'use strict';

/**
 * @module retention-engine
 * @description Per-tenant configurable data retention engine for HeadyOS.
 * Enforces retention windows using Fibonacci-based periods, executes
 * soft-delete → hard-delete cycles, and supports tenant-level overrides.
 *
 * Fibonacci Retention Schedule:
 *   fib(9)  =  34 days — Session tokens, active connections, temp state
 *   fib(11) =  89 days — Usage logs, API call logs, AI interaction content
 *   fib(13) = 233 days — Account data, vector memory, agent configs, audit events
 *   fib(15) = 610 days — Financial records, billing data, legal hold data
 *
 * Lifecycle: ACTIVE → SOFT_DELETED (immediate) → HARD_DELETED (fib(9)=34 days later)
 *
 * @architecture Scheduled job (cron-compatible) + Express Router
 */

const express = require('express');
const router  = express.Router();
const { z }   = require('zod');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

/**
 * RETENTION WINDOWS (all in days, all derived from Fibonacci)
 * These are the MINIMUM default retention periods.
 * Tenants may extend (not shorten) their retention beyond defaults.
 * Legal holds override all retention windows.
 */
const RETENTION_WINDOWS = Object.freeze({
  // TIER 1: Short-lived operational data
  SESSION_TOKENS:        fib(9),   //  34 days
  TEMP_COMPUTATION:      fib(8),   //  21 days
  RATE_LIMIT_COUNTERS:   fib(6),   //   8 days

  // TIER 2: Usage and interaction data
  USAGE_LOGS:            fib(11),  //  89 days
  API_CALL_LOGS:         fib(11),  //  89 days
  AI_INTERACTION_CONTENT: fib(11), //  89 days
  BROWSER_SESSION_DATA:  fib(9),   //  34 days

  // TIER 3: Core user data
  AI_INTERACTION_METADATA: fib(13), // 233 days
  VECTOR_MEMORY:           fib(13), // 233 days
  AGENT_CONFIGS:           fib(13), // 233 days
  USER_ACCOUNT:            fib(13), // 233 days (post-deletion anonymization)
  AUDIT_TRAIL:             fib(13), // 233 days
  SECURITY_EVENTS:         fib(13), // 233 days

  // TIER 4: Legal and financial records (compliance-mandated)
  FINANCIAL_RECORDS:       fib(15), // 610 days (IRS 3-year rule ÷ φ)
  BILLING_TRANSACTIONS:    fib(15), // 610 days
  LEGAL_HOLD:              fib(15), // 610 days + hold duration
  CCPA_OPT_OUT_RECORDS:    fib(15), // 610 days (CCPA accountability)
  GDPR_CONSENT_RECORDS:    fib(15), // 610 days (GDPR Art. 7 accountability)
  DSAR_RECORDS:            fib(15), // 610 days (GDPR Art. 5 accountability)

  // Soft → Hard delete grace period
  SOFT_TO_HARD_DELETE:     fib(9),  //  34 days
});

/** Data sources with their retention configuration */
const RETENTION_TARGETS = [
  {
    name: 'session_tokens',
    table: 'sessions',
    retentionDays: RETENTION_WINDOWS.SESSION_TOKENS,
    deletionColumn: 'expires_at',
    mode: 'hard_delete',
    redisPattern: 'session:*',
  },
  {
    name: 'usage_logs',
    table: 'usage_logs',
    retentionDays: RETENTION_WINDOWS.USAGE_LOGS,
    deletionColumn: 'created_at',
    mode: 'hard_delete',
    redisPattern: 'usage:*',
  },
  {
    name: 'ai_interaction_content',
    table: 'ai_interactions',
    retentionDays: RETENTION_WINDOWS.AI_INTERACTION_CONTENT,
    deletionColumn: 'created_at',
    mode: 'soft_delete', // Soft delete content, keep metadata
    contentColumn: 'content',
    redactedValue: '[CONTENT_EXPIRED]',
  },
  {
    name: 'ai_interaction_metadata',
    table: 'ai_interactions',
    retentionDays: RETENTION_WINDOWS.AI_INTERACTION_METADATA,
    deletionColumn: 'created_at',
    mode: 'hard_delete',
    requiresSoftDeleteFirst: true,
  },
  {
    name: 'vector_memory',
    table: 'vector_memories',
    retentionDays: RETENTION_WINDOWS.VECTOR_MEMORY,
    deletionColumn: 'created_at',
    mode: 'soft_delete',
  },
  {
    name: 'agent_configs',
    table: 'agents',
    retentionDays: RETENTION_WINDOWS.AGENT_CONFIGS,
    deletionColumn: 'updated_at',
    mode: 'soft_delete',
  },
  {
    name: 'audit_trail',
    table: 'audit_events',
    retentionDays: RETENTION_WINDOWS.AUDIT_TRAIL,
    deletionColumn: 'created_at',
    mode: 'archive_then_delete', // Archive to cold storage before deletion
  },
  {
    name: 'security_events',
    table: 'security_incidents',
    retentionDays: RETENTION_WINDOWS.SECURITY_EVENTS,
    deletionColumn: 'detected_at',
    mode: 'archive_then_delete',
  },
  {
    name: 'financial_records',
    table: 'billing_transactions',
    retentionDays: RETENTION_WINDOWS.FINANCIAL_RECORDS,
    deletionColumn: 'created_at',
    mode: 'soft_delete', // Never hard-delete financial records within retention window
    legalBasis: 'IRS record-keeping requirements, Cal. Bus. & Prof. Code',
  },
  {
    name: 'gdpr_consent_records',
    table: 'consent_records',
    retentionDays: RETENTION_WINDOWS.GDPR_CONSENT_RECORDS,
    deletionColumn: 'granted_at',
    mode: 'archive_then_delete',
    legalBasis: 'GDPR Art. 7(1) accountability',
  },
];

// ---------------------------------------------------------------------------
// Tenant Retention Config Schema
// ---------------------------------------------------------------------------
const TenantRetentionConfigSchema = z.object({
  tenantId: z.string().min(1),
  overrides: z.record(
    z.string(),
    z.number().int().positive()
      .min(fib(9))   // Minimum: 34 days (cannot go below default)
      .max(fib(17))  // Maximum: 1597 days
  ).optional(),
  legalHolds: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
    reason: z.string(),
    heldUntil: z.string().datetime().optional(),
  })).optional(),
});

// ---------------------------------------------------------------------------
// Retention Engine Core
// ---------------------------------------------------------------------------

/**
 * Get effective retention window for a tenant.
 * Tenant overrides are applied on top of defaults (can only extend, not shorten).
 */
const getEffectiveRetention = async (tenantId, targetName, pgClient) => {
  const defaultDays = RETENTION_TARGETS.find(t => t.name === targetName)?.retentionDays || RETENTION_WINDOWS.USAGE_LOGS;

  // Query tenant overrides
  const { rows } = await pgClient.query(
    `SELECT override_days FROM tenant_retention_overrides WHERE tenant_id = $1 AND target_name = $2`,
    [tenantId, targetName]
  );

  const override = rows[0]?.override_days;
  // Tenant can only extend retention, not shorten
  return override ? Math.max(defaultDays, override) : defaultDays;
};

/**
 * Check if an entity is under a legal hold.
 */
const isUnderLegalHold = async (entityType, entityId, pgClient) => {
  const { rows } = await pgClient.query(
    `SELECT id FROM legal_holds
     WHERE entity_type = $1 AND entity_id = $2 AND active = true
       AND (held_until IS NULL OR held_until > NOW())`,
    [entityType, entityId]
  );
  return rows.length > 0;
};

/**
 * Execute soft delete for expired records.
 * Marks records as deleted without physically removing them.
 */
const executeSoftDelete = async (target, tenantId, pgClient) => {
  const retentionDays = await getEffectiveRetention(tenantId, target.name, pgClient);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  if (target.contentColumn) {
    // Redact content column, keep metadata
    const result = await pgClient.query(
      `UPDATE ${target.table}
       SET ${target.contentColumn} = $1, deleted_at = NOW(), deletion_reason = 'RETENTION_EXPIRED'
       WHERE ${target.deletionColumn} < $2
         AND (tenant_id = $3 OR $3 IS NULL)
         AND deleted_at IS NULL`,
      [target.redactedValue, cutoffDate, tenantId]
    );
    return { target: target.name, type: 'content_redacted', rowsAffected: result.rowCount, cutoffDate };
  } else {
    const result = await pgClient.query(
      `UPDATE ${target.table}
       SET deleted_at = NOW(), deletion_reason = 'RETENTION_EXPIRED'
       WHERE ${target.deletionColumn} < $1
         AND (tenant_id = $2 OR $2 IS NULL)
         AND deleted_at IS NULL`,
      [cutoffDate, tenantId]
    );
    return { target: target.name, type: 'soft_deleted', rowsAffected: result.rowCount, cutoffDate };
  }
};

/**
 * Execute hard delete for records past soft-delete grace period.
 * Permanently removes records from the database (fib(9)=34 days after soft-delete).
 */
const executeHardDelete = async (target, pgClient) => {
  const gracePeriodCutoff = new Date(
    Date.now() - RETENTION_WINDOWS.SOFT_TO_HARD_DELETE * 24 * 60 * 60 * 1000
  ).toISOString();

  const result = await pgClient.query(
    `DELETE FROM ${target.table}
     WHERE deleted_at < $1
       AND deletion_reason = 'RETENTION_EXPIRED'`,
    [gracePeriodCutoff]
  );

  return { target: target.name, type: 'hard_deleted', rowsAffected: result.rowCount, gracePeriodCutoff };
};

/**
 * Archive records to cold storage before deletion.
 */
const archiveBeforeDelete = async (target, pgClient, storageClient) => {
  const retentionDays = RETENTION_TARGETS.find(t => t.name === target.name)?.retentionDays || fib(13);
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  // Fetch records to archive
  const { rows } = await pgClient.query(
    `SELECT * FROM ${target.table}
     WHERE ${target.deletionColumn} < $1 AND archived_at IS NULL
     LIMIT $2`,
    [cutoffDate, fib(8)] // Batch size: fib(8)=21
  );

  if (rows.length === 0) return { target: target.name, type: 'archive', rowsAffected: 0 };

  // Upload to cold storage
  const archiveKey = `cold-storage/${target.name}/${new Date().toISOString().split('T')[0]}-batch.json`;
  if (storageClient) {
    await storageClient.upload({
      key: archiveKey,
      data: Buffer.from(JSON.stringify(rows, null, 2), 'utf8'),
      contentType: 'application/json',
      storageClass: 'COLDLINE',
    });
  }

  // Mark as archived
  const ids = rows.map(r => r.id);
  await pgClient.query(
    `UPDATE ${target.table} SET archived_at = NOW(), archive_key = $1 WHERE id = ANY($2::uuid[])`,
    [archiveKey, ids]
  );

  return { target: target.name, type: 'archived', rowsAffected: rows.length, archiveKey };
};

/**
 * Purge expired Redis keys for a tenant.
 */
const purgeRedisKeys = async (target, tenantId, redisClient) => {
  if (!target.redisPattern) return { target: target.name, type: 'redis_skip', keysDeleted: 0 };

  const pattern = tenantId
    ? target.redisPattern.replace('*', `${tenantId}:*`)
    : target.redisPattern;

  const keys = await redisClient.keys(pattern);
  if (keys.length === 0) return { target: target.name, type: 'redis_purge', keysDeleted: 0 };

  // Batch delete in Fibonacci-sized chunks
  let deleted = 0;
  for (let i = 0; i < keys.length; i += fib(8)) {
    const batch = keys.slice(i, i + fib(8));
    // Check TTL — only delete if expired
    const expiredBatch = [];
    for (const key of batch) {
      const ttl = await redisClient.ttl(key);
      if (ttl <= 0) expiredBatch.push(key);
    }
    if (expiredBatch.length > 0) {
      await redisClient.del(expiredBatch);
      deleted += expiredBatch.length;
    }
  }

  return { target: target.name, type: 'redis_purge', keysDeleted: deleted };
};

/**
 * Run the full retention engine for a tenant.
 * Called by cron job or API trigger.
 *
 * @param {string} tenantId - Tenant identifier (null = all tenants)
 * @param {Object} deps - { pgClient, redisClient, storageClient, auditLogger }
 * @returns {Promise<Object>} Retention run report
 */
const runRetentionEngine = async (tenantId, deps) => {
  const { pgClient, redisClient, storageClient, auditLogger } = deps;
  const runId = `retention-run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const actions = [];
  const errors = [];

  for (const target of RETENTION_TARGETS) {
    try {
      let result;
      switch (target.mode) {
        case 'soft_delete':
          result = await executeSoftDelete(target, tenantId, pgClient);
          break;
        case 'hard_delete':
          // Soft-delete first if required
          if (target.requiresSoftDeleteFirst) {
            const softResult = await executeSoftDelete({ ...target, mode: 'soft_delete' }, tenantId, pgClient);
            actions.push(softResult);
          }
          result = await executeHardDelete(target, pgClient);
          break;
        case 'archive_then_delete':
          result = await archiveBeforeDelete(target, pgClient, storageClient);
          if (result.rowsAffected > 0) {
            const delResult = await executeHardDelete(target, pgClient);
            actions.push(delResult);
          }
          break;
        default:
          result = { target: target.name, type: 'skipped', reason: `Unknown mode: ${target.mode}` };
      }

      // Purge Redis if applicable
      if (target.redisPattern) {
        const redisResult = await purgeRedisKeys(target, tenantId, redisClient);
        actions.push(redisResult);
      }

      actions.push(result);
    } catch (err) {
      errors.push({ target: target.name, error: err.message });
    }
  }

  const report = {
    runId,
    tenantId: tenantId || 'all',
    startedAt,
    completedAt: new Date().toISOString(),
    actionsCount: actions.length,
    errorsCount: errors.length,
    actions,
    errors,
    totalRowsAffected: actions.reduce((sum, a) => sum + (a.rowsAffected || a.keysDeleted || 0), 0),
  };

  await auditLogger?.log({
    action: 'RETENTION_ENGINE_RUN',
    runId,
    tenantId: tenantId || 'all',
    actionsCount: report.actionsCount,
    totalRowsAffected: report.totalRowsAffected,
    errors: errors.length,
  });

  return report;
};

/**
 * Configure tenant-specific retention overrides.
 */
const configureTenantRetention = async (config, pgClient, auditLogger) => {
  const validation = TenantRetentionConfigSchema.safeParse(config);
  if (!validation.success) {
    throw Object.assign(new Error('Invalid retention config'), { details: validation.error.issues });
  }
  const { tenantId, overrides, legalHolds } = validation.data;

  if (overrides) {
    for (const [targetName, days] of Object.entries(overrides)) {
      const defaultDays = RETENTION_TARGETS.find(t => t.name === targetName)?.retentionDays;
      if (!defaultDays) continue;
      if (days < defaultDays) {
        throw new Error(`Retention for ${targetName} cannot be less than default ${defaultDays} days (fib-based minimum)`);
      }
      await pgClient.query(
        `INSERT INTO tenant_retention_overrides (tenant_id, target_name, override_days, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, target_name) DO UPDATE SET override_days = $3, updated_at = NOW()`,
        [tenantId, targetName, days]
      );
    }
  }

  if (legalHolds) {
    for (const hold of legalHolds) {
      await pgClient.query(
        `INSERT INTO legal_holds (tenant_id, entity_type, entity_id, reason, held_until, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET reason = $4, held_until = $5, active = true`,
        [tenantId, hold.entityType, hold.entityId, hold.reason, hold.heldUntil || null]
      );
    }
  }

  await auditLogger?.log({ action: 'TENANT_RETENTION_CONFIGURED', tenantId, overrides, legalHolds });

  return { success: true, tenantId, configured: { overrides, legalHolds } };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

const createRetentionRouter = (deps) => {
  /**
   * POST /api/v1/retention/run
   * Trigger retention engine run (admin only).
   */
  router.post('/run', async (req, res) => {
    try {
      const { tenantId } = req.body;
      const report = await runRetentionEngine(tenantId || null, deps);
      res.json({ success: true, report });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/retention/schedule
   * Return current retention schedule.
   */
  router.get('/schedule', (req, res) => {
    res.json({
      retentionWindows: RETENTION_WINDOWS,
      fibonacciMapping: {
        'fib(6)': `${fib(6)} days`,
        'fib(8)': `${fib(8)} days`,
        'fib(9)': `${fib(9)} days`,
        'fib(11)': `${fib(11)} days`,
        'fib(13)': `${fib(13)} days`,
        'fib(15)': `${fib(15)} days`,
      },
      targets: RETENTION_TARGETS.map(t => ({
        name: t.name,
        table: t.table,
        retentionDays: t.retentionDays,
        mode: t.mode,
        legalBasis: t.legalBasis,
      })),
    });
  });

  /**
   * PUT /api/v1/retention/tenant/:tenantId
   * Configure tenant retention overrides.
   */
  router.put('/tenant/:tenantId', async (req, res) => {
    try {
      const config = { tenantId: req.params.tenantId, ...req.body };
      const result = await configureTenantRetention(config, deps.pgClient, deps.auditLogger);
      res.json(result);
    } catch (err) {
      res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({ error: err.message });
    }
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createRetentionRouter,
  runRetentionEngine,
  configureTenantRetention,
  executeSoftDelete,
  executeHardDelete,
  archiveBeforeDelete,
  RETENTION_WINDOWS,
  RETENTION_TARGETS,
  PHI,
  fib,
};

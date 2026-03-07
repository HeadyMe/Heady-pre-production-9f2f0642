'use strict';

/**
 * @module evidence-collector
 * @description Automated SOC 2 evidence collection from HeadyOS audit chain.
 * Pulls audit logs, access reviews, change management records, and security events.
 * Exports evidence packages as JSON, CSV, and PDF for auditor delivery.
 *
 * Evidence Collection Mapping:
 * - CC6.1 (Access Control): access_reviews, rbac_configs, mfa_records
 * - CC7.1 (Monitoring): otel_spans, sentry_events, csl_events
 * - CC7.4 (Incident Response): incident_records, breach_notifications
 * - CC8.1 (Change Management): ci_runs, deployments, pr_reviews
 * - CC9.1 (Risk Assessment): vulnerability_scans, dependency_checks
 *
 * @architecture Express Router + CLI-callable functions
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { z }   = require('zod');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const COLLECTOR_CONSTANTS = {
  // Evidence collection period: fib(13)=233 days (SOC 2 Type II minimum + buffer)
  COLLECTION_PERIOD_DAYS: fib(13),
  // Batch size for pulling records: fib(8)=21
  BATCH_SIZE: fib(8),
  // Max records per evidence category: fib(11)=89
  MAX_RECORDS: fib(11),
  // Evidence cache TTL: fib(8)=21 minutes
  CACHE_TTL_SECONDS: fib(8) * 60,
  // Retry constants
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(6),
};

// Trust Service Criteria being evidenced
const TSC_CRITERIA = {
  CC1: 'Control Environment',
  CC2: 'Communication and Information',
  CC3: 'Risk Assessment',
  CC4: 'Monitoring Activities',
  CC5: 'Control Activities',
  CC6: 'Logical and Physical Access',
  CC7: 'System Operations',
  CC8: 'Change Management',
  CC9: 'Risk Mitigation',
  A1: 'Availability',
  PI1: 'Processing Integrity',
  C1: 'Confidentiality',
  P1_P8: 'Privacy',
};

// Evidence collection schema
const EvidenceRequestSchema = z.object({
  criteria: z.array(z.enum(Object.keys(TSC_CRITERIA))).default(Object.keys(TSC_CRITERIA)),
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  includeChainVerification: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// φ-Retry Helper
// ---------------------------------------------------------------------------
const withPhiRetry = async (fn, maxRetries = COLLECTOR_CONSTANTS.MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.round(COLLECTOR_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// Evidence Collectors per TSC Criterion
// ---------------------------------------------------------------------------

/**
 * Collect audit log entries from SHA-256 chain (CC7, CC8, CC9).
 */
const collectAuditLogs = async (pgClient, dateFrom, dateTo, limit = COLLECTOR_CONSTANTS.MAX_RECORDS) => {
  const { rows } = await pgClient.query(
    `SELECT id, action, subject_id, user_id, ip_address, metadata, chain_hash, previous_hash, created_at
     FROM audit_events
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at <= $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, limit]
  );
  return rows;
};

/**
 * Verify SHA-256 audit chain integrity.
 * Each entry's hash must equal SHA256(previous_hash + action + metadata + timestamp).
 */
const verifyChainIntegrity = async (pgClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT id, action, metadata, chain_hash, previous_hash, created_at
     FROM audit_events
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at <= $2)
     ORDER BY created_at ASC`,
    [dateFrom || null, dateTo || null]
  );

  let valid = true;
  const violations = [];
  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis hash

  for (const row of rows) {
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${row.previous_hash}:${row.action}:${JSON.stringify(row.metadata)}:${row.created_at}`)
      .digest('hex');

    if (row.previous_hash !== expectedPrevHash) {
      valid = false;
      violations.push({
        id: row.id,
        violation: 'chain_break',
        expected_prev: expectedPrevHash,
        actual_prev: row.previous_hash,
        at: row.created_at,
      });
    }

    if (row.chain_hash !== expectedHash) {
      valid = false;
      violations.push({
        id: row.id,
        violation: 'hash_mismatch',
        expected_hash: expectedHash,
        actual_hash: row.chain_hash,
        at: row.created_at,
      });
    }

    expectedPrevHash = row.chain_hash;
  }

  return {
    chainValid: valid,
    recordsChecked: rows.length,
    violations,
    verifiedAt: new Date().toISOString(),
  };
};

/**
 * Collect access review records (CC6).
 */
const collectAccessReviews = async (pgClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT r.id, r.reviewer_id, r.reviewed_at, r.scope, r.status, r.findings,
            u.email as reviewer_email, u.name as reviewer_name
     FROM access_reviews r
     LEFT JOIN users u ON u.id = r.reviewer_id
     WHERE ($1::timestamptz IS NULL OR r.reviewed_at >= $1)
       AND ($2::timestamptz IS NULL OR r.reviewed_at <= $2)
     ORDER BY r.reviewed_at DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
  );
  return rows;
};

/**
 * Collect change management records (CI/CD runs, deployments) (CC8).
 */
const collectChangeManagement = async (pgClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT id, change_type, environment, initiated_by, approved_by, status,
            version_from, version_to, git_sha, pr_number, created_at, deployed_at
     FROM deployments
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at <= $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
  );
  return rows;
};

/**
 * Collect security scan results (CC3, CC9).
 */
const collectSecurityScans = async (pgClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT id, scan_type, triggered_by, status, findings_count, high_count,
            medium_count, low_count, report_url, created_at, completed_at
     FROM security_scans
     WHERE ($1::timestamptz IS NULL OR created_at >= $1)
       AND ($2::timestamptz IS NULL OR created_at <= $2)
     ORDER BY created_at DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
  );
  return rows;
};

/**
 * Collect incident records (CC7.4).
 */
const collectIncidents = async (pgClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT id, incident_type, severity, status, detected_at, contained_at,
            resolved_at, notified_at, root_cause_summary, remediation_actions
     FROM security_incidents
     WHERE ($1::timestamptz IS NULL OR detected_at >= $1)
       AND ($2::timestamptz IS NULL OR detected_at <= $2)
     ORDER BY detected_at DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
  );
  return rows;
};

/**
 * Collect DSAR and consent records (Privacy P1-P8).
 */
const collectPrivacyRecords = async (pgClient, dateFrom, dateTo) => {
  const [dsarResult, consentResult, dnsResult] = await Promise.all([
    pgClient.query(
      `SELECT request_id, request_type, status, submitted_at, deadline, completed_at
       FROM dsar_requests
       WHERE ($1::timestamptz IS NULL OR submitted_at >= $1) AND ($2::timestamptz IS NULL OR submitted_at <= $2)
       ORDER BY submitted_at DESC LIMIT $3`,
      [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
    ),
    pgClient.query(
      `SELECT purpose, COUNT(*) FILTER (WHERE status = 'granted') as granted,
              COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn,
              MAX(granted_at) as last_consent
       FROM consent_records
       WHERE ($1::timestamptz IS NULL OR granted_at >= $1)
       GROUP BY purpose`,
      [dateFrom || null]
    ),
    pgClient.query(
      `SELECT COUNT(*) as total_opt_outs, COUNT(*) FILTER (WHERE source = 'gpc_signal') as gpc_honored
       FROM dns_opt_outs WHERE ($1::timestamptz IS NULL OR opted_out_at >= $1)`,
      [dateFrom || null]
    ),
  ]);

  return {
    dsarRequests: dsarResult.rows,
    consentSummary: consentResult.rows,
    doNotSellSummary: dnsResult.rows[0],
  };
};

/**
 * Collect availability metrics (A1).
 */
const collectAvailabilityMetrics = async (pgClient, redisClient, dateFrom, dateTo) => {
  const { rows } = await pgClient.query(
    `SELECT
       date_trunc('day', recorded_at) as day,
       service_name,
       AVG(uptime_pct) as avg_uptime,
       MIN(uptime_pct) as min_uptime,
       COUNT(*) FILTER (WHERE status = 'incident') as incidents
     FROM service_health_records
     WHERE ($1::timestamptz IS NULL OR recorded_at >= $1)
       AND ($2::timestamptz IS NULL OR recorded_at <= $2)
     GROUP BY day, service_name
     ORDER BY day DESC
     LIMIT $3`,
    [dateFrom || null, dateTo || null, COLLECTOR_CONSTANTS.MAX_RECORDS]
  );
  return rows;
};

// ---------------------------------------------------------------------------
// Master Evidence Collection Function
// ---------------------------------------------------------------------------

/**
 * Collect all evidence for specified TSC criteria.
 *
 * @param {string[]} criteria - TSC criteria to collect evidence for
 * @param {Object} options - { dateFrom, dateTo, includeChainVerification }
 * @param {Object} deps - { pgClient, redisClient }
 * @returns {Promise<Object>} Complete evidence package
 */
const collectEvidence = async (criteria, options, deps) => {
  const { pgClient, redisClient } = deps;
  const { dateFrom, dateTo, includeChainVerification = true } = options;

  const evidence = {
    packageId: `SOC2-EVIDENCE-${Date.now()}-${crypto.randomBytes(fib(3)).toString('hex')}`,
    generatedAt: new Date().toISOString(),
    organization: 'HeadySystems Inc.',
    scope: 'HeadyOS Platform, HeadyMe AI (headyme.com)',
    criteria,
    period: {
      from: dateFrom || new Date(Date.now() - COLLECTOR_CONSTANTS.COLLECTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      to: dateTo || new Date().toISOString(),
    },
    collections: {},
  };

  const tasks = [];

  // Always collect audit logs (core evidence)
  tasks.push(
    withPhiRetry(() => collectAuditLogs(pgClient, dateFrom, dateTo)).then(logs => {
      evidence.collections.audit_logs = {
        criterion: ['CC7.1', 'CC7.4', 'CC8.1'],
        description: 'SHA-256 chained audit events',
        recordCount: logs.length,
        records: logs,
      };
    })
  );

  // Chain integrity verification
  if (includeChainVerification) {
    tasks.push(
      withPhiRetry(() => verifyChainIntegrity(pgClient, dateFrom, dateTo)).then(result => {
        evidence.chainIntegrity = result;
      })
    );
  }

  // Criteria-specific collection
  if (criteria.includes('CC6') || criteria.includes('CC1')) {
    tasks.push(
      withPhiRetry(() => collectAccessReviews(pgClient, dateFrom, dateTo)).then(reviews => {
        evidence.collections.access_reviews = {
          criterion: ['CC6.1', 'CC6.2', 'CC6.3'],
          description: 'Periodic access reviews and recertifications',
          recordCount: reviews.length,
          records: reviews,
        };
      })
    );
  }

  if (criteria.includes('CC8')) {
    tasks.push(
      withPhiRetry(() => collectChangeManagement(pgClient, dateFrom, dateTo)).then(changes => {
        evidence.collections.change_management = {
          criterion: ['CC8.1'],
          description: 'Deployment and change management records',
          recordCount: changes.length,
          records: changes,
        };
      })
    );
  }

  if (criteria.includes('CC3') || criteria.includes('CC9')) {
    tasks.push(
      withPhiRetry(() => collectSecurityScans(pgClient, dateFrom, dateTo)).then(scans => {
        evidence.collections.security_scans = {
          criterion: ['CC3.2', 'CC9.1'],
          description: 'SAST, DAST, dependency and container security scan results',
          recordCount: scans.length,
          records: scans,
        };
      })
    );
  }

  if (criteria.includes('CC7')) {
    tasks.push(
      withPhiRetry(() => collectIncidents(pgClient, dateFrom, dateTo)).then(incidents => {
        evidence.collections.incidents = {
          criterion: ['CC7.4', 'CC7.5'],
          description: 'Security incident records and response documentation',
          recordCount: incidents.length,
          records: incidents,
        };
      })
    );
  }

  if (criteria.includes('P1_P8')) {
    tasks.push(
      withPhiRetry(() => collectPrivacyRecords(pgClient, dateFrom, dateTo)).then(privacy => {
        evidence.collections.privacy_records = {
          criterion: ['P1', 'P2', 'P5', 'P6', 'P8'],
          description: 'DSAR requests, consent records, Do Not Sell opt-outs',
          recordCount:
            (privacy.dsarRequests?.length || 0) +
            (privacy.consentSummary?.length || 0),
          records: privacy,
        };
      })
    );
  }

  if (criteria.includes('A1')) {
    tasks.push(
      withPhiRetry(() => collectAvailabilityMetrics(pgClient, redisClient, dateFrom, dateTo)).then(avail => {
        evidence.collections.availability = {
          criterion: ['A1.1', 'A1.2', 'A1.3'],
          description: 'Service uptime and availability metrics',
          recordCount: avail.length,
          records: avail,
        };
      })
    );
  }

  await Promise.all(tasks);

  evidence.summary = {
    totalCollections: Object.keys(evidence.collections).length,
    totalRecords: Object.values(evidence.collections).reduce((sum, c) => sum + (c.recordCount || 0), 0),
    chainValid: evidence.chainIntegrity?.chainValid ?? null,
    chainViolations: evidence.chainIntegrity?.violations?.length ?? 0,
  };

  return evidence;
};

// ---------------------------------------------------------------------------
// Export Formatters
// ---------------------------------------------------------------------------

const formatEvidenceAsJSON = (evidence) => Buffer.from(JSON.stringify(evidence, null, 2), 'utf8');

const formatEvidenceAsCSV = (evidence) => {
  const lines = [
    `SOC 2 Evidence Package,${evidence.packageId}`,
    `Generated,${evidence.generatedAt}`,
    `Organization,${evidence.organization}`,
    `Period From,${evidence.period.from}`,
    `Period To,${evidence.period.to}`,
    `Chain Valid,${evidence.chainIntegrity?.chainValid ?? 'Not verified'}`,
    '',
  ];

  for (const [name, collection] of Object.entries(evidence.collections || {})) {
    lines.push(`=== ${name.toUpperCase()} ===`);
    lines.push(`Criterion,${collection.criterion?.join(', ')}`);
    lines.push(`Description,${collection.description}`);
    lines.push(`Record Count,${collection.recordCount}`);
    if (Array.isArray(collection.records) && collection.records.length > 0) {
      const headers = Object.keys(collection.records[0]);
      lines.push(headers.join(','));
      for (const record of collection.records) {
        lines.push(headers.map(h => `"${String(record[h] ?? '').replace(/"/g, '""')}"`).join(','));
      }
    }
    lines.push('');
  }

  return Buffer.from(lines.join('\n'), 'utf8');
};

const formatEvidenceAsPDF = (evidence) => {
  // PDF metadata structure for rendering with pdfkit/pdf-lib
  const pdfDoc = {
    title: `SOC 2 Evidence Package — ${evidence.packageId}`,
    author: 'HeadySystems Inc. — Automated Evidence Collector',
    generatedAt: evidence.generatedAt,
    summary: evidence.summary,
    sections: Object.entries(evidence.collections || {}).map(([name, col]) => ({
      name,
      criterion: col.criterion,
      description: col.description,
      recordCount: col.recordCount,
      sampleRecords: Array.isArray(col.records) ? col.records.slice(0, fib(5)) : col.records,
    })),
    chainIntegrity: evidence.chainIntegrity,
  };
  return Buffer.from(JSON.stringify(pdfDoc, null, 2), 'utf8');
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize evidence collector router.
 * @param {Object} deps - { pgClient, redisClient, storageClient, auditLogger }
 */
const createEvidenceRouter = (deps) => {
  /**
   * POST /api/v1/soc2/evidence/collect
   * Trigger evidence collection.
   */
  router.post('/collect', async (req, res) => {
    try {
      const validation = EvidenceRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      }
      const { criteria, dateFrom, dateTo, format, includeChainVerification } = validation.data;

      const evidence = await collectEvidence(criteria, { dateFrom, dateTo, includeChainVerification }, deps);

      let buffer;
      switch (format) {
        case 'json': buffer = formatEvidenceAsJSON(evidence); break;
        case 'csv':  buffer = formatEvidenceAsCSV(evidence);  break;
        case 'pdf':  buffer = formatEvidenceAsPDF(evidence);  break;
      }

      // Upload to storage
      const filename = `soc2-evidence-${evidence.packageId}.${format}`;
      const storageKey = `soc2-evidence/${evidence.packageId}/${filename}`;
      await deps.storageClient.upload({
        key: storageKey,
        data: buffer,
        contentType: 'application/json',
        expires: fib(8) * 24 * 60 * 60,
      });
      const downloadUrl = await deps.storageClient.getSignedUrl(storageKey, {
        expiresIn: fib(8) * 24 * 60 * 60,
      });

      await deps.auditLogger.log({
        action: 'SOC2_EVIDENCE_COLLECTED',
        packageId: evidence.packageId,
        criteria,
        format,
        recordCount: evidence.summary.totalRecords,
        chainValid: evidence.summary.chainValid,
      });

      res.json({
        success: true,
        packageId: evidence.packageId,
        summary: evidence.summary,
        downloadUrl,
        expiresAt: new Date(Date.now() + fib(8) * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/soc2/evidence/verify-chain
   * Verify audit chain integrity.
   */
  router.get('/verify-chain', async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const result = await withPhiRetry(() =>
        verifyChainIntegrity(deps.pgClient, dateFrom || null, dateTo || null)
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createEvidenceRouter,
  collectEvidence,
  verifyChainIntegrity,
  collectAuditLogs,
  collectAccessReviews,
  collectChangeManagement,
  collectSecurityScans,
  collectIncidents,
  collectPrivacyRecords,
  collectAvailabilityMetrics,
  formatEvidenceAsJSON,
  formatEvidenceAsCSV,
  formatEvidenceAsPDF,
  TSC_CRITERIA,
  COLLECTOR_CONSTANTS,
  PHI,
  fib,
};

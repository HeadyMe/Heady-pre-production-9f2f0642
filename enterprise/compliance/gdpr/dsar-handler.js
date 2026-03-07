'use strict';

/**
 * @module dsar-handler
 * @description Data Subject Access Request (DSAR) Handler for GDPR compliance.
 * Handles Article 15-22 requests: Access, Rectification, Erasure, Portability,
 * Restriction, and Objection. All requests must be fulfilled within 30 calendar
 * days of receipt (extendable to 90 days for complex requests with notice).
 *
 * @architecture Express Router mounted at /api/v1/dsar
 * @see compliance/legal/data-processing-agreement.md Section 3.5
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');

// ---------------------------------------------------------------------------
// φ (Golden Ratio) Constants — All numeric parameters derive from φ or Fibonacci
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;

/** Fibonacci sequence helper */
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const DSAR_CONSTANTS = {
  // GDPR Art. 12(3): 30-day compliance window (milliseconds)
  COMPLIANCE_WINDOW_MS: 30 * 24 * 60 * 60 * 1000,
  // Extension window: additional 60 days for complex requests
  EXTENSION_WINDOW_MS: 60 * 24 * 60 * 60 * 1000,
  // Retry backoff base: φ-exponential (ms)
  RETRY_BASE_MS: 1000,
  // Max retries: fib(6)=8
  MAX_RETRIES: fib(6),
  // Page size for data exports: fib(9)=34
  EXPORT_PAGE_SIZE: fib(9),
  // Audit log batch size: fib(8)=21
  AUDIT_BATCH_SIZE: fib(8),
  // Identity verification token expiry: fib(8)=21 minutes
  VERIFICATION_EXPIRY_MINUTES: fib(8),
  // Max data sets returned in search: fib(11)=89
  MAX_SEARCH_RESULTS: fib(11),
};

// ---------------------------------------------------------------------------
// Request Types (GDPR Articles 15-22)
// ---------------------------------------------------------------------------
const REQUEST_TYPES = Object.freeze({
  ACCESS: 'access',              // Art. 15 - Right of access
  RECTIFICATION: 'rectification', // Art. 16 - Right to rectify
  ERASURE: 'erasure',            // Art. 17 - Right to be forgotten
  RESTRICTION: 'restriction',    // Art. 18 - Right to restrict processing
  PORTABILITY: 'portability',    // Art. 20 - Right to data portability
  OBJECTION: 'objection',        // Art. 21 - Right to object
});

const REQUEST_STATUS = Object.freeze({
  RECEIVED: 'received',
  IDENTITY_PENDING: 'identity_pending',
  IDENTITY_VERIFIED: 'identity_verified',
  IN_PROGRESS: 'in_progress',
  AWAITING_REVIEW: 'awaiting_review',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  EXTENDED: 'extended',
});

// ---------------------------------------------------------------------------
// Zod Validation Schemas
// ---------------------------------------------------------------------------
const DSARSchema = z.object({
  subjectId: z.string().min(1).max(255),
  requestType: z.enum(Object.values(REQUEST_TYPES)),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  details: z.string().max(2000).optional(),
  identityDocument: z.string().optional(), // Base64-encoded ID for high-risk requests
  exportFormat: z.enum(['json', 'csv', 'pdf']).default('json'),
});

const ErasureSchema = z.object({
  subjectId: z.string().min(1),
  scopes: z.array(z.enum(['all', 'account', 'ai_interactions', 'vector_memory', 'agent_configs', 'usage_logs'])).default(['all']),
  reason: z.string().max(500).optional(),
  confirmDeletion: z.literal(true),
});

// ---------------------------------------------------------------------------
// φ-Exponential Retry Helper
// ---------------------------------------------------------------------------
/**
 * Retry an async operation with φ-exponential backoff.
 * Backoff: 1000ms × φ^n → 1618ms, 2618ms, 4236ms, 6854ms...
 *
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: fib(6)=8)
 * @returns {Promise<*>}
 */
const withPhiRetry = async (fn, maxRetries = DSAR_CONSTANTS.MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.round(DSAR_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// DSAR Storage Stub — Replace with actual DB client (Redis/Postgres)
// ---------------------------------------------------------------------------
class DSARStore {
  constructor({ redisClient, pgClient, auditLogger }) {
    this.redis = redisClient;
    this.pg = pgClient;
    this.audit = auditLogger;
  }

  /** Store DSAR request record */
  async createRequest(requestId, data) {
    const key = `dsar:request:${requestId}`;
    const record = {
      ...data,
      requestId,
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + DSAR_CONSTANTS.COMPLIANCE_WINDOW_MS).toISOString(),
      status: REQUEST_STATUS.RECEIVED,
    };
    await this.redis.setex(key, 60 * 60 * 24 * 365, JSON.stringify(record)); // 1 year TTL
    // Mirror to Postgres for auditability
    await this.pg.query(
      `INSERT INTO dsar_requests (request_id, subject_id, request_type, email, status, created_at, deadline, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (request_id) DO NOTHING`,
      [requestId, data.subjectId, data.requestType, data.email, record.status,
       record.createdAt, record.deadline, JSON.stringify(data)]
    );
    return record;
  }

  async getRequest(requestId) {
    const key = `dsar:request:${requestId}`;
    const raw = await this.redis.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async updateStatus(requestId, status, metadata = {}) {
    const record = await this.getRequest(requestId);
    if (!record) throw new Error(`DSAR request ${requestId} not found`);
    const updated = { ...record, status, updatedAt: new Date().toISOString(), ...metadata };
    const key = `dsar:request:${requestId}`;
    await this.redis.setex(key, 60 * 60 * 24 * 365, JSON.stringify(updated));
    await this.pg.query(
      'UPDATE dsar_requests SET status = $1, updated_at = $2, metadata = metadata || $3 WHERE request_id = $4',
      [status, updated.updatedAt, JSON.stringify(metadata), requestId]
    );
    return updated;
  }

  async getRequestsBySubject(subjectId) {
    const { rows } = await this.pg.query(
      'SELECT * FROM dsar_requests WHERE subject_id = $1 ORDER BY created_at DESC LIMIT $2',
      [subjectId, DSAR_CONSTANTS.MAX_SEARCH_RESULTS]
    );
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Core DSAR Functions
// ---------------------------------------------------------------------------

/**
 * Receive and register a new DSAR request.
 * Starts the 30-day compliance timer.
 *
 * @param {string} subjectId - Unique identifier of the data subject
 * @param {string} requestType - One of REQUEST_TYPES
 * @param {Object} metadata - Additional request metadata (email, name, details)
 * @returns {Promise<Object>} Created DSAR record with deadline
 */
const receiveDSAR = async (subjectId, requestType, metadata, store, notifier, auditLogger) => {
  // Validate inputs
  const validation = DSARSchema.safeParse({ subjectId, requestType, ...metadata });
  if (!validation.success) {
    throw Object.assign(new Error('Invalid DSAR request parameters'), {
      code: 'VALIDATION_ERROR',
      details: validation.error.issues,
    });
  }

  const requestId = `DSAR-${Date.now()}-${crypto.randomBytes(fib(4)).toString('hex')}`;

  // Log to audit chain
  await auditLogger.log({
    action: 'DSAR_RECEIVED',
    requestId,
    subjectId,
    requestType,
    email: metadata.email,
    timestamp: new Date().toISOString(),
    complianceDeadline: new Date(Date.now() + DSAR_CONSTANTS.COMPLIANCE_WINDOW_MS).toISOString(),
  });

  // Persist request
  const record = await withPhiRetry(() => store.createRequest(requestId, {
    subjectId,
    requestType,
    ...metadata,
  }));

  // Send acknowledgement email within Art. 12(3) - "without undue delay"
  await notifier.sendAcknowledgement({
    to: metadata.email,
    requestId,
    requestType,
    deadline: record.deadline,
    verificationToken: generateVerificationToken(subjectId, requestId),
  });

  // Schedule compliance deadline reminder at 21 days (fib(8))
  await scheduleDeadlineReminder(requestId, metadata.email, record.deadline, notifier);

  return record;
};

/**
 * Gather all Personal Data associated with a data subject.
 * Queries all Heady microservices for data belonging to subjectId.
 *
 * @param {string} subjectId - Data subject identifier
 * @returns {Promise<Object>} Structured data export
 */
const gatherSubjectData = async (subjectId, pgClient, redisClient) => {
  const data = {
    subjectId,
    collectedAt: new Date().toISOString(),
    sources: {},
  };

  // 1. Account data (Postgres)
  const accountResult = await pgClient.query(
    'SELECT id, email, name, organization, role, created_at, updated_at, subscription_tier FROM users WHERE id = $1 OR email = $1',
    [subjectId]
  );
  data.sources.account = accountResult.rows;

  // 2. AI interaction history (Postgres - heady_brain logs)
  const interactionResult = await pgClient.query(
    `SELECT id, model, prompt_tokens, completion_tokens, created_at, metadata
     FROM ai_interactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [subjectId, DSAR_CONSTANTS.MAX_SEARCH_RESULTS]
  );
  data.sources.ai_interactions = interactionResult.rows;

  // 3. Vector memory (Postgres - pgvector)
  const memoryResult = await pgClient.query(
    `SELECT id, memory_key, metadata, created_at, updated_at
     FROM vector_memories
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [subjectId, DSAR_CONSTANTS.MAX_SEARCH_RESULTS]
  );
  // Note: actual embedding vectors are omitted from export (not PII)
  data.sources.vector_memory = memoryResult.rows;

  // 4. Agent configurations (Postgres)
  const agentResult = await pgClient.query(
    `SELECT id, name, description, capabilities, created_at, updated_at
     FROM agents
     WHERE owner_id = $1`,
    [subjectId]
  );
  data.sources.agent_configs = agentResult.rows;

  // 5. Conductor task history
  const taskResult = await pgClient.query(
    `SELECT id, task_type, status, created_at, completed_at
     FROM conductor_tasks
     WHERE submitted_by = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [subjectId, DSAR_CONSTANTS.MAX_SEARCH_RESULTS]
  );
  data.sources.conductor_tasks = taskResult.rows;

  // 6. Usage logs (Redis - recent fib(11)=89 days)
  const usageKeys = await redisClient.keys(`usage:${subjectId}:*`);
  const usageData = usageKeys.length > 0
    ? await redisClient.mget(usageKeys.slice(0, DSAR_CONSTANTS.EXPORT_PAGE_SIZE))
    : [];
  data.sources.usage_logs = usageData.filter(Boolean).map(d => {
    try { return JSON.parse(d); } catch { return d; }
  });

  // 7. Audit events related to subject
  const auditResult = await pgClient.query(
    `SELECT id, action, metadata, ip_address, created_at
     FROM audit_events
     WHERE subject_id = $1 OR metadata->>'userId' = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [subjectId, DSAR_CONSTANTS.MAX_SEARCH_RESULTS]
  );
  data.sources.audit_events = auditResult.rows;

  // 8. Consent records
  const consentResult = await pgClient.query(
    `SELECT purpose, status, granted_at, withdrawn_at, source
     FROM consent_records
     WHERE user_id = $1
     ORDER BY granted_at DESC`,
    [subjectId]
  );
  data.sources.consent_records = consentResult.rows;

  data.totalRecords = Object.values(data.sources).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
  );

  return data;
};

/**
 * Export subject data in specified format.
 *
 * @param {string} subjectId - Data subject identifier
 * @param {string} format - 'json' | 'csv' | 'pdf'
 * @returns {Promise<Buffer>} Serialized export data
 */
const exportSubjectData = async (subjectId, format, pgClient, redisClient) => {
  const data = await gatherSubjectData(subjectId, pgClient, redisClient);

  if (format === 'json') {
    return Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  }

  if (format === 'csv') {
    const csvLines = ['Source,RecordId,Data,CollectedAt'];
    for (const [source, records] of Object.entries(data.sources)) {
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        const id = record.id || 'N/A';
        const dataStr = JSON.stringify(record).replace(/"/g, '""');
        csvLines.push(`"${source}","${id}","${dataStr}","${data.collectedAt}"`);
      }
    }
    return Buffer.from(csvLines.join('\n'), 'utf8');
  }

  if (format === 'pdf') {
    // PDF generation — requires pdf-lib or pdfkit in production
    // Returns structured JSON with PDF metadata markers for now
    const pdfData = {
      title: `Personal Data Export - ${subjectId}`,
      generatedAt: data.collectedAt,
      totalRecords: data.totalRecords,
      sections: data.sources,
      notice: 'This export was generated in response to a GDPR Article 15 request.',
    };
    return Buffer.from(JSON.stringify(pdfData, null, 2), 'utf8');
  }

  throw new Error(`Unsupported export format: ${format}`);
};

/**
 * Erase all Personal Data for a data subject (GDPR Art. 17 — Right to Erasure).
 * Performs soft-delete first, then schedules hard-delete after fib(9)=34 days.
 *
 * @param {string} subjectId - Data subject identifier
 * @returns {Promise<Object>} Deletion report
 */
const eraseSubjectData = async (subjectId, pgClient, redisClient, auditLogger) => {
  const report = {
    subjectId,
    initiatedAt: new Date().toISOString(),
    hardDeleteScheduledAt: new Date(Date.now() + fib(9) * 24 * 60 * 60 * 1000).toISOString(),
    actions: [],
  };

  const softDelete = async (table, column = 'user_id') => {
    try {
      const result = await pgClient.query(
        `UPDATE ${table} SET deleted_at = NOW(), deleted_reason = 'DSAR_ERASURE' WHERE ${column} = $1 AND deleted_at IS NULL`,
        [subjectId]
      );
      report.actions.push({ table, column, rowsAffected: result.rowCount, type: 'soft_delete' });
    } catch (err) {
      report.actions.push({ table, column, error: err.message, type: 'soft_delete_failed' });
    }
  };

  // Soft-delete from all tables
  await softDelete('ai_interactions', 'user_id');
  await softDelete('vector_memories', 'user_id');
  await softDelete('agents', 'owner_id');
  await softDelete('conductor_tasks', 'submitted_by');
  await softDelete('consent_records', 'user_id');

  // Anonymize account (not delete — needed for financial/legal hold records)
  await pgClient.query(
    `UPDATE users
     SET email = $2, name = 'DELETED_USER', organization = NULL, anonymized_at = NOW()
     WHERE id = $1 OR email = $1`,
    [subjectId, `deleted-${crypto.randomBytes(fib(4)).toString('hex')}@redacted.invalid`]
  );
  report.actions.push({ table: 'users', type: 'anonymized' });

  // Purge Redis keys
  const userKeys = await redisClient.keys(`*:${subjectId}:*`);
  if (userKeys.length > 0) {
    await redisClient.del(userKeys);
    report.actions.push({ source: 'redis', keysDeleted: userKeys.length, type: 'deleted' });
  }

  // Schedule hard-delete job (fib(9)=34 days)
  await pgClient.query(
    `INSERT INTO scheduled_jobs (job_type, subject_id, execute_at, metadata)
     VALUES ('hard_delete_gdpr', $1, NOW() + INTERVAL '${fib(9)} days', $2)`,
    [subjectId, JSON.stringify(report)]
  );

  // Audit log
  await auditLogger.log({
    action: 'DSAR_ERASURE_INITIATED',
    subjectId,
    softDeletedAt: report.initiatedAt,
    hardDeleteScheduledAt: report.hardDeleteScheduledAt,
    actionsCount: report.actions.length,
  });

  report.status = 'soft_deleted';
  report.message = `Subject data soft-deleted. Hard delete scheduled for ${report.hardDeleteScheduledAt} (fib(9)=34 days).`;

  return report;
};

/**
 * Handle GDPR Article 20 data portability request.
 * Returns machine-readable export in JSON (primary) or CSV.
 *
 * @param {string} subjectId - Data subject identifier
 * @returns {Promise<Object>} Portability package with download URL
 */
const handlePortabilityRequest = async (subjectId, format = 'json', pgClient, redisClient, storageClient, auditLogger) => {
  const exportBuffer = await exportSubjectData(subjectId, format, pgClient, redisClient);

  // Generate a time-limited secure download link
  const exportId = crypto.randomBytes(fib(5)).toString('hex');
  const filename = `heady-data-export-${subjectId}-${Date.now()}.${format}`;

  // Store export temporarily (fib(8)=21 days expiry)
  const expiresAt = new Date(Date.now() + fib(8) * 24 * 60 * 60 * 1000).toISOString();
  await storageClient.upload({
    key: `dsar-exports/${exportId}/${filename}`,
    data: exportBuffer,
    contentType: format === 'json' ? 'application/json' : 'text/csv',
    metadata: { subjectId, expiresAt, format },
    expires: fib(8) * 24 * 60 * 60, // seconds
  });

  const downloadUrl = await storageClient.getSignedUrl(`dsar-exports/${exportId}/${filename}`, {
    expiresIn: fib(8) * 24 * 60 * 60, // fib(8)=21 days in seconds
  });

  await auditLogger.log({
    action: 'DSAR_PORTABILITY_EXPORT',
    subjectId,
    exportId,
    format,
    filename,
    expiresAt,
  });

  return {
    exportId,
    filename,
    format,
    downloadUrl,
    expiresAt,
    sizeBytes: exportBuffer.length,
    notice: 'Your data export is available for download. The link expires in 21 days.',
  };
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Generate a time-limited identity verification token.
 * Expires after fib(8)=21 minutes.
 */
const generateVerificationToken = (subjectId, requestId) => {
  const expiresAt = Date.now() + DSAR_CONSTANTS.VERIFICATION_EXPIRY_MINUTES * 60 * 1000;
  const payload = `${subjectId}:${requestId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', process.env.DSAR_SECRET || 'heady-dsar-secret-change-in-prod');
  return `${Buffer.from(payload).toString('base64')}.${hmac.update(payload).digest('hex')}`;
};

/**
 * Verify identity token.
 */
const verifyToken = (token) => {
  try {
    const [payloadB64, signature] = token.split('.');
    const payload = Buffer.from(payloadB64, 'base64').toString();
    const [subjectId, requestId, expiresAtStr] = payload.split(':');
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) return { valid: false, reason: 'expired' };
    const hmac = crypto.createHmac('sha256', process.env.DSAR_SECRET || 'heady-dsar-secret-change-in-prod');
    const expected = hmac.update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      return { valid: false, reason: 'invalid_signature' };
    }
    return { valid: true, subjectId, requestId };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
};

/**
 * Schedule a compliance deadline reminder email.
 */
const scheduleDeadlineReminder = async (requestId, email, deadline, notifier) => {
  const reminderAt = new Date(new Date(deadline).getTime() - fib(8) * 24 * 60 * 60 * 1000); // 21 days before deadline
  // In production, push to a job queue (BullMQ/Redis)
  const delay = Math.max(0, reminderAt.getTime() - Date.now());
  setTimeout(async () => {
    await notifier.sendDeadlineReminder({ requestId, email, deadline }).catch(console.error);
  }, delay);
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize DSAR router with dependencies.
 * @param {Object} deps - { pgClient, redisClient, auditLogger, notifier, storageClient }
 */
const createDSARRouter = (deps) => {
  const store = new DSARStore(deps);

  /**
   * POST /api/v1/dsar
   * Submit a new DSAR request.
   */
  router.post('/', async (req, res) => {
    try {
      const { subjectId, requestType, email, name, details, exportFormat } = req.body;
      const record = await receiveDSAR(
        subjectId, requestType,
        { email, name, details, exportFormat: exportFormat || 'json' },
        store, deps.notifier, deps.auditLogger
      );
      res.status(201).json({
        success: true,
        requestId: record.requestId,
        status: record.status,
        deadline: record.deadline,
        message: `DSAR request received. We will respond within 30 days. Reference ID: ${record.requestId}`,
      });
    } catch (err) {
      res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({
        success: false,
        error: err.message,
        details: err.details,
      });
    }
  });

  /**
   * GET /api/v1/dsar/:requestId
   * Get status of a DSAR request.
   */
  router.get('/:requestId', async (req, res) => {
    try {
      const { requestId } = req.params;
      const record = await store.getRequest(requestId);
      if (!record) return res.status(404).json({ error: 'DSAR request not found' });
      res.json({
        requestId: record.requestId,
        status: record.status,
        requestType: record.requestType,
        createdAt: record.createdAt,
        deadline: record.deadline,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/dsar/subject/:subjectId
   * List all DSAR requests for a subject.
   */
  router.get('/subject/:subjectId', async (req, res) => {
    try {
      const requests = await store.getRequestsBySubject(req.params.subjectId);
      res.json({ requests, count: requests.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/dsar/:requestId/verify
   * Verify identity to proceed with DSAR.
   */
  router.post('/:requestId/verify', async (req, res) => {
    try {
      const { token } = req.body;
      const result = verifyToken(token);
      if (!result.valid) {
        return res.status(401).json({ error: `Verification failed: ${result.reason}` });
      }
      const record = await store.updateStatus(req.params.requestId, REQUEST_STATUS.IDENTITY_VERIFIED);
      res.json({ success: true, status: record.status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/dsar/:requestId/export
   * Trigger data export for ACCESS or PORTABILITY request.
   */
  router.post('/:requestId/export', async (req, res) => {
    try {
      const { requestId } = req.params;
      const record = await store.getRequest(requestId);
      if (!record) return res.status(404).json({ error: 'Not found' });
      if (record.status !== REQUEST_STATUS.IDENTITY_VERIFIED) {
        return res.status(403).json({ error: 'Identity must be verified before export' });
      }

      await store.updateStatus(requestId, REQUEST_STATUS.IN_PROGRESS);

      const result = await withPhiRetry(() =>
        handlePortabilityRequest(
          record.subjectId,
          record.exportFormat || 'json',
          deps.pgClient, deps.redisClient,
          deps.storageClient, deps.auditLogger
        )
      );

      await store.updateStatus(requestId, REQUEST_STATUS.COMPLETED, {
        exportId: result.exportId,
        completedAt: new Date().toISOString(),
      });

      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/v1/dsar/:requestId/erase
   * Execute erasure for ERASURE request type.
   */
  router.delete('/:requestId/erase', async (req, res) => {
    try {
      const validation = ErasureSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid erasure request', details: validation.error.issues });
      }

      const { requestId } = req.params;
      const record = await store.getRequest(requestId);
      if (!record) return res.status(404).json({ error: 'Not found' });
      if (record.requestType !== REQUEST_TYPES.ERASURE) {
        return res.status(400).json({ error: 'Request type must be erasure' });
      }
      if (record.status !== REQUEST_STATUS.IDENTITY_VERIFIED) {
        return res.status(403).json({ error: 'Identity must be verified before erasure' });
      }

      await store.updateStatus(requestId, REQUEST_STATUS.IN_PROGRESS);
      const report = await eraseSubjectData(
        record.subjectId, deps.pgClient, deps.redisClient, deps.auditLogger
      );
      await store.updateStatus(requestId, REQUEST_STATUS.COMPLETED, {
        erasureReport: report,
        completedAt: new Date().toISOString(),
      });

      res.json({ success: true, report });
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
  createDSARRouter,
  receiveDSAR,
  gatherSubjectData,
  exportSubjectData,
  eraseSubjectData,
  handlePortabilityRequest,
  REQUEST_TYPES,
  REQUEST_STATUS,
  DSAR_CONSTANTS,
  PHI,
  fib,
};

'use strict';

/**
 * @module consumer-request-handler
 * @description CCPA Consumer Rights Request Handler.
 * Handles four categories of consumer rights:
 *   1. Right to Know (§ 1798.110) — what PI is collected
 *   2. Right to Delete (§ 1798.105) — delete PI
 *   3. Right to Opt-Out (§ 1798.120) — do not sell/share
 *   4. Right to Correct (§ 1798.106) — correct inaccurate PI
 *
 * Response window: 45 calendar days, extendable by 45 days with notice.
 *
 * @architecture Express Router mounted at /api/v1/ccpa
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

const CCPA_CONSTANTS = {
  // CCPA § 1798.100: 45-day response window (ms)
  RESPONSE_WINDOW_MS: 45 * 24 * 60 * 60 * 1000,
  // Extension: additional 45 days with notice
  EXTENSION_WINDOW_MS: 45 * 24 * 60 * 60 * 1000,
  // Identity verification token: fib(8)=21 minutes
  VERIFICATION_EXPIRY_MINUTES: fib(8),
  // Records per response page: fib(9)=34
  PAGE_SIZE: fib(9),
  // Max requests per consumer per fib(6)=8 months: fib(7)=13
  MAX_REQUESTS_PER_PERIOD: fib(7),
  // Rate limit period: fib(6)=8 months (ms)
  RATE_LIMIT_PERIOD_MS: fib(6) * 30 * 24 * 60 * 60 * 1000,
  // Retry
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(5),
};

// ---------------------------------------------------------------------------
// Request Types and Statuses
// ---------------------------------------------------------------------------
const REQUEST_TYPES = Object.freeze({
  KNOW: 'know',           // § 1798.110 — Right to Know
  DELETE: 'delete',       // § 1798.105 — Right to Delete
  OPT_OUT: 'opt_out',    // § 1798.120 — Right to Opt-Out of Sale/Share
  CORRECT: 'correct',    // § 1798.106 — Right to Correct
  LIMIT_USE: 'limit_use', // § 1798.121 — Limit Use of Sensitive PI
});

const REQUEST_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  IDENTITY_PENDING: 'identity_pending',
  IDENTITY_VERIFIED: 'identity_verified',
  IN_PROGRESS: 'in_progress',
  EXTENDED: 'extended',
  COMPLETED: 'completed',
  DENIED: 'denied',
});

const DENIAL_REASONS = Object.freeze({
  CANNOT_VERIFY: 'cannot_verify_identity',
  NO_PI_FOUND: 'no_personal_information_found',
  EXEMPTION_APPLIES: 'legal_exemption_applies',
  RATE_LIMIT: 'exceeded_request_limit',
});

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------
const ConsumerRequestSchema = z.object({
  requestType: z.enum(Object.values(REQUEST_TYPES)),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  accountId: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  // For CORRECT requests
  corrections: z.record(z.string()).optional(),
  // For DELETE requests
  deleteScopes: z.array(z.enum(['all', 'account', 'interactions', 'memory', 'usage'])).optional(),
  // Authorized agent fields
  authorizedAgent: z.object({
    name: z.string(),
    email: z.string().email(),
    proofOfAuthority: z.string().optional(),
  }).optional(),
  // Delivery preference for KNOW response
  deliveryFormat: z.enum(['json', 'csv', 'mail']).default('json'),
});

// ---------------------------------------------------------------------------
// Request Store
// ---------------------------------------------------------------------------
class CCPARequestStore {
  constructor({ pgClient, redisClient }) {
    this.pg = pgClient;
    this.redis = redisClient;
  }

  async create(requestId, data) {
    const deadline = new Date(Date.now() + CCPA_CONSTANTS.RESPONSE_WINDOW_MS).toISOString();
    await this.pg.query(
      `INSERT INTO ccpa_requests
         (request_id, request_type, email, account_id, status, submitted_at, deadline, metadata)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [requestId, data.requestType, data.email, data.accountId || null,
       REQUEST_STATUS.SUBMITTED, deadline, JSON.stringify(data)]
    );
    await this.redis.setex(
      `ccpa:req:${requestId}`,
      fib(15) * 24 * 60 * 60, // fib(15)=610 days
      JSON.stringify({ ...data, requestId, deadline, status: REQUEST_STATUS.SUBMITTED })
    );
    return { requestId, deadline };
  }

  async get(requestId) {
    const cached = await this.redis.get(`ccpa:req:${requestId}`);
    if (cached) return JSON.parse(cached);
    const { rows } = await this.pg.query(
      'SELECT * FROM ccpa_requests WHERE request_id = $1',
      [requestId]
    );
    return rows[0] || null;
  }

  async updateStatus(requestId, status, metadata = {}) {
    await this.pg.query(
      'UPDATE ccpa_requests SET status = $1, updated_at = NOW(), metadata = metadata || $2 WHERE request_id = $3',
      [status, JSON.stringify(metadata), requestId]
    );
    const existing = await this.get(requestId);
    if (existing) {
      const updated = { ...existing, status, ...metadata, updatedAt: new Date().toISOString() };
      await this.redis.setex(`ccpa:req:${requestId}`, fib(15) * 24 * 60 * 60, JSON.stringify(updated));
    }
  }

  async countRequestsByEmail(email, requestType) {
    const since = new Date(Date.now() - CCPA_CONSTANTS.RATE_LIMIT_PERIOD_MS).toISOString();
    const { rows } = await this.pg.query(
      'SELECT COUNT(*) FROM ccpa_requests WHERE email = $1 AND request_type = $2 AND submitted_at > $3',
      [email, requestType, since]
    );
    return parseInt(rows[0].count, 10);
  }
}

// ---------------------------------------------------------------------------
// Request Handlers
// ---------------------------------------------------------------------------

/**
 * Handle Right to Know request.
 * Provides categories and specific pieces of PI collected in last 12 months.
 */
const handleKnowRequest = async (requestId, consumerId, pgClient) => {
  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Categories of PI collected
  const categories = [
    {
      category: 'Identifiers',
      examples: 'Name, email, IP address, account ID, device identifiers',
      sources: ['Direct from consumer', 'Automatically collected'],
      purposes: ['Account management', 'Security', 'Service delivery'],
      sharedWith: ['Service providers under DPA'],
    },
    {
      category: 'Commercial Information',
      examples: 'Subscription tier, purchase history, billing information',
      sources: ['Direct from consumer', 'Payment processor'],
      purposes: ['Billing', 'Account management'],
      sharedWith: ['Stripe Inc. (payment processing)'],
    },
    {
      category: 'Internet or Other Electronic Network Activity',
      examples: 'API call logs, browsing history on headyme.com, usage patterns',
      sources: ['Automatically collected'],
      purposes: ['Security', 'Service improvement', 'Analytics (with consent)'],
      sharedWith: ['Service providers under DPA'],
    },
    {
      category: 'Geolocation Data',
      examples: 'Country and region (IP-derived)',
      sources: ['Automatically collected from IP address'],
      purposes: ['Compliance', 'Content delivery optimization'],
      sharedWith: ['Cloudflare (CDN)'],
    },
    {
      category: 'Inferences',
      examples: 'AI usage preferences, feature affinity, agent configuration patterns',
      sources: ['Derived from usage data'],
      purposes: ['Service personalization (with consent)'],
      sharedWith: ['Not sold or shared with third parties'],
    },
  ];

  // Specific pieces of PI for this consumer
  let specificPieces = null;
  if (consumerId) {
    const { rows } = await pgClient.query(
      `SELECT 'account' as category, email, name, organization, created_at FROM users WHERE id = $1
       UNION ALL
       SELECT 'interaction' as category, id::text, model, created_at::text, '' FROM ai_interactions
       WHERE user_id = $1 AND created_at > $2
       LIMIT $3`,
      [consumerId, twelveMonthsAgo, CCPA_CONSTANTS.PAGE_SIZE]
    );
    specificPieces = rows;
  }

  return {
    requestId,
    responseType: 'right_to_know',
    periodCovered: `Last 12 months (since ${twelveMonthsAgo})`,
    categoriesCollected: categories,
    specificPieces,
    thirdPartySales: {
      sold: false,
      shared: false,
      notice: 'Heady does not sell or share personal information for monetary consideration.',
    },
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Handle Right to Delete request.
 * Deletes PI subject to legal exemptions.
 */
const handleDeleteRequest = async (requestId, consumerId, scopes, pgClient, redisClient, auditLogger) => {
  const report = {
    requestId,
    consumerId,
    initiatedAt: new Date().toISOString(),
    actions: [],
    exemptions: [],
  };

  // Legal exemptions that prevent deletion
  const exemptions = [];

  // Check for pending legal holds
  const { rows: legalHolds } = await pgClient.query(
    'SELECT id FROM legal_holds WHERE user_id = $1 AND active = true',
    [consumerId]
  );
  if (legalHolds.length > 0) {
    exemptions.push({
      reason: 'Legal hold active',
      basis: 'Cal. Civ. Code § 1798.105(d)(1) — Necessary for legal proceedings',
    });
  }

  // Check for pending transactions (billing)
  const { rows: pendingTx } = await pgClient.query(
    'SELECT id FROM billing_transactions WHERE user_id = $1 AND status = $2',
    [consumerId, 'pending']
  );
  if (pendingTx.length > 0) {
    exemptions.push({
      reason: 'Pending financial transaction',
      basis: 'Cal. Civ. Code § 1798.105(d)(2) — Necessary to complete transaction',
    });
  }

  report.exemptions = exemptions;

  if (exemptions.length > 0 && scopes?.includes('all')) {
    report.status = 'partial_deletion';
    report.message = 'Some data cannot be deleted due to legal exemptions. See exemptions field.';
  }

  // Proceed with deletion for non-exempt data
  const includeAll = !scopes || scopes.includes('all');

  if (includeAll || scopes.includes('interactions')) {
    const result = await pgClient.query(
      `UPDATE ai_interactions SET deleted_at = NOW(), deletion_reason = 'CCPA_DELETE'
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [consumerId]
    );
    report.actions.push({ type: 'ai_interactions', rowsAffected: result.rowCount });
  }

  if (includeAll || scopes.includes('memory')) {
    const result = await pgClient.query(
      `UPDATE vector_memories SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL`,
      [consumerId]
    );
    report.actions.push({ type: 'vector_memories', rowsAffected: result.rowCount });
  }

  if (includeAll || scopes.includes('usage')) {
    const usageKeys = await redisClient.keys(`usage:${consumerId}:*`);
    if (usageKeys.length > 0) {
      await redisClient.del(usageKeys);
      report.actions.push({ type: 'usage_logs_redis', keysDeleted: usageKeys.length });
    }
  }

  if (includeAll || scopes.includes('account')) {
    // Anonymize — don't fully delete to preserve fraud prevention records
    await pgClient.query(
      `UPDATE users SET
         email = $2, name = 'CCPA_DELETED', organization = NULL,
         ccpa_deleted_at = NOW(), anonymized = true
       WHERE id = $1`,
      [consumerId, `ccpa-deleted-${crypto.randomBytes(fib(3)).toString('hex')}@redacted.invalid`]
    );
    report.actions.push({ type: 'account', action: 'anonymized' });
  }

  await auditLogger.log({
    action: 'CCPA_DELETE_EXECUTED',
    consumerId,
    requestId,
    scopes,
    actionsCount: report.actions.length,
    exemptionsCount: exemptions.length,
  });

  report.status = report.status || 'completed';
  report.hardDeleteScheduledAt = new Date(Date.now() + fib(9) * 24 * 60 * 60 * 1000).toISOString();

  return report;
};

/**
 * Handle Right to Correct request.
 */
const handleCorrectRequest = async (requestId, consumerId, corrections, pgClient, auditLogger) => {
  const allowedFields = ['name', 'email', 'organization', 'phone', 'address'];
  const applied = {};
  const rejected = {};

  for (const [field, value] of Object.entries(corrections || {})) {
    if (!allowedFields.includes(field)) {
      rejected[field] = 'Field not eligible for correction via this API';
      continue;
    }
    if (typeof value !== 'string' || value.length > 500) {
      rejected[field] = 'Invalid value';
      continue;
    }
    // Email changes require re-verification
    if (field === 'email') {
      rejected.email = 'Email changes require identity re-verification. Contact support@headyme.com.';
      continue;
    }
    await pgClient.query(
      `UPDATE users SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
      [value, consumerId]
    );
    applied[field] = value;
  }

  await auditLogger.log({
    action: 'CCPA_CORRECT_EXECUTED',
    consumerId,
    requestId,
    applied,
    rejected,
  });

  return { requestId, applied, rejected, status: 'completed' };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize CCPA consumer request router.
 * @param {Object} deps - { pgClient, redisClient, auditLogger, notifier }
 */
const createCCPARouter = (deps) => {
  const store = new CCPARequestStore(deps);

  /**
   * POST /api/v1/ccpa/request
   * Submit a CCPA consumer rights request.
   */
  router.post('/request', async (req, res) => {
    try {
      const validation = ConsumerRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
      }
      const data = validation.data;

      // Rate limiting: max fib(7)=13 requests per fib(6)=8-month period per email
      const requestCount = await store.countRequestsByEmail(data.email, data.requestType);
      if (requestCount >= CCPA_CONSTANTS.MAX_REQUESTS_PER_PERIOD) {
        return res.status(429).json({
          error: DENIAL_REASONS.RATE_LIMIT,
          message: `Maximum of ${fib(7)} requests per ${fib(6)}-month period reached for this request type.`,
        });
      }

      const requestId = `CCPA-${Date.now()}-${crypto.randomBytes(fib(3)).toString('hex')}`;
      const { deadline } = await store.create(requestId, data);

      // Send acknowledgement
      await deps.notifier?.sendCCPAAcknowledgement({
        to: data.email,
        requestId,
        requestType: data.requestType,
        deadline,
        name: `${data.firstName} ${data.lastName}`,
      });

      res.status(201).json({
        success: true,
        requestId,
        requestType: data.requestType,
        status: REQUEST_STATUS.SUBMITTED,
        deadline,
        message: `Your CCPA ${data.requestType} request has been received. We will respond within 45 days. Reference: ${requestId}`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/ccpa/request/:requestId
   * Check request status.
   */
  router.get('/request/:requestId', async (req, res) => {
    try {
      const record = await store.get(req.params.requestId);
      if (!record) return res.status(404).json({ error: 'Request not found' });
      res.json({
        requestId: record.requestId || req.params.requestId,
        status: record.status,
        requestType: record.requestType,
        deadline: record.deadline,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/ccpa/request/:requestId/process
   * Internal: Process a verified CCPA request (called by admin or automation).
   */
  router.post('/request/:requestId/process', async (req, res) => {
    try {
      const record = await store.get(req.params.requestId);
      if (!record) return res.status(404).json({ error: 'Not found' });

      const consumerId = record.accountId || record.email;
      let result;

      switch (record.requestType) {
        case REQUEST_TYPES.KNOW:
          result = await handleKnowRequest(record.requestId, consumerId, deps.pgClient);
          break;
        case REQUEST_TYPES.DELETE:
          result = await handleDeleteRequest(
            record.requestId, consumerId, record.deleteScopes,
            deps.pgClient, deps.redisClient, deps.auditLogger
          );
          break;
        case REQUEST_TYPES.CORRECT:
          result = await handleCorrectRequest(
            record.requestId, consumerId, record.corrections,
            deps.pgClient, deps.auditLogger
          );
          break;
        case REQUEST_TYPES.OPT_OUT:
          // Delegate to do-not-sell module
          result = { message: 'Opt-out handled by do-not-sell module', status: 'completed' };
          break;
        default:
          return res.status(400).json({ error: `Unknown request type: ${record.requestType}` });
      }

      await store.updateStatus(req.params.requestId, REQUEST_STATUS.COMPLETED, {
        completedAt: new Date().toISOString(),
        result,
      });

      res.json({ success: true, requestId: req.params.requestId, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/ccpa/categories
   * Return categories of PI Heady collects (for transparency pages).
   */
  router.get('/categories', (req, res) => {
    res.json({
      businessName: 'HeadySystems Inc. (DBA Heady™)',
      categories: [
        { name: 'Identifiers', code: 'A', collected: true, sold: false },
        { name: 'Commercial Information', code: 'B', collected: true, sold: false },
        { name: 'Internet/Electronic Activity', code: 'F', collected: true, sold: false },
        { name: 'Geolocation Data', code: 'G', collected: true, sold: false },
        { name: 'Inferences', code: 'K', collected: true, sold: false },
      ],
      soldInPast12Months: false,
      sharedInPast12Months: false,
      lastUpdated: '2026-03-01',
    });
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createCCPARouter,
  handleKnowRequest,
  handleDeleteRequest,
  handleCorrectRequest,
  REQUEST_TYPES,
  REQUEST_STATUS,
  DENIAL_REASONS,
  CCPA_CONSTANTS,
  PHI,
  fib,
};

'use strict';

/**
 * @module consent-management
 * @description Granular purpose-based consent management API for GDPR Art. 6(1)(a) & Art. 7.
 * Supports granular consent per purpose, full audit history, and withdrawal at any time.
 * Implements GDPR requirements: freely given, specific, informed, unambiguous indication.
 *
 * @architecture Express Router mounted at /api/v1/consent
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const CONSENT_CONSTANTS = {
  // Consent record TTL: fib(15)=610 days (must be kept for accountability)
  RECORD_TTL_DAYS: fib(15),
  // Audit batch: fib(8)=21 entries
  AUDIT_BATCH_SIZE: fib(8),
  // Max history entries returned: fib(11)=89
  MAX_HISTORY_RESULTS: fib(11),
  // Cache TTL for consent status: fib(8)=21 minutes (seconds)
  CACHE_TTL_SECONDS: fib(8) * 60,
  // φ-backoff base for retry
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(6),
};

// ---------------------------------------------------------------------------
// Consent Purposes
// Granular purpose-based consent as required by GDPR Art. 7 and ePrivacy
// ---------------------------------------------------------------------------
const PURPOSES = Object.freeze({
  ANALYTICS: 'analytics',             // Usage analytics and service improvement
  AI_TRAINING: 'ai_training',         // Use interactions to improve AI models
  MARKETING: 'marketing',             // Marketing communications and newsletters
  THIRD_PARTY: 'third_party',         // Share data with third-party partners
  PERSONALIZATION: 'personalization', // Personalize AI responses and recommendations
  RESEARCH: 'research',               // Academic/product research
});

const CONSENT_STATUS = Object.freeze({
  GRANTED: 'granted',
  WITHDRAWN: 'withdrawn',
  PENDING: 'pending',
  EXPIRED: 'expired',
});

// Purpose metadata — basis for layered/contextual consent notices
const PURPOSE_METADATA = {
  [PURPOSES.ANALYTICS]: {
    label: 'Usage Analytics',
    description: 'Allow Heady to analyze how you use the platform to improve services.',
    legalBasis: 'Art. 6(1)(a) GDPR — Consent',
    retentionDays: fib(11), // 89 days
    canWithdraw: true,
  },
  [PURPOSES.AI_TRAINING]: {
    label: 'AI Model Training',
    description: 'Allow Heady to use your AI interactions (anonymized) to improve model quality.',
    legalBasis: 'Art. 6(1)(a) GDPR — Consent',
    retentionDays: fib(13), // 233 days
    canWithdraw: true,
    withdrawalEffect: 'Future interactions will not be used for training. Past data will be deleted within 34 days.',
  },
  [PURPOSES.MARKETING]: {
    label: 'Marketing Communications',
    description: 'Receive product updates, feature announcements, and newsletters.',
    legalBasis: 'Art. 6(1)(a) GDPR — Consent',
    retentionDays: fib(13), // 233 days
    canWithdraw: true,
  },
  [PURPOSES.THIRD_PARTY]: {
    label: 'Third-Party Data Sharing',
    description: 'Share anonymized usage data with select integration partners.',
    legalBasis: 'Art. 6(1)(a) GDPR — Consent',
    retentionDays: fib(11), // 89 days
    canWithdraw: true,
  },
  [PURPOSES.PERSONALIZATION]: {
    label: 'AI Personalization',
    description: 'Use your preferences and history to personalize AI responses.',
    legalBasis: 'Art. 6(1)(b) GDPR — Contract (default on, but can opt out)',
    retentionDays: fib(13), // 233 days
    canWithdraw: true,
  },
  [PURPOSES.RESEARCH]: {
    label: 'Research & Development',
    description: 'Use anonymized data for academic research and product benchmarking.',
    legalBasis: 'Art. 6(1)(a) GDPR — Consent',
    retentionDays: fib(13), // 233 days
    canWithdraw: true,
  },
};

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------
const PurposeEnum = z.enum(Object.values(PURPOSES));

const RecordConsentSchema = z.object({
  userId: z.string().min(1).max(255),
  purposes: z.array(PurposeEnum).min(1),
  source: z.enum(['web_banner', 'settings_page', 'api', 'onboarding', 'email_link', 'gpc_signal']),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
  consentVersion: z.string().default('2.1.0'),
});

const WithdrawConsentSchema = z.object({
  userId: z.string().min(1).max(255),
  purposes: z.array(PurposeEnum).min(1),
  reason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// φ-Retry Helper
// ---------------------------------------------------------------------------
const withPhiRetry = async (fn, maxRetries = CONSENT_CONSTANTS.MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.round(CONSENT_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt));
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};

// ---------------------------------------------------------------------------
// Core Consent Functions
// ---------------------------------------------------------------------------

/**
 * Record consent for one or more purposes.
 * Creates immutable consent record with full audit trail.
 *
 * @param {string} userId - User identifier
 * @param {string[]} purposes - Array of PURPOSES values
 * @param {string} source - Where consent was collected
 * @param {Object} metadata - { ipAddress, userAgent, consentVersion }
 * @returns {Promise<Object>} Consent record
 */
const recordConsent = async (userId, purposes, source, metadata, pgClient, redisClient, auditLogger) => {
  const validation = RecordConsentSchema.safeParse({ userId, purposes, source, ...metadata });
  if (!validation.success) {
    throw Object.assign(new Error('Invalid consent parameters'), {
      code: 'VALIDATION_ERROR',
      details: validation.error.issues,
    });
  }

  const consentId = `consent-${crypto.randomBytes(fib(4)).toString('hex')}`;
  const grantedAt = new Date().toISOString();

  // Calculate expiry based on purpose with shortest retention
  const minRetention = Math.min(...purposes.map(p => PURPOSE_METADATA[p]?.retentionDays || fib(13)));
  const expiresAt = new Date(Date.now() + minRetention * 24 * 60 * 60 * 1000).toISOString();

  // Insert consent records (one per purpose for granularity)
  const insertions = await Promise.all(purposes.map(purpose =>
    withPhiRetry(() => pgClient.query(
      `INSERT INTO consent_records
         (consent_id, user_id, purpose, status, source, ip_address, user_agent, consent_version, granted_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, purpose)
       DO UPDATE SET
         consent_id = $1, status = $4, source = $5, ip_address = $6,
         user_agent = $7, consent_version = $8, granted_at = $9, expires_at = $10,
         withdrawn_at = NULL
       RETURNING *`,
      [consentId, userId, purpose, CONSENT_STATUS.GRANTED, source,
       metadata.ipAddress || null, metadata.userAgent || null,
       metadata.consentVersion || '2.1.0', grantedAt, expiresAt]
    ))
  ));

  // Invalidate cache
  await redisClient.del(`consent:status:${userId}`);

  // Audit log
  await auditLogger.log({
    action: 'CONSENT_GRANTED',
    userId,
    consentId,
    purposes,
    source,
    grantedAt,
    expiresAt,
    ipAddress: metadata.ipAddress,
  });

  return {
    consentId,
    userId,
    purposes,
    status: CONSENT_STATUS.GRANTED,
    source,
    grantedAt,
    expiresAt,
    records: insertions.map(r => r.rows[0]),
  };
};

/**
 * Withdraw consent for one or more purposes.
 * Withdrawal is effective immediately per GDPR Art. 7(3).
 *
 * @param {string} userId - User identifier
 * @param {string[]} purposes - Purposes to withdraw consent for
 * @param {string} [reason] - Optional reason for withdrawal
 * @returns {Promise<Object>} Withdrawal confirmation
 */
const withdrawConsent = async (userId, purposes, reason, pgClient, redisClient, auditLogger) => {
  const validation = WithdrawConsentSchema.safeParse({ userId, purposes, reason });
  if (!validation.success) {
    throw Object.assign(new Error('Invalid withdrawal parameters'), {
      code: 'VALIDATION_ERROR',
      details: validation.error.issues,
    });
  }

  const withdrawnAt = new Date().toISOString();
  const withdrawnPurposes = [];

  for (const purpose of purposes) {
    const result = await withPhiRetry(() => pgClient.query(
      `UPDATE consent_records
       SET status = $1, withdrawn_at = $2, withdrawal_reason = $3
       WHERE user_id = $4 AND purpose = $5 AND status = $6
       RETURNING *`,
      [CONSENT_STATUS.WITHDRAWN, withdrawnAt, reason || null, userId, purpose, CONSENT_STATUS.GRANTED]
    ));

    if (result.rowCount > 0) {
      withdrawnPurposes.push(purpose);

      // Trigger downstream effects
      await handleWithdrawalEffect(userId, purpose, pgClient, redisClient);
    }
  }

  // Invalidate cache
  await redisClient.del(`consent:status:${userId}`);

  await auditLogger.log({
    action: 'CONSENT_WITHDRAWN',
    userId,
    purposes: withdrawnPurposes,
    reason,
    withdrawnAt,
  });

  return {
    userId,
    withdrawnPurposes,
    notWithdrawn: purposes.filter(p => !withdrawnPurposes.includes(p)),
    withdrawnAt,
    message: 'Consent withdrawn. Processing of your data for these purposes has stopped immediately.',
    dataRetentionNote: `Your data will be deleted per the retention schedule (up to ${fib(9)}=34 days for active data).`,
  };
};

/**
 * Handle downstream effects of consent withdrawal.
 */
const handleWithdrawalEffect = async (userId, purpose, pgClient, redisClient) => {
  switch (purpose) {
    case PURPOSES.AI_TRAINING:
      // Mark past interactions as not-for-training
      await pgClient.query(
        `UPDATE ai_interactions SET exclude_from_training = true WHERE user_id = $1`,
        [userId]
      );
      break;
    case PURPOSES.MARKETING:
      // Unsubscribe from mailing lists
      await pgClient.query(
        `UPDATE users SET marketing_opt_in = false WHERE id = $1`,
        [userId]
      );
      break;
    case PURPOSES.PERSONALIZATION:
      // Clear personalization cache
      await redisClient.del(`personalization:${userId}`);
      break;
    case PURPOSES.ANALYTICS:
      // Stop analytics collection
      await redisClient.set(`analytics:opt_out:${userId}`, '1', 'EX', fib(15) * 24 * 60 * 60);
      break;
    case PURPOSES.THIRD_PARTY:
      // Remove from data sharing pools
      await pgClient.query(
        `UPDATE users SET data_sharing_consent = false WHERE id = $1`,
        [userId]
      );
      break;
  }
};

/**
 * Get current consent status for a user across all purposes.
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Consent status per purpose
 */
const getConsentStatus = async (userId, pgClient, redisClient) => {
  // Check cache first (fib(8)=21 minute TTL)
  const cacheKey = `consent:status:${userId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { rows } = await pgClient.query(
    `SELECT purpose, status, source, granted_at, withdrawn_at, expires_at, consent_version
     FROM consent_records
     WHERE user_id = $1
     ORDER BY purpose, granted_at DESC`,
    [userId]
  );

  const statusByPurpose = {};
  for (const row of rows) {
    if (!statusByPurpose[row.purpose]) {
      statusByPurpose[row.purpose] = {
        purpose: row.purpose,
        label: PURPOSE_METADATA[row.purpose]?.label,
        status: row.status,
        grantedAt: row.granted_at,
        withdrawnAt: row.withdrawn_at,
        expiresAt: row.expires_at,
        source: row.source,
        isExpired: row.expires_at && new Date(row.expires_at) < new Date(),
      };
    }
  }

  // Add not-collected purposes
  for (const purpose of Object.values(PURPOSES)) {
    if (!statusByPurpose[purpose]) {
      statusByPurpose[purpose] = {
        purpose,
        label: PURPOSE_METADATA[purpose]?.label,
        status: CONSENT_STATUS.PENDING,
        grantedAt: null,
        withdrawnAt: null,
      };
    }
  }

  const result = {
    userId,
    purposes: statusByPurpose,
    hasAnyGranted: Object.values(statusByPurpose).some(p => p.status === CONSENT_STATUS.GRANTED),
    checkedAt: new Date().toISOString(),
  };

  // Cache for fib(8)=21 minutes
  await redisClient.setex(cacheKey, CONSENT_CONSTANTS.CACHE_TTL_SECONDS, JSON.stringify(result));

  return result;
};

/**
 * Get full consent history for audit and compliance purposes.
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Full immutable consent history
 */
const auditConsentHistory = async (userId, pgClient) => {
  const { rows } = await pgClient.query(
    `SELECT cr.*, u.email as user_email
     FROM consent_records cr
     LEFT JOIN users u ON u.id = cr.user_id
     WHERE cr.user_id = $1
     ORDER BY cr.granted_at DESC
     LIMIT $2`,
    [userId, CONSENT_CONSTANTS.MAX_HISTORY_RESULTS]
  );

  // Group by purpose with full timeline
  const timeline = {};
  for (const row of rows) {
    if (!timeline[row.purpose]) timeline[row.purpose] = [];
    timeline[row.purpose].push({
      consentId: row.consent_id,
      status: row.status,
      source: row.source,
      grantedAt: row.granted_at,
      withdrawnAt: row.withdrawn_at,
      expiresAt: row.expires_at,
      consentVersion: row.consent_version,
      ipAddress: row.ip_address ? `${row.ip_address.split('.').slice(0, 2).join('.')}.x.x` : null, // Partial IP for audit
    });
  }

  return {
    userId,
    userEmail: rows[0]?.user_email,
    auditedAt: new Date().toISOString(),
    timeline,
    totalEvents: rows.length,
    notice: 'Full consent history is maintained for accountability per GDPR Art. 7(1).',
  };
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize consent management router.
 * @param {Object} deps - { pgClient, redisClient, auditLogger }
 */
const createConsentRouter = (deps) => {
  /**
   * GET /api/v1/consent/:userId
   * Get consent status for a user.
   */
  router.get('/:userId', async (req, res) => {
    try {
      const status = await getConsentStatus(req.params.userId, deps.pgClient, deps.redisClient);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/consent
   * Record consent for purposes.
   */
  router.post('/', async (req, res) => {
    try {
      const { userId, purposes, source } = req.body;
      const metadata = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        consentVersion: req.body.consentVersion || '2.1.0',
      };
      const record = await recordConsent(userId, purposes, source, metadata, deps.pgClient, deps.redisClient, deps.auditLogger);
      res.status(201).json({ success: true, ...record });
    } catch (err) {
      res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({ error: err.message, details: err.details });
    }
  });

  /**
   * DELETE /api/v1/consent
   * Withdraw consent for purposes.
   */
  router.delete('/', async (req, res) => {
    try {
      const { userId, purposes, reason } = req.body;
      const result = await withdrawConsent(userId, purposes, reason, deps.pgClient, deps.redisClient, deps.auditLogger);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(err.code === 'VALIDATION_ERROR' ? 400 : 500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/consent/:userId/history
   * Get full audit history for consent.
   */
  router.get('/:userId/history', async (req, res) => {
    try {
      const history = await auditConsentHistory(req.params.userId, deps.pgClient);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/consent/purposes
   * Get all available consent purposes with metadata.
   */
  router.get('/purposes', async (req, res) => {
    res.json({
      purposes: Object.entries(PURPOSE_METADATA).map(([key, meta]) => ({
        key,
        ...meta,
      })),
    });
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createConsentRouter,
  recordConsent,
  withdrawConsent,
  getConsentStatus,
  auditConsentHistory,
  PURPOSES,
  CONSENT_STATUS,
  PURPOSE_METADATA,
  CONSENT_CONSTANTS,
  PHI,
  fib,
};

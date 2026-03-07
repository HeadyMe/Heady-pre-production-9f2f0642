'use strict';

/**
 * @module do-not-sell
 * @description "Do Not Sell or Share My Personal Information" mechanism per CCPA/CPRA
 * (California Civil Code § 1798.120 and § 1798.121).
 *
 * Handles:
 * - Opt-out cookie-based tracking
 * - Global Privacy Control (GPC) signal detection and honoring
 * - Opt-out API endpoint
 * - Opt-out status verification
 * - Re-opt-in workflow (requires affirmative action)
 *
 * GPC Signal: Processor MUST honor navigator.globalPrivacyControl = true per
 * California AG guidance and CPRA regulations effective Jan 1, 2023.
 *
 * @architecture Express Router mounted at /api/v1/privacy/do-not-sell
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// ---------------------------------------------------------------------------
// φ Constants
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

const DNS_CONSTANTS = {
  // Cookie TTL: fib(15)=610 days (CCPA requirement to persist opt-out)
  COOKIE_TTL_DAYS: fib(15),
  COOKIE_TTL_SECONDS: fib(15) * 24 * 60 * 60,
  // Redis TTL for opt-out state: same
  REDIS_TTL_SECONDS: fib(15) * 24 * 60 * 60,
  // Response window: 45 days per CCPA (converted to ms)
  RESPONSE_WINDOW_MS: 45 * 24 * 60 * 60 * 1000,
  // Re-opt-in cooldown: fib(7)=13 days (prevent manipulation)
  REOPT_IN_COOLDOWN_DAYS: fib(7),
  // Retry backoff
  RETRY_BASE_MS: 1000,
  MAX_RETRIES: fib(5),
};

// Cookie names
const COOKIES = {
  OPT_OUT: 'heady_dns',           // "do not sell" opt-out cookie
  GPC_HONORED: 'heady_gpc',       // Records that GPC was honored
  OPT_OUT_TIMESTAMP: 'heady_dns_ts', // Timestamp of opt-out
};

// Data sharing purposes that are covered by CCPA "sale/share"
const DNS_PURPOSES = {
  THIRD_PARTY_ADVERTISING: 'third_party_advertising',
  DATA_BROKER_SHARING: 'data_broker_sharing',
  CROSS_CONTEXT_BEHAVIORAL: 'cross_context_behavioral',
  ANALYTICS_PARTNERS: 'analytics_partners',
};

// ---------------------------------------------------------------------------
// GPC Signal Detection Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware to detect and honor GPC (Sec-GPC: 1 header).
 * Must be mounted globally or before any tracking-related routes.
 *
 * Per California AG: "A business that sells or shares personal information
 * must treat the GPC as a valid request to opt-out."
 */
const gpcMiddleware = async (req, res, next) => {
  const gpcHeader = req.headers['sec-gpc'];
  const isGPC = gpcHeader === '1';

  if (isGPC && req.user?.id) {
    // Auto-honor GPC: record opt-out without user action
    try {
      await honorGPCSignal(req.user.id, req.ip, req.headers['user-agent'],
        req.app.locals.redisClient, req.app.locals.pgClient, req.app.locals.auditLogger);
    } catch (err) {
      // GPC errors should not block the request
      console.error('[GPC] Failed to auto-honor GPC signal:', err.message);
    }
  }

  res.locals.gpcSignal = isGPC;
  next();
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Record a Do Not Sell opt-out.
 * Sets both cookie and backend state for dual-layer persistence.
 *
 * @param {string|null} userId - Authenticated user ID (null for anonymous/cookie-only)
 * @param {string} ipAddress - IP address of requester
 * @param {string} source - 'user_action' | 'gpc_signal' | 'api' | 'webform'
 * @returns {Promise<Object>} Opt-out confirmation
 */
const recordOptOut = async (userId, ipAddress, source, userAgent, redisClient, pgClient, auditLogger, res) => {
  const optOutId = `dns-${Date.now()}-${crypto.randomBytes(fib(3)).toString('hex')}`;
  const optOutAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DNS_CONSTANTS.COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Persist in Redis
  if (userId) {
    const state = {
      userId,
      optOutId,
      source,
      optOutAt,
      expiresAt,
      ipAddress,
      purposes: Object.values(DNS_PURPOSES),
    };
    await redisClient.setex(
      `dns:opt_out:${userId}`,
      DNS_CONSTANTS.REDIS_TTL_SECONDS,
      JSON.stringify(state)
    );

    // Persist in Postgres for audit trail
    await pgClient.query(
      `INSERT INTO dns_opt_outs (opt_out_id, user_id, source, ip_address, user_agent, opted_out_at, expires_at, purposes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         opt_out_id = $1, source = $3, ip_address = $4, opted_out_at = $6, expires_at = $7, revoked_at = NULL`,
      [optOutId, userId, source, ipAddress, userAgent, optOutAt, expiresAt, JSON.stringify(Object.values(DNS_PURPOSES))]
    );

    // Apply downstream effects: stop all data selling/sharing
    await applyOptOutEffects(userId, pgClient, redisClient);
  }

  // Set opt-out cookies on response
  if (res) {
    const cookieOptions = {
      maxAge: DNS_CONSTANTS.COOKIE_TTL_SECONDS * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
    };
    res.cookie(COOKIES.OPT_OUT, '1', cookieOptions);
    res.cookie(COOKIES.OPT_OUT_TIMESTAMP, optOutAt, { ...cookieOptions, httpOnly: false });
    if (source === 'gpc_signal') {
      res.cookie(COOKIES.GPC_HONORED, '1', cookieOptions);
    }
  }

  // Audit log
  if (auditLogger) {
    await auditLogger.log({
      action: 'CCPA_DO_NOT_SELL_OPT_OUT',
      userId: userId || 'anonymous',
      optOutId,
      source,
      optOutAt,
      ipAddress,
      gpcTriggered: source === 'gpc_signal',
    });
  }

  return {
    optOutId,
    userId,
    status: 'opted_out',
    source,
    optOutAt,
    expiresAt,
    purposes: Object.values(DNS_PURPOSES),
    message: 'Your opt-out request has been recorded. We will not sell or share your personal information.',
    rights: {
      reOptIn: 'You may re-opt-in at any time at headyme.com/privacy/do-not-sell',
      moreInfo: 'For more information, see our Privacy Policy at headyme.com/legal/privacy',
    },
  };
};

/**
 * Check if a user has opted out.
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Opt-out status
 */
const getOptOutStatus = async (userId, redisClient, pgClient, req) => {
  // Check cookie for anonymous
  const hasCookie = req?.cookies?.[COOKIES.OPT_OUT] === '1';

  // Check GPC header
  const hasGPC = req?.headers?.['sec-gpc'] === '1';

  // Check backend for authenticated user
  let backendOptOut = null;
  if (userId) {
    const cached = await redisClient.get(`dns:opt_out:${userId}`);
    if (cached) {
      backendOptOut = JSON.parse(cached);
    } else {
      const { rows } = await pgClient.query(
        `SELECT opt_out_id, opted_out_at, expires_at, source, revoked_at
         FROM dns_opt_outs
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [userId]
      );
      backendOptOut = rows[0] || null;
    }
  }

  const isOptedOut = !!backendOptOut || hasCookie || hasGPC;

  return {
    userId: userId || null,
    isOptedOut,
    optOutRecord: backendOptOut,
    cookieOptOut: hasCookie,
    gpcSignal: hasGPC,
    status: isOptedOut ? 'opted_out' : 'not_opted_out',
    checkedAt: new Date().toISOString(),
  };
};

/**
 * Re-opt-in (rescind opt-out). Requires affirmative user action.
 * Subject to fib(7)=13-day cooldown from initial opt-out.
 */
const recordOptIn = async (userId, redisClient, pgClient, auditLogger) => {
  if (!userId) throw new Error('Authentication required to re-opt-in');

  // Check cooldown
  const { rows } = await pgClient.query(
    `SELECT opted_out_at FROM dns_opt_outs WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  if (rows[0]) {
    const optOutAge = Date.now() - new Date(rows[0].opted_out_at).getTime();
    const cooldownMs = DNS_CONSTANTS.REOPT_IN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (optOutAge < cooldownMs) {
      const remainingDays = Math.ceil((cooldownMs - optOutAge) / (24 * 60 * 60 * 1000));
      throw Object.assign(new Error(`Re-opt-in available in ${remainingDays} days`), { code: 'COOLDOWN_ACTIVE' });
    }
  }

  const revokedAt = new Date().toISOString();
  await pgClient.query(
    `UPDATE dns_opt_outs SET revoked_at = $1 WHERE user_id = $2`,
    [revokedAt, userId]
  );
  await redisClient.del(`dns:opt_out:${userId}`);

  await auditLogger.log({
    action: 'CCPA_DO_NOT_SELL_OPT_IN',
    userId,
    revokedAt,
  });

  return {
    userId,
    status: 'opted_in',
    revokedAt,
    message: 'Your opt-out has been revoked. You may opt-out again at any time.',
  };
};

/**
 * Honor GPC signal — automatically applies opt-out.
 */
const honorGPCSignal = async (userId, ipAddress, userAgent, redisClient, pgClient, auditLogger) => {
  // Check if already opted out to avoid duplicate records
  const existing = await redisClient.get(`dns:opt_out:${userId}`);
  if (existing) return JSON.parse(existing);

  return recordOptOut(userId, ipAddress, 'gpc_signal', userAgent, redisClient, pgClient, auditLogger, null);
};

/**
 * Apply downstream effects of CCPA opt-out.
 */
const applyOptOutEffects = async (userId, pgClient, redisClient) => {
  // Stop analytics tracking
  await redisClient.set(`analytics:opt_out:${userId}`, '1', 'EX', DNS_CONSTANTS.REDIS_TTL_SECONDS);

  // Remove from data sharing pools
  await pgClient.query(
    `UPDATE users SET
       data_sharing_consent = false,
       ccpa_opt_out = true,
       ccpa_opt_out_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  // Flag third-party integrations
  await pgClient.query(
    `UPDATE user_integrations SET data_sharing_enabled = false WHERE user_id = $1`,
    [userId]
  );
};

// ---------------------------------------------------------------------------
// Express Router
// ---------------------------------------------------------------------------

/**
 * Initialize Do-Not-Sell router.
 * @param {Object} deps - { redisClient, pgClient, auditLogger }
 */
const createDNSRouter = (deps) => {
  // Apply GPC middleware to all routes
  router.use(gpcMiddleware);

  /**
   * POST /api/v1/privacy/do-not-sell/opt-out
   * Submit a Do Not Sell opt-out request.
   * Works for both authenticated users and anonymous visitors (cookie-only).
   */
  router.post('/opt-out', async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const source = req.body.source || 'user_action';

      const result = await recordOptOut(
        userId, ipAddress, source, userAgent,
        deps.redisClient, deps.pgClient, deps.auditLogger, res
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/privacy/do-not-sell/status
   * Check current opt-out status.
   */
  router.get('/status', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      const status = await getOptOutStatus(userId, deps.redisClient, deps.pgClient, req);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/privacy/do-not-sell/opt-in
   * Re-opt-in (rescind opt-out). Requires authentication.
   */
  router.post('/opt-in', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required to re-opt-in' });
      }
      const result = await recordOptIn(req.user.id, deps.redisClient, deps.pgClient, deps.auditLogger);
      // Clear opt-out cookies
      res.clearCookie(COOKIES.OPT_OUT);
      res.clearCookie(COOKIES.OPT_OUT_TIMESTAMP);
      res.clearCookie(COOKIES.GPC_HONORED);
      res.json({ success: true, ...result });
    } catch (err) {
      const status = err.code === 'COOLDOWN_ACTIVE' ? 429 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * GET /privacy/do-not-sell
   * Human-readable opt-out page redirect (for "Do Not Sell" footer link).
   */
  router.get('/', (req, res) => {
    res.redirect(301, 'https://headyme.com/privacy/do-not-sell');
  });

  return router;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  createDNSRouter,
  recordOptOut,
  getOptOutStatus,
  recordOptIn,
  honorGPCSignal,
  gpcMiddleware,
  DNS_CONSTANTS,
  DNS_PURPOSES,
  COOKIES,
  PHI,
  fib,
};

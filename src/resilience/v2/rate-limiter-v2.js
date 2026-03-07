'use strict';

/**
 * rate-limiter-v2.js — Distributed Sliding Window Rate Limiter
 *
 * Changes from v1 (in-process governance budget check):
 *  - Sliding window algorithm (replaces fixed-window which allows burst at window boundary)
 *  - Distributed: backed by a KV store (HeadyKV / Redis / Cloudflare KV) — works across
 *    multiple Cloud Run instances / Cloudflare Workers
 *  - Multiple limit tiers per identity (per-second burst, per-minute sustained, per-hour budget)
 *  - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
 *  - Per-identity key scoping: userId, sessionId, API key, or IP address
 *  - Adaptive rate limiting: automatically tightens limits for abuse patterns
 *  - Express middleware factory
 *
 * @module rate-limiter-v2
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Local in-memory KV (fallback / testing) ──────────────────────────────────

/**
 * Minimal in-memory KV for local/single-node deployments.
 * Replace with HeadyKV (Redis/Cloudflare) for distributed operation.
 */
class LocalKV {
    constructor() {
        this._store = new Map();
        // Periodic eviction of expired keys
        setInterval(() => this._evict(), 60_000).unref();
    }

    async get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key, value, opts = {}) {
        this._store.set(key, {
            value,
            expiresAt: opts.ttlMs ? Date.now() + opts.ttlMs : null,
        });
    }

    async incrBy(key, delta, ttlMs) {
        const current = await this.get(key) || 0;
        const next = current + delta;
        await this.set(key, next, { ttlMs });
        return next;
    }

    _evict() {
        const now = Date.now();
        for (const [k, v] of this._store) {
            if (v.expiresAt && now > v.expiresAt) this._store.delete(k);
        }
    }
}

// ─── Sliding Window Rate Limiter ──────────────────────────────────────────────

/**
 * Sliding window log algorithm implementation.
 *
 * For each window, we store the count of requests in the *previous* full window
 * and the count in the *current* partial window. The effective rate is:
 *
 *   effectiveCount = prevWindowCount * ((windowMs - elapsedInCurrentWindow) / windowMs)
 *                  + currentWindowCount
 *
 * This approximation avoids storing individual timestamps per request, requiring
 * only two counters per key per window, while closely matching a true sliding window.
 */
class SlidingWindowRateLimiter {
    /**
     * @param {object} [opts]
     * @param {object}  [opts.kv]          - KV store implementing {get, set, incrBy}
     * @param {string}  [opts.keyPrefix]   - Prefix for all KV keys
     * @param {boolean} [opts.localMode]   - Force local in-memory KV (testing)
     */
    constructor(opts = {}) {
        this._kv = (opts.localMode || !opts.kv) ? new LocalKV() : opts.kv;
        this._prefix = opts.keyPrefix || 'rl:';
    }

    /**
     * Check and record a request.
     *
     * @param {string}  identity          - Key identifying the rate-limited entity
     * @param {object}  limit             - { requests, windowMs }
     * @param {number}  limit.requests    - Max requests in the window
     * @param {number}  limit.windowMs    - Window size in milliseconds
     * @param {number}  [cost=1]          - Weight of this request (default: 1)
     * @returns {Promise<RateLimitResult>}
     */
    async check(identity, limit, cost = 1) {
        const { requests, windowMs } = limit;
        const now = Date.now();

        // Current window boundary (floor to window start)
        const currentWindowStart = Math.floor(now / windowMs) * windowMs;
        const prevWindowStart    = currentWindowStart - windowMs;
        const elapsedInCurrent   = now - currentWindowStart;

        // Keys
        const currentKey = `${this._prefix}${identity}:${currentWindowStart}`;
        const prevKey    = `${this._prefix}${identity}:${prevWindowStart}`;

        // Fetch previous window count and current count
        const [prevCount, currentCount] = await Promise.all([
            this._kv.get(prevKey).then(v => Number(v) || 0),
            this._kv.get(currentKey).then(v => Number(v) || 0),
        ]);

        // Sliding window interpolation
        const prevWeight = (windowMs - elapsedInCurrent) / windowMs;
        const effectiveCount = prevCount * prevWeight + currentCount;

        const allowed = (effectiveCount + cost) <= requests;
        const remaining = Math.max(0, Math.floor(requests - effectiveCount - (allowed ? cost : 0)));
        const resetAt = currentWindowStart + windowMs;

        if (allowed) {
            // Increment current window counter with TTL of 2 windows to allow overlap
            await this._kv.incrBy(currentKey, cost, windowMs * 2);
        }

        return {
            allowed,
            remaining,
            limit:    requests,
            resetAt,
            resetMs:  resetAt - now,
            identity,
            windowMs,
        };
    }
}

// ─── RateLimitResult type ─────────────────────────────────────────────────────

/**
 * @typedef {object} RateLimitResult
 * @property {boolean} allowed     - Whether this request is permitted
 * @property {number}  remaining   - Requests remaining in the current window
 * @property {number}  limit       - The configured limit
 * @property {number}  resetAt     - Unix timestamp (ms) when the window resets
 * @property {number}  resetMs     - Milliseconds until the window resets
 * @property {string}  identity    - The key that was checked
 * @property {number}  windowMs    - Window size in ms
 */

// ─── Multi-tier Rate Limiter ───────────────────────────────────────────────────

/**
 * Multi-tier rate limiter.
 * Enforces multiple overlapping limits simultaneously (burst, sustained, daily).
 * All tiers must pass for the request to be allowed.
 */
class MultiTierRateLimiter {
    /**
     * @param {object[]} tiers         - Array of { name, requests, windowMs }
     * @param {object}   [opts]
     * @param {object}   [opts.kv]     - KV store
     * @param {string}   [opts.keyPrefix]
     */
    constructor(tiers, opts = {}) {
        this._tiers   = tiers;
        this._limiter = new SlidingWindowRateLimiter(opts);
    }

    /**
     * Check all tiers. Returns the most restrictive result.
     * @param {string} identity
     * @param {number} [cost=1]
     * @returns {Promise<{ allowed: boolean, tiers: RateLimitResult[], mostRestrictive: RateLimitResult }>}
     */
    async check(identity, cost = 1) {
        const results = await Promise.all(
            this._tiers.map(tier =>
                this._limiter.check(`${identity}:${tier.name}`, tier, cost)
            )
        );

        const denied = results.find(r => !r.allowed);
        const allowed = !denied;

        // Most restrictive = smallest remaining
        const mostRestrictive = results.reduce((a, b) => a.remaining < b.remaining ? a : b);

        return {
            allowed,
            tiers: results,
            mostRestrictive,
            blockedByTier: denied ? this._tiers[results.indexOf(denied)].name : null,
        };
    }
}

// ─── Identity extractors ──────────────────────────────────────────────────────

/**
 * Extract a rate-limit identity from an Express request.
 * Priority: userId → sessionId → API key fingerprint → IP address.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function extractIdentity(req) {
    if (req.user?.sub) return `user:${req.user.sub}`;
    if (req.user?.sessionId) return `session:${req.user.sessionId}`;

    // API key fingerprint (first 12 chars of hash)
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
        const fp = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
        return `apikey:${fp}`;
    }

    // Fall back to IP
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return `ip:${ip}`;
}

// ─── Standard Heady rate limit profiles ───────────────────────────────────────

/**
 * Pre-built tier sets for common Heady routes.
 */
const LIMIT_PROFILES = {
    /** Default API endpoint: 120/min burst, 1000/hour sustained */
    api: [
        { name: 'burst',     requests: 20,    windowMs: 10_000    },  // 20 req / 10s
        { name: 'sustained', requests: 120,   windowMs: 60_000    },  // 120 req / min
        { name: 'hourly',    requests: 1_000, windowMs: 3_600_000 },  // 1000 req / hour
    ],

    /** Auth endpoints: tight limits to prevent brute force */
    auth: [
        { name: 'burst',     requests: 5,  windowMs: 10_000    },  // 5 req / 10s
        { name: 'sustained', requests: 20, windowMs: 60_000    },  // 20 req / min
        { name: 'hourly',    requests: 60, windowMs: 3_600_000 },  // 60 req / hour
    ],

    /** LLM inference: cost-weighted, tight rate limiting */
    inference: [
        { name: 'burst',     requests: 3,   windowMs: 10_000    },  // 3 req / 10s
        { name: 'sustained', requests: 30,  windowMs: 60_000    },  // 30 req / min
        { name: 'daily',     requests: 500, windowMs: 86_400_000 }, // 500 req / day
    ],

    /** Health routes: generous, unauthed probes from k8s */
    health: [
        { name: 'burst', requests: 30, windowMs: 10_000 },
    ],
};

// ─── Express Middleware Factory ───────────────────────────────────────────────

/**
 * Create an Express rate limiting middleware.
 *
 * @param {object} [opts]
 * @param {string|object[]}  [opts.profile='api']      - Profile name from LIMIT_PROFILES or custom tiers array
 * @param {Function}         [opts.identityFn]         - Custom identity extractor (req) => string
 * @param {object}           [opts.kv]                 - KV store for distributed operation
 * @param {boolean}          [opts.skipSuccessful=false]- Do not count 2xx responses against the limit
 * @param {Function}         [opts.onLimited]          - Custom handler (req, res, result) => void
 * @returns {import('express').RequestHandler}
 *
 * @example
 * // Auth routes
 * router.post('/login', rateLimitMiddleware({ profile: 'auth' }), authHandler);
 *
 * // LLM inference with custom KV
 * router.post('/infer', rateLimitMiddleware({ profile: 'inference', kv: headyKV }), inferHandler);
 */
function rateLimitMiddleware(opts = {}) {
    const profileName = opts.profile || 'api';
    const tiers = Array.isArray(profileName)
        ? profileName
        : (LIMIT_PROFILES[profileName] || LIMIT_PROFILES.api);

    const limiter = new MultiTierRateLimiter(tiers, {
        kv:        opts.kv,
        keyPrefix: opts.keyPrefix || 'rl:',
    });

    const identityFn = opts.identityFn || extractIdentity;

    return async (req, res, next) => {
        const identity = identityFn(req);

        let result;
        try {
            result = await limiter.check(identity);
        } catch (err) {
            // KV failure: fail-open with a warning rather than blocking all traffic
            logger.warn('[RateLimiter] KV error, failing open', { error: err.message, identity });
            return next();
        }

        // Always set standard rate limit headers
        const mr = result.mostRestrictive;
        res.setHeader('X-RateLimit-Limit', mr.limit);
        res.setHeader('X-RateLimit-Remaining', mr.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(mr.resetAt / 1000));
        res.setHeader('X-RateLimit-Policy', `${mr.limit};w=${mr.windowMs / 1000}`);

        if (!result.allowed) {
            const retryAfterSec = Math.ceil(mr.resetMs / 1000);
            res.setHeader('Retry-After', retryAfterSec);

            logger.warn('[RateLimiter] Request rate-limited', {
                identity,
                blockedByTier: result.blockedByTier,
                remaining: mr.remaining,
                resetMs: mr.resetMs,
            });

            if (opts.onLimited) {
                return opts.onLimited(req, res, result);
            }

            return res.status(429).json({
                error:       'Too Many Requests',
                code:        'RATE_LIMITED',
                retryAfter:  retryAfterSec,
                tier:        result.blockedByTier,
            });
        }

        next();
    };
}

// ─── Adaptive rate limit adjuster ─────────────────────────────────────────────

/**
 * Adaptive tightener: if a client is repeatedly hitting the limit,
 * temporarily reduce their effective limit by adding a penalty multiplier.
 *
 * @param {object} baseProfile     - Base LIMIT_PROFILES entry array
 * @param {number} penaltyFactor   - Factor to reduce limits by (default: 0.5 = halved)
 * @param {number} penaltyWindowMs - How long the penalty lasts (default: 5 minutes)
 * @returns {{
 *   checkAndRecord: (identity: string, wasLimited: boolean) => Promise<object[]>
 * }}
 */
function adaptiveLimiter(baseProfile, penaltyFactor = 0.5, penaltyWindowMs = 300_000) {
    const penaltyStore = new Map(); // identity → { hitCount, expiresAt }

    return {
        /**
         * Get effective tiers for an identity, applying penalty if applicable.
         * @param {string}  identity
         * @param {boolean} wasLimited - Whether the last request was rate-limited
         * @returns {object[]} effective tiers
         */
        getTiers(identity, wasLimited = false) {
            const now = Date.now();
            let record = penaltyStore.get(identity);

            if (wasLimited) {
                if (!record || now > record.expiresAt) {
                    record = { hitCount: 1, expiresAt: now + penaltyWindowMs };
                } else {
                    record.hitCount++;
                    record.expiresAt = now + penaltyWindowMs; // reset timer on each hit
                }
                penaltyStore.set(identity, record);
            }

            // Clean up expired entries occasionally
            if (Math.random() < 0.01) {
                for (const [k, v] of penaltyStore) {
                    if (now > v.expiresAt) penaltyStore.delete(k);
                }
            }

            if (record && now <= record.expiresAt) {
                // Apply penalty: reduce limits
                return baseProfile.map(tier => ({
                    ...tier,
                    requests: Math.max(1, Math.floor(tier.requests * penaltyFactor)),
                    _penaltyActive: true,
                    _hitCount: record.hitCount,
                }));
            }

            return baseProfile;
        },
    };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    SlidingWindowRateLimiter,
    MultiTierRateLimiter,
    LocalKV,
    rateLimitMiddleware,
    adaptiveLimiter,
    extractIdentity,
    LIMIT_PROFILES,
};

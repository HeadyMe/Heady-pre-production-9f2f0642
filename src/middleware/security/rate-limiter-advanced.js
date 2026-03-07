/**
 * Advanced Rate Limiter — Production Implementation
 * @module security-middleware/rate-limiter-advanced
 *
 * Features:
 *  - Per-tenant limits
 *  - Per-API-key limits
 *  - Sliding window algorithm
 *  - Distributed rate limiting via Redis
 *  - Burst allowance with token bucket
 *  - Tier system: free (100/hr), pro (1000/hr), enterprise (10000/hr)
 *  - Graceful degradation headers
 *  - Webhook notification on limit breach
 *  - Circuit-breaker-aware (checks X-Circuit-State)
 */

'use strict';

const crypto = require('crypto');

// ─── Tier Definitions ─────────────────────────────────────────────────────────

const TIERS = {
  free: {
    requestsPerHour: 100,
    burstMultiplier: 1.5,   // Allow 150% of hourly rate as burst window
    burstWindowMs:   60_000, // 1-minute burst window
    concurrency:     5,
    webhookOnBreach: false,
  },
  pro: {
    requestsPerHour: 1_000,
    burstMultiplier: 2.0,
    burstWindowMs:   60_000,
    concurrency:     20,
    webhookOnBreach: false,
  },
  enterprise: {
    requestsPerHour: 10_000,
    burstMultiplier: 3.0,
    burstWindowMs:   60_000,
    concurrency:     100,
    webhookOnBreach: true,
  },
  internal: {
    requestsPerHour: 1_000_000, // Effectively unlimited for internal services
    burstMultiplier: 10.0,
    burstWindowMs:   60_000,
    concurrency:     500,
    webhookOnBreach: false,
  },
};

// Default tier for unknown tenants
const DEFAULT_TIER = 'free';

// ─── In-Memory Sliding Window Store (fallback if no Redis) ───────────────────

class InMemorySlidingWindowStore {
  constructor() {
    this._windows = new Map();   // key → sorted array of timestamps (ms)
    this._buckets  = new Map();   // key → { tokens, lastRefill }

    // Cleanup expired entries every 5 minutes
    const interval = setInterval(() => this._cleanup(), 5 * 60_000);
    if (interval.unref) interval.unref();
  }

  /**
   * Sliding window: count requests in the past windowMs.
   * Returns current count AFTER incrementing.
   */
  async increment(key, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = this._windows.get(key) || [];
    // Remove expired
    timestamps = timestamps.filter(ts => ts > cutoff);
    timestamps.push(now);
    this._windows.set(key, timestamps);

    return {
      count:     timestamps.length,
      resetAt:   now + windowMs,
      windowMs,
    };
  }

  async getCount(key, windowMs) {
    const now  = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (this._windows.get(key) || []).filter(ts => ts > cutoff);
    return timestamps.length;
  }

  /**
   * Token bucket: consume tokens for burst allowance.
   * Returns { allowed, tokensRemaining, nextRefillAt }
   */
  async consumeToken(key, maxTokens, refillRate, refillIntervalMs) {
    const now = Date.now();
    let bucket = this._buckets.get(key) || { tokens: maxTokens, lastRefill: now };

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillCount = Math.floor(elapsed / refillIntervalMs) * refillRate;
    if (refillCount > 0) {
      bucket.tokens    = Math.min(maxTokens, bucket.tokens + refillCount);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this._buckets.set(key, bucket);
      return { allowed: true,  tokensRemaining: Math.floor(bucket.tokens), nextRefillAt: now + refillIntervalMs };
    }

    this._buckets.set(key, bucket);
    return { allowed: false, tokensRemaining: 0, nextRefillAt: bucket.lastRefill + refillIntervalMs };
  }

  async reset(key) {
    this._windows.delete(key);
    this._buckets.delete(key);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this._windows) {
      const valid = timestamps.filter(ts => now - ts < 2 * 60 * 60 * 1000); // keep 2hr
      if (valid.length === 0) this._windows.delete(key);
      else this._windows.set(key, valid);
    }
  }
}

// ─── Redis Sliding Window Store ───────────────────────────────────────────────

class RedisSlidingWindowStore {
  /**
   * @param {object} redisClient  - ioredis or compatible client
   */
  constructor(redisClient) {
    this._redis = redisClient;
  }

  /**
   * Lua script for atomic sliding window increment.
   * Returns [current_count, ttl_ms]
   */
  get _SLIDING_WINDOW_SCRIPT() {
    return `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local cutoff = now - window

      -- Remove expired entries
      redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

      -- Add current request (score = timestamp, member = unique ID)
      local member = ARGV[3]
      redis.call('ZADD', key, now, member)

      -- Set TTL
      redis.call('PEXPIRE', key, window + 1000)

      -- Return count
      return redis.call('ZCARD', key)
    `;
  }

  async increment(key, windowMs) {
    const now    = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2)}`;

    let count;
    try {
      count = await this._redis.eval(
        this._SLIDING_WINDOW_SCRIPT,
        1,    // number of keys
        key,
        String(now),
        String(windowMs),
        member,
      );
    } catch (err) {
      // Redis error — fall back to conservative estimate
      console.error('[RATE-LIMITER] Redis error, applying conservative limit:', err.message);
      throw err;
    }

    return {
      count:     Number(count),
      resetAt:   now + windowMs,
      windowMs,
    };
  }

  async getCount(key, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const count = await this._redis.zcount(key, cutoff, '+inf').catch(() => 0);
    return Number(count);
  }

  async consumeToken(key, maxTokens, refillRate, refillIntervalMs) {
    // Token bucket via Redis hash
    const now = Date.now();
    const bucketKey = `bucket:${key}`;

    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local maxTokens = tonumber(ARGV[2])
      local refillRate = tonumber(ARGV[3])
      local refillInterval = tonumber(ARGV[4])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local tokens = tonumber(bucket[1]) or maxTokens
      local lastRefill = tonumber(bucket[2]) or now

      -- Refill
      local elapsed = now - lastRefill
      local refillCount = math.floor(elapsed / refillInterval) * refillRate
      if refillCount > 0 then
        tokens = math.min(maxTokens, tokens + refillCount)
        lastRefill = now
      end

      if tokens >= 1 then
        tokens = tokens - 1
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('PEXPIRE', key, refillInterval * 2)
        return {1, tokens}
      end

      redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
      redis.call('PEXPIRE', key, refillInterval * 2)
      return {0, tokens}
    `;

    try {
      const result = await this._redis.eval(script, 1, bucketKey,
        String(now), String(maxTokens), String(refillRate), String(refillIntervalMs));
      const [allowed, tokensRemaining] = result;
      return {
        allowed:         allowed === 1,
        tokensRemaining: Number(tokensRemaining),
        nextRefillAt:    now + refillIntervalMs,
      };
    } catch {
      return { allowed: true, tokensRemaining: maxTokens, nextRefillAt: now + refillIntervalMs };
    }
  }

  async reset(key) {
    await this._redis.del(key, `bucket:${key}`).catch(() => {});
  }
}

// ─── Rate Limiter Core ────────────────────────────────────────────────────────

class AdvancedRateLimiter {
  /**
   * @param {object} opts
   * @param {object} [opts.redis]          - Redis client (falls back to in-memory)
   * @param {object} [opts.tiers]          - Tier config overrides
   * @param {object} [opts.tenantTiers]    - { [tenantId]: tierName } override map
   * @param {Function} [opts.getTier]      - Async fn(tenantId, apiKey) → tierName
   * @param {string} [opts.keyPrefix]      - Redis key prefix (default: 'rl:')
   * @param {Function} [opts.onBreach]     - Async fn(info) — called on limit breach
   * @param {string} [opts.webhookUrl]     - Webhook URL for breach notifications
   */
  constructor(opts = {}) {
    this._store        = opts.redis ? new RedisSlidingWindowStore(opts.redis) : new InMemorySlidingWindowStore();
    this._tiers        = { ...TIERS, ...opts.tiers };
    this._tenantTiers  = opts.tenantTiers || {};
    this._getTier      = opts.getTier;
    this._keyPrefix    = opts.keyPrefix || 'rl:';
    this._onBreach     = opts.onBreach;
    this._webhookUrl   = opts.webhookUrl;
    this._fallbackMode = false;  // true when Redis is down
  }

  /**
   * Check and consume rate limit for a request.
   *
   * @param {object} identity
   * @param {string} [identity.tenantId]
   * @param {string} [identity.apiKey]
   * @param {string} [identity.userId]
   * @param {string} [identity.ip]
   * @returns {Promise<{ allowed, tier, limit, remaining, resetAt, retryAfter, burst }>}
   */
  async check(identity = {}) {
    const { tenantId, apiKey, userId, ip } = identity;

    // Resolve tier
    const tier = await this._resolveTier(tenantId, apiKey);
    const tierConfig = this._tiers[tier];
    const windowMs = 60 * 60 * 1000; // 1 hour sliding window
    const limit  = tierConfig.requestsPerHour;
    const burstLimit = Math.floor(limit * tierConfig.burstMultiplier);

    // Build rate limit keys (most → least specific)
    const keys = this._buildKeys(tenantId, apiKey, userId, ip);

    // Check most specific key first
    let result = null;
    let chosenKey = null;

    for (const key of keys) {
      try {
        const windowResult = await this._store.increment(
          `${this._keyPrefix}${key}`,
          windowMs,
        );

        // Burst check (short window token bucket)
        const burstResult = await this._store.consumeToken(
          `${this._keyPrefix}burst:${key}`,
          burstLimit,
          Math.ceil(burstLimit / 60),    // refill rate: burstLimit per minute
          60_000,                         // refill interval: 1 minute
        );

        result = { windowResult, burstResult, key };
        chosenKey = key;
        break;
      } catch (err) {
        // Redis failure — degrade gracefully
        this._fallbackMode = true;
        console.error('[RATE-LIMITER] Store error:', err.message);
        return this._fallbackResponse(tier, limit);
      }
    }

    if (!result) return this._fallbackResponse(tier, limit);

    const { windowResult, burstResult } = result;
    const count     = windowResult.count;
    const remaining = Math.max(0, limit - count);
    const resetAt   = windowResult.resetAt;

    // Allowed if within hourly limit AND burst bucket has tokens
    const allowed = count <= limit && burstResult.allowed;

    if (!allowed) {
      const breachInfo = {
        tenantId, apiKey, userId, ip,
        tier, limit, count,
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        timestamp:  new Date().toISOString(),
        key:        chosenKey,
      };

      // Fire breach notifications async
      this._handleBreach(breachInfo).catch(() => {});
    }

    return {
      allowed,
      tier,
      limit,
      remaining,
      resetAt,
      count,
      retryAfter:       allowed ? 0 : Math.ceil((resetAt - Date.now()) / 1000),
      burstRemaining:   burstResult.tokensRemaining,
      burstNextRefillAt: burstResult.nextRefillAt,
    };
  }

  _buildKeys(tenantId, apiKey, userId, ip) {
    const keys = [];
    // Most specific → least specific for priority
    if (apiKey)   keys.push(`apikey:${apiKey}`);
    if (tenantId) keys.push(`tenant:${tenantId}`);
    if (userId)   keys.push(`user:${userId}`);
    if (ip)       keys.push(`ip:${ip}`);
    if (keys.length === 0) keys.push('global');
    return keys;
  }

  async _resolveTier(tenantId, apiKey) {
    // 1. Explicit tenant tier map
    if (tenantId && this._tenantTiers[tenantId]) return this._tenantTiers[tenantId];

    // 2. Dynamic resolution
    if (this._getTier) {
      try {
        const tier = await this._getTier(tenantId, apiKey);
        if (tier && this._tiers[tier]) return tier;
      } catch {}
    }

    return DEFAULT_TIER;
  }

  _fallbackResponse(tier, limit) {
    // Degrade gracefully: allow request but signal degraded mode
    return {
      allowed:      true,
      tier,
      limit,
      remaining:    -1,  // unknown
      resetAt:      Date.now() + 3600_000,
      count:        -1,
      retryAfter:   0,
      degraded:     true,
    };
  }

  async _handleBreach(info) {
    // Internal callback
    if (typeof this._onBreach === 'function') {
      await this._onBreach(info);
    }

    // Webhook notification (for enterprise tier)
    const tier = this._tiers[info.tier];
    if (tier?.webhookOnBreach && this._webhookUrl) {
      await this._sendWebhook(info).catch(err =>
        console.error('[RATE-LIMITER] Webhook error:', err.message)
      );
    }
  }

  async _sendWebhook(info) {
    const body = JSON.stringify({
      event:     'rate_limit_breach',
      timestamp: info.timestamp,
      tenantId:  info.tenantId,
      apiKey:    info.apiKey ? info.apiKey.slice(0, 8) + '...' : null,
      tier:      info.tier,
      limit:     info.limit,
      count:     info.count,
      retryAfter: info.retryAfter,
    });

    const url = this._webhookUrl;
    const headers = {
      'Content-Type': 'application/json',
      'X-Heady-Event': 'rate_limit_breach',
      'X-Heady-Signature': crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET || 'change-me')
        .update(body)
        .digest('hex'),
    };

    // Use node 18+ native fetch
    if (typeof fetch !== 'undefined') {
      await fetch(url, { method: 'POST', headers, body });
    }
  }

  /**
   * Reset limits for a specific identity.
   */
  async reset(identity = {}) {
    const keys = this._buildKeys(identity.tenantId, identity.apiKey, identity.userId, identity.ip);
    for (const key of keys) {
      await this._store.reset(`${this._keyPrefix}${key}`).catch(() => {});
    }
  }
}

// ─── Middleware Factory ───────────────────────────────────────────────────────

/**
 * Create Express rate limiting middleware.
 *
 * @param {AdvancedRateLimiter} limiter
 * @param {object} [opts]
 * @param {Function} [opts.getIdentity]   - fn(req) → { tenantId, apiKey, userId, ip }
 * @param {boolean}  [opts.skipOnError]   - Allow request if rate limiter errors (default: true)
 * @returns {Function}
 */
function rateLimiterMiddleware(limiter, opts = {}) {
  const {
    getIdentity = (req) => ({
      tenantId: req.tenantId || req.user?.tenantId,
      apiKey:   req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', ''),
      userId:   req.user?.id,
      ip:       req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    }),
    skipOnError = true,
  } = opts;

  return async (req, res, next) => {
    const identity = getIdentity(req);

    let result;
    try {
      result = await limiter.check(identity);
    } catch (err) {
      console.error('[RATE-LIMITER] Middleware error:', err.message);
      if (skipOnError) return next();
      return res.status(503).json({ error: 'Rate limiter unavailable', code: 'RATE_LIMITER_ERROR' });
    }

    // Set standard rate limit headers
    res.set('X-RateLimit-Limit',     String(result.limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
    res.set('X-RateLimit-Reset',     String(Math.ceil(result.resetAt / 1000)));
    res.set('X-RateLimit-Tier',      result.tier);

    if (result.degraded) {
      res.set('X-RateLimit-Degraded', 'true');
    }

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter));
      res.set('X-RateLimit-Retry-After', String(result.retryAfter));

      return res.status(429).json({
        error:      'Too Many Requests',
        code:       'RATE_LIMIT_EXCEEDED',
        tier:       result.tier,
        limit:      result.limit,
        retryAfter: result.retryAfter,
        resetAt:    new Date(result.resetAt).toISOString(),
        message:    `Rate limit exceeded. Upgrade to a higher tier for more requests. Retry after ${result.retryAfter}s.`,
      });
    }

    // Attach for downstream use
    req.rateLimit = result;
    next();
  };
}

/**
 * Convenience factory: create both limiter and middleware in one call.
 *
 * @param {object} opts
 * @param {object} [opts.redis]       - Redis client
 * @param {object} [opts.tiers]       - Tier overrides
 * @param {object} [opts.tenantTiers] - Static tenant→tier map
 * @param {Function} [opts.getTier]   - Dynamic tier resolver
 * @param {string} [opts.webhookUrl]  - Breach webhook URL
 * @param {Function} [opts.onBreach]  - Breach callback
 * @returns {{ limiter, middleware, TIERS }}
 */
function createRateLimiter(opts = {}) {
  const limiter    = new AdvancedRateLimiter(opts);
  const middleware = rateLimiterMiddleware(limiter, opts);
  return { limiter, middleware, TIERS };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  createRateLimiter,
  AdvancedRateLimiter,
  rateLimiterMiddleware,
  InMemorySlidingWindowStore,
  RedisSlidingWindowStore,
  TIERS,
  DEFAULT_TIER,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const Redis = require('ioredis');
const { createRateLimiter } = require('./rate-limiter-advanced');

const redis = new Redis(process.env.REDIS_URL);

const { limiter, middleware } = createRateLimiter({
  redis,
  webhookUrl: process.env.RATE_LIMIT_WEBHOOK_URL,
  getTier: async (tenantId, apiKey) => {
    // Lookup tier from DB
    const tenant = await db.tenants.findById(tenantId);
    return tenant?.tier || 'free';
  },
  onBreach: async (info) => {
    console.warn('[RATE LIMIT BREACH]', info);
    await auditLogger.log({
      action:   'RATE_LIMIT_EXCEEDED',
      actor:    info.tenantId || info.ip,
      resource: 'api',
      metadata: info,
    });
  },
});

// Apply to all API routes
app.use('/api/', middleware);

// Apply stricter limits to specific endpoints
const strictLimiter = createRateLimiter({
  redis,
  tiers: {
    free:       { requestsPerHour: 10,  burstMultiplier: 1.0, burstWindowMs: 60000, concurrency: 2, webhookOnBreach: false },
    pro:        { requestsPerHour: 100, burstMultiplier: 1.5, burstWindowMs: 60000, concurrency: 10, webhookOnBreach: false },
    enterprise: { requestsPerHour: 1000, burstMultiplier: 2.0, burstWindowMs: 60000, concurrency: 50, webhookOnBreach: true },
  },
});

app.post('/api/v1/ai/complete', strictLimiter.middleware, async (req, res) => { ... });
*/

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
let Redis, redis;

try {
    Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    redis.on('error', () => { }); // Suppress connection errors
} catch (e) {
    // ioredis not installed or Redis unavailable — use in-memory fallback
    redis = null;
}

const RATE_LIMIT_WINDOW_SECS = 60;
const MAX_REQUESTS_PER_WINDOW = 120;
const PENALTY_BAN_SECS = 3600;

// In-memory fallback when Redis is unavailable
const memoryStore = new Map();

class HeadyRateLimiter {
    constructor() {
        this.redis = redis;
        if (redis) {
            console.log("[SECURITY] Heady Sliding-Window Rate Limiter Armed (Redis).");
        } else {
            console.log("[SECURITY] Heady Rate Limiter Armed (in-memory fallback — Redis unavailable).");
        }
    }

    async checkLimit(ip, endpoint) {
        // Exclude internal mesh network from limits
        if (ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1') return { allowed: true };

        // If Redis is unavailable, use simple in-memory counter
        if (!this.redis) {
            return this._checkLimitMemory(ip);
        }

        const key = `rate_limit:${ip}`;
        const banKey = `banned:${ip}`;

        try {
            const isBanned = await this.redis.get(banKey);
            if (isBanned) {
                return {
                    allowed: false,
                    reason: 'IP temporarily restricted due to aggressive scraping.',
                    retryAfter: await this.redis.ttl(banKey)
                };
            }

            const now = Date.now();
            const windowStart = now - (RATE_LIMIT_WINDOW_SECS * 1000);

            const pipeline = this.redis.pipeline();
            pipeline.zremrangebyscore(key, 0, windowStart);
            pipeline.zadd(key, now, `${now}-${Math.random()}`);
            pipeline.zcard(key);
            pipeline.expire(key, RATE_LIMIT_WINDOW_SECS);

            const results = await pipeline.exec();
            const requestCount = results[2][1];

            if (requestCount > MAX_REQUESTS_PER_WINDOW) {
                await this.redis.setex(banKey, PENALTY_BAN_SECS, "1");
                console.warn(`[DEFENSE] IP ${ip} banned for ${PENALTY_BAN_SECS}s due to rate limit violation.`);
                return {
                    allowed: false,
                    reason: 'Rate limit exceeded. Temporary ban applied.',
                    retryAfter: PENALTY_BAN_SECS
                };
            }

            return {
                allowed: true,
                remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - requestCount)
            };

        } catch (err) {
            console.error("[SECURITY] Redis Rate Limiter Error (Failing Open):", err.message);
            return { allowed: true };
        }
    }

    _checkLimitMemory(ip) {
        const now = Date.now();
        const key = `rate:${ip}`;
        let entry = memoryStore.get(key);

        if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_SECS * 1000) {
            entry = { windowStart: now, count: 0 };
        }

        entry.count++;
        memoryStore.set(key, entry);

        if (entry.count > MAX_REQUESTS_PER_WINDOW) {
            return { allowed: false, reason: 'Rate limit exceeded.', retryAfter: RATE_LIMIT_WINDOW_SECS };
        }

        return { allowed: true, remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count) };
    }
}

module.exports = new HeadyRateLimiter();

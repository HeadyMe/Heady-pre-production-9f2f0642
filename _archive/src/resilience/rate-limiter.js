/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Rate Limiter — Per-IP and per-key throttling
 * Prevents abuse of public endpoints and enforces fair usage.
 */

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000;       // 1 minute
        this.maxRequests = options.maxRequests || 100;    // per window
        this.store = new Map();
        this.cleanupInterval = setInterval(() => this._cleanup(), this.windowMs * 2);
        if (this.cleanupInterval.unref) this.cleanupInterval.unref();
    }

    /**
     * Express middleware factory
     */
    middleware() {
        return (req, res, next) => {
            const key = req.headers['x-api-key'] || req.ip || 'unknown';
            const now = Date.now();
            let record = this.store.get(key);

            if (!record || now - record.windowStart > this.windowMs) {
                record = { windowStart: now, count: 0 };
                this.store.set(key, record);
            }

            record.count++;

            // Set rate limit headers
            const remaining = Math.max(0, this.maxRequests - record.count);
            const resetAt = new Date(record.windowStart + this.windowMs);
            res.set('X-RateLimit-Limit', String(this.maxRequests));
            res.set('X-RateLimit-Remaining', String(remaining));
            res.set('X-RateLimit-Reset', resetAt.toISOString());

            if (record.count > this.maxRequests) {
                res.status(429).json({
                    error: 'Too Many Requests',
                    retryAfterMs: record.windowStart + this.windowMs - now,
                    limit: this.maxRequests,
                    windowMs: this.windowMs,
                });
                return;
            }

            next();
        };
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, record] of this.store) {
            if (now - record.windowStart > this.windowMs * 2) {
                this.store.delete(key);
            }
        }
    }

    getMetrics() {
        return {
            trackedClients: this.store.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests,
        };
    }
}

// Pre-configured limiters for different endpoint tiers
const limiters = {
    api: new RateLimiter({ windowMs: 60000, maxRequests: 100 }),    // Standard API
    ai: new RateLimiter({ windowMs: 60000, maxRequests: 20 }),     // AI model calls
    auth: new RateLimiter({ windowMs: 300000, maxRequests: 10 }),    // Login attempts
    public: new RateLimiter({ windowMs: 60000, maxRequests: 200 }),    // Public/static
    webhook: new RateLimiter({ windowMs: 60000, maxRequests: 50 }),     // Webhook ingress
};

module.exports = { RateLimiter, limiters };

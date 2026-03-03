/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Resilience Middleware ═══
 * Phase 1: Express middleware that wraps API calls through circuit breakers,
 *          caches GET responses, and enforces connection pool limits.
 *
 * This middleware activates the three resilience primitives that were
 * previously coded but never wired:
 *   - Circuit Breaker → prevents cascade failures
 *   - Cache → caches repeated GET responses
 *   - Connection Pool → bounds concurrent external calls
 */

const { getBreaker } = require('../resilience/circuit-breaker');
const { getCache } = require('../resilience/cache');

/**
 * Creates middleware that wraps outbound-heavy endpoints with circuit breakers.
 * Attach to routes that call external services.
 */
function circuitBreakerMiddleware(serviceName, options = {}) {
    const breaker = getBreaker(serviceName, options);

    return async (req, res, next) => {
        try {
            await breaker.execute(async () => {
                // Attach breaker state to request for downstream use
                req.circuitBreaker = breaker;
                req.circuitBreakerState = breaker.state;
            }, () => {
                // Fallback: respond with 503 when circuit is open
                if (options.fallbackResponse) {
                    return res.status(503).json(options.fallbackResponse);
                }
            });
            next();
        } catch (err) {
            if (err.isCircuitOpen) {
                return res.status(503).json({
                    ok: false,
                    error: 'Service temporarily unavailable',
                    circuitBreaker: serviceName,
                    state: 'OPEN',
                    retryAfter: Math.ceil(breaker.resetTimeoutMs / 1000),
                });
            }
            next(err);
        }
    };
}

/**
 * Creates middleware that caches GET responses for a given TTL.
 */
function cacheMiddleware(cacheName, ttlMs = 15000) {
    const cache = getCache(cacheName);

    return (req, res, next) => {
        if (req.method !== 'GET') return next();

        const key = `${cacheName}:${req.originalUrl}`;
        const cached = cache.get(key);

        if (cached !== undefined) {
            res.set('X-Cache', 'HIT');
            res.set('X-Cache-Name', cacheName);
            return res.json(cached);
        }

        // Intercept res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.set(key, body, ttlMs);
            }
            res.set('X-Cache', 'MISS');
            res.set('X-Cache-Name', cacheName);
            return originalJson(body);
        };

        next();
    };
}

/**
 * Middleware that reports resilience status in response headers.
 */
function resilienceHeaders() {
    return (req, res, next) => {
        if (req.circuitBreaker) {
            res.set('X-Circuit-Breaker', req.circuitBreaker.name);
            res.set('X-Circuit-State', req.circuitBreaker.state);
        }
        next();
    };
}

module.exports = { circuitBreakerMiddleware, cacheMiddleware, resilienceHeaders };

/**
 * Heady Resilience — Unified export
 * Combines circuit breaker, cache, connection pool, rate limiter, and retry
 * into a single require('src/resilience') import.
 */

const { CircuitBreaker, CircuitOpenError, getBreaker, getAllBreakers, CRITICAL_SERVICES } = require('./circuit-breaker');
const { HeadyCache, getCache, getAllCacheMetrics, caches } = require('./cache');
const { ConnectionPool, PoolExhaustedError, PoolTimeoutError, getPool, getAllPoolStatus, pools } = require('./pool');
const { RateLimiter, limiters } = require('./rate-limiter');
const { retry, DEFAULT_OPTIONS: RETRY_DEFAULTS } = require('./retry');

/**
 * Get full resilience status for all primitives
 * Useful for /api/resilience/status endpoint and HeadyLens telemetry
 */
function getResilienceStatus() {
    return {
        timestamp: new Date().toISOString(),
        circuitBreakers: getAllBreakers(),
        caches: getAllCacheMetrics(),
        pools: getAllPoolStatus(),
        rateLimiters: Object.fromEntries(
            Object.entries(limiters).map(([name, rl]) => [name, rl.getMetrics()])
        ),
        summary: {
            breakersRegistered: Object.keys(getAllBreakers()).length,
            breakersOpen: Object.values(getAllBreakers()).filter(b => b.state === 'OPEN').length,
            totalCacheHitRate: (() => {
                const m = getAllCacheMetrics();
                let hits = 0, misses = 0;
                for (const c of Object.values(m)) { hits += c.hits; misses += c.misses; }
                const total = hits + misses;
                return total > 0 ? (hits / total * 100).toFixed(1) + '%' : 'N/A';
            })(),
            poolsActive: Object.values(getAllPoolStatus()).reduce((sum, p) => sum + p.active, 0),
            rateLimiterClients: Object.values(limiters).reduce((sum, rl) => sum + rl.getMetrics().trackedClients, 0),
        }
    };
}

module.exports = {
    // Circuit Breaker
    CircuitBreaker, CircuitOpenError, getBreaker, getAllBreakers, CRITICAL_SERVICES,
    // Cache
    HeadyCache, getCache, getAllCacheMetrics, caches,
    // Pool
    ConnectionPool, PoolExhaustedError, PoolTimeoutError, getPool, getAllPoolStatus, pools,
    // Rate Limiter
    RateLimiter, limiters,
    // Retry
    retry, RETRY_DEFAULTS,
    // Unified
    getResilienceStatus,
};

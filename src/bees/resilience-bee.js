/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Resilience Bee — Covers all src/resilience/ modules + patterns:
 * auto-heal, cache, circuit-breaker, pool, rate-limiter, retry,
 * auto-tuning-pool, hot-cold-cache
 */
const domain = 'resilience';
const description = 'Auto-heal, cache, circuit breaker, connection pool, rate limiter, retry, auto-tuning, hot-cold cache';
const priority = 0.9;

function getWork(ctx = {}) {
    const mods = [
        { name: 'auto-heal', path: '../resilience/auto-heal' },
        { name: 'cache', path: '../resilience/cache' },
        { name: 'circuit-breaker', path: '../resilience/circuit-breaker' },
        { name: 'pool', path: '../resilience/pool' },
        { name: 'rate-limiter', path: '../resilience/rate-limiter' },
        { name: 'retry', path: '../resilience/retry' },
        { name: 'auto-tuning-pool', path: '../patterns/auto-tuning-pool' },
        { name: 'hot-cold-cache', path: '../patterns/hot-cold-cache' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };

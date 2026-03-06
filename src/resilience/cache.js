/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Cache — Hot/cold caching layer
 * LRU in-memory cache with TTL, hit/miss tracking, and namespace isolation.
 * Addresses registry bestPracticeScores.caching = 0.
 */

class HeadyCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 500;
        this.defaultTTLMs = options.defaultTTLMs || 60000; // 1 minute
        this.store = new Map();
        this.metrics = { hits: 0, misses: 0, evictions: 0, sets: 0 };
    }

    /**
     * Get a cached value
     * @param {string} key
     * @returns {any|undefined}
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            this.metrics.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            this.metrics.misses++;
            return undefined;
        }
        this.metrics.hits++;
        // Move to end for LRU
        this.store.delete(key);
        this.store.set(key, entry);
        return entry.value;
    }

    /**
     * Set a cached value
     * @param {string} key
     * @param {any} value
     * @param {number} [ttlMs] - override default TTL
     */
    set(key, value, ttlMs) {
        this.metrics.sets++;
        if (this.store.size >= this.maxSize) {
            // Evict oldest (first key in Map)
            const oldest = this.store.keys().next().value;
            this.store.delete(oldest);
            this.metrics.evictions++;
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + (ttlMs || this.defaultTTLMs),
            createdAt: Date.now(),
        });
    }

    /**
     * Get-or-set pattern: returns cached value if fresh, otherwise calls fn and caches result
     * @param {string} key
     * @param {Function} fn - async function to produce value on miss
     * @param {number} [ttlMs]
     * @returns {Promise<any>}
     */
    async getOrSet(key, fn, ttlMs) {
        const cached = this.get(key);
        if (cached !== undefined) return cached;
        const value = await fn();
        this.set(key, value, ttlMs);
        return value;
    }

    /**
     * Invalidate a specific key or all keys matching a prefix
     * @param {string} keyOrPrefix
     * @param {boolean} [prefix=false]
     */
    invalidate(keyOrPrefix, prefix = false) {
        if (prefix) {
            for (const k of this.store.keys()) {
                if (k.startsWith(keyOrPrefix)) this.store.delete(k);
            }
        } else {
            this.store.delete(keyOrPrefix);
        }
    }

    clear() {
        this.store.clear();
    }

    getMetrics() {
        const total = this.metrics.hits + this.metrics.misses;
        return {
            ...this.metrics,
            size: this.store.size,
            maxSize: this.maxSize,
            hitRate: total > 0 ? (this.metrics.hits / total * 100).toFixed(1) + '%' : '0%',
        };
    }
}

// ─── Named Cache Instances ─────────────────────────────────────────
// As recommended by registry: conductor-polls, registry-lookups, pattern-evaluations
const caches = {
    conductor: new HeadyCache({ maxSize: 200, defaultTTLMs: 5000 }),    // 5s — fast polls
    registry: new HeadyCache({ maxSize: 100, defaultTTLMs: 30000 }),   // 30s — registry rarely changes
    patterns: new HeadyCache({ maxSize: 300, defaultTTLMs: 120000 }),  // 2min — patterns are stable
    ai: new HeadyCache({ maxSize: 50, defaultTTLMs: 10000 }),   // 10s — AI response dedup
    health: new HeadyCache({ maxSize: 50, defaultTTLMs: 15000 }),   // 15s — health check results
};

function getCache(name) {
    if (!caches[name]) {
        caches[name] = new HeadyCache();
    }
    return caches[name];
}

function getAllCacheMetrics() {
    const result = {};
    for (const [name, cache] of Object.entries(caches)) {
        result[name] = cache.getMetrics();
    }
    return result;
}

module.exports = { HeadyCache, getCache, getAllCacheMetrics, caches };

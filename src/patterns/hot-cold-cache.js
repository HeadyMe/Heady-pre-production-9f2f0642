/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Hot/Cold Path Separation — Cache Layer
 * Routes requests through fast cache (hot) or origin (cold).
 * Auto-promotes frequently accessed items to hot path.
 * Auto-demotes stale items to cold path.
 */

class HotColdCache {
    constructor(name, options = {}) {
        this.name = name;
        this.hotMaxItems = options.hotMaxItems || 200;
        this.hotTtlMs = options.hotTtlMs || 60000; // 1 min default
        this.coldTtlMs = options.coldTtlMs || 300000; // 5 min default
        this.promotionThreshold = options.promotionThreshold || 3; // hits to promote

        this._hot = new Map(); // key → { value, ts, hits }
        this._cold = new Map();
        this._accessLog = new Map(); // key → hit count

        this.stats = { hotHits: 0, coldHits: 0, misses: 0, promotions: 0, evictions: 0 };

        // Periodic cleanup
        this._cleaner = setInterval(() => this._cleanup(), Math.min(this.hotTtlMs, this.coldTtlMs));
    }

    get(key) {
        const now = Date.now();

        // Try hot path first
        const hotEntry = this._hot.get(key);
        if (hotEntry && now - hotEntry.ts < this.hotTtlMs) {
            hotEntry.hits++;
            this.stats.hotHits++;
            return { value: hotEntry.value, path: "hot" };
        }

        // Try cold path
        const coldEntry = this._cold.get(key);
        if (coldEntry && now - coldEntry.ts < this.coldTtlMs) {
            this.stats.coldHits++;
            // Track access for promotion
            const count = (this._accessLog.get(key) || 0) + 1;
            this._accessLog.set(key, count);
            if (count >= this.promotionThreshold) {
                this._promote(key, coldEntry.value);
            }
            return { value: coldEntry.value, path: "cold" };
        }

        this.stats.misses++;
        return null;
    }

    set(key, value, path = "cold") {
        const entry = { value, ts: Date.now(), hits: 0 };
        if (path === "hot") {
            this._hot.set(key, entry);
            this._enforceLimits();
        } else {
            this._cold.set(key, entry);
        }
    }

    async getOrFetch(key, fetchFn, options = {}) {
        const cached = this.get(key);
        if (cached) return cached.value;

        const value = await fetchFn();
        this.set(key, value, options.path || "cold");
        return value;
    }

    _promote(key, value) {
        this._cold.delete(key);
        this._hot.set(key, { value, ts: Date.now(), hits: 0 });
        this._accessLog.delete(key);
        this.stats.promotions++;
        this._enforceLimits();
    }

    _enforceLimits() {
        if (this._hot.size <= this.hotMaxItems) return;

        // Evict least-hit items from hot → cold
        const entries = [...this._hot.entries()].sort((a, b) => a[1].hits - b[1].hits);
        const toEvict = entries.slice(0, this._hot.size - this.hotMaxItems);
        for (const [key, entry] of toEvict) {
            this._hot.delete(key);
            this._cold.set(key, entry);
            this.stats.evictions++;
        }
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, entry] of this._hot) {
            if (now - entry.ts > this.hotTtlMs) this._hot.delete(key);
        }
        for (const [key, entry] of this._cold) {
            if (now - entry.ts > this.coldTtlMs) this._cold.delete(key);
        }
    }

    invalidate(key) {
        this._hot.delete(key);
        this._cold.delete(key);
        this._accessLog.delete(key);
    }

    clear() {
        this._hot.clear();
        this._cold.clear();
        this._accessLog.clear();
    }

    getStatus() {
        return {
            name: this.name,
            hotSize: this._hot.size,
            coldSize: this._cold.size,
            hotMaxItems: this.hotMaxItems,
            ...this.stats,
            hitRate: this.stats.hotHits + this.stats.coldHits + this.stats.misses > 0
                ? ((this.stats.hotHits + this.stats.coldHits) / (this.stats.hotHits + this.stats.coldHits + this.stats.misses) * 100).toFixed(1) + "%"
                : "0.0%",
        };
    }

    destroy() {
        clearInterval(this._cleaner);
        this.clear();
    }
}

// ── Cache Registry ──
const caches = new Map();

function getCache(name, options) {
    if (!caches.has(name)) {
        caches.set(name, new HotColdCache(name, options));
    }
    return caches.get(name);
}

function getAllCacheStatus() {
    const status = {};
    for (const [name, cache] of caches) {
        status[name] = cache.getStatus();
    }
    return status;
}

module.exports = { HotColdCache, getCache, getAllCacheStatus };

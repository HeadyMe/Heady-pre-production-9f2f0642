/**
 * Heady Cache — Hot/cold caching layer
 * LRU in-memory cache with TTL, hit/miss tracking, and namespace isolation.
 * Addresses registry bestPracticeScores.caching = 0.
 */
export class HeadyCache {
    constructor(options?: {});
    maxSize: any;
    defaultTTLMs: any;
    store: Map<any, any>;
    metrics: {
        hits: number;
        misses: number;
        evictions: number;
        sets: number;
    };
    /**
     * Get a cached value
     * @param {string} key
     * @returns {any|undefined}
     */
    get(key: string): any | undefined;
    /**
     * Set a cached value
     * @param {string} key
     * @param {any} value
     * @param {number} [ttlMs] - override default TTL
     */
    set(key: string, value: any, ttlMs?: number): void;
    /**
     * Get-or-set pattern: returns cached value if fresh, otherwise calls fn and caches result
     * @param {string} key
     * @param {Function} fn - async function to produce value on miss
     * @param {number} [ttlMs]
     * @returns {Promise<any>}
     */
    getOrSet(key: string, fn: Function, ttlMs?: number): Promise<any>;
    /**
     * Invalidate a specific key or all keys matching a prefix
     * @param {string} keyOrPrefix
     * @param {boolean} [prefix=false]
     */
    invalidate(keyOrPrefix: string, prefix?: boolean): void;
    clear(): void;
    getMetrics(): {
        size: number;
        maxSize: any;
        hitRate: string;
        hits: number;
        misses: number;
        evictions: number;
        sets: number;
    };
}
export function getCache(name: any): any;
export function getAllCacheMetrics(): {};
export namespace caches {
    let conductor: HeadyCache;
    let registry: HeadyCache;
    let patterns: HeadyCache;
    let ai: HeadyCache;
    let health: HeadyCache;
}
//# sourceMappingURL=cache.d.ts.map
/**
 * Heady Hot/Cold Path Separation — Cache Layer
 * Routes requests through fast cache (hot) or origin (cold).
 * Auto-promotes frequently accessed items to hot path.
 * Auto-demotes stale items to cold path.
 */
export class HotColdCache {
    constructor(name: any, options?: {});
    name: any;
    hotMaxItems: any;
    hotTtlMs: any;
    coldTtlMs: any;
    promotionThreshold: any;
    _hot: Map<any, any>;
    _cold: Map<any, any>;
    _accessLog: Map<any, any>;
    stats: {
        hotHits: number;
        coldHits: number;
        misses: number;
        promotions: number;
        evictions: number;
    };
    _cleaner: NodeJS.Timeout;
    get(key: any): {
        value: any;
        path: string;
    } | null;
    set(key: any, value: any, path?: string): void;
    getOrFetch(key: any, fetchFn: any, options?: {}): Promise<any>;
    _promote(key: any, value: any): void;
    _enforceLimits(): void;
    _cleanup(): void;
    invalidate(key: any): void;
    clear(): void;
    getStatus(): {
        hitRate: string;
        hotHits: number;
        coldHits: number;
        misses: number;
        promotions: number;
        evictions: number;
        name: any;
        hotSize: number;
        coldSize: number;
        hotMaxItems: any;
    };
    destroy(): void;
}
export function getCache(name: any, options: any): any;
export function getAllCacheStatus(): {};
//# sourceMappingURL=hot-cold-cache.d.ts.map
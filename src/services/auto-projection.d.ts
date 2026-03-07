/**
 * Boot auto-projection: pre-render all sites, cache in RAM.
 * Call this during app bootstrap, after vault-boot.
 */
export function bootAutoProjection(): Promise<{
    ok: boolean;
    projected: number;
    totalDomains: number;
    aliasesCached: number;
    elapsedMs: number;
    edgeCachePush: {
        pushed: boolean;
        sitesInKV: number;
        namespaceId: any;
        reason?: undefined;
    } | {
        pushed: boolean;
        reason: any;
        sitesInKV?: undefined;
        namespaceId?: undefined;
    };
    results: ({
        domain: string;
        name: any;
        size: number;
        hash: string;
        error?: undefined;
    } | {
        domain: string;
        error: any;
        name?: undefined;
        size?: undefined;
        hash?: undefined;
    })[];
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    projected?: undefined;
    totalDomains?: undefined;
    aliasesCached?: undefined;
    elapsedMs?: undefined;
    edgeCachePush?: undefined;
    results?: undefined;
}>;
/**
 * Serve a projected site directly from RAM cache.
 * Returns null if domain not cached (caller should fall through to live render).
 */
export function serveProjection(hostname: any): any;
/**
 * Re-project a single domain (for hot-reload / config changes).
 */
export function reproject(domain: any): {
    ok: boolean;
    domain: any;
    hash: string;
    size: number;
    error?: undefined;
} | {
    ok: boolean;
    domain: any;
    error: any;
    hash?: undefined;
    size?: undefined;
};
/**
 * Re-project ALL sites (full cache refresh).
 */
export function reprojectAll(): Promise<{
    ok: boolean;
    projected: number;
    totalDomains: number;
    aliasesCached: number;
    elapsedMs: number;
    edgeCachePush: {
        pushed: boolean;
        sitesInKV: number;
        namespaceId: any;
        reason?: undefined;
    } | {
        pushed: boolean;
        reason: any;
        sitesInKV?: undefined;
        namespaceId?: undefined;
    };
    results: ({
        domain: string;
        name: any;
        size: number;
        hash: string;
        error?: undefined;
    } | {
        domain: string;
        error: any;
        name?: undefined;
        size?: undefined;
        hash?: undefined;
    })[];
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    projected?: undefined;
    totalDomains?: undefined;
    aliasesCached?: undefined;
    elapsedMs?: undefined;
    edgeCachePush?: undefined;
    results?: undefined;
}>;
export function autoProjectionRoutes(app: any): void;
//# sourceMappingURL=auto-projection.d.ts.map
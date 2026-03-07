/**
 * Heady Rate Limiter — Per-IP and per-key throttling
 * Prevents abuse of public endpoints and enforces fair usage.
 */
export class RateLimiter {
    constructor(options?: {});
    windowMs: any;
    maxRequests: any;
    store: Map<any, any>;
    cleanupInterval: NodeJS.Timeout;
    /**
     * Express middleware factory
     */
    middleware(): (req: any, res: any, next: any) => void;
    _cleanup(): void;
    getMetrics(): {
        trackedClients: number;
        windowMs: any;
        maxRequests: any;
    };
}
export namespace limiters {
    export let api: RateLimiter;
    export let ai: RateLimiter;
    export let auth: RateLimiter;
    let _public: RateLimiter;
    export { _public as public };
    export let webhook: RateLimiter;
}
//# sourceMappingURL=rate-limiter.d.ts.map
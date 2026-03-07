/**
 * Creates middleware that wraps outbound-heavy endpoints with circuit breakers.
 * Attach to routes that call external services.
 */
export function circuitBreakerMiddleware(serviceName: any, options?: {}): (req: any, res: any, next: any) => Promise<any>;
/**
 * Creates middleware that caches GET responses for a given TTL.
 */
export function cacheMiddleware(cacheName: any, ttlMs?: number): (req: any, res: any, next: any) => any;
/**
 * Middleware that reports resilience status in response headers.
 */
export function resilienceHeaders(): (req: any, res: any, next: any) => void;
//# sourceMappingURL=resilience-middleware.d.ts.map
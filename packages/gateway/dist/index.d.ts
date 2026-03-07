/**
 * @heady/gateway — API Gateway with Auth + Rate Limiting
 *
 * Routes requests across Heady services with:
 * - Cross-domain authentication (sign in once, roam all sites)
 * - Token-bucket rate limiting per tenant
 * - Request routing based on domain → service mapping
 */
export interface GatewayConfig {
    domains: Record<string, string>;
    rateLimitRpm: number;
    corsOrigins: string[];
}
export interface RateLimitState {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number;
}
export declare class HeadyGateway {
    private config;
    private rateLimits;
    private routedCount;
    constructor(config?: Partial<GatewayConfig>);
    route(hostname: string): string | null;
    checkRateLimit(clientId: string): {
        allowed: boolean;
        remaining: number;
    };
    getCorsHeaders(origin: string): Record<string, string>;
    getStatus(): {
        ok: boolean;
        domains: number;
        routedCount: number;
        rateLimitClients: number;
    };
}
export declare function createGateway(config?: Partial<GatewayConfig>): HeadyGateway;
//# sourceMappingURL=index.d.ts.map
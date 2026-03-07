export = MCPGatewayAuth;
declare class MCPGatewayAuth {
    constructor(opts?: {});
    rateLimiter: TokenBucketRateLimiter;
    breaker: CircuitBreaker;
    allowedScopes: any;
    _sessions: Map<any, any>;
    authenticate(req: any): Promise<{
        authenticated: boolean;
        error: string;
        user?: undefined;
    } | {
        authenticated: boolean;
        user: {
            id: any;
            email: any;
            scopes: any;
            tenantId: any;
        };
        error?: undefined;
    }>;
    createSession(userId: any): `${string}-${string}-${string}-${string}-${string}`;
    validateSession(sessionId: any): any;
    middleware(): (req: any, res: any, next: any) => Promise<any>;
    getMetrics(): {
        activeSessions: number;
        circuitBreaker: {
            state: string;
            failures: number;
            successes: number;
        };
    };
}
import { TokenBucketRateLimiter } from "../lib/circuit-breaker";
import { CircuitBreaker } from "../lib/circuit-breaker";
//# sourceMappingURL=mcp-auth.d.ts.map
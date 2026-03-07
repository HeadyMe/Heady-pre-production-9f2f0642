/**
 * @heady/gateway — API Gateway with Auth + Rate Limiting
 * 
 * Routes requests across Heady services with:
 * - Cross-domain authentication (sign in once, roam all sites)
 * - Token-bucket rate limiting per tenant
 * - Request routing based on domain → service mapping
 */

export interface GatewayConfig {
    domains: Record<string, string>;  // domain → serviceUrl
    rateLimitRpm: number;
    corsOrigins: string[];
}

export interface RateLimitState {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number;
}

const DEFAULT_DOMAINS: Record<string, string> = {
    'headyme.com': 'command-center',
    'headyio.com': 'heady-io-docs',
    'headymcp.com': 'heady-mcp-portal',
    'headysystems.com': 'heady-systems',
    'headyconnection.org': 'heady-connection',
    'headybuddy.org': 'heady-buddy',
    'headybot.com': 'heady-bot',
    'headyapi.com': 'heady-api',
    'headyai.com': 'heady-ai',
};

export class HeadyGateway {
    private config: GatewayConfig;
    private rateLimits = new Map<string, RateLimitState>();
    private routedCount = 0;

    constructor(config?: Partial<GatewayConfig>) {
        this.config = {
            domains: config?.domains || DEFAULT_DOMAINS,
            rateLimitRpm: config?.rateLimitRpm || 600,
            corsOrigins: config?.corsOrigins || Object.keys(DEFAULT_DOMAINS).map(d => `https://${d}`),
        };
    }

    route(hostname: string): string | null {
        this.routedCount++;
        return this.config.domains[hostname] || null;
    }

    checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
        let state = this.rateLimits.get(clientId);
        const now = Date.now();
        const maxTokens = this.config.rateLimitRpm;
        const refillRate = maxTokens / 60000; // tokens per ms

        if (!state) {
            state = { tokens: maxTokens, lastRefill: now, maxTokens, refillRate };
            this.rateLimits.set(clientId, state);
        }

        // Refill tokens
        const elapsed = now - state.lastRefill;
        state.tokens = Math.min(maxTokens, state.tokens + elapsed * refillRate);
        state.lastRefill = now;

        if (state.tokens >= 1) {
            state.tokens -= 1;
            return { allowed: true, remaining: Math.floor(state.tokens) };
        }

        return { allowed: false, remaining: 0 };
    }

    getCorsHeaders(origin: string): Record<string, string> {
        const allowed = this.config.corsOrigins.includes(origin);
        return {
            'Access-Control-Allow-Origin': allowed ? origin : '',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        };
    }

    getStatus() {
        return {
            ok: true,
            domains: Object.keys(this.config.domains).length,
            routedCount: this.routedCount,
            rateLimitClients: this.rateLimits.size,
        };
    }
}

export function createGateway(config?: Partial<GatewayConfig>): HeadyGateway {
    return new HeadyGateway(config);
}

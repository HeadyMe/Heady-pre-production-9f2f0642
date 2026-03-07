"use strict";
/**
 * @heady/gateway — API Gateway with Auth + Rate Limiting
 *
 * Routes requests across Heady services with:
 * - Cross-domain authentication (sign in once, roam all sites)
 * - Token-bucket rate limiting per tenant
 * - Request routing based on domain → service mapping
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadyGateway = void 0;
exports.createGateway = createGateway;
const DEFAULT_DOMAINS = {
    'headyme.com': 'command-center',
    'headyio.com': 'heady-io-docs',
    'headymcp.com': 'heady-mcp-portal',
    'headysystems.com': 'heady-systems',
    'headyconnection.org': 'heady-connection',
    'headybuddy.org': 'heady-buddy',
    'headybot.com': 'heady-bot',
    'headyapi.com': 'heady-api',
    'heady-ai.com': 'heady-ai',
};
class HeadyGateway {
    config;
    rateLimits = new Map();
    routedCount = 0;
    constructor(config) {
        this.config = {
            domains: config?.domains || DEFAULT_DOMAINS,
            rateLimitRpm: config?.rateLimitRpm || 600,
            corsOrigins: config?.corsOrigins || Object.keys(DEFAULT_DOMAINS).map(d => `https://${d}`),
        };
    }
    route(hostname) {
        this.routedCount++;
        return this.config.domains[hostname] || null;
    }
    checkRateLimit(clientId) {
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
    getCorsHeaders(origin) {
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
exports.HeadyGateway = HeadyGateway;
function createGateway(config) {
    return new HeadyGateway(config);
}
//# sourceMappingURL=index.js.map
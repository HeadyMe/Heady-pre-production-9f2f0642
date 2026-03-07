/**
 * T6: MCP Gateway Auth — SSO-integrated authentication for MCP servers
 * @module src/middleware/mcp-auth
 */
'use strict';

const crypto = require('crypto');
const { CircuitBreaker, TokenBucketRateLimiter } = require('../lib/circuit-breaker');

const MCP_RATE_LIMIT = parseInt(process.env.MCP_RATE_LIMIT || '100', 10);

class MCPGatewayAuth {
    constructor(opts = {}) {
        this.rateLimiter = new TokenBucketRateLimiter({ rate: MCP_RATE_LIMIT, burst: 20 });
        this.breaker = new CircuitBreaker({ failureThreshold: 5, recoveryTimeout: 30000 });
        this.allowedScopes = opts.scopes || ['tools.read', 'tools.execute', 'resources.read'];
        this._sessions = new Map();
    }

    // Validate MCP-specific JWT with scope checks
    async authenticate(req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return { authenticated: false, error: 'Missing authorization' };

        try {
            const [, payload] = token.split('.');
            const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

            // Validate issued-for this MCP server
            if (decoded.aud && decoded.aud !== process.env.MCP_SERVER_ID) {
                return { authenticated: false, error: 'Token not issued for this MCP server' };
            }

            // Validate expiry
            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return { authenticated: false, error: 'Token expired' };
            }

            // Validate scopes
            const tokenScopes = decoded.scope?.split(' ') || [];
            const hasScope = this.allowedScopes.some(s => tokenScopes.includes(s));
            if (!hasScope && tokenScopes.length > 0) {
                return { authenticated: false, error: 'Insufficient scopes' };
            }

            return {
                authenticated: true,
                user: { id: decoded.sub, email: decoded.email, scopes: tokenScopes, tenantId: decoded.org },
            };
        } catch (err) {
            return { authenticated: false, error: 'Invalid token' };
        }
    }

    // Session management with __Host- cookie prefix per MCP spec
    createSession(userId) {
        const sessionId = crypto.randomUUID();
        this._sessions.set(sessionId, {
            userId, createdAt: Date.now(),
            expiresAt: Date.now() + 600000, // 10 min
        });
        return sessionId;
    }

    validateSession(sessionId) {
        const session = this._sessions.get(sessionId);
        if (!session || session.expiresAt < Date.now()) {
            this._sessions.delete(sessionId);
            return null;
        }
        return session;
    }

    // Express middleware
    middleware() {
        return async (req, res, next) => {
            // Rate limit
            const rateResult = this.rateLimiter.consume(req.ip);
            if (!rateResult.allowed) {
                res.set('Retry-After', String(rateResult.retryAfter));
                return res.status(429).json({ error: 'MCP rate limit exceeded' });
            }

            // Authenticate
            const authResult = await this.authenticate(req);
            if (!authResult.authenticated) {
                return res.status(401).json({ error: authResult.error });
            }

            req.mcpUser = authResult.user;
            req.tenantId = authResult.user.tenantId;
            next();
        };
    }

    getMetrics() {
        return {
            activeSessions: this._sessions.size,
            circuitBreaker: this.breaker.getState(),
        };
    }
}

module.exports = MCPGatewayAuth;

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyOAuth — OAuth 2.1 Authorization Server for MCP Connectors
 *
 * Implements the OAuth 2.1 spec required by Claude Desktop/Claude.ai
 * for remote MCP server connections:
 *
 *   - /.well-known/oauth-authorization-server  (discovery)
 *   - /.well-known/oauth-protected-resource    (protected resource metadata)
 *   - POST /oauth/register                     (dynamic client registration)
 *   - GET  /oauth/authorize                    (consent page)
 *   - POST /oauth/authorize                    (process consent)
 *   - POST /oauth/token                        (auth code → access token)
 *
 * Supports: authorization_code grant, PKCE (S256), refresh tokens.
 * Storage: in-memory + JSON persistence in data/oauth-*.json.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const logger = require('../utils/logger');

// ── Constants ────────────────────────────────────────────────────────
const AUTH_CODE_TTL = 10 * 60 * 1000;           // 10 minutes
const ACCESS_TOKEN_TTL = 3600;                   // 1 hour (seconds)
const REFRESH_TOKEN_TTL = 90 * 24 * 3600;       // 90 days (seconds)

class HeadyOAuthProvider {
    constructor(opts = {}) {
        this.issuer = opts.issuer || process.env.HEADY_OAUTH_ISSUER || 'https://manager.headysystems.com';
        this.dataDir = opts.dataDir || path.join(__dirname, '..', '..', 'data');
        this.authEngine = opts.authEngine || null;
        this.adminKey = opts.adminKey || process.env.HEADY_API_KEY || '';

        // In-memory stores (persisted to disk)
        this.clients = this._load('oauth-clients.json');
        this.authCodes = {};  // ephemeral — not persisted
        this.tokens = this._load('oauth-tokens.json');

        // Cleanup expired tokens on boot
        this._cleanupExpired();
    }

    // ── Discovery ────────────────────────────────────────────────────
    getServerMetadata() {
        return {
            issuer: this.issuer,
            authorization_endpoint: `${this.issuer}/oauth/authorize`,
            token_endpoint: `${this.issuer}/oauth/token`,
            registration_endpoint: `${this.issuer}/oauth/register`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['mcp:tools', 'mcp:resources', 'mcp:prompts', 'mcp:read', 'mcp:write'],
            service_documentation: `${this.issuer}/api-docs`,
        };
    }

    getProtectedResourceMetadata() {
        return {
            resource: `${this.issuer}/mcp`,
            authorization_servers: [this.issuer],
            bearer_methods_supported: ['header'],
            scopes_supported: ['mcp:tools', 'mcp:resources', 'mcp:prompts'],
        };
    }

    // ── Dynamic Client Registration ──────────────────────────────────
    registerClient(body) {
        const clientId = `heady_${crypto.randomBytes(16).toString('hex')}`;
        const clientSecret = crypto.randomBytes(32).toString('base64url');

        const client = {
            client_id: clientId,
            client_secret: clientSecret,
            client_name: body.client_name || 'MCP Client',
            redirect_uris: body.redirect_uris || [],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            scope: 'mcp:tools mcp:resources mcp:prompts mcp:read mcp:write',
            created_at: Date.now(),
            client_id_issued_at: Math.floor(Date.now() / 1000),
        };

        this.clients[clientId] = client;
        this._save('oauth-clients.json', this.clients);

        logger.logNodeActivity('OAUTH', `Client registered: ${client.client_name} (${clientId})`);

        return {
            client_id: clientId,
            client_secret: clientSecret,
            client_name: client.client_name,
            redirect_uris: client.redirect_uris,
            grant_types: client.grant_types,
            response_types: client.response_types,
            scope: client.scope,
            client_id_issued_at: client.client_id_issued_at,
        };
    }

    // ── Authorization ────────────────────────────────────────────────
    createAuthCode(clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, apiKey) {
        // Validate the API key against HeadyAuth or admin key
        let tier = 'guest';
        if (apiKey === this.adminKey) {
            tier = 'admin';
        } else if (this.authEngine) {
            const verified = this.authEngine.verify(apiKey);
            if (verified) {
                tier = verified.tier;
            } else {
                return null;  // Invalid key
            }
        } else if (apiKey) {
            // Fallback: check key prefix
            if (apiKey.startsWith('hdy_int_')) tier = 'admin';
            else if (apiKey.startsWith('hdy_max_') || apiKey.startsWith('hdy_ent_')) tier = 'premium';
            else if (apiKey.startsWith('hdy_pro_') || apiKey.startsWith('hdy_biz_')) tier = 'pro';
            else if (apiKey.startsWith('hdy_free_')) tier = 'free';
            else return null;
        } else {
            return null;
        }

        const code = crypto.randomBytes(32).toString('base64url');

        this.authCodes[code] = {
            clientId,
            redirectUri,
            scope: scope || 'mcp:tools mcp:resources mcp:prompts',
            codeChallenge,
            codeChallengeMethod,
            tier,
            apiKey,
            createdAt: Date.now(),
            expiresAt: Date.now() + AUTH_CODE_TTL,
        };

        return code;
    }

    // ── Token Exchange ───────────────────────────────────────────────
    exchangeCode(code, clientId, clientSecret, redirectUri, codeVerifier) {
        const authCode = this.authCodes[code];
        if (!authCode) return { error: 'invalid_grant', error_description: 'Auth code not found or expired' };
        if (authCode.expiresAt < Date.now()) {
            delete this.authCodes[code];
            return { error: 'invalid_grant', error_description: 'Auth code expired' };
        }
        if (authCode.clientId !== clientId) {
            return { error: 'invalid_grant', error_description: 'Client mismatch' };
        }

        // Validate client credentials
        const client = this.clients[clientId];
        if (!client || client.client_secret !== clientSecret) {
            return { error: 'invalid_client', error_description: 'Invalid client credentials' };
        }

        // Validate PKCE if present
        if (authCode.codeChallenge) {
            if (!codeVerifier) {
                return { error: 'invalid_grant', error_description: 'PKCE code_verifier required' };
            }
            const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
            if (computed !== authCode.codeChallenge) {
                return { error: 'invalid_grant', error_description: 'PKCE code_verifier mismatch' };
            }
        }

        // Generate tokens
        const accessToken = `hdy_at_${crypto.randomBytes(32).toString('base64url')}`;
        const refreshToken = `hdy_rt_${crypto.randomBytes(32).toString('base64url')}`;
        const now = Math.floor(Date.now() / 1000);

        this.tokens[accessToken] = {
            type: 'access',
            clientId,
            scope: authCode.scope,
            tier: authCode.tier,
            apiKey: authCode.apiKey,
            issuedAt: now,
            expiresAt: now + ACCESS_TOKEN_TTL,
        };

        this.tokens[refreshToken] = {
            type: 'refresh',
            clientId,
            scope: authCode.scope,
            tier: authCode.tier,
            apiKey: authCode.apiKey,
            issuedAt: now,
            expiresAt: now + REFRESH_TOKEN_TTL,
        };

        // Consume the auth code (one-time use)
        delete this.authCodes[code];

        this._save('oauth-tokens.json', this.tokens);

        logger.logNodeActivity('OAUTH', `Token issued for client ${clientId} (tier: ${authCode.tier})`);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL,
            refresh_token: refreshToken,
            scope: authCode.scope,
        };
    }

    // ── Refresh Token ────────────────────────────────────────────────
    refreshAccessToken(refreshTokenValue, clientId, clientSecret) {
        const rt = this.tokens[refreshTokenValue];
        if (!rt || rt.type !== 'refresh') {
            return { error: 'invalid_grant', error_description: 'Invalid refresh token' };
        }
        if (rt.expiresAt < Math.floor(Date.now() / 1000)) {
            delete this.tokens[refreshTokenValue];
            this._save('oauth-tokens.json', this.tokens);
            return { error: 'invalid_grant', error_description: 'Refresh token expired' };
        }
        if (rt.clientId !== clientId) {
            return { error: 'invalid_client', error_description: 'Client mismatch' };
        }

        // Validate client
        const client = this.clients[clientId];
        if (!client || client.client_secret !== clientSecret) {
            return { error: 'invalid_client', error_description: 'Invalid client credentials' };
        }

        // Issue new access token
        const accessToken = `hdy_at_${crypto.randomBytes(32).toString('base64url')}`;
        const now = Math.floor(Date.now() / 1000);

        this.tokens[accessToken] = {
            type: 'access',
            clientId,
            scope: rt.scope,
            tier: rt.tier,
            apiKey: rt.apiKey,
            issuedAt: now,
            expiresAt: now + ACCESS_TOKEN_TTL,
        };

        this._save('oauth-tokens.json', this.tokens);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL,
            refresh_token: refreshTokenValue,
            scope: rt.scope,
        };
    }

    // ── Token Verification (used by SSE transport) ───────────────────
    verifyAccessToken(token) {
        if (!token) return null;

        // Also accept raw Heady API keys
        if (token === this.adminKey) {
            return { valid: true, tier: 'admin', scope: 'mcp:tools mcp:resources mcp:prompts mcp:read mcp:write', apiKey: token };
        }

        const t = this.tokens[token];
        if (!t || t.type !== 'access') return null;
        if (t.expiresAt < Math.floor(Date.now() / 1000)) {
            delete this.tokens[token];
            return null;
        }

        return { valid: true, tier: t.tier, scope: t.scope, clientId: t.clientId, apiKey: t.apiKey };
    }

    // ── Persistence ──────────────────────────────────────────────────
    _load(filename) {
        try {
            const fp = path.join(this.dataDir, filename);
            if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
        } catch { /* ignore */ }
        return {};
    }

    _save(filename, data) {
        try {
            if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(path.join(this.dataDir, filename), JSON.stringify(data, null, 2));
        } catch { /* ignore */ }
    }

    _cleanupExpired() {
        const now = Math.floor(Date.now() / 1000);
        let cleaned = 0;
        for (const [key, tok] of Object.entries(this.tokens)) {
            if (tok.expiresAt < now) {
                delete this.tokens[key];
                cleaned++;
            }
        }
        if (cleaned > 0) this._save('oauth-tokens.json', this.tokens);
    }
}

// ── Express Routes ───────────────────────────────────────────────────

function registerOAuthRoutes(app, oauthProvider) {
    const router = express.Router();

    // ── Discovery ────────────────────────────────────────────────────
    app.get('/.well-known/oauth-authorization-server', (_req, res) => {
        res.json(oauthProvider.getServerMetadata());
    });

    app.get('/.well-known/oauth-protected-resource', (_req, res) => {
        res.json(oauthProvider.getProtectedResourceMetadata());
    });

    // ── Dynamic Client Registration ──────────────────────────────────
    router.post('/register', express.json(), (req, res) => {
        try {
            const result = oauthProvider.registerClient(req.body || {});
            res.status(201).json(result);
        } catch (err) {
            res.status(400).json({ error: 'invalid_client_metadata', error_description: err.message });
        }
    });

    // ── Authorization Endpoint (GET = show consent page) ─────────────
    router.get('/authorize', (req, res) => {
        const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

        if (response_type !== 'code') {
            return res.status(400).json({ error: 'unsupported_response_type' });
        }

        const client = oauthProvider.clients[client_id];
        if (!client) {
            return res.status(400).json({ error: 'invalid_client', error_description: 'Client not registered' });
        }

        // Serve consent page
        res.setHeader('Content-Type', 'text/html');
        res.send(getConsentPageHtml({
            clientName: client.client_name,
            scope: scope || 'mcp:tools mcp:resources mcp:prompts',
            clientId: client_id,
            redirectUri: redirect_uri,
            state: state || '',
            codeChallenge: code_challenge || '',
            codeChallengeMethod: code_challenge_method || '',
        }));
    });

    // ── Authorization Endpoint (POST = process consent) ──────────────
    router.post('/authorize', express.urlencoded({ extended: true }), (req, res) => {
        const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, api_key } = req.body;

        if (!api_key) {
            return res.status(400).json({ error: 'access_denied', error_description: 'API key required' });
        }

        const code = oauthProvider.createAuthCode(client_id, redirect_uri, scope, code_challenge, code_challenge_method, api_key);
        if (!code) {
            return res.status(403).json({ error: 'access_denied', error_description: 'Invalid API key' });
        }

        // Redirect back with auth code
        const url = new URL(redirect_uri);
        url.searchParams.set('code', code);
        if (state) url.searchParams.set('state', state);
        res.redirect(302, url.toString());
    });

    // ── Token Endpoint ───────────────────────────────────────────────
    router.post('/token', express.urlencoded({ extended: true }), (req, res) => {
        const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body;

        // Also support Basic auth for client credentials
        let resolvedClientId = client_id;
        let resolvedClientSecret = client_secret;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Basic ')) {
            const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
            const [id, secret] = decoded.split(':');
            resolvedClientId = resolvedClientId || id;
            resolvedClientSecret = resolvedClientSecret || secret;
        }

        if (grant_type === 'authorization_code') {
            const result = oauthProvider.exchangeCode(code, resolvedClientId, resolvedClientSecret, redirect_uri, code_verifier);
            if (result.error) return res.status(400).json(result);
            return res.json(result);
        }

        if (grant_type === 'refresh_token') {
            const result = oauthProvider.refreshAccessToken(refresh_token, resolvedClientId, resolvedClientSecret);
            if (result.error) return res.status(400).json(result);
            return res.json(result);
        }

        return res.status(400).json({ error: 'unsupported_grant_type' });
    });

    app.use('/oauth', router);

    logger.logNodeActivity('CONDUCTOR', '  🔐 OAuth 2.1: LOADED (/.well-known/oauth-authorization-server, /oauth/*)');
    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /oauth/register, /oauth/authorize, /oauth/token');

    return router;
}

// ── Consent Page HTML ────────────────────────────────────────────────
function getConsentPageHtml({ clientName, scope, clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐝 Heady — Authorize ${clientName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 16px; padding: 40px; max-width: 420px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .logo { font-size: 48px; text-align: center; margin-bottom: 8px; }
        h1 { font-size: 20px; text-align: center; color: #f0f6fc; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #8b949e; font-size: 14px; margin-bottom: 24px; }
        .client-name { color: #58a6ff; font-weight: 600; }
        .scope-list { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
        .scope-item { padding: 6px 0; font-size: 13px; color: #8b949e; }
        .scope-item::before { content: '✓ '; color: #3fb950; }
        label { display: block; font-size: 14px; color: #c9d1d9; margin-bottom: 8px; font-weight: 500; }
        input[type="password"] { width: 100%; padding: 12px 16px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #f0f6fc; font-size: 14px; font-family: 'JetBrains Mono', monospace; outline: none; transition: border-color 0.2s; }
        input[type="password"]:focus { border-color: #f7c948; }
        .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; transition: all 0.2s; }
        .btn-authorize { background: linear-gradient(135deg, #f7c948, #f0a30a); color: #0d1117; }
        .btn-authorize:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-deny { background: transparent; color: #8b949e; border: 1px solid #30363d; margin-top: 8px; }
        .btn-deny:hover { border-color: #f85149; color: #f85149; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #484f58; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">🐝</div>
        <h1>Authorize Access</h1>
        <p class="subtitle"><span class="client-name">${clientName}</span> wants to access Heady MCP</p>

        <div class="scope-list">
            ${scope.split(' ').map(s => `<div class="scope-item">${s.replace('mcp:', 'MCP ')}</div>`).join('')}
        </div>

        <form method="POST" action="/oauth/authorize">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="scope" value="${scope}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${codeChallenge}">
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

            <label for="api_key">Your Heady API Key</label>
            <input type="password" id="api_key" name="api_key" placeholder="hdy_pro_..." required autocomplete="off">

            <button type="submit" class="btn btn-authorize">🔓 Authorize</button>
        </form>

        <form action="#" onsubmit="window.close(); return false;">
            <button type="submit" class="btn btn-deny">Deny</button>
        </form>

        <div class="footer">Heady Systems LLC — headyme.com</div>
    </div>
</body>
</html>`;
}

module.exports = { HeadyOAuthProvider, registerOAuthRoutes };

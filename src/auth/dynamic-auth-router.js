/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Dynamic Auth Router — auto-wires routes from provider-registry.js
 * Two connector types are generated dynamically:
 *   OAuth:  GET /:provider → redirect to auth URL
 *           GET /:provider/callback → exchange code, extract user, postMessage
 *   API Key: POST /:provider → validate key against provider API
 *
 * Adding a new provider = add an entry to provider-registry.js. Done.
 */
const router = require('express').Router();
const registry = require('./provider-registry');
const logger = require('../utils/logger');

// ─── postMessage popup HTML helpers ──────────────────────────────
function successPage(token, user) {
    const payload = JSON.stringify({ type: 'heady_auth_success', token, user });
    return `<!DOCTYPE html>
<html><head><title>Heady — Connected</title>
<style>body{background:#0a0a0f;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;padding:40px;border-radius:24px;background:rgba(15,15,25,0.95);border:1px solid rgba(255,255,255,0.08)}
h2{color:#818cf8;margin-bottom:8px}p{opacity:0.7;font-size:0.9rem}</style></head>
<body><div class="box"><h2>✅ Connected to Heady</h2><p>This window will close automatically...</p></div>
<script>
try { window.opener.postMessage(${payload}, '*'); } catch(e) {}
setTimeout(function(){ window.close(); }, 1500);
</script></body></html>`;
}

function errorPage(message) {
    return `<!DOCTYPE html>
<html><head><title>Heady — Auth Error</title>
<style>body{background:#0a0a0f;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;padding:40px;border-radius:24px;background:rgba(15,15,25,0.95);border:1px solid rgba(255,255,255,0.08)}
h2{color:#ef4444;margin-bottom:8px}p{opacity:0.7;font-size:0.9rem}
.btn{margin-top:16px;padding:10px 24px;border-radius:12px;background:#818cf8;color:#000;border:none;cursor:pointer;font-weight:700}</style></head>
<body><div class="box"><h2>⚠️ Auth Error</h2><p>${message}</p>
<button class="btn" onclick="window.close()">Close</button></div></body></html>`;
}

// ═══ Auto-wire OAuth providers ═══════════════════════════════════
for (const [key, provider] of Object.entries(registry)) {
    if (provider.type !== 'oauth') continue;

    // GET /:provider — initiate OAuth redirect
    router.get(`/${key}`, (req, res) => {
        const clientId = process.env[provider.envKey];
        if (!clientId) {
            return res.send(errorPage(`${provider.name} OAuth not configured — set ${provider.envKey}`));
        }
        const redirect = `https://${req.get('host')}/api/auth/${key}/callback`;
        const authorizeUrl = typeof provider.authorizeUrl === 'function' ? provider.authorizeUrl() : provider.authorizeUrl;
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirect,
            response_type: 'code',
            scope: provider.scope,
            ...(provider.extraParams || {}),
        });
        res.redirect(`${authorizeUrl}?${params.toString()}`);
    });

    // GET /:provider/callback — exchange code for token, extract user
    router.get(`/${key}/callback`, async (req, res) => {
        const { code } = req.query;
        if (!code) return res.send(errorPage(`Missing authorization code from ${provider.name}.`));
        try {
            const redirect = `https://${req.get('host')}/api/auth/${key}/callback`;
            const tokenUrl = typeof provider.tokenUrl === 'function' ? provider.tokenUrl() : provider.tokenUrl;
            const contentType = provider.tokenContentType || 'application/x-www-form-urlencoded';

            const tokenBody = new URLSearchParams({
                client_id: process.env[provider.envKey],
                client_secret: process.env[provider.envSecret],
                code,
                redirect_uri: redirect,
                grant_type: 'authorization_code',
            });

            const tokenHeaders = { 'Content-Type': contentType, 'Accept': 'application/json' };
            // Some providers require Basic auth for token exchange
            if (provider.tokenAuth === 'basic') {
                const creds = Buffer.from(`${process.env[provider.envKey]}:${process.env[provider.envSecret]}`).toString('base64');
                tokenHeaders['Authorization'] = `Basic ${creds}`;
            }

            const tokenRes = await fetch(tokenUrl, {
                method: 'POST',
                headers: tokenHeaders,
                body: tokenBody.toString(),
            });
            const tokens = await tokenRes.json();
            if (tokens.error) throw new Error(tokens.error_description || tokens.error_message || tokens.error);

            // Fetch profile if provider has a profileUrl
            let profile = null;
            const accessToken = tokens.access_token;
            if (provider.profileUrl) {
                const profileHeaders = provider.profileHeaders
                    ? provider.profileHeaders(accessToken)
                    : { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' };
                const profileRes = await fetch(provider.profileUrl, { headers: profileHeaders });
                profile = await profileRes.json();
            }

            // Extract user info using provider's extractor
            const user = await Promise.resolve(provider.extractUser(tokens, profile, accessToken));
            user.provider = key;

            const sessionToken = `${provider.tokenPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
            logger.info(`[Auth] ${provider.name} OAuth success`, { email: user.email, provider: key });
            res.send(successPage(sessionToken, user));
        } catch (err) {
            logger.error(`[Auth] ${provider.name} OAuth failed`, { error: err.message, provider: key });
            res.send(errorPage(`${provider.name} sign-in failed: ${err.message}`));
        }
    });
}

// ═══ Auto-wire API Key providers ═════════════════════════════════
for (const [key, provider] of Object.entries(registry)) {
    if (provider.type !== 'apikey') continue;

    router.post(`/${key}`, async (req, res) => {
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ error: 'API key required' });
        try {
            const url = typeof provider.validateUrl === 'function' ? provider.validateUrl(apiKey) : provider.validateUrl;
            const headers = provider.validateHeaders(apiKey);
            const fetchOpts = { method: provider.validateMethod || 'GET', headers };
            if (provider.validateBody) {
                fetchOpts.body = JSON.stringify(provider.validateBody);
            }

            const check = await fetch(url, fetchOpts);
            if (!check.ok) {
                const errData = await check.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Invalid ${provider.name} API key`);
            }

            const sessionToken = `${provider.tokenPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
            const user = { name: `${provider.name} User`, email: null, photo: null, provider: key };
            logger.info(`[Auth] ${provider.name} key validated`, { provider: key });
            res.json({ success: true, token: sessionToken, user, expiresIn: 90 * 24 * 60 * 60 });
        } catch (err) {
            logger.error(`[Auth] ${provider.name} key validation failed`, { error: err.message, provider: key });
            res.status(401).json({ error: `${provider.name} key validation failed`, message: err.message });
        }
    });
}

// ═══ Email / Device / WARP — always available ════════════════════
router.post('/email', (req, res) => {
    const { email, site } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const sessionToken = `hdy_em_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    const user = { email, name: email.split('@')[0], photo: null, provider: 'email' };
    logger.info('[Auth] Email auth', { email, site });
    res.json({ success: true, token: sessionToken, user, expiresIn: 30 * 24 * 60 * 60 });
});

router.post('/device', (req, res) => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    const deviceCode = `hdy_dev_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    res.json({ device_code: deviceCode, user_code: code, verification_uri: 'https://headysystems.com/device', expires_in: 900, interval: 5 });
});

router.post('/warp', (req, res) => {
    const cfAccessJWT = req.headers['cf-access-jwt-assertion'];
    if (!cfAccessJWT) return res.status(401).json({ error: 'Missing CF-Access-JWT-Assertion header' });
    const sessionToken = `hdy_warp_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({ success: true, token: sessionToken, tier: 'admin', expiresIn: 365 * 24 * 60 * 60 });
});

router.post('/verify', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const isValid = token.startsWith('hdy_') || token === process.env.HEADY_API_KEY;
    const tier = token === process.env.HEADY_API_KEY ? 'admin' : token.startsWith('hdy_warp_') ? 'admin' : 'pro';
    res.json({ valid: isValid, tier, token: token.substring(0, 12) + '...' });
});

router.post('/refresh', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const newToken = `hdy_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({ success: true, token: newToken, expiresIn: 30 * 24 * 60 * 60 });
});

// ═══ Dynamic provider listing ════════════════════════════════════
// Frontend fetches this to render available auth buttons dynamically
router.get('/providers', (req, res) => {
    const providers = {};
    for (const [key, p] of Object.entries(registry)) {
        const configured = p.type === 'oauth'
            ? !!process.env[p.envKey]
            : true; // API key providers are always available
        providers[key] = {
            type: p.type,
            name: p.name,
            icon: p.icon,
            color: p.color,
            bg: p.bg,
            configured,
            keyPlaceholder: p.keyPlaceholder || null,
        };
    }
    // Add built-in methods
    providers.email = { type: 'builtin', name: 'Email', configured: true };
    providers.device = { type: 'builtin', name: 'Device Code', configured: true };
    providers.warp = { type: 'builtin', name: 'Cloudflare WARP', configured: true };
    res.json({ providers });
});

// Legacy compat: /sessions
router.get('/sessions', (req, res) => {
    const configured = {};
    for (const [key, p] of Object.entries(registry)) {
        configured[key] = p.type === 'oauth' ? !!process.env[p.envKey] : true;
    }
    configured.email = true;
    configured.warp = true;
    configured.device = true;
    res.json({ activeSessions: 1, methods: Object.keys(configured), configured });
});

module.exports = router;

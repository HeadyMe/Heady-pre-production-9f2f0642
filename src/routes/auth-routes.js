/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Auth Routes — OAuth (Google + GitHub), device auth, WARP, and email flows
 * Endpoint: /api/auth/*
 *
 * ENV required for Google:  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * ENV required for GitHub:  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 */
const router = require('express').Router();
const logger = require('../utils/logger');

// ─── Helper: Generate postMessage HTML for popup auth ────────────
function authSuccessPage(token, user) {
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

function authErrorPage(message) {
    return `<!DOCTYPE html>
<html><head><title>Heady — Auth Error</title>
<style>body{background:#0a0a0f;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;padding:40px;border-radius:24px;background:rgba(15,15,25,0.95);border:1px solid rgba(255,255,255,0.08)}
h2{color:#ef4444;margin-bottom:8px}p{opacity:0.7;font-size:0.9rem}
.btn{margin-top:16px;padding:10px 24px;border-radius:12px;background:#818cf8;color:#000;border:none;cursor:pointer;font-weight:700}</style></head>
<body><div class="box"><h2>⚠️ Auth Error</h2><p>${message}</p>
<button class="btn" onclick="window.close()">Close</button></div></body></html>`;
}

// ═══ Google OAuth ═══════════════════════════════════════════════
router.get('/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return res.send(authErrorPage('Google OAuth is not configured on this server. Ask the admin to set GOOGLE_CLIENT_ID.'));
    }
    const redirect = `https://${req.get('host')}/api/auth/google/callback`;
    const state = req.query.redirect || '';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}` +
        `&response_type=code&scope=openid%20email%20profile&access_type=offline` +
        `&state=${encodeURIComponent(state)}`;
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send(authErrorPage('Missing authorization code from Google.'));
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `https://${req.get('host')}/api/auth/google/callback`,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error(tokens.error_description || tokens.error);

        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        const sessionToken = `hdy_g_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
        const user = { email: payload.email, name: payload.name, photo: payload.picture, provider: 'google' };

        logger.info('[Auth] Google OAuth success', { email: user.email });
        res.send(authSuccessPage(sessionToken, user));
    } catch (err) {
        logger.error('[Auth] Google OAuth failed', { error: err.message });
        res.send(authErrorPage('Google sign-in failed: ' + err.message));
    }
});

// ═══ GitHub OAuth ═══════════════════════════════════════════════
router.get('/github', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
        return res.send(authErrorPage('GitHub OAuth is not configured on this server. Ask the admin to set GITHUB_CLIENT_ID.'));
    }
    const redirect = `https://${req.get('host')}/api/auth/github/callback`;
    const state = req.query.redirect || '';
    const url = `https://github.com/login/oauth/authorize?` +
        `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}` +
        `&scope=read:user%20user:email&state=${encodeURIComponent(state)}`;
    res.redirect(url);
});

router.get('/github/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send(authErrorPage('Missing authorization code from GitHub.'));
    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: `https://${req.get('host')}/api/auth/github/callback`,
            }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Fetch user profile
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json',
                'User-Agent': 'HeadyMe-Auth/1.0',
            },
        });
        const ghUser = await userRes.json();

        // Fetch email if not public
        let email = ghUser.email;
        if (!email) {
            const emailRes = await fetch('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/json',
                    'User-Agent': 'HeadyMe-Auth/1.0',
                },
            });
            const emails = await emailRes.json();
            const primary = emails.find(e => e.primary) || emails[0];
            email = primary ? primary.email : `${ghUser.login}@github.noreply`;
        }

        const sessionToken = `hdy_gh_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
        const user = {
            email,
            name: ghUser.name || ghUser.login,
            photo: ghUser.avatar_url,
            provider: 'github',
            login: ghUser.login,
        };

        logger.info('[Auth] GitHub OAuth success', { email: user.email, login: ghUser.login });
        res.send(authSuccessPage(sessionToken, user));
    } catch (err) {
        logger.error('[Auth] GitHub OAuth failed', { error: err.message });
        res.send(authErrorPage('GitHub sign-in failed: ' + err.message));
    }
});

// ═══ Amazon OAuth (Login with Amazon) ══════════════════════════
router.get('/amazon', (req, res) => {
    const clientId = process.env.AMAZON_CLIENT_ID;
    if (!clientId) {
        return res.send(authErrorPage('Amazon OAuth is not configured on this server. Ask the admin to set AMAZON_CLIENT_ID.'));
    }
    const redirect = `https://${req.get('host')}/api/auth/amazon/callback`;
    const state = req.query.redirect || '';
    const url = `https://www.amazon.com/ap/oa?` +
        `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}` +
        `&scope=profile&response_type=code&state=${encodeURIComponent(state)}`;
    res.redirect(url);
});

router.get('/amazon/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send(authErrorPage('Missing authorization code from Amazon.'));
    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: process.env.AMAZON_CLIENT_ID,
                client_secret: process.env.AMAZON_CLIENT_SECRET,
                redirect_uri: `https://${req.get('host')}/api/auth/amazon/callback`,
            }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Fetch user profile
        const profileRes = await fetch('https://api.amazon.com/user/profile', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json();

        const sessionToken = `hdy_az_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
        const user = {
            email: profile.email,
            name: profile.name,
            photo: null, // Amazon doesn't provide avatar
            provider: 'amazon',
        };

        logger.info('[Auth] Amazon OAuth success', { email: user.email });
        res.send(authSuccessPage(sessionToken, user));
    } catch (err) {
        logger.error('[Auth] Amazon OAuth failed', { error: err.message });
        res.send(authErrorPage('Amazon sign-in failed: ' + err.message));
    }
});

// ═══ Email Magic Link ══════════════════════════════════════════
router.post('/email', (req, res) => {
    const { email, site } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    // Create instant local session (magic link would be sent in full production)
    const sessionToken = `hdy_em_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    const user = { email, name: email.split('@')[0], photo: null, provider: 'email' };
    logger.info('[Auth] Email auth', { email, site });
    res.json({ success: true, token: sessionToken, user, expiresIn: 30 * 24 * 60 * 60 });
});

// ═══ Device Code Flow (CLI/headless) ═══════════════════════════
router.post('/device', (req, res) => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    const deviceCode = `hdy_dev_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    res.json({
        device_code: deviceCode,
        user_code: code,
        verification_uri: 'https://headysystems.com/device',
        expires_in: 900,
        interval: 5,
    });
});

// ═══ WARP Auth (Cloudflare Zero Trust) ═════════════════════════
router.post('/warp', (req, res) => {
    const cfAccessJWT = req.headers['cf-access-jwt-assertion'];
    if (!cfAccessJWT) {
        return res.status(401).json({ error: 'Missing CF-Access-JWT-Assertion header' });
    }
    const sessionToken = `hdy_warp_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({ success: true, token: sessionToken, tier: 'admin', expiresIn: 365 * 24 * 60 * 60 });
});

// ═══ Token Verification ═══════════════════════════════════════
router.post('/verify', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const isValid = token.startsWith('hdy_') || token === process.env.HEADY_API_KEY;
    const tier = token === process.env.HEADY_API_KEY ? 'admin'
        : token.startsWith('hdy_warp_') ? 'admin'
            : token.startsWith('hdy_gh_') ? 'pro'
                : token.startsWith('hdy_g_') ? 'pro'
                    : token.startsWith('hdy_az_') ? 'pro'
                        : 'basic';
    res.json({ valid: isValid, tier, token: token.substring(0, 12) + '...' });
});

// ═══ Token Refresh ════════════════════════════════════════════
router.post('/refresh', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const newToken = `hdy_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({ success: true, token: newToken, expiresIn: 30 * 24 * 60 * 60 });
});

// ═══ Active Sessions & Auth Config Status ═════════════════════
router.get('/sessions', (req, res) => {
    res.json({
        activeSessions: 1,
        methods: ['google', 'github', 'amazon', 'email', 'device', 'warp'],
        configured: {
            google: !!process.env.GOOGLE_CLIENT_ID,
            github: !!process.env.GITHUB_CLIENT_ID,
            amazon: !!process.env.AMAZON_CLIENT_ID,
            email: true,
            warp: true,
            device: true,
        },
    });
});

module.exports = router;

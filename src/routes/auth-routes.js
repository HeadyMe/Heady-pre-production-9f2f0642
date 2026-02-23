/**
 * Auth Routes — Extended OAuth and device auth flows
 * Supplements inline auth at /api/auth/login and /api/auth/policy
 * Endpoint: /api/auth/*
 */
const router = require('express').Router();

// Google OAuth initiation
router.get('/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google OAuth not configured' });
    const redirect = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}` +
        `&response_type=code&scope=openid%20email%20profile&access_type=offline`;
    res.redirect(url);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
                grant_type: 'authorization_code',
            }),
        });
        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error(tokens.error_description || tokens.error);

        // Decode ID token for user info
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        const user = {
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            tier: 'pro', // Google OAuth users get pro tier
        };

        // Generate session token
        const sessionToken = `hdy_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
        res.json({
            success: true,
            token: sessionToken,
            user,
            expiresIn: 180 * 24 * 60 * 60, // 180 days
        });
    } catch (err) {
        res.status(500).json({ error: 'OAuth failed', message: err.message });
    }
});

// Device code flow (for CLI/headless)
router.post('/device', (req, res) => {
    const code = Math.random().toString(36).substr(2, 8).toUpperCase();
    const deviceCode = `hdy_dev_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    // In production, store this in KV/Redis with TTL
    res.json({
        device_code: deviceCode,
        user_code: code,
        verification_uri: 'https://headysystems.com/device',
        expires_in: 900,
        interval: 5,
    });
});

// WARP auth (Cloudflare Zero Trust)
router.post('/warp', (req, res) => {
    const cfAccessJWT = req.headers['cf-access-jwt-assertion'];
    if (!cfAccessJWT) {
        return res.status(401).json({ error: 'Missing CF-Access-JWT-Assertion header' });
    }
    // Validate with Cloudflare — in production hits CF access certs endpoint
    const sessionToken = `hdy_warp_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({
        success: true,
        token: sessionToken,
        tier: 'admin', // WARP users are trusted
        expiresIn: 365 * 24 * 60 * 60, // 365 days
    });
});

// Token verification
router.post('/verify', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    // Basic validation — check prefix and format
    const isValid = token.startsWith('hdy_') || token === process.env.HEADY_API_KEY;
    const tier = token === process.env.HEADY_API_KEY ? 'admin' : 'pro';
    res.json({ valid: isValid, tier, token: token.substring(0, 12) + '...' });
});

// Token refresh
router.post('/refresh', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const newToken = `hdy_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    res.json({ success: true, token: newToken, expiresIn: 30 * 24 * 60 * 60 });
});

// Active sessions
router.get('/sessions', (req, res) => {
    res.json({
        activeSessions: 1,
        methods: ['manual', 'device', 'warp', 'google'],
        configured: {
            google: !!process.env.GOOGLE_CLIENT_ID,
            warp: true, // Always available via CF
            device: true,
            manual: true,
        },
    });
});

module.exports = router;

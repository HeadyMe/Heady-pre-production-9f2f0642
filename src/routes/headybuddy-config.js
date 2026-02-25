/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyBuddy Config Routes
 * Serves runtime configuration to HeadyBuddy clients (web, mobile, widget)
 * Endpoint: /api/headybuddy-config
 */
const router = require('express').Router();

// Runtime config served to HeadyBuddy clients
router.get('/', (req, res) => {
    res.json({
        version: '2.0.0',
        brainEndpoint: process.env.BRAIN_ENDPOINT || 'https://manager.headysystems.com',
        streamEndpoint: '/api/brain/stream',
        chatEndpoint: '/api/brain/chat',
        features: {
            voice: true,
            streaming: true,
            vectorMemory: true,
            fileAccess: false,
            taskQueue: true,
            exportChat: true,
            keyboardShortcuts: true,
        },
        providers: {
            'heady-brain': { label: 'Heady Brain', icon: '🧠', color: '#34d399' },
            'headyjules-haiku': { label: 'HeadyJules Haiku', icon: '⚡', color: '#fbbf24' },
            'headyjules-sonnet': { label: 'HeadyJules Sonnet', icon: '⬡', color: '#fb923c' },
            'headyjules-opus': { label: 'HeadyJules Opus', icon: '🔮', color: '#f472b6' },
            'gpt-4o': { label: 'GPT-4o', icon: '◆', color: '#10b981' },
            'headypythia': { label: 'HeadyPythia', icon: '✦', color: '#60a5fa' },
        },
        auth: {
            firebaseEnabled: !!process.env.FIREBASE_API_KEY,
            googleSignIn: true,
            anonymousAllowed: true,
        },
        limits: {
            maxMessageLength: 10000,
            maxHistoryLength: 100,
            rateLimitPerMinute: 30,
        },
        ui: {
            theme: 'dark',
            accentColor: '#8b5cf6',
            brandName: 'HeadyBuddy',
            tagline: 'Your AI Companion',
        },
    });
});

// Connected services status
router.get('/services', async (req, res) => {
    const checks = {};
    try {
        const pulse = await fetch('http://127.0.0.1:3301/api/pulse', { signal: AbortSignal.timeout(2000) });
        checks.manager = pulse.ok ? 'connected' : 'degraded';
    } catch { checks.manager = 'disconnected'; }

    try {
        const headylocal = await fetch('http://127.0.0.1:11434/', { signal: AbortSignal.timeout(2000) });
        checks.headylocal = headylocal.ok ? 'connected' : 'disconnected';
    } catch { checks.headylocal = 'disconnected'; }

    checks.headyjules = !!process.env.HEADY_NEXUS_KEY ? 'configured' : 'not_configured';
    checks.headycompute = !!process.env.HEADY_COMPUTE_KEY ? 'configured' : 'not_configured';
    checks.headypythia = !!process.env.GOOGLE_API_KEY ? 'configured' : 'not_configured';

    res.json({ services: checks, timestamp: new Date().toISOString() });
});

module.exports = router;

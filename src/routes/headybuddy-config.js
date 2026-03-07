/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyBuddy Config Routes
 * Serves runtime configuration to HeadyBuddy clients (web, mobile, widget)
 * Endpoint: /api/headybuddy-config
 */
const router = require('../core/heady-server').Router();

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
            outputFormatSwitching: true,
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
            tagline: 'Type anything. Heady intelligently processes it and delivers in your chosen format — instantly.',
        },
        outputFormats: [
            { id: 'raw', label: 'Raw Data', icon: '📊' },
            { id: 'text', label: 'Plain Text', icon: '📝' },
            { id: 'markdown', label: 'Markdown', icon: '📋' },
            { id: 'pretty', label: 'Pretty Print', icon: '✨' },
            { id: 'branded', label: 'Heady Branded', icon: '🎨' },
            { id: 'infographic', label: 'Infographic', icon: '📈' },
            { id: 'animated', label: 'Animated Visual', icon: '🎬' },
            { id: 'dashboard', label: 'Dashboard View', icon: '📱' },
            { id: 'presentation', label: 'Slide Deck', icon: '🖥️' },
            { id: 'report', label: 'Formal Report', icon: '📑' },
            { id: 'conversational', label: 'Chat Style', icon: '💬' },
            { id: 'technical', label: 'Technical Spec', icon: '⚙️' },
            { id: 'audience', label: 'Audience-Adapted', icon: '👥' },
            { id: 'csv', label: 'CSV Export', icon: '📊' },
            { id: 'api', label: 'API Response', icon: '🔌' },
        ],
        capabilities: {
            description: 'HeadyBuddy intelligently processes ANY freeform input. Type anything — a question, a task, a creative brief, raw data — and Heady analyzes intent, routes to optimal AI nodes, and delivers results in your chosen format. Switch output formats on-the-fly at any time.',
            inputExamples: [
                'super random stuff for buddy',
                'analyze my nonprofit fundraising data and make it pretty',
                'build me a dashboard showing KPIs for Q1',
                'create a branded infographic for our annual report',
                'give me raw JSON of all active services',
            ],
        },
        suggestedCombos: [
            {
                id: 'live-service-monitor',
                label: '🌊 Live Service Monitor',
                desc: 'Super pretty non-technical display with real-time visual representations of all active services during operation',
                formats: ['pretty', 'animated', 'dashboard'],
                prompt: 'Show me all active Heady services with pretty visuals and real-time status — make it beautiful and non-technical'
            },
            {
                id: 'executive-brief',
                label: '📊 Executive Brief',
                desc: 'Branded summary with KPI cards, charts, and a one-page executive takeaway',
                formats: ['branded', 'report', 'infographic'],
                prompt: 'Give me a branded executive summary with charts and key metrics'
            },
            {
                id: 'developer-deep-dive',
                label: '⚙️ Developer Deep Dive',
                desc: 'Technical spec with code samples, architecture diagrams, and raw API data',
                formats: ['technical', 'raw', 'markdown'],
                prompt: 'Show me the technical details with code, diagrams, and raw data'
            },
            {
                id: 'stakeholder-showcase',
                label: '🎨 Stakeholder Showcase',
                desc: 'Presentation-ready branded slides with audience-adapted messaging and infographics',
                formats: ['presentation', 'branded', 'audience'],
                prompt: 'Create a branded presentation for stakeholders with adapted messaging'
            },
            {
                id: 'data-export-bundle',
                label: '📦 Data Export Bundle',
                desc: 'Full data export in CSV, raw JSON, and formatted tables — ready for any tool',
                formats: ['csv', 'raw', 'api'],
                prompt: 'Export all data in CSV, JSON, and formatted tables'
            },
            {
                id: 'quick-chat-helper',
                label: '💬 Quick Chat',
                desc: 'Fast conversational answer with plain text — no frills, just answers',
                formats: ['conversational', 'text'],
                prompt: 'Just give me a quick plain answer'
            },
        ],
    });
});

// Connected services status
router.get('/services', async (req, res) => {
    const checks = {};
    try {
        const pulse = await fetch('https://127.0.0.1:3301/api/pulse', { signal: AbortSignal.timeout(2000) });
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

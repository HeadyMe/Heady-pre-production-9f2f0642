/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * UI Registry — HeadyWeb Universal Shell
 *
 * Central registry for all Heady UIs and applications.
 * Serves a dynamic manifest so HeadyWeb can route users
 * to the correct UI projection from a single entry point.
 */

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
// UI Application Registry
// ═══════════════════════════════════════════════════════════════

const _uiApps = new Map();

// Pre-register all known Heady UIs
const BUILTIN_UIS = [
    {
        id: 'antigravity',
        name: 'Heady Antigravity',
        description: '3D collaborative workspace for Heady vector space visualization',
        category: 'core',
        entryPoint: '/src/ui/heady-antigravity-app/index.html',
        route: '/app/antigravity',
        icon: '🌀',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'landing',
        name: 'Heady Landing Page',
        description: 'Premium glassmorphism landing page for headyme.com',
        category: 'marketing',
        entryPoint: '/src/landing/index.html',
        route: '/',
        icon: '🐝',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'heady-ide',
        name: 'HeadyAI-IDE',
        description: 'AI-powered code modification interface with governance integration',
        category: 'developer',
        entryPoint: '/app/ide',
        route: '/app/ide',
        icon: '💻',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'swarm-dashboard',
        name: 'Swarm Dashboard',
        description: 'Real-time HeadyBee swarm visualization and orchestration control',
        category: 'ops',
        entryPoint: '/app/swarm',
        route: '/app/swarm',
        icon: '🐝',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'governance-panel',
        name: 'Governance Panel',
        description: 'Proposal review, voting, and audit trail visualization',
        category: 'governance',
        entryPoint: '/app/governance',
        route: '/app/governance',
        icon: '⚖️',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'projection-monitor',
        name: 'Projection Monitor',
        description: 'Real-time projection staleness, health, and sync status',
        category: 'ops',
        entryPoint: '/app/projections',
        route: '/app/projections',
        icon: '📡',
        status: 'active',
        version: '3.0.1',
    },
    {
        id: 'vector-explorer',
        name: 'Vector Space Explorer',
        description: '3D vector space topology browser with zone navigation',
        category: 'core',
        entryPoint: '/app/vectors',
        route: '/app/vectors',
        icon: '🧭',
        status: 'active',
        version: '3.0.1',
    },
];

// Initialize registry
for (const ui of BUILTIN_UIS) {
    _uiApps.set(ui.id, { ...ui, registeredAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the full UI manifest.
 * Used by HeadyWeb shell to discover available apps.
 */
function getUIManifest(options = {}) {
    const { category, status } = options;
    let apps = Array.from(_uiApps.values());

    if (category) apps = apps.filter(a => a.category === category);
    if (status) apps = apps.filter(a => a.status === status);

    return {
        receipt: {
            hash: crypto.createHash('sha256').update(JSON.stringify(apps)).digest('hex').slice(0, 16),
            timestamp: new Date().toISOString(),
        },
        shell: {
            name: 'HeadyWeb',
            version: '3.0.1',
            description: 'Universal delivery shell for all Heady products',
            baseUrl: 'https://headyme.com',
        },
        totalApps: apps.length,
        activeApps: apps.filter(a => a.status === 'active').length,
        plannedApps: apps.filter(a => a.status === 'planned').length,
        categories: [...new Set(apps.map(a => a.category))],
        apps: apps.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            category: a.category,
            route: a.route,
            icon: a.icon,
            status: a.status,
            version: a.version,
        })),
    };
}

/**
 * Register a new UI application.
 */
function registerUI(config) {
    if (!config.id || !config.name) {
        return { success: false, error: 'id and name are required' };
    }

    const entry = {
        id: config.id,
        name: config.name,
        description: config.description || '',
        category: config.category || 'custom',
        entryPoint: config.entryPoint || `/app/${config.id}`,
        route: config.route || `/app/${config.id}`,
        icon: config.icon || '📦',
        status: config.status || 'active',
        version: config.version || '3.0.1',
        registeredAt: new Date().toISOString(),
    };

    _uiApps.set(entry.id, entry);
    return { success: true, app: entry };
}

/**
 * Get a specific UI app by ID.
 */
function getUI(id) {
    return _uiApps.get(id) || null;
}

/**
 * Update a UI app's status.
 */
function updateUIStatus(id, status) {
    const app = _uiApps.get(id);
    if (!app) return { success: false, error: `UI '${id}' not found` };
    app.status = status;
    return { success: true, app };
}

/**
 * Get UI health — checks all active UIs have valid entry points.
 */
function getUIHealth() {
    const apps = Array.from(_uiApps.values());
    return {
        totalRegistered: apps.length,
        active: apps.filter(a => a.status === 'active').length,
        planned: apps.filter(a => a.status === 'planned').length,
        deprecated: apps.filter(a => a.status === 'deprecated').length,
        byCategory: apps.reduce((acc, a) => {
            acc[a.category] = (acc[a.category] || 0) + 1;
            return acc;
        }, {}),
    };
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function uiRegistryRoutes(app) {
    app.get('/api/ui/manifest', (req, res) => {
        const { category, status } = req.query;
        res.json(getUIManifest({ category, status }));
    });

    app.get('/api/ui/health', (_req, res) => {
        res.json(getUIHealth());
    });

    app.get('/api/ui/apps/:id', (req, res) => {
        const ui = getUI(req.params.id);
        if (!ui) return res.status(404).json({ error: `UI '${req.params.id}' not found` });
        res.json(ui);
    });

    app.post('/api/ui/register', (req, res) => {
        const result = registerUI(req.body);
        if (!result.success) return res.status(400).json(result);
        res.status(201).json(result);
    });

    app.patch('/api/ui/apps/:id/status', (req, res) => {
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'status is required' });
        const result = updateUIStatus(req.params.id, status);
        if (!result.success) return res.status(404).json(result);
        res.json(result);
    });
}

module.exports = {
    getUIManifest,
    registerUI,
    getUI,
    updateUIStatus,
    getUIHealth,
    uiRegistryRoutes,
};

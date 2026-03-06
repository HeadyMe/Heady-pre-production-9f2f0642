/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Projection Engine — Dynamic Projection Management
 *
 * Registry-driven build targeting, stale projection pruning,
 * and projection manifest generation. This is the single service
 * that knows which projections are active and how to sync them.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'heady-registry.json');
const FABRIC_PATH = path.resolve(__dirname, '..', '..', 'configs', 'resources', 'liquid-unified-fabric.yaml');

// ═══════════════════════════════════════════════════════════════
// Projection Target Registry
// ═══════════════════════════════════════════════════════════════

const PROJECTION_TARGETS = {
    'cloud-run': {
        type: 'container',
        endpoint: 'https://heady-manager-<hash>.run.app',
        healthPath: '/health',
        stalenessBudgetMs: 60000, // 1 minute
        status: 'active',
    },
    'cloudflare-edge': {
        type: 'worker',
        endpoint: 'https://heady.headyme.com',
        healthPath: '/health',
        stalenessBudgetMs: 30000, // 30 seconds (edge cache)
        status: 'active',
    },
    'huggingface-spaces': {
        type: 'container',
        endpoint: 'https://headyme-heady-demo.hf.space',
        healthPath: '/health',
        stalenessBudgetMs: 300000, // 5 minutes
        status: 'active',
    },
    'github-monorepo': {
        type: 'source-of-truth',
        endpoint: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
        healthPath: null,
        stalenessBudgetMs: 0, // Always fresh (it IS the source)
        status: 'active',
    },
};

// Track projection state
const _projectionState = new Map();
const _projectionHistory = [];

// ═══════════════════════════════════════════════════════════════
// Core Projection Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the current projection manifest.
 * Returns all active projections with health and staleness info.
 */
function getProjectionManifest() {
    const registry = _loadRegistry();
    const targets = Object.entries(PROJECTION_TARGETS).map(([name, config]) => {
        const state = _projectionState.get(name) || {};
        const age = state.lastProjectedAt
            ? Date.now() - new Date(state.lastProjectedAt).getTime()
            : Infinity;

        return {
            name,
            type: config.type,
            endpoint: config.endpoint,
            status: config.status,
            stalenessBudgetMs: config.stalenessBudgetMs,
            lastProjectedAt: state.lastProjectedAt || null,
            lastProjectionHash: state.hash || null,
            ageMs: age === Infinity ? null : age,
            isStale: age > config.stalenessBudgetMs,
            healthPath: config.healthPath,
        };
    });

    return {
        receipt: {
            hash: crypto.createHash('sha256').update(JSON.stringify(targets)).digest('hex').slice(0, 16),
            timestamp: new Date().toISOString(),
        },
        version: registry?.version || '3.0.1',
        sourceOfTruth: 'github-monorepo',
        totalTargets: targets.length,
        activeTargets: targets.filter(t => t.status === 'active').length,
        staleTargets: targets.filter(t => t.isStale).length,
        targets,
    };
}

/**
 * Project to a specific target.
 * Records the projection event and updates state.
 *
 * @param {string} target - Target name (cloud-run, cloudflare-edge, etc.)
 * @param {Object} options - Projection options
 * @returns {Object} Projection result
 */
function projectToTarget(target, options = {}) {
    const config = PROJECTION_TARGETS[target];
    if (!config) {
        return { success: false, error: `Unknown projection target: ${target}` };
    }

    if (config.status !== 'active') {
        return { success: false, error: `Target '${target}' is not active (status: ${config.status})` };
    }

    const projectionId = crypto.randomUUID();
    const hash = crypto.createHash('sha256')
        .update(`${target}:${Date.now()}:${JSON.stringify(options)}`)
        .digest('hex');

    const record = {
        projectionId,
        target,
        type: config.type,
        hash,
        timestamp: new Date().toISOString(),
        triggeredBy: options.triggeredBy || 'manual',
        registryVersion: _loadRegistry()?.version || '3.0.1',
    };

    // Update state
    _projectionState.set(target, {
        lastProjectedAt: record.timestamp,
        hash: record.hash,
        projectionId: record.projectionId,
    });

    // Append to history (bounded)
    _projectionHistory.push(record);
    if (_projectionHistory.length > 500) _projectionHistory.shift();

    return {
        success: true,
        projectionId: record.projectionId,
        target,
        hash: record.hash,
        timestamp: record.timestamp,
    };
}

/**
 * Detect and report stale projections.
 * Returns a cleanup plan without executing it.
 */
function pruneStaleProjections() {
    const manifest = getProjectionManifest();
    const stale = manifest.targets.filter(t => t.isStale && t.status === 'active');

    return {
        receipt: {
            hash: crypto.createHash('sha256').update(JSON.stringify(stale)).digest('hex').slice(0, 16),
            timestamp: new Date().toISOString(),
        },
        totalProjections: manifest.totalTargets,
        staleCount: stale.length,
        staleProjections: stale.map(t => ({
            name: t.name,
            type: t.type,
            ageMs: t.ageMs,
            stalenessBudgetMs: t.stalenessBudgetMs,
            overBudgetMs: (t.ageMs || 0) - t.stalenessBudgetMs,
            recommendation: t.type === 'source-of-truth' ? 'SKIP' : 'RE-PROJECT',
        })),
        actions: stale
            .filter(t => t.type !== 'source-of-truth')
            .map(t => ({
                action: 're-project',
                target: t.name,
                reason: `Stale by ${((t.ageMs || 0) - t.stalenessBudgetMs) / 1000}s`,
            })),
    };
}

/**
 * Execute a full projection sync across all active targets.
 */
function syncAllProjections(options = {}) {
    const results = [];
    for (const [name, config] of Object.entries(PROJECTION_TARGETS)) {
        if (config.status === 'active' && config.type !== 'source-of-truth') {
            results.push(projectToTarget(name, {
                ...options,
                triggeredBy: options.triggeredBy || 'sync-all',
            }));
        }
    }

    return {
        receipt: {
            hash: crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex').slice(0, 16),
            timestamp: new Date().toISOString(),
        },
        syncedTargets: results.length,
        results,
    };
}

/**
 * Add or update a projection target.
 */
function registerTarget(name, config) {
    PROJECTION_TARGETS[name] = {
        type: config.type || 'container',
        endpoint: config.endpoint,
        healthPath: config.healthPath || '/health',
        stalenessBudgetMs: config.stalenessBudgetMs || 60000,
        status: config.status || 'active',
    };
    return { success: true, target: name, config: PROJECTION_TARGETS[name] };
}

/**
 * Deprecate a projection target.
 */
function deprecateTarget(name) {
    if (!PROJECTION_TARGETS[name]) {
        return { success: false, error: `Target '${name}' not found` };
    }
    PROJECTION_TARGETS[name].status = 'deprecated';
    return { success: true, target: name, status: 'deprecated' };
}

/**
 * Get projection history.
 */
function getProjectionHistory(limit = 50) {
    return _projectionHistory.slice(-limit).reverse();
}

// ═══════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════

function _loadRegistry() {
    try {
        if (fs.existsSync(REGISTRY_PATH)) {
            return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        }
    } catch { /* ignore parse errors */ }
    return null;
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function projectionRoutes(app) {
    app.get('/api/projections/manifest', (_req, res) => {
        res.json(getProjectionManifest());
    });

    app.get('/api/projections/history', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        res.json(getProjectionHistory(limit));
    });

    app.post('/api/projections/sync', (req, res) => {
        const result = syncAllProjections({ triggeredBy: 'api' });
        res.json(result);
    });

    app.post('/api/projections/sync/:target', (req, res) => {
        const result = projectToTarget(req.params.target, { triggeredBy: 'api' });
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });

    app.get('/api/projections/prune', (_req, res) => {
        res.json(pruneStaleProjections());
    });

    app.post('/api/projections/targets', (req, res) => {
        const { name, ...config } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        res.json(registerTarget(name, config));
    });

    app.delete('/api/projections/targets/:name', (req, res) => {
        const result = deprecateTarget(req.params.name);
        if (!result.success) return res.status(404).json(result);
        res.json(result);
    });
}

module.exports = {
    getProjectionManifest,
    projectToTarget,
    pruneStaleProjections,
    syncAllProjections,
    registerTarget,
    deprecateTarget,
    getProjectionHistory,
    projectionRoutes,
    PROJECTION_TARGETS,
};

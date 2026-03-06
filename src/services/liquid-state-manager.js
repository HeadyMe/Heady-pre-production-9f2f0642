/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Liquid State Lifecycle Manager
 * ═══════════════════════════════════════════════════════════════
 *
 * Implements the 5-state projection lifecycle from the Gemini
 * Liquid Architecture Manifesto v3.0:
 *
 *   LATENT → MATERIALIZING → PROJECTED → STALE → PRUNED
 *
 * Every projection target (GitHub, Cloudflare Edge, HuggingFace,
 * Cloud Run, etc.) has a lifecycle state. Transitions are
 * deterministic and emit governance receipts for full auditability.
 *
 * Integration Points:
 *   - projection-engine.js    — target registry & health probes
 *   - projection-governance.js — receipt chain for audit trail
 *   - projection-sync.js      — actual sync execution
 */

const { getLogger } = require('./structured-logger');

const log = getLogger('liquid-state');

// ═══════════════════════════════════════════════════════════════
// Lifecycle States
// ═══════════════════════════════════════════════════════════════

const STATES = {
    LATENT: 'LATENT',        // Exists in vector space only, not projected
    MATERIALIZING: 'MATERIALIZING', // Projection in progress
    PROJECTED: 'PROJECTED',     // Successfully projected to target
    STALE: 'STALE',         // Projection outdated, needs refresh
    PRUNED: 'PRUNED',        // Removed from target, returned to latent
};

// Valid state transitions
const TRANSITIONS = {
    [STATES.LATENT]: [STATES.MATERIALIZING],
    [STATES.MATERIALIZING]: [STATES.PROJECTED, STATES.LATENT],  // Can fail back to LATENT
    [STATES.PROJECTED]: [STATES.STALE, STATES.PRUNED],
    [STATES.STALE]: [STATES.MATERIALIZING, STATES.PRUNED],
    [STATES.PRUNED]: [STATES.LATENT],                     // Can re-enter cycle
};

// Default staleness budgets per target type (ms)
const STALENESS_BUDGETS = {
    'cloud-run': 60_000,       // 1 minute
    'cloudflare-edge': 30_000,       // 30 seconds (edge should be fresh)
    'github-monorepo': 3_600_000,    // 1 hour
    'huggingface-spaces': 7_200_000,   // 2 hours
    'colab-notebooks': 86_400_000,   // 24 hours
    'local-dev': Infinity,     // Never stale
};

// ═══════════════════════════════════════════════════════════════
// Lifecycle Registry
// ═══════════════════════════════════════════════════════════════

const _lifecycles = new Map();
const _transitionLog = [];

/**
 * Initialize a target into the lifecycle as LATENT.
 *
 * @param {string} targetId - Unique target identifier
 * @param {Object} meta - Target metadata (type, url, tier, etc.)
 */
function registerTarget(targetId, meta = {}) {
    if (_lifecycles.has(targetId)) {
        log.warn(`Target ${targetId} already registered, skipping`);
        return _lifecycles.get(targetId);
    }

    const entry = {
        targetId,
        state: STATES.LATENT,
        type: meta.type || 'unknown',
        url: meta.url || null,
        tier: meta.tier || 99,
        stalenessBudgetMs: meta.stalenessBudgetMs || STALENESS_BUDGETS[targetId] || 3_600_000,
        lastProjectedAt: null,
        lastPrunedAt: null,
        stateChangedAt: new Date().toISOString(),
        projectionCount: 0,
        metadata: meta,
    };

    _lifecycles.set(targetId, entry);
    _logTransition(targetId, null, STATES.LATENT, 'registered');
    log.info(`Registered target ${targetId} as LATENT`, { type: entry.type, tier: entry.tier });
    return entry;
}

// ═══════════════════════════════════════════════════════════════
// State Transitions
// ═══════════════════════════════════════════════════════════════

/**
 * Transition a target to MATERIALIZING state (projection starting).
 *
 * @param {string} targetId
 * @returns {Object} Transition result
 */
function materialize(targetId) {
    return _transition(targetId, STATES.MATERIALIZING, 'materialize');
}

/**
 * Mark a target as PROJECTED (projection complete).
 *
 * @param {string} targetId
 * @param {Object} result - Sync result metadata
 * @returns {Object} Transition result
 */
function markProjected(targetId, result = {}) {
    const entry = _lifecycles.get(targetId);
    if (!entry) return { ok: false, error: `Unknown target: ${targetId}` };

    const transition = _transition(targetId, STATES.PROJECTED, 'projected');
    if (transition.ok) {
        entry.lastProjectedAt = new Date().toISOString();
        entry.projectionCount++;
        entry.lastResult = result;
    }
    return transition;
}

/**
 * Mark a target as STALE (needs refresh).
 *
 * @param {string} targetId
 * @param {string} reason
 * @returns {Object} Transition result
 */
function markStale(targetId, reason = 'staleness_budget_exceeded') {
    return _transition(targetId, STATES.STALE, reason);
}

/**
 * Prune a target (remove projection, return to latent pool).
 *
 * @param {string} targetId
 * @param {string} reason
 * @returns {Object} Transition result
 */
function prune(targetId, reason = 'manual_prune') {
    const entry = _lifecycles.get(targetId);
    if (!entry) return { ok: false, error: `Unknown target: ${targetId}` };

    const transition = _transition(targetId, STATES.PRUNED, reason);
    if (transition.ok) {
        entry.lastPrunedAt = new Date().toISOString();
    }
    return transition;
}

/**
 * Return a pruned target back to LATENT for re-projection.
 *
 * @param {string} targetId
 * @returns {Object} Transition result
 */
function reactivate(targetId) {
    return _transition(targetId, STATES.LATENT, 'reactivated');
}

/**
 * Full lifecycle: LATENT → MATERIALIZING → PROJECTED in one call.
 * Used when the projection sync is synchronous or already complete.
 *
 * @param {string} targetId
 * @param {Object} result - Sync result metadata
 * @returns {Object} Final transition result
 */
function projectFull(targetId, result = {}) {
    const mat = materialize(targetId);
    if (!mat.ok) return mat;
    return markProjected(targetId, result);
}

// ═══════════════════════════════════════════════════════════════
// Staleness Detection
// ═══════════════════════════════════════════════════════════════

/**
 * Check all PROJECTED targets and auto-transition to STALE if they
 * exceed their staleness budget.
 *
 * @returns {Array} List of targets that transitioned to STALE
 */
function detectStaleness() {
    const staleTransitions = [];
    const now = Date.now();

    for (const [targetId, entry] of _lifecycles) {
        if (entry.state !== STATES.PROJECTED) continue;
        if (!entry.lastProjectedAt) continue;

        const ageMs = now - new Date(entry.lastProjectedAt).getTime();
        if (ageMs > entry.stalenessBudgetMs) {
            const result = markStale(targetId, `age_${ageMs}ms_exceeds_budget_${entry.stalenessBudgetMs}ms`);
            if (result.ok) staleTransitions.push({ targetId, ageMs, budgetMs: entry.stalenessBudgetMs });
        }
    }

    if (staleTransitions.length > 0) {
        log.warn(`Staleness sweep: ${staleTransitions.length} targets transitioned to STALE`, {
            targets: staleTransitions.map(t => t.targetId),
        });
    }

    return staleTransitions;
}

// ═══════════════════════════════════════════════════════════════
// Query Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the full lifecycle map — all targets with their current states.
 */
function getLifecycleMap() {
    const map = {};
    for (const [targetId, entry] of _lifecycles) {
        map[targetId] = {
            state: entry.state,
            type: entry.type,
            tier: entry.tier,
            lastProjectedAt: entry.lastProjectedAt,
            stalenessBudgetMs: entry.stalenessBudgetMs,
            projectionCount: entry.projectionCount,
            stateChangedAt: entry.stateChangedAt,
        };
    }
    return map;
}

/**
 * Get targets in a specific state.
 */
function getByState(state) {
    const results = [];
    for (const [targetId, entry] of _lifecycles) {
        if (entry.state === state) results.push({ targetId, ...entry });
    }
    return results;
}

/**
 * Get the transition log (audit trail).
 */
function getTransitionLog(limit = 100) {
    return _transitionLog.slice(-limit);
}

/**
 * Get lifecycle dashboard summary.
 */
function getDashboard() {
    const counts = {};
    Object.values(STATES).forEach(s => { counts[s] = 0; });
    for (const [, entry] of _lifecycles) {
        counts[entry.state]++;
    }

    return {
        totalTargets: _lifecycles.size,
        stateCounts: counts,
        transitionLogSize: _transitionLog.length,
        lastTransition: _transitionLog[_transitionLog.length - 1] || null,
        states: STATES,
    };
}

// ═══════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════

function _transition(targetId, toState, reason) {
    const entry = _lifecycles.get(targetId);
    if (!entry) {
        return { ok: false, error: `Unknown target: ${targetId}` };
    }

    const fromState = entry.state;
    const allowed = TRANSITIONS[fromState];
    if (!allowed || !allowed.includes(toState)) {
        log.warn(`Invalid transition ${fromState} → ${toState} for ${targetId}`);
        return {
            ok: false,
            error: `Invalid transition: ${fromState} → ${toState}`,
            allowedTransitions: allowed || [],
        };
    }

    entry.state = toState;
    entry.stateChangedAt = new Date().toISOString();

    _logTransition(targetId, fromState, toState, reason);

    log.info(`${targetId}: ${fromState} → ${toState}`, { reason });
    return { ok: true, targetId, from: fromState, to: toState, reason, timestamp: entry.stateChangedAt };
}

function _logTransition(targetId, from, to, reason) {
    const entry = {
        targetId,
        from,
        to,
        reason,
        timestamp: new Date().toISOString(),
    };
    _transitionLog.push(entry);

    // Bound the log
    if (_transitionLog.length > 5000) {
        _transitionLog.splice(0, _transitionLog.length - 5000);
    }
}

// ═══════════════════════════════════════════════════════════════
// Boot — Auto-register default targets
// ═══════════════════════════════════════════════════════════════

function boot() {
    const defaultTargets = [
        { id: 'cloud-run', type: 'container', url: 'https://heady-manager-*.run.app', tier: 1 },
        { id: 'cloudflare-edge', type: 'network-projection', url: 'https://heady.headyme.com', tier: 1 },
        { id: 'github-monorepo', type: 'code-projection', url: 'https://github.com/HeadyMe/Heady-pre-production', tier: 1 },
        { id: 'huggingface-spaces', type: 'frontend-projection', url: 'https://huggingface.co/HeadyMe', tier: 2 },
        { id: 'colab-notebooks', type: 'compute-projection', url: 'https://colab.research.google.com', tier: 2 },
        { id: 'local-dev', type: 'dev-projection', url: 'http://localhost:3301', tier: 3 },
    ];

    for (const t of defaultTargets) {
        registerTarget(t.id, t);
    }

    log.info(`Liquid State Manager booted: ${_lifecycles.size} targets registered`);
    return getDashboard();
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function liquidStateRoutes(app) {
    app.get('/api/liquid-state/dashboard', (_req, res) => {
        res.json(getDashboard());
    });

    app.get('/api/liquid-state/map', (_req, res) => {
        res.json(getLifecycleMap());
    });

    app.get('/api/liquid-state/by-state/:state', (req, res) => {
        const state = req.params.state.toUpperCase();
        if (!STATES[state]) {
            return res.status(400).json({ error: `Invalid state: ${state}. Valid: ${Object.keys(STATES).join(', ')}` });
        }
        res.json(getByState(state));
    });

    app.post('/api/liquid-state/materialize', (req, res) => {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(materialize(targetId));
    });

    app.post('/api/liquid-state/mark-projected', (req, res) => {
        const { targetId, result } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(markProjected(targetId, result));
    });

    app.post('/api/liquid-state/mark-stale', (req, res) => {
        const { targetId, reason } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(markStale(targetId, reason));
    });

    app.post('/api/liquid-state/prune', (req, res) => {
        const { targetId, reason } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(prune(targetId, reason));
    });

    app.post('/api/liquid-state/reactivate', (req, res) => {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(reactivate(targetId));
    });

    app.post('/api/liquid-state/project-full', (req, res) => {
        const { targetId, result } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(projectFull(targetId, result));
    });

    app.post('/api/liquid-state/detect-staleness', (_req, res) => {
        res.json({ staleTransitions: detectStaleness() });
    });

    app.get('/api/liquid-state/transitions', (req, res) => {
        const limit = parseInt(req.query.limit || '100', 10);
        res.json(getTransitionLog(limit));
    });

    app.post('/api/liquid-state/register', (req, res) => {
        const { targetId, ...meta } = req.body;
        if (!targetId) return res.status(400).json({ error: 'targetId required' });
        res.json(registerTarget(targetId, meta));
    });

    log.info('LiquidState: routes registered at /api/liquid-state/*');
}

module.exports = {
    // States
    STATES,
    TRANSITIONS,
    STALENESS_BUDGETS,

    // Lifecycle management
    registerTarget,
    materialize,
    markProjected,
    markStale,
    prune,
    reactivate,
    projectFull,

    // Detection
    detectStaleness,

    // Query
    getLifecycleMap,
    getByState,
    getTransitionLog,
    getDashboard,

    // Boot & Routes
    boot,
    liquidStateRoutes,
};

/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Swarm Ignition — Boot Sequence for the Heady Bee Swarm
 *
 * Registers all template bees with the HeadyConductor,
 * starts scheduled maintenance cycles, and wires the
 * autonomous heartbeat into the conductor loop.
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 */

const { conductor } = require('./heady-conductor');
const {
    prunerBee,
    testerBee,
    embedderBee,
} = require('../bees/session-templates');
const { createSwarm } = require('../bees/bee-factory');
const logger = require('../utils/logger').child('swarm-ignition');

const PHI = (1 + Math.sqrt(5)) / 2;

// Cycle intervals derived from Sacred Geometry (φ-weighted)
const CYCLES = {
    PRUNER_INTERVAL_MS: Math.round(Math.pow(PHI, 12) * 1000),    // ~321s (~5.3 min, nightly in prod via scheduler)
    TESTER_INTERVAL_MS: Math.round(Math.pow(PHI, 10) * 1000),    // ~122s (~2 min, hourly in prod)
    EMBEDDER_INTERVAL_MS: Math.round(Math.pow(PHI, 8) * 1000),    // ~46.9s (continuous in prod)
};

// ═══════════════════════════════════════════════════════════════
// Swarm State
// ═══════════════════════════════════════════════════════════════

const _swarmState = {
    ignited: false,
    ignitedAt: null,
    registeredBees: [],
    activeCycles: {},
    cycleHistory: [],
    totalCyclesRun: 0,
};

// ═══════════════════════════════════════════════════════════════
// Ignition Sequence
// ═══════════════════════════════════════════════════════════════

/**
 * Ignite the swarm — register all template bees with the conductor
 * and start autonomous maintenance cycles.
 *
 * @param {Object} options - { enablePruner, enableTester, enableEmbedder }
 * @returns {Object} Ignition result
 */
function igniteSwarm(options = {}) {
    const {
        enablePruner = true,
        enableTester = true,
        enableEmbedder = true,
    } = options;

    if (_swarmState.ignited) {
        logger.warn('Swarm already ignited — skipping re-ignition');
        return { ok: false, reason: 'Already ignited', state: getSwarmStatus() };
    }

    logger.info('🔥 SWARM IGNITION — Starting bee registration...');

    // ── Register bees with conductor ──────────────────────────
    const bees = [];

    if (enablePruner && prunerBee) {
        conductor.registerBee('pruner-bee', prunerBee);
        bees.push('pruner-bee');
        logger.info('  ✅ pruner-bee registered');
    }

    if (enableTester && testerBee) {
        conductor.registerBee('tester-bee', testerBee);
        bees.push('tester-bee');
        logger.info('  ✅ tester-bee registered');
    }

    if (enableEmbedder && embedderBee) {
        conductor.registerBee('embedder-bee', embedderBee);
        bees.push('embedder-bee');
        logger.info('  ✅ embedder-bee registered');
    }

    _swarmState.registeredBees = bees;

    // ── Start autonomous cycles ────────────────────────────────
    if (enablePruner) {
        _swarmState.activeCycles.pruner = setInterval(() => {
            _runCycle('pruner-bee', 'maintenance');
        }, CYCLES.PRUNER_INTERVAL_MS);
        logger.info(`  🔄 Pruner cycle: every ${Math.round(CYCLES.PRUNER_INTERVAL_MS / 1000)}s`);
    }

    if (enableTester) {
        _swarmState.activeCycles.tester = setInterval(() => {
            _runCycle('tester-bee', 'health-check');
        }, CYCLES.TESTER_INTERVAL_MS);
        logger.info(`  🔄 Tester cycle: every ${Math.round(CYCLES.TESTER_INTERVAL_MS / 1000)}s`);
    }

    if (enableEmbedder) {
        _swarmState.activeCycles.embedder = setInterval(() => {
            _runCycle('embedder-bee', 'embedding');
        }, CYCLES.EMBEDDER_INTERVAL_MS);
        logger.info(`  🔄 Embedder cycle: every ${Math.round(CYCLES.EMBEDDER_INTERVAL_MS / 1000)}s`);
    }

    // Start the conductor heartbeat
    conductor.startHeartbeat();

    _swarmState.ignited = true;
    _swarmState.ignitedAt = new Date().toISOString();

    logger.info(`🐝 SWARM IGNITED — ${bees.length} bees, ${Object.keys(_swarmState.activeCycles).length} cycles`);

    return {
        ok: true,
        registeredBees: bees,
        cycles: Object.keys(_swarmState.activeCycles).map(name => ({
            name,
            intervalMs: CYCLES[`${name.toUpperCase()}_INTERVAL_MS`],
        })),
        ignitedAt: _swarmState.ignitedAt,
    };
}

/**
 * Shutdown the swarm — stop all cycles and unregister bees.
 */
function shutdownSwarm() {
    logger.info('⛔ SWARM SHUTDOWN initiated...');

    // Stop all cycles
    for (const [name, timer] of Object.entries(_swarmState.activeCycles)) {
        clearInterval(timer);
        logger.info(`  Stopped cycle: ${name}`);
    }
    _swarmState.activeCycles = {};

    // Stop conductor heartbeat
    conductor.stopHeartbeat();

    // Unregister bees
    for (const beeId of _swarmState.registeredBees) {
        conductor.unregisterBee(beeId);
    }
    _swarmState.registeredBees = [];
    _swarmState.ignited = false;

    logger.info('🛑 SWARM SHUTDOWN complete');
    return { ok: true, shutdownAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════
// Internal Cycle Runner
// ═══════════════════════════════════════════════════════════════

async function _runCycle(beeId, taskType) {
    const cycleId = `cycle_${Date.now()}_${beeId}`;
    _swarmState.totalCyclesRun++;

    try {
        const result = await conductor.dispatch(taskType, {
            cycleId,
            triggeredBy: 'swarm-ignition',
            timestamp: new Date().toISOString(),
        }, { beeId, timeout: 60000 });

        _swarmState.cycleHistory.push({
            cycleId,
            beeId,
            taskType,
            ok: result.ok,
            timestamp: new Date().toISOString(),
        });

        // Keep history bounded
        if (_swarmState.cycleHistory.length > 200) {
            _swarmState.cycleHistory = _swarmState.cycleHistory.slice(-100);
        }

    } catch (err) {
        logger.error(`Cycle ${cycleId} failed: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// Status & Swarm Launch
// ═══════════════════════════════════════════════════════════════

/**
 * Launch a one-shot swarm of all bees using createSwarm.
 * Useful for on-demand full-system health checks.
 */
function launchFullSwarm() {
    logger.info('🚀 Launching full swarm (one-shot)...');

    const beeConfigs = [];
    if (prunerBee) beeConfigs.push(prunerBee);
    if (testerBee) beeConfigs.push(testerBee);
    if (embedderBee) beeConfigs.push(embedderBee);

    return createSwarm('full-swarm-check', beeConfigs, {
        mode: 'parallel',
        timeout: 120000,
    });
}

/**
 * Get the current swarm status.
 */
function getSwarmStatus() {
    return {
        ignited: _swarmState.ignited,
        ignitedAt: _swarmState.ignitedAt,
        registeredBees: _swarmState.registeredBees,
        activeCycles: Object.keys(_swarmState.activeCycles),
        totalCyclesRun: _swarmState.totalCyclesRun,
        recentCycles: _swarmState.cycleHistory.slice(-10),
        conductorStatus: conductor.getStatus(),
    };
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function swarmIgnitionRoutes(app) {
    app.post('/api/swarm/ignite', (req, res) => {
        const result = igniteSwarm(req.body || {});
        res.json(result);
    });

    app.post('/api/swarm/shutdown', (_req, res) => {
        const result = shutdownSwarm();
        res.json(result);
    });

    app.get('/api/swarm/status', (_req, res) => {
        res.json({ ok: true, ...getSwarmStatus() });
    });

    app.post('/api/swarm/launch', async (_req, res) => {
        try {
            const result = await launchFullSwarm();
            res.json({ ok: true, result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });
}

module.exports = {
    igniteSwarm,
    shutdownSwarm,
    launchFullSwarm,
    getSwarmStatus,
    swarmIgnitionRoutes,
    CYCLES,
};

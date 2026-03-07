/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

'use strict';

/**
 * conductor-integration.js — HeadyConductor ↔ ProjectionSwarm Integration
 * ════════════════════════════════════════════════════════════════════════
 *
 * Registers the Autonomous Projection System as a first-class concern in
 * the HeadyConductor's routing table, lifecycle, and health subsystem.
 *
 * Integration points:
 *   1. Routing table — 'project', 'projection_status', 'projection_update'
 *      → 'projection' service group
 *   2. Lifecycle — conductor start/stop/pause delegates to ProjectionSwarm
 *   3. Health — projection health is surfaced in conductor's health endpoint
 *   4. Express routes:
 *        GET  /api/projections/status           — all projection statuses
 *        GET  /api/projections/:type            — specific projection data
 *        POST /api/projections/:type/trigger    — force-trigger an update
 *        GET  /api/projections/snapshot         — full system snapshot
 *        GET  /api/projections/diff             — diff between two snapshots
 *        GET  /api/projections/sse              — SSE stream (delegated to projection-sse)
 *   5. Shutdown hook — projection swarm registered with graceful-shutdown
 *
 * Usage:
 *   const { integrateConductor } = require('./conductor-integration');
 *   integrateConductor(conductor, projectionManager, projectionSwarm);
 */

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger').child('conductor-integration');
const { onShutdown } = require('../lifecycle/graceful-shutdown');
const { createSSERouter } = require('./projection-sse');

// ─── Golden Ratio ────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── Audit Trail ────────────────────────────────────────────────────────────
const AUDIT_PATH = path.join(__dirname, '..', '..', 'data', 'conductor-projection-audit.jsonl');

// ─── Projection Routing Table ────────────────────────────────────────────────
// These entries are injected into the conductor's routing table
const PROJECTION_ROUTES = {
    project:            'projection',
    projection_status:  'projection',
    projection_update:  'projection',
    project_health:     'projection',
    project_config:     'projection',
    project_telemetry:  'projection',
    project_vector:     'projection',
    project_topology:   'projection',
    project_task:       'projection',
    snapshot:           'projection',
    projection_diff:    'projection',
};

// ─── Service Group Weight ────────────────────────────────────────────────────
// Projection is a background concern — weight below interactive groups
const PROJECTION_GROUP_WEIGHT = 0.45;

// ─── Snapshot Store (in-memory ring buffer) ─────────────────────────────────
const MAX_SNAPSHOTS = Math.round(PHI * 10); // ~16 snapshots retained
const _snapshots = [];

function _storeSnapshot(snapshot) {
    _snapshots.push({
        ...snapshot,
        snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        capturedAt: new Date().toISOString(),
    });
    if (_snapshots.length > MAX_SNAPSHOTS) {
        _snapshots.shift();
    }
    return _snapshots[_snapshots.length - 1];
}

function _getSnapshot(id) {
    if (!id) return _snapshots[_snapshots.length - 1] || null;
    return _snapshots.find(s => s.snapshotId === id) || null;
}

// ─── Diff Utility ────────────────────────────────────────────────────────────
function _diffSnapshots(snapA, snapB) {
    if (!snapA || !snapB) return { error: 'One or both snapshots not found' };

    const diff = {
        snapshotA: snapA.snapshotId,
        snapshotB: snapB.snapshotId,
        capturedAtA: snapA.capturedAt,
        capturedAtB: snapB.capturedAt,
        deltaMs: new Date(snapB.capturedAt) - new Date(snapA.capturedAt),
        changes: {},
    };

    // Compare projection states across all domains
    const allDomains = new Set([
        ...Object.keys(snapA.projections || {}),
        ...Object.keys(snapB.projections || {}),
    ]);

    for (const domain of allDomains) {
        const a = snapA.projections?.[domain];
        const b = snapB.projections?.[domain];

        if (!a && b) {
            diff.changes[domain] = { type: 'added', value: b };
        } else if (a && !b) {
            diff.changes[domain] = { type: 'removed', was: a };
        } else if (JSON.stringify(a) !== JSON.stringify(b)) {
            diff.changes[domain] = {
                type: 'changed',
                was: a,
                now: b,
                runCountDelta: (b.runCount || 0) - (a.runCount || 0),
                errorCountDelta: (b.errorCount || 0) - (a.errorCount || 0),
            };
        }
    }

    diff.totalChanges = Object.keys(diff.changes).length;
    return diff;
}

// ─── Audit Helper ────────────────────────────────────────────────────────────
function _auditWrite(record) {
    try {
        const dir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const line = JSON.stringify({ ...record, _ts: new Date().toISOString() }) + '\n';
        fs.appendFileSync(AUDIT_PATH, line, 'utf8');
    } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
//  integrateConductor — Main Wiring Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wire the Projection System into the HeadyConductor.
 *
 * @param {object} conductor      - HeadyConductor instance
 * @param {object} projectionManager - ProjectionManager (projection data source)
 * @param {object} projectionSwarm   - ProjectionSwarm (coordinator)
 * @returns {{ router: Express.Router, cleanup: Function }}
 */
function integrateConductor(conductor, projectionManager, projectionSwarm) {
    if (!conductor) throw new Error('[ConductorIntegration] conductor is required');
    if (!projectionSwarm) throw new Error('[ConductorIntegration] projectionSwarm is required');

    logger.info('[ConductorIntegration] Wiring projection system into conductor');

    // ── 1. Extend Conductor Routing Table ─────────────────────────────────────
    _injectRoutes(conductor, PROJECTION_ROUTES);

    // ── 2. Extend Conductor Group Weights ─────────────────────────────────────
    if (conductor.GROUP_WEIGHTS || (conductor.layers && conductor.groupHits)) {
        // Inject weight into conductor's GROUP_WEIGHTS if accessible
        try {
            if (conductor.groupHits) {
                conductor.groupHits['projection'] = conductor.groupHits['projection'] || 0;
            }
        } catch (_) {}
    }

    // ── 3. Lifecycle: Conductor events → Swarm actions ────────────────────────
    _bindLifecycle(conductor, projectionSwarm);

    // ── 4. Health Integration ──────────────────────────────────────────────────
    _bindHealthIntegration(conductor, projectionManager, projectionSwarm);

    // ── 5. Projection → Conductor telemetry forwarding ────────────────────────
    _bindTelemetryForwarding(projectionSwarm, conductor);

    // ── 6. Graceful Shutdown ──────────────────────────────────────────────────
    onShutdown('conductor-projection-integration', async () => {
        logger.info('[ConductorIntegration] Shutdown: stopping projection swarm');
        await projectionSwarm.stop();
    });

    // ── 7. Build Express Router ───────────────────────────────────────────────
    const router = _buildRouter(projectionManager, projectionSwarm);

    logger.info({
        routes: Object.keys(PROJECTION_ROUTES).length,
        sseEnabled: true,
    }, '[ConductorIntegration] Projection system fully integrated into conductor');

    _auditWrite({ event: 'conductor:integrated', routes: Object.keys(PROJECTION_ROUTES).length });

    return {
        router,
        cleanup: () => projectionSwarm.stop(),
    };
}

// ─── Route Injection ──────────────────────────────────────────────────────────

function _injectRoutes(conductor, routes) {
    // HeadyConductor exposes its routing table — we inject projection routes
    // If conductor supports registerRoutes(), use it; otherwise mutate the table
    if (typeof conductor.registerProjectionRoutes === 'function') {
        conductor.registerProjectionRoutes(routes);
    } else {
        // Direct table mutation (safe — conductor reads table at route() call time)
        try {
            const ROUTING_TABLE = conductor._routingTable || conductor.routingTable;
            if (ROUTING_TABLE && typeof ROUTING_TABLE === 'object') {
                Object.assign(ROUTING_TABLE, routes);
                logger.debug({ count: Object.keys(routes).length }, '[ConductorIntegration] Routes injected into routing table');
            } else {
                // Fallback: patch the route() method to intercept projection actions
                _patchRouteMethod(conductor, routes);
            }
        } catch (_) {
            _patchRouteMethod(conductor, routes);
        }
    }
}

function _patchRouteMethod(conductor, routes) {
    const originalRoute = conductor.route.bind(conductor);
    conductor.route = async function(task, requestIp) {
        const action = task?.action || '';
        if (routes[action]) {
            const serviceGroup = routes[action];
            logger.debug({ action, serviceGroup }, '[ConductorIntegration] Projection route intercepted');
            return {
                serviceGroup,
                vectorZone: null,
                pattern: 'projection-direct',
                weight: PROJECTION_GROUP_WEIGHT,
                routeId: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            };
        }
        return originalRoute(task, requestIp);
    };
    logger.debug('[ConductorIntegration] Route method patched for projection routing');
}

// ─── Lifecycle Binding ────────────────────────────────────────────────────────

function _bindLifecycle(conductor, projectionSwarm) {
    // When conductor emits system-level events, relay to swarm
    conductor.on('conductor:started', () => {
        if (!projectionSwarm._running) {
            logger.info('[ConductorIntegration] Conductor started → starting projection swarm');
            projectionSwarm.start();
        }
    });

    conductor.on('conductor:paused', () => {
        logger.info('[ConductorIntegration] Conductor paused → pausing projection swarm');
        projectionSwarm.pause();
    });

    conductor.on('conductor:resumed', () => {
        logger.info('[ConductorIntegration] Conductor resumed → resuming projection swarm');
        projectionSwarm.resume();
    });

    conductor.on('conductor:stopping', async () => {
        logger.info('[ConductorIntegration] Conductor stopping → stopping projection swarm');
        await projectionSwarm.stop();
    });

    // Swarm events → conductor
    projectionSwarm.on('swarm:started', data => {
        conductor.emit('projection:swarm:started', data);
    });

    projectionSwarm.on('swarm:stopped', data => {
        conductor.emit('projection:swarm:stopped', data);
    });

    projectionSwarm.on('bee:error', data => {
        conductor.emit('projection:bee:error', data);
        logger.warn(data, '[ConductorIntegration] Projection bee error relayed to conductor');
    });
}

// ─── Health Integration ───────────────────────────────────────────────────────

function _bindHealthIntegration(conductor, projectionManager, projectionSwarm) {
    // Augment conductor's getStatus() to include projection health
    const originalGetStatus = conductor.getStatus
        ? conductor.getStatus.bind(conductor)
        : () => ({});

    conductor.getStatus = function() {
        const base = originalGetStatus();
        const swarmStatus = projectionSwarm.getStatus();

        const projectionHealth = _computeProjectionHealth(swarmStatus);

        return {
            ...base,
            projection: {
                health: projectionHealth,
                swarm: {
                    running: swarmStatus.running,
                    paused: swarmStatus.paused,
                    beeCount: swarmStatus.beeCount,
                    activeTasks: swarmStatus.telemetry?.activeTasks || 0,
                    totalErrors: swarmStatus.telemetry?.totalErrors || 0,
                    totalRuns: swarmStatus.telemetry?.totalRuns || 0,
                },
            },
        };
    };
}

function _computeProjectionHealth(swarmStatus) {
    if (!swarmStatus.running) return { status: 'STOPPED', score: 0 };
    if (swarmStatus.paused) return { status: 'PAUSED', score: 0.5 };

    const bees = Object.values(swarmStatus.bees || {});
    if (bees.length === 0) return { status: 'NO_BEES', score: 0 };

    const healthyBees = bees.filter(b =>
        b.circuitBreaker?.state === 'closed' &&
        b.errorCount < 5
    ).length;

    const score = healthyBees / bees.length;

    const status = score >= 0.8 ? 'HEALTHY'
        : score >= 0.5 ? 'DEGRADED'
        : 'CRITICAL';

    return { status, score: +score.toFixed(3), healthyBees, totalBees: bees.length };
}

// ─── Telemetry Forwarding ─────────────────────────────────────────────────────

function _bindTelemetryForwarding(projectionSwarm, conductor) {
    projectionSwarm.on('swarm:pulse', data => {
        conductor.emit('projection:telemetry', { type: 'swarm-pulse', ...data });
        if (global.eventBus) {
            global.eventBus.emit('projection:conductor:pulse', data);
        }
    });

    projectionSwarm.on('bee:complete', data => {
        conductor.emit('projection:telemetry', { type: 'bee-complete', ...data });
    });
}

// ─── Express Router ───────────────────────────────────────────────────────────

/**
 * Build the Express router for all projection HTTP endpoints.
 * Call router.registerRoutes(app) to mount at /api/projections.
 */
function _buildRouter(projectionManager, projectionSwarm) {
    // Lazy-require express to avoid hard dep at module load time
    let express;
    try { express = require('express'); } catch (_) {
        // Return a minimal shim if express isn't available yet
        return { registerRoutes: () => {} };
    }

    const router = express.Router();

    // ── GET /api/projections/status — all projection statuses ─────────────────
    router.get('/status', (req, res) => {
        try {
            const swarmStatus = projectionSwarm.getStatus();
            const managerStatus = projectionManager
                ? (typeof projectionManager.getStatus === 'function' ? projectionManager.getStatus() : {})
                : {};

            res.json({
                ok: true,
                swarm: swarmStatus,
                manager: managerStatus,
                health: _computeProjectionHealth(swarmStatus),
                ts: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err: err.message }, 'GET /status error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── GET /api/projections/snapshot — full system snapshot ─────────────────
    router.get('/snapshot', (req, res) => {
        try {
            const swarmStatus = projectionSwarm.getStatus();
            const managerProjections = projectionManager
                ? (typeof projectionManager.getAllProjections === 'function'
                    ? projectionManager.getAllProjections()
                    : {})
                : {};

            const snapshot = _storeSnapshot({
                projections: managerProjections,
                swarm: swarmStatus,
                health: _computeProjectionHealth(swarmStatus),
            });

            res.json({ ok: true, snapshot });
        } catch (err) {
            logger.error({ err: err.message }, 'GET /snapshot error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── GET /api/projections/diff — diff between two snapshots ────────────────
    router.get('/diff', (req, res) => {
        try {
            const { from: fromId, to: toId } = req.query;
            const snapA = fromId ? _getSnapshot(fromId) : _snapshots[_snapshots.length - 2] || null;
            const snapB = toId ? _getSnapshot(toId) : _snapshots[_snapshots.length - 1] || null;

            if (!snapA || !snapB) {
                return res.status(400).json({
                    ok: false,
                    error: 'Need at least 2 snapshots for a diff. Trigger /snapshot first.',
                    available: _snapshots.map(s => ({ id: s.snapshotId, capturedAt: s.capturedAt })),
                });
            }

            const diff = _diffSnapshots(snapA, snapB);
            res.json({ ok: true, diff });
        } catch (err) {
            logger.error({ err: err.message }, 'GET /diff error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── GET /api/projections/sse — SSE stream ─────────────────────────────────
    // Delegated to projection-sse module — creates its own sub-router
    try {
        const sseRouter = createSSERouter(projectionManager);
        router.use('/sse', sseRouter);
    } catch (err) {
        logger.warn({ err: err.message }, '[ConductorIntegration] SSE router not mounted');
        router.get('/sse', (req, res) => {
            res.status(503).json({ ok: false, error: 'SSE module not available' });
        });
    }

    // ── GET /api/projections/:type — specific projection data ─────────────────
    // NOTE: Must come AFTER named routes (/status, /snapshot, /diff, /sse)
    router.get('/:type', (req, res) => {
        try {
            const { type } = req.params;

            // Guard against catching named routes
            const RESERVED = ['status', 'snapshot', 'diff', 'sse'];
            if (RESERVED.includes(type)) {
                return res.status(404).json({ ok: false, error: `Use /${type} route` });
            }

            const swarmBee = projectionSwarm.bees.get(type)
                || projectionSwarm.bees.get(`${type}-projection`);

            if (!swarmBee) {
                const available = [...projectionSwarm.bees.keys()];
                return res.status(404).json({
                    ok: false,
                    error: `No projection bee for type: ${type}`,
                    available,
                });
            }

            const projectionData = projectionManager && typeof projectionManager.getProjection === 'function'
                ? projectionManager.getProjection(type)
                : null;

            res.json({
                ok: true,
                type,
                projection: projectionData,
                bee: swarmBee.getStatus(),
                ts: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err: err.message }, 'GET /:type error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── POST /api/projections/:type/trigger — force-trigger a projection ──────
    router.post('/:type/trigger', async (req, res) => {
        try {
            const { type } = req.params;
            const { reason } = req.body || {};

            logger.info({ type, reason }, '[ConductorIntegration] Manual projection trigger');
            _auditWrite({ event: 'projection:trigger', type, reason, ip: req.ip });

            const result = await projectionSwarm.blast(type).catch(async () => {
                // Try with -projection suffix
                return projectionSwarm.blast(`${type}-projection`);
            });

            res.json({
                ok: result.ok !== false,
                type,
                result,
                ts: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err: err.message }, 'POST /:type/trigger error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── registerRoutes helper ─────────────────────────────────────────────────
    router.registerRoutes = function(app) {
        app.use('/api/projections', router);
        logger.info('[ConductorIntegration] Routes mounted at /api/projections');
    };

    return router;
}

// ─── Module Exports ──────────────────────────────────────────────────────────
module.exports = {
    integrateConductor,
    PROJECTION_ROUTES,
    PROJECTION_GROUP_WEIGHT,
};

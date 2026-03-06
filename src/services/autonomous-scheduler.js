/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Autonomous Scheduler (The Heartbeat)
 * ═══════════════════════════════════════════════════════════════
 *
 * The system's autonomic nervous system. Fires scheduled tasks
 * to keep the liquid architecture self-maintaining:
 *
 *   - Nightly:  PrunerBee swarm (orphan cleanup)
 *   - Hourly:   TesterBee swarm (health sweeps)
 *   - Every 5m: EmbedderBee (projection staleness check)
 *   - Daily:    Self-healing cycle (projection noise scan + cleanup)
 */

const logger = require('./structured-logger');

// ── Schedule Registry ───────────────────────────────────────────
const _schedules = new Map();
const _timers = new Map();
const _executionLog = [];
let _running = false;

const BUILT_IN_SCHEDULES = [
    {
        id: 'pruner-nightly',
        description: 'PrunerBee: scan for orphaned projections and stale artifacts',
        cronExpression: '0 2 * * *',    // 2:00 AM daily
        intervalMs: 24 * 60 * 60 * 1000, // fallback: 24h
        handler: 'pruner-bee',
        priority: 'background',
        enabled: true,
    },
    {
        id: 'tester-hourly',
        description: 'TesterBee: health sweep against all projection endpoints',
        cronExpression: '0 * * * *',    // every hour
        intervalMs: 60 * 60 * 1000,     // fallback: 1h
        handler: 'tester-bee',
        priority: 'background',
        enabled: true,
    },
    {
        id: 'embedder-staleness',
        description: 'EmbedderBee: check embedding pipeline staleness',
        cronExpression: '*/5 * * * *',  // every 5 minutes
        intervalMs: 5 * 60 * 1000,      // fallback: 5m
        handler: 'embedder-health',
        priority: 'background',
        enabled: true,
    },
    {
        id: 'self-healing-daily',
        description: 'Autonomy: run self-healing cycle (projection noise scan + cleanup)',
        cronExpression: '30 3 * * *',   // 3:30 AM daily
        intervalMs: 24 * 60 * 60 * 1000,
        handler: 'self-healing',
        priority: 'maintenance',
        enabled: true,
    },
    {
        id: 'projection-sync',
        description: 'Projection Engine: sync all projection targets',
        cronExpression: '*/15 * * * *', // every 15 minutes
        intervalMs: 15 * 60 * 1000,
        handler: 'projection-sync',
        priority: 'background',
        enabled: true,
    },
];

// ── Handler Implementations ─────────────────────────────────────
const _handlers = {
    'pruner-bee': async () => {
        try {
            const templates = require('../bees/session-templates');
            if (templates.prunerBee) {
                const work = templates.prunerBee.getWork({});
                const results = [];
                for (const fn of work) {
                    results.push(await fn({}));
                }
                return { handler: 'pruner-bee', results };
            }
            return { handler: 'pruner-bee', skipped: true, reason: 'template not found' };
        } catch (err) {
            return { handler: 'pruner-bee', error: err.message };
        }
    },

    'tester-bee': async () => {
        try {
            const templates = require('../bees/session-templates');
            if (templates.testerBee) {
                const work = templates.testerBee.getWork({});
                const results = [];
                for (const fn of work) {
                    results.push(await fn({}));
                }
                return { handler: 'tester-bee', results };
            }
            return { handler: 'tester-bee', skipped: true, reason: 'template not found' };
        } catch (err) {
            return { handler: 'tester-bee', error: err.message };
        }
    },

    'embedder-health': async () => {
        try {
            const embedder = require('./continuous-embedder');
            const health = embedder.getEmbeddingHealth();
            if (health.isIngestStale) {
                logger.warn('Scheduler: embedding pipeline is stale, triggering re-embed');
            }
            return { handler: 'embedder-health', health };
        } catch (err) {
            return { handler: 'embedder-health', error: err.message };
        }
    },

    'self-healing': async () => {
        try {
            const { UnifiedEnterpriseAutonomyService } = require('./unified-enterprise-autonomy');
            const autonomy = new UnifiedEnterpriseAutonomyService();
            const result = await autonomy.runSelfHealingCycle();
            return { handler: 'self-healing', result };
        } catch (err) {
            return { handler: 'self-healing', error: err.message };
        }
    },

    'projection-sync': async () => {
        try {
            const projEngine = require('./projection-engine');
            const result = await projEngine.syncAllProjections();
            return { handler: 'projection-sync', result };
        } catch (err) {
            return { handler: 'projection-sync', error: err.message };
        }
    },
};

// ── Core Scheduler ──────────────────────────────────────────────

function start() {
    if (_running) {
        logger.warn('Scheduler: already running');
        return;
    }

    // Register built-in schedules
    for (const schedule of BUILT_IN_SCHEDULES) {
        _schedules.set(schedule.id, { ...schedule, lastRun: null, nextRun: null, runCount: 0 });
    }

    // Start interval timers for each enabled schedule
    for (const [id, schedule] of _schedules) {
        if (!schedule.enabled) continue;

        const timer = setInterval(async () => {
            await _executeSchedule(id);
        }, schedule.intervalMs);

        // Don't block the event loop
        if (timer.unref) timer.unref();

        _timers.set(id, timer);
        schedule.nextRun = new Date(Date.now() + schedule.intervalMs).toISOString();
    }

    _running = true;
    logger.info(`Scheduler: started ${_timers.size} scheduled tasks`);
}

function stop() {
    for (const [id, timer] of _timers) {
        clearInterval(timer);
    }
    _timers.clear();
    _running = false;
    logger.info('Scheduler: stopped');
}

async function _executeSchedule(scheduleId) {
    const schedule = _schedules.get(scheduleId);
    if (!schedule) return;

    const handler = _handlers[schedule.handler];
    if (!handler) {
        logger.warn(`Scheduler: no handler for "${schedule.handler}"`);
        return;
    }

    const startTime = Date.now();
    schedule.lastRun = new Date().toISOString();
    schedule.runCount++;

    try {
        logger.info(`Scheduler: executing "${scheduleId}"`);
        const result = await handler();
        const durationMs = Date.now() - startTime;

        _executionLog.push({
            scheduleId,
            handler: schedule.handler,
            status: 'success',
            durationMs,
            timestamp: schedule.lastRun,
            result: typeof result === 'object' ? { handler: result.handler } : result,
        });

        // Cap log size
        if (_executionLog.length > 200) _executionLog.splice(0, _executionLog.length - 200);

        schedule.nextRun = new Date(Date.now() + schedule.intervalMs).toISOString();
        return result;
    } catch (err) {
        const durationMs = Date.now() - startTime;
        logger.error(`Scheduler: "${scheduleId}" failed: ${err.message}`);

        _executionLog.push({
            scheduleId,
            handler: schedule.handler,
            status: 'error',
            error: err.message,
            durationMs,
            timestamp: schedule.lastRun,
        });
    }
}

/**
 * Trigger a schedule immediately (bypass interval timer).
 */
async function triggerNow(scheduleId) {
    return _executeSchedule(scheduleId);
}

/**
 * Register a custom schedule.
 */
function registerSchedule(config) {
    const { id, description, intervalMs, handler, priority = 'background', enabled = true } = config;
    if (!id || !intervalMs || !handler) {
        throw new Error('Schedule requires id, intervalMs, and handler');
    }

    _schedules.set(id, {
        id, description, intervalMs, handler, priority, enabled,
        lastRun: null, nextRun: null, runCount: 0,
    });

    if (enabled && _running) {
        const timer = setInterval(() => _executeSchedule(id), intervalMs);
        if (timer.unref) timer.unref();
        _timers.set(id, timer);
    }

    logger.info(`Scheduler: registered custom schedule "${id}"`);
}

/**
 * Register a custom handler function.
 */
function registerHandler(name, fn) {
    _handlers[name] = fn;
}

// ── Stats & Health ──────────────────────────────────────────────

function getSchedulerHealth() {
    const schedules = [..._schedules.values()].map(s => ({
        id: s.id,
        description: s.description,
        enabled: s.enabled,
        priority: s.priority,
        intervalMs: s.intervalMs,
        lastRun: s.lastRun,
        nextRun: s.nextRun,
        runCount: s.runCount,
    }));

    return {
        running: _running,
        totalSchedules: _schedules.size,
        activeTimers: _timers.size,
        totalExecutions: _executionLog.length,
        recentExecutions: _executionLog.slice(-10),
        schedules,
    };
}

// ── Express Routes ──────────────────────────────────────────────

function schedulerRoutes(app) {
    app.get('/api/scheduler/health', (_req, res) => {
        res.json(getSchedulerHealth());
    });

    app.post('/api/scheduler/start', (_req, res) => {
        start();
        res.json({ ok: true, status: 'started' });
    });

    app.post('/api/scheduler/stop', (_req, res) => {
        stop();
        res.json({ ok: true, status: 'stopped' });
    });

    app.post('/api/scheduler/trigger/:id', async (req, res) => {
        const { id } = req.params;
        if (!_schedules.has(id)) {
            return res.status(404).json({ error: `Schedule "${id}" not found` });
        }
        const result = await triggerNow(id);
        res.json({ ok: true, scheduleId: id, result });
    });

    app.get('/api/scheduler/log', (_req, res) => {
        res.json({ executions: _executionLog.slice(-50) });
    });

    logger.info('Scheduler: routes registered at /api/scheduler/*');
}

module.exports = {
    start,
    stop,
    triggerNow,
    registerSchedule,
    registerHandler,
    getSchedulerHealth,
    schedulerRoutes,
    BUILT_IN_SCHEDULES,
};

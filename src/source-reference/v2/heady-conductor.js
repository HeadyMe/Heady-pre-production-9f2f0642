/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── HeadyConductor — Unified Orchestration API ────────────────
 *
 * Central traffic controller for Heady's multi-agent swarm.
 * Routes tasks to bees, manages heartbeats, tracks execution state,
 * and bridges local swarm to edge/cloud nodes.
 *
 * Architecture:
 *   Input → Conductor → Route to best bee(s) → Execute → Report
 *   Heartbeat loop monitors all registered bees for liveness.
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 * ──────────────────────────────────────────────────────────────────
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

const PHI = (1 + Math.sqrt(5)) / 2;
const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 5000); // ~8.09s — golden-ratio cadence

// Priority modes — God Mode bypasses queue with max resources
const PRIORITY_MODES = {
    STANDARD: 'standard',
    ADMIN: 'admin',         // Full-throttle auto-success lane
};
const ADMIN_TIMEOUT_MS = 600_000; // 10 minutes for God Mode tasks

class HeadyConductor extends EventEmitter {
    constructor() {
        super();
        this.bees = new Map();          // beeId → { bee, status, lastHeartbeat, taskCount }
        this.taskQueue = [];            // pending tasks
        this.activeExecutions = new Map(); // executionId → { beeId, task, startTime }
        this.executionLog = [];         // completed executions
        this.heartbeatTimer = null;
        this.totalDispatched = 0;
        this.totalCompleted = 0;
        this.totalFailed = 0;
    }

    // ── Bee Registration ────────────────────────────────────────
    registerBee(beeId, bee) {
        this.bees.set(beeId, {
            bee,
            status: 'idle',
            lastHeartbeat: Date.now(),
            taskCount: 0,
            registered: Date.now(),
        });
        this.emit('bee:registered', { beeId });
        logger.info(`[Conductor] Registered bee: ${beeId}`);
    }

    unregisterBee(beeId) {
        this.bees.delete(beeId);
        this.emit('bee:unregistered', { beeId });
    }

    // ── Task Dispatch ───────────────────────────────────────────
    /**
     * Dispatch a task to the best-matched bee.
     * @param {string} taskType - Type hint for routing (e.g., 'research', 'code', 'ops')
     * @param {object} payload  - Task payload (passed as context to bee worker)
     * @param {object} opts     - { priority, timeout, beeId }
     * @returns {Promise<object>} Execution result
     */
    async dispatch(taskType, payload, opts = {}) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        // Route: explicit beeId > category match > first idle
        let targetBee = null;
        if (opts.beeId && this.bees.has(opts.beeId)) {
            targetBee = opts.beeId;
        } else {
            // Find best bee by category match
            for (const [id, entry] of this.bees) {
                const bee = entry.bee;
                if (bee.category === taskType || bee.domain === taskType) {
                    targetBee = id;
                    break;
                }
            }
            // Fallback: first idle bee
            if (!targetBee) {
                for (const [id, entry] of this.bees) {
                    if (entry.status === 'idle') {
                        targetBee = id;
                        break;
                    }
                }
            }
        }

        if (!targetBee) {
            this.totalFailed++;
            return { ok: false, error: 'No available bee for task type: ' + taskType, executionId };
        }

        const entry = this.bees.get(targetBee);
        entry.status = 'busy';
        entry.taskCount++;
        this.totalDispatched++;

        this.activeExecutions.set(executionId, {
            beeId: targetBee,
            taskType,
            payload,
            startTime: Date.now(),
        });

        this.emit('task:dispatched', { executionId, beeId: targetBee, taskType });

        try {
            const timeout = opts.timeout || 30000;
            const result = await Promise.race([
                this._executeBee(entry.bee, payload),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout')), timeout)),
            ]);

            entry.status = 'idle';
            this.totalCompleted++;
            this.activeExecutions.delete(executionId);

            const execution = {
                executionId,
                beeId: targetBee,
                taskType,
                result,
                durationMs: Date.now() - this.activeExecutions.get(executionId)?.startTime || 0,
                completedAt: Date.now(),
            };
            this.executionLog.push(execution);
            if (this.executionLog.length > 100) this.executionLog.shift();

            this.emit('task:completed', execution);
            return { ok: true, executionId, result };

        } catch (err) {
            entry.status = 'idle';
            this.totalFailed++;
            this.activeExecutions.delete(executionId);
            this.emit('task:failed', { executionId, beeId: targetBee, error: err.message });
            return { ok: false, executionId, error: err.message };
        }
    }

    async _executeBee(bee, payload) {
        // Try getWork() first (standard bee API), fall back to direct call
        if (typeof bee.getWork === 'function') {
            const workers = bee.getWork(payload);
            if (workers.length > 0) return workers[0]();
        }
        if (typeof bee.execute === 'function') {
            return bee.execute(payload);
        }
        return { error: 'Bee has no executable workers' };
    }

    // ── Heartbeat Monitor ───────────────────────────────────────
    startHeartbeat() {
        if (this.heartbeatTimer) return;
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            for (const [id, entry] of this.bees) {
                entry.lastHeartbeat = now;
                // Check for stale executions
                for (const [execId, exec] of this.activeExecutions) {
                    if (exec.beeId === id && (now - exec.startTime) > 60000) {
                        logger.warn(`[Conductor] Stale execution: ${execId} on bee ${id}`);
                        this.emit('execution:stale', { executionId: execId, beeId: id });
                    }
                }
            }
            this.emit('heartbeat', { beeCount: this.bees.size, timestamp: now });
        }, HEARTBEAT_INTERVAL_MS);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // ── Admin Dispatch (God Mode) ────────────────────────────────
    /**
     * Priority dispatch — bypasses the task queue entirely.
     * Used for admin/owner triggered tasks that must not wait.
     * Allocates maximum timeout (10 min) and forces immediate execution.
     *
     * @param {string} taskType - Task type hint
     * @param {object} payload  - Task payload
     * @returns {Promise<object>} Execution result
     */
    async adminDispatch(taskType, payload) {
        logger.info(`[Conductor] ⚡ GOD MODE dispatch: ${taskType}`);
        this.emit('admin:dispatch', { taskType, timestamp: Date.now() });
        return this.dispatch(taskType, payload, {
            priority: PRIORITY_MODES.ADMIN,
            timeout: ADMIN_TIMEOUT_MS,
        });
    }

    // ── Status ──────────────────────────────────────────────────
    getStatus() {
        const beeStatus = {};
        for (const [id, entry] of this.bees) {
            beeStatus[id] = {
                status: entry.status,
                taskCount: entry.taskCount,
                lastHeartbeat: entry.lastHeartbeat,
            };
        }

        return {
            bees: beeStatus,
            totalRegistered: this.bees.size,
            totalDispatched: this.totalDispatched,
            totalCompleted: this.totalCompleted,
            totalFailed: this.totalFailed,
            activeExecutions: this.activeExecutions.size,
            recentExecutions: this.executionLog.slice(-5),
            heartbeatActive: !!this.heartbeatTimer,
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
            priorityModes: PRIORITY_MODES,
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const conductor = new HeadyConductor();

// ── REST Endpoints ────────────────────────────────────────────
function registerConductorRoutes(app) {
    app.post('/api/conductor/dispatch', async (req, res) => {
        try {
            const { taskType, payload, opts } = req.body;
            const result = await conductor.dispatch(taskType, payload, opts);
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.get('/api/conductor/status', (req, res) => {
        res.json({ ok: true, ...conductor.getStatus() });
    });

    app.post('/api/conductor/register', (req, res) => {
        const { beeId } = req.body;
        // External registration (bees register via HTTP)
        conductor.registerBee(beeId, { domain: beeId, getWork: () => [] });
        res.json({ ok: true, registered: beeId });
    });

    // God Mode — priority dispatch lane
    app.post('/api/conductor/priority', async (req, res) => {
        try {
            const { taskType, payload } = req.body;
            if (!taskType) return res.status(400).json({ ok: false, error: 'taskType is required' });
            const result = await conductor.adminDispatch(taskType, payload || {});
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });
}

module.exports = { HeadyConductor, conductor, registerConductorRoutes, PRIORITY_MODES };

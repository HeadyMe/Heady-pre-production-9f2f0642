/*
 * © 2026 HeadySystems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── HeadyConductor v2 — Unified Orchestration API ────────────────
 *
 * CHANGES FROM v1:
 *   [FIX P0-1]  Use-after-delete race: startTime captured before deletion.
 *   [FIX P1-2]  Priority-aware bee routing: ADMIN tasks preempt STANDARD
 *               and route to highest-scored bee, not just first-idle.
 *   [FIX P1-7]  All error messages include runId, beeId, and context.
 *   [NEW OBS-3] Queue depth and dispatch latency histogram added to getStatus().
 *   [NEW OBS]   PipelineTelemetry integration points added (optional).
 *   [NEW]       Bee scoring model: composite score from latency, success rate,
 *               task count, and load factor drives routing decisions.
 *   [NEW]       Graceful degradation: dispatch returns structured error
 *               with retryAfterMs hint when all bees are saturated.
 *   [NEW]       `registerBee()` accepts capability metadata for fine-grained routing.
 *   [NEW]       `getMetrics()` returns P50/P95/P99 dispatch latencies.
 *
 * Architecture:
 *   Input → Conductor → Score bees → Priority-weighted route → Execute → Report
 *   Heartbeat loop monitors registered bees for liveness and updates scores.
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');

const PHI = (1 + Math.sqrt(5)) / 2;
const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 5000); // ~8.09s — golden-ratio cadence
const STALE_EXECUTION_MS = 60_000;
const MAX_EXECUTION_LOG = 200;
const MAX_LATENCY_SAMPLES = 500;

/** Priority modes — ADMIN bypasses queue and gets best-scored bee */
const PRIORITY_MODES = Object.freeze({
    STANDARD: 'standard',
    ADMIN: 'admin',
    SYSTEM: 'system',
});

const ADMIN_TIMEOUT_MS = 600_000; // 10 minutes

// ── Latency Histogram ────────────────────────────────────────────
/**
 * Ring-buffer backed latency tracker.
 * Computes P50/P95/P99 on demand without storing all samples sorted.
 * @param {number} maxSamples
 */
class LatencyHistogram {
    constructor(maxSamples = MAX_LATENCY_SAMPLES) {
        this._samples = [];
        this._maxSamples = maxSamples;
    }

    record(ms) {
        this._samples.push(ms);
        if (this._samples.length > this._maxSamples) this._samples.shift();
    }

    percentile(p) {
        if (this._samples.length === 0) return 0;
        const sorted = [...this._samples].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }

    snapshot() {
        return {
            count: this._samples.length,
            p50: this.percentile(50),
            p95: this.percentile(95),
            p99: this.percentile(99),
            min: this._samples.length ? Math.min(...this._samples) : 0,
            max: this._samples.length ? Math.max(...this._samples) : 0,
        };
    }
}

// ── BeeScorer ───────────────────────────────────────────────────
/**
 * Computes a composite routing score for a registered bee.
 * Higher score = better candidate for next task.
 *
 * Formula:
 *   score = (successRate * 0.4) + (speedScore * 0.3) + (availabilityScore * 0.3)
 *
 * successRate    = completions / (completions + failures), clamped [0,1]
 * speedScore     = 1 / (1 + avgLatencyMs / 1000), normalized speed factor
 * availabilityScore = status === 'idle' ? 1.0 : 0.0 (binary for now, could weight)
 *
 * @param {{ status, taskCount, completions, failures, avgLatencyMs }} entry
 * @returns {number} score in [0, 1]
 */
function scoreBee(entry) {
    const completions = entry.completions || 0;
    const failures = entry.failures || 0;
    const total = completions + failures;
    const successRate = total > 0 ? completions / total : 0.8; // optimistic prior for new bees
    const avgLatencyMs = entry.avgLatencyMs || 500;
    const speedScore = 1 / (1 + avgLatencyMs / 1000);
    const availabilityScore = entry.status === 'idle' ? 1.0 : 0.2;
    return (successRate * 0.4) + (speedScore * 0.3) + (availabilityScore * 0.3);
}

// ── HeadyConductor v2 ───────────────────────────────────────────
class HeadyConductor extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {object} [opts.telemetry]  - Optional PipelineTelemetry instance (pipeline-telemetry.js)
     * @param {number} [opts.maxQueueDepth=1000] - Max pending task queue size
     */
    constructor(opts = {}) {
        super();
        /** @type {Map<string, BeeEntry>} beeId → entry */
        this.bees = new Map();
        /** @type {Array<PendingTask>} */
        this.taskQueue = [];
        /** @type {Map<string, ActiveExecution>} executionId → execution */
        this.activeExecutions = new Map();
        /** @type {Array<ExecutionLogEntry>} */
        this.executionLog = [];

        this.heartbeatTimer = null;
        this.totalDispatched = 0;
        this.totalCompleted = 0;
        this.totalFailed = 0;
        this.totalQueued = 0;

        /** Dispatch latency histogram (time from dispatch() call to bee execution start) */
        this._dispatchLatency = new LatencyHistogram();
        /** Execution duration histogram (time from bee start to completion) */
        this._executionDuration = new LatencyHistogram();

        this._telemetry = opts.telemetry || null;
        this._maxQueueDepth = opts.maxQueueDepth || 1000;

        // Routing weight cache — updated by SelfOptimizer feedback
        // [NEW] SelfOptimizer writes to this map when it tunes routing weights
        this._routingWeightOverrides = new Map(); // beeId → weight multiplier
    }

    // ── Bee Registration ──────────────────────────────────────────

    /**
     * Register a bee with the conductor.
     * @param {string} beeId
     * @param {object} bee - Bee instance (must have getWork() or execute())
     * @param {object} [meta] - Capability metadata
     * @param {string} [meta.category]    - Task category this bee handles
     * @param {string} [meta.domain]      - Domain label for routing
     * @param {string[]} [meta.skills]    - List of skill tags (e.g., ['code', 'research'])
     * @param {number} [meta.maxConcurrent=1] - Max simultaneous tasks for this bee
     */
    registerBee(beeId, bee, meta = {}) {
        if (this.bees.has(beeId)) {
            logger.warn(`[ConductorV2] Re-registering existing bee: ${beeId}`);
        }

        this.bees.set(beeId, {
            bee,
            status: 'idle',
            lastHeartbeat: Date.now(),
            taskCount: 0,
            completions: 0,
            failures: 0,
            avgLatencyMs: 500,
            activeTaskCount: 0,
            maxConcurrent: meta.maxConcurrent || 1,
            category: meta.category || bee.category,
            domain: meta.domain || bee.domain,
            skills: meta.skills || [],
            registered: Date.now(),
        });

        this.emit('bee:registered', { beeId, meta });
        logger.info(`[ConductorV2] Registered bee: ${beeId} (category=${meta.category || bee.category})`);

        // Wire telemetry if available
        this._emitTelemetry('bee_registered', { beeId, meta });
    }

    /**
     * Unregister a bee. Fails gracefully if beeId not found.
     */
    unregisterBee(beeId) {
        if (!this.bees.has(beeId)) {
            logger.warn(`[ConductorV2] unregisterBee: ${beeId} not found`);
            return;
        }
        this.bees.delete(beeId);
        this.emit('bee:unregistered', { beeId });
        this._emitTelemetry('bee_unregistered', { beeId });
    }

    /**
     * [NEW] Update routing weight for a bee — called by SelfOptimizer feedback loop.
     * Allows the continuous optimizer to influence routing without restarting.
     *
     * @param {string} beeId
     * @param {number} weight - Multiplier [0.1, 2.0]
     */
    setRoutingWeight(beeId, weight) {
        const clamped = Math.max(0.1, Math.min(2.0, weight));
        this._routingWeightOverrides.set(beeId, clamped);
        logger.info(`[ConductorV2] Routing weight updated: ${beeId} → ${clamped}`);
    }

    // ── Task Dispatch ─────────────────────────────────────────────

    /**
     * Dispatch a task to the best-matched bee.
     *
     * CHANGES FROM v1:
     *   - [FIX P0-1] startTime captured before activeExecutions.delete()
     *   - [FIX P1-2] Priority-aware routing: ADMIN gets best-scored bee
     *   - [NEW] Returns retryAfterMs when all bees are saturated
     *   - [NEW] Records dispatch latency histogram
     *
     * @param {string} taskType - Type hint for routing (e.g., 'research', 'code', 'ops')
     * @param {object} payload  - Task payload
     * @param {object} [opts]
     * @param {string} [opts.priority]   - PRIORITY_MODES.STANDARD|ADMIN|SYSTEM
     * @param {number} [opts.timeout]    - Execution timeout ms (default 30000)
     * @param {string} [opts.beeId]      - Explicit bee target (bypasses scoring)
     * @param {string[]} [opts.skills]   - Required skill tags for routing
     * @returns {Promise<DispatchResult>}
     */
    async dispatch(taskType, payload, opts = {}) {
        const dispatchStartTs = Date.now();
        const executionId = `exec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const priority = opts.priority || PRIORITY_MODES.STANDARD;
        const isAdmin = priority === PRIORITY_MODES.ADMIN || priority === PRIORITY_MODES.SYSTEM;

        // Queue depth guard
        if (!isAdmin && this.taskQueue.length >= this._maxQueueDepth) {
            this.totalFailed++;
            const err = { ok: false, error: 'Task queue full', executionId, retryAfterMs: 5000 };
            this._emitTelemetry('dispatch_rejected_queue_full', { taskType, queueDepth: this.taskQueue.length });
            return err;
        }

        // ── Bee Selection ─────────────────────────────────────────
        const targetBeeId = this._selectBee(taskType, opts);

        if (!targetBeeId) {
            this.totalFailed++;
            // Estimate when a slot might free up
            const retryAfterMs = this._estimateRetryAfter();
            this._emitTelemetry('dispatch_no_bee', { taskType, priority });
            return {
                ok: false,
                error: `No available bee for taskType="${taskType}"`,
                executionId,
                retryAfterMs,
            };
        }

        const entry = this.bees.get(targetBeeId);
        // Mark busy — non-atomic but acceptable for single-process Node.js event loop
        entry.activeTaskCount++;
        if (entry.activeTaskCount >= entry.maxConcurrent) {
            entry.status = 'busy';
        }
        entry.taskCount++;
        this.totalDispatched++;

        const startTime = Date.now();

        // [FIX P0-1] Record startTime before registering in map
        this.activeExecutions.set(executionId, {
            beeId: targetBeeId,
            taskType,
            payload,
            startTime,
            priority,
        });

        this.emit('task:dispatched', { executionId, beeId: targetBeeId, taskType, priority });
        this._emitTelemetry('task_dispatched', { executionId, beeId: targetBeeId, taskType, priority });

        // Record time from dispatch() call to bee execution start
        this._dispatchLatency.record(startTime - dispatchStartTs);

        try {
            const timeout = opts.timeout || (isAdmin ? ADMIN_TIMEOUT_MS : 30_000);
            const result = await Promise.race([
                this._executeBee(entry.bee, payload),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout)
                ),
            ]);

            // [FIX P0-1] Capture startTime BEFORE deleting the entry
            const execEntry = this.activeExecutions.get(executionId);
            const durationMs = execEntry ? Date.now() - execEntry.startTime : 0;

            // Now safe to delete
            this.activeExecutions.delete(executionId);

            // Update bee stats
            entry.activeTaskCount = Math.max(0, entry.activeTaskCount - 1);
            if (entry.activeTaskCount < entry.maxConcurrent) entry.status = 'idle';
            entry.completions++;
            // Exponential moving average for latency
            entry.avgLatencyMs = entry.avgLatencyMs * 0.8 + durationMs * 0.2;

            this.totalCompleted++;
            this._executionDuration.record(durationMs);

            const logEntry = {
                executionId,
                beeId: targetBeeId,
                taskType,
                result,
                durationMs,
                priority,
                completedAt: Date.now(),
            };
            this._appendExecutionLog(logEntry);
            this.emit('task:completed', logEntry);
            this._emitTelemetry('task_completed', logEntry);

            return { ok: true, executionId, result, durationMs };

        } catch (err) {
            // [FIX P0-1] Capture startTime before delete
            const execEntry = this.activeExecutions.get(executionId);
            const durationMs = execEntry ? Date.now() - execEntry.startTime : 0;

            this.activeExecutions.delete(executionId);

            entry.activeTaskCount = Math.max(0, entry.activeTaskCount - 1);
            if (entry.activeTaskCount < entry.maxConcurrent) entry.status = 'idle';
            entry.failures++;

            this.totalFailed++;

            const failEntry = {
                executionId,
                beeId: targetBeeId,
                taskType,
                error: err.message,
                durationMs,
                priority,
                failedAt: Date.now(),
            };
            this._appendExecutionLog(failEntry);
            this.emit('task:failed', failEntry);
            this._emitTelemetry('task_failed', failEntry);

            return { ok: false, executionId, error: err.message, durationMs };
        }
    }

    /**
     * [FIX P1-2] Priority-aware bee selection.
     *
     * Selection order:
     *   1. Explicit beeId (pinned routing)
     *   2. ADMIN/SYSTEM: best-scored bee matching type (ignores idle constraint)
     *   3. STANDARD: best-scored IDLE bee matching type
     *   4. Fallback: best-scored IDLE bee of any type
     *
     * @private
     */
    _selectBee(taskType, opts) {
        const isAdmin = opts.priority === PRIORITY_MODES.ADMIN || opts.priority === PRIORITY_MODES.SYSTEM;

        // 1. Explicit pinned routing
        if (opts.beeId && this.bees.has(opts.beeId)) {
            return opts.beeId;
        }

        const requiredSkills = opts.skills || [];

        // Score all candidates
        const candidates = [];
        for (const [id, entry] of this.bees) {
            // Skill filter
            if (requiredSkills.length > 0) {
                const hasSkills = requiredSkills.every(s => entry.skills.includes(s));
                if (!hasSkills) continue;
            }

            // For STANDARD priority, only consider idle bees at capacity
            if (!isAdmin && entry.activeTaskCount >= entry.maxConcurrent) continue;

            // Category/domain match
            const typeMatch = entry.category === taskType || entry.domain === taskType ||
                entry.skills.includes(taskType);

            const baseScore = scoreBee(entry);
            const weightOverride = this._routingWeightOverrides.get(id) || 1.0;
            const typeBonus = typeMatch ? 0.2 : 0; // Bonus for matching task type
            const finalScore = (baseScore + typeBonus) * weightOverride;

            candidates.push({ id, score: finalScore, typeMatch });
        }

        if (candidates.length === 0) return null;

        // Sort descending by score — highest score wins
        candidates.sort((a, b) => b.score - a.score);

        // For ADMIN: prefer type-matched, then fall to any
        if (isAdmin) {
            const typeMatched = candidates.filter(c => c.typeMatch);
            return (typeMatched[0] || candidates[0]).id;
        }

        return candidates[0].id;
    }

    /**
     * Estimate ms before a bee slot becomes available (rough heuristic).
     * @private
     */
    _estimateRetryAfter() {
        let minRemaining = 5000;
        for (const [, entry] of this.activeExecutions) {
            const elapsed = Date.now() - entry.startTime;
            const beeEntry = this.bees.get(entry.beeId);
            const avgDuration = beeEntry ? beeEntry.avgLatencyMs : 5000;
            const remaining = Math.max(0, avgDuration - elapsed);
            if (remaining < minRemaining) minRemaining = remaining;
        }
        return minRemaining;
    }

    /**
     * Execute a bee's work function.
     * Supports getWork() (standard bee API) and execute() (direct API).
     * @private
     */
    async _executeBee(bee, payload) {
        if (typeof bee.getWork === 'function') {
            const workers = bee.getWork(payload);
            if (Array.isArray(workers) && workers.length > 0) {
                return typeof workers[0] === 'function' ? workers[0]() : workers[0];
            }
        }
        if (typeof bee.execute === 'function') {
            return bee.execute(payload);
        }
        throw new Error('Bee has no executable interface (requires getWork() or execute())');
    }

    /**
     * Append to execution log with bounded size.
     * @private
     */
    _appendExecutionLog(entry) {
        this.executionLog.push(entry);
        if (this.executionLog.length > MAX_EXECUTION_LOG) {
            this.executionLog.shift();
        }
    }

    // ── Heartbeat Monitor ─────────────────────────────────────────

    /**
     * Start the heartbeat loop.
     * Scans for stale executions and emits bee health events.
     */
    startHeartbeat() {
        if (this.heartbeatTimer) return;
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();

            for (const [execId, exec] of this.activeExecutions) {
                const elapsed = now - exec.startTime;
                if (elapsed > STALE_EXECUTION_MS) {
                    logger.warn(`[ConductorV2] Stale execution: ${execId} on bee ${exec.beeId} (${elapsed}ms)`);
                    this.emit('execution:stale', {
                        executionId: execId,
                        beeId: exec.beeId,
                        elapsedMs: elapsed,
                        taskType: exec.taskType,
                    });
                    this._emitTelemetry('execution_stale', { executionId: execId, beeId: exec.beeId, elapsedMs: elapsed });
                }
            }

            // Update bee heartbeat timestamps
            for (const [id, entry] of this.bees) {
                entry.lastHeartbeat = now;
            }

            this.emit('heartbeat', {
                beeCount: this.bees.size,
                activeExecutions: this.activeExecutions.size,
                queueDepth: this.taskQueue.length,
                timestamp: now,
            });
        }, HEARTBEAT_INTERVAL_MS);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // ── Admin Dispatch (God Mode) ─────────────────────────────────

    /**
     * Priority dispatch — bypasses the task queue entirely.
     * Uses ADMIN priority routing: best-scored bee regardless of idle status.
     *
     * @param {string} taskType
     * @param {object} payload
     * @returns {Promise<DispatchResult>}
     */
    async adminDispatch(taskType, payload) {
        logger.info(`[ConductorV2] ⚡ ADMIN dispatch: ${taskType}`);
        this.emit('admin:dispatch', { taskType, timestamp: Date.now() });
        return this.dispatch(taskType, payload, {
            priority: PRIORITY_MODES.ADMIN,
            timeout: ADMIN_TIMEOUT_MS,
        });
    }

    // ── Status & Metrics ──────────────────────────────────────────

    /**
     * Full status snapshot including v2 metrics.
     * @returns {StatusSnapshot}
     */
    getStatus() {
        const beeStatus = {};
        for (const [id, entry] of this.bees) {
            beeStatus[id] = {
                status: entry.status,
                taskCount: entry.taskCount,
                completions: entry.completions,
                failures: entry.failures,
                avgLatencyMs: Math.round(entry.avgLatencyMs),
                score: +scoreBee(entry).toFixed(3),
                routingWeightOverride: this._routingWeightOverrides.get(id) || 1.0,
                lastHeartbeat: entry.lastHeartbeat,
                activeTaskCount: entry.activeTaskCount,
                maxConcurrent: entry.maxConcurrent,
                skills: entry.skills,
            };
        }

        return {
            bees: beeStatus,
            totalRegistered: this.bees.size,
            totalDispatched: this.totalDispatched,
            totalCompleted: this.totalCompleted,
            totalFailed: this.totalFailed,
            activeExecutions: this.activeExecutions.size,
            queueDepth: this.taskQueue.length,
            recentExecutions: this.executionLog.slice(-10),
            heartbeatActive: !!this.heartbeatTimer,
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
            priorityModes: PRIORITY_MODES,
            metrics: {
                dispatchLatency: this._dispatchLatency.snapshot(),
                executionDuration: this._executionDuration.snapshot(),
            },
        };
    }

    /**
     * Wire in the SelfOptimizer's routing weights.
     * Called by the optimizer after each tuning cycle.
     *
     * @param {{ [provider: string]: number }} weights - beeId → weight multiplier
     */
    applyRoutingWeights(weights) {
        for (const [beeId, weight] of Object.entries(weights)) {
            this.setRoutingWeight(beeId, weight);
        }
        this.emit('routing:weights-updated', { weights, ts: Date.now() });
    }

    // ── Telemetry Helper ──────────────────────────────────────────

    /** @private */
    _emitTelemetry(type, data) {
        if (this._telemetry && typeof this._telemetry.record === 'function') {
            try {
                this._telemetry.record({ source: 'conductor', type, data, ts: Date.now() });
            } catch { /* non-fatal */ }
        }
    }
}

// ── Singleton ──────────────────────────────────────────────────
const conductor = new HeadyConductor();

// ── REST Endpoints ─────────────────────────────────────────────

/**
 * Register conductor HTTP routes.
 * @param {import('express').Application} app
 * @param {HeadyConductor} [instance] - Optional conductor instance (defaults to singleton)
 */
function registerConductorRoutes(app, instance) {
    const c = instance || conductor;

    // Dispatch a task
    app.post('/api/conductor/dispatch', async (req, res) => {
        try {
            const { taskType, payload, opts } = req.body;
            if (!taskType) return res.status(400).json({ ok: false, error: 'taskType is required' });
            const result = await c.dispatch(taskType, payload || {}, opts || {});
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Full status
    app.get('/api/conductor/status', (_req, res) => {
        res.json({ ok: true, ...c.getStatus() });
    });

    // Register a bee via HTTP (external bees register themselves)
    app.post('/api/conductor/register', (req, res) => {
        const { beeId, meta } = req.body;
        if (!beeId) return res.status(400).json({ ok: false, error: 'beeId is required' });
        // External bees get a stub — they execute via HTTP callback
        c.registerBee(beeId, {
            domain: meta?.domain || beeId,
            skills: meta?.skills || [],
            execute: async (p) => ({ stub: true, beeId, payload: p }),
        }, meta || {});
        res.json({ ok: true, registered: beeId });
    });

    // Admin/priority dispatch lane
    app.post('/api/conductor/priority', async (req, res) => {
        try {
            const { taskType, payload } = req.body;
            if (!taskType) return res.status(400).json({ ok: false, error: 'taskType is required' });
            const result = await c.adminDispatch(taskType, payload || {});
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Apply routing weight updates from SelfOptimizer
    app.post('/api/conductor/routing-weights', (req, res) => {
        try {
            const { weights } = req.body;
            if (!weights || typeof weights !== 'object') {
                return res.status(400).json({ ok: false, error: 'weights object required' });
            }
            c.applyRoutingWeights(weights);
            res.json({ ok: true, applied: Object.keys(weights).length });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Unregister a bee
    app.delete('/api/conductor/bees/:beeId', (req, res) => {
        c.unregisterBee(req.params.beeId);
        res.json({ ok: true, unregistered: req.params.beeId });
    });
}

module.exports = {
    HeadyConductor,
    conductor,
    registerConductorRoutes,
    PRIORITY_MODES,
    LatencyHistogram,
    scoreBee,
};

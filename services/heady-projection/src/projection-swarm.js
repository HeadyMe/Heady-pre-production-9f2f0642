/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

'use strict';

/**
 * ProjectionSwarm — Coordinator Swarm for the Autonomous Projection System
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Orchestrates all 6 projection bees as a coordinated liquid swarm.
 * Each bee projects a different dimension of system state to external targets.
 *
 * Bees managed:
 *   1. health-projection      — System health snapshots
 *   2. config-projection      — Configuration state projections
 *   3. telemetry-projection   — Live telemetry streaming
 *   4. vector-projection      — Vector memory projections
 *   5. topology-projection    — Service topology maps
 *   6. task-projection        — Task queue / pipeline state
 *
 * Coordination:
 *   - PHI-based scheduling intervals (priority bees run more frequently)
 *   - CSL-gated priority scoring for conflict resolution
 *   - computeSwarmAllocation() for dynamic concurrency scaling
 *   - Per-bee circuit-breaker for error isolation
 *   - Semaphore for bounded parallel execution
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger').child('projection-swarm');
const CSL = require('../core/semantic-logic');
const { computeSwarmAllocation } = require('../orchestration/swarm-intelligence');
const { onShutdown } = require('../lifecycle/graceful-shutdown');

// ─── Golden Ratio ────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── Audit Trail ────────────────────────────────────────────────────────────
const AUDIT_PATH = path.join(__dirname, '..', '..', 'data', 'projection-swarm-audit.jsonl');

// ─── Scheduling Constants (PHI-derived) ─────────────────────────────────────
// Priority bees (health, config) run on the short interval (~16.18s)
// Standard bees run on the long interval (~26.18s)
const PRIORITY_INTERVAL_MS = Math.round(PHI * PHI * 6180);    // ~16,178ms ≈ 16s
const STANDARD_INTERVAL_MS = Math.round(PHI * PHI * PHI * 6180); // ~26,180ms ≈ 26s
const SWARM_PULSE_INTERVAL_MS = Math.round(PHI * 15000);       // ~24,270ms
const CIRCUIT_BREAKER_RESET_MS = Math.round(PHI * PHI * 30000); // ~78,540ms

// ─── Circuit Breaker States ──────────────────────────────────────────────────
const CB_STATE = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };
const CB_FAILURE_THRESHOLD = 5;
const CB_SUCCESS_THRESHOLD = 2;

// ─── Semaphore — Bounded Parallel Execution ──────────────────────────────────
class Semaphore {
    constructor(max) {
        this._max = max;
        this._count = 0;
        this._queue = [];
    }

    acquire() {
        if (this._count < this._max) {
            this._count++;
            return Promise.resolve();
        }
        return new Promise(resolve => this._queue.push(resolve));
    }

    release() {
        this._count--;
        if (this._queue.length > 0) {
            this._count++;
            const next = this._queue.shift();
            next();
        }
    }

    get available() { return this._max - this._count; }
    get waiting() { return this._queue.length; }

    resize(newMax) {
        this._max = Math.max(1, newMax);
        // Drain queue if capacity increased
        while (this._count < this._max && this._queue.length > 0) {
            this._count++;
            this._queue.shift()();
        }
    }
}

// ─── Per-Bee Circuit Breaker ──────────────────────────────────────────────────
class CircuitBreaker {
    constructor(domain) {
        this.domain = domain;
        this.state = CB_STATE.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureAt = null;
        this.lastOpenedAt = null;
        this.totalTripped = 0;
    }

    canExecute() {
        if (this.state === CB_STATE.CLOSED) return true;
        if (this.state === CB_STATE.OPEN) {
            const elapsed = Date.now() - this.lastOpenedAt;
            if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
                this.state = CB_STATE.HALF_OPEN;
                this.successCount = 0;
                logger.warn({ domain: this.domain }, '[CircuitBreaker] Half-open — probing recovery');
                return true;
            }
            return false;
        }
        // HALF_OPEN — allow one probe
        return true;
    }

    recordSuccess() {
        if (this.state === CB_STATE.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= CB_SUCCESS_THRESHOLD) {
                this.state = CB_STATE.CLOSED;
                this.failureCount = 0;
                logger.info({ domain: this.domain }, '[CircuitBreaker] Closed — bee recovered');
            }
        } else {
            this.failureCount = 0;
        }
    }

    recordFailure(err) {
        this.failureCount++;
        this.lastFailureAt = Date.now();
        if (this.state === CB_STATE.HALF_OPEN || this.failureCount >= CB_FAILURE_THRESHOLD) {
            this.state = CB_STATE.OPEN;
            this.lastOpenedAt = Date.now();
            this.totalTripped++;
            logger.error({ domain: this.domain, err: err?.message }, '[CircuitBreaker] Opened — bee isolated');
        }
    }

    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureAt: this.lastFailureAt,
            totalTripped: this.totalTripped,
            canExecute: this.canExecute(),
        };
    }
}

// ─── Bee Registry Entry ───────────────────────────────────────────────────────
class ProjectionBeeEntry {
    constructor(beeModule, domain) {
        this.domain = domain;
        this.module = beeModule;
        this.priority = beeModule.priority || 0.5;
        this.intervalMs = beeModule.priority >= 0.8
            ? PRIORITY_INTERVAL_MS
            : STANDARD_INTERVAL_MS;
        this.circuitBreaker = new CircuitBreaker(domain);
        this.lastRunAt = null;
        this.lastSuccessAt = null;
        this.nextRunAt = Date.now() + this._jitter();
        this.runCount = 0;
        this.errorCount = 0;
        this.successCount = 0;
        this.lastError = null;
        this.lastDurationMs = 0;
        this.avgDurationMs = 0;
        this._durationSum = 0;
        this.priorityScore = 0;
        this.schedulerHandle = null;
    }

    // Small PHI-derived jitter to avoid thundering herd at start
    _jitter() {
        return Math.round((Math.random() * PHI * 1000) + 500);
    }

    updateDuration(ms) {
        this.lastDurationMs = ms;
        this._durationSum += ms;
        this.avgDurationMs = Math.round(this._durationSum / Math.max(1, this.runCount));
    }

    getStatus() {
        return {
            domain: this.domain,
            priority: this.priority,
            intervalMs: this.intervalMs,
            lastRunAt: this.lastRunAt,
            lastSuccessAt: this.lastSuccessAt,
            nextRunAt: this.nextRunAt,
            runCount: this.runCount,
            errorCount: this.errorCount,
            successCount: this.successCount,
            lastError: this.lastError,
            lastDurationMs: this.lastDurationMs,
            avgDurationMs: this.avgDurationMs,
            priorityScore: this.priorityScore,
            circuitBreaker: this.circuitBreaker.getStatus(),
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ProjectionSwarm — Main Coordinator
// ═══════════════════════════════════════════════════════════════════════════════
class ProjectionSwarm extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {number} [opts.maxConcurrency=6]  Initial semaphore max
     * @param {boolean} [opts.autoScale=true]   Whether to auto-scale via swarm allocation
     */
    constructor(opts = {}) {
        super();

        /** @type {Map<string, ProjectionBeeEntry>} */
        this.bees = new Map();

        this._running = false;
        this._paused = false;
        this._startedAt = null;

        // Concurrency control
        this._semaphore = new Semaphore(opts.maxConcurrency || 6);
        this._autoScale = opts.autoScale !== false;

        // Swarm allocation — drives concurrency scaling
        this._swarmAllocation = computeSwarmAllocation({});
        this._swarmPulseTimer = null;

        // Scheduling — timer per bee
        this._schedulerTimers = new Map();

        // Telemetry
        this._totalRuns = 0;
        this._totalErrors = 0;
        this._totalSuccesses = 0;
        this._peakConcurrency = 0;
        this._activeTasks = 0;

        // Audit
        const auditDir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(auditDir)) {
            try { fs.mkdirSync(auditDir, { recursive: true }); } catch (_) {}
        }

        logger.info('[ProjectionSwarm] Initialized — PHI-based scheduler, CSL-gated priority');
    }

    // ═══ LIFECYCLE ══════════════════════════════════════════════════════════════

    /**
     * Start the swarm — begins scheduling all projection bees.
     */
    start() {
        if (this._running) {
            logger.warn('[ProjectionSwarm] Already running');
            return this;
        }

        this._running = true;
        this._paused = false;
        this._startedAt = Date.now();

        logger.info({ bees: this.bees.size }, '[ProjectionSwarm] Starting — scheduling all bees');

        // Schedule each bee
        for (const [domain, entry] of this.bees) {
            this._scheduleBee(entry);
        }

        // Swarm pulse — periodically re-evaluate allocation
        if (this._autoScale) {
            this._swarmPulseTimer = setInterval(() => this._swarmPulse(), SWARM_PULSE_INTERVAL_MS);
            if (typeof this._swarmPulseTimer.unref === 'function') this._swarmPulseTimer.unref();
        }

        // Register graceful shutdown
        onShutdown('projection-swarm', () => this.stop());

        this.emit('swarm:started', { bees: this.bees.size, ts: new Date().toISOString() });
        this._auditWrite({ event: 'swarm:started', bees: this.bees.size });

        if (global.eventBus) {
            global.eventBus.emit('projection:swarm:started', { bees: this.bees.size });
        }

        return this;
    }

    /**
     * Stop the swarm — LIFO cleanup of all bee schedulers.
     */
    async stop() {
        if (!this._running) return;

        this._running = false;
        logger.info('[ProjectionSwarm] Stopping — LIFO cleanup');

        // Clear swarm pulse
        if (this._swarmPulseTimer) {
            clearInterval(this._swarmPulseTimer);
            this._swarmPulseTimer = null;
        }

        // Clear bee schedulers in LIFO order (reverse registration)
        const domains = [...this._schedulerTimers.keys()].reverse();
        for (const domain of domains) {
            const timers = this._schedulerTimers.get(domain);
            if (timers) {
                if (timers.timeout) clearTimeout(timers.timeout);
                if (timers.interval) clearInterval(timers.interval);
            }
            this._schedulerTimers.delete(domain);
        }

        this.emit('swarm:stopped', { ts: new Date().toISOString() });
        this._auditWrite({ event: 'swarm:stopped' });

        if (global.eventBus) {
            global.eventBus.emit('projection:swarm:stopped', {});
        }

        logger.info('[ProjectionSwarm] Stopped cleanly');
    }

    /**
     * Pause scheduling — bees currently executing will complete, no new runs start.
     */
    pause() {
        if (!this._running || this._paused) return this;
        this._paused = true;
        logger.info('[ProjectionSwarm] Paused');
        this.emit('swarm:paused', { ts: new Date().toISOString() });
        return this;
    }

    /**
     * Resume scheduling — re-schedules all bees from their last known state.
     */
    resume() {
        if (!this._running || !this._paused) return this;
        this._paused = false;
        logger.info('[ProjectionSwarm] Resuming');

        // Re-schedule all bees
        for (const [domain, entry] of this.bees) {
            this._scheduleBee(entry);
        }

        this.emit('swarm:resumed', { ts: new Date().toISOString() });
        return this;
    }

    // ═══ BEE MANAGEMENT ════════════════════════════════════════════════════════

    /**
     * Add a projection bee to the swarm.
     * @param {object} beeModule - Bee module with { domain, workers, priority, description }
     */
    addBee(beeModule) {
        if (!beeModule || !beeModule.domain) {
            throw new Error('[ProjectionSwarm] beeModule must have a domain property');
        }

        const { domain } = beeModule;

        if (this.bees.has(domain)) {
            logger.warn({ domain }, '[ProjectionSwarm] Replacing existing bee');
            this.removeBee(domain);
        }

        const entry = new ProjectionBeeEntry(beeModule, domain);
        this.bees.set(domain, entry);

        if (this._running && !this._paused) {
            this._scheduleBee(entry);
        }

        logger.info({ domain, priority: entry.priority, intervalMs: entry.intervalMs },
            '[ProjectionSwarm] Bee added');
        this.emit('bee:added', { domain, priority: entry.priority });

        return this;
    }

    /**
     * Remove a bee from the swarm.
     * @param {string} domain
     */
    removeBee(domain) {
        const timers = this._schedulerTimers.get(domain);
        if (timers) {
            if (timers.timeout) clearTimeout(timers.timeout);
            if (timers.interval) clearInterval(timers.interval);
            this._schedulerTimers.delete(domain);
        }
        this.bees.delete(domain);
        logger.info({ domain }, '[ProjectionSwarm] Bee removed');
        this.emit('bee:removed', { domain });
        return this;
    }

    // ═══ BLAST OPERATIONS ══════════════════════════════════════════════════════

    /**
     * Immediately execute all workers for a specific projection bee.
     * @param {string} domain
     */
    async blast(domain) {
        const entry = this.bees.get(domain);
        if (!entry) throw new Error(`[ProjectionSwarm] No bee for domain: ${domain}`);
        return this._executeBee(entry, { reason: 'manual-blast' });
    }

    /**
     * Execute all projection bees immediately in parallel.
     * Priority-scored — higher priority bees get semaphore slots first.
     */
    async blastAll() {
        logger.info('[ProjectionSwarm] BlastAll — executing all bees');

        // Score and sort bees by CSL priority
        const sorted = this._scoreBeesByPriority([...this.bees.values()]);

        const results = await Promise.allSettled(
            sorted.map(entry => this._executeBee(entry, { reason: 'blast-all' }))
        );

        const summary = {
            total: results.length,
            succeeded: results.filter(r => r.status === 'fulfilled' && r.value?.ok).length,
            failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.ok)).length,
            ts: new Date().toISOString(),
        };

        this.emit('swarm:blasted', summary);
        return summary;
    }

    // ═══ STATUS / DIAGNOSTICS ══════════════════════════════════════════════════

    /**
     * Returns swarm status with per-bee health, last run times, error counts.
     */
    getStatus() {
        const beeStatuses = {};
        for (const [domain, entry] of this.bees) {
            beeStatuses[domain] = entry.getStatus();
        }

        return {
            service: 'projection-swarm',
            running: this._running,
            paused: this._paused,
            startedAt: this._startedAt,
            uptime: this._startedAt ? Date.now() - this._startedAt : 0,
            beeCount: this.bees.size,
            bees: beeStatuses,
            telemetry: {
                totalRuns: this._totalRuns,
                totalErrors: this._totalErrors,
                totalSuccesses: this._totalSuccesses,
                peakConcurrency: this._peakConcurrency,
                activeTasks: this._activeTasks,
                semaphore: {
                    available: this._semaphore.available,
                    waiting: this._semaphore.waiting,
                    max: this._semaphore._max,
                },
            },
            swarmAllocation: this._swarmAllocation,
            cslStats: CSL.getStats(),
            ts: new Date().toISOString(),
        };
    }

    /**
     * Returns the current scheduling plan with next-run times.
     */
    getSchedule() {
        const schedule = [];
        const now = Date.now();

        for (const [domain, entry] of this.bees) {
            schedule.push({
                domain,
                priority: entry.priority,
                priorityScore: entry.priorityScore,
                intervalMs: entry.intervalMs,
                nextRunAt: entry.nextRunAt,
                nextRunIn: Math.max(0, entry.nextRunAt - now),
                lastRunAt: entry.lastRunAt,
                circuitBreakerState: entry.circuitBreaker.state,
            });
        }

        // Sort by next run time
        schedule.sort((a, b) => a.nextRunAt - b.nextRunAt);

        return {
            schedule,
            swarmAllocation: this._swarmAllocation,
            semaphoreCapacity: this._semaphore._max,
            paused: this._paused,
            ts: new Date().toISOString(),
        };
    }

    // ═══ INTERNAL — SCHEDULING ══════════════════════════════════════════════════

    /**
     * Schedule a bee on its PHI-derived interval.
     */
    _scheduleBee(entry) {
        const { domain } = entry;

        // Clear existing timers
        const existing = this._schedulerTimers.get(domain);
        if (existing) {
            if (existing.timeout) clearTimeout(existing.timeout);
            if (existing.interval) clearInterval(existing.interval);
        }

        // Initial delay = remaining time until nextRunAt
        const delay = Math.max(0, entry.nextRunAt - Date.now());

        const timeout = setTimeout(() => {
            if (!this._running || this._paused) return;
            this._executeBee(entry, { reason: 'scheduled' }).catch(err => {
                logger.error({ domain, err: err.message }, '[ProjectionSwarm] Scheduler error');
            });

            // Set up recurring interval after first run
            const interval = setInterval(() => {
                if (!this._running) { clearInterval(interval); return; }
                if (this._paused) return;
                this._executeBee(entry, { reason: 'scheduled' }).catch(err => {
                    logger.error({ domain, err: err.message }, '[ProjectionSwarm] Interval error');
                });
            }, entry.intervalMs);

            if (typeof interval.unref === 'function') interval.unref();
            const timers = this._schedulerTimers.get(domain) || {};
            timers.interval = interval;
            this._schedulerTimers.set(domain, timers);
        }, delay);

        if (typeof timeout.unref === 'function') timeout.unref();
        this._schedulerTimers.set(domain, { timeout, interval: null });

        logger.debug({ domain, delay, intervalMs: entry.intervalMs }, '[ProjectionSwarm] Bee scheduled');
    }

    // ═══ INTERNAL — EXECUTION ═══════════════════════════════════════════════════

    /**
     * Execute a single bee with circuit-breaker protection and semaphore gating.
     * @param {ProjectionBeeEntry} entry
     * @param {object} [ctx]  - Execution context metadata
     */
    async _executeBee(entry, ctx = {}) {
        const { domain } = entry;

        // Circuit-breaker check
        if (!entry.circuitBreaker.canExecute()) {
            logger.debug({ domain }, '[ProjectionSwarm] Circuit open — skipping bee');
            this.emit('bee:skipped', { domain, reason: 'circuit-open', ts: new Date().toISOString() });
            return { ok: false, domain, reason: 'circuit-open' };
        }

        // Resource conflict resolution via CSL scoring
        // If multiple bees want to run, CSL scores determine order via semaphore
        const priorityScore = this._calcCSLPriorityScore(entry);
        entry.priorityScore = priorityScore;

        // Acquire semaphore slot
        await this._semaphore.acquire();
        this._activeTasks++;
        if (this._activeTasks > this._peakConcurrency) {
            this._peakConcurrency = this._activeTasks;
        }

        const start = Date.now();
        entry.lastRunAt = start;
        entry.runCount++;
        this._totalRuns++;

        try {
            const workers = entry.module.workers || [];
            if (workers.length === 0) {
                throw new Error(`Bee ${domain} has no workers`);
            }

            // Execute all workers in the bee
            const results = await Promise.allSettled(
                workers.map(worker => worker({ domain, priorityScore, ctx }))
            );

            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const durationMs = Date.now() - start;
            entry.updateDuration(durationMs);
            entry.lastSuccessAt = Date.now();
            entry.successCount++;
            entry.nextRunAt = Date.now() + entry.intervalMs;
            this._totalSuccesses++;
            entry.circuitBreaker.recordSuccess();

            const runRecord = {
                domain,
                ok: true,
                succeeded,
                failed,
                durationMs,
                runCount: entry.runCount,
                priorityScore,
                reason: ctx.reason || 'scheduled',
                ts: new Date().toISOString(),
            };

            this.emit('bee:complete', runRecord);
            this._auditWrite({ event: 'bee:complete', ...runRecord });

            if (global.eventBus) {
                global.eventBus.emit('projection:bee:complete', runRecord);
            }

            logger.debug({ domain, durationMs, succeeded, failed }, '[ProjectionSwarm] Bee complete');
            return runRecord;

        } catch (err) {
            const durationMs = Date.now() - start;
            entry.errorCount++;
            entry.lastError = err.message;
            entry.nextRunAt = Date.now() + entry.intervalMs;
            this._totalErrors++;
            entry.circuitBreaker.recordFailure(err);

            const errRecord = {
                domain,
                ok: false,
                error: err.message,
                durationMs,
                runCount: entry.runCount,
                reason: ctx.reason || 'scheduled',
                ts: new Date().toISOString(),
            };

            this.emit('bee:error', errRecord);
            this._auditWrite({ event: 'bee:error', ...errRecord });

            if (global.eventBus) {
                global.eventBus.emit('projection:bee:error', errRecord);
            }

            logger.error({ domain, err: err.message }, '[ProjectionSwarm] Bee execution error');
            return errRecord;

        } finally {
            this._activeTasks--;
            this._semaphore.release();
        }
    }

    // ═══ INTERNAL — CSL PRIORITY SCORING ═══════════════════════════════════════

    /**
     * Use CSL.soft_gate and CSL.ternary_gate to compute a real-time priority score
     * for a bee. Higher score = bee gets semaphore precedence.
     *
     * Scoring factors:
     *   - Bee's configured priority (0-1)
     *   - Staleness: how long since last success (soft_gate on age)
     *   - Error pressure: recent error count (ternary_gate)
     *   - Circuit health: CB state modifier
     */
    _calcCSLPriorityScore(entry) {
        const now = Date.now();

        // Factor 1: Configured priority (0–1)
        const basePriority = entry.priority;

        // Factor 2: Staleness score — how overdue is this bee?
        // soft_gate on staleness ratio: 1 = very overdue, 0 = just ran
        const timeSinceLastRun = entry.lastRunAt ? (now - entry.lastRunAt) : entry.intervalMs * PHI;
        const stalenessRatio = Math.min(timeSinceLastRun / entry.intervalMs, PHI);
        const stalenessScore = CSL.soft_gate(stalenessRatio, PHI / 2, 5); // 0→1

        // phi inverse for scoring
        const PHI_INV = 1 / PHI;

        // Factor 3: Error pressure — recent error rate
        const errorRate = entry.runCount > 0 ? (entry.errorCount / entry.runCount) : 0;
        const ternaryResult = CSL.ternary_gate(1 - errorRate, 0.72, 0.35, 15);
        // +1 = healthy (boost), 0 = neutral, -1 = degraded (penalize)
        const healthModifier = ternaryResult.state === 1 ? 1.0
            : ternaryResult.state === 0 ? PHI_INV  // ~0.618
            : PHI_INV * PHI_INV;                    // ~0.382 — heavily penalize

        // Factor 4: Circuit-breaker modifier
        const cbModifier = entry.circuitBreaker.state === CB_STATE.CLOSED ? 1.0
            : entry.circuitBreaker.state === CB_STATE.HALF_OPEN ? PHI_INV
            : 0.0; // OPEN = zero priority

        // Composite CSL score
        const score = (
            basePriority * 0.35 +
            stalenessScore * 0.35 +
            healthModifier * 0.20 +
            cbModifier * 0.10
        );

        return +score.toFixed(4);
    }

    /**
     * Score and sort bees by CSL priority — highest first.
     * Used by blastAll() and conflict resolution.
     * @param {ProjectionBeeEntry[]} entries
     * @returns {ProjectionBeeEntry[]}
     */
    _scoreBeesByPriority(entries) {
        return entries
            .map(e => {
                e.priorityScore = this._calcCSLPriorityScore(e);
                return e;
            })
            .sort((a, b) => b.priorityScore - a.priorityScore);
    }

    // ═══ INTERNAL — SWARM PULSE ════════════════════════════════════════════════

    /**
     * Re-evaluate swarm allocation and resize semaphore accordingly.
     * Called on SWARM_PULSE_INTERVAL_MS.
     */
    _swarmPulse() {
        const errorRate = this._totalRuns > 0
            ? this._totalErrors / this._totalRuns
            : 0;

        const pendingTasks = this._semaphore.waiting;
        const loadScore = Math.min(1, this._activeTasks / Math.max(1, this._semaphore._max));

        this._swarmAllocation = computeSwarmAllocation({
            loadScore,
            pendingTasks,
            p95LatencyMs: this._estimateP95Latency(),
            errorRate,
        });

        // Resize semaphore to reflect new target concurrency
        const newMax = Math.min(this._swarmAllocation.asyncConcurrency, this.bees.size * 2);
        if (newMax !== this._semaphore._max) {
            logger.debug({ oldMax: this._semaphore._max, newMax },
                '[ProjectionSwarm] Resizing semaphore');
            this._semaphore.resize(newMax);
        }

        this.emit('swarm:pulse', {
            allocation: this._swarmAllocation,
            activeTasks: this._activeTasks,
            semaphoreMax: this._semaphore._max,
            ts: new Date().toISOString(),
        });

        if (global.eventBus) {
            global.eventBus.emit('projection:swarm:pulse', {
                allocation: this._swarmAllocation,
                errorRate,
                pendingTasks,
            });
        }
    }

    /**
     * Rough P95 latency estimate from per-bee avgDurations.
     */
    _estimateP95Latency() {
        const durations = [...this.bees.values()]
            .map(e => e.avgDurationMs)
            .filter(d => d > 0)
            .sort((a, b) => a - b);

        if (durations.length === 0) return 0;
        const p95Idx = Math.floor(durations.length * 0.95);
        return durations[Math.min(p95Idx, durations.length - 1)];
    }

    // ═══ INTERNAL — AUDIT ═══════════════════════════════════════════════════════

    _auditWrite(record) {
        try {
            const line = JSON.stringify({ ...record, _ts: new Date().toISOString() }) + '\n';
            fs.appendFileSync(AUDIT_PATH, line, 'utf8');
        } catch (_) {
            // Non-fatal — audit failure does not stop projection
        }
    }
}

// ─── Module Export ────────────────────────────────────────────────────────────
module.exports = { ProjectionSwarm };

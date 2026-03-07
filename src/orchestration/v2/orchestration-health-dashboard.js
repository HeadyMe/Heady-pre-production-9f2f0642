/*
 * © 2026 HeadySystems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── OrchestrationHealthDashboard — Real-Time Health Monitoring ──
 *
 * NEW FILE: Unified health monitoring for all orchestration components.
 *
 * Addresses these issues from the analysis:
 *   [NEW OBS-2]  Per-stage P50/P95/P99 latency tracking (from PipelineTelemetry).
 *   [NEW OBS-3]  Conductor queue depth and wait times.
 *   [NEW OBS-4]  Swarm matrix reconciliation: compares HeadySwarmMatrix.json
 *                registered bees against actually registered conductor bees.
 *                Reports which swarms have unregistered bees.
 *   [NEW]        Composite health score: single 0–100 score combining all
 *                component health signals.
 *   [NEW]        Alert thresholds: configurable per-metric alert levels
 *                that emit 'alert' events and notify SSE clients.
 *   [NEW]        Phase readiness tracker: evaluates CognitiveRuntimeGovernor
 *                phases A–F and surfaces which are ready/blocked.
 *   [NEW]        Express routes: /api/health/dashboard, /api/health/score,
 *                /api/health/swarm-matrix, /api/health/phases, /api/health/alerts.
 *
 * Architecture:
 *   OrchestrationHealthDashboard polls all components every N seconds,
 *   computes health score, detects threshold violations, and emits alerts.
 *   Also provides a GET endpoint for the complete dashboard snapshot.
 *
 * Integration:
 *   const dashboard = new OrchestrationHealthDashboard({
 *     conductor,   // heady-conductor-v2.js
 *     pipeline,    // hc-full-pipeline-v2.js
 *     consensus,   // swarm-consensus-v2.js
 *     optimizer,   // monte-carlo-optimizer.js
 *     telemetry,   // pipeline-telemetry.js
 *     governor,    // cognitive-runtime-governor.js
 *     swarmMatrix, // HeadySwarmMatrix.json (parsed)
 *   });
 *   dashboard.start();
 *   dashboard.registerRoute(app);
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// ── Constants ──────────────────────────────────────────────────────

const PHI = (1 + Math.sqrt(5)) / 2;
const DEFAULT_POLL_INTERVAL_MS = Math.round(PHI * 10000); // ~16.2s
const ALERT_HISTORY_MAX = 200;
const SCORE_HISTORY_MAX = 100;

// Default alert thresholds
const DEFAULT_THRESHOLDS = Object.freeze({
    errorRate1m:       { warn: 10, critical: 25 },    // % error rate in 1 minute
    staleExecutions:   { warn: 2,  critical: 5 },     // count
    activeLocks:       { warn: 50, critical: 100 },   // count
    waitQueueDepth:    { warn: 20, critical: 50 },    // waiter count
    queueDepth:        { warn: 100, critical: 500 },  // conductor queue depth
    heapUsagePct:      { warn: 75, critical: 90 },    // %
    stageP99LatencyMs: { warn: 5000, critical: 15000 }, // ms
    failedRuns:        { warn: 5, critical: 20 },     // rolling 5m count
    unregisteredBees:  { warn: 5, critical: 15 },     // bees in matrix but not in conductor
});

// Score weights per component (sum to 1.0)
const SCORE_WEIGHTS = {
    pipeline:  0.30,
    conductor: 0.25,
    consensus: 0.15,
    memory:    0.10,
    telemetry: 0.10,
    optimizer: 0.10,
};

// ── OrchestrationHealthDashboard ────────────────────────────────

class OrchestrationHealthDashboard extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {object} [opts.conductor]    - HeadyConductor v2 instance
     * @param {object} [opts.pipeline]     - HCFullPipeline v2 instance
     * @param {object} [opts.consensus]    - SwarmConsensus v2 instance
     * @param {object} [opts.optimizer]    - MonteCarloOptimizer instance
     * @param {object} [opts.telemetry]    - PipelineTelemetry instance
     * @param {object} [opts.governor]     - CognitiveRuntimeGovernor instance
     * @param {object} [opts.swarmMatrix]  - Parsed HeadySwarmMatrix.json object
     * @param {string} [opts.swarmMatrixPath] - Path to HeadySwarmMatrix.json (loaded if swarmMatrix not provided)
     * @param {number} [opts.pollIntervalMs] - Health poll interval (default: ~16.2s)
     * @param {object} [opts.thresholds]   - Alert thresholds override
     */
    constructor(opts = {}) {
        super();

        this.conductor  = opts.conductor  || null;
        this.pipeline   = opts.pipeline   || null;
        this.consensus  = opts.consensus  || null;
        this.optimizer  = opts.optimizer  || null;
        this.telemetry  = opts.telemetry  || null;
        this.governor   = opts.governor   || null;

        this._pollIntervalMs = opts.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
        this._thresholds = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds || {}) };

        // Load swarm matrix
        this._swarmMatrix = opts.swarmMatrix || this._loadSwarmMatrix(opts.swarmMatrixPath);

        // State
        this._pollTimer = null;
        this._latestSnapshot = null;
        this._alertHistory = [];
        this._scoreHistory = [];

        // Alert suppression: don't re-fire the same alert for 60s
        this._lastAlertAt = {};
        this._alertSuppressionMs = 60_000;
    }

    // ── Swarm matrix loading ──────────────────────────────────────

    _loadSwarmMatrix(matrixPath) {
        const candidates = [
            matrixPath,
            path.join(process.cwd(), 'HeadySwarmMatrix.json'),
            path.join(process.cwd(), '..', 'HeadySwarmMatrix.json'),
        ].filter(Boolean);

        for (const p of candidates) {
            try {
                if (fs.existsSync(p)) {
                    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
                    logger.info(`[HealthDashboard] Loaded swarm matrix from ${p}`);
                    return raw;
                }
            } catch { /* continue */ }
        }

        logger.warn('[HealthDashboard] HeadySwarmMatrix.json not found — swarm reconciliation disabled');
        return null;
    }

    // ── Start / Stop ──────────────────────────────────────────────

    /**
     * Start the health polling loop.
     */
    start() {
        if (this._pollTimer) return;
        logger.info(`[HealthDashboard] Starting health poll (interval: ${this._pollIntervalMs}ms)`);

        // Immediate first poll
        this._poll().catch(err => logger.warn(`[HealthDashboard] Initial poll error: ${err.message}`));

        this._pollTimer = setInterval(() => {
            this._poll().catch(err => logger.warn(`[HealthDashboard] Poll error: ${err.message}`));
        }, this._pollIntervalMs);
    }

    stop() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    // ── Health Poll ───────────────────────────────────────────────

    /**
     * Execute one health check cycle.
     * Collects data from all registered components, scores them,
     * detects threshold violations, and emits alerts.
     * @private
     */
    async _poll() {
        const snapshot = await this._buildSnapshot();
        this._latestSnapshot = snapshot;

        // [NEW OBS-2] Track score history
        this._scoreHistory.push({ score: snapshot.score, ts: snapshot.ts });
        if (this._scoreHistory.length > SCORE_HISTORY_MAX) this._scoreHistory.shift();

        // Detect threshold violations and fire alerts
        this._checkAlerts(snapshot);

        this.emit('health:snapshot', snapshot);
        return snapshot;
    }

    // ── Snapshot builder ──────────────────────────────────────────

    async _buildSnapshot() {
        const ts = Date.now();
        const components = {};

        // ── Pipeline health ───────────────────────────────────────
        if (this.pipeline) {
            try {
                const status = this.pipeline.status();
                const total = status.running + status.completed + status.failed;
                const failRate = total > 0 ? (status.failed / total) * 100 : 0;

                components.pipeline = {
                    ok: failRate < this._thresholds.failedRuns.warn,
                    status,
                    failRate: +failRate.toFixed(1),
                    selfHeal: status.selfHeal,
                    score: this._scoreComponent('pipeline', {
                        failRate,
                        running: status.running,
                    }),
                };
            } catch (err) {
                components.pipeline = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── Conductor health ──────────────────────────────────────
        if (this.conductor) {
            try {
                const status = this.conductor.getStatus();
                const successRate = status.totalDispatched > 0
                    ? (status.totalCompleted / status.totalDispatched) * 100 : 100;
                const queueDepth = status.queueDepth || 0;
                const staleExecutions = status.activeExecutions || 0;

                components.conductor = {
                    ok: successRate >= 90 && queueDepth < this._thresholds.queueDepth.warn,
                    beeCount: status.totalRegistered,
                    activeExecutions: staleExecutions,
                    queueDepth,
                    successRate: +successRate.toFixed(1),
                    dispatchLatency: status.metrics?.dispatchLatency,
                    executionDuration: status.metrics?.executionDuration,
                    score: this._scoreComponent('conductor', { successRate, queueDepth }),
                };
            } catch (err) {
                components.conductor = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── Consensus health ──────────────────────────────────────
        if (this.consensus) {
            try {
                const status = this.consensus.getStatus();
                const lockContention = status.totalConflicts > 0
                    ? (status.totalConflicts / (status.totalAcquired || 1)) * 100 : 0;

                components.consensus = {
                    ok: status.activeLocks < this._thresholds.activeLocks.warn,
                    activeLocks: status.activeLocks,
                    waitQueueDepth: status.waitQueueDepth,
                    lockContention: +lockContention.toFixed(1),
                    deadOwnerReleases: status.totalDeadOwnerReleases || 0,
                    score: this._scoreComponent('consensus', {
                        activeLocks: status.activeLocks,
                        waitDepth: status.waitQueueDepth,
                    }),
                };
            } catch (err) {
                components.consensus = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── Telemetry / error rates ───────────────────────────────
        if (this.telemetry) {
            try {
                const stats = this.telemetry.getStats();
                components.telemetry = {
                    ok: stats.errorRates['1m'] < this._thresholds.errorRate1m.warn,
                    errorRates: stats.errorRates,
                    eventCounts: stats.eventCounts,
                    latencySnapshots: stats.latencySnapshots,
                    sseClients: stats.sseClients,
                    score: this._scoreComponent('telemetry', { errorRate: stats.errorRates['1m'] }),
                };
            } catch (err) {
                components.telemetry = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── Monte Carlo optimizer health ──────────────────────────
        if (this.optimizer) {
            try {
                const status = this.optimizer.getStatus();
                components.optimizer = {
                    ok: true,
                    totalBatches: status.totalBatches,
                    topPool: status.topPool,
                    baseRates: status.baseRates,
                    historySize: status.historySize,
                    score: Math.min(100, 70 + Math.min(30, status.totalBatches)),
                };
            } catch (err) {
                components.optimizer = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── Memory health ─────────────────────────────────────────
        const mem = process.memoryUsage();
        const heapPct = (mem.heapUsed / mem.heapTotal) * 100;
        components.memory = {
            ok: heapPct < this._thresholds.heapUsagePct.warn,
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            heapPct: +heapPct.toFixed(1),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            score: this._scoreComponent('memory', { heapPct }),
        };

        // ── CognitiveRuntimeGovernor phases ──────────────────────
        let phases = null;
        if (this.governor) {
            try {
                const gStatus = this.governor.getStatus();
                phases = gStatus.phases;
                const readyCount = Object.values(phases).filter(p => p.ready).length;
                const totalPhases = Object.keys(phases).length;
                components.cognitivePhases = {
                    ok: readyCount === totalPhases,
                    readyCount,
                    totalPhases,
                    phaseSummary: phases,
                    score: Math.round((readyCount / totalPhases) * 100),
                };
            } catch (err) {
                components.cognitivePhases = { ok: false, error: err.message, score: 0 };
            }
        }

        // ── [NEW OBS-4] Swarm matrix reconciliation ───────────────
        let swarmReconciliation = null;
        if (this._swarmMatrix && this.conductor) {
            swarmReconciliation = this._reconcileSwarmMatrix();
            components.swarmMatrix = {
                ok: swarmReconciliation.unregisteredCount < this._thresholds.unregisteredBees.warn,
                ...swarmReconciliation,
            };
        }

        // ── Composite health score ────────────────────────────────
        const score = this._computeCompositeScore(components);

        // ── Uptime & process ──────────────────────────────────────
        const process_info = {
            uptime: process.uptime(),
            uptimeFormatted: this._formatUptime(process.uptime()),
            nodeVersion: process.version,
            pid: process.pid,
        };

        return {
            ts: new Date().toISOString(),
            tsMs: ts,
            score,
            grade: this._scoreToGrade(score),
            healthy: score >= 70,
            components,
            phases,
            swarmReconciliation,
            process: process_info,
            pollIntervalMs: this._pollIntervalMs,
            alertCount: this._alertHistory.filter(
                a => (ts - new Date(a.ts).getTime()) < 300_000
            ).length,
        };
    }

    // ── Swarm matrix reconciliation ───────────────────────────────

    /**
     * [NEW OBS-4] Compare HeadySwarmMatrix.json expected bees against
     * actually registered bees in the conductor.
     * Returns a report of which bees are missing from the conductor.
     */
    _reconcileSwarmMatrix() {
        if (!this._swarmMatrix || !this.conductor) {
            return { enabled: false };
        }

        const registeredBeeIds = new Set(this.conductor.bees.keys());
        const expected = [];
        const unregistered = [];
        const standby = [];

        const registry = this._swarmMatrix.swarm_registry || [];
        for (const swarm of registry) {
            for (const bee of (swarm.bees || [])) {
                const entry = {
                    swarmId:   swarm.swarm_id,
                    swarmName: swarm.swarm_name,
                    beeClass:  bee.class,
                    beeRole:   bee.role,
                    status:    bee.status,
                };
                expected.push(entry);

                if (bee.status === 'STANDBY' || bee.status === 'SLEEPER') {
                    standby.push(entry);
                } else if (!registeredBeeIds.has(bee.class)) {
                    unregistered.push(entry);
                }
            }
        }

        return {
            enabled: true,
            totalExpected: expected.length,
            totalRegistered: registeredBeeIds.size,
            unregisteredCount: unregistered.length,
            standbyCount: standby.length,
            unregisteredBees: unregistered.slice(0, 20), // cap for response size
            swarmCoverage: expected.length > 0
                ? +(((expected.length - unregistered.length) / expected.length) * 100).toFixed(1)
                : 100,
        };
    }

    // ── Scoring ───────────────────────────────────────────────────

    /**
     * Score a single component on a 0–100 scale.
     * @private
     */
    _scoreComponent(component, metrics) {
        switch (component) {
            case 'pipeline': {
                const { failRate = 0 } = metrics;
                return Math.max(0, 100 - failRate * 3);
            }
            case 'conductor': {
                const { successRate = 100, queueDepth = 0 } = metrics;
                const queuePenalty = Math.min(30, queueDepth / 10);
                return Math.max(0, successRate - queuePenalty);
            }
            case 'consensus': {
                const { activeLocks = 0, waitDepth = 0 } = metrics;
                const lockPenalty = Math.min(20, activeLocks / 5);
                const waitPenalty = Math.min(20, waitDepth / 3);
                return Math.max(0, 100 - lockPenalty - waitPenalty);
            }
            case 'telemetry': {
                const { errorRate = 0 } = metrics;
                return Math.max(0, 100 - errorRate * 2);
            }
            case 'memory': {
                const { heapPct = 0 } = metrics;
                if (heapPct > 90) return 20;
                if (heapPct > 75) return 50;
                if (heapPct > 60) return 75;
                return 100;
            }
            default:
                return 80;
        }
    }

    /**
     * Compute weighted composite health score.
     * @private
     */
    _computeCompositeScore(components) {
        let totalWeight = 0;
        let weightedSum = 0;

        for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
            const comp = components[key];
            if (comp && typeof comp.score === 'number') {
                weightedSum += comp.score * weight;
                totalWeight += weight;
            }
        }

        if (totalWeight === 0) return 0;
        return Math.round(weightedSum / totalWeight);
    }

    _scoreToGrade(score) {
        if (score >= 90) return 'EXCELLENT';
        if (score >= 75) return 'GOOD';
        if (score >= 60) return 'FAIR';
        if (score >= 40) return 'POOR';
        return 'CRITICAL';
    }

    _formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    }

    // ── Alert Detection ───────────────────────────────────────────

    /**
     * Check snapshot metrics against thresholds and emit alerts.
     * @private
     */
    _checkAlerts(snapshot) {
        const checks = [
            // Error rates
            snapshot.components.telemetry && {
                key:   'errorRate1m',
                value: snapshot.components.telemetry?.errorRates?.['1m'] || 0,
                label: 'Error rate (1m)',
                unit: '%',
            },
            // Conductor queue
            snapshot.components.conductor && {
                key:   'queueDepth',
                value: snapshot.components.conductor?.queueDepth || 0,
                label: 'Conductor queue depth',
                unit: 'tasks',
            },
            // Lock contention
            snapshot.components.consensus && {
                key:   'activeLocks',
                value: snapshot.components.consensus?.activeLocks || 0,
                label: 'Active locks',
                unit: 'locks',
            },
            snapshot.components.consensus && {
                key:   'waitQueueDepth',
                value: snapshot.components.consensus?.waitQueueDepth || 0,
                label: 'Lock wait queue depth',
                unit: 'waiters',
            },
            // Memory
            {
                key:   'heapUsagePct',
                value: snapshot.components.memory?.heapPct || 0,
                label: 'Heap usage',
                unit: '%',
            },
            // Swarm matrix
            snapshot.components.swarmMatrix && {
                key:   'unregisteredBees',
                value: snapshot.components.swarmMatrix?.unregisteredCount || 0,
                label: 'Unregistered active bees',
                unit: 'bees',
            },
        ].filter(Boolean);

        for (const check of checks) {
            const threshold = this._thresholds[check.key];
            if (!threshold) continue;

            let level = null;
            if (check.value >= threshold.critical) level = 'critical';
            else if (check.value >= threshold.warn) level = 'warn';

            if (level) {
                const alertKey = `${check.key}:${level}`;
                const now = Date.now();
                const lastFired = this._lastAlertAt[alertKey] || 0;

                if (now - lastFired > this._alertSuppressionMs) {
                    this._lastAlertAt[alertKey] = now;
                    const alert = {
                        key: check.key,
                        level,
                        label: check.label,
                        value: check.value,
                        threshold: threshold[level],
                        unit: check.unit,
                        ts: new Date().toISOString(),
                        score: snapshot.score,
                    };

                    this._alertHistory.push(alert);
                    if (this._alertHistory.length > ALERT_HISTORY_MAX) this._alertHistory.shift();

                    this.emit('alert', alert);
                    logger.warn(`[HealthDashboard] ALERT [${level.toUpperCase()}] ${check.label}: ${check.value}${check.unit} (threshold: ${threshold[level]}${check.unit})`);
                }
            }
        }
    }

    // ── REST API ──────────────────────────────────────────────────

    /**
     * Register all health dashboard HTTP routes.
     * @param {import('express').Application} app
     */
    registerRoute(app) {
        // Full dashboard snapshot
        app.get('/api/health/dashboard', async (req, res) => {
            try {
                const snapshot = req.query.fresh === 'true'
                    ? await this._buildSnapshot()
                    : (this._latestSnapshot || await this._buildSnapshot());
                res.json({ ok: true, ...snapshot });
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });

        // Composite score only (lightweight)
        app.get('/api/health/score', (_req, res) => {
            if (!this._latestSnapshot) {
                return res.json({ ok: true, score: null, grade: 'UNKNOWN', message: 'No poll yet' });
            }
            res.json({
                ok: true,
                score: this._latestSnapshot.score,
                grade: this._latestSnapshot.grade,
                healthy: this._latestSnapshot.healthy,
                ts: this._latestSnapshot.ts,
                history: this._scoreHistory.slice(-20),
            });
        });

        // Swarm matrix reconciliation
        app.get('/api/health/swarm-matrix', (_req, res) => {
            const recon = this._latestSnapshot?.swarmReconciliation
                || this._reconcileSwarmMatrix();
            res.json({ ok: true, ...recon });
        });

        // CognitiveRuntimeGovernor phases
        app.get('/api/health/phases', async (_req, res) => {
            if (!this.governor) {
                return res.json({ ok: false, error: 'CognitiveRuntimeGovernor not connected' });
            }
            try {
                const status = this.governor.getStatus();
                res.json({ ok: true, ...status });
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });

        // Alert history
        app.get('/api/health/alerts', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            const level = req.query.level;
            let alerts = this._alertHistory.slice(-limit * 2);
            if (level) alerts = alerts.filter(a => a.level === level);
            res.json({ ok: true, alerts: alerts.slice(-limit), total: this._alertHistory.length });
        });

        // Per-stage latency (if telemetry connected)
        app.get('/api/health/latency', (_req, res) => {
            if (!this.telemetry) {
                return res.json({ ok: false, error: 'Telemetry not connected' });
            }
            res.json({ ok: true, stages: this.telemetry._latency.allLabels() });
        });

        // Force a health poll
        app.post('/api/health/poll', async (_req, res) => {
            try {
                const snapshot = await this._buildSnapshot();
                this._latestSnapshot = snapshot;
                res.json({ ok: true, ...snapshot });
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });

        logger.info('[HealthDashboard] Routes registered: /api/health/dashboard, /api/health/score, /api/health/swarm-matrix, /api/health/phases, /api/health/alerts');
    }

    // ── Snapshot access ───────────────────────────────────────────

    getLatestSnapshot() { return this._latestSnapshot; }
    getAlertHistory(limit = 50) { return this._alertHistory.slice(-limit); }
    getScoreHistory(limit = 20) { return this._scoreHistory.slice(-limit); }
}

module.exports = { OrchestrationHealthDashboard, DEFAULT_THRESHOLDS, SCORE_WEIGHTS };

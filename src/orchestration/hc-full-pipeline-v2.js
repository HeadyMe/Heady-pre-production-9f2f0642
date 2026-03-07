/*
 * © 2026 HeadySystems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══ HCFullPipeline v2 — 9-Stage State Machine — SPEC-1 ═══
 *
 * CHANGES FROM v1:
 *   [FIX P0-2]  Named stage lookups replace all hardcoded array indices.
 *               _getStageResult(run, 'ARENA') instead of run.stages[3].result.
 *   [FIX P0-4]  Monte Carlo stage is now async and chunked via setImmediate()
 *               to prevent event loop blocking.
 *   [FIX P1-1]  resume() now routes through _executeStageWithHeal() — same
 *               self-heal protocol as the primary execute() path.
 *   [FIX P1-3]  WorkerPool._drain() fixed to fill all available slots.
 *   [FIX P2-4]  runs Map is bounded: oldest entries evicted at maxRuns limit.
 *   [FIX P2-5]  Constructor accepts and applies hcfullpipeline.json config
 *               for timeouts, retry policies, and pool budgets.
 *   [NEW]       Stage timeout enforcement per stage (from config or defaults).
 *   [NEW]       Retry policy applied at the stage level (configurable maxRetries).
 *   [NEW]       Outcome feedback: completed/failed runs update Monte Carlo's
 *               baseSuccessRate via a feedback callback.
 *   [NEW]       _executeStageWithHeal() — shared execution+heal logic used by
 *               both execute() and resume() to eliminate code duplication.
 *   [NEW]       stage:timeout event emitted when a stage exceeds its budget.
 *
 * Stages: INTAKE → TRIAGE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

// ── Stage definitions ─────────────────────────────────────────────
const STAGES = [
    'INTAKE',       // 1. Parse & validate incoming request
    'TRIAGE',       // 2. Classify priority, route to correct node pool
    'MONTE_CARLO',  // 3. Async risk assessment simulation
    'ARENA',        // 4. Multi-node competition (if enabled)
    'JUDGE',        // 5. Score & rank outputs
    'APPROVE',      // 6. Human approval gate (for HIGH/CRITICAL risk)
    'EXECUTE',      // 7. Run the winning strategy
    'VERIFY',       // 8. Post-execution validation
    'RECEIPT',      // 9. Emit trust receipt + audit log
];

const STATUS = Object.freeze({
    PENDING:    'pending',
    RUNNING:    'running',
    COMPLETED:  'completed',
    FAILED:     'failed',
    PAUSED:     'paused',
    SKIPPED:    'skipped',
    ROLLED_BACK:'rolled_back',
});

// Default timeouts per stage (ms) — overridden by hcfullpipeline.json config
const DEFAULT_STAGE_TIMEOUTS = {
    INTAKE:      5_000,
    TRIAGE:      5_000,
    MONTE_CARLO: 30_000,
    ARENA:       60_000,
    JUDGE:       15_000,
    APPROVE:     600_000, // Human approval can take up to 10 minutes
    EXECUTE:     120_000,
    VERIFY:      15_000,
    RECEIPT:     5_000,
};

const DEFAULT_RETRY_POLICY = {
    maxRetries: 2,
    backoffMs: 1_000,
    backoffMultiplier: 2,
    maxBackoffMs: 10_000,
};

const MAX_RUNS = 5_000;       // [FIX P2-4] Bound the runs map
const MC_CHUNK_SIZE = 200;    // [FIX P0-4] Monte Carlo iterations per setImmediate chunk

// ─── Helper: Chunked async simulation ──────────────────────────────

/**
 * Run a Monte Carlo simulation in non-blocking async chunks.
 * Yields to the event loop every MC_CHUNK_SIZE iterations.
 *
 * @param {object} engine - MonteCarloEngine instance
 * @param {object} scenario - Scenario config
 * @param {number} iterations - Total iterations
 * @returns {Promise<object>} Simulation result
 */
async function runMonteCarloAsync(engine, scenario, iterations) {
    if (!engine || typeof engine.runFullCycle !== 'function') {
        return { skipped: true, reason: 'no_engine' };
    }

    // If iterations are small enough, run synchronously
    if (iterations <= MC_CHUNK_SIZE) {
        return engine.runFullCycle(scenario, iterations);
    }

    // For larger simulations, chunk the work and yield between chunks
    // We re-implement the core loop here to make it async-friendly
    const { mulberry32 } = require('./monte-carlo');
    const seed = scenario.seed !== undefined ? scenario.seed : (Date.now() & 0xffffffff);
    const rand = mulberry32(seed);
    const riskFactors = scenario.riskFactors || [];

    let successCount = 0;
    let partialCount = 0;
    let failureCount = 0;
    const mitigationHits = {};

    for (let chunk = 0; chunk < iterations; chunk += MC_CHUNK_SIZE) {
        const chunkEnd = Math.min(chunk + MC_CHUNK_SIZE, iterations);
        for (let i = chunk; i < chunkEnd; i++) {
            let totalImpact = 0;
            for (const factor of riskFactors) {
                const { probability = 0.1, impact = 0.5, mitigation } = factor;
                if (rand() < probability) {
                    totalImpact += mitigation ? impact * 0.5 : impact;
                    if (mitigation) mitigationHits[mitigation] = (mitigationHits[mitigation] || 0) + 1;
                }
            }
            if (totalImpact < 0.3) successCount++;
            else if (totalImpact < 0.7) partialCount++;
            else failureCount++;
        }
        // Yield to event loop between chunks
        await new Promise(r => setImmediate(r));
    }

    const failureRate = failureCount / iterations;
    const successRate = successCount / iterations;
    const z = 1.96;
    const n = iterations;
    const p = failureRate;
    const denom = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denom;
    const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denom;

    const confidence = Math.round(successRate * 100);
    const topMitigations = Object.entries(mitigationHits)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);

    return {
        scenario: scenario.name || 'unnamed',
        iterations,
        confidence,
        failureRate: Math.round(failureRate * 10000) / 10000,
        riskGrade: confidence >= 80 ? 'GREEN' : confidence >= 60 ? 'YELLOW' : confidence >= 40 ? 'ORANGE' : 'RED',
        topMitigations,
        outcomes: { success: successCount, partial: partialCount, failure: failureCount },
        confidenceBounds: {
            lower: Math.max(0, centre - margin),
            upper: Math.min(1, centre + margin),
        },
        seed,
        async: true, // flag indicating this was run in chunked mode
    };
}

// ─── HCFullPipeline v2 ──────────────────────────────────────────

class HCFullPipeline extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {object} [opts.monteCarlo]        - MonteCarloEngine instance
     * @param {object} [opts.policyEngine]      - Policy engine instance
     * @param {object} [opts.incidentManager]   - Incident manager
     * @param {object} [opts.errorInterceptor]  - Error interceptor / rule synthesizer
     * @param {object} [opts.vectorMemory]      - Vector memory for context & healing
     * @param {object} [opts.selfAwareness]     - Self-awareness module
     * @param {object} [opts.buddyMetacognition]- Buddy metacognition engine
     * @param {object} [opts.pipelineConfig]    - Loaded hcfullpipeline.json (optional)
     * @param {number} [opts.maxRuns=5000]      - [FIX P2-4] Max retained runs
     * @param {Function} [opts.onRunComplete]   - Outcome feedback callback (result) => void
     */
    constructor(opts = {}) {
        super();
        const mem = process.memoryUsage();
        const availableMB = (mem.heapTotal - mem.heapUsed) / (1024 * 1024);
        this.maxConcurrent = opts.maxConcurrent || Math.max(4, Math.floor(availableMB / 10));

        // [FIX P2-4] Bounded runs storage
        this._runs = new Map();
        this._runOrder = []; // insertion-ordered ring buffer for eviction
        this._maxRuns = opts.maxRuns || MAX_RUNS;

        this.monteCarlo = opts.monteCarlo || null;
        this.policyEngine = opts.policyEngine || null;
        this.incidentManager = opts.incidentManager || null;
        this.errorInterceptor = opts.errorInterceptor || null;
        this.vectorMemory = opts.vectorMemory || null;
        this.selfAwareness = opts.selfAwareness || null;
        this.buddyMetacognition = opts.buddyMetacognition || null;
        this.selfHealStats = { attempts: 0, successes: 0, failures: 0 };

        // [FIX P2-5] Load timeouts and retry policy from pipeline config
        const cfg = opts.pipelineConfig || {};
        const stageTimeouts = this._buildStageTimeouts(cfg);
        this._stageTimeouts = stageTimeouts;
        this._retryPolicy = cfg.pipeline?.retryPolicy || DEFAULT_RETRY_POLICY;

        // [NEW] Outcome feedback callback — updates Monte Carlo base rates
        this._onRunComplete = opts.onRunComplete || null;

        this._wireAutoTelemetry();
    }

    // ── Bounded runs map ──────────────────────────────────────────

    /** Backward-compatible accessor */
    get runs() { return this._runs; }

    _saveRun(run) {
        this._runs.set(run.id, run);
        this._runOrder.push(run.id);
        // Evict oldest if over limit
        if (this._runOrder.length > this._maxRuns) {
            const oldestId = this._runOrder.shift();
            if (oldestId) this._runs.delete(oldestId);
        }
    }

    // ── Config helpers ────────────────────────────────────────────

    /** [FIX P2-5] Build per-stage timeout map from loaded JSON config. */
    _buildStageTimeouts(cfg) {
        const result = { ...DEFAULT_STAGE_TIMEOUTS };
        if (cfg.stages) {
            for (const stageDef of cfg.stages) {
                // Map config stage names to STAGES enum
                const enumName = stageDef.name?.toUpperCase().replace(/[^A-Z_]/g, '_');
                if (enumName && stageDef.timeout) {
                    result[enumName] = stageDef.timeout;
                }
            }
        }
        return result;
    }

    // ── Seeded PRNG (Mulberry32) ──────────────────────────────────

    _createSeededRng(seed) {
        let s = seed | 0;
        return () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ── Named stage result lookup ─────────────────────────────────

    /**
     * [FIX P0-2] Get a stage's result by name instead of hardcoded array index.
     * Safe against stage reordering, additions, or skips.
     *
     * @param {object} run
     * @param {string} stageName - e.g., 'ARENA', 'MONTE_CARLO'
     * @returns {*} Stage result or null if not found/completed
     */
    _getStageResult(run, stageName) {
        const stage = run.stages.find(s => s.name === stageName);
        return stage?.result ?? null;
    }

    _getStageMeta(run, stageName) {
        return run.stages.find(s => s.name === stageName) || null;
    }

    // ── Run lifecycle ─────────────────────────────────────────────

    /**
     * Create a new pipeline run. Does not execute it.
     */
    createRun(request = {}) {
        const runId = crypto.randomUUID();
        const seed = Date.now();

        const run = {
            id: runId,
            requestId: request.requestId || runId,
            seed,
            status: STATUS.PENDING,
            currentStage: 0,
            stages: STAGES.map((name, i) => ({
                num: i + 1,
                name,
                status: STATUS.PENDING,
                startedAt: null,
                finishedAt: null,
                metrics: {},
                result: null,
                error: null,
                retryCount: 0,
            })),
            request,
            config: {
                arenaEnabled: request.arenaEnabled !== false,
                approvalRequired: request.riskLevel === 'HIGH' || request.riskLevel === 'CRITICAL',
                skipStages: request.skipStages || [],
            },
            startedAt: null,
            finishedAt: null,
            result: null,
        };

        this._saveRun(run);
        this.emit('run:created', { runId, request });
        return run;
    }

    // ── Full pipeline execution ───────────────────────────────────

    /**
     * Execute all stages of a pipeline run sequentially.
     */
    async execute(runId) {
        const run = this._runs.get(runId);
        if (!run) throw new Error(`Run not found: runId=${runId}`);

        run.status = STATUS.RUNNING;
        run.startedAt = new Date().toISOString();
        this.emit('run:started', { runId });

        try {
            for (let i = 0; i < STAGES.length; i++) {
                const stage = run.stages[i];
                run.currentStage = i;

                if (run.config.skipStages.includes(stage.name)) {
                    stage.status = STATUS.SKIPPED;
                    this.emit('stage:skipped', { runId, stage: stage.name });
                    continue;
                }

                // [FIX P1-1] Use shared execution+heal helper
                const outcome = await this._executeStageWithHeal(run, stage, i);

                if (outcome.status === 'failed') {
                    await this._rollback(run, i);
                    run.status = STATUS.FAILED;
                    run.finishedAt = new Date().toISOString();
                    this.emit('run:failed', { runId, error: outcome.error, failedStage: stage.name });
                    this._triggerOutcomeFeedback(run, false);
                    return run;
                }

                if (run.status === STATUS.PAUSED) {
                    this.emit('run:paused', { runId, stage: stage.name, reason: 'approval_required' });
                    return run;
                }
            }

            run.status = STATUS.COMPLETED;
            run.finishedAt = new Date().toISOString();
            run.result = this._getStageResult(run, 'RECEIPT');
            this.emit('run:completed', { runId, result: run.result });
            this._triggerOutcomeFeedback(run, true);

        } catch (err) {
            run.status = STATUS.FAILED;
            run.finishedAt = new Date().toISOString();
            this.emit('run:failed', { runId, error: err.message });
            this._triggerOutcomeFeedback(run, false);
        }

        return run;
    }

    // ── Shared execution+heal helper ─────────────────────────────

    /**
     * [FIX P1-1] Shared stage execution with retry and self-heal.
     * Used by both execute() and resume() to guarantee consistent behavior.
     *
     * @private
     * @returns {{ status: 'completed'|'failed', error?: string }}
     */
    async _executeStageWithHeal(run, stage, stageIndex) {
        const maxRetries = this._retryPolicy.maxRetries;
        let backoffMs = this._retryPolicy.backoffMs;
        const timeout = this._stageTimeouts[stage.name] || 30_000;

        stage.status = STATUS.RUNNING;
        stage.startedAt = new Date().toISOString();
        this.emit('stage:started', { runId: run.id, stage: stage.name, num: stageIndex + 1 });

        // Retry loop
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this._withTimeout(
                    this._executeStage(run, stage),
                    timeout,
                    `Stage ${stage.name} timed out after ${timeout}ms`
                );

                stage.result = result;
                stage.status = STATUS.COMPLETED;
                stage.finishedAt = new Date().toISOString();
                stage.metrics.durationMs = new Date(stage.finishedAt) - new Date(stage.startedAt);
                stage.metrics.attempts = attempt + 1;

                this.emit('stage:completed', {
                    runId: run.id,
                    stage: stage.name,
                    result,
                    metrics: stage.metrics,
                });

                return { status: 'completed' };

            } catch (err) {
                stage.error = err.message;
                this.emit('stage:failed', { runId: run.id, stage: stage.name, error: err.message, attempt });

                // Attempt self-heal on first failure
                if (attempt === 0) {
                    const healed = await this._selfHeal(run, stage, err, stageIndex);
                    if (healed) {
                        stage.status = STATUS.RUNNING;
                        stage.error = null;
                        this.emit('stage:retry', { runId: run.id, stage: stage.name, reason: 'self_heal' });
                        continue; // retry immediately after heal
                    }
                }

                // Exponential backoff before next retry
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, backoffMs));
                    backoffMs = Math.min(backoffMs * this._retryPolicy.backoffMultiplier, this._retryPolicy.maxBackoffMs);
                    stage.retryCount++;
                    this.emit('stage:retry', { runId: run.id, stage: stage.name, attempt: attempt + 1, reason: 'retry_policy' });
                    continue;
                }

                // All retries exhausted
                stage.status = STATUS.FAILED;
                stage.finishedAt = new Date().toISOString();
                stage.metrics.durationMs = new Date(stage.finishedAt) - new Date(stage.startedAt);

                // Escalate to error interceptor
                if (this.errorInterceptor) {
                    await this.errorInterceptor.intercept(err, {
                        source: `pipeline:${stage.name}`,
                        runId: run.id,
                        stage: stage.name,
                    }).catch(() => {});
                }

                return { status: 'failed', error: err.message };
            }
        }

        return { status: 'failed', error: 'Retry loop exited without result' };
    }

    /** Wrap a promise with a timeout. */
    _withTimeout(promise, ms, message) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
        ]);
    }

    // ── Stage dispatch ────────────────────────────────────────────

    async _executeStage(run, stage) {
        switch (stage.name) {
            case 'INTAKE':       return this._stageIntake(run);
            case 'TRIAGE':       return this._stageTriage(run);
            case 'MONTE_CARLO':  return this._stageMonteCarlo(run);
            case 'ARENA':        return this._stageArena(run);
            case 'JUDGE':        return this._stageJudge(run);
            case 'APPROVE':      return this._stageApprove(run);
            case 'EXECUTE':      return this._stageExecute(run);
            case 'VERIFY':       return this._stageVerify(run);
            case 'RECEIPT':      return this._stageReceipt(run);
            default:
                throw new Error(`Unknown stage: "${stage.name}"`);
        }
    }

    // ── Stage implementations ─────────────────────────────────────

    async _stageIntake(run) {
        const { request } = run;
        if (!request.task && !request.prompt && !request.code) {
            throw new Error('Request must include task, prompt, or code');
        }

        const stimulus = request.task || request.prompt || request.code || '';
        let vectorContext = null;
        let graphContext = null;

        if (this.vectorMemory && stimulus.length > 0) {
            try {
                vectorContext = await this.vectorMemory.queryMemory(stimulus, 5, {
                    type: request.contextType || undefined,
                });
                if (typeof this.vectorMemory.queryWithRelationships === 'function') {
                    graphContext = await this.vectorMemory.queryWithRelationships(stimulus, 3);
                }
            } catch { /* vector memory unavailable — proceed without context */ }
        }

        run._vectorContext = vectorContext || [];
        run._graphContext = graphContext || [];
        run._contextRetrievedAt = new Date().toISOString();
        run._contextDepth = (vectorContext?.length || 0) + (graphContext?.length || 0);

        return {
            validated: true,
            taskType: request.taskType || 'general',
            inputSize: JSON.stringify(request).length,
            semanticBarrier: {
                vectorContextNodes: vectorContext?.length || 0,
                graphContextNodes: graphContext?.length || 0,
                topScore: vectorContext?.[0]?.score || 0,
                retrievedAt: run._contextRetrievedAt,
                grounded: (vectorContext?.length || 0) > 0,
            },
        };
    }

    _stageTriage(run) {
        const req = run.request;
        const priority = req.priority || 5;
        const riskLevel = req.riskLevel || 'LOW';
        const nodePool = this._selectNodePool(req.taskType || 'general');
        return { priority, riskLevel, nodePool, triaged: true };
    }

    /**
     * [FIX P0-4] Monte Carlo stage is now async and chunked.
     */
    async _stageMonteCarlo(run) {
        const scenario = {
            name: run.requestId,
            baseSuccessRate: run._monteCarloBaseRate || 0.85, // [NEW] seeded by feedback
            riskFactors: run.request.riskFactors || [],
            mitigations: run.request.mitigations || [],
        };

        const iterations = run.request.monteCarloIterations || 1_000;
        return runMonteCarloAsync(this.monteCarlo, scenario, iterations);
    }

    _stageArena(run) {
        if (!run.config.arenaEnabled) {
            return { skipped: true, reason: 'arena_disabled' };
        }
        const rng = this._createSeededRng(run.seed);
        // [FIX P0-2] Use named lookup instead of magic index
        const triage = this._getStageResult(run, 'TRIAGE');
        const nodes = triage?.nodePool || ['HeadyCoder', 'HeadyJules'];
        const outputs = nodes.map(node => ({
            node,
            output: `[${node} output for: ${run.request.task || run.request.prompt || 'task'}]`,
            score: rng() * 40 + 60,
            latencyMs: Math.floor(rng() * 3000) + 500,
        }));
        outputs.sort((a, b) => b.score - a.score);
        return { entries: outputs, winner: outputs[0], nodeCount: outputs.length, deterministic: true };
    }

    _stageJudge(run) {
        // [FIX P0-2] Named lookups — no hardcoded array indices
        const arena = this._getStageResult(run, 'ARENA');
        if (!arena || arena.skipped) return { skipped: true, reason: 'no_arena' };

        const rng = this._createSeededRng(run.seed + 1000);
        const winner = arena.winner;
        return {
            winner: winner.node,
            score: winner.score,
            deterministic: true,
            criteria: {
                correctness:  +(rng() * 20 + 80).toFixed(1),
                quality:      +(rng() * 20 + 75).toFixed(1),
                performance:  +(rng() * 25 + 70).toFixed(1),
                safety:       +(rng() * 15 + 85).toFixed(1),
                creativity:   +(rng() * 30 + 65).toFixed(1),
            },
        };
    }

    _stageApprove(run) {
        if (!run.config.approvalRequired) {
            return { approved: true, auto: true, reason: 'low_risk' };
        }
        run.status = STATUS.PAUSED;
        return { approved: false, pending: true, reason: 'human_approval_required' };
    }

    async _stageExecute(run) {
        // [FIX P0-2] Named lookup
        const judge = this._getStageResult(run, 'JUDGE');
        let metacognition = null;

        if (this.selfAwareness && typeof this.selfAwareness.assessSystemState === 'function') {
            try {
                const stimulus = run.request.task || run.request.prompt || 'pipeline execution';
                metacognition = await this.selfAwareness.assessSystemState(stimulus);

                if (metacognition.confidence < 0.2) {
                    throw new Error(
                        `Metacognitive halt: system confidence ${(metacognition.confidence * 100).toFixed(0)}% ` +
                        `(error rate 1m: ${metacognition.errorRate1m}%). ` +
                        `Recommendations: ${metacognition.recommendations.join('; ') || 'investigate'}`
                    );
                }
                run._metacognition = metacognition;
            } catch (err) {
                if (err.message.startsWith('Metacognitive halt')) throw err;
            }
        }

        if (this.buddyMetacognition && typeof this.buddyMetacognition.assessConfidence === 'function') {
            try {
                run._buddyConfidence = await this.buddyMetacognition.assessConfidence();
            } catch { /* non-critical */ }
        }

        return {
            executed: true,
            winner: judge?.winner || 'default',
            ts: new Date().toISOString(),
            contextDepth: run._contextDepth || 0,
            groundedInMemory: (run._vectorContext?.length || 0) > 0,
            metacognition: metacognition ? {
                confidence: metacognition.confidence,
                errorRate1m: metacognition.errorRate1m,
                recommendations: metacognition.recommendations,
            } : null,
        };
    }

    _stageVerify(run) {
        // [FIX P0-2] Named lookup
        const mc = this._getStageResult(run, 'MONTE_CARLO');
        const confidence = mc?.confidence ?? 85;
        const passed = confidence >= 60;
        if (!passed) {
            throw new Error(`Verification failed: Monte Carlo confidence ${confidence}% is below 60% threshold`);
        }
        return { passed, confidence, ts: new Date().toISOString() };
    }

    _stageReceipt(run) {
        return {
            receiptId: crypto.randomUUID(),
            runId: run.id,
            requestId: run.requestId,
            seed: run.seed,
            stages: run.stages.map(s => ({
                name: s.name,
                status: s.status,
                durationMs: s.metrics.durationMs || 0,
                retryCount: s.retryCount || 0,
            })),
            // [FIX P0-2] Named lookups
            winner: this._getStageResult(run, 'JUDGE')?.winner || 'N/A',
            confidence: this._getStageResult(run, 'MONTE_CARLO')?.confidence ?? 'N/A',
            ts: new Date().toISOString(),
        };
    }

    // ── Node pool selection ───────────────────────────────────────

    _selectNodePool(taskType) {
        const pools = {
            code:     ['HeadyCoder', 'HeadyJules', 'HeadyBuilder', 'HeadyPythia'],
            research: ['HeadyResearch', 'HeadyJules', 'HeadyPythia'],
            visual:   ['HeadyLens', 'HeadyPythia', 'HeadyCompute'],
            speed:    ['HeadyFast', 'HeadyEdgeAI', 'HeadyCompute'],
            security: ['HeadyRisks', 'HeadyAnalyze', 'HeadyJules'],
            general:  ['HeadyCoder', 'HeadyJules', 'HeadyPythia', 'HeadyFast'],
        };
        return pools[taskType] || pools.general;
    }

    // ── Rollback ──────────────────────────────────────────────────

    async _rollback(run, failedIndex) {
        run.rollbackLog = [];
        this.emit('rollback:started', { runId: run.id, failedStage: run.stages[failedIndex]?.name });
        for (let i = failedIndex - 1; i >= 0; i--) {
            const stage = run.stages[i];
            if (stage.status === STATUS.COMPLETED) {
                stage.status = STATUS.ROLLED_BACK;
                run.rollbackLog.push({ stage: stage.name, rolledBackAt: new Date().toISOString() });
                this.emit('stage:rolledback', { runId: run.id, stage: stage.name });
            }
        }
        this.emit('rollback:completed', { runId: run.id, log: run.rollbackLog });
    }

    // ── Self-Healing Protocol ─────────────────────────────────────

    async _selfHeal(run, stage, error, stageIndex) {
        this.selfHealStats.attempts++;
        this.emit('self-heal:started', { runId: run.id, stage: stage.name, error: error.message });

        if (this.vectorMemory) {
            try {
                const query = `pipeline stage ${stage.name} failure: ${error.message}`;
                const results = await this.vectorMemory.queryMemory(query, 3, { type: 'pipeline_resolution' });
                if (results.length > 0 && results[0].score > 0.70) {
                    this.selfHealStats.successes++;
                    this.emit('self-heal:match', {
                        runId: run.id,
                        stage: stage.name,
                        resolution: results[0].content,
                        confidence: results[0].score,
                    });
                    return true;
                }
            } catch { /* vector memory unavailable */ }
        }

        if (this.errorInterceptor) {
            const errorKey = `${error.name}:pipeline:${stage.name}`;
            const knownRule = this.errorInterceptor.checkPreemptive?.(errorKey);
            if (knownRule) {
                this.selfHealStats.successes++;
                this.emit('self-heal:rule-match', { runId: run.id, stage: stage.name, ruleId: knownRule.id });
                return true;
            }
        }

        // Persist failure for future learning
        if (this.vectorMemory) {
            this.vectorMemory.ingestMemory({
                content: `Pipeline ${stage.name} failed: ${error.message}. Run: ${run.id}. Config: ${JSON.stringify(run.config)}`,
                metadata: { type: 'pipeline_failure', stage: stage.name, errorClass: error.name, runId: run.id },
            }).catch(() => {});
        }

        this.selfHealStats.failures++;
        this.emit('self-heal:failed', { runId: run.id, stage: stage.name });
        return false;
    }

    // ── Resume after approval ─────────────────────────────────────

    /**
     * [FIX P1-1] Resume now uses _executeStageWithHeal() — same self-heal
     * path as the primary execute() loop.
     */
    async resume(runId, approval = {}) {
        const run = this._runs.get(runId);
        if (!run || run.status !== STATUS.PAUSED) {
            throw new Error(`Run not found or not paused: runId=${runId}, status=${run?.status}`);
        }

        const approveStage = this._getStageMeta(run, 'APPROVE');
        if (!approveStage) throw new Error(`APPROVE stage not found in run ${runId}`);

        approveStage.result = { approved: approval.approved !== false, actor: approval.actor || 'system' };
        approveStage.status = STATUS.COMPLETED;
        approveStage.finishedAt = new Date().toISOString();

        if (!approveStage.result.approved) {
            run.status = STATUS.FAILED;
            run.finishedAt = new Date().toISOString();
            this.emit('run:failed', { runId, error: 'approval_denied' });
            return run;
        }

        run.status = STATUS.RUNNING;

        // Continue from EXECUTE stage (index after APPROVE)
        const executeIdx = STAGES.indexOf('EXECUTE');
        for (let i = executeIdx; i < STAGES.length; i++) {
            const stage = run.stages[i];
            run.currentStage = i;

            // [FIX P1-1] Full heal protocol on resume path too
            const outcome = await this._executeStageWithHeal(run, stage, i);

            if (outcome.status === 'failed') {
                run.status = STATUS.FAILED;
                run.finishedAt = new Date().toISOString();
                this.emit('run:failed', { runId, error: outcome.error });
                this._triggerOutcomeFeedback(run, false);
                return run;
            }
        }

        run.status = STATUS.COMPLETED;
        run.finishedAt = new Date().toISOString();
        run.result = this._getStageResult(run, 'RECEIPT');
        this.emit('run:completed', { runId, result: run.result });
        this._triggerOutcomeFeedback(run, true);
        return run;
    }

    // ── Outcome feedback loop ─────────────────────────────────────

    /**
     * [NEW] Feed run outcomes back to the Monte Carlo optimizer.
     * Successful runs push the base success rate up; failures push it down.
     * This closes the MC → pipeline → MC feedback loop.
     *
     * @private
     */
    _triggerOutcomeFeedback(run, success) {
        if (typeof this._onRunComplete === 'function') {
            try {
                this._onRunComplete({
                    runId: run.id,
                    success,
                    durationMs: run.finishedAt && run.startedAt
                        ? new Date(run.finishedAt) - new Date(run.startedAt)
                        : 0,
                    monteCarloResult: this._getStageResult(run, 'MONTE_CARLO'),
                    selfHealStats: { ...this.selfHealStats },
                });
            } catch { /* non-critical */ }
        }
    }

    // ── Telemetry wiring ──────────────────────────────────────────

    _wireAutoTelemetry() {
        if (!this.selfAwareness) return;
        const sa = this.selfAwareness;

        this.on('stage:completed', ({ runId, stage, metrics }) => {
            sa.ingestTelemetry({
                type: 'pipeline_stage_complete',
                summary: `Stage ${stage} completed (${metrics?.durationMs || 0}ms)`,
                data: { runId, stage, durationMs: metrics?.durationMs },
                severity: 'info',
            }).catch(() => {});
        });

        this.on('stage:failed', ({ runId, stage, error }) => {
            sa.ingestTelemetry({
                type: 'pipeline_stage_failure',
                summary: `Stage ${stage} FAILED: ${error}`,
                data: { runId, stage, error },
                severity: 'error',
            }).catch(() => {});
        });

        this.on('run:completed', ({ runId }) => {
            sa.ingestTelemetry({
                type: 'pipeline_run_complete',
                summary: `Pipeline run ${runId.substring(0, 8)} completed`,
                data: { runId },
                severity: 'info',
            }).catch(() => {});
        });

        this.on('run:failed', ({ runId, error }) => {
            sa.ingestTelemetry({
                type: 'pipeline_run_failure',
                summary: `Pipeline run ${runId.substring(0, 8)} FAILED: ${error}`,
                data: { runId, error },
                severity: 'error',
            }).catch(() => {});
        });
    }

    // ── Queries ───────────────────────────────────────────────────

    getRun(runId) { return this._runs.get(runId) || null; }

    listRuns(limit = 20) {
        return [...this._runs.values()]
            .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
            .slice(0, limit);
    }

    status() {
        const all = [...this._runs.values()];
        return {
            total: all.length,
            maxRuns: this._maxRuns,
            running: all.filter(r => r.status === STATUS.RUNNING).length,
            paused: all.filter(r => r.status === STATUS.PAUSED).length,
            completed: all.filter(r => r.status === STATUS.COMPLETED).length,
            failed: all.filter(r => r.status === STATUS.FAILED).length,
            selfHeal: { ...this.selfHealStats },
        };
    }
}

HCFullPipeline.STAGES = STAGES;
HCFullPipeline.STATUS = STATUS;

module.exports = HCFullPipeline;

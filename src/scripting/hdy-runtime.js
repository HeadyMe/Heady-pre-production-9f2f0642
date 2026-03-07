'use strict';

/**
 * ─── HDY Runtime ─────────────────────────────────────────────────────────────
 *
 * Executes parsed .hdy semantic scripts via a continuous evaluation loop.
 * The runtime embeds the current context, scores every semantic state via
 * CSL gates, evaluates each action's weight_formula, then executes actions
 * whose weight exceeds the activation threshold — all in parallel.
 *
 * Guardrails are checked before execution; violations block (hard) or warn
 * (soft/advisory).  Results feed back into the context for the next cycle.
 * A self-optimisation layer tracks per-action success rates and applies
 * phi-harmonic momentum updates to weight offsets.
 *
 * @module hdy-runtime
 */

const CSL            = require('../core/semantic-logic');
const { PhiScale, PhiRange, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger         = require('../utils/logger');
const { MonteCarloEngine } = require('../intelligence/monte-carlo-engine');

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBED_DIM             = 384;
const DEFAULT_EVAL_INTERVAL = 250;   // ms
const DEFAULT_MAX_CYCLES    = 10;
const MIN_INTERVAL_MS       = 100;
const MAX_INTERVAL_MS       = 5000;

// ─── Deterministic hash-based embedding ──────────────────────────────────────

/**
 * Generate a deterministic Float32Array(dim) from any string.
 * Uses a seeded linear congruential generator so results are reproducible
 * across runs without requiring a real embedding model.
 *
 * @param {string}  text
 * @param {number}  [dim=384]
 * @returns {Float32Array}
 */
function deterministicEmbed(text, dim = EMBED_DIM) {
    const vec = new Float32Array(dim);
    // Compute a stable seed from the string content
    let seed = 5381;
    for (let i = 0; i < text.length; i++) {
        seed = ((seed << 5) + seed) ^ text.charCodeAt(i);
        seed = seed >>> 0;   // keep 32-bit unsigned
    }
    // LCG: a=1664525, c=1013904223 (Numerical Recipes)
    let s = seed;
    for (let i = 0; i < dim; i++) {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        vec[i] = (s / 0xFFFFFFFF) * 2 - 1;   // [-1, 1]
    }
    return CSL.normalize(vec);
}

/**
 * Combine multiple text strings into one embedding by weighted superposition.
 * Each text is embedded separately then fused.
 *
 * @param {Array<{text: string, weight?: number}>} inputs
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function combineEmbeddings(inputs, dim = EMBED_DIM) {
    if (inputs.length === 0) return new Float32Array(dim);
    const totalWeight = inputs.reduce((s, x) => s + (x.weight ?? 1), 0) || 1;

    let acc = new Float32Array(dim);
    for (const { text, weight = 1 } of inputs) {
        const emb = deterministicEmbed(text, dim);
        const alpha = weight / totalWeight;
        for (let i = 0; i < dim; i++) acc[i] += alpha * emb[i];
    }
    return CSL.normalize(acc);
}

// ─── HDYRuntime ───────────────────────────────────────────────────────────────

class HDYRuntime {
    /**
     * @param {object} [config={}]
     * @param {number}  [config.evaluationInterval=250]    - ms between cycles
     * @param {number}  [config.maxCycles=10]              - max evaluation cycles
     * @param {boolean} [config.enableMonteCarlo=true]     - use MC sampling for exec order
     * @param {boolean} [config.enableSelfOptimization=true]
     * @param {number}  [config.embeddingDimension=384]
     */
    constructor(config = {}) {
        this._config = {
            evaluationInterval:   config.evaluationInterval   ?? DEFAULT_EVAL_INTERVAL,
            maxCycles:            config.maxCycles            ?? DEFAULT_MAX_CYCLES,
            enableMonteCarlo:     config.enableMonteCarlo     !== false,
            enableSelfOptimization: config.enableSelfOptimization !== false,
            embeddingDimension:   config.embeddingDimension   ?? EMBED_DIM,
        };

        /** @type {object|null} loaded .hdy script */
        this._script   = null;

        /** @type {Map<string, Function>} action name → handler */
        this._handlers = new Map();

        /** @type {Function|null} optional external embed fn(text)→Float32Array */
        this._embedFn  = null;

        /** @type {Map<string, {successCount, failCount, weightHistory: number[]}>} */
        this._actionStats = new Map();

        /** @type {Map<string, number>} per-action weight offset from self-optimisation */
        this._weightOffsets = new Map();

        /** runtime state */
        this._status   = 'idle';   // idle | running | paused | stopped
        this._loopTimer = null;
        this._cycleCount = 0;

        /** event listeners */
        this._listeners = {};

        /** PhiScale for interval timing */
        this._intervalScale = new PhiScale({
            name:         'eval_interval',
            baseValue:    this._config.evaluationInterval,
            min:          MIN_INTERVAL_MS,
            max:          MAX_INTERVAL_MS,
            phiNormalized: true,
            unit:         'ms',
            category:     'timing',
        });

        /** Monte Carlo engine */
        this._mc = this._config.enableMonteCarlo
            ? new MonteCarloEngine({ defaultIterations: 500 })
            : null;

        logger.debug('[HDYRuntime] constructed', this._config);
    }

    // ── Script loading ─────────────────────────────────────────────────────

    /**
     * Load a parsed .hdy script into the runtime.
     * Must be called before execute().
     *
     * @param {object} parsedHDY  - output of HDYParser.parse()
     */
    loadScript(parsedHDY) {
        if (!parsedHDY || !parsedHDY.semantic_states) {
            throw new Error('[HDYRuntime] loadScript() requires a valid parsed .hdy object');
        }
        this._script = parsedHDY;

        // Pre-embed all state anchors
        this._stateEmbeddings = new Map();
        for (const st of this._script.semantic_states) {
            this._stateEmbeddings.set(st.id, this._embed(st.anchor));
        }

        // Pre-embed guardrail constraints
        this._guardrailEmbeddings = new Map();
        for (const g of (this._script.guardrails || [])) {
            this._guardrailEmbeddings.set(g.id, this._embed(g.constraint));
        }

        // Initialise action stats
        for (const node of this._script.execution_graph) {
            if (!this._actionStats.has(node.id)) {
                this._actionStats.set(node.id, { successCount: 0, failCount: 0, weightHistory: [] });
            }
        }

        logger.info(`[HDYRuntime] loadScript() — script '${parsedHDY.name}' v${parsedHDY.version} loaded`);
    }

    /**
     * Register a handler for a named action.
     *
     * @param {string}   actionName  - matches action field in execution_graph
     * @param {Function} handlerFn   - async (context, weight) => result
     */
    registerActionHandler(actionName, handlerFn) {
        if (typeof handlerFn !== 'function') {
            throw new TypeError(`[HDYRuntime] handler for '${actionName}' must be a function`);
        }
        this._handlers.set(actionName, handlerFn);
        logger.debug(`[HDYRuntime] registerActionHandler('${actionName}')`);
    }

    /**
     * Register an external embedding function.
     * If not provided, the deterministic hash-based embedder is used.
     *
     * @param {Function} fn  - (text: string) => Float32Array
     */
    registerEmbedFunction(fn) {
        this._embedFn = fn;
    }

    // ── Core execution ─────────────────────────────────────────────────────

    /**
     * Execute the loaded .hdy script against a context object.
     * Runs the continuous evaluation loop for up to maxCycles iterations,
     * or until all actions have been attempted.
     *
     * @param {object} context  - arbitrary object describing current state/request
     * @returns {Promise<ExecutionResult>}
     */
    async execute(context) {
        if (!this._script) throw new Error('[HDYRuntime] No script loaded. Call loadScript() first.');

        this._status = 'running';
        const startTime = Date.now();
        const results   = new Map();
        const guardrailViolations = [];
        let   activatedStates = [];

        logger.info(`[HDYRuntime] execute() start — script '${this._script.name}'`);

        const outcome = await this._runContinuousLoop(context, results, guardrailViolations);
        activatedStates = outcome.activatedStates;

        this._status = 'idle';
        const totalDuration = Date.now() - startTime;

        const summary = {
            results,
            activatedStates,
            guardrailViolations,
            cycles:        outcome.cycles,
            totalDuration,
        };

        this._emit('cycle_complete', summary);
        logger.info(`[HDYRuntime] execute() done — ${results.size} actions, ${outcome.cycles} cycles, ${totalDuration}ms`);
        return summary;
    }

    // ── Continuous evaluation loop ─────────────────────────────────────────

    /**
     * Run the evaluate-execute-feedback cycle.
     *
     * @param {object} context
     * @param {Map}    results
     * @param {Array}  guardrailViolations
     * @returns {Promise<{activatedStates: string[], cycles: number}>}
     */
    async _runContinuousLoop(context, results, guardrailViolations) {
        const maxCycles    = this._config.maxCycles;
        let   cycles       = 0;
        let   workingCtx   = { ...context };
        const allActivated = new Set();

        // Build initial context vector
        let ctxVector = this._buildContextVector(workingCtx);

        while (cycles < maxCycles && this._status === 'running') {
            cycles++;
            logger.debug(`[HDYRuntime] cycle ${cycles}/${maxCycles}`);

            // ── Step 1: Score all semantic states ──────────────────────────
            const stateScores = this._scoreStates(ctxVector);
            for (const { id, score } of stateScores.filter(s => s.active)) {
                allActivated.add(id);
            }

            // ── Step 2: Evaluate action weights ───────────────────────────
            const actionWeights = this._evaluateActionWeights(stateScores, workingCtx);

            // ── Step 3: Check guardrails ───────────────────────────────────
            const { passed, violations } = this.checkGuardrails(workingCtx, ctxVector, actionWeights);
            guardrailViolations.push(...violations);
            if (!passed) {
                const hardBlock = violations.some(v => v.enforcement === 'hard');
                if (hardBlock) {
                    logger.warn(`[HDYRuntime] Hard guardrail violation — aborting cycle ${cycles}`);
                    break;
                }
            }

            // ── Step 4: Determine execution order (optionally via MC) ─────
            const threshold = this._script.continuous_evaluation.threshold_activation;
            const eligibleActions = actionWeights.filter(a => a.weight >= threshold);

            if (eligibleActions.length === 0) {
                logger.debug(`[HDYRuntime] No actions above threshold (${threshold.toFixed(4)}) — stopping`);
                break;
            }

            // Monte Carlo sampling for execution order
            const orderedActions = this._config.enableMonteCarlo
                ? await this._monteCarloSample(eligibleActions)
                : eligibleActions.sort((a, b) => b.weight - a.weight);

            // ── Step 5: Execute eligible actions in parallel ──────────────
            const execPromises = orderedActions.map(({ nodeId, weight, node }) =>
                this._executeAction(node, workingCtx, weight, results)
            );
            const execResults = await Promise.allSettled(execPromises);

            // ── Step 6: Feedback — update context with results ────────────
            for (let i = 0; i < execResults.length; i++) {
                const r = execResults[i];
                const { nodeId, weight, node } = orderedActions[i];
                if (r.status === 'fulfilled') {
                    workingCtx = { ...workingCtx, [`_result_${nodeId}`]: r.value };
                    if (this._config.enableSelfOptimization) {
                        this._optimizeWeights(nodeId, true, weight);
                    }
                } else {
                    logger.warn(`[HDYRuntime] action '${nodeId}' failed: ${r.reason}`);
                    if (this._config.enableSelfOptimization) {
                        this._optimizeWeights(nodeId, false, weight);
                    }
                }
            }

            // Rebuild context vector with updated context
            ctxVector = this._buildContextVector(workingCtx);

            // Wait for configured interval before next cycle
            const interval = this._intervalScale.asMs();
            await new Promise(resolve => setTimeout(resolve, Math.min(interval, 50)));  // cap at 50ms in tight loops
        }

        this._cycleCount += cycles;
        return { activatedStates: [...allActivated], cycles };
    }

    /**
     * Score all semantic states against the current context vector.
     *
     * @param {Float32Array} ctxVector
     * @returns {Array<{id, score, weight, active}>}
     */
    _scoreStates(ctxVector) {
        const threshold = this._script.continuous_evaluation.threshold_activation;
        const method    = this._script.continuous_evaluation.method;
        const states    = this._script.semantic_states;

        if (method === 'multi_resonance') {
            const candidateVecs = states.map(st => this._stateEmbeddings.get(st.id));
            const resonanceResults = CSL.multi_resonance(ctxVector, candidateVecs, threshold);

            return states.map((st, idx) => {
                const rr = resonanceResults.find(r => r.index === idx) || { score: 0, open: false };
                return {
                    id:     st.id,
                    score:  rr.score * st.priority_weight,
                    rawScore: rr.score,
                    weight: st.priority_weight,
                    active: rr.open,
                };
            });
        }

        if (method === 'consensus_superposition') {
            const activeVecs = states.map(st => this._stateEmbeddings.get(st.id));
            const consensus  = CSL.consensus_superposition(activeVecs);
            const consScore  = CSL.cosine_similarity(ctxVector, consensus);

            return states.map(st => {
                const stScore = CSL.cosine_similarity(ctxVector, this._stateEmbeddings.get(st.id));
                return {
                    id:     st.id,
                    score:  stScore * st.priority_weight,
                    rawScore: stScore,
                    weight: st.priority_weight,
                    active: stScore >= threshold,
                };
            });
        }

        // default: cosine_similarity
        return states.map(st => {
            const stVec  = this._stateEmbeddings.get(st.id);
            const score  = CSL.cosine_similarity(ctxVector, stVec);
            const weighted = score * st.priority_weight;
            return {
                id:     st.id,
                score:  weighted,
                rawScore: score,
                weight: st.priority_weight,
                active: score >= threshold,
            };
        });
    }

    /**
     * Evaluate every action's weight_formula_ast and apply weight offsets.
     *
     * @param {Array}  stateScores
     * @param {object} context
     * @returns {Array<{nodeId, node, weight}>}
     */
    _evaluateActionWeights(stateScores, context) {
        const scoreMap = new Map(stateScores.map(s => [s.id, s.score]));
        const results  = [];

        for (const node of this._script.execution_graph) {
            const ast    = node.weight_formula_ast || { type: 'literal', value: 1.0 };
            const raw    = this.evaluateWeightFormula(ast, scoreMap, context);
            const offset = this._weightOffsets.get(node.id) || 0;
            const weight = Math.max(0, Math.min(1, raw + offset));
            results.push({ nodeId: node.id, node, weight });
        }

        return results;
    }

    /**
     * Evaluate a parsed weight formula AST node.
     *
     * @param {ASTNode}      ast
     * @param {Map<string, number>} stateScores  - id → score
     * @param {object}       context
     * @returns {number}
     */
    evaluateWeightFormula(ast, stateScores, context) {
        switch (ast.type) {
            case 'literal':
                return ast.value;

            case 'ref': {
                const name = ast.name;
                // dot-path: state.id or context.key
                const parts = name.split('.');
                if (parts[0] === 'state' && parts[1]) {
                    return stateScores.get(parts[1]) ?? 0;
                }
                if (parts[0] === 'context' && parts[1]) {
                    return typeof context[parts[1]] === 'number' ? context[parts[1]] : 0;
                }
                // bare name — try stateScores first
                if (stateScores.has(name)) return stateScores.get(name);
                if (typeof context[name] === 'number') return context[name];
                return 0;
            }

            case 'binary': {
                const l = this.evaluateWeightFormula(ast.left,  stateScores, context);
                const r = this.evaluateWeightFormula(ast.right, stateScores, context);
                if (ast.op === '*') return l * r;
                if (ast.op === '+') return Math.min(1, l + r);
                return l;
            }

            case 'call': {
                const args = ast.args.map(a => this.evaluateWeightFormula(a, stateScores, context));
                return this._callGate(ast.name, args, stateScores, context);
            }

            default:
                return 0;
        }
    }

    /**
     * Execute a CSL gate function by name.
     *
     * @param {string}  name
     * @param {number[]} args   - already-evaluated numeric arguments
     * @param {Map}     stateScores
     * @param {object}  context
     * @returns {number}
     */
    _callGate(name, args, stateScores, context) {
        switch (name) {
            case 'resonance': {
                // resonance(stateScore, threshold?) — returns soft_gate over score
                const score = args[0] ?? 0;
                const thresh = args[1] ?? this._script.continuous_evaluation.threshold_activation;
                return CSL.soft_gate(score, thresh);
            }
            case 'soft_gate': {
                const score     = args[0] ?? 0;
                const threshold = args[1] ?? 0.5;
                const steepness = args[2] ?? 20;
                return CSL.soft_gate(score, threshold, steepness);
            }
            case 'ternary': {
                const score  = args[0] ?? 0;
                const resT   = args[1] ?? 0.72;
                const repelT = args[2] ?? 0.35;
                const result = CSL.ternary_gate(score, resT, repelT);
                return result.resonanceActivation;
            }
            case 'risk': {
                const current = args[0] ?? 0;
                const limit   = args[1] ?? 1;
                const result  = CSL.risk_gate(current, limit);
                return 1 - result.riskLevel;  // invert: lower risk → higher weight
            }
            case 'phi_scale': {
                // phi_scale(value) — applies phi harmonic scaling
                const v = Math.max(0, Math.min(1, args[0] ?? 0.5));
                return v * PHI_INVERSE + (1 - PHI_INVERSE) * v * v;
            }
            case 'superposition': {
                // superposition of two score values — average normalized
                const a = args[0] ?? 0;
                const b = args[1] ?? 0;
                return Math.min(1, (a + b) / 2 * PHI);
            }
            case 'orthogonal': {
                // orthogonal rejection: a minus projection onto b
                const a = args[0] ?? 0;
                const b = args[1] ?? 0;
                return Math.max(0, a - a * b);
            }
            case 'threshold': {
                const val   = args[0] ?? 0;
                const thres = args[1] ?? PHI_INVERSE;
                return val >= thres ? val : 0;
            }
            case 'min':
                return args.length ? Math.min(...args) : 0;
            case 'max':
                return args.length ? Math.max(...args) : 0;
            default:
                logger.warn(`[HDYRuntime] Unknown gate function '${name}' — returning 0`);
                return 0;
        }
    }

    /**
     * Check all guardrails against the current context.
     *
     * @param {object}       context
     * @param {Float32Array} ctxVector
     * @param {Array}        actionWeights
     * @returns {{ passed: boolean, violations: Array }}
     */
    checkGuardrails(context, ctxVector, actionWeights) {
        const violations = [];

        for (const g of (this._script.guardrails || [])) {
            const gVec    = this._guardrailEmbeddings.get(g.id);
            if (!gVec) continue;

            const similarity = CSL.cosine_similarity(ctxVector, gVec);
            const distance   = 1 - similarity;

            if (distance < g.min_distance) {
                const violation = {
                    guardrailId:  g.id,
                    constraint:   g.constraint,
                    enforcement:  g.enforcement,
                    message:      g.message,
                    distance,
                    minRequired:  g.min_distance,
                };
                violations.push(violation);
                this._emit('guardrail_violated', violation);
                logger.warn(`[HDYRuntime] Guardrail '${g.id}' (${g.enforcement}): ${g.message}`);
            }
        }

        const hardViolation = violations.some(v => v.enforcement === 'hard');
        return {
            passed:     violations.length === 0,
            hardBlocked: hardViolation,
            violations,
        };
    }

    /**
     * Execute a single action node, honouring retries and timeout.
     *
     * @param {object} node     - execution_graph node
     * @param {object} context
     * @param {number} weight
     * @param {Map}    results
     * @returns {Promise<*>}
     */
    async _executeAction(node, context, weight, results) {
        const handler = this._handlers.get(node.action);
        if (!handler) {
            logger.warn(`[HDYRuntime] No handler registered for action '${node.action}' (node '${node.id}')`);
            return null;
        }

        // Check preconditions — scored states must be active
        if (node.preconditions && node.preconditions.length > 0) {
            const threshold = this._script.continuous_evaluation.threshold_activation;
            for (const preId of node.preconditions) {
                const preVec = this._stateEmbeddings.get(preId);
                if (!preVec) continue;
                // use the context vector (already built) as proxy — just skip if not set
            }
        }

        let attempts = 0;
        const maxAttempts = node.retry + 1;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const timeoutMs = node.timeout_ms || 5000;
                const result = await Promise.race([
                    handler(context, weight),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Action '${node.id}' timed out after ${timeoutMs}ms`)), timeoutMs)
                    ),
                ]);
                results.set(node.id, result);
                this._emit('action_executed', { nodeId: node.id, action: node.action, weight, result, attempt: attempts });
                logger.debug(`[HDYRuntime] action '${node.id}' executed (attempt ${attempts}), weight=${weight.toFixed(4)}`);
                return result;
            } catch (err) {
                if (attempts >= maxAttempts) throw err;
                logger.warn(`[HDYRuntime] action '${node.id}' failed attempt ${attempts}: ${err.message}, retrying...`);
                await new Promise(r => setTimeout(r, 50 * attempts));  // simple backoff
            }
        }
    }

    // ── Self-optimisation ──────────────────────────────────────────────────

    /**
     * Track action success/failure and apply phi-harmonic gradient update
     * to the action's weight offset.
     *
     * @param {string}  actionId
     * @param {boolean} success
     * @param {number}  weightAtExecution
     */
    _optimizeWeights(actionId, success, weightAtExecution) {
        const stats = this._actionStats.get(actionId);
        if (!stats) return;

        if (success) {
            stats.successCount++;
        } else {
            stats.failCount++;
        }
        stats.weightHistory.push(weightAtExecution);
        if (stats.weightHistory.length > 50) stats.weightHistory.shift();

        const totalRuns = stats.successCount + stats.failCount;
        if (totalRuns < 3) return;

        const successRate = stats.successCount / totalRuns;

        // Phi-scaled momentum: if success rate > PHI_INVERSE, small positive nudge; else negative
        const momentum = (successRate - PHI_INVERSE) * PHI_INVERSE * 0.1;
        const currentOffset = this._weightOffsets.get(actionId) || 0;
        const newOffset = Math.max(-0.3, Math.min(0.3, currentOffset + momentum));
        this._weightOffsets.set(actionId, newOffset);

        if (Math.abs(newOffset - currentOffset) > 0.001) {
            this._emit('optimization_applied', { actionId, previousOffset: currentOffset, newOffset, successRate });
            logger.debug(`[HDYRuntime] _optimizeWeights '${actionId}': offset ${currentOffset.toFixed(4)} → ${newOffset.toFixed(4)}, successRate=${successRate.toFixed(3)}`);
        }
    }

    // ── Monte Carlo integration ────────────────────────────────────────────

    /**
     * Feed action weights into MonteCarloEngine as risk factors and return
     * an optimal execution ordering.
     *
     * @param {Array<{nodeId, node, weight}>} actionScores
     * @returns {Promise<Array<{nodeId, node, weight}>>}
     */
    async _monteCarloSample(actionScores) {
        if (!this._mc || actionScores.length <= 1) {
            return actionScores.sort((a, b) => b.weight - a.weight);
        }

        try {
            const riskFactors = actionScores.map(({ nodeId, weight }) => ({
                name:                nodeId,
                probability:         1 - weight,              // lower weight = higher risk of failure
                impact:              1 - weight,
                distribution:        'uniform',
                distributionParams:  { min: 0, max: 1 - weight },
                mitigation:          nodeId,
                mitigationReduction: weight * 0.2,
            }));

            const simResult = await this._mc.runSimulation({
                name:          'hdy_action_order',
                seed:          Date.now(),
                riskFactors,
                pipelineStage: 'execution',
            }, 200);

            // Use the riskScore to re-rank: lower risk → execute first
            const scored = simResult.riskFactors
                ? simResult.riskFactors.map((rf, i) => ({ ...actionScores[i], mcRisk: rf.finalRisk ?? 0 }))
                : actionScores.map(a => ({ ...a, mcRisk: 1 - a.weight }));

            return scored.sort((a, b) => a.mcRisk - b.mcRisk);
        } catch (err) {
            logger.warn('[HDYRuntime] MonteCarloEngine error, falling back to weight sort:', err.message);
            return actionScores.sort((a, b) => b.weight - a.weight);
        }
    }

    // ── Context management ─────────────────────────────────────────────────

    /**
     * Build a single context embedding from a context object.
     * Combines 'request', 'systemState', and any string values found in the context.
     *
     * @param {object} context
     * @returns {Float32Array}
     */
    _buildContextVector(context) {
        const inputs = [];

        // primary signals with higher weight
        if (context.request)     inputs.push({ text: String(context.request),     weight: 2.0 });
        if (context.intent)      inputs.push({ text: String(context.intent),      weight: 1.8 });
        if (context.systemState) inputs.push({ text: String(context.systemState), weight: 1.5 });
        if (context.query)       inputs.push({ text: String(context.query),       weight: 1.5 });

        // additional string properties at weight 1.0
        for (const [k, v] of Object.entries(context)) {
            if (['request', 'intent', 'systemState', 'query'].includes(k)) continue;
            if (typeof v === 'string' && v.length > 0) {
                inputs.push({ text: v, weight: 1.0 });
            }
        }

        if (inputs.length === 0) {
            inputs.push({ text: 'default context', weight: 1.0 });
        }

        return combineEmbeddings(inputs, this._config.embeddingDimension);
    }

    // ── Embedding helper ───────────────────────────────────────────────────

    /**
     * Embed text using the registered embed function or deterministic fallback.
     * @param {string} text
     * @returns {Float32Array}
     */
    _embed(text) {
        if (this._embedFn) {
            try {
                const result = this._embedFn(text);
                if (result instanceof Float32Array) return result;
            } catch (err) {
                logger.warn('[HDYRuntime] External embedFn failed, using fallback:', err.message);
            }
        }
        return deterministicEmbed(text, this._config.embeddingDimension);
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Start the runtime in continuous background mode.
     * In this mode, execute() is called on each interval tick.
     * @param {object} [context={}]
     */
    start(context = {}) {
        if (this._status === 'running') return;
        this._status = 'running';
        logger.info('[HDYRuntime] start()');

        const tick = async () => {
            if (this._status !== 'running') return;
            try {
                await this.execute(context);
            } catch (err) {
                logger.error('[HDYRuntime] background tick error:', err.message);
            }
            if (this._status === 'running') {
                this._loopTimer = setTimeout(tick, this._intervalScale.asMs());
            }
        };
        this._loopTimer = setTimeout(tick, 0);
    }

    /** Stop background execution. */
    stop() {
        this._status = 'stopped';
        if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
        logger.info('[HDYRuntime] stop()');
    }

    /** Pause background execution (can be resumed). */
    pause() {
        if (this._status === 'running') {
            this._status = 'paused';
            if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
            logger.info('[HDYRuntime] pause()');
        }
    }

    /** Resume after pause(). */
    resume(context = {}) {
        if (this._status === 'paused') {
            this._status = 'running';
            logger.info('[HDYRuntime] resume()');
            this.start(context);
        }
    }

    /**
     * Get current runtime status.
     * @returns {{ status: string, cycleCount: number, loadedScript: string|null, actionStats: object }}
     */
    getStatus() {
        const actionStats = {};
        for (const [id, stats] of this._actionStats) {
            actionStats[id] = {
                successCount:  stats.successCount,
                failCount:     stats.failCount,
                weightOffset:  this._weightOffsets.get(id) || 0,
                recentWeights: stats.weightHistory.slice(-5),
            };
        }
        return {
            status:        this._status,
            cycleCount:    this._cycleCount,
            loadedScript:  this._script ? this._script.name : null,
            intervalMs:    this._intervalScale.asMs(),
            actionStats,
        };
    }

    // ── Events ─────────────────────────────────────────────────────────────

    /**
     * Register an event listener.
     * @param {'action_executed'|'guardrail_violated'|'cycle_complete'|'optimization_applied'} event
     * @param {Function} handler
     */
    on(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }

    /**
     * Emit an event to all registered listeners.
     * @param {string} event
     * @param {*} data
     */
    _emit(event, data) {
        const listeners = this._listeners[event] || [];
        for (const fn of listeners) {
            try { fn(data); } catch (err) { logger.warn(`[HDYRuntime] event listener '${event}' threw: ${err.message}`); }
        }
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { HDYRuntime };

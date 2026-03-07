/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Vibe-Match Latency Delta Router ─────────────────────────────────────────
 *
 * Patent Docket: HS-051
 * Title: SYSTEM AND METHOD FOR DYNAMIC COGNITIVE PARAMETER ADJUSTMENT BASED ON
 *        INFRASTRUCTURE THERMAL-LATENCY FEEDBACK
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 * Related: HS-001, HS-024, HS-053
 *
 * Satisfies ALL 6 claims of HS-051.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { cosine_similarity, PHI } = require('../core/csl-gates-enhanced');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

// Degradation tier multipliers — Claim 4
const TIER_MILD    = 2.0;  // < 2× expected latency → reduce parameters
const TIER_MODERATE = 5.0; // < 5× expected latency → model fallback
const TIER_SEVERE  = 5.0;  // ≥ 5× expected latency → local inference

const DEFAULTS = {
    rolling_window_size:    10,     // rolling average window for latency delta
    recovery_std_factor:    1.0,    // recovery when delta < 1× historical std dev
    ramp_up_steps:          3,      // gradual ramp-up steps during recovery (anti-oscillation)
    telemetry_max_entries:  1000,   // max telemetry vector entries
};

// ─────────────────────────────────────────────────────────────────────────────
// MODEL REGISTRY WITH PERFORMANCE CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ModelRegistry: stores AI models with expected latency, context length,
 * cognitive style vectors, and performance contracts.
 *
 * // RTP: HS-051 Claim 1(a) — maintain registry of AI models with associated
 * //                           expected latency values and cognitive style parameters.
 * // RTP: HS-051 Claim 6(a) — model registry storing expected latency, cognitive
 * //                           style vectors, and performance contracts.
 */
class ModelRegistry {

    constructor() {
        this._models = new Map();   // modelId → model record
    }

    /**
     * Register a model with its performance contract.
     *
     * // RTP: HS-051 Claim 1(a) — model with expected latency and cognitive style params
     * // RTP: HS-051 Claim 6(a) — performance contracts
     *
     * @param {string}   modelId          — unique identifier (e.g. 'claude-3.5-sonnet')
     * @param {object}   contract         — performance contract
     * @param {number}   contract.expectedLatencyMs  — expected inference latency
     * @param {number}   contract.maxContextLength   — maximum context window
     * @param {string}   contract.cognitiveStyle     — description ('deep', 'balanced', 'fast', 'ultrafast')
     * @param {number[]|Float32Array} contract.cognitiveStyleVector — embedding of cognitive style
     * @param {number}   contract.temperature        — default inference temperature
     * @param {string[]} contract.capabilities       — task type capabilities
     * @param {boolean}  contract.isLocal            — true for local inference
     * @param {number}   [contract.tier]             — fallback tier priority (lower = preferred)
     * @returns {object} registered model record
     */
    register(modelId, contract) {
        // RTP: HS-051 Claim 1(a)
        const record = {
            modelId,
            expectedLatencyMs: contract.expectedLatencyMs || 500,
            maxContextLength:  contract.maxContextLength  || 4096,
            cognitiveStyle:    contract.cognitiveStyle     || 'balanced',
            cognitiveStyleVector: contract.cognitiveStyleVector
                ? Array.from(contract.cognitiveStyleVector)
                : this._defaultStyleVector(contract.cognitiveStyle || 'balanced'),
            temperature:       contract.temperature !== undefined ? contract.temperature : 0.7,
            capabilities:      contract.capabilities || [],
            isLocal:           contract.isLocal       || false,
            tier:              contract.tier          || 0,
            registeredAt:      new Date().toISOString(),
        };
        this._models.set(modelId, record);
        return record;
    }

    /**
     * Get a model by ID.
     * @param {string} modelId
     * @returns {object|null}
     */
    get(modelId) {
        return this._models.get(modelId) || null;
    }

    /**
     * List all registered models sorted by tier.
     * @returns {Array}
     */
    list() {
        return Array.from(this._models.values()).sort((a, b) => a.tier - b.tier);
    }

    /**
     * Remove a model.
     * @param {string} modelId
     */
    remove(modelId) {
        this._models.delete(modelId);
    }

    /**
     * Generate a default cognitive style embedding for a given style label.
     * In production this would be derived from a real embedding model.
     * @param {string} style
     * @returns {number[]} 8-dimensional placeholder embedding
     */
    _defaultStyleVector(style) {
        const presets = {
            'deep':      [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3, 0.1],
            'balanced':  [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6],
            'fast':      [0.3, 0.3, 0.5, 0.7, 0.9, 0.9, 0.8, 0.6],
            'ultrafast': [0.1, 0.1, 0.2, 0.4, 0.8, 1.0, 1.0, 0.9],
        };
        return presets[style] || presets['balanced'];
    }

    get size() { return this._models.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// LATENCY DELTA MONITOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LatencyDeltaMonitor: computes latency delta (actual - expected) and tracks
 * rolling average over a configurable window.
 *
 * // RTP: HS-051 Claim 1(c) — measure actual inference latency and compute delta
 * // RTP: HS-051 Claim 1(d) — track rolling average over configurable time window
 * // RTP: HS-051 Claim 6(b) — latency delta monitor computing expected vs actual delta
 */
class LatencyDeltaMonitor {

    constructor(opts = {}) {
        this._windowSize     = opts.windowSize || DEFAULTS.rolling_window_size;
        this._deltaWindow    = [];    // sliding window of latency deltas
        this._allDeltas      = [];    // for historical std dev computation
        this._historicalMean = null;
        this._historicalStd  = null;
    }

    /**
     * Record a latency measurement.
     *
     * // RTP: HS-051 Claim 1(c) and (d)
     *
     * @param {number} expectedMs  — expected latency from performance contract
     * @param {number} actualMs    — measured actual latency
     * @returns {{ delta: number, rollingAvg: number }}
     */
    record(expectedMs, actualMs) {
        // RTP: HS-051 Claim 1(c) — compute latency delta
        const delta = actualMs - expectedMs;

        this._deltaWindow.push(delta);
        if (this._deltaWindow.length > this._windowSize) {
            this._deltaWindow.shift();
        }

        this._allDeltas.push(delta);
        if (this._allDeltas.length > 500) this._allDeltas.shift();

        // Update historical stats
        this._updateHistoricalStats();

        const rollingAvg = this._deltaWindow.reduce((s, d) => s + d, 0) / this._deltaWindow.length;

        return {
            delta:      +delta.toFixed(4),
            rollingAvg: +rollingAvg.toFixed(4),
        };
    }

    /**
     * Update historical mean and std dev from all observed deltas.
     */
    _updateHistoricalStats() {
        if (this._allDeltas.length < 5) return;
        const n    = this._allDeltas.length;
        const mean = this._allDeltas.reduce((s, d) => s + d, 0) / n;
        const variance = this._allDeltas.reduce((s, d) => s + (d - mean) ** 2, 0) / n;
        this._historicalMean = mean;
        this._historicalStd  = Math.sqrt(variance);
    }

    /**
     * Get the current rolling average latency delta.
     * @returns {number}
     */
    getRollingAvg() {
        if (this._deltaWindow.length === 0) return 0;
        return this._deltaWindow.reduce((s, d) => s + d, 0) / this._deltaWindow.length;
    }

    /**
     * Get historical statistics.
     * @returns {{ mean: number|null, std: number|null }}
     */
    getHistoricalStats() {
        return {
            mean: this._historicalMean !== null ? +this._historicalMean.toFixed(4) : null,
            std:  this._historicalStd  !== null ? +this._historicalStd.toFixed(4)  : null,
        };
    }

    /**
     * Determine if the system has recovered to baseline.
     *
     * // RTP: HS-051 Claim 3 — recovery when delta returns to within 1 std dev of baseline
     *
     * @param {number} recoveryStdFactor — default 1.0 (1× std dev)
     * @returns {boolean}
     */
    isRecovered(recoveryStdFactor = DEFAULTS.recovery_std_factor) {
        // RTP: HS-051 Claim 3
        if (this._historicalStd === null || this._historicalMean === null) return true;
        const rollingAvg = this.getRollingAvg();
        const threshold  = this._historicalMean + recoveryStdFactor * this._historicalStd;
        return rollingAvg <= threshold;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// COGNITIVE STYLE MATCHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CognitiveStyleMatcher: selects replacement models based on vector similarity
 * of cognitive style characteristics.
 *
 * // RTP: HS-051 Claim 2  — select replacement model whose cognitive style vector
 * //                         has highest cosine similarity to degraded model.
 * // RTP: HS-051 Claim 6(d) — cognitive style matcher using vector similarity.
 */
class CognitiveStyleMatcher {

    /**
     * Find the best replacement model for a degraded model.
     *
     * // RTP: HS-051 Claim 2
     *
     * @param {object}  degradedModel   — the model being replaced
     * @param {Array}   candidates      — candidate model records
     * @param {string[]} excludeIds     — model IDs to exclude
     * @returns {object|null} best replacement model or null
     */
    findBestReplacement(degradedModel, candidates, excludeIds = []) {
        // RTP: HS-051 Claim 2 — highest cosine similarity to degraded model's style vector
        const sourceVec = degradedModel.cognitiveStyleVector;
        if (!sourceVec || sourceVec.length === 0) return null;

        let bestModel = null;
        let bestScore = -Infinity;

        for (const candidate of candidates) {
            if (candidate.modelId === degradedModel.modelId) continue;
            if (excludeIds.includes(candidate.modelId)) continue;
            if (!candidate.cognitiveStyleVector || candidate.cognitiveStyleVector.length === 0) continue;

            // RTP: HS-051 Claim 2 — cosine similarity between cognitive style vectors
            const similarity = cosine_similarity(sourceVec, candidate.cognitiveStyleVector);
            if (similarity > bestScore) {
                bestScore = similarity;
                bestModel = candidate;
            }
        }

        return bestModel ? { model: bestModel, similarity: +bestScore.toFixed(6) } : null;
    }

    /**
     * Score all candidates against a reference model.
     *
     * @param {object} referenceModel
     * @param {Array}  candidates
     * @returns {Array<{ model, similarity }>} sorted descending
     */
    rankCandidates(referenceModel, candidates) {
        const sourceVec = referenceModel.cognitiveStyleVector;
        if (!sourceVec) return [];

        return candidates
            .filter(c => c.modelId !== referenceModel.modelId)
            .map(c => ({
                model:      c,
                similarity: c.cognitiveStyleVector
                    ? +cosine_similarity(sourceVec, c.cognitiveStyleVector).toFixed(6)
                    : 0,
            }))
            .sort((a, b) => b.similarity - a.similarity);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY PERSISTENCE LAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TelemetryPersistence: embeds latency measurements as telemetry vectors for
 * long-term trend analysis.
 *
 * // RTP: HS-051 Claim 1(f) — embed latency measurements in persistent telemetry
 * //                           vector space for trend analysis.
 * // RTP: HS-051 Claim 5    — embed latency delta measurements into persistent
 * //                           vector database for long-term trending and anomaly detection.
 * // RTP: HS-051 Claim 6(e) — telemetry persistence layer embedding performance
 * //                           metrics in vector database.
 */
class TelemetryPersistence {

    constructor(opts = {}) {
        this._maxEntries = opts.maxEntries || DEFAULTS.telemetry_max_entries;
        // RTP: HS-051 Claim 1(f) / Claim 5 — persistent telemetry vector space
        this._vectors = [];
    }

    /**
     * Store a latency measurement as a telemetry vector.
     *
     * // RTP: HS-051 Claim 1(f) and Claim 5
     *
     * @param {string} modelId
     * @param {number} expectedMs
     * @param {number} actualMs
     * @param {number} delta
     * @param {string} degradationTier — 'healthy', 'mild', 'moderate', 'severe'
     * @param {object} [extra]         — additional context fields
     * @returns {object} stored entry
     */
    store(modelId, expectedMs, actualMs, delta, degradationTier, extra = {}) {
        // RTP: HS-051 Claim 5
        const entry = {
            modelId,
            expectedMs,
            actualMs,
            delta,
            degradationTier,
            timestamp: Date.now(),
            ...extra,
            // Compact vector representation for similarity search
            // [normalizedDelta, actualMs/expectedMs ratio, tierCode]
            vector: this._buildVector(expectedMs, actualMs, delta, degradationTier),
        };

        this._vectors.push(entry);
        if (this._vectors.length > this._maxEntries) {
            this._vectors.shift();
        }
        return entry;
    }

    /**
     * Build a compact numeric vector from telemetry fields.
     * @param {number} expectedMs
     * @param {number} actualMs
     * @param {number} delta
     * @param {string} tier
     * @returns {number[]}
     */
    _buildVector(expectedMs, actualMs, delta, tier) {
        const tierCode = { healthy: 0.0, mild: 0.33, moderate: 0.66, severe: 1.0 };
        const ratio    = expectedMs > 0 ? actualMs / expectedMs : 1;
        const normDelta = expectedMs > 0 ? delta / expectedMs : 0;
        return [
            Math.max(-5, Math.min(5, normDelta)),  // normalized delta (clamped)
            Math.max(0,  Math.min(10, ratio)),      // actual/expected ratio (clamped)
            tierCode[tier] !== undefined ? tierCode[tier] : 0.5,
        ];
    }

    /**
     * Get all stored telemetry vectors.
     * @returns {Array}
     */
    getAll() {
        return [...this._vectors];
    }

    /**
     * Get recent entries (last N).
     * @param {number} n
     * @returns {Array}
     */
    getRecent(n = 10) {
        return this._vectors.slice(-n);
    }

    /**
     * Compute aggregate statistics across stored vectors.
     * @returns {object}
     */
    getStats() {
        if (this._vectors.length === 0) return { count: 0 };
        const deltas = this._vectors.map(e => e.delta);
        const mean   = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        const maxDelta = Math.max(...deltas);
        const minDelta = Math.min(...deltas);
        const tierCounts = {};
        for (const e of this._vectors) {
            tierCounts[e.degradationTier] = (tierCounts[e.degradationTier] || 0) + 1;
        }
        return { count: this._vectors.length, mean, maxDelta, minDelta, tierCounts };
    }

    get count() { return this._vectors.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE ROUTER — 3-TIER DEGRADATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AdaptiveRouter: selects models and adjusts cognitive parameters based on
 * observed infrastructure latency.
 *
 * // RTP: HS-051 Claim 1(e) — automatically adjust cognitive parameters when
 * //                           rolling average exceeds degradation threshold.
 * // RTP: HS-051 Claim 4    — three degradation tiers: mild, moderate, severe.
 * // RTP: HS-051 Claim 6(c) — adaptive router re-selecting models based on infra health.
 */
class AdaptiveRouter {

    /**
     * @param {ModelRegistry}       registry     — model registry
     * @param {LatencyDeltaMonitor} monitor      — latency delta monitor
     * @param {CognitiveStyleMatcher} matcher    — cognitive style matcher
     * @param {TelemetryPersistence}  telemetry  — telemetry persistence layer
     * @param {object}              opts         — configuration
     */
    constructor(registry, monitor, matcher, telemetry, opts = {}) {
        this.registry    = registry;
        this.monitor     = monitor;
        this.matcher     = matcher;
        this.telemetry   = telemetry;
        this.config      = Object.assign({}, DEFAULTS, opts);

        this._currentModelId  = null;  // currently active model
        this._originalModelId = null;  // model before any degradation routing
        this._rampUpCounter   = 0;
        this._routingLog      = [];
    }

    /**
     * Select a model for the given task type, or default to first registered.
     *
     * // RTP: HS-051 Claim 1(b) — select model from registry based on task type
     *
     * @param {string} taskType
     * @returns {object|null} model record
     */
    selectModel(taskType = 'general') {
        // RTP: HS-051 Claim 1(b)
        const all = this.registry.list();
        if (all.length === 0) return null;

        // Find first model whose capabilities include the task type, or fallback to first
        const match = all.find(m => m.capabilities.includes(taskType)) || all[0];

        if (!this._currentModelId) {
            this._currentModelId  = match.modelId;
            this._originalModelId = match.modelId;
        }

        return this.registry.get(this._currentModelId) || match;
    }

    /**
     * Process an inference result: record latency, compute delta, adapt routing.
     *
     * // RTP: HS-051 Claim 1 — full adaptive loop
     *
     * @param {string} modelId     — model used for this inference
     * @param {number} actualMs    — actual inference latency
     * @returns {object} routing decision
     */
    processInferenceResult(modelId, actualMs) {
        // RTP: HS-051 Claim 1(c) — measure actual latency, compute delta
        const model       = this.registry.get(modelId);
        if (!model) throw new Error(`processInferenceResult: unknown modelId '${modelId}'`);

        // Initialize current/original model on first call
        if (!this._currentModelId) {
            this._currentModelId  = modelId;
            this._originalModelId = modelId;
        }

        const expectedMs  = model.expectedLatencyMs;
        const { delta, rollingAvg } = this.monitor.record(expectedMs, actualMs);

        // Determine degradation tier
        // RTP: HS-051 Claim 4 — three tiers
        const ratio    = expectedMs > 0 ? actualMs / expectedMs : 1;
        const tier     = this._determineTier(ratio);

        // RTP: HS-051 Claim 1(f) / Claim 5 — embed latency in telemetry vector space
        this.telemetry.store(modelId, expectedMs, actualMs, delta, tier);

        let decision = {
            modelId,
            expectedMs,
            actualMs,
            delta,
            rollingAvg,
            tier,
            action:      'no_change',
            newModelId:  null,
            paramAdjustments: {},
        };

        // RTP: HS-051 Claim 3 — check for recovery first
        if (this._currentModelId !== this._originalModelId && this.monitor.isRecovered(this.config.recovery_std_factor)) {
            decision = this._handleRecovery(decision);
        } else {
            // RTP: HS-051 Claim 1(e) — adapt based on tier
            decision = this._applyTierAdjustment(decision, tier, rollingAvg, expectedMs);
        }

        this._routingLog.push({ ...decision, timestamp: Date.now() });
        return decision;
    }

    /**
     * Determine the degradation tier from actual/expected latency ratio.
     *
     * // RTP: HS-051 Claim 4 — mild (<2×), moderate (<5×), severe (≥5×)
     *
     * @param {number} ratio — actualMs / expectedMs
     * @returns {string}
     */
    _determineTier(ratio) {
        // RTP: HS-051 Claim 4
        if (ratio >= TIER_SEVERE)   return 'severe';
        if (ratio >= TIER_MILD)     return 'moderate';
        if (ratio > 1.0)            return 'mild';
        return 'healthy';
    }

    /**
     * Apply tier-appropriate parameter adjustments.
     *
     * // RTP: HS-051 Claim 1(e) — adjust model selection, temperature, context window
     * // RTP: HS-051 Claim 4    — three-tier response
     *
     * @param {object} decision
     * @param {string} tier
     * @param {number} rollingAvg
     * @param {number} expectedMs
     * @returns {object} updated decision
     */
    _applyTierAdjustment(decision, tier, rollingAvg, expectedMs) {
        // RTP: HS-051 Claim 4
        const currentModel = this._currentModelId ? this.registry.get(this._currentModelId) : null;

        if (tier === 'mild') {
            // RTP: HS-051 Claim 4 — mild: reduce context window and temperature
            decision.action = 'parameter_reduction';
            const baseTemp    = (currentModel && currentModel.temperature    !== undefined) ? currentModel.temperature    : 0.7;
            const baseContext = (currentModel && currentModel.maxContextLength !== undefined) ? currentModel.maxContextLength : 4096;
            decision.paramAdjustments = {
                temperature:      Math.max(0.1, baseTemp    * 0.7),
                maxContextLength: Math.floor(baseContext * 0.7),
            };
        } else if (tier === 'moderate') {
            // RTP: HS-051 Claim 4 — moderate: switch to next-tier fallback model
            const currentTier = (currentModel && currentModel.tier !== undefined) ? currentModel.tier : 0;
            const candidates  = this.registry.list().filter(m => m.tier > currentTier);
            // RTP: HS-051 Claim 2 — select by cognitive style vector similarity
            const match = currentModel
                ? this.matcher.findBestReplacement(currentModel, candidates)
                : (candidates.length > 0 ? { model: candidates[0], similarity: 1.0 } : null);
            if (match) {
                this._currentModelId = match.model.modelId;
                decision.action      = 'model_fallback';
                decision.newModelId  = match.model.modelId;
                decision.styleSimilarity = match.similarity;
            }
        } else if (tier === 'severe') {
            // RTP: HS-051 Claim 4 — severe: route to local inference with minimal params
            const localModel = this.registry.list().find(m => m.isLocal);
            if (localModel) {
                this._currentModelId = localModel.modelId;
                decision.action      = 'local_inference';
                decision.newModelId  = localModel.modelId;
                decision.paramAdjustments = {
                    temperature:      0.1,
                    maxContextLength: 512,
                };
            }
        }

        return decision;
    }

    /**
     * Handle recovery: gradually restore the original model.
     *
     * // RTP: HS-051 Claim 3 — restore original model when delta < 1 std dev of baseline.
     *                           Ramp-up period prevents oscillation.
     *
     * @param {object} decision
     * @returns {object}
     */
    _handleRecovery(decision) {
        // RTP: HS-051 Claim 3
        this._rampUpCounter++;

        if (this._rampUpCounter >= this.config.ramp_up_steps) {
            const originalModel    = this._originalModelId ? this.registry.get(this._originalModelId) : null;
            this._currentModelId   = this._originalModelId;
            this._rampUpCounter    = 0;
            decision.action        = 'recovery_complete';
            decision.newModelId    = this._originalModelId;
            decision.paramAdjustments = (originalModel && originalModel.temperature !== undefined) ? {
                temperature:      originalModel.temperature,
                maxContextLength: originalModel.maxContextLength,
            } : {};
        } else {
            decision.action = 'recovery_ramp_up';
            decision.rampUpStep = this._rampUpCounter;
            decision.rampUpStepsRemaining = this.config.ramp_up_steps - this._rampUpCounter;
        }

        return decision;
    }

    /**
     * Get the currently active model.
     * @returns {object|null}
     */
    getCurrentModel() {
        return this._currentModelId ? this.registry.get(this._currentModelId) : null;
    }

    /**
     * Get the routing decision log.
     * @returns {Array}
     */
    getRoutingLog() {
        return [...this._routingLog];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIBE-MATCH ROUTER — Full HS-051 System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VibeMatchRouter: assembles all HS-051 components into the complete system.
 *
 * // RTP: HS-051 Claim 6 — full system with model registry, latency delta monitor,
 * //                         adaptive router, cognitive style matcher, telemetry persistence.
 */
class VibeMatchRouter {

    /**
     * @param {object} opts — configuration overrides
     */
    constructor(opts = {}) {
        // RTP: HS-051 Claim 6(a) — model registry
        this.registry = new ModelRegistry();

        // RTP: HS-051 Claim 6(b) — latency delta monitor
        this.monitor = new LatencyDeltaMonitor(opts.monitor || {});

        // RTP: HS-051 Claim 6(d) — cognitive style matcher
        this.matcher = new CognitiveStyleMatcher();

        // RTP: HS-051 Claim 6(e) — telemetry persistence
        this.telemetry = new TelemetryPersistence(opts.telemetry || {});

        // RTP: HS-051 Claim 6(c) — adaptive router
        this.router = new AdaptiveRouter(
            this.registry,
            this.monitor,
            this.matcher,
            this.telemetry,
            opts.router || {},
        );

        // Seed default models from HS-051 detailed description
        this._seedDefaultModels(opts.seedDefaults !== false);
    }

    /**
     * Seed the registry with the example models from HS-051's detailed description.
     * @param {boolean} doSeed
     */
    _seedDefaultModels(doSeed) {
        if (!doSeed) return;
        // Models from HS-051 description: expected latencies and cognitive styles
        const defaults = [
            {
                modelId: 'claude-3.5-sonnet',
                contract: {
                    expectedLatencyMs: 800,
                    maxContextLength:  200_000,
                    cognitiveStyle:    'deep',
                    temperature:       0.7,
                    capabilities:      ['reasoning', 'analysis', 'generation'],
                    isLocal:           false,
                    tier:              0,
                },
            },
            {
                modelId: 'gpt-4o',
                contract: {
                    expectedLatencyMs: 600,
                    maxContextLength:  128_000,
                    cognitiveStyle:    'balanced',
                    temperature:       0.7,
                    capabilities:      ['reasoning', 'generation', 'retrieval'],
                    isLocal:           false,
                    tier:              1,
                },
            },
            {
                modelId: 'groq-llama-70b',
                contract: {
                    expectedLatencyMs: 150,
                    maxContextLength:  8_192,
                    cognitiveStyle:    'fast',
                    temperature:       0.5,
                    capabilities:      ['generation', 'retrieval'],
                    isLocal:           false,
                    tier:              2,
                },
            },
            {
                modelId: 'local-mistral',
                contract: {
                    expectedLatencyMs: 50,
                    maxContextLength:  4_096,
                    cognitiveStyle:    'ultrafast',
                    temperature:       0.3,
                    capabilities:      ['generation'],
                    isLocal:           true,
                    tier:              3,
                },
            },
        ];

        for (const { modelId, contract } of defaults) {
            this.registry.register(modelId, contract);
        }
    }

    /**
     * Select a model for a task.
     *
     * // RTP: HS-051 Claim 1(b)
     *
     * @param {string} taskType
     * @returns {object|null}
     */
    selectModel(taskType) {
        // RTP: HS-051 Claim 1(b)
        return this.router.selectModel(taskType);
    }

    /**
     * Report an inference completion and trigger routing adaptation.
     *
     * // RTP: HS-051 Claim 1
     *
     * @param {string} modelId
     * @param {number} actualMs
     * @returns {object} routing decision
     */
    reportLatency(modelId, actualMs) {
        // RTP: HS-051 Claim 1
        return this.router.processInferenceResult(modelId, actualMs);
    }

    /**
     * Get the current active model.
     * @returns {object|null}
     */
    getCurrentModel() {
        return this.router.getCurrentModel();
    }

    /**
     * Get telemetry statistics.
     *
     * // RTP: HS-051 Claim 5
     *
     * @returns {object}
     */
    getTelemetryStats() {
        // RTP: HS-051 Claim 5
        return this.telemetry.getStats();
    }

    /**
     * Get full routing decision log.
     * @returns {Array}
     */
    getRoutingLog() {
        return this.router.getRoutingLog();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,
    DEFAULTS,
    TIER_MILD,
    TIER_MODERATE,
    TIER_SEVERE,
    ModelRegistry,
    LatencyDeltaMonitor,
    CognitiveStyleMatcher,
    TelemetryPersistence,
    AdaptiveRouter,
    VibeMatchRouter,
};

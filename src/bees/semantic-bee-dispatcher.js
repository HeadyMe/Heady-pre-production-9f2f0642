'use strict';

/**
 * semantic-bee-dispatcher.js — Heady Semantic Bee Dispatcher
 *
 * Replaces discrete bee type matching (if/switch on bee.type) with continuous
 * semantic dispatch.  Every bee registers its capabilities as natural language
 * descriptions that are embedded into 384-dim vectors and combined via CSL
 * consensus_superposition into a composite capability fingerprint.
 *
 * Dispatch, collaborative teaming, dead-bee detection, recycling, and
 * capability rebalancing all operate on continuous CSL similarity scores
 * rather than boolean capability flags.
 *
 * @module bees/semantic-bee-dispatcher
 */

const CSL    = require('../core/semantic-logic');
const { PhiScale, PhiRange, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of recent dispatches to consider for dead-bee detection */
const HISTORY_WINDOW    = 20;

/** Minimum similarity for a bee to be an "observer" in a dispatch */
const OBSERVER_FLOOR    = 0.30;

/** Similarity above which two bees are considered heavily overlapping */
const OVERLAP_THRESHOLD = 0.90;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic-ish 384-dim text embedding via seeded LCG.
 * Replace with a real sentence-transformer in production.
 *
 * @param {string} text
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function _embed(text, dim = 384) {
    const vec = new Float32Array(dim);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
        seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    }
    let s = seed || 1;
    for (let i = 0; i < dim; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        vec[i] = (s / 0xffffffff) * 2 - 1;
    }
    return CSL.normalize(vec);
}

// ── SemanticBeeDispatcher ─────────────────────────────────────────────────────

class SemanticBeeDispatcher {

    // -------------------------------------------------------------------------
    // constructor
    // -------------------------------------------------------------------------

    /**
     * @param {object} [config={}]
     * @param {number} [config.phiEquilibriumThreshold=PHI_INVERSE]  - Secondary role cutoff
     * @param {number} [config.maxActiveBees=50]
     * @param {number} [config.embeddingDimension=384]
     */
    constructor(config = {}) {
        this.phiEquilibriumThreshold = config.phiEquilibriumThreshold ?? PHI_INVERSE;
        this.maxActiveBees           = config.maxActiveBees           ?? 50;
        this.embeddingDimension      = config.embeddingDimension      ?? 384;

        /** @type {Map<string, {
         *   beeId:       string,
         *   capabilities: Array<{ description: string, weight: number }>,
         *   anchors:     Float32Array[],
         *   composite:   Float32Array,
         *   registeredAt: number,
         *   dispatchCount: number,
         *   lastDispatchAt: number|null,
         * }>} */
        this._bees = new Map();

        /** Dispatch history: beeId → circular buffer of { taskVector, relevance, ts } */
        this._history = new Map();

        /** Recycled bee log */
        this._recycled = [];

        // Phi-scaled equilibrium threshold (adapts based on fleet health)
        this._thresholdScale = new PhiScale({
            name:          'dispatcher.phiEquilibrium',
            baseValue:     this.phiEquilibriumThreshold,
            min:           0.1,
            max:           0.95,
            phiNormalized: true,
            sensitivity:   PHI_INVERSE * PHI_INVERSE,
            unit:          'similarity',
            category:      'dispatcher',
        });

        // Stats counters
        this._stats = {
            totalDispatches:    0,
            totalBeesRegistered: 0,
            totalBeesRecycled:  0,
            averageRelevance:   0,
            _relevanceSum:      0,
            deadBeeHistory:     [],
        };

        logger.info('SemanticBeeDispatcher initialised', {
            phiEquilibrium: this.phiEquilibriumThreshold,
            maxActiveBees:  this.maxActiveBees,
        });
    }

    // -------------------------------------------------------------------------
    // registerBee(beeId, capabilities)
    // -------------------------------------------------------------------------

    /**
     * Register a bee with its natural-language capability descriptions.
     * Each capability is embedded into a 384-dim vector; all capability
     * vectors are combined via consensus_superposition into a single
     * composite fingerprint.
     *
     * @param {string} beeId
     * @param {Array<{ description: string, weight?: number }>} capabilities
     * @throws {Error} if beeId is already registered
     */
    registerBee(beeId, capabilities) {
        if (this._bees.has(beeId)) {
            logger.warn('Bee already registered — overwriting', { beeId });
        }
        if (!Array.isArray(capabilities) || capabilities.length === 0) {
            throw new Error(`registerBee: capabilities must be a non-empty array (beeId=${beeId})`);
        }
        if (this._bees.size >= this.maxActiveBees) {
            throw new Error(`registerBee: maxActiveBees (${this.maxActiveBees}) reached`);
        }

        const anchors = capabilities.map(cap =>
            _embed(cap.description, this.embeddingDimension),
        );

        const composite = this._computeBeeCapabilityVector(capabilities);

        this._bees.set(beeId, {
            beeId,
            capabilities,
            anchors,
            composite,
            registeredAt:   Date.now(),
            dispatchCount:  0,
            lastDispatchAt: null,
        });

        this._history.set(beeId, []);
        this._stats.totalBeesRegistered++;

        logger.debug('Bee registered', {
            beeId,
            capabilityCount: capabilities.length,
        });
    }

    // -------------------------------------------------------------------------
    // dispatch(task)
    // -------------------------------------------------------------------------

    /**
     * Core replacement for discrete bee type matching.
     * Embeds the task and scores it against every bee's composite capability
     * vector.  Multiple bees CAN be partially activated simultaneously.
     *
     * Roles:
     *  - primary:   highest relevance bee
     *  - secondary: relevance > phiEquilibrium threshold
     *  - observer:  relevance > OBSERVER_FLOOR but below threshold
     *
     * @param {{
     *   input:                string,
     *   context?:             object,
     *   requiredCapabilities?: string[],
     * }} task
     * @returns {{
     *   dispatched: Array<{ beeId: string, relevance: number, role: 'primary'|'secondary'|'observer' }>,
     *   undispatched: string[],
     * }}
     */
    dispatch(task) {
        this._stats.totalDispatches++;

        const taskText   = [
            task.input,
            JSON.stringify(task.context ?? {}),
            (task.requiredCapabilities ?? []).join(' '),
        ].join(' ');
        const taskVector = _embed(taskText, this.embeddingDimension);

        const beeArray   = Array.from(this._bees.values());
        if (beeArray.length === 0) {
            logger.warn('dispatch: no bees registered');
            return { dispatched: [], undispatched: [] };
        }

        const compositeVecs = beeArray.map(b => b.composite);
        const resonance     = CSL.multi_resonance(taskVector, compositeVecs, OBSERVER_FLOOR);

        const threshold = this._thresholdScale.value;

        const dispatched   = [];
        const undispatched = [];

        // First pass: label roles
        for (let rank = 0; rank < resonance.length; rank++) {
            const r    = resonance[rank];
            const bee  = beeArray[r.index];
            const role = rank === 0 && r.score >= threshold ? 'primary'
                       : r.score >= threshold               ? 'secondary'
                       : r.open                             ? 'observer'
                       : null;

            if (role) {
                dispatched.push({ beeId: bee.beeId, relevance: r.score, role });
                bee.dispatchCount++;
                bee.lastDispatchAt = Date.now();

                // Track history for dead-bee detection
                this._trackDispatchHistory(bee.beeId, taskVector, r.score);

                this._stats._relevanceSum += r.score;
                this._stats.averageRelevance =
                    this._stats._relevanceSum / this._stats.totalDispatches;
            } else {
                undispatched.push(bee.beeId);
            }
        }

        // Adapt threshold based on average relevance
        this._thresholdScale.adjust({
            errorRate:          1 - (dispatched[0]?.relevance ?? 0),
            serviceHealthRatio: dispatched.length / Math.max(1, beeArray.length),
        });

        logger.debug('Dispatch complete', {
            dispatched:   dispatched.length,
            undispatched: undispatched.length,
            topRelevance: dispatched[0]?.relevance?.toFixed(4) ?? 'n/a',
        });

        return { dispatched, undispatched };
    }

    // -------------------------------------------------------------------------
    // dispatchCollaborative(task)
    // -------------------------------------------------------------------------

    /**
     * Collaborative dispatch: all bees above phiEquilibrium work together,
     * weighted by relevance.  Returns the team and a coherence score
     * indicating how well the team collectively covers the task.
     *
     * @param {{ input: string, context?: object, requiredCapabilities?: string[] }} task
     * @returns {{
     *   team: Array<{ beeId: string, weight: number, capabilities: Array<{ description: string, weight: number }> }>,
     *   teamCoherence: number,
     * }}
     */
    dispatchCollaborative(task) {
        const { dispatched } = this.dispatch(task);

        const threshold = this._thresholdScale.value;
        const team = dispatched
            .filter(d => d.relevance >= threshold)
            .map(d => {
                const bee = this._bees.get(d.beeId);
                return {
                    beeId:        d.beeId,
                    weight:       d.relevance,
                    capabilities: bee?.capabilities ?? [],
                };
            });

        // Team coherence: how well the weighted superposition of team vectors
        // aligns with the task vector.
        let teamCoherence = 0;
        if (team.length > 0) {
            const taskText   = [task.input, JSON.stringify(task.context ?? {})].join(' ');
            const taskVector = _embed(taskText, this.embeddingDimension);

            // Build weighted superposition of all team capability vectors
            const teamVectors = team.map(m => {
                const bee = this._bees.get(m.beeId);
                return bee ? bee.composite : new Float32Array(this.embeddingDimension).fill(0);
            });
            const consensusVec = CSL.consensus_superposition(teamVectors);
            teamCoherence = CSL.cosine_similarity(taskVector, consensusVec);
        }

        logger.debug('Collaborative dispatch', {
            teamSize:     team.length,
            teamCoherence: teamCoherence.toFixed(4),
        });

        return { team, teamCoherence };
    }

    // -------------------------------------------------------------------------
    // detectDeadBees()
    // -------------------------------------------------------------------------

    /**
     * Semantic dead-bee detection.
     * A bee is classified as:
     *  - dead:   highest recent relevance < phiEquilibrium for all recent dispatches
     *  - zombie: responds to dispatches but relevance never rises above threshold
     *  - active: relevance exceeds threshold in at least one recent dispatch
     *
     * @returns {{
     *   deadBees:   Array<{ beeId: string, highestRecentMatch: number, idleSince: number|null }>,
     *   activeBees: string[],
     *   zombieBees: Array<{ beeId: string, averageRelevance: number }>,
     * }}
     */
    detectDeadBees() {
        const deadBees   = [];
        const activeBees = [];
        const zombieBees = [];

        const threshold = this._thresholdScale.value;
        const now       = Date.now();

        for (const [beeId, bee] of this._bees) {
            const history = this._history.get(beeId) ?? [];

            if (history.length === 0) {
                // Never dispatched — treat as potentially dead if registered > 5 min ago
                if (now - bee.registeredAt > 5 * 60 * 1000) {
                    deadBees.push({ beeId, highestRecentMatch: 0, idleSince: bee.registeredAt });
                }
                continue;
            }

            const recent = history.slice(-HISTORY_WINDOW);
            const highestRecentMatch = recent.reduce((max, h) => Math.max(max, h.relevance), 0);
            const avgRelevance = recent.reduce((s, h) => s + h.relevance, 0) / recent.length;

            if (highestRecentMatch < threshold) {
                if (avgRelevance >= OBSERVER_FLOOR) {
                    // Responds but never crosses threshold → zombie
                    zombieBees.push({ beeId, averageRelevance: avgRelevance });
                } else {
                    // Completely irrelevant → dead
                    deadBees.push({
                        beeId,
                        highestRecentMatch,
                        idleSince: bee.lastDispatchAt,
                    });
                }
            } else {
                activeBees.push(beeId);
            }
        }

        // Record in stats
        this._stats.deadBeeHistory.push({
            ts:     now,
            dead:   deadBees.length,
            zombie: zombieBees.length,
            active: activeBees.length,
        });

        logger.info('Dead bee detection', {
            dead:   deadBees.length,
            zombie: zombieBees.length,
            active: activeBees.length,
        });

        return { deadBees, activeBees, zombieBees };
    }

    // -------------------------------------------------------------------------
    // recycleBee(beeId)
    // -------------------------------------------------------------------------

    /**
     * Remove a dead bee, log its capability gap for potential new bee creation.
     *
     * @param {string} beeId
     * @returns {{ removed: boolean, capabilityGap: string[] }}
     */
    recycleBee(beeId) {
        const bee = this._bees.get(beeId);
        if (!bee) {
            logger.warn('recycleBee: bee not found', { beeId });
            return { removed: false, capabilityGap: [] };
        }

        // Log capability gap: which descriptions this bee uniquely served
        const capabilityGap = bee.capabilities.map(c => c.description);

        this._recycled.push({
            beeId,
            capabilities:    capabilityGap,
            recycledAt:      Date.now(),
            dispatchCount:   bee.dispatchCount,
            registeredAt:    bee.registeredAt,
        });

        this._bees.delete(beeId);
        this._history.delete(beeId);
        this._stats.totalBeesRecycled++;

        logger.info('Bee recycled', { beeId, capabilityGap });
        return { removed: true, capabilityGap };
    }

    // -------------------------------------------------------------------------
    // rebalanceCapabilities()
    // -------------------------------------------------------------------------

    /**
     * Analyse all bee capabilities pairwise to find:
     *  - Overlap: bees with cosine similarity > OVERLAP_THRESHOLD → recommend merge
     *  - Gaps: tasks that no bee covers above phiEquilibrium
     *
     * @returns {{
     *   overlaps: Array<{ beeA: string, beeB: string, similarity: number }>,
     *   gaps:     Array<{ description: string }>,
     *   recommendations: string[],
     * }}
     */
    rebalanceCapabilities() {
        const beeArray       = Array.from(this._bees.values());
        const overlaps       = [];
        const recommendations = [];
        const threshold       = this._thresholdScale.value;

        // Pairwise cosine similarity matrix
        for (let i = 0; i < beeArray.length; i++) {
            for (let j = i + 1; j < beeArray.length; j++) {
                const sim = CSL.cosine_similarity(
                    beeArray[i].composite,
                    beeArray[j].composite,
                );
                if (sim >= OVERLAP_THRESHOLD) {
                    overlaps.push({
                        beeA:       beeArray[i].beeId,
                        beeB:       beeArray[j].beeId,
                        similarity: sim,
                    });
                    recommendations.push(
                        `Merge bees '${beeArray[i].beeId}' and '${beeArray[j].beeId}' ` +
                        `(similarity=${sim.toFixed(4)})`,
                    );
                }
            }
        }

        // Gap detection: examine recycled bee capability descriptions as
        // proxies for "tasks the current fleet might not cover well".
        const gaps = [];
        for (const recycled of this._recycled) {
            for (const desc of recycled.capabilities) {
                const gapVector = _embed(desc, this.embeddingDimension);
                const composites = beeArray.map(b => b.composite);
                if (composites.length === 0) {
                    gaps.push({ description: desc });
                    continue;
                }
                const results = CSL.multi_resonance(gapVector, composites, threshold);
                const bestCoverage = results.length > 0 ? results[0].score : 0;
                if (bestCoverage < threshold) {
                    gaps.push({ description: desc });
                    recommendations.push(
                        `Create a new bee to cover: "${desc}" ` +
                        `(best existing coverage=${bestCoverage.toFixed(4)})`,
                    );
                }
            }
        }

        logger.info('Capability rebalance complete', {
            overlaps:        overlaps.length,
            gaps:            gaps.length,
            recommendations: recommendations.length,
        });

        return { overlaps, gaps, recommendations };
    }

    // -------------------------------------------------------------------------
    // _computeBeeCapabilityVector(capabilities)
    // -------------------------------------------------------------------------

    /**
     * Combine capability descriptions into a single composite vector via
     * weighted consensus superposition.  Higher-weighted capabilities
     * contribute more to the composite.
     *
     * @param {Array<{ description: string, weight?: number }>} capabilities
     * @returns {Float32Array}
     */
    _computeBeeCapabilityVector(capabilities) {
        if (capabilities.length === 1) {
            return _embed(capabilities[0].description, this.embeddingDimension);
        }

        // Build weighted vectors: weight = caller weight or 1.0
        const weightedVecs = capabilities.map(cap => {
            const base   = _embed(cap.description, this.embeddingDimension);
            const w      = Math.max(0.01, cap.weight ?? 1.0);
            // Scale each dimension by weight then normalise
            const scaled = new Float32Array(this.embeddingDimension);
            for (let i = 0; i < this.embeddingDimension; i++) {
                scaled[i] = base[i] * w;
            }
            return CSL.normalize(scaled);
        });

        return CSL.consensus_superposition(weightedVecs);
    }

    // -------------------------------------------------------------------------
    // _trackDispatchHistory(beeId, taskVector, relevance)
    // -------------------------------------------------------------------------

    /**
     * Record a dispatch event for a bee.  Maintains a rolling window of
     * HISTORY_WINDOW entries.
     *
     * @param {string}       beeId
     * @param {Float32Array} taskVector
     * @param {number}       relevance
     */
    _trackDispatchHistory(beeId, taskVector, relevance) {
        let history = this._history.get(beeId);
        if (!history) {
            history = [];
            this._history.set(beeId, history);
        }

        history.push({ taskVector, relevance, ts: Date.now() });

        // Trim to rolling window
        if (history.length > HISTORY_WINDOW) {
            history.splice(0, history.length - HISTORY_WINDOW);
        }
    }

    // -------------------------------------------------------------------------
    // getStats()
    // -------------------------------------------------------------------------

    /**
     * Return dispatch statistics, average relevance, and dead-bee history.
     *
     * @returns {object}
     */
    getStats() {
        const beeStats = [];
        for (const [beeId, bee] of this._bees) {
            const history = this._history.get(beeId) ?? [];
            const recent  = history.slice(-HISTORY_WINDOW);
            const avgRel  = recent.length > 0
                ? recent.reduce((s, h) => s + h.relevance, 0) / recent.length
                : 0;
            beeStats.push({
                beeId,
                dispatchCount:  bee.dispatchCount,
                lastDispatchAt: bee.lastDispatchAt,
                registeredAt:   bee.registeredAt,
                averageRelevance: avgRel,
                capabilityCount: bee.capabilities.length,
            });
        }

        return {
            totalDispatches:     this._stats.totalDispatches,
            totalBeesRegistered: this._stats.totalBeesRegistered,
            totalBeesRecycled:   this._stats.totalBeesRecycled,
            activeBeeCount:      this._bees.size,
            averageRelevance:    this._stats.averageRelevance,
            phiEquilibriumValue: this._thresholdScale.value,
            deadBeeHistory:      this._stats.deadBeeHistory.slice(-10),
            bees:                beeStats,
            cslStats:            CSL.getStats(),
        };
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { SemanticBeeDispatcher };

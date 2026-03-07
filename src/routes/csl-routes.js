/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── CSL Gates REST Routes ────────────────────────────────────────────────────
 *
 * Patent Docket: HS-058
 * Express-style route handlers exposing Continuous Semantic Logic gates as REST
 * endpoints.  Satisfies Claim 9(e) (API layer) and Claim 10 (integration points).
 *
 * Mount in your Express app:
 *   const cslRoutes = require('./src/routes/csl-routes');
 *   app.use('/api/csl', cslRoutes);
 *
 * Endpoints:
 *   POST /api/csl/resonance              — Claim 1: resonance gate
 *   POST /api/csl/multi-resonance        — Claim 4: multi-resonance
 *   POST /api/csl/superposition          — Claim 2: superposition gate
 *   POST /api/csl/weighted-superposition — Claim 5: weighted superposition
 *   POST /api/csl/consensus-superposition— Claim 6: consensus superposition
 *   POST /api/csl/orthogonal             — Claim 3: orthogonal gate
 *   POST /api/csl/batch-orthogonal       — Claim 7: batch orthogonal
 *   POST /api/csl/soft-gate              — Claim 8: configurable sigmoid
 *   GET  /api/csl/stats                  — Claim 9(d): statistics
 *   POST /api/csl/stats/reset            — reset stats
 *   POST /api/csl/memory-density-gate    — Claim 10: vector memory integration
 *   POST /api/csl/hallucination-gate     — Claim 10: mesh integration point
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,
    soft_gate,
    getStats,
    resetStats,
    CSLSystem,
} = require('../core/csl-gates-enhanced');

// Shared CSL system instance for integration-point routes
const csl = new CSLSystem({ threshold: 0.5, steepness: 20 });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a value is a non-empty numeric array.
 * @param {any} v
 * @returns {boolean}
 */
function isVector(v) {
    return Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number' && isFinite(x));
}

/**
 * Send a standardized error response.
 * @param {object} res
 * @param {number} statusCode
 * @param {string} message
 */
function sendError(res, statusCode, message) {
    return res.status(statusCode).json({ error: message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/csl/resonance
 * Claim 1: Resonance Gate — cosine similarity + sigmoid activation.
 *
 * Body: { vec_a: number[], vec_b: number[], threshold?: number, steepness?: number }
 * Returns: { score, activation, open, threshold, steepness }
 */
function postResonance(req, res) {
    // RTP: HS-058 Claim 1 and Claim 9(e)
    const { vec_a, vec_b, threshold = 0.5, steepness = 20 } = req.body;
    if (!isVector(vec_a)) return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b)) return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    try {
        const result = resonance_gate(vec_a, vec_b, threshold, steepness);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/multi-resonance
 * Claim 4: Multi-Resonance — score N candidates against a target.
 *
 * Body: { target: number[], candidates: number[][], threshold?: number, steepness?: number }
 * Returns: Array<{ index, score, activation, open }>
 */
function postMultiResonance(req, res) {
    // RTP: HS-058 Claim 4 and Claim 9(e)
    const { target, candidates, threshold = 0.5, steepness = 20 } = req.body;
    if (!isVector(target))                     return sendError(res, 400, 'target must be a non-empty numeric array');
    if (!Array.isArray(candidates))            return sendError(res, 400, 'candidates must be an array');
    if (!candidates.every(isVector))           return sendError(res, 400, 'every candidate must be a numeric array');
    try {
        const results = multi_resonance(target, candidates, threshold, steepness);
        res.json({ ok: true, data: results });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/superposition
 * Claim 2: Superposition Gate — fuse two vectors.
 *
 * Body: { vec_a: number[], vec_b: number[] }
 * Returns: { hybrid: number[] }
 */
function postSuperposition(req, res) {
    // RTP: HS-058 Claim 2 and Claim 9(e)
    const { vec_a, vec_b } = req.body;
    if (!isVector(vec_a)) return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b)) return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    try {
        const hybrid = superposition_gate(vec_a, vec_b);
        res.json({ ok: true, data: { hybrid: Array.from(hybrid) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/weighted-superposition
 * Claim 5: Weighted Superposition — biased fusion with α.
 *
 * Body: { vec_a: number[], vec_b: number[], alpha: number }
 * Returns: { hybrid: number[], alpha }
 */
function postWeightedSuperposition(req, res) {
    // RTP: HS-058 Claim 5 and Claim 9(e)
    const { vec_a, vec_b, alpha = 0.5 } = req.body;
    if (!isVector(vec_a))                          return sendError(res, 400, 'vec_a must be a non-empty numeric array');
    if (!isVector(vec_b))                          return sendError(res, 400, 'vec_b must be a non-empty numeric array');
    if (typeof alpha !== 'number' || alpha < 0 || alpha > 1)
        return sendError(res, 400, 'alpha must be a number in [0, 1]');
    try {
        const hybrid = weighted_superposition(vec_a, vec_b, alpha);
        res.json({ ok: true, data: { hybrid: Array.from(hybrid), alpha } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/consensus-superposition
 * Claim 6: Consensus Superposition — fuse arbitrary N vectors.
 *
 * Body: { vectors: number[][] }
 * Returns: { consensus: number[] }
 */
function postConsensusSuperposition(req, res) {
    // RTP: HS-058 Claim 6 and Claim 9(e)
    const { vectors } = req.body;
    if (!Array.isArray(vectors) || vectors.length === 0)
        return sendError(res, 400, 'vectors must be a non-empty array');
    if (!vectors.every(isVector))
        return sendError(res, 400, 'every vector must be a non-empty numeric array');
    try {
        const consensus = consensus_superposition(vectors);
        res.json({ ok: true, data: { consensus: Array.from(consensus) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/orthogonal
 * Claim 3: Orthogonal Gate — remove rejection vector from target.
 *
 * Body: { target_vec: number[], reject_vec: number[] }
 * Returns: { purified: number[] }
 */
function postOrthogonal(req, res) {
    // RTP: HS-058 Claim 3 and Claim 9(e)
    const { target_vec, reject_vec } = req.body;
    if (!isVector(target_vec)) return sendError(res, 400, 'target_vec must be a non-empty numeric array');
    if (!isVector(reject_vec)) return sendError(res, 400, 'reject_vec must be a non-empty numeric array');
    try {
        const purified = orthogonal_gate(target_vec, reject_vec);
        res.json({ ok: true, data: { purified: Array.from(purified) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/batch-orthogonal
 * Claim 7: Batch Orthogonal — remove multiple rejection vectors.
 *
 * Body: { target_vec: number[], reject_vecs: number[][] }
 * Returns: { purified: number[] }
 */
function postBatchOrthogonal(req, res) {
    // RTP: HS-058 Claim 7 and Claim 9(e)
    const { target_vec, reject_vecs } = req.body;
    if (!isVector(target_vec))               return sendError(res, 400, 'target_vec must be a non-empty numeric array');
    if (!Array.isArray(reject_vecs))         return sendError(res, 400, 'reject_vecs must be an array');
    if (!reject_vecs.every(isVector))        return sendError(res, 400, 'every reject_vec must be a numeric array');
    try {
        const purified = batch_orthogonal(target_vec, reject_vecs);
        res.json({ ok: true, data: { purified: Array.from(purified) } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/soft-gate
 * Claim 8: Configurable sigmoid activation.
 *
 * Body: { score: number, threshold?: number, steepness?: number }
 * Returns: { activation: number }
 */
function postSoftGate(req, res) {
    // RTP: HS-058 Claim 8 and Claim 9(e)
    const { score, threshold = 0.5, steepness = 20 } = req.body;
    if (typeof score !== 'number' || !isFinite(score))
        return sendError(res, 400, 'score must be a finite number');
    try {
        const activation = soft_gate(score, threshold, steepness);
        res.json({ ok: true, data: { activation, score, threshold, steepness } });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * GET /api/csl/stats
 * Claim 9(d): Return gate invocation counts and average scores.
 */
function getStatsHandler(req, res) {
    // RTP: HS-058 Claim 9(d) and Claim 9(e)
    res.json({ ok: true, data: getStats() });
}

/**
 * POST /api/csl/stats/reset
 * Reset all statistics counters.
 */
function postStatsReset(req, res) {
    resetStats();
    res.json({ ok: true, data: { message: 'Stats reset successfully' } });
}

/**
 * POST /api/csl/memory-density-gate
 * Claim 10: Vector memory deduplication integration point.
 *
 * Body: { new_memory_vec: number[], existing_mem_vec: number[], threshold?: number }
 * Returns: { isDuplicate, score, activation }
 */
function postMemoryDensityGate(req, res) {
    // RTP: HS-058 Claim 10
    const { new_memory_vec, existing_mem_vec, threshold = 0.92 } = req.body;
    if (!isVector(new_memory_vec))    return sendError(res, 400, 'new_memory_vec required');
    if (!isVector(existing_mem_vec))  return sendError(res, 400, 'existing_mem_vec required');
    try {
        const result = csl.vectorMemoryDensityGate(new_memory_vec, existing_mem_vec, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

/**
 * POST /api/csl/hallucination-gate
 * Claim 10: Self-healing mesh hallucination detection integration point.
 *
 * Body: { agent_output_vec: number[], consensus_vec: number[], threshold?: number }
 * Returns: { score, activation, hallucinated }
 */
function postHallucinationGate(req, res) {
    // RTP: HS-058 Claim 10
    const { agent_output_vec, consensus_vec, threshold = 0.7 } = req.body;
    if (!isVector(agent_output_vec)) return sendError(res, 400, 'agent_output_vec required');
    if (!isVector(consensus_vec))    return sendError(res, 400, 'consensus_vec required');
    try {
        const result = csl.hallucinationDetectionGate(agent_output_vec, consensus_vec, threshold);
        res.json({ ok: true, data: result });
    } catch (err) {
        sendError(res, 500, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express Router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register all CSL routes on an Express Router instance.
 *
 * Usage:
 *   const express = require('express');
 *   const { createRouter } = require('./src/routes/csl-routes');
 *   app.use('/api/csl', createRouter(express.Router()));
 *
 * @param {object} router — Express Router instance
 * @returns {object} configured router
 */
function createRouter(router) {
    router.post('/resonance',               postResonance);
    router.post('/multi-resonance',         postMultiResonance);
    router.post('/superposition',           postSuperposition);
    router.post('/weighted-superposition',  postWeightedSuperposition);
    router.post('/consensus-superposition', postConsensusSuperposition);
    router.post('/orthogonal',              postOrthogonal);
    router.post('/batch-orthogonal',        postBatchOrthogonal);
    router.post('/soft-gate',               postSoftGate);
    router.get( '/stats',                   getStatsHandler);
    router.post('/stats/reset',             postStatsReset);
    router.post('/memory-density-gate',     postMemoryDensityGate);
    router.post('/hallucination-gate',      postHallucinationGate);
    return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    createRouter,
    // Export individual handlers for testing without an HTTP layer
    handlers: {
        postResonance,
        postMultiResonance,
        postSuperposition,
        postWeightedSuperposition,
        postConsensusSuperposition,
        postOrthogonal,
        postBatchOrthogonal,
        postSoftGate,
        getStatsHandler,
        postStatsReset,
        postMemoryDensityGate,
        postHallucinationGate,
    },
};

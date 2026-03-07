/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Continuous Semantic Logic Gates — Enhanced ───────────────────────────────
 *
 * Patent Docket: HS-058
 * Title: SYSTEM AND METHOD FOR CONTINUOUS SEMANTIC LOGIC GATES USING GEOMETRIC
 *        OPERATIONS IN HIGH-DIMENSIONAL VECTOR SPACES
 * Applicant: Heady Systems LLC  |  Inventor: Eric Haywood
 *
 * Satisfies ALL 10 claims of HS-058.
 *
 * THE 3 UNIVERSAL VECTOR GATES:
 *   1. Resonance Gate   (Semantic AND / IF)   — cosine similarity + sigmoid
 *   2. Superposition Gate (Semantic OR / MERGE) — weighted vector fusion
 *   3. Orthogonal Gate  (Semantic NOT / REJECT) — vector subtraction
 *
 * EXTENDED OPERATIONS (Claims 4-8):
 *   4. Multi-Resonance         — score N vectors against a target (Claim 4)
 *   5. Weighted Superposition  — biased fusion with configurable α (Claim 5)
 *   6. Consensus Superposition — fuse arbitrary N vectors (Claim 6)
 *   7. Batch Orthogonal        — strip multiple reject vectors in one pass (Claim 7)
 *   8. Soft Gate               — configurable sigmoid steepness/threshold (Claim 8)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// Golden ratio constant — used throughout HeadySystems implementations
const PHI = 1.6180339887;

// ── Statistics module — Claim 9(d): tracks gate invocation counts and avg scores
const _gateStats = {
    resonance:           0,
    superposition:       0,
    orthogonal:          0,
    softGate:            0,
    totalCalls:          0,
    avgResonanceScore:   0,
    _resonanceScoreSum:  0,
    _resonanceCallCount: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR MATH PRIMITIVES (shared by all gates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two vectors.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function dot_product(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

/**
 * Compute the L2 norm (magnitude) of a vector.
 * @param {number[]|Float32Array} v
 * @returns {number}
 */
function norm(v) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
        sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length.
 * @param {number[]|Float32Array} v
 * @returns {Float32Array}
 */
function normalize(v) {
    const n = norm(v);
    if (n < 1e-10) return Float32Array.from(v);
    const res = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) {
        res[i] = v[i] / n;
    }
    return res;
}

/**
 * Cosine similarity between two N-dimensional vectors.
 * Returns a value in [-1, 1].
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
function cosine_similarity(a, b) {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;
    const dot = dot_product(a, b);
    const normA = norm(a);
    const normB = norm(b);
    return dot / (normA * normB || 1e-10);
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT GATE — Continuous Activation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft Gate: sigmoid activation σ(x) = 1 / (1 + e^(-k(x - θ)))
 * Produces a continuous activation value between 0 and 1.
 *
 * // RTP: HS-058 Claim 8 — configurable sigmoid steepness k and threshold θ
 *
 * @param {number} score      — raw cosine similarity score
 * @param {number} threshold  — center of the sigmoid (θ), default 0.5
 * @param {number} steepness  — how sharp the transition is (k), default 20
 * @returns {number} continuous activation ∈ [0, 1]
 */
function soft_gate(score, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(c) — sigmoid applied to similarity score
    // RTP: HS-058 Claim 8    — configurable k (steepness) and θ (threshold)
    _gateStats.softGate++;
    _gateStats.totalCalls++;
    return 1.0 / (1.0 + Math.exp(-steepness * (score - threshold)));
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1: RESONANCE GATE  (Semantic IF / AND)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resonance Gate: measures cosine similarity between two N≥128 dimensional
 * vectors and applies sigmoid activation.
 *
 * // RTP: HS-058 Claim 1 — receives two N≥128-dim vectors, computes cosine
 * //                        similarity, applies sigmoid, returns structured result.
 *
 * @param {number[]|Float32Array} vec_a     — first embedding vector (N ≥ 128 dims)
 * @param {number[]|Float32Array} vec_b     — second embedding vector (N ≥ 128 dims)
 * @param {number}                threshold — sigmoid center θ (default 0.5)
 * @param {number}                steepness — sigmoid slope k (default 20)
 * @returns {{ score: number, activation: number, open: boolean }}
 */
function resonance_gate(vec_a, vec_b, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 1(a) — receive two N-dimensional embedding vectors
    if (!vec_a || !vec_b) throw new Error('resonance_gate: both vectors required');

    // RTP: HS-058 Claim 1(b) — compute continuous alignment score via cosine similarity
    const score = cosine_similarity(vec_a, vec_b);

    // RTP: HS-058 Claim 1(c) — apply sigmoid activation function
    // RTP: HS-058 Claim 8    — sigmoid uses configurable steepness and threshold
    const activation = soft_gate(score, threshold, steepness);

    _gateStats.resonance++;
    _gateStats.totalCalls++;
    _gateStats._resonanceScoreSum += score;
    _gateStats._resonanceCallCount++;
    _gateStats.avgResonanceScore = _gateStats._resonanceScoreSum / _gateStats._resonanceCallCount;

    // RTP: HS-058 Claim 1(d) — return activation value and score as structured gate result
    return {
        score:      +score.toFixed(6),
        activation: +activation.toFixed(6),
        open:       activation >= 0.5,
        threshold,
        steepness,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 1 EXTENSION: MULTI-RESONANCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-Resonance: scores a plurality of candidate vectors against a single
 * target simultaneously and returns a sorted array of results.
 *
 * // RTP: HS-058 Claim 4 — scores multiple candidates against single target,
 * //                        returns sorted array of alignment scores and activations.
 *
 * @param {number[]|Float32Array}            target     — reference vector
 * @param {Array<number[]|Float32Array>}     candidates — vectors to score
 * @param {number}                           threshold  — sigmoid threshold
 * @param {number}                           steepness  — sigmoid steepness
 * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
 */
function multi_resonance(target, candidates, threshold = 0.5, steepness = 20) {
    // RTP: HS-058 Claim 4 — score plurality of candidate vectors simultaneously
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates
        .map((c, i) => {
            const score = cosine_similarity(target, c);
            const activation = soft_gate(score, threshold, steepness);
            _gateStats.resonance++;
            _gateStats.totalCalls++;
            _gateStats._resonanceScoreSum += score;
            _gateStats._resonanceCallCount++;
            return {
                index:      i,
                score:      +score.toFixed(6),
                activation: +activation.toFixed(6),
                open:       activation >= 0.5,
            };
        })
        // RTP: HS-058 Claim 4 — return SORTED array (descending by score)
        .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 2: SUPERPOSITION GATE  (Semantic OR / MERGE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Superposition Gate: fuses two concept vectors into a normalized hybrid vector.
 * Basic (equal-weight) form: S(A, B) = normalize(A + B)
 *
 * // RTP: HS-058 Claim 2 — receives plurality of vectors, computes weighted sum,
 * //                        normalizes, returns unit vector as new hybrid concept.
 *
 * @param {number[]|Float32Array} vec_a — concept A
 * @param {number[]|Float32Array} vec_b — concept B
 * @returns {Float32Array} normalized hybrid concept vector
 */
function superposition_gate(vec_a, vec_b) {
    // RTP: HS-058 Claim 2(a) — receive plurality of embedding vectors
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    // RTP: HS-058 Claim 2(b) — compute weighted sum (equal weight = 0.5 each)
    for (let i = 0; i < len; i++) {
        hybrid[i] = vec_a[i] + vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 2(c) — normalize result to unit vector
    // RTP: HS-058 Claim 2(d) — return unit vector as new hybrid semantic concept
    return normalize(hybrid);
}

/**
 * Weighted Superposition: biased fusion with configurable α.
 * S(A, B, α) = normalize(α·A + (1−α)·B)
 *
 * // RTP: HS-058 Claim 5 — α ∈ [0,1]; α=1.0 returns A; α=0.0 returns B.
 *
 * @param {number[]|Float32Array} vec_a  — concept A
 * @param {number[]|Float32Array} vec_b  — concept B
 * @param {number}                alpha  — weight for vec_a ∈ [0.0, 1.0]
 * @returns {Float32Array} normalized weighted hybrid vector
 */
function weighted_superposition(vec_a, vec_b, alpha = 0.5) {
    // RTP: HS-058 Claim 5 — alpha ∈ [0.0,1.0]; (1-alpha) applied to vec_b
    if (alpha < 0 || alpha > 1) throw new Error('weighted_superposition: alpha must be in [0, 1]');
    const beta = 1.0 - alpha;
    const len = vec_a.length;
    const hybrid = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        hybrid[i] = alpha * vec_a[i] + beta * vec_b[i];
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(hybrid);
}

/**
 * Consensus Superposition: fuses an arbitrary number of vectors into a single
 * normalized consensus vector using sum + normalize.
 *
 * // RTP: HS-058 Claim 6 — fuses arbitrary N vectors via sum + normalize.
 *
 * @param {Array<number[]|Float32Array>} vectors — vectors to fuse
 * @returns {Float32Array} normalized consensus vector
 */
function consensus_superposition(vectors) {
    // RTP: HS-058 Claim 6 — arbitrary number of vectors, sum all, normalize result
    if (!vectors || vectors.length === 0) return new Float32Array(0);
    const len = vectors[0].length;
    const fused = new Float32Array(len);
    for (const v of vectors) {
        for (let i = 0; i < len; i++) {
            fused[i] += v[i];
        }
    }
    _gateStats.superposition++;
    _gateStats.totalCalls++;
    return normalize(fused);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE 3: ORTHOGONAL GATE  (Semantic NOT / REJECT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orthogonal Gate: removes a semantic concept from a target vector by
 * projecting the target onto the orthogonal complement of the rejection vector.
 * O(T, L) = normalize(T − ((T·L)/(L·L))·L)
 *
 * // RTP: HS-058 Claim 3 — receives target + rejection vectors, projects target
 * //                        onto orthogonal complement, returns purified unit vector.
 *
 * @param {number[]|Float32Array} target_vec  — base intent vector
 * @param {number[]|Float32Array} reject_vec  — concept to remove
 * @returns {Float32Array} purified orthogonal unit vector
 */
function orthogonal_gate(target_vec, reject_vec) {
    // RTP: HS-058 Claim 3(a) — receive target vector and rejection vector
    const len = target_vec.length;
    const dotTR = dot_product(target_vec, reject_vec);
    const dotRR = dot_product(reject_vec, reject_vec);
    const projectionFactor = dotTR / (dotRR || 1e-10);

    // RTP: HS-058 Claim 3(b) — project target onto each rejection, subtract projections
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = target_vec[i] - projectionFactor * reject_vec[i];
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    // RTP: HS-058 Claim 3(c) — normalize to produce purified unit vector
    // RTP: HS-058 Claim 3(d) — return purified vector
    return normalize(result);
}

/**
 * Batch Orthogonal: iteratively removes multiple rejection vectors from the
 * target in a single pass.
 *
 * // RTP: HS-058 Claim 7 — iteratively removes multiple rejection vectors in a single pass.
 *
 * @param {number[]|Float32Array}        target_vec  — base intent vector
 * @param {Array<number[]|Float32Array>} reject_vecs — concepts to strip out
 * @returns {Float32Array} purified vector with all rejections removed
 */
function batch_orthogonal(target_vec, reject_vecs) {
    // RTP: HS-058 Claim 7 — single pass through all rejection vectors
    let current = Float32Array.from(target_vec);
    for (const reject of reject_vecs) {
        const dotTR = dot_product(current, reject);
        const dotRR = dot_product(reject, reject);
        const factor = dotTR / (dotRR || 1e-10);
        for (let i = 0; i < current.length; i++) {
            current[i] -= factor * reject[i];
        }
    }
    _gateStats.orthogonal++;
    _gateStats.totalCalls++;
    return normalize(current);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS MODULE — Claim 9(d)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a snapshot of gate invocation counts and average scores.
 *
 * // RTP: HS-058 Claim 9(d) — statistics module tracking gate invocation counts
 * //                            and average scores.
 * @returns {object}
 */
function getStats() {
    // RTP: HS-058 Claim 9(d)
    return {
        resonance:         _gateStats.resonance,
        superposition:     _gateStats.superposition,
        orthogonal:        _gateStats.orthogonal,
        softGate:          _gateStats.softGate,
        totalCalls:        _gateStats.totalCalls,
        avgResonanceScore: _gateStats._resonanceCallCount > 0
            ? +(_gateStats._resonanceScoreSum / _gateStats._resonanceCallCount).toFixed(6)
            : 0,
    };
}

/**
 * Reset all statistics counters.
 */
function resetStats() {
    _gateStats.resonance           = 0;
    _gateStats.superposition       = 0;
    _gateStats.orthogonal          = 0;
    _gateStats.softGate            = 0;
    _gateStats.totalCalls          = 0;
    _gateStats.avgResonanceScore   = 0;
    _gateStats._resonanceScoreSum  = 0;
    _gateStats._resonanceCallCount = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL CSL SYSTEM — Claim 9: complete system exposing all gates + stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSLSystem: the full Continuous Semantic Logic system as a single object.
 *
 * // RTP: HS-058 Claim 9  — system with Resonance Gate module, Superposition Gate
 * //                         module, Orthogonal Gate module, statistics module, and
 * //                         API layer (see csl-routes.js).
 * // RTP: HS-058 Claim 10 — replaces all discrete boolean logic in vector memory
 * //                         subsystem, hybrid search subsystem, and self-healing
 * //                         attestation mesh with continuous geometric operations.
 */
class CSLSystem {

    constructor(opts = {}) {
        // RTP: HS-058 Claim 8 — configurable sigmoid steepness and threshold
        this.defaultThreshold = opts.threshold !== undefined ? opts.threshold : 0.5;
        this.defaultSteepness = opts.steepness !== undefined ? opts.steepness : 20;
    }

    // ── Resonance Gate module (Claim 9a) ───────────────────────────────────

    /**
     * Resonance Gate — Claim 1 core method.
     * // RTP: HS-058 Claim 1
     */
    resonance(vec_a, vec_b, threshold, steepness) {
        // RTP: HS-058 Claim 1
        return resonance_gate(
            vec_a,
            vec_b,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    /**
     * Multi-Resonance — Claim 4 extension.
     * // RTP: HS-058 Claim 4
     */
    multiResonance(target, candidates, threshold, steepness) {
        // RTP: HS-058 Claim 4
        return multi_resonance(
            target,
            candidates,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Superposition Gate module (Claim 9b) ───────────────────────────────

    /**
     * Superposition Gate — Claim 2 core method.
     * // RTP: HS-058 Claim 2
     */
    superposition(vec_a, vec_b) {
        // RTP: HS-058 Claim 2
        return superposition_gate(vec_a, vec_b);
    }

    /**
     * Weighted Superposition — Claim 5 configurable alpha.
     * // RTP: HS-058 Claim 5
     */
    weightedSuperposition(vec_a, vec_b, alpha = 0.5) {
        // RTP: HS-058 Claim 5
        return weighted_superposition(vec_a, vec_b, alpha);
    }

    /**
     * Consensus Superposition — Claim 6 arbitrary N vectors.
     * // RTP: HS-058 Claim 6
     */
    consensusSuperposition(vectors) {
        // RTP: HS-058 Claim 6
        return consensus_superposition(vectors);
    }

    // ── Orthogonal Gate module (Claim 9c) ──────────────────────────────────

    /**
     * Orthogonal Gate — Claim 3 core method.
     * // RTP: HS-058 Claim 3
     */
    orthogonal(target_vec, reject_vec) {
        // RTP: HS-058 Claim 3
        return orthogonal_gate(target_vec, reject_vec);
    }

    /**
     * Batch Orthogonal — Claim 7 multi-rejection single pass.
     * // RTP: HS-058 Claim 7
     */
    batchOrthogonal(target_vec, reject_vecs) {
        // RTP: HS-058 Claim 7
        return batch_orthogonal(target_vec, reject_vecs);
    }

    // ── Soft Gate (sigmoid) — Claim 8 ─────────────────────────────────────

    /**
     * Soft Gate with configurable steepness and threshold.
     * // RTP: HS-058 Claim 8
     */
    softGate(score, threshold, steepness) {
        // RTP: HS-058 Claim 8
        return soft_gate(
            score,
            threshold !== undefined ? threshold : this.defaultThreshold,
            steepness !== undefined ? steepness : this.defaultSteepness,
        );
    }

    // ── Statistics module — Claim 9(d) ────────────────────────────────────

    /**
     * Get gate invocation counts and average scores.
     * // RTP: HS-058 Claim 9(d)
     */
    getStats() {
        // RTP: HS-058 Claim 9(d)
        return getStats();
    }

    resetStats() {
        resetStats();
    }

    // ── Integration Replacement Points — Claim 10 ─────────────────────────

    /**
     * Vector Memory Density Gate: replaces boolean deduplication.
     * Returns continuous alignment — downstream decides with soft threshold.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: vector memory subsystem
     *
     * @param {number[]|Float32Array} newMemoryVec    — incoming memory embedding
     * @param {number[]|Float32Array} existingMemVec  — candidate existing memory
     * @param {number}               threshold        — deduplication threshold
     * @returns {{ isDuplicate: boolean, score: number, activation: number }}
     */
    vectorMemoryDensityGate(newMemoryVec, existingMemVec, threshold = 0.92) {
        // RTP: HS-058 Claim 10 — replaces discrete boolean deduplication
        const result = this.resonance(newMemoryVec, existingMemVec, threshold);
        return {
            isDuplicate: result.open,
            score:       result.score,
            activation:  result.activation,
        };
    }

    /**
     * Hybrid Search Score: replaces boolean similarity cutoffs.
     * Returns continuous relevance score.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: hybrid search subsystem
     *
     * @param {number[]|Float32Array}        queryVec    — query embedding
     * @param {Array<number[]|Float32Array>} docVecs     — document embeddings
     * @param {number}                       threshold   — relevance threshold
     * @returns {Array<{ index: number, score: number, activation: number, open: boolean }>}
     */
    hybridSearchScore(queryVec, docVecs, threshold = 0.5) {
        // RTP: HS-058 Claim 10 — replaces discrete cutoff in hybrid search
        return this.multiResonance(queryVec, docVecs, threshold);
    }

    /**
     * Hallucination Detection: replaces boolean confidence threshold.
     * Returns continuous alignment of agent output against mesh consensus.
     *
     * // RTP: HS-058 Claim 10 — replacement integration point: self-healing attestation mesh
     *
     * @param {number[]|Float32Array} agentOutputVec  — agent output embedding
     * @param {number[]|Float32Array} consensusVec    — mesh consensus vector
     * @param {number}               threshold        — hallucination threshold
     * @returns {{ score: number, activation: number, hallucinated: boolean }}
     */
    hallucinationDetectionGate(agentOutputVec, consensusVec, threshold = 0.7) {
        // RTP: HS-058 Claim 10 — replaces discrete hallucination detection in mesh
        const result = this.resonance(agentOutputVec, consensusVec, threshold);
        return {
            score:        result.score,
            activation:   result.activation,
            hallucinated: !result.open,
        };
    }

    // ── Shared math utilities (exposed for external callers) ───────────────

    cosineSimilarity(a, b) { return cosine_similarity(a, b); }
    dotProduct(a, b)       { return dot_product(a, b); }
    normalize(v)           { return normalize(v); }
    norm(v)                { return norm(v); }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    PHI,

    // Primitive math
    dot_product,
    norm,
    normalize,
    cosine_similarity,

    // Individual gate functions (functional API)
    soft_gate,
    resonance_gate,
    multi_resonance,
    superposition_gate,
    weighted_superposition,
    consensus_superposition,
    orthogonal_gate,
    batch_orthogonal,

    // Stats
    getStats,
    resetStats,

    // Full system class (OOP API)
    CSLSystem,

    // Convenience default instance with production defaults
    // RTP: HS-058 Claim 9 — instantiated full system
    defaultCSL: new CSLSystem({ threshold: 0.5, steepness: 20 }),
};

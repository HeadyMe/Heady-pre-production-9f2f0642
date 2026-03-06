/**
 * ─── Heady Continuous Semantic Logic (CSL) ──────────────────────────
 *
 * BLUEPRINT: Universal Vector Gates v2.0
 * Replace ALL discrete logic (0, 1) with infinite geometric continuity.
 *
 * THE 3 UNIVERSAL VECTOR GATES:
 *   1. Resonance Gate  (Semantic AND / IF)  — cosine similarity
 *   2. Superposition Gate (Semantic OR / MERGE) — vector fusion
 *   3. Orthogonal Gate (Semantic NOT / REJECT) — vector subtraction
 *
 * EXTENDED OPERATIONS:
 *   4. Weighted Superposition — biased fusion with α
 *   5. Multi-Resonance — score N vectors against a target
 *   6. Batch Orthogonal — strip multiple reject vectors in one pass
 *   7. Soft Gate — sigmoid activation (continuous, not boolean)
 *
 * Patent: PPA #52 — Continuous Semantic Logic Gates
 * ──────────────────────────────────────────────────────────────────
 */

// ── Stats Tracking ─────────────────────────────────────────────
const gateStats = {
    resonance: 0,
    superposition: 0,
    orthogonal: 0,
    softGate: 0,
    totalCalls: 0,
    avgResonanceScore: 0,
    _resonanceScoreSum: 0,
};

class HeadySemanticLogic {

    // ═══════════════════════════════════════════════════════════════
    // GATE 1: RESONANCE (The Semantic IF / AND)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Measures cosine similarity between two intents.
     * R(I, C) = (I · C) / (‖I‖ · ‖C‖)
     *
     * @param {number[]|Float32Array} vec_a - Intent A
     * @param {number[]|Float32Array} vec_b - Intent B
     * @param {number} threshold - Activation threshold (default 0.95)
     * @returns {{ score: number, open: boolean }}
     */
    static resonance_gate(vec_a, vec_b, threshold = 0.95) {
        const score = this.cosine_similarity(vec_a, vec_b);
        gateStats.resonance++;
        gateStats.totalCalls++;
        gateStats._resonanceScoreSum += score;
        gateStats.avgResonanceScore = gateStats._resonanceScoreSum / gateStats.resonance;
        return {
            score: +score.toFixed(6),
            open: score >= threshold,
        };
    }

    /**
     * Multi-Resonance: score N vectors simultaneously against a target.
     * Returns sorted array of { index, score, open } for each candidate.
     *
     * @param {number[]|Float32Array} target - The reference vector
     * @param {Array<number[]|Float32Array>} candidates - Array of vectors to score
     * @param {number} threshold - Activation threshold
     * @returns {Array<{ index: number, score: number, open: boolean }>}
     */
    static multi_resonance(target, candidates, threshold = 0.95) {
        return candidates
            .map((c, i) => {
                const score = this.cosine_similarity(target, c);
                gateStats.resonance++;
                gateStats.totalCalls++;
                gateStats._resonanceScoreSum += score;
                return { index: i, score: +score.toFixed(6), open: score >= threshold };
            })
            .sort((a, b) => b.score - a.score);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 2: SUPERPOSITION (The Semantic OR / MERGE)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Fuses two concepts into a brand-new hybrid intent.
     * S(T, A) = normalize(T + A)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @returns {Float32Array} Normalized hybrid vector
     */
    static superposition_gate(vec_a, vec_b) {
        const len = vec_a.length;
        const hybrid = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            hybrid[i] = vec_a[i] + vec_b[i];
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(hybrid);
    }

    /**
     * Weighted Superposition: biased fusion with factor α.
     * S(A, B, α) = normalize(α·A + (1-α)·B)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @param {number} alpha - Weight for vec_a (0.0 - 1.0), default 0.5
     * @returns {Float32Array} Normalized weighted hybrid vector
     */
    static weighted_superposition(vec_a, vec_b, alpha = 0.5) {
        const len = vec_a.length;
        const beta = 1.0 - alpha;
        const hybrid = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            hybrid[i] = alpha * vec_a[i] + beta * vec_b[i];
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(hybrid);
    }

    /**
     * N-way Superposition: fuse an array of vectors into a single consensus.
     * S(V₁, V₂, ... Vₙ) = normalize(Σ Vᵢ)
     *
     * @param {Array<number[]|Float32Array>} vectors - Array of vectors to fuse
     * @returns {Float32Array} Normalized consensus vector
     */
    static consensus_superposition(vectors) {
        if (!vectors || vectors.length === 0) return new Float32Array(0);
        const len = vectors[0].length;
        const fused = new Float32Array(len);
        for (const v of vectors) {
            for (let i = 0; i < len; i++) {
                fused[i] += v[i];
            }
        }
        gateStats.superposition++;
        gateStats.totalCalls++;
        return this.normalize(fused);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 3: ORTHOGONAL (The Semantic NOT / REJECT)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Strips the influence of reject_vec from target_vec.
     * O(T, L) = T - ((T·L)/(L·L)) · L
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {number[]|Float32Array} reject_vec - The intent to strip out
     * @returns {Float32Array} Purified orthogonal vector
     */
    static orthogonal_gate(target_vec, reject_vec) {
        const len = target_vec.length;
        const dotTR = this.dot_product(target_vec, reject_vec);
        const dotRR = this.dot_product(reject_vec, reject_vec);
        const projectionFactor = dotTR / (dotRR || 1e-10);

        const orthogonal = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            orthogonal[i] = target_vec[i] - (projectionFactor * reject_vec[i]);
        }
        gateStats.orthogonal++;
        gateStats.totalCalls++;
        return this.normalize(orthogonal);
    }

    /**
     * Batch Orthogonal: strip multiple reject vectors in one pass.
     * Iteratively projects out each rejection vector.
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {Array<number[]|Float32Array>} reject_vecs - Array of intents to strip
     * @returns {Float32Array} Purified vector with all rejections removed
     */
    static batch_orthogonal(target_vec, reject_vecs) {
        let current = Float32Array.from(target_vec);
        for (const reject of reject_vecs) {
            const dotTR = this.dot_product(current, reject);
            const dotRR = this.dot_product(reject, reject);
            const factor = dotTR / (dotRR || 1e-10);
            for (let i = 0; i < current.length; i++) {
                current[i] -= factor * reject[i];
            }
        }
        gateStats.orthogonal++;
        gateStats.totalCalls++;
        return this.normalize(current);
    }

    // ═══════════════════════════════════════════════════════════════
    // SOFT GATE — Continuous sigmoid activation
    // ═══════════════════════════════════════════════════════════════

    /**
     * Soft Gate: returns a continuous activation value [0, 1]
     * instead of a hard boolean. Uses sigmoid around the threshold.
     *
     * σ(x) = 1 / (1 + e^(-k(x - threshold)))
     *
     * @param {number} score - The raw cosine similarity score
     * @param {number} threshold - Center of the sigmoid (default 0.5)
     * @param {number} steepness - How sharp the transition is (default 20)
     * @returns {number} Continuous activation between 0 and 1
     */
    static soft_gate(score, threshold = 0.5, steepness = 20) {
        gateStats.softGate++;
        gateStats.totalCalls++;
        return 1.0 / (1.0 + Math.exp(-steepness * (score - threshold)));
    }

    // ═══════════════════════════════════════════════════════════════
    // VECTOR MATH PRIMITIVES (shared by all gates)
    // ═══════════════════════════════════════════════════════════════

    static dot_product(a, b) {
        let dot = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            dot += a[i] * b[i];
        }
        return dot;
    }

    static norm(v) {
        let sum = 0;
        for (let i = 0; i < v.length; i++) {
            sum += v[i] * v[i];
        }
        return Math.sqrt(sum);
    }

    static normalize(v) {
        const n = this.norm(v);
        if (n < 1e-10) return v;
        const res = new Float32Array(v.length);
        for (let i = 0; i < v.length; i++) {
            res[i] = v[i] / n;
        }
        return res;
    }

    /**
     * Cosine similarity — the foundational metric of CSL.
     * All gates reduce to this geometric measure.
     */
    static cosine_similarity(a, b) {
        if (!a || !b || a.length === 0 || b.length === 0) return 0;
        const dot = this.dot_product(a, b);
        const normA = this.norm(a);
        const normB = this.norm(b);
        return dot / (normA * normB || 1e-10);
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 5: TERNARY (Continuous {-1, 0, +1} Classification)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Ternary Gate: maps a continuous confidence score to {-1, 0, +1}
     * using dual sigmoid boundaries instead of hard thresholds.
     *
     * Returns the discrete state PLUS the continuous activation values
     * so downstream systems preserve the geometric magnitude.
     *
     * @param {number} score - Raw confidence/similarity (0.0 - 1.0)
     * @param {number} resonanceThreshold - Center for +1 sigmoid (default 0.72)
     * @param {number} repelThreshold - Center for -1 sigmoid (default 0.35)
     * @param {number} steepness - Sigmoid steepness (default 15)
     * @returns {{ state: -1|0|+1, resonanceActivation: number, repelActivation: number, raw: number }}
     */
    static ternary_gate(score, resonanceThreshold = 0.72, repelThreshold = 0.35, steepness = 15) {
        const resonanceActivation = this.soft_gate(score, resonanceThreshold, steepness);
        const repelActivation = 1.0 - this.soft_gate(score, repelThreshold, steepness);

        let state;
        if (resonanceActivation >= 0.5) {
            state = +1;  // Core Resonance
        } else if (repelActivation >= 0.5) {
            state = -1;  // Repel
        } else {
            state = 0;   // Ephemeral / Epistemic Hold
        }

        gateStats.totalCalls++;
        return { state, resonanceActivation: +resonanceActivation.toFixed(6), repelActivation: +repelActivation.toFixed(6), raw: score };
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 6: RISK (Trading-Specific Continuous Risk Evaluation)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Risk Gate: evaluates trading risk as a continuous activation.
     * Maps proximity-to-limit ratios through sigmoid to produce
     * smooth risk curves instead of hard cutoffs.
     *
     * @param {number} current - Current value (equity, P&L, etc.)
     * @param {number} limit - The hard limit/threshold
     * @param {number} sensitivity - How early the alarm activates (default 0.8 = at 80%)
     * @param {number} steepness - Sigmoid steepness (default 12)
     * @returns {{ riskLevel: number, signal: -1|0|+1, proximity: number, activation: number }}
     */
    static risk_gate(current, limit, sensitivity = 0.8, steepness = 12) {
        const proximity = Math.abs(current) / (Math.abs(limit) || 1e-10);
        const activation = this.soft_gate(proximity, sensitivity, steepness);

        // Map to ternary: high activation = danger
        const ternary = this.ternary_gate(1.0 - activation, 0.5, 0.2, steepness);

        gateStats.totalCalls++;
        return {
            riskLevel: +activation.toFixed(6),
            signal: ternary.state,
            proximity: +proximity.toFixed(6),
            activation: +activation.toFixed(6),
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // GATE 7: ROUTE (Multi-Candidate Routing via Ranked Resonance)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Route Gate: selects the best candidate from a set using
     * multi-resonance scoring with soft gate activation.
     * Used for model selection, service routing, bee dispatch.
     *
     * @param {number[]|Float32Array} intent - The intent/query vector
     * @param {Array<{id: string, vector: number[]|Float32Array}>} candidates - Named candidates
     * @param {number} threshold - Minimum activation to be considered (default 0.3)
     * @returns {{ best: string|null, scores: Array<{id: string, score: number, activation: number}>, fallback: boolean }}
     */
    static route_gate(intent, candidates, threshold = 0.3) {
        const scores = candidates.map(c => {
            const score = this.cosine_similarity(intent, c.vector);
            const activation = this.soft_gate(score, threshold, 10);
            return { id: c.id, score: +score.toFixed(6), activation: +activation.toFixed(6) };
        }).sort((a, b) => b.score - a.score);

        const viable = scores.filter(s => s.activation >= 0.5);
        gateStats.totalCalls++;

        return {
            best: viable.length > 0 ? viable[0].id : null,
            scores,
            fallback: viable.length === 0,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // STATUS & DIAGNOSTICS
    // ═══════════════════════════════════════════════════════════════

    static getStats() {
        return {
            ...gateStats,
            avgResonanceScore: gateStats.resonance > 0
                ? +(gateStats._resonanceScoreSum / gateStats.resonance).toFixed(4)
                : 0,
        };
    }

    static resetStats() {
        gateStats.resonance = 0;
        gateStats.superposition = 0;
        gateStats.orthogonal = 0;
        gateStats.softGate = 0;
        gateStats.totalCalls = 0;
        gateStats.avgResonanceScore = 0;
        gateStats._resonanceScoreSum = 0;
    }
}

// Export both the class and a singleton for convenience
module.exports = HeadySemanticLogic;
module.exports.CSL = HeadySemanticLogic;

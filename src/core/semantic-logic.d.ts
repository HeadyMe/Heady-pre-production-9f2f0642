export = HeadySemanticLogic;
declare class HeadySemanticLogic {
    /**
     * Measures cosine similarity between two intents.
     * R(I, C) = (I · C) / (‖I‖ · ‖C‖)
     *
     * @param {number[]|Float32Array} vec_a - Intent A
     * @param {number[]|Float32Array} vec_b - Intent B
     * @param {number} threshold - Activation threshold (default 0.95)
     * @returns {{ score: number, open: boolean }}
     */
    static resonance_gate(vec_a: number[] | Float32Array, vec_b: number[] | Float32Array, threshold?: number): {
        score: number;
        open: boolean;
    };
    /**
     * Multi-Resonance: score N vectors simultaneously against a target.
     * Returns sorted array of { index, score, open } for each candidate.
     *
     * @param {number[]|Float32Array} target - The reference vector
     * @param {Array<number[]|Float32Array>} candidates - Array of vectors to score
     * @param {number} threshold - Activation threshold
     * @returns {Array<{ index: number, score: number, open: boolean }>}
     */
    static multi_resonance(target: number[] | Float32Array, candidates: Array<number[] | Float32Array>, threshold?: number): Array<{
        index: number;
        score: number;
        open: boolean;
    }>;
    /**
     * Fuses two concepts into a brand-new hybrid intent.
     * S(T, A) = normalize(T + A)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @returns {Float32Array} Normalized hybrid vector
     */
    static superposition_gate(vec_a: number[] | Float32Array, vec_b: number[] | Float32Array): Float32Array;
    /**
     * Weighted Superposition: biased fusion with factor α.
     * S(A, B, α) = normalize(α·A + (1-α)·B)
     *
     * @param {number[]|Float32Array} vec_a - Concept A
     * @param {number[]|Float32Array} vec_b - Concept B
     * @param {number} alpha - Weight for vec_a (0.0 - 1.0), default 0.5
     * @returns {Float32Array} Normalized weighted hybrid vector
     */
    static weighted_superposition(vec_a: number[] | Float32Array, vec_b: number[] | Float32Array, alpha?: number): Float32Array;
    /**
     * N-way Superposition: fuse an array of vectors into a single consensus.
     * S(V₁, V₂, ... Vₙ) = normalize(Σ Vᵢ)
     *
     * @param {Array<number[]|Float32Array>} vectors - Array of vectors to fuse
     * @returns {Float32Array} Normalized consensus vector
     */
    static consensus_superposition(vectors: Array<number[] | Float32Array>): Float32Array;
    /**
     * Strips the influence of reject_vec from target_vec.
     * O(T, L) = T - ((T·L)/(L·L)) · L
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {number[]|Float32Array} reject_vec - The intent to strip out
     * @returns {Float32Array} Purified orthogonal vector
     */
    static orthogonal_gate(target_vec: number[] | Float32Array, reject_vec: number[] | Float32Array): Float32Array;
    /**
     * Batch Orthogonal: strip multiple reject vectors in one pass.
     * Iteratively projects out each rejection vector.
     *
     * @param {number[]|Float32Array} target_vec - The base intent
     * @param {Array<number[]|Float32Array>} reject_vecs - Array of intents to strip
     * @returns {Float32Array} Purified vector with all rejections removed
     */
    static batch_orthogonal(target_vec: number[] | Float32Array, reject_vecs: Array<number[] | Float32Array>): Float32Array;
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
    static soft_gate(score: number, threshold?: number, steepness?: number): number;
    static dot_product(a: any, b: any): number;
    static norm(v: any): number;
    static normalize(v: any): any;
    /**
     * Cosine similarity — the foundational metric of CSL.
     * All gates reduce to this geometric measure.
     */
    static cosine_similarity(a: any, b: any): number;
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
    static ternary_gate(score: number, resonanceThreshold?: number, repelThreshold?: number, steepness?: number): {
        state: -1 | 0 | any;
    };
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
    static risk_gate(current: number, limit: number, sensitivity?: number, steepness?: number): {
        riskLevel: number;
        signal: -1 | 0 | any;
    };
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
    static route_gate(intent: number[] | Float32Array, candidates: Array<{
        id: string;
        vector: number[] | Float32Array;
    }>, threshold?: number): {
        best: string | null;
        scores: Array<{
            id: string;
            score: number;
            activation: number;
        }>;
        fallback: boolean;
    };
    static getStats(): {
        avgResonanceScore: number;
        resonance: number;
        superposition: number;
        orthogonal: number;
        softGate: number;
        totalCalls: number;
        _resonanceScoreSum: number;
    };
    static resetStats(): void;
}
declare namespace HeadySemanticLogic {
    export { HeadySemanticLogic as CSL };
}
//# sourceMappingURL=semantic-logic.d.ts.map
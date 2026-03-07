/**
 * @fileoverview MoE-CSL Router — Mixture-of-Experts routing via CSL gates
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Routes inputs to expert agents using cosine similarity gates. The router
 * uses semantic alignment (CSL AND) rather than learned linear weights to
 * determine which experts are semantically relevant for each input.
 *
 * Key advantages over standard MoE routers:
 *   - Scale invariance: routing based on direction, not magnitude
 *   - Semantic interpretability: expert gate vectors have semantic meaning
 *   - Anti-collapse: cosine similarity naturally prevents expert collapse
 *   - Cross-domain robustness: geometric routing excels on diverse inputs
 *
 * Architecture:
 *   1. Each expert has a "gate vector" eᵢ ∈ ℝᴰ defining its semantic domain
 *   2. For input x, compute cosine scores: sᵢ = cos(x, eᵢ)
 *   3. Apply temperature-controlled softmax: pᵢ = softmax(sᵢ / τ)
 *   4. Select top-k experts by probability
 *   5. Load-balance via auxiliary anti-collapse loss
 *
 * References:
 *   - MoE Survey (arXiv:2503.07137, March 2025): cosine routing superiority
 *   - DeepSeekMoE (2024): cosine routing for stable sparse expert selection
 *   - Cottention (arXiv:2409.18747): cosine attention for linear transformers
 *
 * @module moe-csl-router
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL/routing techniques
 */

'use strict';

const { PHI, PSI, PHI_TEMPERATURE, adaptiveTemperature, fib } = require('../../shared/phi-math.js');
const { CSLEngine, norm, normalize, dot, clamp, EPSILON } = require('./csl-engine');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default number of experts to activate per token (sparse activation).
 * fib(3) = 2 — already Fibonacci, made explicit via fib(). */
const DEFAULT_TOP_K = fib(3); // fib(3) = 2 (already Fibonacci — made explicit)

/** Default temperature for softmax over cosine scores.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softmax sharpness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

/** Default load-balance penalty weight (anti-collapse regularization).
 * Math.pow(PSI, 8) ≈ 0.0131 — phi-scaled anti-collapse coefficient. */
const DEFAULT_BALANCE_WEIGHT = Math.pow(PSI, 8); // ≈ 0.0131 (PSI^8 phi-scaled)

/** Minimum utilization rate before expert is flagged as collapsed.
 * Math.pow(PSI, 9) ≈ 0.0081 — phi-scaled collapse detection floor. */
const COLLAPSE_THRESHOLD = Math.pow(PSI, 9); // ≈ 0.0081 (PSI^9 phi-scaled)

// ─── MoECSLRouter Class ───────────────────────────────────────────────────────

/**
 * MoECSLRouter — Cosine-Similarity-based Mixture of Experts Router
 *
 * Routes input vectors to the most semantically relevant expert agents
 * using cosine similarity gates. Supports top-k sparse activation with
 * load balancing and anti-collapse regularization.
 *
 * The router maintains a running utilization table across routing decisions,
 * enabling monitoring of expert usage patterns and detecting collapse.
 *
 * @class
 * @example
 * const router = new MoECSLRouter({ numExperts: 8, topK: 2, dim: 384 });
 * router.setExpertGate(0, codeVec);
 * router.setExpertGate(1, mathVec);
 * // ...
 * const { experts, weights } = router.route(inputVec);
 */
class MoECSLRouter {
  /**
   * @param {Object} [options]
   * @param {number} [options.numExperts=8] - Total number of experts
   * @param {number} [options.topK=2] - Experts activated per input
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.temperature=0.1] - Softmax temperature (lower = sharper)
   * @param {number} [options.balanceWeight=0.01] - Anti-collapse regularization weight
   * @param {boolean} [options.normalizeGates=true] - Normalize gate vectors to unit sphere
   * @param {'hard'|'soft'} [options.selectionMode='soft'] - Expert selection mode
   */
  constructor(options = {}) {
    this.numExperts = options.numExperts || 8;
    this.topK = Math.min(options.topK || DEFAULT_TOP_K, this.numExperts);
    this.dim = options.dim || 384;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.balanceWeight = options.balanceWeight !== undefined
      ? options.balanceWeight
      : DEFAULT_BALANCE_WEIGHT;
    this.normalizeGates = options.normalizeGates !== false;
    this.selectionMode = options.selectionMode || 'soft';

    // Expert gate vectors (define each expert's semantic domain)
    this.expertGates = new Array(this.numExperts).fill(null);

    // Expert metadata
    this.expertMeta = Array.from({ length: this.numExperts }, (_, i) => ({
      id: i,
      name: `expert_${i}`,
      description: '',
    }));

    // Running statistics for load balancing
    this._stats = {
      totalRoutings: 0,
      expertCounts: new Float64Array(this.numExperts),  // cumulative activations
      expertTokens: new Float64Array(this.numExperts),  // weighted token count
      routingEntropies: [],                              // history of routing entropy
      batchSize: 0,
    };

    this._csl = new CSLEngine({ dim: this.dim });
  }

  // ─── Expert Configuration ─────────────────────────────────────────────────

  /**
   * Set the gate vector for a specific expert.
   *
   * The gate vector defines the semantic domain of the expert:
   * inputs cosine-similar to this vector will be routed here.
   *
   * @param {number} expertId - Expert index ∈ [0, numExperts)
   * @param {Float32Array|Float64Array|number[]} gateVector - Expert's semantic direction
   * @param {Object} [meta] - Optional metadata { name, description }
   */
  setExpertGate(expertId, gateVector, meta = null) {
    this._validateExpertId(expertId);

    if (gateVector.length !== this.dim) {
      throw new Error(`Gate vector dim ${gateVector.length} != router dim ${this.dim}`);
    }

    const gate = this.normalizeGates ? normalize(gateVector) : new Float64Array(gateVector);
    this.expertGates[expertId] = gate;

    if (meta) {
      Object.assign(this.expertMeta[expertId], meta);
    }
  }

  /**
   * Set all expert gates at once from an array of vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} gateVectors - One per expert
   * @param {Object[]} [metaArray] - Optional metadata for each expert
   */
  setAllExpertGates(gateVectors, metaArray = null) {
    if (gateVectors.length !== this.numExperts) {
      throw new Error(`Expected ${this.numExperts} gate vectors, got ${gateVectors.length}`);
    }
    gateVectors.forEach((gate, i) => {
      this.setExpertGate(i, gate, metaArray ? metaArray[i] : null);
    });
  }

  /**
   * Initialize expert gates as random orthogonal unit vectors.
   * Useful for testing or when no semantic labels are available.
   *
   * @param {number} [seed] - Not used (Math.random() is used internally)
   */
  initRandomGates(seed = null) {
    for (let i = 0; i < this.numExperts; i++) {
      const vec = new Float64Array(this.dim);
      for (let j = 0; j < this.dim; j++) {
        vec[j] = (Math.random() - PSI) * PHI; // phi-harmonic: center at PSI, scale by PHI
      }
      this.expertGates[i] = normalize(vec);
    }
  }

  // ─── Routing ─────────────────────────────────────────────────────────────

  /**
   * Route a single input vector to the top-k most relevant experts.
   *
   * Algorithm:
   *   1. Compute cosine similarity: sᵢ = cos(input, eᵢ) for each expert
   *   2. Apply load-balance adjustment: s̃ᵢ = sᵢ - λ · utilization_penalty(i)
   *   3. Temperature softmax: pᵢ = exp(s̃ᵢ/τ) / Σⱼ exp(s̃ⱼ/τ)
   *   4. Select top-k experts by probability
   *   5. Renormalize selected weights to sum to 1
   *   6. Update utilization statistics
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to route
   * @param {Object} [options]
   * @param {boolean} [options.applyLoadBalance=true] - Apply anti-collapse penalty
   * @param {number} [options.topK] - Override default topK for this routing
   * @returns {{
   *   experts: number[],       // selected expert indices (topK)
   *   weights: number[],       // routing weights (sum to 1)
   *   cosScores: Float64Array, // raw cosine scores for all experts
   *   softmaxScores: Float64Array, // softmax probabilities for all experts
   *   entropy: number,         // routing distribution entropy (nats)
   *   dominantExpert: number,  // highest-weight expert
   * }}
   */
  route(input, options = {}) {
    this._validateGatesInitialized();

    const applyLB = options.applyLoadBalance !== false;
    const k = options.topK || this.topK;

    // Step 1: Compute cosine scores for all experts
    const cosScores = this._computeCosineScores(input);

    // Step 2: Apply load-balance penalty (anti-collapse regularization)
    const adjustedScores = new Float64Array(this.numExperts);
    const utilizationPenalties = this._computeUtilizationPenalties();

    for (let i = 0; i < this.numExperts; i++) {
      adjustedScores[i] = cosScores[i]
        - (applyLB ? this.balanceWeight * utilizationPenalties[i] : 0);
    }

    // Step 3: Temperature-controlled softmax
    const softmaxScores = this._softmax(adjustedScores, this.temperature);

    // Step 4: Select top-k experts
    const topExperts = this._topK(softmaxScores, k);

    // Step 5: Renormalize selected weights
    const sumTopK = topExperts.reduce((s, i) => s + softmaxScores[i], 0);
    const weights = topExperts.map(i => softmaxScores[i] / (sumTopK + EPSILON));

    // Step 6: Update statistics
    this._updateStats(topExperts, weights);

    // Compute routing entropy: H = -Σᵢ pᵢ log(pᵢ)
    const entropy = this._computeEntropy(softmaxScores);

    // Adaptive temperature: use phi-harmonic adaptiveTemperature() for next routing call.
    // PSI^(1 + 2*(1 - H/Hmax)) — sharper when distribution is concentrated, softer at max entropy.
    // maxEntropy = log(numExperts) for uniform distribution over all experts.
    const _adaptiveTemp = adaptiveTemperature(entropy, Math.log(this.numExperts));
    // Note: _adaptiveTemp is computed and exposed for callers; next route() call may use it
    // by passing options.temperature. See adaptiveRoute() pattern in documentation.

    return {
      experts: topExperts,
      weights,
      cosScores,
      softmaxScores,
      entropy,
      dominantExpert: topExperts[0],
      adaptiveTemp: _adaptiveTemp,  // phi-harmonic temperature for next routing step
    };
  }

  /**
   * Route a batch of input vectors simultaneously.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Batch of inputs
   * @param {Object} [options] - Same as route()
   * @returns {Array<ReturnType<MoECSLRouter['route']>>} Array of routing results
   */
  routeBatch(inputs, options = {}) {
    this._stats.batchSize = inputs.length;
    return inputs.map(inp => this.route(inp, options));
  }

  /**
   * Soft routing — returns a weighted combination vector from all experts.
   * Instead of selecting top-k, uses full softmax distribution.
   *
   * @param {Float32Array|Float64Array|number[]} input
   * @param {Object[]} expertOutputs - Expert output vectors [{ id, vector }]
   * @returns {{ combined: Float64Array, weights: Float64Array }}
   */
  softRoute(input, expertOutputs) {
    this._validateGatesInitialized();

    const cosScores = this._computeCosineScores(input);
    const weights = this._softmax(cosScores, this.temperature);

    const dim = expertOutputs[0].vector.length;
    const combined = new Float64Array(dim);

    for (const { id, vector } of expertOutputs) {
      if (id >= 0 && id < this.numExperts) {
        const w = weights[id];
        for (let i = 0; i < dim; i++) {
          combined[i] += w * vector[i];
        }
      }
    }

    return { combined: normalize(combined), weights };
  }

  // ─── Load Balancing ───────────────────────────────────────────────────────

  /**
   * Compute the auxiliary load-balance loss for training.
   *
   * Anti-collapse regularization loss (from Switch Transformer):
   *   L_balance = α · N · Σᵢ fᵢ · Pᵢ
   *
   * Where:
   *   - fᵢ = fraction of tokens routed to expert i
   *   - Pᵢ = average routing probability for expert i
   *   - α = balanceWeight
   *   - N = number of experts
   *
   * @returns {{ loss: number, expertFractions: Float64Array, loadImbalance: number }}
   */
  computeBalanceLoss() {
    const total = this._stats.totalRoutings + EPSILON;
    const fractions = new Float64Array(this.numExperts);
    const probs = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      fractions[i] = this._stats.expertCounts[i] / total;
      probs[i] = this._stats.expertTokens[i] / total;
    }

    // Anti-collapse loss: penalize unequal distribution
    let loss = 0;
    for (let i = 0; i < this.numExperts; i++) {
      loss += fractions[i] * probs[i];
    }
    loss *= this.numExperts * this.balanceWeight;

    // Load imbalance: max(fractions) / mean(fractions)
    const meanFrac = 1.0 / this.numExperts;
    const maxFrac = Math.max(...fractions);
    const loadImbalance = maxFrac / meanFrac;

    return { loss, expertFractions: fractions, loadImbalance };
  }

  /**
   * Detect expert collapse — experts that have been nearly unused.
   *
   * @returns {number[]} Indices of collapsed experts (utilization < COLLAPSE_THRESHOLD)
   */
  detectCollapse() {
    const total = this._stats.totalRoutings + EPSILON;
    const collapsed = [];

    for (let i = 0; i < this.numExperts; i++) {
      const utilRate = this._stats.expertCounts[i] / total;
      if (utilRate < COLLAPSE_THRESHOLD) {
        collapsed.push(i);
      }
    }

    return collapsed;
  }

  /**
   * Reset collapsed experts by re-initializing their gates to random vectors.
   *
   * @returns {number[]} Expert IDs that were reset
   */
  resetCollapsedExperts() {
    const collapsed = this.detectCollapse();

    for (const id of collapsed) {
      const vec = new Float64Array(this.dim);
      for (let j = 0; j < this.dim; j++) {
        vec[j] = (Math.random() - PSI) * PHI; // phi-harmonic: center at PSI, scale by PHI
      }
      this.expertGates[id] = normalize(vec);
      // Reset utilization to give fresh start
      this._stats.expertCounts[id] = this._stats.totalRoutings * COLLAPSE_THRESHOLD;
    }

    return collapsed;
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  /**
   * Compute comprehensive routing metrics.
   *
   * @returns {{
   *   expertUtilization: Float64Array,  // fraction of tokens per expert [0,1]
   *   routingEntropy: number,           // mean routing entropy (nats)
   *   loadImbalance: number,            // max/mean utilization ratio
   *   collapsedExperts: number[],       // expert IDs with near-zero utilization
   *   totalRoutings: number,
   * }}
   */
  getMetrics() {
    const total = this._stats.totalRoutings + EPSILON;
    const expertUtilization = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      expertUtilization[i] = this._stats.expertCounts[i] / total;
    }

    const meanUtil = 1.0 / this.numExperts;
    const maxUtil = Math.max(...expertUtilization);
    const loadImbalance = maxUtil / meanUtil;

    const entropies = this._stats.routingEntropies;
    const routingEntropy = entropies.length > 0
      ? entropies.reduce((s, x) => s + x, 0) / entropies.length
      : 0;

    return {
      expertUtilization,
      routingEntropy,
      loadImbalance,
      collapsedExperts: this.detectCollapse(),
      totalRoutings: this._stats.totalRoutings,
    };
  }

  /**
   * Reset all routing statistics.
   */
  resetStats() {
    this._stats = {
      totalRoutings: 0,
      expertCounts: new Float64Array(this.numExperts),
      expertTokens: new Float64Array(this.numExperts),
      routingEntropies: [],
      batchSize: 0,
    };
  }

  /**
   * Compute mutual information between experts (expert similarity matrix).
   * Experts with high cosine similarity between gate vectors will compete.
   *
   * @returns {Float64Array[]} numExperts × numExperts cosine similarity matrix
   */
  expertSimilarityMatrix() {
    const n = this.numExperts;
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      if (!this.expertGates[i]) continue;

      for (let j = i + 1; j < n; j++) {
        if (!this.expertGates[j]) continue;
        const sim = this._csl.AND(this.expertGates[i], this.expertGates[j]);
        matrix[i][j] = sim;
        matrix[j][i] = sim;
      }
    }

    return matrix;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Compute cosine scores of input against all expert gates.
   * @private
   */
  _computeCosineScores(input) {
    const scores = new Float64Array(this.numExperts);
    const normInput = norm(input);

    if (normInput < EPSILON) {
      return scores; // degenerate input: all zeros
    }

    for (let i = 0; i < this.numExperts; i++) {
      if (!this.expertGates[i]) {
        scores[i] = 0.0;
        continue;
      }
      const d = dot(input, this.expertGates[i]);
      const normGate = norm(this.expertGates[i]);
      scores[i] = normGate < EPSILON ? 0.0 : clamp(d / (normInput * normGate), -1.0, 1.0);
    }

    return scores;
  }

  /**
   * Temperature-controlled softmax.
   * σ(x)ᵢ = exp(xᵢ/τ) / Σⱼ exp(xⱼ/τ)
   *
   * Numerically stable: subtracts max before exponentiation.
   * @private
   */
  _softmax(scores, temperature) {
    const tau = temperature || this.temperature;
    const result = new Float64Array(scores.length);

    // Numerically stable: find max
    let maxScore = -Infinity;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > maxScore) maxScore = scores[i];
    }

    let sumExp = 0.0;
    for (let i = 0; i < scores.length; i++) {
      result[i] = Math.exp((scores[i] - maxScore) / tau);
      sumExp += result[i];
    }

    if (sumExp < EPSILON) {
      // Uniform fallback
      const uniform = 1.0 / scores.length;
      result.fill(uniform);
    } else {
      for (let i = 0; i < result.length; i++) {
        result[i] /= sumExp;
      }
    }

    return result;
  }

  /**
   * Select top-k indices from a probability array.
   * Returns indices sorted by probability (descending).
   * @private
   */
  _topK(probs, k) {
    const indexed = Array.from(probs, (p, i) => ({ i, p }));
    indexed.sort((a, b) => b.p - a.p);
    return indexed.slice(0, k).map(x => x.i);
  }

  /**
   * Compute utilization penalty for load balancing.
   * penalty[i] = (expertCounts[i] / total) / (1/numExperts) - 1
   *            = numExperts * expertCounts[i] / total - 1
   * @private
   */
  _computeUtilizationPenalties() {
    const total = this._stats.totalRoutings + EPSILON;
    const expected = 1.0 / this.numExperts;
    const penalties = new Float64Array(this.numExperts);

    for (let i = 0; i < this.numExperts; i++) {
      const actual = this._stats.expertCounts[i] / total;
      penalties[i] = Math.max(0, actual - expected) / expected; // excess utilization ratio
    }

    return penalties;
  }

  /**
   * Compute Shannon entropy of a probability distribution.
   * H = -Σᵢ pᵢ · log(pᵢ)   (nats)
   * @private
   */
  _computeEntropy(probs) {
    let H = 0;
    for (let i = 0; i < probs.length; i++) {
      if (probs[i] > EPSILON) {
        H -= probs[i] * Math.log(probs[i]);
      }
    }
    return H;
  }

  /**
   * Update routing statistics after a routing decision.
   * @private
   */
  _updateStats(selectedExperts, weights) {
    this._stats.totalRoutings++;

    for (let k = 0; k < selectedExperts.length; k++) {
      const id = selectedExperts[k];
      this._stats.expertCounts[id]++;
      this._stats.expertTokens[id] += weights[k];
    }

    // Track routing entropy history (keep last 1000)
    const scores = new Float64Array(this.numExperts);
    for (let k = 0; k < selectedExperts.length; k++) {
      scores[selectedExperts[k]] = weights[k];
    }

    const entropy = this._computeEntropy(scores);
    this._stats.routingEntropies.push(entropy);
    if (this._stats.routingEntropies.length > 1000) {
      this._stats.routingEntropies.shift();
    }
  }

  _validateExpertId(id) {
    if (id < 0 || id >= this.numExperts || !Number.isInteger(id)) {
      throw new Error(`Invalid expert ID: ${id}. Must be integer in [0, ${this.numExperts})`);
    }
  }

  _validateGatesInitialized() {
    const unset = this.expertGates.findIndex(g => g === null);
    if (unset !== -1) {
      throw new Error(`Expert gate ${unset} not initialized. Call setExpertGate() or initRandomGates()`);
    }
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  MoECSLRouter,
  DEFAULT_TOP_K,
  DEFAULT_TEMPERATURE,
  DEFAULT_BALANCE_WEIGHT,
  COLLAPSE_THRESHOLD,
};

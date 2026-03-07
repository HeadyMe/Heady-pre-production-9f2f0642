/**
 * @fileoverview CSL Engine — Continuous Semantic Logic
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Core innovation: vector geometry as logical gates operating in 384-dimensional
 * (or 1536-dimensional) embedding space. All logic is geometric: alignment,
 * superposition, orthogonal projection, and cosine activation.
 *
 * Mathematical Foundation:
 *   - Domain: unit vectors in ℝᴰ, D ∈ {384, 1536}
 *   - Truth value: τ(a, b) = cos(θ) = (a·b) / (‖a‖·‖b‖) ∈ [-1, +1]
 *   - +1 = fully aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)
 *
 * References:
 *   - Birkhoff & von Neumann (1936): "The Logic of Quantum Mechanics"
 *   - Widdows (2003): "Orthogonal Negation in Vector Spaces" — ACL 2003
 *   - Grand et al. (2022): "Semantic projection" — Nature Human Behaviour
 *   - Fagin, Riegel, Gray (2024): "Foundations of reasoning with uncertainty" — PNAS
 *
 * @module csl-engine
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL techniques
 */

import { PHI, PSI, PHI_TEMPERATURE, CSL_THRESHOLDS, phiThreshold, EPSILON as PHI_EPSILON, adaptiveTemperature } from '../../shared/phi-math.js';

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default vector dimension for standard embedding models (e.g., all-MiniLM-L6-v2) */
const DEFAULT_DIM = 384;

/** Extended dimension for high-fidelity models (e.g., text-embedding-3-large) */
const LARGE_DIM = 1536;

/** Numerical epsilon: prevents division-by-zero and detects near-zero vectors.
 * Sourced from shared/phi-math.js PHI_EPSILON (same 1e-10 value, unified constant). */
const EPSILON = PHI_EPSILON; // from shared/phi-math.js

/** Threshold below which a vector is considered near-zero (degenerate) */
const ZERO_NORM_THRESHOLD = 1e-8;

/** Default gate threshold τ for GATE operation.
 * CSL_THRESHOLDS.MINIMUM ≈ 0.500 — noise floor for geometric truth activation. */
const DEFAULT_GATE_THRESHOLD = CSL_THRESHOLDS.MINIMUM; // ≈ 0.500 (CSL noise floor)

/** Default temperature τ for soft gating / softmax operations.
 * PHI_TEMPERATURE = PSI^3 ≈ 0.236 — phi-harmonic softness. */
const DEFAULT_TEMPERATURE = PHI_TEMPERATURE; // PSI^3 ≈ 0.236

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Compute the L2 norm (Euclidean length) of a vector.
 *
 * Formula: ‖a‖ = √(Σᵢ aᵢ²)
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {number} L2 norm ≥ 0
 */
function norm(a) {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length (project onto unit hypersphere Sᴰ⁻¹).
 *
 * Formula: â = a / ‖a‖
 *
 * Returns the zero vector if ‖a‖ < ZERO_NORM_THRESHOLD (degenerate case).
 *
 * @param {Float32Array|Float64Array|number[]} a - Input vector
 * @returns {Float64Array} Unit vector, or zero vector if degenerate
 */
function normalize(a) {
  const n = norm(a);
  const result = new Float64Array(a.length);
  if (n < ZERO_NORM_THRESHOLD) {
    return result; // zero vector — caller should handle
  }
  const invN = 1.0 / n;
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * invN;
  }
  return result;
}

/**
 * Compute the dot product of two equal-length vectors.
 *
 * Formula: a·b = Σᵢ aᵢ·bᵢ
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {number} Scalar dot product
 * @throws {Error} If vectors have different lengths
 */
function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Clamp a value to the interval [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Add two vectors element-wise and return a new Float64Array.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorAdd(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] + b[i];
  }
  return result;
}

/**
 * Subtract vector b from a element-wise.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {Float32Array|Float64Array|number[]} b
 * @returns {Float64Array}
 */
function vectorSub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

/**
 * Scale a vector by a scalar.
 *
 * @param {Float32Array|Float64Array|number[]} a
 * @param {number} scalar
 * @returns {Float64Array}
 */
function vectorScale(a, scalar) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] * scalar;
  }
  return result;
}

// ─── CSLEngine Class ──────────────────────────────────────────────────────────

/**
 * CSLEngine — Continuous Semantic Logic Engine
 *
 * Implements all CSL logical gates as pure geometric operations on high-dimensional
 * vectors. All operations work on raw (unnormalized) input vectors and handle
 * normalization internally unless otherwise noted.
 *
 * All gate methods:
 *   1. Accept Float32Array, Float64Array, or number[] inputs
 *   2. Return Float64Array for gate outputs (or number for scalar outputs)
 *   3. Include full numerical stability handling
 *   4. Support batch operation via the batch* prefix methods
 *
 * @class
 * @example
 * const engine = new CSLEngine({ dim: 384 });
 * const score = engine.AND(vectorA, vectorB);     // cosine similarity ∈ [-1,1]
 * const union = engine.OR(vectorA, vectorB);       // normalized superposition
 * const negated = engine.NOT(vectorA, vectorB);    // semantic negation
 */
class CSLEngine {
  /** Golden ratio constant — accessible on class for downstream phi-arithmetic */
  static PHI = PHI;
  /** Golden ratio conjugate (1/Φ = Φ-1) — accessible on class */
  static PSI = PSI;

  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.gateThreshold=0.0] - Default threshold τ for GATE
   * @param {number} [options.temperature=1.0] - Default temperature for soft gates
   * @param {boolean} [options.normalizeInputs=true] - Auto-normalize inputs
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.epsilon = options.epsilon || EPSILON;
    this.gateThreshold = options.gateThreshold !== undefined
      ? options.gateThreshold
      : DEFAULT_GATE_THRESHOLD;
    this.temperature = options.temperature || DEFAULT_TEMPERATURE;
    this.normalizeInputs = options.normalizeInputs !== false;

    // Runtime statistics for monitoring
    this._stats = {
      operationCount: 0,
      degenerateVectors: 0,
      gateActivations: 0,
    };
  }

  // ─── Core Gate Operations ──────────────────────────────────────────────────

  /**
   * CSL AND — Measures semantic alignment between two concept vectors.
   *
   * Mathematical formula:
   *   AND(a, b) = cos(θ_{a,b}) = (a·b) / (‖a‖·‖b‖)
   *
   * Interpretation:
   *   - Result ∈ [-1, +1]
   *   - +1: concepts are fully aligned ("both true in the same direction")
   *   - 0:  concepts are orthogonal ("independent / no relationship")
   *   - -1: concepts are antipodal ("contradictory / one negates the other")
   *
   * Logical analogy: "a AND b is true" ↔ cos(a, b) close to +1.
   * This is the soft AND: high only when both concepts are co-aligned.
   *
   * Properties:
   *   - Commutative: AND(a,b) = AND(b,a)
   *   - Bounded: result ∈ [-1, +1]
   *   - Scale invariant: AND(λa, b) = AND(a, b) for λ > 0
   *
   * Reference: Birkhoff & von Neumann (1936), quantum logic inner product.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {number} Cosine similarity ∈ [-1, +1]
   */
  AND(a, b) {
    this._stats.operationCount++;
    const normA = norm(a);
    const normB = norm(b);

    if (normA < this.epsilon || normB < this.epsilon) {
      this._stats.degenerateVectors++;
      return 0.0; // degenerate: zero vectors are orthogonal to everything
    }

    const dotProduct = dot(a, b);
    return clamp(dotProduct / (normA * normB), -1.0, 1.0);
  }

  /**
   * CSL OR — Computes semantic superposition (soft union) of two concepts.
   *
   * Mathematical formula:
   *   OR(a, b) = normalize(a + b)
   *
   * The sum a + b creates a vector similar to both a and b — capturing the
   * "union" of semantic content. Normalization returns the result to the unit
   * sphere for subsequent operations.
   *
   * Interpretation:
   *   - The result vector points "between" a and b on the hypersphere
   *   - Its cosine similarity to both a and b is positive
   *   - For orthogonal a, b: result is at 45° to both (equal similarity)
   *   - For identical a = b: result is identical to a (idempotent in direction)
   *
   * Logical analogy: "a OR b" is the direction that captures either concept.
   *
   * Properties:
   *   - Commutative: OR(a,b) = OR(b,a)
   *   - Returns unit vector on Sᴰ⁻¹
   *   - Degenerate when a ≈ -b (antiparallel): returns zero vector
   *
   * Reference: HDC bundling operation; Boolean IR vector addition.
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized superposition vector (unit length)
   */
  OR(a, b) {
    this._stats.operationCount++;
    const sum = vectorAdd(a, b);
    const n = norm(sum);

    if (n < this.epsilon) {
      this._stats.degenerateVectors++;
      // a ≈ -b: concepts cancel. Return zero vector to signal cancellation.
      return new Float64Array(a.length);
    }

    return vectorScale(sum, 1.0 / n);
  }

  /**
   * CSL NOT — Semantic negation via orthogonal projection.
   *
   * Mathematical formula:
   *   NOT(a, b) = a - proj_b(a) = a - (a·b / ‖b‖²) · b
   *
   * For unit vectors ‖b‖ = 1:
   *   NOT(a, b) = a - (a·b) · b
   *
   * The result is the component of a that is orthogonal to b — removing
   * the semantic content of b from a.
   *
   * Interpretation:
   *   - "NOT(a, b)" means "a, but not the part that overlaps with b"
   *   - Example: NOT(cat_vector, persian_vector) → cat vector minus Persian traits
   *   - The result has zero cosine similarity with b (by construction)
   *   - Residual magnitude: ‖NOT(a,b)‖ = ‖a‖·sin(θ_{a,b})
   *
   * Idempotency:
   *   NOT(NOT(a,b), b) ≈ NOT(a,b) because the result is already in b⊥.
   *   More precisely: the projection of NOT(a,b) onto b is ≈ 0, so subtracting
   *   proj_b again leaves it unchanged. (Full proof in csl-mathematical-proofs.md)
   *
   * Similarity after negation (for normalized a, b):
   *   a · NOT(a, b) = 1 - (a·b)²
   *
   * Reference: Widdows (2003), ACL 2003, "Orthogonal Negation in Vector Spaces"
   *
   * @param {Float32Array|Float64Array|number[]} a - Query/source vector
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate/remove
   * @param {boolean} [returnNormalized=true] - Whether to normalize the result
   * @returns {Float64Array} Vector with b's semantic content removed
   */
  NOT(a, b, returnNormalized = true) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      // b is near-zero: nothing to project out, return a (optionally normalized)
      return returnNormalized ? normalize(a) : new Float64Array(a);
    }

    // Projection coefficient: (a·b) / ‖b‖²
    const projCoeff = dot(a, b) / normBSq;

    // Remove projection: a - projCoeff·b
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - projCoeff * b[i];
    }

    if (returnNormalized) {
      return normalize(result);
    }
    return result;
  }

  /**
   * CSL IMPLY — Geometric material implication via projection.
   *
   * Mathematical formula:
   *   IMPLY(a, b) = proj_b(a) = (a·b / ‖b‖²) · b
   *
   * For unit vectors:
   *   IMPLY(a, b) = (a·b) · b    [scalar times unit vector]
   *
   * The projection of a onto b captures "how much of a is contained in b" —
   * the geometric analog of material implication: degree to which a implies b.
   *
   * Interpretation:
   *   - Large projection → a strongly implies b (concepts highly co-directional)
   *   - Zero projection → a and b are independent (no implication)
   *   - Negative projection → a implies NOT b (antiparallel)
   *
   * Scalar implication strength: IMPLY_scalar(a,b) = a·b / ‖b‖ = cos(θ)·‖a‖
   *
   * Reference: Grand et al. (2022) semantic projection; Birkhoff-von Neumann.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent vector (hypothesis)
   * @param {Float32Array|Float64Array|number[]} b - Consequent vector (conclusion)
   * @returns {Float64Array} Projection of a onto span(b)
   */
  IMPLY(a, b) {
    this._stats.operationCount++;
    const normBSq = dot(b, b); // ‖b‖²

    if (normBSq < this.epsilon) {
      return new Float64Array(a.length); // zero consequent: no implication
    }

    const projCoeff = dot(a, b) / normBSq;
    return vectorScale(b, projCoeff);
  }

  /**
   * Scalar implication strength — returns the signed magnitude of implication.
   *
   * Formula: IMPLY_strength(a, b) = (a·b) / (‖a‖·‖b‖) = cos(θ_{a,b})
   *
   * Equivalent to AND(a, b) — the cosine similarity *is* the implication strength.
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Implication strength ∈ [-1, +1]
   */
  IMPLY_scalar(a, b) {
    return this.AND(a, b);
  }

  /**
   * CSL XOR — Exclusive semantic content (symmetric difference).
   *
   * Mathematical formula:
   *   XOR(a, b) = normalize(a + b) - proj_mutual(a, b)
   *
   * More precisely, for unit vectors:
   *   XOR(a, b) = normalize( (a - proj_b(a)) + (b - proj_a(b)) )
   *             = normalize( a_⊥b + b_⊥a )
   *
   * Where a_⊥b is the component of a orthogonal to b (exclusive to a),
   * and b_⊥a is the component of b orthogonal to a (exclusive to b).
   *
   * Interpretation:
   *   - XOR captures what is unique to each concept (symmetric difference)
   *   - When a ≈ b: both exclusive components → 0, XOR → zero vector
   *   - When a ⊥ b: exclusive components = full vectors, XOR ≈ normalize(a + b)
   *   - "a XOR b" = concepts that appear in one but not both
   *
   * Properties:
   *   - Commutative: XOR(a,b) = XOR(b,a)
   *   - Anti-idempotent: XOR(a,a) → zero vector
   *
   * @param {Float32Array|Float64Array|number[]} a - First concept vector
   * @param {Float32Array|Float64Array|number[]} b - Second concept vector
   * @returns {Float64Array} Normalized exclusive semantic content
   */
  XOR(a, b) {
    this._stats.operationCount++;

    // a_⊥b: component of a orthogonal to b (NOT(a, b) unnormalized)
    const normBSq = dot(b, b);
    const normASq = dot(a, a);

    if (normASq < this.epsilon || normBSq < this.epsilon) {
      this._stats.degenerateVectors++;
      return new Float64Array(a.length);
    }

    const projAonB = dot(a, b) / normBSq;
    const projBonA = dot(a, b) / normASq; // Note: dot(b,a) = dot(a,b)

    // a_⊥b = a - proj_b(a)
    // b_⊥a = b - proj_a(b)
    const exclusive = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const a_excl = a[i] - projAonB * b[i];
      const b_excl = b[i] - projBonA * a[i];
      exclusive[i] = a_excl + b_excl;
    }

    const n = norm(exclusive);
    if (n < this.epsilon) {
      return new Float64Array(a.length); // a ≈ b: no exclusive content
    }

    return vectorScale(exclusive, 1.0 / n);
  }

  /**
   * CSL CONSENSUS — Weighted mean of agent/concept vectors (agreement).
   *
   * Mathematical formula:
   *   CONSENSUS({aᵢ}, {wᵢ}) = normalize( Σᵢ wᵢ · aᵢ )
   *
   * Uniform weights (default):
   *   CONSENSUS({aᵢ}) = normalize( (1/n) Σᵢ aᵢ )
   *
   * Interpretation:
   *   - Result is the centroid direction on the unit hypersphere
   *   - ‖Σ wᵢaᵢ‖ before normalization measures consensus strength:
   *     → ≈ 1: strong agreement (vectors nearly aligned)
   *     → ≈ 0: strong disagreement (vectors cancel out)
   *   - Consensus Quality metric: R = ‖(1/n)Σaᵢ‖ ∈ [0,1]
   *
   * Properties:
   *   - Commutative: order of vectors doesn't matter
   *   - Weights must be non-negative (negative weights invert contribution)
   *   - Returns zero vector when agents completely disagree
   *
   * Reference: HDC bundling operation; Roundtable Policy (arXiv 2509.16839)
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors - Agent opinion vectors
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ consensus: Float64Array, strength: number }}
   *   consensus: normalized consensus vector
   *   strength: R ∈ [0,1] measuring agreement level
   */
  CONSENSUS(vectors, weights = null) {
    this._stats.operationCount++;

    if (!vectors || vectors.length === 0) {
      throw new Error('CONSENSUS requires at least one vector');
    }

    const dim = vectors[0].length;
    const n = vectors.length;

    // Validate weights
    let w = weights;
    if (!w) {
      w = new Array(n).fill(1.0 / n);
    } else {
      if (w.length !== n) {
        throw new Error(`Weights length ${w.length} != vectors length ${n}`);
      }
      // Normalize weights to sum to 1
      const wSum = w.reduce((s, x) => s + x, 0);
      if (wSum < this.epsilon) {
        throw new Error('Weights must have positive sum');
      }
      w = w.map(x => x / wSum);
    }

    // Weighted sum
    const sum = new Float64Array(dim);
    for (let j = 0; j < n; j++) {
      const vec = vectors[j];
      const wj = w[j];
      for (let i = 0; i < dim; i++) {
        sum[i] += wj * vec[i];
      }
    }

    // Measure consensus strength before normalizing
    const strength = norm(sum);

    if (strength < this.epsilon) {
      this._stats.degenerateVectors++;
      return {
        consensus: new Float64Array(dim),
        strength: 0.0,
      };
    }

    const consensus = vectorScale(sum, 1.0 / strength);
    return { consensus, strength: clamp(strength, 0, 1) };
  }

  /**
   * CSL GATE — Threshold activation function using cosine similarity.
   *
   * Mathematical formula:
   *   GATE(input, gate_vector, τ) = θ( cos(input, gate_vector) - τ )
   *
   * Where θ is the Heaviside step function (hard gate) or sigmoid (soft gate):
   *   Hard:  GATE = 1  if cos(input, gate_vector) ≥ τ, else 0
   *   Soft:  GATE = σ( (cos(input, gate_vector) - τ) / temperature )
   *
   * The gate_vector defines a semantic "topic direction" in embedding space.
   * Inputs aligned with this direction (above threshold τ) pass the gate.
   *
   * Properties:
   *   - Bounded output: hard ∈ {0,1}, soft ∈ (0,1)
   *   - Scale invariant: GATE(λ·input, gate_vector, τ) = GATE(input, gate_vector, τ)
   *   - Differentiable (soft gate only)
   *   - Valid activation function: monotone, bounded, Lipschitz-continuous (soft)
   *
   * Proof that soft GATE is a valid activation function:
   *   (See csl-mathematical-proofs.md §4: CSL GATE Activation Properties)
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector to gate
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [threshold=0.0] - Threshold τ ∈ [-1, +1]
   * @param {'hard'|'soft'} [mode='hard'] - Hard (step) or soft (sigmoid) gate
   * @param {number} [temperature=1.0] - Temperature for soft gate sharpness
   * @returns {{ activation: number, cosScore: number }}
   *   activation: gate output ∈ {0,1} (hard) or (0,1) (soft)
   *   cosScore: raw cosine similarity before thresholding
   */
  GATE(input, gateVector, threshold = null, mode = 'hard', temperature = null) {
    this._stats.operationCount++;

    const tau = threshold !== null ? threshold : this.gateThreshold;
    const temp = temperature !== null ? temperature : this.temperature;

    const cosScore = this.AND(input, gateVector);
    const shifted = cosScore - tau;

    let activation;
    if (mode === 'hard') {
      activation = shifted >= 0 ? 1 : 0;
    } else {
      // Soft (sigmoid) gate: σ(x) = 1 / (1 + e^{-x/temp})
      activation = 1.0 / (1.0 + Math.exp(-shifted / temp));
    }

    if (activation > 0) this._stats.gateActivations++;

    return { activation, cosScore };
  }

  /**
   * CSL NAND — NOT AND: semantic incompatibility gate.
   *
   * Formula: NAND(a, b) = 1 - max(0, AND(a, b))
   *          Maps high alignment → low output; low alignment → high output.
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {number} NAND score ∈ [0, 1]
   */
  NAND(a, b) {
    const andScore = this.AND(a, b);
    return 1.0 - Math.max(0, andScore);
  }

  /**
   * CSL NOR — NOT OR: semantic exclusion gate.
   *
   * Returns normalized vector pointing away from the OR superposition.
   * Semantically: the concept that is distinct from both a and b.
   *
   * Formula: NOR(a,b) = normalize( -(a + b) )
   *                   = negate( OR(a, b) )
   *
   * @param {Float32Array|Float64Array|number[]} a
   * @param {Float32Array|Float64Array|number[]} b
   * @returns {Float64Array} Antipodal to OR(a,b)
   */
  NOR(a, b) {
    this._stats.operationCount++;
    const orVec = this.OR(a, b);
    return vectorScale(orVec, -1.0);
  }

  // ─── Projection Utilities ──────────────────────────────────────────────────

  /**
   * Project vector a onto the subspace spanned by a set of basis vectors.
   *
   * Uses Gram-Schmidt orthogonalization for numerical stability.
   *
   * Formula: proj_B(a) = Σᵢ (a·eᵢ) eᵢ
   * where {eᵢ} is an orthonormal basis for span(B), computed via Gram-Schmidt.
   *
   * @param {Float32Array|Float64Array|number[]} a - Vector to project
   * @param {Array<Float32Array|Float64Array|number[]>} basisVectors - Spanning set
   * @returns {Float64Array} Projection of a onto span(basisVectors)
   */
  projectOntoSubspace(a, basisVectors) {
    if (!basisVectors || basisVectors.length === 0) {
      return new Float64Array(a.length);
    }

    const dim = a.length;
    // Gram-Schmidt orthogonalization of basisVectors
    const orthoBasis = [];

    for (let j = 0; j < basisVectors.length; j++) {
      let vec = new Float64Array(basisVectors[j]);

      // Remove components along existing orthobasis
      for (const e of orthoBasis) {
        const coeff = dot(vec, e);
        for (let i = 0; i < dim; i++) {
          vec[i] -= coeff * e[i];
        }
      }

      const n = norm(vec);
      if (n > this.epsilon) {
        const unitVec = vectorScale(vec, 1.0 / n);
        orthoBasis.push(unitVec);
      }
    }

    // Project a onto orthobasis
    const projection = new Float64Array(dim);
    for (const e of orthoBasis) {
      const coeff = dot(a, e);
      for (let i = 0; i < dim; i++) {
        projection[i] += coeff * e[i];
      }
    }

    return projection;
  }

  /**
   * NOT against a subspace (multiple semantic concepts removed simultaneously).
   *
   * Formula: NOT(a, B) = a - proj_B(a)
   *
   * Removes all semantic content in span{b₁,...,bₙ} from a.
   *
   * @param {Float32Array|Float64Array|number[]} a - Source vector
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Concepts to remove
   * @param {boolean} [returnNormalized=true]
   * @returns {Float64Array}
   */
  NOT_subspace(a, bVectors, returnNormalized = true) {
    this._stats.operationCount++;
    const projection = this.projectOntoSubspace(a, bVectors);
    const result = vectorSub(a, projection);
    return returnNormalized ? normalize(result) : result;
  }

  // ─── Batch Operations ──────────────────────────────────────────────────────

  /**
   * Batch AND — Compute cosine similarity of one vector against many.
   *
   * GPU-friendly: equivalent to a matrix-vector multiplication.
   * M[j] = a · B[j] / (‖a‖ · ‖B[j]‖) for each row B[j] in the matrix.
   *
   * @param {Float32Array|Float64Array|number[]} a - Query vector (1 × dim)
   * @param {Array<Float32Array|Float64Array|number[]>} bVectors - Corpus vectors (n × dim)
   * @returns {Float64Array} Similarity scores (n,) ∈ [-1,+1]
   */
  batchAND(a, bVectors) {
    const normA = norm(a);
    if (normA < this.epsilon) {
      return new Float64Array(bVectors.length);
    }

    const result = new Float64Array(bVectors.length);
    for (let j = 0; j < bVectors.length; j++) {
      const normB = norm(bVectors[j]);
      if (normB < this.epsilon) {
        result[j] = 0.0;
        continue;
      }
      result[j] = clamp(dot(a, bVectors[j]) / (normA * normB), -1.0, 1.0);
    }
    return result;
  }

  /**
   * Batch NOT — Remove concept b from an array of source vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors - Source vectors
   * @param {Float32Array|Float64Array|number[]} b - Concept to negate
   * @param {boolean} [returnNormalized=true]
   * @returns {Array<Float64Array>} Array of negated vectors
   */
  batchNOT(aVectors, b, returnNormalized = true) {
    return aVectors.map(a => this.NOT(a, b, returnNormalized));
  }

  /**
   * Batch GATE — Apply semantic gate to an array of input vectors.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} inputs - Input vectors
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction
   * @param {number} [threshold=0.0] - Threshold τ
   * @param {'hard'|'soft'} [mode='hard']
   * @returns {Array<{ activation: number, cosScore: number }>}
   */
  batchGATE(inputs, gateVector, threshold = null, mode = 'hard') {
    return inputs.map(inp => this.GATE(inp, gateVector, threshold, mode));
  }

  /**
   * Batch IMPLY — Compute projection of each input onto the consequent.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} aVectors
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {Array<Float64Array>} Projections
   */
  batchIMPLY(aVectors, b) {
    return aVectors.map(a => this.IMPLY(a, b));
  }

  // ─── Advanced Logical Compositions ────────────────────────────────────────

  /**
   * CSL CONDITIONAL — Soft conditional probability: P(b|a) via geometric Bayes.
   *
   * Formula: P(b|a) ≈ AND(a,b) / AND(a,a) = cos(a,b) / 1 = cos(a,b)
   *          [for normalized vectors, this reduces to AND]
   *
   * For asymmetric conditional, use the projection magnitude:
   *   P(b|a) ≈ ‖proj_b(a)‖ / ‖a‖ = |cos(a,b)|
   *
   * @param {Float32Array|Float64Array|number[]} a - Antecedent
   * @param {Float32Array|Float64Array|number[]} b - Consequent
   * @returns {number} Conditional alignment ∈ [0, 1]
   */
  CONDITIONAL(a, b) {
    return Math.abs(this.AND(a, b));
  }

  /**
   * CSL ANALOGY — Completes an analogy: "a is to b as c is to ?"
   *
   * Formula: d = normalize( b - a + c )
   *   [vector arithmetic analogy, as in word2vec: king - man + woman ≈ queen]
   *
   * @param {Float32Array|Float64Array|number[]} a - Source concept
   * @param {Float32Array|Float64Array|number[]} b - Target concept
   * @param {Float32Array|Float64Array|number[]} c - Query concept
   * @returns {Float64Array} Analogy completion vector
   */
  ANALOGY(a, b, c) {
    this._stats.operationCount++;
    // d = normalize(b - a + c)
    const diff = vectorSub(b, a);
    const result = vectorAdd(diff, c);
    return normalize(result);
  }

  /**
   * Compute pairwise AND (cosine similarity matrix) for a set of vectors.
   *
   * Returns a symmetric matrix M where M[i][j] = cos(vectors[i], vectors[j]).
   * GPU-friendly: equivalent to normalized matrix multiplication V @ Vᵀ.
   *
   * @param {Array<Float32Array|Float64Array|number[]>} vectors
   * @returns {Float64Array[]} n×n cosine similarity matrix (row-major)
   */
  pairwiseAND(vectors) {
    const n = vectors.length;
    const norms = vectors.map(v => norm(v));

    // Pre-allocate n×n matrix as array of Float64Arrays
    const matrix = Array.from({ length: n }, () => new Float64Array(n));

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0; // self-similarity
      for (let j = i + 1; j < n; j++) {
        const d = dot(vectors[i], vectors[j]);
        const normIJ = norms[i] * norms[j];
        const sim = normIJ < this.epsilon ? 0.0 : clamp(d / normIJ, -1.0, 1.0);
        matrix[i][j] = sim;
        matrix[j][i] = sim; // symmetric
      }
    }

    return matrix;
  }

  // ─── Statistics and Introspection ─────────────────────────────────────────

  /**
   * Retrieve runtime operation statistics.
   *
   * @returns {{ operationCount: number, degenerateVectors: number, gateActivations: number }}
   */
  getStats() {
    return { ...this._stats };
  }

  /**
   * Reset runtime statistics.
   */
  resetStats() {
    this._stats = { operationCount: 0, degenerateVectors: 0, gateActivations: 0 };
  }

  // ─── Phi-Harmonic Gate Extensions ───────────────────────────────────────────────

  /**
   * Phi-harmonic GATE — uses phiThreshold(level) from phi-math.js as threshold.
   *
   * phiThreshold(level) = 1 - PSI^level * 0.5:
   *   level=1 ≈ 0.691 (CSL LOW)
   *   level=2 ≈ 0.809 (CSL MEDIUM)
   *   level=3 ≈ 0.882 (CSL HIGH)
   *
   * Provides a geometrically scaled activation threshold aligned with
   * the sacred geometry resource allocation tiers.
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} [level=2] - Phi threshold level (1–4)
   * @param {'hard'|'soft'} [mode='hard'] - Gate mode
   * @returns {{ activation: number, cosScore: number, threshold: number }}
   */
  phiGATE(input, gateVector, level = 2, mode = 'hard') {
    const threshold = phiThreshold(level); // e.g. level=2 ≈ 0.809 (MEDIUM)
    const result = this.GATE(input, gateVector, threshold, mode);
    return { ...result, threshold };
  }

  /**
   * Adaptive GATE — uses adaptiveTemperature(entropy, maxEntropy) for dynamic softness.
   *
   * Temperature = PSI^(1 + 2*(1 - H/Hmax)) from phi-math.js.
   * At max entropy (uniform distribution): temperature ≈ PSI (softest).
   * At zero entropy (deterministic):       temperature ≈ PSI^3 (sharpest = PHI_TEMPERATURE).
   *
   * @param {Float32Array|Float64Array|number[]} input - Input vector
   * @param {Float32Array|Float64Array|number[]} gateVector - Gate direction vector
   * @param {number} entropy - Current routing entropy H (nats)
   * @param {number} maxEntropy - Maximum possible entropy Hmax = log(numExperts)
   * @returns {{ activation: number, cosScore: number, temperature: number }}
   */
  adaptiveGATE(input, gateVector, entropy, maxEntropy) {
    const temperature = adaptiveTemperature(entropy, maxEntropy);
    const result = this.GATE(input, gateVector, null, 'soft', temperature);
    return { ...result, temperature };
  }

  /**
   * Validate that a vector has the expected dimension and no NaN/Inf values.
   *
   * @param {Float32Array|Float64Array|number[]} vector
   * @param {number} [expectedDim] - Expected dimension (defaults to this.dim)
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validateVector(vector, expectedDim = null) {
    const issues = [];
    const dim = expectedDim || this.dim;

    if (!vector || vector.length === 0) {
      issues.push('Vector is empty or null');
    } else {
      if (vector.length !== dim) {
        issues.push(`Dimension mismatch: got ${vector.length}, expected ${dim}`);
      }

      let hasNaN = false;
      let hasInf = false;
      for (let i = 0; i < vector.length; i++) {
        if (Number.isNaN(vector[i])) hasNaN = true;
        if (!Number.isFinite(vector[i])) hasInf = true;
      }
      if (hasNaN) issues.push('Vector contains NaN values');
      if (hasInf) issues.push('Vector contains Inf values');

      const n = norm(vector);
      if (n < ZERO_NORM_THRESHOLD) {
        issues.push('Vector is near-zero (degenerate)');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  CSLEngine,
  // Export utility functions for external use
  norm,
  normalize,
  dot,
  clamp,
  vectorAdd,
  vectorSub,
  vectorScale,
  // Export constants
  DEFAULT_DIM,
  LARGE_DIM,
  EPSILON,
  ZERO_NORM_THRESHOLD,
};

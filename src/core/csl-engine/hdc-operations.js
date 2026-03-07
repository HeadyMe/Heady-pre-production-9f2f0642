/**
 * @fileoverview HDC Operations — Hyperdimensional Computing
 *
 * Heady Latent OS — Section 5: CSL & Geometric AI
 *
 * Implements the Vector Symbolic Architecture (VSA) algebra for distributed
 * representation and reasoning. HDC operations form the substrate for encoding
 * structured knowledge (records, sequences, graphs) as single high-dimensional
 * vectors that can be composed, queried, and compared in O(D) time.
 *
 * Mathematical Foundation:
 *   - Domain: binary {0,1}ᴰ or real-valued ℝᴰ vectors
 *   - Primary operations: BIND (⊗), BUNDLE (+), PERMUTE (Π)
 *   - Near-orthogonality: in D=10000-dim binary space, random vectors have
 *     Hamming distance ≈ D/2 ± √(D/4) — essentially orthogonal
 *
 * Supported VSA Families:
 *   - BSC (Binary Spatter Code): binary {0,1}ᴰ, XOR binding, majority bundling
 *   - MAP (Multiply-Add-Permute): bipolar {-1,+1}ᴰ, multiply binding
 *   - HRR (Holographic Reduced Representations): real ℝᴰ, circular convolution
 *
 * References:
 *   - Kanerva (2009): "Hyperdimensional Computing: An Introduction"
 *   - Plate (1995): "Holographic Reduced Representations" — IEEE Trans. NN
 *   - Kleyko et al. (2021): "VSA as a Computing Framework" — arXiv:2106.05268
 *   - Gayler (2003/2009): "Vector Symbolic Architectures" — MAP architecture
 *   - Large-Margin HDC (2026): arXiv:2603.03830 — HDC ↔ SVM equivalence
 *
 * @module hdc-operations
 * @version 1.0.0
 * @patent Heady Connection — 60+ provisional patents on CSL/HDC techniques
 */

'use strict';

const { norm, normalize, dot, clamp, vectorAdd, vectorScale, EPSILON } = require('./csl-engine');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default dimension for standard embedding models */
const DEFAULT_DIM = 384;

/** Large dimension for high-fidelity models */
const LARGE_DIM = 1536;

/** Bundle capacity rule of thumb: N_max ≈ 0.1 · D / log(D) */
function bundleCapacity(dim) {
  return Math.floor(0.1 * dim / Math.log(dim));
}

// ─── HDCOperations Class ──────────────────────────────────────────────────────

/**
 * HDCOperations — Hyperdimensional Computing Operations
 *
 * Provides all core VSA operations for both binary ({0,1}^D) and real-valued
 * (ℝᴰ) hypervectors. Each operation has mathematically defined properties
 * that support distributed representation of complex data structures.
 *
 * The three primitive operations form a complete algebra:
 *   1. BIND  (⊗): Associates two concepts → result dissimilar to both
 *   2. BUNDLE (+): Combines concepts → result similar to all components
 *   3. PERMUTE (Π): Encodes position/role → structure-preserving reordering
 *
 * These three operations can represent any data structure:
 *   - Key-value records: H = (k₁⊗v₁) + (k₂⊗v₂) + ...
 *   - Sequences: S = v₁ + Π(v₂) + Π²(v₃) + ...
 *   - Trees/graphs: Hierarchical binding chains
 *
 * @class
 * @example
 * const hdc = new HDCOperations({ dim: 384, type: 'real' });
 * const codebook = hdc.generateCodebook(['cat', 'dog', 'bird'], 384);
 * const catVec = hdc.ENCODE('cat', codebook);
 * const bound = hdc.BIND(catVec, hdc.randomVector(384));
 * const bundle = hdc.BUNDLE([catVec, dogVec, birdVec]);
 */
class HDCOperations {
  /**
   * @param {Object} [options]
   * @param {number} [options.dim=384] - Vector dimension D
   * @param {'binary'|'bipolar'|'real'} [options.type='real'] - Vector type
   * @param {number} [options.epsilon=1e-10] - Numerical stability epsilon
   * @param {number} [options.nnRadius=0.45] - Nearest-neighbor search radius for DECODE
   */
  constructor(options = {}) {
    this.dim = options.dim || DEFAULT_DIM;
    this.type = options.type || 'real';
    this.epsilon = options.epsilon || EPSILON;
    this.nnRadius = options.nnRadius !== undefined ? options.nnRadius : 0.45;

    // Validate type
    if (!['binary', 'bipolar', 'real'].includes(this.type)) {
      throw new Error(`Unknown HDC type: ${this.type}. Use 'binary', 'bipolar', or 'real'`);
    }
  }

  // ─── Random Vector Generation ─────────────────────────────────────────────

  /**
   * Generate a random hypervector of the configured type.
   *
   * Binary {0,1}^D: each component i.i.d. Bernoulli(0.5)
   * Bipolar {-1,+1}^D: each component i.i.d. ±1 with equal probability
   * Real ℝ^D: each component i.i.d. N(0, 1/D), then normalized
   *
   * Near-orthogonality guarantee: for D ≥ 1000, any two random vectors have
   *   E[similarity] = 0,  Var[similarity] = O(1/D)
   *
   * @param {number} [dim] - Dimension (defaults to this.dim)
   * @param {'binary'|'bipolar'|'real'} [type] - Type (defaults to this.type)
   * @returns {Float64Array|Uint8Array} Random hypervector
   */
  randomVector(dim = null, type = null) {
    const d = dim || this.dim;
    const t = type || this.type;

    if (t === 'binary') {
      const vec = new Uint8Array(d);
      for (let i = 0; i < d; i++) {
        vec[i] = Math.random() < 0.5 ? 0 : 1;
      }
      return vec;
    } else if (t === 'bipolar') {
      const vec = new Float64Array(d);
      for (let i = 0; i < d; i++) {
        vec[i] = Math.random() < 0.5 ? -1.0 : 1.0;
      }
      return vec;
    } else {
      // Real: N(0, 1/D), then L2-normalized for unit sphere
      const vec = new Float64Array(d);
      const scale = 1.0 / Math.sqrt(d);
      for (let i = 0; i < d; i++) {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        vec[i] = scale * Math.sqrt(-2.0 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
      }
      return normalize(vec);
    }
  }

  // ─── BIND Operation ───────────────────────────────────────────────────────

  /**
   * BIND — Associate two hypervectors to form a new, dissimilar hypervector.
   *
   * The BIND operation creates an association between two concepts. The result
   * is dissimilar to both operands (crucial property) but encodes their
   * relationship. BIND is invertible: A ⊗ B ⊗ B⁻¹ ≈ A.
   *
   * Implementations by type:
   *
   * Binary XOR:
   *   BIND(a, b)[i] = a[i] XOR b[i]
   *   Properties: a ⊗ b ⊗ b = a (exact inverse), commutative, associative
   *   Inverse: b⁻¹ = b (XOR is self-inverse)
   *
   * Bipolar multiply:
   *   BIND(a, b)[i] = a[i] · b[i]
   *   Properties: a ⊗ b ⊗ b = a (exact inverse), commutative, associative
   *   Inverse: b⁻¹ = b (self-inverse since b[i] ∈ {-1,+1})
   *
   * Real circular convolution (HRR):
   *   BIND(a, b)[k] = Σⱼ a[j] · b[(k-j) mod D]   (circular convolution)
   *   Computed via FFT in O(D log D)
   *   Properties: commutative, associative, approximate inverse via conjugation
   *   Inverse: b⁻¹ = [b[0], b[D-1], b[D-2], ..., b[1]]  (reversal)
   *
   * Reference: Plate (1995) HRR; Kanerva (2009) spatter code
   *
   * @param {Float64Array|Uint8Array|number[]} a - First hypervector
   * @param {Float64Array|Uint8Array|number[]} b - Second hypervector
   * @param {'xor'|'multiply'|'convolution'} [method] - Binding method (auto-detected from type)
   * @returns {Float64Array|Uint8Array} Bound hypervector
   */
  BIND(a, b, method = null) {
    if (a.length !== b.length) {
      throw new Error(`BIND dimension mismatch: ${a.length} vs ${b.length}`);
    }
    const d = a.length;

    // Auto-detect method if not specified
    const m = method || (this.type === 'binary' ? 'xor'
      : this.type === 'bipolar' ? 'multiply'
      : 'convolution');

    if (m === 'xor') {
      // Binary XOR binding
      const result = new Uint8Array(d);
      for (let i = 0; i < d; i++) {
        result[i] = (a[i] ^ b[i]) & 1; // XOR, mask to 1 bit
      }
      return result;

    } else if (m === 'multiply') {
      // Bipolar multiplication
      const result = new Float64Array(d);
      for (let i = 0; i < d; i++) {
        result[i] = a[i] * b[i];
      }
      return result;

    } else {
      // Real circular convolution via direct O(D²) or via FFT-like approach
      // For D=384/1536, direct computation is acceptable
      return this._circularConvolution(a, b);
    }
  }

  /**
   * BIND inverse — Recover a from BIND(a,b) given b.
   *
   * For binary/bipolar: inverse is BIND(result, b) [self-inverse]
   * For real HRR: inverse uses the conjugate (reversal) of b
   *
   * @param {Float64Array|Uint8Array|number[]} bound - Bound vector BIND(a, b)
   * @param {Float64Array|Uint8Array|number[]} b - One of the operands
   * @param {'xor'|'multiply'|'convolution'} [method]
   * @returns {Float64Array|Uint8Array} Approximate reconstruction of a
   */
  BIND_inverse(bound, b, method = null) {
    const m = method || (this.type === 'binary' ? 'xor'
      : this.type === 'bipolar' ? 'multiply'
      : 'convolution');

    if (m === 'xor' || m === 'multiply') {
      // Self-inverse: BIND(bound, b) = a
      return this.BIND(bound, b, m);
    } else {
      // HRR inverse: use conjugate (reversal) of b
      const d = b.length;
      const bInv = new Float64Array(d);
      bInv[0] = b[0];
      for (let i = 1; i < d; i++) {
        bInv[i] = b[d - i];
      }
      return this._circularConvolution(bound, bInv);
    }
  }

  /**
   * Circular convolution for HRR binding.
   *
   * Formula: (a ⊛ b)[k] = Σⱼ a[j] · b[(k-j) mod D]
   *
   * This is equivalent to element-wise multiplication in the DFT domain:
   *   FFT(a ⊛ b) = FFT(a) · FFT(b)
   *
   * For D=384, direct O(D²) is ~147K multiplications, acceptable for
   * single operations. For batch operations, FFT would be preferred.
   *
   * @private
   * @param {Float64Array|number[]} a
   * @param {Float64Array|number[]} b
   * @returns {Float64Array}
   */
  _circularConvolution(a, b) {
    const d = a.length;
    const result = new Float64Array(d);

    for (let k = 0; k < d; k++) {
      let sum = 0.0;
      for (let j = 0; j < d; j++) {
        const idx = ((k - j) % d + d) % d; // circular index
        sum += a[j] * b[idx];
      }
      result[k] = sum;
    }

    // Normalize to prevent magnitude growth
    return normalize(result);
  }

  // ─── BUNDLE Operation ─────────────────────────────────────────────────────

  /**
   * BUNDLE — Superpose multiple hypervectors into a single representative.
   *
   * Also called "bundling" or "superposition." The result is similar to all
   * input vectors — encoding set membership. The reverse (decoding) uses
   * nearest-neighbor lookup.
   *
   * Implementations:
   *
   * Binary majority vote:
   *   BUNDLE({aᵢ})[k] = 1 if Σᵢ aᵢ[k] > n/2, else 0
   *   For ties (even n): break randomly
   *   Properties: result is most similar to all inputs
   *
   * Bipolar/Real mean:
   *   BUNDLE({aᵢ}, {wᵢ})[k] = Σᵢ wᵢ · aᵢ[k]  (then normalize for real)
   *   Result is the centroid — most similar to all inputs
   *
   * Capacity: N_max ≈ 0.1 · D / log(D) items before retrieval degrades.
   *   For D=384: ~17 items; D=1536: ~77 items; D=10000: ~434 items.
   *
   * Reference: Kanerva (2009); Anthropic "Toy Models of Superposition" (2022)
   *
   * @param {Array<Float64Array|Uint8Array|number[]>} vectors - Vectors to bundle
   * @param {number[]} [weights] - Optional weights (uniform if omitted)
   * @returns {{ bundle: Float64Array|Uint8Array, strength: number }}
   *   bundle: bundled hypervector
   *   strength: ‖mean_vector‖ ∈ [0,1] — consensus strength
   */
  BUNDLE(vectors, weights = null) {
    if (!vectors || vectors.length === 0) {
      throw new Error('BUNDLE requires at least one vector');
    }

    const n = vectors.length;
    const d = vectors[0].length;

    // Compute weights
    const w = weights
      ? (() => {
          const sum = weights.reduce((s, x) => s + x, 0);
          return weights.map(x => x / sum);
        })()
      : new Array(n).fill(1.0 / n);

    if (this.type === 'binary') {
      // Majority vote
      const counts = new Float64Array(d);
      for (let j = 0; j < n; j++) {
        const wj = w[j];
        for (let i = 0; i < d; i++) {
          counts[i] += wj * vectors[j][i];
        }
      }

      const bundle = new Uint8Array(d);
      let agreedBits = 0;
      for (let i = 0; i < d; i++) {
        if (counts[i] > 0.5) {
          bundle[i] = 1;
          agreedBits++;
        } else if (counts[i] === 0.5) {
          bundle[i] = Math.random() < 0.5 ? 1 : 0; // tie-break randomly
        }
        // else bundle[i] = 0 (default)
      }

      const strength = agreedBits / d; // fraction of bits with clear majority
      return { bundle, strength };

    } else {
      // Bipolar or Real: weighted sum then normalize
      const sum = new Float64Array(d);
      for (let j = 0; j < n; j++) {
        const wj = w[j];
        for (let i = 0; i < d; i++) {
          sum[i] += wj * vectors[j][i];
        }
      }

      const n_sum = norm(sum);
      const strength = clamp(n_sum, 0, 1);

      if (n_sum < this.epsilon) {
        return { bundle: new Float64Array(d), strength: 0.0 };
      }

      const bundle = vectorScale(sum, 1.0 / n_sum);
      return { bundle, strength };
    }
  }

  // ─── PERMUTE Operation ────────────────────────────────────────────────────

  /**
   * PERMUTE — Cyclic shift for sequence/position encoding.
   *
   * Permutes the vector components by a fixed amount, encoding position
   * in a structure-preserving way. Used to distinguish roles/positions.
   *
   * Formula: PERMUTE(a, n)[i] = a[(i - n) mod D]  (cyclic shift by n)
   *
   * Properties:
   *   - Invertible: PERMUTE(PERMUTE(a, n), -n) = a
   *   - Preserves Hamming distance for binary vectors
   *   - Result is dissimilar to input (distinct position encoding)
   *   - Composable: PERMUTE(a, n) applied n times ≠ a for small n
   *
   * Sequence encoding: S = v₁ + Π(v₂) + Π²(v₃) + ... + Πⁿ(vₙ₊₁)
   *   where Πᵏ means PERMUTE applied k times.
   *
   * @param {Float64Array|Uint8Array|number[]} a - Input hypervector
   * @param {number} [n=1] - Number of positions to shift (can be negative)
   * @returns {Float64Array|Uint8Array} Permuted hypervector
   */
  PERMUTE(a, n = 1) {
    const d = a.length;
    const shift = ((n % d) + d) % d; // normalize to [0, D)

    if (this.type === 'binary') {
      const result = new Uint8Array(d);
      for (let i = 0; i < d; i++) {
        result[i] = a[(i - shift + d) % d];
      }
      return result;
    } else {
      const result = new Float64Array(d);
      for (let i = 0; i < d; i++) {
        result[i] = a[(i - shift + d) % d];
      }
      return result;
    }
  }

  /**
   * PERMUTE chain — Apply PERMUTE n times (for sequence encoding positions).
   *
   * @param {Float64Array|Uint8Array|number[]} a - Input vector
   * @param {number} n - Number of applications (position index)
   * @returns {Float64Array|Uint8Array} Result of applying PERMUTE n times
   */
  PERMUTE_n(a, n) {
    return this.PERMUTE(a, n); // cyclic shift by n*1 = n positions
  }

  // ─── ENCODE / DECODE ──────────────────────────────────────────────────────

  /**
   * ENCODE — Map a scalar or categorical value to a hypervector.
   *
   * For categorical values: nearest-neighbor lookup in codebook.
   * For scalar values: fractional power encoding (FHRR-style interpolation).
   *
   * Categorical encoding:
   *   ENCODE(value, codebook) = codebook[value]
   *   Returns the pre-generated random vector for this category.
   *
   * Scalar encoding (real hypervectors only):
   *   For scalar x ∈ [min, max]: interpolate between two anchor vectors
   *   using fractional power (angle-based interpolation).
   *   f(x) = H₁ · Π^{round(D · (x-min)/(max-min))}
   *   Approximates shift-invariant kernel: ⟨f(x),f(y)⟩ ≈ K(x-y)
   *
   * @param {string|number} value - Value to encode
   * @param {Object} codebook - Codebook object { [key]: Float64Array }
   * @param {Object} [scalarOptions] - For scalar encoding: { min, max }
   * @returns {Float64Array|Uint8Array} Encoded hypervector
   * @throws {Error} If value not found in codebook (categorical)
   */
  ENCODE(value, codebook, scalarOptions = null) {
    if (scalarOptions && typeof value === 'number') {
      // Scalar encoding via permutation interpolation
      const { min = 0, max = 1 } = scalarOptions;
      const anchorKey = `__scalar_anchor__`;

      if (!codebook[anchorKey]) {
        throw new Error('Scalar codebook must have __scalar_anchor__ vector');
      }

      const anchor = codebook[anchorKey];
      const normalized = (value - min) / (max - min + this.epsilon);
      const shiftAmount = Math.round(normalized * anchor.length);

      return this.PERMUTE(anchor, shiftAmount);

    } else {
      // Categorical encoding
      const key = String(value);
      if (codebook[key] === undefined) {
        throw new Error(`ENCODE: key '${key}' not found in codebook. Available: ${Object.keys(codebook).slice(0, 5).join(', ')}...`);
      }
      return codebook[key];
    }
  }

  /**
   * DECODE — Find the nearest item in a codebook (clean-up memory lookup).
   *
   * Performs nearest-neighbor search using cosine similarity (real) or
   * Hamming distance (binary). Returns the codebook key whose vector is
   * most similar to the query.
   *
   * This is the "clean-up memory" in HDC terminology: it takes a noisy
   * bundle result and snaps it to the nearest known item.
   *
   * Formula: DECODE(x, codebook) = argmax_{key} similarity(x, codebook[key])
   *
   * @param {Float64Array|Uint8Array|number[]} vector - Query vector (possibly noisy)
   * @param {Object} codebook - Codebook { [key]: Float64Array|Uint8Array }
   * @param {number} [k=1] - Return top-k matches
   * @returns {Array<{ key: string, similarity: number }>} Sorted matches (best first)
   */
  DECODE(vector, codebook, k = 1) {
    const keys = Object.keys(codebook).filter(k => k !== '__scalar_anchor__');
    const scores = [];

    for (const key of keys) {
      const candidate = codebook[key];
      let sim;

      if (this.type === 'binary') {
        sim = this.SIMILARITY(vector, candidate);
      } else {
        // Cosine similarity
        const n1 = norm(vector);
        const n2 = norm(candidate);
        if (n1 < this.epsilon || n2 < this.epsilon) {
          sim = 0;
        } else {
          sim = clamp(dot(vector, candidate) / (n1 * n2), -1.0, 1.0);
        }
      }

      scores.push({ key, similarity: sim });
    }

    // Sort by similarity (descending)
    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, k);
  }

  // ─── SIMILARITY ───────────────────────────────────────────────────────────

  /**
   * SIMILARITY — Compute similarity between two hypervectors.
   *
   * Type-appropriate similarity measure:
   *
   * Binary (Hamming-based):
   *   similarity = 1 - hammingDistance(a,b) / D
   *   Range: [0, 1], where 1 = identical, 0.5 = random, 0 = antipodal
   *
   * Bipolar/Real (Cosine):
   *   similarity = (a·b) / (‖a‖·‖b‖)
   *   Range: [-1, +1], where +1 = identical, 0 = orthogonal, -1 = antipodal
   *
   * @param {Float64Array|Uint8Array|number[]} a
   * @param {Float64Array|Uint8Array|number[]} b
   * @returns {number} Similarity score
   */
  SIMILARITY(a, b) {
    if (a.length !== b.length) {
      throw new Error(`SIMILARITY dimension mismatch: ${a.length} vs ${b.length}`);
    }

    if (this.type === 'binary') {
      // Hamming distance → similarity
      let diff = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diff++;
      }
      return 1.0 - diff / a.length;
    } else {
      // Cosine similarity
      const n1 = norm(a);
      const n2 = norm(b);
      if (n1 < this.epsilon || n2 < this.epsilon) return 0.0;
      return clamp(dot(a, b) / (n1 * n2), -1.0, 1.0);
    }
  }

  /**
   * Hamming distance between two binary vectors.
   *
   * @param {Uint8Array|number[]} a
   * @param {Uint8Array|number[]} b
   * @returns {number} Hamming distance (number of positions that differ)
   */
  hammingDistance(a, b) {
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) dist++;
    }
    return dist;
  }

  // ─── Codebook Generation ──────────────────────────────────────────────────

  /**
   * Generate a codebook of random orthogonal hypervectors for a set of items.
   *
   * Each item gets a random hypervector. In high dimensions, these are
   * near-orthogonal with high probability (near-orthogonality guarantee).
   *
   * Near-orthogonality: for D=384 real vectors, E[cos(a,b)] = 0, σ = 1/√384 ≈ 0.051.
   * Two random 384-D vectors have |cos| < 0.15 with probability > 99%.
   *
   * @param {string[]} items - Items to generate codebook for
   * @param {number} [dim] - Vector dimension (defaults to this.dim)
   * @param {'binary'|'bipolar'|'real'} [type] - Vector type (defaults to this.type)
   * @returns {Object} Codebook: { [item]: Float64Array|Uint8Array }
   */
  generateCodebook(items, dim = null, type = null) {
    const d = dim || this.dim;
    const t = type || this.type;
    const codebook = {};

    for (const item of items) {
      codebook[String(item)] = this.randomVector(d, t);
    }

    return codebook;
  }

  /**
   * Generate a scalar codebook for encoding continuous values.
   *
   * Creates an anchor vector for permutation-based scalar encoding.
   * Scalar x ∈ [min, max] is encoded as PERMUTE(anchor, round(D*(x-min)/(max-min))).
   * This produces similar vectors for nearby values and dissimilar vectors for
   * distant values — a shift-invariant kernel.
   *
   * @param {number} min - Minimum scalar value
   * @param {number} max - Maximum scalar value
   * @param {number} [dim] - Vector dimension
   * @returns {Object} Scalar codebook with __scalar_anchor__ key
   */
  generateScalarCodebook(min, max, dim = null) {
    const d = dim || this.dim;
    const codebook = {
      __scalar_anchor__: this.randomVector(d, 'real'),
      __meta__: { min, max, dim: d },
    };
    return codebook;
  }

  // ─── Sequence Encoding ────────────────────────────────────────────────────

  /**
   * Encode a sequence of vectors using permutation chains.
   *
   * Formula: S = Π⁰(v₁) + Π¹(v₂) + Π²(v₃) + ... + Πⁿ⁻¹(vₙ)
   *
   * Each element is permuted by its position index, making position
   * distinguishable from identity. The sequence is order-sensitive:
   * [A, B, C] ≠ [B, A, C].
   *
   * Decoding element at position k: S ⊗ Π^{-k}(probe) → similarity to vₖ₊₁
   *
   * @param {Array<Float64Array|Uint8Array|number[]>} sequence - Ordered vectors
   * @returns {Float64Array|Uint8Array} Sequence bundle
   */
  encodeSequence(sequence) {
    if (!sequence || sequence.length === 0) {
      throw new Error('encodeSequence requires at least one element');
    }

    const permuted = sequence.map((vec, i) => this.PERMUTE_n(vec, i));
    return this.BUNDLE(permuted).bundle;
  }

  /**
   * Query a sequence bundle for the element at a given position.
   *
   * @param {Float64Array|Uint8Array|number[]} seqBundle - Encoded sequence
   * @param {number} position - Position index (0-based)
   * @param {Object} codebook - Item codebook for nearest-neighbor lookup
   * @param {number} [k=3] - Return top-k candidates
   * @returns {Array<{ key: string, similarity: number }>}
   */
  decodeSequencePosition(seqBundle, position, codebook, k = 3) {
    // Shift bundle by -position to align position's encoding with position 0
    const derotated = this.PERMUTE(seqBundle, -position);
    return this.DECODE(derotated, codebook, k);
  }

  /**
   * Encode a key-value record as a single holistic hypervector.
   *
   * Formula: H = Σⱼ BIND(keyⱼ, valueⱼ)
   *
   * To query: BIND_inverse(H, keyⱼ) ≈ valueⱼ (with noise from other pairs)
   *
   * @param {Array<{ key: Float64Array, value: Float64Array }>} pairs - Key-value pairs
   * @returns {Float64Array|Uint8Array} Holistic record hypervector
   */
  encodeRecord(pairs) {
    if (!pairs || pairs.length === 0) {
      throw new Error('encodeRecord requires at least one key-value pair');
    }

    const boundPairs = pairs.map(({ key, value }) => {
      const bound = this.BIND(key, value);
      // Convert Uint8Array to Float64Array for bundling if needed
      if (bound instanceof Uint8Array) {
        return Array.from(bound).map(x => x * 2 - 1); // {0,1} → {-1,+1}
      }
      return bound;
    });

    return this.BUNDLE(boundPairs).bundle;
  }

  /**
   * Query a record hypervector for the value associated with a key.
   *
   * @param {Float64Array|Uint8Array|number[]} record - Encoded record
   * @param {Float64Array|Uint8Array|number[]} queryKey - Key to look up
   * @param {Object} valueCodebook - Codebook of known values
   * @param {number} [k=3] - Return top-k candidates
   * @returns {Array<{ key: string, similarity: number }>}
   */
  queryRecord(record, queryKey, valueCodebook, k = 3) {
    const approxValue = this.BIND_inverse(record, queryKey);
    return this.DECODE(approxValue, valueCodebook, k);
  }

  // ─── Capacity and Statistics ──────────────────────────────────────────────

  /**
   * Estimate the bundle capacity for this dimension.
   *
   * Rule of thumb: N_max ≈ 0.1 · D / log(D)
   * This is the number of items that can be bundled before SNR drops below
   * reliable retrieval threshold (>75% accuracy).
   *
   * @returns {{ capacity: number, dim: number, snrAtCapacity: number }}
   */
  estimateCapacity() {
    const d = this.dim;
    const capacity = bundleCapacity(d);
    // SNR ≈ 1/√(n-1) for n items bundled
    const snrAtCapacity = 1.0 / Math.sqrt(capacity - 1);

    return { capacity, dim: d, snrAtCapacity };
  }

  /**
   * Compute the expected similarity between a bundle and one of its components.
   *
   * For n equal-weight items: E[sim(bundle, item)] = 1/√n
   *
   * @param {number} n - Number of bundled items
   * @returns {number} Expected similarity ∈ (0,1]
   */
  bundleSimilarity(n) {
    return 1.0 / Math.sqrt(n);
  }

  /**
   * Check if a vector is "present" in a bundle (membership query).
   *
   * @param {Float64Array|Uint8Array|number[]} bundle - Bundle vector
   * @param {Float64Array|Uint8Array|number[]} query - Query vector
   * @param {number} [n] - Number of items in bundle (for adaptive threshold)
   * @returns {{ present: boolean, similarity: number, threshold: number }}
   */
  isPresent(bundle, query, n = null) {
    const sim = this.SIMILARITY(bundle, query);
    // Threshold: 2 standard deviations above chance level
    const threshold = n ? (1.0 / Math.sqrt(n) * 0.5) : 0.15;

    return {
      present: sim > threshold,
      similarity: sim,
      threshold,
    };
  }
}

// ─── Module Exports ────────────────────────────────────────────────────────────

module.exports = {
  HDCOperations,
  bundleCapacity,
  DEFAULT_DIM,
  LARGE_DIM,
};

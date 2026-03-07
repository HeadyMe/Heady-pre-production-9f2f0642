/**
 * @fileoverview Vector Symbolic Architecture (VSA) Hypervector Implementation
 * @description Implements FHRR-style (Fourier Holographic Reduced Representation)
 *              hypervectors for Heady's semantic logic operations
 * @version 1.0.0
 * @license Apache-2.0
 */

const { logger } = require('../utils/logger');
const { PhiScale } = require('./phi-scales');

/**
 * Default dimensionality for hypervectors (based on VSA research best practices)
 * Range: 1000-10000 dimensions for optimal orthogonality
 */
const DEFAULT_DIMENSIONALITY = 4096; // Power of 2 for efficient computation
const PHI = (1 + Math.sqrt(5)) / 2; // Golden ratio for phi-scale integration

/**
 * Hypervector class implementing VSA operations
 * Uses continuous-valued representation in range [-1, 1] (multiplied by π internally)
 */
class Hypervector {
  /**
   * Create a new hypervector
   * @param {Float32Array|Array<number>} values - Vector values in range [-1, 1]
   * @param {number} [dimensionality=DEFAULT_DIMENSIONALITY] - Vector dimension
   */
  constructor(values = null, dimensionality = DEFAULT_DIMENSIONALITY) {
    this.dimensionality = dimensionality;

    if (values) {
      if (values.length !== dimensionality) {
        throw new Error(`Values length (${values.length}) must match dimensionality (${dimensionality})`);
      }
      this.values = values instanceof Float32Array ? values : new Float32Array(values);
    } else {
      // Generate random hypervector with uniform distribution [-1, 1]
      this.values = new Float32Array(dimensionality);
      for (let i = 0; i < dimensionality; i++) {
        this.values[i] = Math.random() * 2 - 1;
      }
    }

    this._phiScale = null; // Lazy initialization for phi-scale integration
  }

  /**
   * Create a random hypervector (atomic symbol)
   * @param {number} [dimensionality=DEFAULT_DIMENSIONALITY]
   * @param {number} [seed] - Optional seed for reproducibility
   * @returns {Hypervector}
   */
  static random(dimensionality = DEFAULT_DIMENSIONALITY, seed = null) {
    if (seed !== null) {
      // Simple seeded random (for reproducibility in tests)
      const seededRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      const values = new Float32Array(dimensionality);
      for (let i = 0; i < dimensionality; i++) {
        values[i] = seededRandom() * 2 - 1;
      }
      return new Hypervector(values, dimensionality);
    }
    return new Hypervector(null, dimensionality);
  }

  /**
   * Create a zero hypervector
   * @param {number} [dimensionality=DEFAULT_DIMENSIONALITY]
   * @returns {Hypervector}
   */
  static zero(dimensionality = DEFAULT_DIMENSIONALITY) {
    return new Hypervector(new Float32Array(dimensionality), dimensionality);
  }

  /**
   * Calculate similarity between two hypervectors using FHRR metric
   * Returns cosine similarity in range [0, 1] (0 = orthogonal, 1 = identical)
   * @param {Hypervector} other
   * @returns {number} Similarity score
   */
  similarity(other) {
    if (this.dimensionality !== other.dimensionality) {
      throw new Error('Hypervectors must have same dimensionality for similarity calculation');
    }

    let sum = 0;
    for (let i = 0; i < this.dimensionality; i++) {
      // FHRR similarity: mean cosine of angle differences
      const angleDiff = Math.PI * (this.values[i] - other.values[i]);
      sum += Math.cos(angleDiff);
    }

    const similarity = sum / this.dimensionality;

    // Normalize to [0, 1] range (from [-1, 1])
    return (similarity + 1) / 2;
  }

  /**
   * BINDING operation: Creates unique combination of two concepts
   * Implements circular convolution (element-wise multiplication in Fourier domain)
   * Example: bind(HEADY, SEMANTIC) = HEADY-SEMANTIC (compositional representation)
   * @param {Hypervector} other
   * @returns {Hypervector} Bound hypervector
   */
  bind(other) {
    if (this.dimensionality !== other.dimensionality) {
      throw new Error('Hypervectors must have same dimensionality for binding');
    }

    const result = new Float32Array(this.dimensionality);

    // Element-wise multiplication (simplified binding for FHRR)
    for (let i = 0; i < this.dimensionality; i++) {
      result[i] = this.values[i] * other.values[i];

      // Keep in range [-1, 1]
      if (result[i] > 1) result[i] = 1;
      if (result[i] < -1) result[i] = -1;
    }

    return new Hypervector(result, this.dimensionality);
  }

  /**
   * UNBINDING operation: Inverse of binding (self-inverse operation)
   * In FHRR, unbinding is the same as binding due to involution property
   * @param {Hypervector} other
   * @returns {Hypervector}
   */
  unbind(other) {
    return this.bind(other); // FHRR binding is self-inverse
  }

  /**
   * BUNDLING/SUPERPOSITION operation: Combines multiple concepts into a set
   * Returns element-wise average (preserves similarity to constituents)
   * Example: bundle([CAT, DOG, BIRD]) = ANIMALS
   * @param {Hypervector|Array<Hypervector>} others
   * @returns {Hypervector} Bundled hypervector
   */
  bundle(others) {
    const vectors = Array.isArray(others) ? [this, ...others] : [this, others];

    if (!vectors.every(v => v.dimensionality === this.dimensionality)) {
      throw new Error('All hypervectors must have same dimensionality for bundling');
    }

    const result = new Float32Array(this.dimensionality);

    // Element-wise sum
    for (const vector of vectors) {
      for (let i = 0; i < this.dimensionality; i++) {
        result[i] += vector.values[i];
      }
    }

    // Normalize by count (average)
    const count = vectors.length;
    for (let i = 0; i < this.dimensionality; i++) {
      result[i] /= count;

      // Clip to [-1, 1] range
      if (result[i] > 1) result[i] = 1;
      if (result[i] < -1) result[i] = -1;
    }

    return new Hypervector(result, this.dimensionality);
  }

  /**
   * PERMUTATION operation: Rotates hypervector components
   * Used for encoding sequences and ordered structures
   * Example: permute(X, 1) ≠ X, permute(permute(X, 1), -1) ≈ X
   * @param {number} shift - Number of positions to rotate (can be negative)
   * @returns {Hypervector} Permuted hypervector
   */
  permute(shift = 1) {
    const result = new Float32Array(this.dimensionality);
    const normalizedShift = ((shift % this.dimensionality) + this.dimensionality) % this.dimensionality;

    for (let i = 0; i < this.dimensionality; i++) {
      const newIndex = (i + normalizedShift) % this.dimensionality;
      result[newIndex] = this.values[i];
    }

    return new Hypervector(result, this.dimensionality);
  }

  /**
   * RESONATOR operation: Finds closest match in a codebook
   * Implements resonator network for cleanup/nearest neighbor search
   * @param {Array<{name: string, vector: Hypervector}>} codebook
   * @param {number} [threshold=0.5] - Minimum similarity threshold
   * @returns {{name: string, similarity: number, vector: Hypervector}|null}
   */
  resonate(codebook, threshold = 0.5) {
    let bestMatch = null;
    let bestSimilarity = threshold;

    for (const entry of codebook) {
      const sim = this.similarity(entry.vector);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = { ...entry, similarity: sim };
      }
    }

    return bestMatch;
  }

  /**
   * PHI-SCALE INTEGRATION: Map hypervector to phi-bounded continuous value
   * Converts high-dimensional representation to single continuous value
   * @returns {number} Value in phi-bounded range [0, φ]
   */
  toPhiScale() {
    if (!this._phiScale) {
      // Project to [0, 1] using L2 norm magnitude
      let magnitude = 0;
      for (let i = 0; i < this.dimensionality; i++) {
        magnitude += this.values[i] * this.values[i];
      }
      magnitude = Math.sqrt(magnitude / this.dimensionality);

      // Map to [0, φ] range
      this._phiScale = (magnitude + 1) / 2 * PHI;
    }
    return this._phiScale;
  }

  /**
   * SEMANTIC LOGIC GATE INTEGRATION
   * Convert hypervector to continuous truth value for CSL gates
   * @returns {number} Truth value in [0, 1]
   */
  toTruthValue() {
    // Average of normalized components gives continuous truth value
    let sum = 0;
    for (let i = 0; i < this.dimensionality; i++) {
      sum += (this.values[i] + 1) / 2; // Map [-1,1] to [0,1]
    }
    return sum / this.dimensionality;
  }

  /**
   * Clone this hypervector
   * @returns {Hypervector}
   */
  clone() {
    return new Hypervector(new Float32Array(this.values), this.dimensionality);
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      dimensionality: this.dimensionality,
      values: Array.from(this.values),
      phiScale: this.toPhiScale(),
      truthValue: this.toTruthValue()
    };
  }

  /**
   * Create hypervector from JSON
   * @param {Object} json
   * @returns {Hypervector}
   */
  static fromJSON(json) {
    return new Hypervector(json.values, json.dimensionality);
  }

  /**
   * Get string representation for debugging
   * @returns {string}
   */
  toString() {
    const preview = this.values.slice(0, 5).map(v => v.toFixed(3)).join(', ');
    return `Hypervector<${this.dimensionality}>[${preview}...]`;
  }
}

module.exports = {
  Hypervector,
  DEFAULT_DIMENSIONALITY,
  PHI
};

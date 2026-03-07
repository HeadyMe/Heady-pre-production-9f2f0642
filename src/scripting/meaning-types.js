'use strict';

/**
 * meaning-types.js
 *
 * MeaningType — wraps any discrete JS value with its semantic meaning
 * expressed as a 384-dimensional embedding vector so that value comparisons
 * use continuous cosine similarity instead of strict equality (===).
 *
 * MeaningTypeCollection — bulk operations over arrays of MeaningTypes.
 */

const CSL     = require('../core/semantic-logic');
const { PhiScale, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger  = require('../utils/logger');

// Default embedding dimension (matches all-MiniLM-L6-v2)
const DEFAULT_DIM = 384;

// ---------------------------------------------------------------------------
// MeaningType
// ---------------------------------------------------------------------------

class MeaningType {
  /**
   * @param {*}           discreteValue      The original JS value
   * @param {string}      semanticDescription  Natural-language description of its meaning
   * @param {Float32Array} embeddingVector     Pre-computed 384-dim vector
   */
  constructor(discreteValue, semanticDescription, embeddingVector) {
    if (!(embeddingVector instanceof Float32Array)) {
      throw new TypeError('MeaningType: embeddingVector must be a Float32Array');
    }
    /** @type {*} */
    this.value       = discreteValue;
    /** @type {string} */
    this.description = semanticDescription;
    /** @type {Float32Array} */
    this.vector      = embeddingVector;

    Object.freeze(this);
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Create a MeaningType from a raw JS value and a semantic description.
   *
   * @param {*}        discreteValue
   * @param {string}   semanticDescription
   * @param {object}   [options={}]
   * @param {Function} [options.embedFn]       External embed function: (text: string) => Float32Array
   * @param {number}   [options.dimension=384]
   * @returns {MeaningType}
   */
  static create(discreteValue, semanticDescription, options = {}) {
    const dim     = options.dimension || DEFAULT_DIM;
    const embedFn = options.embedFn   || null;

    let vector;
    if (typeof embedFn === 'function') {
      const raw = embedFn(semanticDescription);
      vector    = raw instanceof Float32Array ? raw : new Float32Array(raw);
    } else {
      vector    = MeaningType._generateEmbedding(semanticDescription, dim);
    }

    logger.debug(
      `[MeaningType] Created for value=${JSON.stringify(discreteValue).slice(0, 50)} ` +
      `desc="${semanticDescription.slice(0, 60)}"`
    );

    return new MeaningType(discreteValue, semanticDescription, vector);
  }

  // ── Comparison ────────────────────────────────────────────────────────────

  /**
   * Semantic equality — uses cosine similarity instead of ===.
   *
   * @param {MeaningType} other
   * @returns {{ match: boolean, similarity: number, activation: number }}
   */
  equals(other) {
    _assertMeaningType(other, 'equals');
    const similarity  = CSL.cosine_similarity(this.vector, other.vector);
    const activation  = CSL.soft_gate(similarity, PHI_INVERSE, 20);
    return {
      match:      similarity > PHI_INVERSE,
      similarity,
      activation,
    };
  }

  /**
   * Phi-equilibrium compatibility check using resonance_gate.
   *
   * @param {MeaningType} other
   * @returns {{ compatible: boolean, score: number, open: boolean }}
   */
  isCompatible(other) {
    _assertMeaningType(other, 'isCompatible');
    const { score, open } = CSL.resonance_gate(this.vector, other.vector, PHI_INVERSE);
    return { compatible: open, score, open };
  }

  /**
   * Continuous semantic distance: 1 − cosine_similarity ∈ [0, 1].
   *
   * @param {MeaningType} other
   * @returns {number}
   */
  distance(other) {
    _assertMeaningType(other, 'distance');
    return 1 - CSL.cosine_similarity(this.vector, other.vector);
  }

  // ── Composition ───────────────────────────────────────────────────────────

  /**
   * Combine this MeaningType with another via weighted superposition.
   *
   * @param {MeaningType} other
   * @param {number}      [alpha=0.5]  Weight for this vector (1-alpha for other)
   * @returns {MeaningType}
   */
  combine(other, alpha = 0.5) {
    _assertMeaningType(other, 'combine');
    const newVec  = CSL.weighted_superposition(this.vector, other.vector, alpha);
    const newDesc = `(${this.description}) ⊕[${alpha.toFixed(2)}] (${other.description})`;
    const newVal  = alpha >= 0.5 ? this.value : other.value;
    return new MeaningType(newVal, newDesc, newVec);
  }

  /**
   * Exclude another MeaningType's meaning via orthogonal_gate.
   *
   * @param {MeaningType} other
   * @returns {MeaningType}
   */
  exclude(other) {
    _assertMeaningType(other, 'exclude');
    const newVec  = CSL.orthogonal_gate(this.vector, other.vector);
    const newDesc = `(${this.description}) ⊖ (${other.description})`;
    return new MeaningType(this.value, newDesc, newVec);
  }

  // ── Static combinators ───────────────────────────────────────────────────

  /**
   * Merge an array of MeaningTypes via consensus_superposition.
   *
   * @param {MeaningType[]} meaningTypes
   * @returns {MeaningType}
   */
  static consensus(meaningTypes) {
    if (!Array.isArray(meaningTypes) || meaningTypes.length === 0) {
      throw new TypeError('MeaningType.consensus: requires a non-empty array');
    }
    meaningTypes.forEach((m, i) => _assertMeaningType(m, `consensus[${i}]`));

    const vectors = meaningTypes.map(m => m.vector);
    const newVec  = CSL.consensus_superposition(vectors);
    const descs   = meaningTypes.map(m => m.description.slice(0, 30)).join(' | ');
    const values  = meaningTypes.map(m => m.value);

    logger.debug(`[MeaningType] consensus() over ${meaningTypes.length} types`);

    return new MeaningType(values, `consensus(${descs})`, newVec);
  }

  // ── Classification ───────────────────────────────────────────────────────

  /**
   * Classify this MeaningType against a set of category MeaningTypes.
   * Returns categories ranked by similarity (highest first).
   *
   * @param {MeaningType[]} categories
   * @returns {Array<{ category: MeaningType, similarity: number, activation: number, rank: number }>}
   */
  classify(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return [];
    }
    categories.forEach((c, i) => _assertMeaningType(c, `classify[${i}]`));

    const candidates = categories.map(c => c.vector);
    const result     = CSL.route_gate(this.vector, candidates, 0);

    return result.scores
      .map((score, i) => ({
        category:   categories[i],
        similarity: score,
        activation: CSL.soft_gate(score, PHI_INVERSE, 20),
        rank:       0,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // ── Serialisation ────────────────────────────────────────────────────────

  /**
   * Serialise to a plain JSON-compatible object.
   * @returns {{ value, description, vector: number[], type: string }}
   */
  toJSON() {
    return {
      value:       this.value,
      description: this.description,
      vector:      Array.from(this.vector),
      type:        typeof this.value,
    };
  }

  /**
   * Deserialise from toJSON() output.
   * @param {{ value, description, vector: number[], type?: string }} json
   * @returns {MeaningType}
   */
  static fromJSON(json) {
    if (!json || !Array.isArray(json.vector)) {
      throw new TypeError('MeaningType.fromJSON: invalid JSON shape');
    }
    return new MeaningType(
      json.value,
      json.description || '',
      new Float32Array(json.vector)
    );
  }

  /**
   * @returns {string}
   */
  toString() {
    const desc = this.description.length > 50
      ? `${this.description.slice(0, 50)}...`
      : this.description;
    return `MeaningType<${JSON.stringify(this.value)}>(${desc})`;
  }

  // ── Embedding ────────────────────────────────────────────────────────────

  /**
   * Deterministic hash-based pseudo-embedding (same algorithm as AnchorRegistry).
   * Produces a normalised 384-dim Float32Array from any text string.
   *
   * NOTE: This is a seeded PRNG-style embedding — semantically related strings
   * will NOT automatically produce similar vectors unless an external model is
   * provided via options.embedFn. Its main purpose is reproducibility in tests
   * and CI pipelines without a live embedding model.
   *
   * @param {string} text
   * @param {number} [dim=384]
   * @returns {Float32Array}
   * @private
   */
  static _generateEmbedding(text, dim = DEFAULT_DIM) {
    const vec = new Float32Array(dim);

    // Seed from text chars
    let seed = 2166136261; // FNV-1a offset basis
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed  = (seed * 16777619) >>> 0; // FNV-1a prime, keep 32-bit
    }

    // Fill using a linear congruential generator seeded from the text hash
    let state = seed;
    for (let i = 0; i < dim; i++) {
      // LCG: a=1664525, c=1013904223 (Numerical Recipes)
      state        = ((state * 1664525) + 1013904223) >>> 0;
      const signed = (state >>> 0) - 2147483648;
      vec[i]       = signed / 2147483648;  // normalise to [-1, 1]
    }

    // Character-position perturbations for semantic spread
    for (let i = 0; i < text.length && i < dim; i++) {
      const ci  = text.charCodeAt(i);
      const idx = (ci * 7 + i * 31) % dim;
      vec[idx] += (ci / 128) - 1;
    }

    return CSL.normalize(vec);
  }
}

// ---------------------------------------------------------------------------
// MeaningTypeCollection
// ---------------------------------------------------------------------------

class MeaningTypeCollection {
  /**
   * @param {MeaningType[]} [items=[]]
   */
  constructor(items = []) {
    items.forEach((m, i) => _assertMeaningType(m, `MeaningTypeCollection[${i}]`));
    /** @type {MeaningType[]} */
    this.items = [...items];
  }

  /** Number of items in the collection. @type {number} */
  get size() { return this.items.length; }

  /**
   * Add a MeaningType to the collection.
   * @param {MeaningType} meaningType
   * @returns {MeaningTypeCollection} self (fluent)
   */
  add(meaningType) {
    _assertMeaningType(meaningType, 'add');
    this.items.push(meaningType);
    return this;
  }

  /**
   * Find the closest MeaningType to a query.
   *
   * @param {MeaningType|string} query  Either a MeaningType or a raw string
   *                                    (auto-embedded with _generateEmbedding)
   * @returns {{ item: MeaningType, similarity: number, index: number }|null}
   */
  findClosest(query) {
    if (this.items.length === 0) return null;

    let queryVec;
    if (query instanceof MeaningType) {
      queryVec = query.vector;
    } else if (typeof query === 'string') {
      queryVec = MeaningType._generateEmbedding(query);
    } else {
      throw new TypeError('findClosest: query must be MeaningType or string');
    }

    let best     = null;
    let bestSim  = -Infinity;
    let bestIdx  = -1;

    for (let i = 0; i < this.items.length; i++) {
      const sim = CSL.cosine_similarity(queryVec, this.items[i].vector);
      if (sim > bestSim) {
        bestSim = sim;
        best    = this.items[i];
        bestIdx = i;
      }
    }

    return best ? { item: best, similarity: bestSim, index: bestIdx } : null;
  }

  /**
   * Filter the collection by semantic similarity to a predicate MeaningType.
   * Returns items whose similarity to the predicate exceeds PHI_INVERSE.
   *
   * @param {MeaningType} predicate
   * @param {number}      [threshold=PHI_INVERSE]
   * @returns {MeaningTypeCollection}
   */
  filter(predicate, threshold = PHI_INVERSE) {
    _assertMeaningType(predicate, 'filter');
    const filtered = this.items.filter(item => {
      const sim = CSL.cosine_similarity(predicate.vector, item.vector);
      return sim >= threshold;
    });
    return new MeaningTypeCollection(filtered);
  }

  /**
   * Sort items by descending similarity to a reference MeaningType.
   *
   * @param {MeaningType} [reference]  If omitted, sort by description lexically
   * @returns {MeaningTypeCollection}  New collection (sorted copy)
   */
  sort(reference) {
    if (!reference) {
      const sorted = [...this.items].sort((a, b) =>
        a.description.localeCompare(b.description)
      );
      return new MeaningTypeCollection(sorted);
    }

    _assertMeaningType(reference, 'sort');
    const scored = this.items.map(item => ({
      item,
      sim: CSL.cosine_similarity(reference.vector, item.vector),
    }));
    scored.sort((a, b) => b.sim - a.sim);
    return new MeaningTypeCollection(scored.map(s => s.item));
  }

  /**
   * Remove near-duplicate MeaningTypes (similarity > threshold are collapsed to one).
   *
   * @param {number} [similarityThreshold=0.95]
   * @returns {MeaningTypeCollection}
   */
  deduplicate(similarityThreshold = 0.95) {
    const kept = [];
    for (const candidate of this.items) {
      const isDup = kept.some(
        k => CSL.cosine_similarity(candidate.vector, k.vector) >= similarityThreshold
      );
      if (!isDup) kept.push(candidate);
    }
    logger.debug(
      `[MeaningTypeCollection] deduplicate: ${this.items.length} → ${kept.length} items`
    );
    return new MeaningTypeCollection(kept);
  }

  /**
   * Map over items.
   * @param {Function} fn
   * @returns {Array}
   */
  map(fn) {
    return this.items.map(fn);
  }

  /**
   * Convert to a plain Array.
   * @returns {MeaningType[]}
   */
  toArray() {
    return [...this.items];
  }

  /**
   * @returns {string}
   */
  toString() {
    return `MeaningTypeCollection(${this.items.length} items)`;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Assert that value is an instance of MeaningType.
 * @param {*}      value
 * @param {string} context  Method name for the error message
 * @private
 */
function _assertMeaningType(value, context) {
  if (!(value instanceof MeaningType)) {
    throw new TypeError(`${context}: argument must be a MeaningType instance`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { MeaningType, MeaningTypeCollection };

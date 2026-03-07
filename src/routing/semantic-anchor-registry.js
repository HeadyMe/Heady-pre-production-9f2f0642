'use strict';

/**
 * @file semantic-anchor-registry.js
 * @description Singleton registry that manages all semantic anchors system-wide.
 * Handles registration, versioning, embedding computation (local deterministic or
 * external), pairwise similarity analysis, merging, splitting, and full
 * serialisation/deserialisation.
 *
 * Local embedding mode uses a mulberry32-style PRNG seeded from a djb2 hash of
 * the anchor description, producing a stable 384-dimensional Float32Array that
 * is L2-normalised.  The same text always produces the same vector.
 *
 * @module routing/semantic-anchor-registry
 */

const CSL = require('../core/semantic-logic');
const { PhiScale, PhiBackoff, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Deterministic PRNG helpers (duplicated here to keep the module self-contained)
// ---------------------------------------------------------------------------

/**
 * djb2-variant hash of a string → unsigned 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
function _hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32 PRNG closure seeded from a 32-bit integer.
 * @param {number} seed
 * @returns {function(): number} yields floats in [0, 1)
 */
function _mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// AnchorRegistry
// ---------------------------------------------------------------------------

/**
 * @class AnchorRegistry
 * @description Singleton registry for semantic anchors with versioning,
 * embedding caching, pairwise analysis, merge/split, and serialisation.
 */
class AnchorRegistry {
  constructor() {
    if (AnchorRegistry._instance) {
      return AnchorRegistry._instance;
    }

    /** @type {Map<string, AnchorEntry>} */
    this._anchors = new Map();

    /**
     * Version history: anchorId → Array<{version, description, vector, ts}>
     * @type {Map<string, Array>}
     */
    this._versions = new Map();

    /**
     * Embedding cache: text → { vector: Float32Array, expiresAt: number }
     * TTL is managed with PhiBackoff to produce phi-spaced expiry intervals.
     * @type {Map<string, {vector: Float32Array, expiresAt: number}>}
     */
    this._embeddingCache = new Map();

    /**
     * Optional external embedding function. When set, overrides local mode.
     * @type {function(string): Promise<Float32Array>|Float32Array|null}
     */
    this._externalEmbedFn = null;

    /**
     * PhiBackoff used to derive TTL values for cache entries.
     * Each successive call to next() yields a longer interval (phi-spaced).
     */
    this._cacheTTLBackoff = new PhiBackoff(60_000, 20, 0.05); // base 60 s

    // PhiScale for similarity thresholds
    this._overlapScale = new PhiScale({
      name: 'registry_overlap_threshold',
      baseValue: 0.85,
      min: 0.7,
      max: 1.0,
      phiNormalized: false,
      category: 'registry',
    });

    this._gapScale = new PhiScale({
      name: 'registry_gap_threshold',
      baseValue: 0.15,
      min: 0.0,
      max: 0.3,
      phiNormalized: false,
      category: 'registry',
    });

    this._findScale = new PhiScale({
      name: 'registry_find_threshold',
      baseValue: 0.3,
      min: 0.1,
      max: 0.8,
      phiNormalized: true,
      sensitivity: 0.1,
      category: 'registry',
    });

    AnchorRegistry._instance = this;
    logger.info('[AnchorRegistry] Singleton created');
  }

  // -------------------------------------------------------------------------
  // Singleton accessor
  // -------------------------------------------------------------------------

  /**
   * Return the singleton AnchorRegistry instance.
   * @returns {AnchorRegistry}
   */
  static getInstance() {
    if (!AnchorRegistry._instance) {
      new AnchorRegistry(); // sets _instance in constructor
    }
    return AnchorRegistry._instance;
  }

  // -------------------------------------------------------------------------
  // Core embedding
  // -------------------------------------------------------------------------

  /**
   * Generate a deterministic 384-dim Float32Array from text using a mulberry32 PRNG
   * seeded from the djb2 hash of the text.  The result is L2-normalised.
   * Identical inputs always produce identical outputs.
   *
   * @param {string} text
   * @param {number} [dim=384]
   * @returns {Float32Array}
   */
  generateDeterministicEmbedding(text, dim = 384) {
    const seed = _hashString(text);
    const rng = _mulberry32(seed);
    const vec = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      vec[i] = rng() * 2 - 1; // centred in [-1, 1)
    }
    // L2 normalise
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) vec[i] /= norm;
    }
    return vec;
  }

  /**
   * Compute a 384-dim embedding for the given text.
   * Uses external embedFn if registered; otherwise falls back to local deterministic mode.
   * Results are cached with a phi-spaced TTL.
   *
   * @param {string} text
   * @returns {Promise<Float32Array>}
   */
  async computeAnchorEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new TypeError('text must be a non-empty string');
    }

    const cacheKey = text;
    const now = Date.now();
    const cached = this._embeddingCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.vector;
    }

    let vector;
    if (typeof this._externalEmbedFn === 'function') {
      try {
        let result = await Promise.resolve(this._externalEmbedFn(text));
        vector = result instanceof Float32Array ? result : new Float32Array(result);
      } catch (err) {
        logger.warn('[AnchorRegistry] External embedFn failed; falling back to local mode', { err: err.message });
        vector = this.generateDeterministicEmbedding(text);
      }
    } else {
      vector = this.generateDeterministicEmbedding(text);
    }

    // Cache with phi-backoff TTL (reset backoff for each new text key so TTL is always base)
    const ttl = this._cacheTTLBackoff.next(); // base interval on first call = 60 s
    this._embeddingCache.set(cacheKey, { vector, expiresAt: now + ttl });

    return vector;
  }

  /**
   * Register an external embedding function that overrides local deterministic mode.
   * @param {function(string): Promise<Float32Array>|Float32Array} fn
   */
  setEmbeddingFunction(fn) {
    if (typeof fn !== 'function') throw new TypeError('fn must be a function');
    this._externalEmbedFn = fn;
    // Invalidate all cached embeddings so they are recomputed with the new function
    this._embeddingCache.clear();
    logger.info('[AnchorRegistry] External embedding function registered; cache cleared');
  }

  // -------------------------------------------------------------------------
  // Registration & updates
  // -------------------------------------------------------------------------

  /**
   * Register a new semantic anchor.
   * @param {string} id — unique identifier
   * @param {string} naturalLanguageDescription — rich description of the anchor's semantics
   * @param {object} [options={}]
   * @param {Float32Array} [options.vector] — pre-computed embedding; auto-generated if omitted
   * @param {string} [options.category='general'] — grouping label
   * @param {object} [options.metadata={}] — arbitrary key-value metadata
   * @param {number} [options.version=1] — manual version override
   * @returns {Promise<AnchorEntry>}
   */
  async registerAnchor(id, naturalLanguageDescription, options = {}) {
    if (!id || typeof id !== 'string') throw new TypeError('id must be a non-empty string');
    if (!naturalLanguageDescription || typeof naturalLanguageDescription !== 'string') {
      throw new TypeError('naturalLanguageDescription must be a non-empty string');
    }

    const now = Date.now();
    const vector = options.vector instanceof Float32Array
      ? options.vector
      : await this.computeAnchorEmbedding(naturalLanguageDescription);

    /** @type {AnchorEntry} */
    const entry = {
      id,
      description: naturalLanguageDescription,
      vector,
      category: options.category ?? 'general',
      metadata: options.metadata ?? {},
      version: options.version ?? 1,
      createdAt: now,
      updatedAt: now,
    };

    this._anchors.set(id, entry);
    this._initVersionHistory(id, entry);

    logger.info(`[AnchorRegistry] Anchor registered: ${id}`, { category: entry.category, version: entry.version });
    return entry;
  }

  /**
   * Update an anchor's description (and optionally metadata), re-embeds, increments version.
   * @param {string} id
   * @param {string} newDescription
   * @param {object} [metadataUpdate={}]
   * @returns {Promise<AnchorEntry>}
   */
  async updateAnchor(id, newDescription, metadataUpdate = {}) {
    const existing = this._anchors.get(id);
    if (!existing) throw new Error(`Anchor '${id}' not found`);

    const now = Date.now();
    const newVector = await this.computeAnchorEmbedding(newDescription);

    const updated = {
      ...existing,
      description: newDescription,
      vector: newVector,
      metadata: { ...existing.metadata, ...metadataUpdate },
      version: existing.version + 1,
      updatedAt: now,
    };

    this._anchors.set(id, updated);
    this._pushVersionHistory(id, updated);

    logger.info(`[AnchorRegistry] Anchor updated: ${id}`, { newVersion: updated.version });
    return updated;
  }

  // -------------------------------------------------------------------------
  // Retrieval & listing
  // -------------------------------------------------------------------------

  /**
   * Retrieve a full anchor entry by id.
   * @param {string} id
   * @returns {AnchorEntry|undefined}
   */
  getAnchor(id) {
    return this._anchors.get(id);
  }

  /**
   * List all anchors, optionally filtered by category.
   * @param {object} [filter={}]
   * @param {string} [filter.category] — only return anchors in this category
   * @returns {AnchorEntry[]}
   */
  listAnchors(filter = {}) {
    const all = Array.from(this._anchors.values());
    if (filter.category) {
      return all.filter(a => a.category === filter.category);
    }
    return all;
  }

  /**
   * Remove an anchor by id.
   * @param {string} id
   * @returns {boolean}
   */
  removeAnchor(id) {
    const existed = this._anchors.has(id);
    this._anchors.delete(id);
    if (existed) {
      logger.info(`[AnchorRegistry] Anchor removed: ${id}`);
    }
    return existed;
  }

  // -------------------------------------------------------------------------
  // Similarity search
  // -------------------------------------------------------------------------

  /**
   * Find the topK anchors most similar to a query vector.
   * Uses CSL.multi_resonance for efficient ranked filtering.
   *
   * @param {Float32Array} queryVector — normalised query embedding
   * @param {number} [topK=5]
   * @param {number} [threshold=0.3]
   * @returns {Array<{anchor: AnchorEntry, score: number, open: boolean}>}
   */
  findSimilarAnchors(queryVector, topK = 5, threshold = 0.3) {
    if (!(queryVector instanceof Float32Array)) {
      throw new TypeError('queryVector must be a Float32Array');
    }

    const anchors = Array.from(this._anchors.values());
    if (anchors.length === 0) return [];

    const candidateVectors = anchors.map(a => a.vector);
    const resonanceResults = CSL.multi_resonance(queryVector, candidateVectors, threshold);

    // Take topK results
    return resonanceResults
      .slice(0, topK)
      .map(r => ({
        anchor: anchors[r.index],
        score: r.score,
        open: r.open,
      }));
  }

  // -------------------------------------------------------------------------
  // Pairwise similarity matrix
  // -------------------------------------------------------------------------

  /**
   * Compute the NxN cosine similarity matrix between all registered anchors.
   * Identifies overlapping (similarity > overlapThreshold) and isolated
   * (similarity < gapThreshold) anchor pairs.
   *
   * @returns {{
   *   matrix: number[][],
   *   anchors: string[],
   *   overlaps: Array<{a, b, similarity}>,
   *   gaps: Array<{a, b, similarity}>
   * }}
   */
  computePairwiseMatrix() {
    const anchors = Array.from(this._anchors.values());
    const n = anchors.length;

    if (n === 0) return { matrix: [], anchors: [], overlaps: [], gaps: [] };

    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const overlapThreshold = this._overlapScale.value; // ~0.85
    const gapThreshold = this._gapScale.value;         // ~0.15
    const overlaps = [];
    const gaps = [];

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const sim = CSL.cosine_similarity(anchors[i].vector, anchors[j].vector);
        matrix[i][j] = sim;
        matrix[j][i] = sim;

        if (sim > overlapThreshold) {
          overlaps.push({ a: anchors[i].id, b: anchors[j].id, similarity: sim });
        } else if (sim < gapThreshold) {
          gaps.push({ a: anchors[i].id, b: anchors[j].id, similarity: sim });
        }
      }
    }

    const anchorIds = anchors.map(a => a.id);
    logger.info('[AnchorRegistry] Pairwise matrix computed', {
      anchors: n,
      overlaps: overlaps.length,
      gaps: gaps.length,
    });

    return { matrix, anchors: anchorIds, overlaps, gaps };
  }

  // -------------------------------------------------------------------------
  // Merge & Split
  // -------------------------------------------------------------------------

  /**
   * Merge two anchors into a single new anchor whose vector is the
   * phi-normalised superposition of the two source vectors.
   * The merged description is a concatenation; the source anchors are removed.
   *
   * @param {string} idA
   * @param {string} idB
   * @param {string} newId — id for the merged anchor
   * @returns {Promise<AnchorEntry>}
   */
  async mergeAnchors(idA, idB, newId) {
    const anchorA = this._anchors.get(idA);
    const anchorB = this._anchors.get(idB);
    if (!anchorA) throw new Error(`Anchor '${idA}' not found`);
    if (!anchorB) throw new Error(`Anchor '${idB}' not found`);

    // Superposition_gate normalises the averaged vector
    const mergedVector = CSL.superposition_gate(anchorA.vector, anchorB.vector);
    const mergedDescription = [anchorA.description, anchorB.description].join('\n\nMERGED WITH:\n');

    const mergedEntry = await this.registerAnchor(newId, mergedDescription, {
      vector: mergedVector,
      category: anchorA.category === anchorB.category ? anchorA.category : 'merged',
      metadata: {
        mergedFrom: [idA, idB],
        mergedAt: Date.now(),
      },
    });

    // Remove source anchors
    this.removeAnchor(idA);
    this.removeAnchor(idB);

    logger.info(`[AnchorRegistry] Merged '${idA}' + '${idB}' → '${newId}'`);
    return mergedEntry;
  }

  /**
   * Split one anchor into multiple more specific child anchors.
   * The parent anchor is removed; each child gets a description from the
   * descriptions array. The child vector is the orthogonal projection of the
   * parent vector against all other children's vectors (to maximise distinctness).
   *
   * @param {string} id — parent anchor id
   * @param {Array<{id: string, description: string, category?: string}>} descriptions
   * @returns {Promise<AnchorEntry[]>}
   */
  async splitAnchor(id, descriptions) {
    const parent = this._anchors.get(id);
    if (!parent) throw new Error(`Anchor '${id}' not found`);
    if (!Array.isArray(descriptions) || descriptions.length < 2) {
      throw new Error('descriptions must be an array of at least 2 items');
    }

    const children = [];
    // Compute initial embeddings for each child description
    const childVectors = await Promise.all(
      descriptions.map(d => this.computeAnchorEmbedding(d.description))
    );

    for (let i = 0; i < descriptions.length; i++) {
      const spec = descriptions[i];
      // Orthogonalise this child's vector away from all others to reduce overlap
      const othersVectors = childVectors.filter((_, j) => j !== i);
      let vec = childVectors[i];
      if (othersVectors.length > 0) {
        vec = CSL.batch_orthogonal(vec, othersVectors);
      }

      const entry = await this.registerAnchor(spec.id, spec.description, {
        vector: vec,
        category: spec.category ?? parent.category,
        metadata: { splitFrom: id, splitAt: Date.now() },
      });
      children.push(entry);
    }

    // Remove parent
    this.removeAnchor(id);
    logger.info(`[AnchorRegistry] Split '${id}' → [${descriptions.map(d => d.id).join(', ')}]`);
    return children;
  }

  // -------------------------------------------------------------------------
  // Version history helpers
  // -------------------------------------------------------------------------

  /**
   * Initialise version history for a newly registered anchor.
   * @private
   */
  _initVersionHistory(id, entry) {
    this._versions.set(id, [{
      version: entry.version,
      description: entry.description,
      vector: entry.vector,
      ts: entry.createdAt,
    }]);
  }

  /**
   * Push a new version record for an updated anchor.
   * @private
   */
  _pushVersionHistory(id, entry) {
    const history = this._versions.get(id) ?? [];
    history.push({
      version: entry.version,
      description: entry.description,
      vector: entry.vector,
      ts: entry.updatedAt,
    });
    this._versions.set(id, history);
  }

  /**
   * Retrieve the full version history for an anchor.
   * @param {string} id
   * @returns {Array<{version, description, vector, ts}>}
   */
  getVersionHistory(id) {
    return (this._versions.get(id) ?? []).map(v => ({
      version: v.version,
      description: v.description,
      ts: v.ts,
      // vectors omitted by default to keep responses lean; use getVersionVector() if needed
    }));
  }

  /**
   * Retrieve the embedding vector at a specific historical version.
   * @param {string} id
   * @param {number} version
   * @returns {Float32Array|null}
   */
  getVersionVector(id, version) {
    const history = this._versions.get(id);
    if (!history) return null;
    const entry = history.find(v => v.version === version);
    return entry ? entry.vector : null;
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  /**
   * Export the full registry to a JSON-safe plain object.
   * @returns {object}
   */
  export() {
    const anchors = [];
    for (const [id, entry] of this._anchors) {
      anchors.push({
        id: entry.id,
        description: entry.description,
        vector: Array.from(entry.vector),
        category: entry.category,
        metadata: entry.metadata,
        version: entry.version,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }

    const versions = {};
    for (const [id, history] of this._versions) {
      versions[id] = history.map(v => ({
        version: v.version,
        description: v.description,
        vector: Array.from(v.vector),
        ts: v.ts,
      }));
    }

    return {
      formatVersion: 1,
      exportedAt: Date.now(),
      anchors,
      versions,
    };
  }

  /**
   * Restore registry state from a previously exported plain object.
   * Clears all existing anchors, versions, and cache before restoring.
   * @param {object} data — produced by export()
   */
  import(data) {
    if (!data || data.formatVersion !== 1) {
      throw new Error('Incompatible export format version');
    }

    this._anchors.clear();
    this._versions.clear();
    this._embeddingCache.clear();

    for (const a of data.anchors) {
      const entry = {
        id: a.id,
        description: a.description,
        vector: new Float32Array(a.vector),
        category: a.category ?? 'general',
        metadata: a.metadata ?? {},
        version: a.version ?? 1,
        createdAt: a.createdAt ?? Date.now(),
        updatedAt: a.updatedAt ?? Date.now(),
      };
      this._anchors.set(a.id, entry);
    }

    if (data.versions) {
      for (const [id, history] of Object.entries(data.versions)) {
        this._versions.set(id, history.map(v => ({
          version: v.version,
          description: v.description,
          vector: new Float32Array(v.vector),
          ts: v.ts,
        })));
      }
    }

    logger.info('[AnchorRegistry] State imported', { anchors: this._anchors.size });
  }

  // -------------------------------------------------------------------------
  // Cache maintenance
  // -------------------------------------------------------------------------

  /**
   * Evict all expired entries from the embedding cache.
   * @returns {number} number of entries evicted
   */
  pruneCache() {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this._embeddingCache) {
      if (entry.expiresAt <= now) {
        this._embeddingCache.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.debug(`[AnchorRegistry] Cache pruned: ${evicted} entries evicted`);
    }
    return evicted;
  }

  /**
   * Return registry statistics.
   * @returns {object}
   */
  stats() {
    return {
      anchorCount: this._anchors.size,
      cacheSize: this._embeddingCache.size,
      versionedAnchors: this._versions.size,
      hasExternalEmbedFn: typeof this._externalEmbedFn === 'function',
      overlapThreshold: this._overlapScale.value,
      gapThreshold: this._gapScale.value,
    };
  }
}

// Static singleton holder
AnchorRegistry._instance = null;

// ---------------------------------------------------------------------------
// JSDoc type definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} AnchorEntry
 * @property {string} id
 * @property {string} description
 * @property {Float32Array} vector
 * @property {string} category
 * @property {object} metadata
 * @property {number} version
 * @property {number} createdAt
 * @property {number} updatedAt
 */

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { AnchorRegistry };

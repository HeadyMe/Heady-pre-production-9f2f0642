/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * RAM-first 3D Vector Memory — the brain of the Heady™ AI Platform.
 * Stores 384-dimensional embeddings in-memory Maps with optional
 * JSON-lines persistence and namespace isolation.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { cosineSimilarity, EMBEDDING_DIM } = require('./vector-space-ops');
const logger = require('./utils/logger');

const DRIFT_THRESHOLD = 0.75;
const FLOAT64_BYTES = 8;

class VectorMemory {
  /**
   * @param {object} [opts]
   * @param {string} [opts.defaultNamespace='default']
   */
  constructor(opts = {}) {
    this._defaultNs = opts.defaultNamespace || 'default';
    /** @type {Map<string, Map<string, { vector: Float64Array, metadata: object, updatedAt: number }>>} */
    this._store = new Map();
    this._ensureNamespace(this._defaultNs);
    logger.info({ component: 'VectorMemory' }, 'VectorMemory initialised');
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _ensureNamespace(ns) {
    if (!this._store.has(ns)) this._store.set(ns, new Map());
  }

  _resolveKey(key, namespace) {
    const ns = namespace || this._defaultNs;
    this._ensureNamespace(ns);
    return { ns, map: this._store.get(ns) };
  }

  _toFloat64(v) {
    if (v instanceof Float64Array) return v;
    if (v instanceof Float32Array || Array.isArray(v)) return Float64Array.from(v);
    throw new TypeError('vector must be an Array or Float32/64Array');
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Store a vector with associated metadata.
   * @param {string} key
   * @param {number[]|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   */
  store(key, vector, metadata = {}, namespace) {
    const { map } = this._resolveKey(key, namespace);
    const vec = this._toFloat64(vector);
    if (vec.length !== EMBEDDING_DIM) {
      logger.warn({ key, dim: vec.length }, 'VectorMemory: non-standard embedding dimension');
    }
    map.set(key, { vector: vec, metadata: { ...metadata }, updatedAt: Date.now() });
    logger.debug({ key, ns: namespace || this._defaultNs }, 'VectorMemory: stored');
  }

  /**
   * Retrieve a stored entry by key.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {{ vector: Float64Array, metadata: object, updatedAt: number }|null}
   */
  get(key, namespace) {
    const { map } = this._resolveKey(key, namespace);
    return map.get(key) || null;
  }

  /**
   * Update an existing entry. Creates it if not present.
   * @param {string} key
   * @param {number[]|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   */
  update(key, vector, metadata = {}, namespace) {
    const existing = this.get(key, namespace);
    const mergedMeta = existing ? { ...existing.metadata, ...metadata } : metadata;
    this.store(key, vector, mergedMeta, namespace);
  }

  /**
   * Delete an entry.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {boolean} true if deleted
   */
  delete(key, namespace) {
    const { map } = this._resolveKey(key, namespace);
    const deleted = map.delete(key);
    if (deleted) logger.debug({ key, ns: namespace || this._defaultNs }, 'VectorMemory: deleted');
    return deleted;
  }

  /**
   * Clear all entries in a namespace (or the default namespace).
   * @param {string} [namespace]
   */
  clear(namespace) {
    const ns = namespace || this._defaultNs;
    if (this._store.has(ns)) {
      this._store.get(ns).clear();
      logger.info({ ns }, 'VectorMemory: namespace cleared');
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Cosine similarity search across a namespace.
   * @param {number[]|Float64Array} queryVector
   * @param {number} [limit=5]
   * @param {number} [minScore=0.6]
   * @param {string} [namespace]
   * @returns {Array<{ key: string, score: number, metadata: object }>}
   */
  search(queryVector, limit = 5, minScore = 0.6, namespace) {
    const { map } = this._resolveKey(null, namespace);
    const query = this._toFloat64(queryVector);
    const results = [];

    for (const [key, entry] of map.entries()) {
      const score = cosineSimilarity(query, entry.vector);
      if (score >= minScore) results.push({ key, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ─── Drift detection ───────────────────────────────────────────────────────

  /**
   * Detect semantic drift between two vectors.
   * @param {number[]|Float64Array} vectorA
   * @param {number[]|Float64Array} vectorB
   * @returns {{ similarity: number, isDrifting: boolean }}
   */
  detectDrift(vectorA, vectorB) {
    const similarity = cosineSimilarity(
      this._toFloat64(vectorA),
      this._toFloat64(vectorB),
    );
    return { similarity, isDrifting: similarity < DRIFT_THRESHOLD };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Return high-level statistics about the memory store.
   * @returns {{ totalVectors: number, namespaces: string[], memoryEstimateBytes: number }}
   */
  stats() {
    let totalVectors = 0;
    const namespaces = [];
    for (const [ns, map] of this._store.entries()) {
      totalVectors += map.size;
      namespaces.push(ns);
    }
    // Estimate: each entry ≈ EMBEDDING_DIM * 8 bytes (Float64) + ~200 bytes overhead
    const memoryEstimateBytes = totalVectors * (EMBEDDING_DIM * FLOAT64_BYTES + 200);
    return { totalVectors, namespaces, memoryEstimateBytes };
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  /**
   * Persist all namespaces to a JSON-lines file.
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  async persist(filePath) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

    for (const [ns, map] of this._store.entries()) {
      for (const [key, entry] of map.entries()) {
        const line = JSON.stringify({
          ns,
          key,
          vector: Array.from(entry.vector),
          metadata: entry.metadata,
          updatedAt: entry.updatedAt,
        });
        stream.write(line + '\n');
      }
    }

    await new Promise((resolve, reject) => {
      stream.end();
      stream.once('finish', resolve);
      stream.once('error', reject);
    });

    logger.info({ filePath }, 'VectorMemory: persisted');
  }

  /**
   * Load vectors from a JSON-lines file (merges into current store).
   * @param {string} filePath
   * @returns {Promise<number>} count of loaded entries
   */
  async load(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let count = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const { ns, key, vector, metadata, updatedAt } = JSON.parse(line);
        this._ensureNamespace(ns);
        this._store.get(ns).set(key, {
          vector: Float64Array.from(vector),
          metadata: metadata || {},
          updatedAt: updatedAt || Date.now(),
        });
        count++;
      } catch (err) {
        logger.warn({ err: err.message }, 'VectorMemory: skipping malformed line');
      }
    }

    logger.info({ filePath, count }, 'VectorMemory: loaded');
    return count;
  }
}

module.exports = { VectorMemory, DRIFT_THRESHOLD };

/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══════════════════════════════════════════════════════════════════
 * VectorMemory V2 — Production-Grade RAM-First Vector Store
 * ═══════════════════════════════════════════════════════════════════
 *
 * CHANGES FROM V1 (vector-memory.js):
 *   [FIXED]  Added `queryMemory(text, limit, filter)` — the missing method
 *            called in buddy-core.js Phase 3 (was a runtime bug)
 *   [NEW]    HNSW-lite approximate nearest neighbor index (NSW graph)
 *            — O(log n) search vs O(n) in V1
 *   [NEW]    Hybrid search: cosine similarity + BM25 keyword fallback,
 *            weighted by `alpha` parameter (1.0 = pure vector, 0.0 = pure BM25)
 *   [NEW]    Metadata predicate filtering on search()
 *   [NEW]    Automatic compaction: dedup + eviction of stale entries
 *   [NEW]    Float32 storage option (halves memory vs Float64 in V1)
 *   [NEW]    `ingestMemory({content, metadata})` — high-level API for text
 *            (used by continuous-learning.js and DeterministicErrorInterceptor)
 *   [NEW]    Namespace-level TTL expiry
 *   [NEW]    Stats include per-namespace breakdown
 *   [IMPROVED] `persist()` / `load()` support incremental (append-only) mode
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// ─── Vector Math (inline to avoid circular deps) ────────────────────────────

/** @param {Float32Array|Float64Array} v @returns {number} */
function _magnitude(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** @param {Float32Array|Float64Array} a @param {Float32Array|Float64Array} b @returns {number} */
function _cosine(a, b) {
  const ma = _magnitude(a), mb = _magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (ma * mb);
}

/** Pre-normalize a vector to unit length. */
function _normalize(v) {
  const mag = _magnitude(v);
  const out = new Float32Array(v.length);
  if (mag === 0) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i] / mag;
  return out;
}

// ─── BM25 Keyword Scorer ────────────────────────────────────────────────────

const BM25_K1 = 1.5;
const BM25_B  = 0.75;

/**
 * Lightweight BM25 scorer for the text stored in entry metadata/content.
 * Used for hybrid search fallback.
 */
class BM25Index {
  constructor() {
    /** @type {Map<string, {tf: Map<string, number>, length: number}>} */
    this._docs = new Map(); // key → { tf, length }
    this._df = new Map();   // term → doc frequency
    this._totalDocs = 0;
    this._avgDocLen = 0;
    this._totalDocLen = 0;
  }

  /**
   * Index a document.
   * @param {string} key - Document identifier (same as vector key)
   * @param {string} text - Document text
   */
  index(key, text) {
    const terms = this._tokenize(text);
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);

    // If re-indexing, subtract old doc stats
    if (this._docs.has(key)) {
      const old = this._docs.get(key);
      for (const [t, c] of old.tf) {
        const df = this._df.get(t) || 0;
        if (df <= 1) this._df.delete(t);
        else this._df.set(t, df - 1);
      }
      this._totalDocLen -= old.length;
      this._totalDocs--;
    }

    this._docs.set(key, { tf, length: terms.length });
    for (const t of tf.keys()) this._df.set(t, (this._df.get(t) || 0) + 1);
    this._totalDocs++;
    this._totalDocLen += terms.length;
    this._avgDocLen = this._totalDocs > 0 ? this._totalDocLen / this._totalDocs : 0;
  }

  /**
   * Remove a document from the index.
   * @param {string} key
   */
  remove(key) {
    const doc = this._docs.get(key);
    if (!doc) return;
    for (const [t, c] of doc.tf) {
      const df = this._df.get(t) || 0;
      if (df <= 1) this._df.delete(t);
      else this._df.set(t, df - 1);
    }
    this._totalDocLen -= doc.length;
    this._totalDocs--;
    this._avgDocLen = this._totalDocs > 0 ? this._totalDocLen / this._totalDocs : 0;
    this._docs.delete(key);
  }

  /**
   * Compute BM25 score for a query against a document.
   * @param {string} query
   * @param {string} key - Document key to score
   * @returns {number}
   */
  score(query, key) {
    const doc = this._docs.get(key);
    if (!doc) return 0;

    const qTerms = this._tokenize(query);
    let score = 0;
    for (const t of qTerms) {
      const tf_d = doc.tf.get(t) || 0;
      if (tf_d === 0) continue;
      const df = this._df.get(t) || 0;
      if (df === 0) continue;
      const N = this._totalDocs;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      const tfNorm = (tf_d * (BM25_K1 + 1)) /
        (tf_d + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / (this._avgDocLen || 1))));
      score += idf * tfNorm;
    }
    return score;
  }

  /**
   * Get all scored keys for a query, sorted descending.
   * @param {string} query
   * @returns {Array<{key: string, score: number}>}
   */
  search(query, limit = 20) {
    const results = [];
    for (const key of this._docs.keys()) {
      const s = this.score(query, key);
      if (s > 0) results.push({ key, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** @private */
  _tokenize(text) {
    return (text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}

// ─── NSW Approximate Nearest-Neighbor Index ─────────────────────────────────

/**
 * Navigable Small World graph for approximate nearest neighbor search.
 * Provides O(log n) average-case search vs O(n) linear scan.
 *
 * This is a simplified NSW (not full HNSW) — suitable for in-process use
 * where DuckDB's full HNSW index is not available.
 *
 * Parameters:
 *   M          = max connections per node (default 16)
 *   ef_search  = beam width during search (default 32)
 */
class NSWIndex {
  /**
   * @param {object} opts
   * @param {number} [opts.M=16]         - Max edges per node
   * @param {number} [opts.efSearch=32]  - Beam width for search
   */
  constructor(opts = {}) {
    this.M = opts.M ?? 16;
    this.efSearch = opts.efSearch ?? 32;
    /** @type {Map<string, {vector: Float32Array, neighbors: Set<string>}>} */
    this._nodes = new Map();
  }

  /**
   * Insert a node into the index.
   * @param {string} key
   * @param {Float32Array} vector - Pre-normalized unit vector
   */
  insert(key, vector) {
    if (this._nodes.size === 0) {
      this._nodes.set(key, { vector, neighbors: new Set() });
      return;
    }

    // Find M nearest neighbors via greedy search
    const candidates = this._greedySearch(vector, this.M);

    // Add node with edges to its neighbors
    const node = { vector, neighbors: new Set(candidates.map(c => c.key)) };
    this._nodes.set(key, node);

    // Bidirectional edge: neighbors also point back to this node
    for (const { key: nbrKey } of candidates) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) {
        nbr.neighbors.add(key);
        // Prune if over M connections (keep M closest)
        if (nbr.neighbors.size > this.M) {
          this._pruneNeighbors(nbrKey);
        }
      }
    }
  }

  /**
   * Remove a node from the index.
   * @param {string} key
   */
  remove(key) {
    const node = this._nodes.get(key);
    if (!node) return;
    // Remove back-edges
    for (const nbrKey of node.neighbors) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) nbr.neighbors.delete(key);
    }
    this._nodes.delete(key);
  }

  /**
   * Find approximate nearest neighbors.
   * @param {Float32Array} query - Pre-normalized query vector
   * @param {number} [k=10]
   * @returns {Array<{key: string, score: number}>}
   */
  search(query, k = 10) {
    if (this._nodes.size === 0) return [];
    return this._greedySearch(query, Math.max(k, this.efSearch)).slice(0, k);
  }

  /** @private */
  _greedySearch(query, ef) {
    // Pick a random entry point
    const entryKey = this._nodes.keys().next().value;
    const entry = this._nodes.get(entryKey);

    const visited = new Set([entryKey]);
    const candidates = [{ key: entryKey, score: _cosine(query, entry.vector) }];
    const result = [...candidates];

    while (candidates.length > 0) {
      // Pick best unvisited candidate
      candidates.sort((a, b) => b.score - a.score);
      const current = candidates.shift();

      const node = this._nodes.get(current.key);
      if (!node) continue;

      for (const nbrKey of node.neighbors) {
        if (visited.has(nbrKey)) continue;
        visited.add(nbrKey);
        const nbr = this._nodes.get(nbrKey);
        if (!nbr) continue;
        const score = _cosine(query, nbr.vector);
        result.push({ key: nbrKey, score });
        if (candidates.length < ef) candidates.push({ key: nbrKey, score });
      }

      if (visited.size > ef * 3) break; // Safety cap
    }

    result.sort((a, b) => b.score - a.score);
    return result.slice(0, ef);
  }

  /** @private */
  _pruneNeighbors(key) {
    const node = this._nodes.get(key);
    if (!node) return;
    const scored = [];
    for (const nbrKey of node.neighbors) {
      const nbr = this._nodes.get(nbrKey);
      if (nbr) scored.push({ key: nbrKey, score: _cosine(node.vector, nbr.vector) });
    }
    scored.sort((a, b) => b.score - a.score);
    node.neighbors = new Set(scored.slice(0, this.M).map(s => s.key));
  }

  get size() { return this._nodes.size; }
  get nodeCount() { return this._nodes.size; }
}

// ─── Namespace Container ─────────────────────────────────────────────────────

/**
 * Per-namespace storage with its own NSW index and BM25 scorer.
 */
class Namespace {
  /**
   * @param {string} name
   * @param {object} opts
   * @param {number} [opts.ttlMs=0]       - Entry TTL (0 = no expiry)
   * @param {number} [opts.maxEntries=0]  - Max entries before LRU eviction (0 = no limit)
   * @param {object} [opts.nsw]           - NSW index options
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.ttlMs = opts.ttlMs ?? 0;
    this.maxEntries = opts.maxEntries ?? 0;

    /** @type {Map<string, {vector: Float32Array, metadata: object, text: string, updatedAt: number, accessedAt: number}>} */
    this.entries = new Map();

    this.nsw = new NSWIndex(opts.nsw || {});
    this.bm25 = new BM25Index();

    this.stats = { stores: 0, deletes: 0, hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Store a vector entry.
   * @param {string} key
   * @param {Float32Array} vector - Pre-normalized
   * @param {object} metadata
   * @param {string} [text] - Raw text for BM25 indexing
   */
  set(key, vector, metadata, text = '') {
    const isUpdate = this.entries.has(key);

    // LRU eviction before insertion
    if (!isUpdate && this.maxEntries > 0 && this.entries.size >= this.maxEntries) {
      this._evictLRU();
    }

    this.entries.set(key, {
      vector,
      metadata: { ...metadata },
      text,
      updatedAt: Date.now(),
      accessedAt: Date.now(),
    });

    // Update indexes
    if (!isUpdate) {
      this.nsw.insert(key, vector);
    }
    this.bm25.index(key, text || JSON.stringify(metadata));
    this.stats.stores++;
  }

  /**
   * Retrieve an entry by key.
   * @param {string} key
   * @returns {object|null}
   */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) { this.stats.misses++; return null; }

    // TTL check
    if (this.ttlMs > 0 && Date.now() - entry.updatedAt > this.ttlMs) {
      this._delete(key);
      this.stats.misses++;
      return null;
    }

    entry.accessedAt = Date.now();
    this.stats.hits++;
    return entry;
  }

  /**
   * Delete an entry.
   * @param {string} key
   * @returns {boolean}
   */
  _delete(key) {
    if (!this.entries.has(key)) return false;
    this.entries.delete(key);
    this.nsw.remove(key);
    this.bm25.remove(key);
    this.stats.deletes++;
    return true;
  }

  /** @private LRU eviction — removes the least recently accessed entry. */
  _evictLRU() {
    let oldest = null, oldestTime = Infinity;
    for (const [key, entry] of this.entries) {
      if (entry.accessedAt < oldestTime) {
        oldest = key;
        oldestTime = entry.accessedAt;
      }
    }
    if (oldest) {
      this._delete(oldest);
      this.stats.evictions++;
    }
  }

  /** Evict all entries older than `maxAgeMs`. */
  evictStale(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    let count = 0;
    for (const [key, entry] of this.entries) {
      if (entry.updatedAt < cutoff) {
        this._delete(key);
        count++;
      }
    }
    return count;
  }

  /** Deduplicate near-identical entries. Returns count removed. */
  dedup(threshold = 0.98) {
    const keys = [...this.entries.keys()];
    const toDelete = new Set();
    for (let i = 0; i < keys.length; i++) {
      if (toDelete.has(keys[i])) continue;
      const a = this.entries.get(keys[i]);
      for (let j = i + 1; j < keys.length; j++) {
        if (toDelete.has(keys[j])) continue;
        const b = this.entries.get(keys[j]);
        if (_cosine(a.vector, b.vector) >= threshold) {
          // Keep the newer one
          const older = a.updatedAt <= b.updatedAt ? keys[i] : keys[j];
          toDelete.add(older);
        }
      }
    }
    for (const key of toDelete) this._delete(key);
    return toDelete.size;
  }

  get size() { return this.entries.size; }
}

// ─── VectorMemory V2 ─────────────────────────────────────────────────────────

/**
 * Production-grade RAM-first vector memory with:
 *   - NSW approximate nearest neighbor index
 *   - Hybrid search (vector + BM25 keyword)
 *   - Metadata predicate filtering
 *   - Namespace-level TTL and LRU eviction
 *   - Automatic compaction
 *   - `ingestMemory()` high-level API (compatible with buddy-core, continuous-learning)
 *   - `queryMemory()` high-level API (fixes the runtime bug in buddy-core Phase 3)
 */
class VectorMemoryV2 {
  /**
   * @param {object} [opts]
   * @param {string}   [opts.defaultNamespace='default']
   * @param {Function} [opts.embedFn]        - async (text: string) => Float32Array|number[]
   *                                           If provided, ingestMemory/queryMemory work fully
   * @param {number}   [opts.driftThreshold=0.75]
   * @param {object}   [opts.nsw]            - NSW index options { M, efSearch }
   * @param {object}   [opts.namespaceDefaults] - Default opts for new namespaces { ttlMs, maxEntries }
   * @param {boolean}  [opts.useFloat32=true] - Store as Float32 (saves memory vs Float64)
   * @param {number}   [opts.compactionIntervalMs=0] - Auto-compact interval (0 = disabled)
   */
  constructor(opts = {}) {
    this._defaultNs = opts.defaultNamespace || 'default';
    this._embedFn = opts.embedFn || null;
    this._driftThreshold = opts.driftThreshold ?? 0.75;
    this._nswOpts = opts.nsw || {};
    this._nsDefaults = opts.namespaceDefaults || {};
    this._useFloat32 = opts.useFloat32 ?? true;

    /** @type {Map<string, Namespace>} */
    this._namespaces = new Map();
    this._ensureNamespace(this._defaultNs);

    this._totalIngested = 0;
    this._compactionRuns = 0;

    // Auto-compaction
    if (opts.compactionIntervalMs > 0) {
      this._compactionTimer = setInterval(
        () => this.compact(),
        opts.compactionIntervalMs
      ).unref(); // Don't prevent process exit
    }
  }

  // ─── Namespace Management ──────────────────────────────────────────────────

  /**
   * Ensure a namespace exists, creating it if needed.
   * @param {string} ns
   * @param {object} [opts]
   */
  _ensureNamespace(ns, opts = {}) {
    if (!this._namespaces.has(ns)) {
      this._namespaces.set(ns, new Namespace(ns, { ...this._nsDefaults, ...opts }));
    }
  }

  /**
   * Configure a namespace with TTL and/or max entries.
   * @param {string} ns
   * @param {object} opts - { ttlMs, maxEntries }
   */
  configureNamespace(ns, opts = {}) {
    this._ensureNamespace(ns, opts);
    const namespace = this._namespaces.get(ns);
    if (opts.ttlMs !== undefined) namespace.ttlMs = opts.ttlMs;
    if (opts.maxEntries !== undefined) namespace.maxEntries = opts.maxEntries;
  }

  /** @private */
  _ns(namespace) {
    const ns = namespace || this._defaultNs;
    this._ensureNamespace(ns);
    return this._namespaces.get(ns);
  }

  /** @private */
  _toVector(v) {
    if (v instanceof Float32Array) return v;
    if (v instanceof Float64Array || Array.isArray(v)) {
      return this._useFloat32 ? Float32Array.from(v) : Float64Array.from(v);
    }
    throw new TypeError('[VectorMemoryV2] vector must be Array, Float32Array, or Float64Array');
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Store a vector with metadata.
   * Vector is pre-normalized on store for faster dot-product search.
   *
   * @param {string} key
   * @param {number[]|Float32Array|Float64Array} vector
   * @param {object} [metadata={}]
   * @param {string} [namespace]
   * @param {string} [text] - Plain text for BM25 (auto-extracted from metadata.content if not provided)
   */
  store(key, vector, metadata = {}, namespace, text) {
    const ns = this._ns(namespace);
    const vec = _normalize(this._toVector(vector));
    const docText = text || metadata.content || metadata.text || JSON.stringify(metadata);
    ns.set(key, vec, metadata, docText);
  }

  /**
   * Retrieve an entry by key.
   * @param {string} key
   * @param {string} [namespace]
   * @returns {{vector: Float32Array, metadata: object, updatedAt: number}|null}
   */
  get(key, namespace) {
    return this._ns(namespace).get(key);
  }

  /**
   * Update an existing entry (merge metadata).
   * @param {string} key
   * @param {number[]|Float32Array} vector
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
   * @returns {boolean}
   */
  delete(key, namespace) {
    return this._ns(namespace)._delete(key);
  }

  /**
   * Clear all entries in a namespace.
   * @param {string} [namespace]
   */
  clear(namespace) {
    const ns = namespace || this._defaultNs;
    this._namespaces.delete(ns);
    this._ensureNamespace(ns);
  }

  // ─── High-Level Ingestion API ─────────────────────────────────────────────

  /**
   * Ingest a text memory using the configured embedFn.
   *
   * This is the high-level API used by:
   *   - continuous-learning.js (runLearningCycle)
   *   - buddy-core.js (DeterministicErrorInterceptor Phase 5)
   *
   * @param {object} opts
   * @param {string} opts.content   - Text content to embed and store
   * @param {object} [opts.metadata={}]
   * @param {string} [opts.key]     - Custom key (auto-generated if not provided)
   * @param {string} [opts.namespace]
   * @returns {Promise<{key: string, ok: boolean}>}
   */
  async ingestMemory({ content, metadata = {}, key, namespace } = {}) {
    if (!content) throw new Error('[VectorMemoryV2] ingestMemory: content is required');

    const memKey = key || `mem-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let vector;
    if (this._embedFn) {
      try {
        vector = await this._embedFn(content);
      } catch (err) {
        // Fall back to a deterministic hash-based pseudo-vector
        vector = this._hashVector(content);
      }
    } else {
      // No embed function — use hash-based pseudo-vector
      vector = this._hashVector(content);
    }

    this.store(memKey, vector, { ...metadata, content, ingestedAt: new Date().toISOString() }, namespace, content);
    this._totalIngested++;
    return { key: memKey, ok: true };
  }

  /**
   * Query memory using a text string.
   * Uses hybrid search if an embedFn is configured.
   *
   * THIS METHOD WAS MISSING FROM V1 — causing a runtime bug in buddy-core.js
   * Phase 3 (DeterministicErrorInterceptor semantic analysis).
   *
   * @param {string} query      - Natural language query
   * @param {number} [limit=5]
   * @param {object} [filter]   - Metadata filter { key: value, ... }
   * @param {string} [namespace]
   * @returns {Promise<Array<{key: string, score: number, metadata: object, content: string}>>}
   */
  async queryMemory(query, limit = 5, filter = null, namespace) {
    if (!query) return [];

    let queryVector = null;
    if (this._embedFn) {
      try {
        queryVector = await this._embedFn(query);
      } catch {
        queryVector = this._hashVector(query);
      }
    } else {
      queryVector = this._hashVector(query);
    }

    // Hybrid search: alpha = 0.7 vector + 0.3 BM25
    const results = this.searchHybrid(queryVector, query, limit * 3, 0.7, filter, namespace);

    // Apply metadata filter if provided
    const filtered = filter
      ? results.filter(r => this._matchesFilter(r.metadata, filter))
      : results;

    return filtered.slice(0, limit).map(r => ({
      key: r.key,
      score: r.score,
      metadata: r.metadata,
      content: r.metadata?.content || '',
    }));
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Cosine similarity search using the NSW approximate index.
   *
   * CHANGE FROM V1: Uses NSW O(log n) index instead of O(n) linear scan.
   *
   * @param {number[]|Float32Array} queryVector
   * @param {number} [limit=5]
   * @param {number} [minScore=0.5]
   * @param {object|null} [filter] - Metadata predicate filter
   * @param {string} [namespace]
   * @returns {Array<{key: string, score: number, metadata: object}>}
   */
  search(queryVector, limit = 5, minScore = 0.5, filter = null, namespace) {
    const ns = this._ns(namespace);
    const query = _normalize(this._toVector(queryVector));

    // NSW ANN search (candidate set is larger to allow post-filtering)
    const candidateK = filter ? limit * 5 : limit * 2;
    const candidates = ns.nsw.search(query, Math.max(candidateK, 20));

    const results = [];
    for (const { key, score } of candidates) {
      if (score < minScore) continue;
      const entry = ns.get(key);
      if (!entry) continue;
      if (filter && !this._matchesFilter(entry.metadata, filter)) continue;
      results.push({ key, score, metadata: entry.metadata });
    }

    return results.slice(0, limit);
  }

  /**
   * Hybrid search combining cosine similarity (NSW) and BM25 keyword ranking.
   *
   * CHANGE FROM V1: This is entirely new.
   *
   * @param {number[]|Float32Array} queryVector
   * @param {string} queryText
   * @param {number} [limit=5]
   * @param {number} [alpha=0.7]  - Weight for vector score (1-alpha = BM25 weight)
   * @param {object|null} [filter]
   * @param {string} [namespace]
   * @returns {Array<{key: string, score: number, vectorScore: number, bm25Score: number, metadata: object}>}
   */
  searchHybrid(queryVector, queryText, limit = 5, alpha = 0.7, filter = null, namespace) {
    const ns = this._ns(namespace);
    const query = _normalize(this._toVector(queryVector));

    // Get vector candidates (larger pool for merging)
    const vectorResults = ns.nsw.search(query, Math.max(limit * 4, 50));
    const vectorScores = new Map(vectorResults.map(r => [r.key, r.score]));

    // Get BM25 candidates
    const bm25Results = ns.bm25.search(queryText, Math.max(limit * 4, 50));
    const rawBm25Scores = new Map(bm25Results.map(r => [r.key, r.score]));

    // Normalize BM25 scores to [0, 1]
    const maxBm25 = Math.max(...rawBm25Scores.values(), 1);
    const bm25Scores = new Map([...rawBm25Scores].map(([k, v]) => [k, v / maxBm25]));

    // Union of candidates
    const allKeys = new Set([...vectorScores.keys(), ...bm25Scores.keys()]);

    const results = [];
    for (const key of allKeys) {
      const vScore = vectorScores.get(key) ?? 0;
      const bScore = bm25Scores.get(key) ?? 0;
      const combined = alpha * vScore + (1 - alpha) * bScore;

      if (combined < 0.1) continue;

      const entry = ns.get(key);
      if (!entry) continue;
      if (filter && !this._matchesFilter(entry.metadata, filter)) continue;

      results.push({ key, score: combined, vectorScore: vScore, bm25Score: bScore, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Exact key lookup. Returns null if key not found or expired.
   * @param {string} key
   * @param {string} [namespace]
   */
  getEntry(key, namespace) {
    return this._ns(namespace).get(key);
  }

  // ─── Drift Detection ──────────────────────────────────────────────────────

  /**
   * Detect semantic drift between two vectors.
   * @param {number[]|Float32Array} a
   * @param {number[]|Float32Array} b
   * @returns {{ similarity: number, isDrifting: boolean }}
   */
  detectDrift(a, b) {
    const similarity = _cosine(this._toVector(a), this._toVector(b));
    return { similarity, isDrifting: similarity < this._driftThreshold };
  }

  // ─── Compaction ───────────────────────────────────────────────────────────

  /**
   * Run compaction across all namespaces:
   *   1. Evict TTL-expired entries
   *   2. Deduplicate near-identical entries
   *
   * CHANGE FROM V1: This is entirely new.
   *
   * @param {object} [opts]
   * @param {number} [opts.dedupThreshold=0.98]  - Cosine threshold for dedup
   * @param {number} [opts.maxStaleAgeMs=0]       - Evict entries older than this (0 = skip)
   * @returns {{ evicted: number, deduped: number, durationMs: number }}
   */
  compact(opts = {}) {
    const { dedupThreshold = 0.98, maxStaleAgeMs = 0 } = opts;
    const start = Date.now();
    let evicted = 0, deduped = 0;

    for (const ns of this._namespaces.values()) {
      // TTL-based eviction
      if (ns.ttlMs > 0) {
        evicted += ns.evictStale(ns.ttlMs);
      }
      // Explicit max age eviction
      if (maxStaleAgeMs > 0) {
        evicted += ns.evictStale(maxStaleAgeMs);
      }
      // Deduplication (O(n²) — run on namespaces with ≤ 10k entries)
      if (ns.size <= 10_000) {
        deduped += ns.dedup(dedupThreshold);
      }
    }

    this._compactionRuns++;
    return { evicted, deduped, durationMs: Date.now() - start };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /**
   * Persist all namespaces to a JSON-lines file.
   *
   * CHANGE FROM V1: Vectors stored as Float32 (half the size).
   * Also supports incremental/append mode.
   *
   * @param {string} filePath
   * @param {object} [opts]
   * @param {boolean} [opts.append=false] - Append to existing file (incremental)
   * @returns {Promise<number>} entries written
   */
  async persist(filePath, opts = {}) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const flag = opts.append ? 'a' : 'w';
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8', flags: flag });
    let count = 0;

    for (const [nsName, ns] of this._namespaces) {
      for (const [key, entry] of ns.entries) {
        const line = JSON.stringify({
          ns: nsName,
          key,
          vector: Array.from(entry.vector),
          metadata: entry.metadata,
          text: entry.text || '',
          updatedAt: entry.updatedAt,
        });
        stream.write(line + '\n');
        count++;
      }
    }

    await new Promise((resolve, reject) => {
      stream.end();
      stream.once('finish', resolve);
      stream.once('error', reject);
    });

    return count;
  }

  /**
   * Load vectors from a JSON-lines file.
   * @param {string} filePath
   * @returns {Promise<number>} entries loaded
   */
  async load(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let count = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const { ns, key, vector, metadata, text, updatedAt } = JSON.parse(line);
        this._ensureNamespace(ns);
        const namespace = this._namespaces.get(ns);
        const vec = _normalize(Float32Array.from(vector));
        namespace.entries.set(key, {
          vector: vec,
          metadata: metadata || {},
          text: text || '',
          updatedAt: updatedAt || Date.now(),
          accessedAt: Date.now(),
        });
        namespace.nsw.insert(key, vec);
        namespace.bm25.index(key, text || JSON.stringify(metadata));
        count++;
      } catch {
        /* skip malformed lines */
      }
    }

    return count;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  /**
   * Memory store statistics.
   * CHANGE FROM V1: Includes per-namespace breakdown.
   */
  stats() {
    let totalVectors = 0;
    const namespaces = [];
    for (const [nsName, ns] of this._namespaces) {
      const count = ns.size;
      totalVectors += count;
      namespaces.push({
        name: nsName,
        vectors: count,
        indexNodes: ns.nsw.size,
        bm25Docs: ns.bm25._docs.size,
        ttlMs: ns.ttlMs,
        maxEntries: ns.maxEntries,
        stats: ns.stats,
      });
    }
    // Float32 = 4 bytes/dim, Float64 = 8 bytes/dim
    const bytesPerVec = this._useFloat32 ? 4 : 8;
    const EMBEDDING_DIM = totalVectors > 0
      ? (this._namespaces.values().next().value?.entries.values().next().value?.vector.length ?? 384)
      : 384;

    return {
      totalVectors,
      namespaces,
      memoryEstimateBytes: totalVectors * (EMBEDDING_DIM * bytesPerVec + 300),
      totalIngested: this._totalIngested,
      compactionRuns: this._compactionRuns,
      useFloat32: this._useFloat32,
      hasEmbedFn: !!this._embedFn,
    };
  }

  // ─── Private Utilities ────────────────────────────────────────────────────

  /**
   * @private
   * Generate a deterministic pseudo-vector from text using SHA-256.
   * Used as fallback when no embedFn is configured.
   * The vector is deterministic but NOT semantically meaningful.
   * @param {string} text
   * @returns {Float32Array}
   */
  _hashVector(text, dim = 384) {
    const vec = new Float32Array(dim);
    const hash = crypto.createHash('sha256').update(text).digest();
    // Fill the vector using repeating bytes from the hash
    for (let i = 0; i < dim; i++) {
      // Map byte to [-1, 1]
      vec[i] = (hash[i % hash.length] / 127.5) - 1;
    }
    return _normalize(vec);
  }

  /**
   * @private
   * Check if a metadata object matches a filter.
   * @param {object} metadata
   * @param {object} filter - { key: value } — exact match
   * @returns {boolean}
   */
  _matchesFilter(metadata, filter) {
    if (!filter || typeof filter !== 'object') return true;
    for (const [k, v] of Object.entries(filter)) {
      if (metadata[k] !== v) return false;
    }
    return true;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Default drift threshold (exported for backward compatibility with V1). */
const DRIFT_THRESHOLD = 0.75;

module.exports = {
  VectorMemoryV2,
  VectorMemory: VectorMemoryV2, // alias for drop-in replacement of V1
  Namespace,
  NSWIndex,
  BM25Index,
  DRIFT_THRESHOLD,
};

'use strict';

/**
 * HeadyCache Semantic Matcher
 *
 * Computes embeddings via HeadyEmbed, performs cosine/euclidean/dot similarity
 * search using a VP-tree (Vantage Point Tree) for sub-linear ANN lookups.
 * Falls back to exact hash match when the embedding service is unavailable.
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const config = require('./config');

// ---------------------------------------------------------------------------
// Distance functions
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two Float32 or regular arrays.
 * Returns value in [-1, 1]; higher = more similar.
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Euclidean distance (lower = more similar).
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Dot product similarity (higher = more similar).
 */
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Unified similarity score in [0, 1] for the configured metric.
 * 1.0 = identical, 0.0 = maximally dissimilar.
 */
function similarity(a, b, metric) {
  switch (metric || config.distanceMetric) {
    case 'euclidean': {
      const d = euclideanDistance(a, b);
      // Normalize: max distance for unit vectors = sqrt(2*dims)
      const maxDist = Math.sqrt(2 * a.length);
      return 1 - Math.min(d / maxDist, 1);
    }
    case 'dot':
      // Clamp dot to [0, 1] assuming normalized vectors
      return Math.max(0, Math.min(1, (dotProduct(a, b) + 1) / 2));
    case 'cosine':
    default:
      return (cosineSimilarity(a, b) + 1) / 2; // map [-1,1] → [0,1]
  }
}

// ---------------------------------------------------------------------------
// VP-Tree (Vantage Point Tree)
// ---------------------------------------------------------------------------

class VPTree {
  /**
   * @param {Array<{id: string, vector: number[]}>} points
   * @param {function(number[], number[]): number} distFn  — returns distance (lower = closer)
   */
  constructor(points, distFn) {
    this._distFn = distFn;
    this._root = this._build(points.slice());
  }

  _build(points) {
    if (points.length === 0) return null;
    if (points.length === 1) return { point: points[0], mu: 0, left: null, right: null };

    // Pick a random vantage point
    const vpIdx = Math.floor(Math.random() * points.length);
    const vp = points[vpIdx];
    points.splice(vpIdx, 1);

    // Compute distances to all other points
    const dists = points.map((p) => ({ p, d: this._distFn(vp.vector, p.vector) }));
    dists.sort((a, b) => a.d - b.d);

    const median = dists[Math.floor(dists.length / 2)].d;
    const left = dists.filter((x) => x.d < median).map((x) => x.p);
    const right = dists.filter((x) => x.d >= median).map((x) => x.p);

    return {
      point: vp,
      mu: median,
      left: this._build(left),
      right: this._build(right),
    };
  }

  /**
   * Find the k nearest neighbors to `query`.
   * @param {number[]} queryVector
   * @param {number} k
   * @returns {Array<{id: string, vector: number[], dist: number}>}
   */
  knn(queryVector, k) {
    if (!this._root) return [];
    const heap = []; // max-heap by dist
    this._search(this._root, queryVector, k, heap);
    return heap.sort((a, b) => a.dist - b.dist);
  }

  _search(node, query, k, heap) {
    if (!node) return;

    const d = this._distFn(query, node.point.vector);

    // Maintain max-heap of k smallest distances
    if (heap.length < k) {
      heap.push({ ...node.point, dist: d });
      heap.sort((a, b) => b.dist - a.dist); // sort descending (max at front)
    } else if (d < heap[0].dist) {
      heap[0] = { ...node.point, dist: d };
      heap.sort((a, b) => b.dist - a.dist);
    }

    const tau = heap.length < k ? Infinity : heap[0].dist;

    if (d < node.mu) {
      this._search(node.left, query, k, heap);
      if (d + tau >= node.mu) this._search(node.right, query, k, heap);
    } else {
      this._search(node.right, query, k, heap);
      if (d - tau <= node.mu) this._search(node.left, query, k, heap);
    }
  }

  /**
   * Find all points within `radius` of `queryVector`.
   */
  rangeSearch(queryVector, radius) {
    const results = [];
    this._rangeSearch(this._root, queryVector, radius, results);
    return results.sort((a, b) => a.dist - b.dist);
  }

  _rangeSearch(node, query, radius, results) {
    if (!node) return;
    const d = this._distFn(query, node.point.vector);
    if (d <= radius) results.push({ ...node.point, dist: d });
    if (d - radius <= node.mu) this._rangeSearch(node.left, query, radius, results);
    if (d + radius >= node.mu) this._rangeSearch(node.right, query, radius, results);
  }
}

// ---------------------------------------------------------------------------
// Embedding client
// ---------------------------------------------------------------------------

/**
 * Fetch a JSON response from a URL (minimal http/https client).
 */
function fetchJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Embed request timeout')); });
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// SemanticMatcher
// ---------------------------------------------------------------------------

class SemanticMatcher {
  /**
   * @param {object} opts
   * @param {string}  [opts.embedUrl]
   * @param {number}  [opts.similarityThreshold]
   * @param {string}  [opts.distanceMetric]
   * @param {number}  [opts.embeddingDims]
   * @param {number}  [opts.vpTreeRebuildThreshold]
   */
  constructor(opts = {}) {
    this._embedUrl = opts.embedUrl || config.embedUrl;
    this._threshold = opts.similarityThreshold || config.similarityThreshold;
    this._metric = opts.distanceMetric || config.distanceMetric;
    this._dims = opts.embeddingDims || config.embeddingDims;
    this._rebuildThreshold = opts.vpTreeRebuildThreshold || config.vpTreeRebuildThreshold;

    // namespace → { id → {id, key, vector} }
    this._index = new Map();
    // namespace → VPTree
    this._trees = new Map();
    // namespace → pending changes count
    this._dirty = new Map();

    // Exact hash fallback: hash → id
    this._hashIndex = new Map();

    this._embedAvailable = true;
    this._lastEmbedCheck = 0;
    this._embedCheckInterval = 30000; // recheck embed availability every 30s
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Compute hash of a text key (exact match fallback).
   */
  hashKey(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Get or compute embedding for text.
   * Returns null if service unavailable.
   */
  async embed(text) {
    if (!this._shouldTryEmbed()) return null;
    try {
      const result = await fetchJson(`${this._embedUrl}/embed`, { text });
      if (!result.embedding || !Array.isArray(result.embedding)) {
        throw new Error('Invalid embedding response');
      }
      this._embedAvailable = true;
      return result.embedding;
    } catch (err) {
      this._embedAvailable = false;
      this._lastEmbedCheck = Date.now();
      return null;
    }
  }

  /**
   * Add an entry to the semantic index.
   * @param {string} ns   Namespace
   * @param {string} id   Entry ID / cache key
   * @param {string} text Original text key
   * @param {number[]} [vector] Pre-computed embedding (optional)
   */
  async addToIndex(ns, id, text, vector) {
    // Always add hash fallback
    const hash = this.hashKey(text);
    if (!this._hashIndex.has(ns)) this._hashIndex.set(ns, new Map());
    this._hashIndex.get(ns).set(hash, id);

    if (!vector) {
      vector = await this.embed(text);
    }
    if (!vector) return; // no embedding available, hash-only

    if (!this._index.has(ns)) this._index.set(ns, new Map());
    this._index.get(ns).set(id, { id, key: text, vector });

    // Mark tree dirty
    const dirty = (this._dirty.get(ns) || 0) + 1;
    this._dirty.set(ns, dirty);

    // Incremental rebuild when threshold exceeded
    if (dirty >= this._rebuildThreshold) {
      this._rebuildTree(ns);
    } else {
      // Invalidate tree so next search does full scan until rebuild
      this._trees.delete(ns);
    }
  }

  /**
   * Remove an entry from the semantic index.
   */
  removeFromIndex(ns, id, text) {
    const hash = this.hashKey(text);
    this._hashIndex.get(ns)?.delete(hash);
    if (this._index.has(ns)) {
      this._index.get(ns).delete(id);
      this._dirty.set(ns, (this._dirty.get(ns) || 0) + 1);
      this._trees.delete(ns);
    }
  }

  /**
   * Search for the nearest cached entry to `text`.
   * Returns { id, similarity, exact } or null.
   */
  async search(ns, text) {
    // 1. Exact hash check (always fast)
    const hash = this.hashKey(text);
    const nsHash = this._hashIndex.get(ns);
    if (nsHash && nsHash.has(hash)) {
      return { id: nsHash.get(hash), similarity: 1.0, exact: true };
    }

    // 2. Semantic search
    if (!this._shouldTryEmbed()) return null;

    const queryVec = await this.embed(text);
    if (!queryVec) return null;

    const nsIndex = this._index.get(ns);
    if (!nsIndex || nsIndex.size === 0) return null;

    let bestId = null;
    let bestSim = -Infinity;

    const tree = this._getTree(ns);
    if (tree) {
      // VP-tree ANN search
      const distFn = this._getDistFn();
      const results = tree.knn(queryVec, 1);
      if (results.length > 0) {
        const sim = similarity(queryVec, results[0].vector, this._metric);
        if (sim >= this._threshold) {
          bestId = results[0].id;
          bestSim = sim;
        }
      }
    } else {
      // Linear scan fallback
      for (const [id, entry] of nsIndex) {
        const sim = similarity(queryVec, entry.vector, this._metric);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = id;
        }
      }
      if (bestSim < this._threshold) return null;
    }

    if (!bestId) return null;
    return { id: bestId, similarity: bestSim, exact: false };
  }

  /**
   * Find all IDs with similarity >= threshold to a vector.
   * Used by eviction policy (similarity-aware).
   */
  findSimilarIds(ns, vector, threshold) {
    const nsIndex = this._index.get(ns);
    if (!nsIndex) return [];

    const results = [];
    const tree = this._getTree(ns);

    if (tree) {
      const distFn = this._getDistFn();
      // Convert threshold to distance: dist = 1 - threshold (cosine)
      const radius = 1 - threshold;
      const found = tree.rangeSearch(vector, radius);
      return found.map((x) => ({ id: x.id, similarity: 1 - x.dist }));
    }

    for (const [id, entry] of nsIndex) {
      const sim = similarity(vector, entry.vector, this._metric);
      if (sim >= threshold) results.push({ id, similarity: sim });
    }
    return results;
  }

  /**
   * Get the vector for a given ID, or null.
   */
  getVector(ns, id) {
    return this._index.get(ns)?.get(id)?.vector || null;
  }

  /**
   * Clear all index data for a namespace.
   */
  clearNamespace(ns) {
    this._index.delete(ns);
    this._trees.delete(ns);
    this._dirty.delete(ns);
    this._hashIndex.delete(ns);
  }

  /**
   * Get index size for a namespace.
   */
  indexSize(ns) {
    return this._index.get(ns)?.size || 0;
  }

  /**
   * Force rebuild VP-tree for a namespace.
   */
  rebuildTree(ns) {
    this._rebuildTree(ns);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  _shouldTryEmbed() {
    if (this._embedAvailable) return true;
    // Retry after interval
    return Date.now() - this._lastEmbedCheck > this._embedCheckInterval;
  }

  _getTree(ns) {
    if (this._trees.has(ns)) return this._trees.get(ns);
    const nsIndex = this._index.get(ns);
    if (!nsIndex || nsIndex.size < 2) return null;
    this._rebuildTree(ns);
    return this._trees.get(ns) || null;
  }

  _rebuildTree(ns) {
    const nsIndex = this._index.get(ns);
    if (!nsIndex || nsIndex.size === 0) {
      this._trees.delete(ns);
      return;
    }
    const points = Array.from(nsIndex.values()).map((e) => ({
      id: e.id,
      key: e.key,
      vector: e.vector,
    }));
    const distFn = this._getDistFn();
    this._trees.set(ns, new VPTree(points, distFn));
    this._dirty.set(ns, 0);
  }

  _getDistFn() {
    switch (this._metric) {
      case 'euclidean':
        return euclideanDistance;
      case 'dot':
        return (a, b) => 1 - Math.max(0, Math.min(1, (dotProduct(a, b) + 1) / 2));
      case 'cosine':
      default:
        return (a, b) => 1 - (cosineSimilarity(a, b) + 1) / 2;
    }
  }
}

module.exports = {
  SemanticMatcher,
  VPTree,
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  similarity,
};

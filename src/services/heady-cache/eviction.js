'use strict';

/**
 * HeadyCache Eviction Policy Engine
 *
 * Supported policies:
 *   lru        — Least Recently Used
 *   lfu        — Least Frequently Used
 *   ttl        — Evict expired entries first, then oldest
 *   similarity — Prefer evicting entries with many similar neighbors
 *               (least unique / most redundant)
 *   hybrid     — Weighted combination of multiple policies
 *
 * Memory pressure detection triggers aggressive eviction regardless of policy.
 */

const os = require('os');

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a score array to [0, 1].
 */
function normalize(scores) {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range === 0) return scores.map(() => 0.5);
  return scores.map((s) => (s - min) / range);
}

// ---------------------------------------------------------------------------
// Individual policy scorers
// Returns an array of {key, score} where lower score = evict first
// ---------------------------------------------------------------------------

/**
 * LRU scorer: score = lastAccessed (ms). Lower = older = evict first.
 */
function lruScores(entries) {
  return entries.map(([key, { meta }]) => ({
    key,
    score: meta.lastAccessed || meta.updatedAt || 0,
  }));
}

/**
 * LFU scorer: score = accessCount. Lower = less used = evict first.
 */
function lfuScores(entries) {
  return entries.map(([key, { meta }]) => ({
    key,
    score: meta.accessCount || 0,
  }));
}

/**
 * TTL scorer: score = remaining TTL (ms). Lower = expires sooner = evict first.
 * Expired entries get score = -1 (highest priority).
 */
function ttlScores(entries) {
  const now = Date.now();
  return entries.map(([key, { meta }]) => {
    if (!meta.expiresAt || meta.expiresAt === 0) return { key, score: Infinity };
    const remaining = meta.expiresAt - now;
    return { key, score: remaining };
  });
}

/**
 * Similarity-aware scorer.
 * Entries that have many similar neighbors are more redundant → evict first.
 * Score = number of similar neighbors (higher = more redundant = evict first).
 * We invert so lower score = evict first.
 */
function similarityScores(entries, matcher, namespace, threshold) {
  const scores = entries.map(([key, { meta }]) => {
    if (!meta.vector) return { key, score: 0 };
    const similar = matcher.findSimilarIds(namespace, meta.vector, threshold);
    // Exclude self
    const neighbors = similar.filter((x) => x.id !== key).length;
    return { key, score: -neighbors }; // negate so lower (more neighbors) = evict first
  });
  return scores;
}

// ---------------------------------------------------------------------------
// EvictionEngine
// ---------------------------------------------------------------------------

class EvictionEngine {
  /**
   * @param {object} opts
   * @param {string} [opts.policy='lru']     'lru'|'lfu'|'ttl'|'similarity'|'hybrid'
   * @param {object} [opts.hybridWeights]    { lru, lfu, ttl, similarity } (default equal)
   * @param {number} [opts.memoryThreshold]  Bytes — trigger aggressive eviction
   * @param {number} [opts.aggressiveRatio]  Fraction of cache to evict under pressure (0-1)
   * @param {number} [opts.similarityThreshold] Threshold for similarity scorer
   * @param {object} [opts.matcher]          SemanticMatcher instance
   */
  constructor(opts = {}) {
    this._policy = opts.policy || 'lru';
    this._hybridWeights = opts.hybridWeights || { lru: 0.4, lfu: 0.3, ttl: 0.2, similarity: 0.1 };
    this._memThreshold = opts.memoryThreshold || 512 * 1024 * 1024;
    this._aggressiveRatio = opts.aggressiveRatio || 0.25;
    this._simThreshold = opts.similarityThreshold || 0.9;
    this._matcher = opts.matcher || null;
    this._analytics = null; // set by HeadyCache
  }

  /**
   * Determine which keys should be evicted to reduce cache by `count` entries.
   * @param {Array<[key, {value, meta}]>} entries  All live cache entries (namespace)
   * @param {number} count                          Number of entries to evict
   * @param {string} [namespace]
   * @returns {string[]} Keys to evict, ordered (evict first = index 0)
   */
  select(entries, count, namespace) {
    if (entries.length === 0 || count <= 0) return [];

    const candidates = this._score(entries, namespace);
    // Sort ascending (lowest score = evict first)
    candidates.sort((a, b) => a.score - b.score);

    return candidates.slice(0, count).map((c) => c.key);
  }

  /**
   * Detect if process is under memory pressure.
   * Returns true if heap or RSS exceeds threshold.
   */
  isUnderMemoryPressure() {
    const mem = process.memoryUsage();
    return mem.heapUsed > this._memThreshold || mem.rss > this._memThreshold * 1.5;
  }

  /**
   * Aggressive eviction: remove aggressiveRatio fraction of cache entries.
   * @param {string[]} allKeys  All keys in namespace
   * @param {Array<[key, {value, meta}]>} entries
   * @param {string} [namespace]
   * @returns {string[]} Keys to evict
   */
  aggressiveEviction(entries, namespace) {
    const count = Math.ceil(entries.length * this._aggressiveRatio);
    return this.select(entries, count, namespace);
  }

  /**
   * Set the analytics instance for recording eviction events.
   */
  setAnalytics(analytics) {
    this._analytics = analytics;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  _score(entries, namespace) {
    switch (this._policy) {
      case 'lru':
        return lruScores(entries);
      case 'lfu':
        return lfuScores(entries);
      case 'ttl':
        return ttlScores(entries);
      case 'similarity':
        return this._similarityScore(entries, namespace);
      case 'hybrid':
        return this._hybridScore(entries, namespace);
      default:
        return lruScores(entries);
    }
  }

  _similarityScore(entries, namespace) {
    if (!this._matcher || !namespace) {
      // Fall back to LRU if no matcher
      return lruScores(entries);
    }
    return similarityScores(entries, this._matcher, namespace, this._simThreshold);
  }

  _hybridScore(entries, namespace) {
    const w = this._hybridWeights;
    const policies = [];

    if (w.lru > 0) {
      const raw = lruScores(entries).map((x) => x.score);
      const norm = normalize(raw);
      policies.push({ weight: w.lru, scores: norm });
    }
    if (w.lfu > 0) {
      const raw = lfuScores(entries).map((x) => x.score);
      const norm = normalize(raw);
      policies.push({ weight: w.lfu, scores: norm });
    }
    if (w.ttl > 0) {
      const raw = ttlScores(entries).map((x) => (isFinite(x.score) ? x.score : 1e15));
      const norm = normalize(raw);
      policies.push({ weight: w.ttl, scores: norm });
    }
    if (w.similarity > 0 && this._matcher && namespace) {
      const raw = similarityScores(entries, this._matcher, namespace, this._simThreshold)
        .map((x) => x.score);
      const norm = normalize(raw);
      policies.push({ weight: w.similarity, scores: norm });
    }

    if (policies.length === 0) return lruScores(entries);

    const totalWeight = policies.reduce((s, p) => s + p.weight, 0);

    return entries.map(([key], i) => {
      let score = 0;
      for (const p of policies) score += (p.scores[i] || 0) * p.weight;
      return { key, score: score / totalWeight };
    });
  }
}

module.exports = { EvictionEngine, lruScores, lfuScores, ttlScores, similarityScores };

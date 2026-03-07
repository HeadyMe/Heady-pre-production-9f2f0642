'use strict';

/**
 * HeadyCache Analytics Engine
 *
 * Tracks:
 *   - Hit / miss / eviction counts and rates
 *   - Latency histograms (p50, p95, p99) using t-digest-style bucketing
 *   - Size tracking (entries, bytes)
 *   - Hot key detection (top-N most accessed keys)
 *   - API call / cost savings estimates
 *   - Time-series snapshots for dashboards
 */

const config = require('./config');

// ---------------------------------------------------------------------------
// Simple histogram — fixed power-of-2 buckets
// ---------------------------------------------------------------------------

class Histogram {
  constructor() {
    // Buckets: [0,1), [1,2), [2,4), [4,8), ..., [8192,∞)
    this._buckets = new Array(14).fill(0); // 0–8192ms
    this._count = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
  }

  record(ms) {
    this._count++;
    this._sum += ms;
    if (ms < this._min) this._min = ms;
    if (ms > this._max) this._max = ms;

    const idx = ms < 1 ? 0 : Math.min(13, Math.floor(Math.log2(ms)) + 1);
    this._buckets[idx]++;
  }

  percentile(p) {
    if (this._count === 0) return 0;
    const target = Math.ceil((p / 100) * this._count);
    let cumulative = 0;
    for (let i = 0; i < this._buckets.length; i++) {
      cumulative += this._buckets[i];
      if (cumulative >= target) {
        return i === 0 ? 0.5 : Math.pow(2, i - 1);
      }
    }
    return this._max;
  }

  toJSON() {
    return {
      count: this._count,
      sum: this._sum,
      min: this._min === Infinity ? 0 : this._min,
      max: this._max === -Infinity ? 0 : this._max,
      mean: this._count > 0 ? this._sum / this._count : 0,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99),
    };
  }

  reset() {
    this._buckets.fill(0);
    this._count = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
  }
}

// ---------------------------------------------------------------------------
// TopN tracker (hot keys)
// ---------------------------------------------------------------------------

class TopN {
  constructor(n = 100) {
    this._n = n;
    this._counts = new Map();
  }

  hit(key) {
    this._counts.set(key, (this._counts.get(key) || 0) + 1);
    // Prune if overgrown
    if (this._counts.size > this._n * 10) {
      const sorted = [...this._counts.entries()].sort((a, b) => b[1] - a[1]);
      this._counts = new Map(sorted.slice(0, this._n));
    }
  }

  top(n) {
    return [...this._counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n || this._n)
      .map(([key, count]) => ({ key, count }));
  }

  delete(key) {
    this._counts.delete(key);
  }

  reset() {
    this._counts.clear();
  }
}

// ---------------------------------------------------------------------------
// CacheAnalytics
// ---------------------------------------------------------------------------

class CacheAnalytics {
  /**
   * @param {object} opts
   * @param {number} [opts.retentionPoints] Time-series retention count
   * @param {number} [opts.snapshotInterval] ms between snapshots
   * @param {number} [opts.costPerCall] USD per avoided API call
   * @param {number} [opts.topNKeys] Number of hot keys to track
   */
  constructor(opts = {}) {
    this._retention = opts.retentionPoints || config.analyticsRetention;
    this._snapshotInterval = opts.snapshotInterval || 60000;
    this._costPerCall = opts.costPerCall || config.costPerCall;
    this._topN = new TopN(opts.topNKeys || 100);

    // Counters
    this._hits = 0;
    this._semanticHits = 0;
    this._exactHits = 0;
    this._misses = 0;
    this._sets = 0;
    this._deletes = 0;
    this._evictions = 0;
    this._errors = 0;
    this._batchOps = 0;
    this._warmOps = 0;

    // Latency histograms by operation
    this._histograms = {
      get: new Histogram(),
      set: new Histogram(),
      batch: new Histogram(),
    };

    // Time-series snapshots
    this._timeSeries = [];

    // Size tracking (updated by HeadyCache)
    this._entryCount = 0;
    this._byteCount = 0;

    // Namespace breakdown
    this._nsCounts = new Map(); // ns -> { hits, misses }

    // Start periodic snapshot
    this._snapshotTimer = setInterval(() => this._snapshot(), this._snapshotInterval);
    this._snapshotTimer.unref?.();

    this._startTime = Date.now();
  }

  // -------------------------------------------------------------------------
  // Recording methods (called by HeadyCache)
  // -------------------------------------------------------------------------

  recordHit(key, ns, latencyMs, semantic = false) {
    this._hits++;
    if (semantic) this._semanticHits++;
    else this._exactHits++;
    this._histograms.get.record(latencyMs);
    this._topN.hit(key);
    this._nsCounter(ns).hits++;
  }

  recordMiss(key, ns, latencyMs) {
    this._misses++;
    this._histograms.get.record(latencyMs);
    this._nsCounter(ns).misses++;
  }

  recordSet(key, ns, latencyMs) {
    this._sets++;
    this._histograms.set.record(latencyMs);
  }

  recordDelete(key, ns) {
    this._deletes++;
    this._topN.delete(key);
  }

  recordEviction(count = 1) {
    this._evictions += count;
  }

  recordError() {
    this._errors++;
  }

  recordBatch(ops, latencyMs) {
    this._batchOps += ops;
    this._histograms.batch.record(latencyMs);
  }

  recordWarm(count) {
    this._warmOps += count;
  }

  updateSize(entries, bytes) {
    this._entryCount = entries;
    this._byteCount = bytes;
  }

  // -------------------------------------------------------------------------
  // Query methods
  // -------------------------------------------------------------------------

  /**
   * Get current snapshot of all metrics.
   */
  getStats() {
    const total = this._hits + this._misses;
    const hitRate = total > 0 ? this._hits / total : 0;
    const missRate = 1 - hitRate;
    const uptimeMs = Date.now() - this._startTime;

    return {
      hits: this._hits,
      semanticHits: this._semanticHits,
      exactHits: this._exactHits,
      misses: this._misses,
      sets: this._sets,
      deletes: this._deletes,
      evictions: this._evictions,
      errors: this._errors,
      batchOps: this._batchOps,
      warmOps: this._warmOps,
      hitRate: parseFloat(hitRate.toFixed(4)),
      missRate: parseFloat(missRate.toFixed(4)),
      entries: this._entryCount,
      bytes: this._byteCount,
      uptimeMs,
    };
  }

  /**
   * Full analytics report.
   */
  getAnalytics() {
    const stats = this.getStats();
    return {
      ...stats,
      latency: {
        get: this._histograms.get.toJSON(),
        set: this._histograms.set.toJSON(),
        batch: this._histograms.batch.toJSON(),
      },
      hotKeys: this._topN.top(20),
      savings: this._computeSavings(),
      namespaces: this._namespaceReport(),
      timeSeries: this._timeSeries.slice(-100),
    };
  }

  /**
   * Savings estimate: API calls avoided and cost saved.
   */
  _computeSavings() {
    const callsAvoided = this._hits;
    const costSaved = callsAvoided * this._costPerCall;
    return {
      callsAvoided,
      costSaved: parseFloat(costSaved.toFixed(6)),
      costPerCall: this._costPerCall,
    };
  }

  /**
   * Per-namespace hit/miss breakdown.
   */
  _namespaceReport() {
    const result = {};
    for (const [ns, counts] of this._nsCounts) {
      const total = counts.hits + counts.misses;
      result[ns] = {
        hits: counts.hits,
        misses: counts.misses,
        hitRate: total > 0 ? parseFloat((counts.hits / total).toFixed(4)) : 0,
      };
    }
    return result;
  }

  /**
   * Reset all counters (but keep time-series).
   */
  reset() {
    this._hits = 0;
    this._semanticHits = 0;
    this._exactHits = 0;
    this._misses = 0;
    this._sets = 0;
    this._deletes = 0;
    this._evictions = 0;
    this._errors = 0;
    this._batchOps = 0;
    this._warmOps = 0;
    for (const h of Object.values(this._histograms)) h.reset();
    this._topN.reset();
    this._nsCounts.clear();
  }

  /**
   * Stop background timer.
   */
  close() {
    clearInterval(this._snapshotTimer);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  _nsCounter(ns) {
    if (!this._nsCounts.has(ns)) this._nsCounts.set(ns, { hits: 0, misses: 0 });
    return this._nsCounts.get(ns);
  }

  _snapshot() {
    const ts = {
      ts: Date.now(),
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? this._hits / (this._hits + this._misses)
        : 0,
      entries: this._entryCount,
      bytes: this._byteCount,
      evictions: this._evictions,
      p99GetMs: this._histograms.get.percentile(99),
    };
    this._timeSeries.push(ts);
    if (this._timeSeries.length > this._retention) {
      this._timeSeries.splice(0, this._timeSeries.length - this._retention);
    }
  }
}

module.exports = { CacheAnalytics, Histogram, TopN };

'use strict';

/**
 * HeadyCache — Intelligent Semantic Cache Service
 *
 * Architecture:
 *   - Pluggable storage backends (memory / file / pg)
 *   - Semantic similarity lookup via VP-tree + HeadyEmbed
 *   - Configurable eviction: LRU, LFU, TTL, similarity-aware, hybrid
 *   - Write-through and write-behind population strategies
 *   - Namespace isolation
 *   - Batch operations with concurrency limiting
 *   - Cache warming from external data sources
 *   - Full analytics
 *
 * Sacred Geometry: PHI = 1.618033988749895
 */

const { SemanticMatcher } = require('./semantic-matcher');
const { EvictionEngine } = require('./eviction');
const { CacheAnalytics } = require('./analytics');
const { MemoryStore } = require('./storage/memory-store');
const config = require('./config');

const PHI = config.phi;

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

function createStore(backend, opts) {
  switch (backend || config.backend) {
    case 'file': {
      const { FileStore } = require('./storage/file-store');
      return new FileStore(opts);
    }
    case 'pg': {
      const { PgStore } = require('./storage/pg-store');
      return new PgStore(opts);
    }
    case 'memory':
    default:
      return new MemoryStore(opts);
  }
}

// ---------------------------------------------------------------------------
// Write-behind queue
// ---------------------------------------------------------------------------

class WriteBehindQueue {
  constructor(flushFn, intervalMs) {
    this._queue = new Map(); // key -> { value, meta, ns }
    this._flush = flushFn;
    this._timer = setInterval(() => this._doFlush(), intervalMs);
    this._timer.unref?.();
  }

  enqueue(key, value, meta) {
    this._queue.set(key, { value, meta });
  }

  async _doFlush() {
    if (this._queue.size === 0) return;
    const batch = new Map(this._queue);
    this._queue.clear();
    for (const [key, { value, meta }] of batch) {
      try {
        await this._flush(key, value, meta);
      } catch {
        // Re-enqueue on failure
        this._queue.set(key, { value, meta });
      }
    }
  }

  async forceFlush() {
    await this._doFlush();
  }

  close() {
    clearInterval(this._timer);
  }
}

// ---------------------------------------------------------------------------
// Pimit — tiny promise-based concurrency limiter
// ---------------------------------------------------------------------------

class Pimit {
  constructor(limit) {
    this._limit = limit;
    this._active = 0;
    this._queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      const task = () => {
        this._active++;
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            this._active--;
            if (this._queue.length > 0) this._queue.shift()();
          });
      };
      if (this._active < this._limit) task();
      else this._queue.push(task);
    });
  }
}

// ---------------------------------------------------------------------------
// HeadyCache
// ---------------------------------------------------------------------------

class HeadyCache {
  /**
   * @param {object} [opts]
   * @param {string}  [opts.backend]             'memory'|'file'|'pg'
   * @param {number}  [opts.maxSize]
   * @param {number}  [opts.ttl]                 Default TTL ms
   * @param {number}  [opts.similarityThreshold]
   * @param {string}  [opts.distanceMetric]
   * @param {string}  [opts.evictionPolicy]
   * @param {object}  [opts.hybridWeights]
   * @param {string}  [opts.writeStrategy]       'write-through'|'write-behind'
   * @param {number}  [opts.writeBehindInterval]
   * @param {string}  [opts.embedUrl]
   * @param {boolean} [opts.slidingWindowTtl]
   * @param {string}  [opts.defaultNamespace]
   * @param {number}  [opts.batchConcurrency]
   * @param {object}  [opts.storeOpts]           Extra opts forwarded to store
   */
  constructor(opts = {}) {
    this._backend = opts.backend || config.backend;
    this._maxSize = opts.maxSize || config.maxSize;
    this._defaultTtl = opts.ttl !== undefined ? opts.ttl : config.ttl;
    this._threshold = opts.similarityThreshold || config.similarityThreshold;
    this._metric = opts.distanceMetric || config.distanceMetric;
    this._evictionPolicy = opts.evictionPolicy || config.evictionPolicy;
    this._writeStrategy = opts.writeStrategy || config.writeStrategy;
    this._sliding = opts.slidingWindowTtl !== undefined ? opts.slidingWindowTtl : config.slidingWindowTtl;
    this._defaultNs = opts.defaultNamespace || config.defaultNamespace;
    this._batchConcurrency = opts.batchConcurrency || config.batchConcurrency;

    // Storage
    this._store = createStore(this._backend, {
      maxSize: this._maxSize,
      ttl: this._defaultTtl,
      slidingWindow: this._sliding,
      ...(opts.storeOpts || {}),
    });

    // Semantic matcher
    this._matcher = new SemanticMatcher({
      embedUrl: opts.embedUrl || config.embedUrl,
      similarityThreshold: this._threshold,
      distanceMetric: this._metric,
      embeddingDims: opts.embeddingDims || config.embeddingDims,
      vpTreeRebuildThreshold: opts.vpTreeRebuildThreshold || config.vpTreeRebuildThreshold,
    });

    // Eviction engine
    this._eviction = new EvictionEngine({
      policy: this._evictionPolicy,
      hybridWeights: opts.hybridWeights,
      memoryThreshold: opts.memoryThreshold || config.memoryPressureThreshold,
      similarityThreshold: this._threshold,
      matcher: this._matcher,
    });

    // Analytics
    this._analytics = new CacheAnalytics({
      costPerCall: opts.costPerCall || config.costPerCall,
      retentionPoints: opts.analyticsRetention || config.analyticsRetention,
    });
    this._eviction.setAnalytics(this._analytics);

    // Write-behind queue (only used if writeStrategy = 'write-behind')
    this._writeBehind = null;
    if (this._writeStrategy === 'write-behind') {
      const interval = opts.writeBehindInterval || config.writeBehindInterval;
      this._writeBehind = new WriteBehindQueue(
        (key, value, meta) => this._storeSet(key, value, meta),
        interval
      );
    }

    // Batch concurrency limiter
    this._pimit = new Pimit(this._batchConcurrency);

    this._ready = false;
    this._initPromise = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    if (this._store.init) await this._store.init();
    this._ready = true;
  }

  async close() {
    if (this._writeBehind) {
      await this._writeBehind.forceFlush();
      this._writeBehind.close();
    }
    if (this._store.close) await this._store.close();
    this._analytics.close();
  }

  // -------------------------------------------------------------------------
  // Core: get
  // -------------------------------------------------------------------------

  /**
   * Semantic cache lookup.
   *
   * 1. Try exact hash match via matcher
   * 2. Try semantic similarity via VP-tree + HeadyEmbed
   * 3. Return null on miss
   *
   * @param {object} req
   * @param {string}  req.key         Text key (natural language or structured)
   * @param {string}  [req.namespace]
   * @param {number}  [req.threshold] Override similarity threshold
   * @param {boolean} [req.exactOnly] Skip semantic search
   * @returns {Promise<{value, meta, similarity, exact}|null>}
   */
  async get(req) {
    await this._ensureReady();
    const start = Date.now();
    const ns = req.namespace || this._defaultNs;
    const threshold = req.threshold !== undefined ? req.threshold : this._threshold;

    try {
      // Search semantic index
      let match = null;
      if (!req.exactOnly) {
        const savedThreshold = this._matcher._threshold;
        this._matcher._threshold = threshold;
        match = await this._matcher.search(ns, req.key);
        this._matcher._threshold = savedThreshold;
      } else {
        // Exact only: use hash
        const hash = this._matcher.hashKey(req.key);
        const nsHash = this._matcher._hashIndex.get(ns);
        if (nsHash && nsHash.has(hash)) {
          match = { id: nsHash.get(hash), similarity: 1.0, exact: true };
        }
      }

      if (!match) {
        this._analytics.recordMiss(req.key, ns, Date.now() - start);
        return null;
      }

      const entry = await this._storeGet(match.id);
      if (!entry) {
        // Stale index entry — clean up
        this._matcher.removeFromIndex(ns, match.id, req.key);
        this._analytics.recordMiss(req.key, ns, Date.now() - start);
        return null;
      }

      this._analytics.recordHit(req.key, ns, Date.now() - start, !match.exact);
      return { ...entry, similarity: match.similarity, exact: match.exact };
    } catch (err) {
      this._analytics.recordError();
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Core: set
  // -------------------------------------------------------------------------

  /**
   * Store a value in the cache.
   *
   * @param {object} req
   * @param {string}  req.key
   * @param {*}       req.value
   * @param {string}  [req.namespace]
   * @param {number}  [req.ttl]
   * @param {number[]} [req.vector]    Pre-computed embedding
   * @param {boolean} [req.skipEmbed] Skip embedding computation
   * @returns {Promise<{id: string}>}
   */
  async set(req) {
    await this._ensureReady();
    const start = Date.now();
    const ns = req.namespace || this._defaultNs;

    try {
      // Generate stable ID from key + namespace (namespace-scoped)
      const id = this._matcher.hashKey(`${ns}:${req.key}`);
      const ttl = req.ttl !== undefined ? req.ttl : this._defaultTtl;

      const meta = {
        namespace: ns,
        ttl,
        byteSize: this._estimateSize(req.value),
        vector: req.vector || null,
      };

      // Compute embedding and update semantic index
      const vector = req.skipEmbed ? req.vector : (req.vector || await this._matcher.embed(req.key));
      if (vector) meta.vector = vector;

      // Check memory pressure before writing
      if (this._eviction.isUnderMemoryPressure()) {
        await this._runEviction(ns, Math.ceil(this._maxSize * 0.1));
      }

      // Write to store
      if (this._writeStrategy === 'write-behind' && this._writeBehind) {
        this._writeBehind.enqueue(id, req.value, meta);
        // Still update semantic index immediately
        await this._matcher.addToIndex(ns, id, req.key, vector || null);
      } else {
        await this._storeSet(id, req.value, meta);
        await this._matcher.addToIndex(ns, id, req.key, vector || null);
      }

      this._analytics.recordSet(req.key, ns, Date.now() - start);
      this._updateSizeAnalytics();

      return { id };
    } catch (err) {
      this._analytics.recordError();
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Core: delete
  // -------------------------------------------------------------------------

  /**
   * Delete a cache entry by exact key.
   */
  async delete(req) {
    await this._ensureReady();
    const ns = req.namespace || this._defaultNs;
    const id = this._matcher.hashKey(`${ns}:${req.key}`);

    this._matcher.removeFromIndex(ns, id, req.key);
    const deleted = await this._storeDelete(id);
    if (deleted) this._analytics.recordDelete(req.key, ns);
    this._updateSizeAnalytics();
    return { deleted };
  }

  // -------------------------------------------------------------------------
  // Namespace operations
  // -------------------------------------------------------------------------

  /**
   * Clear all entries in a namespace.
   */
  async clearNamespace(ns) {
    await this._ensureReady();
    this._matcher.clearNamespace(ns);
    await this._storeClear(ns);
    this._updateSizeAnalytics();
    return { cleared: true };
  }

  // -------------------------------------------------------------------------
  // Batch operations
  // -------------------------------------------------------------------------

  /**
   * Batch get — returns array of results in same order as keys.
   * null = cache miss.
   */
  async batchGet(requests) {
    await this._ensureReady();
    const start = Date.now();
    const results = await Promise.all(
      requests.map((req) => this._pimit.run(() => this.get(req)))
    );
    this._analytics.recordBatch(requests.length, Date.now() - start);
    return results;
  }

  /**
   * Batch set — returns array of {id} in same order as requests.
   */
  async batchSet(requests) {
    await this._ensureReady();
    const start = Date.now();
    const results = await Promise.all(
      requests.map((req) => this._pimit.run(() => this.set(req)))
    );
    this._analytics.recordBatch(requests.length, Date.now() - start);
    return results;
  }

  // -------------------------------------------------------------------------
  // Cache warming
  // -------------------------------------------------------------------------

  /**
   * Warm cache from an array of {key, value, namespace?, ttl?, vector?}.
   * @param {Array<object>} entries
   * @returns {Promise<{warmed: number, failed: number}>}
   */
  async warm(entries) {
    await this._ensureReady();
    let warmed = 0;
    let failed = 0;

    // Process in batches of PHI-scaled size
    const batchSize = Math.round(50 * PHI);
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((e) => this._pimit.run(() => this.set(e)))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') warmed++;
        else failed++;
      }
    }

    this._analytics.recordWarm(warmed);
    this._updateSizeAnalytics();
    return { warmed, failed };
  }

  // -------------------------------------------------------------------------
  // Stats & analytics
  // -------------------------------------------------------------------------

  getStats() {
    return this._analytics.getStats();
  }

  getAnalytics() {
    return this._analytics.getAnalytics();
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async healthCheck() {
    const probe = '__heady_cache_health__';
    const ns = '__health__';
    try {
      await this.set({ key: probe, value: 1, namespace: ns, ttl: 5000, skipEmbed: true });
      const hit = await this.get({ key: probe, namespace: ns, exactOnly: true });
      await this.delete({ key: probe, namespace: ns });
      return {
        status: hit ? 'ok' : 'degraded',
        backend: this._backend,
        entries: this._analytics.getStats().entries,
        uptime: this._analytics.getStats().uptimeMs,
      };
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // Private store wrappers (handle both sync and async stores uniformly)
  // -------------------------------------------------------------------------

  async _storeGet(id) {
    const result = await Promise.resolve(this._store.get(id));
    return result;
  }

  async _storeSet(id, value, meta) {
    await Promise.resolve(this._store.set(id, value, meta));
  }

  async _storeDelete(id) {
    const result = await Promise.resolve(this._store.delete(id));
    return result;
  }

  async _storeClear(ns) {
    await Promise.resolve(this._store.clear(ns));
  }

  async _storeEntries(ns) {
    const result = await Promise.resolve(this._store.entries(ns));
    return result;
  }

  async _storeSize(ns) {
    const result = await Promise.resolve(this._store.size(ns));
    return result;
  }

  // -------------------------------------------------------------------------
  // Eviction helpers
  // -------------------------------------------------------------------------

  async _runEviction(ns, count) {
    const entries = await this._storeEntries(ns);
    const toEvict = this._eviction.select(entries, count, ns);
    let evicted = 0;
    for (const key of toEvict) {
      try {
        await this._storeDelete(key);
        // Key here is ID (hash), not original text — remove from vector index by ID
        const nsIndex = this._matcher._index.get(ns);
        if (nsIndex && nsIndex.has(key)) {
          const entry = nsIndex.get(key);
          this._matcher.removeFromIndex(ns, key, entry.key);
        }
        evicted++;
      } catch {
        // best-effort
      }
    }
    if (evicted > 0) this._analytics.recordEviction(evicted);
  }

  _updateSizeAnalytics() {
    setImmediate(async () => {
      try {
        const entries = await this._storeSize();
        const bytes = typeof this._store.byteSize === 'function'
          ? (await Promise.resolve(this._store.byteSize())) : 0;
        this._analytics.updateSize(entries, bytes);
      } catch {
        // non-fatal
      }
    });
  }

  _estimateSize(value) {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 256;
    }
  }

  async _ensureReady() {
    if (!this._ready) await this.init();
  }
}

module.exports = { HeadyCache, createStore };

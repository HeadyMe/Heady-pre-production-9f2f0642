'use strict';
/**
 * @module multi-layer-cache
 * @description Multi-layer caching implementation for HeadySystems
 *
 * Architecture:
 *   L1 — In-memory LRU   : fib(16)=987 entries, TTL φ^5≈11.09s
 *   L2 — Redis            : fib(20)=6765 entries, TTL φ^8≈46.98s
 *   L3 — Cloudflare CDN   : edge cache, TTL fib(10)=55s
 *
 * Patterns:
 *   - Cache-aside for reads
 *   - Write-through for critical data
 *   - Redis pub/sub for invalidation
 *   - Per-layer metrics: hit rate, miss rate, eviction rate
 *
 * φ constants:
 *   PHI       = 1.618033988749895
 *   PHI_5     = φ^5  = 11.09 s  (L1 TTL)
 *   PHI_8     = φ^8  = 46.98 s  (L2 TTL)
 *   FIB_16    = 987             (L1 max entries)
 *   FIB_20    = 6765            (L2 max entries)
 *   FIB_10    = 55  s           (L3 CDN TTL)
 */

const { createClient } = require('redis');
const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// φ-derived constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;

/** Compute φ^n */
const phi = (n) => Math.pow(PHI, n);

/** Fibonacci sequence via direct computation */
const FIB = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987,
             1597, 2584, 4181, 6765];

const L1_MAX_ENTRIES = FIB[16];         // 987
const L1_TTL_MS      = phi(5) * 1000;  // φ^5 ≈ 11,090 ms
const L2_MAX_ENTRIES = FIB[20];         // 6765
const L2_TTL_S       = phi(8);         // φ^8 ≈ 46.98 s
const L3_TTL_S       = FIB[10];        // 55 s (Cloudflare Cache-Control max-age)

// ─────────────────────────────────────────────────────────────────────────────
// Layer metrics tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class LayerMetrics
 * Tracks hit, miss, and eviction counts per cache layer.
 */
class LayerMetrics {
  constructor(layerName) {
    this.layer     = layerName;
    this.hits      = 0;
    this.misses    = 0;
    this.evictions = 0;
    this.sets      = 0;
    this.deletes   = 0;
    this._startTime = Date.now();
  }

  recordHit()      { this.hits++;      }
  recordMiss()     { this.misses++;    }
  recordEviction() { this.evictions++; }
  recordSet()      { this.sets++;      }
  recordDelete()   { this.deletes++;   }

  /** @returns {Object} Metrics snapshot with computed rates */
  snapshot() {
    const total     = this.hits + this.misses;
    const hitRate   = total > 0 ? (this.hits / total) : 0;
    const missRate  = total > 0 ? (this.misses / total) : 0;
    const uptimeSec = (Date.now() - this._startTime) / 1000;

    return {
      layer:         this.layer,
      hits:          this.hits,
      misses:        this.misses,
      evictions:     this.evictions,
      sets:          this.sets,
      deletes:       this.deletes,
      hitRate:       Number(hitRate.toFixed(4)),
      missRate:      Number(missRate.toFixed(4)),
      evictionRate:  uptimeSec > 0 ? Number((this.evictions / uptimeSec).toFixed(4)) : 0,
      totalRequests: total,
      uptimeSeconds: Math.round(uptimeSec),
    };
  }

  reset() {
    this.hits = this.misses = this.evictions = this.sets = this.deletes = 0;
    this._startTime = Date.now();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L1: In-Memory LRU Cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class LRUNode
 * Doubly-linked list node for O(1) LRU eviction.
 */
class LRUNode {
  constructor(key, value, expiresAt) {
    this.key       = key;
    this.value     = value;
    this.expiresAt = expiresAt;
    this.prev      = null;
    this.next      = null;
  }
}

/**
 * @class L1Cache
 * In-memory LRU cache backed by a doubly-linked list + Map.
 * Capacity: fib(16)=987 entries
 * TTL:      φ^5 ≈ 11.09 seconds
 */
class L1Cache {
  /**
   * @param {Object} opts
   * @param {number} [opts.maxEntries=987]     - fib(16)
   * @param {number} [opts.ttlMs=11090]        - φ^5 ms
   */
  constructor(opts = {}) {
    this.maxEntries = opts.maxEntries ?? L1_MAX_ENTRIES;
    this.ttlMs      = opts.ttlMs      ?? L1_TTL_MS;
    this._map       = new Map();
    this.metrics    = new LayerMetrics('L1:memory');

    // Doubly-linked list: head=most-recent, tail=least-recent
    this._head = new LRUNode(null, null, Infinity);
    this._tail = new LRUNode(null, null, Infinity);
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /** @private Move node to head (most recently used) */
  _moveToHead(node) {
    this._detach(node);
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next.prev = node;
    this._head.next = node;
  }

  /** @private Detach node from list */
  _detach(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /** @private Evict the LRU (tail) node */
  _evictLRU() {
    const lru = this._tail.prev;
    if (lru === this._head) return;
    this._detach(lru);
    this._map.delete(lru.key);
    this.metrics.recordEviction();
  }

  /**
   * Retrieve a value from L1.
   * @param {string} key
   * @returns {*} value or undefined if missing/expired
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) {
      this.metrics.recordMiss();
      return undefined;
    }
    if (Date.now() > node.expiresAt) {
      this._detach(node);
      this._map.delete(key);
      this.metrics.recordEviction();
      this.metrics.recordMiss();
      return undefined;
    }
    this._moveToHead(node);
    this.metrics.recordHit();
    return node.value;
  }

  /**
   * Store a value in L1.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs] - override default TTL
   */
  set(key, value, ttlMs) {
    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
    let node = this._map.get(key);
    if (node) {
      node.value     = value;
      node.expiresAt = expiresAt;
      this._moveToHead(node);
    } else {
      if (this._map.size >= this.maxEntries) this._evictLRU();
      node = new LRUNode(key, value, expiresAt);
      this._map.set(key, node);
      this._moveToHead(node);
    }
    this.metrics.recordSet();
  }

  /**
   * Delete a key from L1.
   * @param {string} key
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._detach(node);
    this._map.delete(key);
    this.metrics.recordDelete();
    return true;
  }

  /** Clear all entries */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /** @returns {number} Number of live (non-expired) entries */
  get size() { return this._map.size; }
}

// ─────────────────────────────────────────────────────────────────────────────
// L2: Redis Cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class L2Cache
 * Redis-backed distributed cache.
 * Capacity: fib(20)=6765 max tracked entries
 * TTL:      φ^8 ≈ 46.98 seconds
 */
class L2Cache {
  /**
   * @param {Object} opts
   * @param {Object} opts.redisClient   - Connected Redis client instance
   * @param {string} [opts.namespace]   - Key namespace prefix
   * @param {number} [opts.ttlS]        - TTL in seconds (default φ^8)
   */
  constructor(opts = {}) {
    this._redis     = opts.redisClient;
    this.namespace  = opts.namespace ?? 'heady:cache:l2';
    this.ttlS       = opts.ttlS     ?? Math.round(L2_TTL_S);   // ≈ 47s
    this.metrics    = new LayerMetrics('L2:redis');
  }

  /** @private Build namespaced key */
  _key(key) { return `${this.namespace}:${key}`; }

  /**
   * Retrieve a value from L2.
   * @param {string} key
   * @returns {Promise<*>} Parsed value or null
   */
  async get(key) {
    try {
      const raw = await this._redis.get(this._key(key));
      if (raw === null) {
        this.metrics.recordMiss();
        return null;
      }
      this.metrics.recordHit();
      return JSON.parse(raw);
    } catch (err) {
      this.metrics.recordMiss();
      throw err;
    }
  }

  /**
   * Store a value in L2 with EX TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlS] - override default TTL in seconds
   */
  async set(key, value, ttlS) {
    const serialized = JSON.stringify(value);
    await this._redis.set(this._key(key), serialized, {
      EX: ttlS ?? this.ttlS,
    });
    this.metrics.recordSet();
  }

  /**
   * Delete a key from L2.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    const result = await this._redis.del(this._key(key));
    if (result > 0) this.metrics.recordDelete();
    return result > 0;
  }

  /**
   * Delete by pattern (cache tag invalidation).
   * @param {string} pattern - glob pattern e.g. "heady:cache:l2:user:*"
   */
  async deleteByPattern(pattern) {
    const keys = await this._redis.keys(`${this.namespace}:${pattern}`);
    if (keys.length === 0) return 0;
    const deleted = await this._redis.del(keys);
    for (let i = 0; i < deleted; i++) this.metrics.recordDelete();
    return deleted;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// L3: Cloudflare CDN Cache (header-driven)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class L3Cache
 * CDN edge cache for HTTP responses.
 * TTL: fib(10)=55 seconds via Cache-Control headers.
 * Supports Cache-Tag based purging via Cloudflare API.
 */
class L3Cache {
  /**
   * @param {Object} opts
   * @param {string} opts.cfZoneId       - Cloudflare Zone ID
   * @param {string} opts.cfApiToken     - Cloudflare API token
   * @param {number} [opts.ttlS=55]      - fib(10) = 55s
   */
  constructor(opts = {}) {
    this.zoneId    = opts.cfZoneId;
    this.apiToken  = opts.cfApiToken;
    this.ttlS      = opts.ttlS ?? L3_TTL_S;    // 55s
    this.metrics   = new LayerMetrics('L3:cloudflare-cdn');
    this._purgeUrl = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`;
  }

  /**
   * Generate Cache-Control headers for an HTTP response.
   * @param {Object} opts
   * @param {boolean} [opts.isPrivate=false]
   * @param {string[]} [opts.tags=[]]          - Cache-Tag values for targeted purging
   * @returns {Object} HTTP headers object
   */
  headers(opts = {}) {
    const { isPrivate = false, tags = [] } = opts;
    const headers = {
      'Cache-Control': isPrivate
        ? `private, max-age=${this.ttlS}`
        : `public, s-maxage=${this.ttlS}, stale-while-revalidate=${Math.round(this.ttlS * PHI)}`,
      'Surrogate-Control': `max-age=${this.ttlS}`,
      'CDN-Cache-Control': `max-age=${this.ttlS}`,
    };
    if (tags.length > 0) {
      headers['Cache-Tag'] = tags.join(',');
    }
    this.metrics.recordSet();
    return headers;
  }

  /**
   * Purge Cloudflare cache by tags.
   * @param {string[]} tags
   * @returns {Promise<Object>} Cloudflare API response
   */
  async purgeByTags(tags) {
    if (!this.zoneId || !this.apiToken) {
      throw new Error('L3Cache: cfZoneId and cfApiToken required for purge');
    }
    const response = await fetch(this._purgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ tags }),
    });
    const result = await response.json();
    if (result.success) {
      tags.forEach(() => this.metrics.recordDelete());
    }
    return result;
  }

  /**
   * Purge specific URLs.
   * @param {string[]} urls
   * @returns {Promise<Object>}
   */
  async purgeByUrls(urls) {
    if (!this.zoneId || !this.apiToken) {
      throw new Error('L3Cache: cfZoneId and cfApiToken required for purge');
    }
    const response = await fetch(this._purgeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ files: urls }),
    });
    return response.json();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pub/Sub Invalidation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CacheInvalidator
 * Redis pub/sub for cross-instance cache invalidation.
 * Subscribes to invalidation events and clears L1/L2 accordingly.
 */
class CacheInvalidator extends EventEmitter {
  static CHANNEL = 'heady:cache:invalidation';

  /**
   * @param {Object} opts
   * @param {Object} opts.publisherClient   - Redis client for publishing
   * @param {Object} opts.subscriberClient  - Dedicated Redis subscriber client
   * @param {L1Cache} opts.l1               - L1 cache instance to invalidate
   * @param {L2Cache} opts.l2               - L2 cache instance to invalidate
   */
  constructor(opts) {
    super();
    this._pub = opts.publisherClient;
    this._sub = opts.subscriberClient;
    this.l1   = opts.l1;
    this.l2   = opts.l2;
  }

  /** Start listening for invalidation messages */
  async subscribe() {
    await this._sub.subscribe(CacheInvalidator.CHANNEL, (message) => {
      try {
        const { type, key, pattern, tags } = JSON.parse(message);
        this._handleInvalidation(type, { key, pattern, tags });
      } catch (err) {
        this.emit('error', err);
      }
    });
  }

  /** @private Handle received invalidation event */
  async _handleInvalidation(type, payload) {
    switch (type) {
      case 'key':
        this.l1.delete(payload.key);
        await this.l2.delete(payload.key);
        this.emit('invalidated', { type, key: payload.key });
        break;

      case 'pattern':
        // L1: iterate and delete matching keys
        for (const [k] of this.l1._map) {
          if (k.includes(payload.pattern)) this.l1.delete(k);
        }
        await this.l2.deleteByPattern(payload.pattern);
        this.emit('invalidated', { type, pattern: payload.pattern });
        break;

      case 'tags':
        // Delegate to L3 for CDN purge (handled externally)
        this.emit('purge-tags', { tags: payload.tags });
        break;

      default:
        this.emit('error', new Error(`Unknown invalidation type: ${type}`));
    }
  }

  /**
   * Publish a key invalidation event.
   * @param {string} key
   */
  async invalidateKey(key) {
    await this._pub.publish(CacheInvalidator.CHANNEL,
      JSON.stringify({ type: 'key', key }));
  }

  /**
   * Publish a pattern invalidation event.
   * @param {string} pattern
   */
  async invalidatePattern(pattern) {
    await this._pub.publish(CacheInvalidator.CHANNEL,
      JSON.stringify({ type: 'pattern', pattern }));
  }

  /**
   * Publish a tag-based invalidation event (CDN purge).
   * @param {string[]} tags
   */
  async invalidateTags(tags) {
    await this._pub.publish(CacheInvalidator.CHANNEL,
      JSON.stringify({ type: 'tags', tags }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Layer Cache (orchestrator)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class MultiLayerCache
 * Orchestrates L1 → L2 → L3 with:
 *   - Cache-aside pattern for reads
 *   - Write-through for critical data
 *   - Automatic cache promotion on L2 hit
 *   - Metrics aggregation across all layers
 */
class MultiLayerCache extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {Object} opts.redisClient       - Connected Redis client
   * @param {string} [opts.namespace]       - Key namespace prefix
   * @param {string} [opts.cfZoneId]        - Cloudflare Zone ID
   * @param {string} [opts.cfApiToken]      - Cloudflare API token
   * @param {Object} [opts.l1Opts]          - L1 cache overrides
   * @param {Object} [opts.l2Opts]          - L2 cache overrides
   */
  constructor(opts = {}) {
    super();
    this.l1 = new L1Cache(opts.l1Opts);
    this.l2 = new L2Cache({
      redisClient: opts.redisClient,
      namespace:   opts.namespace ?? 'heady:cache:l2',
      ...opts.l2Opts,
    });
    this.l3 = new L3Cache({
      cfZoneId:   opts.cfZoneId,
      cfApiToken: opts.cfApiToken,
    });
  }

  // ───────────────────────────────────────────────
  // READ — Cache-aside pattern
  // ───────────────────────────────────────────────

  /**
   * Get a value, checking L1 → L2 → miss.
   * Promotes L2 hits back to L1.
   * @param {string} key
   * @returns {Promise<{value: *, layer: string}|null>}
   */
  async get(key) {
    // L1 check
    const l1val = this.l1.get(key);
    if (l1val !== undefined) {
      this.emit('hit', { key, layer: 'L1' });
      return { value: l1val, layer: 'L1' };
    }

    // L2 check
    const l2val = await this.l2.get(key);
    if (l2val !== null) {
      // Promote to L1
      this.l1.set(key, l2val);
      this.emit('hit', { key, layer: 'L2' });
      return { value: l2val, layer: 'L2' };
    }

    // Miss
    this.emit('miss', { key });
    return null;
  }

  /**
   * Get or load: retrieve from cache or call loader function.
   * @param {string} key
   * @param {Function} loader   - async () => value
   * @param {Object} [opts]
   * @param {boolean} [opts.critical=false] - if true, use write-through
   * @param {number}  [opts.l1TtlMs]        - L1 TTL override
   * @param {number}  [opts.l2TtlS]         - L2 TTL override
   * @returns {Promise<*>}
   */
  async getOrLoad(key, loader, opts = {}) {
    const cached = await this.get(key);
    if (cached !== null) return cached.value;

    const value = await loader();
    if (value !== undefined && value !== null) {
      if (opts.critical) {
        await this.setWriteThrough(key, value, opts);
      } else {
        await this.set(key, value, opts);
      }
    }
    return value;
  }

  // ───────────────────────────────────────────────
  // WRITE — Standard (L1 + L2)
  // ───────────────────────────────────────────────

  /**
   * Write to both L1 and L2.
   * @param {string} key
   * @param {*} value
   * @param {Object} [opts]
   * @param {number} [opts.l1TtlMs]
   * @param {number} [opts.l2TtlS]
   */
  async set(key, value, opts = {}) {
    this.l1.set(key, value, opts.l1TtlMs);
    await this.l2.set(key, value, opts.l2TtlS);
    this.emit('set', { key, layers: ['L1', 'L2'] });
  }

  /**
   * Write-through: write to L1, L2, and mark L3 for revalidation.
   * Use for critical data (billing, auth tokens, agent state).
   * @param {string} key
   * @param {*} value
   * @param {Object} [opts]
   * @param {string[]} [opts.tags]    - Cache-Tag for CDN purge
   */
  async setWriteThrough(key, value, opts = {}) {
    // Write L1 + L2 synchronously
    this.l1.set(key, value, opts.l1TtlMs);
    await this.l2.set(key, value, opts.l2TtlS);

    // Invalidate L3 CDN edge if tags provided
    if (opts.tags && opts.tags.length > 0 && this.l3.zoneId) {
      await this.l3.purgeByTags(opts.tags).catch((err) => {
        this.emit('error', { op: 'writethrough-l3-purge', err });
      });
    }
    this.emit('set', { key, layers: ['L1', 'L2', 'L3'], critical: true });
  }

  // ───────────────────────────────────────────────
  // DELETE / INVALIDATION
  // ───────────────────────────────────────────────

  /**
   * Delete a key from all layers.
   * @param {string} key
   * @param {string[]} [tags] - CDN cache tags to purge
   */
  async delete(key, tags = []) {
    this.l1.delete(key);
    await this.l2.delete(key);
    if (tags.length > 0 && this.l3.zoneId) {
      await this.l3.purgeByTags(tags).catch((err) => {
        this.emit('error', { op: 'delete-l3-purge', err });
      });
    }
    this.emit('delete', { key });
  }

  /**
   * Get L3 headers for HTTP responses.
   * @param {Object} opts - passed to L3Cache.headers()
   * @returns {Object} HTTP headers
   */
  l3Headers(opts = {}) {
    return this.l3.headers(opts);
  }

  // ───────────────────────────────────────────────
  // METRICS
  // ───────────────────────────────────────────────

  /**
   * Get aggregated metrics from all layers.
   * @returns {Object} metrics per layer + overall efficiency
   */
  metrics() {
    const l1 = this.l1.metrics.snapshot();
    const l2 = this.l2.metrics.snapshot();
    const l3 = this.l3.metrics.snapshot();

    const totalRequests = l1.totalRequests + l2.totalRequests;
    const totalHits     = l1.hits + l2.hits;
    const overallHitRate = totalRequests > 0
      ? Number((totalHits / totalRequests).toFixed(4))
      : 0;

    return {
      timestamp:      new Date().toISOString(),
      phi:            PHI,
      l1Capacity:     L1_MAX_ENTRIES,
      l2Capacity:     L2_MAX_ENTRIES,
      l1TtlMs:        Math.round(L1_TTL_MS),
      l2TtlS:         Math.round(L2_TTL_S),
      l3TtlS:         L3_TTL_S,
      layers:         { l1, l2, l3 },
      overall: {
        totalRequests,
        totalHits,
        hitRate:       overallHitRate,
        l1CurrentSize: this.l1.size,
        l1FillRatio:   Number((this.l1.size / L1_MAX_ENTRIES).toFixed(4)),
      },
      // CSL pressure classification
      cslPressure: (() => {
        const miss = 1 - overallHitRate;
        if (miss < 0.236)       return 'DORMANT';
        if (miss < 0.382)       return 'LOW';
        if (miss < 0.618)       return 'MODERATE';
        if (miss < 0.854)       return 'HIGH';
        return                         'CRITICAL';
      })(),
    };
  }

  /**
   * Reset all layer metrics (for reporting cycles).
   */
  resetMetrics() {
    this.l1.metrics.reset();
    this.l2.metrics.reset();
    this.l3.metrics.reset();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fully wired MultiLayerCache with Redis and pub/sub invalidation.
 *
 * @param {Object} opts
 * @param {string} [opts.redisUrl='redis://localhost:6379']
 * @param {string} [opts.namespace='heady:cache:l2']
 * @param {string} [opts.cfZoneId]
 * @param {string} [opts.cfApiToken]
 * @returns {Promise<{cache: MultiLayerCache, invalidator: CacheInvalidator}>}
 *
 * @example
 * const { cache, invalidator } = await createMultiLayerCache({
 *   redisUrl: process.env.REDIS_URL,
 *   cfZoneId: process.env.CF_ZONE_ID,
 *   cfApiToken: process.env.CF_API_TOKEN,
 * });
 * const user = await cache.getOrLoad(`user:${id}`, () => db.getUser(id));
 */
async function createMultiLayerCache(opts = {}) {
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';

  // Create dedicated clients for data + pub/sub
  const dataClient = createClient({ url: redisUrl });
  const pubClient  = createClient({ url: redisUrl });
  const subClient  = createClient({ url: redisUrl });

  await Promise.all([
    dataClient.connect(),
    pubClient.connect(),
    subClient.connect(),
  ]);

  const cache = new MultiLayerCache({
    redisClient: dataClient,
    namespace:   opts.namespace,
    cfZoneId:    opts.cfZoneId   ?? process.env.CF_ZONE_ID,
    cfApiToken:  opts.cfApiToken ?? process.env.CF_API_TOKEN,
  });

  const invalidator = new CacheInvalidator({
    publisherClient:  pubClient,
    subscriberClient: subClient,
    l1: cache.l1,
    l2: cache.l2,
  });

  await invalidator.subscribe();

  // Wire L3 purge events from invalidator to L3 cache
  invalidator.on('purge-tags', async ({ tags }) => {
    if (cache.l3.zoneId) {
      await cache.l3.purgeByTags(tags).catch((err) => {
        cache.emit('error', { op: 'invalidator-l3-purge', err });
      });
    }
  });

  return { cache, invalidator, dataClient, pubClient, subClient };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  MultiLayerCache,
  L1Cache,
  L2Cache,
  L3Cache,
  CacheInvalidator,
  LayerMetrics,
  createMultiLayerCache,
  // φ constants for external reference
  PHI,
  L1_MAX_ENTRIES,   // 987
  L1_TTL_MS,        // ~11090
  L2_MAX_ENTRIES,   // 6765
  L2_TTL_S,         // ~47
  L3_TTL_S,         // 55
};

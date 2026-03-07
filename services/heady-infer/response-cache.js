'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * ResponseCache — LRU cache for LLM responses.
 *
 * Cache key: SHA-256 of (model + serialized messages + temperature + maxTokens)
 * - Bypasses cache when temperature > bypassAboveTemp (default: 0)
 * - TTL per model or global default
 * - LRU eviction when maxSize is reached
 * - Emits 'hit', 'miss', 'evict', 'set' events
 */
class ResponseCache extends EventEmitter {
  /**
   * @param {object} options
   * @param {boolean} options.enabled
   * @param {number}  options.maxSize           Max entries (LRU eviction)
   * @param {number}  options.defaultTTL        Default TTL in ms
   * @param {number}  options.bypassAboveTemp   Skip cache if temperature > this
   * @param {object}  options.ttlByModel        Per-model TTL overrides
   */
  constructor(options = {}) {
    super();
    this.enabled          = options.enabled          !== false;
    this.maxSize          = options.maxSize           || 1000;
    this.defaultTTL       = options.defaultTTL        || 3_600_000;
    this.bypassAboveTemp  = options.bypassAboveTemp   ?? 0;
    this.ttlByModel       = options.ttlByModel        || {};

    // LRU store: Map preserves insertion order; we use move-to-end on access
    this._store = new Map();      // key → { value, expiresAt, hits, model }
    this._stats = {
      hits:      0,
      misses:    0,
      sets:      0,
      evictions: 0,
      bypasses:  0,
    };
  }

  // ─── Cache Key ────────────────────────────────────────────────────────────

  /**
   * Build a deterministic cache key from request parameters.
   * @param {object} params
   * @param {string}   params.model
   * @param {Array}    params.messages
   * @param {number}   [params.temperature]
   * @param {number}   [params.maxTokens]
   * @returns {string} hex SHA-256
   */
  buildKey({ model, messages, temperature = 0, maxTokens }) {
    const payload = JSON.stringify({ model, messages, temperature, maxTokens });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // ─── Core Operations ──────────────────────────────────────────────────────

  /**
   * Check whether a request should bypass the cache.
   */
  shouldBypass(request) {
    if (!this.enabled) return true;
    if (request.noCache) return true;
    const temp = request.temperature ?? 0;
    if (temp > this.bypassAboveTemp) return true;
    return false;
  }

  /**
   * Get a cached response.
   * @param {string} key
   * @returns {object|null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._stats.misses++;
      this.emit('miss', key);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._stats.misses++;
      this.emit('miss', key, 'expired');
      return null;
    }

    // Move to end (LRU — most recently used)
    this._store.delete(key);
    entry.hits++;
    entry.lastAccessedAt = Date.now();
    this._store.set(key, entry);

    this._stats.hits++;
    this.emit('hit', key, entry.model);
    return entry.value;
  }

  /**
   * Store a response.
   * @param {string} key
   * @param {object} response
   * @param {string} model
   */
  set(key, response, model = 'unknown') {
    if (!this.enabled) return;

    // Evict LRU if at capacity
    if (this._store.size >= this.maxSize) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
      this._stats.evictions++;
      this.emit('evict', oldestKey);
    }

    const ttl = this.ttlByModel[model] || this.defaultTTL;
    this._store.set(key, {
      value:          response,
      model,
      hits:           0,
      createdAt:      Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt:      Date.now() + ttl,
    });

    this._stats.sets++;
    this.emit('set', key, model);
  }

  /**
   * High-level: try cache lookup then execute fn on miss.
   * @param {object}   request
   * @param {Function} fn  async () => response
   * @returns {Promise<{response, cacheHit}>}
   */
  async getOrSet(request, fn) {
    if (this.shouldBypass(request)) {
      this._stats.bypasses++;
      const response = await fn();
      return { response, cacheHit: false };
    }

    const key      = this.buildKey(request);
    const cached   = this.get(key);

    if (cached) {
      return {
        response: { ...cached, cached: true, cacheKey: key },
        cacheHit: true,
      };
    }

    const response = await fn();
    // Only cache successful responses with content
    if (response && response.content) {
      this.set(key, response, response.model || request.model);
    }
    return { response, cacheHit: false };
  }

  // ─── Cache Management ─────────────────────────────────────────────────────

  /**
   * Warm the cache with a list of pre-computed entries.
   * @param {Array<{request, response}>} entries
   */
  warm(entries = []) {
    let warmed = 0;
    for (const { request, response } of entries) {
      if (!request || !response) continue;
      try {
        const key = this.buildKey(request);
        this.set(key, response, response.model || request.model);
        warmed++;
      } catch (_) {}
    }
    return warmed;
  }

  /**
   * Delete a specific key.
   */
  invalidate(key) {
    return this._store.delete(key);
  }

  /**
   * Delete all entries for a model.
   */
  invalidateModel(model) {
    let count = 0;
    for (const [key, entry] of this._store) {
      if (entry.model === model) {
        this._store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Purge all expired entries.
   * @returns {number} entries removed
   */
  purgeExpired() {
    const now   = Date.now();
    let removed = 0;
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Clear everything.
   */
  clear() {
    const size = this._store.size;
    this._store.clear();
    return size;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  getStats() {
    const total = this._stats.hits + this._stats.misses;
    return {
      ...this._stats,
      size:     this._store.size,
      maxSize:  this.maxSize,
      hitRate:  total > 0 ? (this._stats.hits / total) : 0,
      enabled:  this.enabled,
    };
  }

  /**
   * Detailed entry list for inspection.
   */
  inspect() {
    const now     = Date.now();
    const entries = [];
    for (const [key, entry] of this._store) {
      entries.push({
        key:           key.substring(0, 12) + '...',
        model:         entry.model,
        hits:          entry.hits,
        createdAt:     new Date(entry.createdAt).toISOString(),
        expiresAt:     new Date(entry.expiresAt).toISOString(),
        ttlRemainingMs: Math.max(0, entry.expiresAt - now),
      });
    }
    return entries;
  }
}

module.exports = ResponseCache;

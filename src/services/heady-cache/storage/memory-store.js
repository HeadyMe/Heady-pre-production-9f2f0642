'use strict';

/**
 * HeadyCache Memory Store
 *
 * In-memory cache store with:
 * - O(1) get/set/delete via Map
 * - LRU eviction using a doubly-linked list
 * - TTL expiry checked on access and via periodic sweep
 */

class MemoryStore {
  /**
   * @param {object} opts
   * @param {number} [opts.maxSize=50000]  Max number of entries
   * @param {number} [opts.ttl=3600000]   Default TTL in ms (0 = no expiry)
   * @param {boolean} [opts.slidingWindow=true] Reset TTL on access
   */
  constructor(opts = {}) {
    this._maxSize = opts.maxSize || 50000;
    this._defaultTtl = opts.ttl !== undefined ? opts.ttl : 3600000;
    this._sliding = opts.slidingWindow !== false;

    // Map<key, node> for O(1) lookup
    this._map = new Map();

    // Doubly-linked list for LRU order (head = MRU, tail = LRU)
    this._head = { key: null, value: null, prev: null, next: null };
    this._tail = { key: null, value: null, prev: null, next: null };
    this._head.next = this._tail;
    this._tail.prev = this._head;

    // Periodic TTL sweep every 60s
    this._sweepInterval = setInterval(() => this._sweepExpired(), 60000);
    this._sweepInterval.unref?.(); // don't block process exit
  }

  // -------------------------------------------------------------------------
  // Core interface
  // -------------------------------------------------------------------------

  /**
   * Get a value. Returns { value, meta } or null if miss/expired.
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) return null;

    if (this._isExpired(node)) {
      this._evictNode(node);
      return null;
    }

    if (this._sliding && node.meta.ttl > 0) {
      node.meta.expiresAt = Date.now() + node.meta.ttl;
    }

    this._moveToHead(node);
    node.meta.accessCount++;
    node.meta.lastAccessed = Date.now();

    return { value: node.value, meta: { ...node.meta } };
  }

  /**
   * Set a value.
   * @param {string} key
   * @param {*}      value
   * @param {object} [meta]
   * @param {number} [meta.ttl]         TTL override (ms, 0 = no expiry)
   * @param {string} [meta.namespace]
   * @param {number[]} [meta.vector]    Embedding vector
   * @param {number} [meta.byteSize]    Byte size estimate
   */
  set(key, value, meta = {}) {
    const now = Date.now();
    const ttl = meta.ttl !== undefined ? meta.ttl : this._defaultTtl;

    if (this._map.has(key)) {
      const node = this._map.get(key);
      node.value = value;
      node.meta = {
        ...node.meta,
        ...meta,
        ttl,
        expiresAt: ttl > 0 ? now + ttl : 0,
        lastAccessed: now,
        updatedAt: now,
      };
      this._moveToHead(node);
      return;
    }

    // Evict if full
    while (this._map.size >= this._maxSize) {
      this._evictLru();
    }

    const node = {
      key,
      value,
      meta: {
        namespace: meta.namespace || 'default',
        vector: meta.vector || null,
        byteSize: meta.byteSize || this._estimateSize(value),
        ttl,
        expiresAt: ttl > 0 ? now + ttl : 0,
        createdAt: now,
        updatedAt: now,
        lastAccessed: now,
        accessCount: 0,
        ...meta,
      },
      prev: null,
      next: null,
    };

    this._map.set(key, node);
    this._addToHead(node);
  }

  /**
   * Delete a key. Returns true if it existed.
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._evictNode(node);
    return true;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key) {
    const node = this._map.get(key);
    if (!node) return false;
    if (this._isExpired(node)) {
      this._evictNode(node);
      return false;
    }
    return true;
  }

  /**
   * Clear all entries (or entries in a namespace).
   */
  clear(namespace) {
    if (!namespace) {
      this._map.clear();
      this._head.next = this._tail;
      this._tail.prev = this._head;
      return;
    }
    for (const [key, node] of this._map) {
      if (node.meta.namespace === namespace) this._evictNode(node);
    }
  }

  /**
   * Number of live entries.
   */
  size(namespace) {
    if (!namespace) return this._map.size;
    let count = 0;
    for (const node of this._map.values()) {
      if (node.meta.namespace === namespace) count++;
    }
    return count;
  }

  /**
   * All live keys (optionally filtered by namespace).
   */
  keys(namespace) {
    const result = [];
    for (const [key, node] of this._map) {
      if (!this._isExpired(node) && (!namespace || node.meta.namespace === namespace)) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * All live entries: [key, {value, meta}][]
   */
  entries(namespace) {
    const result = [];
    for (const [key, node] of this._map) {
      if (!this._isExpired(node) && (!namespace || node.meta.namespace === namespace)) {
        result.push([key, { value: node.value, meta: { ...node.meta } }]);
      }
    }
    return result;
  }

  /**
   * Approximate total byte size of stored values.
   */
  byteSize() {
    let total = 0;
    for (const node of this._map.values()) {
      total += node.meta.byteSize || 0;
    }
    return total;
  }

  /**
   * Evict the N least recently used entries.
   */
  evictLru(n = 1) {
    const evicted = [];
    for (let i = 0; i < n; i++) {
      const lru = this._tail.prev;
      if (lru === this._head) break;
      evicted.push(lru.key);
      this._evictNode(lru);
    }
    return evicted;
  }

  /**
   * Evict the N least frequently used entries.
   */
  evictLfu(n = 1) {
    const sorted = Array.from(this._map.values())
      .filter((node) => !this._isExpired(node))
      .sort((a, b) => a.meta.accessCount - b.meta.accessCount);
    const evicted = [];
    for (let i = 0; i < n && i < sorted.length; i++) {
      evicted.push(sorted[i].key);
      this._evictNode(sorted[i]);
    }
    return evicted;
  }

  /**
   * Evict all expired entries.
   */
  evictExpired() {
    const evicted = [];
    for (const [key, node] of this._map) {
      if (this._isExpired(node)) {
        evicted.push(key);
        this._evictNode(node);
      }
    }
    return evicted;
  }

  /**
   * Get meta for a key without updating access stats.
   */
  getMeta(key) {
    const node = this._map.get(key);
    if (!node || this._isExpired(node)) return null;
    return { ...node.meta };
  }

  /**
   * Update TTL for an existing key.
   */
  touch(key, ttl) {
    const node = this._map.get(key);
    if (!node || this._isExpired(node)) return false;
    const newTtl = ttl !== undefined ? ttl : node.meta.ttl;
    node.meta.ttl = newTtl;
    node.meta.expiresAt = newTtl > 0 ? Date.now() + newTtl : 0;
    return true;
  }

  /**
   * Shutdown: clear timers.
   */
  close() {
    clearInterval(this._sweepInterval);
  }

  // -------------------------------------------------------------------------
  // LRU linked-list helpers
  // -------------------------------------------------------------------------

  _addToHead(node) {
    node.prev = this._head;
    node.next = this._head.next;
    this._head.next.prev = node;
    this._head.next = node;
  }

  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  _evictNode(node) {
    this._removeNode(node);
    this._map.delete(node.key);
  }

  _evictLru() {
    const lru = this._tail.prev;
    if (lru !== this._head) this._evictNode(lru);
  }

  _isExpired(node) {
    return node.meta.expiresAt > 0 && Date.now() > node.meta.expiresAt;
  }

  _sweepExpired() {
    for (const [, node] of this._map) {
      if (this._isExpired(node)) this._evictNode(node);
    }
  }

  _estimateSize(value) {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 256; // fallback estimate
    }
  }
}

module.exports = { MemoryStore };

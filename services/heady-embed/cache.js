'use strict';

/**
 * HeadyEmbed Cache Layer
 *
 * LRU cache with TTL support, content-addressable keying (SHA-256),
 * bloom filter for O(1) negative lookups, and JSONL persistence.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const EventEmitter = require('events');
const config = require('./config');

// ---------------------------------------------------------------------------
// Bloom Filter (simple bit-array implementation)
// ---------------------------------------------------------------------------

class BloomFilter {
  /**
   * @param {number} size - Bit array size (larger = fewer false positives)
   * @param {number} hashCount - Number of hash functions
   */
  constructor(size = 100000, hashCount = 4) {
    this._size = size;
    this._hashCount = hashCount;
    this._bits = Buffer.alloc(Math.ceil(size / 8), 0);
    this._count = 0;
  }

  /**
   * Compute `hashCount` positions for a key using double-hashing.
   */
  _positions(key) {
    const h1 = parseInt(crypto.createHash('md5').update(key).digest('hex').slice(0, 8), 16);
    const h2 = parseInt(crypto.createHash('sha1').update(key).digest('hex').slice(0, 8), 16);
    const positions = [];
    for (let i = 0; i < this._hashCount; i++) {
      positions.push(Math.abs((h1 + i * h2) % this._size));
    }
    return positions;
  }

  _setBit(pos) {
    const byte = Math.floor(pos / 8);
    const bit = pos % 8;
    this._bits[byte] |= (1 << bit);
  }

  _getBit(pos) {
    const byte = Math.floor(pos / 8);
    const bit = pos % 8;
    return (this._bits[byte] & (1 << bit)) !== 0;
  }

  add(key) {
    for (const pos of this._positions(key)) {
      this._setBit(pos);
    }
    this._count++;
  }

  /** Returns false if definitely NOT present; true if possibly present. */
  mightContain(key) {
    for (const pos of this._positions(key)) {
      if (!this._getBit(pos)) return false;
    }
    return true;
  }

  get approximateCount() { return this._count; }

  clear() {
    this._bits.fill(0);
    this._count = 0;
  }
}

// ---------------------------------------------------------------------------
// LRU Node & Doubly-Linked List
// ---------------------------------------------------------------------------

class LRUNode {
  constructor(key, value, expiresAt) {
    this.key = key;
    this.value = value;
    this.expiresAt = expiresAt; // timestamp ms, or null for no TTL
    this.prev = null;
    this.next = null;
    this.sizeBytes = 0;
  }
}

// ---------------------------------------------------------------------------
// EmbeddingCache Class
// ---------------------------------------------------------------------------

class EmbeddingCache extends EventEmitter {
  /**
   * @param {object} options
   * @param {number} options.maxSize     - Max entries before eviction
   * @param {number} options.ttl         - TTL in ms (0 = no TTL)
   * @param {string} options.persistPath - JSONL file path for persistence
   * @param {number} options.bloomSize   - Bloom filter bit size
   */
  constructor(options = {}) {
    super();
    this._maxSize = options.maxSize || config.cacheSize;
    this._ttl = options.ttl != null ? options.ttl : config.cacheTtl;
    this._persistPath = options.persistPath || config.cachePersistPath;
    this._bloomSize = options.bloomSize || config.bloomFilterSize;

    /** @type {Map<string, LRUNode>} */
    this._map = new Map();

    // Doubly-linked list: head = most recently used, tail = least recently used
    this._head = new LRUNode(null, null, null); // sentinel
    this._tail = new LRUNode(null, null, null); // sentinel
    this._head.next = this._tail;
    this._tail.prev = this._head;

    this._bloom = new BloomFilter(this._bloomSize, 4);

    this._stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      persistWrites: 0,
      totalBytes: 0,
    };

    this._dirty = false; // Track whether cache has unsaved changes
    this._persistTimer = null;
  }

  // -------------------------------------------------------------------------
  // Key derivation
  // -------------------------------------------------------------------------

  /**
   * Compute a content-addressable cache key.
   * Key = SHA-256(modelId + "\0" + text)
   */
  static makeKey(text, modelId) {
    return crypto
      .createHash('sha256')
      .update(`${modelId}\0${text}`)
      .digest('hex');
  }

  // -------------------------------------------------------------------------
  // Core cache operations
  // -------------------------------------------------------------------------

  /**
   * Get a cached embedding. Returns null on miss or expiry.
   */
  get(key) {
    // Fast negative: bloom filter says definitely not here
    if (!this._bloom.mightContain(key)) {
      this._stats.misses++;
      return null;
    }

    const node = this._map.get(key);
    if (!node) {
      this._stats.misses++;
      return null;
    }

    // Check TTL
    if (node.expiresAt !== null && Date.now() > node.expiresAt) {
      this._evictNode(node);
      this._stats.misses++;
      this._stats.expirations++;
      return null;
    }

    // Move to head (most recently used)
    this._moveToHead(node);
    this._stats.hits++;
    return node.value;
  }

  /**
   * Set a cache entry.
   */
  set(key, value) {
    const expiresAt = this._ttl > 0 ? Date.now() + this._ttl : null;

    if (this._map.has(key)) {
      const node = this._map.get(key);
      this._stats.totalBytes -= node.sizeBytes;
      node.value = value;
      node.expiresAt = expiresAt;
      node.sizeBytes = this._estimateSize(value);
      this._stats.totalBytes += node.sizeBytes;
      this._moveToHead(node);
    } else {
      // Evict LRU entries if at capacity
      while (this._map.size >= this._maxSize) {
        this._evictTail();
      }

      const node = new LRUNode(key, value, expiresAt);
      node.sizeBytes = this._estimateSize(value);
      this._stats.totalBytes += node.sizeBytes;
      this._addToHead(node);
      this._map.set(key, node);
      this._bloom.add(key);
    }

    this._dirty = true;
    this.emit('set', { key, size: this._map.size });
  }

  /**
   * Delete a specific key.
   */
  delete(key) {
    const node = this._map.get(key);
    if (node) {
      this._evictNode(node);
      return true;
    }
    return false;
  }

  /**
   * Batch get: returns Map<key, embedding|null>
   */
  batchGet(keys) {
    const results = new Map();
    for (const key of keys) {
      results.set(key, this.get(key));
    }
    return results;
  }

  /**
   * Batch set: accepts Map<key, embedding> or array of [key, value] pairs
   */
  batchSet(entries) {
    const pairs = entries instanceof Map ? entries.entries() : entries;
    for (const [key, value] of pairs) {
      this.set(key, value);
    }
  }

  /**
   * Check existence without updating LRU order.
   */
  has(key) {
    if (!this._bloom.mightContain(key)) return false;
    const node = this._map.get(key);
    if (!node) return false;
    if (node.expiresAt !== null && Date.now() > node.expiresAt) return false;
    return true;
  }

  /**
   * Clear all entries.
   */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._bloom.clear();
    this._stats.totalBytes = 0;
    this._dirty = true;
    this.emit('clear');
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  get size() { return this._map.size; }

  getStats() {
    const total = this._stats.hits + this._stats.misses;
    return {
      size: this._map.size,
      maxSize: this._maxSize,
      hits: this._stats.hits,
      misses: this._stats.misses,
      hitRate: total > 0 ? this._stats.hits / total : 0,
      evictions: this._stats.evictions,
      expirations: this._stats.expirations,
      estimatedMemoryBytes: this._stats.totalBytes,
      estimatedMemoryMb: (this._stats.totalBytes / (1024 * 1024)).toFixed(2),
      bloomApproximateCount: this._bloom.approximateCount,
      persistWrites: this._stats.persistWrites,
    };
  }

  // -------------------------------------------------------------------------
  // Persistence: save/load JSONL
  // -------------------------------------------------------------------------

  /**
   * Save all non-expired entries to a JSONL file.
   */
  async persist() {
    if (!this._persistPath) return;
    if (!this._dirty) return;

    const now = Date.now();
    const dir = path.dirname(this._persistPath);

    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) { /* ok */ }

    const tmpPath = `${this._persistPath}.tmp`;
    const stream = fs.createWriteStream(tmpPath, { flags: 'w', encoding: 'utf8' });

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);

      for (const [key, node] of this._map) {
        if (node.expiresAt !== null && now > node.expiresAt) continue;
        const line = JSON.stringify({
          k: key,
          v: node.value,
          e: node.expiresAt,
        });
        stream.write(line + '\n');
      }

      stream.end();
    });

    // Atomic rename
    fs.renameSync(tmpPath, this._persistPath);
    this._dirty = false;
    this._stats.persistWrites++;
    this.emit('persisted', { path: this._persistPath, size: this._map.size });
  }

  /**
   * Load entries from JSONL file (cache warming).
   */
  async loadFromDisk() {
    if (!this._persistPath) return 0;

    let loaded = 0;
    try {
      fs.accessSync(this._persistPath);
    } catch (_) {
      return 0; // File doesn't exist yet
    }

    const now = Date.now();
    const rl = readline.createInterface({
      input: fs.createReadStream(this._persistPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    await new Promise((resolve, reject) => {
      rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
          const entry = JSON.parse(line);
          // Skip expired entries
          if (entry.e !== null && now > entry.e) return;
          this.set(entry.k, entry.v);
          loaded++;
        } catch (_) { /* skip corrupt lines */ }
      });
      rl.on('close', resolve);
      rl.on('error', reject);
    });

    this._dirty = false; // Just loaded, nothing new
    this.emit('warmed', { loaded });
    return loaded;
  }

  /**
   * Start periodic persistence (every intervalMs).
   */
  startAutoPersist(intervalMs = 60000) {
    if (this._persistTimer) return;
    this._persistTimer = setInterval(() => {
      this.persist().catch((err) => {
        this.emit('error', new Error(`Auto-persist failed: ${err.message}`));
      });
    }, intervalMs);
    // Don't block process exit
    if (this._persistTimer.unref) this._persistTimer.unref();
  }

  stopAutoPersist() {
    if (this._persistTimer) {
      clearInterval(this._persistTimer);
      this._persistTimer = null;
    }
  }

  /**
   * Graceful shutdown: flush to disk.
   */
  async shutdown() {
    this.stopAutoPersist();
    await this.persist();
    this.emit('shutdown');
  }

  // -------------------------------------------------------------------------
  // LRU internals
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

  _evictTail() {
    const tail = this._tail.prev;
    if (tail === this._head) return;
    this._evictNode(tail);
    this._stats.evictions++;
  }

  _evictNode(node) {
    this._removeNode(node);
    this._map.delete(node.key);
    this._stats.totalBytes -= node.sizeBytes;
    this.emit('evict', { key: node.key });
  }

  /**
   * Estimate size of an embedding array in bytes.
   * Float32 = 4 bytes/element; add key overhead.
   */
  _estimateSize(value) {
    if (Array.isArray(value)) {
      return value.length * 4 + 64; // Float32 + key overhead
    }
    if (value && value.data) {
      return value.data.length * 4 + 64;
    }
    return 64;
  }
}

module.exports = { EmbeddingCache, BloomFilter };

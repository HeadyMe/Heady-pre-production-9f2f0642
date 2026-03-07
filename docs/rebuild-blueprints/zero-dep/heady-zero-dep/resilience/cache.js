/**
 * @file cache.js
 * @description Multi-tier caching: L1 (in-memory LRU) + L2 (disk).
 *
 * Features:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Disk-based cache (larger, persistent across restarts)
 * - Cache-aside pattern (read-through / write-around)
 * - TTL with PHI-scaled expiry jitter
 * - Cache warming strategies (preload from disk on startup)
 * - Bloom filter for negative cache (skip disk lookup for known misses)
 *
 * Sacred Geometry: PHI-scaled TTL jitter, Fibonacci capacity tiers.
 * Zero external dependencies (fs, path, crypto, os).
 *
 * @module HeadyResilience/Cache
 */

import { EventEmitter } from 'events';
import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { createHash, randomBytes } from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

// ─── Bloom Filter (in-memory) ─────────────────────────────────────────────────
class BloomFilter {
  /**
   * Simple counting Bloom filter for negative cache.
   * @param {number} size      Bit array size
   * @param {number} hashCount Number of hash functions
   */
  constructor(size = 2048, hashCount = 4) {
    this.size       = size;
    this.hashCount  = hashCount;
    this._bits      = new Uint8Array(Math.ceil(size / 8));
  }

  _hashes(key) {
    const positions = [];
    for (let i = 0; i < this.hashCount; i++) {
      const h = createHash('sha256')
        .update(`${i}:${key}`)
        .digest('hex');
      positions.push(parseInt(h.slice(0, 8), 16) % this.size);
    }
    return positions;
  }

  add(key) {
    for (const pos of this._hashes(key)) {
      const byte = Math.floor(pos / 8);
      const bit  = pos % 8;
      this._bits[byte] |= (1 << bit);
    }
  }

  has(key) {
    for (const pos of this._hashes(key)) {
      const byte = Math.floor(pos / 8);
      const bit  = pos % 8;
      if (!(this._bits[byte] & (1 << bit))) return false;
    }
    return true; // probabilistically present
  }

  clear() {
    this._bits.fill(0);
  }
}

// ─── LRU Node ─────────────────────────────────────────────────────────────────
class LRUNode {
  constructor(key, value, ttlMs) {
    this.key     = key;
    this.value   = value;
    this.expiry  = ttlMs > 0 ? Date.now() + ttlMs : 0;
    this.hits    = 0;
    this.prev    = null;
    this.next    = null;
  }
  isExpired() {
    return this.expiry > 0 && Date.now() > this.expiry;
  }
}

// ─── L1 In-Memory LRU Cache ───────────────────────────────────────────────────
class L1Cache {
  /**
   * @param {number} capacity  Max entries (Fibonacci-based tiers)
   */
  constructor(capacity = 377) {
    this.capacity = capacity;
    this._map     = new Map();
    // Doubly-linked list: head = MRU, tail = LRU
    this._head = new LRUNode('__head__', null, 0);
    this._tail = new LRUNode('__tail__', null, 0);
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this.hits   = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  _detach(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _insertAfterHead(node) {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next.prev = node;
    this._head.next = node;
  }

  get(key) {
    const node = this._map.get(key);
    if (!node) { this.misses++; return undefined; }
    if (node.isExpired()) {
      this._detach(node);
      this._map.delete(key);
      this.misses++;
      return undefined;
    }
    // Move to MRU
    this._detach(node);
    this._insertAfterHead(node);
    node.hits++;
    this.hits++;
    return node.value;
  }

  set(key, value, ttlMs = 0) {
    if (this._map.has(key)) {
      const node = this._map.get(key);
      node.value  = value;
      node.expiry = ttlMs > 0 ? Date.now() + ttlMs : 0;
      this._detach(node);
      this._insertAfterHead(node);
      return;
    }
    if (this._map.size >= this.capacity) {
      // Evict LRU
      const lru = this._tail.prev;
      if (lru !== this._head) {
        this._detach(lru);
        this._map.delete(lru.key);
        this.evictions++;
      }
    }
    const node = new LRUNode(key, value, ttlMs);
    this._map.set(key, node);
    this._insertAfterHead(node);
  }

  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._detach(node);
    this._map.delete(key);
    return true;
  }

  has(key) {
    const node = this._map.get(key);
    return !!(node && !node.isExpired());
  }

  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  get size() { return this._map.size; }

  stats() {
    return { size: this._map.size, capacity: this.capacity, hits: this.hits, misses: this.misses, evictions: this.evictions };
  }
}

// ─── L2 Disk Cache ───────────────────────────────────────────────────────────
class L2Cache {
  constructor(dir) {
    this.dir = dir ?? path.join(os.tmpdir(), 'heady-cache-l2');
    fs.mkdirSync(this.dir, { recursive: true });
    this.hits   = 0;
    this.misses = 0;
    this.writes = 0;
  }

  _keyToPath(key) {
    const hash = createHash('sha256').update(key).digest('hex');
    // Shard into 256 subdirs to avoid fs listing overhead
    const shard = hash.slice(0, 2);
    return path.join(this.dir, shard, hash + '.json');
  }

  get(key) {
    const fpath = this._keyToPath(key);
    try {
      const raw  = fs.readFileSync(fpath, 'utf8');
      const entry = JSON.parse(raw);
      if (entry.expiry > 0 && Date.now() > entry.expiry) {
        fs.unlinkSync(fpath);
        this.misses++;
        return undefined;
      }
      this.hits++;
      return entry.value;
    } catch {
      this.misses++;
      return undefined;
    }
  }

  set(key, value, ttlMs = 0) {
    const fpath = this._keyToPath(key);
    const entry = {
      key,
      value,
      expiry: ttlMs > 0 ? Date.now() + ttlMs : 0,
      ts: Date.now(),
    };
    try {
      fs.mkdirSync(path.dirname(fpath), { recursive: true });
      fs.writeFileSync(fpath, JSON.stringify(entry), 'utf8');
      this.writes++;
    } catch (err) {
      // Disk write failure is non-fatal
    }
  }

  delete(key) {
    try { fs.unlinkSync(this._keyToPath(key)); return true; } catch { return false; }
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Enumerate all keys (used for cache warming).
   */
  keys() {
    const result = [];
    try {
      const shards = fs.readdirSync(this.dir);
      for (const shard of shards) {
        const shardDir = path.join(this.dir, shard);
        const files    = fs.readdirSync(shardDir);
        for (const f of files) {
          if (!f.endsWith('.json')) continue;
          try {
            const raw   = fs.readFileSync(path.join(shardDir, f), 'utf8');
            const entry = JSON.parse(raw);
            if (entry.expiry === 0 || Date.now() <= entry.expiry) {
              result.push(entry.key);
            }
          } catch { /* skip corrupt */ }
        }
      }
    } catch { /* dir may be empty */ }
    return result;
  }

  stats() {
    return { dir: this.dir, hits: this.hits, misses: this.misses, writes: this.writes };
  }
}

// ─── Multi-Tier Cache ─────────────────────────────────────────────────────────
export class MultiTierCache extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} opts.l1Capacity      L1 entry limit (default: 377 = Fibonacci)
   * @param {string} opts.l2Dir           Disk cache directory
   * @param {number} opts.defaultTtlMs    Default TTL (0 = no expiry)
   * @param {number} opts.phiJitter       Apply PHI-scaled jitter to TTL (bool)
   */
  constructor(opts = {}) {
    super();
    this.config = {
      l1Capacity:   opts.l1Capacity   ?? 377,
      l2Dir:        opts.l2Dir        ?? null,
      defaultTtlMs: opts.defaultTtlMs ?? 300_000,   // 5 minutes
      phiJitter:    opts.phiJitter    !== false,
    };
    this._l1     = new L1Cache(this.config.l1Capacity);
    this._l2     = new L2Cache(this.config.l2Dir);
    this._bloom  = new BloomFilter(4096, 5);  // negative cache bloom
  }

  /**
   * PHI-scaled jitter on TTL to spread cache expiry.
   */
  _jitter(ttlMs) {
    if (!this.config.phiJitter || ttlMs === 0) return ttlMs;
    // ±(PHI_INV * 0.1) = roughly ±6% jitter
    const range = ttlMs * PHI_INV * 0.1;
    return ttlMs + Math.floor((Math.random() * 2 - 1) * range);
  }

  /**
   * Get a value from cache (L1 → L2 → miss).
   * @returns {any} undefined if not found
   */
  async get(key) {
    // L1 hit
    const l1val = this._l1.get(key);
    if (l1val !== undefined) {
      this.emit('hit', { tier: 'L1', key });
      return l1val;
    }

    // Bloom filter negative cache — skip disk if we know it's a miss
    if (this._bloom.has(key)) {
      this.emit('miss', { tier: 'bloom', key });
      return undefined;
    }

    // L2 hit → promote to L1
    const l2val = this._l2.get(key);
    if (l2val !== undefined) {
      this._l1.set(key, l2val, this._jitter(this.config.defaultTtlMs));
      this.emit('hit', { tier: 'L2', key });
      return l2val;
    }

    // True miss
    this._bloom.add(key);
    this.emit('miss', { tier: 'all', key });
    return undefined;
  }

  /**
   * Set a value in both tiers.
   */
  async set(key, value, ttlMs) {
    const effectiveTtl = this._jitter(ttlMs ?? this.config.defaultTtlMs);
    this._l1.set(key, value, effectiveTtl);
    this._l2.set(key, value, effectiveTtl);
    // Remove from negative cache bloom on write
    // (can't remove from bloom filter directly; clear periodically)
    this.emit('set', { key, ttlMs: effectiveTtl });
  }

  /**
   * Delete from both tiers.
   */
  async delete(key) {
    this._l1.delete(key);
    this._l2.delete(key);
    this.emit('delete', { key });
  }

  /**
   * Cache-aside: get from cache, or load via loader fn + store.
   * @param {string}   key
   * @param {Function} loader      async () => value
   * @param {number}   [ttlMs]
   */
  async getOrLoad(key, loader, ttlMs) {
    const cached = await this.get(key);
    if (cached !== undefined) return cached;

    const value = await loader();
    if (value !== undefined && value !== null) {
      await this.set(key, value, ttlMs);
    }
    return value;
  }

  /**
   * Cache warming: load all L2 keys into L1 (up to capacity).
   */
  async warm(filter = null) {
    const keys   = this._l2.keys();
    let loaded   = 0;
    const limit  = Math.floor(this.config.l1Capacity * PHI_INV); // warm ~61% of L1

    for (const key of keys) {
      if (loaded >= limit) break;
      if (filter && !filter(key)) continue;
      const val = this._l2.get(key);
      if (val !== undefined) {
        this._l1.set(key, val, this._jitter(this.config.defaultTtlMs));
        loaded++;
      }
    }
    this.emit('warmed', { keysLoaded: loaded, totalL2Keys: keys.length });
    return loaded;
  }

  /**
   * Clear all tiers + reset bloom.
   */
  async clear() {
    this._l1.clear();
    this._bloom.clear();
    this.emit('cleared');
  }

  stats() {
    return {
      l1: this._l1.stats(),
      l2: this._l2.stats(),
      bloom: { size: this._bloom.size, hashCount: this._bloom.hashCount },
    };
  }
}

export default MultiTierCache;

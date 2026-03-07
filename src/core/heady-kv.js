/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview In-memory key-value store with TTL, LRU eviction, and
 * optional persistence to disk. Replaces node-cache and similar packages.
 * @module src/core/heady-kv
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('heady-kv');

// ---------------------------------------------------------------------------
// LRU Node (doubly linked list)
// ---------------------------------------------------------------------------

class LRUNode {
  constructor(key, value, expiresAt) {
    this.key = key;
    this.value = value;
    this.expiresAt = expiresAt; // epoch ms or null (no expiry)
    this.prev = null;
    this.next = null;
  }
}

// ---------------------------------------------------------------------------
// HeadyKV Store
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} KVOptions
 * @property {number} [maxSize=1000] - Maximum number of entries (LRU eviction)
 * @property {number} [defaultTtlMs=0] - Default TTL in ms (0 = no expiry)
 * @property {string} [persistPath] - File path for persistence (optional)
 * @property {number} [persistIntervalMs=60000] - How often to persist (ms)
 * @property {boolean} [autoCleanup=true] - Run periodic TTL cleanup
 * @property {number} [cleanupIntervalMs=30000] - TTL cleanup interval (ms)
 */

class HeadyKV {
  /**
   * @param {KVOptions} [options={}]
   */
  constructor(options = {}) {
    const {
      maxSize = 1000,
      defaultTtlMs = 0,
      persistPath = null,
      persistIntervalMs = 60000,
      autoCleanup = true,
      cleanupIntervalMs = 30000,
    } = options;

    this._maxSize = maxSize;
    this._defaultTtlMs = defaultTtlMs;
    this._persistPath = persistPath;

    /** @type {Map<string, LRUNode>} */
    this._map = new Map();

    // Doubly linked list for LRU tracking (head = most recent, tail = least recent)
    this._head = new LRUNode(null, null, null); // sentinel
    this._tail = new LRUNode(null, null, null); // sentinel
    this._head.next = this._tail;
    this._tail.prev = this._head;

    /** @type {NodeJS.Timeout|null} */
    this._cleanupHandle = null;
    /** @type {NodeJS.Timeout|null} */
    this._persistHandle = null;

    // Load persisted data if available
    if (persistPath) {
      this._loadFromDisk();
    }

    if (autoCleanup) {
      this._cleanupHandle = setInterval(() => this._evictExpired(), cleanupIntervalMs);
      if (this._cleanupHandle.unref) this._cleanupHandle.unref();
    }

    if (persistPath && persistIntervalMs > 0) {
      this._persistHandle = setInterval(() => this._saveToDisk(), persistIntervalMs);
      if (this._persistHandle.unref) this._persistHandle.unref();
    }
  }

  // ── Core operations ───────────────────────────────────────────────────────

  /**
   * Stores a value with an optional TTL.
   * @param {string} key
   * @param {*} value - Must be JSON-serialisable
   * @param {number} [ttlMs] - TTL in ms (0 or undefined = use default or no expiry)
   * @returns {this}
   */
  set(key, value, ttlMs) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');

    const effectiveTtl = ttlMs !== undefined ? ttlMs : this._defaultTtlMs;
    const expiresAt = effectiveTtl > 0 ? Date.now() + effectiveTtl : null;

    if (this._map.has(key)) {
      // Update existing node
      const node = this._map.get(key);
      node.value = value;
      node.expiresAt = expiresAt;
      this._moveToHead(node);
    } else {
      // Evict LRU entry if at capacity
      if (this._map.size >= this._maxSize) {
        this._evictLRU();
      }
      const node = new LRUNode(key, value, expiresAt);
      this._map.set(key, node);
      this._addToHead(node);
    }

    return this;
  }

  /**
   * Gets a value by key. Returns undefined if missing or expired.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) return undefined;

    if (node.expiresAt !== null && Date.now() > node.expiresAt) {
      this._removeNode(node);
      this._map.delete(key);
      return undefined;
    }

    this._moveToHead(node);
    return node.value;
  }

  /**
   * Checks whether a key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Deletes a key.
   * @param {string} key
   * @returns {boolean} True if the key existed
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._removeNode(node);
    this._map.delete(key);
    return true;
  }

  /**
   * Removes all entries.
   * @returns {this}
   */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
    return this;
  }

  /**
   * Returns the number of non-expired entries.
   * @returns {number}
   */
  get size() {
    return this._map.size;
  }

  /**
   * Returns the remaining TTL for a key in milliseconds.
   * Returns -1 if no expiry, 0 if expired/missing.
   * @param {string} key
   * @returns {number}
   */
  ttl(key) {
    const node = this._map.get(key);
    if (!node) return 0;
    if (node.expiresAt === null) return -1;
    const remaining = node.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Updates the TTL of an existing key.
   * @param {string} key
   * @param {number} ttlMs
   * @returns {boolean} True if the key exists and was updated
   */
  expire(key, ttlMs) {
    const node = this._map.get(key);
    if (!node) return false;
    node.expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;
    return true;
  }

  /**
   * Gets a value and deletes it atomically.
   * @param {string} key
   * @returns {*}
   */
  pop(key) {
    const value = this.get(key);
    if (value !== undefined) this.delete(key);
    return value;
  }

  /**
   * Gets a value, or computes and stores it if missing/expired.
   * @param {string} key
   * @param {Function} computeFn - () => value or Promise<value>
   * @param {number} [ttlMs]
   * @returns {Promise<*>}
   */
  async getOrSet(key, computeFn, ttlMs) {
    const existing = this.get(key);
    if (existing !== undefined) return existing;
    const value = await computeFn();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Increments a numeric counter. Initialises to 0 if absent.
   * @param {string} key
   * @param {number} [by=1]
   * @returns {number} New value
   */
  incr(key, by = 1) {
    const current = this.get(key) || 0;
    const next = current + by;
    this.set(key, next, this.ttl(key) > 0 ? this.ttl(key) : undefined);
    return next;
  }

  /**
   * Returns all non-expired keys.
   * @returns {string[]}
   */
  keys() {
    this._evictExpired();
    return [...this._map.keys()];
  }

  /**
   * Returns all non-expired values.
   * @returns {*[]}
   */
  values() {
    this._evictExpired();
    return [...this._map.values()].map((n) => n.value);
  }

  /**
   * Returns all non-expired [key, value] entries.
   * @returns {Array<[string, *]>}
   */
  entries() {
    this._evictExpired();
    return [...this._map.entries()].map(([k, n]) => [k, n.value]);
  }

  // ── LRU internals ─────────────────────────────────────────────────────────

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

  _evictLRU() {
    const lru = this._tail.prev;
    if (lru === this._head) return;
    this._removeNode(lru);
    this._map.delete(lru.key);
    logger.debug(`LRU evicted: ${lru.key}`);
  }

  _evictExpired() {
    const now = Date.now();
    for (const [key, node] of this._map) {
      if (node.expiresAt !== null && now > node.expiresAt) {
        this._removeNode(node);
        this._map.delete(key);
      }
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Saves current store contents to disk as JSON.
   */
  _saveToDisk() {
    if (!this._persistPath) return;
    this._evictExpired();
    const snapshot = {};
    for (const [key, node] of this._map) {
      snapshot[key] = { value: node.value, expiresAt: node.expiresAt };
    }
    try {
      fs.mkdirSync(path.dirname(this._persistPath), { recursive: true });
      fs.writeFileSync(this._persistPath, JSON.stringify(snapshot), 'utf8');
    } catch (err) {
      logger.error('Failed to persist KV store', { err, path: this._persistPath });
    }
  }

  /**
   * Loads store contents from disk.
   */
  _loadFromDisk() {
    if (!this._persistPath) return;
    try {
      const raw = fs.readFileSync(this._persistPath, 'utf8');
      const snapshot = JSON.parse(raw);
      const now = Date.now();
      for (const [key, { value, expiresAt }] of Object.entries(snapshot)) {
        if (expiresAt !== null && now > expiresAt) continue; // Skip expired
        this.set(key, value, expiresAt !== null ? expiresAt - now : 0);
      }
      logger.info(`KV store loaded from disk: ${Object.keys(snapshot).length} entries`, { path: this._persistPath });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn('Could not load KV store from disk', { err, path: this._persistPath });
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Persists to disk and clears all timers.
   */
  destroy() {
    if (this._persistHandle) clearInterval(this._persistHandle);
    if (this._cleanupHandle) clearInterval(this._cleanupHandle);
    if (this._persistPath) this._saveToDisk();
    this._persistHandle = null;
    this._cleanupHandle = null;
    logger.debug('KV store destroyed');
  }

  /**
   * Returns store statistics.
   * @returns {Object}
   */
  stats() {
    this._evictExpired();
    return {
      size: this._map.size,
      maxSize: this._maxSize,
      utilizationPercent: Math.round((this._map.size / this._maxSize) * 100),
      defaultTtlMs: this._defaultTtlMs,
      persistPath: this._persistPath || null,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory & singleton
// ---------------------------------------------------------------------------

/**
 * Creates a new HeadyKV instance.
 * @param {KVOptions} [options]
 * @returns {HeadyKV}
 */
function createKV(options = {}) {
  return new HeadyKV(options);
}

/** Default in-memory store (no persistence, 1000 entries). */
const defaultStore = new HeadyKV({ maxSize: 1000 });

module.exports = { HeadyKV, createKV, defaultStore };

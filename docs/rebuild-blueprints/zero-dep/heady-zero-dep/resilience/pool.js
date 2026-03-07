/**
 * @file pool.js
 * @description Generic object/connection pool with Fibonacci-based sizing.
 *
 * Features:
 * - Generic object pool (works for DB connections, HTTP clients, workers, etc.)
 * - Acquire/release with configurable timeout
 * - Min/max pool size based on Fibonacci ratios
 * - Health validation on acquire (evict stale objects)
 * - Idle timeout with graceful cleanup
 * - Pool statistics and monitoring
 *
 * Sacred Geometry: Fibonacci-based min/max sizing, PHI growth factor.
 * Zero external dependencies (events, crypto).
 *
 * @module HeadyResilience/Pool
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
// Fibonacci pool sizes: pick sensible defaults
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/**
 * Pick the nearest Fibonacci number >= n.
 */
function nearestFib(n) {
  for (const f of FIBONACCI) if (f >= n) return f;
  return FIBONACCI[FIBONACCI.length - 1];
}

// ─── Pool Item Wrapper ────────────────────────────────────────────────────────
class PoolItem {
  constructor(resource) {
    this.id         = randomUUID();
    this.resource   = resource;
    this.createdAt  = Date.now();
    this.lastUsedAt = Date.now();
    this.useCount   = 0;
    this.inUse      = false;
  }

  touch() {
    this.lastUsedAt = Date.now();
    this.useCount++;
  }

  idleMs() {
    return Date.now() - this.lastUsedAt;
  }
}

// ─── Acquire Queue Entry ──────────────────────────────────────────────────────
class AcquireRequest {
  constructor(timeoutMs) {
    this.id = randomUUID();
    this.resolve = null;
    this.reject  = null;
    this.timer   = null;
    this.promise = new Promise((res, rej) => {
      this.resolve = res;
      this.reject  = rej;
    });
    if (timeoutMs > 0) {
      this.timer = setTimeout(() => {
        this.reject(Object.assign(
          new Error(`Pool: acquire timed out after ${timeoutMs}ms`),
          { code: 'POOL_TIMEOUT' }
        ));
      }, timeoutMs);
    }
  }

  fulfill(item) {
    if (this.timer) clearTimeout(this.timer);
    this.resolve(item);
  }

  fail(err) {
    if (this.timer) clearTimeout(this.timer);
    this.reject(err);
  }
}

// ─── Pool ─────────────────────────────────────────────────────────────────────
/**
 * Generic object pool.
 *
 * @example
 * const pool = new Pool({
 *   factory:     async () => createDbConnection(),
 *   destroyer:   async (conn) => conn.close(),
 *   validate:    async (conn) => conn.isAlive(),
 *   minSize:     3,
 *   maxSize:     13,
 *   idleTimeoutMs: 60_000,
 * });
 * await pool.initialize();
 * const conn = await pool.acquire();
 * // use conn.resource
 * await pool.release(conn);
 */
export class Pool extends EventEmitter {
  /**
   * @param {object}   opts
   * @param {Function} opts.factory         async () => resource
   * @param {Function} [opts.destroyer]     async (resource) => void
   * @param {Function} [opts.validate]      async (resource) => bool
   * @param {number}   [opts.minSize]       Min pool size (will be snapped to Fibonacci)
   * @param {number}   [opts.maxSize]       Max pool size (will be snapped to Fibonacci)
   * @param {number}   [opts.acquireTimeoutMs]
   * @param {number}   [opts.idleTimeoutMs]
   * @param {number}   [opts.maxItemAge]    Max item lifetime ms (0 = unlimited)
   * @param {number}   [opts.maxUseCount]   Max uses per item (0 = unlimited)
   */
  constructor(opts = {}) {
    super();
    if (!opts.factory) throw new Error('Pool: factory function required');

    this.config = {
      factory:           opts.factory,
      destroyer:         opts.destroyer        ?? null,
      validate:          opts.validate         ?? null,
      minSize:           nearestFib(opts.minSize ?? 2),
      maxSize:           nearestFib(opts.maxSize ?? 13),
      acquireTimeoutMs:  opts.acquireTimeoutMs ?? 10_000,
      idleTimeoutMs:     opts.idleTimeoutMs    ?? 120_000,
      maxItemAge:        opts.maxItemAge       ?? 0,
      maxUseCount:       opts.maxUseCount      ?? 0,
    };

    this._idle     = [];          // available PoolItems
    this._inUse    = new Map();   // id → PoolItem (checked out)
    this._queue    = [];          // pending AcquireRequests
    this._creating = 0;          // items currently being created
    this._draining = false;
    this._idleTimer = null;
  }

  // ── Initialization ────────────────────────────────────────────────────────

  async initialize() {
    const promises = [];
    for (let i = 0; i < this.config.minSize; i++) {
      promises.push(this._createItem());
    }
    await Promise.all(promises);
    this._startIdleReaper();
    this.emit('initialized', { size: this._idle.length });
  }

  async _createItem() {
    if (this._totalSize >= this.config.maxSize) return null;
    this._creating++;
    try {
      const resource = await this.config.factory();
      const item     = new PoolItem(resource);
      this._idle.push(item);
      this.emit('created', { id: item.id });
      return item;
    } catch (err) {
      this.emit('createError', { error: err.message });
      throw err;
    } finally {
      this._creating--;
    }
  }

  async _destroyItem(item) {
    try {
      if (this.config.destroyer) await this.config.destroyer(item.resource);
    } catch (err) {
      this.emit('destroyError', { id: item.id, error: err.message });
    }
    this.emit('destroyed', { id: item.id });
  }

  // ── Acquire / Release ─────────────────────────────────────────────────────

  /**
   * Acquire a resource from the pool.
   * @returns {Promise<PoolItem>}
   */
  async acquire() {
    if (this._draining) {
      throw Object.assign(new Error('Pool: draining'), { code: 'POOL_DRAINING' });
    }

    // Try to get a healthy idle item
    while (this._idle.length > 0) {
      const item = this._idle.pop();
      const ok   = await this._validateItem(item);
      if (ok) {
        item.inUse = true;
        item.touch();
        this._inUse.set(item.id, item);
        this.emit('acquired', { id: item.id, queueDepth: this._queue.length });
        return item;
      } else {
        await this._destroyItem(item);
      }
    }

    // Can we grow the pool?
    if (this._totalSize < this.config.maxSize) {
      const item = await this._createItem();
      if (item) {
        this._idle.pop(); // _createItem pushes to idle
        item.inUse = true;
        item.touch();
        this._inUse.set(item.id, item);
        this.emit('acquired', { id: item.id, queueDepth: this._queue.length });
        return item;
      }
    }

    // Queue the request
    const req = new AcquireRequest(this.config.acquireTimeoutMs);
    this._queue.push(req);
    this.emit('queued', { queueDepth: this._queue.length });
    return req.promise;
  }

  /**
   * Release a resource back to the pool.
   * @param {PoolItem} item
   */
  async release(item) {
    if (!this._inUse.has(item.id)) return; // already released or foreign
    this._inUse.delete(item.id);
    item.inUse = false;

    // Check if item should be retired
    if (this._shouldRetire(item)) {
      await this._destroyItem(item);
      // Ensure minimum is maintained
      if (this._totalSize < this.config.minSize) {
        this._createItem().catch(() => {});
      }
    } else {
      // Fulfill next queued request or return to idle
      if (this._queue.length > 0) {
        const req  = this._queue.shift();
        item.inUse = true;
        item.touch();
        this._inUse.set(item.id, item);
        req.fulfill(item);
      } else {
        this._idle.push(item);
      }
    }
    this.emit('released', { id: item.id, idleSize: this._idle.length });
  }

  _shouldRetire(item) {
    if (this.config.maxUseCount > 0 && item.useCount >= this.config.maxUseCount) return true;
    if (this.config.maxItemAge > 0 && Date.now() - item.createdAt > this.config.maxItemAge) return true;
    return false;
  }

  async _validateItem(item) {
    if (this.config.maxItemAge > 0 && Date.now() - item.createdAt > this.config.maxItemAge) return false;
    if (this.config.maxUseCount > 0 && item.useCount >= this.config.maxUseCount) return false;
    if (this.config.validate) {
      try {
        return await this.config.validate(item.resource);
      } catch {
        return false;
      }
    }
    return true;
  }

  // ── Idle Reaper ───────────────────────────────────────────────────────────

  _startIdleReaper() {
    // PHI-scaled reaper interval (shorter = more aggressive)
    const interval = Math.floor(this.config.idleTimeoutMs * PHI_INV);
    this._idleTimer = setInterval(() => this._reapIdle(), Math.max(interval, 5_000));
    if (this._idleTimer.unref) this._idleTimer.unref();
  }

  _reapIdle() {
    const now     = Date.now();
    const toReap  = [];

    for (const item of this._idle) {
      if (
        this._totalSize > this.config.minSize &&
        item.idleMs() > this.config.idleTimeoutMs
      ) {
        toReap.push(item);
      }
    }

    this._idle = this._idle.filter(i => !toReap.includes(i));

    for (const item of toReap) {
      this._destroyItem(item).catch(() => {});
    }

    if (toReap.length > 0) {
      this.emit('reaped', { count: toReap.length, idleSize: this._idle.length });
    }
  }

  // ── Drain ─────────────────────────────────────────────────────────────────

  async drain() {
    this._draining = true;

    // Reject pending requests
    for (const req of this._queue) {
      req.fail(new Error('Pool: draining'));
    }
    this._queue = [];

    // Destroy idle
    const destroys = this._idle.map(item => this._destroyItem(item));
    this._idle = [];
    await Promise.allSettled(destroys);

    // Wait for in-use items to be released (with timeout)
    const deadline = Date.now() + 10_000;
    while (this._inUse.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }

    if (this._idleTimer) clearInterval(this._idleTimer);
    this.emit('drained');
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get _totalSize() {
    return this._idle.length + this._inUse.size + this._creating;
  }

  stats() {
    return {
      idle:      this._idle.length,
      inUse:     this._inUse.size,
      creating:  this._creating,
      total:     this._totalSize,
      min:       this.config.minSize,
      max:       this.config.maxSize,
      queued:    this._queue.length,
      draining:  this._draining,
    };
  }

  /**
   * Convenience: run fn with auto-acquired+released item.
   * @param {Function} fn  async (resource) => result
   */
  async use(fn) {
    const item = await this.acquire();
    try {
      return await fn(item.resource);
    } finally {
      await this.release(item);
    }
  }
}

export default Pool;

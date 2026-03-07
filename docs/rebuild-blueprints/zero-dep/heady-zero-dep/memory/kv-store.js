/**
 * @fileoverview Key-Value Store — Redis/Upstash replacement
 * Zero-dependency in-process KV store with:
 *   - LRU eviction (PHI-scaled capacity)
 *   - TTL per entry
 *   - Pub/Sub channels
 *   - Atomic operations: incr, decr, append
 *   - Sorted sets (ZSet) for leaderboards / scoring
 *   - WAL (Write-Ahead Log) for crash recovery
 *   - Snapshot & restore
 *   - Glob pattern key matching
 *
 * Node.js built-ins only: fs, path, events, crypto
 */

import fs      from 'node:fs';
import path    from 'node:path';
import { EventEmitter } from 'node:events';
import crypto  from 'node:crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;

/** Default max entries before LRU eviction kicks in */
const DEFAULT_MAX_SIZE = Math.round(10_000 * PHI); // ~16 180

/** Default WAL flush interval (ms) */
const WAL_FLUSH_INTERVAL = Math.round(1000 * PHI); // ~1 618 ms

/** Snapshot interval (ms) — PHI^7 seconds */
const SNAPSHOT_INTERVAL = Math.round(1000 * Math.pow(PHI, 7)); // ~29 000 ms

// ─── Glob → RegExp ────────────────────────────────────────────────────────────

/**
 * Convert a Redis-style glob pattern to a RegExp.
 * Supports: * ? [chars]
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegex(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    switch (c) {
      case '*':  re += '.*';              break;
      case '?':  re += '.';               break;
      case '[':  re += '[';               break;
      case ']':  re += ']';               break;
      case '\\': re += '\\\\';            break;
      case '.':  re += '\\.';             break;
      case '^':  re += '\\^';             break;
      case '$':  re += '\\$';             break;
      case '+':  re += '\\+';             break;
      case '(':  re += '\\(';             break;
      case ')':  re += '\\)';             break;
      case '{':  re += '\\{';             break;
      case '}':  re += '\\}';             break;
      case '|':  re += '\\|';             break;
      default:   re += c;
    }
  }
  re += '$';
  return new RegExp(re);
}

// ─── LRU Cache node ───────────────────────────────────────────────────────────

class LRUNode {
  constructor(key, value, ttl = 0) {
    this.key     = key;
    this.value   = value;
    this.ttl     = ttl;            // ms from epoch, 0 = no expiry
    this.prev    = null;
    this.next    = null;
    this.version = 0;
  }
  isExpired() {
    return this.ttl > 0 && Date.now() > this.ttl;
  }
}

// ─── Sorted Set ───────────────────────────────────────────────────────────────

/**
 * Sorted Set backed by a Map<member,score> + sorted array.
 * Scores are kept sorted for range queries.
 */
class ZSet {
  constructor() {
    /** @type {Map<string, number>} */
    this._scores = new Map();
    /** @type {Array<{member:string, score:number}>} sorted ascending */
    this._sorted = [];
    this._dirty  = false;
  }

  _sort() {
    if (!this._dirty) return;
    this._sorted.sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
    this._dirty = false;
  }

  zadd(member, score) {
    if (this._scores.has(member)) {
      // update existing
      const idx = this._sorted.findIndex(x => x.member === member);
      if (idx !== -1) this._sorted.splice(idx, 1);
    }
    this._scores.set(member, score);
    this._sorted.push({ member, score });
    this._dirty = true;
  }

  zscore(member) { return this._scores.get(member) ?? null; }

  zincrby(member, delta) {
    const cur = this._scores.get(member) ?? 0;
    this.zadd(member, cur + delta);
    return cur + delta;
  }

  zrank(member) {
    this._sort();
    return this._sorted.findIndex(x => x.member === member);
  }

  zrevrank(member) {
    this._sort();
    const i = this._sorted.findIndex(x => x.member === member);
    return i === -1 ? null : this._sorted.length - 1 - i;
  }

  /** @returns {Array<{member:string, score:number}>} */
  zrange(start, stop, withScores = false) {
    this._sort();
    const slice = this._sorted.slice(start, stop === -1 ? undefined : stop + 1);
    return withScores ? slice : slice.map(x => x.member);
  }

  /** Range by score */
  zrangebyscore(min, max) {
    this._sort();
    return this._sorted.filter(x => x.score >= min && x.score <= max);
  }

  zrem(member) {
    if (!this._scores.has(member)) return 0;
    this._scores.delete(member);
    const idx = this._sorted.findIndex(x => x.member === member);
    if (idx !== -1) this._sorted.splice(idx, 1);
    return 1;
  }

  zcard() { return this._scores.size; }

  toJSON() {
    return Object.fromEntries(this._scores);
  }

  static fromJSON(obj) {
    const z = new ZSet();
    for (const [member, score] of Object.entries(obj)) z.zadd(member, score);
    return z;
  }
}

// ─── WAL ──────────────────────────────────────────────────────────────────────

class WAL {
  /**
   * @param {string} walPath - path to WAL file
   */
  constructor(walPath) {
    this.path    = walPath;
    this._buffer = [];
    this._fd     = null;
    this._open();
  }

  _open() {
    try {
      this._fd = fs.openSync(this.path, 'a');
    } catch { /* no-op if disk not available */ }
  }

  /**
   * Append a log entry.
   * @param {string} op    - SET|DEL|INCR|ZADD|ZREM
   * @param {string} key
   * @param {*}      [value]
   * @param {number} [ttl]
   */
  append(op, key, value, ttl = 0) {
    const entry = JSON.stringify({ op, key, value, ttl, ts: Date.now() }) + '\n';
    this._buffer.push(entry);
  }

  flush() {
    if (!this._fd || this._buffer.length === 0) return;
    const data = this._buffer.join('');
    this._buffer = [];
    try { fs.writeSync(this._fd, data); } catch { /* ignore */ }
  }

  /** Read all entries for replay. */
  readAll() {
    try {
      const content = fs.readFileSync(this.path, 'utf8');
      return content.split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch { return []; }
  }

  /** Truncate WAL (after snapshot). */
  truncate() {
    if (this._fd) { try { fs.closeSync(this._fd); } catch {} }
    try { fs.writeFileSync(this.path, ''); } catch {}
    this._open();
  }

  close() {
    this.flush();
    if (this._fd) { try { fs.closeSync(this._fd); } catch {} this._fd = null; }
  }
}

// ─── KVStore ──────────────────────────────────────────────────────────────────

/**
 * In-process key-value store — Redis/Upstash replacement.
 *
 * @extends EventEmitter
 * @example
 * const kv = new KVStore({ dataDir: './data/kv' });
 * await kv.init();
 * await kv.set('foo', 'bar', { ttl: 5000 });
 * const val = await kv.get('foo');
 */
export class KVStore extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}  [opts.maxSize]          - max entries before LRU eviction
   * @param {string}  [opts.dataDir]          - directory for WAL + snapshots
   * @param {number}  [opts.walFlushInterval] - ms between WAL flushes
   * @param {boolean} [opts.persistence=true]
   */
  constructor(opts = {}) {
    super();
    this.maxSize   = opts.maxSize   ?? DEFAULT_MAX_SIZE;
    this.dataDir   = opts.dataDir   ?? null;
    this.persistence = opts.dataDir ? (opts.persistence ?? true) : false;

    /** @type {Map<string, LRUNode>} */
    this._store = new Map();
    /** LRU doubly-linked list head (most recent) */
    this._head = null;
    /** LRU doubly-linked list tail (least recent) */
    this._tail = null;

    /** @type {Map<string, ZSet>} */
    this._zsets = new Map();

    /** @type {Map<string, Set<Function>>} pub/sub channels */
    this._subs = new Map();

    this._wal = null;
    this._walTimer = null;
    this._snapTimer = null;
  }

  // ─ init ────────────────────────────────────────────────────────────────────

  async init() {
    if (this.persistence && this.dataDir) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      const walPath = path.join(this.dataDir, 'wal.log');
      this._wal = new WAL(walPath);

      // Restore snapshot first, then replay WAL
      await this._restoreSnapshot();
      this._replayWAL();

      // Flush WAL periodically
      this._walTimer = setInterval(() => this._wal?.flush(), WAL_FLUSH_INTERVAL);
      this._walTimer.unref?.();

      // Snapshot periodically
      this._snapTimer = setInterval(() => this.snapshot(), SNAPSHOT_INTERVAL);
      this._snapTimer.unref?.();
    }
  }

  // ─ LRU helpers ─────────────────────────────────────────────────────────────

  _detach(node) {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this._head === node) this._head = node.next;
    if (this._tail === node) this._tail = node.prev;
    node.prev = node.next = null;
  }

  _prepend(node) {
    node.next = this._head;
    node.prev = null;
    if (this._head) this._head.prev = node;
    this._head = node;
    if (!this._tail) this._tail = node;
  }

  _touch(node) {
    this._detach(node);
    this._prepend(node);
  }

  _evict() {
    while (this._store.size > this.maxSize && this._tail) {
      const victim = this._tail;
      this._detach(victim);
      this._store.delete(victim.key);
      this.emit('evict', victim.key, victim.value);
    }
  }

  _cleanExpired() {
    // Lazy expiry: check on access; also periodic sweep on tail
    if (this._tail && this._tail.isExpired()) {
      const key = this._tail.key;
      this._detach(this._tail);
      this._store.delete(key);
    }
  }

  // ─ SET / GET / DEL ─────────────────────────────────────────────────────────

  /**
   * Set a key.
   * @param {string} key
   * @param {*}      value
   * @param {object} [opts]
   * @param {number}  [opts.ttl] - TTL in milliseconds
   * @param {boolean} [opts.nx]  - only set if not exists (SETNX)
   * @param {boolean} [opts.xx]  - only set if exists
   * @returns {boolean} true if set
   */
  async set(key, value, opts = {}) {
    const existing = this._store.get(key);
    if (opts.nx && existing && !existing.isExpired()) return false;
    if (opts.xx && (!existing || existing.isExpired())) return false;

    const expiry = opts.ttl ? Date.now() + opts.ttl : 0;
    let node;
    if (existing) {
      existing.value = value;
      existing.ttl   = expiry;
      existing.version++;
      node = existing;
      this._touch(node);
    } else {
      node = new LRUNode(key, value, expiry);
      this._store.set(key, node);
      this._prepend(node);
      this._evict();
    }

    this._wal?.append('SET', key, value, expiry);
    return true;
  }

  /**
   * Get a key value.
   * @param {string} key
   * @returns {*} value or null
   */
  async get(key) {
    this._cleanExpired();
    const node = this._store.get(key);
    if (!node || node.isExpired()) {
      if (node) { this._detach(node); this._store.delete(key); }
      return null;
    }
    this._touch(node);
    return node.value;
  }

  /**
   * Delete a key.
   * @param {string} key
   * @returns {number} 1 if deleted, 0 if not found
   */
  async del(key) {
    const node = this._store.get(key);
    if (!node) return 0;
    this._detach(node);
    this._store.delete(key);
    this._wal?.append('DEL', key);
    return 1;
  }

  /**
   * Check existence (respects TTL).
   * @param {string} key
   * @returns {boolean}
   */
  async exists(key) {
    return (await this.get(key)) !== null;
  }

  /**
   * Set TTL on existing key.
   * @param {string} key
   * @param {number} ms
   * @returns {boolean}
   */
  async expire(key, ms) {
    const node = this._store.get(key);
    if (!node || node.isExpired()) return false;
    node.ttl = Date.now() + ms;
    return true;
  }

  /**
   * Remaining TTL in ms. -1 = no TTL, -2 = not found/expired.
   * @param {string} key
   * @returns {number}
   */
  async ttl(key) {
    const node = this._store.get(key);
    if (!node || node.isExpired()) return -2;
    if (node.ttl === 0) return -1;
    return Math.max(0, node.ttl - Date.now());
  }

  // ─ Atomic operations ───────────────────────────────────────────────────────

  /**
   * Increment integer value.
   * @param {string} key
   * @param {number} [by=1]
   * @returns {number} new value
   */
  async incr(key, by = 1) {
    const node = this._store.get(key);
    const cur  = (node && !node.isExpired()) ? (Number(node.value) || 0) : 0;
    const next = cur + by;
    await this.set(key, next);
    this._wal?.append('INCR', key, by);
    return next;
  }

  /**
   * Decrement integer value.
   * @param {string} key
   * @param {number} [by=1]
   * @returns {number} new value
   */
  async decr(key, by = 1) {
    return this.incr(key, -by);
  }

  /**
   * Append string to value.
   * @param {string} key
   * @param {string} str
   * @returns {number} new length
   */
  async append(key, str) {
    const cur  = (await this.get(key)) ?? '';
    const next = String(cur) + str;
    await this.set(key, next);
    return next.length;
  }

  // ─ Key scanning ────────────────────────────────────────────────────────────

  /**
   * Return all keys matching a glob pattern.
   * @param {string} [pattern='*']
   * @returns {Array<string>}
   */
  async keys(pattern = '*') {
    const regex = globToRegex(pattern);
    const result = [];
    for (const [k, node] of this._store) {
      if (!node.isExpired() && regex.test(k)) result.push(k);
    }
    return result;
  }

  /**
   * Scan keys matching pattern (cursor-based, like Redis SCAN).
   * @param {number} cursor    - 0 to start
   * @param {string} [pattern='*']
   * @param {number} [count=100]
   * @returns {{ cursor:number, keys:Array<string> }}
   */
  async scan(cursor, pattern = '*', count = 100) {
    const all   = await this.keys(pattern);
    const chunk = all.slice(cursor, cursor + count);
    const next  = cursor + count >= all.length ? 0 : cursor + count;
    return { cursor: next, keys: chunk };
  }

  // ─ Pub/Sub ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a channel.
   * @param {string}   channel
   * @param {Function} handler  - called with (message, channel)
   */
  subscribe(channel, handler) {
    if (!this._subs.has(channel)) this._subs.set(channel, new Set());
    this._subs.get(channel).add(handler);
    return () => this.unsubscribe(channel, handler); // returns unsubscribe fn
  }

  /**
   * Unsubscribe from a channel.
   * @param {string}   channel
   * @param {Function} handler
   */
  unsubscribe(channel, handler) {
    const subs = this._subs.get(channel);
    if (subs) subs.delete(handler);
  }

  /**
   * Publish a message to a channel.
   * @param {string} channel
   * @param {*}      message
   * @returns {number} subscriber count reached
   */
  publish(channel, message) {
    const subs = this._subs.get(channel);
    if (!subs) return 0;
    let count = 0;
    for (const handler of subs) {
      try { handler(message, channel); } catch { /* isolate subscriber errors */ }
      count++;
    }
    this.emit('publish', channel, message);
    return count;
  }

  // ─ Sorted Sets ─────────────────────────────────────────────────────────────

  _getZSet(key, create = false) {
    if (!this._zsets.has(key)) {
      if (!create) return null;
      this._zsets.set(key, new ZSet());
    }
    return this._zsets.get(key);
  }

  /** @returns {number} new score */
  async zadd(key, member, score) {
    this._getZSet(key, true).zadd(member, score);
    this._wal?.append('ZADD', key, { member, score });
    return score;
  }

  /** @returns {number|null} */
  async zscore(key, member) { return this._getZSet(key)?.zscore(member) ?? null; }

  /** @returns {number} new score */
  async zincrby(key, member, delta) {
    return this._getZSet(key, true).zincrby(member, delta);
  }

  /** @returns {number} 0-indexed rank ascending */
  async zrank(key, member) { return this._getZSet(key)?.zrank(member) ?? null; }

  /** @returns {number} 0-indexed rank descending */
  async zrevrank(key, member) { return this._getZSet(key)?.zrevrank(member) ?? null; }

  /** Top N members by score descending. */
  async ztop(key, n = 10) {
    const z = this._getZSet(key);
    if (!z) return [];
    const all = z.zrange(0, -1, true);
    return all.slice(-n).reverse();
  }

  /** Range by rank. */
  async zrange(key, start, stop, withScores = false) {
    return this._getZSet(key)?.zrange(start, stop, withScores) ?? [];
  }

  /** Range by score. */
  async zrangebyscore(key, min, max) {
    return this._getZSet(key)?.zrangebyscore(min, max) ?? [];
  }

  /** @returns {number} 1 if removed */
  async zrem(key, member) {
    const z = this._getZSet(key);
    if (!z) return 0;
    const r = z.zrem(member);
    this._wal?.append('ZREM', key, member);
    return r;
  }

  /** @returns {number} cardinality */
  async zcard(key) { return this._getZSet(key)?.zcard() ?? 0; }

  // ─ Snapshots ───────────────────────────────────────────────────────────────

  /**
   * Take a snapshot to disk.
   */
  async snapshot() {
    if (!this.dataDir) return;
    const snapshotPath = path.join(this.dataDir, 'snapshot.json');

    const kvEntries = [];
    for (const [key, node] of this._store) {
      if (!node.isExpired()) {
        kvEntries.push({ key, value: node.value, ttl: node.ttl });
      }
    }

    const zsetEntries = {};
    for (const [key, z] of this._zsets) {
      zsetEntries[key] = z.toJSON();
    }

    const snap = { ts: Date.now(), kv: kvEntries, zsets: zsetEntries };
    try {
      await fs.promises.writeFile(snapshotPath, JSON.stringify(snap));
      this._wal?.truncate();
    } catch (err) {
      console.error('[KVStore] Snapshot failed:', err.message);
    }
  }

  /**
   * Restore from snapshot.
   */
  async _restoreSnapshot() {
    if (!this.dataDir) return;
    const snapshotPath = path.join(this.dataDir, 'snapshot.json');
    if (!fs.existsSync(snapshotPath)) return;

    try {
      const snap = JSON.parse(await fs.promises.readFile(snapshotPath, 'utf8'));

      for (const { key, value, ttl } of (snap.kv ?? [])) {
        const remaining = ttl > 0 ? ttl - Date.now() : 0;
        if (ttl > 0 && remaining <= 0) continue; // expired
        await this.set(key, value, ttl > 0 ? { ttl: remaining } : {});
      }

      for (const [key, scores] of Object.entries(snap.zsets ?? {})) {
        this._zsets.set(key, ZSet.fromJSON(scores));
      }
    } catch (err) {
      console.error('[KVStore] Restore failed:', err.message);
    }
  }

  _replayWAL() {
    if (!this._wal) return;
    const entries = this._wal.readAll();
    for (const entry of entries) {
      try {
        switch (entry.op) {
          case 'SET': {
            const remaining = entry.ttl > 0 ? entry.ttl - Date.now() : 0;
            if (entry.ttl > 0 && remaining <= 0) break;
            const node = new LRUNode(entry.key, entry.value, entry.ttl);
            this._store.set(entry.key, node);
            this._prepend(node);
            this._evict();
            break;
          }
          case 'DEL': {
            const n = this._store.get(entry.key);
            if (n) { this._detach(n); this._store.delete(entry.key); }
            break;
          }
          case 'INCR': {
            const n2 = this._store.get(entry.key);
            if (n2) n2.value = Number(n2.value) + Number(entry.value);
            break;
          }
          case 'ZADD': {
            this._getZSet(entry.key, true).zadd(entry.value.member, entry.value.score);
            break;
          }
          case 'ZREM': {
            this._getZSet(entry.key)?.zrem(entry.value);
            break;
          }
        }
      } catch { /* skip corrupt WAL entries */ }
    }
  }

  // ─ Stats & Admin ───────────────────────────────────────────────────────────

  /** @returns {number} live (non-expired) key count */
  async dbsize() {
    let count = 0;
    for (const node of this._store.values()) {
      if (!node.isExpired()) count++;
    }
    return count;
  }

  /** Flush all keys. */
  async flushall() {
    this._store.clear();
    this._head = this._tail = null;
    this._zsets.clear();
    this._wal?.append('FLUSHALL', '*');
  }

  /** @returns {object} diagnostic stats */
  stats() {
    return {
      size    : this._store.size,
      maxSize : this.maxSize,
      zsets   : this._zsets.size,
      subs    : [...this._subs.entries()].reduce((acc, [ch, s]) => { acc[ch] = s.size; return acc; }, {}),
    };
  }

  async close() {
    if (this._walTimer) { clearInterval(this._walTimer); this._walTimer = null; }
    if (this._snapTimer) { clearInterval(this._snapTimer); this._snapTimer = null; }
    await this.snapshot();
    this._wal?.close();
  }
}

export default KVStore;

'use strict';

/**
 * HeadyCache File Store
 *
 * Persistent JSON-lines store with Write-Ahead Log (WAL) for durability.
 *
 * Format:
 *   Main file: one JSON record per line { key, value, meta }
 *   WAL file: append-only operations { op:'set'|'del', key, value?, meta?, ts }
 *
 * On startup: replay WAL over main snapshot to reconstruct latest state.
 * On compaction: flush in-memory state to main file, truncate WAL.
 */

const fs = require('fs');
const path = require('path');
const { MemoryStore } = require('./memory-store');

const WAL_OP_SET = 'set';
const WAL_OP_DEL = 'del';

class FileStore {
  /**
   * @param {object} opts
   * @param {string} opts.filePath        Path to main JSON-lines file
   * @param {string} [opts.walPath]       Path to WAL file (default: filePath + '.wal')
   * @param {number} [opts.maxSize]
   * @param {number} [opts.ttl]
   * @param {boolean} [opts.slidingWindow]
   * @param {number} [opts.compactThreshold=1000] Compact after N WAL ops
   * @param {number} [opts.compactInterval=300000] Periodic compact interval (ms)
   */
  constructor(opts = {}) {
    this._filePath = opts.filePath || '/tmp/heady-cache.jsonl';
    this._walPath = opts.walPath || this._filePath + '.wal';
    this._compactThreshold = opts.compactThreshold || 1000;
    this._compactInterval = opts.compactInterval || 300000;

    // Backing in-memory store for fast reads
    this._mem = new MemoryStore({
      maxSize: opts.maxSize,
      ttl: opts.ttl,
      slidingWindow: opts.slidingWindow,
    });

    this._walOps = 0;
    this._walStream = null;
    this._ready = false;
    this._initPromise = null;
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._load();
    await this._initPromise;
    this._ready = true;

    // Periodic compaction
    this._compactTimer = setInterval(() => this._compact(), this._compactInterval);
    this._compactTimer.unref?.();
  }

  // -------------------------------------------------------------------------
  // Core interface (mirrors MemoryStore)
  // -------------------------------------------------------------------------

  async get(key) {
    await this._ensureReady();
    return this._mem.get(key);
  }

  async set(key, value, meta = {}) {
    await this._ensureReady();
    this._mem.set(key, value, meta);
    await this._walAppend({ op: WAL_OP_SET, key, value, meta, ts: Date.now() });
  }

  async delete(key) {
    await this._ensureReady();
    const existed = this._mem.delete(key);
    if (existed) await this._walAppend({ op: WAL_OP_DEL, key, ts: Date.now() });
    return existed;
  }

  async has(key) {
    await this._ensureReady();
    return this._mem.has(key);
  }

  async clear(namespace) {
    await this._ensureReady();
    this._mem.clear(namespace);
    await this._walAppend({ op: WAL_OP_DEL, key: null, namespace, ts: Date.now() });
  }

  async size(namespace) {
    await this._ensureReady();
    return this._mem.size(namespace);
  }

  async keys(namespace) {
    await this._ensureReady();
    return this._mem.keys(namespace);
  }

  async entries(namespace) {
    await this._ensureReady();
    return this._mem.entries(namespace);
  }

  byteSize() {
    return this._mem.byteSize();
  }

  async getMeta(key) {
    await this._ensureReady();
    return this._mem.getMeta(key);
  }

  async touch(key, ttl) {
    await this._ensureReady();
    return this._mem.touch(key, ttl);
  }

  evictLru(n) { return this._mem.evictLru(n); }
  evictLfu(n) { return this._mem.evictLfu(n); }
  evictExpired() { return this._mem.evictExpired(); }

  async close() {
    clearInterval(this._compactTimer);
    await this._compact();
    if (this._walStream) {
      await new Promise((res) => this._walStream.end(res));
    }
    this._mem.close();
  }

  // -------------------------------------------------------------------------
  // WAL & persistence
  // -------------------------------------------------------------------------

  async _load() {
    // Ensure directories exist
    fs.mkdirSync(path.dirname(this._filePath), { recursive: true });

    // Load main snapshot
    await this._loadSnapshot();

    // Replay WAL
    await this._replayWal();

    // Open WAL for appending
    this._walStream = fs.createWriteStream(this._walPath, { flags: 'a' });
  }

  async _loadSnapshot() {
    if (!fs.existsSync(this._filePath)) return;
    let lines;
    try {
      lines = fs.readFileSync(this._filePath, 'utf8').split('\n');
    } catch (e) {
      return; // corrupted snapshot — start fresh
    }
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const rec = JSON.parse(trimmed);
        if (rec && rec.key) this._mem.set(rec.key, rec.value, rec.meta || {});
      } catch {
        // skip corrupt lines
      }
    }
  }

  async _replayWal() {
    if (!fs.existsSync(this._walPath)) return;
    let lines;
    try {
      lines = fs.readFileSync(this._walPath, 'utf8').split('\n');
    } catch {
      return;
    }
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const op = JSON.parse(trimmed);
        if (op.op === WAL_OP_SET && op.key) {
          this._mem.set(op.key, op.value, op.meta || {});
        } else if (op.op === WAL_OP_DEL) {
          if (op.key) this._mem.delete(op.key);
          else if (op.namespace) this._mem.clear(op.namespace);
        }
      } catch {
        // skip corrupt WAL entries
      }
    }
  }

  async _walAppend(op) {
    if (!this._walStream) return;
    const line = JSON.stringify(op) + '\n';
    await new Promise((resolve, reject) => {
      this._walStream.write(line, (err) => (err ? reject(err) : resolve()));
    });
    this._walOps++;
    if (this._walOps >= this._compactThreshold) {
      setImmediate(() => this._compact());
    }
  }

  async _compact() {
    if (!this._ready) return;
    try {
      const tmpPath = this._filePath + '.tmp';
      const entries = this._mem.entries();
      const lines = entries.map(([key, { value, meta }]) =>
        JSON.stringify({ key, value, meta })
      );

      fs.writeFileSync(tmpPath, lines.join('\n') + '\n', 'utf8');
      fs.renameSync(tmpPath, this._filePath);

      // Truncate WAL
      if (this._walStream) {
        await new Promise((res) => this._walStream.end(res));
      }
      fs.writeFileSync(this._walPath, '', 'utf8');
      this._walStream = fs.createWriteStream(this._walPath, { flags: 'a' });
      this._walOps = 0;
    } catch (e) {
      // Non-fatal — will retry on next compact cycle
    }
  }

  async _ensureReady() {
    if (!this._ready) await this.init();
  }
}

module.exports = { FileStore };

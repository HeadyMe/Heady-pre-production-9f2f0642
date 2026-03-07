/**
 * @fileoverview Short-Term / Long-Term Memory Consolidation
 * Biologically-inspired dual-memory system.
 *
 * Architecture:
 *   STM  — ring buffer with PHI-decay function (fast, volatile)
 *   LTM  — persistent store with importance scoring I(m)
 *   Consolidation — periodic STM→LTM migration
 *   Forgetting curve — exponential decay (Ebbinghaus) for unused memories
 *   Dream cycle — background process that strengthens important connections
 *
 * PHI (φ = 1.618…) governs:
 *   - STM decay rate
 *   - LTM consolidation threshold
 *   - Dream cycle interval scaling
 *
 * Node.js built-ins only: fs, path, events, crypto
 */

import fs    from 'node:fs';
import path  from 'node:path';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { cosineSimilarity } from './vector-db.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;

/** STM ring buffer default size */
const DEFAULT_STM_SIZE = 89; // Fibonacci(11)

/** STM decay half-life in ms (PHI^10 ≈ 123 s) */
const STM_DECAY_HALFLIFE_MS = Math.round(1000 * Math.pow(PHI, 10)); // ~122 966 ms

/** LTM importance threshold for consolidation (PHI-scaled) */
const CONSOLIDATION_THRESHOLD = 1 / PHI; // ~0.618

/** Dream cycle base interval (ms) — PHI^12 ≈ 521 s */
const DREAM_BASE_INTERVAL_MS = Math.round(1000 * Math.pow(PHI, 12)); // ~521 498 ms

/** Forgetting curve: decay rate k in I(t) = I₀ * e^(-k*t) — PHI-scaled */
const FORGETTING_K = Math.log(PHI) / (3600 * 1000); // half of importance lost in ~2.26 h

// ─── Memory entry ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} MemoryEntry
 * @property {string}  id
 * @property {string}  content          - text content
 * @property {Float32Array|null} vector - embedding
 * @property {number}  importance       - I(m) ∈ [0, 1]
 * @property {number}  accessCount
 * @property {number}  createdAt        - epoch ms
 * @property {number}  lastAccessedAt   - epoch ms
 * @property {object}  metadata
 * @property {string}  [source]         - 'stm'|'ltm'
 */

// ─── STM Ring Buffer ──────────────────────────────────────────────────────────

/**
 * Volatile short-term memory with PHI-decay importance scoring.
 */
class STM {
  /**
   * @param {object} opts
   * @param {number} [opts.size=89]    - ring buffer capacity
   * @param {number} [opts.halfLife]   - decay half-life ms
   */
  constructor(opts = {}) {
    this.size     = opts.size     ?? DEFAULT_STM_SIZE;
    this.halfLife = opts.halfLife ?? STM_DECAY_HALFLIFE_MS;

    /** @type {Array<MemoryEntry|null>} */
    this._ring   = new Array(this.size).fill(null);
    this._head   = 0; // next write position
    this._count  = 0;

    /** @type {Map<string, number>} id → ring index */
    this._index = new Map();
  }

  /**
   * PHI-scaled exponential decay: importance drops as I₀ / (1 + (t/halfLife)^φ)
   * @param {number} initialImportance
   * @param {number} ageMs
   * @returns {number}
   */
  _decay(initialImportance, ageMs) {
    const ratio = ageMs / this.halfLife;
    return initialImportance / (1 + Math.pow(ratio, PHI));
  }

  /**
   * Add a memory to STM.
   * @param {MemoryEntry} entry
   */
  write(entry) {
    // Remove old slot if id already exists
    if (this._index.has(entry.id)) {
      const oldIdx = this._index.get(entry.id);
      this._ring[oldIdx] = null;
    }

    const slot = this._head % this.size;
    const evicted = this._ring[slot];
    if (evicted) this._index.delete(evicted.id);

    this._ring[slot] = { ...entry, source: 'stm' };
    this._index.set(entry.id, slot);
    this._head = (this._head + 1) % this.size;
    this._count = Math.min(this._count + 1, this.size);
  }

  /**
   * Get a memory, returning null if it doesn't exist or has fully decayed.
   * @param {string} id
   * @returns {MemoryEntry|null}
   */
  read(id) {
    const idx  = this._index.get(id);
    if (idx === undefined) return null;
    const entry = this._ring[idx];
    if (!entry) return null;

    const ageMs = Date.now() - entry.createdAt;
    const decayed = this._decay(entry.importance, ageMs);
    if (decayed < 0.01) { // effectively forgotten
      this._ring[idx] = null;
      this._index.delete(id);
      return null;
    }

    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    return { ...entry, importance: decayed };
  }

  /**
   * Return all live (non-decayed) memories, sorted by current importance descending.
   * @returns {Array<MemoryEntry>}
   */
  getAll() {
    const now    = Date.now();
    const result = [];
    for (const entry of this._ring) {
      if (!entry) continue;
      const ageMs  = now - entry.createdAt;
      const decayed = this._decay(entry.importance, ageMs);
      if (decayed >= 0.01) result.push({ ...entry, importance: decayed });
    }
    result.sort((a, b) => b.importance - a.importance);
    return result;
  }

  /**
   * Return memories above the consolidation threshold.
   * @param {number} [threshold]
   * @returns {Array<MemoryEntry>}
   */
  getConsolidationCandidates(threshold = CONSOLIDATION_THRESHOLD) {
    return this.getAll().filter(m => m.importance >= threshold);
  }

  /** @returns {number} live entry count */
  get liveCount() { return this.getAll().length; }

  /** Clear all STM entries */
  clear() {
    this._ring.fill(null);
    this._index.clear();
    this._head  = 0;
    this._count = 0;
  }
}

// ─── LTM Store ────────────────────────────────────────────────────────────────

/**
 * Persistent long-term memory with Ebbinghaus forgetting curve.
 */
class LTM {
  /**
   * @param {object} opts
   * @param {string}  [opts.dataDir]
   * @param {number}  [opts.maxSize=100000]
   */
  constructor(opts = {}) {
    this.dataDir = opts.dataDir ?? null;
    this.maxSize = opts.maxSize ?? 100_000;

    /** @type {Map<string, MemoryEntry>} */
    this._store = new Map();

    this._dirty     = false;
    this._saveTimer = null;
  }

  async init() {
    if (this.dataDir) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      await this._load();
    }
  }

  /**
   * Importance scoring function: I(m) = freq * recency * baseImportance
   * where recency = e^(-k * age_ms) and k = FORGETTING_K
   * @param {MemoryEntry} m
   * @returns {number}
   */
  _importance(m) {
    const ageMs    = Date.now() - m.lastAccessedAt;
    const recency  = Math.exp(-FORGETTING_K * ageMs);
    const freqScore = Math.log1p(m.accessCount) / Math.log1p(100); // normalize to [0,1]
    return m.importance * recency * (1 + freqScore) / 2;
  }

  /**
   * Write a memory to LTM. Updates if already exists.
   * @param {MemoryEntry} entry
   */
  store(entry) {
    const existing = this._store.get(entry.id);
    if (existing) {
      // Merge: boost importance, keep max access count
      existing.importance   = Math.min(1, existing.importance + entry.importance * (1 / PHI));
      existing.accessCount += entry.accessCount;
      existing.lastAccessedAt = Date.now();
      existing.updatedAt      = Date.now();
      if (entry.vector) existing.vector = entry.vector;
    } else {
      this._store.set(entry.id, { ...entry, source: 'ltm', updatedAt: Date.now() });
    }

    // Evict lowest-importance entries if over capacity
    if (this._store.size > this.maxSize) this._evict();
    this._markDirty();
  }

  /**
   * Retrieve a memory by id.
   * @param {string} id
   * @returns {MemoryEntry|null}
   */
  retrieve(id) {
    const m = this._store.get(id);
    if (!m) return null;
    m.accessCount++;
    m.lastAccessedAt = Date.now();
    this._markDirty();
    return m;
  }

  /**
   * Search LTM by vector similarity.
   * @param {Float32Array} queryVec
   * @param {number} [k=10]
   * @param {number} [threshold=0.5]
   * @returns {Array<{entry:MemoryEntry, score:number}>}
   */
  searchByVector(queryVec, k = 10, threshold = 0.5) {
    const results = [];
    for (const m of this._store.values()) {
      if (!m.vector) continue;
      const sim = cosineSimilarity(queryVec, m.vector);
      if (sim >= threshold) results.push({ entry: m, score: sim });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  /**
   * Return top N memories by current importance.
   * @param {number} [n=20]
   * @returns {Array<MemoryEntry>}
   */
  getTopN(n = 20) {
    const all = [...this._store.values()].map(m => ({ m, score: this._importance(m) }));
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, n).map(x => x.m);
  }

  /**
   * Forget memories below a dynamic importance threshold.
   * Runs as part of the dream cycle.
   * @param {number} [minImportance=0.01]
   * @returns {number} count of forgotten memories
   */
  applyForgettingCurve(minImportance = 0.01) {
    let forgotten = 0;
    for (const [id, m] of this._store) {
      const score = this._importance(m);
      if (score < minImportance) {
        this._store.delete(id);
        forgotten++;
      }
    }
    if (forgotten > 0) this._markDirty();
    return forgotten;
  }

  _evict() {
    const sorted = [...this._store.entries()].map(([id, m]) => ({ id, score: this._importance(m) }));
    sorted.sort((a, b) => a.score - b.score);
    const toRemove = sorted.slice(0, Math.ceil(this._store.size * (1 - 1 / PHI)));
    for (const { id } of toRemove) this._store.delete(id);
  }

  _markDirty() {
    this._dirty = true;
    if (this.dataDir && !this._saveTimer) {
      this._saveTimer = setTimeout(() => { this._saveTimer = null; this.save(); }, 5000);
    }
  }

  async save() {
    if (!this.dataDir || !this._dirty) return;
    this._dirty = false;
    const entries = [...this._store.values()].map(m => ({
      ...m,
      vector: m.vector ? Array.from(m.vector) : null,
    }));
    const fp = path.join(this.dataDir, 'ltm.json');
    await fs.promises.writeFile(fp, JSON.stringify({ version: 1, ts: Date.now(), entries }));
  }

  async _load() {
    const fp = path.join(this.dataDir, 'ltm.json');
    if (!fs.existsSync(fp)) return;
    try {
      const data = JSON.parse(await fs.promises.readFile(fp, 'utf8'));
      for (const m of (data.entries ?? [])) {
        m.vector = m.vector ? new Float32Array(m.vector) : null;
        this._store.set(m.id, m);
      }
    } catch (err) {
      console.error('[LTM] Load failed:', err.message);
    }
  }

  async close() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    await this.save();
  }

  get size() { return this._store.size; }
}

// ─── MemoryConsolidator (Dream Cycle) ─────────────────────────────────────────

/**
 * Background dream cycle: moves memories from STM → LTM and strengthens
 * important connections.
 *
 * @extends EventEmitter
 * @emits 'consolidate' { moved: number, forgotten: number }
 * @emits 'dream'       { strengthened: number }
 */
export class MemoryConsolidator extends EventEmitter {
  /**
   * @param {object} opts
   * @param {STM}    opts.stm
   * @param {LTM}    opts.ltm
   * @param {number} [opts.intervalMs]    - consolidation interval
   * @param {number} [opts.dreamInterval] - dream cycle interval
   * @param {number} [opts.threshold]     - STM importance threshold
   */
  constructor(opts) {
    super();
    this.stm          = opts.stm;
    this.ltm          = opts.ltm;
    this.intervalMs   = opts.intervalMs   ?? Math.round(1000 * PHI * PHI * PHI * PHI); // ~6.85s
    this.dreamInterval= opts.dreamInterval?? DREAM_BASE_INTERVAL_MS;
    this.threshold    = opts.threshold    ?? CONSOLIDATION_THRESHOLD;

    this._consolidateTimer = null;
    this._dreamTimer       = null;
    this._dreamCount       = 0;
  }

  /** Start background consolidation and dream cycles. */
  start() {
    this._consolidateTimer = setInterval(() => this.consolidate(), this.intervalMs);
    this._consolidateTimer.unref?.();

    // Dream cycle runs at PHI-scaled intervals after the first consolidation
    this._scheduleDream();
  }

  _scheduleDream() {
    // Interval grows as PHI^dreamCount to slow down over time
    const delay = this.dreamInterval * Math.pow(PHI, Math.min(this._dreamCount, 4));
    this._dreamTimer = setTimeout(() => {
      this.dream();
      this._dreamCount++;
      this._scheduleDream();
    }, delay);
    this._dreamTimer.unref?.();
  }

  /** Stop background processes. */
  stop() {
    if (this._consolidateTimer) { clearInterval(this._consolidateTimer); this._consolidateTimer = null; }
    if (this._dreamTimer)       { clearTimeout(this._dreamTimer);        this._dreamTimer       = null; }
  }

  /**
   * Run one consolidation pass: move high-importance STM → LTM.
   * @returns {{ moved: number }}
   */
  consolidate() {
    const candidates = this.stm.getConsolidationCandidates(this.threshold);
    let moved = 0;

    for (const entry of candidates) {
      this.ltm.store(entry);
      moved++;
    }

    this.emit('consolidate', { moved });
    return { moved };
  }

  /**
   * Dream cycle: apply forgetting curve + strengthen top LTM memories.
   * Strengthening: boost importance of top memories by 1/PHI of their current value.
   * @returns {{ strengthened: number, forgotten: number }}
   */
  dream() {
    const forgotten = this.ltm.applyForgettingCurve();

    // Strengthen top memories
    const top         = this.ltm.getTopN(Math.round(PHI * 13)); // ~21
    let   strengthened = 0;
    for (const m of top) {
      m.importance = Math.min(1, m.importance * (1 + 1 / PHI));
      m.accessCount++;
      strengthened++;
    }

    this.emit('dream', { strengthened, forgotten });
    return { strengthened, forgotten };
  }
}

// ─── STMLTM — Main export ─────────────────────────────────────────────────────

/**
 * Unified STM/LTM memory system.
 *
 * @example
 * const mem = new STMLTM({ dataDir: './data/memory' });
 * await mem.init();
 * await mem.remember({ content: 'Heady processes tokens', importance: 0.9 });
 * const related = await mem.recall(queryVec, { from: 'both', k: 5 });
 */
export class STMLTM {
  /**
   * @param {object} opts
   * @param {string}  [opts.dataDir]
   * @param {number}  [opts.stmSize]
   * @param {boolean} [opts.autoDream=true]
   */
  constructor(opts = {}) {
    this.dataDir  = opts.dataDir  ?? null;

    this.stm = new STM({ size: opts.stmSize ?? DEFAULT_STM_SIZE });
    this.ltm = new LTM({ dataDir: this.dataDir ? path.join(this.dataDir, 'ltm') : null });

    this.consolidator = new MemoryConsolidator({ stm: this.stm, ltm: this.ltm });
    this._autoDream   = opts.autoDream ?? true;
  }

  async init() {
    await this.ltm.init();
    if (this._autoDream) this.consolidator.start();
  }

  /**
   * Store a new memory (always goes to STM first).
   * @param {object}              props
   * @param {string}              props.content
   * @param {Float32Array|number[]|null} [props.vector]
   * @param {number}              [props.importance=0.5]
   * @param {object}              [props.metadata]
   * @param {string}              [props.id]
   * @returns {string} memory id
   */
  async remember(props) {
    const id      = props.id ?? crypto.randomUUID();
    const vector  = props.vector
      ? (props.vector instanceof Float32Array ? props.vector : new Float32Array(props.vector))
      : null;
    const entry = {
      id,
      content       : props.content ?? '',
      vector,
      importance    : props.importance   ?? 0.5,
      accessCount   : 0,
      createdAt     : Date.now(),
      lastAccessedAt: Date.now(),
      metadata      : props.metadata ?? {},
    };
    this.stm.write(entry);
    return id;
  }

  /**
   * Recall memory by id from STM or LTM.
   * @param {string} id
   * @returns {MemoryEntry|null}
   */
  async recall(id) {
    return this.stm.read(id) ?? this.ltm.retrieve(id);
  }

  /**
   * Search memories by vector similarity.
   * @param {Float32Array|number[]} queryVec
   * @param {object} [opts]
   * @param {'stm'|'ltm'|'both'} [opts.from='both']
   * @param {number}              [opts.k=10]
   * @param {number}              [opts.threshold=0.5]
   * @returns {Array<{entry:MemoryEntry, score:number, source:string}>}
   */
  async searchByVector(queryVec, opts = {}) {
    const vec       = queryVec instanceof Float32Array ? queryVec : new Float32Array(queryVec);
    const from      = opts.from      ?? 'both';
    const k         = opts.k         ?? 10;
    const threshold = opts.threshold ?? 0.5;

    let results = [];

    if (from === 'stm' || from === 'both') {
      const stmEntries = this.stm.getAll().filter(m => m.vector);
      for (const m of stmEntries) {
        const sim = cosineSimilarity(vec, m.vector);
        if (sim >= threshold) results.push({ entry: m, score: sim, source: 'stm' });
      }
    }

    if (from === 'ltm' || from === 'both') {
      const ltmResults = this.ltm.searchByVector(vec, k * 2, threshold);
      results.push(...ltmResults.map(r => ({ ...r, source: 'ltm' })));
    }

    // Deduplicate by id, prefer higher score
    const seen = new Map();
    for (const r of results) {
      if (!seen.has(r.entry.id) || r.score > seen.get(r.entry.id).score) {
        seen.set(r.entry.id, r);
      }
    }

    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, k);
  }

  /**
   * Force immediate consolidation + dream cycle.
   * @returns {{ moved: number, strengthened: number, forgotten: number }}
   */
  async consolidate() {
    const { moved }               = this.consolidator.consolidate();
    const { strengthened, forgotten } = this.consolidator.dream();
    return { moved, strengthened, forgotten };
  }

  async close() {
    this.consolidator.stop();
    await this.ltm.close();
  }

  stats() {
    return {
      stm: { liveCount: this.stm.liveCount, capacity: this.stm.size },
      ltm: { size: this.ltm.size },
    };
  }
}

export default STMLTM;

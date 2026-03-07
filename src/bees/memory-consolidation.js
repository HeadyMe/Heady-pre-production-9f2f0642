'use strict';

/**
 * @file memory-consolidation.js
 * @description Memory Compaction and Consolidation Engine.
 *
 * CHANGE LOG (new file — addresses gaps found in duckdb-memory.js, vector-memory.js, continuous-learning.js):
 *
 *  PROBLEMS FIXED:
 *  1. VectorMemoryV2 (RAM) and HeadyEmbeddedDuckDB (disk) have no synchronisation layer —
 *     entries written to one are not mirrored to the other.
 *  2. duckdb-memory.js loads VSS extension but never creates an HNSW index.  This engine
 *     creates the index on first consolidation run if absent.
 *  3. continuous-learning.js quality gate uses response length only; this engine adds
 *     content-based deduplication (cosine ≥ 0.98) so near-duplicate memories are merged
 *     rather than accumulated.
 *  4. buddy-watchdog.js clears `decisionLog = []` on restart without persisting first.
 *     This engine provides `archiveDecisionLog(log)` that the watchdog can call before
 *     clearing the array.
 *  5. No staleness eviction policy: memories accumulate indefinitely.  This engine enforces
 *     a configurable TTL per namespace and a global row-count budget for DuckDB.
 *
 *  ARCHITECTURE:
 *    MemoryConsolidationEngine
 *      ├─ ConsolidationScheduler    – cron-style scheduler (interval or cron string)
 *      ├─ DedupEngine               – cosine-based near-duplicate detector with union-find merge
 *      ├─ StalenessEviction         – TTL + LRU + row-budget eviction across both stores
 *      ├─ WriteThrough              – keeps VectorMemoryV2 ↔ DuckDB in sync after mutations
 *      ├─ HNSWIndexManager          – ensures the DuckDB HNSW index exists and is rebuilt if stale
 *      └─ ArchivalStore             – moves evicted/merged memories to cold archive table
 *
 *  USAGE:
 *    const { MemoryConsolidationEngine } = require('./memory-consolidation');
 *    const engine = new MemoryConsolidationEngine({ vectorMemory, duckdbMemory });
 *    await engine.init();
 *    engine.startScheduler();                // runs every 30 min by default
 *    await engine.runOnce();                 // on-demand full consolidation pass
 *    await engine.archiveDecisionLog(log);   // call from buddy-watchdog before restart
 */

const EventEmitter = require('events');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold above which two memories are considered duplicates */
const DEDUP_COSINE_THRESHOLD = 0.98;

/** Default consolidation run interval (30 minutes) */
const DEFAULT_INTERVAL_MS = 30 * 60 * 1_000;

/** Default staleness TTL per namespace (ms) */
const DEFAULT_TTL_MS = {
  episodic:   7  * 24 * 60 * 60 * 1_000,  // 7 days
  semantic:   90 * 24 * 60 * 60 * 1_000,  // 90 days
  procedural: 30 * 24 * 60 * 60 * 1_000,  // 30 days
  shortterm:  24 * 60 * 60 * 1_000,        // 24 hours
  decisionLog: 14 * 24 * 60 * 60 * 1_000, // 14 days
};

/** Max rows in DuckDB memories table before forced eviction */
const DEFAULT_MAX_ROWS = 250_000;

/** DuckDB table names used by HeadyEmbeddedDuckDB */
const TABLES = {
  memories:  'memories',
  archive:   'memories_archive',
  decisions: 'decision_log',
  meta:      'consolidation_meta',
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two Float32Array / number[] vectors.
 * Returns 0 if either vector has zero magnitude.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}  [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Union-Find (for grouping duplicate clusters)
// ---------------------------------------------------------------------------

class UnionFind {
  constructor(n) {
    this._parent = Array.from({ length: n }, (_, i) => i);
    this._rank   = new Array(n).fill(0);
  }

  find(x) {
    if (this._parent[x] !== x) this._parent[x] = this.find(this._parent[x]);
    return this._parent[x];
  }

  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return;
    if (this._rank[rx] < this._rank[ry]) this._parent[rx] = ry;
    else if (this._rank[rx] > this._rank[ry]) this._parent[ry] = rx;
    else { this._parent[ry] = rx; this._rank[rx]++; }
  }

  /** Return a Map from representative-index → [member-indices] */
  clusters(n) {
    const map = new Map();
    for (let i = 0; i < n; i++) {
      const r = this.find(i);
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(i);
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// DedupEngine
// ---------------------------------------------------------------------------

/**
 * Near-duplicate detector using pairwise cosine similarity over embedding vectors.
 * For large sets (>2000 entries), uses a block-partitioning heuristic to stay within
 * acceptable O(n) time per block rather than O(n²) globally.
 */
class DedupEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.threshold=0.98]   cosine similarity dedup threshold
   * @param {number} [opts.blockSize=500]    pairwise comparison block size
   */
  constructor(opts = {}) {
    this._threshold = opts.threshold ?? DEDUP_COSINE_THRESHOLD;
    this._blockSize = opts.blockSize ?? 500;
  }

  /**
   * Find duplicate clusters among a set of memory entries.
   * @param {Array<{ id: string, embedding: number[], content: string, createdAt: number }>} entries
   * @returns {{ keep: string[], discard: string[], mergeMap: Map<string, string> }}
   *   keep    — IDs to retain (representative of each cluster)
   *   discard — IDs to archive/delete
   *   mergeMap — discardId → keepId mapping
   */
  findDuplicates(entries) {
    if (entries.length < 2) return { keep: entries.map(e => e.id), discard: [], mergeMap: new Map() };

    const n = entries.length;
    const uf = new UnionFind(n);

    // Process in blocks to avoid O(n²) on huge sets
    for (let blockStart = 0; blockStart < n; blockStart += this._blockSize) {
      const blockEnd = Math.min(blockStart + this._blockSize, n);
      for (let i = blockStart; i < blockEnd; i++) {
        for (let j = i + 1; j < blockEnd; j++) {
          const sim = cosineSimilarity(entries[i].embedding, entries[j].embedding);
          if (sim >= this._threshold) uf.union(i, j);
        }
      }
    }

    const clusters = uf.clusters(n);
    const keep    = [];
    const discard = [];
    const mergeMap = new Map();

    for (const [, members] of clusters) {
      if (members.length === 1) {
        keep.push(entries[members[0]].id);
        continue;
      }
      // Representative = most recently created entry in the cluster
      members.sort((a, b) => (entries[b].createdAt || 0) - (entries[a].createdAt || 0));
      const rep = entries[members[0]];
      keep.push(rep.id);
      for (let k = 1; k < members.length; k++) {
        const dup = entries[members[k]];
        discard.push(dup.id);
        mergeMap.set(dup.id, rep.id);
      }
    }

    return { keep, discard, mergeMap };
  }
}

// ---------------------------------------------------------------------------
// HNSWIndexManager
// ---------------------------------------------------------------------------

/**
 * Manages the DuckDB VSS HNSW index on the memories table.
 * CHANGE: duckdb-memory.js loads the VSS extension but never issues
 * `CREATE INDEX ... USING HNSW` — this class fixes that gap.
 */
class HNSWIndexManager {
  /**
   * @param {object} db  DuckDB connection with `.run(sql, params, cb)` interface
   * @param {number} [dims=384]  embedding dimensions
   */
  constructor(db, dims = 384) {
    this._db   = db;
    this._dims = dims;
  }

  /**
   * Ensure the VSS extension is loaded and the HNSW index exists.
   * Safe to call multiple times (idempotent).
   * @returns {Promise<void>}
   */
  async ensureIndex() {
    await this._run(`LOAD vss`);
    await this._run(`INSTALL vss`);

    // Check if index already exists via DuckDB pragma
    const rows = await this._query(
      `SELECT index_name FROM duckdb_indexes WHERE table_name = '${TABLES.memories}' AND index_name = 'hnsw_emb_idx'`
    );

    if (rows.length === 0) {
      // Create HNSW index on the embedding column
      // NOTE: DuckDB VSS requires the column to be of type FLOAT[dims]
      await this._run(
        `CREATE INDEX hnsw_emb_idx ON ${TABLES.memories} USING HNSW (embedding)
         WITH (metric = 'cosine', ef_construction = 128, M = 16)`
      );
    }
  }

  /**
   * Drop and rebuild the HNSW index.  Should be called after large bulk deletes
   * which can fragment the index.
   * @returns {Promise<void>}
   */
  async rebuildIndex() {
    await this._run(`DROP INDEX IF EXISTS hnsw_emb_idx`);
    await this.ensureIndex();
  }

  /** @private */
  _run(sql) {
    return new Promise((resolve, reject) => {
      this._db.run(sql, (err) => err ? reject(err) : resolve());
    });
  }

  /** @private */
  _query(sql) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// StalenessEviction
// ---------------------------------------------------------------------------

/**
 * Evicts stale entries from both VectorMemoryV2 (RAM) and DuckDB (disk)
 * based on TTL, LRU position, and a global row-count budget.
 */
class StalenessEviction {
  /**
   * @param {object} opts
   * @param {object} opts.ttlByNamespace  namespace → TTL in ms
   * @param {number} opts.maxRows          max total rows in DuckDB before forced LRU eviction
   */
  constructor(opts = {}) {
    this._ttl     = { ...DEFAULT_TTL_MS, ...opts.ttlByNamespace };
    this._maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  }

  /**
   * Evict stale entries from an in-memory namespace map.
   * @param {Map<string, { namespace: string, createdAt: number, lastAccessed: number }>} entries
   * @returns {{ evicted: string[], kept: string[] }}
   */
  evictFromMemory(entries) {
    const now = Date.now();
    const evicted = [];
    const kept    = [];

    for (const [id, entry] of entries) {
      const ttl = this._ttl[entry.namespace] ?? this._ttl.episodic;
      const age = now - (entry.createdAt || 0);
      if (age > ttl) evicted.push(id);
      else kept.push(id);
    }
    return { evicted, kept };
  }

  /**
   * Build SQL clauses to evict stale rows from DuckDB.
   * Returns an array of SQL strings ready to execute.
   * @returns {string[]}
   */
  buildEvictionSql() {
    const now = Date.now();
    const sqls = [];

    // TTL-based eviction per namespace
    for (const [ns, ttlMs] of Object.entries(this._ttl)) {
      const cutoff = now - ttlMs;
      sqls.push(
        `INSERT INTO ${TABLES.archive} SELECT *, 'ttl_eviction' AS archive_reason, ${now} AS archived_at ` +
        `FROM ${TABLES.memories} WHERE namespace = '${ns}' AND created_at < ${cutoff}`
      );
      sqls.push(
        `DELETE FROM ${TABLES.memories} WHERE namespace = '${ns}' AND created_at < ${cutoff}`
      );
    }

    return sqls;
  }

  /**
   * Build SQL for LRU eviction when row count exceeds budget.
   * @param {number} currentCount
   * @returns {string[]}
   */
  buildLruSql(currentCount) {
    if (currentCount <= this._maxRows) return [];
    const excess = currentCount - this._maxRows;
    const now = Date.now();
    return [
      `INSERT INTO ${TABLES.archive} SELECT *, 'lru_eviction' AS archive_reason, ${now} AS archived_at ` +
      `FROM ${TABLES.memories} ORDER BY last_accessed ASC LIMIT ${excess}`,

      `DELETE FROM ${TABLES.memories} WHERE id IN (` +
      `SELECT id FROM ${TABLES.memories} ORDER BY last_accessed ASC LIMIT ${excess})`,
    ];
  }
}

// ---------------------------------------------------------------------------
// WriteThrough
// ---------------------------------------------------------------------------

/**
 * Keeps VectorMemoryV2 (RAM) and DuckDB (disk) in sync.
 * Write-through: every write to one store is mirrored to the other.
 *
 * CHANGE: Previously there was no synchronisation — duckdb-memory.js and
 * vector-memory.js were entirely independent stores.
 */
class WriteThrough {
  /**
   * @param {object} vectorMemory   VectorMemoryV2 instance
   * @param {object} duckdbMemory   HeadyEmbeddedDuckDB instance
   */
  constructor(vectorMemory, duckdbMemory) {
    this._vm  = vectorMemory;
    this._ddb = duckdbMemory;
  }

  /**
   * Write a memory to both stores.
   * @param {object} entry
   * @param {string} entry.namespace
   * @param {string} entry.content
   * @param {number[]} entry.embedding
   * @param {object} [entry.metadata]
   * @returns {Promise<string>}  the new memory ID
   */
  async write(entry) {
    // Write to VectorMemoryV2 first (faster, in-memory)
    let vmId;
    if (this._vm && typeof this._vm.ingestMemory === 'function') {
      vmId = await this._vm.ingestMemory(entry.namespace, entry.content, entry.embedding, entry.metadata);
    }

    // Write to DuckDB
    if (this._ddb && typeof this._ddb.store === 'function') {
      await this._ddb.store({ ...entry, id: vmId });
    }

    return vmId;
  }

  /**
   * Delete a memory from both stores.
   * @param {string} id
   * @param {string} namespace
   * @returns {Promise<void>}
   */
  async delete(id, namespace) {
    if (this._vm && typeof this._vm.delete === 'function') {
      await this._vm.delete(namespace, id);
    }
    if (this._ddb && typeof this._ddb.delete === 'function') {
      await this._ddb.delete(id);
    }
  }

  /**
   * Sync a batch of DuckDB rows into VectorMemoryV2 (cold start / recovery).
   * @param {Array<object>} rows
   * @returns {Promise<number>}  count synced
   */
  async syncDdbToVector(rows) {
    if (!this._vm || typeof this._vm.ingestMemory !== 'function') return 0;
    let count = 0;
    for (const row of rows) {
      try {
        await this._vm.ingestMemory(row.namespace, row.content, row.embedding, row.metadata || {});
        count++;
      } catch { /* skip individual failures */ }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// ArchivalStore
// ---------------------------------------------------------------------------

/**
 * Handles moving memories from the hot store to the cold archive table.
 * Also manages the DuckDB archive schema initialisation.
 */
class ArchivalStore {
  /**
   * @param {object} db  DuckDB connection
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Ensure archive and meta tables exist.
   * @returns {Promise<void>}
   */
  async ensureSchema() {
    // Archive table mirrors memories + reason + timestamp
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.archive} (
        id           VARCHAR PRIMARY KEY,
        namespace    VARCHAR,
        content      TEXT,
        embedding    FLOAT[384],
        metadata     JSON,
        created_at   BIGINT,
        last_accessed BIGINT,
        archive_reason VARCHAR,
        archived_at  BIGINT
      )
    `);

    // Decision log table for buddy-watchdog archival
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.decisions} (
        id          VARCHAR PRIMARY KEY,
        agent_id    VARCHAR,
        decision    JSON,
        outcome     VARCHAR,
        created_at  BIGINT,
        archived_at BIGINT
      )
    `);

    // Consolidation run metadata
    await this._run(`
      CREATE TABLE IF NOT EXISTS ${TABLES.meta} (
        run_id      VARCHAR PRIMARY KEY,
        started_at  BIGINT,
        finished_at BIGINT,
        deduped     INTEGER DEFAULT 0,
        evicted     INTEGER DEFAULT 0,
        synced      INTEGER DEFAULT 0,
        errors      INTEGER DEFAULT 0,
        status      VARCHAR DEFAULT 'running'
      )
    `);
  }

  /**
   * Archive decision log entries from buddy-watchdog/buddy-core.
   * CHANGE: buddy-watchdog._triggerRestart() clears decisionLog = [] without
   * persisting — this method is called before that clear.
   *
   * @param {Array<object>} decisions
   * @returns {Promise<number>}  rows inserted
   */
  async archiveDecisions(decisions) {
    if (!decisions || decisions.length === 0) return 0;
    const now = Date.now();
    let count = 0;

    for (const d of decisions) {
      try {
        const id = d.id || `dec_${now}_${Math.random().toString(36).slice(2, 7)}`;
        await this._run(`
          INSERT OR IGNORE INTO ${TABLES.decisions}
            (id, agent_id, decision, outcome, created_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [id, d.agentId || 'BUDDY', JSON.stringify(d), d.outcome || 'unknown', d.ts || now, now]
        );
        count++;
      } catch { /* skip individual failures */ }
    }
    return count;
  }

  /** @private */
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this._db.prepare ? this._db.prepare(sql) : null;
        if (stmt) {
          stmt.run(params, (err) => err ? reject(err) : resolve());
        } else {
          this._db.run(sql, params, (err) => err ? reject(err) : resolve());
        }
      } catch (err) { reject(err); }
    });
  }

  /** @private */
  _query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// ConsolidationScheduler
// ---------------------------------------------------------------------------

/**
 * Simple interval-based scheduler.  Can be replaced with a cron library if
 * more precise scheduling (e.g., "2 AM daily") is needed.
 */
class ConsolidationScheduler {
  /**
   * @param {Function} task  async () => void — the consolidation function to call
   * @param {number}   [intervalMs=DEFAULT_INTERVAL_MS]
   */
  constructor(task, intervalMs = DEFAULT_INTERVAL_MS) {
    this._task       = task;
    this._intervalMs = intervalMs;
    this._timer      = null;
    this._running    = false;
  }

  /** Start the scheduler. */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (!this._running) {
        this._running = true;
        this._task().finally(() => { this._running = false; });
      }
    }, this._intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  /** Stop the scheduler. */
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Returns true if a run is currently in progress. */
  get isRunning() { return this._running; }
}

// ---------------------------------------------------------------------------
// MemoryConsolidationEngine  (main class)
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full memory consolidation pipeline.
 *
 * @extends EventEmitter
 */
class MemoryConsolidationEngine extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object}  opts.vectorMemory          VectorMemoryV2 instance (may be null for DuckDB-only mode)
   * @param {object}  opts.duckdbMemory          HeadyEmbeddedDuckDB instance (may be null for RAM-only mode)
   * @param {object}  [opts.ttlByNamespace]      namespace → TTL override in ms
   * @param {number}  [opts.maxRows=250000]       DuckDB row budget
   * @param {number}  [opts.intervalMs]           scheduler interval in ms
   * @param {number}  [opts.dedupThreshold=0.98]  cosine threshold for dedup
   * @param {boolean} [opts.autoInit=false]        call init() in constructor (not recommended — use await init())
   * @param {number}  [opts.embeddingDims=384]    vector dimensions
   */
  constructor(opts = {}) {
    super();

    this._vm      = opts.vectorMemory  || null;
    this._ddb     = opts.duckdbMemory  || null;
    this._dims    = opts.embeddingDims || 384;

    this._dedup    = new DedupEngine({ threshold: opts.dedupThreshold ?? DEDUP_COSINE_THRESHOLD });
    this._eviction = new StalenessEviction({
      ttlByNamespace: opts.ttlByNamespace || {},
      maxRows:        opts.maxRows        || DEFAULT_MAX_ROWS,
    });

    // DuckDB components (only active when duckdbMemory is provided)
    this._hnsw     = this._ddb ? new HNSWIndexManager(this._ddb._db || this._ddb, this._dims) : null;
    this._archive  = this._ddb ? new ArchivalStore(this._ddb._db || this._ddb)                : null;
    this._wt       = (this._vm || this._ddb) ? new WriteThrough(this._vm, this._ddb)          : null;

    this._scheduler = new ConsolidationScheduler(
      () => this.runOnce(),
      opts.intervalMs || DEFAULT_INTERVAL_MS
    );

    this._initialised = false;

    /** @type {Array<object>}  last N run reports */
    this._runHistory = [];
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialise the engine: ensure DuckDB schema and HNSW index exist,
   * then optionally sync DuckDB → VectorMemory.
   * @param {object} [opts]
   * @param {boolean} [opts.syncOnInit=false]  load DuckDB rows into VectorMemory on startup
   * @returns {Promise<void>}
   */
  async init(opts = {}) {
    if (this._initialised) return;

    if (this._archive) await this._archive.ensureSchema();
    if (this._hnsw)    await this._hnsw.ensureIndex().catch(err => {
      // VSS may not be available in all environments — log but don't crash
      this.emit('warn', { phase: 'init', message: `HNSW index creation skipped: ${err.message}` });
    });

    if (opts.syncOnInit && this._ddb && this._wt) {
      await this._coldStartSync();
    }

    this._initialised = true;
    this.emit('init:complete');
  }

  /**
   * Start the background consolidation scheduler.
   * @returns {this}
   */
  startScheduler() {
    if (!this._initialised) throw new Error('Call init() before startScheduler()');
    this._scheduler.start();
    this.emit('scheduler:started');
    return this;
  }

  /**
   * Stop the background scheduler.
   * @returns {this}
   */
  stopScheduler() {
    this._scheduler.stop();
    this.emit('scheduler:stopped');
    return this;
  }

  // -------------------------------------------------------------------------
  // Core consolidation pipeline
  // -------------------------------------------------------------------------

  /**
   * Run a full consolidation pass:
   *   1. Deduplication (both stores)
   *   2. Staleness eviction (both stores)
   *   3. HNSW index rebuild if significant rows were removed
   *   4. Emit a run report
   *
   * @returns {Promise<ConsolidationReport>}
   */
  async runOnce() {
    const runId  = `run_${Date.now()}`;
    const report = {
      runId,
      startedAt:   Date.now(),
      finishedAt:  null,
      deduped:     0,
      evicted:     0,
      archived:    0,
      synced:      0,
      indexRebuilt: false,
      errors:      [],
    };

    this.emit('run:start', { runId });

    try {
      // --- Phase 1: Deduplication ---
      const dedupResult = await this._runDedup();
      report.deduped  += dedupResult.count;
      report.archived += dedupResult.archived;

    } catch (err) {
      report.errors.push({ phase: 'dedup', message: err.message });
      this.emit('error', { phase: 'dedup', err });
    }

    try {
      // --- Phase 2: Staleness Eviction ---
      const evictResult = await this._runEviction();
      report.evicted  += evictResult.count;
      report.archived += evictResult.archived;

    } catch (err) {
      report.errors.push({ phase: 'eviction', message: err.message });
      this.emit('error', { phase: 'eviction', err });
    }

    try {
      // --- Phase 3: HNSW index rebuild if significant removals ---
      if (this._hnsw && (report.deduped + report.evicted) > 1_000) {
        await this._hnsw.rebuildIndex();
        report.indexRebuilt = true;
      }
    } catch (err) {
      report.errors.push({ phase: 'hnsw_rebuild', message: err.message });
      this.emit('warn', { phase: 'hnsw_rebuild', message: err.message });
    }

    report.finishedAt = Date.now();
    report.durationMs = report.finishedAt - report.startedAt;

    // Persist run metadata to DuckDB
    if (this._archive) {
      await this._persistRunMeta(report).catch(() => {});
    }

    this._runHistory.push(report);
    if (this._runHistory.length > 50) this._runHistory.shift();

    this.emit('run:complete', report);
    return report;
  }

  // -------------------------------------------------------------------------
  // Decision log archival (called by buddy-watchdog before restart)
  // -------------------------------------------------------------------------

  /**
   * Archive a decision log array to DuckDB before it is cleared by buddy-watchdog.
   * CHANGE: Provides the missing persistence hook for buddy-watchdog._triggerRestart().
   *
   * @param {Array<object>} decisionLog  buddy-core's this.decisionLog array
   * @returns {Promise<number>}  number of decisions archived
   */
  async archiveDecisionLog(decisionLog) {
    if (!this._archive || !Array.isArray(decisionLog) || decisionLog.length === 0) return 0;
    const count = await this._archive.archiveDecisions(decisionLog);
    this.emit('decisions:archived', { count });
    return count;
  }

  // -------------------------------------------------------------------------
  // Write-through API (delegate to WriteThrough)
  // -------------------------------------------------------------------------

  /**
   * Write a memory through to both stores.
   * @param {object} entry
   * @returns {Promise<string>}
   */
  async writeMemory(entry) {
    if (!this._wt) throw new Error('No stores configured');
    return this._wt.write(entry);
  }

  /**
   * Delete a memory from both stores.
   * @param {string} id
   * @param {string} namespace
   * @returns {Promise<void>}
   */
  async deleteMemory(id, namespace) {
    if (!this._wt) throw new Error('No stores configured');
    return this._wt.delete(id, namespace);
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  /**
   * Return the last N consolidation run reports.
   * @param {number} [n=10]
   * @returns {ConsolidationReport[]}
   */
  getRunHistory(n = 10) {
    return this._runHistory.slice(-n);
  }

  /**
   * Return current scheduler state and initialisation status.
   * @returns {object}
   */
  status() {
    return {
      initialised:        this._initialised,
      schedulerRunning:   this._scheduler.isRunning,
      hasVectorMemory:    !!this._vm,
      hasDuckdb:          !!this._ddb,
      runCount:           this._runHistory.length,
      lastRun:            this._runHistory[this._runHistory.length - 1] || null,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** @private */
  async _runDedup() {
    let count = 0, archived = 0;

    // Dedup in VectorMemoryV2 (if available)
    if (this._vm && typeof this._vm.getAllEntries === 'function') {
      const namespaces = await this._vm.getNamespaces().catch(() => []);
      for (const ns of namespaces) {
        const entries = await this._vm.getAllEntries(ns).catch(() => []);
        if (entries.length < 2) continue;

        const { discard, mergeMap } = this._dedup.findDuplicates(entries);
        for (const id of discard) {
          await this._vm.delete(ns, id).catch(() => {});
          count++;
        }

        // Merge metadata of discarded entries into their representatives
        for (const [discardId, keepId] of mergeMap) {
          const discardEntry = entries.find(e => e.id === discardId);
          if (discardEntry) {
            await this._vm.mergeMetadata?.(ns, keepId, discardEntry.metadata).catch(() => {});
          }
        }
      }
    }

    // Dedup in DuckDB
    if (this._ddb) {
      const dbRows = await this._queryDdb(
        `SELECT id, namespace, content, embedding, created_at FROM ${TABLES.memories} ORDER BY created_at DESC`
      );

      // Map rows: parse embedding from DuckDB array if needed
      const entries = dbRows.map(r => ({
        id:        r.id,
        namespace: r.namespace,
        content:   r.content,
        embedding: Array.isArray(r.embedding) ? r.embedding : JSON.parse(r.embedding || '[]'),
        createdAt: r.created_at,
      }));

      if (entries.length >= 2) {
        const { discard } = this._dedup.findDuplicates(entries);
        if (discard.length > 0) {
          const now = Date.now();
          // Archive discards
          const ids = discard.map(id => `'${id}'`).join(',');
          await this._runDdb(
            `INSERT INTO ${TABLES.archive} SELECT *, 'dedup' AS archive_reason, ${now} AS archived_at ` +
            `FROM ${TABLES.memories} WHERE id IN (${ids})`
          ).catch(() => {});
          await this._runDdb(`DELETE FROM ${TABLES.memories} WHERE id IN (${ids})`).catch(() => {});
          count    += discard.length;
          archived += discard.length;
        }
      }
    }

    return { count, archived };
  }

  /** @private */
  async _runEviction() {
    let count = 0, archived = 0;

    // Evict from VectorMemoryV2
    if (this._vm && typeof this._vm.getAllEntriesWithMeta === 'function') {
      const allEntries = await this._vm.getAllEntriesWithMeta().catch(() => new Map());
      const { evicted } = this._eviction.evictFromMemory(allEntries);
      for (const id of evicted) {
        const entry = allEntries.get(id);
        await this._vm.delete(entry?.namespace || 'episodic', id).catch(() => {});
        count++;
      }
    }

    // Evict from DuckDB: TTL-based
    if (this._ddb) {
      const evictSqls = this._eviction.buildEvictionSql();
      let evictedFromDdb = 0;
      for (const sql of evictSqls) {
        const changed = await this._runDdb(sql).catch(() => 0);
        if (typeof changed === 'number') evictedFromDdb += changed;
      }
      count    += evictedFromDdb;
      archived += evictedFromDdb;

      // LRU eviction if over row budget
      const [[{ total }]] = await this._queryDdb(
        `SELECT COUNT(*) AS total FROM ${TABLES.memories}`
      ).then(rows => [rows]).catch(() => [[{ total: 0 }]]);

      if (total > this._eviction._maxRows) {
        const lruSqls = this._eviction.buildLruSql(total);
        for (const sql of lruSqls) await this._runDdb(sql).catch(() => {});
        const overflow = total - this._eviction._maxRows;
        count    += overflow;
        archived += overflow;
      }
    }

    return { count, archived };
  }

  /** @private */
  async _coldStartSync() {
    if (!this._ddb || !this._wt) return 0;
    const rows = await this._queryDdb(
      `SELECT id, namespace, content, embedding, metadata, created_at FROM ${TABLES.memories} LIMIT 10000`
    ).catch(() => []);
    const synced = await this._wt.syncDdbToVector(rows);
    this.emit('coldstart:synced', { count: synced });
    return synced;
  }

  /** @private */
  async _persistRunMeta(report) {
    if (!this._ddb) return;
    await this._runDdb(
      `INSERT OR REPLACE INTO ${TABLES.meta} (run_id, started_at, finished_at, deduped, evicted, synced, errors, status) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.runId,
        report.startedAt,
        report.finishedAt,
        report.deduped,
        report.evicted,
        report.synced,
        report.errors.length,
        report.errors.length === 0 ? 'ok' : 'partial',
      ]
    ).catch(() => {});
  }

  /** @private */
  _runDdb(sql, params = []) {
    if (!this._ddb) return Promise.resolve(0);
    const db = this._ddb._db || this._ddb;
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this?.changes ?? 0);
      });
    });
  }

  /** @private */
  _queryDdb(sql, params = []) {
    if (!this._ddb) return Promise.resolve([]);
    const db = this._ddb._db || this._ddb;
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MemoryConsolidationEngine,
  DedupEngine,
  StalenessEviction,
  WriteThrough,
  HNSWIndexManager,
  ArchivalStore,
  ConsolidationScheduler,
  // Constants exported for integration tests / custom configuration
  DEDUP_COSINE_THRESHOLD,
  DEFAULT_INTERVAL_MS,
  DEFAULT_TTL_MS,
  DEFAULT_MAX_ROWS,
  TABLES,
};

/**
 * @typedef {object} ConsolidationReport
 * @property {string}   runId
 * @property {number}   startedAt
 * @property {number}   finishedAt
 * @property {number}   durationMs
 * @property {number}   deduped       entries removed by cosine dedup
 * @property {number}   evicted       entries removed by TTL/LRU
 * @property {number}   archived      entries moved to archive table
 * @property {number}   synced        DuckDB rows synced to VectorMemory
 * @property {boolean}  indexRebuilt  whether HNSW index was rebuilt
 * @property {Array<{phase:string, message:string}>} errors
 */

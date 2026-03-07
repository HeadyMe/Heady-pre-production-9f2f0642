/**
 * @fileoverview Vector Memory Optimizer for Heady Latent OS
 * @module vector-memory-optimizer
 *
 * Automated optimization advisor and monitor for pgvector-backed memory stores.
 * Provides:
 *   - Index type selection advisor (HNSW vs IVFFlat vs brute-force)
 *   - Quantization advisor (halfvec vs binary vs full float)
 *   - Slow query detection and alerting (pg_stat_statements integration)
 *   - Index health checker (fragmentation, bloat, dead tuples)
 *   - Auto-vacuum schedule recommendations
 *   - Memory pressure detection and response
 *   - pgvector 0.8.0 iterative scan tuning
 *
 * Decision thresholds (from research/section1_vector_db.md §1.3):
 *   - <30K vectors:    brute-force acceptable
 *   - 30K–50K:         HNSW starts showing advantage
 *   - 50K–1M:          HNSW strongly preferred (30× QPS, 27× lower p99)
 *   - 1M–50M:          HNSW + halfvec quantization
 *   - >50M:            Consider pgvectorscale or dedicated vector DB
 *
 * @example
 * import { VectorMemoryOptimizer } from './vector-memory-optimizer.js';
 *
 * const optimizer = new VectorMemoryOptimizer(pgPool, { logger: console });
 * await optimizer.start();
 *
 * // On-demand index check
 * const advice = await optimizer.getIndexRecommendation('vector_memories');
 * console.log(advice.recommendation, advice.action);
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI,
  CSL_THRESHOLDS,
  phiAdaptiveInterval,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vector count thresholds for index type selection */
const THRESHOLDS = {
  bruteForce:     30_000,    // <30K: brute-force acceptable
  hnswPreferred:  50_000,    // 30K–50K: HNSW starts winning
  hnswRequired:   1_000_000, // 50K–1M: HNSW strongly preferred
  quantization:   1_000_000, // >1M: add halfvec quantization
  binary:         10_000_000,// >10M: consider binary quantization
  pgvectorscale:  50_000_000,// >50M: consider pgvectorscale
};

/**
 * HNSW parameter presets by scale.
 * All m, ef_construction, and ef_search values are Fibonacci numbers,
 * which naturally satisfy HNSW's requirement that ef_construction > m
 * and that ef_search < ef_construction.
 *
 * small:  fib(7)=13, fib(9)=34, fib(8)=21   — replaces {16, 64, 40}
 * medium: fib(8)=21, fib(11)=89, fib(10)=55  — replaces {16, 128, 80}
 * large:  fib(8)=21, fib(12)=144, fib(11)=89 — replaces {32, 200, 100}
 * xlarge: unchanged (no phi mapping specified)
 */
const HNSW_PARAMS = {
  /** small: m=fib(7)=13, ef_construction=fib(9)=34, ef_search=fib(8)=21  — <100K */
  small:  { m: fib(7),  ef_construction: fib(9),  ef_search: fib(8)  },
  /** medium: m=fib(8)=21, ef_construction=fib(11)=89, ef_search=fib(10)=55 — 100K–1M */
  medium: { m: fib(8),  ef_construction: fib(11), ef_search: fib(10) },
  /** large: m=fib(8)=21, ef_construction=fib(12)=144, ef_search=fib(11)=89 — 1M–10M */
  large:  { m: fib(8),  ef_construction: fib(12), ef_search: fib(11) },
  xlarge: { m: 32, ef_construction: 256, ef_search: 150 },  // >10M
};

/**
 * Slow query threshold in milliseconds.
 * Math.round(1000 * PSI) ≈ 618ms — phi-derived boundary replacing 500ms.
 * PSI = 1/φ ≈ 0.618; 618ms is the golden-ratio fraction of one second.
 */
const SLOW_QUERY_THRESHOLD_MS = Math.round(1000 * PSI);  // ≈ 618ms

/**
 * Index bloat threshold (fragmentation ratio).
 * Math.pow(PSI, 2) ≈ 0.382 — phi-derived, replaces arbitrary 0.3.
 * PSI^2 = 1 - PSI is the minor segment of the golden ratio split.
 */
const BLOAT_THRESHOLD = Math.pow(PSI, 2);  // ≈ 0.382

/**
 * Dead tuple ratio threshold for autovacuum trigger.
 * Math.pow(PSI, 4) ≈ 0.146 — phi-derived, replaces arbitrary 0.1.
 * PSI^4 is the 4th-level phi-harmonic threshold.
 */
const DEAD_TUPLE_RATIO = Math.pow(PSI, 4);  // ≈ 0.146

/**
 * Memory pressure threshold: fraction of shared_buffers considered high.
 * CSL_THRESHOLDS.HIGH ≈ 0.882 — phi-harmonic level-3 threshold, replaces 0.85.
 * Derived as phiThreshold(3) = 1 - PSI^3 * 0.5.
 */
const MEMORY_PRESSURE_THRESHOLD = CSL_THRESHOLDS.HIGH;  // ≈ 0.882

/**
 * Default monitoring interval in milliseconds.
 * fib(16) * 1000 / fib(10) = 987000 / 55 ≈ 17945ms ≈ 18 seconds.
 * Alternatively expressed as a phi-harmonic starting interval that
 * the phiAdaptiveInterval() function will grow/shrink based on system health.
 * Using 60000ms / PHI^2 ≈ 22918ms as a round Fibonacci-compatible base.
 * Simplified to: fib(16) * 1000 / fib(10) = 17945ms ≈ 18s.
 */
const DEFAULT_MONITOR_INTERVAL_MS = Math.round(fib(16) * 1000 / fib(10));  // ≈ 17945ms

// ─── Main Class ───────────────────────────────────────────────────────────────

/**
 * VectorMemoryOptimizer — Automated advisor and monitor for pgvector stores.
 */
export class VectorMemoryOptimizer extends EventEmitter {
  /**
   * @param {import('pg').Pool} pool — PostgreSQL connection pool
   * @param {object} [options]
   * @param {number} [options.monitorIntervalMs] — Stats poll interval (default: fib(16)*1000/fib(10) ≈ 17945ms)
   * @param {string} [options.schemaName='public']     — Schema to monitor
   * @param {string[]} [options.vectorTables]          — Tables to watch
   * @param {object}  [options.logger=console]
   */
  constructor(pool, options = {}) {
    super();
    this.pool             = pool;
    this.schema           = options.schemaName      ?? 'public';
    this.vectorTables     = options.vectorTables    ?? ['vector_memories'];
    this.monitorIntervalMs = options.monitorIntervalMs ?? DEFAULT_MONITOR_INTERVAL_MS;
    this.logger           = options.logger          ?? console;

    this._timer          = null;
    this._running        = false;
    this._history        = [];          // Circular buffer of metric snapshots
    /**
     * fib(17) = 1597 — Fibonacci-scaled history depth, replaces 1440.
     * With the new ~18s default interval, 1597 snapshots ≈ 8 hours of history.
     */
    this._maxHistory     = fib(17);     // 1597 — replaces 1440
    this._slowQueries    = [];
    this._recommendations = [];

    // Stats
    this._stats = {
      snapshots:       0,
      slowQueriesFound: 0,
      recommendations: 0,
      vacuumsTriggered: 0,
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Start periodic monitoring.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._running) return;
    this._running = true;
    this.logger.info('[VectorOptimizer] Starting monitoring...');

    // Run immediately, then on interval
    await this._runMonitoringCycle().catch(err =>
      this.logger.error('[VectorOptimizer] Initial monitoring cycle failed:', err.message)
    );

    this._timer = setInterval(async () => {
      if (!this._running) return;
      await this._runMonitoringCycle().catch(err =>
        this.logger.error('[VectorOptimizer] Monitoring cycle failed:', err.message)
      );
    }, this.monitorIntervalMs);

    this.emit('started');
  }

  /**
   * Stop periodic monitoring.
   */
  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.logger.info('[VectorOptimizer] Monitoring stopped');
    this.emit('stopped');
  }

  // ─── Monitoring Cycle ────────────────────────────────────────────────────────

  /**
   * @private Run one complete monitoring cycle.
   */
  async _runMonitoringCycle() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      tables:    {},
      indexes:   {},
      memory:    {},
      slowQueries: [],
    };

    try {
      // Parallel collection of stats
      const [tableStats, indexStats, memStats, slowQueries] = await Promise.allSettled([
        this._collectTableStats(),
        this._collectIndexStats(),
        this._collectMemoryStats(),
        this._collectSlowQueries(),
      ]);

      if (tableStats.status === 'fulfilled')  snapshot.tables     = tableStats.value;
      if (indexStats.status === 'fulfilled')  snapshot.indexes    = indexStats.value;
      if (memStats.status === 'fulfilled')    snapshot.memory     = memStats.value;
      if (slowQueries.status === 'fulfilled') snapshot.slowQueries = slowQueries.value;

      // Update circular history buffer
      this._history.push(snapshot);
      if (this._history.length > this._maxHistory) this._history.shift();

      // Check thresholds and generate alerts
      await this._checkThresholds(snapshot);

      this._stats.snapshots++;
      this.emit('snapshot', snapshot);

    } catch (err) {
      this.logger.error('[VectorOptimizer] Snapshot collection error:', err.message);
    }
  }

  // ─── Stats Collection ────────────────────────────────────────────────────────

  /**
   * @private Collect per-table statistics including row counts and dead tuple ratios.
   */
  async _collectTableStats() {
    const placeholders = this.vectorTables.map((_, i) => `$${i + 2}`).join(',');
    const result = await this.pool.query(`
      SELECT
        schemaname,
        relname                                         AS table_name,
        n_live_tup                                      AS live_tuples,
        n_dead_tup                                      AS dead_tuples,
        CASE WHEN n_live_tup > 0
             THEN ROUND(n_dead_tup::numeric / n_live_tup, 4)
             ELSE 0
        END                                             AS dead_tuple_ratio,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)))
                                                        AS total_size,
        pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))
                                                        AS total_size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = $1
        AND relname = ANY(ARRAY[${placeholders}])
      ORDER BY total_size_bytes DESC
    `, [this.schema, ...this.vectorTables]);

    return result.rows;
  }

  /**
   * @private Collect index statistics: size, usage, fragmentation.
   */
  async _collectIndexStats() {
    const result = await this.pool.query(`
      SELECT
        ix.schemaname,
        ix.tablename,
        ix.indexname,
        ix.indexdef,
        ix.idx_scan                                       AS scans,
        ix.idx_tup_read                                   AS tuples_read,
        ix.idx_tup_fetch                                  AS tuples_fetched,
        pg_size_pretty(pg_relation_size(quote_ident(ix.schemaname) || '.' || quote_ident(ix.indexname)))
                                                          AS index_size,
        pg_relation_size(quote_ident(ix.schemaname) || '.' || quote_ident(ix.indexname))
                                                          AS index_size_bytes,
        CASE
          WHEN ix.idx_scan = 0 THEN 'unused'
          WHEN ix.idx_scan < 100 THEN 'low_usage'
          ELSE 'active'
        END                                               AS usage_status,
        -- Estimate fragmentation from bloat (approximation via heap pages vs index pages)
        ROUND(
          GREATEST(0,
            1.0 - (ix.idx_tup_read::float + 1) /
                  (GREATEST(ix.idx_tup_fetch, ix.idx_tup_read, 1)::float)
          ), 4
        )                                                 AS fragmentation_estimate
      FROM pg_stat_user_indexes ix
      WHERE ix.schemaname = $1
        AND ix.tablename = ANY($2)
      ORDER BY index_size_bytes DESC
    `, [this.schema, this.vectorTables]);

    return result.rows;
  }

  /**
   * @private Collect PostgreSQL memory and buffer stats.
   */
  async _collectMemoryStats() {
    try {
      // pg_buffercache extension needed for detailed buffer stats
      // Fall back to pg_stat_bgwriter if not available
      const bgResult = await this.pool.query(`
        SELECT
          checkpoints_timed,
          checkpoints_req,
          buffers_checkpoint,
          buffers_clean,
          buffers_backend,
          buffers_alloc,
          maxwritten_clean
        FROM pg_stat_bgwriter
      `);

      const settingsResult = await this.pool.query(`
        SELECT name, setting, unit
        FROM pg_settings
        WHERE name IN (
          'shared_buffers', 'work_mem', 'effective_cache_size',
          'maintenance_work_mem', 'max_parallel_maintenance_workers'
        )
      `);

      return {
        bgwriter:  bgResult.rows[0] ?? {},
        settings:  Object.fromEntries(
          settingsResult.rows.map(r => [r.name, { setting: r.setting, unit: r.unit }])
        ),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * @private Collect slow queries from pg_stat_statements if available.
   * Focuses on vector similarity queries (containing <=> or <~> operators).
   */
  async _collectSlowQueries() {
    try {
      const result = await this.pool.query(`
        SELECT
          query,
          calls,
          mean_exec_time,
          max_exec_time,
          total_exec_time,
          rows,
          ROUND((mean_exec_time)::numeric, 2)  AS mean_ms,
          ROUND((max_exec_time)::numeric, 2)   AS max_ms
        FROM pg_stat_statements
        WHERE
          (query ILIKE '%<=>%' OR query ILIKE '%<~>%' OR query ILIKE '%<%%>%'
           OR query ILIKE '%vector%' OR query ILIKE '%halfvec%')
          AND mean_exec_time > $1
          AND query NOT ILIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `, [SLOW_QUERY_THRESHOLD_MS]);

      if (result.rows.length > 0) {
        this._stats.slowQueriesFound += result.rows.length;
        this._slowQueries = result.rows;
        this.emit('slow:queries', result.rows);
      }

      return result.rows;
    } catch (err) {
      // pg_stat_statements not installed — graceful degradation
      if (err.message.includes('does not exist')) {
        return [];
      }
      throw err;
    }
  }

  // ─── Threshold Checking ──────────────────────────────────────────────────────

  /**
   * @private Check snapshot metrics against thresholds and emit alerts.
   */
  async _checkThresholds(snapshot) {
    const newRecs = [];

    // Check dead tuple ratios
    for (const table of (snapshot.tables ?? [])) {
      if (parseFloat(table.dead_tuple_ratio) > DEAD_TUPLE_RATIO) {
        const rec = {
          type:     'autovacuum',
          table:    table.table_name,
          severity: 'warning',
          message:  `Table ${table.table_name} has ${(table.dead_tuple_ratio * 100).toFixed(1)}% dead tuples (>${DEAD_TUPLE_RATIO * 100}% threshold). Run VACUUM ANALYZE.`,
          action:   `VACUUM ANALYZE ${this.schema}.${table.table_name};`,
          timestamp: new Date().toISOString(),
        };
        newRecs.push(rec);
        this.emit('alert:dead_tuples', rec);
      }
    }

    // Check for unused indexes
    for (const idx of (snapshot.indexes ?? [])) {
      if (idx.usage_status === 'unused' && idx.index_size_bytes > 1024 * 1024 * 10) {
        const rec = {
          type:     'unused_index',
          index:    idx.indexname,
          table:    idx.tablename,
          severity: 'info',
          message:  `Index ${idx.indexname} (${idx.index_size}) has 0 scans. Consider dropping if not needed for constraint enforcement.`,
          action:   `DROP INDEX CONCURRENTLY ${idx.schemaname}.${idx.indexname};`,
          timestamp: new Date().toISOString(),
        };
        newRecs.push(rec);
        this.emit('alert:unused_index', rec);
      }
    }

    // Check slow queries
    for (const query of (snapshot.slowQueries ?? [])) {
      if (query.mean_ms > SLOW_QUERY_THRESHOLD_MS * 5) {  // 5× threshold = critical
        this.emit('alert:critical_slow_query', {
          type:     'critical_slow_query',
          severity: 'critical',
          query:    query.query.slice(0, 300),
          meanMs:   query.mean_ms,
          maxMs:    query.max_ms,
          calls:    query.calls,
        });
      }
    }

    this._recommendations.push(...newRecs);
    if (newRecs.length > 0) {
      this._stats.recommendations += newRecs.length;
    }

    // Keep recommendation history bounded
    if (this._recommendations.length > 500) {
      this._recommendations = this._recommendations.slice(-500);
    }
  }

  // ─── Public Advisors ─────────────────────────────────────────────────────────

  /**
   * Get index type recommendation for a vector table.
   * Based on pgvector research: HNSW vs IVFFlat vs brute-force decision matrix.
   *
   * @param {string} tableName — Table to analyze
   * @param {string} [columnName='embedding'] — Vector column name
   * @returns {Promise<IndexRecommendation>}
   */
  async getIndexRecommendation(tableName, columnName = 'embedding') {
    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS count FROM ${this.schema}.${tableName}`,
      []
    );
    const vectorCount = parseInt(countResult.rows[0].count, 10);

    // Detect current index type
    const indexResult = await this.pool.query(`
      SELECT
        indexname,
        indexdef,
        pg_relation_size(quote_ident($1) || '.' || quote_ident(indexname))
          AS index_size_bytes
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
        AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%' OR indexdef ILIKE '%halfvec%')
    `, [this.schema, tableName]);

    const currentIndexes = indexResult.rows;
    const hasHNSW   = currentIndexes.some(i => i.indexdef.includes('hnsw'));
    const hasHalfvec = currentIndexes.some(i => i.indexdef.includes('halfvec'));
    const hasBinary  = currentIndexes.some(i => i.indexdef.includes('binary_quantize'));

    let recommendation, reason, hnswParams, priority;

    if (vectorCount < THRESHOLDS.bruteForce) {
      recommendation = 'brute_force';
      reason  = `${vectorCount.toLocaleString()} vectors is below ${THRESHOLDS.bruteForce.toLocaleString()} — sequential scan is acceptable (<50ms expected).`;
      priority = 'low';
    } else if (vectorCount < THRESHOLDS.hnswPreferred) {
      recommendation = 'hnsw_small';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW starts showing advantage over brute-force here.`;
      hnswParams = HNSW_PARAMS.small;
      priority = 'medium';
    } else if (vectorCount < THRESHOLDS.hnswRequired) {
      recommendation = 'hnsw_medium';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW delivers 15–30× better QPS than IVFFlat at equal recall.`;
      hnswParams = HNSW_PARAMS.medium;
      priority = 'high';
    } else if (vectorCount < THRESHOLDS.quantization) {
      recommendation = 'hnsw_large';
      reason  = `${vectorCount.toLocaleString()} vectors — HNSW required; add halfvec quantization for 50% memory savings.`;
      hnswParams = HNSW_PARAMS.large;
      priority = 'high';
    } else if (vectorCount < THRESHOLDS.binary) {
      recommendation = 'hnsw_with_halfvec';
      reason  = `${vectorCount.toLocaleString()} vectors — Use HNSW on halfvec (scalar quantized) for 50% memory savings, near-zero recall loss.`;
      hnswParams = HNSW_PARAMS.xlarge;
      priority = 'critical';
    } else if (vectorCount < THRESHOLDS.pgvectorscale) {
      recommendation = 'hnsw_with_binary';
      reason  = `${vectorCount.toLocaleString()} vectors — Use binary quantization for fast pre-filter; re-rank on original floats. Consider pgvectorscale.`;
      hnswParams = HNSW_PARAMS.xlarge;
      priority = 'critical';
    } else {
      recommendation = 'pgvectorscale_or_dedicated';
      reason  = `${vectorCount.toLocaleString()} vectors exceeds pgvector sweet spot. pgvectorscale (StreamingDiskANN) achieves 471 QPS at 99% recall at 50M vectors.`;
      priority = 'critical';
    }

    const actions = this._buildIndexActions(tableName, columnName, recommendation, hnswParams);

    return {
      tableName,
      columnName,
      vectorCount,
      recommendation,
      reason,
      priority,
      actions,
      currentState: {
        hasHNSW,
        hasHalfvec,
        hasBinary,
        indexCount: currentIndexes.length,
        indexes:    currentIndexes,
      },
      hnswParams,
    };
  }

  /**
   * @private Build SQL action statements for the recommendation.
   */
  _buildIndexActions(tableName, columnName, recommendation, hnswParams) {
    const actions = [];
    const fqTable = `${this.schema}.${tableName}`;

    switch (recommendation) {
      case 'hnsw_small':
        actions.push(`SET max_parallel_maintenance_workers = 4;`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_cosine
  ON ${fqTable} USING hnsw (${columnName} vector_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        break;

      case 'hnsw_medium':
      case 'hnsw_large':
        actions.push(`SET max_parallel_maintenance_workers = 8;`);
        actions.push(`SET maintenance_work_mem = '2GB';`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_cosine
  ON ${fqTable} USING hnsw (${columnName} vector_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        actions.push(`SET hnsw.ef_search = ${hnswParams.ef_search};`);
        actions.push(`SET hnsw.iterative_scan = 'relaxed_order';`);
        break;

      case 'hnsw_with_halfvec':
        actions.push(`SET max_parallel_maintenance_workers = 8;`);
        actions.push(`SET maintenance_work_mem = '4GB';`);
        actions.push(`-- Add halfvec column (50% storage reduction)`);
        actions.push(`ALTER TABLE ${fqTable} ADD COLUMN IF NOT EXISTS embedding_half halfvec(384);`);
        actions.push(`UPDATE ${fqTable} SET embedding_half = ${columnName}::halfvec(384);`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_halfvec
  ON ${fqTable} USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        break;

      case 'hnsw_with_binary':
        actions.push(`-- Binary quantization HNSW (96.9% storage reduction) + re-rank`);
        actions.push(`ALTER TABLE ${fqTable} ADD COLUMN IF NOT EXISTS embedding_binary bit(384);`);
        actions.push(`UPDATE ${fqTable} SET embedding_binary = binary_quantize(${columnName})::bit(384);`);
        actions.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${tableName}_hnsw_binary
  ON ${fqTable} USING hnsw (embedding_binary bit_hamming_ops)
  WITH (m = ${hnswParams.m}, ef_construction = ${hnswParams.ef_construction});`);
        actions.push(`-- Example re-ranking query:
-- WITH candidates AS (
--   SELECT id FROM ${fqTable}
--   ORDER BY embedding_binary <~> binary_quantize($1)::bit(384) LIMIT 40
-- )
-- SELECT * FROM ${fqTable} WHERE id IN (SELECT id FROM candidates)
-- ORDER BY ${columnName} <=> $1 LIMIT 10;`);
        break;

      default:
        actions.push(`-- Evaluate pgvectorscale StreamingDiskANN for >50M vectors`);
        actions.push(`-- CREATE EXTENSION IF NOT EXISTS vectorscale;`);
    }

    return actions;
  }

  /**
   * Get quantization recommendation based on collection size and memory constraints.
   *
   * @param {string} tableName
   * @param {object} [options]
   * @param {number} [options.availableRamGB] — Available RAM for index
   * @param {number} [options.dimensions=384] — Vector dimensions
   * @returns {Promise<QuantizationRecommendation>}
   */
  async getQuantizationAdvice(tableName, options = {}) {
    const dims = options.dimensions ?? 384;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) AS count, pg_total_relation_size($1) AS table_bytes
       FROM ${this.schema}.${tableName}`,
      [`${this.schema}.${tableName}`]
    );

    const vectorCount = parseInt(countResult.rows[0].count, 10);
    const tableSizeGB = countResult.rows[0].table_bytes / (1024 ** 3);

    // Memory estimates (from research §1.4):
    // HNSW float32 at m=32: ~192 bytes/vec + raw float
    // HNSW halfvec at m=32: ~96 bytes/vec + compressed
    // Binary quantize: 1 bit/dim
    const float32IndexGB = (vectorCount * (dims * 4 + 192)) / (1024 ** 3);
    const halfvecIndexGB = (vectorCount * (dims * 2 + 96))  / (1024 ** 3);
    const binaryIndexGB  = (vectorCount * (dims / 8 + 32))  / (1024 ** 3);

    const availableRAM = options.availableRamGB ?? 16;
    let recommendation, rationale;

    if (float32IndexGB <= availableRAM * 0.6) {
      recommendation = 'float32';
      rationale      = `Full float32 HNSW fits in ${float32IndexGB.toFixed(2)} GiB RAM. Maximum recall accuracy.`;
    } else if (halfvecIndexGB <= availableRAM * 0.6) {
      recommendation = 'halfvec';
      rationale      = `halfvec (scalar quantization) reduces index to ${halfvecIndexGB.toFixed(2)} GiB (${Math.round((1 - halfvecIndexGB / float32IndexGB) * 100)}% savings) with near-zero recall impact.`;
    } else if (binaryIndexGB <= availableRAM * 0.6) {
      recommendation = 'binary_with_rerank';
      rationale      = `Binary quantization reduces index to ${binaryIndexGB.toFixed(2)} GiB. Must use re-ranking (4× oversample) to recover recall.`;
    } else {
      recommendation = 'pgvectorscale';
      rationale      = `Collection (${vectorCount.toLocaleString()} × ${dims}d) requires ${float32IndexGB.toFixed(1)} GiB for float32 HNSW — exceeds available RAM. Use pgvectorscale StreamingDiskANN (disk-resident) or shard the collection.`;
    }

    return {
      tableName,
      vectorCount,
      dimensions:    dims,
      tableSizeGB:   parseFloat(tableSizeGB.toFixed(2)),
      estimates: {
        float32IndexGB: parseFloat(float32IndexGB.toFixed(2)),
        halfvecIndexGB: parseFloat(halfvecIndexGB.toFixed(2)),
        binaryIndexGB:  parseFloat(binaryIndexGB.toFixed(2)),
      },
      recommendation,
      rationale,
      memorySavings: {
        halfvec: `${Math.round((1 - halfvecIndexGB / float32IndexGB) * 100)}%`,
        binary:  `${Math.round((1 - binaryIndexGB  / float32IndexGB) * 100)}%`,
      },
    };
  }

  /**
   * Check index health — fragmentation, age, stale statistics.
   *
   * @param {string} tableName
   * @returns {Promise<IndexHealthReport>}
   */
  async checkIndexHealth(tableName) {
    const issues  = [];
    const healthy = [];

    // Check index bloat via pgstattuple if available
    let bloatInfo;
    try {
      const bloatResult = await this.pool.query(`
        SELECT
          i.relname         AS index_name,
          s.avg_leaf_density,
          s.dead_leaf_pages,
          s.empty_leaf_pages,
          s.internal_pages,
          s.leaf_pages,
          CASE
            WHEN s.leaf_pages > 0
            THEN ROUND((s.dead_leaf_pages::numeric / s.leaf_pages) * 100, 2)
            ELSE 0
          END               AS dead_leaf_pct
        FROM pg_indexes idx
        JOIN pg_class i    ON i.relname = idx.indexname
        JOIN pg_namespace n ON n.nspname = idx.schemaname AND n.oid = i.relnamespace,
        LATERAL pgstattuple(i.oid) s
        WHERE idx.schemaname = $1 AND idx.tablename = $2
      `, [this.schema, tableName]);
      bloatInfo = bloatResult.rows;
    } catch {
      bloatInfo = [];  // pgstattuple not available
    }

    // Check index scan activity
    const scanResult = await this.pool.query(`
      SELECT
        indexrelname                              AS index_name,
        idx_scan                                  AS scans,
        idx_tup_read                              AS tuples_read,
        idx_blks_read                             AS blocks_read_from_disk,
        idx_blks_hit                              AS blocks_from_cache,
        ROUND(
          CASE WHEN (idx_blks_read + idx_blks_hit) > 0
               THEN idx_blks_hit::numeric / (idx_blks_read + idx_blks_hit) * 100
               ELSE 100
          END, 2
        )                                         AS cache_hit_pct
      FROM pg_stat_user_indexes
      WHERE schemaname = $1 AND relname = $2
    `, [this.schema, tableName]);

    for (const idx of scanResult.rows) {
      if (idx.cache_hit_pct < 80) {
        issues.push({
          index:    idx.index_name,
          severity: 'warning',
          type:     'low_cache_hit',
          message:  `Index ${idx.index_name} has ${idx.cache_hit_pct}% cache hit rate (<80%). Consider increasing shared_buffers or effective_cache_size.`,
        });
      } else {
        healthy.push({ index: idx.index_name, type: 'cache_hit', value: idx.cache_hit_pct });
      }

      if (idx.scans === 0) {
        issues.push({
          index:    idx.index_name,
          severity: 'info',
          type:     'unused',
          message:  `Index ${idx.index_name} has 0 scans. Safe to drop if not used for constraint enforcement.`,
        });
      }
    }

    for (const bloat of bloatInfo) {
      if (bloat.dead_leaf_pct > BLOAT_THRESHOLD * 100) {
        issues.push({
          index:    bloat.index_name,
          severity: 'warning',
          type:     'bloat',
          message:  `Index ${bloat.index_name} has ${bloat.dead_leaf_pct}% dead leaf pages. REINDEX CONCURRENTLY recommended.`,
          action:   `REINDEX INDEX CONCURRENTLY ${this.schema}.${bloat.index_name};`,
        });
      }
    }

    // Check table's last vacuum/analyze
    const vacuumResult = await this.pool.query(`
      SELECT
        last_vacuum,
        last_autovacuum,
        last_analyze,
        n_dead_tup,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = $1 AND relname = $2
    `, [this.schema, tableName]);

    if (vacuumResult.rows.length > 0) {
      const row = vacuumResult.rows[0];
      const lastVacuum = row.last_autovacuum ?? row.last_vacuum;
      if (lastVacuum) {
        const hoursSinceVacuum = (Date.now() - new Date(lastVacuum).getTime()) / 3_600_000;
        if (hoursSinceVacuum > 24) {
          issues.push({
            type:     'stale_vacuum',
            severity: 'info',
            message:  `Table ${tableName} last vacuumed ${hoursSinceVacuum.toFixed(0)} hours ago. Schedule VACUUM ANALYZE.`,
            action:   `VACUUM ANALYZE ${this.schema}.${tableName};`,
          });
        }
      }
    }

    return {
      tableName,
      timestamp:  new Date().toISOString(),
      healthy,
      issues,
      status: issues.some(i => i.severity === 'critical') ? 'critical'
            : issues.some(i => i.severity === 'warning')  ? 'warning'
            : 'healthy',
    };
  }

  /**
   * Detect memory pressure and suggest configuration changes.
   *
   * @returns {Promise<MemoryPressureReport>}
   */
  async detectMemoryPressure() {
    const result = await this.pool.query(`
      SELECT
        setting AS shared_buffers_pages,
        setting::bigint * 8192 / 1024 / 1024 / 1024 AS shared_buffers_gb
      FROM pg_settings WHERE name = 'shared_buffers'
    `);

    const bgWriter = await this.pool.query(`
      SELECT
        buffers_alloc,
        buffers_clean,
        buffers_checkpoint,
        maxwritten_clean
      FROM pg_stat_bgwriter
    `);

    const bw = bgWriter.rows[0];
    const sharedBuffersGB = parseFloat(result.rows[0]?.shared_buffers_gb ?? 0);

    const suggestions = [];

    // High maxwritten_clean indicates memory pressure (bgwriter can't keep up)
    if (bw?.maxwritten_clean > 0) {
      suggestions.push({
        setting: 'bgwriter_lru_maxpages',
        current: null,
        suggested: '200',
        reason: `maxwritten_clean=${bw.maxwritten_clean} indicates bgwriter is throttled by lru_maxpages. Increasing allows more buffers to be cleaned per cycle.`,
      });
    }

    // Low shared_buffers for vector workloads
    if (sharedBuffersGB < 4) {
      suggestions.push({
        setting: 'shared_buffers',
        current: `${sharedBuffersGB.toFixed(1)}GB`,
        suggested: '8GB',
        reason: 'Vector workloads benefit from large shared_buffers to keep HNSW graph pages in memory. Recommend 25% of total RAM.',
      });
    }

    const pressure = bw?.maxwritten_clean > 10
      ? 'high'
      : bw?.maxwritten_clean > 0 ? 'moderate' : 'low';

    return {
      pressure,
      sharedBuffersGB,
      bgWriterStats: bw,
      suggestions,
    };
  }

  /**
   * Get all pending recommendations.
   * @returns {Recommendation[]}
   */
  getRecommendations() {
    return [...this._recommendations];
  }

  /**
   * Get recent slow queries.
   * @returns {SlowQuery[]}
   */
  getSlowQueries() {
    return [...this._slowQueries];
  }

  /**
   * Get monitoring stats.
   * @returns {object}
   */
  getStats() {
    return {
      ...this._stats,
      historyDepth:   this._history.length,
      running:        this._running,
      pendingAlerts:  this._recommendations.filter(r => r.severity !== 'info').length,
    };
  }

  /**
   * Get the last N monitoring snapshots.
   * @param {number} [n=10]
   * @returns {object[]}
   */
  getHistory(n = 10) {
    return this._history.slice(-n);
  }

  /**
   * Auto-schedule VACUUM ANALYZE for tables with high dead tuple ratios.
   * Requires SUPERUSER or appropriate VACUUM privilege.
   *
   * @param {object} [options]
   * @param {number} [options.deadTupleThreshold=0.1]
   * @param {boolean} [options.dryRun=false]
   * @returns {Promise<{vacuumed: string[], skipped: string[]}>}
   */
  async autoVacuumScheduler(options = {}) {
    const threshold = options.deadTupleThreshold ?? DEAD_TUPLE_RATIO;
    const dryRun    = options.dryRun ?? false;

    const tableStats = await this._collectTableStats();
    const vacuumed   = [];
    const skipped    = [];

    for (const table of tableStats) {
      if (parseFloat(table.dead_tuple_ratio) > threshold) {
        if (!dryRun) {
          try {
            await this.pool.query(`VACUUM ANALYZE ${this.schema}.${table.table_name}`);
            vacuumed.push(table.table_name);
            this._stats.vacuumsTriggered++;
            this.logger.info(`[VectorOptimizer] VACUUM ANALYZE completed for ${table.table_name}`);
          } catch (err) {
            this.logger.error(`[VectorOptimizer] VACUUM failed for ${table.table_name}:`, err.message);
          }
        } else {
          vacuumed.push(table.table_name);
          this.logger.info(`[VectorOptimizer] DRY RUN: Would VACUUM ANALYZE ${table.table_name} (dead_tuple_ratio=${table.dead_tuple_ratio})`);
        }
      } else {
        skipped.push(table.table_name);
      }
    }

    return { vacuumed, skipped };
  }

  /**
   * Generate a full optimization report for all monitored tables.
   * @returns {Promise<OptimizationReport>}
   */
  async generateReport() {
    const report = {
      timestamp:       new Date().toISOString(),
      tables:          {},
      memoryPressure:  null,
      recommendations: [],
      slowQueries:     this._slowQueries.slice(0, 10),
    };

    // Parallel analysis
    const [memPressure, ...tableAnalyses] = await Promise.allSettled([
      this.detectMemoryPressure(),
      ...this.vectorTables.map(t => Promise.all([
        this.getIndexRecommendation(t),
        this.getQuantizationAdvice(t),
        this.checkIndexHealth(t),
      ])),
    ]);

    if (memPressure.status === 'fulfilled') {
      report.memoryPressure = memPressure.value;
    }

    for (let i = 0; i < this.vectorTables.length; i++) {
      const analysis = tableAnalyses[i];
      if (analysis.status === 'fulfilled') {
        const [indexRec, quantRec, healthRep] = analysis.value;
        report.tables[this.vectorTables[i]] = {
          indexRecommendation:       indexRec,
          quantizationRecommendation: quantRec,
          healthReport:              healthRep,
        };
        report.recommendations.push(...(healthRep.issues ?? []));
      }
    }

    return report;
  }
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * @typedef {object} IndexRecommendation
 * @property {string}   tableName
 * @property {string}   columnName
 * @property {number}   vectorCount
 * @property {string}   recommendation — 'brute_force'|'hnsw_small'|'hnsw_medium'|'hnsw_large'|'hnsw_with_halfvec'|'hnsw_with_binary'|'pgvectorscale_or_dedicated'
 * @property {string}   reason
 * @property {string}   priority — 'low'|'medium'|'high'|'critical'
 * @property {string[]} actions — SQL statements to implement
 * @property {object}   currentState
 * @property {object}   [hnswParams]
 */

/**
 * @typedef {object} QuantizationRecommendation
 * @property {string}   tableName
 * @property {number}   vectorCount
 * @property {number}   dimensions
 * @property {number}   tableSizeGB
 * @property {object}   estimates
 * @property {string}   recommendation — 'float32'|'halfvec'|'binary_with_rerank'|'pgvectorscale'
 * @property {string}   rationale
 * @property {object}   memorySavings
 */

/**
 * @typedef {object} IndexHealthReport
 * @property {string}   tableName
 * @property {string}   timestamp
 * @property {object[]} healthy
 * @property {object[]} issues
 * @property {string}   status — 'healthy'|'warning'|'critical'
 */

/**
 * @typedef {object} MemoryPressureReport
 * @property {string}   pressure — 'low'|'moderate'|'high'
 * @property {number}   sharedBuffersGB
 * @property {object}   bgWriterStats
 * @property {object[]} suggestions
 */

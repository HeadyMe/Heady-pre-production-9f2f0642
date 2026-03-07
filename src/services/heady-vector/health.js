'use strict';

/**
 * HeadyVector Health Checker
 * Exposes DB connectivity, index status, and query latency checks.
 */

const config = require('./config');

class HealthChecker {
  /**
   * @param {import('pg').Pool} pool
   * @param {import('./indexes').IndexManager} indexManager
   */
  constructor(pool, indexManager) {
    this.pool = pool;
    this.indexManager = indexManager;
    this._lastCheck = null;
    this._checkInterval = 15000; // Cache health for 15s
  }

  /**
   * Full health check.
   * @returns {Promise<object>}
   */
  async check() {
    const now = Date.now();

    // Return cached result within interval
    if (this._lastCheck && now - this._lastCheck.timestamp < this._checkInterval) {
      return this._lastCheck;
    }

    const checks = await Promise.allSettled([
      this._checkDatabase(),
      this._checkIndexes(),
      this._checkQueryLatency(),
      this._checkTableSizes(),
    ]);

    const [dbCheck, indexCheck, latencyCheck, sizeCheck] = checks.map((c) =>
      c.status === 'fulfilled' ? c.value : { status: 'error', error: c.reason?.message }
    );

    const allOk = [dbCheck, indexCheck, latencyCheck, sizeCheck].every(
      (c) => c.status === 'ok'
    );

    const result = {
      status: allOk ? 'healthy' : 'degraded',
      ready: dbCheck.status === 'ok',
      timestamp: new Date().toISOString(),
      service: config.serviceName,
      version: config.version,
      checks: {
        database: dbCheck,
        indexes: indexCheck,
        queryLatency: latencyCheck,
        tableSizes: sizeCheck,
      },
      pool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      },
    };

    this._lastCheck = { ...result, timestamp_ms: now };
    return result;
  }

  /**
   * Check PostgreSQL connectivity and pgvector extension.
   * @private
   */
  async _checkDatabase() {
    const start = Date.now();
    try {
      const client = await this.pool.connect();
      try {
        const [pingResult, extensionResult] = await Promise.all([
          client.query('SELECT 1 AS ok'),
          client.query(
            `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
          ),
        ]);

        const pgvectorInstalled = extensionResult.rows.length > 0;
        const pgvectorVersion = extensionResult.rows[0]?.extversion || null;

        return {
          status: 'ok',
          latencyMs: Date.now() - start,
          pgvector: pgvectorInstalled,
          pgvectorVersion,
        };
      } finally {
        client.release();
      }
    } catch (err) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Check index health across all collections.
   * @private
   */
  async _checkIndexes() {
    const start = Date.now();
    try {
      const result = await this.pool.query(`
        SELECT
          i.indexname,
          i.indexdef,
          s.idx_scan AS total_scans,
          pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
        FROM pg_indexes i
        LEFT JOIN pg_stat_user_indexes s
          ON s.indexrelname = i.indexname AND s.relname = i.tablename
        WHERE i.tablename IN ('heady_vectors', 'heady_graph_nodes')
          AND i.indexname LIKE 'heady_%'
        ORDER BY i.indexname
      `);

      // Check for invalid indexes
      const invalidResult = await this.pool.query(`
        SELECT relname, indisvalid
        FROM pg_index pi
        JOIN pg_class pc ON pc.oid = pi.indexrelid
        WHERE NOT pi.indisvalid
          AND pc.relname LIKE 'heady_%'
      `);

      return {
        status: invalidResult.rows.length > 0 ? 'degraded' : 'ok',
        indexCount: result.rows.length,
        invalidIndexes: invalidResult.rows.map((r) => r.relname),
        indexes: result.rows,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Check recent average query latency.
   * @private
   */
  async _checkQueryLatency() {
    const start = Date.now();
    try {
      const result = await this.pool.query(`
        SELECT
          query_type,
          COUNT(*) AS count,
          AVG(latency_ms)::numeric(10,2) AS avg_ms,
          MAX(latency_ms)::numeric(10,2) AS max_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
        FROM heady_query_metrics
        WHERE created_at > NOW() - INTERVAL '5 minutes'
        GROUP BY query_type
        ORDER BY query_type
      `);

      const slowThreshold = config.metrics.slowQueryThreshold;
      const hasSlowQueries = result.rows.some((r) => r.p95_ms > slowThreshold);

      return {
        status: hasSlowQueries ? 'degraded' : 'ok',
        recentQueries: result.rows,
        slowQueryThreshold: slowThreshold,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        status: 'ok', // Non-critical if metrics table empty
        latencyMs: Date.now() - start,
        note: 'No recent query metrics',
      };
    }
  }

  /**
   * Check table sizes and vector counts.
   * @private
   */
  async _checkTableSizes() {
    const start = Date.now();
    try {
      const result = await this.pool.query(`
        SELECT
          (SELECT COUNT(*) FROM heady_collections) AS collection_count,
          (SELECT COUNT(*) FROM heady_vectors) AS vector_count,
          (SELECT COUNT(*) FROM heady_graph_nodes) AS node_count,
          (SELECT COUNT(*) FROM heady_graph_edges) AS edge_count,
          pg_size_pretty(pg_total_relation_size('heady_vectors')) AS vectors_table_size,
          pg_size_pretty(pg_total_relation_size('heady_graph_nodes')) AS graph_nodes_size
      `);

      return {
        status: 'ok',
        ...result.rows[0],
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        status: 'error',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Minimal liveness probe (just pings the DB).
   * @returns {Promise<boolean>}
   */
  async isAlive() {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Readiness probe (DB + pgvector available).
   * @returns {Promise<boolean>}
   */
  async isReady() {
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
      );
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}

module.exports = { HealthChecker };

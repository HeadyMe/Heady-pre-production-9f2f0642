'use strict';

/**
 * HeadyVector Migration System
 * Auto-runs on startup, tracks versions in PostgreSQL.
 * Each migration is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
 */

const config = require('./config');

// ─── Migration definitions ────────────────────────────────────────────────────
// Ordered array; never remove or reorder. Add new entries at the end.

const MIGRATIONS = [
  {
    version: 1,
    name: 'create_pgvector_extension',
    up: `CREATE EXTENSION IF NOT EXISTS vector;`,
  },
  {
    version: 2,
    name: 'create_pg_trgm_extension',
    up: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  },
  {
    version: 3,
    name: 'create_collections_table',
    up: `
      CREATE TABLE IF NOT EXISTS heady_collections (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT        NOT NULL UNIQUE,
        dimension     INTEGER     NOT NULL DEFAULT 384,
        description   TEXT,
        metadata_schema JSONB,
        hnsw_m        INTEGER     NOT NULL DEFAULT 16,
        hnsw_ef_construction INTEGER NOT NULL DEFAULT 200,
        hnsw_ef_search INTEGER     NOT NULL DEFAULT 100,
        index_type    TEXT        NOT NULL DEFAULT 'hnsw' CHECK (index_type IN ('hnsw', 'ivfflat', 'none')),
        distance_metric TEXT      NOT NULL DEFAULT 'cosine' CHECK (distance_metric IN ('cosine', 'l2', 'ip')),
        access_roles  TEXT[]      NOT NULL DEFAULT ARRAY['*'],
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_heady_collections_name
        ON heady_collections (name);
    `,
  },
  {
    version: 4,
    name: 'create_vectors_table',
    up: `
      CREATE TABLE IF NOT EXISTS heady_vectors (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID        NOT NULL REFERENCES heady_collections(id) ON DELETE CASCADE,
        namespace     TEXT        NOT NULL DEFAULT 'default',
        external_id   TEXT,
        embedding     vector(384),
        embedding_768 vector(768),
        dimension     INTEGER     NOT NULL DEFAULT 384,
        content       TEXT,
        content_tsv   TSVECTOR    GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content, ''))) STORED,
        metadata      JSONB       NOT NULL DEFAULT '{}',
        score         FLOAT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (collection_id, namespace, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_heady_vectors_collection_ns
        ON heady_vectors (collection_id, namespace);

      CREATE INDEX IF NOT EXISTS idx_heady_vectors_external_id
        ON heady_vectors (external_id)
        WHERE external_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_heady_vectors_metadata
        ON heady_vectors USING GIN (metadata);

      CREATE INDEX IF NOT EXISTS idx_heady_vectors_content_tsv
        ON heady_vectors USING GIN (content_tsv);

      CREATE INDEX IF NOT EXISTS idx_heady_vectors_created_at
        ON heady_vectors (created_at DESC);
    `,
  },
  {
    version: 5,
    name: 'create_graph_tables',
    up: `
      CREATE TABLE IF NOT EXISTS heady_graph_nodes (
        id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID  REFERENCES heady_collections(id) ON DELETE CASCADE,
        node_type   TEXT    NOT NULL CHECK (node_type IN ('document','chunk','entity','concept','custom')),
        label       TEXT    NOT NULL,
        content     TEXT,
        properties  JSONB   NOT NULL DEFAULT '{}',
        embedding   vector(384),
        embedding_768 vector(768),
        content_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content, COALESCE(label, '')))) STORED,
        community_id INTEGER,
        page_rank   FLOAT   DEFAULT 0.0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_type
        ON heady_graph_nodes (node_type);

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_label
        ON heady_graph_nodes (label);

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_collection
        ON heady_graph_nodes (collection_id);

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_community
        ON heady_graph_nodes (community_id);

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_properties
        ON heady_graph_nodes USING GIN (properties);

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_tsv
        ON heady_graph_nodes USING GIN (content_tsv);

      CREATE TABLE IF NOT EXISTS heady_graph_edges (
        id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id     UUID    NOT NULL REFERENCES heady_graph_nodes(id) ON DELETE CASCADE,
        target_id     UUID    NOT NULL REFERENCES heady_graph_nodes(id) ON DELETE CASCADE,
        edge_type     TEXT    NOT NULL CHECK (edge_type IN ('references','contains','related_to','derived_from','mentions','co_occurs','custom')),
        label         TEXT,
        weight        FLOAT   NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
        properties    JSONB   NOT NULL DEFAULT '{}',
        bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source_id, target_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_graph_edges_source
        ON heady_graph_edges (source_id);

      CREATE INDEX IF NOT EXISTS idx_graph_edges_target
        ON heady_graph_edges (target_id);

      CREATE INDEX IF NOT EXISTS idx_graph_edges_type
        ON heady_graph_edges (edge_type);

      CREATE INDEX IF NOT EXISTS idx_graph_edges_weight
        ON heady_graph_edges (weight DESC);
    `,
  },
  {
    version: 6,
    name: 'create_query_metrics_table',
    up: `
      CREATE TABLE IF NOT EXISTS heady_query_metrics (
        id            BIGSERIAL   PRIMARY KEY,
        collection_id UUID        REFERENCES heady_collections(id) ON DELETE SET NULL,
        query_type    TEXT        NOT NULL,
        latency_ms    FLOAT       NOT NULL,
        results_count INTEGER     NOT NULL DEFAULT 0,
        error         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_query_metrics_collection
        ON heady_query_metrics (collection_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_query_metrics_type
        ON heady_query_metrics (query_type, created_at DESC);
    `,
  },
  {
    version: 7,
    name: 'create_updated_at_trigger',
    up: `
      CREATE OR REPLACE FUNCTION heady_update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_collections_updated_at ON heady_collections;
      CREATE TRIGGER trg_collections_updated_at
        BEFORE UPDATE ON heady_collections
        FOR EACH ROW EXECUTE FUNCTION heady_update_updated_at();

      DROP TRIGGER IF EXISTS trg_vectors_updated_at ON heady_vectors;
      CREATE TRIGGER trg_vectors_updated_at
        BEFORE UPDATE ON heady_vectors
        FOR EACH ROW EXECUTE FUNCTION heady_update_updated_at();

      DROP TRIGGER IF EXISTS trg_graph_nodes_updated_at ON heady_graph_nodes;
      CREATE TRIGGER trg_graph_nodes_updated_at
        BEFORE UPDATE ON heady_graph_nodes
        FOR EACH ROW EXECUTE FUNCTION heady_update_updated_at();
    `,
  },
  {
    version: 8,
    name: 'create_hnsw_indexes_default_collection',
    up: `
      -- HNSW indexes are created per-collection dynamically.
      -- This migration creates a placeholder to track the version.
      -- Actual HNSW index creation is handled by indexes.js.
      SELECT 1;
    `,
  },
  {
    version: 9,
    name: 'add_collection_stats_view',
    up: `
      CREATE OR REPLACE VIEW heady_collection_stats AS
      SELECT
        c.id,
        c.name,
        c.dimension,
        c.index_type,
        c.distance_metric,
        COUNT(v.id) AS vector_count,
        pg_size_pretty(pg_total_relation_size('heady_vectors')) AS table_size,
        AVG(qm.latency_ms) AS avg_query_latency_ms,
        MAX(qm.latency_ms) AS max_query_latency_ms,
        c.created_at,
        c.updated_at
      FROM heady_collections c
      LEFT JOIN heady_vectors v ON v.collection_id = c.id
      LEFT JOIN heady_query_metrics qm ON qm.collection_id = c.id
      GROUP BY c.id, c.name, c.dimension, c.index_type, c.distance_metric, c.created_at, c.updated_at;
    `,
  },
  {
    version: 10,
    name: 'add_community_detection_table',
    up: `
      CREATE TABLE IF NOT EXISTS heady_graph_communities (
        id            INTEGER     PRIMARY KEY,
        collection_id UUID        REFERENCES heady_collections(id) ON DELETE CASCADE,
        label         TEXT,
        summary       TEXT,
        node_count    INTEGER     NOT NULL DEFAULT 0,
        properties    JSONB       NOT NULL DEFAULT '{}',
        centroid      vector(384),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_communities_collection
        ON heady_graph_communities (collection_id);
    `,
  },
];

// ─── Migration runner ─────────────────────────────────────────────────────────

class MigrationRunner {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.tableName = config.migrations.tableName;
  }

  /**
   * Ensure the migrations tracking table exists.
   */
  async ensureMigrationsTable(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        version     INTEGER     PRIMARY KEY,
        name        TEXT        NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duration_ms FLOAT
      );
    `);
  }

  /**
   * Get the current max applied migration version.
   * @param {import('pg').PoolClient} client
   * @returns {Promise<number>}
   */
  async getCurrentVersion(client) {
    const result = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS version FROM ${this.tableName}`
    );
    return parseInt(result.rows[0].version, 10);
  }

  /**
   * Run all pending migrations inside a serialized advisory lock.
   * @returns {Promise<{applied: number[], skipped: number[]}>}
   */
  async runAll() {
    const client = await this.pool.connect();
    try {
      // Advisory lock to prevent concurrent migration runs
      await client.query('SELECT pg_advisory_lock(987654321)');

      await this.ensureMigrationsTable(client);
      const currentVersion = await this.getCurrentVersion(client);

      const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
      const applied = [];
      const skipped = [];

      if (pending.length === 0) {
        console.log(`[migrations] All ${MIGRATIONS.length} migrations already applied (current v${currentVersion})`);
      }

      for (const migration of pending) {
        const start = Date.now();
        try {
          await client.query('BEGIN');
          await client.query(migration.up);
          await client.query(
            `INSERT INTO ${this.tableName} (version, name, duration_ms)
             VALUES ($1, $2, $3)
             ON CONFLICT (version) DO NOTHING`,
            [migration.version, migration.name, Date.now() - start]
          );
          await client.query('COMMIT');
          applied.push(migration.version);
          console.log(
            `[migrations] Applied v${migration.version}: ${migration.name} (${Date.now() - start}ms)`
          );
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(
            `Migration v${migration.version} "${migration.name}" failed: ${err.message}`
          );
        }
      }

      // Release advisory lock
      await client.query('SELECT pg_advisory_unlock(987654321)');

      // Mark skipped (already applied)
      MIGRATIONS.filter((m) => m.version <= currentVersion).forEach((m) =>
        skipped.push(m.version)
      );

      return { applied, skipped };
    } finally {
      client.release();
    }
  }

  /**
   * Get migration status.
   * @returns {Promise<Array<{version, name, applied_at, duration_ms, pending}>>}
   */
  async getStatus() {
    const client = await this.pool.connect();
    try {
      await this.ensureMigrationsTable(client);
      const result = await client.query(
        `SELECT version, name, applied_at, duration_ms FROM ${this.tableName} ORDER BY version`
      );
      const appliedVersions = new Set(result.rows.map((r) => r.version));

      return MIGRATIONS.map((m) => ({
        version: m.version,
        name: m.name,
        applied: appliedVersions.has(m.version),
        ...(result.rows.find((r) => r.version === m.version) || {}),
      }));
    } finally {
      client.release();
    }
  }
}

module.exports = { MigrationRunner, MIGRATIONS };

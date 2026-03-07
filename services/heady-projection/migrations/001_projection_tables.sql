-- © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.
--
-- Heady™ Projection Service — Database Migration 001
-- Creates the core persistence tables for projection state, history, and metrics.
--
-- Requires: PostgreSQL 14+
-- Extension: btree_gin (for JSONB indexing)
--
-- Run: psql -d heady_db -f migrations/001_projection_tables.sql
-- Rollback: migrations/001_projection_tables.rollback.sql

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- GIN index on JSONB

-- ── Enum type for projection domains ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE projection_domain AS ENUM (
    'vector-memory',
    'config',
    'health',
    'telemetry',
    'topology',
    'task-queue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: projections
-- The live, current state of each projection domain.
-- One row per domain — upserted on every bee cycle.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projections (
  -- Unique identifier for this projection row
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Projection domain key (e.g. 'vector-memory', 'health')
  type          projection_domain NOT NULL UNIQUE,

  -- Monotonically increasing version — incremented on every update
  version       BIGINT      NOT NULL DEFAULT 1
                            CONSTRAINT projections_version_positive CHECK (version > 0),

  -- Full projection state as JSONB — schema varies by domain
  state         JSONB       NOT NULL DEFAULT '{}',

  -- Timestamp of the most recent state update
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamp of initial row creation
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  projections              IS 'Live projection state — one row per domain, continuously overwritten.';
COMMENT ON COLUMN projections.id           IS 'UUID primary key.';
COMMENT ON COLUMN projections.type         IS 'Projection domain name (vector-memory|config|health|telemetry|topology|task-queue).';
COMMENT ON COLUMN projections.version      IS 'Monotonically increasing version counter. Useful for optimistic concurrency checks.';
COMMENT ON COLUMN projections.state        IS 'Domain-specific JSONB payload. Schema documented in docs/PROJECTION-TYPES.md.';
COMMENT ON COLUMN projections.updated_at   IS 'Timestamp of the last write. Used for staleness checks.';
COMMENT ON COLUMN projections.created_at   IS 'Timestamp of first INSERT.';

-- Indexes on projections
CREATE INDEX IF NOT EXISTS idx_projections_type       ON projections (type);
CREATE INDEX IF NOT EXISTS idx_projections_updated_at ON projections (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projections_state_gin  ON projections USING GIN (state);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: projection_history
-- Immutable audit log of every projection state change.
-- Append-only — never UPDATE or DELETE.
-- Supports drift analysis and time-travel queries.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projection_history (
  -- Unique identifier for this history entry
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the live projection row
  projection_id   UUID        NOT NULL
                              REFERENCES projections(id) ON DELETE CASCADE,

  -- Domain (denormalised for query convenience)
  type            projection_domain NOT NULL,

  -- Version at the time of this snapshot
  version         BIGINT      NOT NULL
                              CONSTRAINT history_version_positive CHECK (version > 0),

  -- Full state snapshot at this point in time
  state           JSONB       NOT NULL,

  -- Timestamp when this snapshot was taken
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  projection_history                 IS 'Immutable append-only history of all projection state changes. Never update or delete rows.';
COMMENT ON COLUMN projection_history.id              IS 'UUID primary key for this history entry.';
COMMENT ON COLUMN projection_history.projection_id   IS 'FK → projections.id. Cascade-deletes history when a projection row is removed.';
COMMENT ON COLUMN projection_history.type            IS 'Denormalised domain name for efficient filtering without JOIN.';
COMMENT ON COLUMN projection_history.version         IS 'Projection version at snapshot time. Matches projections.version.';
COMMENT ON COLUMN projection_history.state           IS 'Full JSONB state snapshot at this point in history.';
COMMENT ON COLUMN projection_history.snapshot_at     IS 'Wall-clock timestamp of this history entry. Used for time-travel queries.';

-- Indexes on projection_history
CREATE INDEX IF NOT EXISTS idx_ph_projection_id  ON projection_history (projection_id);
CREATE INDEX IF NOT EXISTS idx_ph_type           ON projection_history (type);
CREATE INDEX IF NOT EXISTS idx_ph_snapshot_at    ON projection_history (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_ph_version        ON projection_history (version);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: projection_metrics
-- Time-series metric samples collected by bee workers.
-- Lightweight schema — one row per metric observation.
-- For heavy time-series workloads consider migrating to TimescaleDB.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projection_metrics (
  -- Unique identifier for this metric sample
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Projection domain this metric belongs to
  type          projection_domain NOT NULL,

  -- Metric name (e.g. 'cpu_percent', 'queue_depth', 'drift_score')
  metric_name   TEXT        NOT NULL
                            CONSTRAINT metrics_name_nonempty CHECK (char_length(metric_name) > 0),

  -- Numeric value of the metric sample
  value         DOUBLE PRECISION NOT NULL,

  -- Optional unit annotation (e.g. 'percent', 'ms', 'count')
  unit          TEXT,

  -- Optional key=value tags as JSONB (e.g. {"instance": "us-central1-a"})
  tags          JSONB       NOT NULL DEFAULT '{}',

  -- Timestamp when this metric was recorded
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  projection_metrics              IS 'Time-series metric samples from projection bee workers.';
COMMENT ON COLUMN projection_metrics.id           IS 'UUID primary key.';
COMMENT ON COLUMN projection_metrics.type         IS 'Projection domain for this metric.';
COMMENT ON COLUMN projection_metrics.metric_name  IS 'Metric identifier (e.g. cpu_percent, drift_score, queue_depth).';
COMMENT ON COLUMN projection_metrics.value        IS 'Numeric metric value at sample time.';
COMMENT ON COLUMN projection_metrics.unit         IS 'Optional unit annotation: percent, ms, bytes, count, etc.';
COMMENT ON COLUMN projection_metrics.tags         IS 'Optional JSONB labels for multi-dimensional filtering.';
COMMENT ON COLUMN projection_metrics.recorded_at  IS 'Timestamp of sample collection.';

-- Indexes on projection_metrics
CREATE INDEX IF NOT EXISTS idx_pm_type          ON projection_metrics (type);
CREATE INDEX IF NOT EXISTS idx_pm_metric_name   ON projection_metrics (metric_name);
CREATE INDEX IF NOT EXISTS idx_pm_recorded_at   ON projection_metrics (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_type_name     ON projection_metrics (type, metric_name);
CREATE INDEX IF NOT EXISTS idx_pm_tags_gin      ON projection_metrics USING GIN (tags);

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: upsert_projection
-- Helper function for atomic upsert of a projection + append to history.
-- Usage: SELECT upsert_projection('health', '{"overallScore": 0.95}'::jsonb);
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_projection(
  p_type  projection_domain,
  p_state JSONB
)
RETURNS projections AS $$
DECLARE
  v_row projections;
BEGIN
  INSERT INTO projections (type, version, state, updated_at)
  VALUES (p_type, 1, p_state, NOW())
  ON CONFLICT (type) DO UPDATE
    SET version    = projections.version + 1,
        state      = EXCLUDED.state,
        updated_at = NOW()
  RETURNING * INTO v_row;

  -- Append to history
  INSERT INTO projection_history (projection_id, type, version, state, snapshot_at)
  VALUES (v_row.id, v_row.type, v_row.version, v_row.state, NOW());

  RETURN v_row;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_projection IS
  'Atomically upserts a projection and appends a history snapshot. '
  'Usage: SELECT upsert_projection(''health'', ''{...}''::jsonb);';

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEW: latest_projections
-- Convenience view returning all current projection states with age.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW latest_projections AS
SELECT
  id,
  type,
  version,
  state,
  updated_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) * 1000 AS age_ms,
  CASE
    WHEN (NOW() - updated_at) < INTERVAL '30 seconds' THEN 'live'
    WHEN (NOW() - updated_at) < INTERVAL '5 minutes'  THEN 'stale'
    ELSE 'dead'
  END AS freshness
FROM projections
ORDER BY type;

COMMENT ON VIEW latest_projections IS
  'Current projection states with computed age_ms and freshness (live|stale|dead).';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (save separately as 001_projection_tables.rollback.sql)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP VIEW   IF EXISTS latest_projections;
-- DROP FUNCTION IF EXISTS upsert_projection(projection_domain, jsonb);
-- DROP TABLE  IF EXISTS projection_metrics  CASCADE;
-- DROP TABLE  IF EXISTS projection_history  CASCADE;
-- DROP TABLE  IF EXISTS projections         CASCADE;
-- DROP TYPE   IF EXISTS projection_domain;
-- COMMIT;

-- =============================================================================
-- © 2024-2026 HeadySystems Inc. All Rights Reserved.
-- PROPRIETARY AND CONFIDENTIAL.
--
-- Heady™ AI Platform v3.1.0 — Database Initialization
-- Run once on fresh PostgreSQL + pgvector instance.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Vector Memory ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_memory (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace   TEXT         NOT NULL DEFAULT 'default',
    content     TEXT         NOT NULL,
    embedding   vector(1536),
    metadata    JSONB        DEFAULT '{}',
    score       FLOAT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS heady_memory_embedding_idx
    ON heady_memory USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS heady_memory_namespace_idx
    ON heady_memory (namespace);

CREATE INDEX IF NOT EXISTS heady_memory_created_at_idx
    ON heady_memory (created_at DESC);

-- ─── Audit Trail ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_audit (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type  TEXT         NOT NULL,
    actor       TEXT,
    service     TEXT,
    action      TEXT,
    target      TEXT,
    result      TEXT,
    metadata    JSONB        DEFAULT '{}',
    ip_address  INET,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS heady_audit_event_type_idx ON heady_audit (event_type);
CREATE INDEX IF NOT EXISTS heady_audit_actor_idx      ON heady_audit (actor);
CREATE INDEX IF NOT EXISTS heady_audit_service_idx    ON heady_audit (service);
CREATE INDEX IF NOT EXISTS heady_audit_created_at_idx ON heady_audit (created_at DESC);

-- ─── Story (Narrative Log) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_story (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    event       TEXT         NOT NULL,
    narrative   TEXT         NOT NULL,
    context     JSONB        DEFAULT '{}',
    actor       TEXT,
    service     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS heady_story_event_idx      ON heady_story (event);
CREATE INDEX IF NOT EXISTS heady_story_actor_idx      ON heady_story (actor);
CREATE INDEX IF NOT EXISTS heady_story_created_at_idx ON heady_story (created_at DESC);

-- Full-text search on narrative
CREATE INDEX IF NOT EXISTS heady_story_narrative_fts_idx
    ON heady_story USING gin (to_tsvector('english', narrative));

-- ─── Patterns (Vinci) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_patterns (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_key   TEXT         NOT NULL UNIQUE,
    category      TEXT         NOT NULL,
    behavior      TEXT         NOT NULL,
    occurrences   INT          NOT NULL DEFAULT 1,
    severity      FLOAT        DEFAULT 0,
    metadata      JSONB        DEFAULT '{}',
    first_seen    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS heady_patterns_category_idx    ON heady_patterns (category);
CREATE INDEX IF NOT EXISTS heady_patterns_occurrences_idx ON heady_patterns (occurrences DESC);
CREATE INDEX IF NOT EXISTS heady_patterns_last_seen_idx   ON heady_patterns (last_seen DESC);

-- ─── Config KV Store ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_config (
    key         TEXT         PRIMARY KEY,
    value       JSONB        NOT NULL,
    description TEXT,
    updated_by  TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Bee Agents ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_bees (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain      TEXT         NOT NULL,
    status      TEXT         NOT NULL DEFAULT 'spawning',
    task        TEXT,
    result      JSONB,
    config      JSONB        DEFAULT '{}',
    spawned_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS heady_bees_domain_idx ON heady_bees (domain);
CREATE INDEX IF NOT EXISTS heady_bees_status_idx ON heady_bees (status);

-- ─── Budget Tracking ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS heady_budget (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    period       TEXT         NOT NULL,  -- e.g. '2025-01-01'
    category     TEXT         NOT NULL,  -- e.g. 'llm_tokens', 'embedding', 'api'
    tokens_used  BIGINT       NOT NULL DEFAULT 0,
    cost_usd     NUMERIC(10,6) NOT NULL DEFAULT 0,
    request_count INT         NOT NULL DEFAULT 1,
    metadata     JSONB        DEFAULT '{}',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS heady_budget_period_idx   ON heady_budget (period DESC);
CREATE INDEX IF NOT EXISTS heady_budget_category_idx ON heady_budget (category);

-- ─── Update Trigger for updated_at ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_heady_memory_updated_at
    BEFORE UPDATE ON heady_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed: Default Config ─────────────────────────────────────────────────────

INSERT INTO heady_config (key, value, description, updated_by) VALUES
    ('platform.version',         '"3.1.0"',      'Platform version',                 'init'),
    ('conductor.timeout',        '30000',         'Conductor task timeout (ms)',       'init'),
    ('conductor.max_retries',    '3',             'Max conductor retries',            'init'),
    ('pipeline.full_auto',       'false',         'Full-auto pipeline mode',          'init'),
    ('budget.daily_usd',         '100',           'Daily LLM budget in USD',          'init'),
    ('budget.warn_pct',          '80',            'Budget warning threshold (%)',      'init'),
    ('memory.default_limit',     '10',            'Default memory search limit',      'init'),
    ('memory.min_score',         '0.7',           'Default minimum similarity score', 'init'),
    ('bee.max_workers',          '50',            'Max concurrent bee workers',       'init'),
    ('governance.strict_mode',   'false',         'Governance strict mode',           'init')
ON CONFLICT (key) DO NOTHING;

-- Done
SELECT 'Heady™ AI Platform v3.1.0 — Database initialized successfully' AS status;

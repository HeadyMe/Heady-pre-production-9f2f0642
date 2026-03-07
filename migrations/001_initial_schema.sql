-- ============================================================
-- HeadyStack v3.0.1 "Aether" — Initial Schema Migration
-- Migration: 001_initial_schema
-- Applied: 2026-03-07
-- © 2026 HeadySystems Inc. — Proprietary
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(255),
    password_hash VARCHAR(255),                     -- NULL for OAuth-only accounts
    role          VARCHAR(50) NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin', 'moderator', 'service')),
    oauth_provider VARCHAR(50),                     -- 'github', 'google', NULL
    oauth_id       VARCHAR(255),                    -- provider-specific user ID
    avatar_url     VARCHAR(500),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    metadata       JSONB NOT NULL DEFAULT '{}',
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: unique OAuth accounts per provider
CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_unique
    ON users (oauth_provider, oauth_id)
    WHERE oauth_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

-- ── Sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL UNIQUE,     -- SHA-256 of refresh token
    device_info   JSONB NOT NULL DEFAULT '{}',       -- UA, IP, device fingerprint
    ip_address    INET,
    is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- Auto-delete expired sessions (run via cron)
-- DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';

-- ── API Keys ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash      VARCHAR(255) NOT NULL UNIQUE,     -- bcrypt hash of the raw key
    key_prefix    VARCHAR(12) NOT NULL,             -- e.g. "hdy_live_xxxx" (for display)
    name          VARCHAR(255) NOT NULL,
    scopes        TEXT[] NOT NULL DEFAULT '{}',      -- e.g. ['read', 'write', 'admin']
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,                       -- NULL = never expires
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_is_active_idx ON api_keys (is_active) WHERE is_active = TRUE;

-- ── Vector Memories ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vector_memories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace   VARCHAR(255) NOT NULL,               -- 'global', 'user', 'agent', 'document', ...
    key         VARCHAR(500) NOT NULL,               -- unique key within namespace
    vector      vector(384) NOT NULL,                -- 384-dimensional embedding
    metadata    JSONB NOT NULL DEFAULT '{}',          -- arbitrary metadata
    content_preview VARCHAR(500),                    -- first 500 chars of original content
    source      VARCHAR(255),                        -- 'manual', 'pipeline', 'agent', 'file'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one vector per namespace+key combination
CREATE UNIQUE INDEX IF NOT EXISTS vector_memories_ns_key_unique
    ON vector_memories (namespace, key);

-- HNSW index for approximate nearest neighbor search
-- m=16: connections per node, ef_construction=64: build accuracy
CREATE INDEX IF NOT EXISTS vector_memories_hnsw_idx
    ON vector_memories
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- B-tree index for namespace filtering
CREATE INDEX IF NOT EXISTS vector_memories_namespace_idx ON vector_memories (namespace);
CREATE INDEX IF NOT EXISTS vector_memories_source_idx ON vector_memories (source);
CREATE INDEX IF NOT EXISTS vector_memories_created_at_idx ON vector_memories (created_at DESC);

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS vector_memories_metadata_gin_idx
    ON vector_memories USING gin (metadata);

-- ── Pipeline Tasks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    type        VARCHAR(100) NOT NULL,               -- 'chat', 'agent', 'tool', 'batch'
    priority    VARCHAR(20) NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    status      VARCHAR(50) NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    stage       SMALLINT NOT NULL DEFAULT 1
                CHECK (stage BETWEEN 1 AND 12),
    data        JSONB NOT NULL DEFAULT '{}',          -- input payload
    result      JSONB,                                -- output payload
    error       JSONB,                                -- error details on failure
    retry_count SMALLINT NOT NULL DEFAULT 0,
    max_retries SMALLINT NOT NULL DEFAULT 3,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pipeline_tasks_status_priority_idx
    ON pipeline_tasks (status, priority DESC, created_at ASC)
    WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS pipeline_tasks_user_id_idx ON pipeline_tasks (user_id);
CREATE INDEX IF NOT EXISTS pipeline_tasks_created_at_idx ON pipeline_tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS pipeline_tasks_type_idx ON pipeline_tasks (type);

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,              -- high-throughput table, use BIGSERIAL
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(255) NOT NULL,              -- e.g. 'auth.login', 'memory.store', 'agent.spawn'
    resource    VARCHAR(255),                       -- e.g. 'users', 'vector_memories', 'pipeline_tasks'
    resource_id VARCHAR(255),                       -- UUID or key of affected resource
    details     JSONB NOT NULL DEFAULT '{}',         -- additional context
    ip_address  INET,
    user_agent  VARCHAR(500),
    request_id  VARCHAR(255),                       -- correlation ID
    outcome     VARCHAR(20) NOT NULL DEFAULT 'success'
                CHECK (outcome IN ('success', 'failure', 'error')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_request_id_idx ON audit_log (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_resource_idx ON audit_log (resource, resource_id) WHERE resource IS NOT NULL;

-- Partition hint: for production, consider PARTITION BY RANGE (created_at) per month

-- ── Functions & Triggers ──────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER vector_memories_updated_at
    BEFORE UPDATE ON vector_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER pipeline_tasks_updated_at
    BEFORE UPDATE ON pipeline_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Views ─────────────────────────────────────────────────────

-- Active users view (commonly queried)
CREATE OR REPLACE VIEW active_users AS
    SELECT id, email, name, role, last_login_at, created_at
    FROM users
    WHERE is_active = TRUE;

-- Pipeline task queue view
CREATE OR REPLACE VIEW task_queue AS
    SELECT id, type, priority, stage, created_at, retry_count
    FROM pipeline_tasks
    WHERE status IN ('queued', 'processing')
    ORDER BY priority DESC, created_at ASC;

-- ── Seed Data ─────────────────────────────────────────────────

-- Record this migration as applied
INSERT INTO schema_migrations (name) VALUES ('001_initial_schema')
    ON CONFLICT (name) DO NOTHING;

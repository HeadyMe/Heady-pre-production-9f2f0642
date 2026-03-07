-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Heady™ AI Platform — PostgreSQL Schema                             ║
-- ║  © 2026 HeadySystems Inc. — PROPRIETARY AND CONFIDENTIAL           ║
-- ║  Database: Neon Postgres with pgvector extension                    ║
-- ║  Version: 3.1.0                                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector

-- ─── Enumerations ──────────────────────────────────────────────────────────

CREATE TYPE user_tier AS ENUM ('anonymous', 'core', 'premium', 'enterprise', 'admin');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE memory_importance AS ENUM ('ephemeral', 'low', 'medium', 'high', 'critical');
CREATE TYPE pipeline_stage AS ENUM (
    'INTAKE', 'TRIAGE', 'MONTE_CARLO', 'ARENA', 'JUDGE',
    'APPROVE', 'EXECUTE', 'VERIFY', 'RECEIPT'
);
CREATE TYPE pipeline_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE headycoin_tx_type AS ENUM ('mint', 'burn', 'transfer', 'stake', 'unstake', 'reward', 'penalty');
CREATE TYPE audit_action AS ENUM (
    'login', 'logout', 'register', 'api_call', 'data_read', 'data_write',
    'data_delete', 'permission_change', 'secret_access', 'payment', 'admin_action'
);
CREATE TYPE circuit_state AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- ─── Core Tables ────────────────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    username        TEXT UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,
    tier            user_tier NOT NULL DEFAULT 'core',
    password_hash   TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);

-- OAuth Providers (Google, GitHub, Discord, Apple)
CREATE TABLE IF NOT EXISTS oauth_providers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,  -- 'google' | 'github' | 'discord' | 'apple'
    provider_id     TEXT NOT NULL,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires   TIMESTAMPTZ,
    profile_data    JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_providers(provider, provider_id);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT UNIQUE NOT NULL,
    status          session_status NOT NULL DEFAULT 'active',
    ip_address      INET,
    user_agent      TEXT,
    device_id       TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ─── Vector Memory Tables ───────────────────────────────────────────────────

-- Vector memories (384-dim embeddings from sentence-transformers/all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS vector_memories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shard_id        SMALLINT NOT NULL DEFAULT 0 CHECK (shard_id BETWEEN 0 AND 4),
    namespace       TEXT NOT NULL DEFAULT 'default',
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    embedding       vector(384),
    -- 3D spatial coordinates (PCA-lite projection)
    pos_x           FLOAT8 NOT NULL DEFAULT 0,
    pos_y           FLOAT8 NOT NULL DEFAULT 0,
    pos_z           FLOAT8 NOT NULL DEFAULT 0,
    zone            SMALLINT NOT NULL DEFAULT 0 CHECK (zone BETWEEN 0 AND 7),
    importance      memory_importance NOT NULL DEFAULT 'medium',
    -- Importance score components: I(m) = α·Freq + β·e^(-γ·Δt) + δ·Surp
    importance_score FLOAT8 NOT NULL DEFAULT 0.5,
    access_count    INTEGER NOT NULL DEFAULT 0,
    -- STM → LTM consolidation tracking
    is_ltm          BOOLEAN NOT NULL DEFAULT FALSE,
    consolidated_at TIMESTAMPTZ,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    source          TEXT,
    tags            TEXT[] DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  -- NULL = permanent
);

CREATE INDEX IF NOT EXISTS idx_vm_namespace ON vector_memories(namespace);
CREATE INDEX IF NOT EXISTS idx_vm_shard ON vector_memories(shard_id);
CREATE INDEX IF NOT EXISTS idx_vm_zone ON vector_memories(zone);
CREATE INDEX IF NOT EXISTS idx_vm_user ON vector_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_vm_ltm ON vector_memories(is_ltm, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_vm_created ON vector_memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vm_content_hash ON vector_memories(content_hash);
CREATE INDEX IF NOT EXISTS idx_vm_tags ON vector_memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_vm_metadata ON vector_memories USING GIN(metadata);

-- pgvector HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_vm_embedding_hnsw
    ON vector_memories USING hnsw(embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Vector graph edges (Graph RAG relationships)
CREATE TABLE IF NOT EXISTS vector_graph_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id       UUID NOT NULL REFERENCES vector_memories(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES vector_memories(id) ON DELETE CASCADE,
    relation        TEXT NOT NULL,   -- 'caused_by', 'related_to', 'prevents', etc.
    weight          FLOAT8 NOT NULL DEFAULT 1.0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, target_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_vge_source ON vector_graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_vge_target ON vector_graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_vge_relation ON vector_graph_edges(relation);

-- Memory receipts (proof-of-storage audit trail)
CREATE TABLE IF NOT EXISTS memory_receipts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation       TEXT NOT NULL,   -- INGEST | EMBED | STORE | DROP
    memory_id       UUID REFERENCES vector_memories(id) ON DELETE SET NULL,
    source          TEXT,
    source_id       TEXT,
    stored          BOOLEAN NOT NULL DEFAULT TRUE,
    reason          TEXT,
    content_hash    TEXT,
    provider        TEXT,  -- embedding provider used
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mr_memory ON memory_receipts(memory_id);
CREATE INDEX IF NOT EXISTS idx_mr_operation ON memory_receipts(operation);
CREATE INDEX IF NOT EXISTS idx_mr_created ON memory_receipts(created_at DESC);

-- ─── Pipeline Tables ─────────────────────────────────────────────────────────

-- HCFullPipeline runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          TEXT UNIQUE NOT NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    current_stage   pipeline_stage NOT NULL DEFAULT 'INTAKE',
    status          pipeline_status NOT NULL DEFAULT 'pending',
    input_text      TEXT,
    input_hash      TEXT,
    final_output    TEXT,
    output_hash     TEXT,
    stage_results   JSONB NOT NULL DEFAULT '{}',
    monte_carlo     JSONB,       -- MC simulation results
    arena_results   JSONB,       -- Arena battle results
    judge_verdict   JSONB,       -- Judge assessment
    approval_chain  JSONB,       -- Approval signatures
    execution_log   JSONB NOT NULL DEFAULT '[]',
    error           TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pr_run_id ON pipeline_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_pr_user ON pipeline_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pr_stage ON pipeline_runs(current_stage);
CREATE INDEX IF NOT EXISTS idx_pr_started ON pipeline_runs(started_at DESC);

-- ─── Audit Log ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          audit_action NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    ip_address      INET,
    user_agent      TEXT,
    request_id      TEXT,
    outcome         TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'failure' | 'error'
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partition audit logs by month
CREATE TABLE IF NOT EXISTS audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_08 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_09 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_10 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_logs_2026_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs DEFAULT;

CREATE INDEX IF NOT EXISTS idx_al_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_al_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_al_created ON audit_logs(created_at DESC);

-- ─── HeadyCoin Tables ────────────────────────────────────────────────────────

-- HeadyCoin wallets
CREATE TABLE IF NOT EXISTS headycoin_wallets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address         TEXT UNIQUE NOT NULL,  -- wallet address
    balance         NUMERIC(28, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    staked          NUMERIC(28, 8) NOT NULL DEFAULT 0 CHECK (staked >= 0),
    total_earned    NUMERIC(28, 8) NOT NULL DEFAULT 0,
    total_spent     NUMERIC(28, 8) NOT NULL DEFAULT 0,
    is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hcw_user ON headycoin_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_hcw_address ON headycoin_wallets(address);

-- HeadyCoin transactions
CREATE TABLE IF NOT EXISTS headycoin_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash         TEXT UNIQUE NOT NULL,
    from_wallet     TEXT REFERENCES headycoin_wallets(address) ON DELETE SET NULL,
    to_wallet       TEXT REFERENCES headycoin_wallets(address) ON DELETE SET NULL,
    type            headycoin_tx_type NOT NULL,
    amount          NUMERIC(28, 8) NOT NULL CHECK (amount > 0),
    fee             NUMERIC(28, 8) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'confirmed',
    block_number    BIGINT,
    description     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hct_from ON headycoin_transactions(from_wallet);
CREATE INDEX IF NOT EXISTS idx_hct_to ON headycoin_transactions(to_wallet);
CREATE INDEX IF NOT EXISTS idx_hct_type ON headycoin_transactions(type);
CREATE INDEX IF NOT EXISTS idx_hct_created ON headycoin_transactions(created_at DESC);

-- ─── Resilience Tracking ──────────────────────────────────────────────────────

-- Circuit breaker state persistence
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name    TEXT UNIQUE NOT NULL,
    state           circuit_state NOT NULL DEFAULT 'CLOSED',
    failure_count   INTEGER NOT NULL DEFAULT 0,
    success_count   INTEGER NOT NULL DEFAULT 0,
    total_calls     INTEGER NOT NULL DEFAULT 0,
    trip_count      INTEGER NOT NULL DEFAULT 0,
    last_failure    TIMESTAMPTZ,
    last_state_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limit_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key             TEXT NOT NULL,   -- IP or API key
    endpoint        TEXT NOT NULL,
    request_count   INTEGER NOT NULL DEFAULT 1,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    blocked_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (key, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rle_key ON rate_limit_entries(key, endpoint, window_end);

-- ─── Service Registry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name    TEXT UNIQUE NOT NULL,
    version         TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    endpoint        TEXT,
    health_endpoint TEXT,
    capabilities    TEXT[] DEFAULT '{}',
    dependencies    TEXT[] DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    last_heartbeat  TIMESTAMPTZ,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Keys ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash        TEXT UNIQUE NOT NULL,
    key_prefix      TEXT NOT NULL,  -- first 8 chars for display (e.g., "hk_live_")
    name            TEXT NOT NULL,
    scopes          TEXT[] DEFAULT '{}',
    tier            user_tier NOT NULL DEFAULT 'core',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    usage_count     BIGINT NOT NULL DEFAULT 0,
    rate_limit      INTEGER NOT NULL DEFAULT 100,  -- req/min
    expires_at      TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ak_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ak_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_ak_active ON api_keys(is_active);

-- ─── Subscriptions & Billing ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer TEXT,
    stripe_sub_id   TEXT UNIQUE,
    plan            TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
    status          TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    cancel_at       TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_stripe ON subscriptions(stripe_sub_id);

-- ─── Onboarding Progress ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_progress (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step            INTEGER NOT NULL DEFAULT 0,
    completed_steps TEXT[] DEFAULT '{}',
    buddy_name      TEXT,
    use_case        TEXT,
    profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── System Configuration ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_config (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    is_secret       BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auto-update updated_at columns ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'oauth_providers', 'sessions', 'vector_memories',
        'headycoin_wallets', 'subscriptions', 'service_registry',
        'circuit_breaker_states', 'onboarding_progress', 'system_config'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_updated_at_%s ON %I;
             CREATE TRIGGER trg_updated_at_%s
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t, t, t
        );
    END LOOP;
END
$$;

-- ─── Initial Seed Data ─────────────────────────────────────────────────────────

-- Default system config entries
INSERT INTO system_config (key, value, description) VALUES
    ('platform.version', '"3.1.0"', 'Platform version'),
    ('platform.phi', '1.6180339887', 'Golden ratio constant'),
    ('platform.fibonacci_pools', '{"hot":34,"warm":21,"cold":13,"reserve":8,"governance":5}', 'Sacred Geometry resource allocation'),
    ('memory.embedding_dim', '384', 'Default embedding dimensions'),
    ('memory.max_vectors_per_shard', '2000', 'Max vectors per shard'),
    ('memory.num_shards', '5', 'Number of Fibonacci shards'),
    ('resilience.circuit_failure_threshold', '5', 'Circuit breaker failure threshold'),
    ('resilience.circuit_reset_timeout_ms', '30000', 'Circuit breaker reset timeout'),
    ('resilience.backoff_base_ms', '1000', 'Base delay for φ-backoff')
ON CONFLICT (key) DO NOTHING;

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Active users view
CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id, u.email, u.username, u.display_name, u.tier,
    u.is_verified, u.last_seen_at,
    s.id AS active_session_id,
    sub.plan AS subscription_plan,
    hw.balance AS headycoin_balance
FROM users u
LEFT JOIN LATERAL (
    SELECT id FROM sessions
    WHERE user_id = u.id AND status = 'active' AND expires_at > NOW()
    ORDER BY last_activity DESC LIMIT 1
) s ON true
LEFT JOIN subscriptions sub ON sub.user_id = u.id AND sub.status = 'active'
LEFT JOIN headycoin_wallets hw ON hw.user_id = u.id
WHERE u.is_active = TRUE;

-- Vector memory stats view
CREATE OR REPLACE VIEW v_vector_memory_stats AS
SELECT
    namespace,
    shard_id,
    zone,
    COUNT(*) AS vector_count,
    AVG(importance_score) AS avg_importance,
    SUM(access_count) AS total_accesses,
    COUNT(*) FILTER (WHERE is_ltm) AS ltm_count,
    MAX(created_at) AS latest_entry
FROM vector_memories
WHERE (expires_at IS NULL OR expires_at > NOW())
GROUP BY namespace, shard_id, zone;

-- Circuit breaker health view
CREATE OR REPLACE VIEW v_circuit_health AS
SELECT
    service_name,
    state,
    failure_count,
    trip_count,
    CASE
        WHEN state = 'OPEN' THEN 'FAILING'
        WHEN state = 'HALF_OPEN' THEN 'RECOVERING'
        ELSE 'HEALTHY'
    END AS health_status,
    last_failure,
    last_state_change
FROM circuit_breaker_states
ORDER BY
    CASE state WHEN 'OPEN' THEN 0 WHEN 'HALF_OPEN' THEN 1 ELSE 2 END,
    failure_count DESC;

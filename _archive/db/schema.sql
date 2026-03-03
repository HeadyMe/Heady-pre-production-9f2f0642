-- ═══════════════════════════════════════════════════════════════════
-- Heady Platform — Unified PostgreSQL Schema
-- Covers: SPEC-1 (Control Plane), SPEC-3 (Knowledge Vault),
--         SPEC-4 (MCP/Tools), SPEC-5 (Observability), SPEC-6 (Buddy)
-- ═══════════════════════════════════════════════════════════════════

-- ════════ SPEC-1: Control Plane & Pipeline ════════

CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    health_endpoint TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    runtime TEXT NOT NULL DEFAULT 'node',
    role TEXT NOT NULL DEFAULT 'executor',
    triggers TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL DEFAULT 'hcfullpipeline',
    max_concurrent_tasks INT NOT NULL DEFAULT 6,
    governance JSONB NOT NULL DEFAULT '{}'::JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    request_id TEXT,
    seed BIGINT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    result JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE pipeline_stage_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    stage_num INT NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
    error TEXT
);
CREATE INDEX idx_stage_runs_pipeline ON pipeline_stage_runs(pipeline_run_id, stage_num);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 5,
    status TEXT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    request_id TEXT,
    ip INET,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at);
CREATE INDEX idx_audit_logs_request ON audit_logs(request_id);

-- ════════ SPEC-3: Knowledge Vault & Memory ════════

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,  -- NOTION | REPO | PIPELINE | REGISTRY
    source_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, source_id)
);

CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,   -- LOCAL | CLOUD
    model TEXT NOT NULL,
    dims INT NOT NULL,
    vector JSONB NOT NULL,    -- MVP: jsonb; later: pgvector
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_embeddings_doc ON embeddings(document_id);

CREATE TABLE memory_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL,   -- INGEST | EMBED | STORE | DROP
    source TEXT NOT NULL,
    source_id TEXT,
    document_id UUID,
    stored BOOLEAN NOT NULL,
    reason TEXT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_receipts_op ON memory_receipts(operation, created_at);

CREATE TABLE connectivity_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_service TEXT NOT NULL,
    to_service TEXT NOT NULL,
    route TEXT,
    method TEXT,
    status TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════ SPEC-4: MCP Gateway & Tools ════════

CREATE TABLE mcp_tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    mapped_endpoint TEXT NOT NULL,
    risk_level TEXT NOT NULL DEFAULT 'LOW',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tool_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id TEXT NOT NULL REFERENCES mcp_tools(id),
    environment TEXT NOT NULL,   -- dev | staging | prod
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_roles TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_per_min INT,
    constraints JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tool_invocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id TEXT NOT NULL REFERENCES mcp_tools(id),
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    environment TEXT NOT NULL,
    request JSONB NOT NULL,
    response JSONB,
    status TEXT NOT NULL,
    latency_ms INT,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tool_invocations_tool ON tool_invocations(tool_id, created_at);

-- ════════ SPEC-5: Observability & Drift ════════

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity TEXT NOT NULL,    -- critical | high | medium | low
    title TEXT NOT NULL,
    status TEXT NOT NULL,      -- open | investigating | resolved | postmortem
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    details JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE drift_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL,        -- REGISTRY | CONNECTIVITY | CONFIG
    before_hash TEXT,
    after_hash TEXT,
    status TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_drift_kind ON drift_events(kind, created_at);

-- ════════ SPEC-6: HeadyBuddy Universal ════════

CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    scope TEXT NOT NULL,       -- TRACKING | DEVICE_SYNC | VOICE
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    details JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    device_public_key TEXT NOT NULL,
    device_name TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    device_id UUID REFERENCES devices(id),
    domain TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tracking_user ON tracking_events(user_id, created_at);

CREATE TABLE device_sync_blobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    device_id UUID REFERENCES devices(id),
    cipher_text TEXT NOT NULL,
    key_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════ SPEC-G: Cost Governance & Budgeting ════════

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL,         -- USER | ORG | WORKSPACE | WORKFLOW
    scope_id TEXT NOT NULL,           -- user_id, org_name, etc.
    limit_usd NUMERIC(10,6) NOT NULL,
    spent_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    period TEXT NOT NULL,             -- DAILY | MONTHLY | TOTAL
    reset_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scope_type, scope_id, period)
);

-- Index for fast budget lookups
CREATE INDEX idx_budgets_scope ON budgets(scope_type, scope_id);

-- Update audit_logs and tool_invocations to track budget context
ALTER TABLE audit_logs ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL;
ALTER TABLE tool_invocations ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL;

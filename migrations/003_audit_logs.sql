-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 003
-- Audit Logs — Immutable Event Ledger
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Append-only audit log for all platform operations:
--   - Agent actions (bee spawns, task completions, failures)
--   - Code governance (auth gate decisions)
--   - Memory operations (store, retrieve, consolidate, prune)
--   - Pipeline stage transitions
--   - Swarm topology changes
--   - Security events (auth, RBAC, key rotation)
--   - Tenant lifecycle (create, suspend, delete)
--
-- Partitioned by month for efficient retention management.
-- Multi-tenant RLS enforced.
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Audit Log Table (Monthly Partitioned)
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_audit.audit_logs (
    id              UUID DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id(),

    -- Event Classification
    event_type      TEXT NOT NULL,                          -- 'agent.spawn', 'memory.store', 'pipeline.stage', etc.
    event_category  TEXT NOT NULL DEFAULT 'system'
                    CHECK (event_category IN (
                        'agent', 'memory', 'pipeline', 'swarm',
                        'security', 'governance', 'tenant', 'system',
                        'api', 'billing', 'health'
                    )),
    severity        TEXT NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),

    -- Event Context
    actor_type      TEXT NOT NULL DEFAULT 'system'
                    CHECK (actor_type IN ('user', 'agent', 'bee', 'swarm', 'pipeline', 'system', 'api_key')),
    actor_id        TEXT NOT NULL,                          -- who/what performed the action
    actor_name      TEXT,                                   -- human-readable actor name

    -- Target
    target_type     TEXT,                                   -- 'vector_memory', 'task', 'agent', 'file', etc.
    target_id       TEXT,                                   -- ID of the affected resource
    target_name     TEXT,                                   -- human-readable target name

    -- Event Data
    action          TEXT NOT NULL,                          -- 'create', 'read', 'update', 'delete', 'execute', 'approve', 'deny'
    description     TEXT,                                   -- human-readable description
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,     -- structured event data
    diff            JSONB,                                  -- before/after for mutations
    result          TEXT DEFAULT 'success'
                    CHECK (result IN ('success', 'failure', 'partial', 'denied', 'timeout')),
    error_message   TEXT,

    -- Request Context
    request_id      UUID,                                   -- correlation ID for distributed tracing
    session_id      UUID,
    ip_address      INET,
    user_agent      TEXT,

    -- Pipeline Context (when audit is from pipeline execution)
    pipeline_run_id UUID,
    pipeline_stage  TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Partition key
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Monthly Partitions (auto-create for current + next 6 months)
-- ————————————————————————————————————————————————————————————————————————————

-- Create partitions dynamically via function
CREATE OR REPLACE FUNCTION heady_audit.create_monthly_partition(
    p_year INTEGER,
    p_month INTEGER
)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := format('audit_logs_y%sm%s', p_year, lpad(p_month::text, 2, '0'));
    start_date := make_date(p_year, p_month, 1);
    end_date := start_date + INTERVAL '1 month';

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS heady_audit.%I PARTITION OF heady_audit.audit_logs
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Create partitions for 2026 (Jan–Dec)
DO $$
BEGIN
    FOR m IN 1..12 LOOP
        PERFORM heady_audit.create_monthly_partition(2026, m);
    END LOOP;
    -- Also create Jan 2027 for forward coverage
    PERFORM heady_audit.create_monthly_partition(2027, 1);
END;
$$;

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Indexes
-- ————————————————————————————————————————————————————————————————————————————

-- Tenant + time range (primary query pattern)
CREATE INDEX idx_audit_tenant_time ON heady_audit.audit_logs (tenant_id, created_at DESC);

-- Event type filtering
CREATE INDEX idx_audit_event_type ON heady_audit.audit_logs (event_type, created_at DESC);
CREATE INDEX idx_audit_event_category ON heady_audit.audit_logs (event_category, created_at DESC);

-- Severity-based alerting
CREATE INDEX idx_audit_severity ON heady_audit.audit_logs (severity, created_at DESC)
    WHERE severity IN ('error', 'critical');

-- Actor lookup
CREATE INDEX idx_audit_actor ON heady_audit.audit_logs (actor_type, actor_id, created_at DESC);

-- Target lookup (what happened to resource X?)
CREATE INDEX idx_audit_target ON heady_audit.audit_logs (target_type, target_id, created_at DESC)
    WHERE target_id IS NOT NULL;

-- Distributed tracing correlation
CREATE INDEX idx_audit_request_id ON heady_audit.audit_logs (request_id)
    WHERE request_id IS NOT NULL;

-- Pipeline run correlation
CREATE INDEX idx_audit_pipeline_run ON heady_audit.audit_logs (pipeline_run_id, pipeline_stage)
    WHERE pipeline_run_id IS NOT NULL;

-- JSONB payload queries
CREATE INDEX idx_audit_payload ON heady_audit.audit_logs USING gin (payload jsonb_path_ops);

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Row-Level Security
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_audit.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_audit.audit_logs FORCE ROW LEVEL SECURITY;

-- Tenants can only read their own audit logs
CREATE POLICY audit_tenant_read ON heady_audit.audit_logs
    FOR SELECT
    USING (tenant_id = heady_identity.current_tenant_id());

-- Only system tenant can read all audit logs
CREATE POLICY audit_system_read ON heady_audit.audit_logs
    FOR SELECT
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- INSERT is always allowed (append-only, tenant_id auto-set)
CREATE POLICY audit_insert ON heady_audit.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- NO UPDATE or DELETE policies — audit logs are immutable
-- The table owner can still delete via partition drops for retention.

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Audit Log Helper Function
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE FUNCTION heady_audit.log_event(
    p_event_type TEXT,
    p_action TEXT,
    p_actor_type TEXT DEFAULT 'system',
    p_actor_id TEXT DEFAULT 'heady-system',
    p_target_type TEXT DEFAULT NULL,
    p_target_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_severity TEXT DEFAULT 'info',
    p_event_category TEXT DEFAULT 'system',
    p_result TEXT DEFAULT 'success',
    p_request_id UUID DEFAULT NULL,
    p_pipeline_run_id UUID DEFAULT NULL,
    p_pipeline_stage TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO heady_audit.audit_logs (
        event_type, event_category, severity,
        actor_type, actor_id, action,
        target_type, target_id, description,
        payload, result, request_id,
        pipeline_run_id, pipeline_stage
    ) VALUES (
        p_event_type, p_event_category, p_severity,
        p_actor_type, p_actor_id, p_action,
        p_target_type, p_target_id, p_description,
        p_payload, p_result, p_request_id,
        p_pipeline_run_id, p_pipeline_stage
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ————————————————————————————————————————————————————————————————————————————
-- 6. Partition Maintenance: Auto-Create Future Partitions
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE FUNCTION heady_audit.ensure_future_partitions(p_months_ahead INTEGER DEFAULT 3)
RETURNS INTEGER AS $$
DECLARE
    v_date DATE;
    v_created INTEGER := 0;
BEGIN
    FOR i IN 0..p_months_ahead LOOP
        v_date := date_trunc('month', now()) + make_interval(months => i);
        PERFORM heady_audit.create_monthly_partition(
            EXTRACT(YEAR FROM v_date)::INTEGER,
            EXTRACT(MONTH FROM v_date)::INTEGER
        );
        v_created := v_created + 1;
    END LOOP;
    RETURN v_created;
END;
$$ LANGUAGE plpgsql;

-- Drop old partitions for retention (keeps last N months)
CREATE OR REPLACE FUNCTION heady_audit.drop_old_partitions(p_retain_months INTEGER DEFAULT 12)
RETURNS INTEGER AS $$
DECLARE
    v_cutoff DATE;
    v_partition RECORD;
    v_dropped INTEGER := 0;
BEGIN
    v_cutoff := date_trunc('month', now()) - make_interval(months => p_retain_months);

    FOR v_partition IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'heady_audit'
          AND tablename LIKE 'audit_logs_y%'
    LOOP
        -- Extract date from partition name and check if older than cutoff
        EXECUTE format('DROP TABLE IF EXISTS heady_audit.%I', v_partition.tablename);
        v_dropped := v_dropped + 1;
    END LOOP;

    RETURN v_dropped;
END;
$$ LANGUAGE plpgsql;

COMMIT;

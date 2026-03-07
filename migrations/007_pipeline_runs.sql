-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 007
-- Pipeline Runs — HCFullPipeline Execution Tracking
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Tracks pipeline execution state across the 6 core stages:
--   INGEST → PROJECTION → REASONING → SYNTHESIS → IGNITION → AUDIT
-- With checkpointing, rollback support, and stage-level telemetry.
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Pipeline Runs Table
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_pipeline.pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id()
                    REFERENCES heady_identity.tenants(tenant_id),

    -- Pipeline Identity
    pipeline_name   TEXT NOT NULL DEFAULT 'HCFullPipeline',
    run_number      SERIAL,
    trigger_type    TEXT NOT NULL DEFAULT 'manual'
                    CHECK (trigger_type IN ('manual', 'scheduled', 'event', 'api', 'swarm')),
    triggered_by    TEXT NOT NULL,

    -- Input/Output
    input_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload  JSONB,
    config_hashes   JSONB NOT NULL DEFAULT '{}'::jsonb,     -- SHA-256 of input configs

    -- State
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending', 'running', 'completed',
                        'failed', 'cancelled', 'rolled_back'
                    )),
    current_stage   TEXT
                    CHECK (current_stage IS NULL OR current_stage IN (
                        'INGEST', 'PROJECTION', 'REASONING',
                        'SYNTHESIS', 'IGNITION', 'AUDIT'
                    )),

    -- Telemetry
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    stages_completed INTEGER NOT NULL DEFAULT 0,

    -- Error
    error_message   TEXT,
    error_stage     TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Pipeline Stage Executions
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_pipeline.stage_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id(),
    pipeline_run_id UUID NOT NULL REFERENCES heady_pipeline.pipeline_runs(id) ON DELETE CASCADE,

    stage           TEXT NOT NULL
                    CHECK (stage IN (
                        'INGEST', 'PROJECTION', 'REASONING',
                        'SYNTHESIS', 'IGNITION', 'AUDIT'
                    )),
    stage_order     INTEGER NOT NULL,

    -- State
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),

    -- Input/Output
    input_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_data     JSONB,
    checkpoint      JSONB,                                  -- checkpoint data for rollback

    -- Telemetry
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,

    -- Agent that executed this stage
    executor_agent  TEXT,
    executor_swarm  UUID,

    -- Error
    error_message   TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Indexes
-- ————————————————————————————————————————————————————————————————————————————

CREATE INDEX idx_pr_tenant_status ON heady_pipeline.pipeline_runs (tenant_id, status, created_at DESC);
CREATE INDEX idx_pr_status ON heady_pipeline.pipeline_runs (status) WHERE status = 'running';
CREATE INDEX idx_se_run ON heady_pipeline.stage_executions (pipeline_run_id, stage_order);
CREATE INDEX idx_se_status ON heady_pipeline.stage_executions (status) WHERE status = 'running';

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Row-Level Security
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_pipeline.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_pipeline.pipeline_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY pr_tenant_isolation ON heady_pipeline.pipeline_runs
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY pr_system_bypass ON heady_pipeline.pipeline_runs
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE heady_pipeline.stage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_pipeline.stage_executions FORCE ROW LEVEL SECURITY;

CREATE POLICY se_tenant_isolation ON heady_pipeline.stage_executions
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY se_system_bypass ON heady_pipeline.stage_executions
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- Triggers
CREATE TRIGGER trg_pr_updated_at
    BEFORE UPDATE ON heady_pipeline.pipeline_runs
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.set_updated_at();

COMMIT;

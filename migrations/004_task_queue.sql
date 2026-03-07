-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 004
-- Task Queue — Postgres-Native Job Queue with Priority & Locking
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Implements a durable, multi-tenant task queue backed by Postgres:
--   - SKIP LOCKED advisory-lock-free dequeuing
--   - Priority ordering with phi-weighted urgency
--   - Pipeline stage integration (INGEST → PROJECTION → REASONING → ...)
--   - Dead letter queue for failed tasks
--   - Retry with exponential backoff (phi-based)
--   - Multi-tenant RLS enforcement
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Task Queue Table
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_swarm.task_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id()
                    REFERENCES heady_identity.tenants(tenant_id),

    -- Task Definition
    task_type       TEXT NOT NULL,                          -- 'embed', 'reason', 'deploy', 'prune', etc.
    domain          TEXT NOT NULL DEFAULT 'general',        -- bee domain: infrastructure, security, intelligence, etc.
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,     -- task-specific arguments
    result          JSONB,                                  -- task output after completion

    -- Priority & Scheduling
    priority        REAL NOT NULL DEFAULT 0.5              -- [0, 1] — higher = more urgent
                    CHECK (priority >= 0 AND priority <= 1),
    scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),     -- earliest execution time
    deadline_at     TIMESTAMPTZ,                            -- hard deadline (task fails if missed)

    -- Pipeline Integration
    pipeline_run_id UUID,
    pipeline_stage  TEXT
                    CHECK (pipeline_stage IS NULL OR pipeline_stage IN (
                        'INGEST', 'PROJECTION', 'REASONING',
                        'SYNTHESIS', 'IGNITION', 'AUDIT'
                    )),

    -- State Machine
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',        -- waiting to be picked up
                        'locked',         -- claimed by a worker
                        'running',        -- actively executing
                        'completed',      -- done successfully
                        'failed',         -- execution failed (may retry)
                        'dead_letter',    -- exhausted retries
                        'cancelled',      -- manually cancelled
                        'timeout'         -- exceeded deadline
                    )),

    -- Worker Assignment
    locked_by       TEXT,                                   -- worker/bee ID that claimed this task
    locked_at       TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Retry Logic (phi-based exponential backoff)
    attempt         INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 5,
    next_retry_at   TIMESTAMPTZ,
    error_log       JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{attempt, error, timestamp}]

    -- Dependency Chain
    depends_on      UUID[],                                 -- task IDs that must complete first
    parent_task_id  UUID,                                   -- for sub-task hierarchies

    -- Telemetry
    duration_ms     INTEGER,                                -- execution time
    queue_wait_ms   INTEGER,                                -- time in queue before pickup

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Indexes for Efficient Dequeuing
-- ————————————————————————————————————————————————————————————————————————————

-- Primary dequeue index: pending tasks ordered by priority + schedule time
-- This is THE hot path — used by every worker polling for tasks
CREATE INDEX idx_tq_dequeue ON heady_swarm.task_queue
    (priority DESC, scheduled_at ASC)
    WHERE status = 'pending';

-- Tenant + status for dashboard queries
CREATE INDEX idx_tq_tenant_status ON heady_swarm.task_queue (tenant_id, status, created_at DESC);

-- Domain-specific dequeue (bees only pick tasks from their domain)
CREATE INDEX idx_tq_domain_dequeue ON heady_swarm.task_queue
    (domain, priority DESC, scheduled_at ASC)
    WHERE status = 'pending';

-- Retry scheduling
CREATE INDEX idx_tq_retry ON heady_swarm.task_queue (next_retry_at ASC)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Deadline monitoring
CREATE INDEX idx_tq_deadline ON heady_swarm.task_queue (deadline_at ASC)
    WHERE status IN ('pending', 'locked', 'running') AND deadline_at IS NOT NULL;

-- Pipeline run correlation
CREATE INDEX idx_tq_pipeline ON heady_swarm.task_queue (pipeline_run_id, pipeline_stage)
    WHERE pipeline_run_id IS NOT NULL;

-- Dependency resolution
CREATE INDEX idx_tq_depends ON heady_swarm.task_queue USING gin (depends_on)
    WHERE depends_on IS NOT NULL;

-- Worker lock tracking
CREATE INDEX idx_tq_locked_by ON heady_swarm.task_queue (locked_by, locked_at)
    WHERE status = 'locked';

-- Parent-child task hierarchy
CREATE INDEX idx_tq_parent ON heady_swarm.task_queue (parent_task_id)
    WHERE parent_task_id IS NOT NULL;

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Row-Level Security
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_swarm.task_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_swarm.task_queue FORCE ROW LEVEL SECURITY;

CREATE POLICY tq_tenant_isolation ON heady_swarm.task_queue
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY tq_system_bypass ON heady_swarm.task_queue
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ————————————————————————————————————————————————————————————————————————————
-- 4. SKIP LOCKED Dequeue Function
-- ————————————————————————————————————————————————————————————————————————————
-- Atomic claim: grabs the highest-priority ready task and locks it.
-- Uses FOR UPDATE SKIP LOCKED — multiple workers can dequeue concurrently
-- without blocking each other.

CREATE OR REPLACE FUNCTION heady_swarm.dequeue_task(
    p_worker_id TEXT,
    p_domain TEXT DEFAULT NULL,
    p_batch_size INTEGER DEFAULT 1
)
RETURNS SETOF heady_swarm.task_queue AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT tq.id
        FROM heady_swarm.task_queue tq
        WHERE tq.status = 'pending'
          AND tq.scheduled_at <= now()
          AND (p_domain IS NULL OR tq.domain = p_domain)
          AND (tq.depends_on IS NULL OR heady_swarm.dependencies_met(tq.depends_on))
        ORDER BY tq.priority DESC, tq.scheduled_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE heady_swarm.task_queue tq
    SET status = 'locked',
        locked_by = p_worker_id,
        locked_at = now(),
        attempt = attempt + 1
    FROM claimed
    WHERE tq.id = claimed.id
    RETURNING tq.*;
END;
$$ LANGUAGE plpgsql;

-- Check if all dependency tasks are completed
CREATE OR REPLACE FUNCTION heady_swarm.dependencies_met(p_dep_ids UUID[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM heady_swarm.task_queue
        WHERE id = ANY(p_dep_ids)
          AND status != 'completed'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Task Lifecycle Functions
-- ————————————————————————————————————————————————————————————————————————————

-- Start execution (transition locked → running)
CREATE OR REPLACE FUNCTION heady_swarm.start_task(
    p_task_id UUID,
    p_worker_id TEXT
)
RETURNS heady_swarm.task_queue AS $$
DECLARE
    v_task heady_swarm.task_queue;
BEGIN
    UPDATE heady_swarm.task_queue
    SET status = 'running',
        started_at = now(),
        queue_wait_ms = EXTRACT(EPOCH FROM (now() - created_at))::INTEGER * 1000
    WHERE id = p_task_id
      AND locked_by = p_worker_id
      AND status = 'locked'
    RETURNING * INTO v_task;

    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Task % not found or not locked by %', p_task_id, p_worker_id;
    END IF;

    RETURN v_task;
END;
$$ LANGUAGE plpgsql;

-- Complete a task
CREATE OR REPLACE FUNCTION heady_swarm.complete_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_result JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    UPDATE heady_swarm.task_queue
    SET status = 'completed',
        result = p_result,
        completed_at = now(),
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER * 1000
    WHERE id = p_task_id
      AND locked_by = p_worker_id
      AND status = 'running';
END;
$$ LANGUAGE plpgsql;

-- Fail a task (with phi-based exponential backoff retry)
CREATE OR REPLACE FUNCTION heady_swarm.fail_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_error TEXT
)
RETURNS void AS $$
DECLARE
    v_task heady_swarm.task_queue;
    v_phi REAL := 1.6180339887;
    v_backoff_seconds REAL;
BEGIN
    SELECT * INTO v_task FROM heady_swarm.task_queue WHERE id = p_task_id;

    IF v_task.attempt >= v_task.max_attempts THEN
        -- Move to dead letter queue
        UPDATE heady_swarm.task_queue
        SET status = 'dead_letter',
            completed_at = now(),
            error_log = error_log || jsonb_build_array(jsonb_build_object(
                'attempt', v_task.attempt,
                'error', p_error,
                'timestamp', now()::text
            ))
        WHERE id = p_task_id;
    ELSE
        -- Phi-based exponential backoff: φ^attempt * 10 seconds
        v_backoff_seconds := power(v_phi, v_task.attempt) * 10;

        UPDATE heady_swarm.task_queue
        SET status = 'failed',
            locked_by = NULL,
            locked_at = NULL,
            next_retry_at = now() + make_interval(secs => v_backoff_seconds),
            error_log = error_log || jsonb_build_array(jsonb_build_object(
                'attempt', v_task.attempt,
                'error', p_error,
                'timestamp', now()::text
            ))
        WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Retry failed tasks whose backoff has elapsed
CREATE OR REPLACE FUNCTION heady_swarm.retry_failed_tasks()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH retried AS (
        UPDATE heady_swarm.task_queue
        SET status = 'pending',
            next_retry_at = NULL
        WHERE status = 'failed'
          AND next_retry_at IS NOT NULL
          AND next_retry_at <= now()
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM retried;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Timeout stale locked tasks (workers that crashed)
CREATE OR REPLACE FUNCTION heady_swarm.timeout_stale_locks(
    p_stale_threshold_minutes INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH timed_out AS (
        UPDATE heady_swarm.task_queue
        SET status = 'pending',
            locked_by = NULL,
            locked_at = NULL,
            error_log = error_log || jsonb_build_array(jsonb_build_object(
                'attempt', attempt,
                'error', 'Lock timed out (worker presumed dead)',
                'timestamp', now()::text
            ))
        WHERE status IN ('locked', 'running')
          AND locked_at < now() - make_interval(mins => p_stale_threshold_minutes)
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM timed_out;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_tq_updated_at
    BEFORE UPDATE ON heady_swarm.task_queue
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.set_updated_at();

COMMIT;

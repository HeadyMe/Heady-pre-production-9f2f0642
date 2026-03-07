-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 005
-- Agent State — Bee/Node Lifecycle, Health, and Runtime State
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Tracks the runtime state of every agent (bee) in the system:
--   - Lifecycle: spawned → idle → working → cooling → terminated
--   - Health telemetry: CPU, memory, latency, error rate
--   - Pool assignment: Hot / Warm / Cold (Sacred Geometry scheduling)
--   - Heartbeat tracking with phi-weighted TTL
--   - Self-awareness metrics (from self-awareness.js)
--   - Multi-tenant RLS
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Agent State Table
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_core.agent_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id()
                    REFERENCES heady_identity.tenants(tenant_id),

    -- Identity
    agent_id        TEXT NOT NULL,                          -- unique agent identifier
    agent_name      TEXT NOT NULL,                          -- human-readable name
    agent_type      TEXT NOT NULL DEFAULT 'bee'
                    CHECK (agent_type IN (
                        'bee',            -- standard worker bee
                        'ephemeral',      -- one-shot spawned bee
                        'conductor',      -- orchestration node
                        'maestro',        -- top-level coordinator
                        'judge',          -- evaluation/approval node
                        'sentinel',       -- monitoring/watchdog
                        'buddy'           -- companion interface agent
                    )),
    domain          TEXT NOT NULL,                          -- infrastructure, security, intelligence, etc.

    -- Lifecycle State
    status          TEXT NOT NULL DEFAULT 'spawned'
                    CHECK (status IN (
                        'spawned',        -- just created
                        'initializing',   -- loading context/tools
                        'idle',           -- ready for work
                        'working',        -- executing a task
                        'cooling',        -- between tasks, winding down
                        'quarantined',    -- isolated due to errors
                        'terminated',     -- gracefully shut down
                        'crashed'         -- unexpected failure
                    )),
    spawned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    terminated_at   TIMESTAMPTZ,

    -- Pool Assignment (Sacred Geometry Scheduling)
    pool            TEXT NOT NULL DEFAULT 'warm'
                    CHECK (pool IN ('hot', 'warm', 'cold')),
    pool_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Current Task
    current_task_id UUID,                                   -- FK to task_queue
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed    INTEGER NOT NULL DEFAULT 0,

    -- Health Telemetry
    health_score    REAL NOT NULL DEFAULT 1.0               -- [0, 1] composite health
                    CHECK (health_score >= 0 AND health_score <= 1),
    cpu_percent     REAL DEFAULT 0,
    memory_mb       REAL DEFAULT 0,
    p95_latency_ms  REAL DEFAULT 0,
    error_rate      REAL NOT NULL DEFAULT 0                 -- [0, 1]
                    CHECK (error_rate >= 0 AND error_rate <= 1),
    consecutive_errors INTEGER NOT NULL DEFAULT 0,

    -- Heartbeat
    last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
    heartbeat_interval_ms INTEGER NOT NULL DEFAULT 8090,    -- φ * 5000ms ≈ 8090ms
    missed_heartbeats INTEGER NOT NULL DEFAULT 0,

    -- Self-Awareness Metrics
    coherence_score REAL DEFAULT 1.0,                       -- semantic coherence with swarm
    drift_score     REAL DEFAULT 0.0,                       -- semantic drift from baseline
    self_awareness  JSONB NOT NULL DEFAULT '{}'::jsonb,     -- extended self-awareness data

    -- Configuration
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,     -- agent-specific configuration
    capabilities    TEXT[] NOT NULL DEFAULT '{}',            -- tool/capability list
    model           TEXT,                                    -- LLM model if applicable

    -- Parent Swarm
    swarm_id        UUID,                                   -- FK to swarm_topology
    swarm_role      TEXT,                                    -- role within swarm

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Indexes
-- ————————————————————————————————————————————————————————————————————————————

-- Unique agent per tenant
CREATE UNIQUE INDEX idx_as_agent_tenant ON heady_core.agent_state (tenant_id, agent_id);

-- Status-based queries (find all working/idle agents)
CREATE INDEX idx_as_status ON heady_core.agent_state (status) WHERE status NOT IN ('terminated', 'crashed');

-- Pool scheduling (Hot/Warm/Cold)
CREATE INDEX idx_as_pool ON heady_core.agent_state (pool, status);

-- Domain-specific agent lookup
CREATE INDEX idx_as_domain ON heady_core.agent_state (domain, status);

-- Health monitoring (find unhealthy agents)
CREATE INDEX idx_as_health ON heady_core.agent_state (health_score ASC)
    WHERE status NOT IN ('terminated', 'crashed');

-- Heartbeat monitoring (find agents that stopped sending heartbeats)
CREATE INDEX idx_as_heartbeat ON heady_core.agent_state (last_heartbeat ASC)
    WHERE status NOT IN ('terminated', 'crashed');

-- Swarm membership
CREATE INDEX idx_as_swarm ON heady_core.agent_state (swarm_id)
    WHERE swarm_id IS NOT NULL;

-- Agent type filtering
CREATE INDEX idx_as_type ON heady_core.agent_state (agent_type);

-- Capabilities search
CREATE INDEX idx_as_capabilities ON heady_core.agent_state USING gin (capabilities);

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Row-Level Security
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_core.agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_core.agent_state FORCE ROW LEVEL SECURITY;

CREATE POLICY as_tenant_isolation ON heady_core.agent_state
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY as_system_bypass ON heady_core.agent_state
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Agent Lifecycle Functions
-- ————————————————————————————————————————————————————————————————————————————

-- Register a new agent
CREATE OR REPLACE FUNCTION heady_core.register_agent(
    p_agent_id TEXT,
    p_agent_name TEXT,
    p_agent_type TEXT DEFAULT 'bee',
    p_domain TEXT DEFAULT 'general',
    p_config JSONB DEFAULT '{}'::jsonb,
    p_capabilities TEXT[] DEFAULT '{}'
)
RETURNS heady_core.agent_state AS $$
DECLARE
    v_agent heady_core.agent_state;
BEGIN
    INSERT INTO heady_core.agent_state (
        agent_id, agent_name, agent_type, domain, config, capabilities
    ) VALUES (
        p_agent_id, p_agent_name, p_agent_type, p_domain, p_config, p_capabilities
    )
    ON CONFLICT (tenant_id, agent_id) DO UPDATE SET
        status = 'spawned',
        spawned_at = now(),
        last_active_at = now(),
        last_heartbeat = now(),
        terminated_at = NULL,
        consecutive_errors = 0,
        missed_heartbeats = 0,
        health_score = 1.0,
        config = EXCLUDED.config,
        capabilities = EXCLUDED.capabilities
    RETURNING * INTO v_agent;

    -- Audit log
    PERFORM heady_audit.log_event(
        'agent.register', 'create', 'system', 'agent-registry',
        'agent', p_agent_id, format('Agent %s registered', p_agent_name),
        jsonb_build_object('type', p_agent_type, 'domain', p_domain)
    );

    RETURN v_agent;
END;
$$ LANGUAGE plpgsql;

-- Heartbeat: update agent health and detect failures
CREATE OR REPLACE FUNCTION heady_core.agent_heartbeat(
    p_agent_id TEXT,
    p_health JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    UPDATE heady_core.agent_state
    SET last_heartbeat = now(),
        last_active_at = now(),
        missed_heartbeats = 0,
        cpu_percent = COALESCE((p_health->>'cpu')::real, cpu_percent),
        memory_mb = COALESCE((p_health->>'memory_mb')::real, memory_mb),
        p95_latency_ms = COALESCE((p_health->>'p95_latency_ms')::real, p95_latency_ms),
        error_rate = COALESCE((p_health->>'error_rate')::real, error_rate),
        coherence_score = COALESCE((p_health->>'coherence')::real, coherence_score),
        drift_score = COALESCE((p_health->>'drift')::real, drift_score),
        health_score = COALESCE((p_health->>'health_score')::real,
            -- Auto-compute if not provided
            GREATEST(0, LEAST(1,
                1.0
                - COALESCE((p_health->>'error_rate')::real, error_rate) * 0.4
                - CASE WHEN COALESCE((p_health->>'p95_latency_ms')::real, p95_latency_ms) > 1000 THEN 0.3
                       WHEN COALESCE((p_health->>'p95_latency_ms')::real, p95_latency_ms) > 500  THEN 0.15
                       ELSE 0 END
                - COALESCE((p_health->>'drift')::real, drift_score) * 0.3
            ))
        )
    WHERE agent_id = p_agent_id
      AND tenant_id = heady_identity.current_tenant_id();
END;
$$ LANGUAGE plpgsql;

-- Detect and quarantine dead agents
CREATE OR REPLACE FUNCTION heady_core.detect_dead_agents(
    p_missed_threshold INTEGER DEFAULT 3
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
    v_phi REAL := 1.6180339887;
BEGIN
    WITH dead AS (
        UPDATE heady_core.agent_state
        SET status = 'quarantined',
            missed_heartbeats = missed_heartbeats + 1,
            health_score = GREATEST(0, health_score - 0.2)
        WHERE status NOT IN ('terminated', 'crashed', 'quarantined')
          AND last_heartbeat < now() - make_interval(
                secs => heartbeat_interval_ms * p_missed_threshold / 1000.0
              )
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM dead;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Pool rebalancing based on health/load
CREATE OR REPLACE FUNCTION heady_core.rebalance_pools()
RETURNS void AS $$
BEGIN
    -- Hot pool: healthy, actively working or idle
    UPDATE heady_core.agent_state
    SET pool = 'hot', pool_changed_at = now()
    WHERE status IN ('working', 'idle')
      AND health_score >= 0.8
      AND pool != 'hot';

    -- Warm pool: moderate health or cooling
    UPDATE heady_core.agent_state
    SET pool = 'warm', pool_changed_at = now()
    WHERE status IN ('idle', 'cooling')
      AND health_score BETWEEN 0.4 AND 0.8
      AND pool != 'warm';

    -- Cold pool: low health or quarantined
    UPDATE heady_core.agent_state
    SET pool = 'cold', pool_changed_at = now()
    WHERE (health_score < 0.4 OR status = 'quarantined')
      AND pool != 'cold';
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_as_updated_at
    BEFORE UPDATE ON heady_core.agent_state
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.set_updated_at();

COMMIT;

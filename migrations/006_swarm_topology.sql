-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 006
-- Swarm Topology — Swarm Registry, Membership, and Sacred Geometry
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Defines the swarm organizational structure:
--   - 17-swarm taxonomy (the official Heady swarm types)
--   - Dynamic swarm creation and lifecycle
--   - Agent membership and role assignments
--   - Sacred Geometry orchestration parameters
--   - Consensus configuration per swarm
--   - Inter-swarm communication channels
--   - Multi-tenant RLS
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Swarm Topology Table
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_swarm.swarm_topology (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id()
                    REFERENCES heady_identity.tenants(tenant_id),

    -- Identity
    swarm_name      TEXT NOT NULL,                          -- e.g., 'intelligence-swarm', 'deploy-swarm'
    swarm_type      TEXT NOT NULL,                          -- taxonomy type (see 17-swarm seed)
    display_name    TEXT NOT NULL,
    description     TEXT,

    -- Sacred Geometry Parameters
    phi_cycle_ms    REAL NOT NULL DEFAULT 48541.0,          -- φ^12 * 1000 ≈ 321s base cycle
    phi_multiplier  REAL NOT NULL DEFAULT 1.6180339887,     -- golden ratio
    resonance_freq  REAL NOT NULL DEFAULT 0.618,            -- 1/φ resonance frequency
    octant_affinity SMALLINT[] NOT NULL DEFAULT '{}'::smallint[], -- preferred 3D octant zones

    -- Capacity
    min_agents      INTEGER NOT NULL DEFAULT 1,
    max_agents      INTEGER NOT NULL DEFAULT 12,
    target_agents   INTEGER NOT NULL DEFAULT 3,
    current_agents  INTEGER NOT NULL DEFAULT 0,

    -- State
    status          TEXT NOT NULL DEFAULT 'initializing'
                    CHECK (status IN (
                        'initializing',   -- being set up
                        'active',         -- running normally
                        'scaling_up',     -- adding agents
                        'scaling_down',   -- removing agents
                        'degraded',       -- below min agents or high error rate
                        'suspended',      -- manually paused
                        'terminated'      -- shut down
                    )),
    health_score    REAL NOT NULL DEFAULT 1.0
                    CHECK (health_score >= 0 AND health_score <= 1),
    error_rate      REAL NOT NULL DEFAULT 0
                    CHECK (error_rate >= 0 AND error_rate <= 1),

    -- Orchestration Strategy
    strategy        TEXT NOT NULL DEFAULT 'balanced'
                    CHECK (strategy IN (
                        'balanced',       -- equal distribution
                        'throughput-first', -- maximize throughput
                        'stability-first', -- minimize errors
                        'cost-first',     -- minimize resource usage
                        'latency-first'   -- minimize response time
                    )),

    -- Consensus Configuration
    consensus_quorum    REAL NOT NULL DEFAULT 0.5,          -- fraction of agents needed for consensus
    consensus_timeout_ms INTEGER NOT NULL DEFAULT 30000,
    consensus_protocol  TEXT NOT NULL DEFAULT 'majority'
                        CHECK (consensus_protocol IN ('majority', 'unanimous', 'weighted', 'raft')),

    -- Communication
    pubsub_topic    TEXT,                                    -- Pub/Sub topic for this swarm
    grpc_endpoint   TEXT,                                    -- gRPC endpoint for direct communication

    -- Domain
    domain          TEXT NOT NULL,                           -- primary domain
    secondary_domains TEXT[] NOT NULL DEFAULT '{}',          -- cross-domain capabilities

    -- Parent/Child hierarchy
    parent_swarm_id UUID REFERENCES heady_swarm.swarm_topology(id),

    -- Configuration
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique swarm name per tenant
    CONSTRAINT uq_swarm_name_tenant UNIQUE (tenant_id, swarm_name)
);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Swarm Membership Table (Agent ↔ Swarm association)
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_swarm.swarm_membership (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id(),
    swarm_id        UUID NOT NULL REFERENCES heady_swarm.swarm_topology(id) ON DELETE CASCADE,
    agent_id        TEXT NOT NULL,                          -- references agent_state.agent_id

    -- Role within swarm
    role            TEXT NOT NULL DEFAULT 'worker'
                    CHECK (role IN (
                        'leader',         -- swarm coordinator
                        'worker',         -- standard participant
                        'observer',       -- read-only monitoring
                        'specialist',     -- domain expert (weighted vote)
                        'sentinel'        -- health watchdog
                    )),
    weight          REAL NOT NULL DEFAULT 1.0,              -- consensus vote weight

    -- State
    is_active       BOOLEAN NOT NULL DEFAULT true,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,

    -- Performance within swarm
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_failed    INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms  REAL DEFAULT 0,

    -- Unique membership
    CONSTRAINT uq_swarm_agent UNIQUE (swarm_id, agent_id)
);

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Inter-Swarm Communication Channels
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_swarm.swarm_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT heady_identity.current_tenant_id(),
    source_swarm_id UUID NOT NULL REFERENCES heady_swarm.swarm_topology(id) ON DELETE CASCADE,
    target_swarm_id UUID NOT NULL REFERENCES heady_swarm.swarm_topology(id) ON DELETE CASCADE,

    channel_type    TEXT NOT NULL DEFAULT 'data'
                    CHECK (channel_type IN ('data', 'control', 'event', 'consensus')),
    protocol        TEXT NOT NULL DEFAULT 'pubsub'
                    CHECK (protocol IN ('pubsub', 'grpc', 'direct', 'queue')),

    is_active       BOOLEAN NOT NULL DEFAULT true,
    bandwidth_limit INTEGER,                                -- messages per second
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_channel UNIQUE (source_swarm_id, target_swarm_id, channel_type)
);

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Indexes
-- ————————————————————————————————————————————————————————————————————————————

-- Swarm topology
CREATE INDEX idx_st_tenant_status ON heady_swarm.swarm_topology (tenant_id, status);
CREATE INDEX idx_st_type ON heady_swarm.swarm_topology (swarm_type);
CREATE INDEX idx_st_domain ON heady_swarm.swarm_topology (domain);
CREATE INDEX idx_st_parent ON heady_swarm.swarm_topology (parent_swarm_id)
    WHERE parent_swarm_id IS NOT NULL;
CREATE INDEX idx_st_health ON heady_swarm.swarm_topology (health_score ASC)
    WHERE status = 'active';

-- Swarm membership
CREATE INDEX idx_sm_swarm ON heady_swarm.swarm_membership (swarm_id, is_active);
CREATE INDEX idx_sm_agent ON heady_swarm.swarm_membership (agent_id, is_active);
CREATE INDEX idx_sm_role ON heady_swarm.swarm_membership (swarm_id, role);

-- Swarm channels
CREATE INDEX idx_sc_source ON heady_swarm.swarm_channels (source_swarm_id, is_active);
CREATE INDEX idx_sc_target ON heady_swarm.swarm_channels (target_swarm_id, is_active);

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Row-Level Security
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_swarm.swarm_topology ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_swarm.swarm_topology FORCE ROW LEVEL SECURITY;

CREATE POLICY st_tenant_isolation ON heady_swarm.swarm_topology
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY st_system_bypass ON heady_swarm.swarm_topology
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE heady_swarm.swarm_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_swarm.swarm_membership FORCE ROW LEVEL SECURITY;

CREATE POLICY sm_tenant_isolation ON heady_swarm.swarm_membership
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY sm_system_bypass ON heady_swarm.swarm_membership
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

ALTER TABLE heady_swarm.swarm_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_swarm.swarm_channels FORCE ROW LEVEL SECURITY;

CREATE POLICY sc_tenant_isolation ON heady_swarm.swarm_channels
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

CREATE POLICY sc_system_bypass ON heady_swarm.swarm_channels
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ————————————————————————————————————————————————————————————————————————————
-- 6. Swarm Management Functions
-- ————————————————————————————————————————————————————————————————————————————

-- Update agent count on membership changes
CREATE OR REPLACE FUNCTION heady_swarm.update_agent_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE heady_swarm.swarm_topology
        SET current_agents = (
            SELECT count(*) FROM heady_swarm.swarm_membership
            WHERE swarm_id = NEW.swarm_id AND is_active = true
        )
        WHERE id = NEW.swarm_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE heady_swarm.swarm_topology
        SET current_agents = (
            SELECT count(*) FROM heady_swarm.swarm_membership
            WHERE swarm_id = OLD.swarm_id AND is_active = true
        )
        WHERE id = OLD.swarm_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sm_agent_count
    AFTER INSERT OR UPDATE OR DELETE ON heady_swarm.swarm_membership
    FOR EACH ROW
    EXECUTE FUNCTION heady_swarm.update_agent_count();

-- Triggers
CREATE TRIGGER trg_st_updated_at
    BEFORE UPDATE ON heady_swarm.swarm_topology
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.set_updated_at();

COMMIT;

-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 008
-- Materialized Views, Dashboard Functions, and Cross-Table Operations
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Swarm Health Dashboard View
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE VIEW heady_swarm.v_swarm_dashboard AS
SELECT
    st.id AS swarm_id,
    st.swarm_name,
    st.swarm_type,
    st.display_name,
    st.domain,
    st.status,
    st.strategy,
    st.health_score,
    st.error_rate,
    st.current_agents,
    st.target_agents,
    st.min_agents,
    st.max_agents,
    -- Compute utilization
    CASE WHEN st.target_agents > 0
        THEN round((st.current_agents::numeric / st.target_agents) * 100, 1)
        ELSE 0 END AS utilization_pct,
    -- Agent breakdown by pool
    (SELECT count(*) FROM heady_core.agent_state a
     WHERE a.swarm_id = st.id AND a.pool = 'hot' AND a.status NOT IN ('terminated', 'crashed')
    ) AS hot_agents,
    (SELECT count(*) FROM heady_core.agent_state a
     WHERE a.swarm_id = st.id AND a.pool = 'warm' AND a.status NOT IN ('terminated', 'crashed')
    ) AS warm_agents,
    (SELECT count(*) FROM heady_core.agent_state a
     WHERE a.swarm_id = st.id AND a.pool = 'cold' AND a.status NOT IN ('terminated', 'crashed')
    ) AS cold_agents,
    -- Pending tasks for this swarm's domain
    (SELECT count(*) FROM heady_swarm.task_queue tq
     WHERE tq.domain = st.domain AND tq.status = 'pending'
    ) AS pending_tasks,
    st.phi_cycle_ms,
    st.consensus_protocol,
    st.consensus_quorum,
    st.created_at
FROM heady_swarm.swarm_topology st
WHERE st.status != 'terminated';

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Agent Overview View
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE VIEW heady_core.v_agent_overview AS
SELECT
    a.id,
    a.agent_id,
    a.agent_name,
    a.agent_type,
    a.domain,
    a.status,
    a.pool,
    a.health_score,
    a.error_rate,
    a.tasks_completed,
    a.tasks_failed,
    CASE WHEN (a.tasks_completed + a.tasks_failed) > 0
        THEN round(a.tasks_completed::numeric / (a.tasks_completed + a.tasks_failed) * 100, 1)
        ELSE 100 END AS success_rate_pct,
    a.p95_latency_ms,
    a.coherence_score,
    a.drift_score,
    a.last_heartbeat,
    EXTRACT(EPOCH FROM (now() - a.last_heartbeat))::integer AS heartbeat_age_seconds,
    a.consecutive_errors,
    a.missed_heartbeats,
    st.swarm_name,
    a.spawned_at,
    a.capabilities
FROM heady_core.agent_state a
LEFT JOIN heady_swarm.swarm_topology st ON st.id = a.swarm_id
WHERE a.status NOT IN ('terminated', 'crashed');

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Vector Memory Statistics View
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE VIEW heady_core.v_memory_stats AS
SELECT
    tenant_id,
    count(*) AS total_memories,
    count(*) FILTER (WHERE memory_type = 'stm') AS stm_count,
    count(*) FILTER (WHERE memory_type = 'ltm') AS ltm_count,
    count(*) FILTER (WHERE memory_type = 'working') AS working_count,
    count(*) FILTER (WHERE memory_type = 'episodic') AS episodic_count,
    count(*) FILTER (WHERE memory_type = 'semantic') AS semantic_count,
    round(avg(importance)::numeric, 3) AS avg_importance,
    round(avg(frequency)::numeric, 1) AS avg_frequency,
    -- Distribution by octant
    count(*) FILTER (WHERE octant = 0) AS octant_0,
    count(*) FILTER (WHERE octant = 1) AS octant_1,
    count(*) FILTER (WHERE octant = 2) AS octant_2,
    count(*) FILTER (WHERE octant = 3) AS octant_3,
    count(*) FILTER (WHERE octant = 4) AS octant_4,
    count(*) FILTER (WHERE octant = 5) AS octant_5,
    count(*) FILTER (WHERE octant = 6) AS octant_6,
    count(*) FILTER (WHERE octant = 7) AS octant_7,
    -- Distribution by shard
    count(*) FILTER (WHERE shard_id = 0) AS shard_0,
    count(*) FILTER (WHERE shard_id = 1) AS shard_1,
    count(*) FILTER (WHERE shard_id = 2) AS shard_2,
    count(*) FILTER (WHERE shard_id = 3) AS shard_3,
    count(*) FILTER (WHERE shard_id = 4) AS shard_4,
    min(created_at) AS oldest_memory,
    max(created_at) AS newest_memory
FROM heady_core.vector_memories
GROUP BY tenant_id;

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Task Queue Statistics View
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE VIEW heady_swarm.v_task_stats AS
SELECT
    tenant_id,
    domain,
    count(*) AS total_tasks,
    count(*) FILTER (WHERE status = 'pending') AS pending,
    count(*) FILTER (WHERE status = 'locked') AS locked,
    count(*) FILTER (WHERE status = 'running') AS running,
    count(*) FILTER (WHERE status = 'completed') AS completed,
    count(*) FILTER (WHERE status = 'failed') AS failed,
    count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
    round(avg(duration_ms) FILTER (WHERE status = 'completed')::numeric, 0) AS avg_duration_ms,
    round(avg(queue_wait_ms) FILTER (WHERE queue_wait_ms IS NOT NULL)::numeric, 0) AS avg_wait_ms,
    round(avg(attempt) FILTER (WHERE status = 'completed')::numeric, 1) AS avg_attempts,
    max(created_at) AS last_task_at
FROM heady_swarm.task_queue
GROUP BY tenant_id, domain;

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Recent Audit Events View (last 24h)
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE VIEW heady_audit.v_recent_events AS
SELECT
    id,
    event_type,
    event_category,
    severity,
    actor_type,
    actor_id,
    action,
    target_type,
    target_id,
    description,
    result,
    created_at
FROM heady_audit.audit_logs
WHERE created_at >= now() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ————————————————————————————————————————————————————————————————————————————
-- 6. System Health Summary Function
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE FUNCTION heady_core.system_health_summary()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'timestamp', now(),
        'agents', jsonb_build_object(
            'total', (SELECT count(*) FROM heady_core.agent_state WHERE status NOT IN ('terminated', 'crashed')),
            'healthy', (SELECT count(*) FROM heady_core.agent_state WHERE health_score >= 0.8 AND status NOT IN ('terminated', 'crashed')),
            'quarantined', (SELECT count(*) FROM heady_core.agent_state WHERE status = 'quarantined'),
            'avg_health', (SELECT round(avg(health_score)::numeric, 3) FROM heady_core.agent_state WHERE status NOT IN ('terminated', 'crashed'))
        ),
        'swarms', jsonb_build_object(
            'total', (SELECT count(*) FROM heady_swarm.swarm_topology WHERE status != 'terminated'),
            'active', (SELECT count(*) FROM heady_swarm.swarm_topology WHERE status = 'active'),
            'degraded', (SELECT count(*) FROM heady_swarm.swarm_topology WHERE status = 'degraded'),
            'avg_health', (SELECT round(avg(health_score)::numeric, 3) FROM heady_swarm.swarm_topology WHERE status = 'active')
        ),
        'tasks', jsonb_build_object(
            'pending', (SELECT count(*) FROM heady_swarm.task_queue WHERE status = 'pending'),
            'running', (SELECT count(*) FROM heady_swarm.task_queue WHERE status = 'running'),
            'dead_letter', (SELECT count(*) FROM heady_swarm.task_queue WHERE status = 'dead_letter'),
            'completed_24h', (SELECT count(*) FROM heady_swarm.task_queue WHERE status = 'completed' AND completed_at >= now() - INTERVAL '24 hours')
        ),
        'memories', jsonb_build_object(
            'total', (SELECT count(*) FROM heady_core.vector_memories),
            'stm', (SELECT count(*) FROM heady_core.vector_memories WHERE memory_type = 'stm'),
            'ltm', (SELECT count(*) FROM heady_core.vector_memories WHERE memory_type = 'ltm')
        ),
        'pipelines', jsonb_build_object(
            'running', (SELECT count(*) FROM heady_pipeline.pipeline_runs WHERE status = 'running'),
            'completed_24h', (SELECT count(*) FROM heady_pipeline.pipeline_runs WHERE status = 'completed' AND completed_at >= now() - INTERVAL '24 hours')
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;

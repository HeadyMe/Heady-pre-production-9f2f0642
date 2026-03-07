-- ============================================================================
-- Heady Liquid Architecture v3.1 — 17-Swarm Taxonomy Seed Data
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
--
-- The 17-Swarm Taxonomy is the organizational backbone of the Heady platform.
-- Each swarm is a specialized cluster of agents (bees) that handles a distinct
-- domain of the Liquid Architecture.
--
-- Taxonomy is derived from:
--   - 8 official bee-factory.js domains (infrastructure, security, intelligence,
--     pipeline, communication, finance, identity, discovery)
--   - 6 pipeline stages (INGEST, PROJECTION, REASONING, SYNTHESIS, IGNITION, AUDIT)
--   - 3 cross-cutting orchestration swarms (conductor, sacred-geometry, self-awareness)
--
-- Sacred Geometry parameters:
--   - phi_cycle_ms: base cycle interval derived from φ^n * 1000
--   - phi_multiplier: golden ratio (1.618...)
--   - resonance_freq: 1/φ = 0.618... (harmonic resonance)
--   - octant_affinity: preferred 3D vector space zones (0-7)
--
-- All swarms are seeded under the system tenant (00000000-0000-0000-0000-000000000000).
-- Tenant-specific swarms are cloned from these templates at provisioning time.
-- ============================================================================

BEGIN;

-- Set system tenant context for seeding
SELECT heady_identity.set_tenant('00000000-0000-0000-0000-000000000000'::UUID);

-- ————————————————————————————————————————————————————————————————————————————
-- TIER 1: Core Domain Swarms (8 swarms)
-- Derived from bee-factory.js DOMAINS array
-- ————————————————————————————————————————————————————————————————————————————

-- 1. Infrastructure Swarm
-- Workers: cloud-orchestrator, self-healer, resource-allocator
-- Manages cloud resources, scaling, deployment, and self-healing
INSERT INTO heady_swarm.swarm_topology (
    swarm_name, swarm_type, display_name, description,
    domain, secondary_domains,
    phi_cycle_ms, resonance_freq, octant_affinity,
    min_agents, max_agents, target_agents,
    strategy, consensus_protocol, consensus_quorum,
    pubsub_topic,
    config, status
) VALUES (
    'infrastructure-swarm', 'domain-core', 'Infrastructure Swarm',
    'Cloud resource orchestration, scaling, deployment, and self-healing. '
    'Manages Cloud Run instances, Cloudflare Workers, and GCP services.',
    'infrastructure', ARRAY['discovery'],
    ROUND(POWER(1.6180339887, 12) * 1000)::REAL,  -- φ^12 * 1000 ≈ 321,997ms (~5.4min)
    0.618, ARRAY[0, 4]::SMALLINT[],                -- octants 0 and 4 (x-axis pair)
    2, 8, 4,
    'stability-first', 'majority', 0.6,
    'heady-swarm-infra',
    '{"auto_scale": true, "health_check_interval_ms": 30000, "max_concurrent_deploys": 3}'::jsonb,
    'active'
),
-- 2. Security Swarm
-- Workers: audit-agent, threat-hunter, rbac-enforcer
-- Handles security scanning, threat detection, RBAC, and code governance
(
    'security-swarm', 'domain-core', 'Security Swarm',
    'Security scanning, threat detection, RBAC enforcement, and code governance. '
    'Integrates with code-governance.js auth gate and rbac-vendor.js tokens.',
    'security', ARRAY['identity', 'infrastructure'],
    ROUND(POWER(1.6180339887, 10) * 1000)::REAL,  -- φ^10 * 1000 ≈ 122,991ms (~2min)
    0.618, ARRAY[1, 5]::SMALLINT[],
    2, 6, 3,
    'stability-first', 'unanimous', 0.8,
    'heady-swarm-security',
    '{"scan_on_commit": true, "threat_alert_severity": "critical", "rbac_cache_ttl_sec": 300}'::jsonb,
    'active'
),
-- 3. Intelligence Swarm
-- Workers: reasoning-engine, knowledge-aggregator, embedding-generator
-- Core AI reasoning, RAG retrieval, and knowledge synthesis
(
    'intelligence-swarm', 'domain-core', 'Intelligence Swarm',
    'Core AI reasoning, RAG retrieval, knowledge aggregation, and embedding generation. '
    'Implements the CSL semantic gates (Resonance, Superposition, Orthogonal).',
    'intelligence', ARRAY['discovery'],
    ROUND(POWER(1.6180339887, 8) * 1000)::REAL,   -- φ^8 * 1000 ≈ 46,979ms (~47s)
    0.618, ARRAY[6, 7]::SMALLINT[],                -- octants 6,7 (high-z)
    3, 12, 6,
    'throughput-first', 'weighted', 0.5,
    'heady-swarm-intel',
    '{"model_affinity": ["claude-4-sonnet", "gpt-4o", "gemini-2.5-pro"], "max_context_tokens": 128000, "embedding_model": "all-MiniLM-L6-v2", "embedding_dims": 384}'::jsonb,
    'active'
),
-- 4. Pipeline Swarm
-- Workers: code-generator, stage-runner, checkpoint-manager
-- Manages HCFullPipeline execution across all 6 stages
(
    'pipeline-swarm', 'domain-core', 'Pipeline Swarm',
    'HCFullPipeline orchestration across INGEST → PROJECTION → REASONING → SYNTHESIS → IGNITION → AUDIT. '
    'Stage transitions, checkpointing, and rollback management.',
    'pipeline', ARRAY['intelligence', 'infrastructure'],
    ROUND(POWER(1.6180339887, 11) * 1000)::REAL,  -- φ^11 * 1000 ≈ 199,005ms (~3.3min)
    0.618, ARRAY[2, 3]::SMALLINT[],
    2, 8, 4,
    'balanced', 'majority', 0.6,
    'heady-swarm-pipeline',
    '{"max_concurrent_pipelines": 5, "checkpoint_enabled": true, "rollback_enabled": true, "stages": ["INGEST","PROJECTION","REASONING","SYNTHESIS","IGNITION","AUDIT"]}'::jsonb,
    'active'
),
-- 5. Communication Swarm
-- Workers: slack-bridge, email-sender, webhook-dispatcher, notification-manager
-- Handles all external communication channels
(
    'communication-swarm', 'domain-core', 'Communication Swarm',
    'External communication: Slack, email, webhooks, push notifications, and SSE streams. '
    'Bridges internal events to external consumers.',
    'communication', ARRAY['identity'],
    ROUND(POWER(1.6180339887, 9) * 1000)::REAL,   -- φ^9 * 1000 ≈ 76,013ms (~1.3min)
    0.618, ARRAY[0, 1]::SMALLINT[],
    1, 6, 2,
    'latency-first', 'majority', 0.5,
    'heady-swarm-comm',
    '{"channels": ["slack", "email", "webhook", "sse"], "rate_limit_per_channel": 100, "retry_on_failure": true}'::jsonb,
    'active'
),
-- 6. Finance Swarm
-- Workers: cost-optimizer, budget-enforcer, usage-tracker
-- Manages LLM costs, resource budgets, and billing
(
    'finance-swarm', 'domain-core', 'Finance Swarm',
    'Cost optimization, budget enforcement, and usage tracking across all LLM providers. '
    'Integrates with budget-tracker module for real-time cost caps.',
    'finance', ARRAY['infrastructure'],
    ROUND(POWER(1.6180339887, 13) * 1000)::REAL,  -- φ^13 * 1000 ≈ 521,002ms (~8.7min)
    0.618, ARRAY[4, 5]::SMALLINT[],
    1, 4, 2,
    'cost-first', 'majority', 0.5,
    'heady-swarm-finance',
    '{"daily_budget_usd": 50.00, "alert_threshold_pct": 80, "cost_per_model": {"claude-4-sonnet": 0.003, "gpt-4o": 0.005, "gemini-2.5-pro": 0.00125}}'::jsonb,
    'active'
),
-- 7. Identity Swarm
-- Workers: auth-validator, tenant-manager, key-rotator
-- Manages authentication, authorization, and multi-tenant isolation
(
    'identity-swarm', 'domain-core', 'Identity Swarm',
    'Authentication, authorization, tenant lifecycle, API key management, '
    'and RBAC token issuance. OAuth 2.1 / OIDC integration.',
    'identity', ARRAY['security'],
    ROUND(POWER(1.6180339887, 10) * 1000)::REAL,  -- φ^10 * 1000 ≈ 122,991ms (~2min)
    0.618, ARRAY[2, 6]::SMALLINT[],
    1, 4, 2,
    'stability-first', 'unanimous', 0.8,
    'heady-swarm-identity',
    '{"oauth_providers": ["google", "github"], "token_ttl_sec": 3600, "key_rotation_days": 90, "mfa_required": true}'::jsonb,
    'active'
),
-- 8. Discovery Swarm
-- Workers: service-locator, capability-finder, dependency-mapper
-- Service discovery, capability detection, and dependency management
(
    'discovery-swarm', 'domain-core', 'Discovery Swarm',
    'Service discovery, capability detection, health probing, and dependency mapping. '
    'Auto-discovers new bees and registers them in the swarm topology.',
    'discovery', ARRAY['infrastructure', 'intelligence'],
    ROUND(POWER(1.6180339887, 11) * 1000)::REAL,  -- φ^11 * 1000 ≈ 199,005ms (~3.3min)
    0.618, ARRAY[3, 7]::SMALLINT[],
    1, 6, 2,
    'balanced', 'majority', 0.5,
    'heady-swarm-discovery',
    '{"scan_interval_ms": 60000, "probe_timeout_ms": 5000, "auto_register": true}'::jsonb,
    'active'
);

-- ————————————————————————————————————————————————————————————————————————————
-- TIER 2: Pipeline Stage Swarms (6 swarms)
-- One swarm per HCFullPipeline stage for fine-grained orchestration
-- ————————————————————————————————————————————————————————————————————————————

-- 9. Ingest Stage Swarm
INSERT INTO heady_swarm.swarm_topology (
    swarm_name, swarm_type, display_name, description,
    domain, secondary_domains,
    phi_cycle_ms, resonance_freq, octant_affinity,
    min_agents, max_agents, target_agents,
    strategy, consensus_protocol, consensus_quorum,
    pubsub_topic,
    config, status
) VALUES (
    'ingest-stage-swarm', 'pipeline-stage', 'Ingest Stage Swarm',
    'Data acquisition and normalization. Fetches from APIs, files, and streams. '
    'Validates input schemas and routes to appropriate processing paths.',
    'pipeline', ARRAY['communication', 'discovery'],
    ROUND(POWER(1.6180339887, 7) * 1000)::REAL,   -- φ^7 * 1000 ≈ 29,034ms (~29s)
    0.618, ARRAY[0]::SMALLINT[],
    1, 8, 3,
    'throughput-first', 'majority', 0.5,
    'heady-stage-ingest',
    '{"stage": "INGEST", "max_batch_size": 100, "supported_formats": ["json", "csv", "text", "pdf", "code"]}'::jsonb,
    'active'
),
-- 10. Projection Stage Swarm
(
    'projection-stage-swarm', 'pipeline-stage', 'Projection Stage Swarm',
    'Vector space mapping. Generates 384-dim embeddings, computes 3D projections (x,y,z), '
    'assigns octant zones and Fibonacci shards.',
    'pipeline', ARRAY['intelligence'],
    ROUND(POWER(1.6180339887, 8) * 1000)::REAL,   -- φ^8 * 1000 ≈ 46,979ms (~47s)
    0.618, ARRAY[1]::SMALLINT[],
    1, 6, 3,
    'throughput-first', 'majority', 0.5,
    'heady-stage-projection',
    '{"stage": "PROJECTION", "embedding_model": "all-MiniLM-L6-v2", "dims": 384, "batch_size": 64, "gpu_accelerated": true}'::jsonb,
    'active'
),
-- 11. Reasoning Stage Swarm
(
    'reasoning-stage-swarm', 'pipeline-stage', 'Reasoning Stage Swarm',
    'Swarm consensus and multi-model reasoning. Applies CSL semantic gates '
    '(Resonance, Superposition, Orthogonal) for knowledge synthesis.',
    'pipeline', ARRAY['intelligence'],
    ROUND(POWER(1.6180339887, 9) * 1000)::REAL,   -- φ^9 * 1000 ≈ 76,013ms (~1.3min)
    0.618, ARRAY[6, 7]::SMALLINT[],
    2, 8, 4,
    'balanced', 'weighted', 0.6,
    'heady-stage-reasoning',
    '{"stage": "REASONING", "semantic_gates": ["resonance", "superposition", "orthogonal"], "multi_model": true, "consensus_rounds": 3}'::jsonb,
    'active'
),
-- 12. Synthesis Stage Swarm
(
    'synthesis-stage-swarm', 'pipeline-stage', 'Synthesis Stage Swarm',
    'Knowledge creation and memory consolidation. Merges reasoning outputs, '
    'builds graph RAG edges, and performs STM → LTM promotion.',
    'pipeline', ARRAY['intelligence'],
    ROUND(POWER(1.6180339887, 9) * 1000)::REAL,   -- φ^9 * 1000 ≈ 76,013ms (~1.3min)
    0.618, ARRAY[2, 3]::SMALLINT[],
    1, 6, 3,
    'balanced', 'majority', 0.5,
    'heady-stage-synthesis',
    '{"stage": "SYNTHESIS", "consolidation_threshold": 0.7, "graph_edge_types": ["caused_by", "led_to", "similar_to", "part_of", "contradicts"]}'::jsonb,
    'active'
),
-- 13. Ignition Stage Swarm
(
    'ignition-stage-swarm', 'pipeline-stage', 'Ignition Stage Swarm',
    'Deployment and action execution. Deploys code, triggers side effects, '
    'and executes approved actions from the pipeline.',
    'pipeline', ARRAY['infrastructure', 'communication'],
    ROUND(POWER(1.6180339887, 10) * 1000)::REAL,  -- φ^10 * 1000 ≈ 122,991ms (~2min)
    0.618, ARRAY[4, 5]::SMALLINT[],
    1, 4, 2,
    'stability-first', 'unanimous', 0.8,
    'heady-stage-ignition',
    '{"stage": "IGNITION", "approval_required": true, "rollback_on_failure": true, "deploy_targets": ["cloud-run", "cloudflare", "github"]}'::jsonb,
    'active'
),
-- 14. Audit Stage Swarm
(
    'audit-stage-swarm', 'pipeline-stage', 'Audit Stage Swarm',
    'Post-action verification and audit logging. Validates outputs, '
    'records immutable audit trail, and triggers alerts on anomalies.',
    'pipeline', ARRAY['security'],
    ROUND(POWER(1.6180339887, 10) * 1000)::REAL,  -- φ^10 * 1000 ≈ 122,991ms (~2min)
    0.618, ARRAY[1, 5]::SMALLINT[],
    1, 4, 2,
    'stability-first', 'majority', 0.6,
    'heady-stage-audit',
    '{"stage": "AUDIT", "immutable_log": true, "anomaly_detection": true, "retention_months": 12}'::jsonb,
    'active'
);

-- ————————————————————————————————————————————————————————————————————————————
-- TIER 3: Cross-Cutting Orchestration Swarms (3 swarms)
-- Meta-swarms that coordinate across all other swarms
-- ————————————————————————————————————————————————————————————————————————————

-- 15. Conductor Swarm (Master Orchestrator)
INSERT INTO heady_swarm.swarm_topology (
    swarm_name, swarm_type, display_name, description,
    domain, secondary_domains,
    phi_cycle_ms, resonance_freq, octant_affinity,
    min_agents, max_agents, target_agents,
    strategy, consensus_protocol, consensus_quorum,
    pubsub_topic,
    config, status
) VALUES (
    'conductor-swarm', 'orchestration', 'Conductor Swarm',
    'Master orchestrator. Routes tasks to the right swarms, manages HCFullPipeline runs, '
    'coordinates Hot/Warm/Cold pool scheduling, and handles inter-swarm communication. '
    'Patent: PPA #3 - Agentic Intelligence Network (AIN).',
    'infrastructure', ARRAY['pipeline', 'intelligence', 'discovery', 'security', 'communication', 'finance', 'identity'],
    ROUND(POWER(1.6180339887, 7) * 1000)::REAL,   -- φ^7 * 1000 ≈ 29,034ms (~29s) — fastest cycle
    0.618, ARRAY[0, 1, 2, 3, 4, 5, 6, 7]::SMALLINT[],  -- all octants (global oversight)
    2, 4, 3,
    'balanced', 'raft', 0.6,
    'heady-swarm-conductor',
    '{"is_master": true, "pool_rebalance_interval_ms": 60000, "swarm_health_check_ms": 30000, "task_routing": "domain-affinity", "dead_letter_check_ms": 300000}'::jsonb,
    'active'
),
-- 16. Sacred Geometry Swarm (Orchestration Aesthetics)
(
    'sacred-geometry-swarm', 'orchestration', 'Sacred Geometry Swarm',
    'Manages phi-weighted scheduling, 3D vector space topology, octant zone balancing, '
    'and Fibonacci shard distribution. Ensures the platform maintains its geometric harmony. '
    'Patent: PPA #1 - Cognitive Symmetry Protocol (CSP).',
    'intelligence', ARRAY['infrastructure', 'discovery'],
    ROUND(POWER(1.6180339887, 14) * 1000)::REAL,  -- φ^14 * 1000 ≈ 843,099ms (~14min) — slowest, deepest cycle
    0.618, ARRAY[0, 1, 2, 3, 4, 5, 6, 7]::SMALLINT[],  -- all octants (spatial awareness)
    1, 3, 2,
    'balanced', 'weighted', 0.5,
    'heady-swarm-geometry',
    '{"phi": 1.6180339887, "fibonacci_shards": 5, "octant_zones": 8, "vector_dims": 384, "projection_dims": 3, "rebalance_interval_ms": 600000, "drift_threshold": 0.15}'::jsonb,
    'active'
),
-- 17. Self-Awareness Swarm (Introspection & Coherence)
(
    'self-awareness-swarm', 'orchestration', 'Self-Awareness Swarm',
    'System introspection, semantic coherence monitoring, drift detection, and '
    'self-healing. Implements the self-awareness telemetry loop that makes '
    'Heady a truly alive software system. '
    'Patent: PPA #2 - Cognitive Symmetry Language (CSL).',
    'intelligence', ARRAY['security', 'infrastructure'],
    ROUND(POWER(1.6180339887, 11) * 1000)::REAL,  -- φ^11 * 1000 ≈ 199,005ms (~3.3min)
    0.618, ARRAY[6, 7]::SMALLINT[],                -- high-z octants (introspective space)
    1, 3, 2,
    'stability-first', 'unanimous', 0.8,
    'heady-swarm-awareness',
    '{"coherence_threshold": 0.85, "drift_alert_threshold": 0.2, "quarantine_threshold": 0.5, "self_heal_enabled": true, "introspection_depth": 3, "telemetry_retention_hours": 168}'::jsonb,
    'active'
);

-- ————————————————————————————————————————————————————————————————————————————
-- Inter-Swarm Communication Channels
-- ————————————————————————————————————————————————————————————————————————————

-- Conductor → all domain swarms (control channels)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT
    conductor.id,
    target.id,
    'control',
    'pubsub'
FROM heady_swarm.swarm_topology conductor
CROSS JOIN heady_swarm.swarm_topology target
WHERE conductor.swarm_name = 'conductor-swarm'
  AND target.swarm_type = 'domain-core'
  AND target.swarm_name != 'conductor-swarm';

-- Conductor → all pipeline stage swarms (control channels)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT
    conductor.id,
    target.id,
    'control',
    'pubsub'
FROM heady_swarm.swarm_topology conductor
CROSS JOIN heady_swarm.swarm_topology target
WHERE conductor.swarm_name = 'conductor-swarm'
  AND target.swarm_type = 'pipeline-stage';

-- Pipeline stage chain: INGEST → PROJECTION → REASONING → SYNTHESIS → IGNITION → AUDIT
WITH stage_order AS (
    SELECT id, swarm_name,
        CASE swarm_name
            WHEN 'ingest-stage-swarm' THEN 1
            WHEN 'projection-stage-swarm' THEN 2
            WHEN 'reasoning-stage-swarm' THEN 3
            WHEN 'synthesis-stage-swarm' THEN 4
            WHEN 'ignition-stage-swarm' THEN 5
            WHEN 'audit-stage-swarm' THEN 6
        END AS seq
    FROM heady_swarm.swarm_topology
    WHERE swarm_type = 'pipeline-stage'
)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT s1.id, s2.id, 'data', 'queue'
FROM stage_order s1
JOIN stage_order s2 ON s2.seq = s1.seq + 1;

-- Intelligence ↔ Reasoning (bidirectional data exchange)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT i.id, r.id, 'data', 'grpc'
FROM heady_swarm.swarm_topology i, heady_swarm.swarm_topology r
WHERE i.swarm_name = 'intelligence-swarm' AND r.swarm_name = 'reasoning-stage-swarm';

INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT r.id, i.id, 'data', 'grpc'
FROM heady_swarm.swarm_topology r, heady_swarm.swarm_topology i
WHERE r.swarm_name = 'reasoning-stage-swarm' AND i.swarm_name = 'intelligence-swarm';

-- Security → all swarms (event broadcast for threat alerts)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT
    sec.id,
    target.id,
    'event',
    'pubsub'
FROM heady_swarm.swarm_topology sec
CROSS JOIN heady_swarm.swarm_topology target
WHERE sec.swarm_name = 'security-swarm'
  AND target.swarm_name != 'security-swarm'
  AND target.status = 'active';

-- Self-Awareness ↔ Sacred Geometry (consensus on system coherence)
INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT a.id, g.id, 'consensus', 'grpc'
FROM heady_swarm.swarm_topology a, heady_swarm.swarm_topology g
WHERE a.swarm_name = 'self-awareness-swarm' AND g.swarm_name = 'sacred-geometry-swarm';

INSERT INTO heady_swarm.swarm_channels (source_swarm_id, target_swarm_id, channel_type, protocol)
SELECT g.id, a.id, 'consensus', 'grpc'
FROM heady_swarm.swarm_topology g, heady_swarm.swarm_topology a
WHERE g.swarm_name = 'sacred-geometry-swarm' AND a.swarm_name = 'self-awareness-swarm';

-- ————————————————————————————————————————————————————————————————————————————
-- Seed Default Agents for Critical Swarms
-- ————————————————————————————————————————————————————————————————————————————

-- Conductor agents (always-on)
INSERT INTO heady_core.agent_state (
    agent_id, agent_name, agent_type, domain, status, pool,
    capabilities, config
) VALUES
(
    'conductor-primary', 'Heady Conductor (Primary)', 'conductor', 'infrastructure',
    'idle', 'hot',
    ARRAY['task-routing', 'pool-scheduling', 'pipeline-management', 'swarm-coordination'],
    '{"is_primary": true, "failover_target": "conductor-secondary"}'::jsonb
),
(
    'conductor-secondary', 'Heady Conductor (Secondary)', 'conductor', 'infrastructure',
    'idle', 'warm',
    ARRAY['task-routing', 'pool-scheduling', 'pipeline-management', 'swarm-coordination'],
    '{"is_primary": false, "failover_source": "conductor-primary"}'::jsonb
),
-- Maestro (top-level coordinator)
(
    'maestro-alpha', 'Heady Maestro', 'maestro', 'intelligence',
    'idle', 'hot',
    ARRAY['multi-model-reasoning', 'swarm-consensus', 'knowledge-synthesis', 'csl-gates'],
    '{"model": "claude-4-sonnet", "reasoning_depth": "deep", "csl_version": "3.0"}'::jsonb
),
-- Sentinel (watchdog)
(
    'sentinel-health', 'Health Sentinel', 'sentinel', 'infrastructure',
    'idle', 'hot',
    ARRAY['health-monitoring', 'heartbeat-checking', 'dead-agent-detection', 'alert-dispatch'],
    '{"check_interval_ms": 15000, "alert_channels": ["slack", "email"]}'::jsonb
),
-- Buddy (companion agent)
(
    'buddy-primary', 'Heady Buddy', 'buddy', 'communication',
    'idle', 'hot',
    ARRAY['natural-language', 'context-retrieval', 'task-delegation', 'memory-recall'],
    '{"model": "claude-4-sonnet", "streaming": true, "personality": "helpful-expert"}'::jsonb
);

-- Assign agents to swarms
INSERT INTO heady_swarm.swarm_membership (swarm_id, agent_id, role, weight)
SELECT st.id, 'conductor-primary', 'leader', 2.0
FROM heady_swarm.swarm_topology st WHERE st.swarm_name = 'conductor-swarm';

INSERT INTO heady_swarm.swarm_membership (swarm_id, agent_id, role, weight)
SELECT st.id, 'conductor-secondary', 'worker', 1.0
FROM heady_swarm.swarm_topology st WHERE st.swarm_name = 'conductor-swarm';

INSERT INTO heady_swarm.swarm_membership (swarm_id, agent_id, role, weight)
SELECT st.id, 'maestro-alpha', 'leader', 2.0
FROM heady_swarm.swarm_topology st WHERE st.swarm_name = 'intelligence-swarm';

INSERT INTO heady_swarm.swarm_membership (swarm_id, agent_id, role, weight)
SELECT st.id, 'sentinel-health', 'sentinel', 1.5
FROM heady_swarm.swarm_topology st WHERE st.swarm_name = 'self-awareness-swarm';

INSERT INTO heady_swarm.swarm_membership (swarm_id, agent_id, role, weight)
SELECT st.id, 'buddy-primary', 'specialist', 1.5
FROM heady_swarm.swarm_topology st WHERE st.swarm_name = 'communication-swarm';

-- ————————————————————————————————————————————————————————————————————————————
-- Audit: Log the seed operation
-- ————————————————————————————————————————————————————————————————————————————

SELECT heady_audit.log_event(
    'system.seed',
    'create',
    'system', 'setup-script',
    'swarm_topology', NULL,
    'Seeded 17-swarm taxonomy with inter-swarm channels and default agents',
    jsonb_build_object(
        'swarms_created', 17,
        'agents_created', 5,
        'taxonomy_version', '3.1',
        'architecture', 'Liquid Architecture',
        'tiers', jsonb_build_object(
            'domain_core', 8,
            'pipeline_stage', 6,
            'orchestration', 3
        )
    ),
    'info',
    'system'
);

COMMIT;

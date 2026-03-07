-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 002
-- Vector Memories Table with 3D Spatial Indexing & HNSW
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Implements the 384-dimensional vector memory system with:
--   - 3D spatial projection (x, y, z from dim averages)
--   - HNSW indexing for approximate nearest neighbor search
--   - Fibonacci shard assignment
--   - Importance scoring: I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
--   - STM → LTM consolidation lifecycle
--   - Graph RAG edge support via JSONB
--   - Multi-tenant RLS enforcement
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Core Vector Memories Table
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_core.vector_memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES heady_identity.tenants(tenant_id)
                    DEFAULT heady_identity.current_tenant_id(),

    -- Embedding & 3D Projection
    embedding       vector(384) NOT NULL,                 -- 384-dim sentence-transformer embedding
    x               REAL NOT NULL,                         -- avg(dims[0..127])
    y               REAL NOT NULL,                         -- avg(dims[128..255])
    z               REAL NOT NULL,                         -- avg(dims[256..383])
    octant          SMALLINT NOT NULL CHECK (octant BETWEEN 0 AND 7),  -- 3D octant zone (0-7)
    shard_id        SMALLINT NOT NULL CHECK (shard_id BETWEEN 0 AND 4), -- Fibonacci shard (0-4)

    -- Content
    content         TEXT NOT NULL,                         -- raw text that was embedded
    content_hash    TEXT NOT NULL,                         -- SHA-256 hash for dedup
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,    -- arbitrary metadata
    tags            TEXT[] NOT NULL DEFAULT '{}',           -- fast tag-based filtering
    source          TEXT,                                   -- origin: 'user', 'agent', 'system', 'ingest'
    mime_type       TEXT DEFAULT 'text/plain',

    -- Memory Lifecycle (STM → LTM)
    memory_type     TEXT NOT NULL DEFAULT 'stm'
                    CHECK (memory_type IN ('stm', 'ltm', 'working', 'episodic', 'semantic')),
    consolidated_at TIMESTAMPTZ,                           -- when STM → LTM promotion occurred

    -- Importance Scoring: I(m) = αFreq + βRecency + δSurprise
    importance      REAL NOT NULL DEFAULT 0.5,             -- composite importance score [0, 1]
    frequency       INTEGER NOT NULL DEFAULT 0,            -- access count
    surprise        REAL NOT NULL DEFAULT 0.5,             -- novelty score [0, 1]
    last_accessed   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Graph RAG Edges
    graph_edges     JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{target_id, relation, weight}]

    -- Agent Attribution
    agent_id        TEXT,                                   -- bee/node that created this memory
    swarm_id        UUID,                                   -- swarm that owns this memory
    pipeline_run_id UUID,                                   -- pipeline run that produced it

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ                            -- optional TTL for ephemeral memories
);

-- ————————————————————————————————————————————————————————————————————————————
-- 2. HNSW Indexes for Vector Similarity Search
-- ————————————————————————————————————————————————————————————————————————————
-- HNSW = Hierarchical Navigable Small World — fastest ANN algorithm.
-- m = 16 connections per layer, ef_construction = 128 for build quality.

-- Primary: cosine similarity on full 384-dim embedding
CREATE INDEX idx_vm_embedding_hnsw ON heady_core.vector_memories
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- L2 distance index for Euclidean queries
CREATE INDEX idx_vm_embedding_l2_hnsw ON heady_core.vector_memories
    USING hnsw (embedding vector_l2_ops)
    WITH (m = 16, ef_construction = 128);

-- Inner product index for dot-product similarity
CREATE INDEX idx_vm_embedding_ip_hnsw ON heady_core.vector_memories
    USING hnsw (embedding vector_ip_ops)
    WITH (m = 16, ef_construction = 128);

-- ————————————————————————————————————————————————————————————————————————————
-- 3. B-Tree & GIN Indexes for Filtering
-- ————————————————————————————————————————————————————————————————————————————

-- Tenant isolation (every query filters by tenant_id first)
CREATE INDEX idx_vm_tenant ON heady_core.vector_memories (tenant_id);

-- 3D spatial zone-first filtering (octant + shard)
CREATE INDEX idx_vm_octant_shard ON heady_core.vector_memories (octant, shard_id);

-- 3D coordinate range scans
CREATE INDEX idx_vm_xyz ON heady_core.vector_memories (x, y, z);

-- Memory lifecycle queries
CREATE INDEX idx_vm_memory_type ON heady_core.vector_memories (memory_type);
CREATE INDEX idx_vm_consolidated ON heady_core.vector_memories (consolidated_at)
    WHERE consolidated_at IS NOT NULL;

-- Importance-based pruning/ranking
CREATE INDEX idx_vm_importance ON heady_core.vector_memories (importance DESC);

-- Tag-based filtering (GIN for array contains)
CREATE INDEX idx_vm_tags ON heady_core.vector_memories USING gin (tags);

-- Metadata JSONB queries
CREATE INDEX idx_vm_metadata ON heady_core.vector_memories USING gin (metadata jsonb_path_ops);

-- Content deduplication
CREATE UNIQUE INDEX idx_vm_content_hash_tenant ON heady_core.vector_memories (tenant_id, content_hash);

-- TTL expiration cleanup
CREATE INDEX idx_vm_expires ON heady_core.vector_memories (expires_at)
    WHERE expires_at IS NOT NULL;

-- Agent attribution
CREATE INDEX idx_vm_agent ON heady_core.vector_memories (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_vm_swarm ON heady_core.vector_memories (swarm_id) WHERE swarm_id IS NOT NULL;

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Row-Level Security (Multi-Tenant Isolation)
-- ————————————————————————————————————————————————————————————————————————————

ALTER TABLE heady_core.vector_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE heady_core.vector_memories FORCE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see their own tenant's memories
CREATE POLICY vm_tenant_isolation ON heady_core.vector_memories
    FOR ALL
    USING (tenant_id = heady_identity.current_tenant_id())
    WITH CHECK (tenant_id = heady_identity.current_tenant_id());

-- System tenant bypass: the system tenant (all zeros) can see everything
CREATE POLICY vm_system_bypass ON heady_core.vector_memories
    FOR ALL
    USING (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (heady_identity.current_tenant_id() = '00000000-0000-0000-0000-000000000000'::UUID);

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Auto-Compute 3D Projection & Octant on INSERT/UPDATE
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE FUNCTION heady_core.compute_3d_projection()
RETURNS TRIGGER AS $$
DECLARE
    dims REAL[];
    sum_x REAL := 0;
    sum_y REAL := 0;
    sum_z REAL := 0;
    i INTEGER;
BEGIN
    -- Extract dimensions from pgvector to float array
    dims := NEW.embedding::real[];

    -- x = avg(dims[1..128])  (1-indexed in PG)
    FOR i IN 1..128 LOOP
        sum_x := sum_x + dims[i];
    END LOOP;
    NEW.x := sum_x / 128.0;

    -- y = avg(dims[129..256])
    FOR i IN 129..256 LOOP
        sum_y := sum_y + dims[i];
    END LOOP;
    NEW.y := sum_y / 128.0;

    -- z = avg(dims[257..384])
    FOR i IN 257..384 LOOP
        sum_z := sum_z + dims[i];
    END LOOP;
    NEW.z := sum_z / 128.0;

    -- Compute octant: 3-bit encoding of sign(x), sign(y), sign(z)
    NEW.octant := (
        (CASE WHEN NEW.x >= 0 THEN 4 ELSE 0 END) |
        (CASE WHEN NEW.y >= 0 THEN 2 ELSE 0 END) |
        (CASE WHEN NEW.z >= 0 THEN 1 ELSE 0 END)
    )::SMALLINT;

    -- Compute Fibonacci shard: hash-based distribution across 5 shards
    NEW.shard_id := (abs(hashtext(NEW.id::text)) % 5)::SMALLINT;

    -- Auto-compute content hash if not provided
    IF NEW.content_hash IS NULL OR NEW.content_hash = '' THEN
        NEW.content_hash := encode(digest(NEW.content, 'sha256'), 'hex');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vm_3d_projection
    BEFORE INSERT OR UPDATE OF embedding ON heady_core.vector_memories
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.compute_3d_projection();

-- Updated-at trigger
CREATE TRIGGER trg_vm_updated_at
    BEFORE UPDATE ON heady_core.vector_memories
    FOR EACH ROW
    EXECUTE FUNCTION heady_core.set_updated_at();

-- ————————————————————————————————————————————————————————————————————————————
-- 6. Helper Functions for Vector Operations
-- ————————————————————————————————————————————————————————————————————————————

-- Importance scoring: I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
-- α=0.3, β=0.4, γ=0.001 (per-minute decay), δ=0.3
CREATE OR REPLACE FUNCTION heady_core.compute_importance(
    p_frequency INTEGER,
    p_last_accessed TIMESTAMPTZ,
    p_surprise REAL
)
RETURNS REAL AS $$
DECLARE
    alpha REAL := 0.3;
    beta  REAL := 0.4;
    gamma REAL := 0.001;
    delta REAL := 0.3;
    freq_norm REAL;
    recency REAL;
    minutes_elapsed REAL;
BEGIN
    -- Normalize frequency to [0, 1] using log scale
    freq_norm := LEAST(1.0, ln(GREATEST(1, p_frequency) + 1) / ln(101));

    -- Exponential recency decay
    minutes_elapsed := EXTRACT(EPOCH FROM (now() - p_last_accessed)) / 60.0;
    recency := exp(-gamma * minutes_elapsed);

    -- Composite importance
    RETURN LEAST(1.0, GREATEST(0.0,
        alpha * freq_norm + beta * recency + delta * p_surprise
    ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Zone-first similarity search (octant-aware)
CREATE OR REPLACE FUNCTION heady_core.search_vectors_by_zone(
    p_query_embedding vector(384),
    p_octant SMALLINT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_min_similarity REAL DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity REAL,
    importance REAL,
    memory_type TEXT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vm.id,
        vm.content,
        (1 - (vm.embedding <=> p_query_embedding))::REAL AS similarity,
        vm.importance,
        vm.memory_type,
        vm.metadata
    FROM heady_core.vector_memories vm
    WHERE (p_octant IS NULL OR vm.octant = p_octant)
      AND (1 - (vm.embedding <=> p_query_embedding)) >= p_min_similarity
    ORDER BY vm.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- STM → LTM consolidation: promote high-importance STM memories
CREATE OR REPLACE FUNCTION heady_core.consolidate_stm_to_ltm(
    p_importance_threshold REAL DEFAULT 0.7,
    p_min_age_hours INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
    consolidated INTEGER;
BEGIN
    WITH promoted AS (
        UPDATE heady_core.vector_memories
        SET memory_type = 'ltm',
            consolidated_at = now()
        WHERE memory_type = 'stm'
          AND importance >= p_importance_threshold
          AND created_at < now() - make_interval(hours => p_min_age_hours)
        RETURNING id
    )
    SELECT count(*) INTO consolidated FROM promoted;

    RETURN consolidated;
END;
$$ LANGUAGE plpgsql;

-- Prune expired and low-importance memories
CREATE OR REPLACE FUNCTION heady_core.prune_memories(
    p_importance_floor REAL DEFAULT 0.1,
    p_max_age_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    pruned INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM heady_core.vector_memories
        WHERE (expires_at IS NOT NULL AND expires_at < now())
           OR (memory_type = 'stm'
               AND importance < p_importance_floor
               AND created_at < now() - make_interval(days => p_max_age_days))
        RETURNING id
    )
    SELECT count(*) INTO deleted FROM deleted;

    RETURN COALESCE(deleted, 0);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =============================================================================
-- Migration: 001_hnsw_optimization.sql
-- Purpose:   HNSW index optimization for Heady Latent OS vector memory
-- Platform:  PostgreSQL 16+ with pgvector 0.7+ / 0.8+
-- Created:   2026-03-07
-- Author:    Heady Platform Team
--
-- Architecture:
--   - 384d primary embeddings (nomic-embed-text-v1.5 / jina-embeddings-v3)
--   - 1536d extended embeddings (voyage-3, OpenAI text-3-large)
--   - HNSW indexes with ef_construction=200, m=32 (high-recall production config)
--   - halfvec scalar quantization columns (50% memory savings)
--   - binary quantization columns (fast pre-filtering / 32x memory savings)
--   - GIN indexes on tsvector columns for BM25 full-text search
--   - pgvector 0.8.0 iterative scan support for filtered queries
--
-- Benchmark context (from research/section1_vector_db.md):
--   HNSW vs IVFFlat @ 1M vectors 99% recall:
--     QPS:      253 vs 8    (31x improvement)
--     p99 lat:  5.51ms vs 150ms (27x improvement)
--   halfvec:  50% storage savings, ~3x faster build, near-zero recall impact
--   binary:   32x storage savings, ~67x faster build (with re-ranking required)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Prerequisites
-- ---------------------------------------------------------------------------

-- Ensure pgvector extension is installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Track migration
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rolled_back BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO schema_migrations (version, description) VALUES
    ('001', 'HNSW index optimization with quantization and BM25 support')
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Performance settings for index builds
-- These are SET for the session; persist in postgresql.conf for production
-- ---------------------------------------------------------------------------

-- Allow more memory for parallel index builds (critical for large HNSW builds)
SET maintenance_work_mem = '4GB';

-- Use all available workers for parallel HNSW build
-- pgvector 0.7.0 reduced 1M×1536d build from 87 min → 9.5 min with parallelism
SET max_parallel_maintenance_workers = 7;

-- Enable parallel workers for query plans
SET max_parallel_workers_per_gather = 4;

-- ---------------------------------------------------------------------------
-- Core vector_memories table (Heady primary memory store)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vector_memories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bee_id              TEXT NOT NULL,                    -- Which bee/agent owns this memory
    session_id          TEXT,                             -- Session context
    workspace_id        TEXT,                             -- Multi-tenant workspace
    content             TEXT NOT NULL,                    -- Raw text content
    content_tokens      INTEGER,                          -- Token count for chunking
    embedding           vector(384),                      -- Primary 384d embedding
    embedding_1536      vector(1536),                     -- Extended 1536d embedding (optional)
    -- Scalar quantization columns (halfvec = 50% storage vs float32)
    embedding_half      halfvec(384),                     -- 384d half-precision (generated)
    embedding_1536_half halfvec(1536),                    -- 1536d half-precision (generated)
    -- Binary quantization columns (1 bit per dim = 32x storage savings vs float32)
    -- Used for fast pre-filtering; re-rank using original vectors
    embedding_binary    bit(384),                         -- 384d binary quantized
    embedding_1536_bin  bit(1536),                        -- 1536d binary quantized
    -- BM25 / full-text search
    content_tsv         TSVECTOR,                         -- Generated tsvector for BM25
    -- Metadata
    memory_type         TEXT NOT NULL DEFAULT 'episodic'  -- episodic | semantic | procedural | working
                        CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'working')),
    coherence_score     FLOAT,                            -- Sacred Geometry coherence score
    importance_score    FLOAT DEFAULT 0.5,                -- Priority for memory retention
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed_at    TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,                      -- TTL-based expiration
    tags                TEXT[],                           -- Flexible tagging
    metadata            JSONB NOT NULL DEFAULT '{}',      -- Arbitrary metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vector_memories IS
    'Primary vector memory store for Heady Latent OS bee agents. '
    'Stores 384d and 1536d embeddings with halfvec/binary quantization columns. '
    'Indexed with HNSW (ef_construction=200, m=32) for high-recall ANN search.';

COMMENT ON COLUMN vector_memories.embedding_half IS
    'Auto-maintained halfvec(384) for scalar-quantized HNSW index. '
    '50% memory savings vs float32 with near-zero recall impact.';

COMMENT ON COLUMN vector_memories.embedding_binary IS
    'Auto-maintained bit(384) for binary-quantized HNSW index. '
    '32x memory savings. Use with re-ranking against original embedding.';

-- ---------------------------------------------------------------------------
-- Generated columns: automatically maintain quantized representations
-- ---------------------------------------------------------------------------

-- Note: If using PostgreSQL 17+ with generated columns for vectors, use:
-- ALTER TABLE vector_memories
--   ADD COLUMN embedding_half halfvec(384) GENERATED ALWAYS AS (embedding::halfvec(384)) STORED;
-- For PostgreSQL 14-16, use triggers or application-layer population.

-- Trigger to auto-populate quantized columns on insert/update
CREATE OR REPLACE FUNCTION heady_sync_quantized_vectors()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Sync halfvec columns
    IF NEW.embedding IS NOT NULL THEN
        NEW.embedding_half   := NEW.embedding::halfvec(384);
        NEW.embedding_binary := binary_quantize(NEW.embedding)::bit(384);
    END IF;
    IF NEW.embedding_1536 IS NOT NULL THEN
        NEW.embedding_1536_half := NEW.embedding_1536::halfvec(1536);
        NEW.embedding_1536_bin  := binary_quantize(NEW.embedding_1536)::bit(1536);
    END IF;
    -- Sync full-text search vector
    IF NEW.content IS NOT NULL THEN
        NEW.content_tsv := to_tsvector('english', NEW.content);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER heady_vector_memories_sync
    BEFORE INSERT OR UPDATE ON vector_memories
    FOR EACH ROW EXECUTE FUNCTION heady_sync_quantized_vectors();

-- ---------------------------------------------------------------------------
-- HNSW Indexes — 384d primary embeddings
-- ---------------------------------------------------------------------------
-- Parameters rationale (from research benchmarks):
--   m=32:               Each node stores 32 neighbors (default=16).
--                       More connections = better recall but 2x graph memory.
--                       m=32 is the sweet spot for production high-recall.
--   ef_construction=200: Build-time quality beam width (default=64).
--                        Higher = better recall at higher build cost.
--                        200 is production-standard; use 64 for dev.
--   Cosine similarity:  Best for normalized text embeddings.
--   L2:                 Available for image/audio embeddings if needed.

-- Primary float32 HNSW index (highest recall, largest memory footprint)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_hnsw_384_cosine
ON vector_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 200);

COMMENT ON INDEX idx_vm_hnsw_384_cosine IS
    'HNSW index on 384d float32 embeddings. m=32, ef_construction=200. '
    'Highest recall, largest memory. Use for precision-critical queries.';

-- Scalar-quantized HNSW index (halfvec — 50% memory savings, ~3x faster build)
-- Near-identical recall to float32 at ef_construction >= 128.
-- Benchmark: 1M×1536d build: ~250s (vs 7,479s for float32 HNSW in pgvector 0.5)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_hnsw_384_half_cosine
ON vector_memories
USING hnsw (embedding_half halfvec_cosine_ops)
WITH (m = 32, ef_construction = 200);

COMMENT ON INDEX idx_vm_hnsw_384_half_cosine IS
    'HNSW index on 384d halfvec (scalar-quantized) embeddings. '
    '50% memory savings vs float32. Recommended default for production.';

-- Binary quantized HNSW index (bit — 32x memory savings, ~50x faster build)
-- Use for fast pre-filtering; always re-rank candidates using float32 vectors.
-- Recall at k=10 after over-fetching 4x and re-ranking: ~95%+ (matches float32)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_hnsw_384_binary_hamming
ON vector_memories
USING hnsw (embedding_binary bit_hamming_ops)
WITH (m = 32, ef_construction = 200);

COMMENT ON INDEX idx_vm_hnsw_384_binary_hamming IS
    'HNSW index on 384d binary-quantized embeddings (Hamming distance). '
    '32x memory savings. Use for pre-filtering; re-rank with float32 vectors.';

-- ---------------------------------------------------------------------------
-- HNSW Indexes — 1536d extended embeddings
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_hnsw_1536_cosine
ON vector_memories
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 32, ef_construction = 200);

COMMENT ON INDEX idx_vm_hnsw_1536_cosine IS
    'HNSW index on 1536d float32 embeddings (voyage-3, OpenAI text-3-large). '
    'm=32, ef_construction=200. For high-dimensional extended embeddings.';

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_hnsw_1536_half_cosine
ON vector_memories
USING hnsw (embedding_1536_half halfvec_cosine_ops)
WITH (m = 32, ef_construction = 200);

COMMENT ON INDEX idx_vm_hnsw_1536_half_cosine IS
    'HNSW index on 1536d halfvec embeddings. '
    '50% memory savings. Recommended default for 1536d workloads.';

-- ---------------------------------------------------------------------------
-- GIN Index for BM25 Full-Text Search
-- ---------------------------------------------------------------------------
-- Used in hybrid search (BM25 + dense vector + RRF fusion).
-- BM25 alone: nDCG@10 ≈ 43.4; Hybrid (BM25 + dense): +10-15% improvement.

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_tsv_gin
ON vector_memories
USING gin (content_tsv);

COMMENT ON INDEX idx_vm_tsv_gin IS
    'GIN index on tsvector for BM25 full-text search. '
    'Used in hybrid search pipeline with RRF score fusion.';

-- ---------------------------------------------------------------------------
-- Metadata / Scalar Indexes for Filtered Vector Search
-- ---------------------------------------------------------------------------
-- Critical for pgvector 0.8.0 iterative scan feature:
-- With hnsw.iterative_scan = relaxed_order, these indexes allow HNSW to
-- continue scanning until enough results pass the filter — preventing
-- incomplete result sets when filtering by bee_id, workspace_id, etc.

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_bee_id
ON vector_memories (bee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_workspace_id
ON vector_memories (workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_session_id
ON vector_memories (session_id)
WHERE session_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_memory_type
ON vector_memories (memory_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_created_at
ON vector_memories (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_importance_score
ON vector_memories (importance_score DESC)
WHERE importance_score > 0.5;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_expires_at
ON vector_memories (expires_at)
WHERE expires_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_tags_gin
ON vector_memories
USING gin (tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_metadata_gin
ON vector_memories
USING gin (metadata jsonb_path_ops);

-- Composite index for most common query pattern: bee_id + memory_type + time
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vm_bee_type_time
ON vector_memories (bee_id, memory_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Sparse vector table for SPLADE embeddings
-- ---------------------------------------------------------------------------
-- Uses pgvector 0.7.0's sparsevec type for learned sparse retrieval.
-- Supports up to 30,522 dimensions (BERT vocabulary size) with non-zero storage.
-- Enables SPLADE-style query expansion without full dense vector overhead.

CREATE TABLE IF NOT EXISTS vector_memories_sparse (
    id              UUID PRIMARY KEY REFERENCES vector_memories(id) ON DELETE CASCADE,
    bee_id          TEXT NOT NULL,
    sparse_embed    sparsevec(30522),    -- SPLADE/learned sparse representation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_vms_bee_id
ON vector_memories_sparse (bee_id);

COMMENT ON TABLE vector_memories_sparse IS
    'SPLADE sparse embeddings for hybrid lexical+dense retrieval. '
    'Linked 1:1 to vector_memories. Populated when sparse embedding models are available.';

-- ---------------------------------------------------------------------------
-- Query helper: Similarity search with iterative scan support
-- ---------------------------------------------------------------------------
-- Example invocation:
--   SELECT * FROM heady_similarity_search(
--     '[0.1, 0.2, ...]'::vector(384),
--     'bee_001',
--     'episodic',
--     10
--   );

CREATE OR REPLACE FUNCTION heady_similarity_search(
    query_embedding     vector(384),
    p_bee_id            TEXT,
    p_memory_type       TEXT DEFAULT NULL,
    p_limit             INTEGER DEFAULT 10,
    p_ef_search         INTEGER DEFAULT 100,
    use_iterative_scan  BOOLEAN DEFAULT TRUE,
    use_quantized       BOOLEAN DEFAULT FALSE  -- Use halfvec index for speed
)
RETURNS TABLE (
    id              UUID,
    content         TEXT,
    memory_type     TEXT,
    coherence_score FLOAT,
    importance_score FLOAT,
    similarity      FLOAT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Set HNSW runtime parameters
    PERFORM set_config('hnsw.ef_search', p_ef_search::TEXT, TRUE);

    -- Enable iterative scan for filtered queries (pgvector 0.8.0+)
    -- This prevents incomplete results when filtering by bee_id/memory_type
    IF use_iterative_scan THEN
        PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', TRUE);
        PERFORM set_config('hnsw.max_scan_tuples', '20000', TRUE);
    ELSE
        PERFORM set_config('hnsw.iterative_scan', 'off', TRUE);
    END IF;

    IF use_quantized THEN
        -- Scalar-quantized search: faster, 50% less memory, near-identical recall
        RETURN QUERY
        SELECT
            vm.id,
            vm.content,
            vm.memory_type,
            vm.coherence_score,
            vm.importance_score,
            1 - (vm.embedding_half <=> query_embedding::halfvec(384)) AS similarity,
            vm.created_at
        FROM vector_memories vm
        WHERE vm.bee_id = p_bee_id
          AND (p_memory_type IS NULL OR vm.memory_type = p_memory_type)
          AND (vm.expires_at IS NULL OR vm.expires_at > NOW())
        ORDER BY vm.embedding_half <=> query_embedding::halfvec(384)
        LIMIT p_limit;
    ELSE
        -- Full float32 search: highest recall
        RETURN QUERY
        SELECT
            vm.id,
            vm.content,
            vm.memory_type,
            vm.coherence_score,
            vm.importance_score,
            1 - (vm.embedding <=> query_embedding) AS similarity,
            vm.created_at
        FROM vector_memories vm
        WHERE vm.bee_id = p_bee_id
          AND (p_memory_type IS NULL OR vm.memory_type = p_memory_type)
          AND (vm.expires_at IS NULL OR vm.expires_at > NOW())
        ORDER BY vm.embedding <=> query_embedding
        LIMIT p_limit;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Query helper: Two-stage binary quantization search with re-ranking
-- ---------------------------------------------------------------------------
-- Stage 1: Fast Hamming-distance scan over binary vectors (32x smaller index)
-- Stage 2: Re-rank candidates using original float32 cosine similarity
-- Net result: ~67x faster than full float32 HNSW, ~95%+ recall after rerank

CREATE OR REPLACE FUNCTION heady_binary_rerank_search(
    query_embedding vector(384),
    p_bee_id        TEXT,
    p_limit         INTEGER DEFAULT 10,
    p_oversample    INTEGER DEFAULT 4    -- Fetch p_limit * p_oversample candidates
)
RETURNS TABLE (
    id          UUID,
    content     TEXT,
    similarity  FLOAT,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
DECLARE
    v_candidates INTEGER := p_limit * p_oversample;
BEGIN
    -- Stage 2: Re-rank using float32 cosine similarity
    RETURN QUERY
    SELECT
        vm.id,
        vm.content,
        1 - (vm.embedding <=> query_embedding) AS similarity,
        vm.created_at
    FROM (
        -- Stage 1: Fast binary Hamming distance pre-filter
        SELECT id
        FROM vector_memories
        WHERE bee_id = p_bee_id
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY embedding_binary <~> binary_quantize(query_embedding)::bit(384)
        LIMIT v_candidates
    ) candidates
    JOIN vector_memories vm ON vm.id = candidates.id
    ORDER BY vm.embedding <=> query_embedding
    LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Maintenance: Auto-update timestamps
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION heady_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Performance monitoring view
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW heady_index_health AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan        AS index_scans,
    idx_tup_read    AS tuples_read,
    idx_tup_fetch   AS tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END             AS usage_status,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('vector_memories', 'vector_memories_sparse')
ORDER BY tablename, indexname;

COMMENT ON VIEW heady_index_health IS
    'Monitor HNSW and GIN index usage statistics for vector_memories. '
    'Check index_scans to identify unused indexes consuming memory.';

-- ---------------------------------------------------------------------------
-- Performance monitoring view: slow vector queries
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW heady_slow_queries AS
SELECT
    query,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(max_exec_time::numeric, 2)  AS max_ms,
    round(total_exec_time::numeric / 1000, 2) AS total_sec,
    rows
FROM pg_stat_statements
WHERE query ILIKE '%vector_memories%'
  AND mean_exec_time > 50  -- Flag queries over 50ms average
ORDER BY mean_exec_time DESC
LIMIT 20;

COMMENT ON VIEW heady_slow_queries IS
    'Identify slow vector memory queries (avg > 50ms). '
    'Requires pg_stat_statements extension.';

-- ---------------------------------------------------------------------------
-- Recommended postgresql.conf settings (as comment reference)
-- ---------------------------------------------------------------------------
-- Apply these in Cloud Run PostgreSQL sidecar or Cloud SQL configuration:
--
-- # Memory settings for vector workloads
-- shared_buffers = 8GB                    # 25% of total RAM
-- effective_cache_size = 24GB             # 75% of total RAM
-- work_mem = 256MB                        # Per sort/hash operation
-- maintenance_work_mem = 4GB              # For index builds
--
-- # HNSW build parallelism
-- max_parallel_maintenance_workers = 7    # N_CPU - 1
-- max_parallel_workers_per_gather = 4
-- max_parallel_workers = 8
--
-- # WAL settings (reduce for index build sessions)
-- wal_compression = on
-- checkpoint_completion_target = 0.9
--
-- # pgvector 0.8.0 iterative scan defaults
-- # (set per-query via SET hnsw.iterative_scan = 'relaxed_order')
-- ---------------------------------------------------------------------------

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (run if migration needs to be reversed)
-- =============================================================================
-- To rollback:
-- BEGIN;
-- DROP TRIGGER IF EXISTS heady_vector_memories_sync ON vector_memories;
-- DROP FUNCTION IF EXISTS heady_sync_quantized_vectors();
-- DROP FUNCTION IF EXISTS heady_similarity_search(vector, text, text, integer, integer, boolean, boolean);
-- DROP FUNCTION IF EXISTS heady_binary_rerank_search(vector, text, integer, integer);
-- DROP FUNCTION IF EXISTS heady_update_updated_at();
-- DROP VIEW IF EXISTS heady_index_health;
-- DROP VIEW IF EXISTS heady_slow_queries;
-- DROP TABLE IF EXISTS vector_memories_sparse;
-- DROP TABLE IF EXISTS vector_memories;
-- UPDATE schema_migrations SET rolled_back = TRUE WHERE version = '001';
-- COMMIT;

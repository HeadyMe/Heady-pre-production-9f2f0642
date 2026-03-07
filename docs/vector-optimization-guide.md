# Vector Database Optimization Guide — Heady Latent OS

**Platform:** Node.js (Express) on Cloud Run + PostgreSQL/pgvector  
**Version:** pgvector 0.8.0+  
**Last updated:** March 7, 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Migration Playbook](#2-migration-playbook)
3. [Performance Tuning Checklist](#3-performance-tuning-checklist)
4. [Monitoring Dashboard Queries](#4-monitoring-dashboard-queries)
5. [Troubleshooting Guide](#5-troubleshooting-guide)
6. [Capacity Planning Formulas](#6-capacity-planning-formulas)

---

## 1. Architecture Overview

### 1.1 Design Decisions

#### Why HNSW over IVFFlat

Heady uses HNSW indexes exclusively for all vector similarity search. The decision is based on benchmarks from [Jonathan Katz's 150× speedup study](https://jkatz.github.io/post/postgres/pgvector-performance-150x-speedup/) and [AWS Aurora pgvector 0.7.0 analysis](https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/):

| Metric | HNSW | IVFFlat | Winner |
|--------|------|---------|--------|
| QPS @ 99% recall (1M × 1536d) | 253 | 8 | **HNSW (31×)** |
| p99 latency (1M × 1536d) | 5.51ms | 150ms | **HNSW (27×)** |
| Incremental inserts | ✓ No rebuild | ✗ Rebuild required | **HNSW** |
| Build time (pgvector 0.7+) | 4.2 min | 8 min | **HNSW (2×)** |
| Index size (1M × 1536d) | ~7.6 GiB | ~7.6 GiB | Tie |

**Key insight:** IVFFlat degrades when the index is built on partial data — an agent memory system continuously ingests new memories, making IVFFlat's requirement for periodic full rebuilds operationally untenable. HNSW handles incremental inserts without quality degradation.

#### Why Scalar Quantization (halfvec) is Default

All 384d HNSW indexes on Heady use a companion `halfvec` column for the index, with the original `float32` vector retained for re-ranking. Research from [Jonathan Katz's quantization blog](https://jkatz.github.io/post/postgres/pgvector-scalar-binary-quantization/) shows:

- **50% memory savings** with near-identical recall
- **~3× faster HNSW build time** vs float32
- Recall impact at `ef_construction=256`: essentially zero difference

The halfvec index handles the ANN search (fast approximate lookup); the original float32 column is used only for re-ranking the top candidates. This two-column design is implemented in migration `001_hnsw_optimization.sql`.

#### Why pgvector 0.8.0 Iterative Scan Matters

Agent memory systems constantly filter by:
- `bee_id` (which agent/swarm worker owns the memory)
- `workspace_id` (multi-tenant isolation)
- `memory_type` (episodic, semantic, procedural)
- `importance_score` (relevance filter)

Before pgvector 0.8.0, a HNSW query with a selective WHERE clause (e.g., `bee_id = 'bee_001'`) would scan `ef_search` candidates, apply the filter, and return whatever survived — often returning 0–3 results when 10 were requested. The [AWS Aurora 0.8.0 benchmark](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/) shows `iterative_scan = relaxed_order` provides **100× better result completeness** for 90% selective filters.

Heady sets this globally in migration 001:
```sql
ALTER SYSTEM SET hnsw.iterative_scan = 'relaxed_order';
ALTER SYSTEM SET hnsw.max_scan_tuples = 20000;
```

#### Why Hybrid Search (BM25 + Dense + RRF)

Pure dense search misses exact keyword matches, proper nouns, and out-of-vocabulary terms. Research from [IBM and InfiniFlow](https://infiniflow.org/blog/best-hybrid-search-solution) shows:

- BM25 alone: nDCG@10 ≈ 43.4
- Dense alone: nDCG@10 ≈ 51–55
- **Hybrid (BM25 + dense + RRF): +10–15% over individual methods**

Heady's `HybridSearchEngine` (modules/hybrid-search.js) runs BM25 and dense search in parallel, then combines using Reciprocal Rank Fusion (k=60). Optional SPLADE sparse vectors can be added as a third signal.

#### Why LightRAG over Microsoft GraphRAG

For Graph RAG on agent memory, [LightRAG (HKUDS)](https://arxiv.org/html/2410.05779v3) is preferred over Microsoft GraphRAG for these reasons:

| Criterion | LightRAG | Microsoft GraphRAG |
|-----------|----------|-------------------|
| Incremental updates | ✓ Yes (~50% lower cost) | ✗ Full rebuild required |
| Cost per indexing | ~$0.15 | ~$4.00 (GPT-4o pricing) |
| API calls per query | 1 | Hundreds |
| Query latency | ~80ms | Seconds |
| Build-time blocking | No | Yes (hours for large corpora) |

Agent memory continuously ingests new data — GraphRAG's requirement for periodic full rebuilds makes it operationally impractical. LightRAG's incremental merge (implemented in `buildGraph()`) is designed for continuous-ingest workloads.

### 1.2 System Architecture Diagram

```
                    Heady Latent OS — Vector Memory Stack
                    ─────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────┐
  │  Bee Worker (bee-factory.js pattern)                            │
  │  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐  │
  │  │ EmbeddingRouter│  │ HybridSearch  │  │  GraphRAGEngine    │  │
  │  │ ─────────────  │  │ ─────────────  │  │ ─────────────────  │  │
  │  │ nomic / jina   │  │ BM25 (tsvector)│  │ Entities (graph)  │  │
  │  │ cohere / voyage│  │ Dense (HNSW)   │  │ Relationships     │  │
  │  │ local (Ollama) │  │ SPLADE (opt.)  │  │ Communities       │  │
  │  │ Circuit breaker│  │ RRF fusion     │  │ Incremental update│  │
  │  │ LRU cache      │  │                │  │                   │  │
  │  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘  │
  └──────────┼─────────────────┼──────────────────────┼────────────┘
             │                 │                      │
  ┌──────────▼─────────────────▼──────────────────────▼────────────┐
  │  PostgreSQL 16 + pgvector 0.8.0                                 │
  │                                                                  │
  │  vector_memories table                                           │
  │  ┌──────────────┬─────────────────┬─────────────────────────┐  │
  │  │ embedding    │ embedding_half   │ embedding_binary        │  │
  │  │ vector(384)  │ halfvec(384)     │ bit(384)                │  │
  │  │ (full float) │ (HNSW index)     │ (pre-filter index)      │  │
  │  │              │ 50% memory save  │ 96.9% memory save       │  │
  │  └──────────────┴─────────────────┴─────────────────────────┘  │
  │  ┌──────────────────────────────────────────────────────────┐   │
  │  │ content_tsv  tsvector — GIN index for BM25               │   │
  │  └──────────────────────────────────────────────────────────┘   │
  │                                                                  │
  │  graph_rag_entities        graph_rag_relationships               │
  │  graph_rag_communities     (from migration 002)                  │
  └──────────────────────────────────────────────────────────────────┘
                         │
  ┌──────────────────────▼─────────────────────────────────────────┐
  │  VectorMemoryOptimizer (monitoring)                             │
  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
  │  │ Index advisor│  │ Quant advisor│  │ Slow query detector   │  │
  │  │ HNSW params  │  │ float→halfvec│  │ pg_stat_statements   │  │
  │  │ by scale tier│  │ halfvec→bit  │  │ HNSW ef_search tuning│  │
  │  └─────────────┘  └──────────────┘  └──────────────────────┘  │
  └────────────────────────────────────────────────────────────────┘
```

### 1.3 Index Strategy by Collection Size

| Vector Count | Index Type | Quantization | HNSW m | ef_construction | ef_search |
|---|---|---|---|---|---|
| < 30K | Sequential scan | Full float32 | N/A | N/A | N/A |
| 30K – 50K | HNSW | Full float32 | 16 | 64 | 40 |
| 50K – 500K | HNSW | Full float32 | 16 | 128 | 80 |
| 500K – 1M | HNSW | halfvec (SQ) | 32 | 200 | 100 |
| 1M – 10M | HNSW on halfvec | halfvec | 32 | 256 | 150 |
| > 10M | HNSW + binary pre-filter | binary + rerank | 32 | 256 | 200 |
| > 50M | pgvectorscale / StreamingDiskANN | SBQ | — | — | — |

---

## 2. Migration Playbook

### 2.1 Prerequisites

```bash
# Verify pgvector version (requires 0.8.0+)
psql -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# Check PostgreSQL version (requires 14+)
psql -c "SELECT version();"

# Estimate table size before migration
psql -c "SELECT pg_size_pretty(pg_total_relation_size('vector_memories'));"

# Check available disk space (need ~2× current table size)
df -h
```

### 2.2 Step-by-Step Migration

#### Step 1: Apply Session-Level Performance Settings

Run before each migration to avoid timeouts and optimize parallel build:

```sql
-- Set high maintenance_work_mem for parallel HNSW build
SET maintenance_work_mem = '2GB';          -- Or higher on large instances

-- Enable parallel index build (scale with CPU count - 2)
SET max_parallel_maintenance_workers = 7;  -- For 8-core server

-- Increase lock timeout for concurrent operations
SET lock_timeout = '30s';

-- Disable sequential scan during migration to force index usage validation
-- (restore after migration)
SET enable_seqscan = off;
```

#### Step 2: Run Migration 001 (HNSW Optimization)

```bash
# Apply with progress monitoring
psql -v ON_ERROR_STOP=1 -f migrations/001_hnsw_optimization.sql

# Monitor build progress (run in separate terminal)
watch -n 5 "psql -c \"
  SELECT
    phase,
    blocks_done,
    blocks_total,
    ROUND(blocks_done * 100.0 / NULLIF(blocks_total, 0), 1) AS pct_done,
    tuples_done,
    tuples_total
  FROM pg_stat_progress_create_index;
\""
```

Expected completion times for `vector_memories`:
- 100K vectors × 384d: ~30 seconds
- 500K vectors × 384d: ~2 minutes
- 1M vectors × 384d: ~5 minutes (with 8 parallel workers)

#### Step 3: Validate Index Creation

```sql
-- Confirm all indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'vector_memories'
ORDER BY indexname;

-- Test HNSW query performance
EXPLAIN ANALYZE
SELECT id, content, 1 - (embedding_half <=> '[0.1, 0.2, ...]'::halfvec(384)) AS similarity
FROM vector_memories
WHERE bee_id = 'test_bee'
ORDER BY embedding_half <=> '[0.1, 0.2, ...]'::halfvec(384)
LIMIT 10;
-- Should show: "Index Scan using vector_memories_hnsw_half_cosine"
-- Should NOT show: "Seq Scan"
```

#### Step 4: Apply Migration 002 (Graph RAG Schema)

```bash
psql -v ON_ERROR_STOP=1 -f migrations/002_graph_rag_schema.sql

# Verify graph tables
psql -c "\dt graph_rag_*"
```

#### Step 5: Reload PostgreSQL Configuration

```bash
# Apply system-level settings from migration 001
psql -c "SELECT pg_reload_conf();"

# Verify iterative scan is enabled
psql -c "SHOW hnsw.iterative_scan;"  -- Should show: relaxed_order
psql -c "SHOW hnsw.max_scan_tuples;" -- Should show: 20000
```

#### Step 6: Run ANALYZE to Update Statistics

```sql
ANALYZE vector_memories;
ANALYZE graph_rag_entities;
ANALYZE graph_rag_relationships;
ANALYZE graph_rag_communities;
```

### 2.3 Rolling Back

If migration fails:

```bash
# Rollback migration 001
psql -v ON_ERROR_STOP=1 -c "
BEGIN;
-- Drop new columns (data not lost, only indexes)
DROP INDEX CONCURRENTLY IF EXISTS vector_memories_hnsw_cosine;
DROP INDEX CONCURRENTLY IF EXISTS vector_memories_hnsw_half_cosine;
DROP INDEX CONCURRENTLY IF EXISTS vector_memories_hnsw_bin;
DROP INDEX CONCURRENTLY IF EXISTS vector_memories_bm25_content;
ALTER TABLE vector_memories DROP COLUMN IF EXISTS embedding_half;
ALTER TABLE vector_memories DROP COLUMN IF EXISTS embedding_binary;
ALTER TABLE vector_memories DROP COLUMN IF EXISTS content_tsv;
COMMIT;
"

# Restore system settings
psql -c "ALTER SYSTEM RESET hnsw.iterative_scan;"
psql -c "ALTER SYSTEM RESET hnsw.max_scan_tuples;"
psql -c "SELECT pg_reload_conf();"
```

### 2.4 Zero-Downtime Migration Pattern

For production systems that cannot tolerate downtime:

```sql
-- Phase 1: Add new columns (non-blocking, immediate)
ALTER TABLE vector_memories ADD COLUMN IF NOT EXISTS embedding_half halfvec(384);
ALTER TABLE vector_memories ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- Phase 2: Backfill in batches (run during off-peak)
-- This script backfills 10,000 rows at a time with a 100ms pause between batches
DO $$
DECLARE
  batch_size   INT := 10000;
  offset_val   INT := 0;
  updated_rows INT;
BEGIN
  LOOP
    UPDATE vector_memories
    SET
      embedding_half = embedding::halfvec(384),
      content_tsv    = to_tsvector('english', COALESCE(content, ''))
    WHERE id IN (
      SELECT id FROM vector_memories
      WHERE embedding_half IS NULL
      ORDER BY id
      LIMIT batch_size
    );

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    EXIT WHEN updated_rows = 0;

    RAISE NOTICE 'Backfilled % rows', updated_rows;
    PERFORM pg_sleep(0.1);  -- 100ms pause to avoid I/O saturation
  END LOOP;
END $$;

-- Phase 3: Build indexes CONCURRENTLY (non-blocking, runs in background)
SET maintenance_work_mem = '2GB';
CREATE INDEX CONCURRENTLY IF NOT EXISTS vector_memories_hnsw_half_cosine
  ON vector_memories USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);

CREATE INDEX CONCURRENTLY IF NOT EXISTS vector_memories_bm25_content
  ON vector_memories USING gin (content_tsv);
```

---

## 3. Performance Tuning Checklist

### 3.1 PostgreSQL Configuration

Apply via `configs/pgvector-optimized.yaml` or ALTER SYSTEM:

```sql
-- Memory settings (for 32GB RAM instance)
ALTER SYSTEM SET shared_buffers               = '8GB';
ALTER SYSTEM SET effective_cache_size         = '24GB';
ALTER SYSTEM SET work_mem                     = '256MB';
ALTER SYSTEM SET maintenance_work_mem         = '2GB';

-- Parallel query
ALTER SYSTEM SET max_parallel_maintenance_workers = 7;
ALTER SYSTEM SET max_parallel_workers_per_gather  = 4;

-- WAL settings for write-heavy workloads
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers                  = '64MB';

-- Vacuum tuning for vector tables (frequent updates)
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.01;  -- 1% (not default 20%)
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.005; -- 0.5%

-- pgvector-specific
ALTER SYSTEM SET hnsw.ef_search        = 100;
ALTER SYSTEM SET hnsw.iterative_scan   = 'relaxed_order';
ALTER SYSTEM SET hnsw.max_scan_tuples  = 20000;

SELECT pg_reload_conf();
```

### 3.2 Query-Level Tuning

```sql
-- For high-recall queries (accuracy > speed):
SET hnsw.ef_search = 200;
SET hnsw.iterative_scan = 'strict_order';

-- For high-throughput queries (speed > accuracy):
SET hnsw.ef_search = 40;
SET hnsw.iterative_scan = 'relaxed_order';

-- For filtered queries (e.g., WHERE bee_id = '...'):
-- ALWAYS use iterative scan for selective filters
SET hnsw.iterative_scan = 'relaxed_order';
SET hnsw.max_scan_tuples = 40000;  -- Increase for very selective filters
```

### 3.3 Query Pattern Best Practices

#### Correct: halfvec index for search, float32 for re-ranking

```sql
-- Best pattern: halfvec ANN search + float32 re-rank
WITH candidates AS (
  SELECT id, embedding
  FROM vector_memories
  WHERE bee_id = $1 AND memory_type = $2
  ORDER BY embedding_half <=> $3::halfvec(384)
  LIMIT 40  -- Oversample for re-ranking
)
SELECT
  c.id,
  m.content,
  m.metadata,
  1 - (c.embedding <=> $3::vector(384)) AS similarity  -- Re-rank on full float
FROM candidates c
JOIN vector_memories m ON c.id = m.id
ORDER BY similarity DESC
LIMIT 10;
```

#### Correct: Binary pre-filter for large collections

```sql
-- For >10M vectors: binary pre-filter reduces search space by ~10×
WITH binary_candidates AS (
  SELECT id
  FROM vector_memories
  ORDER BY embedding_binary <~> binary_quantize($1::vector(384))::bit(384)
  LIMIT 100  -- Fast hamming-distance pre-filter
)
SELECT
  vm.id,
  vm.content,
  1 - (vm.embedding <=> $1) AS similarity
FROM binary_candidates bc
JOIN vector_memories vm ON bc.id = vm.id
ORDER BY vm.embedding <=> $1
LIMIT 10;
```

#### Avoid: Sequential scan on large tables

```sql
-- BAD: Will do sequential scan if HNSW index is not used
-- (happens when ef_search is too low for the filter selectivity)
SELECT id FROM vector_memories
WHERE bee_id = 'rare_bee_id'  -- Very selective filter
ORDER BY embedding <=> $1 LIMIT 10;
-- Fix: Enable iterative scan and increase max_scan_tuples
```

### 3.4 Connection Pool Settings

For Cloud Run deployments with pgvector (from `configs/pgvector-optimized.yaml`):

```javascript
// Recommended pg Pool settings for vector workloads
const pool = new Pool({
  max:              20,         // Max connections per Cloud Run instance
  idleTimeoutMillis: 30_000,   // Release idle connections after 30s
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,   // Prevent runaway vector queries
  // pgvector settings applied per-connection
  application_name: 'heady-vector-worker',
});
```

---

## 4. Monitoring Dashboard Queries

### 4.1 Vector Index Performance

```sql
-- HNSW index hit rate and usage
SELECT
  indexrelname                                                   AS index,
  idx_scan                                                       AS total_scans,
  idx_tup_read                                                   AS tuples_read,
  idx_tup_fetch                                                  AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid))                   AS index_size,
  ROUND(idx_blks_hit * 100.0 / NULLIF(idx_blks_read + idx_blks_hit, 0), 2)
                                                                 AS cache_hit_pct
FROM pg_stat_user_indexes
WHERE relname IN ('vector_memories', 'graph_rag_entities')
  AND (indexrelname LIKE '%hnsw%' OR indexrelname LIKE '%bm25%')
ORDER BY idx_scan DESC;
```

### 4.2 Slow Vector Queries

```sql
-- Top 10 slowest vector queries (requires pg_stat_statements)
SELECT
  LEFT(query, 200)                                               AS query_sample,
  calls,
  ROUND(mean_exec_time::numeric, 2)                             AS mean_ms,
  ROUND(max_exec_time::numeric, 2)                              AS max_ms,
  ROUND(total_exec_time::numeric / 1000, 2)                     AS total_sec,
  rows
FROM pg_stat_statements
WHERE
  (query ILIKE '%<=>%' OR query ILIKE '%<~>%' OR query ILIKE '%halfvec%')
  AND query NOT ILIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 4.3 Vector Memory Table Health

```sql
-- Dead tuple ratios and vacuum status for vector tables
SELECT
  relname                                                        AS table,
  n_live_tup                                                     AS live_tuples,
  n_dead_tup                                                     AS dead_tuples,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup, 0), 2)         AS dead_pct,
  last_autovacuum,
  last_autoanalyze,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname))
                                                                 AS total_size
FROM pg_stat_user_tables
WHERE relname IN (
  'vector_memories', 'graph_rag_entities',
  'graph_rag_relationships', 'graph_rag_communities'
)
ORDER BY n_dead_tup DESC;
```

### 4.4 Index Build Progress

```sql
-- Monitor ongoing HNSW index builds
SELECT
  command,
  phase,
  blocks_done,
  blocks_total,
  ROUND(blocks_done * 100.0 / NULLIF(blocks_total, 0), 1) AS pct_complete,
  tuples_done,
  tuples_total,
  current_locker_pid
FROM pg_stat_progress_create_index
WHERE command = 'CREATE INDEX CONCURRENTLY';
```

### 4.5 Memory Pressure Indicators

```sql
-- Buffer cache hit rate (should be >99% for hot data)
SELECT
  sum(heap_blks_read)  AS heap_disk_reads,
  sum(heap_blks_hit)   AS heap_cache_hits,
  ROUND(sum(heap_blks_hit) * 100.0 /
    NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2)
                       AS cache_hit_pct
FROM pg_statio_user_tables
WHERE relname IN ('vector_memories', 'graph_rag_entities');

-- Background writer checkpoints (high maxwritten_clean = memory pressure)
SELECT
  checkpoints_timed,
  checkpoints_req,
  buffers_checkpoint,
  buffers_clean,
  maxwritten_clean,    -- If >0 frequently, increase bgwriter_lru_maxpages
  buffers_backend      -- If high, increase shared_buffers
FROM pg_stat_bgwriter;
```

### 4.6 Graph RAG Statistics

```sql
-- Knowledge graph health overview
SELECT
  graph_id,
  COUNT(DISTINCT e.id)            AS entity_count,
  COUNT(DISTINCT r.id)            AS relationship_count,
  COUNT(DISTINCT c.id)            AS community_count,
  AVG(e.mention_count)::int       AS avg_entity_mentions,
  COUNT(DISTINCT e.id) FILTER (WHERE e.embedding IS NULL)
                                  AS entities_without_embeddings,
  MAX(e.updated_at)               AS last_updated
FROM graph_rag_entities e
LEFT JOIN graph_rag_relationships r ON r.graph_id = e.graph_id
LEFT JOIN graph_rag_communities c   ON c.graph_id = e.graph_id
GROUP BY e.graph_id
ORDER BY entity_count DESC;
```

### 4.7 Embedding Provider Cost Tracking

```sql
-- If you log embedding calls to an audit table (optional):
-- CREATE TABLE embedding_audit (
--   id          BIGSERIAL PRIMARY KEY,
--   provider    TEXT,
--   token_count INT,
--   cost_usd    NUMERIC(12,8),
--   created_at  TIMESTAMPTZ DEFAULT NOW()
-- );

SELECT
  provider,
  COUNT(*)                                  AS requests,
  SUM(token_count)                          AS total_tokens,
  ROUND(SUM(cost_usd)::numeric, 4)         AS total_cost_usd,
  DATE_TRUNC('day', created_at)            AS day
FROM embedding_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider, DATE_TRUNC('day', created_at)
ORDER BY day DESC, total_cost_usd DESC;
```

---

## 5. Troubleshooting Guide

### 5.1 HNSW Returns Fewer Results Than Requested (Filtered Queries)

**Symptom:** `queryResults.length < limit` on filtered queries (e.g., WHERE bee_id = '...')

**Root cause:** Filter is too selective for current `ef_search` value; not enough candidates pass the filter before the scan terminates.

**Diagnosis:**
```sql
EXPLAIN ANALYZE
SELECT id FROM vector_memories
WHERE bee_id = 'rare_bee_id'
ORDER BY embedding_half <=> $1::halfvec(384) LIMIT 10;
-- Look for: "Rows Removed by Filter: XXXX"
-- If "XXXX" > 1000, increase max_scan_tuples
```

**Fix:**
```sql
-- Option 1: Increase scan ceiling (persistent session setting)
SET hnsw.max_scan_tuples = 50000;

-- Option 2: Enable iterative scan if not already set
SET hnsw.iterative_scan = 'relaxed_order';

-- Option 3: For very selective filters, add a composite index
CREATE INDEX vector_memories_bee_partial
ON vector_memories USING hnsw (embedding_half halfvec_cosine_ops)
WHERE bee_id = 'high_volume_bee_id'  -- Only for bees with >50K memories
WITH (m = 32, ef_construction = 200);
```

### 5.2 HNSW Index Not Used (Sequential Scan)

**Symptom:** `EXPLAIN ANALYZE` shows "Seq Scan on vector_memories"

**Diagnosis:**
```sql
-- Check if planner believes seq scan is cheaper
EXPLAIN (FORMAT JSON, ANALYZE)
SELECT id FROM vector_memories ORDER BY embedding_half <=> $1 LIMIT 10;
-- Look for "Startup Cost" vs "Total Cost" and "Plan Rows"
```

**Fixes:**
```sql
-- Fix 1: Check if index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'vector_memories'
AND indexdef ILIKE '%hnsw%';

-- Fix 2: Update statistics (stale stats cause wrong plan choices)
ANALYZE vector_memories;

-- Fix 3: Force index usage temporarily (for testing)
SET enable_seqscan = off;

-- Fix 4: Reduce random_page_cost to make index more attractive
SET random_page_cost = 1.1;  -- For SSD; default 4.0 is for HDD
```

### 5.3 High p99 Latency on Vector Queries

**Symptom:** p50 is fast (<20ms) but p99 spikes to >500ms

**Diagnosis:**
```sql
-- Check for lock contention on vector tables
SELECT
  blocked_locks.pid     AS blocked_pid,
  blocking_locks.pid    AS blocking_pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.granted
  AND NOT blocked_locks.granted
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid;
```

**Fixes:**
- **Connection pool exhaustion:** Increase `pool.max` or implement queue
- **Lock contention during HNSW inserts:** Use `pg.query` with connection checkout timeouts
- **Large vector in SELECT:** Never `SELECT embedding` in high-frequency queries — use `SELECT id, content` then fetch embeddings only when needed

### 5.4 Index Build Taking Too Long

**Symptom:** `CREATE INDEX CONCURRENTLY` running for >30 minutes on <1M vectors

**Diagnosis:**
```sql
-- Check if parallel workers are being used
SELECT * FROM pg_stat_progress_create_index;
-- Look at "workers_done" field — if 0, parallelism isn't working
```

**Fixes:**
```sql
-- Ensure maintenance_work_mem is set BEFORE creating the connection
SET maintenance_work_mem = '4GB';

-- Ensure parallel workers are configured
SET max_parallel_maintenance_workers = 7;

-- Verify the settings took effect in this session
SHOW maintenance_work_mem;   -- Should show 4GB
SHOW max_parallel_maintenance_workers;  -- Should show 7
```

**Note:** `max_parallel_maintenance_workers` only works in pgvector 0.6.0+. Check version:
```sql
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

### 5.5 Graph RAG — Entity Deduplication Not Working

**Symptom:** Duplicate entities with slightly different names (e.g., "OpenAI" and "Open AI")

**Fix:**
```javascript
// Lower the similarity threshold in GraphRAGEngine config
const engine = new GraphRAGEngine(pool, {
  embeddingRouter,
  graphId: 'heady-prod',
});

// Default similarityThreshold = 0.92; lower for more aggressive dedup
await engine.buildGraph(entities, relationships, {
  similarityThreshold: 0.85,  // Lower = more aggressive dedup
});
```

### 5.6 EmbeddingRouter Circuit Breaker Keeps Opening

**Symptom:** Circuit breaker for a provider opens repeatedly; fallback to local

**Diagnosis:**
```javascript
const stats = embeddingRouter.getStats();
console.log(stats.breakers);  // Check circuit states
console.log(stats.byProvider);  // Check error counts
```

**Fix:**
```javascript
// Reset circuit breaker after investigating root cause
embeddingRouter.resetCircuitBreaker('nomic');

// Increase failure threshold for intermittent network issues
const router = new EmbeddingRouter({
  circuitBreaker: {
    failureThreshold:  10,      // Open after 10 failures (default 5)
    resetTimeoutMs:    60_000,  // Wait 60s before half-open (default 30s)
  },
});
```

---

## 6. Capacity Planning Formulas

### 6.1 Storage Estimates

```
Float32 vector storage   = vectors × dimensions × 4 bytes
halfvec storage          = vectors × dimensions × 2 bytes
Binary vector storage    = vectors × dimensions / 8 bytes

HNSW graph overhead (m=16) = vectors × 96 bytes
HNSW graph overhead (m=32) = vectors × 192 bytes

Total HNSW index size (float32, m=32):
  = float32_storage + graph_overhead
  = (N × D × 4) + (N × 192) bytes

Total HNSW index size (halfvec, m=32):
  = (N × D × 2) + (N × 192) bytes
```

**Examples:**

| Collection | Dimensions | Index Type | Storage |
|---|---|---|---|
| 100K memories | 384 | float32 HNSW m=32 | ~167 MB |
| 100K memories | 384 | halfvec HNSW m=32 | ~96 MB |
| 1M memories | 384 | halfvec HNSW m=32 | ~960 MB |
| 1M memories | 1536 | halfvec HNSW m=32 | ~3.2 GB |
| 10M memories | 384 | binary HNSW m=32 | ~496 MB |

### 6.2 RAM Requirements

```
Minimum RAM for HNSW to stay in buffer cache:
  = HNSW_index_size × 1.25  (25% overhead for WAL and PostgreSQL overhead)

Recommended shared_buffers:
  = max(HNSW_index_size × 1.5, 25% of total RAM)

Recommended effective_cache_size:
  = 75% of total RAM
```

For 1M × 384d halfvec HNSW:
- Index size: ~960 MB
- Recommended shared_buffers: 2 GB
- Minimum VM RAM: 8 GB

### 6.3 Throughput Estimates

Based on [Jonathan Katz benchmarks](https://jkatz.github.io/post/postgres/pgvector-performance-150x-speedup/) (adjusted for 384d, Cloud Run 2-CPU instance):

```
Baseline QPS (384d HNSW, ef_search=100):    ~800 QPS
With iterative scan (filtered):             ~200–400 QPS
Hybrid search (BM25 + dense + RRF):         ~100–200 QPS (parallel overhead)
Graph RAG (local mode, 2 hops):             ~50–100 QPS

Latency targets:
  Dense-only:                               < 20ms p99
  Hybrid search:                            < 80ms p99
  Graph RAG (local):                        < 150ms p99
  Graph RAG (hybrid):                       < 300ms p99
```

### 6.4 Cloud Run Sizing Recommendations

| Workload | Memory | CPU | Max Connections | Note |
|---|---|---|---|---|
| Development | 2 GB | 1 | 5 | Local-only embeddings |
| Small (< 100K memories) | 4 GB | 2 | 10 | nomic API provider |
| Medium (< 1M memories) | 8 GB | 4 | 20 | halfvec HNSW |
| Large (< 10M memories) | 16 GB | 8 | 40 | halfvec + binary |
| Enterprise (> 10M) | 32+ GB | 16 | 80 | Consider pgvectorscale |

### 6.5 Embedding Provider Cost Estimates

```
Daily cost for N embeddings:

nomic-embed-text-v1.5 (API):    N × 400 tokens / 1M × $0.05  = $0.05N/1M per day
jina-embeddings-v3 (API):       N × 400 tokens / 1M × $0.018 = $0.018N/1M per day
cohere-embed-v4:                N × 400 tokens / 1M × $0.12  = $0.12N/1M per day
voyage-3-large:                 N × 400 tokens / 1M × $0.12  = $0.12N/1M per day
local (Ollama, A100 GPU):       $2/hour → ~50K embeddings/hr → $0.04/1000 embeddings
local (CPU, 8-core):            $0.50/hour → ~5K embeddings/hr → $0.10/1000 embeddings
```

At 1M embeddings/day:
- **Nomic API:** $50/day
- **Local Ollama (GPU):** ~$40/day (+ infrastructure)
- **Local Ollama (CPU):** ~$100/day (+ infrastructure)
- **Cohere/Voyage:** $120/day

**Recommendation for Heady sovereign deployment:** Use local Ollama for high-volume routine embeddings; route complex/domain-specific queries to Voyage-3-large for maximum quality. Configure via `EmbeddingRouter` routing policy with `preferSovereign: true`.

---

## References

- [pgvector 0.7.0 release notes](https://www.postgresql.org/about/news/pgvector-070-released-2852/)
- [pgvector 0.8.0 release notes](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [Jonathan Katz 150× speedup benchmark](https://jkatz.github.io/post/postgres/pgvector-performance-150x-speedup/)
- [Jonathan Katz quantization guide](https://jkatz.github.io/post/postgres/pgvector-scalar-binary-quantization/)
- [AWS Aurora pgvector 0.7.0 analysis](https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/)
- [AWS Aurora pgvector 0.8.0 analysis](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/)
- [Timescale pgvectorscale vs Qdrant benchmark](https://www.tigerdata.com/blog/pgvector-vs-qdrant)
- [LightRAG paper (arXiv 2410.05779)](https://arxiv.org/html/2410.05779v3)
- [RAG vs GraphRAG systematic evaluation (arXiv 2502.11371)](https://arxiv.org/html/2502.11371v3)
- [Ailog MTEB leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models)
- [Ailog BEIR 2.0 leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/news/beir-benchmark-update)
- [Voyage-3-large announcement](https://blog.voyageai.com/2025/01/07/voyage-3-large/)
- [Jina Embeddings v3 paper (arXiv 2409.10173)](https://arxiv.org/abs/2409.10173)
- [BGE-EN-ICL (arXiv 2409.15700)](https://arxiv.org/abs/2409.15700)
- [GTE-Qwen2-7B HuggingFace](https://huggingface.co/Alibaba-NLP/gte-Qwen2-7B-instruct)
- [InfiniFlow hybrid search analysis](https://infiniflow.org/blog/best-hybrid-search-solution)
- [DEV Community IVFFlat vs HNSW (Mar 2026)](https://dev.to/philip_mcclarence_2ef9475/ivfflat-vs-hnsw-in-pgvector-which-index-should-you-use-305p)

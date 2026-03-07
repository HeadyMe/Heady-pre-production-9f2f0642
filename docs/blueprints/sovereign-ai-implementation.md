

# Heady Sovereign AI Platform — Deep Research Report & Implementation Guide

**Prepared for:** Eric Haywood, HeadySystems Inc.
**Date:** March 7, 2026
**Based on:** HeadyMe organization context, current Heady monorepo architecture, and extensive research across all 7 domains

---

> **Important upfront notes:**
> 1. The HeadyMe/Heady repo is private — I couldn't fetch it directly, but I'm working from extensive context from your prior sessions (monorepo structure with `src/core/semantic-logic.js`, `src/mcp/mcp-router.js`, `src/bees/bee-factory.js`, `src/orchestration/skill-router.js`, the CSL gate system, 64D deterministic hash vectors, etc.)[1][2]
> 2. I cannot generate downloadable zip files. What I **can** deliver is every implementation file inline with copy-paste-ready code matching your Heady architecture patterns. I recommend piping this entire response into Windsurf and having it scaffold the file tree.
> 3. Every file below is designed to drop into your existing monorepo under the paths specified.

---

## SECTION 1: VECTOR DATABASE OPTIMIZATION FOR LATENT OS MEMORY

### 1.1 Research Findings

#### pgvector Index Comparison (HNSW vs IVFFlat vs DiskANN)

As of pgvector 0.8.1 on PostgreSQL 18 (February 2026), the landscape has three index families[3]:

| Attribute | HNSW | IVFFlat | DiskANN (pgvectorscale) |
|---|---|---|---|
| Algorithm | Multi-layer navigable graph | Voronoi cell partitioning | Vamana graph + SBQ |
| Max dims (vector) | 2,000 | 2,000 | 16,000 |
| Max dims (halfvec) | 4,000 | 4,000 | N/A (vector only) |
| Build time (25K, 3072d) | 29s | 5s | 49s |
| Index size (25K, 3072d) | 193 MB | 193 MB | **21 MB** |
| Query time | 2-6 ms | 2-10 ms | ~3 ms |
| Iterative scan support | ✅ (0.8.0+) | ✅ (0.8.0+) | ❌ |

**Critical finding**: DiskANN achieves **9x compression** over HNSW/IVFFlat via Statistical Binary Quantization (SBQ) — each 3072-dim float32 vector (12KB) is compressed to a 384-byte binary string using per-dimension mean thresholding, with XOR+popcount distance computation.[3]

**The 2,000-dimension wall**: HNSW and IVFFlat on `vector` type are limited to 2,000 dimensions. The workaround is `halfvec` (2 bytes/dim, limit 4,000 dims) or expression indexes. For Heady's 384-1536 dim embeddings, this is not a blocker.[3]

**Iterative scans** (pgvector 0.8.0+) solve the critical "vector search + WHERE clause" problem — instead of fetching K candidates then filtering, the index keeps fetching until the filter is satisfied. This is essential for Heady's agent-scoped memory queries.[3]

#### pgvector vs Dedicated Vector DBs at Scale

| Database | 1M p50 | 10M p50 | 100M p50 | Recall@10 (10M) | Monthly Cost (10M, 100K q/day) |
|---|---|---|---|---|---|
| Qdrant | 8ms | 14ms | 24ms | 98.0% | ~$150 (cloud) |
| Pinecone | 12ms | 18ms | 28ms | 97.8% | ~$260 (serverless) |
| pgvector | 15ms | 35ms | 85ms | 96.5% | ~$75 (Supabase) |
| Weaviate | 22ms | 38ms | 62ms | 96.9% | ~$200 (cloud) |
| Milvus | 50-80ms | — | — | — | varies |

[9][10]

**Recommendation for Heady**: Stay with pgvector for sovereign deployment. At your current scale (<10M vectors), pgvector with HNSW + iterative scans delivers 96.5% recall@10 at 35ms p50 for **half the cost** of alternatives. pgvector's ACID compliance, JOINs with relational data, and point-in-time recovery are irreplaceable for a sovereign OS with user data in the same database.[12][9]

For the future 100M+ vector tier, add DiskANN (pgvectorscale) for 9x index compression, keeping the navigational structure in shared_buffers while full vectors stay in heap.[3]

#### Hybrid Search: BM25 + Dense + Sparse

Research confirms that combining BM25 full-text search with dense vector search significantly improves nDCG over pure vector search. The optimal three-way combination (BM25 + dense + sparse via BGE-M3) outperforms even ColBERT reranking on standard benchmarks.[13][14]

BGE-M3 is the only model that natively produces all three representation types (dense, sparse, ColBERT) from a single forward pass.[15] For Heady's hybrid search:
- **Dense vectors**: Semantic similarity (cosine distance via pgvector HNSW)
- **Sparse vectors / BM25**: Keyword matching (PostgreSQL `tsvector` + GIN index)
- **Reranking**: ColBERT or cross-encoder on top-K candidates

#### GraphRAG for Multi-Hop Reasoning

LightRAG incorporates graph structures into text indexing with dual-level retrieval (low-level entity queries + high-level thematic queries).[16] Microsoft's GraphRAG uses community detection and hierarchical summarization for global queries.[17] StepChain GraphRAG interleaves BFS reasoning with dynamic graph expansion for multi-hop QA.[18]

**For Heady's 17 agent swarms**: Graph RAG enables agents to trace reasoning paths across multiple memory nodes — critical for the CSL-gated routing where geometric relationships between concepts need multi-hop traversal.

#### 2026 Embedding Model Rankings (MTEB)

| Model | MTEB Rank | Dims | Notes |
|---|---|---|---|
| Qwen3-Embedding-8B | #1 | variable | Open-weight, outperforms GTE-Qwen2[19] |
| BGE-M3 | Top-tier | 1024 | Trilingual, hybrid dense+sparse+ColBERT[20] |
| Nomic Embed v1.5 | Strong | 768 | 86.2% top-5 retrieval, higher latency[21] |
| Voyage-3-large | Strong | 1024-2048 | Best commercial for retrieval[22] |
| Jina v3 | Mid-tier | 1024 | Outcompeted by newer models[22] |
| Cohere v4 (embed) | Strong | 1024 | Good multilingual performance |

**Recommendation**: BGE-M3 for Heady's primary embedding (1024 dims, hybrid retrieval, open-weight, self-hostable). Qwen3-Embedding-8B as the high-accuracy option for critical memory paths.

### 1.2 Implementation Files

#### `migrations/001_pgvector_hnsw_optimization.sql`

```sql
-- Heady Vector Memory: HNSW Index Optimization Migration
-- Targets pgvector 0.8.1+ on PostgreSQL 16+
-- Based on 2026 benchmarks: HNSW for dims 384-1536, DiskANN for 3072+

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale; -- for DiskANN (pgvectorscale)

-- ============================================================
-- 1. HEADY VECTOR MEMORY TABLE (optimized schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS heady_vector_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL,           -- which swarm agent owns this memory
    swarm_id        TEXT NOT NULL,           -- which of 17 swarms
    memory_type     TEXT NOT NULL DEFAULT 'episodic',  -- episodic|semantic|procedural|working
    content         TEXT NOT NULL,
    content_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding       vector(1024),            -- BGE-M3 dense embedding
    sparse_vector   jsonb,                   -- BGE-M3 sparse vector (term:weight pairs)
    metadata        jsonb DEFAULT '{}',
    csl_resonance   float DEFAULT 0.0,       -- CSL resonance score at write time
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    expires_at      timestamptz,             -- for working memory TTL
    access_count    integer DEFAULT 0,
    last_accessed   timestamptz DEFAULT now()
);

-- ============================================================
-- 2. HNSW INDEX (primary dense vector search)
-- ============================================================
-- For 1024 dims: well within 2000-dim limit, use vector type directly
-- m=16: standard connectivity, good recall/speed balance
-- ef_construction=128: higher quality graph for production
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_hnsw_embedding
    ON heady_vector_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- ============================================================
-- 3. PARTIAL HNSW INDEXES (per memory type — 11x smaller, 20x faster build)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_hnsw_episodic
    ON heady_vector_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE memory_type = 'episodic';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_hnsw_semantic
    ON heady_vector_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE memory_type = 'semantic';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_hnsw_procedural
    ON heady_vector_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE memory_type = 'procedural';

-- ============================================================
-- 4. BM25 FULL-TEXT INDEX (sparse retrieval leg)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_tsv
    ON heady_vector_memory
    USING gin (content_tsv);

-- ============================================================
-- 5. B-TREE INDEXES for filtered vector search + iterative scan
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_agent
    ON heady_vector_memory (agent_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_swarm
    ON heady_vector_memory (swarm_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_type
    ON heady_vector_memory (memory_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_created
    ON heady_vector_memory (created_at DESC);

-- ============================================================
-- 6. GRAPH RAG TABLES (entity-relation knowledge graph)
-- ============================================================
CREATE TABLE IF NOT EXISTS heady_kg_entities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    embedding   vector(1024),
    properties  jsonb DEFAULT '{}',
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS heady_kg_relations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL REFERENCES heady_kg_entities(id),
    target_id       UUID NOT NULL REFERENCES heady_kg_entities(id),
    relation_type   TEXT NOT NULL,
    weight          float DEFAULT 1.0,
    properties      jsonb DEFAULT '{}',
    created_at      timestamptz DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_entity_embedding
    ON heady_kg_entities
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_rel_source ON heady_kg_relations(source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_rel_target ON heady_kg_relations(target_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_rel_type   ON heady_kg_relations(relation_type);

-- ============================================================
-- 7. OPTIMAL RUNTIME SETTINGS (apply per-transaction with SET LOCAL)
-- ============================================================
COMMENT ON TABLE heady_vector_memory IS
'Runtime settings for vector search:
  -- Standard search (fast, good recall):
  SET LOCAL hnsw.ef_search = 100;
  SET LOCAL hnsw.iterative_scan = ''relaxed_order'';

  -- High-precision search (slower, best recall):
  SET LOCAL hnsw.ef_search = 200;
  SET LOCAL hnsw.iterative_scan = ''strict_order'';

  -- NEVER exceed ef_search=400 (optimizer flips to SeqScan)
  -- ALWAYS use SET LOCAL inside transactions, never session-level

  -- For IVFFlat (if used):
  SET LOCAL ivfflat.probes = 3;
  SET LOCAL ivfflat.iterative_scan = ''relaxed_order'';
';

COMMIT;
```

#### `src/memory/hybrid-search.js`

```javascript
/**
 * Heady Hybrid Search Module
 * Combines BM25 sparse retrieval + dense vector search + optional ColBERT reranking
 * Research basis: 3-way hybrid outperforms pure vector by 15-25% on nDCG
 */

import { Pool } from 'pg';
import { getCSLEngine } from '../core/semantic-logic.js';

const SEARCH_MODES = {
  DENSE_ONLY: 'dense',
  BM25_ONLY: 'bm25',
  HYBRID: 'hybrid',
  HYBRID_RERANK: 'hybrid_rerank'
};

export class HybridSearchEngine {
  constructor(pool, options = {}) {
    this.pool = pool;
    this.csl = getCSLEngine();
    this.options = {
      denseWeight: 0.6,      // weight for dense vector score
      sparseWeight: 0.3,     // weight for BM25 score
      colbertWeight: 0.1,    // weight for ColBERT reranking (when enabled)
      efSearch: 100,         // HNSW ef_search parameter
      iterativeScan: 'relaxed_order',
      topK: 10,
      overFetchMultiplier: 5, // fetch 5x candidates for reranking
      ...options
    };
  }

  /**
   * Primary search method — combines dense + BM25 with RRF fusion
   * @param {string} query - natural language query
   * @param {Float32Array} queryEmbedding - pre-computed 1024d embedding
   * @param {object} filters - { agent_id, swarm_id, memory_type }
   * @returns {Array<{id, content, score, metadata}>}
   */
  async search(query, queryEmbedding, filters = {}, mode = SEARCH_MODES.HYBRID) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL hnsw.ef_search = ${this.options.efSearch}`);
      await client.query(`SET LOCAL hnsw.iterative_scan = '${this.options.iterativeScan}'`);

      let results;
      switch (mode) {
        case SEARCH_MODES.DENSE_ONLY:
          results = await this._denseSearch(client, queryEmbedding, filters);
          break;
        case SEARCH_MODES.BM25_ONLY:
          results = await this._bm25Search(client, query, filters);
          break;
        case SEARCH_MODES.HYBRID:
          results = await this._hybridSearch(client, query, queryEmbedding, filters);
          break;
        case SEARCH_MODES.HYBRID_RERANK:
          results = await this._hybridSearchWithRerank(client, query, queryEmbedding, filters);
          break;
        default:
          results = await this._hybridSearch(client, query, queryEmbedding, filters);
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Dense vector search using pgvector HNSW with iterative scan
   * Uses scalar subquery pattern (NOT cross-join) for sargable index use
   */
  async _denseSearch(client, queryEmbedding, filters) {
    const { whereClause, params } = this._buildFilterClause(filters, 2);
    const embeddingParam = `[${Array.from(queryEmbedding).join(',')}]`;

    const sql = `
      SELECT id, content, metadata, agent_id, swarm_id, memory_type,
             1 - (embedding <=> $1::vector) AS dense_score
      FROM heady_vector_memory
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT ${this.options.topK}
    `;

    const result = await client.query(sql, [embeddingParam, ...params]);
    return result.rows.map(row => ({
      ...row,
      score: row.dense_score,
      search_method: 'dense'
    }));
  }

  /**
   * BM25 full-text search using PostgreSQL tsvector + GIN index
   */
  async _bm25Search(client, query, filters) {
    const { whereClause, params } = this._buildFilterClause(filters, 2);
    const tsQuery = query.split(/\s+/).filter(Boolean).join(' & ');

    const sql = `
      SELECT id, content, metadata, agent_id, swarm_id, memory_type,
             ts_rank_cd(content_tsv, plainto_tsquery('english', $1)) AS bm25_score
      FROM heady_vector_memory
      WHERE content_tsv @@ plainto_tsquery('english', $1)
      ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
      ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('english', $1)) DESC
      LIMIT ${this.options.topK}
    `;

    const result = await client.query(sql, [query, ...params]);
    return result.rows.map(row => ({
      ...row,
      score: row.bm25_score,
      search_method: 'bm25'
    }));
  }

  /**
   * Reciprocal Rank Fusion (RRF) hybrid search
   * Combines dense + BM25 results using RRF(k=60) scoring
   */
  async _hybridSearch(client, query, queryEmbedding, filters) {
    const fetchK = this.options.topK * this.options.overFetchMultiplier;
    const { whereClause, params } = this._buildFilterClause(filters, 2);
    const embeddingParam = `[${Array.from(queryEmbedding).join(',')}]`;

    // Parallel dense + BM25 via CTE
    const sql = `
      WITH dense_results AS (
        SELECT id, content, metadata, agent_id, swarm_id, memory_type,
               ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS dense_rank,
               1 - (embedding <=> $1::vector) AS dense_score
        FROM heady_vector_memory
        ${whereClause}
        ORDER BY embedding <=> $1::vector
        LIMIT ${fetchK}
      ),
      bm25_results AS (
        SELECT id,
               ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('english', $2)) DESC) AS bm25_rank,
               ts_rank_cd(content_tsv, plainto_tsquery('english', $2)) AS bm25_score
        FROM heady_vector_memory
        WHERE content_tsv @@ plainto_tsquery('english', $2)
        ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
        ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('english', $2)) DESC
        LIMIT ${fetchK}
      )
      SELECT
        d.id, d.content, d.metadata, d.agent_id, d.swarm_id, d.memory_type,
        d.dense_score,
        COALESCE(b.bm25_score, 0) AS bm25_score,
        -- RRF fusion with k=60
        (1.0 / (60 + d.dense_rank)) * ${this.options.denseWeight} +
        COALESCE((1.0 / (60 + b.bm25_rank)), 0) * ${this.options.sparseWeight}
        AS rrf_score
      FROM dense_results d
      LEFT JOIN bm25_results b ON d.id = b.id
      ORDER BY rrf_score DESC
      LIMIT ${this.options.topK}
    `;

    const result = await client.query(sql, [embeddingParam, query, ...params]);

    // Apply CSL resonance gating — boost results that resonate with query semantics
    return result.rows.map(row => {
      const cslBoost = row.csl_resonance ? row.csl_resonance * 0.1 : 0;
      return {
        ...row,
        score: row.rrf_score + cslBoost,
        search_method: 'hybrid_rrf'
      };
    });
  }

  async _hybridSearchWithRerank(client, query, queryEmbedding, filters) {
    // Get hybrid candidates
    const candidates = await this._hybridSearch(client, query, queryEmbedding, filters);

    // Apply CSL multi_resonance reranking
    if (this.csl && candidates.length > 0) {
      const queryVector = this.csl.textToVector(query);
      const scored = candidates.map(c => {
        const contentVector = this.csl.textToVector(c.content);
        const resonance = this.csl.resonance_gate(queryVector, contentVector);
        return {
          ...c,
          score: c.score * 0.7 + resonance * 0.3,
          csl_resonance: resonance,
          search_method: 'hybrid_rrf_csl_rerank'
        };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, this.options.topK);
    }

    return candidates;
  }

  _buildFilterClause(filters, paramOffset) {
    const conditions = [];
    const params = [];
    let idx = paramOffset;

    if (filters.agent_id) {
      conditions.push(`agent_id = $${idx++}`);
      params.push(filters.agent_id);
    }
    if (filters.swarm_id) {
      conditions.push(`swarm_id = $${idx++}`);
      params.push(filters.swarm_id);
    }
    if (filters.memory_type) {
      conditions.push(`memory_type = $${idx++}`);
      params.push(filters.memory_type);
    }
    if (filters.since) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(filters.since);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    return { whereClause, params };
  }
}

export { SEARCH_MODES };
export default HybridSearchEngine;
```

#### `src/memory/graph-rag.js`

```javascript
/**
 * Heady Graph RAG Integration Layer
 * Multi-hop reasoning over knowledge graph + vector memory
 * Architecture: LightRAG-inspired dual-level retrieval (entity + thematic)
 */

import { Pool } from 'pg';
import { getCSLEngine } from '../core/semantic-logic.js';

export class GraphRAGLayer {
  constructor(pool, embeddingProvider) {
    this.pool = pool;
    this.embed = embeddingProvider;
    this.csl = getCSLEngine();
    this.maxHops = 3;
    this.maxEntitiesPerHop = 20;
  }

  /**
   * Extract entities and relations from text, store in knowledge graph
   * @param {string} text - source document
   * @param {Function} llmExtractor - LLM function that returns {entities, relations}
   */
  async ingestDocument(text, llmExtractor) {
    const { entities, relations } = await llmExtractor(text);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const entityIdMap = new Map();

      for (const entity of entities) {
        const embedding = await this.embed(entity.name + ' ' + (entity.description || ''));
        const embStr = `[${Array.from(embedding).join(',')}]`;

        const result = await client.query(`
          INSERT INTO heady_kg_entities (name, entity_type, embedding, properties)
          VALUES ($1, $2, $3::vector, $4)
          ON CONFLICT (name) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            properties = heady_kg_entities.properties || EXCLUDED.properties
          RETURNING id
        `, [entity.name, entity.type, embStr, JSON.stringify(entity.properties || {})]);

        entityIdMap.set(entity.name, result.rows[0].id);
      }

      for (const rel of relations) {
        const sourceId = entityIdMap.get(rel.source);
        const targetId = entityIdMap.get(rel.target);
        if (sourceId && targetId) {
          await client.query(`
            INSERT INTO heady_kg_relations (source_id, target_id, relation_type, weight, properties)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
          `, [sourceId, targetId, rel.type, rel.weight || 1.0, JSON.stringify(rel.properties || {})]);
        }
      }

      await client.query('COMMIT');
      return { entities: entities.length, relations: relations.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Multi-hop graph traversal for complex reasoning queries
   * Implements BFS-RF (Breadth-First Search Reasoning Flow) pattern
   * @param {string} query - natural language query
   * @param {Float32Array} queryEmbedding
   * @param {number} maxHops - maximum reasoning hops
   * @returns {object} - { entities, paths, context }
   */
  async multiHopRetrieve(query, queryEmbedding, maxHops = this.maxHops) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL hnsw.ef_search = 100');

      const embStr = `[${Array.from(queryEmbedding).join(',')}]`;

      // Hop 0: Find seed entities nearest to query
      const seedResult = await client.query(`
        SELECT id, name, entity_type, properties,
               1 - (embedding <=> $1::vector) AS similarity
        FROM heady_kg_entities
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `, [embStr, this.maxEntitiesPerHop]);

      const visited = new Set();
      const allEntities = [];
      const allPaths = [];
      let frontier = seedResult.rows.map(r => ({ ...r, hop: 0, path: [r.name] }));

      for (const entity of frontier) {
        visited.add(entity.id);
        allEntities.push(entity);
      }

      // BFS expansion with CSL-gated relevance filtering
      for (let hop = 1; hop <= maxHops; hop++) {
        const frontierIds = frontier.map(e => e.id);
        if (frontierIds.length === 0) break;

        // Traverse outgoing AND incoming edges
        const neighborResult = await client.query(`
          SELECT DISTINCT
            e.id, e.name, e.entity_type, e.properties,
            r.relation_type, r.weight,
            CASE WHEN r.source_id = ANY($1::uuid[]) THEN 'outgoing' ELSE 'incoming' END AS direction,
            1 - (e.embedding <=> $2::vector) AS similarity
          FROM heady_kg_relations r
          JOIN heady_kg_entities e ON (
            (r.source_id = ANY($1::uuid[]) AND e.id = r.target_id) OR
            (r.target_id = ANY($1::uuid[]) AND e.id = r.source_id)
          )
          WHERE e.id != ALL($1::uuid[])
          ORDER BY e.embedding <=> $2::vector
          LIMIT $3
        `, [frontierIds, embStr, this.maxEntitiesPerHop]);

        const nextFrontier = [];
        for (const neighbor of neighborResult.rows) {
          if (visited.has(neighbor.id)) continue;

          // CSL resonance gate: only expand if semantically relevant
          const queryVec = this.csl.textToVector(query);
          const entityVec = this.csl.textToVector(neighbor.name + ' ' + neighbor.entity_type);
          const resonance = this.csl.resonance_gate(queryVec, entityVec);

          if (resonance > 0.3) { // threshold for expansion
            visited.add(neighbor.id);
            const parentEntity = frontier.find(f =>
              neighborResult.rows.some(n => n.id === neighbor.id)
            );
            const path = parentEntity ? [...parentEntity.path, `--${neighbor.relation_type}-->`, neighbor.name] : [neighbor.name];

            const enriched = { ...neighbor, hop, path, csl_resonance: resonance };
            nextFrontier.push(enriched);
            allEntities.push(enriched);
            allPaths.push(path);
          }
        }

        frontier = nextFrontier;
      }

      await client.query('COMMIT');

      // Build context string for LLM consumption
      const context = this._buildContext(allEntities, allPaths);

      return {
        entities: allEntities,
        paths: allPaths,
        context,
        hops_used: Math.max(...allEntities.map(e => e.hop), 0)
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  _buildContext(entities, paths) {
    const entityDescriptions = entities
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 30)
      .map(e => `[${e.entity_type}] ${e.name} (relevance: ${(e.similarity || 0).toFixed(3)}, hop: ${e.hop})`)
      .join('\n');

    const pathDescriptions = paths
      .slice(0, 15)
      .map(p => p.join(' '))
      .join('\n');

    return `### Knowledge Graph Entities\n${entityDescriptions}\n\n### Reasoning Paths\n${pathDescriptions}`;
  }
}

export default GraphRAGLayer;
```

#### `scripts/benchmark-embeddings.js`

```javascript
#!/usr/bin/env node
/**
 * Heady Embedding Model Benchmark Script
 * Tests latency, throughput, recall@10, and cost across models
 * Run: node scripts/benchmark-embeddings.js
 */

const MODELS = [
  {
    name: 'BGE-M3',
    provider: 'local',       // self-hosted via HuggingFace
    dims: 1024,
    endpoint: process.env.BGE_M3_ENDPOINT || 'http://localhost:8080/embed',
    costPer1KTokens: 0.0,    // self-hosted
    supportsHybrid: true
  },
  {
    name: 'Qwen3-Embedding-0.6B',
    provider: 'local',
    dims: 1024,
    endpoint: process.env.QWEN_EMBED_ENDPOINT || 'http://localhost:8081/embed',
    costPer1KTokens: 0.0,
    supportsHybrid: false
  },
  {
    name: 'Voyage-3-large',
    provider: 'voyage',
    dims: 1024,
    endpoint: 'https://api.voyageai.com/v1/embeddings',
    apiKey: process.env.VOYAGE_API_KEY,
    costPer1KTokens: 0.00018,
    supportsHybrid: false
  },
  {
    name: 'text-embedding-3-large',
    provider: 'openai',
    dims: 1024,
    endpoint: 'https://api.openai.com/v1/embeddings',
    apiKey: process.env.OPENAI_API_KEY,
    costPer1KTokens: 0.00013,
    supportsHybrid: false
  },
  {
    name: 'Nomic-embed-text-v1.5',
    provider: 'local',
    dims: 768,
    endpoint: process.env.NOMIC_ENDPOINT || 'http://localhost:8082/embed',
    costPer1KTokens: 0.0,
    supportsHybrid: false
  }
];

const TEST_CORPUS = [
  "The Heady system orchestrates 17 autonomous agent swarms using CSL gates",
  "Vector memory persistence uses pgvector with HNSW indexing for semantic search",
  "MCP tool routing enables zero-trust execution of external tools",
  "Cloudflare Workers handle edge inference with Durable Object state management",
  "Continuous Semantic Logic implements geometric reasoning via cosine operations",
  "The bee/swarm architecture distributes tasks using Monte Carlo simulation",
  "Patent claims cover novel geometric gate implementations for AI routing",
  "Enterprise pricing includes per-seat licensing with usage-based metering",
  // ... expand with 100+ representative documents for real benchmark
];

const TEST_QUERIES = [
  { query: "How does CSL routing work?", relevant: [0, 4] },
  { query: "vector database configuration", relevant: [1] },
  { query: "edge deployment architecture", relevant: [3] },
  { query: "agent task distribution", relevant: [0, 5] },
];

async function embedText(model, text) {
  const start = performance.now();

  let embedding;
  if (model.provider === 'local') {
    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, model: model.name })
    });
    const data = await res.json();
    embedding = data.embedding || data.data?.[0]?.embedding;
  } else if (model.provider === 'openai') {
    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      },
      body: JSON.stringify({ input: text, model: model.name, dimensions: model.dims })
    });
    const data = await res.json();
    embedding = data.data[0].embedding;
  } else if (model.provider === 'voyage') {
    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      },
      body: JSON.stringify({ input: [text], model: model.name })
    });
    const data = await res.json();
    embedding = data.data[0].embedding;
  }

  const latencyMs = performance.now() - start;
  return { embedding, latencyMs };
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function recallAtK(retrievedIndices, relevantIndices, k) {
  const topK = retrievedIndices.slice(0, k);
  const hits = topK.filter(idx => relevantIndices.includes(idx));
  return hits.length / relevantIndices.length;
}

async function benchmarkModel(model) {
  console.log(`\n=== Benchmarking: ${model.name} (${model.dims}d) ===`);

  // Phase 1: Embed corpus
  const corpusEmbeddings = [];
  const embedLatencies = [];
  for (const doc of TEST_CORPUS) {
    try {
      const { embedding, latencyMs } = await embedText(model, doc);
      corpusEmbeddings.push(embedding);
      embedLatencies.push(latencyMs);
    } catch (err) {
      console.error(`  Failed to embed: ${err.message}`);
      return null;
    }
  }

  const avgEmbedLatency = embedLatencies.reduce((a, b) => a + b, 0) / embedLatencies.length;

  // Phase 2: Query and measure recall@10
  const queryLatencies = [];
  const recalls = [];
  for (const testCase of TEST_QUERIES) {
    const { embedding: queryEmb, latencyMs } = await embedText(model, testCase.query);
    queryLatencies.push(latencyMs);

    // Compute similarities and rank
    const similarities = corpusEmbeddings.map((docEmb, idx) => ({
      idx,
      score: cosineSimilarity(queryEmb, docEmb)
    }));
    similarities.sort((a, b) => b.score - a.score);

    const retrievedIndices = similarities.map(s => s.idx);
    const recall = recallAtK(retrievedIndices, testCase.relevant, 10);
    recalls.push(recall);
  }

  const avgQueryLatency = queryLatencies.reduce((a, b) => a + b, 0) / queryLatencies.length;
  const avgRecall = recalls.reduce((a, b) => a + b, 0) / recalls.length;

  const results = {
    model: model.name,
    dimensions: model.dims,
    avgEmbedLatencyMs: Math.round(avgEmbedLatency * 10) / 10,
    avgQueryLatencyMs: Math.round(avgQueryLatency * 10) / 10,
    recallAt10: Math.round(avgRecall * 1000) / 1000,
    costPer1KTokens: model.costPer1KTokens,
    supportsHybrid: model.supportsHybrid
  };

  console.log(`  Embed latency: ${results.avgEmbedLatencyMs}ms`);
  console.log(`  Query latency: ${results.avgQueryLatencyMs}ms`);
  console.log(`  Recall@10: ${results.recallAt10}`);
  console.log(`  Cost/1K tokens: $${results.costPer1KTokens}`);
  console.log(`  Hybrid support: ${results.supportsHybrid}`);

  return results;
}

async function main() {
  console.log('Heady Embedding Model Benchmark');
  console.log(`Corpus size: ${TEST_CORPUS.length} docs`);
  console.log(`Query count: ${TEST_QUERIES.length} queries`);
  console.log('================================');

  const allResults = [];
  for (const model of MODELS) {
    const result = await benchmarkModel(model);
    if (result) allResults.push(result);
  }

  console.log('\n\n=== SUMMARY TABLE ===');
  console.table(allResults);

  // Recommend best model for Heady
  const selfHosted = allResults.filter(r => r.costPer1KTokens === 0);
  if (selfHosted.length > 0) {
    const best = selfHosted.sort((a, b) => b.recallAt10 - a.recallAt10)[0];
    console.log(`\n🏆 Recommended self-hosted model: ${best.model} (recall@10: ${best.recallAt10})`);
  }
}

main().catch(console.error);
```

---

## SECTION 2: AUTONOMOUS AGENT ORCHESTRATION PATTERNS

### 2.1 Research Findings

#### Framework Landscape (2026)

| Framework | Coordination Model | Best For | Production Fit |
|---|---|---|---|
| **LangGraph** | Graph state machine | Complex branching workflows | Strong (LangSmith tracing)[23] |
| **CrewAI** | Role+task orchestration | Multi-agent collaboration | Strong (policy/cost controls)[23] |
| **AutoGen (v0.4)** | Async message passing | Free-flowing multi-agent conversations | Strong (OpenTelemetry)[24] |
| **OpenAI Agents** | Managed runtime | Fastest path on OpenAI stack | Portability tradeoffs[23] |
| **Google ADK** | Multi-agent native | Full Google ecosystem | Built-in CLI/web UI[24] |

Key architectural insight: LangGraph's graph state machine model is closest to Heady's CSL-gated routing — both use deterministic graph traversal with conditional branching. However, Heady's CSL gates add a geometric reasoning layer that none of these frameworks provide.[23][24]

#### Devin/Cursor/Windsurf Architecture Patterns

Devin's architecture follows a **plan → execute → reflect → update** cycle: it creates a plan first, then continuously updates the plan's progress during execution, preventing deviation and enabling depth of thought.[25] Key patterns:

1. **Process Planning**: .cursorrules/.windsurfrules define plan structure; scratchpad.md tracks state
2. **Self-Evolution**: Agent modifies its own rules based on task outcomes
3. **Tool Access**: Full terminal, browser, editor access within sandboxed environment
4. **Self-Correction**: Failed commands trigger reflection loops with error analysis

For Heady's 17 swarms, the optimal topology is **hierarchical supervisor with mesh communication** — a HeadyConductor supervisor coordinates swarm leads, who manage worker bees, with peer-to-peer messaging for cross-swarm collaboration.

### 2.2 Implementation Files

#### `src/orchestration/swarm-coordinator.js`

```javascript
/**
 * Heady Enhanced Swarm Coordinator
 * Hierarchical supervisor topology with CSL-gated task routing
 * Supports 17 autonomous agent swarms with semantic backpressure
 */

import { getCSLEngine } from '../core/semantic-logic.js';
import { EventEmitter } from 'events';

const SWARM_TOPOLOGIES = {
  SUPERVISOR: 'supervisor',     // one lead per swarm, centralized control
  HIERARCHICAL: 'hierarchical', // multi-level supervision tree
  MESH: 'mesh',                 // peer-to-peer within swarm
  SWARM: 'swarm'                // emergent consensus (bee model)
};

export class SwarmCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.csl = getCSLEngine();
    this.swarms = new Map();
    this.taskQueue = [];
    this.activeTasksBySwarm = new Map();
    this.backpressureThresholds = options.backpressureThresholds || {
      warning: 0.7,   // 70% capacity → slow admission
      critical: 0.9,  // 90% capacity → reject non-priority
      max: 1.0        // 100% → reject all
    };
    this.maxConcurrentPerSwarm = options.maxConcurrentPerSwarm || 10;
    this.selfCorrectionEnabled = options.selfCorrectionEnabled !== false;
  }

  /**
   * Register a swarm with its capabilities and topology
   */
  registerSwarm(swarmId, config) {
    const swarmVector = this.csl.textToVector(
      `${swarmId} ${config.capabilities.join(' ')} ${config.description || ''}`
    );
    this.swarms.set(swarmId, {
      ...config,
      id: swarmId,
      vector: swarmVector,
      agents: new Map(),
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgLatencyMs: 0,
      topology: config.topology || SWARM_TOPOLOGIES.SUPERVISOR
    });
    this.activeTasksBySwarm.set(swarmId, 0);
    this.emit('swarm:registered', { swarmId, capabilities: config.capabilities });
  }

  /**
   * Register an agent within a swarm
   */
  registerAgent(swarmId, agentId, agentConfig) {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) throw new Error(`Swarm ${swarmId} not registered`);

    const agentVector = this.csl.textToVector(
      `${agentId} ${agentConfig.skills.join(' ')} ${agentConfig.description || ''}`
    );
    swarm.agents.set(agentId, {
      ...agentConfig,
      id: agentId,
      vector: agentVector,
      status: 'idle',
      currentTask: null,
      taskHistory: [],
      errorCount: 0
    });
  }

  /**
   * CSL-gated task decomposition and routing
   * @param {object} task - { id, description, priority, requiredCapabilities, context }
   * @returns {object} - { assignedSwarm, assignedAgent, cslScore, decomposition }
   */
  async routeTask(task) {
    const taskVector = this.csl.textToVector(task.description);

    // 1. Score all swarms using multi_resonance
    const swarmScores = [];
    for (const [swarmId, swarm] of this.swarms) {
      const resonance = this.csl.resonance_gate(taskVector, swarm.vector);
      const riskPenalty = this.csl.risk_gate(
        this._getSwarmLoadFactor(swarmId),
        this.backpressureThresholds.warning
      );
      const compositeScore = resonance * (1 - riskPenalty * 0.3);

      swarmScores.push({ swarmId, swarm, resonance, riskPenalty, compositeScore });
    }

    swarmScores.sort((a, b) => b.compositeScore - a.compositeScore);

    // 2. Check backpressure on top swarm
    const topSwarm = swarmScores[0];
    if (!topSwarm || topSwarm.compositeScore < 0.1) {
      this.emit('task:unroutable', { taskId: task.id, scores: swarmScores.slice(0, 3) });
      throw new Error(`No suitable swarm found for task: ${task.id}`);
    }

    const backpressure = this._checkBackpressure(topSwarm.swarmId);
    if (backpressure === 'reject' && task.priority !== 'critical') {
      // Try next best swarm
      const fallback = swarmScores.find(s =>
        s.swarmId !== topSwarm.swarmId &&
        this._checkBackpressure(s.swarmId) !== 'reject'
      );
      if (fallback) {
        return this._assignToSwarm(task, fallback, taskVector);
      }
      this.emit('task:backpressure_rejected', { taskId: task.id, swarmId: topSwarm.swarmId });
      throw new Error(`All swarms at capacity for task: ${task.id}`);
    }

    return this._assignToSwarm(task, topSwarm, taskVector);
  }

  /**
   * Task decomposition engine with CSL scoring
   * Breaks complex tasks into subtasks with dependency graph
   */
  async decomposeTask(task, maxDepth = 3) {
    const taskVector = this.csl.textToVector(task.description);
    const complexity = this._estimateComplexity(taskVector);

    if (complexity < 0.3 || maxDepth === 0) {
      // Simple enough for direct execution
      return [{ ...task, decomposed: false, complexity }];
    }

    // Decompose based on capability matching
    const subtasks = [];
    const capabilities = new Set();
    for (const [, swarm] of this.swarms) {
      for (const cap of swarm.capabilities || []) {
        capabilities.add(cap);
      }
    }

    // CSL orthogonal projection: find capability dimensions that are
    // orthogonal (independent) — these become parallel subtask groups
    const capVectors = [...capabilities].map(cap => ({
      cap,
      vector: this.csl.textToVector(cap)
    }));

    const relevantCaps = capVectors
      .map(cv => ({
        ...cv,
        relevance: this.csl.resonance_gate(taskVector, cv.vector)
      }))
      .filter(cv => cv.relevance > 0.2)
      .sort((a, b) => b.relevance - a.relevance);

    // Group orthogonal capabilities into parallel tracks
    const parallelGroups = [];
    const used = new Set();

    for (const cap of relevantCaps) {
      if (used.has(cap.cap)) continue;

      const group = [cap];
      used.add(cap.cap);

      // Find other capabilities orthogonal to this one (can run in parallel)
      for (const other of relevantCaps) {
        if (used.has(other.cap)) continue;
        const similarity = this.csl.resonance_gate(cap.vector, other.vector);
        if (similarity < 0.3) { // orthogonal = independent = parallelizable
          group.push(other);
          used.add(other.cap);
        }
      }
      parallelGroups.push(group);
    }

    for (let gi = 0; gi < parallelGroups.length; gi++) {
      const group = parallelGroups[gi];
      for (const cap of group) {
        subtasks.push({
          id: `${task.id}_sub_${gi}_${cap.cap}`,
          parentId: task.id,
          description: `${cap.cap}: ${task.description}`,
          priority: task.priority,
          requiredCapabilities: [cap.cap],
          parallelGroup: gi,
          cslRelevance: cap.relevance,
          decomposed: true
        });
      }
    }

    return subtasks.length > 0 ? subtasks : [{ ...task, decomposed: false, complexity }];
  }

  _assignToSwarm(task, swarmScore, taskVector) {
    const swarm = swarmScore.swarm;

    // Find best agent within swarm using CSL
    let bestAgent = null;
    let bestAgentScore = -1;

    for (const [agentId, agent] of swarm.agents) {
      if (agent.status !== 'idle') continue;

      const agentResonance = this.csl.resonance_gate(taskVector, agent.vector);
      const errorPenalty = agent.errorCount > 3 ? 0.5 : 0;
      const score = agentResonance - errorPenalty;

      if (score > bestAgentScore) {
        bestAgentScore = score;
        bestAgent = agent;
      }
    }

    if (!bestAgent) {
      // All agents busy — queue the task
      this.taskQueue.push({ task, targetSwarm: swarmScore.swarmId, queuedAt: Date.now() });
      this.emit('task:queued', { taskId: task.id, swarmId: swarmScore.swarmId });
      return { assignedSwarm: swarmScore.swarmId, assignedAgent: null, queued: true };
    }

    // Assign
    bestAgent.status = 'working';
    bestAgent.currentTask = task.id;
    swarm.activeTasks++;
    this.activeTasksBySwarm.set(swarmScore.swarmId, swarm.activeTasks);

    const assignment = {
      taskId: task.id,
      assignedSwarm: swarmScore.swarmId,
      assignedAgent: bestAgent.id,
      cslScore: swarmScore.compositeScore,
      agentScore: bestAgentScore,
      queued: false
    };

    this.emit('task:assigned', assignment);
    return assignment;
  }

  /**
   * Self-correction loop: when a task fails, analyze and retry
   */
  async handleTaskFailure(taskId, swarmId, agentId, error) {
    if (!this.selfCorrectionEnabled) return;

    const swarm = this.swarms.get(swarmId);
    const agent = swarm?.agents.get(agentId);
    if (!agent) return;

    agent.errorCount++;
    agent.status = 'idle';
    agent.currentTask = null;
    swarm.activeTasks--;
    swarm.failedTasks++;

    // Reflection: analyze error pattern
    const errorVector = this.csl.textToVector(error.message || String(error));
    const taskVector = this.csl.textToVector(agent.taskHistory.slice(-1)[0]?.description || '');

    // If error is orthogonal to task (unrelated failure), retry same agent
    const errorRelevance = this.csl.resonance_gate(errorVector, taskVector);

    if (errorRelevance < 0.3 && agent.errorCount < 3) {
      // Transient error — retry
      this.emit('task:retry', { taskId, agentId, reason: 'transient_error' });
      return { action: 'retry', agent: agentId };
    }

    if (agent.errorCount >= 3) {
      // Agent is struggling — reassign to different agent/swarm
      agent.status = 'degraded';
      this.emit('task:reassign', { taskId, fromAgent: agentId, reason: 'repeated_failures' });
      return { action: 'reassign', fromAgent: agentId };
    }

    // Error is related to task — needs different approach
    this.emit('task:escalate', { taskId, error: error.message, reason: 'semantic_mismatch' });
    return { action: 'escalate', reason: 'semantic_mismatch' };
  }

  _getSwarmLoadFactor(swarmId) {
    const active = this.activeTasksBySwarm.get(swarmId) || 0;
    return active / this.maxConcurrentPerSwarm;
  }

  _checkBackpressure(swarmId) {
    const load = this._getSwarmLoadFactor(swarmId);
    if (load >= this.backpressureThresholds.max) return 'reject';
    if (load >= this.backpressureThresholds.critical) return 'critical';
    if (load >= this.backpressureThresholds.warning) return 'warning';
    return 'ok';
  }

  _estimateComplexity(taskVector) {
    // Use vector magnitude and entropy as complexity proxy
    let sumSquares = 0;
    let nonZero = 0;
    for (let i = 0; i < taskVector.length; i++) {
      sumSquares += taskVector[i] * taskVector[i];
      if (Math.abs(taskVector[i]) > 0.01) nonZero++;
    }
    const magnitude = Math.sqrt(sumSquares);
    const density = nonZero / taskVector.length;
    return Math.min(1.0, magnitude * density);
  }

  getMetrics() {
    const metrics = {};
    for (const [swarmId, swarm] of this.swarms) {
      metrics[swarmId] = {
        activeTasks: swarm.activeTasks,
        completedTasks: swarm.completedTasks,
        failedTasks: swarm.failedTasks,
        agentCount: swarm.agents.size,
        idleAgents: [...swarm.agents.values()].filter(a => a.status === 'idle').length,
        loadFactor: this._getSwarmLoadFactor(swarmId),
        backpressure: this._checkBackpressure(swarmId)
      };
    }
    return metrics;
  }
}

export { SWARM_TOPOLOGIES };
export default SwarmCoordinator;
```

#### `src/orchestration/context-window-manager.js`

```javascript
/**
 * Heady Context Window Management System
 * Manages context budgets across 17 swarms with intelligent compression
 * Prevents context overflow while preserving critical information
 */

import { getCSLEngine } from '../core/semantic-logic.js';

export class ContextWindowManager {
  constructor(options = {}) {
    this.csl = getCSLEngine();
    this.maxTokens = options.maxTokens || 128000; // Claude/GPT-4o context
    this.reservedTokens = options.reservedTokens || 4096; // for system prompt
    this.compressionThreshold = options.compressionThreshold || 0.75;
    this.contexts = new Map(); // agentId -> context state
  }

  createContext(agentId, config = {}) {
    this.contexts.set(agentId, {
      systemPrompt: config.systemPrompt || '',
      systemTokens: this._estimateTokens(config.systemPrompt || ''),
      messages: [],
      toolResults: [],
      memoryContext: '',
      totalTokens: 0,
      maxTokens: config.maxTokens || this.maxTokens,
      compressionHistory: []
    });
  }

  addMessage(agentId, role, content) {
    const ctx = this.contexts.get(agentId);
    if (!ctx) throw new Error(`No context for agent ${agentId}`);

    const tokens = this._estimateTokens(content);
    ctx.messages.push({ role, content, tokens, timestamp: Date.now() });
    ctx.totalTokens += tokens;

    // Check if compression needed
    if (ctx.totalTokens > ctx.maxTokens * this.compressionThreshold) {
      this._compressContext(agentId);
    }

    return { totalTokens: ctx.totalTokens, compressed: false };
  }

  addMemoryContext(agentId, memoryResults) {
    const ctx = this.contexts.get(agentId);
    if (!ctx) return;

    // Rank memories by CSL resonance with current conversation
    const convVector = this.csl.textToVector(
      ctx.messages.slice(-5).map(m => m.content).join(' ')
    );

    const scored = memoryResults.map(mem => ({
      ...mem,
      resonance: this.csl.resonance_gate(
        convVector,
        this.csl.textToVector(mem.content)
      )
    })).sort((a, b) => b.resonance - a.resonance);

    // Budget: 20% of remaining context for memory
    const budgetTokens = (ctx.maxTokens - ctx.totalTokens) * 0.2;
    let usedTokens = 0;
    const includedMemories = [];

    for (const mem of scored) {
      const memTokens = this._estimateTokens(mem.content);
      if (usedTokens + memTokens > budgetTokens) break;
      includedMemories.push(mem);
      usedTokens += memTokens;
    }

    ctx.memoryContext = includedMemories
      .map(m => `[Memory ${m.memory_type}] ${m.content}`)
      .join('\n');
    ctx.totalTokens += usedTokens;
  }

  buildPrompt(agentId) {
    const ctx = this.contexts.get(agentId);
    if (!ctx) return [];

    const messages = [];

    // System prompt
    if (ctx.systemPrompt) {
      let systemContent = ctx.systemPrompt;
      if (ctx.memoryContext) {
        systemContent += `\n\n### Relevant Memories\n${ctx.memoryContext}`;
      }
      messages.push({ role: 'system', content: systemContent });
    }

    // Conversation messages (already compressed if needed)
    for (const msg of ctx.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }

  _compressContext(agentId) {
    const ctx = this.contexts.get(agentId);
    const targetTokens = ctx.maxTokens * 0.5; // compress to 50%

    // Strategy 1: Summarize old messages (keep last 10 intact)
    const keepRecent = 10;
    if (ctx.messages.length <= keepRecent) return;

    const oldMessages = ctx.messages.slice(0, -keepRecent);
    const recentMessages = ctx.messages.slice(-keepRecent);

    // CSL-based importance scoring for old messages
    const queryVector = this.csl.textToVector(
      recentMessages.map(m => m.content).join(' ')
    );

    const scored = oldMessages.map((msg, i) => ({
      ...msg,
      index: i,
      importance: this.csl.resonance_gate(
        queryVector,
        this.csl.textToVector(msg.content)
      )
    }));

    // Keep messages with importance > 0.5, summarize the rest
    const important = scored.filter(m => m.importance > 0.5);
    const compressed = scored.filter(m => m.importance <= 0.5);

    const summaryText = `[Compressed ${compressed.length} earlier messages. Key topics: ${
      compressed.map(m => m.content.substring(0, 50)).join('; ').substring(0, 200)
    }]`;

    ctx.messages = [
      { role: 'system', content: summaryText, tokens: this._estimateTokens(summaryText) },
      ...important,
      ...recentMessages
    ];

    ctx.totalTokens = ctx.messages.reduce((sum, m) => sum + m.tokens, 0) + ctx.systemTokens;
    ctx.compressionHistory.push({
      timestamp: Date.now(),
      removedMessages: compressed.length,
      keptImportant: important.length,
      tokensSaved: ctx.totalTokens // approximate
    });
  }

  _estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters for English
    return Math.ceil((text || '').length / 4);
  }

  getUsage(agentId) {
    const ctx = this.contexts.get(agentId);
    if (!ctx) return null;
    return {
      totalTokens: ctx.totalTokens,
      maxTokens: ctx.maxTokens,
      utilization: ctx.totalTokens / ctx.maxTokens,
      messageCount: ctx.messages.length,
      compressions: ctx.compressionHistory.length
    };
  }
}

export default ContextWindowManager;
```

---

## SECTION 3: MCP ECOSYSTEM AND TOOL ROUTING

### 3.1 Research Findings

MCP has undergone explosive growth — from ~100K downloads in Nov 2024 to 8M+ by April 2025, with 5,800+ MCP servers in the ecosystem.[26] In December 2025, Anthropic donated MCP to the Agentic AI Foundation (AAIF) under the Linux Foundation, with OpenAI and Block as co-founders and AWS, Google, Microsoft, Cloudflare, and Bloomberg as supporting members.[27]

**November 2025 spec updates** added: asynchronous operations, statelessness, server identity, and an official community-driven registry for discovering MCP servers.[27]

**Transport comparison**:
- **stdio**: Lowest latency (~1ms overhead), used for local tool execution
- **SSE (Server-Sent Events)**: Original remote transport, unidirectional streaming, HTTP/1.1
- **Streamable HTTP**: New in 2025 spec, replaces SSE for most remote use cases
- **WebSocket**: Bidirectional, lower overhead for high-frequency calls

**Enterprise security concerns** are significant — systematic threat modeling reveals attack vectors including prompt injection via tool outputs, privilege escalation through MCP server chains, and data exfiltration via tool side-channels.[28][29] Zero-trust execution, sandboxing, rate limiting, and audit logging are non-negotiable for production.[30]

**MCP vs alternatives**: MCP's key advantage is standardized server discovery and composition — you can aggregate multiple MCP servers behind a meta-server proxy. Function calling (OpenAI/Anthropic native) is simpler but proprietary. LangChain tools are framework-locked.[23]

### 3.2 Implementation Files

#### `src/mcp/mcp-gateway.js`

```javascript
/**
 * Heady MCP Gateway with CSL-Gated Intelligent Routing
 * Meta-server that aggregates multiple MCP servers with:
 * - CSL-based tool selection
 * - Connection pooling
 * - Transport abstraction (stdio/SSE/WebSocket)
 * - Zero-trust execution sandbox
 * - Rate limiting with semantic deduplication
 * - Full audit logging
 */

import { EventEmitter } from 'events';
import { getCSLEngine } from '../core/semantic-logic.js';
import { createHash } from 'crypto';

// ============================================================
// CONNECTION POOL MANAGER
// ============================================================
class MCPConnectionPool {
  constructor(maxConnections = 50) {
    this.pools = new Map(); // serverId -> { connections[], available[], config }
    this.maxPerServer = maxConnections;
  }

  register(serverId, config) {
    this.pools.set(serverId, {
      config,
      connections: [],
      available: [],
      waitQueue: []
    });
  }

  async acquire(serverId) {
    const pool = this.pools.get(serverId);
    if (!pool) throw new Error(`Server ${serverId} not registered`);

    if (pool.available.length > 0) {
      const conn = pool.available.pop();
      conn.lastUsed = Date.now();
      return conn;
    }

    if (pool.connections.length < this.maxPerServer) {
      const conn = await this._createConnection(serverId, pool.config);
      pool.connections.push(conn);
      return conn;
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection pool timeout')), 30000);
      pool.waitQueue.push({ resolve, reject, timeout });
    });
  }

  release(serverId, conn) {
    const pool = this.pools.get(serverId);
    if (!pool) return;

    if (pool.waitQueue.length > 0) {
      const waiter = pool.waitQueue.shift();
      clearTimeout(waiter.timeout);
      waiter.resolve(conn);
    } else {
      pool.available.push(conn);
    }
  }

  async _createConnection(serverId, config) {
    return {
      id: `${serverId}_${Date.now()}`,
      serverId,
      transport: config.transport,
      endpoint: config.endpoint,
      lastUsed: Date.now(),
      requestCount: 0
    };
  }
}

// ============================================================
// TRANSPORT ADAPTER (SSE + WebSocket + stdio)
// ============================================================
class TransportAdapter {
  constructor() {
    this.transports = new Map();
  }

  async send(connection, method, params) {
    const { transport, endpoint } = connection;

    switch (transport) {
      case 'stdio':
        return this._sendStdio(connection, method, params);
      case 'sse':
      case 'http':
        return this._sendHTTP(endpoint, method, params);
      case 'websocket':
        return this._sendWebSocket(connection, method, params);
      default:
        throw new Error(`Unsupported transport: ${transport}`);
    }
  }

  async _sendHTTP(endpoint, method, params) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body
    });

    if (!response.ok) {
      throw new Error(`MCP HTTP error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      return this._parseSSEResponse(response);
    }
    return response.json();
  }

  async _sendWebSocket(connection, method, params) {
    // WebSocket send via existing connection
    if (!connection._ws || connection._ws.readyState !== 1) {
      connection._ws = new WebSocket(connection.endpoint);
      await new Promise((resolve, reject) => {
        connection._ws.onopen = resolve;
        connection._ws.onerror = reject;
      });
    }

    return new Promise((resolve, reject) => {
      const id = Date.now();
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          connection._ws.removeEventListener('message', handler);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data);
        }
      };
      connection._ws.addEventListener('message', handler);
      connection._ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  async _sendStdio(connection, method, params) {
    // For local MCP servers running as child processes
    const { spawn } = await import('child_process');
    const message = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });

    return new Promise((resolve, reject) => {
      const proc = connection._process;
      if (!proc) {
        reject(new Error('stdio process not initialized'));
        return;
      }

      let response = '';
      const onData = (data) => {
        response += data.toString();
        try {
          const parsed = JSON.parse(response);
          proc.stdout.removeListener('data', onData);
          resolve(parsed);
        } catch { /* incomplete JSON, wait for more */ }
      };

      proc.stdout.on('data', onData);
      proc.stdin.write(message + '\n');
    });
  }

  async _parseSSEResponse(response) {
    const text = await response.text();
    const lines = text.split('\n');
    const results = [];
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          results.push(JSON.parse(line.slice(6)));
        } catch { /* skip malformed */ }
      }
    }
    return results.length === 1 ? results[0] : results;
  }
}

// ============================================================
// RATE LIMITER WITH SEMANTIC DEDUPLICATION
// ============================================================
class SemanticRateLimiter {
  constructor(csl, options = {}) {
    this.csl = csl;
    this.windowMs = options.windowMs || 60000;      // 1 minute window
    this.maxRequests = options.maxRequests || 100;    // per window per server
    this.deduplicationThreshold = options.deduplicationThreshold || 0.95;
    this.counters = new Map();  // serverId -> { count, resetAt }
    this.recentRequests = [];   // for semantic dedup
    this.maxRecentCache = 100;
  }

  async checkLimit(serverId, toolName, params) {
    // Rate limit check
    const key = serverId;
    let counter = this.counters.get(key);
    if (!counter || Date.now() > counter.resetAt) {
      counter = { count: 0, resetAt: Date.now() + this.windowMs };
      this.counters.set(key, counter);
    }

    if (counter.count >= this.maxRequests) {
      return { allowed: false, reason: 'rate_limit_exceeded', retryAfterMs: counter.resetAt - Date.now() };
    }

    // Semantic deduplication: check if nearly identical request was made recently
    const requestSignature = `${serverId}:${toolName}:${JSON.stringify(params)}`;
    const requestVector = this.csl.textToVector(requestSignature);

    for (const recent of this.recentRequests) {
      if (Date.now() - recent.timestamp > 5000) continue; // 5s dedup window
      const similarity = this.csl.resonance_gate(requestVector, recent.vector);
      if (similarity > this.deduplicationThreshold) {
        return {
          allowed: false,
          reason: 'semantic_duplicate',
          cachedResult: recent.result,
          similarity
        };
      }
    }

    counter.count++;
    return { allowed: true };
  }

  recordResult(serverId, toolName, params, result) {
    const requestSignature = `${serverId}:${toolName}:${JSON.stringify(params)}`;
    const requestVector = this.csl.textToVector(requestSignature);
    this.recentRequests.push({
      vector: requestVector,
      result,
      timestamp: Date.now(),
      serverId,
      toolName
    });

    // Prune old entries
    if (this.recentRequests.length > this.maxRecentCache) {
      this.recentRequests = this.recentRequests.slice(-this.maxRecentCache / 2);
    }
  }
}

// ============================================================
// AUDIT LOGGER
// ============================================================
class MCPAuditLogger {
  constructor(options = {}) {
    this.logs = [];
    this.maxLogs = options.maxLogs || 10000;
    this.onLog = options.onLog || null; // external handler
  }

  log(event) {
    const entry = {
      ...event,
      timestamp: new Date().toISOString(),
      id: createHash('sha256').update(JSON.stringify(event) + Date.now()).digest('hex').slice(0, 16)
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2);
    }

    if (this.onLog) this.onLog(entry);
    return entry;
  }

  query(filters = {}) {
    return this.logs.filter(entry => {
      if (filters.serverId && entry.serverId !== filters.serverId) return false;
      if (filters.toolName && entry.toolName !== filters.toolName) return false;
      if (filters.since && new Date(entry.timestamp) < new Date(filters.since)) return false;
      if (filters.status && entry.status !== filters.status) return false;
      return true;
    });
  }
}

// ============================================================
// ZERO-TRUST EXECUTION SANDBOX
// ============================================================
class ExecutionSandbox {
  constructor(options = {}) {
    this.allowedServers = new Set(options.allowedServers || []);
    this.deniedTools = new Set(options.deniedTools || []);
    this.maxExecutionMs = options.maxExecutionMs || 30000;
    this.maxResponseSizeBytes = options.maxResponseSizeBytes || 10 * 1024 * 1024; // 10MB
  }

  validate(serverId, toolName, params) {
    const violations = [];

    if (this.allowedServers.size > 0 && !this.allowedServers.has(serverId)) {
      violations.push(`Server ${serverId} not in allowlist`);
    }

    if (this.deniedTools.has(toolName)) {
      violations.push(`Tool ${toolName} is denied`);
    }

    // Check for dangerous patterns in params
    const paramStr = JSON.stringify(params);
    if (paramStr.includes('__proto__') || paramStr.includes('constructor.prototype')) {
      violations.push('Prototype pollution attempt detected');
    }
    if (paramStr.length > 1024 * 1024) {
      violations.push('Params exceed 1MB size limit');
    }

    return {
      allowed: violations.length === 0,
      violations
    };
  }

  async executeWithTimeout(fn, timeoutMs = this.maxExecutionMs) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Execution timeout: ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
}

// ============================================================
// MAIN MCP GATEWAY
// ============================================================
export class MCPGateway extends EventEmitter {
  constructor(options = {}) {
    super();
    this.csl = getCSLEngine();
    this.servers = new Map(); // serverId -> server config + tools + vector
    this.connectionPool = new MCPConnectionPool(options.maxConnections || 50);
    this.transport = new TransportAdapter();
    this.rateLimiter = new SemanticRateLimiter(this.csl, options.rateLimit);
    this.audit = new MCPAuditLogger(options.audit);
    this.sandbox = new ExecutionSandbox(options.sandbox);
  }

  /**
   * Register an MCP server with its tools
   */
  async registerServer(serverId, config) {
    const toolDescriptions = (config.tools || [])
      .map(t => `${t.name}: ${t.description}`)
      .join(' ');

    const serverVector = this.csl.textToVector(
      `${serverId} ${config.description || ''} ${toolDescriptions}`
    );

    const toolVectors = {};
    for (const tool of config.tools || []) {
      toolVectors[tool.name] = this.csl.textToVector(
        `${tool.name} ${tool.description} ${JSON.stringify(tool.inputSchema || {})}`
      );
    }

    this.servers.set(serverId, {
      ...config,
      id: serverId,
      vector: serverVector,
      toolVectors,
      healthStatus: 'unknown',
      lastHealthCheck: 0
    });

    this.connectionPool.register(serverId, {
      transport: config.transport || 'http',
      endpoint: config.endpoint
    });

    this.emit('server:registered', { serverId, tools: config.tools?.map(t => t.name) });
  }

  /**
   * CSL-gated intelligent tool routing
   * Routes to the best server+tool based on semantic intent matching
   */
  async route(intent, params = {}) {
    const intentVector = this.csl.textToVector(intent);

    // Score all tools across all servers
    const candidates = [];
    for (const [serverId, server] of this.servers) {
      for (const tool of server.tools || []) {
        const toolVector = server.toolVectors[tool.name];
        const resonance = this.csl.resonance_gate(intentVector, toolVector);
        const softScore = this.csl.soft_gate(resonance, 0.5); // sigmoid activation

        if (softScore > 0.3) {
          candidates.push({
            serverId,
            toolName: tool.name,
            tool,
            resonance,
            softScore,
            server
          });
        }
      }
    }

    if (candidates.length === 0) {
      this.audit.log({
        action: 'route_failed',
        intent,
        reason: 'no_matching_tools'
      });
      throw new Error(`No MCP tool matches intent: ${intent}`);
    }

    // Sort by CSL score, apply risk gate for server health
    candidates.sort((a, b) => b.softScore - a.softScore);
    const best = candidates[0];

    // Execute through sandbox
    return this.executeTool(best.serverId, best.toolName, params);
  }

  /**
   * Execute a specific tool with full safety pipeline
   */
  async executeTool(serverId, toolName, params) {
    const startTime = Date.now();

    // 1. Zero-trust validation
    const validation = this.sandbox.validate(serverId, toolName, params);
    if (!validation.allowed) {
      this.audit.log({
        action: 'tool_blocked',
        serverId, toolName,
        status: 'blocked',
        violations: validation.violations
      });
      throw new Error(`Sandbox violation: ${validation.violations.join(', ')}`);
    }

    // 2. Rate limit + semantic dedup check
    const limitCheck = await this.rateLimiter.checkLimit(serverId, toolName, params);
    if (!limitCheck.allowed) {
      if (limitCheck.cachedResult) {
        this.audit.log({
          action: 'tool_deduplicated',
          serverId, toolName,
          status: 'cached',
          similarity: limitCheck.similarity
        });
        return limitCheck.cachedResult;
      }
      this.audit.log({
        action: 'tool_rate_limited',
        serverId, toolName,
        status: 'rate_limited',
        retryAfterMs: limitCheck.retryAfterMs
      });
      throw new Error(`Rate limited: ${limitCheck.reason}`);
    }

    // 3. Acquire connection from pool
    const conn = await this.connectionPool.acquire(serverId);

    try {
      // 4. Execute with timeout
      const result = await this.sandbox.executeWithTimeout(async () => {
        return this.transport.send(conn, 'tools/call', {
          name: toolName,
          arguments: params
        });
      });

      const latencyMs = Date.now() - startTime;

      // 5. Record for semantic dedup
      this.rateLimiter.recordResult(serverId, toolName, params, result);

      // 6. Audit log
      this.audit.log({
        action: 'tool_executed',
        serverId, toolName,
        status: 'success',
        latencyMs,
        resultSize: JSON.stringify(result).length
      });

      this.emit('tool:executed', { serverId, toolName, latencyMs });
      return result;

    } catch (err) {
      this.audit.log({
        action: 'tool_error',
        serverId, toolName,
        status: 'error',
        error: err.message,
        latencyMs: Date.now() - startTime
      });
      throw err;
    } finally {
      this.connectionPool.release(serverId, conn);
    }
  }

  /**
   * List all available tools across all servers
   */
  listTools() {
    const tools = [];
    for (const [serverId, server] of this.servers) {
      for (const tool of server.tools || []) {
        tools.push({
          serverId,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }
    }
    return tools;
  }

  getAuditLogs(filters) {
    return this.audit.query(filters);
  }
}

export default MCPGateway;
```

---

## SECTION 4: EDGE AI AND CLOUDFLARE WORKERS AI

### 4.1 Research Findings

Cloudflare has built what's described as the "first true serverless cloud for the AI Agent era" — vertically integrating compute (Workers), state (Durable Objects), and memory (Vectorize) at the edge.[31]

**Durable Objects as Agent Primitives**: The Actor Model reintroduced to infrastructure, solving the "agent memory" problem without managing Redis clusters. Each Durable Object maintains single-threaded, consistent state with automatic global migration.[31]

**Vectorize**: Edge-native vector DB designed to eliminate the network latency of calling third-party services like Pinecone. Supports Workers AI embedding models natively, with index management via Wrangler CLI.[32][33]

**Cloudflare's custom inference engine (Infire)**: Built in Rust, replacing vLLM which was "not efficient enough for distributed edge networks." Supports quantized open-source models (Llama, Mistral, Qwen) across the global network.[34]

**Workers AI vs Hyperscalers**:
- Workers
---
name: heady-graph-rag-memory
description: >
  Use when implementing graph-based retrieval augmented generation (Graph RAG) for multi-hop reasoning
  over knowledge graphs combined with vector memory. Covers LightRAG-style incremental entity extraction,
  relationship graph construction, Louvain community detection, local/global/hybrid query modes, and
  integration with Heady's 3D vector memory and pgvector. Phi-scaled parameters throughout.
  Keywords: graph RAG, GraphRAG, LightRAG, knowledge graph, entity extraction, multi-hop reasoning,
  community detection, Louvain, graph traversal, vector memory, Heady memory, NER, relationship graph.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Graph RAG Memory

## When to Use This Skill

Use this skill when you need to:

- Build or extend a knowledge graph from documents for RAG
- Implement multi-hop reasoning (2+ hop graph traversal)
- Extract entities and relationships from text using LLM or NER fallback
- Detect communities in knowledge graphs (Louvain modularity)
- Choose between vector-only RAG vs graph RAG vs hybrid routing
- Design incremental graph updates (LightRAG pattern)

## Architecture

```
Document → Entity Extraction (LLM + regex fallback)
         → Relationship Extraction
         → Graph Upsert (dedup by DEDUP_THRESHOLD ≈ 0.972)
         → Community Detection (Louvain)

Query → Mode Router:
  local  → Entity similarity + graph traversal (hops)
  global → Community summaries + vector search
  hybrid → Weighted blend (φ-split: 0.618 local, 0.382 global)
  naive  → Pure vector similarity
```

## Instructions

### 1. Schema Design (PostgreSQL)

```sql
-- Entity nodes with embeddings
CREATE TABLE graph_rag_entities (
  id UUID PRIMARY KEY,
  graph_id UUID NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT,
  description TEXT,
  embedding vector(384),
  metadata JSONB
);

-- Relationship edges
CREATE TABLE graph_rag_relationships (
  id UUID PRIMARY KEY,
  graph_id UUID NOT NULL,
  source_entity_id UUID REFERENCES graph_rag_entities,
  target_entity_id UUID REFERENCES graph_rag_entities,
  relationship_type TEXT,
  weight FLOAT DEFAULT PSI,  -- ≈ 0.618
  description TEXT
);

-- Community clusters
CREATE TABLE graph_rag_communities (
  id UUID PRIMARY KEY,
  graph_id UUID NOT NULL,
  level INTEGER,
  summary TEXT,
  entity_ids UUID[]
);
```

### 2. Phi-Scaled Parameters

- Entity dedup threshold: `DEDUP_THRESHOLD ≈ 0.972` (from phi-math)
- Max entities per doc: `fib(10) = 55`
- Max relationships per doc: `fib(11) = 89`
- Default result limit: `fib(7) = 13`
- Local/global weights: `phiFusionWeights(2)` → [0.618, 0.382]
- Min edge weight: `PSI⁴ ≈ 0.146`
- Max community iterations: `fib(7) = 13`
- Cache size: `fib(16) = 987`
- Oversample factor: `PHI` (1.618×)

### 3. Query Modes

- **local**: Best for specific entity lookups. Finds nearest entities by embedding, then traverses graph edges up to N hops.
- **global**: Best for broad summaries. Queries community-level summaries.
- **hybrid**: Best general-purpose. Blends local and global with phi-fusion weights.
- **naive**: Pure vector search fallback. No graph traversal.

### 4. When Graph RAG Wins

- Multi-hop queries: Graph RAG uniquely answers 13.6% of queries that vector RAG misses
- Entity-relationship questions: "What companies did X invest in that also worked with Y?"
- LightRAG pattern: 26× cheaper indexing ($0.15 vs $4), incremental updates

### 5. Integration with Heady Vector Memory

The graph RAG layer sits alongside the existing vector-memory.js:
- Short-term memory (STM) → vector search (fast, recent)
- Long-term memory (LTM) → graph RAG (connected, multi-hop)
- Routing: CSL gate score determines vector vs graph vs hybrid

## Evidence Paths

- `section1-vector-db/modules/graph-rag.js`
- `section1-vector-db/migrations/002_graph_rag_schema.sql`
- `src/vector-memory.js`, `src/vector-space-ops.js`

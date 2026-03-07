-- =============================================================================
-- Migration: 002_graph_rag_schema.sql
-- Purpose:   Graph RAG schema for Heady Latent OS knowledge graph memory
-- Platform:  PostgreSQL 16+ with pgvector 0.7+
-- Created:   2026-03-07
-- Author:    Heady Platform Team
--
-- Architecture (LightRAG-inspired, dual-level retrieval):
--   - Entity nodes with embeddings for semantic entity search
--   - Directed relationship edges with type, weight, and embedding
--   - Community/cluster table for hierarchical graph structure (Leiden algo)
--   - Entity aliases and co-reference resolution
--   - Provenance tracking (which bee/document created each entity)
--   - Full-text search on entity descriptions
--
-- Key design decisions (from research/section1_vector_db.md):
--   - LightRAG over GraphRAG: incremental updates, 26x cheaper indexing,
--     single API call per retrieval vs hundreds for GraphRAG global search
--   - Dual-level retrieval: low-level (entity-specific) + high-level (thematic)
--   - pgvector-backed (no separate graph DB needed for agent-scale corpora)
--   - Incremental merge: new entities merge into graph without full rebuild
--
-- Query patterns:
--   - Multi-hop traversal: 2-3 hops for most agent reasoning chains
--   - Community detection: Leiden algorithm via external processing
--   - Graph+vector hybrid: entity embedding search + graph expansion
-- =============================================================================

BEGIN;

INSERT INTO schema_migrations (version, description) VALUES
    ('002', 'Graph RAG schema: entities, relationships, communities, provenance')
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Entity Nodes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identity
    name            TEXT NOT NULL,                        -- Canonical entity name
    entity_type     TEXT NOT NULL DEFAULT 'CONCEPT'       -- PERSON|ORG|LOCATION|CONCEPT|EVENT|OBJECT
                    CHECK (entity_type IN ('PERSON','ORG','LOCATION','CONCEPT','EVENT','OBJECT','OTHER')),
    -- Descriptions
    description     TEXT,                                 -- LLM-generated entity description
    summary         TEXT,                                 -- Condensed community-level summary
    -- Embeddings (for semantic entity search)
    embedding       vector(384),                          -- Primary embedding of description
    embedding_half  halfvec(384),                         -- Scalar-quantized for memory efficiency
    -- Full-text search
    description_tsv TSVECTOR,                             -- Generated tsvector
    -- Graph metadata
    community_id    UUID,                                 -- Assigned community cluster
    rank            FLOAT DEFAULT 0.5,                    -- PageRank / importance score
    occurrence_count INTEGER NOT NULL DEFAULT 1,          -- How many times entity was observed
    -- Provenance
    source_bee_id   TEXT,                                 -- Which bee extracted this entity
    source_doc_ids  TEXT[],                               -- Source document IDs
    workspace_id    TEXT,                                 -- Multi-tenant workspace
    -- State
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,       -- Co-reference resolved?
    canonical_id    UUID,                                 -- Points to canonical entity if merged
    -- Timestamps
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE graph_entities IS
    'Entity nodes in the Heady knowledge graph. Each entity represents a unique '
    'concept, person, organization, location, event, or object extracted from '
    'document corpora by bee agents. Supports LightRAG-style incremental updates.';

COMMENT ON COLUMN graph_entities.canonical_id IS
    'If set, this entity is a duplicate/alias. Points to the canonical merged entity. '
    'Used for co-reference resolution (e.g., "POTUS" → "The President").';

COMMENT ON COLUMN graph_entities.rank IS
    'Entity importance score. Updated via periodic PageRank computation or '
    'heuristic scoring (occurrence_count × relationship_degree).';

-- Auto-sync generated columns
CREATE OR REPLACE FUNCTION heady_sync_entity_vectors()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.embedding IS NOT NULL THEN
        NEW.embedding_half := NEW.embedding::halfvec(384);
    END IF;
    IF NEW.description IS NOT NULL THEN
        NEW.description_tsv := to_tsvector('english', NEW.description);
    ELSIF NEW.name IS NOT NULL THEN
        NEW.description_tsv := to_tsvector('english', NEW.name);
    END IF;
    NEW.last_updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER graph_entities_sync
    BEFORE INSERT OR UPDATE ON graph_entities
    FOR EACH ROW EXECUTE FUNCTION heady_sync_entity_vectors();

-- ---------------------------------------------------------------------------
-- Entity Aliases (co-reference resolution)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_entity_aliases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    alias           TEXT NOT NULL,                        -- Alternative name/mention
    alias_tsv       TSVECTOR,                             -- For alias search
    confidence      FLOAT NOT NULL DEFAULT 1.0,           -- Co-reference confidence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, alias)
);

CREATE TRIGGER graph_entity_aliases_sync
    BEFORE INSERT OR UPDATE ON graph_entity_aliases
    FOR EACH ROW EXECUTE FUNCTION
        (SELECT set_config('', '', FALSE));  -- Placeholder; use app-layer for alias tsv

-- Simple function to maintain alias tsvector
CREATE OR REPLACE FUNCTION heady_sync_alias_tsv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.alias_tsv := to_tsvector('english', NEW.alias);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_entity_aliases_sync ON graph_entity_aliases;
CREATE TRIGGER graph_entity_aliases_sync
    BEFORE INSERT OR UPDATE ON graph_entity_aliases
    FOR EACH ROW EXECUTE FUNCTION heady_sync_alias_tsv();

-- ---------------------------------------------------------------------------
-- Relationship Edges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Graph structure
    source_id       UUID NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    -- Relationship type
    rel_type        TEXT NOT NULL,                        -- e.g., WORKS_FOR, LOCATED_IN, CAUSES, etc.
    rel_description TEXT,                                 -- Natural language description of edge
    -- Weights and scoring
    weight          FLOAT NOT NULL DEFAULT 0.5            -- Edge strength (0-1)
                    CHECK (weight >= 0 AND weight <= 1),
    confidence      FLOAT NOT NULL DEFAULT 0.8            -- Extraction confidence
                    CHECK (confidence >= 0 AND confidence <= 1),
    -- Temporal
    valid_from      TIMESTAMPTZ,                          -- Temporal relationship start
    valid_until     TIMESTAMPTZ,                          -- Temporal relationship end
    -- Graph traversal metadata
    hop_order       INTEGER NOT NULL DEFAULT 1            -- 1=direct, 2=second-order, 3=third-order
                    CHECK (hop_order BETWEEN 1 AND 5),
    -- Embedding of the relationship description
    rel_embedding   vector(384),                          -- For semantic relationship search
    rel_embed_half  halfvec(384),                         -- Scalar-quantized
    -- Full-text search
    rel_tsv         TSVECTOR,
    -- Provenance
    source_bee_id   TEXT,
    source_doc_id   TEXT,
    workspace_id    TEXT,
    -- State
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- Prevent exact duplicate edges
    UNIQUE (source_id, target_id, rel_type)
);

COMMENT ON TABLE graph_relationships IS
    'Directed edges in the Heady knowledge graph. Represents semantic relationships '
    'between entities (e.g., PERSON WORKS_FOR ORG, CONCEPT CAUSES EVENT). '
    'Supports temporal validity, confidence scoring, and LightRAG-style incremental merging.';

COMMENT ON COLUMN graph_relationships.hop_order IS
    '1=direct relationship, 2=second-order (A→B→C), 3=third-order. '
    'Used to limit graph traversal depth in multi-hop queries.';

-- Auto-sync relationship vectors
CREATE OR REPLACE FUNCTION heady_sync_relationship_vectors()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.rel_embedding IS NOT NULL THEN
        NEW.rel_embed_half := NEW.rel_embedding::halfvec(384);
    END IF;
    IF NEW.rel_description IS NOT NULL THEN
        NEW.rel_tsv := to_tsvector('english', NEW.rel_description);
    ELSIF NEW.rel_type IS NOT NULL THEN
        NEW.rel_tsv := to_tsvector('english', NEW.rel_type);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER graph_relationships_sync
    BEFORE INSERT OR UPDATE ON graph_relationships
    FOR EACH ROW EXECUTE FUNCTION heady_sync_relationship_vectors();

-- ---------------------------------------------------------------------------
-- Community/Cluster Table (Hierarchical Graph Structure)
-- ---------------------------------------------------------------------------
-- Communities are groups of tightly-connected entities (Leiden algorithm output).
-- Used for GraphRAG-style global summarization and thematic queries.

CREATE TABLE IF NOT EXISTS graph_communities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Hierarchy
    level           INTEGER NOT NULL DEFAULT 0,           -- 0=leaf, higher=more abstract
    parent_id       UUID REFERENCES graph_communities(id), -- Parent community (hierarchical)
    -- Identity
    title           TEXT,                                 -- LLM-generated community title
    summary         TEXT NOT NULL DEFAULT '',             -- Community summary for global search
    -- Embedding
    summary_embedding  vector(384),                       -- Embedding of community summary
    summary_embed_half halfvec(384),                      -- Scalar-quantized
    -- Full-text search
    summary_tsv     TSVECTOR,
    -- Graph stats
    entity_count    INTEGER NOT NULL DEFAULT 0,
    edge_count      INTEGER NOT NULL DEFAULT 0,
    density         FLOAT,                                -- Edge density within community
    -- Provenance
    workspace_id    TEXT,
    algorithm       TEXT DEFAULT 'leiden',                -- Detection algorithm used
    -- Timestamps
    built_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE graph_communities IS
    'Hierarchical community clusters for global-level graph RAG queries. '
    'Each community aggregates a set of related entities. '
    'Built by Leiden algorithm; supports multi-level hierarchy for zoom-in/out queries.';

CREATE OR REPLACE FUNCTION heady_sync_community_vectors()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.summary_embedding IS NOT NULL THEN
        NEW.summary_embed_half := NEW.summary_embedding::halfvec(384);
    END IF;
    IF NEW.summary IS NOT NULL AND LENGTH(NEW.summary) > 0 THEN
        NEW.summary_tsv := to_tsvector('english', NEW.summary);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER graph_communities_sync
    BEFORE INSERT OR UPDATE ON graph_communities
    FOR EACH ROW EXECUTE FUNCTION heady_sync_community_vectors();

-- ---------------------------------------------------------------------------
-- Community Membership (Entity → Community mapping)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_community_members (
    community_id    UUID NOT NULL REFERENCES graph_communities(id) ON DELETE CASCADE,
    entity_id       UUID NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    membership_score FLOAT DEFAULT 1.0,                   -- Strength of community membership
    is_core_member  BOOLEAN NOT NULL DEFAULT FALSE,        -- Core vs peripheral member
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (community_id, entity_id)
);

COMMENT ON TABLE graph_community_members IS
    'Many-to-many mapping between communities and their member entities. '
    'An entity can belong to multiple communities at different hierarchy levels.';

-- ---------------------------------------------------------------------------
-- Document provenance (links graph nodes to source documents)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_document_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id          TEXT NOT NULL,                        -- Source document identifier
    title           TEXT,
    content_hash    TEXT,                                 -- SHA256 of document content
    chunk_index     INTEGER,                              -- Which chunk this came from
    -- Embeddings for source-document-level search
    doc_embedding   vector(384),
    -- Full-text
    doc_tsv         TSVECTOR,
    -- Provenance
    bee_id          TEXT,
    workspace_id    TEXT,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Entity-Document provenance link
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS graph_entity_sources (
    entity_id       UUID NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
    source_id       UUID NOT NULL REFERENCES graph_document_sources(id) ON DELETE CASCADE,
    span_start      INTEGER,                              -- Character offset in document
    span_end        INTEGER,
    extraction_conf FLOAT DEFAULT 0.8,
    extracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entity_id, source_id)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Entity HNSW index (for semantic entity lookup in graph RAG)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_hnsw_384_cosine
ON graph_entities
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);  -- Lighter params for graph entity search

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_hnsw_half_cosine
ON graph_entities
USING hnsw (embedding_half halfvec_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Entity full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_description_gin
ON graph_entities
USING gin (description_tsv);

-- Entity lookup indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_name
ON graph_entities (lower(name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_type
ON graph_entities (entity_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_workspace
ON graph_entities (workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_community
ON graph_entities (community_id)
WHERE community_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_canonical
ON graph_entities (canonical_id)
WHERE canonical_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_ge_rank_desc
ON graph_entities (rank DESC)
WHERE rank > 0.3;

-- Relationship indexes (graph traversal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_source_id
ON graph_relationships (source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_target_id
ON graph_relationships (target_id);

-- Composite for efficient outgoing-edge traversal
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_source_type
ON graph_relationships (source_id, rel_type, weight DESC);

-- Composite for incoming-edge traversal
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_target_type
ON graph_relationships (target_id, rel_type, weight DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_workspace
ON graph_relationships (workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gr_tsv_gin
ON graph_relationships
USING gin (rel_tsv);

-- Community indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gc_hnsw_half
ON graph_communities
USING hnsw (summary_embed_half halfvec_cosine_ops)
WITH (m = 16, ef_construction = 128);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gc_tsv_gin
ON graph_communities
USING gin (summary_tsv);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gc_level
ON graph_communities (level, workspace_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gc_parent
ON graph_communities (parent_id)
WHERE parent_id IS NOT NULL;

-- Community member indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gcm_entity_id
ON graph_community_members (entity_id);

-- Alias indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gea_alias_tsv_gin
ON graph_entity_aliases
USING gin (alias_tsv);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gea_lower_alias
ON graph_entity_aliases (lower(alias));

-- Document source indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gds_doc_id
ON graph_document_sources (doc_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
    idx_gds_workspace
ON graph_document_sources (workspace_id);

-- ---------------------------------------------------------------------------
-- Graph traversal query: Multi-hop entity neighbors
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION heady_graph_neighbors(
    p_entity_id     UUID,
    p_max_hops      INTEGER DEFAULT 2,
    p_min_weight    FLOAT DEFAULT 0.3,
    p_workspace_id  TEXT DEFAULT NULL
)
RETURNS TABLE (
    entity_id       UUID,
    entity_name     TEXT,
    entity_type     TEXT,
    description     TEXT,
    hop_depth       INTEGER,
    path_weight     FLOAT,
    rel_types       TEXT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE graph_walk AS (
        -- Base case: starting entity
        SELECT
            e.id AS entity_id,
            e.name AS entity_name,
            e.entity_type,
            e.description,
            0 AS hop_depth,
            1.0::FLOAT AS path_weight,
            ARRAY[]::TEXT[] AS rel_types,
            ARRAY[e.id] AS visited_ids
        FROM graph_entities e
        WHERE e.id = p_entity_id
          AND (p_workspace_id IS NULL OR e.workspace_id = p_workspace_id)

        UNION ALL

        -- Recursive case: follow outgoing edges
        SELECT
            target_e.id,
            target_e.name,
            target_e.entity_type,
            target_e.description,
            gw.hop_depth + 1,
            gw.path_weight * r.weight,
            gw.rel_types || ARRAY[r.rel_type],
            gw.visited_ids || ARRAY[target_e.id]
        FROM graph_walk gw
        JOIN graph_relationships r ON r.source_id = gw.entity_id
        JOIN graph_entities target_e ON target_e.id = r.target_id
        WHERE gw.hop_depth < p_max_hops
          AND r.weight >= p_min_weight
          AND r.is_active = TRUE
          AND NOT (target_e.id = ANY(gw.visited_ids))  -- Prevent cycles
          AND (p_workspace_id IS NULL OR target_e.workspace_id = p_workspace_id)
    )
    SELECT
        entity_id,
        entity_name,
        entity_type,
        description,
        hop_depth,
        path_weight,
        rel_types
    FROM graph_walk
    WHERE hop_depth > 0
    ORDER BY hop_depth ASC, path_weight DESC;
END;
$$;

COMMENT ON FUNCTION heady_graph_neighbors IS
    'Recursive graph traversal for multi-hop entity retrieval. '
    'Returns neighbors up to p_max_hops away, ordered by hop depth and path weight. '
    'Used in GraphRAG local search mode.';

-- ---------------------------------------------------------------------------
-- Combined entity + vector search (vector-first with graph expansion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION heady_entity_vector_search(
    query_embedding vector(384),
    p_workspace_id  TEXT DEFAULT NULL,
    p_limit         INTEGER DEFAULT 10,
    p_graph_expand  BOOLEAN DEFAULT TRUE,
    p_expand_hops   INTEGER DEFAULT 1
)
RETURNS TABLE (
    entity_id       UUID,
    entity_name     TEXT,
    entity_type     TEXT,
    description     TEXT,
    similarity      FLOAT,
    source_type     TEXT  -- 'vector_match' or 'graph_expansion'
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    -- Vector similarity matches
    SELECT
        e.id,
        e.name,
        e.entity_type,
        e.description,
        1 - (e.embedding_half <=> query_embedding::halfvec(384)) AS similarity,
        'vector_match'::TEXT AS source_type
    FROM graph_entities e
    WHERE (p_workspace_id IS NULL OR e.workspace_id = p_workspace_id)
      AND e.canonical_id IS NULL  -- Only canonical entities
    ORDER BY e.embedding_half <=> query_embedding::halfvec(384)
    LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Statistics view: Graph health metrics
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW heady_graph_stats AS
SELECT
    ge.workspace_id,
    COUNT(DISTINCT ge.id) AS total_entities,
    COUNT(DISTINCT gr.id) AS total_relationships,
    COUNT(DISTINCT gc.id) AS total_communities,
    COUNT(DISTINCT ge.entity_type) AS entity_types,
    ROUND(AVG(ge.occurrence_count)::numeric, 2) AS avg_entity_occurrences,
    ROUND(AVG(gr.weight)::numeric, 3) AS avg_relationship_weight,
    COUNT(DISTINCT ge.id) FILTER (WHERE ge.canonical_id IS NOT NULL) AS merged_entities,
    MAX(ge.last_updated_at) AS last_graph_update
FROM graph_entities ge
LEFT JOIN graph_relationships gr ON gr.workspace_id = ge.workspace_id
LEFT JOIN graph_communities gc ON gc.workspace_id = ge.workspace_id
GROUP BY ge.workspace_id;

COMMENT ON VIEW heady_graph_stats IS
    'Health and size statistics for the Heady knowledge graph per workspace. '
    'Monitor total_entities and total_relationships for graph growth rate.';

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT
-- =============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS heady_graph_neighbors(uuid, integer, float, text);
-- DROP FUNCTION IF EXISTS heady_entity_vector_search(vector, text, integer, boolean, integer);
-- DROP VIEW IF EXISTS heady_graph_stats;
-- DROP TABLE IF EXISTS graph_entity_sources;
-- DROP TABLE IF EXISTS graph_document_sources;
-- DROP TABLE IF EXISTS graph_community_members;
-- DROP TABLE IF EXISTS graph_communities;
-- DROP TABLE IF EXISTS graph_relationships;
-- DROP TABLE IF EXISTS graph_entity_aliases;
-- DROP TABLE IF EXISTS graph_entities;
-- DROP FUNCTION IF EXISTS heady_sync_entity_vectors();
-- DROP FUNCTION IF EXISTS heady_sync_relationship_vectors();
-- DROP FUNCTION IF EXISTS heady_sync_community_vectors();
-- DROP FUNCTION IF EXISTS heady_sync_alias_tsv();
-- UPDATE schema_migrations SET rolled_back = TRUE WHERE version = '002';
-- COMMIT;

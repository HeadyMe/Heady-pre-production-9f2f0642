-- ============================================================
-- HEADY VECTOR STORAGE SCHEMA — PostgreSQL + pgvector
-- ============================================================
-- Run against your Drupal database or a dedicated vector DB.
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;
-- ============================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. CORE EMBEDDING TABLE
-- Stores all vector embeddings with metadata linkage
-- ============================================================
CREATE TABLE IF NOT EXISTS heady_embeddings (
  id              BIGSERIAL PRIMARY KEY,
  -- Source linkage
  entity_type     VARCHAR(64) NOT NULL,       -- 'node', 'patent', 'concept', 'note'
  entity_id       BIGINT NOT NULL,            -- Drupal node ID or external ref
  entity_uuid     UUID,                       -- Drupal entity UUID
  chunk_index     INTEGER DEFAULT 0,          -- For chunked content (0 = whole doc)

  -- Content snapshot
  content_hash    VARCHAR(64) NOT NULL,       -- SHA-256 of source text (dedup)
  content_preview TEXT,                       -- First 500 chars for quick display

  -- THE VECTOR (1536-dim for OpenAI ada-002, 768 for smaller models)
  embedding       vector(1536) NOT NULL,

  -- 3D PROJECTION for spatial visualization + fast clustering
  -- Reduced via UMAP/t-SNE from high-dim embedding
  embedding_3d    vector(3),

  -- Metadata
  model_name      VARCHAR(128) DEFAULT 'text-embedding-3-small',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Tags for filtered search
  tags            JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',

  -- Prevent duplicate embeddings for same content
  UNIQUE(entity_type, entity_id, chunk_index, content_hash)
);

-- ============================================================
-- 2. INDEXES FOR FAST SIMILARITY SEARCH
-- ============================================================
-- HNSW index for approximate nearest neighbor search (sub-millisecond)
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_embedding_hnsw 
ON heady_embeddings USING hnsw (embedding vector_cosine_ops);

-- 3D spatial index for fast clustering and visualization
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_3d 
ON heady_embeddings USING hnsw (embedding_3d vector_cosine_ops);

-- Entity lookup indexes
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_entity 
ON heady_embeddings (entity_type, entity_id);

-- Content hash for deduplication
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_hash 
ON heady_embeddings (content_hash);

-- GIN indexes for JSONB tags/metadata
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_tags 
ON heady_embeddings USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_metadata 
ON heady_embeddings USING gin (metadata);

-- ============================================================
-- 3. KNOWLEDGE GRAPH EDGES
-- Stores semantic relationships between embeddings
-- ============================================================
CREATE TABLE IF NOT EXISTS heady_knowledge_edges (
  id              BIGSERIAL PRIMARY KEY,
  source_id       BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  target_id       BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  
  -- Relationship type and weight
  relationship    VARCHAR(32) NOT NULL,       -- 'related_to', 'derived_from', 'contradicts'
  weight          FLOAT DEFAULT 1.0,          -- Relationship strength (0-1)
  confidence      FLOAT DEFAULT 1.0,          -- Confidence in relationship
  
  -- Computed similarity
  cosine_similarity FLOAT,                   -- Pre-computed similarity score
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate edges
  UNIQUE(source_id, target_id, relationship)
);

-- Index for fast graph traversal
CREATE INDEX IF NOT EXISTS idx_heady_knowledge_edges_source 
ON heady_knowledge_edges (source_id);

CREATE INDEX IF NOT EXISTS idx_heady_knowledge_edges_target 
ON heady_knowledge_edges (target_id);

-- ============================================================
-- 4. CLUSTER TABLES
-- Stores auto-discovered topic clusters
-- ============================================================
CREATE TABLE IF NOT EXISTS heady_clusters (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(128) NOT NULL,
  description     TEXT,
  
  -- Cluster centroids (both full and 3D)
  centroid        vector(1536),
  centroid_3d     vector(3),
  
  -- Cluster metadata
  member_count    INTEGER DEFAULT 0,
  avg_similarity  FLOAT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Cluster membership table
CREATE TABLE IF NOT EXISTS heady_cluster_members (
  cluster_id      BIGINT REFERENCES heady_clusters(id) ON DELETE CASCADE,
  embedding_id    BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  membership_score FLOAT DEFAULT 1.0,
  
  PRIMARY KEY (cluster_id, embedding_id)
);

-- ============================================================
-- 5. CORE FUNCTIONS
-- ============================================================

-- Semantic search function
CREATE OR REPLACE FUNCTION heady_semantic_search(
  query_vector vector(1536),
  min_similarity FLOAT DEFAULT 0.7,
  limit_count INTEGER DEFAULT 10,
  entity_filter VARCHAR DEFAULT NULL
) RETURNS TABLE (
  id BIGINT,
  entity_type VARCHAR(64),
  entity_id BIGINT,
  content_preview TEXT,
  similarity FLOAT,
  tags JSONB,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.entity_type,
    e.entity_id,
    e.content_preview,
    1 - (e.embedding <=> query_vector) as similarity,
    e.tags,
    e.metadata
  FROM heady_embeddings e
  WHERE 1 - (e.embedding <=> query_vector) >= min_similarity
    AND (entity_filter IS NULL OR e.entity_type = entity_filter)
  ORDER BY e.embedding <=> query_vector
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 3D spatial search function
CREATE OR REPLACE FUNCTION heady_3d_neighbors(
  point vector(3),
  radius FLOAT DEFAULT 2.0,
  limit_count INTEGER DEFAULT 20
) RETURNS TABLE (
  id BIGINT,
  entity_type VARCHAR(64),
  entity_id BIGINT,
  content_preview TEXT,
  distance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.entity_type,
    e.entity_id,
    e.content_preview,
    e.embedding_3d <=> point as distance
  FROM heady_embeddings e
  WHERE e.embedding_3d <=> point <= radius
  ORDER BY e.embedding_3d <=> point
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-linking function (finds related content)
CREATE OR REPLACE FUNCTION heady_auto_link(
  embedding_id BIGINT,
  similarity_threshold FLOAT DEFAULT 0.85
) RETURNS VOID AS $$
DECLARE
  source_embedding vector(1536);
  target_record RECORD;
BEGIN
  -- Get source embedding
  SELECT embedding INTO source_embedding
  FROM heady_embeddings
  WHERE id = embedding_id;
  
  -- Find similar embeddings and create edges
  FOR target_record IN 
    SELECT id, 1 - (embedding <=> source_embedding) as similarity
    FROM heady_embeddings
    WHERE id != embedding_id
      AND 1 - (embedding <=> source_embedding) >= similarity_threshold
  LOOP
    INSERT INTO heady_knowledge_edges (source_id, target_id, relationship, cosine_similarity)
    VALUES (embedding_id, target_record.id, 'related_to', target_record.similarity)
    ON CONFLICT (source_id, target_id, relationship) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. TRIGGERS FOR AUTOMATIC PROCESSING
-- ============================================================

-- Auto-link new embeddings
CREATE OR REPLACE FUNCTION heady_trigger_auto_link()
RETURNS TRIGGER AS $$
BEGIN
  -- Schedule auto-linking (run asynchronously)
  PERFORM pg_notify('heady_auto_link', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_heady_auto_link
  AFTER INSERT ON heady_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION heady_trigger_auto_link();

-- Update cluster member counts
CREATE OR REPLACE FUNCTION heady_trigger_cluster_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE heady_clusters 
    SET member_count = member_count + 1,
        updated_at = NOW()
    WHERE id = NEW.cluster_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE heady_clusters 
    SET member_count = member_count - 1,
        updated_at = NOW()
    WHERE id = OLD.cluster_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_heady_cluster_count
  AFTER INSERT OR DELETE ON heady_cluster_members
  FOR EACH ROW
  EXECUTE FUNCTION heady_trigger_cluster_count();

-- ============================================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================================

-- Knowledge graph view
CREATE OR REPLACE VIEW heady_knowledge_graph AS
SELECT 
  e1.entity_type as source_type,
  e1.entity_id as source_id,
  e2.entity_type as target_type,
  e2.entity_id as target_id,
  ke.relationship,
  ke.weight,
  ke.confidence,
  ke.cosine_similarity
FROM heady_knowledge_edges ke
JOIN heady_embeddings e1 ON ke.source_id = e1.id
JOIN heady_embeddings e2 ON ke.target_id = e2.id;

-- Cluster summary view
CREATE OR REPLACE VIEW heady_cluster_summary AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.member_count,
  c.avg_similarity,
  c.centroid_3d,
  array_agg(e.entity_type) as entity_types
FROM heady_clusters c
LEFT JOIN heady_cluster_members cm ON c.id = cm.cluster_id
LEFT JOIN heady_embeddings e ON cm.embedding_id = e.id
GROUP BY c.id, c.name, c.description, c.member_count, c.avg_similarity, c.centroid_3d;

-- ============================================================
-- 8. SAMPLE DATA & TESTING
-- ============================================================

-- Example: Insert a test embedding
INSERT INTO heady_embeddings (
  entity_type, entity_id, content_hash, content_preview, 
  embedding, embedding_3d, tags, metadata
) VALUES (
  'note', 
  1, 
  'test_hash_123',
  'This is a test note about Heady Systems vector storage...',
  array_fill(0.1, ARRAY[1536])::vector(1536),  -- Dummy 1536-dim vector
  '[0.1, 0.2, 0.3]'::vector(3),               -- Dummy 3D projection
  '["test", "vector"]',
  '{"source": "test", "version": 1}'
) ON CONFLICT (entity_type, entity_id, chunk_index, content_hash) DO NOTHING;

-- ============================================================
-- 9. PERFORMANCE NOTES
-- ============================================================
/*
TIERED STORAGE STRATEGY:
- HOT (0-90 days): Full vector(1536) with HNSW index
- WARM (90-365 days): Consider halfvec(1536) for 50% storage savings
- COLD (>365 days): Archive to file storage, keep metadata only

INDEX MAINTENANCE:
- HNSW indexes need periodic VACUUM for optimal performance
- Consider IVFFlat for warm tier if memory is constrained

PERFORMANCE TUNING:
- maintenance_work_mem = 512MB for index creation
- shared_buffers = 25% of RAM on dedicated DB server
- effective_cache_size = 75% of RAM

MONITORING:
- Track index size vs table size ratio
- Monitor query latency for semantic search
- Set up alerts for embedding generation failures
*/

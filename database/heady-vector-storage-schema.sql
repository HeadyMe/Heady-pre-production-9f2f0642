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

-- Primary vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_vector 
ON heady_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 3D projection index for clustering/visualization
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_3d 
ON heady_embeddings USING ivfflat (embedding_3d vector_cosine_ops) 
WITH (lists = 10);

-- Entity lookup indexes
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_entity 
ON heady_embeddings (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_uuid 
ON heady_embeddings (entity_uuid);

-- Content hash for deduplication
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_hash 
ON heady_embeddings (content_hash);

-- Time-based indexes
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_created 
ON heady_embeddings (created_at DESC);

-- JSONB tag indexes for filtered search
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_tags 
ON heady_embeddings USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_metadata 
ON heady_embeddings USING gin (metadata);

-- ============================================================
-- 3. SIMILARITY SEARCH FUNCTIONS
-- ============================================================

-- Find similar embeddings by vector
CREATE OR REPLACE FUNCTION find_similar_embeddings(
  query_vector vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 10,
  entity_filter VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  entity_type VARCHAR(64),
  entity_id BIGINT,
  entity_uuid UUID,
  chunk_index INTEGER,
  content_preview TEXT,
  similarity_score FLOAT,
  tags JSONB,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.entity_type,
    e.entity_id,
    e.entity_uuid,
    e.chunk_index,
    e.content_preview,
    1 - (e.embedding <=> query_vector) as similarity_score,
    e.tags,
    e.metadata
  FROM heady_embeddings e
  WHERE 
    (entity_filter IS NULL OR e.entity_type = entity_filter)
    AND (1 - (e.embedding <=> query_vector)) >= similarity_threshold
  ORDER BY e.embedding <=> query_vector
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Find similar by entity ID (content-based recommendations)
CREATE OR REPLACE FUNCTION find_similar_by_entity(
  source_entity_type VARCHAR(64),
  source_entity_id BIGINT,
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  entity_type VARCHAR(64),
  entity_id BIGINT,
  entity_uuid UUID,
  content_preview TEXT,
  similarity_score FLOAT
) AS $$
DECLARE
  source_vector vector(1536);
BEGIN
  SELECT embedding INTO source_vector
  FROM heady_embeddings
  WHERE entity_type = source_entity_type AND entity_id = source_entity_id
  LIMIT 1;
  
  IF source_vector IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    e.id,
    e.entity_type,
    e.entity_id,
    e.entity_uuid,
    e.content_preview,
    1 - (e.embedding <=> source_vector) as similarity_score
  FROM heady_embeddings e
  WHERE 
    e.entity_type != source_entity_type OR e.entity_id != source_entity_id
    AND (1 - (e.embedding <=> source_vector)) >= similarity_threshold
  ORDER BY e.embedding <=> source_vector
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. EMBEDDING MANAGEMENT FUNCTIONS
-- ============================================================

-- Insert or update embedding with deduplication
CREATE OR REPLACE FUNCTION upsert_embedding(
  p_entity_type VARCHAR(64),
  p_entity_id BIGINT,
  p_entity_uuid UUID DEFAULT NULL,
  p_chunk_index INTEGER DEFAULT 0,
  p_content TEXT,
  p_embedding vector(1536),
  p_embedding_3d vector(3) DEFAULT NULL,
  p_model_name VARCHAR(128) DEFAULT 'text-embedding-3-small',
  p_tags JSONB DEFAULT '[]',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
  content_hash VARCHAR(64);
  existing_id BIGINT;
  new_id BIGINT;
BEGIN
  -- Generate content hash
  content_hash := encode(sha256(p_content::bytea), 'hex');
  
  -- Check for existing embedding
  SELECT id INTO existing_id
  FROM heady_embeddings
  WHERE entity_type = p_entity_type 
    AND entity_id = p_entity_id 
    AND chunk_index = p_chunk_index 
    AND content_hash = content_hash;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing
    UPDATE heady_embeddings
    SET 
      embedding = p_embedding,
      embedding_3d = p_embedding_3d,
      content_preview = LEFT(p_content, 500),
      updated_at = NOW(),
      tags = p_tags,
      metadata = p_metadata
    WHERE id = existing_id;
    
    RETURN existing_id;
  ELSE
    -- Insert new
    INSERT INTO heady_embeddings (
      entity_type, entity_id, entity_uuid, chunk_index,
      content_hash, content_preview, embedding, embedding_3d,
      model_name, tags, metadata
    )
    VALUES (
      p_entity_type, p_entity_id, p_entity_uuid, p_chunk_index,
      content_hash, LEFT(p_content, 500), p_embedding, p_embedding_3d,
      p_model_name, p_tags, p_metadata
    )
    RETURNING id INTO new_id;
    
    RETURN new_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Batch insert embeddings for efficiency
CREATE OR REPLACE FUNCTION batch_insert_embeddings(
  embeddings JSONB
)
RETURNS INTEGER AS $$
DECLARE
  embedding_record JSONB;
  inserted_count INTEGER := 0;
BEGIN
  FOR embedding_record IN SELECT * FROM jsonb_array_elements(embeddings)
  LOOP
    PERFORM upsert_embedding(
      embedding_record->>'entity_type',
      (embedding_record->>'entity_id')::BIGINT,
      (embedding_record->>'entity_uuid')::UUID,
      COALESCE((embedding_record->>'chunk_index')::INTEGER, 0),
      embedding_record->>'content',
      embedding_record->>'embedding'::vector(1536),
      embedding_record->>'embedding_3d'::vector(3),
      COALESCE(embedding_record->>'model_name', 'text-embedding-3-small'),
      COALESCE(embedding_record->'tags', '[]'),
      COALESCE(embedding_record->'metadata', '{}')
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. CLUSTERING AND ANALYTICS
-- ============================================================

-- Get embedding statistics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
  total_embeddings BIGINT,
  unique_entities BIGINT,
  entity_types JSONB,
  model_distribution JSONB,
  avg_embedding_dimensions FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_embeddings,
    COUNT(DISTINCT entity_type || '|' || entity_id) as unique_entities,
    jsonb_agg(DISTINCT entity_type) as entity_types,
    jsonb_object_agg(model_name, model_count) as model_distribution,
    AVG(1536) as avg_embedding_dimensions
  FROM heady_embeddings,
  (SELECT model_name, COUNT(*) as model_count 
   FROM heady_embeddings 
   GROUP BY model_name) model_stats;
END;
$$ LANGUAGE plpgsql;

-- Find clusters using 3D projections
CREATE OR REPLACE FUNCTION find_3d_clusters(
  cluster_radius FLOAT DEFAULT 0.1,
  min_cluster_size INTEGER DEFAULT 3
)
RETURNS TABLE (
  cluster_id INTEGER,
  center_x FLOAT,
  center_y FLOAT,
  center_z FLOAT,
  member_count BIGINT,
  entity_types JSONB
) AS $$
WITH cluster_centers AS (
  SELECT 
    ROW_NUMBER() OVER () as cluster_id,
    embedding_3d[0] as center_x,
    embedding_3d[1] as center_y,
    embedding_3d[2] as center_z
  FROM heady_embeddings
  WHERE embedding_3d IS NOT NULL
  GROUP BY embedding_3d[0], embedding_3d[1], embedding_3d[2]
  HAVING COUNT(*) >= min_cluster_size
)
SELECT 
  cc.cluster_id,
  cc.center_x,
  cc.center_y,
  cc.center_z,
  COUNT(e.id) as member_count,
  jsonb_agg(DISTINCT e.entity_type) as entity_types
FROM cluster_centers cc
JOIN heady_embeddings e ON (
  e.embedding_3d IS NOT NULL AND
  SQRT(
    POW(e.embedding_3d[0] - cc.center_x, 2) +
    POW(e.embedding_3d[1] - cc.center_y, 2) +
    POW(e.embedding_3d[2] - cc.center_z, 2)
  ) <= cluster_radius
)
GROUP BY cc.cluster_id, cc.center_x, cc.center_y, cc.center_z;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. MAINTENANCE AND CLEANUP
-- ============================================================

-- Clean up old embeddings (keep recent N days per entity type)
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(
  days_to_keep INTEGER DEFAULT 365,
  entity_type_filter VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM heady_embeddings
  WHERE 
    created_at < NOW() - INTERVAL '1 day' * days_to_keep
    AND (entity_type_filter IS NULL OR entity_type = entity_type_filter);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Rebuild indexes for optimal performance
CREATE OR REPLACE FUNCTION rebuild_vector_indexes()
RETURNS VOID AS $$
BEGIN
  REINDEX INDEX idx_heady_embeddings_vector;
  REINDEX INDEX idx_heady_embeddings_3d;
  ANALYZE heady_embeddings;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. VIEWS FOR COMMON QUERIES
-- ============================================================

-- Recent embeddings view
CREATE OR REPLACE VIEW recent_embeddings AS
SELECT 
  id,
  entity_type,
  entity_id,
  entity_uuid,
  chunk_index,
  content_preview,
  model_name,
  created_at,
  tags,
  metadata
FROM heady_embeddings
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Entity summary view
CREATE OR REPLACE VIEW entity_embedding_summary AS
SELECT 
  entity_type,
  entity_id,
  entity_uuid,
  COUNT(*) as chunk_count,
  MIN(created_at) as first_embedded,
  MAX(created_at) as last_updated,
  model_name,
  jsonb_agg(DISTINCT tags) as all_tags
FROM heady_embeddings
GROUP BY entity_type, entity_id, entity_uuid, model_name
ORDER BY last_updated DESC;

-- ============================================================
-- 8. SAMPLE USAGE QUERIES
-- ============================================================

-- Example: Find similar content to a Drupal node
/*
SELECT * FROM find_similar_embeddings(
  (SELECT embedding FROM heady_embeddings WHERE entity_type = 'node' AND entity_id = 123 LIMIT 1),
  0.8,  -- 80% similarity threshold
  5,    -- max 5 results
  'node' -- only nodes
);
*/

-- Example: Insert new embedding
/*
SELECT upsert_embedding(
  'node',
  456,
  '123e4567-e89b-12d3-a456-426614174000'::UUID,
  0,
  'This is the content to embed...',
  '[0.1,0.2,0.3,...]'::vector(1536),
  '[0.1,0.2,0.3]'::vector(3),
  'text-embedding-3-small',
  '["drupal", "article"]'::JSONB,
  '{"author": "admin", "category": "tech"}'::JSONB
);
*/

-- ============================================================
-- 9. PERFORMANCE TUNING NOTES
-- ============================================================
-- 
-- - Adjust IVFFlat lists parameter based on dataset size:
--   * 1M rows: lists = 100
--   * 10M rows: lists = 1000
--   * 100M rows: lists = 10000
--
-- - Consider partitioning by entity_type for large datasets
-- - Monitor index size and rebuild periodically
-- - Use connection pooling for high-throughput scenarios
-- - Consider materialized views for frequent analytics queries
--
-- ============================================================

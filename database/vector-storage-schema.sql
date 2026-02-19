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

-- Primary similarity index on full embedding
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_embedding_cosine 
ON heady_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Index on 3D projection for fast clustering/visualization
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_embedding_3d 
ON heady_embeddings 
USING ivfflat (embedding_3d vector_cosine_ops) 
WITH (lists = 10);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_entity_lookup 
ON heady_embeddings (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_content_hash 
ON heady_embeddings (content_hash);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_model_created 
ON heady_embeddings (model_name, created_at);

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_heady_embeddings_tags_gin 
ON heady_embeddings USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_heady_embeddings_metadata_gin 
ON heady_embeddings USING gin (metadata);

-- ============================================================
-- 3. NODE-SPECIFIC TABLES (for AI node activities)
-- ============================================================

-- JULES (Hyper-Surgeon) - Optimizations
CREATE TABLE IF NOT EXISTS heady_jules_optimizations (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  optimization_type VARCHAR(64) NOT NULL,     -- 'performance', 'code', 'architecture'
  file_path TEXT,
  before_metrics JSONB,
  after_metrics JSONB,
  improvement_score DECIMAL(5,4),              -- 0.0000 to 1.0000
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OBSERVER (Natural Observer) - Monitoring data
CREATE TABLE IF NOT EXISTS heady_observer_observations (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  observation_type VARCHAR(64) NOT NULL,     -- 'health', 'performance', 'anomaly'
  metrics JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',       -- 'info', 'warning', 'error', 'critical'
  node_status VARCHAR(20) DEFAULT 'healthy',  -- 'healthy', 'degraded', 'unhealthy'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUILDER (Constructor) - Project creations
CREATE TABLE IF NOT EXISTS heady_builder_projects (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(64) NOT NULL,          -- 'react', 'drupal', 'api', 'service'
  template_used VARCHAR(128),
  file_structure JSONB,
  dependencies JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATLAS (Auto-Archivist) - Documentation
CREATE TABLE IF NOT EXISTS heady_atlas_documentation (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  doc_type VARCHAR(64) NOT NULL,               -- 'readme', 'api', 'guide', 'reference'
  file_path TEXT,
  auto_generated BOOLEAN DEFAULT true,
  quality_score DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PYTHIA (Oracle) - Predictions and insights
CREATE TABLE IF NOT EXISTS heady_pythia_predictions (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  prediction_type VARCHAR(64) NOT NULL,       -- 'trend', 'risk', 'opportunity', 'recommendation'
  confidence DECIMAL(5,4) NOT NULL,           -- 0.0000 to 1.0000
  prediction_data JSONB NOT NULL,
  actual_outcome JSONB,                       -- Filled when prediction is evaluated
  accuracy_score DECIMAL(5,4),                -- Calculated later
  created_at TIMESTAMPTZ DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ
);

-- ============================================================
-- 4. PATTERN RECOGNITION AND ARENA MODE
-- ============================================================

-- Pattern definitions and performance
CREATE TABLE IF NOT EXISTS heady_patterns (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  pattern_name VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(64) NOT NULL,          -- 'optimization', 'security', 'performance'
  description TEXT,
  success_rate DECIMAL(5,4) DEFAULT 0.0000,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  arena_score DECIMAL(5,4) DEFAULT 0.0000,    -- Arena mode performance score
  status VARCHAR(20) DEFAULT 'active',        -- 'active', 'deprecated', 'experimental'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arena mode competitions and results
CREATE TABLE IF NOT EXISTS heady_arena_competitions (
  id BIGSERIAL PRIMARY KEY,
  competition_name VARCHAR(255) NOT NULL,
  task_description TEXT,
  patterns_competing BIGINT[] REFERENCES heady_patterns(id),
  winner_pattern_id BIGINT REFERENCES heady_patterns(id),
  metrics JSONB NOT NULL,                      -- latency, accuracy, resource_usage
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. MEMORY AND LEARNING SYSTEM
-- ============================================================

-- Enhanced memory system with vector search
CREATE TABLE IF NOT EXISTS heady_memories (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  memory_type VARCHAR(64) NOT NULL,            -- 'learning', 'error', 'success', 'pattern'
  source_node VARCHAR(32) NOT NULL,            -- Which AI node created this memory
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  importance_score DECIMAL(5,4) DEFAULT 0.5000,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                     -- For temporary memories
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning connections between memories
CREATE TABLE IF NOT EXISTS heady_memory_connections (
  id BIGSERIAL PRIMARY KEY,
  source_memory_id BIGINT REFERENCES heady_memories(id) ON DELETE CASCADE,
  target_memory_id BIGINT REFERENCES heady_memories(id) ON DELETE CASCADE,
  connection_strength DECIMAL(5,4) DEFAULT 0.5000,
  connection_type VARCHAR(64) DEFAULT 'related',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(source_memory_id, target_memory_id)
);

-- ============================================================
-- 6. DRUPAL INTEGRATION TABLES
-- ============================================================

-- Drupal content types for Heady ecosystem
CREATE TABLE IF NOT EXISTS heady_drupal_content (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  drupal_nid BIGINT,                          -- Drupal node ID
  drupal_uuid UUID,                           -- Drupal entity UUID
  content_type VARCHAR(128) NOT NULL,         -- 'pattern', 'node_activity', 'project'
  title VARCHAR(255),
  status VARCHAR(20) DEFAULT 'published',     -- 'published', 'draft', 'archived'
  drupal_data JSONB,                          -- Full Drupal entity data
  sync_status VARCHAR(20) DEFAULT 'synced',   -- 'synced', 'pending', 'error'
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node activity tracking for Drupal
CREATE TABLE IF NOT EXISTS heady_node_activities (
  id BIGSERIAL PRIMARY KEY,
  embedding_id BIGINT REFERENCES heady_embeddings(id) ON DELETE CASCADE,
  node_name VARCHAR(32) NOT NULL,             -- 'JULES', 'OBSERVER', etc.
  activity_type VARCHAR(64) NOT NULL,         -- 'optimization', 'monitoring', 'creation'
  activity_data JSONB NOT NULL,
  drupal_content_id BIGINT REFERENCES heady_drupal_content(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. SEARCH AND QUERY FUNCTIONS
-- ============================================================

-- Function for semantic similarity search
CREATE OR REPLACE FUNCTION heady_semantic_search(
  query_vector vector(1536),
  entity_type_filter VARCHAR(64) DEFAULT NULL,
  limit_count INTEGER DEFAULT 10,
  similarity_threshold DECIMAL(3,2) DEFAULT 0.7
)
RETURNS TABLE (
  id BIGINT,
  entity_type VARCHAR(64),
  entity_id BIGINT,
  content_preview TEXT,
  similarity DECIMAL(3,2),
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
    e.metadata
  FROM heady_embeddings e
  WHERE 
    (entity_type_filter IS NULL OR e.entity_type = entity_type_filter)
    AND (1 - (e.embedding <=> query_vector)) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function for pattern recommendation based on context
CREATE OR REPLACE FUNCTION heady_recommend_patterns(
  context_vector vector(1536),
  pattern_type_filter VARCHAR(64) DEFAULT NULL,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  pattern_id BIGINT,
  pattern_name VARCHAR(255),
  success_rate DECIMAL(5,4),
  arena_score DECIMAL(5,4),
  similarity DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.pattern_name,
    p.success_rate,
    p.arena_score,
    1 - (e.embedding <=> context_vector) as similarity
  FROM heady_patterns p
  JOIN heady_embeddings e ON p.embedding_id = e.id
  WHERE 
    (pattern_type_filter IS NULL OR p.pattern_type = pattern_type_filter)
    AND p.status = 'active'
  ORDER BY 
    (p.success_rate * 0.4 + p.arena_score * 0.4 + similarity * 0.2) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function for memory consolidation and cleanup
CREATE OR REPLACE FUNCTION heady_consolidate_memories()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired memories
  DELETE FROM heady_memories 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Update access statistics
  UPDATE heady_memories 
  SET last_accessed = NOW(), access_count = access_count + 1
  WHERE id IN (
    SELECT DISTINCT source_memory_id 
    FROM heady_memory_connections 
    WHERE created_at > NOW() - INTERVAL '24 hours'
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. TRIGGERS AND AUTOMATION
-- ============================================================

-- Update updated_at timestamp on embeddings
CREATE OR REPLACE FUNCTION heady_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER heady_embeddings_updated_at
  BEFORE UPDATE ON heady_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION heady_update_updated_at_column();

-- Auto-generate 3D projection when embedding is inserted
CREATE OR REPLACE FUNCTION heady_generate_3d_projection()
RETURNS TRIGGER AS $$
BEGIN
  -- This would normally use UMAP/t-SNE, simplified for demo
  -- In production, this would call a Python service for dimensionality reduction
  NEW.embedding_3d = (
    NEW.embedding[1:3]  -- Simple truncation for demo
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER heady_embeddings_3d_projection
  BEFORE INSERT ON heady_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION heady_generate_3d_projection();

-- ============================================================
-- 9. VIEWS FOR COMMON QUERIES
-- ============================================================

-- Node activity summary
CREATE OR REPLACE VIEW heady_node_activity_summary AS
SELECT 
  n.node_name,
  n.activity_type,
  COUNT(*) as activity_count,
  MAX(n.created_at) as last_activity,
  COUNT(DISTINCT n.drupal_content_id) as content_items
FROM heady_node_activities n
GROUP BY n.node_name, n.activity_type
ORDER BY activity_count DESC;

-- Pattern performance ranking
CREATE OR REPLACE VIEW heady_pattern_rankings AS
SELECT 
  p.pattern_name,
  p.pattern_type,
  p.success_rate,
  p.arena_score,
  p.usage_count,
  (p.success_rate * 0.6 + p.arena_score * 0.4) as composite_score
FROM heady_patterns p
WHERE p.status = 'active'
ORDER BY composite_score DESC;

-- Memory system health
CREATE OR REPLACE VIEW heady_memory_health AS
SELECT 
  COUNT(*) as total_memories,
  COUNT(CASE WHEN importance_score > 0.8 THEN 1 END) as high_importance,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_count,
  COUNT(CASE WHEN last_accessed > NOW() - INTERVAL '24 hours' THEN 1 END) as recently_accessed,
  AVG(importance_score) as avg_importance
FROM heady_memories;

-- ============================================================
-- 10. SAMPLE DATA AND TESTING
-- ============================================================

-- Function to insert test data
CREATE OR REPLACE FUNCTION heady_insert_test_data()
RETURNS VOID AS $$
DECLARE
  test_embedding vector(1536);
  test_id BIGINT;
BEGIN
  -- Generate a test embedding (all zeros for demo)
  test_embedding := '[0]'::vector(1536);
  
  -- Insert a test embedding
  INSERT INTO heady_embeddings (
    entity_type, entity_id, content_hash, content_preview, 
    embedding, model_name, tags
  ) VALUES (
    'test', 1, 'test_hash', 'This is a test embedding for verification',
    test_embedding, 'text-embedding-3-small', '["test", "demo"]'
  ) RETURNING id INTO test_id;
  
  -- Insert a test memory
  INSERT INTO heady_memories (
    embedding_id, memory_type, source_node, content, importance_score
  ) VALUES (
    test_id, 'test', 'BRAIN', 'Test memory for system verification', 0.8
  );
  
  RAISE NOTICE 'Test data inserted successfully. Embedding ID: %', test_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. MAINTENANCE AND OPTIMIZATION
-- ============================================================

-- Function to rebuild indexes for performance
CREATE OR REPLACE FUNCTION heady_rebuild_indexes()
RETURNS VOID AS $$
BEGIN
  REINDEX INDEX CONCURRENTLY idx_heady_embeddings_embedding_cosine;
  REINDEX INDEX CONCURRENTLY idx_heady_embeddings_embedding_3d;
  REINDEX INDEX CONCURRENTLY idx_heady_embeddings_entity_lookup;
  
  RAISE NOTICE 'Indexes rebuilt successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION heady_analyze_tables()
RETURNS VOID AS $$
BEGIN
  ANALYZE heady_embeddings;
  ANALYZE heady_memories;
  ANALYZE heady_patterns;
  ANALYZE heady_node_activities;
  
  RAISE NOTICE 'Table statistics analyzed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. SECURITY AND PERMISSIONS
-- ============================================================

-- Create read-only role for semantic search
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'heady_readonly') THEN
    CREATE ROLE heady_readonly;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO heady_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO heady_readonly;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO heady_readonly;

-- Create application role with full permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'heady_app') THEN
    CREATE ROLE heady_app;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO heady_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO heady_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO heady_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO heady_app;

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Heady Vector Storage Schema installed successfully!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Key features:';
  RAISE NOTICE '- Vector embeddings with pgvector support';
  RAISE NOTICE '- AI node activity tracking';
  RAISE NOTICE '- Pattern recognition and arena mode';
  RAISE NOTICE '- Enhanced memory system';
  RAISE NOTICE '- Drupal integration';
  RAISE NOTICE '- Semantic search functions';
  RAISE NOTICE '- Automated maintenance';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: SELECT heady_insert_test_data();';
  RAISE NOTICE '2. Test search: SELECT * FROM heady_semantic_search(''[0]''::vector(1536));';
  RAISE NOTICE '3. Set up your embedding service';
  RAISE NOTICE '4. Configure AI node integration';
  RAISE NOTICE '============================================================';
END $$;

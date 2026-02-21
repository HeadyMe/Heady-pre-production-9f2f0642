-- Initialize pgvector extension for Heady MCP Engine
-- This script runs automatically when PostgreSQL starts

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the heady_embeddings table for vector storage
CREATE TABLE IF NOT EXISTS heady_embeddings (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id INT NOT NULL,
    bundle VARCHAR(64),
    embedding vector(1536) NOT NULL,  -- OpenAI ada-002 dimensions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_type, entity_id)
);

-- Create HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS heady_embeddings_hnsw_idx
ON heady_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create priority execution log table
CREATE TABLE IF NOT EXISTS heady_priority_log (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    priority INT NOT NULL,
    args TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for priority queries
CREATE INDEX IF NOT EXISTS heady_priority_log_priority_created
ON heady_priority_log (priority, created_at);

-- Grant permissions to Drupal user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

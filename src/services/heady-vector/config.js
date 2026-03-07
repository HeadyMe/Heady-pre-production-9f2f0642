'use strict';

/**
 * HeadyVector Configuration
 * Sacred Geometry scaling: PHI = 1.618033988749895
 * Supports 384-dim and 768-dim embeddings
 */

const PHI = 1.618033988749895;

const config = {
  // Service identity
  serviceName: 'heady-vector',
  version: '1.0.0',

  // Network
  port: parseInt(process.env.HEADY_VECTOR_PORT, 10) || 3103,
  host: process.env.HEADY_VECTOR_HOST || '0.0.0.0',

  // PostgreSQL connection
  database: {
    url: process.env.DATABASE_URL || 'postgresql://heady:heady@localhost:5432/heady_vector',
    poolSize: parseInt(process.env.PG_POOL_SIZE, 10) || Math.round(PHI * 10), // ~16
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT, 10) || 5000,
    statementTimeout: parseInt(process.env.PG_STATEMENT_TIMEOUT, 10) || 30000,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  // Vector dimensions supported
  vectorDimensions: {
    small: 384,   // all-MiniLM-L6-v2, paraphrase-MiniLM-L6-v2
    large: 768,   // all-mpnet-base-v2, paraphrase-mpnet-base-v2
    default: 384,
  },

  // HNSW index parameters (pgvector)
  hnsw: {
    m: parseInt(process.env.HNSW_M, 10) || 16,                           // max connections per node
    efConstruction: parseInt(process.env.HNSW_EF_CONSTRUCTION, 10) || 200, // build-time candidate list
    efSearch: parseInt(process.env.HNSW_EF_SEARCH, 10) || 100,           // query-time candidate list
  },

  // IVFFlat index parameters
  ivfflat: {
    lists: parseInt(process.env.IVFFLAT_LISTS, 10) || 100,   // number of cluster centroids
    probes: parseInt(process.env.IVFFLAT_PROBES, 10) || 10,  // number of clusters to search
  },

  // Hybrid search weights (must sum to 1.0)
  search: {
    bm25Weight: parseFloat(process.env.BM25_WEIGHT) || 0.3,
    semanticWeight: parseFloat(process.env.SEMANTIC_WEIGHT) || 0.7,
    defaultTopK: parseInt(process.env.DEFAULT_TOP_K, 10) || 10,
    maxTopK: parseInt(process.env.MAX_TOP_K, 10) || 1000,
    defaultAlpha: parseFloat(process.env.DEFAULT_ALPHA) || 0.7, // 0=pure BM25, 1=pure semantic
    rrfK: parseInt(process.env.RRF_K, 10) || 60, // RRF constant
    mmrLambda: parseFloat(process.env.MMR_LAMBDA) || 0.5, // MMR diversity vs relevance
  },

  // Batch operations
  batch: {
    upsertSize: parseInt(process.env.BATCH_UPSERT_SIZE, 10) || Math.round(PHI * PHI * 100), // ~261
    maxConcurrency: parseInt(process.env.BATCH_CONCURRENCY, 10) || 4,
  },

  // Graph RAG
  graph: {
    maxDepth: parseInt(process.env.GRAPH_MAX_DEPTH, 10) || 3,
    maxNodes: parseInt(process.env.GRAPH_MAX_NODES, 10) || 100,
    minEdgeWeight: parseFloat(process.env.GRAPH_MIN_EDGE_WEIGHT) || 0.1,
    communityResolution: parseFloat(process.env.COMMUNITY_RESOLUTION) || 1.0,
  },

  // Migration
  migrations: {
    tableName: process.env.MIGRATIONS_TABLE || 'heady_vector_migrations',
    lockTimeout: parseInt(process.env.MIGRATIONS_LOCK_TIMEOUT, 10) || 10000,
  },

  // Collection defaults
  collections: {
    defaultMetadataSchema: null,   // no schema enforcement by default
    maxNameLength: 128,
    maxMetadataSize: 65536, // 64KB
  },

  // Metrics
  metrics: {
    queryLatencyBuckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_MS, 10) || 500,
  },

  // Sacred Geometry
  phi: PHI,
  phiSquared: PHI * PHI,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate weights sum to ~1.0
const weightSum = config.search.bm25Weight + config.search.semanticWeight;
if (Math.abs(weightSum - 1.0) > 0.01) {
  console.warn(
    `[heady-vector] WARNING: BM25_WEIGHT(${config.search.bm25Weight}) + SEMANTIC_WEIGHT(${config.search.semanticWeight}) = ${weightSum} (should be 1.0)`
  );
}

module.exports = config;

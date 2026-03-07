'use strict';

/**
 * HeadyCache Configuration
 * Sacred Geometry scaling: PHI = 1.618033988749895
 */

const PHI = 1.618033988749895;

const config = {
  // Server
  port: parseInt(process.env.HEADY_CACHE_PORT || '3105', 10),

  // Storage backend: 'memory' | 'file' | 'pg'
  backend: process.env.HEADY_CACHE_BACKEND || 'memory',

  // Max number of entries in cache (per namespace)
  maxSize: parseInt(process.env.HEADY_CACHE_MAX_SIZE || '50000', 10),

  // Default TTL in milliseconds (1 hour)
  ttl: parseInt(process.env.HEADY_CACHE_TTL || String(3600 * 1000), 10),

  // Cosine similarity threshold for semantic cache hit (0-1)
  similarityThreshold: parseFloat(
    process.env.HEADY_CACHE_SIMILARITY_THRESHOLD || '0.95'
  ),

  // Distance metric: 'cosine' | 'euclidean' | 'dot'
  distanceMetric: process.env.HEADY_CACHE_DISTANCE_METRIC || 'cosine',

  // Eviction policy: 'lru' | 'lfu' | 'ttl' | 'similarity' | 'hybrid'
  evictionPolicy: process.env.HEADY_CACHE_EVICTION_POLICY || 'lru',

  // Write strategy: 'write-through' | 'write-behind'
  writeStrategy: process.env.HEADY_CACHE_WRITE_STRATEGY || 'write-through',

  // Write-behind flush interval (ms)
  writeBehindInterval: parseInt(
    process.env.HEADY_CACHE_WRITE_BEHIND_INTERVAL || String(Math.round(5000 * PHI)),
    10
  ),

  // HeadyEmbed service URL for computing embeddings
  embedUrl: process.env.HEADY_EMBED_URL || 'http://localhost:3103',

  // Embedding dimensions (384 for all-MiniLM-L6-v2)
  embeddingDims: parseInt(process.env.HEADY_CACHE_EMBEDDING_DIMS || '384', 10),

  // VP-tree rebuild threshold: rebuild index after this many changes
  vpTreeRebuildThreshold: parseInt(
    process.env.HEADY_CACHE_VPTREE_REBUILD_THRESHOLD || '100',
    10
  ),

  // File store path (file backend)
  filePath: process.env.HEADY_CACHE_FILE_PATH || '/tmp/heady-cache.jsonl',
  walPath: process.env.HEADY_CACHE_WAL_PATH || '/tmp/heady-cache.wal',

  // PostgreSQL connection (pg backend)
  pgConnectionString:
    process.env.HEADY_CACHE_PG_URL ||
    process.env.DATABASE_URL ||
    'postgresql://localhost:5432/heady_cache',

  // Analytics retention (number of time-series points to keep)
  analyticsRetention: parseInt(
    process.env.HEADY_CACHE_ANALYTICS_RETENTION || String(Math.round(1000 * PHI)),
    10
  ),

  // Cost savings: estimated cost per API call avoided (USD)
  costPerCall: parseFloat(process.env.HEADY_CACHE_COST_PER_CALL || '0.002'),

  // Memory pressure threshold (bytes) - trigger aggressive eviction
  memoryPressureThreshold: parseInt(
    process.env.HEADY_CACHE_MEMORY_THRESHOLD || String(512 * 1024 * 1024),
    10
  ),

  // Sliding window TTL: reset TTL on hit
  slidingWindowTtl: process.env.HEADY_CACHE_SLIDING_TTL !== 'false',

  // Default namespace
  defaultNamespace: process.env.HEADY_CACHE_DEFAULT_NS || 'default',

  // Batch operation concurrency limit
  batchConcurrency: parseInt(
    process.env.HEADY_CACHE_BATCH_CONCURRENCY || String(Math.round(10 * PHI)),
    10
  ),

  // Sacred Geometry
  phi: PHI,
};

module.exports = config;

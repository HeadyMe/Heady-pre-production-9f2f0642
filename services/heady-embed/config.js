'use strict';

/**
 * HeadyEmbed Configuration
 * 
 * All settings are overridable via environment variables.
 * Sacred Geometry constants (PHI) are used throughout for scaling.
 */

const PHI = 1.618033988749895; // Golden ratio

const config = {
  // Sacred Geometry
  PHI,
  PHI_SQUARED: PHI * PHI,       // ~2.618
  PHI_CUBED: PHI * PHI * PHI,   // ~4.236

  // Model settings
  model: process.env.HEADY_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2',
  dimensions: parseInt(process.env.HEADY_EMBED_DIMENSIONS, 10) || 384,
  maxTokens: parseInt(process.env.HEADY_EMBED_MAX_TOKENS, 10) || 512,
  poolingStrategy: process.env.HEADY_EMBED_POOLING || 'mean', // mean | cls | max

  // Batch processing
  batchSize: parseInt(process.env.HEADY_EMBED_BATCH_SIZE, 10) || 32,
  maxConcurrentBatches: parseInt(process.env.HEADY_EMBED_MAX_CONCURRENT_BATCHES, 10) || 4,
  batchTimeoutMs: parseInt(process.env.HEADY_EMBED_BATCH_TIMEOUT_MS, 10) || 30000,

  // Cache settings
  cacheSize: parseInt(process.env.HEADY_EMBED_CACHE_SIZE, 10) || 10000,
  cacheTtl: parseInt(process.env.HEADY_EMBED_CACHE_TTL, 10) || 86400000, // 24h
  cachePersistPath: process.env.HEADY_EMBED_CACHE_PATH || '/tmp/heady-embed-cache.jsonl',
  cacheWarmOnStart: process.env.HEADY_EMBED_CACHE_WARM !== 'false',
  bloomFilterSize: parseInt(process.env.HEADY_EMBED_BLOOM_SIZE, 10) || 100000,

  // Server settings
  port: parseInt(process.env.HEADY_EMBED_PORT, 10) || 3101,
  host: process.env.HEADY_EMBED_HOST || '0.0.0.0',

  // Retry settings (PHI-scaled backoff: 1s, 1.618s, 2.618s, 4.236s)
  retryMaxAttempts: parseInt(process.env.HEADY_EMBED_RETRY_MAX, 10) || 4,
  retryBaseDelayMs: parseInt(process.env.HEADY_EMBED_RETRY_BASE_MS, 10) || 1000,

  // Logging
  logLevel: process.env.HEADY_EMBED_LOG_LEVEL || 'info',

  // Model cache directory (for ONNX model weights)
  modelCacheDir: process.env.HEADY_EMBED_MODEL_CACHE_DIR || '/tmp/heady-models',

  // Warm-up settings
  warmupOnStart: process.env.HEADY_EMBED_WARMUP !== 'false',
  warmupTexts: [
    'Hello world',
    'Sacred geometry powers the Heady AI platform',
    'Embedding warm-up for optimal latency',
  ],

  // Memory limits
  maxMemoryMb: parseInt(process.env.HEADY_EMBED_MAX_MEMORY_MB, 10) || 2048,

  // Metrics
  metricsWindowSize: parseInt(process.env.HEADY_EMBED_METRICS_WINDOW, 10) || 100,

  // Job management for async batch jobs
  jobTtlMs: parseInt(process.env.HEADY_EMBED_JOB_TTL_MS, 10) || 3600000, // 1h
};

/**
 * Compute PHI-scaled backoff delay for retry attempt (0-indexed)
 * Sequence: 1000ms, 1618ms, 2618ms, 4236ms
 */
config.getRetryDelay = function getRetryDelay(attempt) {
  return Math.round(config.retryBaseDelayMs * Math.pow(PHI, attempt));
};

/**
 * Validate configuration on load
 */
(function validate() {
  const validPooling = ['mean', 'cls', 'max'];
  if (!validPooling.includes(config.poolingStrategy)) {
    throw new Error(`Invalid HEADY_EMBED_POOLING: "${config.poolingStrategy}". Must be one of: ${validPooling.join(', ')}`);
  }
  if (config.batchSize < 1 || config.batchSize > 512) {
    throw new Error(`HEADY_EMBED_BATCH_SIZE must be between 1 and 512, got: ${config.batchSize}`);
  }
  if (config.dimensions !== 384 && config.dimensions !== 768) {
    // Allow any value but warn
    process.stderr.write(`[HeadyEmbed] Warning: Non-standard dimensions ${config.dimensions}. Expected 384 or 768.\n`);
  }
})();

module.exports = config;

'use strict';

/**
 * HeadyEmbed — Main Class
 *
 * Production-quality local embedding service using @xenova/transformers (ONNX Runtime).
 * Replaces OpenAI embeddings with local transformer models on Heady AI platform.
 *
 * Architecture:
 *   - Sacred Geometry scaling (PHI = 1.618) for retry backoff and dimension normalization
 *   - 384-dim (default) and 768-dim embedding support
 *   - LRU cache with bloom filter, TTL, and JSONL persistence
 *   - Dynamic batch processing with priority queue and deduplication
 *   - Event emitter lifecycle: ready | embedding | cached | error | shutdown
 */

const EventEmitter = require('events');
const config = require('./config');
const { ModelManager } = require('./models');
const { EmbeddingCache } = require('./cache');
const { BatchProcessor } = require('./batch-processor');

const PHI = config.PHI;

// ---------------------------------------------------------------------------
// HeadyEmbed Class
// ---------------------------------------------------------------------------

class HeadyEmbed extends EventEmitter {
  /**
   * @param {object} options - Override config defaults
   * @param {string}   options.model           - Default model ID
   * @param {number}   options.batchSize        - Batch size
   * @param {number}   options.cacheSize        - LRU cache max entries
   * @param {number}   options.cacheTtl         - TTL in ms
   * @param {string}   options.cachePersistPath - JSONL cache file path
   * @param {string}   options.poolingStrategy  - 'mean' | 'cls' | 'max'
   * @param {number}   options.dimensions       - Target embedding dimensions
   */
  constructor(options = {}) {
    super();

    this._config = {
      model: options.model || config.model,
      batchSize: options.batchSize || config.batchSize,
      cacheSize: options.cacheSize || config.cacheSize,
      cacheTtl: options.cacheTtl != null ? options.cacheTtl : config.cacheTtl,
      cachePersistPath: options.cachePersistPath || config.cachePersistPath,
      poolingStrategy: options.poolingStrategy || config.poolingStrategy,
      dimensions: options.dimensions || config.dimensions,
      warmupOnStart: options.warmupOnStart != null ? options.warmupOnStart : config.warmupOnStart,
      warmupTexts: options.warmupTexts || config.warmupTexts,
      cacheWarmOnStart: options.cacheWarmOnStart != null ? options.cacheWarmOnStart : config.cacheWarmOnStart,
    };

    this._ready = false;
    this._startTime = Date.now();

    // Sub-systems
    this._modelManager = new ModelManager({
      cacheDir: config.modelCacheDir,
      defaultModel: this._config.model,
    });

    this._cache = new EmbeddingCache({
      maxSize: this._config.cacheSize,
      ttl: this._config.cacheTtl,
      persistPath: this._config.cachePersistPath,
    });

    this._batchProcessor = new BatchProcessor({
      embedFn: this._runInference.bind(this),
      batchSize: this._config.batchSize,
      maxConcurrent: config.maxConcurrentBatches,
      maxMemoryMb: config.maxMemoryMb,
      retryMaxAttempts: config.retryMaxAttempts,
    });

    // Metrics
    this._metrics = {
      totalEmbeddings: 0,
      cacheHits: 0,
      cacheMisses: 0,
      modelLoadTimeMs: 0,
      latencyWindow: [],     // Last N request latencies (ms)
      windowSize: config.metricsWindowSize,
      errors: 0,
    };

    // Wire sub-system events
    this._wireEvents();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialize HeadyEmbed: load model, warm cache, run warm-up embeddings.
   * Must be called before embed().
   */
  async initialize() {
    if (this._ready) return;

    this.emit('initializing');

    const t0 = Date.now();

    // 1. Warm cache from disk
    if (this._config.cacheWarmOnStart) {
      try {
        const loaded = await this._cache.loadFromDisk();
        this.emit('cacheWarmed', { loaded });
      } catch (err) {
        this.emit('warn', { message: `Cache warm failed: ${err.message}` });
      }
    }

    // 2. Load default model
    try {
      await this._modelManager.loadModel(this._config.model);
      this._metrics.modelLoadTimeMs = Date.now() - t0;
    } catch (err) {
      this.emit('error', new Error(`Model load failed: ${err.message}`));
      throw err;
    }

    // 3. Warm-up inference (pre-load ONNX weights into memory)
    if (this._config.warmupOnStart) {
      try {
        await this._warmUp();
      } catch (err) {
        // Warm-up failure is non-fatal
        this.emit('warn', { message: `Warm-up failed: ${err.message}` });
      }
    }

    // 4. Start cache auto-persist (every 60s)
    this._cache.startAutoPersist(60000);

    this._ready = true;
    this.emit('ready', {
      model: this._config.model,
      dimensions: this._config.dimensions,
      modelLoadTimeMs: this._metrics.modelLoadTimeMs,
    });
  }

  /**
   * Graceful shutdown: persist cache, release model memory.
   */
  async shutdown() {
    if (!this._ready) return;
    this._ready = false;

    this.emit('shutting-down');

    await Promise.all([
      this._batchProcessor.shutdown(),
      this._cache.shutdown(),
      this._modelManager.shutdown(),
    ]);

    this.emit('shutdown');
  }

  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------

  /**
   * Generate embeddings for one or more texts.
   *
   * @param {string|string[]} texts
   * @param {object} options
   * @param {string} options.modelId          - Override model for this request
   * @param {string} options.pooling          - Override pooling strategy
   * @param {boolean} options.normalize       - L2-normalize output (default: true)
   * @param {boolean} options.useCache        - Use cache (default: true)
   * @param {number}  options.priority        - Request priority 0-9 (0=urgent)
   * @param {Function} options.onProgress     - Progress callback for large batches
   * @returns {Promise<number[][]>}            Array of embedding vectors
   */
  async embed(texts, options = {}) {
    if (!this._ready) {
      throw new Error('HeadyEmbed is not initialized. Call initialize() first.');
    }

    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) return [];

    const modelId = options.modelId || this._config.model;
    const useCache = options.useCache !== false;
    const normalize = options.normalize !== false;

    const t0 = Date.now();
    const results = new Array(arr.length);
    const missIndices = [];

    // 1. Check cache for each text
    if (useCache) {
      for (let i = 0; i < arr.length; i++) {
        const key = EmbeddingCache.makeKey(arr[i], modelId);
        const cached = this._cache.get(key);
        if (cached) {
          results[i] = cached;
          this._metrics.cacheHits++;
        } else {
          missIndices.push(i);
          this._metrics.cacheMisses++;
        }
      }
    } else {
      for (let i = 0; i < arr.length; i++) missIndices.push(i);
    }

    // 2. Compute embeddings for cache misses
    if (missIndices.length > 0) {
      const missTexts = missIndices.map((i) => arr[i]);

      let embeddings;
      try {
        embeddings = await this._batchProcessor.embed(missTexts, {
          modelId,
          priority: options.priority,
          onProgress: options.onProgress,
        });
      } catch (err) {
        this._metrics.errors++;
        this.emit('error', err);
        throw err;
      }

      // 3. L2-normalize and store results
      for (let j = 0; j < missIndices.length; j++) {
        const i = missIndices[j];
        const vec = normalize ? l2Normalize(embeddings[j]) : toArray(embeddings[j]);
        results[i] = vec;
        this._metrics.totalEmbeddings++;

        if (useCache) {
          const key = EmbeddingCache.makeKey(arr[i], modelId);
          this._cache.set(key, vec);
        }
      }
    }

    // 4. Track latency
    const latencyMs = Date.now() - t0;
    this._recordLatency(latencyMs);

    this.emit('embedded', {
      count: arr.length,
      cacheHits: arr.length - missIndices.length,
      misses: missIndices.length,
      latencyMs,
    });

    return results;
  }

  /**
   * Compute cosine similarity between two texts (or two vectors).
   *
   * @param {string|number[]} a
   * @param {string|number[]} b
   * @param {object} options
   * @returns {Promise<number>} Similarity in [-1, 1]
   */
  async similarity(a, b, options = {}) {
    let vecA, vecB;

    if (typeof a === 'string') {
      const embeddings = await this.embed([a, b], options);
      vecA = embeddings[0];
      vecB = embeddings[1];
    } else {
      vecA = a;
      vecB = b;
    }

    return cosineSimilarity(vecA, vecB);
  }

  /**
   * Load a model (downloads + caches if needed).
   */
  async loadModel(modelId) {
    return this._modelManager.loadModel(modelId);
  }

  /**
   * Hot-swap the active model without downtime.
   */
  async switchModel(modelId) {
    this.emit('modelSwitch', { from: this._config.model, to: modelId });
    await this._modelManager.hotSwap(modelId);
    this._config.model = modelId;
    this.emit('modelSwitched', { model: modelId });
  }

  // -------------------------------------------------------------------------
  // Metrics & Status
  // -------------------------------------------------------------------------

  /**
   * Return current metrics snapshot.
   */
  getMetrics() {
    const cacheStats = this._cache.getStats();
    const batchStats = this._batchProcessor.getStats();
    const totalRequests = this._metrics.cacheHits + this._metrics.cacheMisses;

    return {
      ready: this._ready,
      model: this._config.model,
      dimensions: this._config.dimensions,
      uptime: Date.now() - this._startTime,

      // Embedding counts
      totalEmbeddings: this._metrics.totalEmbeddings,
      errors: this._metrics.errors,
      modelLoadTimeMs: this._metrics.modelLoadTimeMs,

      // Cache
      cache: {
        hits: this._metrics.cacheHits,
        misses: this._metrics.cacheMisses,
        hitRate: totalRequests > 0 ? this._metrics.cacheHits / totalRequests : 0,
        ...cacheStats,
      },

      // Latency (rolling window)
      latency: this._getLatencyStats(),

      // Batch processor
      batch: batchStats,

      // Memory
      memory: process.memoryUsage(),
    };
  }

  /**
   * Return service health status.
   */
  getHealth() {
    const latency = this._getLatencyStats();
    const cacheStats = this._cache.getStats();
    const mem = process.memoryUsage();

    return {
      status: this._ready ? 'healthy' : 'unavailable',
      ready: this._ready,
      model: {
        id: this._config.model,
        loaded: this._modelManager.isLoaded(this._config.model),
      },
      cache: {
        size: cacheStats.size,
        maxSize: this._config.cacheSize,
        hitRate: cacheStats.hitRate,
      },
      latency: {
        avgMs: latency.avg,
        p95Ms: latency.p95,
      },
      memory: {
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1),
        rssMb: (mem.rss / 1024 / 1024).toFixed(1),
      },
      uptime: Date.now() - this._startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Internal: inference
  // -------------------------------------------------------------------------

  /**
   * Run actual ONNX inference via @xenova/transformers pipeline.
   * Called by BatchProcessor.
   *
   * @param {string[]} texts
   * @param {string}   modelId
   * @param {Function} onProgress
   * @returns {Promise<number[][]>}
   */
  async _runInference(texts, modelId, onProgress) {
    const pipeline = await this._modelManager.loadModel(modelId);
    const pooling = this._config.poolingStrategy;

    this.emit('embedding', { count: texts.length, modelId, pooling });

    const results = [];
    const total = texts.length;

    // Process texts through the pipeline
    // @xenova/transformers pipeline returns tensor-like objects
    for (let i = 0; i < total; i++) {
      const text = texts[i];

      let output;
      try {
        output = await pipeline(text, {
          pooling,
          normalize: false, // We apply our own L2 normalization
        });
      } catch (err) {
        throw new Error(`Inference failed for text[${i}]: ${err.message}`);
      }

      // Extract the embedding vector from the tensor output
      const vec = this._extractVector(output);
      results.push(vec);

      if (onProgress && (i + 1) % 10 === 0) {
        onProgress(i + 1, total);
      }
    }

    if (onProgress) onProgress(total, total);

    return results;
  }

  /**
   * Extract a flat number array from a Xenova tensor output.
   * Handles various output formats (Tensor, TypedArray, plain array).
   */
  _extractVector(output) {
    // Xenova pipeline returns a Tensor with .data property
    if (output && output.data) {
      return Array.from(output.data);
    }
    // Already an array
    if (Array.isArray(output)) {
      // May be nested: [[...]] or [...]
      if (Array.isArray(output[0])) return Array.from(output[0]);
      return output;
    }
    // TypedArray
    if (output && output.constructor && output.constructor.BYTES_PER_ELEMENT) {
      return Array.from(output);
    }
    throw new Error(`Unrecognized pipeline output format: ${typeof output}`);
  }

  // -------------------------------------------------------------------------
  // Internal: warm-up
  // -------------------------------------------------------------------------

  async _warmUp() {
    this.emit('warmup:start', { texts: this._config.warmupTexts.length });
    const t0 = Date.now();
    await this.embed(this._config.warmupTexts, { useCache: false });
    this.emit('warmup:complete', { durationMs: Date.now() - t0 });
  }

  // -------------------------------------------------------------------------
  // Internal: metrics
  // -------------------------------------------------------------------------

  _recordLatency(ms) {
    this._metrics.latencyWindow.push(ms);
    if (this._metrics.latencyWindow.length > this._metrics.windowSize) {
      this._metrics.latencyWindow.shift();
    }
  }

  _getLatencyStats() {
    const window = this._metrics.latencyWindow;
    if (window.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };

    const sorted = [...window].sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);

    return {
      avg: Math.round(sum / sorted.length),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      samples: sorted.length,
    };
  }

  // -------------------------------------------------------------------------
  // Internal: event wiring
  // -------------------------------------------------------------------------

  _wireEvents() {
    // Model manager events
    this._modelManager.on('model:loaded', (e) => this.emit('model:loaded', e));
    this._modelManager.on('model:loading', (e) => this.emit('model:loading', e));
    this._modelManager.on('model:error', (e) => this.emit('model:error', e));
    this._modelManager.on('model:progress', (e) => this.emit('model:progress', e));
    this._modelManager.on('hotswap:complete', (e) => this.emit('hotswap:complete', e));

    // Cache events
    this._cache.on('error', (e) => this.emit('warn', { message: `Cache error: ${e.message}` }));
    this._cache.on('evict', () => {}); // Silently allow evictions

    // Batch processor events
    this._batchProcessor.on('retry', (e) => this.emit('retry', e));
    this._batchProcessor.on('dedup', (e) => this.emit('dedup', e));
  }
}

// ---------------------------------------------------------------------------
// Math utilities
// ---------------------------------------------------------------------------

/**
 * L2-normalize a vector to unit length.
 * If the norm is 0 (zero vector), returns the zero vector unchanged.
 */
function l2Normalize(vec) {
  const arr = toArray(vec);
  let norm = 0;
  for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return arr;
  return arr.map((v) => v / norm);
}

/**
 * Cosine similarity between two unit vectors.
 * Assumes inputs are already L2-normalized (dot product == cosine similarity).
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/**
 * Convert TypedArray or Tensor.data to plain Array.
 */
function toArray(vec) {
  if (Array.isArray(vec)) return vec;
  if (vec && vec.data) return Array.from(vec.data);
  if (vec && vec.constructor && vec.constructor.BYTES_PER_ELEMENT) return Array.from(vec);
  return vec;
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  HeadyEmbed,
  l2Normalize,
  cosineSimilarity,
  // Re-export sub-modules for direct access
  ModelManager: require('./models').ModelManager,
  MODEL_REGISTRY: require('./models').MODEL_REGISTRY,
  EmbeddingCache: require('./cache').EmbeddingCache,
  BatchProcessor: require('./batch-processor').BatchProcessor,
  config,
  PHI,
};

'use strict';

/**
 * HeadyEmbed Model Registry & Management
 *
 * Manages supported transformer models, their metadata, and hot-swap loading.
 * Uses @xenova/transformers (ONNX Runtime) for local inference.
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// ---------------------------------------------------------------------------
// Model Registry
// ---------------------------------------------------------------------------

/**
 * Supported models with full metadata.
 * Speed ratings: 1 (slowest) → 5 (fastest)
 */
const MODEL_REGISTRY = {
  'Xenova/all-MiniLM-L6-v2': {
    id: 'Xenova/all-MiniLM-L6-v2',
    shortName: 'all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 256,
    speedRating: 5,
    qualityRating: 3,
    description: 'Lightweight 384-dim model. Excellent for high-throughput semantic search.',
    task: 'feature-extraction',
    sizeMb: 23,
    defaultPooling: 'mean',
  },
  'Xenova/all-MiniLM-L12-v2': {
    id: 'Xenova/all-MiniLM-L12-v2',
    shortName: 'all-MiniLM-L12-v2',
    dimensions: 384,
    maxTokens: 256,
    speedRating: 4,
    qualityRating: 4,
    description: 'Balanced 384-dim model with 12 layers. Better quality than L6 at modest cost.',
    task: 'feature-extraction',
    sizeMb: 45,
    defaultPooling: 'mean',
  },
  'Xenova/all-mpnet-base-v2': {
    id: 'Xenova/all-mpnet-base-v2',
    shortName: 'all-mpnet-base-v2',
    dimensions: 768,
    maxTokens: 384,
    speedRating: 2,
    qualityRating: 5,
    description: 'High-quality 768-dim MPNet model. Best for precision semantic tasks.',
    task: 'feature-extraction',
    sizeMb: 438,
    defaultPooling: 'mean',
  },
  'Xenova/bge-small-en-v1.5': {
    id: 'Xenova/bge-small-en-v1.5',
    shortName: 'bge-small-en-v1.5',
    dimensions: 384,
    maxTokens: 512,
    speedRating: 5,
    qualityRating: 4,
    description: 'BGE small English model. Fast, high-quality BAAI General Embeddings.',
    task: 'feature-extraction',
    sizeMb: 24,
    defaultPooling: 'cls',
  },
  'Xenova/bge-base-en-v1.5': {
    id: 'Xenova/bge-base-en-v1.5',
    shortName: 'bge-base-en-v1.5',
    dimensions: 768,
    maxTokens: 512,
    speedRating: 3,
    qualityRating: 5,
    description: 'BGE base English model. Quality 768-dim embeddings from BAAI.',
    task: 'feature-extraction',
    sizeMb: 109,
    defaultPooling: 'cls',
  },
};

// ---------------------------------------------------------------------------
// ModelManager Class
// ---------------------------------------------------------------------------

class ModelManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this._options = {
      cacheDir: options.cacheDir || config.modelCacheDir,
      defaultModel: options.defaultModel || config.model,
    };

    /** @type {Map<string, { pipeline: any, meta: object, loadedAt: number }>} */
    this._loaded = new Map();
    this._loading = new Map(); // modelId -> Promise
    this._Pipeline = null;    // lazy import
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Returns all registered model metadata (no pipeline objects).
   */
  listModels() {
    return Object.values(MODEL_REGISTRY).map((m) => ({
      ...m,
      loaded: this._loaded.has(m.id),
      loadedAt: this._loaded.has(m.id) ? this._loaded.get(m.id).loadedAt : null,
    }));
  }

  /**
   * Get metadata for a single model.
   */
  getModelMeta(modelId) {
    const id = this._resolveId(modelId);
    if (!MODEL_REGISTRY[id]) {
      throw new Error(`Unknown model: "${modelId}". Run listModels() for available options.`);
    }
    return { ...MODEL_REGISTRY[id] };
  }

  /**
   * Load (or return cached) a model pipeline.
   * Thread-safe: concurrent calls for the same model wait on the same promise.
   */
  async loadModel(modelId) {
    const id = this._resolveId(modelId);

    if (!MODEL_REGISTRY[id]) {
      throw new Error(`Unknown model: "${id}". Supported: ${Object.keys(MODEL_REGISTRY).join(', ')}`);
    }

    // Return already-loaded pipeline immediately
    if (this._loaded.has(id)) {
      return this._loaded.get(id).pipeline;
    }

    // Coalesce concurrent load requests
    if (this._loading.has(id)) {
      return this._loading.get(id);
    }

    const loadPromise = this._doLoadModel(id);
    this._loading.set(id, loadPromise);

    try {
      const pipeline = await loadPromise;
      return pipeline;
    } finally {
      this._loading.delete(id);
    }
  }

  /**
   * Hot-swap: load a new model and unload the previous default.
   * Ensures zero-downtime model switching.
   */
  async hotSwap(newModelId) {
    const id = this._resolveId(newModelId);
    const previousDefault = this._options.defaultModel;

    this.emit('hotswap:start', { from: previousDefault, to: id });

    // Load new model first
    await this.loadModel(id);

    // Update default
    this._options.defaultModel = id;

    // Unload old model if different
    if (previousDefault !== id && this._loaded.has(previousDefault)) {
      await this.unloadModel(previousDefault);
    }

    this.emit('hotswap:complete', { from: previousDefault, to: id });
    return this._loaded.get(id).pipeline;
  }

  /**
   * Unload a model to free memory.
   */
  async unloadModel(modelId) {
    const id = this._resolveId(modelId);
    if (!this._loaded.has(id)) return;

    const entry = this._loaded.get(id);
    // Xenova pipelines don't have an explicit destroy, but we can dereference
    // and let GC collect. Some runtimes expose dispose().
    if (entry.pipeline && typeof entry.pipeline.dispose === 'function') {
      try { await entry.pipeline.dispose(); } catch (_) { /* best-effort */ }
    }

    this._loaded.delete(id);
    this.emit('model:unloaded', { modelId: id });
  }

  /**
   * Get default pipeline (loads if not ready).
   */
  async getDefaultPipeline() {
    return this.loadModel(this._options.defaultModel);
  }

  /**
   * Get an already-loaded pipeline synchronously. Returns null if not loaded.
   */
  getPipelineSync(modelId) {
    const id = this._resolveId(modelId || this._options.defaultModel);
    const entry = this._loaded.get(id);
    return entry ? entry.pipeline : null;
  }

  /**
   * Check whether a model is currently loaded.
   */
  isLoaded(modelId) {
    const id = this._resolveId(modelId || this._options.defaultModel);
    return this._loaded.has(id);
  }

  /**
   * Graceful shutdown: unload all models.
   */
  async shutdown() {
    const ids = [...this._loaded.keys()];
    await Promise.all(ids.map((id) => this.unloadModel(id)));
    this.emit('shutdown');
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Normalize a model identifier (support short names too).
   */
  _resolveId(modelId) {
    if (!modelId) return this._options.defaultModel;
    if (MODEL_REGISTRY[modelId]) return modelId;

    // Try matching shortName
    const match = Object.values(MODEL_REGISTRY).find(
      (m) => m.shortName === modelId || m.shortName === modelId.replace('Xenova/', '')
    );
    if (match) return match.id;

    return modelId; // Pass through (may fail later with a clear error)
  }

  /**
   * Perform actual model load. Called once per model.
   */
  async _doLoadModel(id) {
    const meta = MODEL_REGISTRY[id];
    const startMs = Date.now();

    this.emit('model:loading', { modelId: id, meta });

    // Ensure cache dir exists
    try {
      fs.mkdirSync(this._options.cacheDir, { recursive: true });
    } catch (_) { /* already exists */ }

    // Set HuggingFace cache env so Xenova stores models to our path
    process.env.TRANSFORMERS_CACHE = this._options.cacheDir;
    process.env.HF_HOME = this._options.cacheDir;

    // Lazy-load @xenova/transformers to avoid top-level await
    if (!this._Pipeline) {
      try {
        const transformers = require('@xenova/transformers');
        this._Pipeline = transformers.pipeline;

        // Configure for local ONNX runtime
        if (transformers.env) {
          transformers.env.allowLocalModels = false; // Use HF Hub
          transformers.env.useBrowserCache = false;
          if (transformers.env.backends && transformers.env.backends.onnx) {
            // Use wasm backend for Node.js compatibility
            transformers.env.backends.onnx.wasm = transformers.env.backends.onnx.wasm || {};
          }
        }
      } catch (err) {
        throw new Error(
          `@xenova/transformers is not installed. Run: npm install @xenova/transformers\n${err.message}`
        );
      }
    }

    let pipeline;
    try {
      pipeline = await this._Pipeline(meta.task, id, {
        quantized: true,       // Use int8-quantized ONNX for smaller footprint
        progress_callback: (progress) => {
          this.emit('model:progress', { modelId: id, progress });
        },
      });
    } catch (err) {
      this.emit('model:error', { modelId: id, error: err.message });
      throw new Error(`Failed to load model "${id}": ${err.message}`);
    }

    const loadTimeMs = Date.now() - startMs;

    this._loaded.set(id, {
      pipeline,
      meta,
      loadedAt: Date.now(),
      loadTimeMs,
    });

    this.emit('model:loaded', { modelId: id, loadTimeMs, meta });
    return pipeline;
  }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
  MODEL_REGISTRY,
  ModelManager,
};

'use strict';

/**
 * VectorPipeline — Vector-augmented request/response pipeline.
 * Enriches incoming requests with relevant vector context from memory
 * and can store response interactions for future retrieval.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class VectorPipeline extends EventEmitter {
  constructor(vectorMemory, opts = {}) {
    super();
    this.vectorMemory = vectorMemory;
    this.topK = opts.topK || 3;
    this.minScore = opts.minScore || 0.5;
    this.maxContextChars = opts.maxContextChars || 4000;
    this.storeInteractions = opts.storeInteractions !== false;
    this._stats = { enrichments: 0, stores: 0, errors: 0, hits: 0, misses: 0 };
  }

  // ─── Context enrichment ────────────────────────────────────────────────────

  /**
   * Retrieve relevant context for a query from vector memory.
   */
  async getContext(query, opts = {}) {
    if (!this.vectorMemory || typeof this.vectorMemory.search !== 'function') {
      return { context: null, results: [] };
    }
    try {
      const results = await this.vectorMemory.search(query, {
        topK: opts.topK || this.topK,
        minScore: opts.minScore || this.minScore,
        namespace: opts.namespace,
        filter: opts.filter,
      });

      if (!results || results.length === 0) {
        this._stats.misses++;
        return { context: null, results: [] };
      }

      this._stats.hits++;
      this._stats.enrichments++;

      // Build context string
      let context = results
        .map((r, i) => `[Memory ${i + 1} | score: ${r.score?.toFixed(3) || 'N/A'}]: ${r.text || r.content || ''}`)
        .join('\n\n')
        .slice(0, this.maxContextChars);

      return { context, results, truncated: context.length >= this.maxContextChars };
    } catch (err) {
      this._stats.errors++;
      this.emit('error', { phase: 'search', error: err.message });
      return { context: null, results: [], error: err.message };
    }
  }

  /**
   * Store a text (with optional vector) in memory.
   */
  async store(text, meta = {}, vectorOverride = null) {
    if (!this.vectorMemory || typeof this.vectorMemory.store !== 'function') return null;
    try {
      const id = meta.id || 'vp_' + crypto.randomBytes(8).toString('hex');
      await this.vectorMemory.store(id, vectorOverride, text, meta);
      this._stats.stores++;
      return id;
    } catch (err) {
      this._stats.errors++;
      this.emit('error', { phase: 'store', error: err.message });
      return null;
    }
  }

  getStats() {
    return { ...this._stats };
  }
}

// ─── Middleware factory ────────────────────────────────────────────────────────

/**
 * Creates Express middleware that enriches req with vector context.
 * Attaches req.vectorContext = { context, results } before route handlers run.
 */
function createVectorAugmentedMiddleware(vectorMemory, opts = {}) {
  const pipeline = new VectorPipeline(vectorMemory, opts);

  return async function vectorAugmentMiddleware(req, res, next) {
    // Only enrich POST/PUT requests with a body
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.vectorPipeline = pipeline;
      return next();
    }

    const query = req.body?.prompt || req.body?.query || req.body?.message || req.body?.text;
    if (query) {
      const { context, results, error } = await pipeline.getContext(query, {
        topK: opts.topK,
        namespace: req.body?.namespace,
      });
      req.vectorContext = { context, results, error };
      req.vectorPipeline = pipeline;
    }
    next();
  };
}

// ─── Express routes ───────────────────────────────────────────────────────────

function registerRoutes(app, vectorMemory) {
  const pipeline = new VectorPipeline(vectorMemory);

  /** POST /api/vector/search — semantic search */
  app.post('/api/vector/search', async (req, res) => {
    try {
      const { query, topK, minScore, namespace } = req.body || {};
      if (!query) return res.status(400).json({ ok: false, error: 'query required' });
      const { context, results, error } = await pipeline.getContext(query, { topK, minScore, namespace });
      res.json({ ok: !error, context, results: results || [], stats: pipeline.getStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** POST /api/vector/store — store text in vector memory */
  app.post('/api/vector/store', async (req, res) => {
    try {
      const { text, meta } = req.body || {};
      if (!text) return res.status(400).json({ ok: false, error: 'text required' });
      const id = await pipeline.store(text, meta || {});
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** GET /api/vector/stats — pipeline stats */
  app.get('/api/vector/stats', (req, res) => {
    res.json({ ok: true, stats: pipeline.getStats() });
  });

  /** POST /api/vector/augment — enrich a prompt with vector context */
  app.post('/api/vector/augment', async (req, res) => {
    try {
      const { prompt, topK, namespace } = req.body || {};
      if (!prompt) return res.status(400).json({ ok: false, error: 'prompt required' });
      const { context, results } = await pipeline.getContext(prompt, { topK, namespace });
      const augmented = context ? `Relevant context:\n${context}\n\n---\n\n${prompt}` : prompt;
      res.json({ ok: true, augmented, original: prompt, context, results: results || [], enriched: !!context });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  return app;
}

module.exports = { VectorPipeline, createVectorAugmentedMiddleware, registerRoutes };

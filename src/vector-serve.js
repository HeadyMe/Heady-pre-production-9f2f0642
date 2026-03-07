'use strict';

/**
 * VectorServe — High-level vector memory serving API.
 * Wraps a vectorMemory instance with full CRUD, search, and analytics.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class VectorServe extends EventEmitter {
  /**
   * @param {object} vectorMemory — must implement store(id, vector, text, meta), search(query, opts), delete(id), list(opts)
   * @param {object} logger — logger interface with info/warn/error
   */
  constructor(vectorMemory, logger) {
    super();
    this.vectorMemory = vectorMemory;
    this.logger = logger || console;
    this._stats = {
      stores: 0,
      searches: 0,
      deletes: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
    };
  }

  // ─── Core operations ───────────────────────────────────────────────────────

  async store(text, meta = {}, vectorOverride = null) {
    const id = meta.id || 'vs_' + crypto.randomBytes(10).toString('hex');
    try {
      await this.vectorMemory.store(id, vectorOverride, text, { ...meta, storedAt: new Date().toISOString() });
      this._stats.stores++;
      this.emit('stored', { id, meta });
      return { id, ok: true };
    } catch (err) {
      this._stats.errors++;
      this.logger.error('[VectorServe] store error:', err.message);
      throw err;
    }
  }

  async storeBatch(items) {
    const results = [];
    for (const item of items) {
      try {
        const result = await this.store(item.text, item.meta || {}, item.vector || null);
        results.push(result);
      } catch (err) {
        results.push({ id: item.meta?.id || null, ok: false, error: err.message });
      }
    }
    return results;
  }

  async search(query, opts = {}) {
    try {
      const results = await this.vectorMemory.search(query, {
        topK: opts.topK || 5,
        minScore: opts.minScore || 0,
        namespace: opts.namespace,
        filter: opts.filter,
      });
      this._stats.searches++;
      this.emit('searched', { query: query.slice(0, 80), results: results?.length || 0 });
      return results || [];
    } catch (err) {
      this._stats.errors++;
      this.logger.error('[VectorServe] search error:', err.message);
      throw err;
    }
  }

  async delete(id) {
    try {
      if (typeof this.vectorMemory.delete === 'function') {
        await this.vectorMemory.delete(id);
      } else {
        throw new Error('delete not supported by underlying vector memory');
      }
      this._stats.deletes++;
      this.emit('deleted', { id });
      return true;
    } catch (err) {
      this._stats.errors++;
      this.logger.error('[VectorServe] delete error:', err.message);
      throw err;
    }
  }

  async list(opts = {}) {
    try {
      if (typeof this.vectorMemory.list === 'function') {
        return await this.vectorMemory.list(opts);
      }
      return [];
    } catch (err) {
      this._stats.errors++;
      this.logger.error('[VectorServe] list error:', err.message);
      return [];
    }
  }

  async get(id) {
    try {
      if (typeof this.vectorMemory.get === 'function') {
        return await this.vectorMemory.get(id);
      }
      return null;
    } catch (err) {
      this._stats.errors++;
      return null;
    }
  }

  async ping() {
    if (typeof this.vectorMemory.ping === 'function') return await this.vectorMemory.ping();
    return { ok: true, message: 'VectorMemory ping not supported' };
  }

  getStats() {
    return {
      ...this._stats,
      uptime: Math.floor((Date.now() - new Date(this._stats.startedAt).getTime()) / 1000),
    };
  }

  // ─── Wire routes ───────────────────────────────────────────────────────────

  wireRoutes(app) {
    /** POST /api/vs/store — store a document */
    app.post('/api/vs/store', async (req, res) => {
      try {
        const { text, meta, vector } = req.body || {};
        if (!text) return res.status(400).json({ ok: false, error: 'text required' });
        const result = await this.store(text, meta || {}, vector || null);
        res.status(201).json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/vs/batch — batch store */
    app.post('/api/vs/batch', async (req, res) => {
      try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ ok: false, error: 'items array required' });
        }
        const results = await this.storeBatch(items);
        res.json({ ok: true, results, stored: results.filter(r => r.ok).length });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/vs/search — semantic search */
    app.post('/api/vs/search', async (req, res) => {
      try {
        const { query, topK, minScore, namespace, filter } = req.body || {};
        if (!query) return res.status(400).json({ ok: false, error: 'query required' });
        const results = await this.search(query, { topK, minScore, namespace, filter });
        res.json({ ok: true, results, count: results.length });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/vs/docs/:id — retrieve a document */
    app.get('/api/vs/docs/:id', async (req, res) => {
      const doc = await this.get(req.params.id);
      if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
      res.json({ ok: true, doc });
    });

    /** DELETE /api/vs/docs/:id */
    app.delete('/api/vs/docs/:id', async (req, res) => {
      try {
        await this.delete(req.params.id);
        res.json({ ok: true, deleted: req.params.id });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/vs/docs — list documents */
    app.get('/api/vs/docs', async (req, res) => {
      try {
        const { namespace, limit, offset } = req.query;
        const docs = await this.list({ namespace, limit: parseInt(limit) || 100, offset: parseInt(offset) || 0 });
        res.json({ ok: true, docs, count: docs.length });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/vs/stats */
    app.get('/api/vs/stats', (req, res) => {
      res.json({ ok: true, stats: this.getStats() });
    });

    /** GET /api/vs/health */
    app.get('/api/vs/health', async (req, res) => {
      try {
        const pingResult = await this.ping();
        res.json({ ok: true, ...pingResult, stats: this.getStats() });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    return app;
  }
}

module.exports = { VectorServe };

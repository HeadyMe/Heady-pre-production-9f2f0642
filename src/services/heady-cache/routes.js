'use strict';

/**
 * HeadyCache Express Router
 *
 * Routes:
 *   POST   /cache/get               — Semantic or exact cache lookup
 *   POST   /cache/set               — Store a cache entry
 *   DELETE /cache/:key              — Delete a cache entry
 *   POST   /cache/batch/get         — Batch get
 *   POST   /cache/batch/set         — Batch set
 *   DELETE /cache/namespace/:ns     — Clear a namespace
 *   GET    /cache/stats             — Cache statistics
 *   GET    /cache/analytics         — Full analytics report
 *   POST   /cache/warm              — Warm cache from data
 *   GET    /health                  — Health check
 */

const express = require('express');

/**
 * @param {import('./index').HeadyCache} cache
 * @returns {express.Router}
 */
function createRouter(cache) {
  const router = express.Router();

  // ---------------------------------------------------------------------------
  // Input validation helpers
  // ---------------------------------------------------------------------------

  function requireFields(res, body, fields) {
    for (const f of fields) {
      if (body[f] === undefined || body[f] === null) {
        res.status(400).json({ error: `Missing required field: ${f}` });
        return false;
      }
    }
    return true;
  }

  function handleError(res, err) {
    console.error('[heady-cache] route error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }

  // ---------------------------------------------------------------------------
  // POST /cache/get
  // ---------------------------------------------------------------------------
  // Body: { key: string, namespace?: string, threshold?: number, exactOnly?: boolean }
  // Response: { value, meta, similarity, exact } | { hit: false }
  router.post('/cache/get', async (req, res) => {
    if (!requireFields(res, req.body, ['key'])) return;
    try {
      const result = await cache.get({
        key: req.body.key,
        namespace: req.body.namespace,
        threshold: req.body.threshold,
        exactOnly: req.body.exactOnly,
      });
      if (!result) {
        return res.status(200).json({ hit: false });
      }
      res.json({ hit: true, ...result });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /cache/set
  // ---------------------------------------------------------------------------
  // Body: { key, value, namespace?, ttl?, vector?, skipEmbed? }
  // Response: { id }
  router.post('/cache/set', async (req, res) => {
    if (!requireFields(res, req.body, ['key', 'value'])) return;
    try {
      const result = await cache.set({
        key: req.body.key,
        value: req.body.value,
        namespace: req.body.namespace,
        ttl: req.body.ttl,
        vector: req.body.vector,
        skipEmbed: req.body.skipEmbed,
      });
      res.status(201).json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // DELETE /cache/namespace/:ns — must be before /cache/:key to avoid shadowing
  // ---------------------------------------------------------------------------
  // Response: { cleared: true }
  router.delete('/cache/namespace/:ns', async (req, res) => {
    try {
      const result = await cache.clearNamespace(req.params.ns);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // DELETE /cache/:key
  // ---------------------------------------------------------------------------
  // Query param: ?namespace=<ns>
  // Response: { deleted: boolean }
  router.delete('/cache/:key', async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.key);
      const result = await cache.delete({
        key,
        namespace: req.query.namespace,
      });
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /cache/batch/get
  // ---------------------------------------------------------------------------
  // Body: { requests: [{ key, namespace?, threshold?, exactOnly? }] }
  // Response: { results: [{ hit, value, meta, similarity, exact } | { hit: false }] }
  router.post('/cache/batch/get', async (req, res) => {
    if (!requireFields(res, req.body, ['requests'])) return;
    if (!Array.isArray(req.body.requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }
    if (req.body.requests.length > 1000) {
      return res.status(400).json({ error: 'Batch size exceeds maximum of 1000' });
    }
    try {
      const results = await cache.batchGet(req.body.requests);
      res.json({
        results: results.map((r) => r ? { hit: true, ...r } : { hit: false }),
      });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /cache/batch/set
  // ---------------------------------------------------------------------------
  // Body: { requests: [{ key, value, namespace?, ttl?, vector?, skipEmbed? }] }
  // Response: { results: [{ id }] }
  router.post('/cache/batch/set', async (req, res) => {
    if (!requireFields(res, req.body, ['requests'])) return;
    if (!Array.isArray(req.body.requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }
    if (req.body.requests.length > 1000) {
      return res.status(400).json({ error: 'Batch size exceeds maximum of 1000' });
    }
    try {
      const results = await cache.batchSet(req.body.requests);
      res.status(201).json({ results });
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /cache/stats
  // ---------------------------------------------------------------------------
  // Response: { hits, misses, hitRate, entries, bytes, ... }
  router.get('/cache/stats', (req, res) => {
    try {
      res.json(cache.getStats());
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /cache/analytics
  // ---------------------------------------------------------------------------
  // Response: full analytics including latency histograms, hot keys, savings
  router.get('/cache/analytics', (req, res) => {
    try {
      res.json(cache.getAnalytics());
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /cache/warm
  // ---------------------------------------------------------------------------
  // Body: { entries: [{ key, value, namespace?, ttl?, vector? }] }
  // Response: { warmed, failed }
  router.post('/cache/warm', async (req, res) => {
    if (!requireFields(res, req.body, ['entries'])) return;
    if (!Array.isArray(req.body.entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }
    if (req.body.entries.length > 10000) {
      return res.status(400).json({ error: 'Warm batch exceeds maximum of 10000' });
    }
    try {
      const result = await cache.warm(req.body.entries);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /health
  // ---------------------------------------------------------------------------
  router.get('/health', async (req, res) => {
    try {
      const health = await cache.healthCheck();
      const status = health.status === 'ok' ? 200 : 503;
      res.status(status).json(health);
    } catch (err) {
      res.status(503).json({ status: 'error', error: err.message });
    }
  });

  return router;
}

module.exports = { createRouter };

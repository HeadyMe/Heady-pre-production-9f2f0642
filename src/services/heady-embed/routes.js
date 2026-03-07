'use strict';

/**
 * HeadyEmbed Express Router
 *
 * Endpoints:
 *   POST   /embed                 — Embed one or more texts
 *   POST   /embed/batch           — Large async batch job
 *   GET    /embed/batch/:jobId    — Poll batch job status
 *   POST   /embed/similarity      — Cosine similarity between two texts
 *   GET    /models                — List available models
 *   POST   /models/load           — Load a specific model
 *   GET    /metrics               — Service metrics
 *   GET    /health                — Full health report
 *   GET    /health/live           — Liveness probe
 *   GET    /health/ready          — Readiness probe
 */

const express = require('express');
const crypto = require('crypto');
const { buildHealthReport, buildLivenessProbe, buildReadinessProbe } = require('./health');
const { MODEL_REGISTRY } = require('./models');
const { EmbeddingCache } = require('./cache');
const config = require('./config');

// ---------------------------------------------------------------------------
// Async job store (in-memory, with TTL cleanup)
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} jobId -> job state */
const jobStore = new Map();

function createJob(texts, options) {
  const jobId = crypto.randomUUID();
  const job = {
    jobId,
    status: 'pending',    // pending | processing | complete | failed
    texts,
    options,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    progress: { processed: 0, total: texts.length },
    result: null,
    error: null,
  };
  jobStore.set(jobId, job);
  return job;
}

// Cleanup expired jobs periodically
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobStore) {
    if (now - job.createdAt > config.jobTtlMs) {
      jobStore.delete(jobId);
    }
  }
}, 60000).unref();

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

function requireString(val, fieldName) {
  if (typeof val !== 'string' || val.trim().length === 0) {
    return `"${fieldName}" must be a non-empty string`;
  }
  return null;
}

function validateTexts(texts) {
  if (typeof texts === 'string') {
    if (texts.trim().length === 0) return '"texts" must be a non-empty string';
    return null;
  }
  if (Array.isArray(texts)) {
    if (texts.length === 0) return '"texts" array must not be empty';
    if (texts.some((t) => typeof t !== 'string' || t.trim().length === 0)) {
      return 'All items in "texts" must be non-empty strings';
    }
    return null;
  }
  return '"texts" must be a string or array of strings';
}

function normalizeTexts(texts) {
  if (typeof texts === 'string') return [texts];
  return texts;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

/**
 * Create and configure the Express router.
 *
 * @param {import('./index').HeadyEmbed} embedService
 * @returns {express.Router}
 */
function createRouter(embedService) {
  const router = express.Router();

  // -------------------------------------------------------------------------
  // POST /embed
  // -------------------------------------------------------------------------

  /**
   * @route POST /embed
   * @body { texts: string | string[], model?: string, pooling?: string,
   *          normalize?: boolean, useCache?: boolean }
   * @returns { embeddings: number[][], model: string, count: number,
   *             cached: number, latencyMs: number }
   */
  router.post('/embed', async (req, res) => {
    const { texts, model, pooling, normalize, useCache, priority } = req.body || {};

    const validationErr = validateTexts(texts);
    if (validationErr) {
      return res.status(400).json({ error: validationErr });
    }

    const textArr = normalizeTexts(texts);

    const t0 = Date.now();
    try {
      const embeddings = await embedService.embed(textArr, {
        modelId: model,
        poolingStrategy: pooling,
        normalize: normalize !== false,
        useCache: useCache !== false,
        priority: typeof priority === 'number' ? priority : 5,
      });

      return res.json({
        embeddings,
        model: model || config.model,
        count: embeddings.length,
        dimensions: embeddings[0] ? embeddings[0].length : config.dimensions,
        latencyMs: Date.now() - t0,
      });
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // POST /embed/batch (async large batch job)
  // -------------------------------------------------------------------------

  /**
   * @route POST /embed/batch
   * @body { texts: string[], model?: string, normalize?: boolean, priority?: number }
   * @returns { jobId: string, status: 'pending', total: number }
   */
  router.post('/embed/batch', (req, res) => {
    const { texts, model, normalize, priority } = req.body || {};

    const validationErr = validateTexts(texts);
    if (validationErr) {
      return res.status(400).json({ error: validationErr });
    }

    const textArr = normalizeTexts(texts);
    if (textArr.length < 1) {
      return res.status(400).json({ error: 'texts array is empty' });
    }

    const job = createJob(textArr, { model, normalize, priority });

    // Run async (detached from request)
    setImmediate(() => {
      job.status = 'processing';
      job.startedAt = Date.now();

      embedService
        .embed(textArr, {
          modelId: model,
          normalize: normalize !== false,
          priority: typeof priority === 'number' ? priority : 7, // batch = lower priority
          onProgress: (processed, total) => {
            job.progress = { processed, total };
          },
        })
        .then((embeddings) => {
          job.status = 'complete';
          job.completedAt = Date.now();
          job.result = {
            embeddings,
            count: embeddings.length,
            dimensions: embeddings[0] ? embeddings[0].length : config.dimensions,
            durationMs: job.completedAt - job.startedAt,
          };
          job.progress = { processed: textArr.length, total: textArr.length };
        })
        .catch((err) => {
          job.status = 'failed';
          job.completedAt = Date.now();
          job.error = err.message;
        });
    });

    return res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      total: textArr.length,
      message: `Batch job created. Poll GET /embed/batch/${job.jobId} for status.`,
    });
  });

  // -------------------------------------------------------------------------
  // GET /embed/batch/:jobId
  // -------------------------------------------------------------------------

  /**
   * @route GET /embed/batch/:jobId
   * @returns Job status + results when complete
   */
  router.get('/embed/batch/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      return res.status(404).json({ error: `Job "${jobId}" not found or expired` });
    }

    const response = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };

    if (job.status === 'complete') {
      response.result = job.result;
    } else if (job.status === 'failed') {
      response.error = job.error;
    }

    return res.json(response);
  });

  // -------------------------------------------------------------------------
  // POST /embed/similarity
  // -------------------------------------------------------------------------

  /**
   * @route POST /embed/similarity
   * @body { a: string | number[], b: string | number[], model?: string }
   * @returns { similarity: number, model: string, latencyMs: number }
   */
  router.post('/embed/similarity', async (req, res) => {
    const { a, b, model } = req.body || {};

    if (!a || !b) {
      return res.status(400).json({ error: '"a" and "b" are required' });
    }

    if (typeof a !== 'string' && !Array.isArray(a)) {
      return res.status(400).json({ error: '"a" must be a string or number array' });
    }
    if (typeof b !== 'string' && !Array.isArray(b)) {
      return res.status(400).json({ error: '"b" must be a string or number array' });
    }

    const t0 = Date.now();
    try {
      const similarity = await embedService.similarity(a, b, { modelId: model });
      return res.json({
        similarity,
        model: model || config.model,
        latencyMs: Date.now() - t0,
      });
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // GET /models
  // -------------------------------------------------------------------------

  /**
   * @route GET /models
   * @returns { models: ModelMeta[], defaultModel: string }
   */
  router.get('/models', (req, res) => {
    const models = embedService._modelManager.listModels();
    return res.json({
      models,
      defaultModel: config.model,
      total: models.length,
    });
  });

  // -------------------------------------------------------------------------
  // POST /models/load
  // -------------------------------------------------------------------------

  /**
   * @route POST /models/load
   * @body { modelId: string, setDefault?: boolean }
   * @returns { success: boolean, modelId: string, loadTimeMs: number }
   */
  router.post('/models/load', async (req, res) => {
    const { modelId, setDefault } = req.body || {};

    const err = requireString(modelId, 'modelId');
    if (err) return res.status(400).json({ error: err });

    const t0 = Date.now();
    try {
      await embedService.loadModel(modelId);

      if (setDefault) {
        await embedService.switchModel(modelId);
      }

      return res.json({
        success: true,
        modelId,
        isDefault: setDefault || modelId === config.model,
        loadTimeMs: Date.now() - t0,
      });
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // GET /metrics
  // -------------------------------------------------------------------------

  /**
   * @route GET /metrics
   * @returns Full metrics object from HeadyEmbed
   */
  router.get('/metrics', (req, res) => {
    return res.json(embedService.getMetrics());
  });

  // -------------------------------------------------------------------------
  // GET /health  (full report)
  // -------------------------------------------------------------------------

  /**
   * @route GET /health
   * @returns Structured health report
   */
  router.get('/health', (req, res) => {
    const report = buildHealthReport(embedService);
    const statusCode = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 200 : 503;
    return res.status(statusCode).json(report);
  });

  // -------------------------------------------------------------------------
  // GET /health/live  (Kubernetes liveness probe — fast)
  // -------------------------------------------------------------------------

  router.get('/health/live', (req, res) => {
    const probe = buildLivenessProbe(embedService);
    return res.status(200).json(probe);
  });

  // -------------------------------------------------------------------------
  // GET /health/ready  (Kubernetes readiness probe)
  // -------------------------------------------------------------------------

  router.get('/health/ready', (req, res) => {
    const probe = buildReadinessProbe(embedService);
    return res.status(probe.ready ? 200 : 503).json(probe);
  });

  // -------------------------------------------------------------------------
  // Error handler for this router
  // -------------------------------------------------------------------------

  router.use((err, req, res, next) => {
    console.error('[HeadyEmbed Router Error]', err);
    if (res.headersSent) return next(err);
    return res.status(422).json({ error: err.message || 'Internal error' });
  });

  return router;
}

module.exports = { createRouter, jobStore };

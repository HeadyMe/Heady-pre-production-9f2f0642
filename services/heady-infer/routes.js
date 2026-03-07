'use strict';

const express = require('express');
const { liveness, readiness, buildHttpResponse } = require('./health');

/**
 * HeadyInfer Express Router
 *
 * Mounts all inference, provider, cost, routing, and metric endpoints.
 * Call createRouter(gateway) to get an Express Router instance.
 *
 * @param {HeadyInfer} gateway  — initialized HeadyInfer instance
 * @returns {express.Router}
 */
function createRouter(gateway) {
  const router = express.Router();

  // ─── Middleware ────────────────────────────────────────────────────────────
  router.use(express.json({ limit: '10mb' }));

  function asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  function normalizeError(err) {
    const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    return {
      statusCode,
      body: {
        error:     err.message,
        code:      err.code  || 'INTERNAL_ERROR',
        provider:  err.provider,
        providers: err.providerErrors,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ─── POST /infer ──────────────────────────────────────────────────────────
  /**
   * Unified inference endpoint.
   * Body: { messages?, prompt?, model?, provider?, taskType?, temperature?, maxTokens?, noCache? }
   */
  router.post('/infer', asyncHandler(async (req, res) => {
    const response = await gateway.generate(req.body);
    res.json({
      success:  true,
      response,
    });
  }));

  // ─── POST /infer/stream ────────────────────────────────────────────────────
  /**
   * Streaming inference via SSE.
   * Body: same as /infer
   */
  router.post('/infer/stream', asyncHandler(async (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let finished = false;

    const sendEvent = (event, data) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    req.on('close', () => { finished = true; });

    try {
      const finalResponse = await gateway.stream(req.body, (chunk) => {
        if (finished) return;
        if (chunk.type === 'delta') {
          sendEvent('delta', { text: chunk.text, provider: chunk.provider });
        } else if (chunk.type === 'done') {
          // Will send full response below
        }
      });

      if (!finished) {
        sendEvent('complete', {
          provider:    finalResponse.provider,
          model:       finalResponse.model,
          finishReason: finalResponse.finishReason,
          usage:       finalResponse.usage,
          costUsd:     finalResponse.costUsd,
          latencyMs:   finalResponse.latencyMs,
        });
        res.write('event: close\ndata: {}\n\n');
        res.end();
      }
    } catch (err) {
      sendEvent('error', { message: err.message, code: err.code });
      res.end();
    }
  }));

  // ─── POST /infer/race ──────────────────────────────────────────────────────
  /**
   * Explicit provider racing — fires all specified providers simultaneously.
   * Body: { messages?, prompt?, providers?: string[], ...rest }
   */
  router.post('/infer/race', asyncHandler(async (req, res) => {
    const response = await gateway.raceGenerate(req.body);
    res.json({
      success:  true,
      response,
      raceAnalytics: gateway.racing.getAnalytics(),
    });
  }));

  // ─── GET /providers ────────────────────────────────────────────────────────
  /**
   * List all configured providers and their status.
   */
  router.get('/providers', asyncHandler(async (req, res) => {
    res.json({
      providers: gateway.getProviders(),
      timestamp: new Date().toISOString(),
    });
  }));

  // ─── GET /providers/:id/health ─────────────────────────────────────────────
  /**
   * Individual provider health check.
   */
  router.get('/providers/:id/health', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prov   = gateway._providers[id];

    if (!prov) {
      return res.status(404).json({
        error:     `Provider '${id}' not found`,
        available: Object.keys(gateway._providers),
      });
    }

    const start  = Date.now();
    let health;
    try {
      health = await prov.health();
    } catch (err) {
      health = { provider: id, status: 'unhealthy', error: err.message };
    }

    const circuit = gateway.circuitBreaker.getCircuit(id);
    const result  = {
      ...health,
      circuit:   circuit.getStats(),
      metrics:   prov.getMetrics(),
      latencyMs: Date.now() - start,
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(result);
  }));

  // ─── GET /providers/:id/models ─────────────────────────────────────────────
  router.get('/providers/:id/models', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prov   = gateway._providers[id];
    if (!prov) return res.status(404).json({ error: `Provider '${id}' not found` });

    const models = await prov.getModels();
    res.json({ provider: id, models });
  }));

  // ─── GET /costs ────────────────────────────────────────────────────────────
  /**
   * Cost tracking dashboard data.
   */
  router.get('/costs', (req, res) => {
    res.json(gateway.costTracker.getDashboard());
  });

  // ─── GET /costs/report ─────────────────────────────────────────────────────
  /**
   * Detailed cost report.
   * Query: ?days=30
   */
  router.get('/costs/report', (req, res) => {
    const days = parseInt(req.query.days, 10) || 30;
    res.json(gateway.costTracker.generateReport(days));
  });

  // ─── GET /routing ──────────────────────────────────────────────────────────
  /**
   * Current routing matrix and stats.
   */
  router.get('/routing', (req, res) => {
    res.json({
      matrix:    gateway.router.getMatrix(),
      stats:     gateway.router.getStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── PUT /routing ──────────────────────────────────────────────────────────
  /**
   * Update routing rules.
   * Body: { taskType: string, providers: string[] }
   */
  router.put('/routing', (req, res) => {
    const { taskType, providers } = req.body;

    if (!taskType || typeof taskType !== 'string') {
      return res.status(400).json({ error: 'taskType is required' });
    }
    if (!Array.isArray(providers) || providers.length === 0) {
      return res.status(400).json({ error: 'providers must be a non-empty array' });
    }

    try {
      gateway.router.setRoute(taskType, providers);
      res.json({
        success:  true,
        taskType,
        providers,
        matrix:   gateway.router.getMatrix(),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── GET /routing/affinity ─────────────────────────────────────────────────
  router.get('/routing/affinity', (req, res) => {
    res.json(gateway.router.getAffinityStats());
  });

  // ─── GET /metrics ──────────────────────────────────────────────────────────
  /**
   * Performance metrics.
   */
  router.get('/metrics', (req, res) => {
    res.json({
      gateway:   gateway.getMetrics(),
      cache:     gateway.cache.getStats(),
      circuits:  gateway.circuitBreaker.getAllStats(),
      racing:    gateway.racing.getAnalytics(),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /metrics/audit ────────────────────────────────────────────────────
  /**
   * Recent audit log.
   * Query: ?limit=100
   */
  router.get('/metrics/audit', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    res.json({
      entries:   gateway.getAuditLog(limit),
      timestamp: new Date().toISOString(),
    });
  });

  // ─── GET /cache/stats ──────────────────────────────────────────────────────
  router.get('/cache/stats', (req, res) => {
    res.json(gateway.cache.getStats());
  });

  router.get('/cache/inspect', (req, res) => {
    res.json(gateway.cache.inspect());
  });

  router.delete('/cache', (req, res) => {
    const cleared = gateway.cache.clear();
    res.json({ cleared, timestamp: new Date().toISOString() });
  });

  // ─── POST /circuits/:id/reset ──────────────────────────────────────────────
  /**
   * Manually reset a circuit breaker.
   */
  router.post('/circuits/:id/reset', (req, res) => {
    const { id } = req.params;
    gateway.circuitBreaker.reset(id);
    res.json({
      success:  true,
      provider: id,
      circuit:  gateway.circuitBreaker.getAllStats()[id],
    });
  });

  // ─── GET /health ───────────────────────────────────────────────────────────
  /**
   * Quick health check.
   * Query: ?detailed=true  for full provider ping
   */
  router.get('/health', asyncHandler(async (req, res) => {
    const detailed = req.query.detailed === 'true';

    if (detailed) {
      const report = await readiness(gateway);
      const { statusCode, body } = buildHttpResponse(report, true);
      return res.status(statusCode).json(body);
    }

    const report = liveness(gateway);
    const { statusCode, body } = buildHttpResponse(report, false);
    res.status(statusCode).json(body);
  }));

  // ─── Error Handler ─────────────────────────────────────────────────────────
  router.use((err, req, res, _next) => {
    const { statusCode, body } = normalizeError(err);
    // Clamp 5xx to 422 to satisfy proxy requirements
    const safeCode = statusCode >= 500 ? 422 : statusCode;
    res.status(safeCode).json(body);
  });

  return router;
}

module.exports = { createRouter };

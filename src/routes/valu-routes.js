/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  Tensor,
  TensorRegistry,
  MathService,
  BatchProcessor,
} = require('../compute/valu-tensor-core');

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function serializeTensor(t) {
  if (t instanceof Tensor) return { shape: t.shape, data: Array.from(t.data), dtype: 'float32' };
  return t;
}

function createValuRoutes(opts = {}) {
  const registry  = opts.registry  || new TensorRegistry();
  const service   = opts.service   || new MathService({ registry });
  const processor = opts.processor || new BatchProcessor({ service });
  const routes    = [];

  /**
   * POST /valu/execute
   * Execute a single math operation.
   * Body: { op: string, args: object, store?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/valu/execute',
    handler: async (req, res) => {
      const { op, args = {}, store } = req.body || {};
      if (!op) return respond(res, 400, { error: 'Missing op field' });
      const result = service.handleRequest({ op, args, store });
      const out    = result.ok
        ? { ...result, result: serializeTensor(result.result) }
        : result;
      return respond(res, result.ok ? 200 : 422, out);
    },
  });

  /**
   * POST /valu/batch
   * Execute a batch of operations.
   * Body: { operations: [{ op, args, store? }] }
   */
  routes.push({
    method: 'POST',
    path:   '/valu/batch',
    handler: async (req, res) => {
      const { operations } = req.body || {};
      if (!Array.isArray(operations)) return respond(res, 400, { error: 'Missing operations array' });
      const results = await processor.processBatch(operations);
      const serialized = results.map(r => r.ok ? { ...r, result: serializeTensor(r.result) } : r);
      return respond(res, 200, { ok: true, results: serialized, count: results.length });
    },
  });

  /**
   * POST /valu/tensor
   * Create and optionally store a tensor.
   * Body: { op: 'zeros'|'ones'|'eye'|'rand'|'randn'|'arange'|'from', args: object, name?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/valu/tensor',
    handler: async (req, res) => {
      const { op = 'zeros', args = {}, name } = req.body || {};
      const result = service.handleRequest({ op, args, store: name });
      if (!result.ok) return respond(res, 422, result);
      return respond(res, 201, { ok: true, name, tensor: result.result });
    },
  });

  /**
   * GET /valu/tensor/:name
   * Retrieve a named tensor from the registry.
   */
  routes.push({
    method: 'GET',
    path:   '/valu/tensor/:name',
    handler: async (req, res) => {
      const { name } = req.params || {};
      if (!name) return respond(res, 400, { error: 'Missing name' });
      try {
        const t = registry.get(name);
        return respond(res, 200, { ok: true, name, tensor: serializeTensor(t) });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * DELETE /valu/tensor/:name
   * Remove a named tensor from the registry.
   */
  routes.push({
    method: 'DELETE',
    path:   '/valu/tensor/:name',
    handler: async (req, res) => {
      const { name } = req.params || {};
      if (!name) return respond(res, 400, { error: 'Missing name' });
      registry.delete(name);
      return respond(res, 200, { ok: true, deleted: name });
    },
  });

  /**
   * GET /valu/tensors
   * List all registered tensors.
   */
  routes.push({
    method: 'GET',
    path:   '/valu/tensors',
    handler: async (req, res) => {
      return respond(res, 200, { ok: true, tensors: registry.list(), count: registry.size() });
    },
  });

  /**
   * POST /valu/ops/matmul
   * Matrix multiplication shortcut.
   * Body: { a: tensorRef, b: tensorRef, store?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/valu/ops/matmul',
    handler: async (req, res) => {
      const { a, b, store } = req.body || {};
      if (!a || !b) return respond(res, 400, { error: 'Missing a or b' });
      const result = service.handleRequest({ op: 'matmul', args: { a, b }, store });
      const out    = result.ok ? { ...result, result: serializeTensor(result.result) } : result;
      return respond(res, result.ok ? 200 : 422, out);
    },
  });

  /**
   * POST /valu/ops/cosine
   * Cosine similarity between two tensors.
   * Body: { a: tensorRef, b: tensorRef }
   */
  routes.push({
    method: 'POST',
    path:   '/valu/ops/cosine',
    handler: async (req, res) => {
      const { a, b } = req.body || {};
      if (!a || !b) return respond(res, 400, { error: 'Missing a or b' });
      const result = service.handleRequest({ op: 'cosine', args: { a, b } });
      return respond(res, result.ok ? 200 : 422, result);
    },
  });

  /**
   * GET /valu/log
   * Get the operation call log.
   */
  routes.push({
    method: 'GET',
    path:   '/valu/log',
    handler: async (req, res) => {
      const log = service.getCallLog();
      return respond(res, 200, { ok: true, log, count: log.length });
    },
  });

  return routes;
}

function attachValuRoutes(app, opts = {}) {
  const routes = createValuRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createValuRoutes, attachValuRoutes };

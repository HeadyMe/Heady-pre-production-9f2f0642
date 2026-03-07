'use strict';

/**
 * HeadyVector Express Router
 * All routes are mounted at the Express app level.
 * The router receives a fully-initialized HeadyVector instance.
 */

const { Router } = require('express');
const config = require('./config');

// ─── Error handling helper ────────────────────────────────────────────────────

/**
 * Wrap an async route handler to catch errors.
 * @param {Function} fn
 * @returns {Function}
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Send a standardized error response.
 * @param {object} res
 * @param {number} status
 * @param {string} message
 * @param {object} [details]
 */
function sendError(res, status, message, details) {
  const body = { error: message, status };
  if (details) body.details = details;
  return res.status(status).json(body);
}

/**
 * Validate that a request body field exists.
 * @param {object} body
 * @param {string[]} fields
 * @returns {string|null} first missing field, or null
 */
function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null) return f;
  }
  return null;
}

// ─── Router factory ───────────────────────────────────────────────────────────

/**
 * Create and return the Express router for HeadyVector.
 * @param {import('./index').HeadyVector} hv - initialized HeadyVector instance
 * @returns {Router}
 */
function createRouter(hv) {
  const router = Router();

  // ── Health ─────────────────────────────────────────────────────────────────

  /**
   * GET /health — Full health check
   */
  router.get('/health', asyncHandler(async (req, res) => {
    const health = await hv.healthCheck();
    const status = health.status === 'healthy' ? 200 : health.ready ? 200 : 503;
    return res.status(status).json(health);
  }));

  /**
   * GET /health/live — Kubernetes liveness probe
   */
  router.get('/health/live', asyncHandler(async (req, res) => {
    const alive = await hv.health.isAlive();
    return res.status(alive ? 200 : 503).json({ alive });
  }));

  /**
   * GET /health/ready — Kubernetes readiness probe
   */
  router.get('/health/ready', asyncHandler(async (req, res) => {
    const ready = await hv.health.isReady();
    return res.status(ready ? 200 : 503).json({ ready });
  }));

  // ── Metrics ────────────────────────────────────────────────────────────────

  /**
   * GET /metrics — Service metrics
   */
  router.get('/metrics', (req, res) => {
    const m = hv.getMetrics();
    return res.json({
      service: config.serviceName,
      version: config.version,
      ...m,
    });
  });

  // ── Collections ────────────────────────────────────────────────────────────

  /**
   * POST /collections — Create a collection
   * Body: { name, dimension?, description?, metadataSchema?, indexType?, distanceMetric?,
   *         hnswM?, hnswEfConstruction?, hnswEfSearch?, accessRoles? }
   */
  router.post('/collections', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['name']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const collection = await hv.createCollection(req.body);
    return res.status(201).json({ collection });
  }));

  /**
   * GET /collections — List all collections
   * Query: ?limit=100&offset=0
   */
  router.get('/collections', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = parseInt(req.query.offset, 10) || 0;
    const result = await hv.listCollections({ limit, offset });
    return res.json(result);
  }));

  /**
   * GET /collections/:name — Get a single collection
   */
  router.get('/collections/:name', asyncHandler(async (req, res) => {
    const collection = await hv.getCollection(req.params.name);
    if (!collection) return sendError(res, 404, `Collection "${req.params.name}" not found`);
    return res.json({ collection });
  }));

  /**
   * GET /collections/:name/stats — Collection statistics
   */
  router.get('/collections/:name/stats', asyncHandler(async (req, res) => {
    const stats = await hv.collectionStats(req.params.name);
    return res.json(stats);
  }));

  /**
   * PATCH /collections/:name — Update collection settings
   * Body: { description?, metadataSchema?, hnswEfSearch?, accessRoles? }
   */
  router.patch('/collections/:name', asyncHandler(async (req, res) => {
    const collection = await hv.collections.update(req.params.name, req.body);
    return res.json({ collection });
  }));

  /**
   * DELETE /collections/:name — Delete collection + all vectors
   */
  router.delete('/collections/:name', asyncHandler(async (req, res) => {
    const result = await hv.deleteCollection(req.params.name);
    return res.json(result);
  }));

  // ── Vectors ────────────────────────────────────────────────────────────────

  /**
   * POST /vectors/upsert — Upsert single or batch vectors
   * Body (single): { collection, vector, id?, namespace?, content?, metadata? }
   * Body (batch):  { collection, vectors: [{vector, id?, namespace?, content?, metadata?}],
   *                  namespace?, batchSize? }
   */
  router.post('/vectors/upsert', asyncHandler(async (req, res) => {
    const { collection, vectors, vector, id, namespace, content, metadata, batchSize } = req.body;

    const missing = requireFields(req.body, ['collection']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    if (vectors && Array.isArray(vectors)) {
      // Batch upsert
      if (vectors.length === 0) {
        return sendError(res, 400, 'vectors array must not be empty');
      }
      if (vectors.length > 10000) {
        return sendError(res, 400, 'vectors array exceeds maximum of 10000 per request');
      }

      const result = await hv.upsertBatch(collection, vectors, { batchSize, namespace });
      return res.json(result);
    } else if (vector !== undefined) {
      // Single upsert
      const record = await hv.upsert({
        collection,
        namespace: namespace || 'default',
        id,
        vector,
        content,
        metadata: metadata || {},
      });
      return res.status(201).json({ vector: record });
    } else {
      return sendError(res, 400, 'Request must include either "vector" (single) or "vectors" (batch)');
    }
  }));

  /**
   * GET /vectors/:id — Get vector by internal UUID
   */
  router.get('/vectors/:id', asyncHandler(async (req, res) => {
    const vector = await hv.getVector(req.params.id);
    if (!vector) return sendError(res, 404, `Vector "${req.params.id}" not found`);
    return res.json({ vector });
  }));

  /**
   * DELETE /vectors/:id — Delete vector by internal UUID
   */
  router.delete('/vectors/:id', asyncHandler(async (req, res) => {
    const result = await hv.deleteVector(req.params.id);
    if (!result.deleted) return sendError(res, 404, `Vector "${req.params.id}" not found`);
    return res.json(result);
  }));

  /**
   * POST /vectors/delete-by-filter — Delete vectors matching metadata filter
   * Body: { collection, filter, namespace? }
   */
  router.post('/vectors/delete-by-filter', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['collection', 'filter']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const { collection, filter, namespace } = req.body;
    const result = await hv.deleteByFilter(collection, filter, namespace);
    return res.json(result);
  }));

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * POST /vectors/search — Search vectors
   * Body: {
   *   collection,
   *   vector?,         // for semantic / hybrid
   *   query?,          // for bm25 / hybrid text
   *   type?,           // 'semantic' | 'bm25' | 'hybrid' (default: 'semantic')
   *   topK?,
   *   alpha?,          // hybrid: 0=bm25, 1=semantic
   *   namespace?,
   *   filter?,
   *   includeVector?,
   *   efSearch?,
   *   offset?,
   * }
   */
  router.post('/vectors/search', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['collection']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const {
      collection,
      vector,
      query,
      type = vector ? 'semantic' : 'bm25',
      topK,
      alpha,
      namespace,
      filter,
      includeVector,
      efSearch,
      offset,
      useRankCd,
    } = req.body;

    const topKNum = Math.min(parseInt(topK, 10) || config.search.defaultTopK, config.search.maxTopK);

    let result;
    switch (type) {
      case 'semantic': {
        if (!vector) return sendError(res, 400, 'Semantic search requires "vector"');
        result = await hv.semanticSearch({
          collection, vector, topK: topKNum, namespace, filter,
          includeVector, efSearch, offset: offset || 0,
        });
        break;
      }
      case 'bm25': {
        if (!query) return sendError(res, 400, 'BM25 search requires "query"');
        result = await hv.bm25Search({
          collection, query, topK: topKNum, namespace, filter,
          useRankCd, offset: offset || 0,
        });
        break;
      }
      case 'hybrid': {
        result = await hv.hybridSearch({
          collection, vector, query,
          alpha: alpha !== undefined ? parseFloat(alpha) : config.search.defaultAlpha,
          topK: topKNum, namespace, filter, includeVector,
          offset: offset || 0,
        });
        break;
      }
      default:
        return sendError(res, 400, `Unknown search type "${type}". Use: semantic, bm25, hybrid`);
    }

    return res.json(result);
  }));

  /**
   * POST /vectors/search/mmr — MMR diverse search
   * Body: { collection, vector, topK?, lambda?, namespace?, filter?, candidateMultiplier? }
   */
  router.post('/vectors/search/mmr', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['collection', 'vector']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const {
      collection, vector, topK, lambda, namespace, filter, candidateMultiplier,
    } = req.body;

    const result = await hv.mmrSearch({
      collection, vector,
      topK: Math.min(parseInt(topK, 10) || config.search.defaultTopK, config.search.maxTopK),
      lambda: lambda !== undefined ? parseFloat(lambda) : config.search.mmrLambda,
      namespace, filter, candidateMultiplier,
    });

    return res.json(result);
  }));

  // ── Graph ──────────────────────────────────────────────────────────────────

  /**
   * POST /graph/nodes — Add a graph node
   * Body: { label, nodeType?, content?, properties?, vector?, collectionId?, communityId? }
   */
  router.post('/graph/nodes', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['label']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const node = await hv.addNode(req.body);
    return res.status(201).json({ node });
  }));

  /**
   * GET /graph/nodes/:id — Get a graph node
   */
  router.get('/graph/nodes/:id', asyncHandler(async (req, res) => {
    const node = await hv.graph.getNode(req.params.id);
    if (!node) return sendError(res, 404, `Node "${req.params.id}" not found`);
    return res.json({ node });
  }));

  /**
   * DELETE /graph/nodes/:id — Delete a graph node
   */
  router.delete('/graph/nodes/:id', asyncHandler(async (req, res) => {
    const result = await hv.graph.deleteNode(req.params.id);
    if (!result.deleted) return sendError(res, 404, `Node "${req.params.id}" not found`);
    return res.json(result);
  }));

  /**
   * GET /graph/nodes/:id/edges — Get edges for a node
   * Query: ?direction=outgoing&edgeTypes=references,contains&minWeight=0.1
   */
  router.get('/graph/nodes/:id/edges', asyncHandler(async (req, res) => {
    const { direction, edgeTypes, minWeight } = req.query;
    const edges = await hv.graph.getEdges(req.params.id, {
      direction: direction || 'outgoing',
      edgeTypes: edgeTypes ? edgeTypes.split(',') : undefined,
      minWeight: minWeight ? parseFloat(minWeight) : 0,
    });
    return res.json({ edges, count: edges.length });
  }));

  /**
   * POST /graph/edges — Add a graph edge
   * Body: { sourceId, targetId, edgeType?, label?, weight?, properties?, bidirectional? }
   */
  router.post('/graph/edges', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['sourceId', 'targetId']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const edge = await hv.addEdge(req.body);
    return res.status(201).json({ edge });
  }));

  /**
   * POST /graph/traverse — BFS graph traversal
   * Body: { seedNodeIds, maxDepth?, maxNodes?, edgeTypes?, minWeight?, direction? }
   */
  router.post('/graph/traverse', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['seedNodeIds']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    if (!Array.isArray(req.body.seedNodeIds) || req.body.seedNodeIds.length === 0) {
      return sendError(res, 400, 'seedNodeIds must be a non-empty array');
    }

    const result = await hv.traverse(req.body);
    return res.json(result);
  }));

  /**
   * POST /graph/rag — Graph RAG retrieval
   * Body: { collection, vector?, query?, topK?, entityTopK?, maxDepth?,
   *         nodeTypes?, edgeTypes?, includePaths? }
   */
  router.post('/graph/rag', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['collection']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const { collection, vector, query } = req.body;
    if (!vector && !query) {
      return sendError(res, 400, 'Graph RAG requires either "vector" or "query"');
    }

    const result = await hv.graphRag(req.body);
    return res.json(result);
  }));

  /**
   * POST /graph/paths — Find paths between two nodes
   * Body: { sourceId, targetId, maxDepth?, maxPaths? }
   */
  router.post('/graph/paths', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['sourceId', 'targetId']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const result = await hv.graph.findPaths(req.body);
    return res.json(result);
  }));

  /**
   * POST /graph/community/detect — Run community detection
   * Body: { collectionId?, maxIterations? }
   */
  router.post('/graph/community/detect', asyncHandler(async (req, res) => {
    const result = await hv.graph.detectCommunities(req.body || {});
    return res.json(result);
  }));

  /**
   * POST /graph/pagerank — Compute PageRank for all nodes
   * Body: { collectionId?, dampingFactor?, iterations? }
   */
  router.post('/graph/pagerank', asyncHandler(async (req, res) => {
    const result = await hv.graph.computePageRank(req.body || {});
    return res.json(result);
  }));

  /**
   * GET /graph/visualize — Export graph for visualization
   * Query: ?collectionId=...&limit=500&nodeTypes=entity,concept&minEdgeWeight=0.1
   */
  router.get('/graph/visualize', asyncHandler(async (req, res) => {
    const { collectionId, limit, nodeTypes, minEdgeWeight } = req.query;
    const result = await hv.graph.exportVisualization({
      collectionId: collectionId || undefined,
      limit: limit ? parseInt(limit, 10) : 500,
      nodeTypes: nodeTypes ? nodeTypes.split(',') : undefined,
      minEdgeWeight: minEdgeWeight ? parseFloat(minEdgeWeight) : 0.1,
    });
    return res.json(result);
  }));

  // ── Indexes ────────────────────────────────────────────────────────────────

  /**
   * POST /indexes/rebuild — Rebuild indexes for a collection
   * Body: { collectionName }
   */
  router.post('/indexes/rebuild', asyncHandler(async (req, res) => {
    const missing = requireFields(req.body, ['collectionName']);
    if (missing) return sendError(res, 400, `Missing required field: ${missing}`);

    const collection = await hv.collections.require(req.body.collectionName);
    await hv.indexes.rebuildIndex(collection);
    return res.json({ rebuilt: true, collection: collection.name });
  }));

  /**
   * POST /indexes/optimize — VACUUM ANALYZE
   */
  router.post('/indexes/optimize', asyncHandler(async (req, res) => {
    await hv.indexes.optimize();
    return res.json({ optimized: true });
  }));

  /**
   * GET /indexes/health — Index health summary
   */
  router.get('/indexes/health', asyncHandler(async (req, res) => {
    const health = await hv.indexes.getHealthSummary();
    return res.json(health);
  }));

  // ── Migrations ─────────────────────────────────────────────────────────────

  /**
   * GET /migrations/status — Migration status
   */
  router.get('/migrations/status', asyncHandler(async (req, res) => {
    const status = await hv.migrations.getStatus();
    return res.json({ migrations: status });
  }));

  // ── 404 fallthrough ────────────────────────────────────────────────────────
  router.use((req, res) => {
    return sendError(res, 404, `Route ${req.method} ${req.path} not found`);
  });

  // ── Error middleware ───────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    const isUserError =
      err.message.includes('not found') ||
      err.message.includes('already exists') ||
      err.message.includes('required') ||
      err.message.includes('invalid') ||
      err.message.includes('mismatch');

    const statusCode = isUserError ? 400 : 500;
    console.error(`[heady-vector] ${req.method} ${req.path} error:`, err.message);

    return sendError(res, statusCode, err.message, {
      path: req.path,
      method: req.method,
      ...(config.nodeEnv === 'development' ? { stack: err.stack } : {}),
    });
  });

  return router;
}

module.exports = { createRouter };

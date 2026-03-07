/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  MemoryStore,
  Vec3,
  SpatialIndex,
  GraphRAG,
  ZoneManager,
  STMtoLTM,
  ImportanceScorer,
  fibonacciShard,
} = require('../memory/octree-spatial-index');

const PHI = 1.6180339887;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function parseVector(v) {
  if (Array.isArray(v)) return v.map(Number);
  if (v && typeof v === 'object') return Object.values(v).map(Number);
  throw new Error('vector must be an array or object of numbers');
}

function parseVec3(v) {
  if (Array.isArray(v)) return Vec3.fromArray(v);
  if (v && typeof v === 'object' && 'x' in v) return new Vec3(v.x, v.y, v.z);
  throw new Error('point must be [x,y,z] or {x,y,z}');
}

// ─── Route Factory ────────────────────────────────────────────────────────────

function createOctreeRoutes(opts = {}) {
  const store  = opts.store  || new MemoryStore(opts.storeOpts || {});
  const routes = [];

  /**
   * POST /octree/store
   * Store a memory vector with optional metadata.
   * Body: { id?: string, vector: number[], data?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/store',
    handler: async (req, res) => {
      const { id, vector, data } = req.body || {};
      if (!vector) return respond(res, 400, { error: 'Missing vector field' });
      let vec;
      try { vec = parseVector(vector); } catch (e) { return respond(res, 400, { error: e.message }); }
      const memId = id || require('crypto').randomUUID();
      try {
        store.store(memId, vec, data || {});
        const stats = store.getStats();
        return respond(res, 201, { ok: true, id: memId, stats, phi: PHI });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /octree/retrieve
   * Retrieve k-nearest memories to a query vector.
   * Body: { vector: number[], k?: number, maxRadius?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/retrieve',
    handler: async (req, res) => {
      const { vector, k = 10, maxRadius = 5 } = req.body || {};
      if (!vector) return respond(res, 400, { error: 'Missing vector field' });
      let vec;
      try { vec = parseVector(vector); } catch (e) { return respond(res, 400, { error: e.message }); }
      try {
        const results = store.retrieve(vec, Number(k), Number(maxRadius));
        return respond(res, 200, { ok: true, results, count: results.length, phi: PHI });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * DELETE /octree/memory/:id
   * Remove a memory by ID.
   */
  routes.push({
    method: 'DELETE',
    path:   '/octree/memory/:id',
    handler: async (req, res) => {
      const { id } = req.params || {};
      if (!id) return respond(res, 400, { error: 'Missing id' });
      store.remove(id);
      return respond(res, 200, { ok: true, removed: id });
    },
  });

  /**
   * POST /octree/link
   * Create a graph edge between two memories.
   * Body: { from: string, to: string, type?: string, weight?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/link',
    handler: async (req, res) => {
      const { from, to, type = 'related', weight = 1.0 } = req.body || {};
      if (!from || !to) return respond(res, 400, { error: 'Missing from or to fields' });
      try {
        store.link(from, to, type, Number(weight));
        return respond(res, 201, { ok: true, from, to, type, weight: Number(weight) });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /octree/consolidate
   * Manually trigger STM → LTM consolidation.
   */
  routes.push({
    method: 'POST',
    path:   '/octree/consolidate',
    handler: async (req, res) => {
      try {
        const promoted = store.consolidate();
        const stats    = store.getStats();
        return respond(res, 200, { ok: true, promoted: promoted || [], stats, phi: PHI });
      } catch (err) {
        return respond(res, 500, { error: err.message });
      }
    },
  });

  /**
   * GET /octree/stats
   * Get memory store statistics.
   */
  routes.push({
    method: 'GET',
    path:   '/octree/stats',
    handler: async (req, res) => {
      const stats = store.getStats();
      return respond(res, 200, { ok: true, stats, phi: PHI });
    },
  });

  /**
   * POST /octree/spatial/insert
   * Insert a point into the spatial index directly (bypasses MemoryStore STM/LTM).
   * Body: { id: string, vector: number[], data?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/spatial/insert',
    handler: async (req, res) => {
      const { id, vector, data } = req.body || {};
      if (!id || !vector) return respond(res, 400, { error: 'Missing id or vector' });
      let vec;
      try { vec = parseVector(vector); } catch (e) { return respond(res, 400, { error: e.message }); }
      const spatial = store.getSpatialIndex();
      try {
        spatial.insert(id, vec, data || {});
        return respond(res, 201, { ok: true, id });
      } catch (err) {
        return respond(res, 422, { error: err.message });
      }
    },
  });

  /**
   * POST /octree/spatial/query
   * Query the spatial index by radius around a 3D point.
   * Body: { center: [x,y,z]|{x,y,z}, radius: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/spatial/query',
    handler: async (req, res) => {
      const { center, radius = 1 } = req.body || {};
      if (!center) return respond(res, 400, { error: 'Missing center field' });
      let c;
      try { c = parseVec3(center); } catch (e) { return respond(res, 400, { error: e.message }); }
      const spatial = store.getSpatialIndex();
      const results = spatial.queryRadius(c.toArray(), Number(radius));
      return respond(res, 200, { ok: true, results, count: results.length, phi: PHI });
    },
  });

  /**
   * POST /octree/spatial/knn
   * Find k-nearest neighbors in the spatial index.
   * Body: { center: [x,y,z]|{x,y,z}, k?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/spatial/knn',
    handler: async (req, res) => {
      const { center, k = 5 } = req.body || {};
      if (!center) return respond(res, 400, { error: 'Missing center field' });
      let c;
      try { c = parseVec3(center); } catch (e) { return respond(res, 400, { error: e.message }); }
      const spatial = store.getSpatialIndex();
      const results = spatial.kNearest(c.toArray(), Number(k));
      return respond(res, 200, { ok: true, results, count: results.length });
    },
  });

  /**
   * POST /octree/graph/traverse
   * Traverse the knowledge graph from a starting node.
   * Body: { startId: string, maxDepth?: number, edgeTypes?: string[] }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/graph/traverse',
    handler: async (req, res) => {
      const { startId, maxDepth = 2, edgeTypes } = req.body || {};
      if (!startId) return respond(res, 400, { error: 'Missing startId field' });
      const graph = store.getGraphRAG();
      try {
        const nodes = graph.traverse(startId, Number(maxDepth), edgeTypes || null);
        return respond(res, 200, { ok: true, nodes, count: nodes.length });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * POST /octree/graph/context
   * Retrieve graph context for a set of node IDs.
   * Body: { nodeIds: string[], maxDepth?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/graph/context',
    handler: async (req, res) => {
      const { nodeIds, maxDepth = 1 } = req.body || {};
      if (!Array.isArray(nodeIds) || !nodeIds.length) {
        return respond(res, 400, { error: 'Missing nodeIds array' });
      }
      const graph   = store.getGraphRAG();
      const context = graph.retrieveContext(nodeIds, Number(maxDepth));
      return respond(res, 200, { ok: true, context });
    },
  });

  /**
   * GET /octree/zones
   * List all spatial memory zones.
   */
  routes.push({
    method: 'GET',
    path:   '/octree/zones',
    handler: async (req, res) => {
      const zones = store.getZoneManager().getAllZones();
      return respond(res, 200, {
        ok:    true,
        zones: zones.map(z => ({ id: z.id, label: z.label, centroid: z.centroid })),
        count: zones.length,
        phi:   PHI,
      });
    },
  });

  /**
   * POST /octree/zones/lookup
   * Find the zone for a given 3D point.
   * Body: { point: [x,y,z]|{x,y,z} }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/zones/lookup',
    handler: async (req, res) => {
      const { point } = req.body || {};
      if (!point) return respond(res, 400, { error: 'Missing point field' });
      let p;
      try { p = parseVec3(point); } catch (e) { return respond(res, 400, { error: e.message }); }
      const zone = store.getZoneManager().getZone(p);
      if (!zone) return respond(res, 404, { error: 'No zone found for this point' });
      return respond(res, 200, { ok: true, zone: { id: zone.id, label: zone.label } });
    },
  });

  /**
   * POST /octree/shard
   * Compute the Fibonacci shard for a 3D point.
   * Body: { point: [x,y,z]|{x,y,z}, numShards?: number }
   */
  routes.push({
    method: 'POST',
    path:   '/octree/shard',
    handler: async (req, res) => {
      const { point, numShards = 8 } = req.body || {};
      if (!point) return respond(res, 400, { error: 'Missing point field' });
      let p;
      try { p = parseVec3(point); } catch (e) { return respond(res, 400, { error: e.message }); }
      const shard = fibonacciShard(p, Number(numShards));
      return respond(res, 200, { ok: true, point: p.toArray(), shard, numShards: Number(numShards), phi: PHI });
    },
  });

  return routes;
}

function attachOctreeRoutes(app, opts = {}) {
  const routes = createOctreeRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createOctreeRoutes, attachOctreeRoutes };

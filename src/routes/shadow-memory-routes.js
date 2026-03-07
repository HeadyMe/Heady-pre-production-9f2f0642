/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Routes: Shadow Memory Persistence (HS-052)
 *
 * Express/Node.js compatible route handlers for the Exhale/Inhale protocol.
 * Mount with: app.use('/api/shadow-memory', require('./routes/shadow-memory-routes'));
 *
 * Endpoints:
 *   POST /exhale             — Persist state to vector DB
 *   POST /exhale/many        — Batch exhale multiple states
 *   POST /exhale/drain       — Pre-destruction drain
 *   POST /inhale             — Reconstitute state for a new node
 *   GET  /status             — System status
 *   GET  /projections        — List projection targets and sync status
 *   POST /projections        — Register a projection target
 *   DELETE /projections/:id  — Deregister a projection target
 *   POST /shards/rebalance   — Trigger Fibonacci shard rebalancing
 *   GET  /shards/summary     — Shard distribution summary
 */

'use strict';

const {
  ShadowMemorySystem,
  PROJECTION_TYPES,
  STORAGE_TIERS,
} = require('../memory/shadow-memory-persistence');

// Module-level singleton
let _system = null;

/**
 * Get or create the singleton ShadowMemorySystem.
 * @param {object} [opts]
 * @returns {ShadowMemorySystem}
 */
function getSystem(opts = {}) {
  if (!_system) _system = new ShadowMemorySystem(opts);
  return _system;
}

/**
 * Replace the singleton (for testing or reconfiguration).
 * @param {ShadowMemorySystem} instance
 */
function setSystem(instance) {
  _system = instance;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /exhale
 * Body: { stateId: string, stateObject: object, opts?: { force?, tier? } }
 */
function exhale(req, res) {
  try {
    const { stateId, stateObject, opts = {} } = req.body || {};
    if (!stateId)     return res.status(400).json({ error: 'stateId is required' });
    if (!stateObject) return res.status(400).json({ error: 'stateObject is required' });

    const sys    = getSystem();
    const result = sys.exhale(stateId, stateObject, opts);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /exhale/many
 * Body: { entries: Array<{ stateId, stateObject, opts? }> }
 */
function exhaleMany(req, res) {
  try {
    const { entries = [] } = req.body || {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

    const sys     = getSystem();
    const results = sys.exhaleModule.exhaleMany(entries);
    return res.json({ ok: true, count: results.length, results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /exhale/drain
 * Body: { nodeId: string, pendingState: Array<{ stateId, stateObject }> }
 */
function drainOnDestruction(req, res) {
  try {
    const { nodeId, pendingState = [] } = req.body || {};
    if (!nodeId) return res.status(400).json({ error: 'nodeId is required' });

    const sys    = getSystem();
    const result = sys.exhaleModule.drainOnDestruction(nodeId, pendingState);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /inhale
 * Body: { nodeId: string, taskDescription: string, opts?: { k?, tierFilter? } }
 */
function inhale(req, res) {
  try {
    const { nodeId, taskDescription, opts = {} } = req.body || {};
    if (!nodeId)          return res.status(400).json({ error: 'nodeId is required' });
    if (!taskDescription) return res.status(400).json({ error: 'taskDescription is required' });

    const sys    = getSystem();
    const result = sys.inhaleModule.inhale(nodeId, taskDescription, opts);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /status
 */
function status(req, res) {
  try {
    const sys = getSystem();
    return res.json({ ok: true, status: sys.status() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /projections
 */
function listProjections(req, res) {
  try {
    const sys     = getSystem();
    const targets = sys.projectionManager.listTargets();
    const inv     = sys.projectionManager.assertCanonicalInvariant();
    return res.json({ ok: true, targets, invariant: inv });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /projections
 * Body: { targetId: string, type: string, config?: object }
 */
function registerProjection(req, res) {
  try {
    const { targetId, type, config = {} } = req.body || {};
    if (!targetId) return res.status(400).json({ error: 'targetId is required' });
    if (!type)     return res.status(400).json({ error: 'type is required' });

    const sys    = getSystem();
    const result = sys.projectionManager.registerTarget(targetId, type, config);
    return res.status(201).json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /projections/:id
 */
function deregisterProjection(req, res) {
  try {
    const { id } = req.params;
    const sys     = getSystem();
    const removed = sys.projectionManager.deregisterTarget(id);
    return res.json({ ok: true, removed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /shards/rebalance
 */
function rebalanceShards(req, res) {
  try {
    const sys    = getSystem();
    const result = sys.shardManager.rebalance();
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /shards/summary
 */
function shardSummary(req, res) {
  try {
    const sys = getSystem();
    return res.json({ ok: true, summary: sys.shardManager.shardSummary() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Router Assembly ──────────────────────────────────────────────────────────

/**
 * Mount all Shadow Memory routes onto an Express router.
 * Usage: app.use('/api/shadow-memory', shadowMemoryRouter());
 *
 * @returns {object} Minimal Express-compatible router
 */
function shadowMemoryRouter() {
  // Minimal router for environments without Express loaded yet
  const routes = [
    { method: 'POST',   path: '/exhale',            handler: exhale },
    { method: 'POST',   path: '/exhale/many',        handler: exhaleMany },
    { method: 'POST',   path: '/exhale/drain',       handler: drainOnDestruction },
    { method: 'POST',   path: '/inhale',             handler: inhale },
    { method: 'GET',    path: '/status',             handler: status },
    { method: 'GET',    path: '/projections',        handler: listProjections },
    { method: 'POST',   path: '/projections',        handler: registerProjection },
    { method: 'DELETE', path: '/projections/:id',    handler: deregisterProjection },
    { method: 'POST',   path: '/shards/rebalance',   handler: rebalanceShards },
    { method: 'GET',    path: '/shards/summary',     handler: shardSummary },
  ];

  // Try to use Express router; fall back to a plain route-list export
  try {
    const express = require('express');
    const router  = express.Router();
    router.post  ('/exhale',            exhale);
    router.post  ('/exhale/many',       exhaleMany);
    router.post  ('/exhale/drain',      drainOnDestruction);
    router.post  ('/inhale',            inhale);
    router.get   ('/status',            status);
    router.get   ('/projections',       listProjections);
    router.post  ('/projections',       registerProjection);
    router.delete('/projections/:id',   deregisterProjection);
    router.post  ('/shards/rebalance',  rebalanceShards);
    router.get   ('/shards/summary',    shardSummary);
    return router;
  } catch {
    // Express not available — return route descriptor list
    return routes;
  }
}

module.exports = {
  shadowMemoryRouter,
  getSystem,
  setSystem,
  // Individual handlers exported for direct use / testing
  exhale,
  exhaleMany,
  drainOnDestruction,
  inhale,
  status,
  listProjections,
  registerProjection,
  deregisterProjection,
  rebalanceShards,
  shardSummary,
};

/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  StateManager,
  EdgeAgentRuntime,
  EdgeHealthProbe,
  DurableAgent,
  evaluateCslGate,
} = require('../edge/durable-edge-agent');

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

function createEdgeRoutes(opts = {}) {
  const runtime = opts.runtime || new EdgeAgentRuntime(opts.runtimeOpts || {});
  runtime.start();
  const routes  = [];

  /**
   * POST /edge/agent/create
   * Create or retrieve a durable agent.
   * Body: { agentId: string, cslGates?: Gate[] }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/create',
    handler: async (req, res) => {
      const { agentId, cslGates = [] } = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId, cslGates);
      if (!agent._initialized) await agent._initialize();
      return respond(res, 201, { ok: true, agentId: agent.getAgentId() });
    },
  });

  /**
   * GET /edge/agent/:agentId/state
   * Get current state of a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/state',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const sm     = agent.getStateManager();
      const state  = await sm.getAll(['agentId', 'status', 'beatCount', 'startedAt', 'lastBeat']);
      return respond(res, 200, { ok: true, state });
    },
  });

  /**
   * GET /edge/agent/:agentId/state/:key
   * Get a specific state key from a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/state/:key',
    handler: async (req, res) => {
      const { agentId, key } = req.params || {};
      if (!agentId || !key) return respond(res, 400, { error: 'Missing agentId or key' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const value = await agent.getStateManager().get(key);
      return respond(res, 200, { ok: true, key, value });
    },
  });

  /**
   * PUT /edge/agent/:agentId/state
   * Set state key(s) on a durable agent.
   * Body: { key: string, value: any } or { entries: { [key]: value } }
   */
  routes.push({
    method: 'PUT',
    path:   '/edge/agent/:agentId/state',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { key, value, entries } = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });

      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const sm    = agent.getStateManager();

      if (entries && typeof entries === 'object') {
        await sm.setAll(entries);
        return respond(res, 200, { ok: true, keys: Object.keys(entries) });
      } else if (key !== undefined && value !== undefined) {
        await sm.set(key, value);
        return respond(res, 200, { ok: true, key, value });
      }
      return respond(res, 400, { error: 'Provide key+value or entries' });
    },
  });

  /**
   * POST /edge/agent/:agentId/action
   * Dispatch an action to a durable agent.
   * Body: { action: string, payload: object }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/action',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { action, payload = {} } = req.body || {};
      if (!agentId || !action) return respond(res, 400, { error: 'Missing agentId or action' });

      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();

      const mockReq = {
        method: 'POST',
        url:    `http://edge/action`,
        json:   async () => ({ action, payload }),
      };
      const mockRes = await agent.fetch(mockReq);
      const body    = JSON.parse(await mockRes.text());
      return respond(res, mockRes.status || 200, body);
    },
  });

  /**
   * POST /edge/agent/:agentId/snapshot
   * Take a state snapshot.
   * Body: { label?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/snapshot',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      const { label }   = req.body || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent   = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const snpLabel = label || `snap-${Date.now()}`;
      const snap     = await agent.getStateManager().snapshot(snpLabel);
      return respond(res, 200, { ok: true, snapshot: snap });
    },
  });

  /**
   * POST /edge/agent/:agentId/migrate
   * Migrate agent state to a target edge location.
   * Body: { targetEdge: string }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/agent/:agentId/migrate',
    handler: async (req, res) => {
      const { agentId }    = req.params || {};
      const { targetEdge } = req.body || {};
      if (!agentId || !targetEdge) return respond(res, 400, { error: 'Missing agentId or targetEdge' });
      try {
        const result = await runtime.migrateAgent(agentId, targetEdge);
        return respond(res, 200, { ok: true, ...result });
      } catch (err) {
        return respond(res, 404, { error: err.message });
      }
    },
  });

  /**
   * GET /edge/agent/:agentId/health
   * Get health status of a durable agent.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agent/:agentId/health',
    handler: async (req, res) => {
      const { agentId } = req.params || {};
      if (!agentId) return respond(res, 400, { error: 'Missing agentId' });
      const agent = runtime.getOrCreate(agentId);
      if (!agent._initialized) await agent._initialize();
      const stats = agent.getProbe().getStats();
      return respond(res, 200, { ok: stats.healthy, ...stats });
    },
  });

  /**
   * GET /edge/agents
   * List all active agent IDs.
   */
  routes.push({
    method: 'GET',
    path:   '/edge/agents',
    handler: async (req, res) => {
      return respond(res, 200, {
        ok:         true,
        agents:     runtime.listAgentIds(),
        count:      runtime.getAgentCount(),
        edgeLabel:  runtime.getEdgeLabel(),
      });
    },
  });

  /**
   * POST /edge/csl/evaluate
   * Evaluate a CSL gate against a provided state.
   * Body: { gate: Gate, state: object }
   */
  routes.push({
    method: 'POST',
    path:   '/edge/csl/evaluate',
    handler: async (req, res) => {
      const { gate, state } = req.body || {};
      if (!gate || !state) return respond(res, 400, { error: 'Missing gate or state' });
      const result = evaluateCslGate(gate, state);
      return respond(res, 200, { ok: true, result, gate, state });
    },
  });

  return routes;
}

function attachEdgeRoutes(app, opts = {}) {
  const routes = createEdgeRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createEdgeRoutes, attachEdgeRoutes };

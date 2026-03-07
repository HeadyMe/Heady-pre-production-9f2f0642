/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Routes: Dynamic Bee Factory Enhanced (HS-060)
 *
 * Express/Node.js compatible route handlers for agent lifecycle management.
 * Mount with: app.use('/api/bees', require('./routes/bee-factory-routes'));
 *
 * Endpoints:
 *   POST   /agents                   — Create a new agent
 *   POST   /agents/template          — Create agent from template
 *   POST   /agents/ephemeral         — Spawn an ephemeral agent
 *   GET    /agents                   — List all registered agents
 *   DELETE /agents/:domain           — Dissolve an agent
 *   POST   /agents/:domain/inject    — Inject work into an agent
 *   POST   /swarms                   — Form a new swarm
 *   POST   /swarms/:swarmId/execute  — Execute a swarm
 *   GET    /swarms                   — List all swarms
 *   DELETE /swarms/:swarmId          — Dissolve a swarm
 *   GET    /status                   — Factory status
 */

'use strict';

const { DynamicBeeFactory } = require('../agents/dynamic-bee-factory-enhanced');

// Module-level singleton
let _factory = null;

/**
 * Get or create the singleton DynamicBeeFactory.
 * @returns {DynamicBeeFactory}
 */
function getFactory() {
  if (!_factory) _factory = new DynamicBeeFactory();
  return _factory;
}

/**
 * Replace the singleton (for testing or reconfiguration).
 * @param {DynamicBeeFactory} instance
 */
function setFactory(instance) {
  _factory = instance;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /agents
 * Body: { domain: string, description?: string, priority?: number, persist?: boolean }
 */
function createAgent(req, res) {
  try {
    const { domain, ...config } = req.body || {};
    if (!domain) return res.status(400).json({ error: 'domain is required' });

    const factory = getFactory();
    const entry   = factory.createAgent(domain, config);
    return res.status(201).json({ ok: true, agent: { domain: entry.domain, id: entry.id, priority: entry.priority, agentType: entry.agentType } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /agents/template
 * Body: { template: string, config: object }
 */
function createFromTemplate(req, res) {
  try {
    const { template, config = {} } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template is required' });

    const factory = getFactory();
    const entry   = factory.createFromTemplate(template, config);
    return res.status(201).json({ ok: true, agent: { domain: entry.domain, id: entry.id, agentType: entry.agentType } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * POST /agents/ephemeral
 * Body: { name: string, priority?: number }
 * Note: work functions cannot be serialised over HTTP — ephemeral bees created
 * via API receive a no-op placeholder work function.
 */
function spawnEphemeral(req, res) {
  try {
    const { name, priority = 0.8 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const factory = getFactory();
    const entry   = factory.spawnEphemeral(name, async () => ({ status: 'ready', source: 'api-spawn' }), priority);
    return res.status(201).json({ ok: true, agent: { domain: entry.domain, id: entry.id, ephemeral: true } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /agents
 */
function listAgents(req, res) {
  try {
    const factory = getFactory();
    const agents  = factory.listAgents();
    return res.json({ ok: true, count: agents.length, agents });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /agents/:domain
 * Query: ?deleteDisk=true|false
 */
function dissolveAgent(req, res) {
  try {
    const { domain } = req.params;
    const deleteDisk = req.query.deleteDisk !== 'false';

    const factory = getFactory();
    const result  = factory.dissolve(domain, { deleteDisk });
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /agents/:domain/inject
 * Body: { workName: string }
 * Note: The work function cannot be provided via API; a status placeholder is injected.
 */
function injectWork(req, res) {
  try {
    const { domain }   = req.params;
    const { workName } = req.body || {};
    if (!workName) return res.status(400).json({ error: 'workName is required' });

    const factory = getFactory();
    const result  = factory.injectWork(domain, workName, async () => ({ injectedViaApi: true, workName, ts: Date.now() }));
    return res.json({
      ok:      true,
      domain,
      injected: result.injected,
      created:  result.created,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /swarms
 * Body: { name: string, beeConfigs: Array<{domain, config?}>, policy: object }
 */
async function formSwarm(req, res) {
  try {
    const { name, beeConfigs = [], policy = {} } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const factory = getFactory();
    const result  = await factory.createSwarm(name, beeConfigs, policy);
    return res.status(201).json({ ok: true, swarm: result.swarm, execution: result.execution || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /swarms/:swarmId/execute
 * Body: { ctx?: object }
 */
async function executeSwarm(req, res) {
  try {
    const { swarmId } = req.params;
    const { ctx = {} } = req.body || {};

    const factory   = getFactory();
    const execution = await factory.swarmCoordinator.executeSwarm(swarmId, ctx);
    return res.json({ ok: true, execution });
  } catch (err) {
    return res.status(404).json({ ok: false, error: err.message });
  }
}

/**
 * GET /swarms
 */
function listSwarms(req, res) {
  try {
    const factory = getFactory();
    const swarms  = factory.swarmCoordinator.listSwarms();
    return res.json({ ok: true, count: swarms.length, swarms });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /swarms/:swarmId
 */
function dissolveSwarm(req, res) {
  try {
    const { swarmId } = req.params;
    const factory = getFactory();
    const removed = factory.swarmCoordinator.dissolveSwarm(swarmId);
    return res.json({ ok: true, removed });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /status
 */
function status(req, res) {
  try {
    const factory = getFactory();
    return res.json({ ok: true, status: factory.status() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Router Assembly ──────────────────────────────────────────────────────────

function beeFactoryRouter() {
  try {
    const express = require('express');
    const router  = express.Router();
    router.post  ('/agents',                  createAgent);
    router.post  ('/agents/template',         createFromTemplate);
    router.post  ('/agents/ephemeral',        spawnEphemeral);
    router.get   ('/agents',                  listAgents);
    router.delete('/agents/:domain',          dissolveAgent);
    router.post  ('/agents/:domain/inject',   injectWork);
    router.post  ('/swarms',                  formSwarm);
    router.post  ('/swarms/:swarmId/execute', executeSwarm);
    router.get   ('/swarms',                  listSwarms);
    router.delete('/swarms/:swarmId',         dissolveSwarm);
    router.get   ('/status',                  status);
    return router;
  } catch {
    return [
      { method: 'POST',   path: '/agents',                  handler: createAgent },
      { method: 'POST',   path: '/agents/template',         handler: createFromTemplate },
      { method: 'POST',   path: '/agents/ephemeral',        handler: spawnEphemeral },
      { method: 'GET',    path: '/agents',                  handler: listAgents },
      { method: 'DELETE', path: '/agents/:domain',          handler: dissolveAgent },
      { method: 'POST',   path: '/agents/:domain/inject',   handler: injectWork },
      { method: 'POST',   path: '/swarms',                  handler: formSwarm },
      { method: 'POST',   path: '/swarms/:swarmId/execute', handler: executeSwarm },
      { method: 'GET',    path: '/swarms',                  handler: listSwarms },
      { method: 'DELETE', path: '/swarms/:swarmId',         handler: dissolveSwarm },
      { method: 'GET',    path: '/status',                  handler: status },
    ];
  }
}

module.exports = {
  beeFactoryRouter,
  getFactory,
  setFactory,
  createAgent,
  createFromTemplate,
  spawnEphemeral,
  listAgents,
  dissolveAgent,
  injectWork,
  formSwarm,
  executeSwarm,
  listSwarms,
  dissolveSwarm,
  status,
};

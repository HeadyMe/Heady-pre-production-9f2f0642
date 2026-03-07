/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Routes: Monte Carlo Engine
 *
 * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
 *
 * Express/Node.js compatible route handlers for Monte Carlo simulation.
 * Mount with: app.use('/api/monte-carlo', require('./routes/monte-carlo-routes'));
 *
 * Endpoints:
 *   POST /simulate              — Run a full Monte Carlo simulation
 *   POST /simulate/batch        — Run multiple scenarios (scenario analysis)
 *   POST /readiness             — Quick readiness score from operational signals
 *   POST /score-risk            — Deterministic risk score (no simulation)
 *   GET  /history               — Simulation history
 *   DELETE /history             — Clear history
 *   GET  /status                — Engine status
 */

'use strict';

const { MonteCarloEngine, RISK_GRADE } = require('../intelligence/monte-carlo-engine');

// Module-level singleton
let _engine = null;

/**
 * Get or create the singleton MonteCarloEngine.
 * @param {object} [opts]
 * @returns {MonteCarloEngine}
 */
function getEngine(opts = {}) {
  if (!_engine) _engine = new MonteCarloEngine(opts);
  return _engine;
}

/**
 * Replace the singleton (for testing or reconfiguration).
 * @param {MonteCarloEngine} instance
 */
function setEngine(instance) {
  _engine = instance;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /simulate
 * Body: {
 *   name?: string,
 *   seed?: number,
 *   riskFactors?: Array<{ name, probability, impact, distribution?, distributionParams?, mitigation?, mitigationReduction? }>,
 *   pipelineStage?: string,
 *   iterations?: number
 * }
 */
function simulate(req, res) {
  try {
    const { iterations, ...params } = req.body || {};
    const engine = getEngine();
    const result = engine.runSimulation(params, iterations);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /simulate/batch
 * Body: {
 *   scenarios: Array<{ name, params, iterations? }>
 * }
 */
function simulateBatch(req, res) {
  try {
    const { scenarios = [] } = req.body || {};
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({ error: 'scenarios must be a non-empty array' });
    }

    const engine = getEngine();
    const result = engine.analyseScenarios(scenarios);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /readiness
 * Body: {
 *   errorRate?: number,
 *   lastDeploySuccess?: boolean,
 *   cpuPressure?: number,
 *   memoryPressure?: number,
 *   serviceHealthRatio?: number,
 *   openIncidents?: number
 * }
 */
function quickReadiness(req, res) {
  try {
    const signals = req.body || {};
    const engine  = getEngine();
    const result  = engine.quickReadiness(signals);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /score-risk
 * Body: { riskFactors: Array<{ probability, impact, mitigation? }> }
 */
function scoreRisk(req, res) {
  try {
    const { riskFactors = [] } = req.body || {};
    const engine = getEngine();
    const result = engine.scoreRisk(riskFactors);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /history
 * Query: ?limit=20
 */
function getHistory(req, res) {
  try {
    const limit  = parseInt(req.query && req.query.limit, 10) || 20;
    const engine = getEngine();
    const hist   = engine.getHistory(limit);
    return res.json({ ok: true, count: hist.length, history: hist });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * DELETE /history
 */
function clearHistory(req, res) {
  try {
    const engine = getEngine();
    engine.clearHistory();
    return res.json({ ok: true, cleared: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /status
 */
function status(req, res) {
  try {
    const engine = getEngine();
    return res.json({ ok: true, status: engine.status() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─── Router Assembly ──────────────────────────────────────────────────────────

function monteCarloRouter() {
  try {
    const express = require('express');
    const router  = express.Router();
    router.post  ('/simulate',        simulate);
    router.post  ('/simulate/batch',  simulateBatch);
    router.post  ('/readiness',       quickReadiness);
    router.post  ('/score-risk',      scoreRisk);
    router.get   ('/history',         getHistory);
    router.delete('/history',         clearHistory);
    router.get   ('/status',          status);
    return router;
  } catch {
    return [
      { method: 'POST',   path: '/simulate',       handler: simulate },
      { method: 'POST',   path: '/simulate/batch',  handler: simulateBatch },
      { method: 'POST',   path: '/readiness',       handler: quickReadiness },
      { method: 'POST',   path: '/score-risk',      handler: scoreRisk },
      { method: 'GET',    path: '/history',          handler: getHistory },
      { method: 'DELETE', path: '/history',          handler: clearHistory },
      { method: 'GET',    path: '/status',           handler: status },
    ];
  }
}

module.exports = {
  monteCarloRouter,
  getEngine,
  setEngine,
  simulate,
  simulateBatch,
  quickReadiness,
  scoreRisk,
  getHistory,
  clearHistory,
  status,
};

'use strict';

/**
 * ComputeDashboard — Compute resource usage dashboard.
 * Aggregates metrics from system monitor, LLM router, and agent orchestrator.
 */

const EventEmitter = require('events');

class ComputeDashboard extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._orchestrator = opts.orchestrator || null;
    this._refreshIntervalMs = opts.refreshIntervalMs || 10000;
    this._timer = null;
    this._cachedDashboard = null;
    this._cacheTs = 0;
    this._cacheTTL = opts.cacheTTL || 5000;
  }

  setOrchestrator(orchestrator) {
    this._orchestrator = orchestrator;
  }

  // ─── Data aggregation ──────────────────────────────────────────────────────

  async _getSystemMetrics() {
    try {
      const { getSystemMonitor } = require('./system-monitor');
      return getSystemMonitor().getSummary();
    } catch { return null; }
  }

  async _getLLMMetrics() {
    try {
      const { getLLMRouter } = require('./services/llm-router');
      const router = getLLMRouter();
      const health = await router.health();
      const budget = health.budget;
      return {
        providers: Object.entries(health.providers || {}).map(([id, p]) => ({
          id,
          vendor: p.vendor,
          ok: p.ok,
          overBudget: p.overBudget,
          nearBudget: p.nearBudget,
          degraded: p.degraded,
        })),
        budget: budget ? {
          monthlyTotal: budget.monthly?.total,
          monthlyCap: budget.monthly?.cap,
          percentUsed: budget.monthly?.percentUsed,
          nearBudget: budget.monthly?.nearBudget,
        } : null,
      };
    } catch { return null; }
  }

  async _getOrchestratorMetrics() {
    if (!this._orchestrator) return null;
    try {
      if (typeof this._orchestrator.getStats === 'function') {
        return await this._orchestrator.getStats();
      }
      return null;
    } catch { return null; }
  }

  async _getSchedulerMetrics() {
    try {
      const { getScheduler } = require('./services/autonomous-scheduler');
      const scheduler = getScheduler();
      const tasks = scheduler.getScheduled();
      const byStatus = {};
      for (const t of tasks) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      return { total: tasks.length, byStatus };
    } catch { return null; }
  }

  async _getPipelineMetrics() {
    try {
      // Pipeline metrics from in-memory store (accessed via require)
      return { active: 'N/A' };
    } catch { return null; }
  }

  async _getBudgetMetrics() {
    try {
      const { getBudgetTracker } = require('./services/budget-tracker');
      return getBudgetTracker().getBudgetStatus();
    } catch { return null; }
  }

  // ─── Dashboard assembly ────────────────────────────────────────────────────

  async getDashboard(opts = {}) {
    const now = Date.now();
    if (!opts.force && this._cachedDashboard && now - this._cacheTs < this._cacheTTL) {
      return this._cachedDashboard;
    }

    const [system, llm, orchestrator, scheduler, budget] = await Promise.all([
      this._getSystemMetrics(),
      this._getLLMMetrics(),
      this._getOrchestratorMetrics(),
      this._getSchedulerMetrics(),
      this._getBudgetMetrics(),
    ]);

    const dashboard = {
      ts: new Date().toISOString(),
      system,
      llm,
      orchestrator,
      scheduler,
      budget,
      overall: this._computeOverallHealth({ system, llm, orchestrator }),
    };

    this._cachedDashboard = dashboard;
    this._cacheTs = now;
    this.emit('refreshed', { ts: dashboard.ts });
    return dashboard;
  }

  _computeOverallHealth({ system, llm }) {
    const issues = [];
    if (system?.health === 'critical') issues.push('system-critical');
    if (system?.health === 'degraded') issues.push('system-degraded');
    if (llm?.budget?.nearBudget) issues.push('budget-near-limit');
    const criticalProviders = (llm?.providers || []).filter(p => p.overBudget);
    if (criticalProviders.length > 0) issues.push(`providers-over-budget: ${criticalProviders.map(p => p.id).join(',')}`);

    return {
      status: issues.length === 0 ? 'healthy' : issues.some(i => i.includes('critical')) ? 'critical' : 'degraded',
      issues,
    };
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(async () => {
      try { await this.getDashboard({ force: true }); } catch {}
    }, this._refreshIntervalMs);
    if (this._timer.unref) this._timer.unref();
    this.emit('started');
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.emit('stopped');
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app, orchestrator) {
    if (orchestrator) this.setOrchestrator(orchestrator);

    /** GET /api/compute/dashboard */
    app.get('/api/compute/dashboard', async (req, res) => {
      try {
        const force = req.query.force === 'true';
        const dashboard = await this.getDashboard({ force });
        res.json({ ok: true, ...dashboard });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/compute/system */
    app.get('/api/compute/system', async (req, res) => {
      try {
        const system = await this._getSystemMetrics();
        res.json({ ok: true, system });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/compute/llm */
    app.get('/api/compute/llm', async (req, res) => {
      try {
        const llm = await this._getLLMMetrics();
        res.json({ ok: true, llm });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/compute/budget */
    app.get('/api/compute/budget', async (req, res) => {
      try {
        const budget = await this._getBudgetMetrics();
        res.json({ ok: true, budget });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/compute/scheduler */
    app.get('/api/compute/scheduler', async (req, res) => {
      try {
        const scheduler = await this._getSchedulerMetrics();
        res.json({ ok: true, scheduler });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/compute/orchestrator */
    app.get('/api/compute/orchestrator', async (req, res) => {
      try {
        const orch = await this._getOrchestratorMetrics();
        res.json({ ok: true, orchestrator: orch });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    return app;
  }
}

let _instance = null;
function getComputeDashboard(opts) {
  if (!_instance) _instance = new ComputeDashboard(opts);
  return _instance;
}

module.exports = { ComputeDashboard, getComputeDashboard };

'use strict';

/**
 * SelfOptimizer — Self-optimization engine for HeadyStack.
 * Analyzes performance metrics, LLM routing patterns, and budget data
 * to automatically tune the system and recommend/apply optimizations.
 */

const EventEmitter = require('events');

const OPTIMIZATION_TYPES = {
  ROUTING_MATRIX: 'routing_matrix',
  BUDGET_CAP: 'budget_cap',
  CACHE_TUNING: 'cache_tuning',
  EMBEDDING_MODEL: 'embedding_model',
  TEMPERATURE: 'temperature',
  BATCH_SIZE: 'batch_size',
  CONCURRENCY: 'concurrency',
};

const OPT_STATUS = {
  PROPOSED: 'proposed',
  APPLIED: 'applied',
  REJECTED: 'rejected',
  ROLLED_BACK: 'rolled_back',
};

class SelfOptimizer extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._vectorMemory = opts.vectorMemory || null;
    this._autoApply = opts.autoApply || false;
    this._optimizations = [];
    this._appliedOptimizations = new Map();
    this._stats = { analyzed: 0, proposed: 0, applied: 0, rejected: 0 };
    this._optimizationIntervalMs = opts.optimizationIntervalMs || 5 * 60 * 1000;
    this._running = false;
    this._timer = null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this._runOptimizationCycle(), this._optimizationIntervalMs);
    if (this._timer.unref) this._timer.unref();
    this.emit('started');
  }

  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.emit('stopped');
  }

  // ─── Analysis ──────────────────────────────────────────────────────────────

  async _runOptimizationCycle() {
    this._stats.analyzed++;
    const proposals = [];

    try {
      // Gather data
      const budgetData = this._getBudgetData();
      const monitorData = this._getMonitorData();
      const routerData = this._getRouterData();

      // Run analyzers
      proposals.push(...this._analyzeBudget(budgetData));
      proposals.push(...this._analyzePerformance(monitorData));
      proposals.push(...this._analyzeRouting(routerData));

      for (const proposal of proposals) {
        this._stats.proposed++;
        this._optimizations.push({ ...proposal, status: OPT_STATUS.PROPOSED, proposedAt: new Date().toISOString() });
        this.emit('optimization-proposed', proposal);

        if (this._autoApply && proposal.safe) {
          await this.applyOptimization(proposal.id);
        }
      }

      if (proposals.length > 0) {
        this.emit('cycle-complete', { proposals: proposals.length, applied: this._stats.applied });
      }
    } catch (err) {
      this.emit('cycle-error', { error: err.message });
    }
  }

  _getBudgetData() {
    try {
      const { getBudgetTracker } = require('./services/budget-tracker');
      const tracker = getBudgetTracker();
      return tracker.getBudgetStatus();
    } catch { return null; }
  }

  _getMonitorData() {
    try {
      const { getSystemMonitor } = require('./system-monitor');
      const monitor = getSystemMonitor();
      return monitor.getSummary();
    } catch { return null; }
  }

  _getRouterData() {
    try {
      const { getLLMRouter } = require('./services/llm-router');
      const router = getLLMRouter();
      return { routingMatrix: router.routingMatrix, providers: Object.keys(router.providers) };
    } catch { return null; }
  }

  // ─── Analyzers ─────────────────────────────────────────────────────────────

  _analyzeBudget(budgetData) {
    const proposals = [];
    if (!budgetData) return proposals;

    for (const [provider, data] of Object.entries(budgetData.providers || {})) {
      // If a provider is consistently near budget, propose a cap increase
      if (data.overBudget) {
        proposals.push({
          id: `budget-${provider}-${Date.now()}`,
          type: OPTIMIZATION_TYPES.BUDGET_CAP,
          target: provider,
          description: `${provider} has exceeded daily budget (${data.usage.cost.toFixed(3)} / ${data.cap} USD). Consider increasing cap or switching routing.`,
          action: 'increase_cap',
          currentValue: data.cap,
          suggestedValue: data.cap * 1.25,
          safe: false, // budget changes require manual approval
          priority: 'high',
        });
      }
    }

    // Monthly budget near limit
    if (budgetData.monthly?.percentUsed > 85) {
      proposals.push({
        id: `monthly-budget-${Date.now()}`,
        type: OPTIMIZATION_TYPES.BUDGET_CAP,
        target: 'monthly',
        description: `Monthly spend at ${budgetData.monthly.percentUsed}% of cap. Auto-downgrade to cheaper models.`,
        action: 'downgrade_routing',
        safe: true,
        priority: 'high',
      });
    }

    return proposals;
  }

  _analyzePerformance(monitorData) {
    const proposals = [];
    if (!monitorData) return proposals;

    if (monitorData.memory?.heapUsagePct > 85) {
      proposals.push({
        id: `memory-${Date.now()}`,
        type: OPTIMIZATION_TYPES.CACHE_TUNING,
        target: 'heap',
        description: `Heap usage at ${monitorData.memory.heapUsagePct}%. Recommend reducing cache sizes.`,
        action: 'reduce_cache',
        safe: true,
        priority: 'medium',
      });
    }

    if (monitorData.eventLoopLagMs > 200) {
      proposals.push({
        id: `eventloop-${Date.now()}`,
        type: OPTIMIZATION_TYPES.CONCURRENCY,
        target: 'event_loop',
        description: `Event loop lag at ${monitorData.eventLoopLagMs}ms. Recommend reducing concurrency.`,
        action: 'reduce_concurrency',
        safe: true,
        priority: 'high',
      });
    }

    return proposals;
  }

  _analyzeRouting(routerData) {
    const proposals = [];
    if (!routerData) return proposals;
    // Future: analyze per-provider latency/error rates from budget tracker
    // and propose routing matrix adjustments
    return proposals;
  }

  // ─── Apply optimizations ───────────────────────────────────────────────────

  async applyOptimization(id) {
    const opt = this._optimizations.find(o => o.id === id);
    if (!opt) throw new Error(`Optimization not found: ${id}`);
    if (opt.status === OPT_STATUS.APPLIED) return opt;

    try {
      await this._doApply(opt);
      opt.status = OPT_STATUS.APPLIED;
      opt.appliedAt = new Date().toISOString();
      this._appliedOptimizations.set(id, opt);
      this._stats.applied++;
      this.emit('optimization-applied', opt);
    } catch (err) {
      opt.status = OPT_STATUS.REJECTED;
      opt.error = err.message;
      this._stats.rejected++;
      this.emit('optimization-failed', { id, error: err.message });
    }
    return opt;
  }

  async _doApply(opt) {
    switch (opt.action) {
      case 'downgrade_routing': {
        const { getLLMRouter } = require('./services/llm-router');
        const router = getLLMRouter();
        // Shift to cheaper models for quick_tasks
        router.routingMatrix['quick_tasks'] = ['groq-llama', 'gpt-4o-mini', 'gemini-flash'];
        break;
      }
      case 'reduce_cache': {
        if (global.gc) global.gc();
        break;
      }
      default:
        // Other actions require external implementation
        this.emit('optimization-action', opt);
    }
  }

  rejectOptimization(id, reason = '') {
    const opt = this._optimizations.find(o => o.id === id);
    if (opt) {
      opt.status = OPT_STATUS.REJECTED;
      opt.rejectedAt = new Date().toISOString();
      opt.rejectReason = reason;
      this._stats.rejected++;
      this.emit('optimization-rejected', { id, reason });
    }
  }

  listOptimizations(status = null) {
    let opts = this._optimizations;
    if (status) opts = opts.filter(o => o.status === status);
    return opts.slice(-200).reverse();
  }

  getStats() {
    return { ...this._stats, pending: this._optimizations.filter(o => o.status === OPT_STATUS.PROPOSED).length };
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app, vectorMemory) {
    if (vectorMemory) this._vectorMemory = vectorMemory;

    /** GET /api/optimizer/optimizations */
    app.get('/api/optimizer/optimizations', (req, res) => {
      const { status } = req.query;
      res.json({ ok: true, optimizations: this.listOptimizations(status), stats: this.getStats() });
    });

    /** POST /api/optimizer/run — trigger a manual optimization cycle */
    app.post('/api/optimizer/run', async (req, res) => {
      try {
        await this._runOptimizationCycle();
        res.json({ ok: true, stats: this.getStats() });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/optimizer/:id/apply */
    app.post('/api/optimizer/:id/apply', async (req, res) => {
      try {
        const result = await this.applyOptimization(req.params.id);
        res.json({ ok: true, optimization: result });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** POST /api/optimizer/:id/reject */
    app.post('/api/optimizer/:id/reject', (req, res) => {
      const { reason } = req.body || {};
      this.rejectOptimization(req.params.id, reason);
      res.json({ ok: true, id: req.params.id });
    });

    /** GET /api/optimizer/stats */
    app.get('/api/optimizer/stats', (req, res) => {
      res.json({ ok: true, stats: this.getStats() });
    });

    /** POST /api/optimizer/start */
    app.post('/api/optimizer/start', (req, res) => {
      this.start();
      res.json({ ok: true, running: this._running });
    });

    /** POST /api/optimizer/stop */
    app.post('/api/optimizer/stop', (req, res) => {
      this.stop();
      res.json({ ok: true, running: this._running });
    });

    return app;
  }
}

let _instance = null;
function getSelfOptimizer(opts) {
  if (!_instance) _instance = new SelfOptimizer(opts);
  return _instance;
}

module.exports = { SelfOptimizer, getSelfOptimizer, OPTIMIZATION_TYPES, OPT_STATUS };

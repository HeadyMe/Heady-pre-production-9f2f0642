'use strict';

/**
 * SystemMonitor — Continuous system health monitoring with alerting.
 * Tracks CPU, memory, event loop lag, error rates, and service health.
 */

const EventEmitter = require('events');
const os = require('os');

const ALERT_LEVELS = {
  OK: 'ok',
  WARN: 'warn',
  CRITICAL: 'critical',
};

const THRESHOLDS = {
  memoryUsagePercent: { warn: 80, critical: 95 },
  heapUsagePercent: { warn: 75, critical: 90 },
  cpuUsagePercent: { warn: 80, critical: 95 },
  eventLoopLagMs: { warn: 100, critical: 500 },
  errorRatePerMin: { warn: 10, critical: 50 },
};

class SystemMonitor extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._thresholds = Object.assign({}, THRESHOLDS, opts.thresholds || {});
    this._sampleIntervalMs = opts.sampleIntervalMs || 5000;
    this._retentionSamples = opts.retentionSamples || 360;  // 30 min at 5s interval
    this._samples = [];
    this._timers = {};
    this._running = false;
    this._alerts = [];
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = Date.now();
    this._errorCounts = [];
  }

  // ─── Monitoring loops ──────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;

    this._timers.sample = setInterval(() => this._collectSample(), this._sampleIntervalMs);
    this._timers.eventLoop = this._measureEventLoopLag();

    for (const t of Object.values(this._timers)) { if (t && t.unref) t.unref(); }

    this.emit('started');
    // Collect first sample immediately
    this._collectSample();
  }

  stop() {
    this._running = false;
    for (const [k, t] of Object.entries(this._timers)) {
      clearInterval(t);
      clearTimeout(t);
      delete this._timers[k];
    }
    this.emit('stopped');
  }

  _measureEventLoopLag() {
    let lag = 0;
    const measure = () => {
      const start = Date.now();
      setImmediate(() => {
        lag = Date.now() - start;
        this._currentLag = lag;
        if (!this._running) return;
        setTimeout(measure, 1000).unref?.();
      });
    };
    setTimeout(measure, 1000).unref?.();
    this._currentLag = 0;
    return null;
  }

  _getCpuUsage() {
    const now = Date.now();
    const elapsed = now - this._lastCpuTime;
    const usage = process.cpuUsage(this._lastCpuUsage);
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = now;
    if (elapsed === 0) return 0;
    return Math.min(100, ((usage.user + usage.system) / 1000 / elapsed) * 100);
  }

  async _collectSample() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const sample = {
      ts: new Date().toISOString(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        heapUsagePercent: Math.round(mem.heapUsed / mem.heapTotal * 100),
        systemUsagePercent: Math.round(usedMem / totalMem * 100),
        systemUsedMB: Math.round(usedMem / 1024 / 1024),
        systemTotalMB: Math.round(totalMem / 1024 / 1024),
      },
      cpu: {
        usagePercent: Math.round(this._getCpuUsage()),
        loadAvg: os.loadavg(),
        cpus: os.cpus().length,
      },
      eventLoop: {
        lagMs: this._currentLag || 0,
      },
      uptime: process.uptime(),
      pid: process.pid,
    };

    this._samples.push(sample);
    if (this._samples.length > this._retentionSamples) this._samples.shift();

    this.emit('sample', sample);
    this._checkThresholds(sample);
  }

  _checkThresholds(sample) {
    const checks = [
      { key: 'memoryUsagePercent', value: sample.memory.systemUsagePercent },
      { key: 'heapUsagePercent', value: sample.memory.heapUsagePercent },
      { key: 'cpuUsagePercent', value: sample.cpu.usagePercent },
      { key: 'eventLoopLagMs', value: sample.eventLoop.lagMs },
    ];

    for (const { key, value } of checks) {
      const t = this._thresholds[key];
      if (!t) continue;

      if (value >= t.critical) {
        this._fireAlert(ALERT_LEVELS.CRITICAL, key, value, t.critical);
      } else if (value >= t.warn) {
        this._fireAlert(ALERT_LEVELS.WARN, key, value, t.warn);
      }
    }
  }

  _fireAlert(level, metric, value, threshold) {
    const alert = { level, metric, value, threshold, ts: new Date().toISOString() };
    this._alerts.push(alert);
    if (this._alerts.length > 500) this._alerts.shift();
    this.emit('alert', alert);
    if (level === ALERT_LEVELS.CRITICAL) this.emit('critical', alert);
  }

  /**
   * Record an error for rate tracking.
   */
  recordError() {
    this._errorCounts.push(Date.now());
    const cutoff = Date.now() - 60000;
    this._errorCounts = this._errorCounts.filter(t => t > cutoff);
    const rate = this._errorCounts.length;
    const t = this._thresholds.errorRatePerMin;
    if (rate >= t.critical) this._fireAlert(ALERT_LEVELS.CRITICAL, 'errorRatePerMin', rate, t.critical);
    else if (rate >= t.warn) this._fireAlert(ALERT_LEVELS.WARN, 'errorRatePerMin', rate, t.warn);
  }

  // ─── Reporting ─────────────────────────────────────────────────────────────

  getCurrentMetrics() {
    return this._samples[this._samples.length - 1] || null;
  }

  getMetricsHistory(limit = 60) {
    return this._samples.slice(-limit);
  }

  getAlerts(level = null, limit = 100) {
    let alerts = this._alerts;
    if (level) alerts = alerts.filter(a => a.level === level);
    return alerts.slice(-limit).reverse();
  }

  getSummary() {
    const current = this.getCurrentMetrics();
    if (!current) return { ok: true, message: 'No samples yet' };

    const memPct = current.memory.heapUsagePercent;
    const cpuPct = current.cpu.usagePercent;
    const lagMs = current.eventLoop.lagMs;

    const health = memPct < 90 && cpuPct < 90 && lagMs < 500 ? 'healthy' :
      memPct < 95 && cpuPct < 95 && lagMs < 1000 ? 'degraded' : 'critical';

    return {
      health,
      uptime: Math.floor(current.uptime),
      memory: { heapUsagePct: memPct, systemUsagePct: current.memory.systemUsagePercent },
      cpu: { usagePct: cpuPct, loadAvg: current.cpu.loadAvg },
      eventLoopLagMs: lagMs,
      sampleCount: this._samples.length,
      recentAlerts: this.getAlerts(null, 5),
    };
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app) {
    /** GET /api/monitor/metrics */
    app.get('/api/monitor/metrics', (req, res) => {
      const limit = parseInt(req.query.limit) || 60;
      res.json({
        ok: true,
        current: this.getCurrentMetrics(),
        history: this.getMetricsHistory(limit),
        summary: this.getSummary(),
      });
    });

    /** GET /api/monitor/current */
    app.get('/api/monitor/current', (req, res) => {
      const current = this.getCurrentMetrics();
      if (!current) return res.json({ ok: true, message: 'No data yet' });
      res.json({ ok: true, ...current });
    });

    /** GET /api/monitor/summary */
    app.get('/api/monitor/summary', (req, res) => {
      res.json({ ok: true, ...this.getSummary() });
    });

    /** GET /api/monitor/alerts */
    app.get('/api/monitor/alerts', (req, res) => {
      const { level, limit } = req.query;
      res.json({ ok: true, alerts: this.getAlerts(level, parseInt(limit) || 100) });
    });

    /** POST /api/monitor/start */
    app.post('/api/monitor/start', (req, res) => {
      this.start();
      res.json({ ok: true, running: this._running });
    });

    /** POST /api/monitor/stop */
    app.post('/api/monitor/stop', (req, res) => {
      this.stop();
      res.json({ ok: true, running: this._running });
    });

    return app;
  }
}

let _instance = null;
function getSystemMonitor(opts) {
  if (!_instance) _instance = new SystemMonitor(opts);
  return _instance;
}

module.exports = { SystemMonitor, getSystemMonitor, ALERT_LEVELS, THRESHOLDS };

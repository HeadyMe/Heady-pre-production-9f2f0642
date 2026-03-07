/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const os = require('os');
const process = require('process');
const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const { TelemetryCollector, METRIC_TYPES } = require('../telemetry/telemetry-collector');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 5_000;

const SEVERITY = Object.freeze({ INFO: 'INFO', WARN: 'WARN', CRITICAL: 'CRITICAL' });

const DEFAULT_THRESHOLDS = {
  cpuPercent:        { warn: 80,    critical: 95,   unit: '%' },
  memoryPercent:     { warn: 80,    critical: 95,   unit: '%' },
  heapUsedMb:        { warn: 1024,  critical: 2048, unit: 'MB' },
  eventLoopLagMs:    { warn: 100,   critical: 500,  unit: 'ms' },
  errorRate:         { warn: 0.05,  critical: 0.15, unit: 'rate' },   // errors / request
};

// ─── SystemMonitor ────────────────────────────────────────────────────────────

class SystemMonitor extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}   [opts.intervalMs=5000]   - Poll interval
   * @param {object}   [opts.thresholds]        - Override default thresholds
   * @param {object}   [opts.telemetry]         - Injected TelemetryCollector
   * @param {boolean}  [opts.autoStart=false]
   */
  constructor(opts = {}) {
    super();

    this.intervalMs  = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.thresholds  = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds || {}) };
    this._telemetry  = opts.telemetry || new TelemetryCollector({ collectBuiltIns: false });

    /** subsystem health reporters: name → () => HealthReport */
    this._subsystems = new Map();

    this._timer     = null;
    this._running   = false;
    this._lastCpuMs = null;
    this._alertHistory = [];   // last 200 alerts

    /** Snapshot from last poll */
    this.latestSnapshot = null;

    if (opts.autoStart) this.start();

    logger.info('[SystemMonitor] initialized', { intervalMs: this.intervalMs });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  start() {
    if (this._running) return this;
    this._running = true;
    this._lastCpuMs = _readCpuMs();

    this._tick();  // immediate first sample
    this._timer = setInterval(() => this._tick(), this.intervalMs);
    this._timer.unref?.();

    logger.info('[SystemMonitor] started');
    return this;
  }

  stop() {
    if (!this._running) return;
    clearInterval(this._timer);
    this._timer = null;
    this._running = false;
    logger.info('[SystemMonitor] stopped');
  }

  // ─── Subsystem registration ──────────────────────────────────────────────────

  /**
   * Register a subsystem health reporter.
   * @param {string}   name
   * @param {Function} reporterFn  - async () => { healthy: bool, details?: object }
   */
  registerSubsystem(name, reporterFn) {
    if (typeof reporterFn !== 'function') throw new TypeError('reporterFn must be a function');
    this._subsystems.set(name, reporterFn);
    logger.debug('[SystemMonitor] subsystem registered', { name });
  }

  removeSubsystem(name) {
    return this._subsystems.delete(name);
  }

  // ─── Threshold management ────────────────────────────────────────────────────

  setThreshold(metric, level, value) {
    if (!this.thresholds[metric]) this.thresholds[metric] = {};
    this.thresholds[metric][level] = value;
  }

  // ─── Manual health check ─────────────────────────────────────────────────────

  /**
   * Run an immediate health check and return a snapshot.
   * @returns {Promise<SystemSnapshot>}
   */
  async check() {
    return this._tick();
  }

  /**
   * Express/Koa middleware that returns a health JSON response.
   */
  healthEndpoint() {
    return async (req, res) => {
      const snapshot = this.latestSnapshot || await this.check();
      const status = snapshot.healthy ? 200 : 503;
      res.status(status).json(snapshot);
    };
  }

  // ─── Alert history ───────────────────────────────────────────────────────────

  getAlertHistory(limit = 50) {
    return this._alertHistory.slice(-limit);
  }

  clearAlertHistory() {
    this._alertHistory = [];
  }

  // ─── Core polling tick ───────────────────────────────────────────────────────

  async _tick() {
    const now = Date.now();

    const [cpu, mem, heap, loopLag, subsystemHealth] = await Promise.all([
      this._measureCpu(),
      this._measureMemory(),
      this._measureHeap(),
      this._measureEventLoopLag(),
      this._pollSubsystems(),
    ]);

    const fd = _countFds();
    const uptime = process.uptime();

    // Push to telemetry
    this._telemetry.set('heady_monitor_cpu_percent', cpu);
    this._telemetry.set('heady_monitor_memory_percent', mem.percentUsed);
    this._telemetry.set('heady_monitor_heap_mb', heap.usedMb);
    this._telemetry.set('heady_monitor_event_loop_lag_ms', loopLag);
    this._telemetry.set('heady_monitor_uptime_seconds', uptime);
    if (fd !== null) this._telemetry.set('heady_monitor_open_fds', fd);

    // Check thresholds → generate alerts
    const alerts = [
      ...this._checkThreshold('cpuPercent', cpu, 'CPU usage'),
      ...this._checkThreshold('memoryPercent', mem.percentUsed, 'Memory usage'),
      ...this._checkThreshold('heapUsedMb', heap.usedMb, 'Heap usage'),
      ...this._checkThreshold('eventLoopLagMs', loopLag, 'Event loop lag'),
    ];

    if (alerts.length > 0) {
      for (const alert of alerts) {
        this._emitAlert(alert);
      }
    }

    const snapshot = {
      timestamp: new Date(now).toISOString(),
      healthy: alerts.filter(a => a.severity === SEVERITY.CRITICAL).length === 0 &&
               subsystemHealth.every(s => s.healthy),
      system: {
        cpu: { percent: cpu },
        memory: mem,
        heap,
        eventLoopLagMs: loopLag,
        openFds: fd,
        uptimeSeconds: uptime,
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
        loadAvg: os.loadavg(),
      },
      subsystems: subsystemHealth,
      activeAlerts: alerts,
    };

    this.latestSnapshot = snapshot;
    this.emit('snapshot', snapshot);

    return snapshot;
  }

  // ─── Measurements ────────────────────────────────────────────────────────────

  async _measureCpu() {
    const prev = this._lastCpuMs;
    const curr = _readCpuMs();
    this._lastCpuMs = curr;

    if (!prev) return 0;

    const userDelta  = curr.user  - prev.user;
    const systemDelta = curr.system - prev.system;
    const totalDelta = curr.total - prev.total;

    if (totalDelta <= 0) return 0;
    return parseFloat((((userDelta + systemDelta) / totalDelta) * 100).toFixed(1));
  }

  _measureMemory() {
    const total = os.totalmem();
    const free  = os.freemem();
    const used  = total - free;
    return {
      totalMb: Math.round(total / 1048576),
      usedMb:  Math.round(used  / 1048576),
      freeMb:  Math.round(free  / 1048576),
      percentUsed: parseFloat(((used / total) * 100).toFixed(1)),
    };
  }

  _measureHeap() {
    const h = process.memoryUsage();
    return {
      usedMb:  parseFloat((h.heapUsed  / 1048576).toFixed(2)),
      totalMb: parseFloat((h.heapTotal / 1048576).toFixed(2)),
      rssMb:   parseFloat((h.rss       / 1048576).toFixed(2)),
      externalMb: parseFloat((h.external / 1048576).toFixed(2)),
    };
  }

  _measureEventLoopLag() {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // ms
        resolve(parseFloat(lag.toFixed(3)));
      });
    });
  }

  async _pollSubsystems() {
    const results = [];
    for (const [name, reporter] of this._subsystems) {
      try {
        const report = await Promise.race([
          reporter(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]);
        results.push({ name, healthy: report.healthy !== false, details: report.details || null });
      } catch (err) {
        results.push({ name, healthy: false, error: err.message });
      }
    }
    return results;
  }

  // ─── Threshold checking ──────────────────────────────────────────────────────

  _checkThreshold(metric, value, label) {
    const t = this.thresholds[metric];
    if (!t) return [];

    if (value >= t.critical) {
      return [{ metric, label, value, threshold: t.critical, severity: SEVERITY.CRITICAL, unit: t.unit }];
    }
    if (value >= t.warn) {
      return [{ metric, label, value, threshold: t.warn, severity: SEVERITY.WARN, unit: t.unit }];
    }
    return [];
  }

  _emitAlert(alert) {
    const enriched = { ...alert, timestamp: new Date().toISOString() };

    this._alertHistory.push(enriched);
    if (this._alertHistory.length > 200) this._alertHistory.shift();

    this.emit('alert', enriched);

    if (alert.severity === SEVERITY.CRITICAL) {
      logger.error('[SystemMonitor] CRITICAL alert', enriched);
    } else {
      logger.warn('[SystemMonitor] WARN alert', enriched);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _readCpuMs() {
  const cpus = os.cpus();
  let user = 0, system = 0, total = 0;
  for (const cpu of cpus) {
    user   += cpu.times.user;
    system += cpu.times.sys;
    total  += Object.values(cpu.times).reduce((a, b) => a + b, 0);
  }
  return { user, system, total };
}

function _countFds() {
  try {
    const fs = require('fs');
    const entries = fs.readdirSync('/proc/self/fd');
    return entries.length;
  } catch {
    return null; // Not available on all platforms
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { SystemMonitor, SEVERITY, DEFAULT_THRESHOLDS };

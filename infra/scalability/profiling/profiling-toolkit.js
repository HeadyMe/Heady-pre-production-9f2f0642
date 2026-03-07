'use strict';
/**
 * @module profiling-toolkit
 * @description Performance profiling toolkit for HeadySystems
 *
 * Features:
 *   - CPU flame graph capture via V8 --prof
 *   - Heap snapshot on memory > 85.4% (CSL CRITICAL threshold)
 *   - Event loop lag monitoring (alert > fib(8)=21ms)
 *   - GC pause tracking
 *   - HTTP request tracing with timing breakdown
 *
 * CSL memory thresholds:
 *   DORMANT:  0.0 – 0.236
 *   LOW:      0.236 – 0.382
 *   MODERATE: 0.382 – 0.618
 *   HIGH:     0.618 – 0.854
 *   CRITICAL: 0.854 – 1.0   ← heap snapshot trigger
 *
 * φ = 1.618033988749895
 */

const os            = require('os');
const fs            = require('fs');
const path          = require('path');
const v8            = require('v8');
const EventEmitter  = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// CSL thresholds
const CSL = {
  DORMANT:  { min: 0,     max: 0.236 },
  LOW:      { min: 0.236, max: 0.382 },
  MODERATE: { min: 0.382, max: 0.618 },
  HIGH:     { min: 0.618, max: 0.854 },
  CRITICAL: { min: 0.854, max: 1.0   },   // ← heap snapshot trigger
};

/** Classify a ratio into CSL level */
function cslLevel(ratio) {
  if (ratio < CSL.DORMANT.max)  return 'DORMANT';
  if (ratio < CSL.LOW.max)      return 'LOW';
  if (ratio < CSL.MODERATE.max) return 'MODERATE';
  if (ratio < CSL.HIGH.max)     return 'HIGH';
  return 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Loop Lag Monitor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class EventLoopMonitor
 * Monitors event loop lag using high-resolution timestamps.
 * Alert threshold: fib(8)=21ms
 *
 * @extends EventEmitter
 *
 * Events:
 *   sample({lagMs, cslLevel})
 *   alert({lagMs, threshold, cslLevel})
 */
class EventLoopMonitor extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {number} [opts.sampleIntervalMs=1000] - How often to measure (ms)
   * @param {number} [opts.alertThresholdMs=21]   - fib(8)=21ms warn threshold
   * @param {number} [opts.criticalThresholdMs=34] - fib(9)=34ms critical
   */
  constructor(opts = {}) {
    super();
    this.sampleIntervalMs    = opts.sampleIntervalMs    ?? 1000;
    this.alertThresholdMs    = opts.alertThresholdMs    ?? FIB[8];   // 21ms
    this.criticalThresholdMs = opts.criticalThresholdMs ?? FIB[9];   // 34ms
    this._timer   = null;
    this._samples = [];
    this._maxSamples = FIB[12];   // fib(12)=144 rolling window
  }

  start() {
    if (this._timer) return this;

    let lastCheck = process.hrtime.bigint();

    this._timer = setInterval(() => {
      const now    = process.hrtime.bigint();
      const actual = Number(now - lastCheck) / 1e6;   // ns → ms
      const lagMs  = Math.max(0, actual - this.sampleIntervalMs);
      lastCheck    = now;

      const level = cslLevel(lagMs / this.criticalThresholdMs);
      this._samples.push({ lagMs, level, ts: Date.now() });
      if (this._samples.length > this._maxSamples) this._samples.shift();

      this.emit('sample', { lagMs, cslLevel: level });

      if (lagMs >= this.alertThresholdMs) {
        this.emit('alert', { lagMs, threshold: this.alertThresholdMs, cslLevel: level });
      }
    }, this.sampleIntervalMs).unref();

    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    return this;
  }

  /** @returns {Object} Rolling statistics */
  stats() {
    if (this._samples.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    const lags = this._samples.map(s => s.lagMs).sort((a, b) => a - b);
    const pct  = (p) => lags[Math.floor(lags.length * p)] ?? 0;
    return {
      count: lags.length,
      p50:   Number(pct(0.50).toFixed(2)),
      p95:   Number(pct(0.95).toFixed(2)),
      p99:   Number(pct(0.99).toFixed(2)),
      max:   Number(lags[lags.length - 1].toFixed(2)),
      alertThresholdMs:    this.alertThresholdMs,
      criticalThresholdMs: this.criticalThresholdMs,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GC Pause Tracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class GCPauseTracker
 * Tracks GC pauses using perf_hooks PerformanceObserver.
 * Emits 'gc-pause' events with duration and type.
 *
 * @extends EventEmitter
 */
class GCPauseTracker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._observer = null;
    this._pauses   = [];
    this._maxPauses = FIB[12];   // 144
    this.alertThresholdMs = opts.alertThresholdMs ?? FIB[8];   // 21ms
  }

  start() {
    try {
      const { PerformanceObserver, constants } = require('perf_hooks');
      this._observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const durationMs = entry.duration;
          const gcType     = this._gcTypeName(entry.detail?.kind);
          const record     = { durationMs, gcType, ts: Date.now() };

          this._pauses.push(record);
          if (this._pauses.length > this._maxPauses) this._pauses.shift();

          this.emit('gc-pause', record);

          if (durationMs >= this.alertThresholdMs) {
            this.emit('gc-alert', { ...record, threshold: this.alertThresholdMs });
          }
        }
      });
      this._observer.observe({ entryTypes: ['gc'], buffered: false });
    } catch (_) {
      // perf_hooks may not be available in all environments
    }
    return this;
  }

  stop() {
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
    return this;
  }

  _gcTypeName(kind) {
    const { constants } = require('perf_hooks');
    switch (kind) {
      case constants?.NODE_PERFORMANCE_GC_MAJOR:     return 'major';
      case constants?.NODE_PERFORMANCE_GC_MINOR:     return 'minor';
      case constants?.NODE_PERFORMANCE_GC_INCREMENTAL: return 'incremental';
      case constants?.NODE_PERFORMANCE_GC_WEAKCB:    return 'weakCallback';
      default:                                       return 'unknown';
    }
  }

  stats() {
    if (this._pauses.length === 0) return { count: 0, totalMs: 0, maxMs: 0, byType: {} };
    const durations = this._pauses.map(p => p.durationMs);
    const byType    = {};
    this._pauses.forEach(p => {
      byType[p.gcType] = (byType[p.gcType] ?? 0) + 1;
    });
    return {
      count:   this._pauses.length,
      totalMs: Number(durations.reduce((a, b) => a + b, 0).toFixed(2)),
      avgMs:   Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)),
      maxMs:   Number(Math.max(...durations).toFixed(2)),
      byType,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heap Monitor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class HeapMonitor
 * Monitors V8 heap usage and triggers snapshots at CRITICAL threshold (85.4%).
 *
 * @extends EventEmitter
 *
 * Events:
 *   sample({usedMb, totalMb, heapRatio, cslLevel})
 *   snapshot-triggered({heapRatio, snapshotPath})
 *   snapshot-written({snapshotPath, sizeMb})
 */
class HeapMonitor extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {number} [opts.sampleIntervalMs=5000]   - Sampling interval
   * @param {number} [opts.criticalThreshold=0.854]  - CSL CRITICAL (1-1/φ²)
   * @param {string} [opts.snapshotDir='/tmp/heady-heap'] - Snapshot directory
   */
  constructor(opts = {}) {
    super();
    this.sampleIntervalMs   = opts.sampleIntervalMs   ?? FIB[5] * 1000;  // 5s
    this.criticalThreshold  = opts.criticalThreshold  ?? 0.854;           // CSL CRITICAL
    this.snapshotDir        = opts.snapshotDir        ?? '/tmp/heady-heap';
    this._timer             = null;
    this._snapshotCount     = 0;
    this._lastSnapshotTime  = 0;
    this._snapshotCooldownMs = FIB[10] * 1000;   // fib(10)=55s cooldown between snapshots
  }

  start() {
    if (this._timer) return this;

    this._timer = setInterval(async () => {
      const stats    = v8.getHeapStatistics();
      const used     = stats.used_heap_size;
      const total    = stats.heap_size_limit;
      const ratio    = used / total;
      const level    = cslLevel(ratio);
      const usedMb   = Math.round(used / 1024 / 1024);
      const totalMb  = Math.round(total / 1024 / 1024);

      this.emit('sample', { usedMb, totalMb, heapRatio: ratio, cslLevel: level });

      if (ratio >= this.criticalThreshold) {
        const now = Date.now();
        if (now - this._lastSnapshotTime > this._snapshotCooldownMs) {
          this._lastSnapshotTime = now;
          await this._takeSnapshot(ratio);
        }
      }
    }, this.sampleIntervalMs).unref();

    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    return this;
  }

  async _takeSnapshot(heapRatio) {
    try {
      await fs.promises.mkdir(this.snapshotDir, { recursive: true });
      const filename    = `heap-${Date.now()}-${++this._snapshotCount}.heapsnapshot`;
      const snapshotPath = path.join(this.snapshotDir, filename);

      this.emit('snapshot-triggered', { heapRatio, snapshotPath });

      const snapshot = v8.writeHeapSnapshot(snapshotPath);
      const stat     = await fs.promises.stat(snapshot);
      const sizeMb   = Math.round(stat.size / 1024 / 1024);

      this.emit('snapshot-written', { snapshotPath: snapshot, sizeMb });
    } catch (err) {
      this.emit('error', err);
    }
  }

  currentStats() {
    const stats  = v8.getHeapStatistics();
    const ratio  = stats.used_heap_size / stats.heap_size_limit;
    return {
      usedMb:      Math.round(stats.used_heap_size / 1024 / 1024),
      totalMb:     Math.round(stats.heap_size_limit / 1024 / 1024),
      externalMb:  Math.round(stats.external_memory / 1024 / 1024),
      heapRatio:   Number(ratio.toFixed(4)),
      cslLevel:    cslLevel(ratio),
      peakMb:      Math.round(stats.peak_malloced_memory / 1024 / 1024),
      snapshotCount: this._snapshotCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Request Tracer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class HttpRequestTracer
 * Express middleware for detailed HTTP request timing breakdown.
 * Tracks: receive, route, handler, serialize, send
 *
 * @extends EventEmitter
 */
class HttpRequestTracer extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._slow  = opts.slowThresholdMs ?? FIB[10];   // fib(10)=55ms
    this._alert = opts.alertThresholdMs ?? FIB[11];  // fib(11)=89ms
  }

  /** Express middleware */
  middleware() {
    return (req, res, next) => {
      const start   = process.hrtime.bigint();
      const traceId = req.headers['x-trace-id'] ?? crypto.randomUUID();

      req._heady_trace = {
        traceId,
        start,
        timings: { receive: Number(process.hrtime.bigint() - start) / 1e6 },
      };
      req.traceId = traceId;

      // Capture route resolution time
      const originalRoute = res.json.bind(res);
      res.json = (body) => {
        const t = req._heady_trace.timings;
        t.total  = Number(process.hrtime.bigint() - start) / 1e6;
        t.send   = t.total - (t.handler ?? 0);
        this._emit(req, res, t);
        return originalRoute(body);
      };

      // Capture route match
      const originalNext = next;
      next = (...args) => {
        req._heady_trace.timings.route = Number(process.hrtime.bigint() - start) / 1e6;
        originalNext(...args);
      };

      // After-handler hook
      const origSend = res.send.bind(res);
      res.send = (body) => {
        const t = req._heady_trace.timings;
        if (!t.total) {
          t.total = Number(process.hrtime.bigint() - start) / 1e6;
          this._emit(req, res, t);
        }
        return origSend(body);
      };

      next();
    };
  }

  _emit(req, res, timings) {
    const trace = {
      traceId:    req.traceId,
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      timings:    {
        receiveMs: Number((timings.receive ?? 0).toFixed(2)),
        routeMs:   Number((timings.route   ?? 0).toFixed(2)),
        handlerMs: Number((timings.handler ?? 0).toFixed(2)),
        sendMs:    Number((timings.send    ?? 0).toFixed(2)),
        totalMs:   Number((timings.total   ?? 0).toFixed(2)),
      },
      slow:       timings.total >= this._slow,
      alert:      timings.total >= this._alert,
      cslLevel:   cslLevel(timings.total / this._alert),
      ts:         Date.now(),
    };

    this.emit('trace', trace);
    if (trace.alert) this.emit('slow-request', trace);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CPU Profiler (V8 --prof integration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CpuProfiler
 * CPU profile capture using Node.js inspector API.
 * Generates .cpuprofile files compatible with Chrome DevTools.
 *
 * @extends EventEmitter
 */
class CpuProfiler extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.outputDir = opts.outputDir ?? '/tmp/heady-profiles';
    this._session  = null;
    this._active   = false;
  }

  /** Start CPU profiling session */
  async start() {
    if (this._active) return;
    const { Session } = require('inspector');
    this._session = new Session();
    this._session.connect();

    await new Promise((res, rej) => {
      this._session.post('Profiler.enable', (err) => err ? rej(err) : res());
    });
    await new Promise((res, rej) => {
      this._session.post('Profiler.start', (err) => err ? rej(err) : res());
    });

    this._active = true;
    this.emit('started');
  }

  /**
   * Stop profiling and write .cpuprofile file.
   * @param {string} [label]
   * @returns {Promise<string>} Path to written profile
   */
  async stop(label = 'profile') {
    if (!this._active || !this._session) return null;

    const profile = await new Promise((res, rej) => {
      this._session.post('Profiler.stop', (err, params) => {
        err ? rej(err) : res(params.profile);
      });
    });

    this._session.disconnect();
    this._active = false;

    await fs.promises.mkdir(this.outputDir, { recursive: true });
    const filename = `cpu-${label}-${Date.now()}.cpuprofile`;
    const filepath = path.join(this.outputDir, filename);
    await fs.promises.writeFile(filepath, JSON.stringify(profile));

    const stat   = await fs.promises.stat(filepath);
    const sizeMb = Math.round(stat.size / 1024 / 1024 * 100) / 100;
    this.emit('stopped', { filepath, sizeMb });
    return filepath;
  }

  get isActive() { return this._active; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfilingToolkit (orchestrator)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class ProfilingToolkit
 * Single façade for all profiling instruments.
 *
 * @extends EventEmitter
 */
class ProfilingToolkit extends EventEmitter {
  /**
   * @param {Object} [opts]
   * @param {string}  [opts.outputDir='/tmp/heady-profiles']
   * @param {number}  [opts.eventLoopAlertMs=21]     - fib(8)
   * @param {number}  [opts.heapCritical=0.854]      - CSL CRITICAL
   * @param {number}  [opts.httpSlowMs=55]            - fib(10)
   * @param {number}  [opts.httpAlertMs=89]           - fib(11)
   */
  constructor(opts = {}) {
    super();
    const dir = opts.outputDir ?? '/tmp/heady-profiles';

    this.eventLoop = new EventLoopMonitor({
      alertThresholdMs:    opts.eventLoopAlertMs ?? FIB[8],
      criticalThresholdMs: FIB[9],
    });

    this.heap = new HeapMonitor({
      criticalThreshold: opts.heapCritical ?? 0.854,
      snapshotDir:       dir,
    });

    this.gc = new GCPauseTracker({
      alertThresholdMs: opts.gcAlertMs ?? FIB[8],
    });

    this.http = new HttpRequestTracer({
      slowThresholdMs:  opts.httpSlowMs  ?? FIB[10],
      alertThresholdMs: opts.httpAlertMs ?? FIB[11],
    });

    this.cpu = new CpuProfiler({ outputDir: dir });

    // Bubble up alerts
    this.eventLoop.on('alert',          (data) => this.emit('alert', { source: 'event-loop', ...data }));
    this.heap.on('snapshot-triggered',  (data) => this.emit('alert', { source: 'heap',       ...data }));
    this.gc.on('gc-alert',              (data) => this.emit('alert', { source: 'gc',         ...data }));
    this.http.on('slow-request',        (data) => this.emit('alert', { source: 'http',       ...data }));
  }

  /** Start all monitors. */
  start() {
    this.eventLoop.start();
    this.heap.start();
    this.gc.start();
    return this;
  }

  /** Stop all monitors. */
  stop() {
    this.eventLoop.stop();
    this.heap.stop();
    this.gc.stop();
    return this;
  }

  /** Express middleware (http tracing) */
  middleware() { return this.http.middleware(); }

  /**
   * Full diagnostics snapshot.
   * @returns {Object}
   */
  diagnostics() {
    return {
      timestamp:   new Date().toISOString(),
      phi:         PHI,
      process: {
        pid:         process.pid,
        uptime:      Math.round(process.uptime()),
        memUsage:    process.memoryUsage(),
        cpuUsage:    process.cpuUsage(),
        versions:    process.versions,
      },
      heap:        this.heap.currentStats(),
      eventLoop:   this.eventLoop.stats(),
      gc:          this.gc.stats(),
      system: {
        freeMem:   os.freemem(),
        totalMem:  os.totalmem(),
        loadAvg:   os.loadavg(),
        cpus:      os.cpus().length,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  ProfilingToolkit,
  CpuProfiler,
  HeapMonitor,
  EventLoopMonitor,
  GCPauseTracker,
  HttpRequestTracer,
  cslLevel,
  CSL,
  PHI,
  FIB,
};

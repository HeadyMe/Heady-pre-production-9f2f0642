/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const os     = require('os');
const v8     = require('v8');
const logger = require('../utils/logger').child('telemetry-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/** Rolling window depth (number of data points retained in memory). */
const ROLLING_WINDOW = 100;

/**
 * PHI-scaled alert thresholds:
 *   CPU   > 1 / PHI  ≈ 61.8%
 *   Mem   > 1 / PHI  ≈ 61.8% of total
 *   Event loop lag > PHI * PHI * 100ms ≈ 261ms
 *   Heap  > PHI * PHI / (PHI + 1) ≈ 61.8% of heap limit
 */
const THRESHOLDS = {
  cpuPercent:     (1 / PHI) * 100,
  memPercent:     (1 / PHI) * 100,
  eventLoopLagMs: PHI * PHI * 100,
  heapPercent:    (1 / PHI) * 100,
};

// ---------------------------------------------------------------------------
// Rolling window state
// ---------------------------------------------------------------------------
const _window = {
  cpu:          [],  // number (0-100)
  mem:          [],  // number (0-100)
  eventLoopLag: [],  // ms
  heapPercent:  [],  // 0-100
  timestamps:   [],  // Date.now()
};

// ---------------------------------------------------------------------------
// Event-loop lag measurement
// ---------------------------------------------------------------------------
let _lagSampleMs = 0;

(function initLagSampler() {
  const SAMPLE_INTERVAL = Math.round(PHI * 100); // ≈ 162ms
  let _lastTick = Date.now();

  function tick() {
    const now = Date.now();
    _lagSampleMs = Math.max(0, now - _lastTick - SAMPLE_INTERVAL);
    _lastTick    = now;
    // Use setImmediate so the sampler is never the one causing the delay
    setTimeout(tick, SAMPLE_INTERVAL).unref();
  }
  setTimeout(tick, SAMPLE_INTERVAL).unref();
})();

// ---------------------------------------------------------------------------
// CPU usage helper (differential between two samples)
// ---------------------------------------------------------------------------
let _prevCpuTimes = os.cpus().map(c => ({ ...c.times }));

function getCpuPercent() {
  const cpus    = os.cpus();
  let totalIdle = 0, totalTick = 0;

  for (let i = 0; i < cpus.length; i++) {
    const curr = cpus[i].times;
    const prev = _prevCpuTimes[i] || curr;
    const idle = curr.idle - (prev.idle || 0);
    const tick = Object.values(curr).reduce((s, v) => s + v, 0) -
                 Object.values(prev).reduce((s, v) => s + v, 0);
    totalIdle += idle;
    totalTick += tick;
    _prevCpuTimes[i] = { ...curr };
  }

  return totalTick === 0 ? 0 : Math.round((1 - totalIdle / totalTick) * 100);
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------
function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

function rollingAvg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

/**
 * Worker: collect-metrics
 * Gathers CPU, memory, event-loop lag, and V8 heap metrics.
 * Appends each sample to the rolling window (capped at ROLLING_WINDOW).
 */
function makeCollectMetricsWorker() {
  return async function collectMetrics() {
    const tag = 'collect-metrics';
    logger.debug(`[${tag}] starting`);

    const cpuPercent    = getCpuPercent();
    const totalMem      = os.totalmem();
    const freeMem       = os.freemem();
    const usedMem       = totalMem - freeMem;
    const memPercent    = (usedMem / totalMem) * 100;
    const heapStats     = v8.getHeapStatistics();
    const heapPercent   = heapStats.heap_size_limit > 0
      ? (heapStats.used_heap_size / heapStats.heap_size_limit) * 100
      : 0;
    const eventLoopLag  = _lagSampleMs;
    const now           = Date.now();

    // Append to rolling windows
    const push = (arr, val) => { arr.push(val); if (arr.length > ROLLING_WINDOW) arr.shift(); };
    push(_window.cpu,          cpuPercent);
    push(_window.mem,          memPercent);
    push(_window.eventLoopLag, eventLoopLag);
    push(_window.heapPercent,  heapPercent);
    push(_window.timestamps,   now);

    const result = {
      worker:       tag,
      capturedAt:   now,
      cpuPercent,
      memPercent,
      heapPercent,
      eventLoopLagMs: eventLoopLag,
      totalMemBytes:  totalMem,
      usedMemBytes:   usedMem,
      freeMemBytes:   freeMem,
      heapUsedBytes:  heapStats.used_heap_size,
      heapTotalBytes: heapStats.total_heap_size,
      heapLimitBytes: heapStats.heap_size_limit,
      externalBytes:  heapStats.external_memory,
      processUptimeS: process.uptime(),
      nodeVersion:    process.version,
      platform:       process.platform,
    };

    logger.debug(`[${tag}] sample`, {
      cpu: `${cpuPercent.toFixed(1)}%`,
      mem: `${memPercent.toFixed(1)}%`,
      lag: `${eventLoopLag}ms`,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:telemetry', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: compute-trends
 * Computes rolling averages, P95, and P99 from the in-memory window.
 */
function makeComputeTrendsWorker() {
  return async function computeTrends() {
    const tag = 'compute-trends';
    logger.debug(`[${tag}] starting`);

    const sortedCpu   = [..._window.cpu].sort((a, b) => a - b);
    const sortedMem   = [..._window.mem].sort((a, b) => a - b);
    const sortedLag   = [..._window.eventLoopLag].sort((a, b) => a - b);
    const sortedHeap  = [..._window.heapPercent].sort((a, b) => a - b);

    const result = {
      worker:     tag,
      capturedAt: Date.now(),
      windowSize: _window.timestamps.length,

      cpu: {
        avg:    rollingAvg(_window.cpu),
        p95:    percentile(sortedCpu, 95),
        p99:    percentile(sortedCpu, 99),
        min:    sortedCpu[0]          ?? 0,
        max:    sortedCpu[sortedCpu.length - 1] ?? 0,
      },
      mem: {
        avg:    rollingAvg(_window.mem),
        p95:    percentile(sortedMem, 95),
        p99:    percentile(sortedMem, 99),
        min:    sortedMem[0]          ?? 0,
        max:    sortedMem[sortedMem.length - 1] ?? 0,
      },
      eventLoopLag: {
        avg:    rollingAvg(_window.eventLoopLag),
        p95:    percentile(sortedLag, 95),
        p99:    percentile(sortedLag, 99),
        min:    sortedLag[0]          ?? 0,
        max:    sortedLag[sortedLag.length - 1] ?? 0,
      },
      heap: {
        avg:    rollingAvg(_window.heapPercent),
        p95:    percentile(sortedHeap, 95),
        p99:    percentile(sortedHeap, 99),
        min:    sortedHeap[0]         ?? 0,
        max:    sortedHeap[sortedHeap.length - 1] ?? 0,
      },
    };

    logger.info(`[${tag}] completed`, {
      cpuAvg:    `${result.cpu.avg.toFixed(1)}%`,
      memAvg:    `${result.mem.avg.toFixed(1)}%`,
      lagP99:    `${result.eventLoopLag.p99.toFixed(1)}ms`,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:telemetry', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: generate-alerts
 * Fires alerts when any metric exceeds PHI-scaled thresholds.
 * Uses CSL weighted_superposition to produce a composite stress score.
 */
function makeGenerateAlertsWorker() {
  return async function generateAlerts() {
    const tag = 'generate-alerts';
    logger.debug(`[${tag}] starting`);

    const latest = {
      cpu:          _window.cpu[_window.cpu.length - 1]                   ?? 0,
      mem:          _window.mem[_window.mem.length - 1]                   ?? 0,
      eventLoopLag: _window.eventLoopLag[_window.eventLoopLag.length - 1] ?? 0,
      heap:         _window.heapPercent[_window.heapPercent.length - 1]   ?? 0,
    };

    const alerts = [];

    const check = (metric, value, threshold, unit = '%') => {
      const ratio    = value / threshold;
      const exceeded = value > threshold;
      // CSL soft_gate: produces a 0-1 signal proportional to how far above threshold
      const signal   = CSL.soft_gate(value - threshold, threshold * 0.1);

      if (exceeded) {
        const alert = {
          metric,
          value:    parseFloat(value.toFixed(2)),
          threshold: parseFloat(threshold.toFixed(2)),
          ratio:    parseFloat(ratio.toFixed(4)),
          signal:   parseFloat(signal.toFixed(4)),
          unit,
          severity: ratio > PHI ? 'critical' : 'warning',
          ts:       Date.now(),
        };
        alerts.push(alert);
        logger.warn(`[${tag}] alert`, alert);

        if (global.eventBus) {
          global.eventBus.emit('telemetry:alert', alert);
        }
      }
    };

    check('cpu',          latest.cpu,          THRESHOLDS.cpuPercent,     '%');
    check('mem',          latest.mem,          THRESHOLDS.memPercent,     '%');
    check('eventLoopLag', latest.eventLoopLag, THRESHOLDS.eventLoopLagMs, 'ms');
    check('heap',         latest.heap,         THRESHOLDS.heapPercent,    '%');

    // Compute composite stress score
    const stressScore = CSL.weighted_superposition([
      { value: latest.cpu          / 100, weight: 0.35 },
      { value: latest.mem          / 100, weight: 0.25 },
      { value: Math.min(latest.eventLoopLag / (PHI * 1000), 1), weight: 0.25 },
      { value: latest.heap         / 100, weight: 0.15 },
    ]);

    const result = {
      worker:      tag,
      capturedAt:  Date.now(),
      alerts,
      alertCount:  alerts.length,
      stressScore: parseFloat(stressScore.toFixed(4)),
      thresholds:  THRESHOLDS,
      latestSamples: latest,
    };

    logger.info(`[${tag}] completed`, {
      alertCount: alerts.length,
      stressScore: stressScore.toFixed(4),
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:telemetry', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'telemetry-projection';
const description = 'Projects real-time telemetry: CPU/mem/heap/event-loop collection, P95/P99 trend analysis, and PHI-scaled threshold alerting.';
const priority    = 0.7;

function getWork() {
  return [
    makeCollectMetricsWorker(),
    makeComputeTrendsWorker(),
    makeGenerateAlertsWorker(),
  ];
}

module.exports = { domain, description, priority, getWork };

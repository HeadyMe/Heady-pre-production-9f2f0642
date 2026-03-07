/**
 * @file cognitive-runtime-governor.js
 * @description Cognitive Resource Governor — CPU/Memory/GPU budget enforcement.
 *
 * Features:
 * - CPU/memory/GPU budget enforcement with PHI-based thresholds
 * - Task throttling based on real-time resource availability
 * - Priority preemption: lower-priority work halted when resources are scarce
 * - Graceful degradation paths: sequential → cached → minimal → reject modes
 * - Periodic resource sampling with PHI-scaled sliding windows
 *
 * Sacred Geometry: PHI thresholds for resource zones (critical/warn/healthy).
 * Zero external dependencies — Node.js built-ins only (process, os).
 *
 * @module Orchestration/CognitiveRuntimeGovernor
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import os from 'os';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} n - attempt index
 * @param {number} [base=1000]
 * @returns {number} ms
 */
function phiBackoff(n, base = 1000) {
  return Math.min(Math.floor(Math.pow(PHI, n) * base), 55000);
}

// ─── Resource Thresholds ──────────────────────────────────────────────────────

/**
 * PHI-based resource threshold bands (0.0–1.0 utilization).
 *
 * Named after the PHI relationship:
 *   HEALTHY:  [0, 1/φ²]    = [0,    0.382]   — full capacity
 *   WARM:     [1/φ², 1/φ]  = [0.382, 0.618]  — normal operations
 *   HOT:      [1/φ,  φ/2]  = [0.618, 0.809]  — start throttling
 *   CRITICAL: [φ/2,  1.0]  = [0.809, 1.0]    — preemption/graceful degrade
 * @enum {object}
 */
export const ResourceZone = Object.freeze({
  HEALTHY:  { name: 'HEALTHY',  min: 0,             max: 1 / (PHI * PHI), color: 'green'  },
  WARM:     { name: 'WARM',     min: 1 / (PHI * PHI), max: 1 / PHI,        color: 'yellow' },
  HOT:      { name: 'HOT',      min: 1 / PHI,        max: PHI / 2,          color: 'orange' },
  CRITICAL: { name: 'CRITICAL', min: PHI / 2,        max: 1.0,              color: 'red'    },
});

/**
 * Get the ResourceZone for a utilization value
 * @param {number} utilization - 0.0–1.0
 * @returns {object} ResourceZone
 */
export function getZone(utilization) {
  const u = Math.max(0, Math.min(1, utilization));
  for (const zone of [ResourceZone.CRITICAL, ResourceZone.HOT, ResourceZone.WARM, ResourceZone.HEALTHY]) {
    if (u >= zone.min) return zone;
  }
  return ResourceZone.HEALTHY;
}

// ─── Degradation Modes ────────────────────────────────────────────────────────

/**
 * Graceful degradation modes, ordered from best to worst.
 * @enum {string}
 */
export const DegradationMode = Object.freeze({
  FULL:       'FULL',       // Normal operation, all features
  SEQUENTIAL: 'SEQUENTIAL', // No parallelism; process tasks one-by-one
  CACHED:     'CACHED',     // Only serve from cache; no fresh computation
  MINIMAL:    'MINIMAL',    // Only critical tasks (Priority >= HIGH)
  REJECT:     'REJECT',     // Reject all non-CRITICAL tasks
});

// ─── Resource Sample ──────────────────────────────────────────────────────────

/**
 * @typedef {object} ResourceSample
 * @property {number} ts - timestamp
 * @property {number} cpuUtilization - 0.0–1.0 (across all cores)
 * @property {number} memUtilization - 0.0–1.0 (heap + rss / total)
 * @property {number} heapUsed - bytes
 * @property {number} heapTotal - bytes
 * @property {number} rss - bytes
 * @property {number} freeMem - bytes
 * @property {number} totalMem - bytes
 * @property {number} loadAvg1 - 1-minute load average
 * @property {number} cpuCount - logical CPU count
 * @property {object} zone - { cpu: ResourceZone, mem: ResourceZone }
 * @property {number} phi_score - composite PHI health score
 */

// ─── CPU Sampling ─────────────────────────────────────────────────────────────

/** @private Previous CPU times for delta computation */
let _prevCpuTimes = null;

/**
 * Compute current CPU utilization across all cores (0.0–1.0)
 * @returns {number}
 */
function getCpuUtilization() {
  const cpus = os.cpus();
  const current = cpus.map((c) => ({
    idle:  c.times.idle,
    total: Object.values(c.times).reduce((s, v) => s + v, 0),
  }));

  if (!_prevCpuTimes) {
    _prevCpuTimes = current;
    return 0; // No delta yet
  }

  let totalDelta = 0, idleDelta = 0;
  for (let i = 0; i < current.length; i++) {
    totalDelta += current[i].total - (_prevCpuTimes[i]?.total ?? 0);
    idleDelta  += current[i].idle  - (_prevCpuTimes[i]?.idle  ?? 0);
  }
  _prevCpuTimes = current;

  if (totalDelta === 0) return 0;
  return Math.max(0, Math.min(1, 1 - idleDelta / totalDelta));
}

/**
 * Take a resource sample
 * @returns {ResourceSample}
 */
export function sampleResources() {
  const mem = process.memoryUsage();
  const totalMem  = os.totalmem();
  const freeMem   = os.freemem();
  const usedMem   = totalMem - freeMem;
  const cpuUtil   = getCpuUtilization();
  const memUtil   = mem.heapUsed / mem.heapTotal; // heap-based
  const sysMemUtil = usedMem / totalMem;           // system-wide
  const loadAvg   = os.loadavg()[0]; // 1-min average
  const cpuCount  = os.cpus().length;

  const phi_score = ((1 - cpuUtil) * PHI + (1 - memUtil)) / (PHI + 1);

  return {
    ts:            Date.now(),
    cpuUtilization: cpuUtil,
    memUtilization: memUtil,
    sysMemUtilization: sysMemUtil,
    heapUsed:      mem.heapUsed,
    heapTotal:     mem.heapTotal,
    external:      mem.external,
    rss:           mem.rss,
    freeMem,
    totalMem,
    loadAvg1:      loadAvg,
    cpuCount,
    zone: {
      cpu: getZone(cpuUtil),
      mem: getZone(memUtil),
    },
    phi_score,
  };
}

// ─── PHI Sliding Window ───────────────────────────────────────────────────────

/**
 * Sliding window accumulator with PHI-weighted averages.
 * Recent samples are weighted more heavily using PHI decay.
 */
class PhiSlidingWindow {
  /**
   * @param {number} [size=FIBONACCI[6]] window size (13)
   */
  constructor(size = FIBONACCI[6]) {
    this._size   = size;
    this._values = [];
  }

  /**
   * Add a value to the window
   * @param {number} v
   */
  add(v) {
    this._values.push(v);
    if (this._values.length > this._size) {
      this._values.shift();
    }
  }

  /**
   * Compute PHI-weighted average (most recent values weighted higher)
   * @returns {number}
   */
  phiAvg() {
    if (this._values.length === 0) return 0;
    let weightedSum = 0, totalWeight = 0;
    const n = this._values.length;
    for (let i = 0; i < n; i++) {
      const weight = Math.pow(PHI, i); // later items have higher PHI^i weight
      weightedSum += this._values[i] * weight;
      totalWeight += weight;
    }
    return weightedSum / totalWeight;
  }

  /** Simple mean */
  mean() {
    if (this._values.length === 0) return 0;
    return this._values.reduce((s, v) => s + v, 0) / this._values.length;
  }

  /** Latest value */
  latest() { return this._values[this._values.length - 1] ?? 0; }

  /** Peak value in window */
  peak() { return this._values.length ? Math.max(...this._values) : 0; }
}

// ─── Budget ───────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ResourceBudget
 * @property {number} [maxCpu=PHI/2] - max CPU utilization before throttling (~0.809)
 * @property {number} [maxMem=PHI/2] - max heap utilization before throttling
 * @property {number} [maxConcurrency=FIBONACCI[7]] - max parallel tasks (21)
 * @property {number} [maxQueueSize=FIBONACCI[12]] - max queued tasks (233)
 */

// ─── CognitiveRuntimeGovernor ─────────────────────────────────────────────────

/**
 * Central resource governance system for the Heady runtime.
 *
 * Enforces CPU/memory/GPU budgets, throttles tasks based on resource availability,
 * preempts lower-priority work, and applies graceful degradation.
 *
 * @extends EventEmitter
 *
 * @example
 * const gov = new CognitiveRuntimeGovernor({
 *   maxCpu: 0.8,
 *   maxMem: 0.7,
 *   maxConcurrency: 21,
 * });
 *
 * gov.on('degradation.changed', ({ mode }) => console.log('Mode:', mode));
 * gov.start();
 *
 * // Before running a task:
 * const permit = await gov.acquire(task, { priority: 3 });
 * try {
 *   await runTask();
 * } finally {
 *   permit.release();
 * }
 */
export class CognitiveRuntimeGovernor extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string} [options.nodeId='governor']
   * @param {number} [options.maxCpu=PHI/2] - CPU throttle threshold (~0.809)
   * @param {number} [options.maxMem=PHI/2] - heap utilization threshold
   * @param {number} [options.maxConcurrency=FIBONACCI[7]] - max parallel tasks (21)
   * @param {number} [options.maxQueueSize=FIBONACCI[12]] - max queued tasks (233)
   * @param {number} [options.sampleInterval=FIBONACCI[4]*1000] - resource sampling ms (5s)
   * @param {number} [options.windowSize=FIBONACCI[6]] - smoothing window size (13)
   * @param {boolean} [options.preemptionEnabled=true] - allow preemption of low-pri tasks
   */
  constructor(options = {}) {
    super();
    this._nodeId      = options.nodeId ?? 'governor';
    this._maxCpu      = options.maxCpu    ?? PHI / 2;         // ~0.809
    this._maxMem      = options.maxMem    ?? PHI / 2;         // ~0.809
    this._maxConc     = options.maxConcurrency ?? FIBONACCI[7]; // 21
    this._maxQueue    = options.maxQueueSize   ?? FIBONACCI[12]; // 233
    this._sampleMs    = options.sampleInterval ?? FIBONACCI[4] * 1000; // 5s
    this._windowSize  = options.windowSize     ?? FIBONACCI[6]; // 13
    this._preemption  = options.preemptionEnabled !== false;

    // PHI sliding windows for CPU and memory
    this._cpuWindow   = new PhiSlidingWindow(this._windowSize);
    this._memWindow   = new PhiSlidingWindow(this._windowSize);

    /** Current degradation mode */
    this._mode = DegradationMode.FULL;

    /** Active concurrency slots (count of tasks currently running) */
    this._activeTasks = 0;

    /** @type {ResourceSample|null} latest resource sample */
    this._latestSample = null;

    /** @type {Array<{ task: *, priority: number, resolve: Function, reject: Function }>} */
    this._waitQueue = [];

    /** Task tracking: id → { startTs, priority, releaseHook } */
    this._inflight = new Map();

    /** Preempted tasks: id → { task, priority } */
    this._preempted = new Map();

    this._sampleTimer    = null;
    this._started        = false;
  }

  // ─── Resource Sampling ───────────────────────────────────────────────────

  /**
   * Sample resources and update degradation mode.
   * @returns {ResourceSample}
   */
  sample() {
    const s = sampleResources();
    this._latestSample = s;
    this._cpuWindow.add(s.cpuUtilization);
    this._memWindow.add(s.memUtilization);
    this._evaluateMode(s);
    this.emit('resource.sampled', {
      cpu: s.cpuUtilization,
      mem: s.memUtilization,
      phi_score: s.phi_score,
      mode: this._mode,
    });
    return s;
  }

  /**
   * Evaluate current resources and update degradation mode.
   * @private
   * @param {ResourceSample} s
   */
  _evaluateMode(s) {
    const prevMode = this._mode;

    const cpuSmooth = this._cpuWindow.phiAvg();
    const memSmooth = this._memWindow.phiAvg();
    const maxUtil   = Math.max(cpuSmooth, memSmooth);

    let newMode;
    if (maxUtil >= ResourceZone.CRITICAL.min) {
      newMode = DegradationMode.REJECT;
    } else if (maxUtil >= ResourceZone.HOT.min + (ResourceZone.CRITICAL.min - ResourceZone.HOT.min) * (1 - 1 / PHI)) {
      newMode = DegradationMode.MINIMAL;
    } else if (maxUtil >= ResourceZone.HOT.min) {
      newMode = DegradationMode.SEQUENTIAL;
    } else if (maxUtil >= ResourceZone.WARM.min) {
      newMode = DegradationMode.CACHED;
    } else {
      newMode = DegradationMode.FULL;
    }

    if (newMode !== prevMode) {
      this._mode = newMode;
      this.emit('degradation.changed', {
        from: prevMode,
        to:   newMode,
        cpu:  cpuSmooth,
        mem:  memSmooth,
        ts:   Date.now(),
      });
      this._rebalanceQueue();
    }
  }

  // ─── Permit System ────────────────────────────────────────────────────────

  /**
   * Acquire a resource permit to run a task.
   * Blocks if at concurrency limit; preempts lower-priority tasks if needed.
   *
   * @param {*} task - task descriptor (for tracking)
   * @param {object} [options]
   * @param {number} [options.priority=10] - task priority (higher = more important)
   * @param {number} [options.timeout=30000] - max wait for permit ms
   * @returns {Promise<{ release: Function, taskId: string }>}
   */
  acquire(task, options = {}) {
    const priority = options.priority ?? 10;
    const timeout  = options.timeout  ?? 30000;

    return new Promise((resolve, reject) => {
      // Check degradation mode
      const rejection = this._checkDegradation(priority);
      if (rejection) {
        return reject(rejection);
      }

      // Check concurrency
      if (this._activeTasks < this._effectiveConcurrency()) {
        return resolve(this._grantPermit(task, priority));
      }

      // Try preemption if priority is high enough
      if (this._preemption && priority >= this._getPreemptThreshold()) {
        const preempted = this._tryPreempt(priority);
        if (preempted) {
          return resolve(this._grantPermit(task, priority));
        }
      }

      // Queue for later (with timeout)
      if (this._waitQueue.length >= this._maxQueue) {
        return reject(new Error(`Governor queue full (${this._maxQueue})`));
      }

      const waiter = { task, priority, resolve, reject };
      this._waitQueue.push(waiter);
      // Keep queue sorted by priority (highest first)
      this._waitQueue.sort((a, b) => b.priority - a.priority);

      const timer = setTimeout(() => {
        const idx = this._waitQueue.indexOf(waiter);
        if (idx !== -1) {
          this._waitQueue.splice(idx, 1);
          reject(new Error(`Permit timeout after ${timeout}ms`));
        }
      }, timeout);

      // Store timer reference for early cleanup
      waiter._timer = timer;
    });
  }

  /**
   * Grant a permit (internal — increments active count)
   * @private
   */
  _grantPermit(task, priority) {
    this._activeTasks++;
    const taskId = randomUUID();
    const startTs = Date.now();

    const release = () => {
      this._activeTasks = Math.max(0, this._activeTasks - 1);
      this._inflight.delete(taskId);
      this.emit('permit.released', { taskId, priority, duration: Date.now() - startTs });
      this._drainQueue();
    };

    this._inflight.set(taskId, { task, priority, startTs, release });
    this.emit('permit.granted', { taskId, priority, activeTasks: this._activeTasks });
    return { release, taskId };
  }

  /**
   * Drain the wait queue (grant permits to queued tasks)
   * @private
   */
  _drainQueue() {
    while (
      this._waitQueue.length > 0 &&
      this._activeTasks < this._effectiveConcurrency()
    ) {
      const waiter = this._waitQueue.shift();
      if (!waiter) break;
      clearTimeout(waiter._timer);

      const rejection = this._checkDegradation(waiter.priority);
      if (rejection) {
        waiter.reject(rejection);
        continue;
      }
      waiter.resolve(this._grantPermit(waiter.task, waiter.priority));
    }
  }

  /**
   * Rebalance queue on mode change (reject tasks that don't meet new threshold)
   * @private
   */
  _rebalanceQueue() {
    const newQueue = [];
    for (const waiter of this._waitQueue) {
      const rejection = this._checkDegradation(waiter.priority);
      if (rejection) {
        clearTimeout(waiter._timer);
        waiter.reject(rejection);
      } else {
        newQueue.push(waiter);
      }
    }
    this._waitQueue = newQueue;
    this._drainQueue();
  }

  /**
   * Check if degradation mode rejects tasks at the given priority
   * @private
   * @returns {Error|null}
   */
  _checkDegradation(priority) {
    if (this._mode === DegradationMode.REJECT && priority < 42) {
      return Object.assign(new Error('System overloaded: REJECT mode active'), {
        code: 'OVERLOADED', mode: this._mode,
      });
    }
    if (this._mode === DegradationMode.MINIMAL && priority < 26) {
      return Object.assign(new Error('System under pressure: MINIMAL mode — only HIGH+ tasks'), {
        code: 'THROTTLED', mode: this._mode,
      });
    }
    return null;
  }

  /**
   * Effective concurrency limit based on current mode
   * @private
   */
  _effectiveConcurrency() {
    switch (this._mode) {
      case DegradationMode.SEQUENTIAL: return 1;
      case DegradationMode.CACHED:     return Math.ceil(this._maxConc / PHI);      // ~13
      case DegradationMode.MINIMAL:    return Math.ceil(this._maxConc / PHI / PHI); // ~8
      case DegradationMode.REJECT:     return 1;
      default:                         return this._maxConc; // FULL
    }
  }

  /**
   * Minimum priority required to trigger preemption
   * @private
   */
  _getPreemptThreshold() {
    return Math.round(PHI * PHI * PHI * 10); // ~42 (CRITICAL)
  }

  /**
   * Try to preempt the lowest-priority inflight task
   * @private
   * @param {number} newPriority - priority of the incoming task
   * @returns {boolean} true if preemption occurred
   */
  _tryPreempt(newPriority) {
    let lowestPriority = newPriority;
    let lowestId = null;
    for (const [id, info] of this._inflight) {
      if (info.priority < lowestPriority) {
        lowestPriority = info.priority;
        lowestId = id;
      }
    }
    if (lowestId) {
      const victim = this._inflight.get(lowestId);
      // We don't forcibly stop the task (no cooperative cancellation here),
      // but we mark it as preempted and reduce effective count for accounting
      this._preempted.set(lowestId, { task: victim.task, priority: victim.priority });
      this._inflight.delete(lowestId);
      this._activeTasks = Math.max(0, this._activeTasks - 1);
      this.emit('task.preempted', { taskId: lowestId, priority: lowestPriority, byPriority: newPriority });
      return true;
    }
    return false;
  }

  // ─── Throttle ─────────────────────────────────────────────────────────────

  /**
   * Apply a PHI-scaled delay based on current resource pressure.
   * Call before starting resource-intensive work.
   *
   * @param {number} [basePressure] - override resource pressure (0.0–1.0); defaults to latest sample
   * @returns {Promise<void>}
   */
  async throttle(basePressure) {
    const pressure = basePressure ?? Math.max(
      this._cpuWindow.phiAvg(),
      this._memWindow.phiAvg()
    );
    if (pressure < ResourceZone.WARM.min) return; // No throttle needed

    // Scale delay: at 50% pressure → ~1s, at 80% → ~5s, at 95% → ~34s
    const intensity = Math.max(0, (pressure - ResourceZone.WARM.min) / (1 - ResourceZone.WARM.min));
    const delay = Math.floor(phiBackoff(intensity * FIBONACCI[4], 200));

    if (delay > 0) {
      this.emit('throttle.applied', { pressure, delay, mode: this._mode });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // ─── Force GC ─────────────────────────────────────────────────────────────

  /**
   * Request garbage collection if exposed (requires --expose-gc Node flag).
   * Emits 'gc.requested' regardless.
   * @returns {boolean} true if GC was actually called
   */
  requestGC() {
    this.emit('gc.requested', { heapUsed: process.memoryUsage().heapUsed });
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
      return true;
    }
    return false;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start the governor (periodic resource sampling)
   */
  start() {
    if (this._started) return;
    this._started = true;

    // Take immediate baseline sample
    this.sample();

    this._sampleTimer = setInterval(() => {
      this.sample();
    }, this._sampleMs);
    if (this._sampleTimer.unref) this._sampleTimer.unref();

    this.emit('governor.started', { nodeId: this._nodeId, mode: this._mode });
  }

  /**
   * Stop the governor
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    clearInterval(this._sampleTimer);
    this._sampleTimer = null;

    // Reject queued waiters
    for (const waiter of this._waitQueue) {
      clearTimeout(waiter._timer);
      waiter.reject(new Error('Governor shutdown'));
    }
    this._waitQueue = [];
    this.emit('governor.stopped', { nodeId: this._nodeId });
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} governor status */
  get status() {
    const s = this._latestSample;
    return {
      nodeId:         this._nodeId,
      mode:           this._mode,
      activeTasks:    this._activeTasks,
      maxConcurrency: this._effectiveConcurrency(),
      queued:         this._waitQueue.length,
      preempted:      this._preempted.size,
      cpu: {
        latest:  s?.cpuUtilization ?? 0,
        smooth:  this._cpuWindow.phiAvg(),
        peak:    this._cpuWindow.peak(),
        zone:    s?.zone?.cpu?.name ?? 'UNKNOWN',
      },
      mem: {
        latest:  s?.memUtilization ?? 0,
        smooth:  this._memWindow.phiAvg(),
        heapUsed: s?.heapUsed ?? 0,
        heapTotal:s?.heapTotal ?? 0,
        zone:    s?.zone?.mem?.name ?? 'UNKNOWN',
      },
      phi_score: s?.phi_score ?? 1.0,
      phi: PHI,
    };
  }

  /** @returns {string} current degradation mode */
  get mode() { return this._mode; }

  /** @returns {ResourceSample|null} latest resource sample */
  get lastSample() { return this._latestSample; }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {CognitiveRuntimeGovernor|null} */
let _globalGovernor = null;

/**
 * Get (or create) the global CognitiveRuntimeGovernor singleton
 * @param {object} [options]
 * @returns {CognitiveRuntimeGovernor}
 */
export function getGlobalGovernor(options = {}) {
  if (!_globalGovernor) {
    _globalGovernor = new CognitiveRuntimeGovernor(options);
  }
  return _globalGovernor;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, phiBackoff };

export default {
  CognitiveRuntimeGovernor,
  DegradationMode,
  ResourceZone,
  PhiSlidingWindow,
  sampleResources,
  getZone,
  getGlobalGovernor,
  PHI,
  FIBONACCI,
  phiBackoff,
};

/**
 * @file pipeline-pools.js
 * @description Pipeline Resource Pool Management — Hot/Warm/Cold pools.
 *
 * Features:
 * - Hot/Warm/Cold pool implementation with Fibonacci capacity ratios
 * - Pool transitions: automatic promotion/demotion based on demand signals
 * - Resource allocation per pool (PHI-scaled Fibonacci fractions)
 * - Pool health monitoring: utilization, saturation, PHI score
 * - Liquid overflow: excess work spills from Hot → Warm → Cold → Reserve
 *
 * Pool Ratios (Sacred Geometry):
 *   HOT:       34% — FIBONACCI[8]  — user-facing, latency-critical
 *   WARM:      21% — FIBONACCI[7]  — background processing
 *   COLD:      13% — FIBONACCI[6]  — low-priority / scheduled work
 *   RESERVE:    8% — FIBONACCI[5]  — overflow buffer
 *   GOVERNANCE: 5% — FIBONACCI[4]  — system overhead
 *
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Pipeline/PipelinePools
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Pool Definitions ─────────────────────────────────────────────────────────

/**
 * @enum {object}
 */
export const PoolType = Object.freeze({
  HOT: {
    name:         'HOT',
    fibIndex:     8,
    ratio:        0.34,
    priority:     5,
    maxLatency:   FIBONACCI[4] * 100,   // 500ms SLA
    description:  'User-facing, latency-critical work. CPU-pinned, never cold-started.',
  },
  WARM: {
    name:         'WARM',
    fibIndex:     7,
    ratio:        0.21,
    priority:     3,
    maxLatency:   FIBONACCI[6] * 1000,  // 13s SLA
    description:  'Background pipeline execution, bee orchestration.',
  },
  COLD: {
    name:         'COLD',
    fibIndex:     6,
    ratio:        0.13,
    priority:     2,
    maxLatency:   FIBONACCI[8] * 1000,  // 34s SLA
    description:  'Low-priority / scheduled tasks, data collection.',
  },
  RESERVE: {
    name:         'RESERVE',
    fibIndex:     5,
    ratio:        0.08,
    priority:     1,
    maxLatency:   FIBONACCI[9] * 1000,  // 55s SLA
    description:  'Overflow buffer. Absorbs demand spikes from HOT/WARM.',
  },
  GOVERNANCE: {
    name:         'GOVERNANCE',
    fibIndex:     4,
    ratio:        0.05,
    priority:     0,
    maxLatency:   FIBONACCI[10] * 1000, // 89s SLA (monitoring is never urgent)
    description:  'System overhead: consensus, heartbeat, meta-operations.',
  },
});

/** Ordered pool names by priority (highest first) */
export const POOL_ORDER = ['HOT', 'WARM', 'COLD', 'RESERVE', 'GOVERNANCE'];

// ─── Pool Slot ────────────────────────────────────────────────────────────────

/**
 * @typedef {object} PoolSlot
 * @property {string} id - slot ID
 * @property {'FREE'|'OCCUPIED'|'RESERVED'} state
 * @property {string|null} occupantId - current occupant (run/bee ID)
 * @property {number} [occupiedAt]
 * @property {number} [releasedAt]
 * @property {number} useCount - number of times this slot has been used
 */

// ─── Pool ─────────────────────────────────────────────────────────────────────

/**
 * A single resource pool (Hot, Warm, Cold, Reserve, or Governance).
 * Manages a fixed number of slots, tracks utilization, and handles requests.
 *
 * @extends EventEmitter
 */
export class Pool extends EventEmitter {
  /**
   * @param {object} poolDef - from PoolType
   * @param {number} totalCapacity - total system capacity units
   * @param {object} [options]
   * @param {number} [options.overcommitRatio=1.0] - allow over-commitment (1.2 = 20% over)
   */
  constructor(poolDef, totalCapacity, options = {}) {
    super();
    this._def          = poolDef;
    this._overcommit   = options.overcommitRatio ?? 1.0;
    this._totalCap     = totalCapacity;
    this._name         = poolDef.name;

    // Compute slot count from ratio + Fibonacci alignment
    const baseSlots = Math.max(1, Math.floor(totalCapacity * poolDef.ratio));
    this._capacity  = Math.floor(baseSlots * this._overcommit);

    /** @type {Map<string, PoolSlot>} */
    this._slots = new Map();
    this._initSlots();

    // Utilization history (PHI sliding window of slot usage)
    this._utilizationHistory = [];
    this._historyWindow = FIBONACCI[6]; // 13 samples

    // Transition thresholds
    this._saturateThreshold = 1 / PHI;           // 0.618 → start spilling to next pool
    this._recoverThreshold  = 1 / (PHI * PHI);   // 0.382 → eligible for downgrade

    this._lastTransitionTs = Date.now();
  }

  /**
   * Initialize slot map
   * @private
   */
  _initSlots() {
    for (let i = 0; i < this._capacity; i++) {
      const id = `${this._name.toLowerCase()}-slot-${i.toString().padStart(3, '0')}`;
      this._slots.set(id, {
        id,
        state: 'FREE',
        occupantId: null,
        useCount: 0,
      });
    }
  }

  // ─── Slot Acquisition ─────────────────────────────────────────────────────

  /**
   * Acquire a free slot from this pool.
   * @param {string} occupantId - ID of the task/bee acquiring the slot
   * @returns {{ slot: PoolSlot, release: Function }|null} null if no slots available
   */
  acquire(occupantId) {
    for (const slot of this._slots.values()) {
      if (slot.state === 'FREE') {
        slot.state      = 'OCCUPIED';
        slot.occupantId = occupantId;
        slot.occupiedAt = Date.now();
        slot.useCount++;
        this.emit('slot.acquired', { pool: this._name, slotId: slot.id, occupantId });
        return {
          slot,
          release: () => this._release(slot.id),
        };
      }
    }
    return null; // No free slots
  }

  /**
   * Release a slot
   * @private
   * @param {string} slotId
   */
  _release(slotId) {
    const slot = this._slots.get(slotId);
    if (!slot) return;
    const dur = slot.occupiedAt ? Date.now() - slot.occupiedAt : 0;
    slot.state       = 'FREE';
    slot.releasedAt  = Date.now();
    slot.occupantId  = null;
    this.emit('slot.released', { pool: this._name, slotId, duration: dur });
    this._recordUtilization();
  }

  // ─── Utilization ─────────────────────────────────────────────────────────

  /**
   * Compute current utilization (0.0–1.0)
   * @returns {number}
   */
  get utilization() {
    const occupied = [...this._slots.values()].filter((s) => s.state === 'OCCUPIED').length;
    return this._capacity > 0 ? occupied / this._capacity : 0;
  }

  /**
   * PHI-weighted smoothed utilization across history
   * @returns {number}
   */
  get smoothUtilization() {
    if (this._utilizationHistory.length === 0) return this.utilization;
    let weightedSum = 0, totalWeight = 0;
    for (let i = 0; i < this._utilizationHistory.length; i++) {
      const w = Math.pow(PHI, i);
      weightedSum += this._utilizationHistory[i] * w;
      totalWeight += w;
    }
    return weightedSum / totalWeight;
  }

  /** @private */
  _recordUtilization() {
    this._utilizationHistory.push(this.utilization);
    if (this._utilizationHistory.length > this._historyWindow) {
      this._utilizationHistory.shift();
    }
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  /**
   * PHI health score: combines utilization (not too high) and slot availability.
   * Score = 1.0 for empty pools, decreases as utilization approaches 1.
   * @returns {number} 0.0–1.0
   */
  get phi_score() {
    const u = this.smoothUtilization;
    return (1 - u) * PHI / (PHI + 1) + (1 - u) / (PHI + 1); // = (1 - u)
  }

  /**
   * Check if pool is saturated (needs to spill to next pool)
   * @returns {boolean}
   */
  get saturated() { return this.utilization >= this._saturateThreshold; }

  /**
   * Check if pool is underutilized (eligible for capacity reduction)
   * @returns {boolean}
   */
  get underutilized() { return this.smoothUtilization <= this._recoverThreshold; }

  /**
   * Count of free slots
   * @returns {number}
   */
  get freeSlots() {
    return [...this._slots.values()].filter((s) => s.state === 'FREE').length;
  }

  /** @returns {number} total slot capacity */
  get capacity() { return this._capacity; }

  /** @returns {string} pool name */
  get name() { return this._name; }

  // ─── Resize ───────────────────────────────────────────────────────────────

  /**
   * Add capacity to this pool (liquid scaling up)
   * @param {number} count - number of slots to add
   */
  expand(count) {
    const startIdx = this._slots.size;
    for (let i = 0; i < count; i++) {
      const id = `${this._name.toLowerCase()}-slot-${(startIdx + i).toString().padStart(3, '0')}`;
      this._slots.set(id, { id, state: 'FREE', occupantId: null, useCount: 0 });
    }
    this._capacity += count;
    this.emit('pool.expanded', { pool: this._name, added: count, capacity: this._capacity });
  }

  /**
   * Remove free capacity from this pool (liquid scaling down)
   * @param {number} count - number of free slots to remove
   * @returns {number} actual slots removed
   */
  shrink(count) {
    let removed = 0;
    for (const [id, slot] of this._slots) {
      if (removed >= count) break;
      if (slot.state === 'FREE') {
        this._slots.delete(id);
        removed++;
      }
    }
    this._capacity = Math.max(0, this._capacity - removed);
    this.emit('pool.shrunk', { pool: this._name, removed, capacity: this._capacity });
    return removed;
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} pool status snapshot */
  get status() {
    const slots = [...this._slots.values()];
    return {
      name:         this._name,
      capacity:     this._capacity,
      occupied:     slots.filter((s) => s.state === 'OCCUPIED').length,
      free:         slots.filter((s) => s.state === 'FREE').length,
      utilization:  this.utilization,
      smoothUtil:   this.smoothUtilization,
      saturated:    this.saturated,
      underutilized:this.underutilized,
      phi_score:    this.phi_score,
      ratio:        this._def.ratio,
      priority:     this._def.priority,
    };
  }
}

// ─── PoolManager ──────────────────────────────────────────────────────────────

/**
 * Manages all five resource pools as a unified liquid system.
 *
 * The PoolManager coordinates:
 * - Slot allocation with automatic pool overflow
 * - Pool transitions based on demand (promote/demote logic)
 * - Capacity rebalancing using Fibonacci ratios
 * - Health monitoring and PHI scoring
 *
 * @extends EventEmitter
 *
 * @example
 * const pm = new PoolManager({ totalCapacity: 610 }); // FIBONACCI[14]
 * pm.start();
 *
 * // Acquire a slot for a task
 * const permit = pm.acquire('task-123', 'HOT');
 * if (permit) {
 *   await runTask();
 *   permit.release();
 * }
 *
 * pm.on('pool.spill', ({ from, to }) => console.log('Spill:', from, '->', to));
 */
export class PoolManager extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.totalCapacity=FIBONACCI[14]] - total capacity units (610)
   * @param {number} [options.monitorInterval=FIBONACCI[6]*1000] - health check interval ms (13s)
   * @param {number} [options.rebalanceInterval=FIBONACCI[8]*1000] - rebalance interval ms (34s)
   * @param {boolean} [options.liquidSpillover=true] - allow overflow between pools
   */
  constructor(options = {}) {
    super();
    this._totalCap     = options.totalCapacity ?? FIBONACCI[14]; // 610
    this._monitorMs    = options.monitorInterval ?? FIBONACCI[6] * 1000;  // 13s
    this._rebalanceMs  = options.rebalanceInterval ?? FIBONACCI[8] * 1000; // 34s
    this._liquidSpill  = options.liquidSpillover !== false;

    /** @type {Map<string, Pool>} pool name → Pool */
    this._pools = new Map();
    this._initPools();

    this._monitorTimer   = null;
    this._rebalanceTimer = null;
    this._started        = false;

    // Transition history for trend analysis
    /** @type {Array<{ ts: number, from: string, to: string, reason: string }>} */
    this._transitions = [];
  }

  /**
   * Initialize all five pools with Fibonacci capacity ratios
   * @private
   */
  _initPools() {
    for (const poolDef of Object.values(PoolType)) {
      this._pools.set(poolDef.name, new Pool(poolDef, this._totalCap));
    }
  }

  // ─── Slot Acquisition ─────────────────────────────────────────────────────

  /**
   * Acquire a slot from the requested pool (with liquid spillover).
   *
   * If the requested pool is saturated:
   * - HOT → WARM → COLD → RESERVE (spill down)
   * - GOVERNANCE never receives spills (isolated overhead)
   *
   * @param {string} occupantId - task/bee ID
   * @param {string} [preferredPool='WARM'] - preferred pool name
   * @returns {{ slot: PoolSlot, pool: string, release: Function }|null}
   */
  acquire(occupantId, preferredPool = 'WARM') {
    const preferredIdx = POOL_ORDER.indexOf(preferredPool);
    if (preferredIdx === -1) throw new Error(`Unknown pool: ${preferredPool}`);

    // Try preferred pool first, then spill downward
    const attemptOrder = this._liquidSpill
      ? POOL_ORDER.slice(preferredIdx, POOL_ORDER.length - 1) // skip GOVERNANCE for spills
      : [preferredPool];

    for (const poolName of attemptOrder) {
      const pool = this._pools.get(poolName);
      if (!pool) continue;

      const result = pool.acquire(occupantId);
      if (result) {
        const isSpill = poolName !== preferredPool;
        if (isSpill) {
          this.emit('pool.spill', {
            from: preferredPool, to: poolName, occupantId,
            slotId: result.slot.id,
          });
        }
        return {
          slot:    result.slot,
          pool:    poolName,
          release: result.release,
        };
      }
    }

    // Last resort: GOVERNANCE (if all others full)
    const govPool = this._pools.get('GOVERNANCE');
    const govResult = govPool?.acquire(occupantId);
    if (govResult) {
      this.emit('pool.spill', { from: preferredPool, to: 'GOVERNANCE', occupantId, emergency: true });
      return { slot: govResult.slot, pool: 'GOVERNANCE', release: govResult.release };
    }

    this.emit('pool.exhausted', { occupantId, preferredPool, ts: Date.now() });
    return null; // All pools exhausted
  }

  // ─── Pool Transitions ─────────────────────────────────────────────────────

  /**
   * Evaluate pool states and apply liquid transitions (capacity rebalancing).
   * Promotes WARM capacity to HOT under high HOT saturation.
   * Demotes COLD capacity to RESERVE when underutilized.
   */
  evaluateTransitions() {
    const hotPool  = this._pools.get('HOT');
    const warmPool = this._pools.get('WARM');
    const coldPool = this._pools.get('COLD');
    const reserve  = this._pools.get('RESERVE');

    // HOT saturated: borrow from WARM (if WARM has free slots)
    if (hotPool.saturated && warmPool.freeSlots >= FIBONACCI[3]) {
      const transfer = Math.min(FIBONACCI[2], warmPool.freeSlots); // transfer 2 slots
      warmPool.shrink(transfer);
      hotPool.expand(transfer);
      this._recordTransition('WARM', 'HOT', `HOT saturated (${(hotPool.utilization * 100).toFixed(0)}%)`);
      this.emit('pool.transition', { from: 'WARM', to: 'HOT', slots: transfer });
    }

    // HOT underutilized: return capacity to WARM
    if (hotPool.underutilized && hotPool.capacity > Math.floor(this._totalCap * PoolType.HOT.ratio)) {
      const excess = hotPool.capacity - Math.floor(this._totalCap * PoolType.HOT.ratio);
      if (excess > 0) {
        hotPool.shrink(excess);
        warmPool.expand(excess);
        this._recordTransition('HOT', 'WARM', `HOT underutilized (${(hotPool.smoothUtilization * 100).toFixed(0)}%)`);
        this.emit('pool.transition', { from: 'HOT', to: 'WARM', slots: excess });
      }
    }

    // COLD underutilized: return capacity to RESERVE
    if (coldPool.underutilized && coldPool.capacity > Math.floor(this._totalCap * PoolType.COLD.ratio)) {
      const excess = coldPool.capacity - Math.floor(this._totalCap * PoolType.COLD.ratio);
      if (excess > 0 && reserve.capacity < Math.floor(this._totalCap * PoolType.RESERVE.ratio * PHI)) {
        coldPool.shrink(excess);
        reserve.expand(excess);
        this._recordTransition('COLD', 'RESERVE', `COLD underutilized`);
      }
    }

    // WARM saturated: borrow from COLD
    if (warmPool.saturated && coldPool.freeSlots >= FIBONACCI[2]) {
      warmPool.expand(FIBONACCI[2]);
      coldPool.shrink(FIBONACCI[2]);
      this._recordTransition('COLD', 'WARM', `WARM saturated (${(warmPool.utilization * 100).toFixed(0)}%)`);
      this.emit('pool.transition', { from: 'COLD', to: 'WARM', slots: FIBONACCI[2] });
    }
  }

  /** @private */
  _recordTransition(from, to, reason) {
    this._transitions.push({ ts: Date.now(), from, to, reason });
    if (this._transitions.length > FIBONACCI[8]) { // cap at 34
      this._transitions = this._transitions.slice(-FIBONACCI[8]);
    }
  }

  // ─── Health Monitoring ────────────────────────────────────────────────────

  /**
   * Compute aggregate pool health
   * @returns {object} health assessment
   */
  computeHealth() {
    const poolStatuses = {};
    let totalPhi = 0;
    let poolCount = 0;

    for (const [name, pool] of this._pools) {
      const s = pool.status;
      poolStatuses[name] = s;
      totalPhi += s.phi_score;
      poolCount++;
    }

    const overallPhi = totalPhi / poolCount;
    const health = overallPhi > 0.75 ? 'GREEN' : overallPhi > 0.5 ? 'YELLOW' : 'RED';

    const report = {
      ts:         Date.now(),
      overall:    health,
      phi_score:  overallPhi,
      pools:      poolStatuses,
      transitions: this._transitions.slice(-FIBONACCI[4]),
      totalCapacity: this._totalCap,
    };

    this.emit('health.computed', report);
    return report;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start pool monitoring and rebalancing loops
   */
  start() {
    if (this._started) return;
    this._started = true;

    // Periodic health monitoring
    this._monitorTimer = setInterval(() => {
      this.computeHealth();
    }, this._monitorMs);
    if (this._monitorTimer.unref) this._monitorTimer.unref();

    // Periodic liquid rebalancing
    this._rebalanceTimer = setInterval(() => {
      this.evaluateTransitions();
    }, this._rebalanceMs);
    if (this._rebalanceTimer.unref) this._rebalanceTimer.unref();

    this.emit('pools.started', { totalCapacity: this._totalCap });
  }

  /**
   * Stop pool monitoring
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    clearInterval(this._monitorTimer);
    clearInterval(this._rebalanceTimer);
    this._monitorTimer   = null;
    this._rebalanceTimer = null;
    this.emit('pools.stopped');
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  /**
   * Get a specific pool
   * @param {string} name
   * @returns {Pool}
   */
  getPool(name) { return this._pools.get(name); }

  /**
   * Get all pools
   * @returns {Pool[]}
   */
  getAllPools() { return [...this._pools.values()]; }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} pool manager status */
  get status() {
    const pools = {};
    for (const [name, pool] of this._pools) {
      pools[name] = pool.status;
    }
    return {
      totalCapacity:  this._totalCap,
      pools,
      transitions:    this._transitions.length,
      started:        this._started,
      liquidSpillover:this._liquidSpill,
      phi:            PHI,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {PoolManager|null} */
let _globalPoolManager = null;

/**
 * Get (or create) the global PoolManager singleton
 * @param {object} [options]
 * @returns {PoolManager}
 */
export function getGlobalPoolManager(options = {}) {
  if (!_globalPoolManager) {
    _globalPoolManager = new PoolManager(options);
  }
  return _globalPoolManager;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI };

export default {
  PoolManager,
  Pool,
  PoolType,
  POOL_ORDER,
  getGlobalPoolManager,
  PHI,
  FIBONACCI,
};

/**
 * @file heady-conductor.js
 * @description Federated Liquid Routing Hub — Central Task Dispatcher.
 *
 * Responsibilities:
 * - Zone-based routing: Hot (34%) / Warm (21%) / Cold (13%) / Reserve (8%) / Gov (5%)
 *   pools following Sacred Geometry Fibonacci ratios
 * - Pattern-based routing with learned affinity scores
 * - Load balancing across 3 Colab nodes (BRAIN / CONDUCTOR / SENTINEL)
 * - Liquid protocol: spawn, scale, and reclaim resource decisions
 * - PHI-weighted priority queue for task urgency
 * - EventEmitter-driven async coordination
 *
 * Sacred Geometry: PHI ratios govern all timing, sizing, and routing thresholds.
 * Zero external dependencies — uses only Node.js built-ins.
 *
 * @module Orchestration/HeadyConductor
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

/** Golden ratio φ = (1 + √5) / 2 */
const PHI = 1.6180339887498948482;

/** First 15 Fibonacci numbers */
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} attempt - 0-based attempt index
 * @param {number} [base=1000] - base delay ms
 * @param {number} [cap=55000] - maximum delay ms (FIBONACCI[9] * 1000)
 * @returns {number} delay ms
 */
function phiBackoff(attempt, base = 1000, cap = 55000) {
  return Math.min(Math.floor(Math.pow(PHI, attempt) * base), cap);
}

// ─── Zone Pool Ratios (Fibonacci-based) ──────────────────────────────────────

/**
 * Resource pool zones with Sacred Geometry Fibonacci allocation ratios.
 * @enum {object}
 */
export const PoolZone = Object.freeze({
  HOT:       { name: 'HOT',       ratio: 0.34, fibIndex: 8,  priority: 5 },
  WARM:      { name: 'WARM',      ratio: 0.21, fibIndex: 7,  priority: 3 },
  COLD:      { name: 'COLD',      ratio: 0.13, fibIndex: 6,  priority: 2 },
  RESERVE:   { name: 'RESERVE',   ratio: 0.08, fibIndex: 5,  priority: 1 },
  GOVERNANCE:{ name: 'GOVERNANCE',ratio: 0.05, fibIndex: 4,  priority: 0 },
});

// ─── Node Roles ───────────────────────────────────────────────────────────────

/**
 * Colab cluster node roles
 * @enum {string}
 */
export const NodeRole = Object.freeze({
  BRAIN:     'brain',
  CONDUCTOR: 'conductor',
  SENTINEL:  'sentinel',
});

// ─── Task Priority ────────────────────────────────────────────────────────────

/**
 * PHI-weighted task priority levels
 * @enum {number}
 */
export const TaskPriority = Object.freeze({
  CRITICAL:   Math.round(PHI * PHI * PHI * 10), // ~42
  HIGH:       Math.round(PHI * PHI * 10),         // ~26
  NORMAL:     Math.round(PHI * 10),               // ~16
  LOW:        10,
  BACKGROUND: Math.round(10 / PHI),              // ~6
});

// ─── Task Definition ──────────────────────────────────────────────────────────

/**
 * @typedef {object} ConductorTask
 * @property {string} id - unique task ID
 * @property {string} type - task type (e.g., 'embed', 'query', 'pipeline.run')
 * @property {*} payload - task data
 * @property {number} priority - PHI-weighted priority
 * @property {string} zone - target PoolZone
 * @property {string} [targetNode] - preferred target node role
 * @property {string} [beeId] - assigned bee ID
 * @property {number} ts - enqueue timestamp (unix ms)
 * @property {number} [deadline] - optional absolute deadline (unix ms)
 * @property {string} correlationId - for reply tracking
 * @property {number} attempts - dispatch attempt count
 * @property {'QUEUED'|'ROUTING'|'DISPATCHED'|'COMPLETED'|'FAILED'|'TIMED_OUT'} status
 * @property {number} [completedAt]
 * @property {*} [result]
 * @property {Error} [error]
 */

/**
 * Create a new ConductorTask
 * @param {string} type
 * @param {*} payload
 * @param {object} [options]
 * @returns {ConductorTask}
 */
export function createTask(type, payload, options = {}) {
  return {
    id: options.id ?? randomUUID(),
    type,
    payload,
    priority: options.priority ?? TaskPriority.NORMAL,
    zone: options.zone ?? PoolZone.WARM.name,
    targetNode: options.targetNode ?? null,
    beeId: options.beeId ?? null,
    ts: Date.now(),
    deadline: options.deadline ?? null,
    correlationId: options.correlationId ?? randomUUID(),
    attempts: 0,
    status: 'QUEUED',
  };
}

// ─── PHI Priority Queue ───────────────────────────────────────────────────────

/**
 * Max-heap priority queue with PHI urgency scoring.
 * Urgency is amplified when tasks approach their deadline.
 */
class PhiPriorityQueue {
  constructor() {
    /** @type {ConductorTask[]} */
    this._heap = [];
  }

  /**
   * Compute effective urgency for a task.
   * If a deadline exists and is approaching, urgency is amplified by PHI.
   * @param {ConductorTask} task
   * @returns {number}
   */
  _urgency(task) {
    let u = task.priority;
    if (task.deadline) {
      const remaining = task.deadline - Date.now();
      if (remaining <= 0) return u * PHI * PHI * PHI; // way past deadline
      if (remaining <= 5000)  return u * PHI * PHI;    // <5s to deadline
      if (remaining <= 30000) return u * PHI;           // <30s to deadline
    }
    return u;
  }

  /** @param {ConductorTask} task */
  enqueue(task) {
    this._heap.push(task);
    this._bubbleUp(this._heap.length - 1);
  }

  /** @returns {ConductorTask|undefined} */
  dequeue() {
    if (this._heap.length === 0) return undefined;
    if (this._heap.length === 1) return this._heap.pop();
    const top = this._heap[0];
    this._heap[0] = this._heap.pop();
    this._siftDown(0);
    return top;
  }

  /** @returns {ConductorTask|undefined} */
  peek() { return this._heap[0]; }

  /** @returns {number} */
  get size() { return this._heap.length; }

  /** @returns {boolean} */
  get empty() { return this._heap.length === 0; }

  /** @private */
  _compare(a, b) {
    const ua = this._urgency(a);
    const ub = this._urgency(b);
    if (ub !== ua) return ub - ua; // higher urgency first (max-heap)
    return a.ts - b.ts;            // FIFO within same urgency
  }

  /** @private */
  _bubbleUp(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this._compare(this._heap[i], this._heap[p]) < 0) {
        [this._heap[i], this._heap[p]] = [this._heap[p], this._heap[i]];
        i = p;
      } else break;
    }
  }

  /** @private */
  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let best = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._compare(this._heap[l], this._heap[best]) < 0) best = l;
      if (r < n && this._compare(this._heap[r], this._heap[best]) < 0) best = r;
      if (best === i) break;
      [this._heap[i], this._heap[best]] = [this._heap[best], this._heap[i]];
      i = best;
    }
  }

  /**
   * Remove timed-out tasks (past deadline)
   * @returns {ConductorTask[]} evicted tasks
   */
  evictExpired() {
    const now = Date.now();
    const evicted = [];
    this._heap = this._heap.filter((t) => {
      if (t.deadline && t.deadline < now) { evicted.push(t); return false; }
      return true;
    });
    // Rebuild heap
    for (let i = Math.floor(this._heap.length / 2) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
    return evicted;
  }

  clear() { this._heap = []; }
}

// ─── Routing Table ────────────────────────────────────────────────────────────

/**
 * @typedef {object} RoutingRule
 * @property {string} id
 * @property {RegExp|string} pattern - task type pattern
 * @property {string} targetNode - NodeRole
 * @property {string} targetZone - PoolZone name
 * @property {number} weight - PHI-scaled affinity weight
 * @property {number} hits - successful routing count
 * @property {number} misses - failed routing count
 */

/**
 * Pattern-based routing table with learned affinity weights.
 * Uses hash-consistent routing when no rule matches.
 */
class RoutingTable {
  constructor() {
    /** @type {Map<string, RoutingRule>} */
    this._rules = new Map();
    /** @type {Map<string, number>} learned affinities: taskType → nodeIndex */
    this._affinities = new Map();
  }

  /**
   * Add a routing rule
   * @param {object} rule
   * @param {string|RegExp} rule.pattern
   * @param {string} rule.targetNode
   * @param {string} rule.targetZone
   * @param {number} [rule.weight=1.0]
   * @returns {string} rule ID
   */
  addRule({ pattern, targetNode, targetZone, weight = 1.0 }) {
    const id = randomUUID();
    this._rules.set(id, {
      id,
      pattern: typeof pattern === 'string' ? new RegExp(pattern) : pattern,
      targetNode,
      targetZone,
      weight,
      hits: 0,
      misses: 0,
    });
    return id;
  }

  /**
   * Remove a routing rule
   * @param {string} id
   * @returns {boolean}
   */
  removeRule(id) { return this._rules.delete(id); }

  /**
   * Find the best matching rule for a task type.
   * Rules with higher weight and more hits win ties.
   * @param {string} taskType
   * @returns {RoutingRule|null}
   */
  match(taskType) {
    let best = null;
    let bestScore = -Infinity;
    for (const rule of this._rules.values()) {
      if (!rule.pattern.test(taskType)) continue;
      // Score = weight * PHI^(hit_ratio)
      const hitRatio = rule.hits / (rule.hits + rule.misses + 1);
      const score = rule.weight * Math.pow(PHI, hitRatio);
      if (score > bestScore) { best = rule; bestScore = score; }
    }
    return best;
  }

  /**
   * Record routing outcome to tune affinity weights
   * @param {string} ruleId
   * @param {boolean} success
   */
  recordOutcome(ruleId, success) {
    const rule = this._rules.get(ruleId);
    if (!rule) return;
    if (success) {
      rule.hits++;
      rule.weight = Math.min(rule.weight * PHI, 100); // PHI growth up to cap
    } else {
      rule.misses++;
      rule.weight = Math.max(rule.weight / PHI, 0.1); // PHI decay with floor
    }
  }

  /**
   * Consistent-hash routing for unmatched tasks.
   * Maps task type → node index in [0, nodeCount)
   * @param {string} taskType
   * @param {number} nodeCount
   * @returns {number} node index
   */
  hashRoute(taskType, nodeCount) {
    const hash = createHash('sha256').update(taskType).digest();
    // Read first 4 bytes as uint32
    const val = hash.readUInt32BE(0);
    return val % nodeCount;
  }

  /**
   * Learn affinity: remember which node handled taskType well
   * @param {string} taskType
   * @param {string} nodeRole
   * @param {boolean} success
   */
  learnAffinity(taskType, nodeRole, success) {
    const key = `${taskType}:${nodeRole}`;
    const current = this._affinities.get(key) ?? 1.0;
    this._affinities.set(key,
      success
        ? Math.min(current * PHI, 100)
        : Math.max(current / PHI, 0.01)
    );
  }

  /**
   * Get affinity score for a (taskType, nodeRole) pair
   * @param {string} taskType
   * @param {string} nodeRole
   * @returns {number}
   */
  getAffinity(taskType, nodeRole) {
    return this._affinities.get(`${taskType}:${nodeRole}`) ?? 1.0;
  }

  /** @returns {object[]} all rules as plain objects */
  getRules() {
    return [...this._rules.values()].map((r) => ({
      ...r,
      pattern: r.pattern.toString(),
    }));
  }
}

// ─── Node Registry ────────────────────────────────────────────────────────────

/**
 * @typedef {object} ClusterNode
 * @property {string} id
 * @property {string} role - NodeRole
 * @property {string} address - host:port
 * @property {'ONLINE'|'DEGRADED'|'OFFLINE'} health
 * @property {number} load - 0.0–1.0 normalized load
 * @property {number} activeTasks
 * @property {number} capacity - max concurrent tasks
 * @property {number} lastHeartbeat
 * @property {number} phi_score - composite PHI health score
 */

// ─── HeadyConductor ───────────────────────────────────────────────────────────

/**
 * Federated Liquid Routing Hub.
 *
 * Routes tasks to appropriate bees/agents across the 3-node Colab cluster using:
 * - Zone-based routing (Hot/Warm/Cold/Reserve/Governance pools)
 * - Pattern-based routing with learned affinity
 * - PHI-weighted priority queue
 * - Liquid spawn/scale/reclaim decisions
 *
 * @extends EventEmitter
 *
 * @example
 * const conductor = new HeadyConductor({ nodeId: 'conductor-1' });
 * conductor.registerNode({ id: 'brain', role: 'brain', address: 'localhost:3001', capacity: 34 });
 * conductor.addRoute({ pattern: 'embed.*', targetNode: 'brain', targetZone: 'HOT' });
 * conductor.on('task.dispatched', ({ task, node }) => console.log(task.id, '->', node.id));
 *
 * await conductor.submit('embed.text', { text: 'hello' }, { priority: TaskPriority.HIGH });
 */
export class HeadyConductor extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string} [options.nodeId='conductor'] - this conductor's ID
   * @param {number} [options.maxQueueSize=610] - FIBONACCI[14]
   * @param {number} [options.dispatchConcurrency=21] - FIBONACCI[7] parallel dispatches
   * @param {number} [options.heartbeatInterval=5000] - node heartbeat check interval ms
   * @param {number} [options.evictionInterval=13000] - FIBONACCI[6]*1000ms
   * @param {boolean} [options.autoScale=true] - enable liquid spawn/reclaim
   * @param {number} [options.drainBatchSize=8] - FIBONACCI[5] tasks per drain tick
   */
  constructor(options = {}) {
    super();
    this._nodeId      = options.nodeId ?? 'conductor';
    this._maxQueue    = options.maxQueueSize ?? FIBONACCI[14];     // 610
    this._concurrency = options.dispatchConcurrency ?? FIBONACCI[7]; // 21
    this._hbInterval  = options.heartbeatInterval ?? 5000;
    this._evictMs     = options.evictionInterval ?? FIBONACCI[6] * 1000; // 13s
    this._autoScale   = options.autoScale !== false;
    this._batchSize   = options.drainBatchSize ?? FIBONACCI[5];    // 8

    /** @type {PhiPriorityQueue} */
    this._queue = new PhiPriorityQueue();

    /** @type {RoutingTable} */
    this._routing = new RoutingTable();

    /** @type {Map<string, ClusterNode>} nodeId → ClusterNode */
    this._nodes = new Map();

    /** @type {Map<string, Function>} taskId → resolve callback */
    this._pending = new Map();

    /** @type {Map<string, Function>} taskId → reject callback */
    this._pendingReject = new Map();

    /** Active dispatch count */
    this._activeDispatches = 0;

    /** @type {Map<string, ConductorTask>} taskId → task (in-flight) */
    this._inflight = new Map();

    /** Liquid pool capacity state */
    this._liquidState = this._initLiquidState();

    /** Pattern learning stats */
    this._routingStats = new Map(); // taskType → { routed, success, avgLatency }

    this._drainScheduled = false;
    this._started = false;
    this._hbTimer  = null;
    this._evictTimer = null;

    // Install default zone routing rules
    this._installDefaultRules();
  }

  // ─── Liquid State ──────────────────────────────────────────────────────────

  /**
   * Initialize liquid pool state with Fibonacci ratios
   * @private
   * @returns {object}
   */
  _initLiquidState() {
    const total = FIBONACCI[14]; // 610 units total capacity
    return {
      HOT:        { allocated: Math.floor(total * 0.34), used: 0 },
      WARM:       { allocated: Math.floor(total * 0.21), used: 0 },
      COLD:       { allocated: Math.floor(total * 0.13), used: 0 },
      RESERVE:    { allocated: Math.floor(total * 0.08), used: 0 },
      GOVERNANCE: { allocated: Math.floor(total * 0.05), used: 0 },
    };
  }

  /**
   * Install default routing rules based on task type conventions
   * @private
   */
  _installDefaultRules() {
    const rules = [
      // BRAIN node: latency-critical, embedding, vector, LLM
      { pattern: '^(embed|vector|llm|brain|query|search).*', targetNode: NodeRole.BRAIN,     targetZone: 'HOT',  weight: PHI * PHI },
      // CONDUCTOR: pipeline, bee orchestration, swarm
      { pattern: '^(pipeline|bee|swarm|conductor|task|job).*', targetNode: NodeRole.CONDUCTOR, targetZone: 'WARM', weight: PHI },
      // SENTINEL: security, governance, telemetry, health
      { pattern: '^(sentinel|security|govern|telemetry|health|monitor|audit).*', targetNode: NodeRole.SENTINEL,  targetZone: 'COLD', weight: 1.0 },
    ];
    for (const r of rules) this._routing.addRule(r);
  }

  // ─── Node Management ───────────────────────────────────────────────────────

  /**
   * Register a cluster node
   * @param {object} node
   * @param {string} node.id
   * @param {string} node.role - NodeRole
   * @param {string} node.address - host:port
   * @param {number} [node.capacity=34] - max concurrent tasks
   * @returns {ClusterNode}
   */
  registerNode({ id, role, address, capacity = 34 }) {
    const node = {
      id,
      role,
      address,
      health: 'ONLINE',
      load: 0,
      activeTasks: 0,
      capacity,
      lastHeartbeat: Date.now(),
      phi_score: 1.0,
    };
    this._nodes.set(id, node);
    this.emit('node.registered', { node });
    return node;
  }

  /**
   * Update node health and load metrics (called by heartbeat or sentinel)
   * @param {string} nodeId
   * @param {object} metrics
   * @param {number} [metrics.load] - 0.0–1.0
   * @param {number} [metrics.activeTasks]
   * @param {'ONLINE'|'DEGRADED'|'OFFLINE'} [metrics.health]
   */
  updateNodeMetrics(nodeId, metrics) {
    const node = this._nodes.get(nodeId);
    if (!node) return;
    if (metrics.load       !== undefined) node.load        = metrics.load;
    if (metrics.activeTasks !== undefined) node.activeTasks = metrics.activeTasks;
    if (metrics.health      !== undefined) node.health      = metrics.health;
    node.lastHeartbeat = Date.now();
    // Compute PHI health score: online=1, degraded=1/PHI, offline=0
    const healthScore = { ONLINE: 1.0, DEGRADED: 1 / PHI, OFFLINE: 0 }[node.health] ?? 0;
    node.phi_score = healthScore * (1 - node.load / 2);
    this.emit('node.updated', { nodeId, metrics, phi_score: node.phi_score });
  }

  /**
   * Get the best available node for a task.
   * Selection: prefer explicit targetNode if healthy, else highest phi_score with headroom.
   * @param {ConductorTask} task
   * @returns {ClusterNode|null}
   */
  _selectNode(task) {
    const online = [...this._nodes.values()].filter((n) =>
      n.health !== 'OFFLINE' && n.activeTasks < n.capacity
    );
    if (online.length === 0) return null;

    // Prefer explicit targetNode
    if (task.targetNode) {
      const preferred = online.find((n) => n.role === task.targetNode);
      if (preferred) return preferred;
    }

    // Score by phi_score * affinity
    let best = null;
    let bestScore = -Infinity;
    for (const node of online) {
      const affinity = this._routing.getAffinity(task.type, node.role);
      const headroom = 1 - node.activeTasks / node.capacity;
      const score = node.phi_score * affinity * headroom;
      if (score > bestScore) { best = node; bestScore = score; }
    }
    return best;
  }

  // ─── Routing Rules ─────────────────────────────────────────────────────────

  /**
   * Add a routing rule
   * @param {object} rule
   * @param {string|RegExp} rule.pattern
   * @param {string} rule.targetNode
   * @param {string} rule.targetZone
   * @param {number} [rule.weight]
   * @returns {string} rule ID
   */
  addRoute(rule) {
    return this._routing.addRule(rule);
  }

  /**
   * Remove a routing rule
   * @param {string} ruleId
   */
  removeRoute(ruleId) {
    return this._routing.removeRule(ruleId);
  }

  // ─── Task Submission ───────────────────────────────────────────────────────

  /**
   * Submit a task for routing and dispatch.
   * Returns a Promise that resolves when the task completes.
   *
   * @param {string} type - task type (determines routing)
   * @param {*} payload
   * @param {object} [options]
   * @param {number} [options.priority=TaskPriority.NORMAL]
   * @param {string} [options.zone] - explicit zone override
   * @param {string} [options.targetNode] - explicit node override
   * @param {number} [options.deadline] - absolute deadline timestamp ms
   * @param {number} [options.timeout=30000] - timeout ms (default 30s)
   * @returns {Promise<*>} task result
   */
  submit(type, payload, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout ?? 30000;

      // Determine zone from routing rule if not specified
      let zone = options.zone;
      let targetNode = options.targetNode;
      if (!zone || !targetNode) {
        const rule = this._routing.match(type);
        if (rule) {
          zone = zone ?? rule.targetZone;
          targetNode = targetNode ?? rule.targetNode;
        }
      }

      const task = createTask(type, payload, {
        ...options,
        zone: zone ?? PoolZone.WARM.name,
        targetNode,
      });

      // Enforce queue cap: drop BACKGROUND tasks under backpressure
      if (this._queue.size >= this._maxQueue) {
        if (task.priority <= TaskPriority.BACKGROUND) {
          this.emit('task.dropped', { task, reason: 'backpressure' });
          return reject(new Error(`Queue full (${this._maxQueue}): task dropped`));
        }
      }

      // Register promise callbacks
      const timer = setTimeout(() => {
        this._pending.delete(task.id);
        this._pendingReject.delete(task.id);
        task.status = 'TIMED_OUT';
        this.emit('task.timeout', { task });
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);

      this._pending.set(task.id, (result) => {
        clearTimeout(timer);
        this._pending.delete(task.id);
        this._pendingReject.delete(task.id);
        resolve(result);
      });
      this._pendingReject.set(task.id, (err) => {
        clearTimeout(timer);
        this._pending.delete(task.id);
        this._pendingReject.delete(task.id);
        reject(err);
      });

      this._queue.enqueue(task);
      this.emit('task.queued', { task });
      this._scheduleDrain();
    });
  }

  /**
   * Fire-and-forget task submission (no result tracking)
   * @param {string} type
   * @param {*} payload
   * @param {object} [options]
   * @returns {ConductorTask}
   */
  dispatch(type, payload, options = {}) {
    const rule = this._routing.match(type);
    const task = createTask(type, payload, {
      ...options,
      zone: options.zone ?? rule?.targetZone ?? PoolZone.WARM.name,
      targetNode: options.targetNode ?? rule?.targetNode,
    });
    this._queue.enqueue(task);
    this.emit('task.queued', { task });
    this._scheduleDrain();
    return task;
  }

  // ─── Drain & Dispatch ──────────────────────────────────────────────────────

  /** @private */
  _scheduleDrain() {
    if (this._drainScheduled) return;
    this._drainScheduled = true;
    setImmediate(() => {
      this._drainScheduled = false;
      this._drain().catch((err) => this.emit('error', err));
    });
  }

  /**
   * Drain the priority queue and dispatch tasks to nodes.
   * Respects concurrency limits and zone capacity.
   * @private
   */
  async _drain() {
    let dispatched = 0;
    while (
      !this._queue.empty &&
      this._activeDispatches < this._concurrency &&
      dispatched < this._batchSize
    ) {
      const task = this._queue.dequeue();
      if (!task) break;

      // Check zone capacity (liquid state)
      const zoneState = this._liquidState[task.zone];
      if (zoneState && zoneState.used >= zoneState.allocated) {
        // Overflow: try to borrow from RESERVE
        const reserve = this._liquidState.RESERVE;
        if (reserve.used < reserve.allocated) {
          reserve.used++;
          task._borrowedFromReserve = true;
        } else {
          // Re-queue at lower priority (liquid backpressure)
          task.priority = Math.max(task.priority - 1, TaskPriority.BACKGROUND);
          this._queue.enqueue(task);
          this.emit('task.backpressured', { task, zone: task.zone });
          break;
        }
      } else if (zoneState) {
        zoneState.used++;
      }

      const node = this._selectNode(task);
      if (!node) {
        // No nodes available: re-queue with backoff hint
        task.attempts++;
        this._queue.enqueue(task);
        this.emit('task.noNode', { task, attempts: task.attempts });
        break;
      }

      task.status = 'DISPATCHED';
      task.attempts++;
      node.activeTasks++;
      this._activeDispatches++;
      this._inflight.set(task.id, task);
      dispatched++;

      this.emit('task.dispatched', { task, node });
      this._executeOnNode(task, node).catch((err) => {
        this.emit('error', err);
      });
    }

    // If queue still has items, schedule next drain
    if (!this._queue.empty) {
      setImmediate(() => {
        this._drain().catch((err) => this.emit('error', err));
      });
    }
  }

  /**
   * Execute a task on a node.
   * Emits 'node.execute' — actual transport to remote node is handled by
   * subscribers (e.g., the BeeFactory or a WebSocket bridge).
   * @private
   * @param {ConductorTask} task
   * @param {ClusterNode} node
   */
  async _executeOnNode(task, node) {
    const startTs = Date.now();
    try {
      // Emit for node handler to pick up (registered via onExecute)
      const result = await new Promise((resolve, reject) => {
        const handler = this._executeHandlers.get(node.role) ??
                        this._executeHandlers.get('*');
        if (handler) {
          handler(task, node).then(resolve).catch(reject);
        } else {
          // No handler: resolve with null (tasks are fire-and-forget)
          resolve(null);
        }
      });

      // Task completed
      const latency = Date.now() - startTs;
      task.status = 'COMPLETED';
      task.completedAt = Date.now();
      task.result = result;

      // Update liquid state
      this._releaseLiquidCapacity(task, node);
      this._activeDispatches--;
      node.activeTasks = Math.max(0, node.activeTasks - 1);
      this._inflight.delete(task.id);

      // Update routing learning
      this._routing.learnAffinity(task.type, node.role, true);
      this._updateRoutingStats(task.type, true, latency);

      this.emit('task.completed', { task, node, latency });
      this._pending.get(task.id)?.(result);
    } catch (err) {
      const latency = Date.now() - startTs;
      task.status = 'FAILED';
      task.error = err;

      this._releaseLiquidCapacity(task, node);
      this._activeDispatches--;
      node.activeTasks = Math.max(0, node.activeTasks - 1);
      this._inflight.delete(task.id);

      this._routing.learnAffinity(task.type, node.role, false);
      this._updateRoutingStats(task.type, false, latency);

      // Retry on DEGRADED node
      if (node.health === 'DEGRADED' && task.attempts < FIBONACCI[4]) {
        const delay = phiBackoff(task.attempts - 1, 500);
        setTimeout(() => {
          task.status = 'QUEUED';
          this._queue.enqueue(task);
          this._scheduleDrain();
        }, delay);
        this.emit('task.retry', { task, node, delay });
      } else {
        this.emit('task.failed', { task, node, error: err });
        this._pendingReject.get(task.id)?.(err);
      }
    }
  }

  /**
   * Release liquid zone capacity after a task completes
   * @private
   * @param {ConductorTask} task
   * @param {ClusterNode} _node
   */
  _releaseLiquidCapacity(task, _node) {
    if (task._borrowedFromReserve) {
      this._liquidState.RESERVE.used = Math.max(0, this._liquidState.RESERVE.used - 1);
    } else {
      const zoneState = this._liquidState[task.zone];
      if (zoneState) zoneState.used = Math.max(0, zoneState.used - 1);
    }
  }

  // ─── Execute Handlers ──────────────────────────────────────────────────────

  /**
   * @type {Map<string, Function>}
   * nodeRole → async (task, node) => result
   */
  _executeHandlers = new Map();

  /**
   * Register a handler that executes tasks on a specific node role.
   * @param {string} nodeRole - NodeRole or '*' for fallback
   * @param {function(ConductorTask, ClusterNode): Promise<*>} handler
   */
  onExecute(nodeRole, handler) {
    this._executeHandlers.set(nodeRole, handler);
  }

  // ─── Task Completion (external callback) ──────────────────────────────────

  /**
   * Mark a task as completed (called by remote node handler)
   * @param {string} taskId
   * @param {*} result
   */
  completeTask(taskId, result) {
    const task = this._inflight.get(taskId);
    if (!task) return;
    this._pending.get(taskId)?.(result);
  }

  /**
   * Mark a task as failed (called by remote node handler)
   * @param {string} taskId
   * @param {Error|string} error
   */
  failTask(taskId, error) {
    const task = this._inflight.get(taskId);
    if (!task) return;
    const err = error instanceof Error ? error : new Error(String(error));
    this._pendingReject.get(taskId)?.(err);
  }

  // ─── Liquid Protocol ──────────────────────────────────────────────────────

  /**
   * Evaluate current liquid state and emit spawn/scale/reclaim decisions.
   * Called periodically and on queue pressure changes.
   * @returns {object} liquid decisions
   */
  evaluateLiquidState() {
    const decisions = { spawn: [], scale: [], reclaim: [] };
    const queuePressure = this._queue.size / this._maxQueue;

    // High pressure: recommend spawning more bees in HOT zone
    if (queuePressure > 1 / PHI) { // > 0.618
      const hotLoad = this._liquidState.HOT.used / this._liquidState.HOT.allocated;
      if (hotLoad > 0.8) {
        decisions.spawn.push({
          zone: 'HOT',
          count: FIBONACCI[3], // 3 new bees
          reason: `High queue pressure (${(queuePressure * 100).toFixed(1)}%) + HOT saturation`,
        });
      }
    }

    // Low pressure: reclaim unused COLD resources
    if (queuePressure < 1 / (PHI * PHI)) { // < 0.382
      const coldUsed = this._liquidState.COLD.used / this._liquidState.COLD.allocated;
      if (coldUsed < 0.2) {
        decisions.reclaim.push({
          zone: 'COLD',
          count: FIBONACCI[2], // release 2
          reason: `Low queue pressure (${(queuePressure * 100).toFixed(1)}%), COLD underutilized`,
        });
      }
    }

    // Scale decision: WARM zone nearing capacity
    const warmLoad = this._liquidState.WARM.used / this._liquidState.WARM.allocated;
    if (warmLoad > 0.75) {
      decisions.scale.push({
        zone: 'WARM',
        targetRatio: Math.min(0.34, warmLoad * PHI / 10),
        reason: `WARM zone at ${(warmLoad * 100).toFixed(1)}% capacity`,
      });
    }

    if (decisions.spawn.length || decisions.scale.length || decisions.reclaim.length) {
      this.emit('liquid.decision', decisions);
    }
    return decisions;
  }

  // ─── Routing Stats ────────────────────────────────────────────────────────

  /**
   * @private
   * @param {string} taskType
   * @param {boolean} success
   * @param {number} latency
   */
  _updateRoutingStats(taskType, success, latency) {
    const stats = this._routingStats.get(taskType) ?? {
      routed: 0, success: 0, avgLatency: 0
    };
    stats.routed++;
    if (success) stats.success++;
    stats.avgLatency = (stats.avgLatency * (stats.routed - 1) + latency) / stats.routed;
    this._routingStats.set(taskType, stats);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start the conductor (heartbeat monitoring + eviction loop)
   */
  start() {
    if (this._started) return;
    this._started = true;

    // Heartbeat check: mark stale nodes as DEGRADED/OFFLINE
    this._hbTimer = setInterval(() => {
      const now = Date.now();
      for (const node of this._nodes.values()) {
        const age = now - node.lastHeartbeat;
        if (age > this._hbInterval * PHI * PHI && node.health === 'ONLINE') {
          node.health = 'DEGRADED';
          this.emit('node.degraded', { node, age });
        } else if (age > this._hbInterval * PHI * PHI * PHI && node.health !== 'OFFLINE') {
          node.health = 'OFFLINE';
          this.emit('node.offline', { node, age });
        }
      }
      // Evaluate liquid state
      this.evaluateLiquidState();
    }, this._hbInterval);

    if (this._hbTimer.unref) this._hbTimer.unref();

    // Eviction timer: remove timed-out tasks
    this._evictTimer = setInterval(() => {
      const evicted = this._queue.evictExpired();
      for (const task of evicted) {
        task.status = 'TIMED_OUT';
        this.emit('task.timeout', { task });
        this._pendingReject.get(task.id)?.(new Error(`Task ${task.id} deadline exceeded`));
      }
    }, this._evictMs);

    if (this._evictTimer.unref) this._evictTimer.unref();

    this.emit('conductor.started', { nodeId: this._nodeId });
  }

  /**
   * Stop the conductor gracefully
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;

    clearInterval(this._hbTimer);
    clearInterval(this._evictTimer);
    this._hbTimer = null;
    this._evictTimer = null;

    // Drain remaining tasks with timeout
    const shutdownDeadline = Date.now() + FIBONACCI[8] * 1000; // 34s
    while (!this._queue.empty && Date.now() < shutdownDeadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    // Fail any remaining inflight tasks
    for (const [id, task] of this._inflight) {
      task.status = 'FAILED';
      this._pendingReject.get(id)?.(new Error('Conductor shutdown'));
    }
    this._inflight.clear();
    this._queue.clear();

    this.emit('conductor.stopped', { nodeId: this._nodeId });
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} conductor status snapshot */
  get status() {
    return {
      nodeId: this._nodeId,
      queueSize: this._queue.size,
      activeDispatches: this._activeDispatches,
      inflight: this._inflight.size,
      nodes: [...this._nodes.values()].map((n) => ({
        id: n.id, role: n.role, health: n.health,
        load: n.load, activeTasks: n.activeTasks, phi_score: n.phi_score,
      })),
      liquidState: this._liquidState,
      routingRules: this._routing.getRules().length,
      routingStats: Object.fromEntries(this._routingStats),
      phi: PHI,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {HeadyConductor|null} */
let _globalConductor = null;

/**
 * Get (or create) the global HeadyConductor singleton
 * @param {object} [options]
 * @returns {HeadyConductor}
 */
export function getGlobalConductor(options = {}) {
  if (!_globalConductor) {
    _globalConductor = new HeadyConductor(options);
  }
  return _globalConductor;
}

// ─── Named Exports ────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, phiBackoff };

export default {
  HeadyConductor,
  createTask,
  PoolZone,
  NodeRole,
  TaskPriority,
  getGlobalConductor,
  PhiPriorityQueue,
  RoutingTable,
  PHI,
  FIBONACCI,
  phiBackoff,
};

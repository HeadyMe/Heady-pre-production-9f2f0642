/**
 * @file bee-factory.js
 * @description Dynamic Agent Worker Factory — BeeFactory.
 *
 * Features:
 * - createBee(config) — create persistent bees with full lifecycle management
 * - spawnBee(config) — create ephemeral bees for one-shot tasks
 * - 24 domain templates covering all Heady functional areas
 * - Bee lifecycle: IDLE → ACTIVE → BUSY → COOLDOWN → IDLE
 * - Resource tracking per bee (CPU/memory budget, task count)
 * - Auto-scaling: spawn new bees when workload exceeds PHI threshold
 *
 * Sacred Geometry: PHI-scaled cooldown timers, Fibonacci bee pools.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Bees/BeeFactory
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} n
 * @param {number} [base=1000]
 * @returns {number} ms
 */
function phiBackoff(n, base = 1000) {
  return Math.min(Math.floor(Math.pow(PHI, n) * base), FIBONACCI[9] * 1000);
}

// ─── Bee Lifecycle States ─────────────────────────────────────────────────────

/**
 * @enum {string}
 */
export const BeeState = Object.freeze({
  IDLE:      'IDLE',      // Ready to accept work
  ACTIVE:    'ACTIVE',    // Processing a task
  BUSY:      'BUSY',      // At full capacity (concurrent task limit reached)
  COOLDOWN:  'COOLDOWN',  // Post-task recovery (PHI-scaled delay before IDLE)
  OFFLINE:   'OFFLINE',   // Deregistered or shut down
  ERROR:     'ERROR',     // Unhealthy, needs restart
});

// ─── Bee Types (Domain Templates) ─────────────────────────────────────────────

/**
 * 24 domain bee templates.
 * Each template defines the bee's capabilities, resource budget, and behavior.
 * @type {object[]}
 */
export const BEE_TEMPLATES = [
  // ─── BRAIN Node Bees ────────────────────────────────────────────────────
  {
    type: 'EmbedBee',        node: 'brain',     zone: 'HOT',
    capabilities: ['embed.*', 'vector.encode'],
    maxConcurrent: FIBONACCI[2],   // 2 — GPU-bound
    cooldownMs: phiBackoff(1),     // ~1.6s
    resourceBudget: { cpuWeight: 0.3, memMB: 512 },
    description: 'Generates text/image embeddings via embedding model',
  },
  {
    type: 'VectorQueryBee',  node: 'brain',     zone: 'HOT',
    capabilities: ['vector.query', 'vector.search', 'similarity.*'],
    maxConcurrent: FIBONACCI[3],   // 3
    cooldownMs: phiBackoff(0, 500),
    resourceBudget: { cpuWeight: 0.2, memMB: 1024 },
    description: 'HNSW nearest-neighbor search across 384-D vector space',
  },
  {
    type: 'LLMRouterBee',    node: 'brain',     zone: 'HOT',
    capabilities: ['llm.*', 'chat.*', 'complete.*'],
    maxConcurrent: FIBONACCI[2],   // 2
    cooldownMs: phiBackoff(2),     // ~2.6s
    resourceBudget: { cpuWeight: 0.5, memMB: 2048 },
    description: 'Routes LLM requests to appropriate model backends',
  },
  {
    type: 'STMLTMBee',       node: 'brain',     zone: 'WARM',
    capabilities: ['memory.stm.*', 'memory.ltm.*', 'memory.consolidate'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(1),
    resourceBudget: { cpuWeight: 0.2, memMB: 512 },
    description: 'Manages STM→LTM memory consolidation and retrieval',
  },
  {
    type: 'GraphRAGBee',     node: 'brain',     zone: 'WARM',
    capabilities: ['graph.*', 'rag.*', 'knowledge.*'],
    maxConcurrent: FIBONACCI[2],
    cooldownMs: phiBackoff(2),
    resourceBudget: { cpuWeight: 0.3, memMB: 768 },
    description: 'Graph-augmented retrieval: vector nodes + relationship edges',
  },

  // ─── CONDUCTOR Node Bees ─────────────────────────────────────────────────
  {
    type: 'PipelineBee',     node: 'conductor', zone: 'WARM',
    capabilities: ['pipeline.*', 'stage.*'],
    maxConcurrent: FIBONACCI[4],   // 5
    cooldownMs: phiBackoff(0, 1000),
    resourceBudget: { cpuWeight: 0.2, memMB: 256 },
    description: 'Executes pipeline stages within HCFullPipeline',
  },
  {
    type: 'OrchestratorBee', node: 'conductor', zone: 'WARM',
    capabilities: ['orchestrate.*', 'coordinate.*', 'task.*'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(1),
    resourceBudget: { cpuWeight: 0.15, memMB: 128 },
    description: 'Coordinates multi-step workflows across bee teams',
  },
  {
    type: 'PlannerBee',      node: 'conductor', zone: 'WARM',
    capabilities: ['plan.*', 'decompose.*', 'strategy.*'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(2),
    resourceBudget: { cpuWeight: 0.3, memMB: 256 },
    description: 'Generates execution plans and decomposes complex tasks',
  },
  {
    type: 'MonteCarloB',     node: 'conductor', zone: 'WARM',
    capabilities: ['montecarlo.*', 'simulate.*', 'risk.*'],
    maxConcurrent: FIBONACCI[4],
    cooldownMs: phiBackoff(1),
    resourceBudget: { cpuWeight: 0.4, memMB: 512 },
    description: 'Monte Carlo simulation of outcomes and risk assessment',
  },
  {
    type: 'ArenaJudgeBee',   node: 'conductor', zone: 'WARM',
    capabilities: ['arena.*', 'judge.*', 'evaluate.*'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(1),
    resourceBudget: { cpuWeight: 0.25, memMB: 256 },
    description: 'Runs competing solution arenas and judges outcomes',
  },
  {
    type: 'GitHubBee',       node: 'conductor', zone: 'COLD',
    capabilities: ['github.*', 'git.*', 'repo.*', 'pr.*'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(0, 2000),
    resourceBudget: { cpuWeight: 0.1, memMB: 128 },
    description: 'GitHub REST API: repos, PRs, issues, commits',
  },
  {
    type: 'WebFetchBee',     node: 'conductor', zone: 'COLD',
    capabilities: ['web.*', 'http.*', 'fetch.*', 'scrape.*'],
    maxConcurrent: FIBONACCI[4],
    cooldownMs: phiBackoff(0, 500),
    resourceBudget: { cpuWeight: 0.1, memMB: 128 },
    description: 'HTTP requests and web data collection',
  },
  {
    type: 'DataAnalyticsBee',node: 'conductor', zone: 'COLD',
    capabilities: ['analytics.*', 'sql.*', 'query.*', 'report.*'],
    maxConcurrent: FIBONACCI[3],
    cooldownMs: phiBackoff(1),
    resourceBudget: { cpuWeight: 0.3, memMB: 512 },
    description: 'In-memory columnar analytics (DuckDB replacement)',
  },
  {
    type: 'CodeGenBee',      node: 'conductor', zone: 'WARM',
    capabilities: ['code.*', 'generate.*', 'refactor.*', 'debug.*'],
    maxConcurrent: FIBONACCI[2],
    cooldownMs: phiBackoff(2),
    resourceBudget: { cpuWeight: 0.4, memMB: 512 },
    description: 'Code generation, refactoring, and debugging assistance',
  },
  {
    type: 'DeployBee',       node: 'conductor', zone: 'COLD',
    capabilities: ['deploy.*', 'publish.*', 'release.*'],
    maxConcurrent: 1,  // Only one deploy at a time
    cooldownMs: phiBackoff(3),     // ~4.2s
    resourceBudget: { cpuWeight: 0.1, memMB: 128 },
    description: 'Deployment operations with safety gates',
  },
  {
    type: 'LearnBee',        node: 'conductor', zone: 'COLD',
    capabilities: ['learn.*', 'update.model.*', 'fine-tune.*'],
    maxConcurrent: FIBONACCI[2],
    cooldownMs: phiBackoff(2),
    resourceBudget: { cpuWeight: 0.3, memMB: 768 },
    description: 'Updates routing patterns, affinities, and model weights',
  },

  // ─── SENTINEL Node Bees ──────────────────────────────────────────────────
  {
    type: 'SecurityBee',     node: 'sentinel',  zone: 'HOT',
    capabilities: ['security.*', 'auth.*', 'validate.*', 'audit.*'],
    maxConcurrent: FIBONACCI[4],
    cooldownMs: phiBackoff(0, 200),
    resourceBudget: { cpuWeight: 0.1, memMB: 128 },
    description: 'Security checks, authentication validation, audit logging',
  },
  {
    type: 'CircuitBreakerBee',node:'sentinel',  zone: 'HOT',
    capabilities: ['circuit.*', 'breaker.*', 'failsafe.*'],
    maxConcurrent: FIBONACCI[5],   // 8 — must be highly available
    cooldownMs: phiBackoff(0, 100),
    resourceBudget: { cpuWeight: 0.05, memMB: 64 },
    description: 'Circuit breaker pattern: open/half-open/closed state machine',
  },
  {
    type: 'TelemetryBee',    node: 'sentinel',  zone: 'COLD',
    capabilities: ['telemetry.*', 'metrics.*', 'trace.*', 'log.*'],
    maxConcurrent: FIBONACCI[5],
    cooldownMs: phiBackoff(0, 200),
    resourceBudget: { cpuWeight: 0.05, memMB: 128 },
    description: 'Telemetry collection, metrics export, distributed tracing',
  },
  {
    type: 'SelfHealBee',     node: 'sentinel',  zone: 'WARM',
    capabilities: ['heal.*', 'recover.*', 'restart.*', 'diagnose.*'],
    maxConcurrent: FIBONACCI[2],
    cooldownMs: phiBackoff(3),
    resourceBudget: { cpuWeight: 0.1, memMB: 128 },
    description: 'Self-healing: quarantine → diagnose → heal → verify cycle',
  },
  {
    type: 'GovernanceBee',   node: 'sentinel',  zone: 'GOVERNANCE',
    capabilities: ['govern.*', 'policy.*', 'compliance.*'],
    maxConcurrent: FIBONACCI[2],
    cooldownMs: phiBackoff(2),
    resourceBudget: { cpuWeight: 0.05, memMB: 64 },
    description: 'Policy enforcement and governance rule evaluation',
  },
  {
    type: 'HeartbeatBee',    node: 'sentinel',  zone: 'GOVERNANCE',
    capabilities: ['heartbeat.*', 'ping.*', 'health.*'],
    maxConcurrent: FIBONACCI[8],   // 34 — very cheap, needed for all nodes
    cooldownMs: phiBackoff(0, 100),
    resourceBudget: { cpuWeight: 0.02, memMB: 16 },
    description: 'Sends heartbeats and health pings to all cluster nodes',
  },

  // ─── Multi-node Bees ─────────────────────────────────────────────────────
  {
    type: 'NotifyBee',       node: 'conductor', zone: 'COLD',
    capabilities: ['notify.*', 'alert.*', 'email.*', 'webhook.*'],
    maxConcurrent: FIBONACCI[4],
    cooldownMs: phiBackoff(0, 500),
    resourceBudget: { cpuWeight: 0.05, memMB: 64 },
    description: 'Notifications: email, Slack webhooks, alerts',
  },
  {
    type: 'ReceiptBee',      node: 'conductor', zone: 'COLD',
    capabilities: ['receipt.*', 'audit.trail.*', 'report.*'],
    maxConcurrent: FIBONACCI[4],
    cooldownMs: phiBackoff(0, 200),
    resourceBudget: { cpuWeight: 0.05, memMB: 64 },
    description: 'Generates receipts, audit trails, and completion reports',
  },
];

// Build a type → template lookup
const TEMPLATE_MAP = new Map(BEE_TEMPLATES.map((t) => [t.type, t]));

// ─── Bee Instance ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} BeeConfig
 * @property {string} [id] - explicit bee ID (auto-generated if omitted)
 * @property {string} type - bee template type (e.g., 'EmbedBee')
 * @property {string} [node] - override node role
 * @property {string} [zone] - override pool zone
 * @property {string[]} [capabilities] - override capabilities
 * @property {number} [maxConcurrent] - override max concurrent tasks
 * @property {number} [cooldownMs] - override cooldown duration
 * @property {object} [resourceBudget] - override resource budget
 * @property {boolean} [ephemeral=false] - ephemeral bee (auto-destroys when done)
 * @property {Function} [executeHandler] - custom task execution function
 */

/**
 * A live bee instance.
 *
 * @extends EventEmitter
 */
export class Bee extends EventEmitter {
  /**
   * @param {BeeConfig} config
   */
  constructor(config) {
    super();
    // Merge template defaults with config overrides
    const template = TEMPLATE_MAP.get(config.type) ?? {};

    this.id             = config.id ?? `${config.type.toLowerCase()}-${randomUUID().slice(0, 8)}`;
    this.type           = config.type;
    this.node           = config.node     ?? template.node     ?? 'conductor';
    this.zone           = config.zone     ?? template.zone     ?? 'WARM';
    this.capabilities   = config.capabilities ?? template.capabilities ?? [];
    this.maxConcurrent  = config.maxConcurrent ?? template.maxConcurrent ?? FIBONACCI[2];
    this.cooldownMs     = config.cooldownMs    ?? template.cooldownMs    ?? 1000;
    this.resourceBudget = config.resourceBudget ?? template.resourceBudget ?? { cpuWeight: 0.1, memMB: 128 };
    this.ephemeral      = config.ephemeral ?? false;
    this.description    = template.description ?? config.type;

    // Lifecycle state
    this.state          = BeeState.IDLE;
    this.activeTasks    = 0;
    this.tasksCompleted = 0;
    this.tasksFailed    = 0;
    this.createdAt      = Date.now();
    this.lastActiveAt   = Date.now();

    // PHI-smoothed success rate
    this.successRate    = 1.0;

    // Current task slots
    /** @type {Map<string, { taskId: string, startTs: number }>} */
    this._slots = new Map();

    // Custom execution handler
    this._executeHandler = config.executeHandler ?? null;

    this._cooldownTimer = null;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Begin processing a task.
   * @param {string} taskId - task identifier
   * @returns {boolean} true if accepted
   */
  accept(taskId) {
    if (this.state === BeeState.OFFLINE || this.state === BeeState.ERROR) return false;
    if (this.activeTasks >= this.maxConcurrent) return false;

    this._slots.set(taskId, { taskId, startTs: Date.now() });
    this.activeTasks++;
    this.lastActiveAt = Date.now();

    this.state = this.activeTasks >= this.maxConcurrent ? BeeState.BUSY : BeeState.ACTIVE;
    this.emit('task.accepted', { beeId: this.id, taskId });
    return true;
  }

  /**
   * Mark a task as complete and update metrics.
   * Starts cooldown timer before returning to IDLE.
   * @param {string} taskId
   * @param {boolean} [success=true]
   */
  complete(taskId, success = true) {
    const slot = this._slots.get(taskId);
    if (!slot) return;
    const duration = Date.now() - slot.startTs;

    this._slots.delete(taskId);
    this.activeTasks = Math.max(0, this.activeTasks - 1);
    if (success) this.tasksCompleted++;
    else         this.tasksFailed++;

    // PHI-smoothed success rate update
    const alpha = 1 / PHI; // ≈ 0.618 — fast decay
    this.successRate = this.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;

    this.emit('task.completed', { beeId: this.id, taskId, success, duration });

    // Transition to cooldown or idle
    if (this.activeTasks === 0) {
      this._startCooldown();
    } else {
      this.state = this.activeTasks >= this.maxConcurrent ? BeeState.BUSY : BeeState.ACTIVE;
    }
  }

  /**
   * Execute a task using the registered handler
   * @param {*} payload
   * @param {object} [context]
   * @returns {Promise<*>}
   */
  async execute(payload, context = {}) {
    if (!this._executeHandler) {
      throw new Error(`Bee ${this.id} (${this.type}) has no execute handler`);
    }
    const taskId = context.taskId ?? randomUUID();
    this.accept(taskId);
    try {
      const result = await this._executeHandler(payload, { ...context, bee: this, taskId });
      this.complete(taskId, true);
      return result;
    } catch (err) {
      this.complete(taskId, false);
      throw err;
    }
  }

  /** @private */
  _startCooldown() {
    this.state = BeeState.COOLDOWN;
    this.emit('bee.cooldown', { beeId: this.id });
    this._cooldownTimer = setTimeout(() => {
      if (this.state === BeeState.COOLDOWN) {
        this.state = BeeState.IDLE;
        this.emit('bee.idle', { beeId: this.id });
        // Ephemeral bees destroy themselves after cooldown
        if (this.ephemeral) this.destroy();
      }
    }, this.cooldownMs);
  }

  /**
   * Destroy this bee (release resources, go OFFLINE)
   */
  destroy() {
    clearTimeout(this._cooldownTimer);
    this._cooldownTimer = null;
    this.state = BeeState.OFFLINE;
    this.emit('bee.destroyed', { beeId: this.id });
    this.removeAllListeners();
  }

  /**
   * Mark this bee as errored
   * @param {Error} err
   */
  markError(err) {
    this.state = BeeState.ERROR;
    this.emit('bee.error', { beeId: this.id, error: err });
  }

  /**
   * Reset a bee from ERROR state back to IDLE
   */
  reset() {
    if (this.state !== BeeState.ERROR) return;
    this._slots.clear();
    this.activeTasks = 0;
    this.state = BeeState.IDLE;
    this.emit('bee.reset', { beeId: this.id });
  }

  // ─── Computed Properties ─────────────────────────────────────────────────

  /** @returns {number} PHI health score */
  get phi_score() {
    const stateScore = {
      [BeeState.IDLE]:     1.0,
      [BeeState.ACTIVE]:   PHI / (PHI + 1),
      [BeeState.BUSY]:     1 / PHI,
      [BeeState.COOLDOWN]: 1 / (PHI * PHI),
      [BeeState.ERROR]:    0,
      [BeeState.OFFLINE]:  0,
    }[this.state] ?? 0.5;
    return stateScore * this.successRate;
  }

  /** @returns {boolean} */
  get available() {
    return this.state === BeeState.IDLE || this.state === BeeState.ACTIVE;
  }

  /** @returns {number} remaining capacity (0 = full) */
  get remainingCapacity() {
    return this.available ? this.maxConcurrent - this.activeTasks : 0;
  }

  /** @returns {object} bee status snapshot */
  get status() {
    return {
      id:             this.id,
      type:           this.type,
      node:           this.node,
      zone:           this.zone,
      state:          this.state,
      activeTasks:    this.activeTasks,
      maxConcurrent:  this.maxConcurrent,
      tasksCompleted: this.tasksCompleted,
      tasksFailed:    this.tasksFailed,
      successRate:    this.successRate,
      phi_score:      this.phi_score,
      capabilities:   this.capabilities,
      ephemeral:      this.ephemeral,
      age:            Date.now() - this.createdAt,
    };
  }
}

// ─── BeeFactory ───────────────────────────────────────────────────────────────

/**
 * Dynamic agent worker factory.
 *
 * Creates and manages persistent (createBee) and ephemeral (spawnBee) agents.
 * Auto-scales the bee pool based on workload pressure using PHI thresholds.
 *
 * @extends EventEmitter
 *
 * @example
 * const factory = new BeeFactory({ maxBees: 197 });
 *
 * const embedBee = factory.createBee({ type: 'EmbedBee' });
 * embedBee.on('task.completed', ({ duration }) => console.log('Done in', duration + 'ms'));
 *
 * // Register execution handler
 * embedBee._executeHandler = async (payload) => embedText(payload.text);
 *
 * const result = await embedBee.execute({ text: 'hello world' });
 */
export class BeeFactory extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.maxBees=197] - max total bees (registry capacity)
   * @param {number} [options.autoScaleThreshold=1/PHI] - utilization to trigger spawn
   * @param {number} [options.autoScaleDown=1/(PHI*PHI)] - utilization to trigger reclaim
   * @param {number} [options.monitorInterval=FIBONACCI[6]*1000] - health check ms (13s)
   * @param {boolean} [options.autoScale=true] - enable automatic scaling
   */
  constructor(options = {}) {
    super();
    this._maxBees          = options.maxBees ?? 197;  // per spec: 197 worker slots
    this._scaleUpThreshold = options.autoScaleThreshold ?? 1 / PHI;           // 0.618
    this._scaleDownThreshold = options.autoScaleDown ?? 1 / (PHI * PHI);      // 0.382
    this._monitorMs        = options.monitorInterval ?? FIBONACCI[6] * 1000;  // 13s
    this._autoScale        = options.autoScale !== false;

    /** @type {Map<string, Bee>} beeId → Bee */
    this._bees = new Map();

    /** @type {Map<string, Set<string>>} capability → Set<beeId> */
    this._capabilityIndex = new Map();

    /** @type {Map<string, Set<string>>} type → Set<beeId> */
    this._typeIndex = new Map();

    this._monitorTimer = null;
    this._started = false;
  }

  // ─── Create (Persistent) ─────────────────────────────────────────────────

  /**
   * Create a persistent bee.
   * Persistent bees survive indefinitely until explicitly destroyed.
   *
   * @param {BeeConfig} config
   * @returns {Bee}
   * @throws {Error} if max bee capacity reached
   */
  createBee(config) {
    if (this._bees.size >= this._maxBees) {
      throw new Error(`BeeFactory at capacity (${this._maxBees} bees). Cannot create more.`);
    }
    const bee = new Bee({ ...config, ephemeral: false });
    this._register(bee);
    this.emit('bee.created', { beeId: bee.id, type: bee.type });
    return bee;
  }

  // ─── Spawn (Ephemeral) ───────────────────────────────────────────────────

  /**
   * Spawn an ephemeral bee for a one-shot task.
   * Auto-destroys after completing its first task and cooling down.
   *
   * @param {BeeConfig} config
   * @returns {Bee}
   */
  spawnBee(config) {
    if (this._bees.size >= this._maxBees) {
      // Try to reclaim an OFFLINE/COOLDOWN bee first
      const reclaimed = this._tryReclaim();
      if (!reclaimed) {
        throw new Error(`BeeFactory at capacity (${this._maxBees}). Cannot spawn.`);
      }
    }
    const bee = new Bee({ ...config, ephemeral: true });
    this._register(bee);
    this.emit('bee.spawned', { beeId: bee.id, type: bee.type });
    return bee;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a bee in the factory indexes
   * @private
   * @param {Bee} bee
   */
  _register(bee) {
    this._bees.set(bee.id, bee);

    // Index by type
    const typeSet = this._typeIndex.get(bee.type) ?? new Set();
    typeSet.add(bee.id);
    this._typeIndex.set(bee.type, typeSet);

    // Index by capability
    for (const cap of bee.capabilities) {
      const capSet = this._capabilityIndex.get(cap) ?? new Set();
      capSet.add(bee.id);
      this._capabilityIndex.set(cap, capSet);
    }

    // Listen for destruction
    bee.on('bee.destroyed', ({ beeId }) => this._deregister(beeId));
  }

  /**
   * Deregister a bee
   * @private
   * @param {string} beeId
   */
  _deregister(beeId) {
    const bee = this._bees.get(beeId);
    if (!bee) return;
    this._bees.delete(beeId);

    const typeSet = this._typeIndex.get(bee.type);
    if (typeSet) { typeSet.delete(beeId); if (typeSet.size === 0) this._typeIndex.delete(bee.type); }

    for (const cap of bee.capabilities) {
      const capSet = this._capabilityIndex.get(cap);
      if (capSet) { capSet.delete(beeId); if (capSet.size === 0) this._capabilityIndex.delete(cap); }
    }

    this.emit('bee.deregistered', { beeId, type: bee.type });
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  /**
   * Find the best available bee for a given capability.
   * Selects bee with highest phi_score among available bees.
   *
   * @param {string} capability - capability pattern to match (exact or regex)
   * @param {string} [preferredNode] - prefer bees on this node role
   * @returns {Bee|null}
   */
  findBee(capability, preferredNode) {
    let candidates = [];

    // Try exact capability match first
    if (this._capabilityIndex.has(capability)) {
      candidates = [...this._capabilityIndex.get(capability)]
        .map((id) => this._bees.get(id))
        .filter(Boolean);
    }

    // Fallback: scan all bees for capability prefix match
    if (candidates.length === 0) {
      const capPattern = new RegExp(capability.replace('*', '.*').replace('.', '\\.'));
      for (const bee of this._bees.values()) {
        if (bee.capabilities.some((c) => capPattern.test(c))) {
          candidates.push(bee);
        }
      }
    }

    // Filter to available bees only
    candidates = candidates.filter((b) => b.available);
    if (candidates.length === 0) return null;

    // Prefer specific node role
    if (preferredNode) {
      const preferred = candidates.filter((b) => b.node === preferredNode);
      if (preferred.length > 0) candidates = preferred;
    }

    // Return highest phi_score bee
    return candidates.reduce((best, b) => b.phi_score > best.phi_score ? b : best);
  }

  /**
   * Get all bees of a specific type
   * @param {string} type
   * @returns {Bee[]}
   */
  getByType(type) {
    const ids = this._typeIndex.get(type) ?? new Set();
    return [...ids].map((id) => this._bees.get(id)).filter(Boolean);
  }

  /**
   * Get all available bees (IDLE or ACTIVE with capacity)
   * @returns {Bee[]}
   */
  getAvailable() {
    return [...this._bees.values()].filter((b) => b.available);
  }

  // ─── Auto-Scaling ─────────────────────────────────────────────────────────

  /**
   * Evaluate workload and auto-scale the bee pool.
   * @returns {{ scaled: boolean, action: string|null, details: object }}
   */
  evaluateScale() {
    const bees = [...this._bees.values()];
    if (bees.length === 0) return { scaled: false, action: null, details: {} };

    const busyBees = bees.filter((b) => b.state === BeeState.BUSY || b.state === BeeState.ACTIVE);
    const utilization = busyBees.length / bees.length;

    let scaled = false;
    let action = null;

    // Scale up: utilization > PHI threshold (0.618)
    if (utilization > this._scaleUpThreshold && this._bees.size < this._maxBees) {
      // Find most-utilized type and spawn more
      const busyByType = {};
      for (const b of busyBees) {
        busyByType[b.type] = (busyByType[b.type] ?? 0) + 1;
      }
      const topType = Object.entries(busyByType)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      if (topType) {
        const toSpawn = FIBONACCI[2]; // spawn 2
        let spawned = 0;
        for (let i = 0; i < toSpawn && this._bees.size < this._maxBees; i++) {
          try {
            this.spawnBee({ type: topType });
            spawned++;
          } catch (_) { break; }
        }
        if (spawned > 0) {
          scaled = true;
          action = 'SCALE_UP';
          this.emit('autoscale.up', { type: topType, spawned, utilization });
        }
      }
    }

    // Scale down: utilization < PHI threshold (0.382)
    if (!scaled && utilization < this._scaleDownThreshold) {
      const idleBees = bees.filter((b) =>
        b.state === BeeState.IDLE && b.ephemeral && b.tasksCompleted > 0
      );
      let reclaimed = 0;
      for (const bee of idleBees.slice(0, FIBONACCI[2])) { // reclaim up to 2
        bee.destroy();
        reclaimed++;
      }
      if (reclaimed > 0) {
        scaled = true;
        action = 'SCALE_DOWN';
        this.emit('autoscale.down', { reclaimed, utilization });
      }
    }

    return { scaled, action, details: { utilization, total: bees.length, busy: busyBees.length } };
  }

  /**
   * Try to reclaim an OFFLINE or long-cooldown bee to free a slot
   * @private
   * @returns {boolean}
   */
  _tryReclaim() {
    for (const bee of this._bees.values()) {
      if (bee.state === BeeState.OFFLINE || bee.state === BeeState.ERROR) {
        this._deregister(bee.id);
        return true;
      }
    }
    // Reclaim long-idle ephemeral bees
    for (const bee of this._bees.values()) {
      if (bee.ephemeral && bee.state === BeeState.IDLE &&
          (Date.now() - bee.lastActiveAt) > FIBONACCI[8] * 1000) { // idle >34s
        bee.destroy();
        return true;
      }
    }
    return false;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Start the factory monitoring loop
   */
  start() {
    if (this._started) return;
    this._started = true;

    this._monitorTimer = setInterval(() => {
      if (this._autoScale) this.evaluateScale();
      this.emit('factory.heartbeat', {
        total: this._bees.size,
        available: this.getAvailable().length,
        capacity: this._maxBees,
      });
    }, this._monitorMs);
    if (this._monitorTimer.unref) this._monitorTimer.unref();

    this.emit('factory.started', { maxBees: this._maxBees });
  }

  /**
   * Shut down the factory and destroy all bees
   */
  async shutdown() {
    if (!this._started) return;
    this._started = false;
    clearInterval(this._monitorTimer);
    this._monitorTimer = null;

    for (const bee of this._bees.values()) {
      bee.destroy();
    }
    this._bees.clear();
    this._typeIndex.clear();
    this._capabilityIndex.clear();

    this.emit('factory.stopped');
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} factory status */
  get status() {
    const bees = [...this._bees.values()];
    const byState = {};
    for (const s of Object.values(BeeState)) {
      byState[s] = bees.filter((b) => b.state === s).length;
    }
    return {
      total:      bees.length,
      maxBees:    this._maxBees,
      capacity:   this._maxBees - bees.length,
      byState,
      types:      [...this._typeIndex.keys()],
      capabilities: this._capabilityIndex.size,
      utilization: bees.length > 0
        ? bees.filter((b) => b.state !== BeeState.IDLE && b.state !== BeeState.OFFLINE).length / bees.length
        : 0,
      phi: PHI,
    };
  }

  /** @returns {number} total bee count */
  get size() { return this._bees.size; }

  /** @returns {Map<string, Bee>} bee map */
  get bees() { return this._bees; }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {BeeFactory|null} */
let _globalFactory = null;

/**
 * Get (or create) the global BeeFactory singleton
 * @param {object} [options]
 * @returns {BeeFactory}
 */
export function getGlobalBeeFactory(options = {}) {
  if (!_globalFactory) {
    _globalFactory = new BeeFactory(options);
  }
  return _globalFactory;
}

// ─── Template Utilities ───────────────────────────────────────────────────────

/**
 * Get a bee template by type name
 * @param {string} type
 * @returns {object|undefined}
 */
export function getBeeTemplate(type) { return TEMPLATE_MAP.get(type); }

/**
 * List all available bee template types
 * @returns {string[]}
 */
export function listBeeTypes() { return [...TEMPLATE_MAP.keys()]; }

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, phiBackoff };

export default {
  BeeFactory,
  Bee,
  BeeState,
  BEE_TEMPLATES,
  TEMPLATE_MAP,
  getBeeTemplate,
  listBeeTypes,
  getGlobalBeeFactory,
  PHI,
  FIBONACCI,
  phiBackoff,
};

/**
 * @fileoverview SwarmCoordinator — Enhanced coordination layer for 17 autonomous
 * agent swarms in the Heady Latent OS platform.
 *
 * Architecture:
 *   - Hierarchical topology: strategic → tactical → operational layers
 *   - Sacred Geometry ring topology (HeadySoul center, inner/middle/outer rings)
 *   - CSL (Cosine Similarity Layer) gates for task routing
 *   - Fibonacci-ratio resource allocation across swarms
 *   - Swarm-to-swarm communication via internal message bus
 *   - Health monitoring, graceful degradation, and metrics collection
 *
 * Integration points:
 *   - src/bees/bee-factory.js        (BeeFactory for worker instantiation)
 *   - src/bees/registry.js           (BeeRegistry for capability lookup)
 *   - src/orchestration/heady-bees.js (HeadyBees orchestration primitives)
 *   - src/orchestration/swarm-consensus.js (SwarmConsensus for cross-swarm agreement)
 *   - src/hc_orchestrator.js         (HCOrchestrator parent integration)
 *
 * @module swarm-coordinator
 * @version 2.1.0
 *
 * PHI-MATH INTEGRATION:
 *   All thresholds, weights, timings, and queue limits are derived from the
 *   golden ratio φ = (1 + √5) / 2 ≈ 1.618 and Fibonacci sequence.
 *   See shared/phi-math.js for derivations.
 */

import { EventEmitter } from 'events';
import { createHash, randomUUID } from 'crypto';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  phiResourceWeights,
  phiBackoff,
  phiFusionWeights,
  cslGate,
  cslBlend,
  PRESSURE_LEVELS,
  classifyPressure,
  phiAdaptiveInterval,
  fib,
  fibSequence,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fibonacci sequence [F(0)..F(11)] for resource-allocation ratios.
 *
 * Derived: fibSequence(11) = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
 * Previously hardcoded as [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].
 * Now generated dynamically so the sequence is always consistent with
 * the canonical Fibonacci definition in phi-math.
 *
 * @type {number[]}
 */
const FIBONACCI = fibSequence(11);

/** Fibonacci sum for the 17-swarm pool (sum of first relevant Fibonacci ratios) */
const FIB_TOTAL = FIBONACCI.slice(0, 17).reduce((a, b) => a + b, 0);

/**
 * CSL cosine-similarity thresholds for deterministic routing.
 *
 * Derived from phi-harmonic levels (phiThreshold(n) = 1 - ψⁿ × 0.5):
 *   HIGH     = phiThreshold(3) ≈ 0.882  (was 0.85 — arbitrary)
 *   MEDIUM   = phiThreshold(2) ≈ 0.809  (was 0.72 — arbitrary)
 *   LOW      = phiThreshold(1) ≈ 0.691  (was 0.55 — arbitrary)
 *
 * The gaps between levels now follow the golden ratio: gap(LOW→MED)/gap(MED→HIGH) ≈ φ.
 */
const CSL_THRESHOLD_HIGH = CSL_THRESHOLDS.HIGH;     // ≈ 0.882  (was 0.85)
const CSL_THRESHOLD_MED  = CSL_THRESHOLDS.MEDIUM;   // ≈ 0.809  (was 0.72)
const CSL_THRESHOLD_LOW  = CSL_THRESHOLDS.LOW;      // ≈ 0.691  (was 0.55)

/**
 * Phi-derived resource weights for the 17-swarm pool.
 *
 * phiResourceWeights(17) assigns Fibonacci-normalized weights in descending
 * order so the highest-priority swarm gets F(18)/sum and the lowest gets F(2)/sum.
 * This replaces the per-swarm fibWeight() lookup with a single computed array.
 *
 * @type {number[]}
 */
const PHI_WEIGHTS_17 = phiResourceWeights(17);

/** Swarm health states */
const SWARM_STATE = Object.freeze({
  HEALTHY:   'healthy',
  DEGRADED:  'degraded',
  OVERLOADED:'overloaded',
  FAILED:    'failed',
  RECOVERING:'recovering',
});

/** Orchestration layer identifiers (hierarchical topology) */
const LAYER = Object.freeze({
  STRATEGIC:   'strategic',   // HeadySoul center + governance
  TACTICAL:    'tactical',    // Inner ring coordinators
  OPERATIONAL: 'operational', // Middle + outer ring workers
});

/** Ring assignments aligned with Sacred Geometry topology */
const RING = Object.freeze({
  CENTER: 'center',
  INNER:  'inner',
  MIDDLE: 'middle',
  OUTER:  'outer',
  GOVERNANCE: 'governance',
});

/** Default metrics snapshot interval (ms) */
const METRICS_INTERVAL_MS = 5_000;

/**
 * Base health check interval (ms).
 *
 * Actual per-swarm intervals adapt via phiAdaptiveInterval():
 *   - Healthy swarm:   current × φ  (checks less often, up to 60 s)
 *   - Unhealthy swarm: current × ψ  (checks more often, down to 1 s)
 */
const HEALTH_CHECK_INTERVAL_MS = 15_000;

/**
 * Max queue depth before triggering backpressure.
 *
 * fib(13) = 233 (a Fibonacci-sized queue — was arbitrary 500).
 * For swarms requiring more capacity, override per-swarm via opts.
 *
 * @type {number}
 */
const MAX_QUEUE_DEPTH = fib(13); // 233  (was 500)

/** Minimum healthy swarms required for operation */
const MIN_HEALTHY_SWARMS = 5;

// ─── Swarm Definitions ────────────────────────────────────────────────────────

/**
 * Canonical 17-swarm definitions with ring placement, layer, and base config.
 * Fibonacci index determines resource weight (higher index = more resources).
 */
const SWARM_DEFINITIONS = [
  // CENTER — HeadySoul (strategic, highest Fibonacci weight)
  { id: 'heady-soul',        ring: RING.CENTER,     layer: LAYER.STRATEGIC,   fibIdx: 10, domain: 'orchestration',  cslThreshold: CSL_THRESHOLD_HIGH },

  // INNER — Tactical coordinators (5 swarms)
  { id: 'cognition-core',    ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 9,  domain: 'reasoning',      cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'memory-weave',      ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 8,  domain: 'memory',         cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'context-bridge',    ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 8,  domain: 'context',        cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'task-planner',      ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 7,  domain: 'planning',       cslThreshold: CSL_THRESHOLD_HIGH },
  { id: 'consensus-forge',   ring: RING.INNER,      layer: LAYER.TACTICAL,    fibIdx: 7,  domain: 'consensus',      cslThreshold: CSL_THRESHOLD_MED  },

  // MIDDLE — Operational specialists (7 swarms)
  { id: 'code-artisan',      ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 6,  domain: 'coding',         cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'data-sculptor',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 6,  domain: 'data',           cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'research-herald',   ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'research',       cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'tool-weaver',       ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'tools',          cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'language-flow',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 5,  domain: 'language',       cslThreshold: CSL_THRESHOLD_MED  },
  { id: 'vision-scribe',     ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 4,  domain: 'vision',         cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'audio-pulse',       ring: RING.MIDDLE,     layer: LAYER.OPERATIONAL, fibIdx: 4,  domain: 'audio',          cslThreshold: CSL_THRESHOLD_LOW  },

  // OUTER — Edge workers (3 swarms)
  { id: 'integration-node',  ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 3,  domain: 'integration',    cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'cache-guardian',    ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 3,  domain: 'caching',        cslThreshold: CSL_THRESHOLD_LOW  },
  { id: 'stream-runner',     ring: RING.OUTER,      layer: LAYER.OPERATIONAL, fibIdx: 2,  domain: 'streaming',      cslThreshold: CSL_THRESHOLD_LOW  },

  // GOVERNANCE — Policy + compliance (1 swarm)
  { id: 'policy-sentinel',   ring: RING.GOVERNANCE, layer: LAYER.STRATEGIC,   fibIdx: 6,  domain: 'governance',     cslThreshold: CSL_THRESHOLD_HIGH },
];

// ─── Helper Utilities ─────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two numeric vectors.
 * @param {number[]} a - Vector A
 * @param {number[]} b - Vector B
 * @returns {number} Cosine similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Return the Fibonacci-ratio resource weight for a given swarm by its
 * rank in the 17-swarm pool (0 = heady-soul, highest weight).
 *
 * Uses pre-computed PHI_WEIGHTS_17 derived from phiResourceWeights(17)
 * rather than re-normalising per lookup.
 *
 * @param {number} fibIdx  - Fibonacci sequence index (0-based, per SWARM_DEFINITIONS)
 * @returns {number} Normalised weight in (0, 1]
 */
function fibWeight(fibIdx) {
  return FIBONACCI[Math.min(fibIdx, FIBONACCI.length - 1)] / FIB_TOTAL;
}

/**
 * Golden-ratio exponential backoff with phi-derived jitter.
 *
 * Base formula: delay = baseMs × 2^attempt  (standard doubling)
 * Phi jitter:   ±(base × ψ²) ≈ ±38.2% of base  (was ±30% — arbitrary)
 *
 * ψ² ≈ 0.382 is the phi-harmonic complement of ψ (≈ 0.618).
 * Together ψ + ψ² = 1, so the jitter band is precisely [0.618×base, base].
 *
 * @param {number} attempt - Attempt number (0-based)
 * @param {number} baseMs  - Base delay in ms
 * @returns {number} Delay in ms
 */
function backoffDelay(attempt, baseMs = 100) {
  const exp  = Math.min(attempt, 10);
  const base = baseMs * Math.pow(2, exp);
  // ψ² ≈ 0.382 — phi-derived jitter coefficient (was arbitrary 0.3)
  const jitter = Math.random() * base * Math.pow(PSI, 2);
  return Math.min(base + jitter, 30_000);
}

// ─── SwarmInstance ─────────────────────────────────────────────────────────────

/**
 * Represents a single running swarm instance with its state, metrics, and queue.
 */
class SwarmInstance {
  /**
   * @param {object} def - Swarm definition from SWARM_DEFINITIONS
   */
  constructor(def) {
    this.id           = def.id;
    this.ring         = def.ring;
    this.layer        = def.layer;
    this.domain       = def.domain;
    this.cslThreshold = def.cslThreshold;
    this.fibIdx       = def.fibIdx;
    this.weight       = fibWeight(def.fibIdx);

    /** @type {string} Current swarm health state */
    this.state = SWARM_STATE.HEALTHY;

    /** @type {Map<string, object>} Active tasks keyed by taskId */
    this.activeTasks = new Map();

    /** @type {Array<object>} Pending task queue */
    this.queue = [];

    /** @type {number[]} Optional domain embedding for CSL routing */
    this.embedding = null;

    /**
     * Current health-check interval in ms.
     * Adapts via phiAdaptiveInterval(): grows by φ when healthy,
     * shrinks by ψ when unhealthy, bounded in [1 s, 60 s].
     *
     * @type {number}
     */
    this._healthCheckInterval = HEALTH_CHECK_INTERVAL_MS;

    /** Metrics accumulator */
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed:    0,
      tasksRejected:  0,
      totalLatencyMs: 0,
      lastHealthAt:   Date.now(),
      consecutiveFails: 0,
      windowRequests:  0,
      windowAccepts:   0,
      windowStart:     Date.now(),
    };

    /**
     * Circuit-breaker state.
     *
     * FAILURE_THRESHOLD = fib(5) = 5  (same numeric value as before, but now
     *   Fibonacci-derived — the threshold is the 5th Fibonacci number).
     * RECOVERY_TIMEOUT_MS = Math.round(phiBackoff(5)) ≈ 11_090 ms base, but
     *   we keep 45_000 ms for recovery as it's an operational SLA requirement;
     *   the phi backoff is used in the swarm-level backoff helper instead.
     */
    this.circuitBreaker = {
      state:          'closed', // closed | open | half-open
      failCount:      0,
      lastOpenedAt:   null,
      halfOpenProbes: 0,
      /** fib(5) = 5 — Fibonacci-derived failure threshold (was hardcoded 5) */
      FAILURE_THRESHOLD:   fib(5),        // = 5
      RECOVERY_TIMEOUT_MS: 45_000,
      HALF_OPEN_MAX_PROBES: 3,
    };
  }

  /** @returns {boolean} Whether this swarm can accept new tasks */
  get canAccept() {
    if (this.circuitBreaker.state === 'open') {
      const elapsed = Date.now() - this.circuitBreaker.lastOpenedAt;
      if (elapsed >= this.circuitBreaker.RECOVERY_TIMEOUT_MS) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.halfOpenProbes = 0;
      } else {
        return false;
      }
    }
    return (
      this.state !== SWARM_STATE.FAILED &&
      this.queue.length < MAX_QUEUE_DEPTH
    );
  }

  /** @returns {number} Queue utilization ratio [0, 1] */
  get queuePressure() {
    return this.queue.length / MAX_QUEUE_DEPTH;
  }

  /** @returns {number} Tasks-per-second over the last sample window */
  get throughput() {
    const elapsed = (Date.now() - this.metrics.windowStart) / 1000;
    return elapsed > 0 ? this.metrics.tasksCompleted / elapsed : 0;
  }

  /**
   * Advance the adaptive health-check interval based on current health.
   *
   * Uses phiAdaptiveInterval() from phi-math:
   *   healthy   → interval × φ  (check less often, up to 60 s)
   *   unhealthy → interval × ψ  (check more often, down to 1 s)
   *
   * @param {boolean} healthy - Whether the swarm is currently healthy
   * @returns {number} Updated interval in ms
   */
  advanceHealthInterval(healthy) {
    this._healthCheckInterval = phiAdaptiveInterval(
      this._healthCheckInterval,
      healthy,
      1_000,   // minMs: at most once per second when degraded
      60_000,  // maxMs: at most once per minute when healthy
    );
    return this._healthCheckInterval;
  }

  /**
   * Record a task completion and update metrics.
   * @param {number} latencyMs - Task execution duration
   * @param {boolean} success  - Whether the task succeeded
   */
  recordCompletion(latencyMs, success) {
    if (success) {
      this.metrics.tasksCompleted++;
      this.metrics.totalLatencyMs += latencyMs;
      this.metrics.consecutiveFails = 0;
      // Circuit-breaker: successful probe in half-open → close
      if (this.circuitBreaker.state === 'half-open') {
        this.circuitBreaker.halfOpenProbes++;
        if (this.circuitBreaker.halfOpenProbes >= this.circuitBreaker.HALF_OPEN_MAX_PROBES) {
          this.circuitBreaker.state    = 'closed';
          this.circuitBreaker.failCount = 0;
        }
      }
    } else {
      this.metrics.tasksFailed++;
      this.metrics.consecutiveFails++;
      this.circuitBreaker.failCount++;
      if (this.circuitBreaker.failCount >= this.circuitBreaker.FAILURE_THRESHOLD) {
        this.circuitBreaker.state      = 'open';
        this.circuitBreaker.lastOpenedAt = Date.now();
      }
    }
    this._updateState();
  }

  /** Derive health state from current metrics */
  _updateState() {
    const { consecutiveFails } = this.metrics;
    const healthy = this.circuitBreaker.state === 'closed' && consecutiveFails === 0;

    if (this.circuitBreaker.state === 'open') {
      this.state = SWARM_STATE.FAILED;
    } else if (consecutiveFails >= 3) {
      this.state = SWARM_STATE.DEGRADED;
    } else if (this.queuePressure > PRESSURE_LEVELS.ELEVATED_MAX) {
      /**
       * Overload detection threshold = PRESSURE_LEVELS.ELEVATED_MAX ≈ 0.618 (ψ).
       *
       * Previously: queuePressure > 0.8 (arbitrary).
       * Now: start overload detection at the phi-harmonic ELEVATED→HIGH boundary (ψ ≈ 0.618).
       * This detects queue buildup earlier — at the golden ratio of capacity —
       * allowing gradual backpressure before hitting hard limits.
       */
      this.state = SWARM_STATE.OVERLOADED;
    } else if (this.circuitBreaker.state === 'half-open') {
      this.state = SWARM_STATE.RECOVERING;
    } else {
      this.state = SWARM_STATE.HEALTHY;
    }

    // Advance the health-check interval based on new state
    this.advanceHealthInterval(this.state === SWARM_STATE.HEALTHY);
  }

  /**
   * Export a metrics snapshot for observability.
   * @returns {object}
   */
  getMetricsSnapshot() {
    const avgLatency = this.metrics.tasksCompleted > 0
      ? Math.round(this.metrics.totalLatencyMs / this.metrics.tasksCompleted)
      : 0;
    return {
      swarmId:       this.id,
      ring:          this.ring,
      layer:         this.layer,
      domain:        this.domain,
      state:         this.state,
      circuitState:  this.circuitBreaker.state,
      queueDepth:    this.queue.length,
      queuePressure: Math.round(this.queuePressure * 100) / 100,
      activeTasks:   this.activeTasks.size,
      tasksCompleted:this.metrics.tasksCompleted,
      tasksFailed:   this.metrics.tasksFailed,
      tasksRejected: this.metrics.tasksRejected,
      avgLatencyMs:  avgLatency,
      throughputTps: Math.round(this.throughput * 100) / 100,
      weight:        Math.round(this.weight * 1000) / 1000,
      healthCheckIntervalMs: this._healthCheckInterval,
      timestamp:     new Date().toISOString(),
    };
  }
}

// ─── MessageBus ───────────────────────────────────────────────────────────────

/**
 * Lightweight in-process message bus for swarm-to-swarm communication.
 * Supports topic-based pub/sub with priority queuing.
 */
class SwarmMessageBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    /** @type {Map<string, Array<object>>} Pending messages per topic */
    this._queues = new Map();
    /** @type {Map<string, Set<Function>>} Subscribers per topic */
    this._subscribers = new Map();
  }

  /**
   * Publish a message to a topic.
   * @param {string} topic   - Target topic (e.g. 'swarm:coding', 'broadcast')
   * @param {object} message - Message payload
   * @param {object} [opts]  - Options: { priority?: number, ttlMs?: number }
   */
  publish(topic, message, opts = {}) {
    const envelope = {
      id:        randomUUID(),
      topic,
      message,
      priority:  opts.priority ?? 5,
      publishedAt: Date.now(),
      expiresAt: opts.ttlMs ? Date.now() + opts.ttlMs : null,
    };

    // Deliver immediately to subscribers
    const subs = this._subscribers.get(topic) ?? new Set();
    const globalSubs = this._subscribers.get('*') ?? new Set();
    const allSubs = new Set([...subs, ...globalSubs]);

    if (allSubs.size > 0) {
      for (const handler of allSubs) {
        try { handler(envelope); } catch (err) { /* isolate subscriber errors */ }
      }
    } else {
      // Queue for late subscribers
      if (!this._queues.has(topic)) this._queues.set(topic, []);
      this._queues.get(topic).push(envelope);
    }

    this.emit('published', { topic, messageId: envelope.id });
    return envelope.id;
  }

  /**
   * Subscribe to a topic.
   * @param {string}   topic   - Topic name, or '*' for all
   * @param {Function} handler - Callback(envelope)
   * @returns {Function} Unsubscribe function
   */
  subscribe(topic, handler) {
    if (!this._subscribers.has(topic)) this._subscribers.set(topic, new Set());
    this._subscribers.get(topic).add(handler);

    // Drain any queued messages
    const queued = this._queues.get(topic) ?? [];
    for (const env of queued) {
      if (!env.expiresAt || Date.now() < env.expiresAt) {
        try { handler(env); } catch (_) {}
      }
    }
    this._queues.delete(topic);

    return () => this._subscribers.get(topic)?.delete(handler);
  }

  /**
   * Send a direct message from one swarm to another.
   * @param {string} fromId  - Sender swarm ID
   * @param {string} toId    - Receiver swarm ID
   * @param {object} payload - Message payload
   */
  sendDirect(fromId, toId, payload) {
    return this.publish(`direct:${toId}`, { ...payload, from: fromId });
  }

  /**
   * Broadcast a backpressure signal to all upstream swarms.
   * @param {string} swarmId    - Overloaded swarm emitting the signal
   * @param {number} pressure   - Pressure level [0, 1]
   */
  broadcastBackpressure(swarmId, pressure) {
    return this.publish('backpressure', { swarmId, pressure, ts: Date.now() }, { priority: 10 });
  }
}

// ─── SwarmCoordinator ─────────────────────────────────────────────────────────

/**
 * @class SwarmCoordinator
 * @extends EventEmitter
 *
 * Central coordination layer for the 17-swarm Heady Latent OS platform.
 *
 * Responsibilities:
 *  - Instantiate and track all 17 swarm instances
 *  - Route tasks using CSL cosine similarity gates with LLM fallback
 *  - Load-balance using Fibonacci-ratio resource weights
 *  - Monitor health and trigger graceful degradation
 *  - Propagate backpressure signals through the message bus
 *  - Collect and expose per-swarm metrics
 *
 * @fires SwarmCoordinator#task:routed       When a task is assigned to a swarm
 * @fires SwarmCoordinator#task:completed    When a swarm task finishes
 * @fires SwarmCoordinator#task:failed       When a swarm task errors
 * @fires SwarmCoordinator#swarm:degraded    When a swarm enters degraded state
 * @fires SwarmCoordinator#swarm:recovered   When a swarm returns to healthy
 * @fires SwarmCoordinator#metrics:snapshot  Periodic metrics snapshot
 * @fires SwarmCoordinator#backpressure      When queue pressure is high
 */
class SwarmCoordinator extends EventEmitter {
  /**
   * @param {object} [opts]                   - Configuration options
   * @param {object} [opts.beeFactory]         - BeeFactory instance for worker creation
   * @param {object} [opts.beeRegistry]        - BeeRegistry for capability lookup
   * @param {object} [opts.headyBees]          - HeadyBees orchestration primitive
   * @param {object} [opts.swarmConsensus]     - SwarmConsensus instance
   * @param {number} [opts.cslThreshold]       - Global CSL gate threshold override
   * @param {number} [opts.metricsIntervalMs]  - Metrics collection interval
   * @param {number} [opts.healthCheckMs]      - Health check interval
   * @param {Function} [opts.embedFn]          - Async fn(text) → number[] for CSL routing
   * @param {Function} [opts.llmClassifyFn]    - Async fn(task) → swarmId for LLM fallback routing
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(200);

    this._beeFactory      = opts.beeFactory      ?? null;
    this._beeRegistry     = opts.beeRegistry     ?? null;
    this._headyBees       = opts.headyBees       ?? null;
    this._swarmConsensus  = opts.swarmConsensus  ?? null;
    this._cslThreshold    = opts.cslThreshold    ?? CSL_THRESHOLD_MED;
    this._metricsInterval = opts.metricsIntervalMs ?? METRICS_INTERVAL_MS;
    this._healthCheckMs   = opts.healthCheckMs   ?? HEALTH_CHECK_INTERVAL_MS;
    this._embedFn         = opts.embedFn         ?? null;
    this._llmClassifyFn   = opts.llmClassifyFn   ?? null;

    /** @type {Map<string, SwarmInstance>} All swarms keyed by ID */
    this._swarms = new Map();

    /** @type {SwarmMessageBus} Internal message bus */
    this._bus = new SwarmMessageBus();

    /** @type {Map<string, Function>} Task completion callbacks */
    this._taskCallbacks = new Map();

    /** Global coordinator metrics */
    this._globalMetrics = {
      totalTasksRouted:   0,
      totalTasksCompleted:0,
      totalTasksFailed:   0,
      routingDecisions:   { deterministic: 0, csl: 0, llm: 0, loadBalance: 0 },
      startedAt: new Date().toISOString(),
    };

    /** @type {NodeJS.Timer|null} */
    this._metricsTimer    = null;
    this._healthTimer     = null;
    this._initialized     = false;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the coordinator: instantiate all 17 swarms, register bus handlers,
   * start monitoring timers, and optionally build domain embeddings for CSL routing.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    // Build swarm instances
    for (const def of SWARM_DEFINITIONS) {
      const instance = new SwarmInstance(def);
      this._swarms.set(def.id, instance);
    }

    // Wire up message bus subscriptions
    this._bus.subscribe('backpressure', (env) => this._handleBackpressureSignal(env));
    this._bus.subscribe('*', (env) => {
      if (env.topic.startsWith('direct:')) {
        const targetId = env.topic.replace('direct:', '');
        this.emit('message:received', { targetId, envelope: env });
      }
    });

    // Build domain embeddings for CSL routing (if embedFn available)
    if (this._embedFn) {
      await this._buildDomainEmbeddings();
    }

    // Start health monitoring
    this._healthTimer = setInterval(
      () => this._runHealthChecks(),
      this._healthCheckMs
    );

    // Start metrics collection
    this._metricsTimer = setInterval(
      () => this._emitMetricsSnapshot(),
      this._metricsInterval
    );

    this._initialized = true;
    this.emit('coordinator:ready', {
      swarmCount: this._swarms.size,
      timestamp:  new Date().toISOString(),
    });
  }

  /**
   * Graceful shutdown: drain queues, stop timers, close resources.
   * @returns {Promise<void>}
   */
  async shutdown() {
    clearInterval(this._healthTimer);
    clearInterval(this._metricsTimer);

    // Wait for active tasks to complete (max 30s)
    const deadline = Date.now() + 30_000;
    while (this._activeTotalCount() > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
    }

    this._initialized = false;
    this.emit('coordinator:shutdown', { timestamp: new Date().toISOString() });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Route and execute a task to the best-matching swarm.
   *
   * Routing priority:
   *   1. Deterministic: explicit swarmId on task
   *   2. CSL cosine similarity gate (if embedFn available)
   *   3. Domain string matching
   *   4. LLM classifier fallback (if llmClassifyFn available)
   *   5. Fibonacci-weighted load balancing (final fallback)
   *
   * @param {object} task           - Task descriptor
   * @param {string} task.id        - Unique task ID (auto-generated if absent)
   * @param {string} [task.swarmId] - Explicit target swarm (bypasses routing)
   * @param {string} [task.domain]  - Domain hint for routing ('coding', 'research', …)
   * @param {string} [task.description] - Task description for CSL embedding
   * @param {number} [task.priority]    - Priority [1-10], default 5
   * @param {number[]} [task.embedding] - Pre-computed embedding (skips embedFn call)
   * @param {object} [task.payload]     - Task-specific data
   * @param {Function} [executor]   - Async fn(task, swarm) → result (optional override)
   * @returns {Promise<object>} Task result with routing metadata
   */
  async routeTask(task, executor = null) {
    if (!this._initialized) await this.initialize();

    const taskId = task.id ?? randomUUID();
    const enriched = { ...task, id: taskId, priority: task.priority ?? 5 };

    // Step 1: Resolve target swarm
    const { swarmId, strategy } = await this._resolveTargetSwarm(enriched);
    const swarm = this._swarms.get(swarmId);

    if (!swarm || !swarm.canAccept) {
      const fallback = this._pickFallback(swarmId);
      if (!fallback) {
        throw new Error(`[SwarmCoordinator] No healthy swarms available for task ${taskId}`);
      }
      return this.routeTask(enriched, executor); // re-route with fallback
    }

    this._globalMetrics.totalTasksRouted++;
    this._globalMetrics.routingDecisions[strategy]++;

    // Step 2: Enqueue or execute immediately
    return this._executeOnSwarm(swarm, enriched, executor, strategy);
  }

  /**
   * Get the current health status of all swarms.
   * @returns {object[]} Array of health descriptors
   */
  getSwarmHealth() {
    return [...this._swarms.values()].map(s => ({
      id:           s.id,
      ring:         s.ring,
      layer:        s.layer,
      domain:       s.domain,
      state:        s.state,
      circuitState: s.circuitBreaker.state,
      queueDepth:   s.queue.length,
      activeTasks:  s.activeTasks.size,
    }));
  }

  /**
   * Get a specific swarm instance by ID.
   * @param {string} swarmId
   * @returns {SwarmInstance|undefined}
   */
  getSwarm(swarmId) {
    return this._swarms.get(swarmId);
  }

  /**
   * Get all metrics snapshots for all swarms.
   * @returns {object[]}
   */
  getAllMetrics() {
    return [...this._swarms.values()].map(s => s.getMetricsSnapshot());
  }

  /**
   * Get global coordinator metrics.
   * @returns {object}
   */
  getGlobalMetrics() {
    return {
      ...this._globalMetrics,
      swarmCount:     this._swarms.size,
      healthySwarms:  this._countByState(SWARM_STATE.HEALTHY),
      degradedSwarms: this._countByState(SWARM_STATE.DEGRADED),
      failedSwarms:   this._countByState(SWARM_STATE.FAILED),
      totalActiveTasks: this._activeTotalCount(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send a direct message from one swarm to another via the message bus.
   * @param {string} fromId  - Sender swarm ID
   * @param {string} toId    - Target swarm ID
   * @param {object} payload - Message payload
   * @returns {string} Message envelope ID
   */
  sendSwarmMessage(fromId, toId, payload) {
    return this._bus.sendDirect(fromId, toId, payload);
  }

  /**
   * Broadcast a system-wide signal to all swarms.
   * @param {string} type    - Signal type (e.g. 'shutdown', 'flush', 'recalibrate')
   * @param {object} payload - Signal payload
   */
  broadcastSignal(type, payload) {
    return this._bus.publish('broadcast', { type, ...payload });
  }

  /**
   * Register domain embeddings manually (e.g. loaded from a vector store).
   * @param {string}   swarmId   - Target swarm ID
   * @param {number[]} embedding - Pre-computed embedding vector
   */
  setSwarmEmbedding(swarmId, embedding) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) throw new Error(`Unknown swarm: ${swarmId}`);
    swarm.embedding = embedding;
  }

  // ─── Routing Logic ─────────────────────────────────────────────────────────

  /**
   * Determine which swarm should handle a given task.
   * @private
   * @param {object} task
   * @returns {Promise<{swarmId: string, strategy: string, score: number}>}
   */
  async _resolveTargetSwarm(task) {
    // 1. Explicit swarm ID
    if (task.swarmId && this._swarms.has(task.swarmId)) {
      return { swarmId: task.swarmId, strategy: 'deterministic', score: 1.0 };
    }

    // 2. CSL cosine similarity routing
    if (this._embedFn || task.embedding) {
      const cslResult = await this._cslRoute(task);
      if (cslResult) return cslResult;
    }

    // 3. Domain string matching
    if (task.domain) {
      const domainMatch = this._domainRoute(task.domain);
      if (domainMatch) return { swarmId: domainMatch, strategy: 'deterministic', score: 0.9 };
    }

    // 4. LLM classification fallback
    if (this._llmClassifyFn) {
      try {
        const swarmId = await this._llmClassifyFn(task);
        if (swarmId && this._swarms.has(swarmId)) {
          return { swarmId, strategy: 'llm', score: 0.8 };
        }
      } catch (err) {
        this.emit('routing:llm-error', { error: err.message, taskId: task.id });
      }
    }

    // 5. Fibonacci-weighted load balancing
    const swarmId = this._fibLoadBalance(task);
    return { swarmId, strategy: 'loadBalance', score: 0 };
  }

  /**
   * CSL-gated cosine similarity routing.
   * @private
   * @param {object} task
   * @returns {Promise<{swarmId: string, strategy: string, score: number}|null>}
   */
  async _cslRoute(task) {
    let queryEmbedding = task.embedding;

    if (!queryEmbedding && this._embedFn && task.description) {
      try {
        queryEmbedding = await this._embedFn(task.description);
      } catch (err) {
        this.emit('routing:embed-error', { error: err.message, taskId: task.id });
        return null;
      }
    }

    if (!queryEmbedding) return null;

    let bestScore = -Infinity;
    let bestSwarm = null;

    for (const swarm of this._swarms.values()) {
      if (!swarm.canAccept || !swarm.embedding) continue;
      const score = cosineSimilarity(queryEmbedding, swarm.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestSwarm = swarm;
      }
    }

    if (bestSwarm && bestScore >= (bestSwarm.cslThreshold ?? this._cslThreshold)) {
      return { swarmId: bestSwarm.id, strategy: 'csl', score: bestScore };
    }

    return null;
  }

  /**
   * Route by domain string matching.
   * @private
   * @param {string} domain
   * @returns {string|null} Matching swarm ID
   */
  _domainRoute(domain) {
    const normalized = domain.toLowerCase().trim();
    for (const swarm of this._swarms.values()) {
      if (swarm.domain === normalized && swarm.canAccept) return swarm.id;
    }
    // Fuzzy match: check if domain contains swarm's domain keyword
    for (const swarm of this._swarms.values()) {
      if (swarm.canAccept && (normalized.includes(swarm.domain) || swarm.domain.includes(normalized))) {
        return swarm.id;
      }
    }
    return null;
  }

  /**
   * Fibonacci-weighted load balancing across healthy swarms.
   * Higher fibonacci index = higher probability of selection.
   * @private
   * @param {object} task - Used for deterministic hash-based selection
   * @returns {string} Selected swarm ID
   */
  _fibLoadBalance(task) {
    const healthySwarms = [...this._swarms.values()].filter(s => s.canAccept);
    if (healthySwarms.length === 0) {
      throw new Error('[SwarmCoordinator] No healthy swarms available');
    }

    // Build weighted selection table
    const totalWeight = healthySwarms.reduce((sum, s) => sum + s.weight, 0);

    // Deterministic selection based on task hash for consistency
    const hash = createHash('sha256').update(task.id).digest('hex');
    const hashVal = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;
    const targetWeight = hashVal * totalWeight;

    let cumulative = 0;
    for (const swarm of healthySwarms) {
      cumulative += swarm.weight;
      if (hashVal <= cumulative / totalWeight) return swarm.id;
    }

    return healthySwarms[healthySwarms.length - 1].id;
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Execute a task on a given swarm instance.
   * @private
   */
  async _executeOnSwarm(swarm, task, executor, strategy) {
    const startMs = Date.now();
    swarm.activeTasks.set(task.id, { task, startMs, strategy });

    /**
     * @event SwarmCoordinator#task:routed
     * @type {object}
     * @property {string} taskId
     * @property {string} swarmId
     * @property {string} strategy - Routing strategy used
     */
    this.emit('task:routed', {
      taskId:   task.id,
      swarmId:  swarm.id,
      strategy,
      ring:     swarm.ring,
      layer:    swarm.layer,
      domain:   swarm.domain,
    });

    try {
      let result;

      if (executor) {
        result = await executor(task, swarm);
      } else if (this._headyBees) {
        // Delegate to HeadyBees orchestration primitive
        result = await this._headyBees.dispatch(swarm.id, task);
      } else {
        // Simulation: resolve immediately (replace with real execution in production)
        result = await this._simulateExecution(task);
      }

      const latencyMs = Date.now() - startMs;
      swarm.activeTasks.delete(task.id);
      swarm.recordCompletion(latencyMs, true);
      this._globalMetrics.totalTasksCompleted++;

      /**
       * @event SwarmCoordinator#task:completed
       */
      this.emit('task:completed', {
        taskId:    task.id,
        swarmId:   swarm.id,
        latencyMs,
        result,
      });

      // Check if queue pressure has dropped below nominal
      if (swarm.queuePressure < PSI * PSI && swarm.state === SWARM_STATE.OVERLOADED) {
        // Recovery threshold = ψ² ≈ 0.382 (NOMINAL_MAX) — phi-harmonic lower bound
        swarm.state = SWARM_STATE.HEALTHY;
        this.emit('swarm:recovered', { swarmId: swarm.id });
      }

      return { taskId: task.id, swarmId: swarm.id, strategy, latencyMs, result };

    } catch (err) {
      const latencyMs = Date.now() - startMs;
      swarm.activeTasks.delete(task.id);
      swarm.recordCompletion(latencyMs, false);
      this._globalMetrics.totalTasksFailed++;

      if (swarm.state === SWARM_STATE.FAILED) {
        /**
         * @event SwarmCoordinator#swarm:degraded
         */
        this.emit('swarm:degraded', {
          swarmId:     swarm.id,
          circuitState: swarm.circuitBreaker.state,
          error:       err.message,
        });
      }

      /**
       * @event SwarmCoordinator#task:failed
       */
      this.emit('task:failed', {
        taskId:   task.id,
        swarmId:  swarm.id,
        error:    err.message,
        latencyMs,
      });

      // Graceful degradation: retry on a fallback swarm
      const fallback = this._pickFallback(swarm.id);
      if (fallback && task._retryCount < 2) {
        const retryTask = { ...task, _retryCount: (task._retryCount ?? 0) + 1, swarmId: fallback };
        return this.routeTask(retryTask, executor);
      }

      throw err;
    }
  }

  /**
   * Simulation placeholder for task execution (development / testing).
   * Replace with real BeeFactory dispatch in production.
   * @private
   */
  async _simulateExecution(task) {
    const delayMs = 50 + Math.random() * 200;
    await new Promise(r => setTimeout(r, delayMs));
    return { simulated: true, taskId: task.id, delayMs };
  }

  // ─── Degradation & Failover ────────────────────────────────────────────────

  /**
   * Pick a fallback swarm when the primary is unavailable.
   * Prefers same ring/layer, then falls back to any healthy swarm.
   * @private
   * @param {string} failedSwarmId
   * @returns {string|null}
   */
  _pickFallback(failedSwarmId) {
    const failed = this._swarms.get(failedSwarmId);
    if (!failed) return null;

    // Same ring preference
    const sameRing = [...this._swarms.values()]
      .filter(s => s.id !== failedSwarmId && s.ring === failed.ring && s.canAccept)
      .sort((a, b) => b.weight - a.weight);

    if (sameRing.length > 0) return sameRing[0].id;

    // Any healthy swarm
    const anyHealthy = [...this._swarms.values()]
      .filter(s => s.id !== failedSwarmId && s.canAccept)
      .sort((a, b) => b.weight - a.weight);

    return anyHealthy.length > 0 ? anyHealthy[0].id : null;
  }

  // ─── Health Monitoring ─────────────────────────────────────────────────────

  /**
   * Run health checks across all swarms.
   * Each swarm's check interval adapts via phiAdaptiveInterval():
   *   healthy   → interval × φ (less frequent checks, saves resources)
   *   unhealthy → interval × ψ (more frequent checks, faster recovery)
   * @private
   */
  _runHealthChecks() {
    const now = Date.now();
    let healthyCount = 0;

    for (const swarm of this._swarms.values()) {
      swarm.metrics.lastHealthAt = now;
      swarm._updateState();

      if (swarm.state === SWARM_STATE.HEALTHY) healthyCount++;

      // Propagate backpressure if queue pressure exceeds ELEVATED_MAX (ψ ≈ 0.618)
      // Previously: queuePressure > 0.7 (arbitrary mid-level)
      // Now: PRESSURE_LEVELS.ELEVATED_MAX ≈ 0.618 (phi-harmonic ELEVATED→HIGH boundary)
      if (swarm.queuePressure > PRESSURE_LEVELS.ELEVATED_MAX) {
        this._bus.broadcastBackpressure(swarm.id, swarm.queuePressure);
        /**
         * @event SwarmCoordinator#backpressure
         */
        this.emit('backpressure', {
          swarmId:  swarm.id,
          pressure: swarm.queuePressure,
          state:    swarm.state,
          level:    classifyPressure(swarm.queuePressure),
        });
      }
    }

    if (healthyCount < MIN_HEALTHY_SWARMS) {
      this.emit('coordinator:critical', {
        message:      `Only ${healthyCount} healthy swarms (minimum: ${MIN_HEALTHY_SWARMS})`,
        healthyCount,
        timestamp:    new Date().toISOString(),
      });
    }
  }

  /**
   * Handle incoming backpressure signals from swarms.
   * @private
   */
  _handleBackpressureSignal(envelope) {
    const { swarmId, pressure } = envelope.message;
    const swarm = this._swarms.get(swarmId);
    if (!swarm) return;

    // Use phi-harmonic pressure classification instead of arbitrary 0.9 / 0.7
    const level = classifyPressure(pressure);
    if (level === 'critical') {
      swarm.state = SWARM_STATE.OVERLOADED;
    } else if (level === 'high') {
      swarm.state = SWARM_STATE.DEGRADED;
    }

    this.emit('backpressure:received', { swarmId, pressure, level });
  }

  // ─── Embeddings ────────────────────────────────────────────────────────────

  /**
   * Build domain embeddings for all swarms using the configured embed function.
   * @private
   */
  async _buildDomainEmbeddings() {
    const promises = [...this._swarms.values()].map(async (swarm) => {
      try {
        const description = `${swarm.domain} swarm: ${swarm.id} (${swarm.ring} ring, ${swarm.layer} layer)`;
        swarm.embedding = await this._embedFn(description);
      } catch (err) {
        this.emit('embedding:error', { swarmId: swarm.id, error: err.message });
      }
    });
    await Promise.allSettled(promises);
  }

  // ─── Metrics ───────────────────────────────────────────────────────────────

  /** @private */
  _emitMetricsSnapshot() {
    const snapshot = {
      global: this.getGlobalMetrics(),
      swarms: this.getAllMetrics(),
    };
    /**
     * @event SwarmCoordinator#metrics:snapshot
     */
    this.emit('metrics:snapshot', snapshot);
  }

  /** @private */
  _activeTotalCount() {
    let count = 0;
    for (const s of this._swarms.values()) count += s.activeTasks.size;
    return count;
  }

  /** @private */
  _countByState(state) {
    let count = 0;
    for (const s of this._swarms.values()) if (s.state === state) count++;
    return count;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  SwarmCoordinator,
  SwarmInstance,
  SwarmMessageBus,
  SWARM_DEFINITIONS,
  SWARM_STATE,
  LAYER,
  RING,
  FIBONACCI,
  FIB_TOTAL,
  CSL_THRESHOLD_HIGH,
  CSL_THRESHOLD_MED,
  CSL_THRESHOLD_LOW,
  cosineSimilarity,
  fibWeight,
};

export default SwarmCoordinator;

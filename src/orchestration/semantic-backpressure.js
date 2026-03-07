/**
 * @fileoverview SemanticBackpressureMonitor — Intelligent backpressure management
 * for the 17-swarm Heady Latent OS platform.
 *
 * Architecture:
 *   - Per-agent/swarm queue depth monitoring with sliding-window metrics
 *   - Semantic deduplication via cosine similarity (phi-derived threshold: ≈0.927)
 *   - Adaptive throttling using Google SRE 2-minute rolling window algorithm
 *   - Priority scoring: phi-weighted fusion of criticality × urgency × user_impact
 *   - Circuit breaker with half-open probe state
 *   - Backpressure signals propagated upstream to caller swarms
 *
 * Google SRE Adaptive Throttling Algorithm:
 *   P(reject) = max(0, (requests - K × accepts) / (requests + 1))
 *   K = 2.0 (multiplier), window = 2 minutes rolling
 *
 * Phi-Math Integration:
 *   All design constants are derived from φ = (1+√5)/2 or the Fibonacci sequence.
 *   SLA/operational parameters (SRE_K_MULTIPLIER, SRE_WINDOW_MS, CIRCUIT_RECOVERY_MS)
 *   are kept as explicit operational values — not design constants.
 *
 * Integration points:
 *   - modules/swarm-coordinator.js  (coordinator receives backpressure signals)
 *   - src/hc_orchestrator.js        (orchestrator-level throttling)
 *   - src/hc_pipeline.js            (pipeline stage admission control)
 *
 * @module semantic-backpressure
 * @version 2.1.0
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  PSI,
  CSL_THRESHOLDS,
  PRESSURE_LEVELS,
  classifyPressure,
  phiPriorityScore,
  phiBackoff,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Cosine similarity threshold above which two tasks are considered semantic
 * duplicates and should be deduplicated.
 *
 * Old value: 0.92 (arbitrary)
 * New value: CSL_THRESHOLDS.CRITICAL = phiThreshold(4) ≈ 0.927
 *
 * Derivation: phiThreshold(4) = 1 - ψ⁴ × 0.5 ≈ 1 - 0.146 × 0.5 ≈ 0.927
 * Near-certainty alignment — two vectors this close are semantically identical.
 */
const SEMANTIC_DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL; // ≈ 0.927

/**
 * Google SRE adaptive throttling multiplier K.
 * Reject locally when requests > K × accepts.
 * @see https://sre.google/sre-book/handling-overload/
 * Kept as operational SLA parameter — not a design constant.
 */
const SRE_K_MULTIPLIER = 2.0;

/**
 * Rolling window duration for SRE throttling (2 minutes).
 * Kept as operational SLA parameter — not a design constant.
 */
const SRE_WINDOW_MS = 120_000;

/**
 * Backpressure signal levels.
 * Labels map to phi-derived pressure ratio boundaries in PRESSURE_LEVELS.
 *
 * Phi-derived boundaries (replaces arbitrary 40/60/80/95):
 *   NONE:     0 → NOMINAL_MAX ≈ 0.382  (PSI² = ψ²)
 *   LOW:      NOMINAL_MAX → ELEVATED_MAX ≈ 0.618  (PSI = ψ)
 *   MEDIUM:   ELEVATED_MAX → HIGH_MAX ≈ 0.854  (1 - ψ³)
 *   HIGH:     HIGH_MAX → CRITICAL ≈ 0.910  (1 - ψ⁴)
 *   CRITICAL: > CRITICAL
 */
const PRESSURE_LEVEL = Object.freeze({
  NONE:     'none',
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
});

/** Circuit breaker states */
const CIRCUIT_STATE = Object.freeze({
  CLOSED:    'closed',    // Normal operation
  OPEN:      'open',      // Rejecting all tasks
  HALF_OPEN: 'half_open', // Probing recovery
});

/** Task criticality tiers (Google SRE-aligned) */
const CRITICALITY = Object.freeze({
  CRITICAL_PLUS: 'critical_plus', // Revenue-impacting; last to shed
  CRITICAL:      'critical',      // Production default; user-visible
  SHEDDABLE_PLUS:'sheddable_plus',// Batch; partial unavailability OK
  SHEDDABLE:     'sheddable',     // Background; first to shed
});

/**
 * Criticality numeric weights for priority scoring.
 *
 * Old values: { 10, 7, 4, 1 } (arbitrary)
 * New values: Fibonacci numbers
 *   CRITICAL_PLUS:  fib(7)  = 13  — dominant weight, φ× larger than CRITICAL
 *   CRITICAL:       fib(6)  =  8  — standard production weight
 *   SHEDDABLE_PLUS: fib(5)  =  5  — batch / partial-availability weight
 *   SHEDDABLE:      fib(3)  =  2  — background weight (fib(4)=3 skipped to maintain ratio)
 *
 * Rationale: consecutive Fibonacci numbers have the golden ratio as their limit,
 * making the progression naturally self-similar at each criticality boundary.
 */
const CRITICALITY_WEIGHT = {
  [CRITICALITY.CRITICAL_PLUS]:  fib(7),  // 13
  [CRITICALITY.CRITICAL]:       fib(6),  //  8
  [CRITICALITY.SHEDDABLE_PLUS]: fib(5),  //  5
  [CRITICALITY.SHEDDABLE]:      fib(3),  //  2
};

/**
 * Default configuration — all design constants replaced with phi-derived values.
 *
 * MAX_QUEUE_DEPTH:
 *   Old: 500 (arbitrary round number)
 *   New: fib(13) = 233 — nearest Fibonacci below 500; natural capacity boundary
 *
 * CIRCUIT_FAILURE_THRESHOLD:
 *   Old: 5 (arbitrary)
 *   New: fib(5) = 5 — coincidentally equal; now Fibonacci-grounded
 *
 * CIRCUIT_RECOVERY_MS:
 *   Old/New: 45_000ms — kept as operational SLA parameter (not a design constant)
 *   Note: phi-backoff sequence at attempt=5 ≈ 11,090ms; 45s is the hard SLA floor
 *
 * DEDUP_CACHE_TTL_MS:
 *   Old: 60_000ms (arbitrary 1 minute)
 *   New: fib(11) × 1000 = 89_000ms — Fibonacci-indexed second boundary
 *
 * DEDUP_CACHE_MAX:
 *   Old: 2_000 (arbitrary)
 *   New: fib(17) = 1597 — nearest Fibonacci below 2000
 *
 * METRICS_WINDOW_MS / SHED_CHECK_INTERVAL_MS: operational timing, kept as-is
 */
const DEFAULTS = Object.freeze({
  /** fib(13) = 233 — replaces arbitrary 500 */
  MAX_QUEUE_DEPTH:          fib(13),        // 233

  /** fib(5) = 5 — now Fibonacci-grounded (was also 5) */
  CIRCUIT_FAILURE_THRESHOLD: fib(5),        // 5

  /** 45_000ms — operational SLA parameter, not a design constant */
  CIRCUIT_RECOVERY_MS:      45_000,

  CIRCUIT_HALF_OPEN_PROBES: 3,

  /** fib(11) × 1000 = 89_000ms — replaces arbitrary 60_000ms */
  DEDUP_CACHE_TTL_MS:       fib(11) * 1000, // 89_000

  /** fib(17) = 1597 — replaces arbitrary 2_000 */
  DEDUP_CACHE_MAX:          fib(17),        // 1597

  METRICS_WINDOW_MS:        30_000,
  SHED_CHECK_INTERVAL_MS:   1_000,
});

// ─── Priority Scoring ─────────────────────────────────────────────────────────

/**
 * Compute a priority score for a task using phi-weighted factor fusion.
 *
 * Old formula: (critWeight × 0.40) + (urgency × 0.30) + (userImpact × 0.30)
 *   — arbitrary weights that do not sum to 1 with a principled split
 *
 * New formula: phiPriorityScore(critWeight, urgency, userImpact)
 *   Uses phiFusionWeights(3) = [φ²/(φ²+φ+1), φ/(φ²+φ+1), 1/(φ²+φ+1)]
 *                             ≈ [0.528, 0.326, 0.146]
 *
 * Rationale: each consecutive weight is ψ× the previous, so the relative
 * importance of criticality vs. urgency vs. user impact follows the golden ratio.
 * All inputs normalised to [0, 10] before scoring.
 *
 * @param {object} task
 * @param {string} [task.criticality]  - One of CRITICALITY values
 * @param {number} [task.urgency]      - Time-sensitive urgency score [0, 10]
 * @param {number} [task.userImpact]   - User impact score [0, 10]
 * @param {number} [task.priority]     - Optional explicit priority override [0, 10]
 * @returns {number} Priority score [0, 10]
 */
function computePriorityScore(task) {
  if (task.priority != null) return Math.min(10, Math.max(0, task.priority));

  const critWeight = CRITICALITY_WEIGHT[task.criticality ?? CRITICALITY.CRITICAL] ?? fib(6);
  const urgency    = Math.min(10, Math.max(0, task.urgency    ?? 5));
  const userImpact = Math.min(10, Math.max(0, task.userImpact ?? 5));

  // phiPriorityScore applies phi fusion weights [0.528, 0.326, 0.146]
  // to the three factors in descending importance order.
  return phiPriorityScore(critWeight, urgency, userImpact);
}

/**
 * Determine whether a task should be shed under pressure.
 *
 * Old thresholds: 0.95 / 0.80 / 0.60 (arbitrary)
 * New thresholds: derived from PRESSURE_LEVELS (phi-harmonic):
 *   CRITICAL     ≈ 0.910  (1 - ψ⁴)  — replaces 0.95
 *   HIGH_MAX     ≈ 0.854  (1 - ψ³)  — replaces 0.80
 *   ELEVATED_MAX ≈ 0.618  (ψ)       — replaces 0.60
 *
 * @param {object} task           - Task with criticality field
 * @param {number} pressureRatio  - Current queue pressure [0, 1]
 * @returns {boolean} true if task should be rejected
 */
function shouldShed(task, pressureRatio) {
  const crit = task.criticality ?? CRITICALITY.CRITICAL;

  if (pressureRatio >= PRESSURE_LEVELS.CRITICAL) {
    // ≥ 0.910 — Only CRITICAL_PLUS survives at near-full capacity
    return crit !== CRITICALITY.CRITICAL_PLUS;
  }
  if (pressureRatio >= PRESSURE_LEVELS.HIGH_MAX) {
    // ≥ 0.854 — Shed SHEDDABLE tasks
    return crit === CRITICALITY.SHEDDABLE;
  }
  if (pressureRatio >= PRESSURE_LEVELS.ELEVATED_MAX) {
    // ≥ 0.618 — Only shed low-priority background tasks
    return crit === CRITICALITY.SHEDDABLE && (task.priority ?? 5) < 3;
  }
  return false;
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Cosine similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

// ─── DedupCache ───────────────────────────────────────────────────────────────

/**
 * Time-bounded cache for semantic deduplication.
 * Stores recent task embeddings with expiry.
 */
class DedupCache {
  /**
   * @param {number} maxSize  - Max entries (default: fib(17) = 1597)
   * @param {number} ttlMs    - Entry TTL in ms (default: fib(11) × 1000 = 89_000ms)
   */
  constructor(maxSize = DEFAULTS.DEDUP_CACHE_MAX, ttlMs = DEFAULTS.DEDUP_CACHE_TTL_MS) {
    this._maxSize = maxSize;
    this._ttlMs   = ttlMs;
    /** @type {Array<{taskId: string, embedding: number[], priority: number, expiresAt: number}>} */
    this._entries = [];
  }

  /**
   * Check whether a new task is semantically duplicate of a cached one.
   *
   * @param {number[]} embedding - New task embedding
   * @param {number}   threshold - Cosine similarity threshold (default: CSL_THRESHOLDS.CRITICAL ≈ 0.927)
   * @returns {{ isDuplicate: boolean, originalTaskId: string|null, score: number }}
   */
  checkDuplicate(embedding, threshold = SEMANTIC_DEDUP_THRESHOLD) {
    const now = Date.now();
    this._purgeExpired(now);

    for (const entry of this._entries) {
      const score = cosineSimilarity(embedding, entry.embedding);
      if (score >= threshold) {
        return { isDuplicate: true, originalTaskId: entry.taskId, score };
      }
    }
    return { isDuplicate: false, originalTaskId: null, score: 0 };
  }

  /**
   * Add a task embedding to the dedup cache.
   * When at capacity, evicts expired entries first, then the lowest-priority
   * fraction. Eviction batch size: ceil(maxSize × ψ⁴) ≈ 14.6% of cache.
   *
   * Old eviction fraction: 0.10 (10% — arbitrary)
   * New eviction fraction: Math.pow(PSI, 4) ≈ 0.146 (ψ⁴ — phi-harmonic)
   *
   * @param {string}   taskId    - Task ID
   * @param {number[]} embedding - Task embedding vector
   * @param {number}   priority  - Task priority (higher priority entries survive eviction longer)
   */
  add(taskId, embedding, priority = 5) {
    if (this._entries.length >= this._maxSize) {
      // Evict: remove expired first, then lowest-priority
      const now = Date.now();
      this._purgeExpired(now);
      if (this._entries.length >= this._maxSize) {
        this._entries.sort((a, b) => a.priority - b.priority);
        // ψ⁴ ≈ 0.146 — replaces arbitrary 0.10 eviction fraction
        this._entries.splice(0, Math.ceil(this._maxSize * Math.pow(PSI, 4)));
      }
    }
    this._entries.push({
      taskId,
      embedding,
      priority,
      expiresAt: Date.now() + this._ttlMs,
    });
  }

  /**
   * Remove a task entry (when the original task completes).
   * @param {string} taskId
   */
  remove(taskId) {
    const idx = this._entries.findIndex(e => e.taskId === taskId);
    if (idx !== -1) this._entries.splice(idx, 1);
  }

  /** @private */
  _purgeExpired(now) {
    this._entries = this._entries.filter(e => e.expiresAt > now);
  }

  /** @returns {number} Number of entries in cache */
  get size() { return this._entries.length; }
}

// ─── AgentBackpressureState ───────────────────────────────────────────────────

/**
 * Per-agent/swarm backpressure state tracker.
 * Manages queue, SRE throttling counters, circuit breaker, and metrics.
 */
class AgentBackpressureState {
  /**
   * @param {string} agentId  - Agent or swarm ID
   * @param {object} [opts]   - Configuration options
   * @param {number} [opts.maxQueueDepth]      - Hard queue depth limit
   * @param {number} [opts.circuitFailThreshold] - Failures before opening circuit
   * @param {number} [opts.circuitRecoveryMs]  - Time before trying half-open
   * @param {number} [opts.circuitHalfOpenProbes] - Probes to confirm recovery
   */
  constructor(agentId, opts = {}) {
    this.agentId       = agentId;
    this.maxQueueDepth = opts.maxQueueDepth ?? DEFAULTS.MAX_QUEUE_DEPTH;

    /** Current queue depth (logical — actual queue managed externally) */
    this.queueDepth    = 0;

    /** Pending task registry: taskId → { priority, criticality, enqueuedAt } */
    this.pendingTasks  = new Map();

    // ── SRE Adaptive Throttling ──────────────────────────────────────────────
    this._sreWindow = {
      requests:    0,
      accepts:     0,
      windowStart: Date.now(),
      windowMs:    SRE_WINDOW_MS,
    };

    // ── Circuit Breaker ──────────────────────────────────────────────────────
    this.circuit = {
      state:           CIRCUIT_STATE.CLOSED,
      failCount:       0,
      successCount:    0,
      lastOpenedAt:    null,
      halfOpenProbes:  0,
      FAILURE_THRESHOLD:    opts.circuitFailThreshold ?? DEFAULTS.CIRCUIT_FAILURE_THRESHOLD,
      RECOVERY_MS:          opts.circuitRecoveryMs    ?? DEFAULTS.CIRCUIT_RECOVERY_MS,
      HALF_OPEN_MAX_PROBES: opts.circuitHalfOpenProbes ?? DEFAULTS.CIRCUIT_HALF_OPEN_PROBES,
    };

    // ── Metrics ──────────────────────────────────────────────────────────────
    this.metrics = {
      totalAccepted:     0,
      totalRejected:     0,
      totalDeduplicated: 0,
      totalCompleted:    0,
      totalFailed:       0,
      totalShed:         0,
      latencies:         [],  // Ring buffer of last 100 latencies
      windowStart:       Date.now(),
      windowAccepted:    0,
      windowRejected:    0,
    };
  }

  // ── Queue Pressure ──────────────────────────────────────────────────────────

  /** @returns {number} Queue pressure ratio [0, 1] */
  get pressureRatio() {
    return Math.min(1, this.queueDepth / this.maxQueueDepth);
  }

  /**
   * Returns a pressure level label based on phi-derived boundaries.
   *
   * Old boundaries: 0.40 / 0.60 / 0.80 / 0.95 (arbitrary percentages)
   * New boundaries from PRESSURE_LEVELS (phi-harmonic):
   *   NONE:     < NOMINAL_MAX  ≈ 0.382  (ψ²)
   *   LOW:      < ELEVATED_MAX ≈ 0.618  (ψ)
   *   MEDIUM:   < HIGH_MAX     ≈ 0.854  (1 - ψ³)
   *   HIGH:     < CRITICAL     ≈ 0.910  (1 - ψ⁴)
   *   CRITICAL: ≥ CRITICAL
   *
   * @returns {string} Pressure level label from PRESSURE_LEVEL
   */
  get pressureLevel() {
    const r = this.pressureRatio;
    if (r >= PRESSURE_LEVELS.CRITICAL)    return PRESSURE_LEVEL.CRITICAL;
    if (r >= PRESSURE_LEVELS.HIGH_MAX)    return PRESSURE_LEVEL.HIGH;
    if (r >= PRESSURE_LEVELS.ELEVATED_MAX) return PRESSURE_LEVEL.MEDIUM;
    if (r >= PRESSURE_LEVELS.NOMINAL_MAX) return PRESSURE_LEVEL.LOW;
    return PRESSURE_LEVEL.NONE;
  }

  // ── Circuit Breaker ─────────────────────────────────────────────────────────

  /**
   * Check and potentially transition circuit breaker state.
   * @returns {boolean} Whether the circuit is currently allowing traffic
   */
  checkCircuit() {
    if (this.circuit.state === CIRCUIT_STATE.OPEN) {
      const elapsed = Date.now() - this.circuit.lastOpenedAt;
      if (elapsed >= this.circuit.RECOVERY_MS) {
        this.circuit.state         = CIRCUIT_STATE.HALF_OPEN;
        this.circuit.halfOpenProbes = 0;
      } else {
        return false; // Still open
      }
    }
    return true; // Closed or half-open
  }

  /**
   * Record a task outcome and update circuit breaker state.
   * @param {boolean} success
   */
  recordOutcome(taskId, success, latencyMs = 0) {
    // Remove from pending
    this.pendingTasks.delete(taskId);
    this.queueDepth = Math.max(0, this.queueDepth - 1);

    // Update metrics
    if (success) {
      this.metrics.totalCompleted++;
      this.circuit.failCount    = 0;
      this.circuit.successCount++;
      if (this.circuit.state === CIRCUIT_STATE.HALF_OPEN) {
        this.circuit.halfOpenProbes++;
        if (this.circuit.halfOpenProbes >= this.circuit.HALF_OPEN_MAX_PROBES) {
          this.circuit.state        = CIRCUIT_STATE.CLOSED;
          this.circuit.failCount    = 0;
          this.circuit.successCount = 0;
        }
      }
    } else {
      this.metrics.totalFailed++;
      this.circuit.failCount++;
      this.circuit.successCount = 0;
      if (this.circuit.failCount >= this.circuit.FAILURE_THRESHOLD) {
        this.circuit.state        = CIRCUIT_STATE.OPEN;
        this.circuit.lastOpenedAt = Date.now();
      }
    }

    // Record latency (ring buffer, max 100)
    if (latencyMs > 0) {
      this.metrics.latencies.push(latencyMs);
      if (this.metrics.latencies.length > 100) {
        this.metrics.latencies.shift();
      }
    }
  }

  // ── SRE Adaptive Throttling ──────────────────────────────────────────────────

  /**
   * Apply Google SRE adaptive throttling to decide if a request should be accepted.
   * Rotates the rolling window when it expires.
   *
   * @param {string} [criticality] - Task criticality tier
   * @returns {boolean} Whether to accept the request
   */
  sreAccept(criticality = CRITICALITY.CRITICAL) {
    const now = Date.now();
    const win = this._sreWindow;

    // Rotate window if expired
    if (now - win.windowStart >= win.windowMs) {
      win.requests    = 0;
      win.accepts     = 0;
      win.windowStart = now;
    }

    win.requests++;

    // CRITICAL_PLUS always accepted (below circuit breaker check)
    if (criticality === CRITICALITY.CRITICAL_PLUS) {
      win.accepts++;
      return true;
    }

    // P(reject) = max(0, (requests - K × accepts) / (requests + 1))
    const rejectProb = Math.max(
      0,
      (win.requests - SRE_K_MULTIPLIER * Math.max(win.accepts, 1)) / (win.requests + 1)
    );

    if (Math.random() < rejectProb) {
      return false; // Throttled
    }

    win.accepts++;
    return true;
  }

  /** @returns {number} Current SRE rejection probability [0, 1] */
  get sreRejectProbability() {
    const win = this._sreWindow;
    return Math.max(
      0,
      (win.requests - SRE_K_MULTIPLIER * Math.max(win.accepts, 1)) / (win.requests + 1)
    );
  }

  // ── Enqueue / Dequeue ───────────────────────────────────────────────────────

  /**
   * Enqueue a task (increments queue depth, registers in pending map).
   * @param {string} taskId
   * @param {number} priority
   * @param {string} criticality
   */
  enqueue(taskId, priority, criticality) {
    this.queueDepth++;
    this.pendingTasks.set(taskId, {
      priority,
      criticality,
      enqueuedAt: Date.now(),
    });
    this.metrics.totalAccepted++;
    this.metrics.windowAccepted++;
    this._sreWindow.accepts++;
  }

  /**
   * Get a snapshot of all current metrics.
   * @returns {object}
   */
  getSnapshot() {
    const latencies  = this.metrics.latencies;
    const sortedLat  = [...latencies].sort((a, b) => a - b);
    const p50        = sortedLat[Math.floor(sortedLat.length * 0.5)] ?? 0;
    const p95        = sortedLat[Math.floor(sortedLat.length * 0.95)] ?? 0;
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    return {
      agentId:           this.agentId,
      queueDepth:        this.queueDepth,
      maxQueueDepth:     this.maxQueueDepth,
      pressureRatio:     Math.round(this.pressureRatio * 1000) / 1000,
      pressureLevel:     this.pressureLevel,
      circuitState:      this.circuit.state,
      sreRejectProb:     Math.round(this.sreRejectProbability * 1000) / 1000,
      totalAccepted:     this.metrics.totalAccepted,
      totalRejected:     this.metrics.totalRejected,
      totalDeduplicated: this.metrics.totalDeduplicated,
      totalCompleted:    this.metrics.totalCompleted,
      totalFailed:       this.metrics.totalFailed,
      totalShed:         this.metrics.totalShed,
      p50LatencyMs:      p50,
      p95LatencyMs:      p95,
      avgLatencyMs:      avgLatency,
      pendingTaskCount:  this.pendingTasks.size,
      timestamp:         new Date().toISOString(),
    };
  }
}

// ─── SemanticBackpressureMonitor ──────────────────────────────────────────────

/**
 * @class SemanticBackpressureMonitor
 * @extends EventEmitter
 *
 * Platform-wide backpressure monitor for the 17-swarm Heady Latent OS.
 *
 * Responsibilities:
 *  - Track per-agent/swarm queue depth and derive pressure levels
 *  - Deduplicate semantically equivalent tasks before enqueue
 *  - Apply Google SRE adaptive throttling per agent
 *  - Manage circuit breakers and propagate upstream signals
 *  - Score and prioritize tasks for admission
 *
 * @fires SemanticBackpressureMonitor#task:accepted      Task admitted to a queue
 * @fires SemanticBackpressureMonitor#task:rejected      Task rejected (backpressure)
 * @fires SemanticBackpressureMonitor#task:deduplicated  Task merged with existing
 * @fires SemanticBackpressureMonitor#task:shed          Task shed due to load
 * @fires SemanticBackpressureMonitor#pressure:change    Pressure level changed
 * @fires SemanticBackpressureMonitor#circuit:opened     Circuit breaker tripped
 * @fires SemanticBackpressureMonitor#circuit:closed     Circuit breaker recovered
 * @fires SemanticBackpressureMonitor#backpressure:signal Upstream propagation signal
 */
class SemanticBackpressureMonitor extends EventEmitter {
  /**
   * @param {object}   [opts]
   * @param {number}   [opts.maxQueueDepth]         - Default max queue depth per agent
   * @param {number}   [opts.dedupThreshold]        - Cosine similarity dedup threshold
   * @param {number}   [opts.dedupCacheTtlMs]       - How long embeddings stay in dedup cache
   * @param {number}   [opts.circuitFailThreshold]  - Failures before circuit opens
   * @param {number}   [opts.circuitRecoveryMs]     - Recovery timeout for open circuit
   * @param {Function} [opts.embedFn]               - Async fn(text) → number[] for semantic dedup
   * @param {number}   [opts.metricsIntervalMs]     - Metrics snapshot interval (0 = disabled)
   * @param {number}   [opts.shedCheckIntervalMs]   - Load shedding scan interval
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(200);

    this._maxQueueDepth        = opts.maxQueueDepth        ?? DEFAULTS.MAX_QUEUE_DEPTH;
    this._dedupThreshold       = opts.dedupThreshold       ?? SEMANTIC_DEDUP_THRESHOLD;
    this._dedupCacheTtlMs      = opts.dedupCacheTtlMs      ?? DEFAULTS.DEDUP_CACHE_TTL_MS;
    this._circuitFailThreshold = opts.circuitFailThreshold ?? DEFAULTS.CIRCUIT_FAILURE_THRESHOLD;
    this._circuitRecoveryMs    = opts.circuitRecoveryMs    ?? DEFAULTS.CIRCUIT_RECOVERY_MS;
    this._embedFn              = opts.embedFn              ?? null;
    this._metricsIntervalMs    = opts.metricsIntervalMs    ?? 10_000;
    this._shedCheckIntervalMs  = opts.shedCheckIntervalMs  ?? DEFAULTS.SHED_CHECK_INTERVAL_MS;

    /** @type {Map<string, AgentBackpressureState>} Per-agent state */
    this._agents = new Map();

    /** @type {DedupCache} Global semantic dedup cache */
    this._dedupCache = new DedupCache(DEFAULTS.DEDUP_CACHE_MAX, this._dedupCacheTtlMs);

    /** @type {Set<string>} Agents currently emitting upstream backpressure */
    this._pressuredAgents = new Set();

    /** @type {NodeJS.Timer|null} */
    this._metricsTimer  = null;
    this._shedTimer     = null;

    if (this._metricsIntervalMs > 0) {
      this._metricsTimer = setInterval(() => this._emitMetricsSnapshot(), this._metricsIntervalMs);
    }
    if (this._shedCheckIntervalMs > 0) {
      this._shedTimer = setInterval(() => this._runShedCheck(), this._shedCheckIntervalMs);
    }
  }

  // ─── Agent Registration ────────────────────────────────────────────────────

  /**
   * Register an agent/swarm for backpressure monitoring.
   *
   * @param {string} agentId      - Unique agent or swarm identifier
   * @param {object} [agentOpts]  - Per-agent overrides (maxQueueDepth, etc.)
   * @returns {AgentBackpressureState}
   */
  registerAgent(agentId, agentOpts = {}) {
    if (this._agents.has(agentId)) return this._agents.get(agentId);

    const state = new AgentBackpressureState(agentId, {
      maxQueueDepth:         agentOpts.maxQueueDepth        ?? this._maxQueueDepth,
      circuitFailThreshold:  agentOpts.circuitFailThreshold ?? this._circuitFailThreshold,
      circuitRecoveryMs:     agentOpts.circuitRecoveryMs    ?? this._circuitRecoveryMs,
      circuitHalfOpenProbes: agentOpts.circuitHalfOpenProbes ?? DEFAULTS.CIRCUIT_HALF_OPEN_PROBES,
    });

    this._agents.set(agentId, state);
    return state;
  }

  /**
   * Ensure an agent is registered, auto-registering if absent.
   * @private
   */
  _getOrCreate(agentId) {
    if (!this._agents.has(agentId)) this.registerAgent(agentId);
    return this._agents.get(agentId);
  }

  // ─── Task Admission ────────────────────────────────────────────────────────

  /**
   * Attempt to admit a task for processing by the given agent.
   *
   * Admission pipeline:
   *   1. Circuit breaker check
   *   2. Semantic deduplication (if task has embedding or description)
   *   3. Load shedding (criticality × pressure check)
   *   4. SRE adaptive throttling
   *   5. Queue depth hard limit
   *   6. Accept → enqueue
   *
   * @param {string} agentId   - Target agent/swarm
   * @param {object} task      - Task descriptor
   * @param {string} task.id   - Unique task ID
   * @param {string} [task.description]  - Text description for semantic dedup
   * @param {number[]} [task.embedding]  - Pre-computed embedding (skips embedFn)
   * @param {string} [task.criticality]  - CRITICALITY level
   * @param {number} [task.urgency]      - Urgency [0, 10]
   * @param {number} [task.userImpact]   - User impact [0, 10]
   * @param {number} [task.priority]     - Explicit priority override [0, 10]
   * @returns {Promise<AdmissionResult>}
   */
  async admitTask(agentId, task) {
    const state     = this._getOrCreate(agentId);
    const taskId    = task.id ?? randomUUID();
    const priority  = computePriorityScore(task);
    const prevLevel = state.pressureLevel;

    // ── 1. Circuit Breaker ─────────────────────────────────────────────────
    if (!state.checkCircuit()) {
      state.metrics.totalRejected++;
      /**
       * @event SemanticBackpressureMonitor#task:rejected
       */
      this.emit('task:rejected', {
        agentId, taskId, reason: 'circuit_open', priority,
        circuitState: state.circuit.state,
      });
      return { accepted: false, taskId, reason: 'circuit_open', priority };
    }

    // ── 2. Semantic Deduplication ──────────────────────────────────────────
    let embedding = task.embedding ?? null;
    if (!embedding && this._embedFn && task.description) {
      try {
        embedding = await this._embedFn(task.description);
      } catch (_) { /* dedup unavailable — skip */ }
    }

    if (embedding) {
      const { isDuplicate, originalTaskId, score } = this._dedupCache.checkDuplicate(
        embedding,
        this._dedupThreshold
      );

      if (isDuplicate) {
        state.metrics.totalDeduplicated++;
        // If new task has higher priority, boost the original
        const original = state.pendingTasks.get(originalTaskId);
        if (original && priority > original.priority) {
          original.priority = priority;
        }

        /**
         * @event SemanticBackpressureMonitor#task:deduplicated
         */
        this.emit('task:deduplicated', {
          agentId, taskId, originalTaskId,
          similarityScore: Math.round(score * 1000) / 1000,
          priority,
        });
        return {
          accepted:        false,
          taskId,
          reason:          'semantic_duplicate',
          originalTaskId,
          similarityScore: score,
          priority,
        };
      }
    }

    // ── 3. Load Shedding ───────────────────────────────────────────────────
    if (shouldShed(task, state.pressureRatio)) {
      state.metrics.totalRejected++;
      state.metrics.totalShed++;

      /**
       * @event SemanticBackpressureMonitor#task:shed
       */
      this.emit('task:shed', {
        agentId, taskId, priority,
        criticality:   task.criticality ?? CRITICALITY.CRITICAL,
        pressureLevel: state.pressureLevel,
        pressureRatio: state.pressureRatio,
      });
      return {
        accepted:      false,
        taskId,
        reason:        'load_shed',
        pressureLevel: state.pressureLevel,
        priority,
      };
    }

    // ── 4. SRE Adaptive Throttling ─────────────────────────────────────────
    if (!state.sreAccept(task.criticality ?? CRITICALITY.CRITICAL)) {
      state.metrics.totalRejected++;
      state.metrics.windowRejected++;

      this.emit('task:rejected', {
        agentId, taskId, reason: 'sre_throttle',
        sreRejectProb: state.sreRejectProbability,
        priority,
      });
      return {
        accepted:             false,
        taskId,
        reason:               'sre_throttle',
        sreRejectProbability: state.sreRejectProbability,
        priority,
      };
    }

    // ── 5. Hard Queue Limit ────────────────────────────────────────────────
    if (state.queueDepth >= state.maxQueueDepth) {
      state.metrics.totalRejected++;
      state.metrics.windowRejected++;

      this.emit('task:rejected', {
        agentId, taskId, reason: 'queue_full',
        queueDepth: state.queueDepth,
        priority,
      });
      return {
        accepted:   false,
        taskId,
        reason:     'queue_full',
        queueDepth: state.queueDepth,
        priority,
      };
    }

    // ── 6. Accept ──────────────────────────────────────────────────────────
    state.enqueue(taskId, priority, task.criticality ?? CRITICALITY.CRITICAL);

    // Add to dedup cache
    if (embedding) {
      this._dedupCache.add(taskId, embedding, priority);
    }

    // Check for pressure level change
    const newLevel = state.pressureLevel;
    if (newLevel !== prevLevel) {
      this._onPressureChange(agentId, state, prevLevel, newLevel);
    }

    /**
     * @event SemanticBackpressureMonitor#task:accepted
     */
    this.emit('task:accepted', {
      agentId, taskId, priority,
      queueDepth:    state.queueDepth,
      pressureLevel: state.pressureLevel,
    });

    return {
      accepted:      true,
      taskId,
      priority,
      queueDepth:    state.queueDepth,
      pressureLevel: state.pressureLevel,
    };
  }

  /**
   * Record that a task has completed (success or failure).
   * Updates circuit breaker, metrics, removes dedup cache entry.
   *
   * @param {string}  agentId    - Agent/swarm that processed the task
   * @param {string}  taskId     - Completed task ID
   * @param {boolean} success    - Whether task succeeded
   * @param {number}  [latencyMs] - Task execution duration
   */
  recordCompletion(agentId, taskId, success, latencyMs = 0) {
    const state = this._agents.get(agentId);
    if (!state) return;

    const prevLevel = state.pressureLevel;
    state.recordOutcome(taskId, success, latencyMs);

    // Remove from dedup cache on completion
    this._dedupCache.remove(taskId);

    // Circuit state change events
    if (!success && state.circuit.state === CIRCUIT_STATE.OPEN) {
      /**
       * @event SemanticBackpressureMonitor#circuit:opened
       */
      this.emit('circuit:opened', { agentId, failCount: state.circuit.failCount });
    } else if (success && state.circuit.state === CIRCUIT_STATE.CLOSED && prevLevel !== state.pressureLevel) {
      /**
       * @event SemanticBackpressureMonitor#circuit:closed
       */
      this.emit('circuit:closed', { agentId });
    }

    // Pressure change check
    const newLevel = state.pressureLevel;
    if (newLevel !== prevLevel) {
      this._onPressureChange(agentId, state, prevLevel, newLevel);
    }
  }

  // ─── Backpressure Signal Propagation ──────────────────────────────────────

  /**
   * Get the current backpressure signal for an agent.
   * Upstream callers should use this to self-throttle.
   *
   * Thresholds:
   *   shouldSlow: pressure > ELEVATED_MAX ≈ 0.618  (replaces arbitrary 0.60)
   *   shouldStop: pressure > CRITICAL     ≈ 0.910  (replaces arbitrary 0.90)
   *
   * @param {string} agentId
   * @returns {{ pressure: number, level: string, shouldSlow: boolean, shouldStop: boolean }}
   */
  getBackpressureSignal(agentId) {
    const state = this._agents.get(agentId);
    if (!state) return { pressure: 0, level: PRESSURE_LEVEL.NONE, shouldSlow: false, shouldStop: false };

    const pressure = state.pressureRatio;
    return {
      agentId,
      pressure,
      level:       state.pressureLevel,
      // ELEVATED_MAX ≈ 0.618 replaces arbitrary 0.60
      shouldSlow:  pressure > PRESSURE_LEVELS.ELEVATED_MAX,
      // CRITICAL ≈ 0.910 replaces arbitrary 0.90
      shouldStop:  pressure > PRESSURE_LEVELS.CRITICAL || state.circuit.state === CIRCUIT_STATE.OPEN,
      circuitOpen: state.circuit.state === CIRCUIT_STATE.OPEN,
      sreRejectProb: state.sreRejectProbability,
    };
  }

  /**
   * Propagate backpressure signals to all registered upstream agents.
   * Called when a downstream agent enters HIGH or CRITICAL pressure.
   *
   * @param {string}   downstreamAgentId - Overloaded downstream agent
   * @param {string[]} upstreamAgentIds  - Agents to signal
   */
  propagateBackpressure(downstreamAgentId, upstreamAgentIds) {
    const signal = this.getBackpressureSignal(downstreamAgentId);

    for (const upstreamId of upstreamAgentIds) {
      /**
       * @event SemanticBackpressureMonitor#backpressure:signal
       */
      this.emit('backpressure:signal', {
        from:       downstreamAgentId,
        to:         upstreamId,
        pressure:   signal.pressure,
        level:      signal.level,
        shouldSlow: signal.shouldSlow,
        shouldStop: signal.shouldStop,
      });
    }
  }

  // ─── Observability ─────────────────────────────────────────────────────────

  /**
   * Get a snapshot of all agent states.
   * @returns {object[]}
   */
  getAllSnapshots() {
    return [...this._agents.values()].map(s => s.getSnapshot());
  }

  /**
   * Get snapshot for a specific agent.
   * @param {string} agentId
   * @returns {object|null}
   */
  getSnapshot(agentId) {
    return this._agents.get(agentId)?.getSnapshot() ?? null;
  }

  /**
   * Get platform-wide aggregate metrics.
   * @returns {object}
   */
  getPlatformMetrics() {
    const snapshots = this.getAllSnapshots();
    const critical  = snapshots.filter(s =>
      s.pressureLevel === PRESSURE_LEVEL.CRITICAL ||
      s.pressureLevel === PRESSURE_LEVEL.HIGH
    );

    return {
      totalAgents:      this._agents.size,
      criticalAgents:   critical.map(s => s.agentId),
      totalQueueDepth:  snapshots.reduce((sum, s) => sum + s.queueDepth, 0),
      avgPressure:      snapshots.length > 0
        ? Math.round(snapshots.reduce((sum, s) => sum + s.pressureRatio, 0) / snapshots.length * 1000) / 1000
        : 0,
      dedupCacheSize:   this._dedupCache.size,
      totalAccepted:    snapshots.reduce((sum, s) => sum + s.totalAccepted, 0),
      totalRejected:    snapshots.reduce((sum, s) => sum + s.totalRejected, 0),
      totalDeduplicated: snapshots.reduce((sum, s) => sum + s.totalDeduplicated, 0),
      totalShed:        snapshots.reduce((sum, s) => sum + s.totalShed, 0),
      openCircuits:     snapshots.filter(s => s.circuitState === CIRCUIT_STATE.OPEN).map(s => s.agentId),
      timestamp:        new Date().toISOString(),
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Graceful shutdown: stop timers, remove listeners.
   */
  destroy() {
    if (this._metricsTimer) clearInterval(this._metricsTimer);
    if (this._shedTimer)    clearInterval(this._shedTimer);
    this.removeAllListeners();
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Handle a pressure level transition for an agent.
   * @private
   */
  _onPressureChange(agentId, state, prevLevel, newLevel) {
    /**
     * @event SemanticBackpressureMonitor#pressure:change
     */
    this.emit('pressure:change', {
      agentId,
      previousLevel: prevLevel,
      currentLevel:  newLevel,
      pressureRatio: state.pressureRatio,
      queueDepth:    state.queueDepth,
    });

    // Track pressured agents for platform-wide signals
    if (newLevel === PRESSURE_LEVEL.HIGH || newLevel === PRESSURE_LEVEL.CRITICAL) {
      this._pressuredAgents.add(agentId);
    } else {
      this._pressuredAgents.delete(agentId);
    }
  }

  /**
   * Periodic load-shedding scan: check all agents and emit signals as needed.
   *
   * Threshold: ELEVATED_MAX ≈ 0.618 (replaces arbitrary 0.70).
   * Fires 'backpressure:high' for any agent in the elevated or above zone.
   * @private
   */
  _runShedCheck() {
    for (const [agentId, state] of this._agents) {
      // Auto-transition circuit breaker
      state.checkCircuit();

      // Propagate backpressure for high-pressure agents
      // ELEVATED_MAX ≈ 0.618 replaces arbitrary 0.70
      if (state.pressureRatio > PRESSURE_LEVELS.ELEVATED_MAX) {
        this.emit('backpressure:high', {
          agentId,
          pressureRatio: state.pressureRatio,
          pressureLevel: state.pressureLevel,
          queueDepth:    state.queueDepth,
          circuitState:  state.circuit.state,
        });
      }
    }
  }

  /**
   * Emit periodic metrics snapshots for observability.
   * @private
   */
  _emitMetricsSnapshot() {
    this.emit('metrics:snapshot', {
      platform: this.getPlatformMetrics(),
      agents:   this.getAllSnapshots(),
    });
  }
}

// ─── Factory Helpers ──────────────────────────────────────────────────────────

/**
 * Create a SemanticBackpressureMonitor pre-configured for the 17-swarm Heady platform.
 *
 * Phi-derived defaults applied:
 *   maxQueueDepth:        fib(13) = 233     (was 500)
 *   dedupThreshold:       CSL_THRESHOLDS.CRITICAL ≈ 0.927  (was SEMANTIC_DEDUP_THRESHOLD)
 *   circuitFailThreshold: fib(5)  = 5       (was 5 — now Fibonacci-grounded)
 *   circuitRecoveryMs:    45_000            (operational SLA — kept as-is)
 *
 * @param {object} [opts] - Override options
 * @returns {SemanticBackpressureMonitor}
 */
function createHeadyBackpressureMonitor(opts = {}) {
  return new SemanticBackpressureMonitor({
    maxQueueDepth:        DEFAULTS.MAX_QUEUE_DEPTH,        // fib(13) = 233
    dedupThreshold:       SEMANTIC_DEDUP_THRESHOLD,        // CSL_THRESHOLDS.CRITICAL ≈ 0.927
    circuitFailThreshold: DEFAULTS.CIRCUIT_FAILURE_THRESHOLD, // fib(5) = 5
    circuitRecoveryMs:    DEFAULTS.CIRCUIT_RECOVERY_MS,   // 45_000ms (SLA)
    metricsIntervalMs:    10_000,
    shedCheckIntervalMs:  1_000,
    ...opts,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  SemanticBackpressureMonitor,
  AgentBackpressureState,
  DedupCache,
  PRESSURE_LEVEL,
  CIRCUIT_STATE,
  CRITICALITY,
  CRITICALITY_WEIGHT,
  SEMANTIC_DEDUP_THRESHOLD,
  SRE_K_MULTIPLIER,
  SRE_WINDOW_MS,
  DEFAULTS as BACKPRESSURE_DEFAULTS,
  computePriorityScore,
  shouldShed,
  cosineSimilarity,
  createHeadyBackpressureMonitor,
};

export default SemanticBackpressureMonitor;

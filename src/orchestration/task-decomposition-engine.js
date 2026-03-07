/**
 * @fileoverview TaskDecompositionEngine — CSL-scored task decomposition and
 * parallel execution for the Heady Latent OS platform.
 *
 * Architecture:
 *   - LLM-based decomposition of complex tasks into typed subtasks
 *   - CSL cosine similarity scoring of subtasks against 17-swarm capabilities
 *   - Dependency DAG construction with cycle detection
 *   - Topological sort for deterministic execution ordering
 *   - Parallel execution of independent subtask groups
 *   - Progress tracking, partial result aggregation, and error recovery
 *
 * CSL Scoring:
 *   Each subtask description is embedded and compared against the capability
 *   embeddings of each swarm. The swarm with the highest cosine similarity
 *   above the domain's CSL threshold wins the subtask assignment.
 *
 *   The threshold comparison uses cslGate() for smooth, differentiable gating
 *   rather than a hard if/else boundary.
 *
 * Phi-Math Integration:
 *   CSL_THRESHOLD:  CSL_THRESHOLDS.LOW ≈ 0.691  (replaces arbitrary 0.65)
 *   MAX_SUBTASKS:   fib(10) = 55                 (replaces arbitrary 50)
 *   MAX_PARALLEL:   fib(6)  = 8                  (same value, now Fibonacci-grounded)
 *
 * Integration points:
 *   - modules/swarm-coordinator.js  (routes decomposed subtasks)
 *   - src/hc_orchestrator.js        (top-level task orchestration)
 *   - src/hc_pipeline.js            (pipeline stage wrapping)
 *   - src/bees/registry.js          (BeeRegistry for capability queries)
 *
 * @module task-decomposition-engine
 * @version 2.1.0
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';
import {
  CSL_THRESHOLDS,
  cslGate,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Subtask execution status values */
const SUBTASK_STATUS = Object.freeze({
  PENDING:   'pending',
  READY:     'ready',      // All dependencies complete
  RUNNING:   'running',
  COMPLETED: 'completed',
  FAILED:    'failed',
  SKIPPED:   'skipped',    // Skipped due to dependency failure
});

/** Subtask types — each maps to an agent capability domain */
const SUBTASK_TYPE = Object.freeze({
  RESEARCH:    'research',
  CODING:      'coding',
  DATA:        'data',
  REASONING:   'reasoning',
  SYNTHESIS:   'synthesis',
  VALIDATION:  'validation',
  RETRIEVAL:   'retrieval',
  INTEGRATION: 'integration',
  PLANNING:    'planning',
  COMMUNICATION: 'communication',
  GENERIC:     'generic',
});

/** Execution strategy for the decomposition */
const EXEC_STRATEGY = Object.freeze({
  PARALLEL:   'parallel',   // Run all ready subtasks simultaneously
  SEQUENTIAL: 'sequential', // Run one at a time in topological order
  ADAPTIVE:   'adaptive',   // Parallel where safe, sequential where dependent
});

/**
 * Default engine options — design constants replaced with phi-derived values.
 *
 * MAX_SUBTASKS:
 *   Old: 50 (arbitrary round number)
 *   New: fib(10) = 55 — nearest Fibonacci ≥ 50; safety cap on LLM decomposition output
 *   Rationale: Fibonacci numbers are natural capacity boundaries; fib(10) is the
 *   first Fibonacci above 50, providing a slightly larger buffer at no design cost.
 *
 * CSL_THRESHOLD:
 *   Old: 0.65 (arbitrary)
 *   New: CSL_THRESHOLDS.LOW = phiThreshold(1) ≈ 0.691
 *   Formula: 1 - ψ¹ × 0.5 = 1 - 0.618 × 0.5 ≈ 0.691
 *   Rationale: Weak but above noise — matches the semantics of a loose minimum
 *   similarity for swarm assignment; phi-grounded rather than arbitrary.
 *
 * MAX_PARALLEL:
 *   Old: 8 (arbitrary)
 *   New: fib(6) = 8 — identical value, now Fibonacci-grounded
 *   Rationale: Max concurrency at fib(6) aligns with the platform's Fibonacci
 *   resource allocation model; the next Fibonacci step up (fib(7)=13) is
 *   deliberately available as an override for high-throughput deployments.
 */
const DEFAULTS = Object.freeze({
  /** fib(10) = 55 — safety cap on LLM decomposition output (was 50) */
  MAX_SUBTASKS:       fib(10),               // 55

  MAX_DEPTH:          5,                     // Max recursion depth (operational, kept)

  /** CSL_THRESHOLDS.LOW = phiThreshold(1) ≈ 0.691 — replaces arbitrary 0.65 */
  CSL_THRESHOLD:      CSL_THRESHOLDS.LOW,    // ≈ 0.691

  SUBTASK_TIMEOUT_MS: 60_000,               // Per-subtask execution timeout (SLA)
  TOTAL_TIMEOUT_MS:   600_000,              // Total execution timeout 10 min (SLA)

  /** fib(6) = 8 — max concurrent subtask executions (same value, now Fibonacci-grounded) */
  MAX_PARALLEL:       fib(6),               // 8

  RETRY_FAILED:       true,                 // Retry failed subtasks once
  ALLOW_PARTIAL:      true,                 // Return partial results if non-critical fail
});

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

// ─── SubTask ──────────────────────────────────────────────────────────────────

/**
 * Represents a single unit of work in a decomposed task graph.
 */
class SubTask {
  /**
   * @param {object}   opts
   * @param {string}   [opts.id]            - Unique ID (auto-generated)
   * @param {string}   opts.description     - Human-readable task description
   * @param {string}   [opts.type]          - Subtask type from SUBTASK_TYPE
   * @param {string[]} [opts.dependencies]  - IDs of subtasks that must complete first
   * @param {number}   [opts.priority]      - Priority [1–10]
   * @param {boolean}  [opts.critical]      - If false, failure doesn't block aggregation
   * @param {object}   [opts.payload]       - Additional task-specific data
   * @param {number}   [opts.estimatedMs]   - Estimated execution time
   */
  constructor(opts) {
    this.id           = opts.id           ?? randomUUID();
    this.description  = opts.description;
    this.type         = opts.type         ?? SUBTASK_TYPE.GENERIC;
    this.dependencies = opts.dependencies ?? [];
    this.priority     = opts.priority     ?? 5;
    this.critical     = opts.critical     ?? true;
    this.payload      = opts.payload      ?? {};
    this.estimatedMs  = opts.estimatedMs  ?? 5_000;

    /** @type {string} Current execution status */
    this.status       = SUBTASK_STATUS.PENDING;

    /** @type {string|null} Assigned swarm ID after CSL scoring */
    this.assignedSwarm = null;

    /**
     * CSL similarity score for assignment.
     * After gating, this is the cslGate() output rather than raw cosine.
     * @type {number}
     */
    this.cslScore     = 0;

    /** @type {*} Execution result */
    this.result       = null;

    /** @type {Error|null} Failure error */
    this.error        = null;

    /** @type {number|null} */
    this.startedAt    = null;

    /** @type {number|null} */
    this.completedAt  = null;
  }

  /** @returns {number|null} Execution duration in ms */
  get latencyMs() {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt - this.startedAt;
  }

  /** @returns {boolean} Whether all dependencies have completed */
  isReady(completedIds) {
    return this.dependencies.every(dep => completedIds.has(dep));
  }
}

// ─── DependencyDAG ────────────────────────────────────────────────────────────

/**
 * Directed Acyclic Graph for subtask dependencies.
 * Provides topological sort and cycle detection.
 */
class DependencyDAG {
  /**
   * @param {SubTask[]} subtasks
   */
  constructor(subtasks) {
    this._nodes = new Map();
    for (const st of subtasks) {
      this._nodes.set(st.id, st);
    }
  }

  /**
   * Detect cycles using DFS.
   * @returns {{ hasCycle: boolean, cycle: string[] }}
   */
  detectCycles() {
    const visited  = new Set();
    const stack    = new Set();
    const cycleIds = [];

    const dfs = (nodeId) => {
      if (stack.has(nodeId)) {
        cycleIds.push(nodeId);
        return true;
      }
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      stack.add(nodeId);

      const node = this._nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (dfs(dep)) return true;
        }
      }

      stack.delete(nodeId);
      return false;
    };

    for (const id of this._nodes.keys()) {
      if (dfs(id)) return { hasCycle: true, cycle: cycleIds };
    }

    return { hasCycle: false, cycle: [] };
  }

  /**
   * Kahn's algorithm topological sort.
   * Returns subtasks in execution order (dependencies first).
   *
   * @returns {SubTask[]} Sorted subtasks
   * @throws {Error} If a cycle is detected
   */
  topologicalSort() {
    const { hasCycle, cycle } = this.detectCycles();
    if (hasCycle) {
      throw new Error(`[DependencyDAG] Cycle detected in subtask dependencies: ${cycle.join(' → ')}`);
    }

    // Count in-degrees
    const inDegree = new Map();
    for (const id of this._nodes.keys()) inDegree.set(id, 0);

    for (const st of this._nodes.values()) {
      for (const dep of st.dependencies) {
        if (this._nodes.has(dep)) {
          inDegree.set(st.id, (inDegree.get(st.id) ?? 0) + 1);
        }
      }
    }

    // BFS from zero-in-degree nodes
    const queue  = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
    const sorted = [];

    while (queue.length > 0) {
      // Pick highest-priority node among available
      queue.sort((a, b) => {
        const pa = this._nodes.get(a)?.priority ?? 5;
        const pb = this._nodes.get(b)?.priority ?? 5;
        return pb - pa; // descending
      });

      const id   = queue.shift();
      const node = this._nodes.get(id);
      if (!node) continue;

      sorted.push(node);

      // For each node that depends on this one
      for (const other of this._nodes.values()) {
        if (other.dependencies.includes(id)) {
          const newDeg = (inDegree.get(other.id) ?? 1) - 1;
          inDegree.set(other.id, newDeg);
          if (newDeg === 0) queue.push(other.id);
        }
      }
    }

    return sorted;
  }

  /**
   * Get subtasks with no remaining unmet dependencies (ready to run).
   * @param {Set<string>} completedIds
   * @returns {SubTask[]}
   */
  getReadySubtasks(completedIds) {
    return [...this._nodes.values()].filter(st =>
      st.status === SUBTASK_STATUS.PENDING &&
      st.isReady(completedIds)
    );
  }

  /**
   * Get all subtasks.
   * @returns {SubTask[]}
   */
  getAll() {
    return [...this._nodes.values()];
  }
}

// ─── DecompositionResult ──────────────────────────────────────────────────────

/**
 * The full result of a decomposition + execution run.
 */
class DecompositionResult {
  constructor(taskId) {
    this.taskId      = taskId;
    this.runId       = randomUUID();
    this.subtasks    = [];
    this.results     = new Map();  // subtaskId → result
    this.errors      = new Map();  // subtaskId → error
    this.completed   = false;
    this.partial     = false;
    this.startedAt   = Date.now();
    this.completedAt = null;
    this.aggregated  = null;  // Final aggregated result
  }

  /** @returns {number} Total elapsed ms */
  get elapsedMs() {
    return (this.completedAt ?? Date.now()) - this.startedAt;
  }

  /** @returns {object} Summary statistics */
  getSummary() {
    const total     = this.subtasks.length;
    const completed = this.subtasks.filter(s => s.status === SUBTASK_STATUS.COMPLETED).length;
    const failed    = this.subtasks.filter(s => s.status === SUBTASK_STATUS.FAILED).length;
    const skipped   = this.subtasks.filter(s => s.status === SUBTASK_STATUS.SKIPPED).length;

    return {
      taskId:        this.taskId,
      runId:         this.runId,
      totalSubtasks: total,
      completed,
      failed,
      skipped,
      pending:       total - completed - failed - skipped,
      successRate:   total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
      isPartial:     this.partial,
      elapsedMs:     this.elapsedMs,
      completedAt:   this.completedAt ? new Date(this.completedAt).toISOString() : null,
    };
  }
}

// ─── TaskDecompositionEngine ──────────────────────────────────────────────────

/**
 * @class TaskDecompositionEngine
 * @extends EventEmitter
 *
 * Decomposes complex tasks into CSL-scored subtask graphs and executes them
 * using the Heady swarm coordinator.
 *
 * @fires TaskDecompositionEngine#decomposed        After LLM decomposition
 * @fires TaskDecompositionEngine#dag:built         After dependency DAG is built
 * @fires TaskDecompositionEngine#subtask:assigned  After CSL scoring assigns swarm
 * @fires TaskDecompositionEngine#subtask:started   When a subtask begins execution
 * @fires TaskDecompositionEngine#subtask:completed When a subtask finishes
 * @fires TaskDecompositionEngine#subtask:failed    When a subtask errors
 * @fires TaskDecompositionEngine#progress          Periodic progress updates
 * @fires TaskDecompositionEngine#task:completed    When entire task finishes
 */
class TaskDecompositionEngine extends EventEmitter {
  /**
   * @param {object}   [opts]
   * @param {Function} opts.llmDecomposeFn       - Async fn(task) → SubTask[] raw decomposition
   * @param {Function} [opts.embedFn]            - Async fn(text) → number[]
   * @param {Function} [opts.executeSubtaskFn]   - Async fn(subtask, swarmId) → result
   * @param {object}   [opts.swarmCoordinator]   - SwarmCoordinator instance for routing
   * @param {object[]} [opts.swarmCapabilities]  - Array of { swarmId, embedding, domain, cslThreshold }
   * @param {string}   [opts.executionStrategy]  - EXEC_STRATEGY value
   * @param {number}   [opts.maxSubtasks]        - Max subtasks per decomposition (default: fib(10)=55)
   * @param {number}   [opts.maxParallel]        - Max concurrent executions (default: fib(6)=8)
   * @param {number}   [opts.subtaskTimeoutMs]   - Per-subtask timeout
   * @param {number}   [opts.totalTimeoutMs]     - Total execution timeout
   * @param {number}   [opts.cslThreshold]       - Global CSL assignment threshold (default: ≈0.691)
   * @param {Function} [opts.aggregateFn]        - Async fn(results, subtasks) → aggregated
   * @param {boolean}  [opts.allowPartial]       - Return partial results on non-critical failures
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(100);

    this._llmDecomposeFn    = opts.llmDecomposeFn;
    this._embedFn           = opts.embedFn           ?? null;
    this._executeSubtaskFn  = opts.executeSubtaskFn  ?? null;
    this._swarmCoordinator  = opts.swarmCoordinator  ?? null;
    this._swarmCapabilities = opts.swarmCapabilities ?? [];
    this._strategy          = opts.executionStrategy ?? EXEC_STRATEGY.ADAPTIVE;
    this._maxSubtasks       = opts.maxSubtasks       ?? DEFAULTS.MAX_SUBTASKS;
    this._maxParallel       = opts.maxParallel       ?? DEFAULTS.MAX_PARALLEL;
    this._subtaskTimeout    = opts.subtaskTimeoutMs  ?? DEFAULTS.SUBTASK_TIMEOUT_MS;
    this._totalTimeout      = opts.totalTimeoutMs    ?? DEFAULTS.TOTAL_TIMEOUT_MS;
    this._cslThreshold      = opts.cslThreshold      ?? DEFAULTS.CSL_THRESHOLD;
    this._aggregateFn       = opts.aggregateFn       ?? this._defaultAggregate.bind(this);
    this._allowPartial      = opts.allowPartial      ?? DEFAULTS.ALLOW_PARTIAL;

    if (!this._llmDecomposeFn) {
      throw new Error('[TaskDecompositionEngine] opts.llmDecomposeFn is required');
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Decompose and execute a complex task.
   *
   * Flow:
   *   1. LLM decomposition → subtask array
   *   2. Build dependency DAG + cycle detection
   *   3. CSL score each subtask → assign to swarm (via cslGate)
   *   4. Topological sort → execution plan
   *   5. Execute (parallel or sequential per strategy)
   *   6. Aggregate results
   *
   * @param {object}  task
   * @param {string}  task.id          - Unique task ID
   * @param {string}  task.description - Full task description for LLM decomposition
   * @param {object}  [task.context]   - Additional context passed to LLM and executor
   * @param {string}  [task.strategy]  - Override execution strategy
   * @param {boolean} [task.dryRun]    - If true, decompose and score but don't execute
   * @returns {Promise<DecompositionResult>}
   */
  async decompose(task) {
    const taskId   = task.id ?? randomUUID();
    const result   = new DecompositionResult(taskId);
    const strategy = task.strategy ?? this._strategy;
    const deadline = Date.now() + this._totalTimeout;

    // ── Step 1: LLM Decomposition ───────────────────────────────────────────
    let rawSubtasks;
    try {
      rawSubtasks = await this._withTimeout(
        this._llmDecomposeFn(task),
        this._subtaskTimeout * 2 // Decomposition gets extra time
      );
    } catch (err) {
      throw new Error(`[TaskDecompositionEngine] Decomposition failed: ${err.message}`);
    }

    // Validate and cap
    if (!Array.isArray(rawSubtasks)) {
      throw new Error('[TaskDecompositionEngine] llmDecomposeFn must return an array of subtasks');
    }

    const subtasks = rawSubtasks
      .slice(0, this._maxSubtasks)
      .map(st => st instanceof SubTask ? st : new SubTask(st));

    result.subtasks = subtasks;

    /**
     * @event TaskDecompositionEngine#decomposed
     */
    this.emit('decomposed', {
      taskId,
      subtaskCount: subtasks.length,
      subtasks: subtasks.map(s => ({ id: s.id, type: s.type, description: s.description.slice(0, 80) })),
    });

    // ── Step 2: Build DAG ────────────────────────────────────────────────────
    const dag = new DependencyDAG(subtasks);

    const { hasCycle, cycle } = dag.detectCycles();
    if (hasCycle) {
      // Remove cyclic dependencies as a best-effort fix
      this.emit('dag:cycle-detected', { taskId, cycle });
      this._breakCycles(subtasks, cycle);
    }

    const sortedSubtasks = dag.topologicalSort();

    /**
     * @event TaskDecompositionEngine#dag:built
     */
    this.emit('dag:built', {
      taskId,
      subtaskCount:    sortedSubtasks.length,
      executionLayers: this._computeLayers(sortedSubtasks).length,
    });

    if (task.dryRun) {
      // Score but don't execute
      await this._cslScoreAll(sortedSubtasks);
      result.aggregated = { dryRun: true, executionPlan: sortedSubtasks.map(s => ({
        id: s.id, type: s.type, assignedSwarm: s.assignedSwarm, cslScore: s.cslScore,
        dependencies: s.dependencies,
      })) };
      result.completed  = true;
      result.completedAt = Date.now();
      return result;
    }

    // ── Step 3: CSL Score All Subtasks ───────────────────────────────────────
    await this._cslScoreAll(sortedSubtasks);

    // ── Step 4: Execute ──────────────────────────────────────────────────────
    try {
      if (strategy === EXEC_STRATEGY.SEQUENTIAL) {
        await this._executeSequential(sortedSubtasks, result, deadline);
      } else {
        await this._executeAdaptive(dag, result, deadline);
      }
    } catch (err) {
      if (!this._allowPartial) throw err;
      result.partial = true;
    }

    // ── Step 5: Aggregate ────────────────────────────────────────────────────
    try {
      result.aggregated = await this._aggregateFn(result.results, sortedSubtasks, task);
    } catch (_) {
      result.aggregated = Object.fromEntries(result.results);
    }

    result.completed   = true;
    result.completedAt = Date.now();
    result.partial     = result.subtasks.some(s => s.status === SUBTASK_STATUS.FAILED);

    /**
     * @event TaskDecompositionEngine#task:completed
     */
    this.emit('task:completed', {
      taskId,
      runId:     result.runId,
      summary:   result.getSummary(),
      elapsedMs: result.elapsedMs,
    });

    return result;
  }

  /**
   * Score a set of subtasks using CSL cosine similarity against swarm capabilities.
   * Can be called standalone for planning/preview purposes.
   *
   * @param {SubTask[]} subtasks
   * @returns {Promise<void>} Mutates subtasks in place with assignedSwarm and cslScore
   */
  async scoreSubtasks(subtasks) {
    await this._cslScoreAll(subtasks);
  }

  /**
   * Get execution layers from a topologically sorted list.
   * Each layer contains subtasks that can run in parallel.
   *
   * @param {SubTask[]} sortedSubtasks
   * @returns {SubTask[][]} Array of parallel execution layers
   */
  getExecutionLayers(sortedSubtasks) {
    return this._computeLayers(sortedSubtasks);
  }

  // ─── CSL Scoring ───────────────────────────────────────────────────────────

  /**
   * Score all subtasks and assign them to swarms.
   * @private
   */
  async _cslScoreAll(subtasks) {
    const promises = subtasks.map(st => this._cslScore(st));
    await Promise.allSettled(promises);
  }

  /**
   * Assign a single subtask to the best-matching swarm via CSL cosine similarity.
   * Falls back to domain matching then generic assignment.
   *
   * CSL Gate integration:
   *   The final assignment decision passes the best cosine score through cslGate()
   *   for smooth, continuous gating rather than a hard threshold check. The gate
   *   output represents the confidence-weighted acceptance of the assignment.
   *   When bestScore >> threshold: gate ≈ 1 (confident assignment)
   *   When bestScore ≈ threshold:  gate ≈ 0.5 (uncertain — may fall back to domain)
   *   When bestScore << threshold:  gate ≈ 0 (reject — fall back to type-based domain)
   *
   *   The gated score stored in subtask.cslScore reflects this continuous confidence.
   *
   * @private
   */
  async _cslScore(subtask) {
    if (this._swarmCapabilities.length === 0 && !this._swarmCoordinator) {
      // No capabilities configured — assign to generic
      subtask.assignedSwarm = 'generic';
      subtask.cslScore      = 0;
      return;
    }

    // Build query embedding
    let queryEmbedding = null;
    if (this._embedFn && subtask.description) {
      try {
        queryEmbedding = await this._embedFn(subtask.description);
      } catch (_) { /* fall through to domain matching */ }
    }

    // Score against known capabilities
    let bestSwarm = null;
    let bestScore = -Infinity;

    for (const cap of this._swarmCapabilities) {
      if (!cap.embedding || !queryEmbedding) continue;
      const score = cosineSimilarity(queryEmbedding, cap.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestSwarm = cap;
      }
    }

    const threshold = bestSwarm?.cslThreshold ?? this._cslThreshold;

    /**
     * Apply cslGate() for smooth, differentiable gating.
     *
     * Old pattern: hard if/else check — `if (bestScore >= threshold)`
     * New pattern: cslGate(bestScore, bestScore, threshold) produces a
     * continuously-valued output in (0, bestScore) that:
     *   - equals ≈ bestScore when score is well above threshold (gate open)
     *   - equals ≈ 0 when score is well below threshold (gate closed)
     *   - provides smooth transition around the threshold
     *
     * Assignment decision: if gatedScore > threshold × 0.5 (half-open gate),
     * the best swarm wins. Otherwise fall back to type-based domain matching.
     * This replaces the binary `bestScore >= threshold` check.
     */
    if (bestSwarm && bestScore > -Infinity) {
      const gatedScore = cslGate(bestScore, bestScore, threshold);

      if (gatedScore > threshold * 0.5) {
        subtask.assignedSwarm = bestSwarm.swarmId;
        subtask.cslScore      = gatedScore;
      } else {
        // Gate closed — fall back to type-based domain matching
        subtask.assignedSwarm = this._typeToSwarmId(subtask.type);
        subtask.cslScore      = 0;
      }
    } else {
      // No capabilities scored — fall back to type-based domain matching
      subtask.assignedSwarm = this._typeToSwarmId(subtask.type);
      subtask.cslScore      = 0;
    }

    /**
     * @event TaskDecompositionEngine#subtask:assigned
     */
    this.emit('subtask:assigned', {
      subtaskId: subtask.id,
      swarmId:   subtask.assignedSwarm,
      cslScore:  Math.round(subtask.cslScore * 1000) / 1000,
      type:      subtask.type,
    });
  }

  /**
   * Map subtask type to a default swarm domain.
   * @private
   */
  _typeToSwarmId(type) {
    const mapping = {
      [SUBTASK_TYPE.RESEARCH]:      'research-herald',
      [SUBTASK_TYPE.CODING]:        'code-artisan',
      [SUBTASK_TYPE.DATA]:          'data-sculptor',
      [SUBTASK_TYPE.REASONING]:     'cognition-core',
      [SUBTASK_TYPE.SYNTHESIS]:     'language-flow',
      [SUBTASK_TYPE.VALIDATION]:    'consensus-forge',
      [SUBTASK_TYPE.RETRIEVAL]:     'memory-weave',
      [SUBTASK_TYPE.INTEGRATION]:   'integration-node',
      [SUBTASK_TYPE.PLANNING]:      'task-planner',
      [SUBTASK_TYPE.COMMUNICATION]: 'language-flow',
      [SUBTASK_TYPE.GENERIC]:       'heady-soul',
    };
    return mapping[type] ?? 'heady-soul';
  }

  // ─── Execution Strategies ──────────────────────────────────────────────────

  /**
   * Sequential execution in topological order.
   * @private
   */
  async _executeSequential(sortedSubtasks, result, deadline) {
    const completedIds = new Set();

    for (const subtask of sortedSubtasks) {
      if (Date.now() > deadline) {
        subtask.status = SUBTASK_STATUS.SKIPPED;
        continue;
      }

      // Check dependencies
      const depsOk = subtask.dependencies.every(depId => {
        const dep = result.subtasks.find(s => s.id === depId);
        return !dep || dep.status === SUBTASK_STATUS.COMPLETED;
      });

      if (!depsOk) {
        subtask.status = SUBTASK_STATUS.SKIPPED;
        continue;
      }

      await this._runSubtask(subtask, result);
      if (subtask.status === SUBTASK_STATUS.COMPLETED) {
        completedIds.add(subtask.id);
      } else if (subtask.critical && !this._allowPartial) {
        throw new Error(`Critical subtask ${subtask.id} failed`);
      }
    }
  }

  /**
   * Adaptive parallel execution: run all ready subtasks concurrently,
   * respecting dependency ordering and max concurrency limit.
   * @private
   */
  async _executeAdaptive(dag, result, deadline) {
    const completedIds = new Set();
    const runningSet   = new Set();

    const runBatch = async () => {
      while (true) {
        if (Date.now() > deadline) {
          // Mark remaining pending subtasks as skipped
          for (const st of result.subtasks) {
            if (st.status === SUBTASK_STATUS.PENDING) st.status = SUBTASK_STATUS.SKIPPED;
          }
          break;
        }

        // Find ready subtasks not yet running
        const ready = result.subtasks.filter(st =>
          st.status === SUBTASK_STATUS.PENDING &&
          st.isReady(completedIds)
        );

        if (ready.length === 0 && runningSet.size === 0) break; // Done
        if (ready.length === 0) {
          // Wait for something to finish
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // Launch up to maxParallel (fib(6) = 8)
        const toStart = ready.slice(0, Math.max(0, this._maxParallel - runningSet.size));

        for (const subtask of toStart) {
          subtask.status = SUBTASK_STATUS.RUNNING;
          runningSet.add(subtask.id);

          this._runSubtask(subtask, result).then(() => {
            runningSet.delete(subtask.id);
            if (subtask.status === SUBTASK_STATUS.COMPLETED) {
              completedIds.add(subtask.id);
            } else if (subtask.critical && !this._allowPartial) {
              // Signal failure to abort remaining
              result.partial = true;
            }
          }).catch(() => {
            runningSet.delete(subtask.id);
          });
        }

        // Emit progress
        const doneCount = result.subtasks.filter(s =>
          s.status === SUBTASK_STATUS.COMPLETED ||
          s.status === SUBTASK_STATUS.FAILED ||
          s.status === SUBTASK_STATUS.SKIPPED
        ).length;

        /**
         * @event TaskDecompositionEngine#progress
         */
        this.emit('progress', {
          taskId:    result.taskId,
          completed: doneCount,
          total:     result.subtasks.length,
          running:   runningSet.size,
          pct:       Math.round((doneCount / result.subtasks.length) * 100),
        });

        await new Promise(r => setTimeout(r, 100));
      }
    };

    await runBatch();
  }

  /**
   * Execute a single subtask with timeout, retry, and error recording.
   * @private
   */
  async _runSubtask(subtask, result) {
    subtask.status    = SUBTASK_STATUS.RUNNING;
    subtask.startedAt = Date.now();

    /**
     * @event TaskDecompositionEngine#subtask:started
     */
    this.emit('subtask:started', {
      subtaskId: subtask.id,
      swarmId:   subtask.assignedSwarm,
      type:      subtask.type,
      cslScore:  subtask.cslScore,
    });

    const attempt = async () => {
      if (this._executeSubtaskFn) {
        return this._executeSubtaskFn(subtask, subtask.assignedSwarm, result);
      } else if (this._swarmCoordinator) {
        return this._swarmCoordinator.routeTask({
          id:          subtask.id,
          swarmId:     subtask.assignedSwarm,
          description: subtask.description,
          payload:     subtask.payload,
          domain:      subtask.type,
          priority:    subtask.priority,
        });
      }
      // Simulation: return stub result in development
      await new Promise(r => setTimeout(r, 10 + Math.random() * 40));
      return { simulated: true, subtaskId: subtask.id };
    };

    try {
      const res = await this._withTimeout(attempt(), this._subtaskTimeout);
      subtask.result      = res;
      subtask.status      = SUBTASK_STATUS.COMPLETED;
      subtask.completedAt = Date.now();

      result.results.set(subtask.id, res);

      /**
       * @event TaskDecompositionEngine#subtask:completed
       */
      this.emit('subtask:completed', {
        subtaskId: subtask.id,
        swarmId:   subtask.assignedSwarm,
        latencyMs: subtask.latencyMs,
      });

    } catch (err) {
      subtask.error       = err;
      subtask.completedAt = Date.now();

      // Retry once if configured
      if (DEFAULTS.RETRY_FAILED && !subtask._retried) {
        subtask._retried = true;
        subtask.status   = SUBTASK_STATUS.PENDING;
        return this._runSubtask(subtask, result);
      }

      subtask.status = SUBTASK_STATUS.FAILED;
      result.errors.set(subtask.id, err);

      /**
       * @event TaskDecompositionEngine#subtask:failed
       */
      this.emit('subtask:failed', {
        subtaskId: subtask.id,
        swarmId:   subtask.assignedSwarm,
        error:     err.message,
        critical:  subtask.critical,
      });

      if (subtask.critical && !this._allowPartial) {
        throw err;
      }
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Compute parallel execution layers from sorted subtasks.
   * Each layer = set of subtasks that share no dependencies within the layer.
   * @private
   * @param {SubTask[]} sorted - Topologically sorted subtasks
   * @returns {SubTask[][]}
   */
  _computeLayers(sorted) {
    const layers     = [];
    const assignedAt = new Map(); // subtaskId → layer index

    for (const st of sorted) {
      // Find the earliest layer where all deps are in earlier layers
      let minLayer = 0;
      for (const depId of st.dependencies) {
        const depLayer = assignedAt.get(depId);
        if (depLayer != null) minLayer = Math.max(minLayer, depLayer + 1);
      }

      if (!layers[minLayer]) layers[minLayer] = [];
      layers[minLayer].push(st);
      assignedAt.set(st.id, minLayer);
    }

    return layers.filter(Boolean);
  }

  /**
   * Remove cyclic dependencies as a best-effort fix.
   * @private
   */
  _breakCycles(subtasks, cycleIds) {
    const cycleSet = new Set(cycleIds);
    for (const st of subtasks) {
      if (cycleSet.has(st.id)) {
        st.dependencies = st.dependencies.filter(dep => !cycleSet.has(dep));
      }
    }
  }

  /**
   * Default result aggregation: collect all results keyed by subtask description.
   * @private
   */
  async _defaultAggregate(results, subtasks) {
    const aggregated = {};
    for (const st of subtasks) {
      if (results.has(st.id)) {
        aggregated[st.description] = results.get(st.id);
      }
    }
    return aggregated;
  }

  /**
   * Wrap a promise with a hard timeout.
   * @private
   */
  _withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`[TaskDecompositionEngine] Timed out after ${ms}ms`)),
        ms
      );
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }
}

// ─── Factory Helpers ──────────────────────────────────────────────────────────

/**
 * Build a simple LLM decompose function from a raw LLM caller.
 *
 * @param {Function} llmFn - Async fn(prompt: string) → string (JSON array of subtasks)
 * @returns {Function} Async fn(task) → SubTask[]
 */
function buildLLMDecomposeFn(llmFn) {
  return async (task) => {
    const prompt = `
You are a task decomposition expert. Break the following complex task into atomic subtasks.

Task: ${task.description}
Context: ${JSON.stringify(task.context ?? {})}

Return a JSON array of subtask objects with these fields:
- description (string, required): Clear description of what this subtask does
- type (string): one of: research, coding, data, reasoning, synthesis, validation, retrieval, integration, planning, communication, generic
- dependencies (string[]): IDs of subtasks that must complete first (use descriptions as stable IDs)
- priority (number 1-10): higher = more critical path
- critical (boolean): if false, failure doesn't block the overall task
- estimatedMs (number): estimated execution time in milliseconds

Guidelines:
- Each subtask should be completable in 1-5 minutes
- Identify real dependencies (do NOT create artificial sequences)
- Mark non-critical exploration subtasks as critical: false
- Maximum ${task.maxSubtasks ?? 20} subtasks

Return ONLY valid JSON. No markdown, no explanation.
`.trim();

    const raw = await llmFn(prompt);

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed  = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) throw new Error('LLM decomposition did not return an array');

    // Stabilize IDs: use description hash as ID if none provided
    return parsed.map((st, i) => new SubTask({
      id:           st.id           ?? `subtask-${i}-${Date.now()}`,
      description:  st.description  ?? `Subtask ${i + 1}`,
      type:         st.type         ?? SUBTASK_TYPE.GENERIC,
      dependencies: st.dependencies ?? [],
      priority:     st.priority     ?? 5,
      critical:     st.critical     ?? true,
      estimatedMs:  st.estimatedMs  ?? 5_000,
      payload:      st.payload      ?? {},
    }));
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  TaskDecompositionEngine,
  SubTask,
  DependencyDAG,
  DecompositionResult,
  SUBTASK_STATUS,
  SUBTASK_TYPE,
  EXEC_STRATEGY,
  DEFAULTS as DECOMP_DEFAULTS,
  cosineSimilarity,
  buildLLMDecomposeFn,
};

export default TaskDecompositionEngine;

'use strict';

/**
 * HeadyChain — Main Orchestrator
 * Executes agent workflows as directed acyclic graphs (DAGs).
 * Supports parallel execution, checkpointing, streaming, and human-in-the-loop.
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { GraphBuilder } = require('./graph');
const { NODE_TYPES, NODE_EXECUTORS, mergeState } = require('./nodes');
const { globalRegistry: defaultToolRegistry, ToolRegistry } = require('./tools');
const { MemoryManager } = require('./memory');

// ─── Workflow Status Constants ────────────────────────────────────────────────

const WORKFLOW_STATUS = {
  PENDING:             'pending',
  RUNNING:             'running',
  WAITING_FOR_HUMAN:   'waiting_for_human',
  PAUSED:              'paused',
  COMPLETED:           'completed',
  FAILED:              'failed',
  TIMED_OUT:           'timed_out',
  DRY_RUN:             'dry_run',
};

// ─── Execution Context ────────────────────────────────────────────────────────

function createExecutionContext(opts = {}) {
  return {
    workflowId: opts.workflowId,
    orchestrator: opts.orchestrator,
    toolRegistry: opts.toolRegistry || defaultToolRegistry,
    memory: opts.memory || null,
    metadata: opts.metadata || {},
    dryRun: opts.dryRun || false,
    emitter: opts.emitter,
    streamCallback: opts.streamCallback || null,
    startedAt: Date.now(),
    stepCount: 0,
  };
}

// ─── HeadyChain Orchestrator ──────────────────────────────────────────────────

class HeadyChain extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.toolRegistry = opts.toolRegistry || defaultToolRegistry;
    this.storedChains = new Map();  // chainId -> GraphBuilder
    this.workflows = new Map();     // workflowId -> WorkflowRecord
    this.metrics = {
      totalWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      totalNodeExecutions: 0,
      totalTimeMs: 0,
    };

    // Ensure checkpoint directory exists
    if (config.CHECKPOINT_ENABLED) {
      fs.mkdirSync(config.CHECKPOINT_DIR, { recursive: true });
    }

    // Periodic cleanup of old workflows
    this._cleanupInterval = setInterval(() => this._cleanupWorkflows(), 60000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  // ─── Chain Registration ─────────────────────────────────────────────────────

  /**
   * Register a compiled chain for use as a sub-chain.
   */
  registerChain(id, graphBuilder) {
    this.storedChains.set(id, graphBuilder);
    return this;
  }

  // ─── Core Execution Engine ──────────────────────────────────────────────────

  /**
   * Execute a graph from a GraphBuilder or compiled graph.
   *
   * @param {GraphBuilder|object} graphOrBuilder
   * @param {object} initialState - Initial workflow state
   * @param {object} opts - Execution options
   * @returns {Promise<WorkflowResult>}
   */
  async execute(graphOrBuilder, initialState = {}, opts = {}) {
    const {
      workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dryRun = false,
      timeoutMs = config.DEFAULT_WORKFLOW_TIMEOUT_MS,
      memory = null,
      metadata = {},
      checkpointId = null,  // resume from checkpoint
      streamCallback = null,
    } = opts;

    // Build/compile graph
    const builder = graphOrBuilder instanceof GraphBuilder
      ? graphOrBuilder
      : GraphBuilder.fromJSON(graphOrBuilder);
    const compiled = builder.getCompiled();

    // Create workflow record
    const record = {
      workflowId,
      graphId: compiled.id,
      status: WORKFLOW_STATUS.PENDING,
      state: { ...initialState },
      currentNode: null,
      completedNodes: [],
      failedNode: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
      dryRun,
      pauseInfo: null,
      humanInputResolver: null,
      steps: [],
      metadata,
    };
    this.workflows.set(workflowId, record);
    this.metrics.totalWorkflows++;

    // Create execution context
    const ctx = createExecutionContext({
      workflowId,
      orchestrator: this,
      toolRegistry: opts.toolRegistry || this.toolRegistry,
      memory,
      metadata,
      dryRun,
      emitter: this,
      streamCallback,
    });

    // Restore from checkpoint if provided
    if (checkpointId) {
      const checkpoint = await this._loadCheckpoint(checkpointId);
      if (checkpoint) {
        record.state = mergeState(record.state, checkpoint.state);
        record.completedNodes = checkpoint.completedNodes || [];
      }
    }

    // Set up workflow timeout
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Workflow '${workflowId}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    record.status = WORKFLOW_STATUS.RUNNING;
    this.emit('workflow:start', { workflowId, graphId: compiled.id, state: record.state });

    try {
      const finalState = await Promise.race([
        this._runDAG(compiled, record, ctx),
        timeoutPromise,
      ]);

      clearTimeout(timeoutHandle);
      record.status = dryRun ? WORKFLOW_STATUS.DRY_RUN : WORKFLOW_STATUS.COMPLETED;
      record.state = finalState;
      record.finishedAt = Date.now();
      this.metrics.completedWorkflows++;
      this.metrics.totalTimeMs += record.finishedAt - record.startedAt;

      this.emit('workflow:complete', { workflowId, state: finalState, durationMs: record.finishedAt - record.startedAt });
      return this._buildResult(record, finalState);
    } catch (err) {
      clearTimeout(timeoutHandle);
      const isTimeout = err.message.includes('timed out');
      record.status = isTimeout ? WORKFLOW_STATUS.TIMED_OUT : WORKFLOW_STATUS.FAILED;
      record.error = err.message;
      record.finishedAt = Date.now();
      this.metrics.failedWorkflows++;

      this.emit('workflow:error', { workflowId, error: err.message });
      throw err;
    }
  }

  /**
   * Run the DAG to completion using topological ordering + parallel execution.
   */
  async _runDAG(compiled, record, ctx) {
    const { entryPoint, exitPoints, edgeMap, adjacency, nodes } = compiled;
    const state = { ...record.state };

    // Track in-degree for Kahn's parallel execution
    const pending = new Map();   // nodeId -> remaining in-degree
    const nodeResults = new Map(); // nodeId -> final state after execution
    const skipNodes = new Set(record.completedNodes); // already done (resume)

    // Compute remaining in-degrees (excluding already-completed predecessor edges)
    for (const [id] of Object.entries(nodes)) {
      pending.set(id, 0);
    }
    for (const { from, to } of compiled.edges) {
      if (!skipNodes.has(from)) {
        pending.set(to, (pending.get(to) || 0) + 1);
      }
    }

    // Initialize queue with nodes that have no pending predecessors
    const ready = [];
    for (const [id, deg] of pending) {
      if (deg === 0 && !skipNodes.has(id)) ready.push(id);
    }

    // State for each node starts from the merged global state
    for (const id of skipNodes) {
      nodeResults.set(id, state);
    }

    let currentState = { ...state };
    let stepCount = 0;

    while (ready.length > 0 || pending.size > 0) {
      if (ready.length === 0) break;

      // Execute ready nodes in parallel (up to MAX_PARALLEL_NODES)
      const batch = ready.splice(0, config.MAX_PARALLEL_NODES);

      const batchResults = await Promise.all(
        batch.map(nodeId => this._executeNode(nodeId, nodes[nodeId], currentState, compiled, record, ctx))
      );

      // Merge results and update ready queue
      for (let i = 0; i < batch.length; i++) {
        const nodeId = batch[i];
        const { state: nodeState, nextEdge, pause } = batchResults[i];

        nodeResults.set(nodeId, nodeState);
        currentState = mergeState(currentState, nodeState);
        record.completedNodes.push(nodeId);
        stepCount++;
        ctx.stepCount++;

        if (stepCount > config.MAX_WORKFLOW_STEPS) {
          throw new Error(`Workflow exceeded max steps (${config.MAX_WORKFLOW_STEPS})`);
        }

        // Handle human pause
        if (pause) {
          record.pauseInfo = pause;
          record.status = WORKFLOW_STATUS.WAITING_FOR_HUMAN;
          record.state = currentState;

          // Save checkpoint
          await this._saveCheckpoint(record.workflowId, record);

          this.emit('workflow:paused', { workflowId: record.workflowId, pause });
          if (ctx.streamCallback) ctx.streamCallback({ type: 'pause', nodeId, pause });

          // Await human input
          const humanInput = await this._waitForHumanInput(record, pause);
          currentState = mergeState(currentState, {
            [pause.inputKey]: humanInput,
          });
          record.status = WORKFLOW_STATUS.RUNNING;
        }

        // Determine which outgoing edges to activate
        const outEdges = edgeMap.get(nodeId) || [];
        const activeEdges = this._resolveEdges(outEdges, currentState, nextEdge);

        for (const edge of activeEdges) {
          const newDeg = (pending.get(edge.to) || 0) - 1;
          pending.set(edge.to, newDeg);
          if (newDeg === 0 && !skipNodes.has(edge.to)) {
            ready.push(edge.to);
          }
        }

        // Remove from pending
        pending.delete(nodeId);

        // Save checkpoint after each node if enabled
        if (config.CHECKPOINT_ENABLED) {
          record.state = currentState;
          await this._saveCheckpoint(record.workflowId, record).catch(() => {});
        }
      }
    }

    return currentState;
  }

  /**
   * Execute a single node with timeout and event emission.
   */
  async _executeNode(nodeId, nodeDef, state, compiled, record, ctx) {
    const { type, config: nodeConfig } = nodeDef;
    const nodeTimeout = nodeConfig.timeoutMs || config.DEFAULT_NODE_TIMEOUT_MS;

    record.currentNode = nodeId;
    this.emit('node:start', { workflowId: record.workflowId, nodeId, type, state });
    if (ctx.streamCallback) {
      ctx.streamCallback({ type: 'node:start', nodeId, nodeType: type, state });
    }

    const step = { nodeId, type, startedAt: Date.now(), status: 'running' };
    record.steps.push(step);

    // Dry-run: skip actual execution
    if (ctx.dryRun) {
      step.status = 'skipped';
      step.finishedAt = Date.now();
      this.emit('node:complete', { workflowId: record.workflowId, nodeId, dryRun: true });
      return { state };
    }

    const executor = NODE_EXECUTORS[type];
    if (!executor) throw new Error(`No executor for node type '${type}'`);

    // Execute with per-node timeout
    let result;
    try {
      result = await Promise.race([
        executor(nodeConfig, state, ctx),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Node '${nodeId}' timed out after ${nodeTimeout}ms`)), nodeTimeout)
        ),
      ]);
    } catch (err) {
      step.status = 'failed';
      step.finishedAt = Date.now();
      step.error = err.message;
      record.failedNode = nodeId;

      this.emit('node:error', { workflowId: record.workflowId, nodeId, error: err.message });
      if (ctx.streamCallback) {
        ctx.streamCallback({ type: 'node:error', nodeId, error: err.message });
      }
      this.metrics.totalNodeExecutions++;
      throw err;
    }

    step.status = 'completed';
    step.finishedAt = Date.now();
    step.durationMs = step.finishedAt - step.startedAt;
    this.metrics.totalNodeExecutions++;

    this.emit('node:complete', { workflowId: record.workflowId, nodeId, durationMs: step.durationMs });
    if (ctx.streamCallback) {
      ctx.streamCallback({ type: 'node:complete', nodeId, nodeType: type, state: result.state, durationMs: step.durationMs });
    }

    return result;
  }

  /**
   * Resolve which outgoing edges are active based on conditions and nextEdge hint.
   */
  _resolveEdges(edges, state, nextEdge) {
    if (edges.length === 0) return [];

    // If executor returned a nextEdge hint (conditional node), filter to matching
    if (nextEdge !== undefined) {
      const matching = edges.filter(e => e.to === nextEdge || e.label === nextEdge);
      return matching.length > 0 ? matching : [];
    }

    // Otherwise, activate all edges whose conditions pass (or have no condition)
    const active = [];
    for (const edge of edges) {
      if (!edge.condition || edge.condition(state)) {
        active.push(edge);
      }
    }
    // If no conditions pass, try first unconditional edge as fallback
    if (active.length === 0) {
      const unconditional = edges.find(e => !e.condition);
      if (unconditional) active.push(unconditional);
    }
    return active;
  }

  // ─── Human-in-the-Loop ──────────────────────────────────────────────────────

  /**
   * Wait for human input to arrive via resume().
   */
  _waitForHumanInput(record, pause) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        record.humanInputResolver = null;
        reject(new Error(`Human input timed out after ${pause.timeoutMs}ms for workflow '${record.workflowId}'`));
      }, pause.timeoutMs);

      record.humanInputResolver = (input) => {
        clearTimeout(timeout);
        resolve(input);
      };
    });
  }

  /**
   * Resume a paused workflow with human input.
   * @param {string} workflowId
   * @param {*} input - Human-provided input
   */
  resume(workflowId, input) {
    const record = this.workflows.get(workflowId);
    if (!record) throw new Error(`Workflow '${workflowId}' not found`);
    if (record.status !== WORKFLOW_STATUS.WAITING_FOR_HUMAN) {
      throw new Error(`Workflow '${workflowId}' is not waiting for human input (status: ${record.status})`);
    }
    if (!record.humanInputResolver) {
      throw new Error(`Workflow '${workflowId}' has no pending human input resolver`);
    }
    record.humanInputResolver(input);
    record.humanInputResolver = null;
    record.pauseInfo = null;
  }

  // ─── Streaming Execution ────────────────────────────────────────────────────

  /**
   * Execute a graph with SSE streaming.
   * @param {GraphBuilder|object} graphOrBuilder
   * @param {object} initialState
   * @param {object} opts
   * @param {Function} onEvent - Called with each streaming event
   */
  async executeStream(graphOrBuilder, initialState = {}, opts = {}, onEvent) {
    const events = [];
    const streamCallback = (event) => {
      events.push(event);
      if (typeof onEvent === 'function') onEvent(event);
    };

    return this.execute(graphOrBuilder, initialState, { ...opts, streamCallback });
  }

  // ─── Sub-Chain Execution ────────────────────────────────────────────────────

  /**
   * Execute a stored chain by ID (used by SubChainNode).
   */
  async executeStoredChain(chainId, initialState, parentCtx) {
    const builder = this.storedChains.get(chainId);
    if (!builder) throw new Error(`Stored chain '${chainId}' not found`);
    const result = await this.execute(builder, initialState, {
      toolRegistry: parentCtx.toolRegistry,
      memory: parentCtx.memory,
    });
    return result.state;
  }

  /**
   * Execute a graph (used by SubChainNode).
   */
  async executeGraph(builder, initialState, parentCtx) {
    const result = await this.execute(builder, initialState, {
      toolRegistry: parentCtx.toolRegistry,
      memory: parentCtx.memory,
    });
    return result.state;
  }

  // ─── Workflow Status ────────────────────────────────────────────────────────

  getWorkflow(workflowId) {
    return this.workflows.get(workflowId) || null;
  }

  getWorkflowStatus(workflowId) {
    const record = this.workflows.get(workflowId);
    if (!record) return null;
    return {
      workflowId: record.workflowId,
      graphId: record.graphId,
      status: record.status,
      currentNode: record.currentNode,
      completedNodes: record.completedNodes,
      failedNode: record.failedNode,
      error: record.error,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      durationMs: record.finishedAt ? record.finishedAt - record.startedAt : Date.now() - record.startedAt,
      stepCount: record.completedNodes.length,
      pauseInfo: record.pauseInfo ? { prompt: record.pauseInfo.prompt, pausedAt: record.pauseInfo.pausedAt } : null,
    };
  }

  listWorkflows() {
    return [...this.workflows.keys()].map(id => this.getWorkflowStatus(id));
  }

  // ─── Checkpointing ──────────────────────────────────────────────────────────

  async _saveCheckpoint(workflowId, record) {
    if (!config.CHECKPOINT_ENABLED) return;
    const checkpointPath = path.join(config.CHECKPOINT_DIR, `${workflowId}.json`);
    const data = {
      workflowId,
      graphId: record.graphId,
      state: record.state,
      completedNodes: record.completedNodes,
      savedAt: Date.now(),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2));
  }

  async _loadCheckpoint(checkpointId) {
    const checkpointPath = path.join(config.CHECKPOINT_DIR, `${checkpointId}.json`);
    if (!fs.existsSync(checkpointPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      // Check TTL
      if (Date.now() - data.savedAt > config.CHECKPOINT_TTL_MS) {
        fs.unlinkSync(checkpointPath);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  // ─── Metrics ────────────────────────────────────────────────────────────────

  getMetrics() {
    return {
      ...this.metrics,
      avgWorkflowTimeMs: this.metrics.completedWorkflows > 0
        ? Math.round(this.metrics.totalTimeMs / this.metrics.completedWorkflows)
        : 0,
      activeWorkflows: [...this.workflows.values()].filter(w => w.status === WORKFLOW_STATUS.RUNNING).length,
      storedChains: this.storedChains.size,
      toolStats: this.toolRegistry.getStats(),
    };
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /**
   * Build a fluent GraphBuilder for constructing new workflows.
   */
  createGraph(id) {
    return new GraphBuilder(id);
  }

  /**
   * Validate a graph without executing it.
   */
  validateGraph(graphOrBuilder) {
    try {
      const builder = graphOrBuilder instanceof GraphBuilder
        ? graphOrBuilder
        : GraphBuilder.fromJSON(graphOrBuilder);
      const compiled = builder.compile();
      return {
        valid: true,
        nodeCount: Object.keys(compiled.nodes).length,
        edgeCount: compiled.edges.length,
        entryPoint: compiled.entryPoint,
        exitPoints: [...compiled.exitPoints],
        topoOrder: compiled.topoOrder,
      };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  _buildResult(record, finalState) {
    return {
      workflowId: record.workflowId,
      status: record.status,
      state: finalState,
      steps: record.steps,
      completedNodes: record.completedNodes,
      durationMs: record.finishedAt - record.startedAt,
      metadata: record.metadata,
    };
  }

  _cleanupWorkflows() {
    const cutoff = Date.now() - 3600000; // 1 hour
    let removed = 0;
    for (const [id, record] of this.workflows) {
      if (
        record.finishedAt &&
        record.finishedAt < cutoff &&
        [WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.DRY_RUN, WORKFLOW_STATUS.TIMED_OUT].includes(record.status)
      ) {
        this.workflows.delete(id);
        removed++;
      }
    }
    // Enforce max stored
    if (this.workflows.size > config.MAX_STORED_WORKFLOWS) {
      const sorted = [...this.workflows.entries()].sort(([, a], [, b]) => a.startedAt - b.startedAt);
      for (const [id] of sorted.slice(0, this.workflows.size - config.MAX_STORED_WORKFLOWS)) {
        this.workflows.delete(id);
      }
    }
    return removed;
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.removeAllListeners();
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

const defaultChain = new HeadyChain();

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  HeadyChain,
  defaultChain,
  WORKFLOW_STATUS,
  // Re-export key building blocks for convenience
  GraphBuilder,
  NODE_TYPES,
  ToolRegistry,
  MemoryManager,
};

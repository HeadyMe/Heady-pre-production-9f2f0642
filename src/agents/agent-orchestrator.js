/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const logger = require('../../utils/logger');
const HeadyConductor = require('../../orchestration/heady-conductor');
const CircuitBreaker = require('../../resilience/circuit-breaker');
const HeadyKV = require('../../core/heady-kv');

// ─── Agent definitions ────────────────────────────────────────────────────────

const KNOWN_AGENTS = [
  'JULES',    // Code generation & review
  'BUILDER',  // Build pipeline orchestration
  'OBSERVER', // System observation & logging
  'MURPHY',   // Chaos/fault injection testing
  'ATLAS',    // Knowledge mapping & retrieval
  'PYTHIA',   // Prediction & forecasting
  'BRIDGE',   // External API bridge
  'MUSE',     // Creative content generation
  'SENTINEL', // Security & anomaly detection
  'NOVA',     // New feature prototyping
  'JANITOR',  // Cleanup & maintenance
  'SOPHIA',   // Learning & adaptation
  'CIPHER',   // Encryption & secrets management
  'LENS',     // Observability & tracing
];

const AGENT_STATES = {
  IDLE: 'IDLE',
  BUSY: 'BUSY',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
  STARTING: 'STARTING',
  DRAINING: 'DRAINING',
};

// ─── AgentOrchestrator ────────────────────────────────────────────────────────

class AgentOrchestrator {
  /**
   * @param {object} opts
   * @param {number}  [opts.maxConcurrentTasks=8]
   * @param {number}  [opts.taskTimeoutMs=30000]
   * @param {object}  [opts.kv]          - HeadyKV instance (injected or created)
   * @param {object}  [opts.conductor]   - HeadyConductor instance (injected or created)
   */
  constructor(opts = {}) {
    this.maxConcurrentTasks = opts.maxConcurrentTasks ?? 8;
    this.taskTimeoutMs = opts.taskTimeoutMs ?? 30_000;

    this._kv = opts.kv || new HeadyKV({ namespace: 'agent-orchestrator' });
    this._conductor = opts.conductor || new HeadyConductor();

    /** @type {Map<string, AgentNode>} */
    this._agents = new Map();

    /** @type {Map<string, CircuitBreaker>} */
    this._breakers = new Map();

    /** @type {Map<string, Promise>} */
    this._activeTasks = new Map();

    this._taskCounter = 0;
    this._initialized = false;

    logger.info('[AgentOrchestrator] instance created', {
      maxConcurrentTasks: this.maxConcurrentTasks,
      taskTimeoutMs: this.taskTimeoutMs,
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async init() {
    if (this._initialized) return this;

    // Restore persisted agent configs from KV
    const persisted = await this._kv.get('agent-configs');
    if (persisted) {
      for (const [name, cfg] of Object.entries(persisted)) {
        if (!this._agents.has(name)) {
          this._registerInternal(name, cfg, false);
        }
      }
    }

    this._initialized = true;
    logger.info('[AgentOrchestrator] initialized', { agentCount: this._agents.size });
    return this;
  }

  async shutdown() {
    logger.info('[AgentOrchestrator] shutting down…');

    // Drain all agents
    for (const [name, node] of this._agents) {
      node.state = AGENT_STATES.DRAINING;
      logger.debug('[AgentOrchestrator] draining', { agent: name });
    }

    // Wait for active tasks to finish (max 10 s)
    if (this._activeTasks.size > 0) {
      const drain = Promise.allSettled([...this._activeTasks.values()]);
      await Promise.race([drain, _sleep(10_000)]);
    }

    this._agents.clear();
    this._breakers.clear();
    this._activeTasks.clear();
    logger.info('[AgentOrchestrator] shutdown complete');
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  /**
   * Register an agent node.
   * @param {string} name   - One of KNOWN_AGENTS or a custom name
   * @param {object} config - Agent configuration
   * @returns {AgentNode}
   */
  registerAgent(name, config = {}) {
    return this._registerInternal(name, config, true);
  }

  _registerInternal(name, config, persist) {
    const node = {
      name,
      config: { ...config },
      state: AGENT_STATES.IDLE,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalLatencyMs: 0,
        lastActivityAt: null,
        registeredAt: Date.now(),
      },
      handler: config.handler || null,
    };

    this._agents.set(name, node);

    // Each agent gets its own circuit breaker
    this._breakers.set(name, new CircuitBreaker({
      name: `agent:${name}`,
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeMs: config.recoveryTimeMs ?? 30_000,
    }));

    if (persist) {
      // Persist config (strip non-serialisable fields)
      const serialisable = { ...config };
      delete serialisable.handler;
      this._kv.get('agent-configs').then(existing => {
        const next = existing || {};
        next[name] = serialisable;
        return this._kv.set('agent-configs', next);
      }).catch(err => logger.warn('[AgentOrchestrator] KV persist failed', { err: err.message }));
    }

    logger.info('[AgentOrchestrator] agent registered', { name, config: { ...config, handler: !!config.handler } });
    return node;
  }

  /**
   * Remove an agent by name.
   * @param {string} name
   */
  async removeAgent(name) {
    if (!this._agents.has(name)) {
      logger.warn('[AgentOrchestrator] removeAgent: unknown agent', { name });
      return false;
    }

    const node = this._agents.get(name);
    node.state = AGENT_STATES.DRAINING;

    // Wait for any active task on this agent
    const activeKey = [...this._activeTasks.keys()].find(k => k.startsWith(`${name}:`));
    if (activeKey) {
      await Promise.race([this._activeTasks.get(activeKey), _sleep(5_000)]);
    }

    this._agents.delete(name);
    this._breakers.delete(name);

    // Remove from persisted configs
    const existing = await this._kv.get('agent-configs');
    if (existing) {
      delete existing[name];
      await this._kv.set('agent-configs', existing);
    }

    logger.info('[AgentOrchestrator] agent removed', { name });
    return true;
  }

  // ─── Dispatch ───────────────────────────────────────────────────────────────

  /**
   * Dispatch a task to a named agent.
   * @param {object} task
   * @param {string} agentName
   * @returns {Promise<any>}
   */
  async dispatch(task, agentName) {
    if (!this._agents.has(agentName)) {
      throw new Error(`[AgentOrchestrator] Unknown agent: ${agentName}`);
    }

    const node = this._agents.get(agentName);

    if (node.state === AGENT_STATES.OFFLINE || node.state === AGENT_STATES.DRAINING) {
      throw new Error(`[AgentOrchestrator] Agent ${agentName} is ${node.state}`);
    }

    if (this._activeTasks.size >= this.maxConcurrentTasks) {
      throw new Error(`[AgentOrchestrator] Max concurrent tasks (${this.maxConcurrentTasks}) reached`);
    }

    const taskId = `${agentName}:${++this._taskCounter}`;
    const start = Date.now();

    logger.debug('[AgentOrchestrator] dispatching task', { taskId, agentName, task });

    node.state = AGENT_STATES.BUSY;
    node.metrics.lastActivityAt = new Date().toISOString();

    const breaker = this._breakers.get(agentName);

    const taskPromise = breaker.fire(() => this._executeTask(node, task, taskId))
      .then(result => {
        node.metrics.tasksCompleted++;
        node.metrics.totalLatencyMs += (Date.now() - start);
        node.state = AGENT_STATES.IDLE;
        this._activeTasks.delete(taskId);
        logger.debug('[AgentOrchestrator] task completed', { taskId, agentName, latencyMs: Date.now() - start });
        return result;
      })
      .catch(err => {
        node.metrics.tasksFailed++;
        node.state = AGENT_STATES.ERROR;
        this._activeTasks.delete(taskId);
        logger.error('[AgentOrchestrator] task failed', { taskId, agentName, err: err.message });
        throw err;
      });

    this._activeTasks.set(taskId, taskPromise);
    return taskPromise;
  }

  async _executeTask(node, task, taskId) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task ${taskId} timed out after ${this.taskTimeoutMs}ms`)), this.taskTimeoutMs)
    );

    const work = node.handler
      ? node.handler(task, node)
      : this._conductor.route({ ...task, agentName: node.name });

    return Promise.race([work, timeout]);
  }

  // ─── Status & Metrics ───────────────────────────────────────────────────────

  /**
   * Get status and metrics for a single agent.
   * @param {string} name
   * @returns {object}
   */
  getAgentStatus(name) {
    if (!this._agents.has(name)) {
      return { found: false, name };
    }

    const node = this._agents.get(name);
    const breaker = this._breakers.get(name);
    const { tasksCompleted, tasksFailed, totalLatencyMs, lastActivityAt, registeredAt } = node.metrics;
    const avgLatencyMs = tasksCompleted > 0 ? Math.round(totalLatencyMs / tasksCompleted) : 0;

    return {
      found: true,
      name,
      state: node.state,
      config: { ...node.config, handler: !!node.handler },
      metrics: {
        tasksCompleted,
        tasksFailed,
        avgLatencyMs,
        lastActivityAt,
        registeredAt: new Date(registeredAt).toISOString(),
        successRate: tasksCompleted + tasksFailed > 0
          ? ((tasksCompleted / (tasksCompleted + tasksFailed)) * 100).toFixed(1) + '%'
          : 'N/A',
      },
      circuitBreaker: breaker ? breaker.getState() : null,
    };
  }

  /**
   * Get status for all registered agents.
   * @returns {object[]}
   */
  getAllAgentStatuses() {
    return [...this._agents.keys()].map(name => this.getAgentStatus(name));
  }

  /**
   * List all registered agent names.
   * @returns {string[]}
   */
  listAgents() {
    return [...this._agents.keys()];
  }

  /**
   * Summary health object.
   */
  getHealth() {
    const statuses = this.getAllAgentStatuses();
    const total = statuses.length;
    const idle = statuses.filter(s => s.state === AGENT_STATES.IDLE).length;
    const busy = statuses.filter(s => s.state === AGENT_STATES.BUSY).length;
    const errored = statuses.filter(s => s.state === AGENT_STATES.ERROR).length;

    return {
      healthy: errored === 0,
      total,
      idle,
      busy,
      errored,
      activeTasks: this._activeTasks.size,
      agents: statuses,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { AgentOrchestrator, KNOWN_AGENTS, AGENT_STATES };

'use strict';

/**
 * AgentOrchestrator — Coordinates multi-agent task execution.
 * Manages agent pools, distributes work, handles failures, and aggregates results.
 */

const EventEmitter = require('events');
const crypto = require('crypto');

const AGENT_STATUS = {
  IDLE: 'idle',
  BUSY: 'busy',
  FAILED: 'failed',
  TERMINATED: 'terminated',
};

const TASK_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const MAX_RETRIES = 3;

class AgentOrchestrator extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._agents = new Map();           // agentId → AgentRecord
    this._tasks = new Map();            // taskId → TaskRecord
    this._taskQueue = [];               // pending task IDs (ordered by priority)
    this._vectorMemory = opts.vectorMemory || null;
    this._llmRouter = opts.llmRouter || null;
    this._maxConcurrent = opts.maxConcurrent || 5;
    this._stats = { tasksSubmitted: 0, tasksCompleted: 0, tasksFailed: 0, agentsSpawned: 0 };
    this._running = false;
    this._dispatchTimer = null;
  }

  // ─── Agent management ──────────────────────────────────────────────────────

  /**
   * Register an agent.
   * @param {object} cfg
   * @param {string} cfg.id
   * @param {string} cfg.type — 'llm' | 'tool' | 'custom'
   * @param {Function} cfg.execute — async (task) => result
   * @param {string[]} [cfg.capabilities] — task types this agent handles
   */
  registerAgent(cfg) {
    if (!cfg.id) cfg.id = 'agent_' + crypto.randomBytes(6).toString('hex');
    const agent = {
      id: cfg.id,
      type: cfg.type || 'llm',
      name: cfg.name || cfg.id,
      execute: cfg.execute || null,
      capabilities: cfg.capabilities || [],
      status: AGENT_STATUS.IDLE,
      registeredAt: new Date().toISOString(),
      tasksCompleted: 0,
      tasksFailed: 0,
      lastUsed: null,
      currentTaskId: null,
    };
    this._agents.set(cfg.id, agent);
    this._stats.agentsSpawned++;
    this.emit('agent-registered', { agentId: cfg.id, name: agent.name });
    return cfg.id;
  }

  unregisterAgent(agentId) {
    const agent = this._agents.get(agentId);
    if (agent?.currentTaskId) {
      // Reassign task
      this._requeueTask(agent.currentTaskId);
    }
    this._agents.delete(agentId);
    this.emit('agent-unregistered', { agentId });
  }

  getAgent(agentId) {
    return this._agents.get(agentId) || null;
  }

  listAgents() {
    return Array.from(this._agents.values()).map(a => ({
      id: a.id,
      type: a.type,
      name: a.name,
      status: a.status,
      capabilities: a.capabilities,
      tasksCompleted: a.tasksCompleted,
      tasksFailed: a.tasksFailed,
      lastUsed: a.lastUsed,
    }));
  }

  // ─── LLM agent factory ─────────────────────────────────────────────────────

  /**
   * Create and register a new LLM-backed agent.
   */
  spawnLLMAgent(opts = {}) {
    const agentId = this.registerAgent({
      type: 'llm',
      name: opts.name || `LLM Agent ${this._agents.size + 1}`,
      capabilities: opts.capabilities || ['code_generation', 'research', 'documentation', 'quick_tasks'],
      execute: async (task) => {
        const router = this._llmRouter || require('./services/llm-router').getLLMRouter();
        const result = await router.generate(task.payload.prompt || '', {
          taskType: task.type,
          systemPrompt: task.payload.systemPrompt || opts.systemPrompt,
          maxTokens: task.payload.maxTokens || opts.maxTokens || 2048,
          temperature: task.payload.temperature || opts.temperature,
        });

        // Store result in vector memory if available
        if (this._vectorMemory && task.payload.prompt) {
          const text = `Agent task: ${task.payload.prompt.slice(0, 200)}\nResult: ${result.text.slice(0, 300)}`;
          this._vectorMemory.store(task.id, null, text, { type: 'agent_result', taskType: task.type, agentId }).catch(() => {});
        }

        return { text: result.text, provider: result.provider, model: result.model, tokens: result.tokens };
      },
    });
    return agentId;
  }

  // ─── Task submission ───────────────────────────────────────────────────────

  /**
   * Submit a task for execution.
   * @param {object} task
   * @param {string} task.type — task type (routes to appropriate agents)
   * @param {object} task.payload — task payload (e.g., { prompt, ... })
   * @param {number} [task.priority] — higher = executed first (default 0)
   * @param {string} [task.agentId] — target a specific agent
   * @param {number} [task.timeout] — ms
   * @returns {string} taskId
   */
  submit(task) {
    const taskId = task.id || 'otask_' + crypto.randomBytes(8).toString('hex');
    const record = {
      id: taskId,
      type: task.type || 'default',
      payload: task.payload || {},
      priority: task.priority || 0,
      preferredAgentId: task.agentId || null,
      timeout: task.timeout || 60000,
      status: TASK_STATUS.PENDING,
      retries: 0,
      result: null,
      error: null,
      submittedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      assignedTo: null,
      _resolve: null,
      _reject: null,
    };

    const promise = new Promise((resolve, reject) => {
      record._resolve = resolve;
      record._reject = reject;
    });
    record.promise = promise;

    this._tasks.set(taskId, record);
    this._taskQueue.push(taskId);
    this._taskQueue.sort((a, b) => {
      const ta = this._tasks.get(a);
      const tb = this._tasks.get(b);
      return (tb?.priority || 0) - (ta?.priority || 0);
    });

    this._stats.tasksSubmitted++;
    this.emit('task-submitted', { taskId, type: record.type });

    // Trigger dispatch
    setImmediate(() => this._dispatch());

    return taskId;
  }

  /**
   * Submit and await a task result.
   */
  async run(task) {
    const taskId = this.submit(task);
    const record = this._tasks.get(taskId);
    return record.promise;
  }

  // ─── Dispatch ──────────────────────────────────────────────────────────────

  _dispatch() {
    if (this._taskQueue.length === 0) return;

    const busyCount = Array.from(this._agents.values()).filter(a => a.status === AGENT_STATUS.BUSY).length;
    if (busyCount >= this._maxConcurrent) return;

    const taskId = this._taskQueue.shift();
    const task = this._tasks.get(taskId);
    if (!task || task.status !== TASK_STATUS.PENDING) return this._dispatch();

    // Find a suitable agent
    const agent = this._findAgent(task);
    if (!agent) {
      // No agent available — put back in queue
      this._taskQueue.unshift(taskId);
      return;
    }

    this._executeTask(agent, task);
    this._dispatch(); // Check for more tasks
  }

  _findAgent(task) {
    // Try preferred agent first
    if (task.preferredAgentId) {
      const preferred = this._agents.get(task.preferredAgentId);
      if (preferred && preferred.status === AGENT_STATUS.IDLE) return preferred;
    }

    // Find idle agent with matching capability
    const capable = Array.from(this._agents.values()).filter(a =>
      a.status === AGENT_STATUS.IDLE &&
      (a.capabilities.length === 0 || a.capabilities.includes(task.type))
    );

    if (capable.length === 0) return null;

    // Round-robin by lastUsed
    return capable.sort((a, b) => (a.lastUsed || '') < (b.lastUsed || '') ? -1 : 1)[0];
  }

  async _executeTask(agent, task) {
    agent.status = AGENT_STATUS.BUSY;
    agent.currentTaskId = task.id;
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    task.assignedTo = agent.id;

    this.emit('task-started', { taskId: task.id, agentId: agent.id });

    let timeoutHandle;
    const timeoutPromise = new Promise((_, rej) => {
      timeoutHandle = setTimeout(() => rej(new Error(`Task timeout after ${task.timeout}ms`)), task.timeout);
    });

    try {
      const result = await Promise.race([
        agent.execute(task),
        timeoutPromise,
      ]);
      clearTimeout(timeoutHandle);

      task.result = result;
      task.status = TASK_STATUS.COMPLETE;
      task.completedAt = new Date().toISOString();
      agent.tasksCompleted++;
      this._stats.tasksCompleted++;

      this.emit('task-complete', { taskId: task.id, agentId: agent.id });
      task._resolve?.(result);
    } catch (err) {
      clearTimeout(timeoutHandle);
      task.retries++;
      if (task.retries < MAX_RETRIES) {
        task.status = TASK_STATUS.PENDING;
        this._taskQueue.unshift(task.id);
        this.emit('task-retry', { taskId: task.id, attempt: task.retries });
      } else {
        task.status = TASK_STATUS.FAILED;
        task.error = err.message;
        task.completedAt = new Date().toISOString();
        agent.tasksFailed++;
        this._stats.tasksFailed++;
        this.emit('task-failed', { taskId: task.id, error: err.message });
        task._reject?.(err);
      }
    } finally {
      agent.status = AGENT_STATUS.IDLE;
      agent.currentTaskId = null;
      agent.lastUsed = new Date().toISOString();
      setImmediate(() => this._dispatch());
    }
  }

  _requeueTask(taskId) {
    const task = this._tasks.get(taskId);
    if (task && task.status === TASK_STATUS.RUNNING) {
      task.status = TASK_STATUS.PENDING;
      task.assignedTo = null;
      this._taskQueue.unshift(taskId);
    }
  }

  // ─── Task management ───────────────────────────────────────────────────────

  getTask(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) return null;
    return { id: task.id, type: task.type, status: task.status, result: task.result, error: task.error, submittedAt: task.submittedAt, completedAt: task.completedAt, assignedTo: task.assignedTo, retries: task.retries };
  }

  listTasks(opts = {}) {
    let tasks = Array.from(this._tasks.values());
    if (opts.status) tasks = tasks.filter(t => t.status === opts.status);
    if (opts.type) tasks = tasks.filter(t => t.type === opts.type);
    return tasks.slice(-100).reverse().map(t => this.getTask(t.id));
  }

  cancelTask(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) return false;
    if ([TASK_STATUS.COMPLETE, TASK_STATUS.FAILED].includes(task.status)) return false;
    task.status = TASK_STATUS.CANCELLED;
    task._reject?.(new Error('Task cancelled'));
    this.emit('task-cancelled', { taskId });
    return true;
  }

  getStats() {
    const agentStats = { total: this._agents.size, idle: 0, busy: 0 };
    for (const a of this._agents.values()) {
      if (a.status === AGENT_STATUS.IDLE) agentStats.idle++;
      if (a.status === AGENT_STATUS.BUSY) agentStats.busy++;
    }
    return { ...this._stats, agents: agentStats, queueDepth: this._taskQueue.length };
  }

  setVectorMemory(vm) {
    this._vectorMemory = vm;
  }

  // ─── Express routes ────────────────────────────────────────────────────────

  registerRoutes(app) {
    /** POST /api/orchestrator/tasks — submit a task */
    app.post('/api/orchestrator/tasks', async (req, res) => {
      try {
        const { type, payload, priority, agentId, timeout, wait } = req.body || {};
        if (!payload) return res.status(400).json({ ok: false, error: 'payload required' });

        const task = { type, payload, priority, agentId, timeout };

        if (wait) {
          const result = await this.run(task);
          return res.json({ ok: true, result });
        }

        const taskId = this.submit(task);
        res.status(201).json({ ok: true, taskId });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    /** GET /api/orchestrator/tasks */
    app.get('/api/orchestrator/tasks', (req, res) => {
      const { status, type } = req.query;
      res.json({ ok: true, tasks: this.listTasks({ status, type }), stats: this.getStats() });
    });

    /** GET /api/orchestrator/tasks/:id */
    app.get('/api/orchestrator/tasks/:id', (req, res) => {
      const task = this.getTask(req.params.id);
      if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
      res.json({ ok: true, task });
    });

    /** DELETE /api/orchestrator/tasks/:id */
    app.delete('/api/orchestrator/tasks/:id', (req, res) => {
      const cancelled = this.cancelTask(req.params.id);
      res.json({ ok: cancelled, taskId: req.params.id });
    });

    /** GET /api/orchestrator/agents */
    app.get('/api/orchestrator/agents', (req, res) => {
      res.json({ ok: true, agents: this.listAgents(), stats: this.getStats() });
    });

    /** POST /api/orchestrator/agents */
    app.post('/api/orchestrator/agents', (req, res) => {
      try {
        const { name, capabilities, systemPrompt, maxTokens } = req.body || {};
        const agentId = this.spawnLLMAgent({ name, capabilities, systemPrompt, maxTokens });
        res.status(201).json({ ok: true, agentId });
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
      }
    });

    /** DELETE /api/orchestrator/agents/:id */
    app.delete('/api/orchestrator/agents/:id', (req, res) => {
      this.unregisterAgent(req.params.id);
      res.json({ ok: true, agentId: req.params.id });
    });

    /** GET /api/orchestrator/stats */
    app.get('/api/orchestrator/stats', (req, res) => {
      res.json({ ok: true, stats: this.getStats() });
    });

    return app;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;

function getOrchestrator(opts) {
  if (!_instance) {
    _instance = new AgentOrchestrator(opts);
    // Register a default LLM agent
    _instance.spawnLLMAgent({ name: 'Default LLM Agent', capabilities: [] });
  }
  return _instance;
}

module.exports = { AgentOrchestrator, getOrchestrator, AGENT_STATUS, TASK_STATUS };

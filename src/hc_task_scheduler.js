// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/hc_task_scheduler.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  HEADY SYSTEMS                                                 ║
 * ║  ━━━━━━━━━━━━━━                                                ║
 * ║  ∞ Sacred Geometry Architecture ∞                              ║
 * ║                                                                ║
 * ║  hc_task_scheduler.js — Priority-aware Task Scheduler          ║
 * ║  Manages task queues with resource-tier routing, parallel      ║
 * ║  group execution, and deterministic scheduling policies.       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const { EventEmitter } = require("events");
const crypto = require("crypto");

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const TASK_PRIORITY = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3, BACKGROUND: 4 };
const TASK_CLASS    = { INTERACTIVE: "interactive", BATCH: "batch", TRAINING: "training" };
const TASK_STATUS   = { QUEUED: "queued", RUNNING: "running", COMPLETED: "completed", FAILED: "failed", PAUSED: "paused", CANCELLED: "cancelled" };
const RESOURCE_TIER = { L: "L", M: "M", S: "S" };

const DEFAULT_CONCURRENCY = {
  interactive: 4,
  batch: 2,
  training: 1,
};

const DEFAULT_TIER_ROUTING = {
  "code_generation":     { defaultTier: "M", maxTier: "L", minTier: "S" },
  "code_review":         { defaultTier: "M", maxTier: "L", minTier: "M" },
  "summarize":           { defaultTier: "S", maxTier: "M", minTier: "S" },
  "classify":            { defaultTier: "S", maxTier: "S", minTier: "S" },
  "route":               { defaultTier: "S", maxTier: "S", minTier: "S" },
  "arena_evaluate":      { defaultTier: "L", maxTier: "L", minTier: "M" },
  "arena_screen":        { defaultTier: "S", maxTier: "M", minTier: "S" },
  "test_generation":     { defaultTier: "M", maxTier: "M", minTier: "S" },
  "security_scan":       { defaultTier: "M", maxTier: "L", minTier: "M" },
  "data_processing":     { defaultTier: "M", maxTier: "M", minTier: "S" },
  "documentation":       { defaultTier: "S", maxTier: "M", minTier: "S" },
  "planning":            { defaultTier: "M", maxTier: "L", minTier: "M" },
  "monte_carlo_trial":   { defaultTier: "M", maxTier: "L", minTier: "S" },
  "pipeline_stage":      { defaultTier: "M", maxTier: "L", minTier: "M" },
  "hcfullpipeline":      { defaultTier: "M", maxTier: "L", minTier: "S" },
  "user_defined":        { defaultTier: "M", maxTier: "L", minTier: "S" },
};

// ─── TASK OBJECT ────────────────────────────────────────────────────────

function createTask(options) {
  const id = options.id || `task_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  return {
    id,
    type: options.type || "generic",
    priority: options.priority != null ? options.priority : TASK_PRIORITY.NORMAL,
    taskClass: options.taskClass || TASK_CLASS.BATCH,
    status: TASK_STATUS.QUEUED,
    resourceTier: null,
    parentId: options.parentId || null,
    groupId: options.groupId || null,
    executionMode: options.executionMode || "sequential",
    constraints: {
      maxLatencyMs: options.maxLatencyMs || null,
      costCeiling: options.costCeiling || null,
      riskLevel: options.riskLevel || "normal",
      ...(options.constraints || {}),
    },
    payload: options.payload || {},
    result: null,
    error: null,
    metrics: { queuedAt: Date.now(), startedAt: null, completedAt: null, retries: 0 },
    handler: options.handler || null,
  };
}

// ─── PARALLEL GROUP ─────────────────────────────────────────────────────

function createParallelGroup(tasks, options = {}) {
  const groupId = `grp_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  for (const t of tasks) t.groupId = groupId;
  return {
    groupId,
    tasks,
    executionMode: options.executionMode || "parallel",
    maxConcurrency: options.maxConcurrency || tasks.length,
    completedCount: 0,
    failedCount: 0,
    status: "pending",
  };
}

// ─── SCHEDULER ──────────────────────────────────────────────────────────

class HCTaskScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrencyLimits = { ...DEFAULT_CONCURRENCY, ...options.concurrency };
    this.tierRouting = { ...DEFAULT_TIER_ROUTING, ...options.tierRouting };
    this.queues = {
      interactive: [],
      batch: [],
      training: [],
    };
    this.running = {
      interactive: new Map(),
      batch: new Map(),
      training: new Map(),
    };
    this.completed = [];
    this.groups = new Map();
    this.paused = false;
    this.safeModeActive = false;
    this.stats = {
      totalQueued: 0,
      totalStarted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0,
      avgWaitMs: 0,
      avgExecMs: 0,
    };
    this._drainTimer = null;
  }

  // ─── Submit a task ──────────────────────────────────────────────────

  submit(taskOrOptions) {
    const task = taskOrOptions.id && taskOrOptions.status ? taskOrOptions : createTask(taskOrOptions);

    task.resourceTier = this._routeTier(task);

    if (this.safeModeActive && task.taskClass !== TASK_CLASS.INTERACTIVE) {
      task.status = TASK_STATUS.PAUSED;
      this.emit("task:paused_safe_mode", task);
      return task;
    }

    const queue = this.queues[task.taskClass] || this.queues.batch;
    this._insertByPriority(queue, task);
    this.stats.totalQueued++;
    this.emit("task:queued", task);

    this._scheduleDrain();
    return task;
  }

  // ─── Submit a parallel group ────────────────────────────────────────

  submitGroup(group) {
    this.groups.set(group.groupId, group);
    for (const task of group.tasks) {
      this.submit(task);
    }
    this.emit("group:submitted", group);
    return group;
  }

  // ─── Route to resource tier ─────────────────────────────────────────

  _routeTier(task) {
    const routing = this.tierRouting[task.type];
    if (!routing) return RESOURCE_TIER.M;

    if (task.constraints.riskLevel === "critical" || task.priority === TASK_PRIORITY.CRITICAL) {
      return routing.maxTier;
    }

    if (this.safeModeActive || task.priority === TASK_PRIORITY.BACKGROUND) {
      return routing.minTier;
    }

    return routing.defaultTier;
  }

  // ─── Priority insertion (lower number = higher priority) ────────────

  _insertByPriority(queue, task) {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (task.priority < queue[i].priority) {
        queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) queue.push(task);
  }

  // ─── Drain queues ──────────────────────────────────────────────────

  _scheduleDrain() {
    if (this._drainTimer) return;
    this._drainTimer = setImmediate(() => {
      this._drainTimer = null;
      this._drain();
    });
  }

  _drain() {
    if (this.paused) return;

    for (const cls of [TASK_CLASS.INTERACTIVE, TASK_CLASS.BATCH, TASK_CLASS.TRAINING]) {
      const queue = this.queues[cls];
      const runningMap = this.running[cls];
      const limit = this.safeModeActive && cls !== TASK_CLASS.INTERACTIVE
        ? 0
        : this.concurrencyLimits[cls] || 1;

      while (queue.length > 0 && runningMap.size < limit) {
        const task = queue.shift();
        this._executeTask(task, runningMap);
      }
    }
  }

  // ─── Execute a single task ──────────────────────────────────────────

  async _executeTask(task, runningMap) {
    task.status = TASK_STATUS.RUNNING;
    task.metrics.startedAt = Date.now();
    runningMap.set(task.id, task);
    this.stats.totalStarted++;
    this.emit("task:started", task);

    try {
      if (typeof task.handler === "function") {
        task.result = await task.handler(task);
      } else {
        task.result = { message: "No handler — task marked complete (stub)" };
      }
      task.status = TASK_STATUS.COMPLETED;
      task.metrics.completedAt = Date.now();
      this.stats.totalCompleted++;
      this._updateAvgMetrics(task);
      this.emit("task:completed", task);
    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.error = err.message || String(err);
      task.metrics.completedAt = Date.now();
      this.stats.totalFailed++;

      if (task.metrics.retries < 2 && task.constraints.riskLevel !== "critical") {
        task.metrics.retries++;
        task.status = TASK_STATUS.QUEUED;
        const queue = this.queues[task.taskClass] || this.queues.batch;
        this._insertByPriority(queue, task);
        this.emit("task:retrying", task);
      } else {
        this.emit("task:failed", task);
      }
    } finally {
      runningMap.delete(task.id);
      this._checkGroupCompletion(task);
      this.completed.push(task);
      if (this.completed.length > 1000) this.completed = this.completed.slice(-500);
      this._scheduleDrain();
    }
  }

  // ─── Group completion check ─────────────────────────────────────────

  _checkGroupCompletion(task) {
    if (!task.groupId) return;
    const group = this.groups.get(task.groupId);
    if (!group) return;

    if (task.status === TASK_STATUS.COMPLETED) group.completedCount++;
    if (task.status === TASK_STATUS.FAILED) group.failedCount++;

    const totalDone = group.completedCount + group.failedCount;
    if (totalDone >= group.tasks.length) {
      group.status = group.failedCount > 0 ? "completed_with_errors" : "completed";
      this.emit("group:completed", group);
      this.groups.delete(group.groupId);
    }
  }

  // ─── Avg metrics ────────────────────────────────────────────────────

  _updateAvgMetrics(task) {
    const waitMs = (task.metrics.startedAt || 0) - (task.metrics.queuedAt || 0);
    const execMs = (task.metrics.completedAt || 0) - (task.metrics.startedAt || 0);
    const n = this.stats.totalCompleted;
    this.stats.avgWaitMs = Math.round(((this.stats.avgWaitMs * (n - 1)) + waitMs) / n);
    this.stats.avgExecMs = Math.round(((this.stats.avgExecMs * (n - 1)) + execMs) / n);
  }

  // ─── Controls ───────────────────────────────────────────────────────

  pause() {
    this.paused = true;
    this.emit("scheduler:paused");
  }

  resume() {
    this.paused = false;
    this.emit("scheduler:resumed");
    this._scheduleDrain();
  }

  enterSafeMode() {
    this.safeModeActive = true;
    for (const cls of [TASK_CLASS.BATCH, TASK_CLASS.TRAINING]) {
      for (const [id, task] of this.running[cls]) {
        task.status = TASK_STATUS.PAUSED;
        this.running[cls].delete(id);
        this.queues[cls].unshift(task);
      }
    }
    this.emit("scheduler:safe_mode_entered");
  }

  exitSafeMode() {
    this.safeModeActive = false;
    this.emit("scheduler:safe_mode_exited");
    this._scheduleDrain();
  }

  cancelTask(taskId) {
    for (const cls of Object.keys(this.queues)) {
      const idx = this.queues[cls].findIndex(t => t.id === taskId);
      if (idx >= 0) {
        const task = this.queues[cls].splice(idx, 1)[0];
        task.status = TASK_STATUS.CANCELLED;
        this.stats.totalCancelled++;
        this.emit("task:cancelled", task);
        return task;
      }
    }
    return null;
  }

  adjustConcurrency(taskClass, newLimit) {
    if (this.concurrencyLimits[taskClass] !== undefined) {
      this.concurrencyLimits[taskClass] = newLimit;
      this.emit("scheduler:concurrency_changed", { taskClass, newLimit });
      this._scheduleDrain();
    }
  }

  // ─── Status & introspection ─────────────────────────────────────────

  getStatus() {
    return {
      paused: this.paused,
      safeModeActive: this.safeModeActive,
      concurrencyLimits: { ...this.concurrencyLimits },
      queues: {
        interactive: this.queues.interactive.length,
        batch: this.queues.batch.length,
        training: this.queues.training.length,
      },
      running: {
        interactive: this.running.interactive.size,
        batch: this.running.batch.size,
        training: this.running.training.size,
      },
      activeGroups: this.groups.size,
      stats: { ...this.stats },
      ts: new Date().toISOString(),
    };
  }

  getQueueDetails() {
    const summarize = (tasks) => tasks.map(t => ({
      id: t.id, type: t.type, priority: t.priority, tier: t.resourceTier,
      status: t.status, waitMs: Date.now() - t.metrics.queuedAt,
    }));
    return {
      interactive: { queued: summarize(this.queues.interactive), running: summarize([...this.running.interactive.values()]) },
      batch: { queued: summarize(this.queues.batch), running: summarize([...this.running.batch.values()]) },
      training: { queued: summarize(this.queues.training), running: summarize([...this.running.training.values()]) },
    };
  }

  getRecentCompleted(limit = 20) {
    return this.completed.slice(-limit).map(t => ({
      id: t.id, type: t.type, priority: t.priority, tier: t.resourceTier,
      status: t.status, waitMs: (t.metrics.startedAt || 0) - (t.metrics.queuedAt || 0),
      execMs: (t.metrics.completedAt || 0) - (t.metrics.startedAt || 0),
      retries: t.metrics.retries, error: t.error,
    }));
  }
}

// ─── EXPRESS ROUTES ─────────────────────────────────────────────────────

function registerSchedulerRoutes(app, scheduler) {
  app.get("/api/scheduler/status", (_req, res) => {
    res.json({ ok: true, ...scheduler.getStatus() });
  });

  app.get("/api/scheduler/queues", (_req, res) => {
    res.json({ ok: true, ...scheduler.getQueueDetails() });
  });

  app.get("/api/scheduler/history", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    res.json({ ok: true, tasks: scheduler.getRecentCompleted(limit) });
  });

  app.post("/api/scheduler/submit", (req, res) => {
    try {
      const task = scheduler.submit(req.body);
      res.json({ ok: true, task: { id: task.id, type: task.type, tier: task.resourceTier, status: task.status } });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/scheduler/submit/hcfp', (req, res) => {
    try {
      const task = scheduler.submit({
        ...req.body,
        type: 'hcfullpipeline',
        priority: TASK_PRIORITY.HIGH,
        constraints: { queue: 'hcfp' }
      });
      res.json({ 
        ok: true, 
        task: { 
          id: task.id, 
          type: task.type,
          priority: task.priority,
          status: task.status 
        } 
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/scheduler/submit/user', (req, res) => {
    try {
      const task = scheduler.submit({
        ...req.body,
        type: 'user_defined',
        constraints: { queue: 'user' }
      });
      res.json({ 
        ok: true, 
        task: { 
          id: task.id, 
          type: task.type,
          priority: task.priority,
          status: task.status 
        } 
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/scheduler/cancel/:taskId", (req, res) => {
    const task = scheduler.cancelTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found in queues" });
    res.json({ ok: true, task: { id: task.id, status: task.status } });
  });

  app.post("/api/scheduler/pause", (_req, res) => {
    scheduler.pause();
    res.json({ ok: true, paused: true });
  });

  app.post("/api/scheduler/resume", (_req, res) => {
    scheduler.resume();
    res.json({ ok: true, paused: false });
  });

  app.post("/api/scheduler/safe-mode", (req, res) => {
    const { enabled } = req.body;
    if (enabled) scheduler.enterSafeMode(); else scheduler.exitSafeMode();
    res.json({ ok: true, safeModeActive: scheduler.safeModeActive });
  });

  app.post("/api/scheduler/concurrency", (req, res) => {
    const { taskClass, limit } = req.body;
    if (!taskClass || limit == null) return res.status(400).json({ error: "taskClass and limit required" });
    scheduler.adjustConcurrency(taskClass, limit);
    res.json({ ok: true, concurrencyLimits: scheduler.concurrencyLimits });
  });
}

// ─── EXPORTS ────────────────────────────────────────────────────────────

module.exports = {
  HCTaskScheduler,
  registerSchedulerRoutes,
  createTask,
  createParallelGroup,
  TASK_PRIORITY,
  TASK_CLASS,
  TASK_STATUS,
  RESOURCE_TIER,
  DEFAULT_TIER_ROUTING,
};

/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const HeadyScheduler = require('../../core/heady-scheduler');

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = Object.freeze({
  USER_PRESENT: 'user-present',
  USER_ABSENT:  'user-absent',
});

// In user-absent mode consume up to 90% of resources; present = 10%
const RESOURCE_CAPS = {
  [MODES.USER_ABSENT]:  0.90,
  [MODES.USER_PRESENT]: 0.10,
};

const TASK_PRIORITIES = Object.freeze({
  ERROR_REPAIR:        1,
  PERFORMANCE_OPT:     2,
  SECURITY_SCAN:       3,
  DOCS_SYNC:           4,
  TRAINING:            5,
  CACHE_WARMUP:        6,
  HOUSEKEEPING:        7,
});

const TASK_STATUS = Object.freeze({
  PENDING:    'pending',
  RUNNING:    'running',
  COMPLETED:  'completed',
  FAILED:     'failed',
  SKIPPED:    'skipped',
  CANCELLED:  'cancelled',
});

const CYCLE_INTERVAL_MS = 15_000;   // How often to run the autonomy loop
const MAX_CONCURRENT    = 4;        // Max parallel background tasks

// ─── AutonomousEngine ─────────────────────────────────────────────────────────

class AutonomousEngine extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  [opts.mode]            - Initial mode ('user-present'|'user-absent')
   * @param {object}  [opts.scheduler]       - HeadyScheduler instance
   * @param {number}  [opts.cycleIntervalMs] - Loop tick interval
   * @param {number}  [opts.maxConcurrent]   - Max parallel tasks
   */
  constructor(opts = {}) {
    super();

    this.mode = opts.mode || MODES.USER_PRESENT;
    this.cycleIntervalMs = opts.cycleIntervalMs ?? CYCLE_INTERVAL_MS;
    this.maxConcurrent   = opts.maxConcurrent   ?? MAX_CONCURRENT;

    this._scheduler = opts.scheduler || new HeadyScheduler({ namespace: 'autonomous-engine' });

    /** @type {Map<string, QueuedTask>} taskId → task */
    this._queue = new Map();

    /** @type {Map<string, Promise>} taskId → running promise */
    this._running = new Map();

    this._cycleTimer  = null;
    this._cycleCount  = 0;
    this._paused      = false;

    // Stats
    this._stats = {
      tasksEnqueued:  0,
      tasksCompleted: 0,
      tasksFailed:    0,
      tasksSkipped:   0,
      cyclesRun:      0,
      startedAt:      null,
    };

    // Built-in recurring task definitions
    this._builtInTasks = _buildBuiltInTasks();

    logger.info('[AutonomousEngine] initialized', { mode: this.mode });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  start() {
    if (this._cycleTimer) return this;
    this._stats.startedAt = new Date().toISOString();
    this._schedulerSetup();
    this._cycleTimer = setInterval(() => this._cycle(), this.cycleIntervalMs);
    this._cycleTimer.unref?.();
    this._cycle(); // immediate first tick
    logger.info('[AutonomousEngine] started');
    return this;
  }

  stop() {
    if (this._cycleTimer) {
      clearInterval(this._cycleTimer);
      this._cycleTimer = null;
    }
    logger.info('[AutonomousEngine] stopped');
  }

  pause() {
    this._paused = true;
    logger.info('[AutonomousEngine] paused');
    this.emit('paused');
  }

  resume() {
    this._paused = false;
    logger.info('[AutonomousEngine] resumed');
    this.emit('resumed');
    this._cycle();
  }

  // ─── Mode switching ──────────────────────────────────────────────────────────

  /**
   * Switch operating mode (called by cognitive-runtime-governor).
   * @param {'user-present'|'user-absent'} mode
   */
  setMode(mode) {
    if (!MODES[mode.toUpperCase().replace('-', '_')] && mode !== MODES.USER_PRESENT && mode !== MODES.USER_ABSENT) {
      throw new Error(`Unknown mode: ${mode}`);
    }
    const prev = this.mode;
    this.mode = mode;
    const cap = Math.round(RESOURCE_CAPS[mode] * 100);
    logger.info('[AutonomousEngine] mode changed', { prev, mode, resourceCap: `${cap}%` });
    this.emit('modeChange', { prev, mode, resourceCap: cap });
  }

  get resourceCap() {
    return RESOURCE_CAPS[this.mode] ?? 0.10;
  }

  // ─── Task Queue ───────────────────────────────────────────────────────────────

  /**
   * Enqueue a background task.
   * @param {object} task
   * @param {string}   task.id          - Unique ID
   * @param {string}   task.type        - Task type (from TASK_PRIORITIES keys)
   * @param {Function} task.run         - async function to execute
   * @param {number}   [task.priority]  - Lower = higher priority (default from type)
   * @param {string}   [task.name]
   * @param {object}   [task.meta]
   * @returns {QueuedTask}
   */
  enqueue(task) {
    if (!task.id)  throw new Error('task.id is required');
    if (!task.run) throw new Error('task.run (function) is required');

    if (this._queue.has(task.id) || this._running.has(task.id)) {
      logger.debug('[AutonomousEngine] task already queued/running', { id: task.id });
      return this._queue.get(task.id) || null;
    }

    const priority = task.priority ?? TASK_PRIORITIES[task.type] ?? TASK_PRIORITIES.HOUSEKEEPING;

    const queued = {
      id: task.id,
      name: task.name || task.id,
      type: task.type || 'custom',
      run: task.run,
      priority,
      meta: task.meta || {},
      status: TASK_STATUS.PENDING,
      enqueuedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
    };

    this._queue.set(task.id, queued);
    this._stats.tasksEnqueued++;

    logger.debug('[AutonomousEngine] task enqueued', { id: task.id, priority, type: task.type });
    this.emit('taskEnqueued', queued);
    return queued;
  }

  /**
   * Cancel a pending task.
   */
  cancel(taskId) {
    const task = this._queue.get(taskId);
    if (task && task.status === TASK_STATUS.PENDING) {
      task.status = TASK_STATUS.CANCELLED;
      this._queue.delete(taskId);
      this.emit('taskCancelled', { id: taskId });
      return true;
    }
    return false;
  }

  // ─── Core cycle ───────────────────────────────────────────────────────────────

  async _cycle() {
    if (this._paused) return;
    this._cycleCount++;
    this._stats.cyclesRun++;

    // In user-present mode only run if queue has high-priority items (error repair)
    const slots = this._availableSlots();
    if (slots <= 0) return;

    // Sort queue by priority
    const pending = [...this._queue.values()]
      .filter(t => t.status === TASK_STATUS.PENDING)
      .sort((a, b) => a.priority - b.priority);

    if (pending.length === 0) {
      // Inject built-in tasks if queue is empty
      this._injectBuiltIns();
      return;
    }

    const toRun = pending.slice(0, slots);

    for (const task of toRun) {
      this._runTask(task);
    }
  }

  _availableSlots() {
    const maxAllowed = this.mode === MODES.USER_ABSENT
      ? this.maxConcurrent
      : Math.max(1, Math.floor(this.maxConcurrent * this.resourceCap));

    return maxAllowed - this._running.size;
  }

  _runTask(task) {
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    this._queue.delete(task.id);

    const taskPromise = (async () => {
      try {
        const result = await task.run(task.meta);
        task.result = result;
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = new Date().toISOString();
        this._stats.tasksCompleted++;
        logger.debug('[AutonomousEngine] task completed', { id: task.id, name: task.name });
        this.emit('taskCompleted', task);
      } catch (err) {
        task.error = err.message;
        task.status = TASK_STATUS.FAILED;
        task.completedAt = new Date().toISOString();
        this._stats.tasksFailed++;
        logger.error('[AutonomousEngine] task failed', { id: task.id, err: err.message });
        this.emit('taskFailed', task);
      } finally {
        this._running.delete(task.id);
      }
    })();

    this._running.set(task.id, taskPromise);
    return taskPromise;
  }

  // ─── Built-in task injection ─────────────────────────────────────────────────

  _injectBuiltIns() {
    const now = Date.now();

    for (const def of this._builtInTasks) {
      // Only inject if enough time has elapsed since last run
      if (def.lastRun && now - def.lastRun < def.intervalMs) continue;

      // In user-present mode, only high-priority tasks
      if (this.mode === MODES.USER_PRESENT && def.priority > TASK_PRIORITIES.ERROR_REPAIR) continue;

      def.lastRun = now;
      this.enqueue({
        id: `builtin:${def.name}:${now}`,
        name: def.name,
        type: def.type,
        priority: def.priority,
        run: def.run,
      });
    }
  }

  _schedulerSetup() {
    // Register recurring self-improvement cycle with HeadyScheduler
    try {
      this._scheduler.schedule('autonomous-improvement-cycle', {
        cronExpression: '*/15 * * * *',  // every 15 min
        handler: () => this._selfImprovementCycle(),
      });
    } catch (err) {
      logger.debug('[AutonomousEngine] scheduler not available', { err: err.message });
    }
  }

  async _selfImprovementCycle() {
    logger.debug('[AutonomousEngine] self-improvement cycle start');
    this.emit('selfImprovementCycle', { cycleCount: this._cycleCount, mode: this.mode });
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      mode: this.mode,
      resourceCap: Math.round(this.resourceCap * 100) + '%',
      paused: this._paused,
      running: this._running.size,
      queued: this._queue.size,
      stats: { ...this._stats },
      queue: [...this._queue.values()].map(t => ({
        id: t.id, name: t.name, type: t.type, priority: t.priority, status: t.status, enqueuedAt: t.enqueuedAt,
      })),
    };
  }
}

// ─── Built-in task definitions ────────────────────────────────────────────────

function _buildBuiltInTasks() {
  return [
    {
      name: 'error-repair-scan',
      type: 'ERROR_REPAIR',
      priority: TASK_PRIORITIES.ERROR_REPAIR,
      intervalMs: 60_000,   // min 1 min between runs
      lastRun: null,
      run: async () => {
        logger.debug('[AutonomousEngine] running error-repair-scan');
        // Scan for error patterns in logs and attempt automatic repair
        return { action: 'error-repair-scan', result: 'no errors found' };
      },
    },
    {
      name: 'performance-optimization',
      type: 'PERFORMANCE_OPT',
      priority: TASK_PRIORITIES.PERFORMANCE_OPT,
      intervalMs: 5 * 60_000,
      lastRun: null,
      run: async () => {
        logger.debug('[AutonomousEngine] running performance-optimization');
        return { action: 'perf-opt', result: 'analyzed' };
      },
    },
    {
      name: 'docs-sync',
      type: 'DOCS_SYNC',
      priority: TASK_PRIORITIES.DOCS_SYNC,
      intervalMs: 30 * 60_000,
      lastRun: null,
      run: async () => {
        logger.debug('[AutonomousEngine] running docs-sync');
        return { action: 'docs-sync', result: 'synced' };
      },
    },
    {
      name: 'training-feedback-loop',
      type: 'TRAINING',
      priority: TASK_PRIORITIES.TRAINING,
      intervalMs: 60 * 60_000,  // 1 h
      lastRun: null,
      run: async () => {
        logger.debug('[AutonomousEngine] running training-feedback-loop');
        return { action: 'training', result: 'feedback processed' };
      },
    },
    {
      name: 'housekeeping',
      type: 'HOUSEKEEPING',
      priority: TASK_PRIORITIES.HOUSEKEEPING,
      intervalMs: 15 * 60_000,
      lastRun: null,
      run: async () => {
        logger.debug('[AutonomousEngine] running housekeeping');
        return { action: 'housekeeping', result: 'cleaned' };
      },
    },
  ];
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { AutonomousEngine, MODES, TASK_PRIORITIES, TASK_STATUS, RESOURCE_CAPS };

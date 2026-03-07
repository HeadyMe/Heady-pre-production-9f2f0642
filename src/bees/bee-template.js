/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

const LIFECYCLE = {
  CREATED:    'CREATED',
  READY:      'READY',
  RUNNING:    'RUNNING',
  PAUSED:     'PAUSED',
  TERMINATED: 'TERMINATED',
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_TASK_TIMEOUT_MS       = 120_000;
const MAX_QUEUE_SIZE                = 500;

// Task priority levels (lower number = higher priority)
const PRIORITY = {
  CRITICAL: 0,
  HIGH:     1,
  NORMAL:   2,
  LOW:      3,
  IDLE:     4,
};

// ─── TaskQueue ────────────────────────────────────────────────────────────────

class TaskQueue {
  constructor(maxSize = MAX_QUEUE_SIZE) {
    this._maxSize = maxSize;
    this._queue   = [];
  }

  enqueue(task) {
    if (this._queue.length >= this._maxSize) {
      throw new Error(`Task queue full (max ${this._maxSize})`);
    }
    const item = {
      id:         task.id || crypto.randomUUID(),
      priority:   typeof task.priority === 'number' ? task.priority : PRIORITY.NORMAL,
      task,
      enqueuedAt: Date.now(),
    };
    this._queue.push(item);
    // Sort by priority (ascending = highest priority first)
    this._queue.sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
    return item.id;
  }

  dequeue() {
    return this._queue.shift() || null;
  }

  peek() {
    return this._queue[0] || null;
  }

  get size() { return this._queue.length; }
  get isEmpty() { return this._queue.length === 0; }

  remove(taskId) {
    const idx = this._queue.findIndex(i => i.id === taskId);
    if (idx === -1) return false;
    this._queue.splice(idx, 1);
    return true;
  }

  clear() {
    const count = this._queue.length;
    this._queue = [];
    return count;
  }

  toArray() {
    return this._queue.map(i => ({ ...i }));
  }
}

// ─── BaseBee ──────────────────────────────────────────────────────────────────

class BaseBee extends EventEmitter {
  /**
   * @param {object} config
   * @param {string} config.domain           - Bee domain (e.g. 'coding', 'research')
   * @param {string} [config.id]             - Unique bee ID (auto-generated if omitted)
   * @param {string} [config.name]           - Human-readable name
   * @param {string} [config.type]           - 'persistent' | 'ephemeral'
   * @param {number} [config.heartbeatMs]    - Heartbeat interval in ms
   * @param {number} [config.taskTimeoutMs]  - Per-task timeout in ms
   * @param {object} [config.conductor]      - Reference to HeadyConductor for routing
   */
  constructor(config = {}) {
    super();

    this.id       = config.id     || `bee-${crypto.randomUUID().slice(0, 8)}`;
    this.domain   = config.domain || 'general';
    this.name     = config.name   || `${this.domain}-bee-${this.id}`;
    this.type     = config.type   || 'persistent';
    this.metadata = config.metadata || {};

    // Lifecycle state
    this._lifecycle = LIFECYCLE.CREATED;

    // Task queue
    this._taskQueue = new TaskQueue(config.maxQueueSize || MAX_QUEUE_SIZE);

    // Currently executing task
    this._currentTask = null;

    // Heartbeat
    this._heartbeatIntervalMs = config.heartbeatMs  || DEFAULT_HEARTBEAT_INTERVAL_MS;
    this._taskTimeoutMs       = config.taskTimeoutMs || DEFAULT_TASK_TIMEOUT_MS;
    this._heartbeatTimer      = null;
    this._lastHeartbeat       = null;

    // Conductor reference for routing
    this._conductor = config.conductor || null;

    // Statistics
    this._stats = {
      tasksCompleted: 0,
      tasksFailed:    0,
      tasksSkipped:   0,
      uptime:         0,
      startedAt:      null,
    };

    // Processing loop control
    this._processing = false;
    this._stopLoop   = false;

    logger.logSystem('BaseBee', `Created ${this.id}`, {
      domain: this.domain,
      type:   this.type,
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  get lifecycle() { return this._lifecycle; }

  _setState(newState) {
    const prev = this._lifecycle;
    this._lifecycle = newState;
    this.emit('lifecycle:changed', { beeId: this.id, from: prev, to: newState, ts: Date.now() });
    logger.logSystem('BaseBee', `${this.id}: ${prev} → ${newState}`, { domain: this.domain });
  }

  /**
   * Initialize bee (called before start).
   * Override onInit() for domain-specific setup.
   */
  async init() {
    if (this._lifecycle !== LIFECYCLE.CREATED) {
      throw new Error(`Cannot init from state ${this._lifecycle}`);
    }
    try {
      await this.onInit();
      this._setState(LIFECYCLE.READY);
      this.emit('bee:ready', { beeId: this.id });
    } catch (err) {
      logger.error('BaseBee', `${this.id} onInit failed`, { error: err.message });
      throw err;
    }
  }

  /**
   * Start the bee (begin processing task queue).
   */
  async start() {
    if (this._lifecycle !== LIFECYCLE.READY) {
      throw new Error(`Cannot start from state ${this._lifecycle}`);
    }
    this._setState(LIFECYCLE.RUNNING);
    this._stats.startedAt = Date.now();
    this._startHeartbeat();
    this._stopLoop = false;
    await this.onStart();
    this._processLoop();
    this.emit('bee:started', { beeId: this.id });
  }

  /**
   * Pause the bee (suspend task processing, keep queue).
   */
  async pause() {
    if (this._lifecycle !== LIFECYCLE.RUNNING) {
      throw new Error(`Cannot pause from state ${this._lifecycle}`);
    }
    this._setState(LIFECYCLE.PAUSED);
    this._stopLoop = true;
    this._stopHeartbeat();
    await this.onPause();
    this.emit('bee:paused', { beeId: this.id, queueSize: this._taskQueue.size });
  }

  /**
   * Resume from paused state.
   */
  async resume() {
    if (this._lifecycle !== LIFECYCLE.PAUSED) {
      throw new Error(`Cannot resume from state ${this._lifecycle}`);
    }
    this._setState(LIFECYCLE.RUNNING);
    this._stopLoop = false;
    this._startHeartbeat();
    await this.onResume();
    this._processLoop();
    this.emit('bee:resumed', { beeId: this.id });
  }

  /**
   * Terminate the bee (graceful shutdown).
   */
  async terminate(reason = 'normal') {
    if (this._lifecycle === LIFECYCLE.TERMINATED) return;

    this._stopLoop = true;
    this._stopHeartbeat();

    // Drain: wait for current task to finish (up to taskTimeout)
    if (this._currentTask) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, this._taskTimeoutMs);
        this.once('task:completed', () => { clearTimeout(timer); resolve(); });
        this.once('task:failed',    () => { clearTimeout(timer); resolve(); });
      });
    }

    this._taskQueue.clear();
    this._setState(LIFECYCLE.TERMINATED);

    await this.onTerminate(reason);
    this.emit('bee:terminated', { beeId: this.id, reason });

    logger.logSystem('BaseBee', `${this.id} terminated`, { reason, stats: this._stats });
  }

  // ── Lifecycle Hooks (override in subclasses) ───────────────────────────────

  async onInit()           {}
  async onStart()          {}
  async onPause()          {}
  async onResume()         {}
  async onTerminate()      {}

  /**
   * Execute a single task. Subclasses MUST override this.
   * @param {object} task
   * @returns {Promise<any>} result
   */
  async executeTask(task) {
    throw new Error(`${this.name}.executeTask not implemented`);
  }

  // ── Task Queue Interface ───────────────────────────────────────────────────

  enqueue(task) {
    if (this._lifecycle === LIFECYCLE.TERMINATED) {
      throw new Error(`Bee ${this.id} is terminated`);
    }
    const taskId = this._taskQueue.enqueue(task);
    this.emit('task:enqueued', { beeId: this.id, taskId, queueSize: this._taskQueue.size });

    // If paused or not yet running, don't process
    if (this._lifecycle === LIFECYCLE.RUNNING && !this._processing) {
      this._processLoop();
    }

    return taskId;
  }

  cancelTask(taskId) {
    const removed = this._taskQueue.remove(taskId);
    if (removed) {
      this._stats.tasksSkipped++;
      this.emit('task:cancelled', { beeId: this.id, taskId });
    }
    return removed;
  }

  // ── Processing Loop ────────────────────────────────────────────────────────

  async _processLoop() {
    if (this._processing) return; // prevent re-entrancy
    this._processing = true;

    while (!this._stopLoop && this._lifecycle === LIFECYCLE.RUNNING) {
      const item = this._taskQueue.dequeue();
      if (!item) {
        this._processing = false;
        break;
      }

      this._currentTask = item;
      this.emit('task:started', { beeId: this.id, taskId: item.id });

      const start = Date.now();
      try {
        // Execute with timeout
        const result = await this._withTimeout(
          () => this.executeTask(item.task),
          this._taskTimeoutMs,
          `Task ${item.id} timed out`
        );

        this._stats.tasksCompleted++;
        const latency = Date.now() - start;
        this.emit('task:completed', { beeId: this.id, taskId: item.id, result, latency });

        // Route result back through conductor if needed
        if (this._conductor && item.task.routeBack) {
          this._conductor.recordOutcome(item.task.sessionId, item.task.group, true);
        }
      } catch (err) {
        this._stats.tasksFailed++;
        logger.error('BaseBee', `${this.id} task ${item.id} failed`, { error: err.message });
        this.emit('task:failed', { beeId: this.id, taskId: item.id, error: err.message });

        if (this._conductor && item.task.routeBack) {
          this._conductor.recordOutcome(item.task.sessionId, item.task.group, false);
        }
      } finally {
        this._currentTask = null;
      }
    }

    this._processing = false;
  }

  async _withTimeout(fn, ms, message) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  _startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(() => this._heartbeat(), this._heartbeatIntervalMs);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _heartbeat() {
    this._lastHeartbeat = Date.now();
    if (this._stats.startedAt) {
      this._stats.uptime = this._lastHeartbeat - this._stats.startedAt;
    }
    this.emit('heartbeat', {
      beeId:         this.id,
      lifecycle:     this._lifecycle,
      queueSize:     this._taskQueue.size,
      currentTask:   this._currentTask?.id || null,
      stats:         { ...this._stats },
      ts:            this._lastHeartbeat,
    });
  }

  // ── Conductor Routing ──────────────────────────────────────────────────────

  async routeTask(task) {
    if (!this._conductor) {
      return this.enqueue(task);
    }
    try {
      const decision = await this._conductor.route(task);
      task._routingDecision = decision;
      return this.enqueue(task);
    } catch (err) {
      logger.warn('BaseBee', `${this.id} routing failed, enqueueing directly`, { error: err.message });
      return this.enqueue(task);
    }
  }

  // ── Introspection ──────────────────────────────────────────────────────────

  getStatus() {
    return {
      id:            this.id,
      name:          this.name,
      domain:        this.domain,
      type:          this.type,
      lifecycle:     this._lifecycle,
      queueSize:     this._taskQueue.size,
      currentTask:   this._currentTask?.id || null,
      lastHeartbeat: this._lastHeartbeat,
      stats:         { ...this._stats },
      metadata:      this.metadata,
    };
  }

  getQueue() {
    return this._taskQueue.toArray();
  }
}

module.exports = { BaseBee, TaskQueue, LIFECYCLE, PRIORITY, PHI };

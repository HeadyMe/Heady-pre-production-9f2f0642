'use strict';
/**
 * @module task-queue
 * @description Queue-based workload management for HeadySystems
 *
 * Features:
 *   - Priority queue with Fibonacci-scaled priorities: 1,1,2,3,5,8,13,21
 *   - Dead letter queue after fib(5)=5 retries with φ-backoff
 *   - Queue depth monitoring with CSL pressure thresholds
 *   - Rate-limited dequeue via Fibonacci token bucket
 *   - Retry policies with φ-exponential backoff (1s, 1.618s, 2.618s, 4.236s, 6.854s)
 *
 * φ = 1.618033988749895
 */

const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

/**
 * Fibonacci-based priority levels (1 = lowest, 21 = highest).
 * Matches fib(1)..fib(8)
 */
const PRIORITY = {
  DORMANT:  FIB[1],   // 1
  MINIMAL:  FIB[2],   // 1
  LOW:      FIB[3],   // 2
  NORMAL:   FIB[4],   // 3
  MEDIUM:   FIB[5],   // 5
  HIGH:     FIB[6],   // 8
  CRITICAL: FIB[7],   // 13
  URGENT:   FIB[8],   // 21
};

/** CSL pressure levels derived from queue depth ratios */
const PRESSURE = {
  NOMINAL:   { min: 0,     max: 0.382, label: 'NOMINAL' },
  ELEVATED:  { min: 0.382, max: 0.618, label: 'ELEVATED' },
  HIGH:      { min: 0.618, max: 0.854, label: 'HIGH' },
  CRITICAL:  { min: 0.854, max: 1.0,   label: 'CRITICAL' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {Object} Task */
/**
 * @class Task
 * Represents a unit of work in the priority queue.
 */
class Task {
  /**
   * @param {Object} opts
   * @param {string} opts.id            - Unique task ID (UUID)
   * @param {*}      opts.payload       - Task data
   * @param {number} [opts.priority]    - Fibonacci priority (default: NORMAL=3)
   * @param {string} [opts.queue]       - Queue name (default: 'normal')
   * @param {Object} [opts.metadata]    - Arbitrary metadata
   */
  constructor(opts) {
    this.id         = opts.id ?? crypto.randomUUID();
    this.payload    = opts.payload;
    this.priority   = opts.priority ?? PRIORITY.NORMAL;
    this.queue      = opts.queue    ?? 'normal';
    this.metadata   = opts.metadata ?? {};
    this.attempts   = 0;
    this.maxRetries = FIB[5];             // fib(5) = 5 max retries
    this.createdAt  = Date.now();
    this.scheduledAt = opts.scheduledAt ?? Date.now();
    this.lastAttemptAt = null;
    this.error      = null;
    this.status     = 'pending';          // pending | processing | done | dead
  }

  /** @returns {boolean} Whether the task is eligible for retry */
  canRetry() {
    return this.attempts < this.maxRetries;
  }

  /**
   * Compute φ-exponential backoff for next retry.
   * Delay sequence: 1s, 1.618s, 2.618s, 4.236s, 6.854s
   * @returns {number} Milliseconds to wait before next attempt
   */
  nextBackoffMs() {
    return Math.round(1000 * Math.pow(PHI, this.attempts));
  }

  /**
   * Schedule the task for retry.
   * @param {Error} err
   */
  scheduleRetry(err) {
    this.attempts++;
    this.error      = err?.message ?? String(err);
    this.status     = 'pending';
    this.scheduledAt = Date.now() + this.nextBackoffMs();
    this.lastAttemptAt = Date.now();
  }

  /** Mark task as sent to DLQ */
  kill(err) {
    this.status = 'dead';
    this.error  = err?.message ?? String(err);
    this.lastAttemptAt = Date.now();
  }

  toJSON() {
    return {
      id:           this.id,
      queue:        this.queue,
      priority:     this.priority,
      status:       this.status,
      attempts:     this.attempts,
      maxRetries:   this.maxRetries,
      createdAt:    this.createdAt,
      scheduledAt:  this.scheduledAt,
      lastAttemptAt: this.lastAttemptAt,
      error:        this.error,
      metadata:     this.metadata,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fibonacci Token Bucket (rate limiter for dequeue)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class FibonacciTokenBucket
 * Rate limiter using Fibonacci-scaled token refill.
 * Burst capacity: fib(10)=55 tokens
 * Refill rate: fib(7)=13 tokens/second
 */
class FibonacciTokenBucket {
  /**
   * @param {Object} opts
   * @param {number} [opts.capacity=55]    - fib(10) max tokens
   * @param {number} [opts.refillRate=13]  - fib(7) tokens per second
   */
  constructor(opts = {}) {
    this.capacity    = opts.capacity   ?? FIB[10];   // 55
    this.refillRate  = opts.refillRate ?? FIB[7];    // 13 tokens/sec
    this.tokens      = this.capacity;
    this._lastRefill = Date.now();
  }

  /** Refill tokens based on elapsed time */
  _refill() {
    const now     = Date.now();
    const elapsed = (now - this._lastRefill) / 1000;  // seconds
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this._lastRefill = now;
  }

  /**
   * Attempt to consume N tokens.
   * @param {number} [n=1]
   * @returns {boolean} true if tokens available
   */
  consume(n = 1) {
    this._refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /**
   * Time until N tokens become available.
   * @param {number} [n=1]
   * @returns {number} milliseconds
   */
  waitTimeMs(n = 1) {
    this._refill();
    if (this.tokens >= n) return 0;
    const deficit = n - this.tokens;
    return Math.ceil((deficit / this.refillRate) * 1000);
  }

  get utilizationRatio() {
    this._refill();
    return 1 - (this.tokens / this.capacity);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Queue (binary heap)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class PriorityQueue
 * Max-heap priority queue for Task objects.
 * Higher priority value = higher precedence.
 */
class PriorityQueue {
  constructor() {
    this._heap = [];
  }

  get size() { return this._heap.length; }

  /** @private Compare: returns true if a should be above b */
  _compare(a, b) {
    if (a.priority !== b.priority) return a.priority > b.priority;
    return a.scheduledAt < b.scheduledAt;  // FIFO within same priority
  }

  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
  }

  _parent(i)   { return Math.floor((i - 1) / 2); }
  _left(i)     { return 2 * i + 1; }
  _right(i)    { return 2 * i + 2; }

  _bubbleUp(i) {
    while (i > 0) {
      const p = this._parent(i);
      if (this._compare(this._heap[i], this._heap[p])) {
        this._swap(i, p);
        i = p;
      } else break;
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let largest = i;
      const l = this._left(i);
      const r = this._right(i);
      if (l < n && this._compare(this._heap[l], this._heap[largest])) largest = l;
      if (r < n && this._compare(this._heap[r], this._heap[largest])) largest = r;
      if (largest !== i) { this._swap(i, largest); i = largest; }
      else break;
    }
  }

  /** @param {Task} task */
  push(task) {
    this._heap.push(task);
    this._bubbleUp(this._heap.length - 1);
  }

  /** @returns {Task|undefined} Highest-priority ready task */
  pop() {
    if (this._heap.length === 0) return undefined;
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  /** @returns {Task|undefined} Peek without removing */
  peek() { return this._heap[0]; }

  /** @returns {Task[]} All tasks (unordered snapshot) */
  toArray() { return [...this._heap]; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dead Letter Queue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class DeadLetterQueue
 * Stores tasks that exceeded fib(5)=5 retries.
 * Emits 'dead-letter' events for monitoring.
 */
class DeadLetterQueue extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.maxSize    = opts.maxSize ?? FIB[12];   // fib(12)=144 DLQ entries
    this._entries   = [];
    this.totalDead  = 0;
  }

  /**
   * Enqueue a dead task.
   * @param {Task} task
   */
  enqueue(task) {
    task.kill(task.error ?? 'Max retries exceeded');
    if (this._entries.length >= this.maxSize) {
      this._entries.shift();  // drop oldest dead task
    }
    this._entries.push({ task, deadAt: Date.now() });
    this.totalDead++;
    this.emit('dead-letter', { task });
  }

  /** @returns {number} Current DLQ size */
  get size() { return this._entries.length; }

  /** @returns {Object[]} All dead task entries */
  getAll() { return [...this._entries]; }

  /** Replay a dead task (returns Task for re-enqueue) */
  replay(taskId) {
    const idx = this._entries.findIndex(e => e.task.id === taskId);
    if (idx === -1) throw new Error(`DLQ: task ${taskId} not found`);
    const [entry] = this._entries.splice(idx, 1);
    const t       = entry.task;
    t.attempts    = 0;
    t.status      = 'pending';
    t.error       = null;
    t.scheduledAt = Date.now();
    return t;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskQueue (main orchestrator)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class TaskQueue
 * Priority-based task queue with:
 *   - Fibonacci priorities
 *   - φ-backoff retry
 *   - Token bucket rate limiting
 *   - Dead letter queue
 *   - CSL pressure monitoring
 *
 * @extends EventEmitter
 *
 * Events:
 *   enqueued({task})
 *   dequeued({task})
 *   completed({task})
 *   failed({task, error, willRetry})
 *   dead-letter({task})
 *   pressure({level, ratio})
 */
class TaskQueue extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {number} [opts.maxCapacity=610]     - fib(15)=610 queue capacity
   * @param {number} [opts.rateCapacity=55]     - fib(10)=55 token bucket capacity
   * @param {number} [opts.rateRefill=13]       - fib(7)=13 tokens/sec refill
   * @param {number} [opts.workerConcurrency=8] - fib(6)=8 concurrent workers
   * @param {Function} [opts.processor]         - async (task) => result
   */
  constructor(opts = {}) {
    super();
    this._queue      = new PriorityQueue();
    this._dlq        = new DeadLetterQueue();
    this._bucket     = new FibonacciTokenBucket({
      capacity:   opts.rateCapacity  ?? FIB[10],   // 55
      refillRate: opts.rateRefill    ?? FIB[7],    // 13
    });
    this.maxCapacity      = opts.maxCapacity     ?? FIB[15];   // 610
    this.workerConcurrency = opts.workerConcurrency ?? FIB[6]; // 8
    this._processor  = opts.processor ?? null;
    this._inFlight   = new Map();   // taskId → Promise
    this._running    = false;
    this._stats      = {
      enqueued:   0,
      processed:  0,
      failed:     0,
      retried:    0,
      deadLetted: 0,
    };

    // Wire DLQ events
    this._dlq.on('dead-letter', ({ task }) => {
      this._stats.deadLetted++;
      this.emit('dead-letter', { task });
    });

    // Pressure monitoring every fib(7)=13s
    this._pressureInterval = setInterval(
      () => this._emitPressure(),
      FIB[7] * 1000
    ).unref();
  }

  // ───────────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────────

  /**
   * Enqueue a task.
   * @param {Object|Task} taskOrOpts
   * @returns {Task}
   */
  enqueue(taskOrOpts) {
    if (this._queue.size >= this.maxCapacity) {
      throw new Error(`Queue at capacity (${this.maxCapacity} = fib(15))`);
    }
    const task = taskOrOpts instanceof Task ? taskOrOpts : new Task(taskOrOpts);
    this._queue.push(task);
    this._stats.enqueued++;
    this.emit('enqueued', { task });
    this._scheduleProcess();
    return task;
  }

  /**
   * Dequeue the next ready, highest-priority task.
   * Respects token bucket rate limiting.
   * @returns {Task|null} task or null if rate limited / queue empty
   */
  dequeue() {
    if (this._queue.size === 0) return null;
    const peek = this._queue.peek();
    if (!peek) return null;

    // Check if task is scheduled for the future (retry delay)
    if (peek.scheduledAt > Date.now()) return null;

    // Rate limit check
    if (!this._bucket.consume(1)) {
      const waitMs = this._bucket.waitTimeMs(1);
      this.emit('rate-limited', { waitMs });
      return null;
    }

    const task = this._queue.pop();
    task.status = 'processing';
    task.lastAttemptAt = Date.now();
    this.emit('dequeued', { task });
    return task;
  }

  /**
   * Acknowledge task completion.
   * @param {string} taskId
   * @param {*} [result]
   */
  ack(taskId, result) {
    const task = this._getInFlight(taskId);
    if (!task) return;
    task.status = 'done';
    this._inFlight.delete(taskId);
    this._stats.processed++;
    this.emit('completed', { task, result });
  }

  /**
   * Negative-acknowledge: retry or DLQ.
   * @param {string} taskId
   * @param {Error} err
   */
  nack(taskId, err) {
    const task = this._getInFlight(taskId);
    if (!task) return;
    this._inFlight.delete(taskId);
    this._stats.failed++;

    if (task.canRetry()) {
      task.scheduleRetry(err);
      this._stats.retried++;
      this._queue.push(task);
      this.emit('failed', { task, error: err, willRetry: true, nextAttemptMs: task.nextBackoffMs() });
      // Re-schedule processing after backoff
      setTimeout(() => this._scheduleProcess(), task.nextBackoffMs());
    } else {
      this._dlq.enqueue(task);
      this.emit('failed', { task, error: err, willRetry: false });
    }
  }

  /**
   * Start automatic processing if a processor is configured.
   */
  start() {
    if (!this._processor) throw new Error('No processor configured');
    this._running = true;
    this._processLoop();
  }

  /** Stop processing (drain gracefully). */
  stop() { this._running = false; }

  /**
   * Drain: wait for all in-flight tasks to complete.
   * @param {number} [timeoutMs=21000] - fib(8)=21s default
   * @returns {Promise<void>}
   */
  async drain(timeoutMs = FIB[8] * 1000) {
    this._running = false;
    const start = Date.now();
    while (this._inFlight.size > 0) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Drain timeout after ${timeoutMs}ms (fib(8) × 1000)`);
      }
      await new Promise(r => setTimeout(r, FIB[5] * 100));  // 500ms poll
    }
  }

  // ───────────────────────────────────────────────
  // Metrics & Monitoring
  // ───────────────────────────────────────────────

  /**
   * Current queue depth across all priority levels.
   * @returns {number}
   */
  get depth() { return this._queue.size; }

  /**
   * CSL pressure based on queue depth ratio.
   * @returns {string} NOMINAL | ELEVATED | HIGH | CRITICAL
   */
  get pressureLevel() {
    const ratio = this._queue.size / this.maxCapacity;
    if (ratio < 0.382)       return PRESSURE.NOMINAL.label;
    if (ratio < 0.618)       return PRESSURE.ELEVATED.label;
    if (ratio < 0.854)       return PRESSURE.HIGH.label;
    return                          PRESSURE.CRITICAL.label;
  }

  /**
   * Full metrics snapshot.
   * @returns {Object}
   */
  metrics() {
    const depthRatio = this._queue.size / this.maxCapacity;
    return {
      timestamp:       new Date().toISOString(),
      phi:             PHI,
      queue: {
        depth:         this._queue.size,
        capacity:      this.maxCapacity,
        depthRatio:    Number(depthRatio.toFixed(4)),
        pressure:      this.pressureLevel,
      },
      dlq: {
        size:          this._dlq.size,
        totalDead:     this._dlq.totalDead,
      },
      rateLimiter: {
        tokens:        Math.floor(this._bucket.tokens),
        capacity:      this._bucket.capacity,
        refillRate:    this._bucket.refillRate,
        utilization:   Number(this._bucket.utilizationRatio.toFixed(4)),
      },
      inFlight:        this._inFlight.size,
      stats:           { ...this._stats },
      priorities:      this._depthByPriority(),
    };
  }

  // ───────────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────────

  _getInFlight(taskId) {
    return [...this._inFlight.values()].find(t => t.id === taskId) || null;
  }

  _scheduleProcess() {
    if (this._running && this._inFlight.size < this.workerConcurrency) {
      setImmediate(() => this._processLoop());
    }
  }

  async _processLoop() {
    if (!this._running) return;

    while (
      this._running &&
      this._inFlight.size < this.workerConcurrency &&
      this._queue.size > 0
    ) {
      const task = this.dequeue();
      if (!task) break;

      this._inFlight.set(task.id, task);

      // Process task
      (async () => {
        try {
          const result = await this._processor(task);
          this.ack(task.id, result);
        } catch (err) {
          this.nack(task.id, err);
        }
        // Immediately try to process more
        setImmediate(() => this._processLoop());
      })();
    }
  }

  _emitPressure() {
    const ratio = this._queue.size / this.maxCapacity;
    this.emit('pressure', { level: this.pressureLevel, ratio });
  }

  _depthByPriority() {
    const counts = {};
    Object.entries(PRIORITY).forEach(([k]) => { counts[k] = 0; });
    this._queue.toArray().forEach(task => {
      const label = Object.entries(PRIORITY).find(([, v]) => v === task.priority)?.[0] ?? 'UNKNOWN';
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return counts;
  }

  /** Clean up intervals */
  destroy() {
    clearInterval(this._pressureInterval);
    this._running = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  TaskQueue,
  Task,
  PriorityQueue,
  DeadLetterQueue,
  FibonacciTokenBucket,
  PRIORITY,
  PRESSURE,
  PHI,
  FIB,
};

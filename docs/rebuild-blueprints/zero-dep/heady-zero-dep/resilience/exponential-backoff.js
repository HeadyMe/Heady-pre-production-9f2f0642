/**
 * @file exponential-backoff.js
 * @description PHI-scaled exponential backoff with jitter strategies and retry budgets.
 *
 * Delay formula: baseDelay * φ^attempt + jitter
 *
 * Jitter strategies:
 * - FULL:         random delay in [0, computed]
 * - EQUAL:        computed/2 + random in [0, computed/2]
 * - DECORRELATED: random in [base, prev * PHI * 3]
 *
 * Features:
 * - Max retry limit
 * - Retry budget per time window (global spend limit)
 * - Dead letter queue for permanently failed retries
 * - AbortSignal support for cancellation
 *
 * Sacred Geometry: base * φ^attempt for all delays.
 * Zero external dependencies.
 *
 * @module HeadyResilience/ExponentialBackoff
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── Jitter Strategies ────────────────────────────────────────────────────────
export const JitterStrategy = Object.freeze({
  NONE:         'none',
  FULL:         'full',
  EQUAL:        'equal',
  DECORRELATED: 'decorrelated',
});

// ─── Dead Letter Queue ────────────────────────────────────────────────────────
class DeadLetterQueue {
  constructor(maxSize = 377) {
    this.maxSize = maxSize;
    this._items  = [];
  }

  push(item) {
    if (this._items.length >= this.maxSize) {
      this._items.shift(); // drop oldest
    }
    this._items.push({
      ...item,
      deadAt: Date.now(),
    });
  }

  drain() {
    const items = [...this._items];
    this._items = [];
    return items;
  }

  peek(n = 10) {
    return this._items.slice(-n);
  }

  get size() { return this._items.length; }
}

// ─── Retry Budget ─────────────────────────────────────────────────────────────
class RetryBudget {
  /**
   * @param {number} budget    Total retry-ms budget per window
   * @param {number} windowMs  Budget window size
   */
  constructor(budget = 60_000, windowMs = 60_000) {
    this.budget   = budget;
    this.windowMs = windowMs;
    this._spent   = [];   // [ {ts, cost} ]
  }

  _prune() {
    const cutoff = Date.now() - this.windowMs;
    this._spent  = this._spent.filter(e => e.ts > cutoff);
  }

  spentInWindow() {
    this._prune();
    return this._spent.reduce((acc, e) => acc + e.cost, 0);
  }

  canSpend(cost) {
    return this.spentInWindow() + cost <= this.budget;
  }

  spend(cost) {
    if (!this.canSpend(cost)) return false;
    this._spent.push({ ts: Date.now(), cost });
    return true;
  }

  remaining() {
    return Math.max(0, this.budget - this.spentInWindow());
  }
}

// ─── BackoffCalculator ────────────────────────────────────────────────────────
export class BackoffCalculator {
  /**
   * @param {object} config
   * @param {number} config.baseDelayMs     Base delay (ms)
   * @param {number} config.maxDelayMs      Cap on computed delay
   * @param {number} config.maxAttempts     Max retries (0 = unlimited)
   * @param {string} config.jitter          JitterStrategy
   * @param {number} config.budget          Retry budget ms per window
   * @param {number} config.budgetWindowMs  Budget window size ms
   */
  constructor(config = {}) {
    this.config = {
      baseDelayMs:    config.baseDelayMs    ?? 100,
      maxDelayMs:     config.maxDelayMs     ?? 30_000,
      maxAttempts:    config.maxAttempts    ?? 8,
      jitter:         config.jitter         ?? JitterStrategy.FULL,
      budget:         config.budget         ?? 120_000,
      budgetWindowMs: config.budgetWindowMs ?? 60_000,
    };
    this._prevDelay = this.config.baseDelayMs;
  }

  /**
   * Compute delay for the nth attempt (0-indexed).
   * @param {number} attempt
   * @returns {number} delay in ms
   */
  compute(attempt) {
    const base = this.config.baseDelayMs;
    const max  = this.config.maxDelayMs;

    // PHI-scaled base
    const raw = Math.min(base * Math.pow(PHI, attempt), max);

    let delay;
    switch (this.config.jitter) {
      case JitterStrategy.NONE:
        delay = raw;
        break;

      case JitterStrategy.FULL:
        delay = Math.random() * raw;
        break;

      case JitterStrategy.EQUAL:
        delay = (raw / 2) + (Math.random() * (raw / 2));
        break;

      case JitterStrategy.DECORRELATED: {
        // AWS decorrelated jitter: uniform in [base, prev * PHI * 3]
        const lo   = base;
        const hi   = Math.min(this._prevDelay * PHI * 3, max);
        delay      = lo + Math.random() * (hi - lo);
        this._prevDelay = delay;
        break;
      }

      default:
        delay = raw;
    }

    return Math.floor(Math.max(0, Math.min(delay, max)));
  }

  reset() {
    this._prevDelay = this.config.baseDelayMs;
  }
}

// ─── RetryExecutor ────────────────────────────────────────────────────────────
/**
 * Execute an async function with PHI-scaled exponential backoff.
 */
export class RetryExecutor extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} opts.backoff    BackoffCalculator config
   * @param {object} opts.budget     RetryBudget config
   * @param {number} opts.dlqSize    Dead letter queue size
   */
  constructor(opts = {}) {
    super();
    this._calc = new BackoffCalculator(opts.backoff ?? {});
    this._budget = new RetryBudget(
      opts.budget?.total   ?? 120_000,
      opts.budget?.windowMs ?? 60_000,
    );
    this._dlq  = new DeadLetterQueue(opts.dlqSize ?? 377);
  }

  /**
   * Execute fn with retries.
   *
   * @param {Function}     fn         async () => result
   * @param {object}       [opts]
   * @param {AbortSignal}  [opts.signal]       Cancellation
   * @param {Function}     [opts.shouldRetry]  (err, attempt) => bool
   * @param {string}       [opts.taskId]       For DLQ tracking
   * @param {any}          [opts.payload]      Stored in DLQ on final failure
   *
   * @returns {Promise<any>}
   */
  async execute(fn, opts = {}) {
    const { signal, shouldRetry, taskId = randomUUID(), payload = null } = opts;
    const maxAttempts = this._calc.config.maxAttempts;
    this._calc.reset();

    let lastErr;
    for (let attempt = 0; attempt <= maxAttempts || maxAttempts === 0; attempt++) {
      // Abort check
      if (signal?.aborted) {
        const err = new Error('RetryExecutor: aborted');
        err.code  = 'ABORTED';
        throw err;
      }

      try {
        const result = await fn();
        if (attempt > 0) {
          this.emit('recovered', { taskId, attempts: attempt });
        }
        return result;
      } catch (err) {
        lastErr = err;

        // Should we retry this error?
        if (shouldRetry && !shouldRetry(err, attempt)) {
          this._dlq.push({ taskId, payload, error: err.message, attempts: attempt + 1 });
          this.emit('deadLetter', { taskId, error: err.message, reason: 'shouldRetry=false' });
          throw err;
        }

        // Max attempts exceeded → DLQ
        if (maxAttempts > 0 && attempt >= maxAttempts) {
          this._dlq.push({ taskId, payload, error: err.message, attempts: attempt + 1 });
          this.emit('deadLetter', { taskId, error: err.message, reason: 'max-attempts' });
          throw err;
        }

        const delay = this._calc.compute(attempt);

        // Budget check
        if (!this._budget.canSpend(delay)) {
          this._dlq.push({ taskId, payload, error: err.message, attempts: attempt + 1 });
          this.emit('deadLetter', { taskId, error: err.message, reason: 'budget-exhausted' });
          throw new Error(`RetryExecutor: budget exhausted after ${attempt} attempts`);
        }
        this._budget.spend(delay);

        this.emit('retry', { taskId, attempt: attempt + 1, delayMs: delay, error: err.message });

        await this._sleep(delay, signal);
      }
    }

    throw lastErr;
  }

  _sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('sleep aborted'), { code: 'ABORTED' }));
      }, { once: true });
    });
  }

  /**
   * Drain the dead letter queue.
   */
  drainDLQ() {
    return this._dlq.drain();
  }

  /**
   * Peek at recent DLQ items.
   */
  peekDLQ(n = 10) {
    return this._dlq.peek(n);
  }

  get dlqSize() { return this._dlq.size; }

  budgetStats() {
    return {
      budget:    this._calc.config.budget,
      spent:     this._budget.spentInWindow(),
      remaining: this._budget.remaining(),
    };
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────
/**
 * Simple retry with PHI backoff (no shared budget/DLQ).
 *
 * @param {Function} fn
 * @param {object}   [config]   BackoffCalculator config
 * @returns {Promise<any>}
 */
export async function withRetry(fn, config = {}) {
  const executor = new RetryExecutor({ backoff: config });
  return executor.execute(fn);
}

export { BackoffCalculator as Calculator, RetryBudget as Budget, DeadLetterQueue as DLQ };
export default RetryExecutor;

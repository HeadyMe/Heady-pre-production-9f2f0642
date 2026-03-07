/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Cron-like task scheduler for the Heady™ AI Platform.
 * Replaces node-cron. Supports fixed intervals, cron expressions (5 and 6
 * field formats), and one-shot delayed tasks. No external dependencies.
 * @module src/core/heady-scheduler
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('heady-scheduler');

// ---------------------------------------------------------------------------
// Cron expression parser
// ---------------------------------------------------------------------------

/**
 * Parses a single cron field into an array of valid values.
 * Supports: * / ranges (1-5) / lists (1,3,5) / step expressions (*\/5)
 *
 * @param {string} field - Single cron field value
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {Set<number>}
 */
function _parseCronField(field, min, max) {
  const values = new Set();

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2), 10);
      if (isNaN(step) || step < 1) throw new Error(`Invalid step: ${part}`);
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range: ${part}`);
      const [lo, hi] = [Math.max(start, min), Math.min(end, max)];
      for (let i = lo; i <= hi; i++) values.add(i);
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const [rangeStart, rangeEnd] = range.includes('-')
        ? range.split('-').map(Number)
        : [min, max];
      for (let i = rangeStart; i <= rangeEnd; i += step) values.add(i);
    } else {
      const val = parseInt(part, 10);
      if (isNaN(val)) throw new Error(`Invalid cron value: ${part}`);
      if (val >= min && val <= max) values.add(val);
    }
  }

  return values;
}

/**
 * @typedef {Object} ParsedCron
 * @property {Set<number>} seconds
 * @property {Set<number>} minutes
 * @property {Set<number>} hours
 * @property {Set<number>} dayOfMonth
 * @property {Set<number>} month
 * @property {Set<number>} dayOfWeek
 */

/**
 * Parses a cron expression string (5 or 6 fields).
 * 6 fields: second minute hour dayOfMonth month dayOfWeek
 * 5 fields: minute hour dayOfMonth month dayOfWeek (second defaults to 0)
 *
 * @param {string} expression
 * @returns {ParsedCron}
 */
function parseCronExpression(expression) {
  const fields = expression.trim().split(/\s+/);

  if (fields.length === 5) {
    // Standard 5-field cron: no seconds field
    fields.unshift('0');
  }

  if (fields.length !== 6) {
    throw new Error(`Invalid cron expression: expected 5 or 6 fields, got ${fields.length}: "${expression}"`);
  }

  const [secF, minF, hourF, domF, monF, dowF] = fields;

  return {
    seconds: _parseCronField(secF, 0, 59),
    minutes: _parseCronField(minF, 0, 59),
    hours: _parseCronField(hourF, 0, 23),
    dayOfMonth: _parseCronField(domF, 1, 31),
    month: _parseCronField(monF, 1, 12),
    dayOfWeek: _parseCronField(dowF, 0, 7),
  };
}

/**
 * Returns whether a given Date matches a parsed cron schedule.
 * @param {ParsedCron} parsed
 * @param {Date} date
 * @returns {boolean}
 */
function _matchesCron(parsed, date) {
  const sec = date.getSeconds();
  const min = date.getMinutes();
  const hr = date.getHours();
  const dom = date.getDate();
  const mon = date.getMonth() + 1; // 1-12
  const dow = date.getDay(); // 0=Sun, 6=Sat; also allow 7=Sun

  return (
    parsed.seconds.has(sec) &&
    parsed.minutes.has(min) &&
    parsed.hours.has(hr) &&
    parsed.dayOfMonth.has(dom) &&
    parsed.month.has(mon) &&
    (parsed.dayOfWeek.has(dow) || parsed.dayOfWeek.has(7) && dow === 0)
  );
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Task
 * @property {string} name - Unique task identifier
 * @property {Function} fn - Async task function
 * @property {'interval'|'cron'|'once'} type
 * @property {number} [intervalMs] - For type='interval'
 * @property {ParsedCron} [cron] - For type='cron'
 * @property {number} [runAt] - Epoch ms for type='once'
 * @property {boolean} running - Whether the task is active
 * @property {number} runCount - How many times it has run
 * @property {number|null} lastRunAt - Epoch ms of last run
 * @property {Error|null} lastError - Last execution error
 * @property {NodeJS.Timeout|null} _handle - Internal timer handle
 */

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

class HeadyScheduler {
  constructor() {
    /** @type {Map<string, Task>} */
    this._tasks = new Map();
    /** @type {NodeJS.Timeout|null} */
    this._cronTicker = null;
  }

  // ── Interval ─────────────────────────────────────────────────────────────

  /**
   * Schedules a task to run at a fixed interval.
   * @param {string} name - Unique task name
   * @param {number} intervalMs - Interval in milliseconds
   * @param {Function} fn - Async task function
   * @param {Object} [options={}]
   * @param {boolean} [options.runImmediately=false] - Run once right away
   * @returns {Task}
   */
  every(name, intervalMs, fn, options = {}) {
    if (this._tasks.has(name)) {
      throw new Error(`Task "${name}" is already registered. Call remove() first.`);
    }
    if (typeof intervalMs !== 'number' || intervalMs < 1) {
      throw new RangeError('intervalMs must be a positive number');
    }

    /** @type {Task} */
    const task = {
      name,
      fn,
      type: 'interval',
      intervalMs,
      running: true,
      runCount: 0,
      lastRunAt: null,
      lastError: null,
      _handle: null,
    };

    this._tasks.set(name, task);

    if (options.runImmediately) {
      this._execute(task);
    }

    task._handle = setInterval(() => this._execute(task), intervalMs);
    if (task._handle.unref) task._handle.unref();

    logger.debug(`Scheduled interval task: ${name}`, { intervalMs });
    return task;
  }

  // ── Cron ─────────────────────────────────────────────────────────────────

  /**
   * Schedules a task using a cron expression.
   * Polling resolution is 1 second.
   *
   * @param {string} name - Unique task name
   * @param {string} expression - Cron expression (5 or 6 fields)
   * @param {Function} fn - Async task function
   * @returns {Task}
   */
  cron(name, expression, fn) {
    if (this._tasks.has(name)) {
      throw new Error(`Task "${name}" is already registered.`);
    }

    const parsed = parseCronExpression(expression);

    /** @type {Task} */
    const task = {
      name,
      fn,
      type: 'cron',
      expression,
      cron: parsed,
      running: true,
      runCount: 0,
      lastRunAt: null,
      lastError: null,
      _handle: null,
      _lastTickSecond: null,
    };

    this._tasks.set(name, task);
    this._ensureCronTicker();
    logger.debug(`Scheduled cron task: ${name}`, { expression });
    return task;
  }

  // ── Once ─────────────────────────────────────────────────────────────────

  /**
   * Schedules a task to run once after a delay.
   * @param {string} name
   * @param {number} delayMs - Delay in milliseconds
   * @param {Function} fn
   * @returns {Task}
   */
  once(name, delayMs, fn) {
    if (this._tasks.has(name)) {
      throw new Error(`Task "${name}" is already registered.`);
    }

    /** @type {Task} */
    const task = {
      name,
      fn,
      type: 'once',
      runAt: Date.now() + delayMs,
      running: true,
      runCount: 0,
      lastRunAt: null,
      lastError: null,
      _handle: null,
    };

    this._tasks.set(name, task);

    task._handle = setTimeout(async () => {
      await this._execute(task);
      this._tasks.delete(name);
    }, delayMs);

    logger.debug(`Scheduled one-shot task: ${name}`, { delayMs });
    return task;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /**
   * Executes a task function with error handling.
   * @param {Task} task
   */
  async _execute(task) {
    if (!task.running) return;
    task.lastRunAt = Date.now();
    task.runCount++;
    try {
      await task.fn();
      task.lastError = null;
    } catch (err) {
      task.lastError = err;
      logger.error(`Scheduled task "${task.name}" threw an error`, { err });
    }
  }

  /**
   * Starts the 1-second polling ticker for cron tasks.
   */
  _ensureCronTicker() {
    if (this._cronTicker) return;
    this._cronTicker = setInterval(() => {
      const now = new Date();
      const secondKey = Math.floor(Date.now() / 1000);

      for (const task of this._tasks.values()) {
        if (task.type !== 'cron' || !task.running) continue;
        // Prevent double-firing within the same second
        if (task._lastTickSecond === secondKey) continue;
        if (_matchesCron(task.cron, now)) {
          task._lastTickSecond = secondKey;
          this._execute(task);
        }
      }
    }, 1000);
    if (this._cronTicker.unref) this._cronTicker.unref();
  }

  // ── Management ───────────────────────────────────────────────────────────

  /**
   * Pauses a task (won't run until resumed).
   * @param {string} name
   */
  pause(name) {
    const task = this._getTask(name);
    task.running = false;
    logger.debug(`Paused task: ${name}`);
  }

  /**
   * Resumes a paused task.
   * @param {string} name
   */
  resume(name) {
    const task = this._getTask(name);
    task.running = true;
    logger.debug(`Resumed task: ${name}`);
  }

  /**
   * Removes and cancels a scheduled task.
   * @param {string} name
   */
  remove(name) {
    const task = this._tasks.get(name);
    if (!task) return;
    if (task._handle) {
      if (task.type === 'interval') clearInterval(task._handle);
      else if (task.type === 'once') clearTimeout(task._handle);
    }
    this._tasks.delete(name);
    logger.debug(`Removed task: ${name}`);

    // Stop cron ticker if no cron tasks remain
    const hasCron = [...this._tasks.values()].some((t) => t.type === 'cron');
    if (!hasCron && this._cronTicker) {
      clearInterval(this._cronTicker);
      this._cronTicker = null;
    }
  }

  /**
   * Stops all tasks and clears all timers.
   */
  destroy() {
    for (const task of this._tasks.values()) {
      if (task._handle) {
        if (task.type === 'interval') clearInterval(task._handle);
        else if (task.type === 'once') clearTimeout(task._handle);
      }
    }
    this._tasks.clear();
    if (this._cronTicker) {
      clearInterval(this._cronTicker);
      this._cronTicker = null;
    }
    logger.debug('Scheduler destroyed');
  }

  /**
   * Returns a snapshot of all registered tasks.
   * @returns {Object[]}
   */
  list() {
    return [...this._tasks.values()].map(({ name, type, running, runCount, lastRunAt, lastError, intervalMs, expression }) => ({
      name,
      type,
      running,
      runCount,
      lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
      lastError: lastError ? lastError.message : null,
      intervalMs: intervalMs || null,
      expression: expression || null,
    }));
  }

  /** @private */
  _getTask(name) {
    const t = this._tasks.get(name);
    if (!t) throw new Error(`Task "${name}" not found`);
    return t;
  }
}

// ---------------------------------------------------------------------------
// Singleton scheduler + factory
// ---------------------------------------------------------------------------

/** Global default scheduler instance. */
const defaultScheduler = new HeadyScheduler();

/**
 * Creates a new isolated scheduler instance.
 * @returns {HeadyScheduler}
 */
function createScheduler() {
  return new HeadyScheduler();
}

module.exports = {
  HeadyScheduler,
  defaultScheduler,
  createScheduler,
  parseCronExpression,
};

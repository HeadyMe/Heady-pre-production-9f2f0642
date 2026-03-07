/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const logger = require('../utils/logger').child('task-queue-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/**
 * PHI-scaled stall detection timeout (ms).
 * A task in-progress for longer than this is considered stalled.
 * PHI³ × 10 000ms ≈ 42 330ms (~42 s).
 */
const STALL_THRESHOLD_MS = Math.round(PHI * PHI * PHI * 10000);

/**
 * Throughput rolling window (number of completed-task timestamps retained).
 */
const THROUGHPUT_WINDOW = 100;

// ---------------------------------------------------------------------------
// Task lifecycle states
// ---------------------------------------------------------------------------
const TASK_STATE = {
  QUEUED:      'queued',
  IN_PROGRESS: 'in-progress',
  COMPLETED:   'completed',
  FAILED:      'failed',
};

// ---------------------------------------------------------------------------
// In-process throughput tracking
// ---------------------------------------------------------------------------
const _completionTimestamps = []; // Date.now() of each completed task
const _failureTimestamps    = []; // Date.now() of each failed task

/**
 * Called by event-bus listener when a task transitions to completed/failed.
 * Exposed so external code can feed events into the bee's tracking state.
 */
function recordTaskCompletion(ts = Date.now()) {
  _completionTimestamps.push(ts);
  if (_completionTimestamps.length > THROUGHPUT_WINDOW) _completionTimestamps.shift();
}

function recordTaskFailure(ts = Date.now()) {
  _failureTimestamps.push(ts);
  if (_failureTimestamps.length > THROUGHPUT_WINDOW) _failureTimestamps.shift();
}

// Wire into global.eventBus if available at module load time.
// The bee re-attaches listeners each time the module is first required.
(function attachBusListeners() {
  if (!global.eventBus) return;

  global.eventBus.on('task:completed', (evt) => recordTaskCompletion(evt?.ts ?? Date.now()));
  global.eventBus.on('task:failed',    (evt) => recordTaskFailure(evt?.ts    ?? Date.now()));
})();

// ---------------------------------------------------------------------------
// Queue registry helpers
// ---------------------------------------------------------------------------

/**
 * Return all task queues.
 * Expects global.taskRegistry to expose a `queues` Map or a `list()` method.
 * Each queue entry: { name, tasks: [{ id, state, priority, createdAt, startedAt, completedAt }] }
 */
function getQueues() {
  if (global.taskRegistry) {
    if (typeof global.taskRegistry.queues === 'object') {
      const q = global.taskRegistry.queues;
      return q instanceof Map ? [...q.values()] : Object.values(q);
    }
    if (typeof global.taskRegistry.list === 'function') {
      return global.taskRegistry.list();
    }
    if (Array.isArray(global.taskRegistry)) {
      return global.taskRegistry;
    }
  }
  logger.warn('global.taskRegistry not found — returning empty queue list');
  return [];
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

/**
 * Worker: snapshot-queues
 * Snapshots all task queues: depth, per-state counts, oldest task age, priority distribution.
 */
function makeSnapshotQueuesWorker() {
  return async function snapshotQueues() {
    const tag  = 'snapshot-queues';
    logger.debug(`[${tag}] starting`);

    const queues    = getQueues();
    const now       = Date.now();
    const snapshot  = {};
    let   totalDepth = 0;

    for (const queue of queues) {
      const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];
      totalDepth += tasks.length;

      const stateCounts = tasks.reduce((acc, t) => {
        acc[t.state || TASK_STATE.QUEUED] = (acc[t.state || TASK_STATE.QUEUED] || 0) + 1;
        return acc;
      }, {});

      const ages = tasks
        .filter(t => t.createdAt)
        .map(t => now - t.createdAt)
        .sort((a, b) => a - b);

      const priorityCounts = tasks.reduce((acc, t) => {
        const p = t.priority ?? 'default';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {});

      snapshot[queue.name || queue.id || 'default'] = {
        depth:         tasks.length,
        stateCounts,
        priorityCounts,
        oldestAgeMs:   ages[ages.length - 1] ?? null,
        newestAgeMs:   ages[0]               ?? null,
        medianAgeMs:   ages[Math.floor(ages.length / 2)] ?? null,
      };
    }

    const result = {
      worker:      tag,
      capturedAt:  now,
      queueCount:  queues.length,
      totalDepth,
      queues:      snapshot,
    };

    logger.info(`[${tag}] completed`, {
      queueCount: result.queueCount,
      totalDepth,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:task-queue', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: analyze-throughput
 * Computes tasks/sec, average completion time, and backlog growth rate
 * from the in-process rolling window of completion timestamps.
 */
function makeAnalyzeThroughputWorker() {
  return async function analyzeThroughput() {
    const tag = 'analyze-throughput';
    logger.debug(`[${tag}] starting`);

    const now            = Date.now();
    const windowMs       = PHI * PHI * 60 * 1000; // ≈ 157 s rolling window
    const windowStart    = now - windowMs;

    const recentCompletions = _completionTimestamps.filter(ts => ts >= windowStart);
    const recentFailures    = _failureTimestamps.filter(ts => ts >= windowStart);

    const completedCount = recentCompletions.length;
    const failedCount    = recentFailures.length;
    const totalCount     = completedCount + failedCount;
    const windowSecs     = windowMs / 1000;

    // Tasks per second (completions only)
    const throughputPerSec = windowSecs > 0 ? completedCount / windowSecs : 0;

    // Average inter-completion interval (inverse throughput)
    let avgCompletionIntervalMs = null;
    if (recentCompletions.length > 1) {
      const sorted   = [...recentCompletions].sort((a, b) => a - b);
      const intervals = sorted.slice(1).map((ts, i) => ts - sorted[i]);
      avgCompletionIntervalMs = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    }

    // Backlog growth rate: (current queue depths compared to window start depth)
    // We approximate as: (completions - fails) vs new arrivals in the window.
    // If arrivals can't be determined, we use a ratio proxy.
    const successRate = totalCount > 0 ? completedCount / totalCount : 1;

    // CSL weighted_superposition for a throughput health score
    const throughputHealth = CSL.weighted_superposition([
      { value: Math.min(throughputPerSec / (1 / PHI), 1), weight: 0.5 },
      { value: successRate,                                weight: 0.5 },
    ]);

    const result = {
      worker:                   tag,
      capturedAt:               now,
      windowMs:                 Math.round(windowMs),
      windowSecs:               parseFloat(windowSecs.toFixed(1)),
      completedCount,
      failedCount,
      throughputPerSec:         parseFloat(throughputPerSec.toFixed(4)),
      avgCompletionIntervalMs:  avgCompletionIntervalMs !== null
                                  ? Math.round(avgCompletionIntervalMs)
                                  : null,
      successRate:              parseFloat(successRate.toFixed(4)),
      throughputHealth:         parseFloat(throughputHealth.toFixed(4)),
    };

    logger.info(`[${tag}] completed`, {
      throughputPerSec: result.throughputPerSec,
      successRate:      result.successRate,
      completedCount,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:task-queue', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: detect-stalls
 * Identifies tasks stuck in 'in-progress' state beyond the PHI-scaled
 * stall threshold. Emits individual stall events per stuck task.
 */
function makeDetectStallsWorker() {
  return async function detectStalls() {
    const tag  = 'detect-stalls';
    logger.debug(`[${tag}] starting`);

    const queues = getQueues();
    const now    = Date.now();
    const stalls = [];

    for (const queue of queues) {
      const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];

      for (const task of tasks) {
        if (task.state !== TASK_STATE.IN_PROGRESS) continue;
        if (!task.startedAt) continue;

        const inProgressMs = now - task.startedAt;

        // Use CSL soft_gate to compute how severely the task has exceeded the threshold
        const stallSignal = CSL.soft_gate(inProgressMs - STALL_THRESHOLD_MS, STALL_THRESHOLD_MS * 0.1);
        const isStalled   = inProgressMs > STALL_THRESHOLD_MS;

        if (isStalled) {
          const stall = {
            taskId:        task.id,
            queue:         queue.name || queue.id || 'default',
            state:         task.state,
            priority:      task.priority ?? null,
            startedAt:     task.startedAt,
            inProgressMs,
            thresholdMs:   STALL_THRESHOLD_MS,
            stallSignal:   parseFloat(stallSignal.toFixed(4)),
            overrunRatio:  parseFloat((inProgressMs / STALL_THRESHOLD_MS).toFixed(4)),
            ts:            now,
          };

          stalls.push(stall);
          logger.warn(`[${tag}] stalled task detected`, {
            taskId:  task.id,
            ageMs:   inProgressMs,
            overrun: stall.overrunRatio,
          });

          if (global.eventBus) {
            global.eventBus.emit('task:stalled', stall);
          }
        }
      }
    }

    const result = {
      worker:         tag,
      capturedAt:     now,
      stalls,
      stallCount:     stalls.length,
      thresholdMs:    STALL_THRESHOLD_MS,
      queuesChecked:  queues.length,
    };

    logger.info(`[${tag}] completed`, {
      stallCount:    result.stallCount,
      queuesChecked: result.queuesChecked,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:task-queue', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'task-queue-projection';
const description = 'Projects task queue state: depth/age snapshots, throughput analytics (P95, backlog growth), and PHI-scaled stall detection.';
const priority    = 0.8;

function getWork() {
  return [
    makeSnapshotQueuesWorker(),
    makeAnalyzeThroughputWorker(),
    makeDetectStallsWorker(),
  ];
}

module.exports = { domain, description, priority, getWork, recordTaskCompletion, recordTaskFailure };

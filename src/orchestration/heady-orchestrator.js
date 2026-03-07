/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { POOL_TIMEOUTS, PHI } = require('./heady-conductor');

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 200;

// Resource governor: maximum concurrent tasks per pool
const POOL_CONCURRENCY = {
  HOT:        34,
  WARM:       21,
  COLD:       13,
  RESERVE:     8,
  GOVERNANCE:  5,
};

// Workflow step status enum
const STEP_STATUS = {
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  SKIPPED:   'SKIPPED',
  TIMEOUT:   'TIMEOUT',
};

// Workflow status enum
const WORKFLOW_STATUS = {
  QUEUED:    'QUEUED',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  PARTIAL:   'PARTIAL',
};

// ─── Phi-Exponential Backoff ───────────────────────────────────────────────────
function phiBackoffDelay(attempt) {
  return Math.floor(BASE_RETRY_DELAY_MS * Math.pow(PHI, attempt));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── HeadyOrchestrator ────────────────────────────────────────────────────────

class HeadyOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = Object.assign({
      maxConcurrentWorkflows: 50,
    }, options);

    // Active workflows: workflowId → workflow state
    this._workflows = new Map();

    // Pool concurrency tracking
    this._poolActive = {
      HOT:        0,
      WARM:       0,
      COLD:       0,
      RESERVE:    0,
      GOVERNANCE: 0,
    };

    // Progress stream callbacks: workflowId → [callback, ...]
    this._progressListeners = new Map();

    logger.logSystem('HeadyOrchestrator', 'Initialized', {
      maxConcurrentWorkflows: this.options.maxConcurrentWorkflows,
      pools: POOL_CONCURRENCY,
    });
  }

  // ── Workflow Registration ──────────────────────────────────────────────────

  _createWorkflowState(workflowSpec) {
    const { id: workflowId = `wf-${Date.now()}-${Math.random().toString(36).slice(2)}` } = workflowSpec;
    const steps = (workflowSpec.steps || []).map((step, idx) => ({
      ...step,
      _idx:      idx,
      _id:       step.id || `step-${idx}`,
      _status:   STEP_STATUS.PENDING,
      _result:   null,
      _error:    null,
      _attempts: 0,
      _startedAt: null,
      _completedAt: null,
    }));

    return {
      workflowId,
      spec:      workflowSpec,
      steps,
      status:    WORKFLOW_STATUS.QUEUED,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      results:   {},
      errors:    [],
      pool:      workflowSpec.pool || workflowSpec.routingDecision?.pool || 'WARM',
    };
  }

  // ── Progress Streaming ─────────────────────────────────────────────────────

  onProgress(workflowId, callback) {
    if (!this._progressListeners.has(workflowId)) {
      this._progressListeners.set(workflowId, []);
    }
    this._progressListeners.get(workflowId).push(callback);
  }

  _emitProgress(workflowId, update) {
    const listeners = this._progressListeners.get(workflowId) || [];
    for (const cb of listeners) {
      try { cb(update); } catch (_) {}
    }
    this.emit('progress', { workflowId, ...update });
  }

  // ── Resource Governor ──────────────────────────────────────────────────────

  _acquirePoolSlot(pool) {
    const max = POOL_CONCURRENCY[pool] || POOL_CONCURRENCY.WARM;
    if (this._poolActive[pool] >= max) return false;
    this._poolActive[pool]++;
    return true;
  }

  _releasePoolSlot(pool) {
    if (this._poolActive[pool] > 0) this._poolActive[pool]--;
  }

  async _waitForPoolSlot(pool, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this._acquirePoolSlot(pool)) return true;
      await sleep(100);
    }
    return false;
  }

  // ── Step Execution ─────────────────────────────────────────────────────────

  async _executeStep(wf, step, context) {
    const pool    = wf.pool;
    const timeout = POOL_TIMEOUTS[pool] || POOL_TIMEOUTS.WARM;

    // Wait for pool slot
    const acquired = await this._waitForPoolSlot(pool, timeout);
    if (!acquired) {
      step._status = STEP_STATUS.TIMEOUT;
      step._error  = `Pool ${pool} slot not available within timeout`;
      return false;
    }

    step._status    = STEP_STATUS.RUNNING;
    step._startedAt = Date.now();

    this._emitProgress(wf.workflowId, {
      type:   'step:start',
      stepId: step._id,
      status: STEP_STATUS.RUNNING,
    });

    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      step._attempts = attempt + 1;

      try {
        // Execute step handler with timeout
        const result = await this._runWithTimeout(
          () => this._invokeStep(step, context),
          timeout,
          `Step ${step._id} timeout after ${timeout}ms`
        );

        step._result   = result;
        step._status   = STEP_STATUS.COMPLETED;
        step._completedAt = Date.now();
        wf.results[step._id] = result;
        success = true;
        break;
      } catch (err) {
        lastError = err;
        logger.warn('HeadyOrchestrator', `Step ${step._id} attempt ${attempt + 1} failed`, {
          error: err.message,
          workflowId: wf.workflowId,
        });

        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = phiBackoffDelay(attempt);
          logger.info('HeadyOrchestrator', `Retrying step ${step._id} in ${delay}ms`, { attempt: attempt + 1 });
          this._emitProgress(wf.workflowId, {
            type:    'step:retry',
            stepId:  step._id,
            attempt: attempt + 1,
            delay,
          });
          await sleep(delay);
        }
      }
    }

    this._releasePoolSlot(pool);

    if (!success) {
      step._status = STEP_STATUS.FAILED;
      step._error  = lastError?.message || 'Unknown error';
      step._completedAt = Date.now();
      wf.errors.push({ stepId: step._id, error: step._error });
      this._emitProgress(wf.workflowId, {
        type:   'step:failed',
        stepId: step._id,
        error:  step._error,
      });
    } else {
      this._emitProgress(wf.workflowId, {
        type:    'step:completed',
        stepId:  step._id,
        result:  step._result,
        latency: step._completedAt - step._startedAt,
      });
    }

    return success;
  }

  async _runWithTimeout(fn, ms, message) {
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

  async _invokeStep(step, context) {
    // If step has an explicit handler function, use it
    if (typeof step.handler === 'function') {
      return step.handler(context, step.params || {});
    }

    // If step has a service reference, delegate
    if (step.service && typeof step.service.execute === 'function') {
      return step.service.execute(step.params || {}, context);
    }

    // Stub: in production, dispatch to bee/provider via conductor
    logger.info('HeadyOrchestrator', `Executing stub step ${step._id}`, { type: step.type });
    return { stepId: step._id, type: step.type, status: 'stub-ok', params: step.params };
  }

  // ── Sequential Execution ───────────────────────────────────────────────────

  async _executeSequential(wf, steps, context) {
    for (const step of steps) {
      const ok = await this._executeStep(wf, step, context);
      if (!ok && step.required !== false) {
        return false; // abort remaining sequential steps
      }
      // Pass result forward in context
      context.results = wf.results;
    }
    return true;
  }

  // ── Parallel Execution ─────────────────────────────────────────────────────

  async _executeParallel(wf, steps, context) {
    const promises = steps.map(step => this._executeStep(wf, step, { ...context }));
    const outcomes = await Promise.allSettled(promises);
    const failures = outcomes.filter(o => o.status === 'rejected' || o.value === false);
    const requiredFailures = steps.filter((s, i) => s.required !== false && (outcomes[i].status === 'rejected' || outcomes[i].value === false));
    return requiredFailures.length === 0;
  }

  // ── Main Execute Method ────────────────────────────────────────────────────

  async execute(workflowSpec) {
    if (this._workflows.size >= this.options.maxConcurrentWorkflows) {
      throw new Error('Max concurrent workflows reached');
    }

    const wf = this._createWorkflowState(workflowSpec);
    this._workflows.set(wf.workflowId, wf);

    wf.status    = WORKFLOW_STATUS.RUNNING;
    wf.startedAt = Date.now();

    this._emitProgress(wf.workflowId, {
      type:       'workflow:start',
      workflowId: wf.workflowId,
      stepCount:  wf.steps.length,
      pool:       wf.pool,
    });

    logger.logRoute('HeadyOrchestrator', `Starting workflow ${wf.workflowId}`, {
      steps:  wf.steps.length,
      pool:   wf.pool,
      mode:   workflowSpec.mode || 'sequential',
    });

    try {
      const context = {
        workflowId: wf.workflowId,
        spec:       workflowSpec,
        results:    wf.results,
        routingDecision: workflowSpec.routingDecision || null,
      };

      const mode = workflowSpec.mode || 'sequential';
      let allOk  = false;

      if (mode === 'parallel') {
        allOk = await this._executeParallel(wf, wf.steps, context);
      } else if (mode === 'mixed' && Array.isArray(workflowSpec.phases)) {
        // Mixed: phases of sequential groups, each phase can be parallel internally
        allOk = true;
        for (const phase of workflowSpec.phases) {
          const phaseSteps = wf.steps.filter(s => phase.stepIds.includes(s._id));
          const phaseOk = phase.parallel
            ? await this._executeParallel(wf, phaseSteps, context)
            : await this._executeSequential(wf, phaseSteps, context);
          if (!phaseOk && phase.required !== false) {
            allOk = false;
            break;
          }
        }
      } else {
        allOk = await this._executeSequential(wf, wf.steps, context);
      }

      wf.completedAt = Date.now();
      wf.status = allOk
        ? WORKFLOW_STATUS.COMPLETED
        : (wf.errors.length > 0 ? WORKFLOW_STATUS.PARTIAL : WORKFLOW_STATUS.FAILED);

      const summary = {
        workflowId:   wf.workflowId,
        status:       wf.status,
        totalSteps:   wf.steps.length,
        completed:    wf.steps.filter(s => s._status === STEP_STATUS.COMPLETED).length,
        failed:       wf.steps.filter(s => s._status === STEP_STATUS.FAILED).length,
        skipped:      wf.steps.filter(s => s._status === STEP_STATUS.SKIPPED).length,
        duration:     wf.completedAt - wf.startedAt,
        results:      wf.results,
        errors:       wf.errors,
      };

      this._emitProgress(wf.workflowId, { type: 'workflow:completed', ...summary });
      this.emit('workflow:completed', summary);

      logger.logRoute('HeadyOrchestrator', `Workflow ${wf.workflowId} ${wf.status}`, {
        duration: summary.duration,
        completed: summary.completed,
        failed: summary.failed,
      });

      return summary;
    } catch (err) {
      wf.status      = WORKFLOW_STATUS.FAILED;
      wf.completedAt = Date.now();
      wf.errors.push({ stepId: null, error: err.message });

      logger.error('HeadyOrchestrator', `Workflow ${wf.workflowId} fatal error`, { error: err.message });
      this._emitProgress(wf.workflowId, { type: 'workflow:failed', workflowId: wf.workflowId, error: err.message });
      this.emit('workflow:failed', { workflowId: wf.workflowId, error: err.message });
      throw err;
    } finally {
      // Clean up listeners after a grace period
      setTimeout(() => this._progressListeners.delete(wf.workflowId), 60_000);
    }
  }

  // ── Introspection ──────────────────────────────────────────────────────────

  getWorkflow(workflowId) {
    return this._workflows.get(workflowId) || null;
  }

  listWorkflows(status) {
    const all = [...this._workflows.values()];
    if (status) return all.filter(w => w.status === status);
    return all;
  }

  getPoolStatus() {
    const status = {};
    for (const pool of Object.keys(POOL_CONCURRENCY)) {
      status[pool] = {
        active: this._poolActive[pool],
        max:    POOL_CONCURRENCY[pool],
        utilization: (this._poolActive[pool] / POOL_CONCURRENCY[pool] * 100).toFixed(1) + '%',
      };
    }
    return status;
  }
}

module.exports = {
  HeadyOrchestrator,
  STEP_STATUS,
  WORKFLOW_STATUS,
  POOL_CONCURRENCY,
  phiBackoffDelay,
};

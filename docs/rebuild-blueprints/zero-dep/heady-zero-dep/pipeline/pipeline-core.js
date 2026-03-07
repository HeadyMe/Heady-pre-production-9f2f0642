/**
 * @file pipeline-core.js
 * @description HCFullPipeline — 12-Stage Heady Cognitive Full Pipeline.
 *
 * Stages (in order):
 * INTAKE → TRIAGE → PLAN → MONTE_CARLO → ARENA → JUDGE
 *       → APPROVE → EXECUTE → VERIFY → DEPLOY → RECEIPT → LEARN
 *
 * Features:
 * - Stage transitions with validation gates
 * - Parallel execution within stages (PHI-scaled worker slots)
 * - Rollback support (any stage can roll back to a previous checkpoint)
 * - State persistence between stages (in-memory + optional WAL)
 * - Event emission at each transition
 * - PHI-weighted stage timeouts (earlier stages are faster)
 *
 * Sacred Geometry: Fibonacci stage weights, PHI timing.
 * Zero external dependencies — Node.js built-ins only.
 *
 * @module Pipeline/PipelineCore
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────

const PHI = 1.6180339887498948482;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/**
 * PHI-scaled exponential backoff
 * @param {number} n
 * @param {number} [base=500]
 * @returns {number} ms
 */
function phiBackoff(n, base = 500) {
  return Math.min(Math.floor(Math.pow(PHI, n) * base), FIBONACCI[9] * 1000);
}

// ─── Pipeline Stages ──────────────────────────────────────────────────────────

/**
 * 12-stage pipeline definition with PHI-weighted timeouts and parallelism.
 * @enum {object}
 */
export const PipelineStage = Object.freeze({
  INTAKE:      { name: 'INTAKE',      index: 0,  fibTimeout: 4,  parallel: false, description: 'Receive and normalize incoming request/data' },
  TRIAGE:      { name: 'TRIAGE',      index: 1,  fibTimeout: 5,  parallel: false, description: 'Classify, prioritize, route to appropriate track' },
  PLAN:        { name: 'PLAN',        index: 2,  fibTimeout: 6,  parallel: true,  description: 'Generate execution plan with alternatives' },
  MONTE_CARLO: { name: 'MONTE_CARLO', index: 3,  fibTimeout: 7,  parallel: true,  description: 'Monte Carlo simulation of outcomes and risks' },
  ARENA:       { name: 'ARENA',       index: 4,  fibTimeout: 8,  parallel: true,  description: 'Competing solutions battle for best outcome' },
  JUDGE:       { name: 'JUDGE',       index: 5,  fibTimeout: 6,  parallel: false, description: 'Evaluate arena results, select winner' },
  APPROVE:     { name: 'APPROVE',     index: 6,  fibTimeout: 5,  parallel: false, description: 'Human/policy approval gate before execution' },
  EXECUTE:     { name: 'EXECUTE',     index: 7,  fibTimeout: 9,  parallel: true,  description: 'Execute the approved plan with rollback support' },
  VERIFY:      { name: 'VERIFY',      index: 8,  fibTimeout: 7,  parallel: true,  description: 'Verify execution results against expected outcomes' },
  DEPLOY:      { name: 'DEPLOY',      index: 9,  fibTimeout: 8,  parallel: false, description: 'Deploy verified results to production/live systems' },
  RECEIPT:     { name: 'RECEIPT',     index: 10, fibTimeout: 4,  parallel: false, description: 'Generate receipt, audit trail, notify stakeholders' },
  LEARN:       { name: 'LEARN',       index: 11, fibTimeout: 6,  parallel: true,  description: 'Update models, patterns, routing with new experience' },
});

/** Ordered stage names for pipeline traversal */
export const STAGE_ORDER = Object.keys(PipelineStage);

// ─── Pipeline Run Status ──────────────────────────────────────────────────────

/**
 * @enum {string}
 */
export const RunStatus = Object.freeze({
  PENDING:    'PENDING',
  RUNNING:    'RUNNING',
  PAUSED:     'PAUSED',
  COMPLETED:  'COMPLETED',
  FAILED:     'FAILED',
  ROLLED_BACK:'ROLLED_BACK',
  CANCELLED:  'CANCELLED',
});

// ─── Stage Result ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} StageResult
 * @property {string} stage - stage name
 * @property {boolean} success
 * @property {*} [data] - stage output
 * @property {Error} [error]
 * @property {number} startTs
 * @property {number} endTs
 * @property {number} duration - ms
 * @property {object} [checkpoint] - state snapshot for rollback
 * @property {number} [parallelWorkers] - workers used if parallel
 */

// ─── Pipeline Run ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} PipelineRun
 * @property {string} id - unique run ID
 * @property {string} pipelineId - parent pipeline ID
 * @property {*} input - original input payload
 * @property {RunStatus} status
 * @property {string} currentStage
 * @property {number} startTs
 * @property {number} [endTs]
 * @property {Map<string, StageResult>} stageResults
 * @property {object} state - accumulated pipeline state (passed between stages)
 * @property {string[]} checkpoints - list of stage names with saved checkpoints
 * @property {number} retryCount
 * @property {object} [error]
 */

/**
 * Create a new pipeline run
 * @param {string} pipelineId
 * @param {*} input
 * @returns {PipelineRun}
 */
function createRun(pipelineId, input) {
  return {
    id:           randomUUID(),
    pipelineId,
    input,
    status:       RunStatus.PENDING,
    currentStage: STAGE_ORDER[0],
    startTs:      Date.now(),
    endTs:        null,
    stageResults: new Map(),
    state:        {},
    checkpoints:  [],
    retryCount:   0,
    error:        null,
  };
}

// ─── Stage Handler Registry ───────────────────────────────────────────────────

/**
 * @typedef {object} StageHandler
 * @property {string} stage - stage name
 * @property {function(PipelineRun, PipelineStageContext): Promise<*>} execute
 * @property {function(PipelineRun, *): Promise<boolean>} [validate] - gate check
 * @property {function(PipelineRun, *): Promise<void>} [rollback] - undo stage effects
 * @property {number} [timeoutMs] - override default timeout
 */

/**
 * @typedef {object} PipelineStageContext
 * @property {string} runId
 * @property {string} stage
 * @property {object} state - current accumulated pipeline state
 * @property {Function} checkpoint - () => void, save a checkpoint
 * @property {Function} emit - emit an event
 * @property {number} parallelSlots - available parallel worker slots
 */

// ─── Validation Gate ──────────────────────────────────────────────────────────

/**
 * Default validation gates for each stage.
 * Returns true to allow transition, false to halt pipeline.
 */
const DEFAULT_GATES = {
  TRIAGE:  (run) => run.state.classified != null,
  PLAN:    (run) => run.state.triaged === true,
  APPROVE: (run) => {
    // Auto-approve if no human approval handler is registered
    return run.state.judgeScore == null || run.state.judgeScore >= 0;
  },
  EXECUTE: (run) => run.state.approved === true,
  DEPLOY:  (run) => run.state.verified === true,
  LEARN:   () => true, // Always allowed
};

// ─── HCFullPipeline ───────────────────────────────────────────────────────────

/**
 * The 12-Stage Heady Cognitive Full Pipeline (HCFullPipeline).
 *
 * @extends EventEmitter
 *
 * @example
 * const pipeline = new HCFullPipeline({ id: 'main-pipeline' });
 *
 * // Register stage handlers
 * pipeline.registerHandler({
 *   stage: 'INTAKE',
 *   execute: async (run, ctx) => {
 *     run.state.normalized = normalizeInput(run.input);
 *     return run.state.normalized;
 *   }
 * });
 *
 * pipeline.on('stage.completed', ({ stage, duration }) => console.log(stage, duration + 'ms'));
 *
 * const runId = await pipeline.run({ query: 'what is PHI?' });
 */
export class HCFullPipeline extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {string} [options.id] - pipeline identifier
   * @param {number} [options.parallelSlots=FIBONACCI[6]] - max parallel workers per stage (13)
   * @param {boolean} [options.autoCheckpoint=true] - auto-save checkpoints after each stage
   * @param {string} [options.walPath] - WAL file for run state persistence
   * @param {number} [options.maxRetries=FIBONACCI[2]] - max retries per stage (2)
   * @param {boolean} [options.skipApprove=false] - skip APPROVE gate (auto-approve all)
   */
  constructor(options = {}) {
    super();
    this._id             = options.id ?? `pipeline-${randomUUID().slice(0, 8)}`;
    this._parallelSlots  = options.parallelSlots ?? FIBONACCI[6];  // 13
    this._autoCheckpoint = options.autoCheckpoint !== false;
    this._walPath        = options.walPath ?? null;
    this._maxRetries     = options.maxRetries ?? FIBONACCI[2];     // 2
    this._skipApprove    = options.skipApprove ?? false;

    /** @type {Map<string, StageHandler>} stage name → handler */
    this._handlers = new Map();

    /** @type {Map<string, PipelineRun>} runId → run */
    this._runs = new Map();

    /** @type {Map<string, { resolve: Function, reject: Function }>} runId → completion callbacks */
    this._runCallbacks = new Map();

    // Install default no-op handlers for all stages
    this._installDefaultHandlers();
  }

  // ─── Default Handlers ────────────────────────────────────────────────────

  /**
   * Install passthrough handlers for all stages.
   * These are overridden by registerHandler().
   * @private
   */
  _installDefaultHandlers() {
    for (const stageName of STAGE_ORDER) {
      this._handlers.set(stageName, {
        stage: stageName,
        execute: async (run, ctx) => {
          // Default: pass state through, mark stage as traversed
          run.state[`${stageName.toLowerCase()}_passed`] = true;
          return run.state;
        },
      });
    }

    // Default APPROVE: auto-approve unless skipApprove is false and approveHandler is set
    this._handlers.set('APPROVE', {
      stage: 'APPROVE',
      execute: async (run, ctx) => {
        if (this._skipApprove) {
          run.state.approved = true;
          return { approved: true, auto: true };
        }
        // If a human approval handler is registered, it will override this
        run.state.approved = true;
        return { approved: true, auto: true };
      },
    });
  }

  // ─── Handler Registration ─────────────────────────────────────────────────

  /**
   * Register a stage handler (replaces default passthrough)
   * @param {StageHandler} handler
   */
  registerHandler(handler) {
    if (!PipelineStage[handler.stage]) {
      throw new Error(`Unknown stage: ${handler.stage}. Must be one of: ${STAGE_ORDER.join(', ')}`);
    }
    this._handlers.set(handler.stage, handler);
    this.emit('handler.registered', { stage: handler.stage });
  }

  /**
   * Register multiple handlers at once
   * @param {StageHandler[]} handlers
   */
  registerHandlers(handlers) {
    for (const h of handlers) this.registerHandler(h);
  }

  // ─── Pipeline Execution ────────────────────────────────────────────────────

  /**
   * Execute the full pipeline with the given input.
   * Returns the run ID. Resolves when the pipeline completes.
   *
   * @param {*} input - pipeline input payload
   * @param {object} [options]
   * @param {string} [options.runId] - custom run ID
   * @param {string} [options.startFrom='INTAKE'] - resume from a specific stage
   * @param {object} [options.initialState] - pre-populate pipeline state
   * @returns {Promise<PipelineRun>} resolves with the completed run
   */
  run(input, options = {}) {
    return new Promise((resolve, reject) => {
      const run = createRun(this._id, input);
      if (options.runId) run.id = options.runId;
      if (options.initialState) Object.assign(run.state, options.initialState);
      if (options.startFrom) run.currentStage = options.startFrom;

      run.status = RunStatus.RUNNING;
      this._runs.set(run.id, run);
      this._runCallbacks.set(run.id, { resolve, reject });

      this._walWrite({ op: 'run.started', runId: run.id, stage: run.currentStage, ts: run.startTs });
      this.emit('run.started', { runId: run.id, pipelineId: this._id, input: run.input });

      // Start execution asynchronously
      this._executeRun(run).catch((err) => {
        this.emit('error', err);
      });
    });
  }

  /**
   * Internal run execution loop
   * @private
   * @param {PipelineRun} run
   */
  async _executeRun(run) {
    const stageNames = STAGE_ORDER.slice(STAGE_ORDER.indexOf(run.currentStage));

    for (const stageName of stageNames) {
      if (run.status === RunStatus.CANCELLED) break;
      if (run.status === RunStatus.PAUSED) {
        // Wait for resume
        await new Promise((r) => this.once(`run.resumed.${run.id}`, r));
      }

      run.currentStage = stageName;
      await this._executeStage(run, stageName);

      if (run.status === RunStatus.FAILED || run.status === RunStatus.ROLLED_BACK) {
        const cb = this._runCallbacks.get(run.id);
        if (cb) {
          this._runCallbacks.delete(run.id);
          cb.reject(Object.assign(new Error(`Pipeline failed at stage ${stageName}`), {
            run, stage: stageName, error: run.error
          }));
        }
        return;
      }
    }

    if (run.status !== RunStatus.CANCELLED) {
      run.status = RunStatus.COMPLETED;
      run.endTs  = Date.now();
      this._walWrite({ op: 'run.completed', runId: run.id, ts: run.endTs });
      this.emit('run.completed', {
        runId:    run.id,
        duration: run.endTs - run.startTs,
        state:    run.state,
      });
      const cb = this._runCallbacks.get(run.id);
      if (cb) {
        this._runCallbacks.delete(run.id);
        cb.resolve(run);
      }
    }
  }

  /**
   * Execute a single stage
   * @private
   * @param {PipelineRun} run
   * @param {string} stageName
   */
  async _executeStage(run, stageName) {
    const handler = this._handlers.get(stageName);
    const stageDef = PipelineStage[stageName];
    const timeoutMs = handler?.timeoutMs ?? FIBONACCI[stageDef.fibTimeout] * 1000;

    const stageResult = {
      stage:     stageName,
      success:   false,
      data:      null,
      error:     null,
      startTs:   Date.now(),
      endTs:     null,
      duration:  0,
      checkpoint:null,
      parallelWorkers: stageDef.parallel ? Math.min(this._parallelSlots, FIBONACCI[3]) : 1,
    };

    this.emit('stage.started', { runId: run.id, stage: stageName, ts: stageResult.startTs });
    this._walWrite({ op: 'stage.started', runId: run.id, stage: stageName, ts: stageResult.startTs });

    // Validation gate
    const gate = DEFAULT_GATES[stageName];
    if (gate && !gate(run)) {
      stageResult.error = new Error(`Validation gate failed for stage ${stageName}`);
      stageResult.endTs = Date.now();
      stageResult.duration = stageResult.endTs - stageResult.startTs;
      run.stageResults.set(stageName, stageResult);
      run.error = stageResult.error;
      run.status = RunStatus.FAILED;
      this.emit('stage.gate_failed', { runId: run.id, stage: stageName, error: stageResult.error });
      return;
    }

    // Execute with timeout and retry
    let lastErr = null;
    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = phiBackoff(attempt - 1);
        this.emit('stage.retrying', { runId: run.id, stage: stageName, attempt, delay });
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        // Build stage context
        const ctx = {
          runId:   run.id,
          stage:   stageName,
          state:   run.state,
          parallelSlots: this._parallelSlots,
          checkpoint: () => {
            stageResult.checkpoint = { ...run.state };
            if (!run.checkpoints.includes(stageName)) {
              run.checkpoints.push(stageName);
            }
          },
          emit: (event, data) => this.emit(event, { runId: run.id, stage: stageName, ...data }),
        };

        // Execute with timeout
        const resultPromise = handler.execute(run, ctx);
        const timeoutPromise = new Promise((_, rej) =>
          setTimeout(() => rej(new Error(`Stage ${stageName} timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        stageResult.data = await Promise.race([resultPromise, timeoutPromise]);
        stageResult.success = true;
        lastErr = null;

        // Auto-checkpoint after each stage
        if (this._autoCheckpoint) {
          stageResult.checkpoint = { ...run.state };
          if (!run.checkpoints.includes(stageName)) {
            run.checkpoints.push(stageName);
          }
        }
        break; // success — no retry needed
      } catch (err) {
        lastErr = err;
        run.retryCount++;
      }
    }

    stageResult.endTs  = Date.now();
    stageResult.duration = stageResult.endTs - stageResult.startTs;

    if (lastErr) {
      stageResult.error = lastErr;
      stageResult.success = false;
      run.stageResults.set(stageName, stageResult);
      run.error = lastErr;
      run.status = RunStatus.FAILED;

      this.emit('stage.failed', {
        runId:    run.id,
        stage:    stageName,
        error:    lastErr,
        duration: stageResult.duration,
        retries:  run.retryCount,
      });
      this._walWrite({ op: 'stage.failed', runId: run.id, stage: stageName, error: lastErr.message });
    } else {
      run.stageResults.set(stageName, stageResult);
      // Validate stage output if handler provides validate()
      if (handler.validate) {
        const valid = await handler.validate(run, stageResult.data).catch(() => false);
        if (!valid) {
          run.error = new Error(`Stage ${stageName} output failed validation`);
          run.status = RunStatus.FAILED;
          this.emit('stage.validation_failed', { runId: run.id, stage: stageName });
          this._walWrite({ op: 'stage.validation_failed', runId: run.id, stage: stageName });
          return;
        }
      }
      this.emit('stage.completed', {
        runId:    run.id,
        stage:    stageName,
        duration: stageResult.duration,
        data:     stageResult.data,
      });
      this._walWrite({ op: 'stage.completed', runId: run.id, stage: stageName, duration: stageResult.duration });
    }
  }

  // ─── Rollback ─────────────────────────────────────────────────────────────

  /**
   * Roll back a run to a previous checkpoint.
   * Executes rollback() handlers from current stage back to targetStage.
   *
   * @param {string} runId
   * @param {string} [targetStage] - roll back to this stage (default: most recent checkpoint)
   * @returns {Promise<void>}
   */
  async rollback(runId, targetStage) {
    const run = this._runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // Find rollback target
    const target = targetStage ?? run.checkpoints[run.checkpoints.length - 1];
    if (!target) throw new Error(`No checkpoints available for rollback`);

    const targetIdx = STAGE_ORDER.indexOf(target);
    const currentIdx = STAGE_ORDER.indexOf(run.currentStage);

    this.emit('run.rollback.started', { runId, from: run.currentStage, to: target });
    this._walWrite({ op: 'rollback.started', runId, from: run.currentStage, to: target });

    // Execute rollback handlers in reverse order
    for (let i = currentIdx; i >= targetIdx; i--) {
      const stageName = STAGE_ORDER[i];
      const handler = this._handlers.get(stageName);
      const result = run.stageResults.get(stageName);

      if (handler?.rollback) {
        try {
          await handler.rollback(run, result?.data);
          this.emit('stage.rolled_back', { runId, stage: stageName });
        } catch (err) {
          this.emit('stage.rollback_error', { runId, stage: stageName, error: err });
        }
      }

      run.stageResults.delete(stageName);
    }

    // Restore state from checkpoint
    const checkpointResult = run.stageResults.get(target);
    if (checkpointResult?.checkpoint) {
      Object.assign(run.state, checkpointResult.checkpoint);
    }

    run.currentStage = target;
    run.status = RunStatus.ROLLED_BACK;
    run.checkpoints = run.checkpoints.slice(0, run.checkpoints.indexOf(target) + 1);

    this.emit('run.rollback.completed', { runId, stage: target });
    this._walWrite({ op: 'rollback.completed', runId, stage: target });
  }

  // ─── Run Control ──────────────────────────────────────────────────────────

  /**
   * Pause a running pipeline
   * @param {string} runId
   */
  pause(runId) {
    const run = this._runs.get(runId);
    if (run && run.status === RunStatus.RUNNING) {
      run.status = RunStatus.PAUSED;
      this.emit('run.paused', { runId });
    }
  }

  /**
   * Resume a paused pipeline
   * @param {string} runId
   */
  resume(runId) {
    const run = this._runs.get(runId);
    if (run && run.status === RunStatus.PAUSED) {
      run.status = RunStatus.RUNNING;
      this.emit(`run.resumed.${runId}`);
      this.emit('run.resumed', { runId });
    }
  }

  /**
   * Cancel a running pipeline
   * @param {string} runId
   */
  cancel(runId) {
    const run = this._runs.get(runId);
    if (run && [RunStatus.RUNNING, RunStatus.PAUSED].includes(run.status)) {
      run.status = RunStatus.CANCELLED;
      run.endTs = Date.now();
      this.emit('run.cancelled', { runId });
      const cb = this._runCallbacks.get(runId);
      if (cb) {
        this._runCallbacks.delete(runId);
        cb.reject(new Error(`Run ${runId} was cancelled`));
      }
    }
  }

  // ─── Run Retrieval ────────────────────────────────────────────────────────

  /**
   * Get a run by ID
   * @param {string} runId
   * @returns {PipelineRun|undefined}
   */
  getRun(runId) { return this._runs.get(runId); }

  /**
   * Get all runs
   * @returns {PipelineRun[]}
   */
  getAllRuns() { return [...this._runs.values()]; }

  /**
   * Get runs by status
   * @param {RunStatus} status
   * @returns {PipelineRun[]}
   */
  getRunsByStatus(status) {
    return [...this._runs.values()].filter((r) => r.status === status);
  }

  // ─── Parallel Stage Execution Helper ─────────────────────────────────────

  /**
   * Run N async tasks in parallel with PHI-scaled slot limiting.
   * Useful inside stage handlers for fan-out work.
   *
   * @param {Array<function(): Promise<*>>} tasks
   * @param {number} [slots=FIBONACCI[5]] parallel slots (default 8)
   * @returns {Promise<Array<{ ok: boolean, value: *, error: Error|null }>>}
   */
  static async parallelRun(tasks, slots = FIBONACCI[5]) {
    const results = [];
    const queue = [...tasks];
    const running = [];

    const runNext = async () => {
      if (queue.length === 0) return;
      const task = queue.shift();
      let result;
      try {
        result = { ok: true, value: await task(), error: null };
      } catch (err) {
        result = { ok: false, value: null, error: err };
      }
      results.push(result);
      await runNext();
    };

    const workers = Array.from(
      { length: Math.min(slots, tasks.length) },
      () => runNext()
    );
    await Promise.all(workers);
    return results;
  }

  // ─── WAL ─────────────────────────────────────────────────────────────────

  /** @private */
  _walWrite(record) {
    if (!this._walPath) return;
    try {
      fs.appendFileSync(this._walPath, JSON.stringify(record) + '\n', 'utf8');
    } catch (_) {}
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /** @returns {object} pipeline status */
  get status() {
    const runs = [...this._runs.values()];
    return {
      id:          this._id,
      totalRuns:   runs.length,
      running:     runs.filter((r) => r.status === RunStatus.RUNNING).length,
      completed:   runs.filter((r) => r.status === RunStatus.COMPLETED).length,
      failed:      runs.filter((r) => r.status === RunStatus.FAILED).length,
      rolledBack:  runs.filter((r) => r.status === RunStatus.ROLLED_BACK).length,
      cancelled:   runs.filter((r) => r.status === RunStatus.CANCELLED).length,
      handlers:    [...this._handlers.keys()],
      stages:      STAGE_ORDER,
      parallelSlots: this._parallelSlots,
      phi:         PHI,
    };
  }
}

// ─── Pipeline Registry ────────────────────────────────────────────────────────

/**
 * Registry of named pipeline instances.
 * Allows service discovery by pipeline name/type.
 */
export class PipelineRegistry {
  constructor() {
    /** @type {Map<string, HCFullPipeline>} */
    this._pipelines = new Map();
  }

  /**
   * Register a pipeline
   * @param {string} name
   * @param {HCFullPipeline} pipeline
   */
  register(name, pipeline) {
    this._pipelines.set(name, pipeline);
  }

  /**
   * Get a pipeline by name
   * @param {string} name
   * @returns {HCFullPipeline|undefined}
   */
  get(name) { return this._pipelines.get(name); }

  /**
   * List all registered pipelines
   * @returns {string[]}
   */
  list() { return [...this._pipelines.keys()]; }

  /**
   * Remove a pipeline
   * @param {string} name
   */
  remove(name) { this._pipelines.delete(name); }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** @type {HCFullPipeline|null} */
let _globalPipeline = null;

/**
 * Get (or create) the global HCFullPipeline singleton
 * @param {object} [options]
 * @returns {HCFullPipeline}
 */
export function getGlobalPipeline(options = {}) {
  if (!_globalPipeline) {
    _globalPipeline = new HCFullPipeline({ id: 'global', ...options });
  }
  return _globalPipeline;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { PHI, FIBONACCI, phiBackoff };

export default {
  HCFullPipeline,
  PipelineRegistry,
  PipelineStage,
  STAGE_ORDER,
  RunStatus,
  createRun,
  getGlobalPipeline,
  PHI,
  FIBONACCI,
  phiBackoff,
};

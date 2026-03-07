'use strict';

/**
 * HeadyEval Runner
 *
 * Executes evaluation runs with:
 *  - Configurable parallelism (concurrency pool)
 *  - Progress tracking with ETA
 *  - Checkpoint/resume on failure
 *  - Rate limiting for judge calls
 *  - Cost tracking
 *  - Event emission for real-time progress
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const config = require('./config');

// ─── Concurrency pool ─────────────────────────────────────────────────────────

class ConcurrencyPool {
  constructor(limit) {
    this.limit = limit;
    this._running = 0;
    this._queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      const task = async () => {
        this._running++;
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          this._running--;
          this._drain();
        }
      };

      if (this._running < this.limit) {
        task();
      } else {
        this._queue.push(task);
      }
    });
  }

  _drain() {
    if (this._queue.length > 0 && this._running < this.limit) {
      this._queue.shift()();
    }
  }
}

// ─── EvalRun ─────────────────────────────────────────────────────────────────

const RUN_STATUSES = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

class EvalRun {
  constructor({ id, name, scorerNames, dataset, config: runConfig, metadata = {} }) {
    this.id = id || crypto.randomUUID();
    this.name = name || `run_${Date.now()}`;
    this.status = RUN_STATUSES.PENDING;
    this.scorerNames = scorerNames;
    this.datasetId = dataset?.id;
    this.datasetName = dataset?.name;
    this.totalExamples = dataset?.size || 0;
    this.processedExamples = 0;
    this.failedExamples = 0;
    this.config = runConfig;
    this.metadata = metadata;
    this.results = [];       // per-example results
    this.summary = null;     // aggregate stats
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.completedAt = null;
    this.errorMessage = null;
    this.durationMs = null;
    this.costEstimate = null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      scorerNames: this.scorerNames,
      datasetId: this.datasetId,
      datasetName: this.datasetName,
      totalExamples: this.totalExamples,
      processedExamples: this.processedExamples,
      failedExamples: this.failedExamples,
      metadata: this.metadata,
      results: this.results,
      summary: this.summary,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.durationMs,
      errorMessage: this.errorMessage,
      costEstimate: this.costEstimate,
    };
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

class Runner extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}  opts.concurrency
   * @param {string}  opts.checkpointsDir
   * @param {object}  opts.judgeClient
   * @param {object}  opts.embedClient
   * @param {object}  opts.guardClient
   */
  constructor(opts = {}) {
    super();
    this.concurrency = opts.concurrency || config.concurrency;
    this.checkpointsDir = opts.checkpointsDir || config.checkpointsDir;
    this.judgeClient = opts.judgeClient;
    this.embedClient = opts.embedClient || null;
    this.guardClient = opts.guardClient || null;
    this._runs = new Map();
    this._ensureDir();
  }

  _ensureDir() {
    try {
      fs.mkdirSync(this.checkpointsDir, { recursive: true });
    } catch {}
  }

  /**
   * Execute an evaluation run.
   *
   * @param {object} opts
   * @param {string}   opts.runId
   * @param {string}   opts.name
   * @param {Dataset}  opts.dataset
   * @param {BaseScorer[]} opts.scorers
   * @param {object}   [opts.metadata]
   * @returns {Promise<EvalRun>}
   */
  async execute({ runId, name, dataset, scorers, metadata = {} }) {
    const run = new EvalRun({
      id: runId || crypto.randomUUID(),
      name,
      scorerNames: scorers.map((s) => s.name),
      dataset,
      config: {
        concurrency: this.concurrency,
        judgeModel: config.judgeModel,
      },
      metadata,
    });

    this._runs.set(run.id, run);
    run.status = RUN_STATUSES.RUNNING;
    run.startedAt = new Date().toISOString();
    const startTs = Date.now();

    this.emit('run:start', { runId: run.id, name: run.name, total: run.totalExamples });

    // Load checkpoint if exists
    const checkpoint = await this._loadCheckpoint(run.id);
    const processedIds = new Set(checkpoint.processedIds || []);
    run.results = checkpoint.results || [];
    run.processedExamples = run.results.length;

    const examples = dataset.examples.filter((ex) => !processedIds.has(ex.id));

    const pool = new ConcurrencyPool(this.concurrency);
    const ctx = {
      judgeClient: this.judgeClient,
      embedClient: this.embedClient,
      guardClient: this.guardClient,
      config,
    };

    // ETA tracking
    const etaTracker = new ETATracker(examples.length, run.processedExamples);

    try {
      await Promise.all(
        examples.map((example) =>
          pool.run(async () => {
            const exampleResult = await this._evaluateExample(example, scorers, ctx);

            run.results.push(exampleResult);
            run.processedExamples++;
            if (exampleResult.error) run.failedExamples++;

            etaTracker.tick();

            this.emit('run:progress', {
              runId: run.id,
              processed: run.processedExamples,
              total: run.totalExamples,
              failed: run.failedExamples,
              etaMs: etaTracker.etaMs(),
              percentComplete: Math.round((run.processedExamples / run.totalExamples) * 100),
            });

            // Save checkpoint every 10 examples
            if (run.processedExamples % 10 === 0) {
              await this._saveCheckpoint(run.id, {
                processedIds: run.results.map((r) => r.exampleId),
                results: run.results,
              });
            }
          })
        )
      );

      run.status = RUN_STATUSES.COMPLETED;
    } catch (err) {
      run.status = RUN_STATUSES.FAILED;
      run.errorMessage = err.message;
      this.emit('run:error', { runId: run.id, error: err.message });
    }

    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - startTs;

    // Aggregate cost from judge client stats
    if (this.judgeClient && this.judgeClient.getStats) {
      const stats = this.judgeClient.getStats();
      run.costEstimate = this._estimateCost(stats);
    }

    // Clean up checkpoint on success
    if (run.status === RUN_STATUSES.COMPLETED) {
      this._deleteCheckpoint(run.id);
    }

    this.emit('run:complete', {
      runId: run.id,
      status: run.status,
      durationMs: run.durationMs,
      processed: run.processedExamples,
      failed: run.failedExamples,
    });

    return run;
  }

  /**
   * Evaluate a single example against all scorers.
   */
  async _evaluateExample(example, scorers, ctx) {
    const exampleStart = Date.now();
    const scorerResults = {};
    let exampleError = null;

    await Promise.all(
      scorers.map(async (scorer) => {
        try {
          const result = await scorer.evaluate(example, ctx);
          scorerResults[scorer.name] = result;
        } catch (err) {
          scorerResults[scorer.name] = {
            scorer: scorer.name,
            score: null,
            pass: false,
            breakdown: {},
            explanation: `Scorer error: ${err.message}`,
            metadata: {},
            durationMs: 0,
            error: err.message,
          };
          exampleError = err.message;
        }
      })
    );

    // Compute aggregate score across all scorers (mean of non-null)
    const scores = Object.values(scorerResults)
      .map((r) => r.score)
      .filter((s) => s !== null);
    const aggregateScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    return {
      exampleId: example.id,
      input: example.input,
      output: example.output || null,
      expected_output: example.expected_output || null,
      context: example.context || null,
      metadata: example.metadata || {},
      scorerResults,
      aggregateScore: aggregateScore !== null ? parseFloat(aggregateScore.toFixed(4)) : null,
      pass: aggregateScore !== null && aggregateScore >= config.scoring.passThreshold,
      durationMs: Date.now() - exampleStart,
      error: exampleError,
    };
  }

  /**
   * Single example scoring (used for /eval/score endpoint).
   */
  async scoreExample(example, scorers) {
    const ctx = {
      judgeClient: this.judgeClient,
      embedClient: this.embedClient,
      guardClient: this.guardClient,
      config,
    };
    return this._evaluateExample(example, scorers, ctx);
  }

  // ─── Checkpoint I/O ──────────────────────────────────────────────────────

  _checkpointPath(runId) {
    return path.join(this.checkpointsDir, `${runId}.checkpoint.json`);
  }

  async _loadCheckpoint(runId) {
    const filePath = this._checkpointPath(runId);
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  async _saveCheckpoint(runId, data) {
    try {
      fs.writeFileSync(this._checkpointPath(runId), JSON.stringify(data), 'utf-8');
    } catch {}
  }

  _deleteCheckpoint(runId) {
    try {
      fs.unlinkSync(this._checkpointPath(runId));
    } catch {}
  }

  // ─── Cost estimation ────────────────────────────────────────────────────

  _estimateCost(stats) {
    // Rough cost estimate: $3/1M input tokens, $15/1M output tokens (Claude 3.5 Sonnet pricing)
    const inputCost = (stats.inputTokens / 1e6) * 3;
    const outputCost = (stats.outputTokens / 1e6) * 15;
    return {
      totalUSD: parseFloat((inputCost + outputCost).toFixed(6)),
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      calls: stats.calls,
    };
  }

  getRun(runId) {
    return this._runs.get(runId) || null;
  }

  listRuns() {
    return Array.from(this._runs.values()).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      processedExamples: r.processedExamples,
      totalExamples: r.totalExamples,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
    }));
  }
}

// ─── ETATracker ───────────────────────────────────────────────────────────────

class ETATracker {
  constructor(remaining, completed = 0) {
    this.total = remaining + completed;
    this._completed = completed;
    this._startedAt = Date.now();
    this._times = [];
  }

  tick() {
    this._completed++;
    this._times.push(Date.now());
    if (this._times.length > 20) this._times.shift();
  }

  etaMs() {
    if (this._completed === 0 || this._times.length < 2) return null;
    const elapsed = Date.now() - this._startedAt;
    const rate = this._completed / elapsed; // examples per ms
    const remaining = this.total - this._completed;
    return remaining > 0 ? Math.round(remaining / rate) : 0;
  }
}

module.exports = { Runner, EvalRun, RUN_STATUSES, ConcurrencyPool, ETATracker };

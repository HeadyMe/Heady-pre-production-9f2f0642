/**
 * @fileoverview SelfCorrectionLoop — Execute-verify-correct cycle for autonomous
 * agents in the Heady Latent OS platform.
 *
 * Architecture:
 *   - Execute-Verify-Correct (EVC) cycle with configurable max iterations
 *   - Four error classes: syntax, logic, hallucination, incomplete
 *   - Per-class correction strategy dispatch
 *   - LLM judge verification with assertion-function fallback
 *   - Learning storage: patterns persist across correction cycles
 *   - Timeout protection per cycle and per total loop
 *   - Circuit breaker prevents unbounded retry storms
 *
 * Integration points:
 *   - src/hc_pipeline.js   (pipeline stage wrapping)
 *   - src/hc_conductor.js  (conductor-level error recovery)
 *   - modules/context-window-manager.js (correction history in context)
 *
 * @module self-correction-loop
 * @version 2.1.0
 *
 * PHI-MATH INTEGRATION:
 *   Quality thresholds, iteration limits, and pattern-store capacity are derived
 *   from φ (golden ratio) and the Fibonacci sequence via shared/phi-math.js.
 *   Every constant is a deterministic function — no magic numbers.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  CSL_THRESHOLDS,
  phiThreshold,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Error classification types */
const ERROR_TYPE = Object.freeze({
  SYNTAX:      'syntax',       // Malformed output (JSON parse fail, schema mismatch)
  LOGIC:       'logic',        // Incorrect reasoning or wrong answer
  HALLUCINATION: 'hallucination', // Fabricated facts or citations
  INCOMPLETE:  'incomplete',   // Missing required sections or partial output
  TIMEOUT:     'timeout',      // Execution exceeded time budget
  UNKNOWN:     'unknown',      // Unclassified error
});

/** Correction outcome codes */
const CORRECTION_OUTCOME = Object.freeze({
  FIXED:     'fixed',      // Error corrected successfully
  IMPROVED:  'improved',   // Partial improvement; another iteration warranted
  NO_CHANGE: 'no_change',  // Correction did not help
  ESCALATED: 'escalated',  // Exceeded max iterations, passed to parent
});

/** Verification result codes */
const VERIFY_RESULT = Object.freeze({
  PASS:        'pass',
  FAIL:        'fail',
  PARTIAL:     'partial',
  INCONCLUSIVE:'inconclusive',
});

/**
 * Default configuration — all values phi-derived.
 *
 * MIN_QUALITY_SCORE = CSL_THRESHOLDS.LOW ≈ 0.691
 *   Previously 0.75 (arbitrary). The LOW phi-harmonic threshold (phiThreshold(1))
 *   is the principled quality floor — above the noise floor (0.5) but below the
 *   medium gate (0.809). Outputs above this level show weak but real alignment.
 *
 * PATTERN_STORE_MAX = fib(14) = 377
 *   Previously 500 (arbitrary). fib(14) is the nearest Fibonacci number that
 *   provides sufficient pattern history. fib(13)=233 is also acceptable for
 *   memory-constrained deployments.
 */
const DEFAULTS = Object.freeze({
  MAX_ITERATIONS:     4,
  ITERATION_TIMEOUT:  30_000,   // ms per iteration
  TOTAL_TIMEOUT:      120_000,  // ms for entire loop
  CIRCUIT_THRESHOLD:  3,        // consecutive failures to trip circuit
  CIRCUIT_RECOVERY:   60_000,   // ms before circuit tries to recover
  /**
   * Phi-harmonic quality floor.
   * CSL_THRESHOLDS.LOW = phiThreshold(1) ≈ 0.691  (was 0.75 — arbitrary)
   * Outputs above this score show weak-but-real semantic alignment.
   */
  MIN_QUALITY_SCORE: CSL_THRESHOLDS.LOW,   // ≈ 0.691
  /**
   * Fibonacci-sized pattern store.
   * fib(14) = 377  (was 500 — arbitrary round number)
   * Fibonacci sizing ensures natural geometric growth if capacity is increased.
   */
  PATTERN_STORE_MAX: fib(14),              // = 377
});

// ─── Error Classifiers ────────────────────────────────────────────────────────

/**
 * Classify an error or failed output into one of the four error types.
 *
 * @param {Error|string}  error   - Thrown error or error message
 * @param {*}             output  - The agent output that failed verification
 * @param {object}        [context] - Additional context about the task
 * @returns {string} One of ERROR_TYPE values
 */
function classifyError(error, output, context = {}) {
  const msg = (error?.message ?? String(error)).toLowerCase();

  // Syntax: JSON, schema, format errors
  if (
    msg.includes('json') ||
    msg.includes('parse') ||
    msg.includes('syntax') ||
    msg.includes('schema') ||
    msg.includes('unexpected token') ||
    msg.includes('invalid format')
  ) {
    return ERROR_TYPE.SYNTAX;
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline')) {
    return ERROR_TYPE.TIMEOUT;
  }

  // Incomplete: missing fields, partial output
  if (
    msg.includes('incomplete') ||
    msg.includes('missing') ||
    msg.includes('required field') ||
    msg.includes('partial') ||
    (output && typeof output === 'object' && Object.keys(output).length === 0)
  ) {
    return ERROR_TYPE.INCOMPLETE;
  }

  // Hallucination: citation errors, confidence flags
  if (
    msg.includes('hallucination') ||
    msg.includes('fabricat') ||
    msg.includes('citation') ||
    msg.includes('unverified') ||
    context.hallucinationDetected === true
  ) {
    return ERROR_TYPE.HALLUCINATION;
  }

  // Logic: reasoning failures
  if (
    msg.includes('logic') ||
    msg.includes('incorrect') ||
    msg.includes('wrong answer') ||
    msg.includes('assertion failed') ||
    msg.includes('expected') // common in test output
  ) {
    return ERROR_TYPE.LOGIC;
  }

  return ERROR_TYPE.UNKNOWN;
}

// ─── Correction Strategies ────────────────────────────────────────────────────

/**
 * Build a correction prompt for a given error type.
 * @param {string} errorType - One of ERROR_TYPE
 * @param {object} opts
 * @param {string}   opts.originalPrompt  - The original task prompt
 * @param {*}        opts.failedOutput    - The output that failed
 * @param {string}   opts.verificationMsg - Verification failure message
 * @param {object[]} [opts.patterns]      - Similar past correction patterns
 * @returns {string} Corrective prompt to send to the agent
 */
function buildCorrectionPrompt(errorType, opts) {
  const { originalPrompt, failedOutput, verificationMsg, patterns = [] } = opts;

  const patternHint = patterns.length > 0
    ? `\n\nRelevant past correction patterns:\n${patterns.slice(0, 3).map(p =>
        `- Error: "${p.errorType}" | Fix: "${p.correctionSummary}"`
      ).join('\n')}`
    : '';

  const strategies = {
    [ERROR_TYPE.SYNTAX]: `
Your previous output had a FORMAT ERROR:
  ${verificationMsg}

Failed output:
${JSON.stringify(failedOutput, null, 2)}

Please re-attempt the task and ensure your output:
  1. Is valid JSON (if JSON was requested)
  2. Matches the required schema exactly
  3. Contains no trailing commas or syntax errors

Original task:
${originalPrompt}
${patternHint}`,

    [ERROR_TYPE.LOGIC]: `
Your previous output had a LOGIC ERROR:
  ${verificationMsg}

Failed output:
${JSON.stringify(failedOutput, null, 2)}

Please re-attempt the task. Before producing output:
  1. Re-read the task requirements carefully
  2. Walk through your reasoning step-by-step
  3. Verify each logical step is sound
  4. Double-check your final answer against the requirements

Original task:
${originalPrompt}
${patternHint}`,

    [ERROR_TYPE.HALLUCINATION]: `
Your previous output contained HALLUCINATED or UNVERIFIED CONTENT:
  ${verificationMsg}

Failed output:
${JSON.stringify(failedOutput, null, 2)}

Please re-attempt the task. Rules:
  1. ONLY include facts you are highly confident about
  2. If uncertain, say "I am uncertain about X" rather than asserting
  3. Do not invent citations, URLs, names, or numbers
  4. Mark any estimates clearly as estimates

Original task:
${originalPrompt}
${patternHint}`,

    [ERROR_TYPE.INCOMPLETE]: `
Your previous output was INCOMPLETE:
  ${verificationMsg}

Failed output:
${JSON.stringify(failedOutput, null, 2)}

Please re-attempt the task and ensure:
  1. ALL required sections/fields are present
  2. No sections are left as placeholders like "TODO" or "..."
  3. Your response fully addresses every part of the original task
  4. Minimum length requirements are met if specified

Original task:
${originalPrompt}
${patternHint}`,

    [ERROR_TYPE.TIMEOUT]: `
Your previous attempt TIMED OUT. This usually means the task needs to be scoped more narrowly.

Please re-attempt with the following adjustments:
  1. Focus on the most critical aspects first
  2. Be more concise in your response
  3. If the task is large, complete the most important 80% first

Original task:
${originalPrompt}
${patternHint}`,

    [ERROR_TYPE.UNKNOWN]: `
Your previous output did not pass verification:
  ${verificationMsg}

Failed output:
${JSON.stringify(failedOutput, null, 2)}

Please re-attempt the task, carefully reviewing the requirements.

Original task:
${originalPrompt}
${patternHint}`,
  };

  return (strategies[errorType] ?? strategies[ERROR_TYPE.UNKNOWN]).trim();
}

// ─── PatternStore ─────────────────────────────────────────────────────────────

/**
 * In-memory store for correction patterns. Enables learning from past corrections.
 */
class PatternStore {
  /**
   * @param {number} maxSize - Maximum patterns to retain
   */
  constructor(maxSize = DEFAULTS.PATTERN_STORE_MAX) {
    this._patterns = [];
    this._maxSize = maxSize;
    /** @type {Map<string, number>} Error type → success rate */
    this._successRates = new Map();
  }

  /**
   * Store a correction pattern for future reference.
   * @param {object} pattern
   * @param {string} pattern.errorType
   * @param {string} pattern.taskDomain
   * @param {string} pattern.correctionSummary
   * @param {boolean} pattern.succeeded
   * @param {number} pattern.iterationsRequired
   */
  store(pattern) {
    const entry = {
      ...pattern,
      id:         randomUUID(),
      storedAt:   new Date().toISOString(),
    };

    this._patterns.unshift(entry); // newest first

    // Enforce max size (FIFO eviction of oldest)
    if (this._patterns.length > this._maxSize) {
      this._patterns = this._patterns.slice(0, this._maxSize);
    }

    // Update success rate
    const current = this._successRates.get(pattern.errorType) ?? { success: 0, total: 0 };
    this._successRates.set(pattern.errorType, {
      success: current.success + (pattern.succeeded ? 1 : 0),
      total:   current.total + 1,
    });
  }

  /**
   * Find similar patterns to a given error type and domain.
   * @param {string} errorType
   * @param {string} [domain]
   * @param {number} [topK=5]
   * @returns {object[]}
   */
  findSimilar(errorType, domain, topK = 5) {
    return this._patterns
      .filter(p => p.errorType === errorType && (!domain || p.taskDomain === domain))
      .slice(0, topK);
  }

  /**
   * Get correction success rate for an error type.
   * @param {string} errorType
   * @returns {number} Success rate [0, 1]
   */
  getSuccessRate(errorType) {
    const stats = this._successRates.get(errorType);
    if (!stats || stats.total === 0) return 0;
    return stats.success / stats.total;
  }

  /**
   * Export a summary of stored patterns for analytics.
   * @returns {object}
   */
  getSummary() {
    const summary = { totalPatterns: this._patterns.length, byErrorType: {} };
    for (const [type, stats] of this._successRates) {
      summary.byErrorType[type] = {
        ...stats,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) / 100 : 0,
      };
    }
    return summary;
  }
}

// ─── SelfCorrectionLoop ───────────────────────────────────────────────────────

/**
 * @class SelfCorrectionLoop
 *
 * Wraps an agent execution function in an execute-verify-correct cycle.
 *
 * Usage:
 * ```js
 * const loop = new SelfCorrectionLoop({
 *   executeFn: async (prompt) => await myAgent.run(prompt),
 *   verifyFn:  async (output) => output.score > 0.8,
 *   llmJudgeFn: async (output, task) => ({ pass: true, feedback: '...' }),
 * });
 *
 * const result = await loop.run({
 *   id:          'task-123',
 *   prompt:      'Generate a structured JSON report...',
 *   domain:      'coding',
 * });
 * ```
 *
 * @fires SelfCorrectionLoop#iteration:start
 * @fires SelfCorrectionLoop#iteration:verified
 * @fires SelfCorrectionLoop#iteration:corrected
 * @fires SelfCorrectionLoop#loop:completed
 * @fires SelfCorrectionLoop#loop:escalated
 * @fires SelfCorrectionLoop#loop:timeout
 */
class SelfCorrectionLoop extends EventEmitter {
  /**
   * @param {object}   opts
   * @param {Function} opts.executeFn          - Async fn(prompt, context) → output
   * @param {Function} [opts.verifyFn]         - Async fn(output, task) → boolean | {pass, score, message}
   * @param {Function} [opts.llmJudgeFn]       - Async fn(output, task) → {pass, score, feedback}
   * @param {object[]} [opts.assertions]        - Array of { name, fn: async (output) → boolean }
   * @param {number}   [opts.maxIterations]     - Max correction iterations (default: 4)
   * @param {number}   [opts.iterationTimeout]  - Ms per iteration (default: 30_000)
   * @param {number}   [opts.totalTimeout]      - Ms for entire loop (default: 120_000)
   * @param {number}   [opts.circuitThreshold]  - Consecutive failures before circuit trip
   * @param {number}   [opts.minQualityScore]   - Minimum acceptable quality score [0,1]
   * @param {PatternStore} [opts.patternStore]  - Shared pattern store (or creates own)
   */
  constructor(opts = {}) {
    super();
    this.setMaxListeners(50);

    this._executeFn        = opts.executeFn;
    this._verifyFn         = opts.verifyFn         ?? null;
    this._llmJudgeFn       = opts.llmJudgeFn       ?? null;
    this._assertions       = opts.assertions       ?? [];
    this._maxIterations    = opts.maxIterations    ?? DEFAULTS.MAX_ITERATIONS;
    this._iterationTimeout = opts.iterationTimeout ?? DEFAULTS.ITERATION_TIMEOUT;
    this._totalTimeout     = opts.totalTimeout     ?? DEFAULTS.TOTAL_TIMEOUT;
    this._circuitThreshold = opts.circuitThreshold ?? DEFAULTS.CIRCUIT_THRESHOLD;
    this._minQualityScore  = opts.minQualityScore  ?? DEFAULTS.MIN_QUALITY_SCORE;
    this._patternStore     = opts.patternStore     ?? new PatternStore();

    /** Circuit breaker state */
    this._circuit = {
      state:          'closed',   // closed | open | half-open
      consecutiveFails: 0,
      lastOpenedAt:   null,
      RECOVERY_MS:    DEFAULTS.CIRCUIT_RECOVERY,
    };

    if (!this._executeFn) {
      throw new Error('[SelfCorrectionLoop] opts.executeFn is required');
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Run the execute-verify-correct cycle for a given task.
   *
   * @param {object}  task
   * @param {string}  task.id           - Unique task identifier
   * @param {string}  task.prompt       - Prompt / instructions for the agent
   * @param {string}  [task.domain]     - Domain hint for pattern matching
   * @param {object}  [task.context]    - Additional execution context
   * @param {boolean} [task.strict]     - If true, escalate on first failure after max iters
   * @returns {Promise<object>} Correction run result
   */
  async run(task) {
    const runId     = randomUUID();
    const startedAt = Date.now();
    const taskId    = task.id ?? randomUUID();

    // Circuit breaker check
    if (this._circuit.state === 'open') {
      const elapsed = Date.now() - this._circuit.lastOpenedAt;
      if (elapsed < this._circuit.RECOVERY_MS) {
        throw new Error(`[SelfCorrectionLoop] Circuit breaker OPEN — refusing task ${taskId}`);
      }
      this._circuit.state = 'half-open';
    }

    const runRecord = {
      runId,
      taskId,
      domain:     task.domain ?? 'unknown',
      iterations: [],
      outcome:    null,
      finalOutput: null,
      qualityScore: 0,
      totalMs:    0,
      escalated:  false,
    };

    let currentPrompt = task.prompt;
    let lastOutput    = null;
    let lastError     = null;

    // Total timeout guard
    const totalDeadline = Date.now() + this._totalTimeout;

    for (let iter = 0; iter < this._maxIterations; iter++) {
      if (Date.now() >= totalDeadline) {
        this.emit('loop:timeout', { taskId, runId, iteration: iter });
        runRecord.outcome    = CORRECTION_OUTCOME.ESCALATED;
        runRecord.escalated  = true;
        break;
      }

      /**
       * @event SelfCorrectionLoop#iteration:start
       */
      this.emit('iteration:start', { taskId, runId, iteration: iter });

      const iterRecord = {
        index:      iter,
        startMs:    Date.now(),
        errorType:  null,
        verifyResult: null,
        qualityScore: 0,
        correctionApplied: false,
        outcome:    null,
      };

      // ── Execute ──────────────────────────────────────────────────────────
      try {
        lastOutput = await this._withTimeout(
          this._executeFn(currentPrompt, task.context ?? {}),
          this._iterationTimeout
        );
        lastError  = null;
      } catch (err) {
        lastError  = err;
        lastOutput = null;
        iterRecord.errorType = err.message?.includes('timeout')
          ? ERROR_TYPE.TIMEOUT
          : classifyError(err, null, task.context);
      }

      // ── Verify ───────────────────────────────────────────────────────────
      const verification = await this._verify(lastOutput, task, lastError);
      iterRecord.verifyResult  = verification.result;
      iterRecord.qualityScore  = verification.score ?? 0;

      /**
       * @event SelfCorrectionLoop#iteration:verified
       */
      this.emit('iteration:verified', {
        taskId, runId, iteration: iter,
        result:  verification.result,
        score:   verification.score,
        message: verification.message,
      });

      // ── Pass? ─────────────────────────────────────────────────────────────
      if (verification.result === VERIFY_RESULT.PASS) {
        runRecord.outcome      = CORRECTION_OUTCOME.FIXED;
        runRecord.finalOutput  = lastOutput;
        runRecord.qualityScore = verification.score ?? 1.0;
        iterRecord.outcome     = CORRECTION_OUTCOME.FIXED;
        runRecord.iterations.push(iterRecord);

        this._recordPattern(task, iterRecord, true, iter + 1);
        this._circuit.consecutiveFails = 0;
        if (this._circuit.state === 'half-open') this._circuit.state = 'closed';
        break;
      }

      // ── Classify & Correct ────────────────────────────────────────────────
      const errorType = iterRecord.errorType
        ?? classifyError(
            new Error(verification.message ?? 'verification failed'),
            lastOutput,
            task.context
          );
      iterRecord.errorType = errorType;

      const similarPatterns = this._patternStore.findSimilar(errorType, task.domain);
      const correctionPrompt = buildCorrectionPrompt(errorType, {
        originalPrompt:  task.prompt,
        failedOutput:    lastOutput,
        verificationMsg: verification.message ?? 'Output did not meet quality threshold',
        patterns:        similarPatterns,
      });

      currentPrompt             = correctionPrompt;
      iterRecord.correctionApplied = true;
      iterRecord.outcome        = CORRECTION_OUTCOME.IMPROVED;

      /**
       * @event SelfCorrectionLoop#iteration:corrected
       */
      this.emit('iteration:corrected', {
        taskId, runId, iteration: iter,
        errorType,
        correctionLength: correctionPrompt.length,
      });

      runRecord.iterations.push(iterRecord);
    }

    // ── Final State ─────────────────────────────────────────────────────────
    if (runRecord.outcome === null) {
      // Exhausted iterations without passing
      runRecord.outcome    = task.strict ? CORRECTION_OUTCOME.ESCALATED : CORRECTION_OUTCOME.NO_CHANGE;
      runRecord.escalated  = task.strict;
      runRecord.finalOutput = lastOutput; // best effort
      this._circuit.consecutiveFails++;

      if (this._circuit.consecutiveFails >= this._circuitThreshold) {
        this._circuit.state      = 'open';
        this._circuit.lastOpenedAt = Date.now();
        this.emit('circuit:opened', { taskId, runId });
      }

      /**
       * @event SelfCorrectionLoop#loop:escalated
       */
      this.emit('loop:escalated', {
        taskId, runId,
        iterations: runRecord.iterations.length,
        lastErrorType: runRecord.iterations.at(-1)?.errorType ?? ERROR_TYPE.UNKNOWN,
      });

      this._recordPattern(task, runRecord.iterations.at(-1), false, this._maxIterations);
    }

    runRecord.totalMs = Date.now() - startedAt;

    /**
     * @event SelfCorrectionLoop#loop:completed
     */
    this.emit('loop:completed', {
      taskId,
      runId,
      outcome:      runRecord.outcome,
      iterations:   runRecord.iterations.length,
      qualityScore: runRecord.qualityScore,
      totalMs:      runRecord.totalMs,
    });

    return runRecord;
  }

  /**
   * Access the underlying pattern store (for cross-loop sharing or persistence).
   * @returns {PatternStore}
   */
  get patternStore() {
    return this._patternStore;
  }

  /**
   * Get circuit breaker status.
   * @returns {object}
   */
  get circuitStatus() {
    return {
      state:            this._circuit.state,
      consecutiveFails: this._circuit.consecutiveFails,
      lastOpenedAt:     this._circuit.lastOpenedAt,
    };
  }

  /**
   * Reset the circuit breaker manually.
   */
  resetCircuit() {
    this._circuit.state           = 'closed';
    this._circuit.consecutiveFails = 0;
    this._circuit.lastOpenedAt    = null;
  }

  // ─── Verification ──────────────────────────────────────────────────────────

  /**
   * Run all verification layers and return a combined result.
   * Priority: assertion fns → custom verifyFn → LLM judge
   * @private
   * @returns {Promise<{result: string, score: number, message: string}>}
   */
  async _verify(output, task, executionError) {
    // If execution itself threw, it's an automatic fail
    if (executionError) {
      return {
        result:  VERIFY_RESULT.FAIL,
        score:   0,
        message: executionError.message,
      };
    }

    if (output == null) {
      return { result: VERIFY_RESULT.FAIL, score: 0, message: 'Output is null or undefined' };
    }

    // 1. Run assertion functions
    if (this._assertions.length > 0) {
      const results = await Promise.allSettled(
        this._assertions.map(async a => {
          const pass = await a.fn(output);
          return { name: a.name, pass };
        })
      );
      const failures = results
        .filter(r => r.status === 'fulfilled' && !r.value.pass)
        .map(r => r.value.name);
      if (failures.length > 0) {
        return {
          result:  VERIFY_RESULT.FAIL,
          score:   1 - (failures.length / this._assertions.length),
          message: `Assertion failures: ${failures.join(', ')}`,
        };
      }
    }

    // 2. Custom verify function
    if (this._verifyFn) {
      try {
        const vResult = await this._withTimeout(
          this._verifyFn(output, task),
          this._iterationTimeout
        );

        if (typeof vResult === 'boolean') {
          return {
            result:  vResult ? VERIFY_RESULT.PASS : VERIFY_RESULT.FAIL,
            score:   vResult ? 1.0 : 0.0,
            message: vResult ? 'Verification passed' : 'Verification function returned false',
          };
        }

        if (typeof vResult === 'object' && vResult !== null) {
          const score = vResult.score ?? (vResult.pass ? 1.0 : 0.0);
          return {
            result:  score >= this._minQualityScore ? VERIFY_RESULT.PASS : VERIFY_RESULT.FAIL,
            score,
            message: vResult.message ?? (vResult.pass ? 'Pass' : 'Fail'),
          };
        }
      } catch (err) {
        return { result: VERIFY_RESULT.FAIL, score: 0, message: `Verify function threw: ${err.message}` };
      }
    }

    // 3. LLM judge
    if (this._llmJudgeFn) {
      try {
        const judgment = await this._withTimeout(
          this._llmJudgeFn(output, task),
          this._iterationTimeout
        );
        const score = judgment.score ?? (judgment.pass ? 1.0 : 0.0);
        return {
          result:  score >= this._minQualityScore ? VERIFY_RESULT.PASS : VERIFY_RESULT.FAIL,
          score,
          message: judgment.feedback ?? judgment.message ?? 'LLM judge result',
        };
      } catch (err) {
        return { result: VERIFY_RESULT.INCONCLUSIVE, score: 0, message: `LLM judge error: ${err.message}` };
      }
    }

    // No verifiers configured → optimistic pass
    return { result: VERIFY_RESULT.PASS, score: 1.0, message: 'No verifiers configured — optimistic pass' };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Record a correction pattern in the pattern store.
   * @private
   */
  _recordPattern(task, iterRecord, succeeded, iterationsRequired) {
    if (!iterRecord) return;
    this._patternStore.store({
      errorType:           iterRecord.errorType ?? ERROR_TYPE.UNKNOWN,
      taskDomain:          task.domain ?? 'unknown',
      correctionSummary:   `${iterRecord.errorType} corrected in ${iterationsRequired} iterations`,
      succeeded,
      iterationsRequired,
    });
  }

  /**
   * Wrap a promise with a timeout.
   * @private
   * @param {Promise<*>} promise
   * @param {number}     ms
   * @returns {Promise<*>}
   */
  _withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[SelfCorrectionLoop] Operation timed out after ${ms}ms`));
      }, ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }
}

// ─── Factory Helper ───────────────────────────────────────────────────────────

/**
 * Create a SelfCorrectionLoop pre-configured for a specific error type strategy.
 *
 * Quality thresholds and max-iteration counts are phi-derived:
 *
 *   syntax:
 *     minQualityScore = CSL_THRESHOLDS.CRITICAL ≈ 0.927  (was 0.95 — arbitrary)
 *     maxIterations   = fib(4) = 3  (was 3 — coincidentally correct but undocumented)
 *     Rationale: syntax errors need near-perfect format compliance.
 *
 *   logic:
 *     minQualityScore = CSL_THRESHOLDS.MEDIUM ≈ 0.809  (was 0.80 — arbitrary)
 *     maxIterations   = fib(5) = 5  (was 4 — now one Fibonacci step higher)
 *     Rationale: reasoning errors tolerate moderate quality, need more iterations.
 *
 *   hallucination:
 *     minQualityScore = CSL_THRESHOLDS.HIGH ≈ 0.882  (was 0.90 — arbitrary)
 *     maxIterations   = fib(4) = 3  (was 3 — preserved)
 *     Rationale: factual accuracy requires strong alignment, limited retries.
 *
 *   incomplete:
 *     minQualityScore = phiThreshold(2.5) ≈ 0.843  (was 0.85 — close but arbitrary)
 *     maxIterations   = fib(3) = 2  (was 2 — preserved)
 *     Rationale: missing content can be patched quickly; phi mid-level quality.
 *
 * @param {string}   errorTypeHint - Dominant error type to optimize for
 * @param {object}   opts          - Base options (same as SelfCorrectionLoop constructor)
 * @returns {SelfCorrectionLoop}
 */
function createCorrectionLoop(errorTypeHint, opts = {}) {
  const strategyDefaults = {
    [ERROR_TYPE.SYNTAX]: {
      maxIterations:   fib(4),                    // = 3  (was 3)
      minQualityScore: CSL_THRESHOLDS.CRITICAL,   // ≈ 0.927  (was 0.95)
    },
    [ERROR_TYPE.LOGIC]: {
      maxIterations:   fib(5),                    // = 5  (was 4)
      minQualityScore: CSL_THRESHOLDS.MEDIUM,     // ≈ 0.809  (was 0.80)
    },
    [ERROR_TYPE.HALLUCINATION]: {
      maxIterations:   fib(4),                    // = 3  (was 3)
      minQualityScore: CSL_THRESHOLDS.HIGH,       // ≈ 0.882  (was 0.90)
    },
    [ERROR_TYPE.INCOMPLETE]: {
      maxIterations:   fib(3),                    // = 2  (was 2)
      /**
       * phiThreshold(2.5) = 1 - ψ^2.5 × 0.5 ≈ 0.843
       * Interpolates between MEDIUM (0.809) and HIGH (0.882).
       * Was 0.85 — now exactly anchored in the phi-harmonic scale.
       */
      minQualityScore: phiThreshold(2.5),         // ≈ 0.843  (was 0.85)
    },
  };

  const merged = {
    ...(strategyDefaults[errorTypeHint] ?? {}),
    ...opts,
  };

  return new SelfCorrectionLoop(merged);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  SelfCorrectionLoop,
  PatternStore,
  ERROR_TYPE,
  CORRECTION_OUTCOME,
  VERIFY_RESULT,
  classifyError,
  buildCorrectionPrompt,
  createCorrectionLoop,
  DEFAULTS as SELF_CORRECTION_DEFAULTS,
};

export default SelfCorrectionLoop;

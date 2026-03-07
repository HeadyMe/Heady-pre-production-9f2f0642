'use strict';

/**
 * HeadyGuard — Pipeline Engine
 *
 * Registers filter stages and executes them in priority order.
 * Stages may run serially or in parallel (for independent checks).
 *
 * Result shape:
 * {
 *   allowed:        boolean,
 *   risk_score:     number,     // 0-100, aggregated
 *   flags:          string[],   // warning labels from FLAG stages
 *   blocked_by:     string|null, // stage name that issued BLOCK
 *   processing_time: number,    // total ms
 *   stage_results:  object,     // keyed by stage name
 *   redactedText:   string|null // if PII redaction was active
 * }
 */

const config = require('./config');

// ── Stage registry ────────────────────────────────────────────────────────────

const _registry = new Map(); // stageName → { runner, priority, parallel }

/**
 * Register a filter stage.
 *
 * @param {string}   name     — unique stage name (must match runner's STAGE_NAME)
 * @param {Function} runner   — async (payload, stageConfig) => stageResult
 * @param {number}   priority — lower number = runs first (default 50)
 * @param {boolean}  parallel — can run in parallel with other parallel stages
 */
function registerStage(name, runner, priority = 50, parallel = false) {
  if (typeof runner !== 'function') {
    throw new TypeError(`HeadyGuard: stage runner for "${name}" must be a function`);
  }
  _registry.set(name, { name, runner, priority, parallel });
}

/**
 * Deregister a stage (mainly for testing).
 */
function deregisterStage(name) {
  _registry.delete(name);
}

/**
 * Get registered stage names in priority order.
 */
function getStageNames() {
  return [..._registry.values()]
    .sort((a, b) => a.priority - b.priority)
    .map(s => s.name);
}

// ── Score aggregation (Sacred Geometry weighting) ────────────────────────────
// Later (higher-priority) stage results are weighted by PHI^(position/total)
// so that high-confidence detection near the end of the pipeline has more pull.

const PHI = config.phi; // 1.618

function _aggregateRiskScores(stageResults, stageOrder) {
  if (stageOrder.length === 0) return 0;
  const n = stageOrder.length;
  let weightedSum  = 0;
  let totalWeight  = 0;

  stageOrder.forEach((name, idx) => {
    const result = stageResults[name];
    if (!result) return;
    const baseWeight = 1 + (idx / n) * (PHI - 1); // 1.0 → 1.618 over the stages
    weightedSum  += result.riskScore * baseWeight;
    totalWeight  += baseWeight;
  });

  if (totalWeight === 0) return 0;
  return Math.round(Math.min(100, weightedSum / totalWeight));
}

// ── Stage execution ───────────────────────────────────────────────────────────

/**
 * Run a single stage with a timeout.
 *
 * @param {object}   stageEntry   — { name, runner, priority }
 * @param {object}   payload
 * @param {object}   pipelineCfg
 * @returns {Promise<object>}     — stage result
 */
async function _runStage(stageEntry, payload, pipelineCfg) {
  const timeoutMs = pipelineCfg.stageTimeoutMs || config.stageTimeoutMs;
  const stageConfig = {
    blockThreshold: pipelineCfg.blockThreshold || config.blockThreshold,
    flagThreshold:  pipelineCfg.flagThreshold  || config.flagThreshold,
    piiMode:        pipelineCfg.piiMode        || config.piiMode,
    piiRedactionStrategy: pipelineCfg.piiRedactionStrategy || config.piiRedactionStrategy,
    toxicity:       pipelineCfg.toxicity       || config.toxicity,
    rateLimit:      pipelineCfg.rateLimit      || config.rateLimit,
    ...(pipelineCfg.stageOverrides?.[stageEntry.name] || {}),
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Stage "${stageEntry.name}" timed out after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const result = await Promise.race([
      stageEntry.runner(payload, stageConfig),
      timeout,
    ]);
    return result;
  } catch (err) {
    // Stage errors are non-fatal — treated as PASS with a warning
    return {
      stage:     stageEntry.name,
      action:    'PASS',
      riskScore: 0,
      confidence: 0,
      findings:  [],
      meta:      { error: err.message, timedOut: err.message.includes('timed out') },
    };
  }
}

// ── Pipeline execution ────────────────────────────────────────────────────────

/**
 * Run the pipeline against a payload.
 *
 * @param {object} payload       — { text, output, userId, tokens, context, type }
 * @param {object} pipelineCfg   — pipeline-level config overrides
 * @returns {Promise<object>}    — pipeline result
 */
async function run(payload, pipelineCfg = {}) {
  const start = Date.now();

  // Which stages to run?
  const enabledNames = pipelineCfg.stages || config.stages;
  const parallelNames = new Set(pipelineCfg.parallelStages || config.parallelStages);

  // Get ordered stages filtered to enabled
  const orderedStages = [..._registry.values()]
    .sort((a, b) => a.priority - b.priority)
    .filter(s => enabledNames.includes(s.name));

  const stageResults = {};
  const flags        = [];
  let   blockedBy    = null;
  let   redactedText = null;

  // Group into serial runs and parallel batches:
  // Parallel stages are collected, run together as a batch, then serial stages continue.
  // For simplicity, we run non-parallel stages serially; collect all parallel stages
  // into one concurrent batch that runs together.

  const serialStages   = orderedStages.filter(s => !parallelNames.has(s.name));
  const parallelStages = orderedStages.filter(s =>  parallelNames.has(s.name));

  // ── Parallel batch (independent checks) ────────────────────────────────────
  if (parallelStages.length > 0) {
    const parallelResults = await Promise.all(
      parallelStages.map(s => _runStage(s, payload, pipelineCfg))
    );
    for (const result of parallelResults) {
      stageResults[result.stage] = result;
      if (result.action === 'FLAG') {
        flags.push(...result.findings.map(f => f.label).filter(Boolean));
      }
      if (result.action === 'BLOCK' && !blockedBy) {
        blockedBy = result.stage;
      }
    }
  }

  // ── Serial stages ───────────────────────────────────────────────────────────
  for (const stageEntry of serialStages) {
    if (blockedBy) break; // Short-circuit on BLOCK

    const result = await _runStage(stageEntry, payload, pipelineCfg);
    stageResults[result.stage] = result;

    if (result.action === 'FLAG') {
      flags.push(...result.findings.map(f => f.label).filter(Boolean));
    }
    if (result.action === 'BLOCK') {
      blockedBy = result.stage;
      break;
    }
    // Carry forward redacted text from PII stage
    if (result.stage === 'pii' && result.redactedText !== undefined) {
      redactedText = result.redactedText;
    }
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const executedOrder = orderedStages.map(s => s.name).filter(n => n in stageResults);
  const riskScore     = _aggregateRiskScores(stageResults, executedOrder);
  const processingTime = Date.now() - start;

  // Final allow/block decision
  const blockThreshold = pipelineCfg.blockThreshold || config.blockThreshold;
  const allowed = !blockedBy && riskScore < blockThreshold;

  return {
    allowed,
    risk_score:      riskScore,
    flags:           [...new Set(flags)],
    blocked_by:      blockedBy || null,
    processing_time: processingTime,
    stage_results:   stageResults,
    redactedText:    redactedText || null,
  };
}

// ── Auto-registration of built-in stages ─────────────────────────────────────

function loadBuiltinStages() {
  const stages = [
    { name: 'injection',       path: './filters/injection-detector', priority: 10, parallel: false },
    { name: 'pii',             path: './filters/pii-detector',       priority: 20, parallel: false },
    { name: 'rate_limit',      path: './filters/rate-limiter',       priority: 25, parallel: false },
    { name: 'toxicity',        path: './filters/toxicity-scorer',    priority: 30, parallel: true  },
    { name: 'topic',           path: './filters/topic-filter',       priority: 40, parallel: true  },
    { name: 'output_validator',path: './filters/output-validator',   priority: 50, parallel: false },
  ];

  for (const { name, path, priority, parallel } of stages) {
    try {
      const mod = require(path);
      registerStage(name, mod.run, priority, parallel);
    } catch (err) {
      console.error(`[HeadyGuard] Failed to load stage "${name}": ${err.message}`);
    }
  }
}

module.exports = {
  run,
  registerStage,
  deregisterStage,
  getStageNames,
  loadBuiltinStages,
  _aggregateRiskScores,
};

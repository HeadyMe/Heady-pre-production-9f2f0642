'use strict';

/**
 * HeadyGuard — Main Pipeline Entry Point
 *
 * Architecture:
 *   Input → [Rules Pre-check] → [Filter Stages] → [Rules Post-check] → Audit Log → Result
 *
 * Fast path:
 *   Very short inputs or inputs matching known-safe patterns skip expensive
 *   stages (toxicity, topic) to minimise latency.
 *
 * Usage:
 *   const guard = require('./heady-guard');
 *   await guard.initialize();
 *   const result = await guard.check({ text, userId });
 */

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const config   = require('./config');
const pipeline = require('./pipeline');
const rules    = require('./rules');

// ── Audit log ─────────────────────────────────────────────────────────────────

const _auditLog = [];   // ring buffer (capped at config.auditMemoryLimit)
let   _auditStream = null;

function _writeAudit(entry) {
  // Memory buffer (ring)
  _auditLog.push(entry);
  if (_auditLog.length > config.auditMemoryLimit) _auditLog.shift();

  // File sink (if configured)
  if (_auditStream) {
    try {
      _auditStream.write(JSON.stringify(entry) + '\n');
    } catch (err) {
      // Non-fatal
    }
  }
}

function _openAuditStream() {
  if (!config.auditLogPath) return;
  try {
    _auditStream = fs.createWriteStream(config.auditLogPath, { flags: 'a' });
    _auditStream.on('error', err => {
      console.error(`[HeadyGuard] Audit log write error: ${err.message}`);
    });
  } catch (err) {
    console.error(`[HeadyGuard] Cannot open audit log "${config.auditLogPath}": ${err.message}`);
  }
}

// ── Statistics ────────────────────────────────────────────────────────────────

const _stats = {
  total:     0,
  allowed:   0,
  blocked:   0,
  flagged:   0,
  startTime: Date.now(),
  stageHits: {},   // stageName → count of non-PASS results
};

function _updateStats(result) {
  _stats.total++;
  if (!result.allowed) _stats.blocked++;
  else if (result.flags.length > 0) _stats.flagged++;
  else _stats.allowed++;

  for (const [stage, sr] of Object.entries(result.stage_results || {})) {
    if (sr.action !== 'PASS') {
      _stats.stageHits[stage] = (_stats.stageHits[stage] || 0) + 1;
    }
  }
}

function getStats() {
  return {
    ..._stats,
    uptime_ms: Date.now() - _stats.startTime,
    block_rate:  _stats.total > 0 ? (_stats.blocked  / _stats.total).toFixed(4) : '0.0000',
    flag_rate:   _stats.total > 0 ? (_stats.flagged   / _stats.total).toFixed(4) : '0.0000',
    allow_rate:  _stats.total > 0 ? (_stats.allowed   / _stats.total).toFixed(4) : '0.0000',
  };
}

// ── Fast-path heuristics ──────────────────────────────────────────────────────

// Skip expensive stages for very short or clearly safe inputs
const FAST_PATH_MAX_LEN = 10;    // single word or emoji
const FAST_PATH_PATTERNS = [
  /^(yes|no|ok|okay|sure|thanks?|hi|hello|bye|great|good|cool|nice|awesome|help)\b/i,
  /^[\d\s\.,!?]+$/, // only numbers/punctuation
];

function _isFastPath(text) {
  if (!text || text.length < FAST_PATH_MAX_LEN) return true;
  return FAST_PATH_PATTERNS.some(re => re.test(text.trim()));
}

// ── Core check function ───────────────────────────────────────────────────────

/**
 * Check a payload through the HeadyGuard pipeline.
 *
 * @param {object} payload
 * @param {string} payload.text       — input text to check
 * @param {string} [payload.output]   — LLM output to check (for output validation)
 * @param {string} [payload.userId]   — user identifier (for rate limiting)
 * @param {number} [payload.tokens]   — token count (for token rate limiting)
 * @param {string} [payload.source]   — 'input' | 'output' (default: 'input')
 * @param {object} [payload.context]  — additional context
 * @param {object} [pipelineCfg]      — per-request config overrides
 *
 * @returns {Promise<{
 *   requestId:       string,
 *   allowed:         boolean,
 *   risk_score:      number,
 *   flags:           string[],
 *   blocked_by:      string|null,
 *   processing_time: number,
 *   stage_results:   object,
 *   redactedText:    string|null,
 *   rules_matched:   string[],
 *   timestamp:       string,
 * }>}
 */
async function check(payload, pipelineCfg = {}) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date().toISOString();
  const start     = Date.now();

  const text   = payload.text   || '';
  const output = payload.output || '';
  const source = payload.source || 'input';

  // ── Rules pre-check ──────────────────────────────────────────────────────
  const rulesPayload = { ...payload, source };
  const rulesResult  = rules.evaluate(rulesPayload);

  // Hard allow from rules — skip pipeline entirely
  if (rulesResult.allowOverride) {
    const result = {
      requestId,
      allowed:         true,
      risk_score:      0,
      flags:           [],
      blocked_by:      null,
      processing_time: Date.now() - start,
      stage_results:   {},
      redactedText:    null,
      rules_matched:   rulesResult.matchedRules,
      timestamp,
    };
    _updateStats(result);
    _writeAudit({ ...result, text: text.slice(0, 100), userId: payload.userId });
    return result;
  }

  // Hard block from rules — skip pipeline
  if (rulesResult.action === 'BLOCK') {
    const result = {
      requestId,
      allowed:         false,
      risk_score:      100,
      flags:           [],
      blocked_by:      `rule:${rulesResult.matchedRules[rulesResult.matchedRules.length - 1]}`,
      block_message:   rulesResult.blockMessage,
      processing_time: Date.now() - start,
      stage_results:   {},
      redactedText:    null,
      rules_matched:   rulesResult.matchedRules,
      timestamp,
    };
    _updateStats(result);
    _writeAudit({ ...result, text: text.slice(0, 100), userId: payload.userId });
    return result;
  }

  // ── Determine effective stage list ────────────────────────────────────────
  let effectiveStages = pipelineCfg.stages || config.stages;

  // Fast path: skip expensive stages for trivially safe inputs
  if (_isFastPath(text) && source === 'input' && !output) {
    effectiveStages = effectiveStages.filter(s => ['injection', 'rate_limit'].includes(s));
  }

  // Output-only check: skip input-focused stages
  if (source === 'output' && !text && output) {
    effectiveStages = effectiveStages.filter(s => s === 'output_validator');
  }

  // ── Pipeline execution ────────────────────────────────────────────────────
  const pipelineResult = await pipeline.run(
    { ...payload, source },
    { ...pipelineCfg, stages: effectiveStages }
  );

  // ── Rules post-check (with stage results context) ─────────────────────────
  const postRulesResult = rules.evaluate(
    { ...rulesPayload, stageResults: pipelineResult.stage_results }
  );

  // Merge rule flags / score into pipeline result
  const mergedFlags = [
    ...pipelineResult.flags,
    ...rulesResult.addedFlags,
    ...postRulesResult.addedFlags,
  ];

  let mergedRiskScore = pipelineResult.risk_score + (rulesResult.addedScore || 0) + (postRulesResult.addedScore || 0);
  mergedRiskScore = Math.min(100, mergedRiskScore);

  let blockedBy = pipelineResult.blocked_by;
  if (!blockedBy && postRulesResult.action === 'BLOCK') {
    blockedBy = `rule:${postRulesResult.matchedRules[postRulesResult.matchedRules.length - 1]}`;
  }

  const blockThreshold = pipelineCfg.blockThreshold || config.blockThreshold;
  const allowed = !blockedBy && mergedRiskScore < blockThreshold;

  const finalResult = {
    requestId,
    allowed,
    risk_score:      mergedRiskScore,
    flags:           [...new Set(mergedFlags)],
    blocked_by:      blockedBy || null,
    block_message:   blockedBy ? (postRulesResult.blockMessage || `Blocked by stage: ${blockedBy}`) : undefined,
    processing_time: Date.now() - start,
    stage_results:   pipelineResult.stage_results,
    redactedText:    pipelineResult.redactedText,
    rules_matched:   [...new Set([...rulesResult.matchedRules, ...postRulesResult.matchedRules])],
    timestamp,
  };

  _updateStats(finalResult);
  _writeAudit({
    requestId,
    allowed:     finalResult.allowed,
    risk_score:  finalResult.risk_score,
    blocked_by:  finalResult.blocked_by,
    flags:       finalResult.flags,
    userId:      payload.userId,
    source,
    text_length: text.length || output.length,
    processing_time: finalResult.processing_time,
    timestamp,
  });

  return finalResult;
}

/**
 * Redact PII from text without running the full pipeline.
 *
 * @param {string} text
 * @param {object} opts — { strategy: 'mask'|'hash'|'placeholder' }
 * @returns {{ redactedText: string, detections: Array }}
 */
async function redact(text, opts = {}) {
  const piiDetector = require('./filters/pii-detector');
  return piiDetector.redact(text, {
    strategy: opts.strategy || config.piiRedactionStrategy,
  });
}

/**
 * Batch check multiple payloads.
 *
 * @param {Array}  payloads
 * @param {object} pipelineCfg
 * @returns {Promise<Array>}
 */
async function checkBatch(payloads, pipelineCfg = {}) {
  if (!Array.isArray(payloads)) throw new TypeError('payloads must be an array');
  return Promise.all(payloads.map(p => check(p, pipelineCfg)));
}

// ── Audit log accessors ───────────────────────────────────────────────────────

function getAuditLog({ limit = 100, offset = 0 } = {}) {
  const total   = _auditLog.length;
  const entries = _auditLog.slice(offset, offset + limit);
  return { total, entries, limit, offset };
}

// ── Initialisation ────────────────────────────────────────────────────────────

let _initialized = false;

async function initialize(opts = {}) {
  if (_initialized) return;

  // Load rules from file if configured
  if (config.rulesPath) {
    try {
      rules.loadFromFile(config.rulesPath);
    } catch (err) {
      console.warn(`[HeadyGuard] Rules file error: ${err.message}. Using defaults.`);
    }
  }

  // Open audit log stream
  _openAuditStream();

  // Load built-in pipeline stages
  pipeline.loadBuiltinStages();

  // Hot-reload watcher
  if (config.rulesHotReload && config.rulesPath) {
    setInterval(() => {
      rules.checkReload(config.rulesPath);
    }, 30_000).unref();
  }

  _initialized = true;
  console.log(`[HeadyGuard] Initialized — stages: [${pipeline.getStageNames().join(', ')}]`);
}

/**
 * Graceful shutdown.
 */
async function shutdown() {
  if (_auditStream) {
    await new Promise(resolve => _auditStream.end(resolve));
    _auditStream = null;
  }
  _initialized = false;
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that runs HeadyGuard on request bodies.
 * Attaches `req.guardResult` and blocks if not allowed.
 *
 * @param {object} opts — { textField, userIdField, onBlock }
 */
function middleware(opts = {}) {
  return async (req, res, next) => {
    const text   = req.body?.[opts.textField || 'text'] || '';
    const userId = req.body?.[opts.userIdField || 'userId'] || req.headers?.['x-user-id'] || 'anonymous';

    try {
      const result = await check({ text, userId, source: 'input' });
      req.guardResult = result;

      if (!result.allowed) {
        const onBlock = opts.onBlock;
        if (typeof onBlock === 'function') return onBlock(req, res, result);
        return res.status(400).json({
          error:       'content_blocked',
          message:     result.block_message || 'Content blocked by HeadyGuard.',
          risk_score:  result.risk_score,
          blocked_by:  result.blocked_by,
          request_id:  result.requestId,
        });
      }

      return next();
    } catch (err) {
      // Guard failure should not block the request — log and pass through
      console.error(`[HeadyGuard] Middleware error: ${err.message}`);
      req.guardResult = null;
      return next();
    }
  };
}

// ── Module exports ────────────────────────────────────────────────────────────

module.exports = {
  initialize,
  shutdown,
  check,
  checkBatch,
  redact,
  getStats,
  getAuditLog,
  middleware,
  pipeline,
  rules,
  config,
};

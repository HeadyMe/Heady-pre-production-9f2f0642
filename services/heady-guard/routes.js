'use strict';

/**
 * HeadyGuard — Express Router
 *
 * Endpoints:
 *   POST   /guard/check          — Check a single input or output
 *   POST   /guard/check/batch    — Batch check multiple items
 *   POST   /guard/redact         — Redact PII from text
 *   GET    /guard/rules          — Get active rules
 *   PUT    /guard/rules          — Hot-reload rules
 *   DELETE /guard/rules/:id      — Remove a rule by id
 *   GET    /guard/stats          — Filter pipeline statistics
 *   GET    /guard/audit          — Audit log (paginated)
 *   GET    /health               — Health check (see health.js)
 */

const express = require('express');
const router  = express.Router();

const guard   = require('./index');
const { getRules, setRules, addRule, removeRule } = require('./rules');
const config  = require('./config');

// ── Helpers ───────────────────────────────────────────────────────────────────

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireField(body, field) {
  if (body[field] === undefined || body[field] === null) {
    throw Object.assign(new Error(`Missing required field: "${field}"`), { status: 400 });
  }
}

// ── POST /guard/check ─────────────────────────────────────────────────────────

/**
 * @body {
 *   text?:    string,    // input text to check
 *   output?:  string,    // LLM output to check
 *   userId?:  string,    // for rate limiting
 *   tokens?:  number,    // token count
 *   source?:  'input'|'output',
 *   context?: object,
 *   options?: {          // per-request pipeline overrides
 *     piiMode?: 'detect'|'redact',
 *     stages?: string[],
 *     blockThreshold?: number,
 *     flagThreshold?:  number,
 *   }
 * }
 */
router.post('/guard/check', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const text   = body.text   || '';
  const output = body.output || '';

  if (!text && !output) {
    return res.status(400).json({ error: 'validation_error', message: 'Provide "text" (input) or "output" (LLM response) to check.' });
  }

  const payload = {
    text,
    output,
    userId:  body.userId  || req.headers['x-user-id']  || 'anonymous',
    tokens:  typeof body.tokens === 'number' ? body.tokens : undefined,
    source:  body.source  || (output && !text ? 'output' : 'input'),
    context: body.context || {},
  };

  const opts = body.options || {};
  const result = await guard.check(payload, {
    piiMode:        opts.piiMode,
    stages:         opts.stages,
    blockThreshold: typeof opts.blockThreshold === 'number' ? opts.blockThreshold : undefined,
    flagThreshold:  typeof opts.flagThreshold  === 'number' ? opts.flagThreshold  : undefined,
  });

  const status = result.allowed ? 200 : 400;
  return res.status(status).json(result);
}));

// ── POST /guard/check/batch ───────────────────────────────────────────────────

/**
 * @body {
 *   items: Array<{ text?, output?, userId?, tokens?, source?, context? }>,
 *   options?: object,
 * }
 */
router.post('/guard/check/batch', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'validation_error', message: '"items" must be a non-empty array.' });
  }
  if (body.items.length > 100) {
    return res.status(400).json({ error: 'validation_error', message: 'Maximum 100 items per batch.' });
  }

  const opts = body.options || {};
  const results = await guard.checkBatch(
    body.items.map(item => ({
      text:    item.text    || '',
      output:  item.output  || '',
      userId:  item.userId  || req.headers['x-user-id'] || 'anonymous',
      tokens:  item.tokens,
      source:  item.source  || 'input',
      context: item.context || {},
    })),
    opts
  );

  const anyBlocked = results.some(r => !r.allowed);
  return res.status(anyBlocked ? 207 : 200).json({
    count:   results.length,
    blocked: results.filter(r => !r.allowed).length,
    results,
  });
}));

// ── POST /guard/redact ────────────────────────────────────────────────────────

/**
 * @body {
 *   text:      string,
 *   strategy?: 'mask'|'hash'|'placeholder',
 * }
 */
router.post('/guard/redact', asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (typeof body.text !== 'string') {
    return res.status(400).json({ error: 'validation_error', message: '"text" (string) is required.' });
  }

  const strategy = ['mask', 'hash', 'placeholder'].includes(body.strategy)
    ? body.strategy
    : config.piiRedactionStrategy;

  const result = await guard.redact(body.text, { strategy });

  return res.json({
    original_length: body.text.length,
    redacted_length: result.redactedText.length,
    redactedText:    result.redactedText,
    detections:      result.detections.length,
    types_found:     [...new Set(result.detections.map(d => d.type))],
  });
}));

// ── GET /guard/rules ──────────────────────────────────────────────────────────

router.get('/guard/rules', asyncHandler(async (req, res) => {
  const allRules  = getRules();
  const enabled   = allRules.filter(r => r.enabled !== false);
  const disabled  = allRules.filter(r => r.enabled === false);
  return res.json({
    total:    allRules.length,
    enabled:  enabled.length,
    disabled: disabled.length,
    rules:    allRules,
  });
}));

// ── PUT /guard/rules ──────────────────────────────────────────────────────────

/**
 * Hot-reload rules.
 * @body {
 *   rules:          Array<Rule>,   // replace entire ruleset
 *   mergeDefaults?: boolean,       // default true
 * }
 * OR
 * @body {
 *   rule: Rule,    // add / update a single rule
 * }
 */
router.put('/guard/rules', asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Add / update single rule
  if (body.rule && typeof body.rule === 'object') {
    if (!body.rule.id) {
      return res.status(400).json({ error: 'validation_error', message: 'Rule must have an "id" field.' });
    }
    addRule(body.rule);
    return res.json({ message: 'Rule added/updated.', total: getRules().length });
  }

  // Replace full ruleset
  if (Array.isArray(body.rules)) {
    const mergeDefaults = body.mergeDefaults !== false;
    const result = setRules(body.rules, mergeDefaults);
    return res.json({ message: 'Rules updated.', ...result });
  }

  return res.status(400).json({ error: 'validation_error', message: 'Provide "rules" array or "rule" object.' });
}));

// ── DELETE /guard/rules/:id ───────────────────────────────────────────────────

router.delete('/guard/rules/:id', asyncHandler(async (req, res) => {
  const removed = removeRule(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'not_found', message: `Rule "${req.params.id}" not found.` });
  }
  return res.json({ message: `Rule "${req.params.id}" removed.`, total: getRules().length });
}));

// ── GET /guard/stats ──────────────────────────────────────────────────────────

router.get('/guard/stats', asyncHandler(async (req, res) => {
  return res.json(guard.getStats());
}));

// ── GET /guard/audit ──────────────────────────────────────────────────────────

/**
 * @query limit  — number of entries (default 100, max 1000)
 * @query offset — pagination offset
 * @query userId — filter by userId
 */
router.get('/guard/audit', asyncHandler(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 1000);
  const offset = parseInt(req.query.offset, 10) || 0;

  const log = guard.getAuditLog({ limit, offset });

  // Optional userId filter
  if (req.query.userId) {
    const filtered = log.entries.filter(e => e.userId === req.query.userId);
    return res.json({ total: filtered.length, entries: filtered, limit, offset });
  }

  return res.json(log);
}));

// ── Error handler ─────────────────────────────────────────────────────────────

router.use((err, req, res, _next) => {
  const status  = err.status || 500;
  const message = config.isProduction && status === 500
    ? 'Internal server error'
    : err.message;

  if (status === 500) {
    console.error(`[HeadyGuard] Route error: ${err.stack || err.message}`);
  }

  return res.status(status).json({ error: 'guard_error', message });
});

module.exports = router;

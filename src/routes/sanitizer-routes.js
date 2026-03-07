/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const {
  SanitizationPipeline,
  SecretScanner,
  InputValidator,
  OutputSanitizer,
  CodeGovernor,
  AuditTrail,
  SECRET_PATTERNS,
  PII_PATTERNS,
  UNSAFE_CODE_PATTERNS,
} = require('../security/zero-trust-sanitizer');

const PHI = 1.6180339887;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function respond(res, status, body) {
  if (res && typeof res.status === 'function') return res.status(status).json(body);
  if (res && typeof res.writeHead === 'function') {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  return body;
}

// ─── Route Factory ────────────────────────────────────────────────────────────

function createSanitizerRoutes(opts = {}) {
  const pipeline = opts.pipeline || new SanitizationPipeline(opts.pipelineOpts || {});
  const routes   = [];

  /**
   * POST /sanitizer/run
   * Run the full zero-trust sanitization pipeline on an input.
   * Body: { input: string|object, context?: object }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/run',
    handler: async (req, res) => {
      const { input, context } = req.body || {};
      if (input === undefined || input === null) {
        return respond(res, 400, { error: 'Missing input field' });
      }
      try {
        const result = pipeline.run(input, context || {});
        return respond(res, result.ok ? 200 : 422, { ...result, phi: PHI });
      } catch (err) {
        return respond(res, 500, { error: err.message });
      }
    },
  });

  /**
   * POST /sanitizer/scan
   * Scan text for secrets only (no redaction).
   * Body: { text: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/scan',
    handler: async (req, res) => {
      const { text } = req.body || {};
      if (typeof text !== 'string') return respond(res, 400, { error: 'Missing text (string) field' });
      const scanner = pipeline.getScanner();
      const result  = scanner.scan(text);
      return respond(res, 200, {
        ok:       true,
        findings: result.findings,
        clean:    result.clean,
        count:    result.findings.length,
        phi:      PHI,
      });
    },
  });

  /**
   * POST /sanitizer/redact
   * Scan and redact secrets from text.
   * Body: { text: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/redact',
    handler: async (req, res) => {
      const { text } = req.body || {};
      if (typeof text !== 'string') return respond(res, 400, { error: 'Missing text (string) field' });
      const scanner  = pipeline.getScanner();
      const redacted = scanner.redact(text);
      return respond(res, 200, { ok: true, redacted });
    },
  });

  /**
   * POST /sanitizer/validate
   * Validate a value against an optional schema.
   * Body: { value: any, schema?: object }
   *   schema: { type?, required?, minLength?, maxLength?, min?, max?, enum? }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/validate',
    handler: async (req, res) => {
      const { value, schema } = req.body || {};
      if (value === undefined) return respond(res, 400, { error: 'Missing value field' });
      const validator = pipeline.getValidator();
      const result    = validator.validate(value, schema || {});
      return respond(res, result.valid ? 200 : 422, result);
    },
  });

  /**
   * POST /sanitizer/validate/injection
   * Check for injection attack patterns in a string.
   * Body: { input: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/validate/injection',
    handler: async (req, res) => {
      const { input } = req.body || {};
      if (typeof input !== 'string') return respond(res, 400, { error: 'Missing input (string) field' });
      const validator = pipeline.getValidator();
      const result    = validator.checkInjection(input);
      return respond(res, 200, { ok: true, ...result });
    },
  });

  /**
   * POST /sanitizer/output
   * Sanitize an LLM output string (PII removal, etc.).
   * Body: { output: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/output',
    handler: async (req, res) => {
      const { output } = req.body || {};
      if (typeof output !== 'string') return respond(res, 400, { error: 'Missing output (string) field' });
      const sanitizer = pipeline.getValidator
        ? (() => {
            // OutputSanitizer is created inside the pipeline; reach it via constructor
            const s = new OutputSanitizer();
            return s;
          })()
        : new OutputSanitizer();
      const result = sanitizer.sanitize(output);
      return respond(res, 200, { ok: true, ...result, phi: PHI });
    },
  });

  /**
   * POST /sanitizer/code
   * Validate code against unsafe patterns.
   * Body: { code: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/code',
    handler: async (req, res) => {
      const { code } = req.body || {};
      if (typeof code !== 'string') return respond(res, 400, { error: 'Missing code (string) field' });
      const governor = pipeline.getGovernor();
      const result   = governor.validate(code);
      return respond(res, result.safe ? 200 : 422, result);
    },
  });

  /**
   * POST /sanitizer/code/fix
   * Auto-fix unsafe patterns in code.
   * Body: { code: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/code/fix',
    handler: async (req, res) => {
      const { code } = req.body || {};
      if (typeof code !== 'string') return respond(res, 400, { error: 'Missing code (string) field' });
      const governor = pipeline.getGovernor();
      const fixed    = governor.autoFix(code);
      return respond(res, 200, { ok: true, fixed });
    },
  });

  /**
   * GET /sanitizer/audit
   * Retrieve the audit trail with optional filters.
   * Query: ?action=string&from=ISO&to=ISO&limit=number
   */
  routes.push({
    method: 'GET',
    path:   '/sanitizer/audit',
    handler: async (req, res) => {
      const query  = (req.query || req.params || {});
      const filter = {};
      if (query.action) filter.action = query.action;
      if (query.from)   filter.from   = new Date(query.from);
      if (query.to)     filter.to     = new Date(query.to);

      // AuditTrail is internal to the pipeline — reconstruct via getScanner trick
      // Expose via a newly created trail from pipeline internals
      const trail   = new AuditTrail();
      const entries = trail.query(filter);
      return respond(res, 200, { ok: true, entries, count: entries.length });
    },
  });

  /**
   * GET /sanitizer/patterns
   * List all registered detection patterns.
   */
  routes.push({
    method: 'GET',
    path:   '/sanitizer/patterns',
    handler: async (req, res) => {
      return respond(res, 200, {
        ok:           true,
        secretCount:  SECRET_PATTERNS.length,
        piiCount:     PII_PATTERNS.length,
        codeCount:    UNSAFE_CODE_PATTERNS.length,
        secrets:      SECRET_PATTERNS.map(p => ({ name: p.name })),
        pii:          PII_PATTERNS.map(p => ({ name: p.name, replace: p.replace })),
        unsafeCode:   UNSAFE_CODE_PATTERNS.map(p => ({ name: p.name, severity: p.severity })),
        phi:          PHI,
      });
    },
  });

  /**
   * POST /sanitizer/redactions
   * Add a custom redaction pattern to the output sanitizer.
   * Body: { name: string, pattern: string (regex), replace?: string }
   */
  routes.push({
    method: 'POST',
    path:   '/sanitizer/redactions',
    handler: async (req, res) => {
      const { name, pattern, replace = '[REDACTED]' } = req.body || {};
      if (!name || !pattern) return respond(res, 400, { error: 'Missing name or pattern' });
      try {
        const sanitizer = new OutputSanitizer();
        const re        = new RegExp(pattern, 'g');
        sanitizer.addCustomRedaction(name, re, replace);
        return respond(res, 201, { ok: true, name, replace });
      } catch (err) {
        return respond(res, 422, { error: `Invalid regex: ${err.message}` });
      }
    },
  });

  return routes;
}

function attachSanitizerRoutes(app, opts = {}) {
  const routes = createSanitizerRoutes(opts);
  for (const route of routes) {
    const method = route.method.toLowerCase();
    if (app[method]) app[method](route.path, route.handler);
  }
  return app;
}

module.exports = { createSanitizerRoutes, attachSanitizerRoutes };

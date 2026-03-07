/**
 * prompt-guard.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/prompt-guard.js
 *
 * Metrics:
 *   heady.prompts_scanned_total       — counter  (validateInput calls)
 *   heady.injections_blocked_total    — counter  (unsafe inputs detected)
 *   heady.prompt_risk_score           — histogram (0=safe, 1=definitely injected)
 *   heady.prompt_scan_duration_ms     — histogram (validateInput latency)
 *   heady.rag_triad_score             — histogram (ragTriad overall score)
 *
 * @module otel-wrappers/prompt-guard.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'prompt-guard';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const promptsScannedTotal = meter.createCounter('heady.prompts_scanned_total', {
  description: 'Total number of input prompts scanned',
  unit: '{prompts}',
});
const injectionsBlockedTotal = meter.createCounter('heady.injections_blocked_total', {
  description: 'Number of prompts blocked due to injection patterns or policy',
  unit: '{blocks}',
});
const promptRiskScore = meter.createHistogram('heady.prompt_risk_score', {
  description: 'Risk score of scanned prompts (0 = safe, 1 = injection detected)',
  unit: '1',
});
const promptScanDurationMs = meter.createHistogram('heady.prompt_scan_duration_ms', {
  description: 'Duration of prompt scanning operations',
  unit: 'ms',
});
const ragTriadScore = meter.createHistogram('heady.rag_triad_score', {
  description: 'Overall RAG-triad score from ragTriad()',
  unit: '1',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeInput(input) {
  if (typeof input !== 'string') return '[non-string]';
  // Only expose length and first 20 non-whitespace chars (enough for debugging, not for data leakage)
  return `[${input.length} chars, starts: "${input.trim().slice(0, 20).replace(/\n/g, '\\n')}…"]`;
}

// ─── Load original ────────────────────────────────────────────────────────────
const OriginalPromptGuard = require('../lib/prompt-guard');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedPromptGuard extends OriginalPromptGuard {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'constructor',
        'guard.strict_mode':  String(!!(opts.strictMode ?? true)),
        'guard.max_length':   opts.maxLength || 50000,
        'guard.patterns_count': (opts.patterns || []).length || 'default',
      },
    }, context.active());
    try {
      super(opts);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  validateInput(input) {
    const span = tracer.startSpan(`${MODULE_NAME}.validateInput`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'validateInput',
        'prompt.summary':     sanitizeInput(input),
        'prompt.length':      typeof input === 'string' ? input.length : 0,
        'guard.strict_mode':  String(this.strictMode),
        'guard.max_length':   this.maxLength,
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = super.validateInput(input);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success',     true);
      span.setAttribute('prompt.safe',        result.safe);
      if (!result.safe) {
        span.setAttribute('prompt.block_reason', result.reason || 'unknown');
      }
      span.setStatus({ code: SpanStatusCode.OK });

      // Risk score: 1.0 if blocked, 0.0 if safe
      const risk = result.safe ? 0.0 : 1.0;
      promptRiskScore.record(risk, { module: MODULE_NAME, reason: result.safe ? 'safe' : (result.reason || 'blocked') });
      promptsScannedTotal.add(1, { module: MODULE_NAME, result: String(result.safe) });
      promptScanDurationMs.record(durationMs, { module: MODULE_NAME, method: 'validateInput', safe: String(result.safe) });

      if (!result.safe) {
        injectionsBlockedTotal.add(1, { module: MODULE_NAME, reason: result.reason || 'unknown' });
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      promptScanDurationMs.record(durationMs, { module: MODULE_NAME, method: 'validateInput', safe: 'error' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  isolateMessages(messages) {
    const span = tracer.startSpan(`${MODULE_NAME}.isolateMessages`, {
      attributes: {
        'heady.module':    MODULE_NAME,
        'heady.method':    'isolateMessages',
        'prompt.msg_count': Array.isArray(messages) ? messages.length : 0,
      },
    }, context.active());
    const startMs = Date.now();
    try {
      const result = super.isolateMessages(messages);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success',     true);
      span.setStatus({ code: SpanStatusCode.OK });
      promptScanDurationMs.record(durationMs, { module: MODULE_NAME, method: 'isolateMessages', safe: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  sanitize(text) {
    const span = tracer.startSpan(`${MODULE_NAME}.sanitize`, {
      attributes: {
        'heady.module':  MODULE_NAME,
        'heady.method':  'sanitize',
        'prompt.length': typeof text === 'string' ? text.length : 0,
      },
    }, context.active());
    const startMs = Date.now();
    try {
      const result = super.sanitize(text);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms',   durationMs);
      span.setAttribute('heady.success',        true);
      span.setAttribute('prompt.output_length', typeof result === 'string' ? result.length : 0);
      span.setStatus({ code: SpanStatusCode.OK });
      promptScanDurationMs.record(durationMs, { module: MODULE_NAME, method: 'sanitize', safe: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  ragTriad(output, ctx) {
    const span = tracer.startSpan(`${MODULE_NAME}.ragTriad`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'ragTriad',
        'rag.has_query':      String(!!(ctx?.query)),
        'rag.sources_count':  ctx?.sources?.length || 0,
        'rag.constraints_count': ctx?.constraints?.length || 0,
      },
    }, context.active());
    const startMs = Date.now();
    try {
      const result = super.ragTriad(output, ctx);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms',    durationMs);
      span.setAttribute('heady.success',         true);
      span.setAttribute('rag.relevance',          result.relevance);
      span.setAttribute('rag.faithfulness',       result.faithfulness);
      span.setAttribute('rag.adherence',          result.adherence);
      span.setAttribute('rag.overall',            result.overall);
      span.setStatus({ code: SpanStatusCode.OK });
      ragTriadScore.record(result.overall, { module: MODULE_NAME });
      promptScanDurationMs.record(durationMs, { module: MODULE_NAME, method: 'ragTriad', safe: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  middleware() {
    const innerMiddleware = super.middleware();
    return (req, res, next) => {
      // Extract incoming W3C trace context
      const incomingCtx = propagation.extract(context.active(), req.headers || {});

      context.with(incomingCtx, () => {
        const span = tracer.startSpan(`${MODULE_NAME}.middleware`, {
          attributes: {
            'heady.module': MODULE_NAME,
            'heady.method': 'middleware',
            'http.method':  req.method || '',
            'http.route':   req.route?.path || req.path || '',
            'prompt.has_body': String(!!(req.body?.prompt || req.body?.messages)),
          },
        }, context.active());

        const startMs = Date.now();
        const wrappedNext = (err) => {
          const durationMs = Date.now() - startMs;
          span.setAttribute('heady.duration_ms', durationMs);
          if (err) {
            span.recordException(err instanceof Error ? err : new Error(String(err)));
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
          } else {
            span.setAttribute('heady.success', true);
            span.setStatus({ code: SpanStatusCode.OK });
          }
          span.end();
          next(err);
        };

        // Override res.status(400) detection
        const originalStatus = res.status.bind(res);
        let statusCalled = null;
        res.status = (code) => {
          statusCalled = code;
          return originalStatus(code);
        };

        try {
          innerMiddleware(req, res, (err) => {
            if (statusCalled === 400) {
              injectionsBlockedTotal.add(1, { module: MODULE_NAME, reason: 'middleware_block' });
              promptsScannedTotal.add(1, { module: MODULE_NAME, result: 'false' });
              span.setAttribute('prompt.blocked', true);
            } else {
              promptsScannedTotal.add(1, { module: MODULE_NAME, result: 'true' });
              span.setAttribute('prompt.blocked', false);
            }
            wrappedNext(err);
          });
        } catch (err) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.end();
          throw err;
        }
      });
    };
  }

  // W3C propagation helpers
  extractContext(carrier) { return propagation.extract(context.active(), carrier); }
  injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }
}

module.exports = TracedPromptGuard;

/**
 * pretty.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/pretty.js
 *
 * Wraps all public exports: pp, ppTable, prettyHTML, prettyJsonMiddleware, and any others.
 *
 * Metrics:
 *   heady.pretty_renders_total       — counter  (labelled by function name)
 *   heady.pretty_render_duration_ms  — histogram (rendering latency)
 *   heady.pretty_errors_total        — counter  (rendering exceptions)
 *   heady.pretty_input_size_bytes    — histogram (approximate input data size)
 *
 * @module otel-wrappers/pretty.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'pretty';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const prettyRendersTotal = meter.createCounter('heady.pretty_renders_total', {
  description: 'Number of pretty-printer render calls',
  unit: '{renders}',
});
const prettyRenderDurationMs = meter.createHistogram('heady.pretty_render_duration_ms', {
  description: 'Pretty-printer render execution latency',
  unit: 'ms',
});
const prettyErrorsTotal = meter.createCounter('heady.pretty_errors_total', {
  description: 'Exceptions thrown during pretty-printer rendering',
  unit: '{errors}',
});
const prettyInputSizeBytes = meter.createHistogram('heady.pretty_input_size_bytes', {
  description: 'Approximate serialized size of input data to pretty printers',
  unit: 'By',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function approxBytes(data) {
  try {
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch { return 0; }
}

function dataType(data) {
  if (data === null || data === undefined) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

// ─── Load original module ─────────────────────────────────────────────────────
const original = require('../lib/pretty');

// ─── Generic function wrapper ─────────────────────────────────────────────────
function wrapFn(fnName, originalFn) {
  return function tracedPrettyFn(...args) {
    const inputBytes = approxBytes(args[0]);
    const span = tracer.startSpan(`${MODULE_NAME}.${fnName}`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       fnName,
        'pretty.input_type':  dataType(args[0]),
        'pretty.input_bytes': inputBytes,
        ...(Array.isArray(args[0]) ? { 'pretty.array_length': args[0].length } : {}),
        ...(args[1] && typeof args[1] === 'object' ? { 'pretty.opts': JSON.stringify(args[1]).slice(0, 128) } : {}),
      },
    }, context.active());

    const startMs = Date.now();
    prettyInputSizeBytes.record(inputBytes, { module: MODULE_NAME, fn: fnName });

    try {
      const result = originalFn.apply(this, args);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success',     true);
      if (typeof result === 'string') {
        span.setAttribute('pretty.output_bytes', Buffer.byteLength(result, 'utf8'));
      }
      span.setStatus({ code: SpanStatusCode.OK });

      prettyRendersTotal.add(1, { module: MODULE_NAME, fn: fnName, success: 'true' });
      prettyRenderDurationMs.record(durationMs, { module: MODULE_NAME, fn: fnName, success: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success',     false);
      prettyErrorsTotal.add(1, { module: MODULE_NAME, fn: fnName });
      prettyRendersTotal.add(1, { module: MODULE_NAME, fn: fnName, success: 'false' });
      prettyRenderDurationMs.record(durationMs, { module: MODULE_NAME, fn: fnName, success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  };
}

// ─── Build traced exports ─────────────────────────────────────────────────────
// Wrap every exported function from the original module.
// Unknown future exports will also be wrapped automatically.
const traced = {};

for (const [key, value] of Object.entries(original)) {
  if (typeof value === 'function') {
    traced[key] = wrapFn(key, value);
  } else {
    // Re-export non-function exports (constants, objects) as-is
    traced[key] = value;
  }
}

// Ensure primary API is explicitly named for IDE auto-complete:
const pp        = traced.pp        || wrapFn('pp',        () => {});
const ppTable   = traced.ppTable   || wrapFn('ppTable',   () => {});
const prettyHTML = traced.prettyHTML || wrapFn('prettyHTML', () => '');

// prettyJsonMiddleware wraps the res.json function — trace the factory call itself
const prettyJsonMiddlewareFactory = original.prettyJsonMiddleware;
const prettyJsonMiddleware = prettyJsonMiddlewareFactory
  ? function tracedPrettyJsonMiddleware(...factoryArgs) {
      const span = tracer.startSpan(`${MODULE_NAME}.prettyJsonMiddleware`, {
        attributes: {
          'heady.module': MODULE_NAME,
          'heady.method': 'prettyJsonMiddleware',
        },
      }, context.active());
      try {
        const innerMiddleware = prettyJsonMiddlewareFactory(...factoryArgs);
        span.setStatus({ code: SpanStatusCode.OK });
        // Return a traced middleware function
        return function(req, res, next) {
          const originalJson = res.json.bind(res);
          res.json = (data) => {
            const midSpan = tracer.startSpan(`${MODULE_NAME}.prettyJsonMiddleware.json`, {
              attributes: {
                'heady.module':      MODULE_NAME,
                'heady.method':      'prettyJsonMiddleware.json',
                'http.method':       req.method || '',
                'http.route':        req.route?.path || req.path || '',
                'pretty.input_type': dataType(data),
              },
            }, context.active());
            const startMs = Date.now();
            try {
              const result = originalJson(data);
              const durationMs = Date.now() - startMs;
              midSpan.setAttribute('heady.duration_ms', durationMs);
              midSpan.setStatus({ code: SpanStatusCode.OK });
              prettyRendersTotal.add(1, { module: MODULE_NAME, fn: 'prettyJsonMiddleware', success: 'true' });
              prettyRenderDurationMs.record(durationMs, { module: MODULE_NAME, fn: 'prettyJsonMiddleware', success: 'true' });
              return result;
            } catch (err) {
              const durationMs = Date.now() - startMs;
              midSpan.setAttribute('heady.duration_ms', durationMs);
              midSpan.recordException(err);
              midSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
              prettyErrorsTotal.add(1, { module: MODULE_NAME, fn: 'prettyJsonMiddleware' });
              throw err;
            } finally {
              midSpan.end();
            }
          };
          innerMiddleware(req, res, next);
        };
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end();
      }
    }
  : undefined;

// ─── W3C propagation helpers ──────────────────────────────────────────────────
function extractContext(carrier) { return propagation.extract(context.active(), carrier); }
function injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }

// ─── Final exports (same shape as original + propagation helpers) ─────────────
module.exports = Object.assign(
  {},
  traced,           // all original exports, wrapped
  { pp, ppTable, prettyHTML, extractContext, injectContext },
  prettyJsonMiddleware ? { prettyJsonMiddleware } : {}
);

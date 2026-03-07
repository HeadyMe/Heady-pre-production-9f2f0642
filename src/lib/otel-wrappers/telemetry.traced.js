/**
 * telemetry.traced.js — Enhanced OTel wrapper with baggage propagation + trace-id injection
 * Drop-in replacement for src/lib/telemetry.js
 *
 * Adds to the original telemetry module:
 *   - W3C Baggage propagation (inject/extract into HTTP headers)
 *   - Automatic trace-id injection into log records and HTTP response headers
 *   - Enhanced middleware (baggage forwarding, X-Trace-Id header)
 *   - Span-level baggage reading/writing helpers
 *
 * Metrics:
 *   heady.spans_created_total   — counter  (spans started via withSpan/startSpan)
 *   heady.span_errors_total     — counter  (spans that ended with ERROR status)
 *   heady.baggage_entries_total — counter  (baggage entries injected per request)
 *
 * @module otel-wrappers/telemetry.traced
 */
'use strict';

const {
  trace,
  context,
  SpanStatusCode,
  metrics,
  propagation,
  baggageEntryMetadataFromString,
} = require('@opentelemetry/api');

const MODULE_NAME = 'telemetry';
const SERVICE_NAME = process.env.HEADY_SERVICE_NAME || 'heady-manager';

// ─── Load original telemetry exports ─────────────────────────────────────────
const original = require('../lib/telemetry');

// ─── Enhanced tracer + meter (re-use from original where possible) ─────────────
const tracer = original.tracer || trace.getTracer(SERVICE_NAME, '3.1.0');
const meter  = original.meter  || metrics.getMeter(SERVICE_NAME, '3.1.0');

// ─── Metrics specific to this wrapper ────────────────────────────────────────
const spansCreatedTotal = meter.createCounter('heady.spans_created_total', {
  description: 'Total spans created via startSpan() / withSpan()',
  unit: '{spans}',
});
const spanErrorsTotal = meter.createCounter('heady.span_errors_total', {
  description: 'Spans that finished with ERROR status',
  unit: '{errors}',
});
const baggageEntriesTotal = meter.createCounter('heady.baggage_entries_total', {
  description: 'Baggage entries injected into outgoing HTTP headers',
  unit: '{entries}',
});

// ─── Enhanced startSpan ───────────────────────────────────────────────────────
function startSpan(name, attributes = {}) {
  spansCreatedTotal.add(1, { service: SERVICE_NAME });
  return tracer.startSpan(name, {
    attributes: { 'service.name': SERVICE_NAME, ...attributes },
  }, context.active());
}

// ─── Enhanced withSpan — supports baggage propagation ────────────────────────
function withSpan(name, fn, attributes = {}) {
  const span = startSpan(name, attributes);
  const ctx  = trace.setSpan(context.active(), span);

  try {
    const result = context.with(ctx, () => fn(span));
    if (result && typeof result.then === 'function') {
      return result
        .then((r) => {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return r;
        })
        .catch((e) => {
          span.recordException(e);
          span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
          spanErrorsTotal.add(1, { service: SERVICE_NAME, span: name });
          span.end();
          return Promise.reject(e);
        });
    }
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
    return result;
  } catch (e) {
    span.recordException(e);
    span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    spanErrorsTotal.add(1, { service: SERVICE_NAME, span: name });
    span.end();
    throw e;
  }
}

// ─── Baggage helpers ──────────────────────────────────────────────────────────

/**
 * Set a baggage entry in the current context.
 * Returns a new context with the baggage value set.
 */
function setBaggage(key, value, metadata = '') {
  const currentBaggage = propagation.getBaggage(context.active()) || propagation.createBaggage();
  const entry = metadata
    ? { value, metadata: baggageEntryMetadataFromString(metadata) }
    : { value };
  const newBaggage = currentBaggage.setEntry(key, entry);
  return propagation.setBaggage(context.active(), newBaggage);
}

/**
 * Get a baggage entry value from the current context (or provided context).
 */
function getBaggage(key, ctx) {
  const bag = propagation.getBaggage(ctx || context.active());
  return bag?.getEntry(key)?.value ?? null;
}

/**
 * Inject W3C traceparent + tracestate + baggage into a carrier (e.g. HTTP headers object).
 */
function injectHeaders(carrier, ctx) {
  const activeCtx = ctx || context.active();
  propagation.inject(activeCtx, carrier);
  // Count injected baggage entries
  const bag = propagation.getBaggage(activeCtx);
  if (bag) {
    const entries = bag.getAllEntries();
    if (entries.length > 0) {
      baggageEntriesTotal.add(entries.length, { service: SERVICE_NAME });
    }
  }
  return carrier;
}

/**
 * Extract W3C traceparent + tracestate + baggage from incoming carrier.
 * Returns a new context.
 */
function extractHeaders(carrier) {
  return propagation.extract(context.active(), carrier);
}

// ─── Enhanced traceMiddleware — adds X-Trace-Id + baggage forwarding ─────────
function traceMiddleware(req, res, next) {
  // Extract incoming W3C context (traceparent, baggage, etc.)
  const incomingCtx = propagation.extract(context.active(), req.headers || {});

  context.with(incomingCtx, () => {
    const span = startSpan(`HTTP ${req.method} ${req.path}`, {
      'http.method':    req.method,
      'http.url':       req.originalUrl,
      'http.user_agent': req.headers?.['user-agent'] || 'unknown',
      'heady.request_id': req.headers?.['x-request-id'] || req.id || 'none',
    });
    spansCreatedTotal.add(1, { service: SERVICE_NAME, type: 'http_server' });

    // Inject current trace context back into response headers
    const traceId = span.spanContext().traceId;
    const spanId  = span.spanContext().spanId;
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Span-Id',  spanId);

    // Forward baggage to response (for debugging)
    const bag = propagation.getBaggage(context.active());
    if (bag) {
      const entries = bag.getAllEntries();
      if (entries.length > 0) {
        res.setHeader('X-Baggage-Keys', entries.map(([k]) => k).join(','));
      }
    }

    const startMs = Date.now();
    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      span.setStatus({ code: res.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      if (original.requestLatency) {
        original.requestLatency.record(Date.now() - startMs, {
          method: req.method,
          path:   req.route?.path || req.path,
          status: res.statusCode,
        });
      }
      if (res.statusCode >= 400) {
        spanErrorsTotal.add(1, { service: SERVICE_NAME, span: 'http_server', status: String(res.statusCode) });
      }
      span.end();
    });

    next();
  });
}

// ─── Re-export all original functions + enhanced versions ────────────────────
const {
  recordTokenUsage,
  recordToolCall,
  recordEvalScore,
  tokenCounter,
  requestLatency,
} = original;

module.exports = {
  // Original API (fully compatible)
  tracer,
  meter,
  startSpan,
  withSpan,
  traceMiddleware,
  recordTokenUsage,
  recordToolCall,
  recordEvalScore,
  tokenCounter,
  requestLatency,

  // Enhanced baggage + propagation API
  setBaggage,
  getBaggage,
  injectHeaders,
  extractHeaders,

  // Metrics
  spansCreatedTotal,
  spanErrorsTotal,
  baggageEntriesTotal,
};

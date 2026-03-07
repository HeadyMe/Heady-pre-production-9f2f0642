/**
 * feature-flags.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/feature-flags.js
 *
 * Wraps every exported function: isEnabled, setFlag, getAllFlags, flagMiddleware
 * and re-exports the FLAGS object.
 *
 * Metrics:
 *   heady.flag_checks_total    — counter  (isEnabled calls, labelled by flag + result)
 *   heady.flag_changes_total   — counter  (setFlag calls)
 *   heady.flags_enabled_gauge  — observable gauge (count of currently enabled flags)
 *
 * @module otel-wrappers/feature-flags.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'feature-flags';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Load original exports ────────────────────────────────────────────────────
const original = require('../lib/feature-flags');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const flagChecksTotal = meter.createCounter('heady.flag_checks_total', {
  description: 'Number of feature flag checks (isEnabled calls)',
  unit: '{checks}',
});
const flagChangesTotal = meter.createCounter('heady.flag_changes_total', {
  description: 'Number of feature flag mutations (setFlag calls)',
  unit: '{changes}',
});
// Observable gauge: reports count of enabled flags each collection cycle
meter.createObservableGauge('heady.flags_enabled_gauge', {
  description: 'Number of currently enabled feature flags',
  unit: '{flags}',
}).addCallback((result) => {
  const allFlags = original.getAllFlags();
  const enabledCount = Object.values(allFlags).filter(f => f.enabled).length;
  result.observe(enabledCount, { module: MODULE_NAME });
});

// ─── Traced isEnabled ─────────────────────────────────────────────────────────
function isEnabled(flagName, userId) {
  const span = tracer.startSpan(`${MODULE_NAME}.isEnabled`, {
    attributes: {
      'heady.module':   MODULE_NAME,
      'heady.method':   'isEnabled',
      'flag.name':      String(flagName),
      // userId may be PII — hash it for the span attribute
      'flag.user_hash': userId ? String(String(userId).length) + '_chars' : 'none',
    },
  }, context.active());

  try {
    const result = original.isEnabled(flagName, userId);
    span.setAttribute('flag.result',  result);
    span.setAttribute('heady.success', true);
    span.setStatus({ code: SpanStatusCode.OK });
    flagChecksTotal.add(1, { module: MODULE_NAME, flag: String(flagName), result: String(result) });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    flagChecksTotal.add(1, { module: MODULE_NAME, flag: String(flagName), result: 'error' });
    throw err;
  } finally {
    span.end();
  }
}

// ─── Traced setFlag ───────────────────────────────────────────────────────────
function setFlag(flagName, enabled, rollout) {
  const span = tracer.startSpan(`${MODULE_NAME}.setFlag`, {
    attributes: {
      'heady.module': MODULE_NAME,
      'heady.method': 'setFlag',
      'flag.name':    String(flagName),
      'flag.enabled': String(enabled),
      'flag.rollout': rollout !== undefined ? rollout : 'unchanged',
    },
  }, context.active());

  try {
    original.setFlag(flagName, enabled, rollout);
    span.setAttribute('heady.success', true);
    span.setStatus({ code: SpanStatusCode.OK });
    flagChangesTotal.add(1, { module: MODULE_NAME, flag: String(flagName), enabled: String(enabled) });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

// ─── Traced getAllFlags ────────────────────────────────────────────────────────
function getAllFlags() {
  const span = tracer.startSpan(`${MODULE_NAME}.getAllFlags`, {
    attributes: {
      'heady.module': MODULE_NAME,
      'heady.method': 'getAllFlags',
    },
  }, context.active());
  try {
    const result = original.getAllFlags();
    const total   = Object.keys(result).length;
    const enabled = Object.values(result).filter(f => f.enabled).length;
    span.setAttribute('flags.total',   total);
    span.setAttribute('flags.enabled', enabled);
    span.setAttribute('heady.success', true);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

// ─── Traced flagMiddleware ────────────────────────────────────────────────────
function flagMiddleware(flagName) {
  const innerMiddleware = original.flagMiddleware(flagName);
  return function tracedFlagMiddleware(req, res, next) {
    const span = tracer.startSpan(`${MODULE_NAME}.flagMiddleware`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'flagMiddleware',
        'flag.name':          String(flagName),
        'http.method':        req.method || '',
        'http.route':         req.route?.path || req.path || '',
        'flag.user_id_present': String(!!(req.user?.id || req.headers?.['x-user-id'])),
      },
    }, context.active());

    // Extract incoming W3C trace context from request
    const incomingCtx = propagation.extract(context.active(), req.headers || {});

    const wrappedNext = (...args) => { span.end(); next(...args); };
    try {
      // Run in the propagated context
      context.with(incomingCtx, () => {
        innerMiddleware(req, res, (err) => {
          if (err) {
            span.recordException(err instanceof Error ? err : new Error(String(err)));
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
            flagChecksTotal.add(1, { module: MODULE_NAME, flag: String(flagName), result: 'middleware_error' });
          } else {
            const enabled = req.featureFlags?.[flagName];
            span.setAttribute('flag.result', String(enabled));
            span.setAttribute('heady.success', true);
            span.setStatus({ code: SpanStatusCode.OK });
            flagChecksTotal.add(1, { module: MODULE_NAME, flag: String(flagName), result: String(enabled) });
          }
          wrappedNext(err);
        });
      });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      throw err;
    }
  };
}

// ─── Re-export FLAGS (live reference to original object) ─────────────────────
const { FLAGS } = original;

// ─── W3C propagation helpers ──────────────────────────────────────────────────
function extractContext(carrier) { return propagation.extract(context.active(), carrier); }
function injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }

module.exports = { isEnabled, setFlag, getAllFlags, flagMiddleware, FLAGS, extractContext, injectContext };

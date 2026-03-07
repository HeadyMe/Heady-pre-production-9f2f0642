/**
 * key-rotation.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/key-rotation.js
 *
 * NOTE: key-rotation.js exports a singleton (new KeyRotationManager()).
 *       This wrapper proxies every method on that singleton and is also a singleton.
 *
 * Metrics:
 *   heady.key_rotations_total     — counter  (rotate() calls)
 *   heady.key_validations_total   — counter  (validate() calls labelled by result)
 *   heady.keys_expired_gauge      — observable gauge (count of currently expired keys)
 *   heady.key_registration_total  — counter  (registerKey() calls)
 *
 * @module otel-wrappers/key-rotation.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'key-rotation';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const keyRotationsTotal = meter.createCounter('heady.key_rotations_total', {
  description: 'Number of successful key rotations',
  unit: '{rotations}',
});
const keyValidationsTotal = meter.createCounter('heady.key_validations_total', {
  description: 'Number of key validation checks labelled by result',
  unit: '{validations}',
});
const keyRegistrationTotal = meter.createCounter('heady.key_registration_total', {
  description: 'Number of key registrations',
  unit: '{registrations}',
});

// ─── Load original singleton ──────────────────────────────────────────────────
const originalManager = require('../lib/key-rotation');

// ─── Observable gauge for expired keys — polled each metric collection ────────
meter.createObservableGauge('heady.keys_expired_gauge', {
  description: 'Number of currently expired keys in the rotation manager',
  unit: '{keys}',
}).addCallback((result) => {
  try {
    const status = originalManager.getStatus();
    const expired = Object.values(status).filter(s => s.isExpired).length;
    result.observe(expired, { module: MODULE_NAME });
  } catch {
    result.observe(0, { module: MODULE_NAME });
  }
});

// ─── Proxy wrapper ────────────────────────────────────────────────────────────

function generateKey(prefix = 'hdy') {
  const span = tracer.startSpan(`${MODULE_NAME}.generateKey`, {
    attributes: {
      'heady.module': MODULE_NAME,
      'heady.method': 'generateKey',
      'key.prefix':   prefix,
    },
  }, context.active());
  try {
    const result = originalManager.generateKey(prefix);
    span.setAttribute('heady.success', true);
    // Never record the key value itself
    span.setAttribute('key.length', result?.length || 0);
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

function registerKey(name, currentValue) {
  const span = tracer.startSpan(`${MODULE_NAME}.registerKey`, {
    attributes: {
      'heady.module':       MODULE_NAME,
      'heady.method':       'registerKey',
      'key.name':           name,
      'key.has_initial_value': String(!!currentValue),
    },
  }, context.active());
  try {
    const result = originalManager.registerKey(name, currentValue);
    span.setAttribute('heady.success', true);
    span.setAttribute('key.rotation_count', result.rotationCount || 0);
    span.setStatus({ code: SpanStatusCode.OK });
    keyRegistrationTotal.add(1, { module: MODULE_NAME, key_name: name });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

function rotate(name) {
  const span = tracer.startSpan(`${MODULE_NAME}.rotate`, {
    attributes: {
      'heady.module': MODULE_NAME,
      'heady.method': 'rotate',
      'key.name':     name,
    },
  }, context.active());
  try {
    const result = originalManager.rotate(name);
    span.setAttribute('heady.success',         true);
    span.setAttribute('key.rotation_count',    result.rotationCount);
    span.setAttribute('key.expires_in_ms',     result.expiresAt - Date.now());
    span.setStatus({ code: SpanStatusCode.OK });
    keyRotationsTotal.add(1, { module: MODULE_NAME, key_name: name });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

function validate(name, token) {
  const span = tracer.startSpan(`${MODULE_NAME}.validate`, {
    attributes: {
      'heady.module':  MODULE_NAME,
      'heady.method':  'validate',
      'key.name':      name,
      // NEVER log token value
    },
  }, context.active());
  try {
    const result = originalManager.validate(name, token);
    span.setAttribute('heady.success',  true);
    span.setAttribute('key.valid',       result);
    span.setStatus({ code: SpanStatusCode.OK });
    keyValidationsTotal.add(1, { module: MODULE_NAME, key_name: name, result: String(result) });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    keyValidationsTotal.add(1, { module: MODULE_NAME, key_name: name, result: 'error' });
    throw err;
  } finally {
    span.end();
  }
}

function getStatus() {
  const span = tracer.startSpan(`${MODULE_NAME}.getStatus`, {
    attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'getStatus' },
  }, context.active());
  try {
    const result = originalManager.getStatus();
    const keys = Object.keys(result);
    const expired = keys.filter(k => result[k].isExpired).length;
    const needsRotation = keys.filter(k => result[k].needsRotation).length;
    span.setAttribute('heady.success',     true);
    span.setAttribute('keys.total',         keys.length);
    span.setAttribute('keys.expired',       expired);
    span.setAttribute('keys.needs_rotation', needsRotation);
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

function startAutoRotation(name, intervalMs) {
  const span = tracer.startSpan(`${MODULE_NAME}.startAutoRotation`, {
    attributes: {
      'heady.module':    MODULE_NAME,
      'heady.method':    'startAutoRotation',
      'key.name':        name,
      'rotation.interval_ms': intervalMs || 'default',
    },
  }, context.active());
  try {
    const result = originalManager.startAutoRotation(name, intervalMs);
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

function stopAll() {
  const span = tracer.startSpan(`${MODULE_NAME}.stopAll`, {
    attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'stopAll' },
  }, context.active());
  try {
    originalManager.stopAll();
    span.setAttribute('heady.success', true);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

// ─── W3C propagation helpers ──────────────────────────────────────────────────
function extractContext(carrier) { return propagation.extract(context.active(), carrier); }
function injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }

// ─── Export as singleton (same interface as original) ─────────────────────────
module.exports = {
  generateKey,
  registerKey,
  rotate,
  validate,
  getStatus,
  startAutoRotation,
  stopAll,
  extractContext,
  injectContext,
  // Expose the underlying manager for advanced use
  _manager: originalManager,
};

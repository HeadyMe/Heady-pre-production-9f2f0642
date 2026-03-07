/**
 * failover.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/failover.js
 *
 * Metrics:
 *   heady.failover_events_total    — counter  (each time routing switches to fallback)
 *   heady.primary_recovery_total   — counter  (each time primary is restored)
 *   heady.backend_latency_ms       — histogram (per-backend request latency)
 *   heady.failover_errors_total    — counter  (route/fetch exceptions)
 *   heady.health_checks_total      — counter  (health check results by outcome)
 *
 * @module otel-wrappers/failover.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'failover';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const failoverEventsTotal = meter.createCounter('heady.failover_events_total', {
  description: 'Number of failover activations (primary → fallback)',
  unit: '{events}',
});
const primaryRecoveryTotal = meter.createCounter('heady.primary_recovery_total', {
  description: 'Number of primary backend recovery events',
  unit: '{recoveries}',
});
const backendLatencyMs = meter.createHistogram('heady.backend_latency_ms', {
  description: 'Per-backend request latency',
  unit: 'ms',
});
const failoverErrorsTotal = meter.createCounter('heady.failover_errors_total', {
  description: 'Errors encountered in route() and _fetch()',
  unit: '{errors}',
});
const healthChecksTotal = meter.createCounter('heady.health_checks_total', {
  description: 'Health check outcomes labelled by backend and result',
  unit: '{checks}',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeRequest(req) {
  try {
    const safe = { path: req?.path, method: req?.method };
    // Never log body or headers that may contain secrets
    return JSON.stringify(safe).slice(0, 256);
  } catch {
    return '[unserializable]';
  }
}

// ─── Load original ────────────────────────────────────────────────────────────
const OriginalMultiCloudFailover = require('../lib/failover');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedMultiCloudFailover extends OriginalMultiCloudFailover {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module':        MODULE_NAME,
        'heady.method':        'constructor',
        'failover.primary':    opts.primary?.name || 'gcp-cloud-run',
        'failover.fallback':   opts.fallback?.name || 'aws-lambda',
        'failover.health_check_interval_ms': opts.healthCheckInterval || 15000,
      },
    }, context.active());
    try {
      super(opts);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      failoverErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async route(request) {
    const prevPrimaryHealthy = this._primaryHealthy;
    const span = tracer.startSpan(`${MODULE_NAME}.route`, {
      attributes: {
        'heady.module':            MODULE_NAME,
        'heady.method':            'route',
        'failover.primary_healthy': String(this._primaryHealthy),
        'failover.failover_count':  this._failoverCount,
        'request.path':             request?.path || '/',
        'request.method':           request?.method || 'GET',
        'heady.args':               sanitizeRequest(request),
      },
    }, context.active());

    // Inject W3C traceparent into outgoing request headers
    const outgoingHeaders = Object.assign({}, request?.headers || {});
    propagation.inject(context.active(), outgoingHeaders);
    const tracedRequest = Object.assign({}, request, { headers: outgoingHeaders });

    const startMs = Date.now();
    try {
      const result = await super.route(tracedRequest);
      const durationMs = Date.now() - startMs;
      const nowPrimaryHealthy = this._primaryHealthy;

      span.setAttribute('heady.duration_ms',       durationMs);
      span.setAttribute('heady.success',            true);
      span.setAttribute('failover.routed_to',       result?.backend || 'unknown');
      span.setAttribute('failover.response_status', result?.status || 0);
      span.setStatus({ code: SpanStatusCode.OK });

      backendLatencyMs.record(durationMs, { module: MODULE_NAME, backend: result?.backend || 'unknown', success: 'true' });

      // Detect failover
      if (prevPrimaryHealthy && !nowPrimaryHealthy) {
        failoverEventsTotal.add(1, { module: MODULE_NAME, from: this.primary.name, to: this.fallback.name });
      }
      // Detect recovery
      if (!prevPrimaryHealthy && nowPrimaryHealthy) {
        primaryRecoveryTotal.add(1, { module: MODULE_NAME, backend: this.primary.name });
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      failoverErrorsTotal.add(1, { module: MODULE_NAME, method: 'route' });
      backendLatencyMs.record(durationMs, { module: MODULE_NAME, backend: 'unknown', success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async _fetch(backend, request) {
    const span = tracer.startSpan(`${MODULE_NAME}._fetch`, {
      attributes: {
        'heady.module':    MODULE_NAME,
        'heady.method':    '_fetch',
        'backend.name':    backend?.name || 'unknown',
        'request.path':    request?.path || '/',
        'request.method':  request?.method || 'GET',
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super._fetch(backend, request);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms',       durationMs);
      span.setAttribute('heady.success',            true);
      span.setAttribute('backend.response_status',  result?.status || 0);
      span.setStatus({ code: SpanStatusCode.OK });
      backendLatencyMs.record(durationMs, { module: MODULE_NAME, backend: backend?.name || 'unknown', success: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      failoverErrorsTotal.add(1, { module: MODULE_NAME, method: '_fetch', backend: backend?.name || 'unknown' });
      backendLatencyMs.record(durationMs, { module: MODULE_NAME, backend: backend?.name || 'unknown', success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async _healthCheck(backend) {
    const span = tracer.startSpan(`${MODULE_NAME}._healthCheck`, {
      attributes: {
        'heady.module':  MODULE_NAME,
        'heady.method':  '_healthCheck',
        'backend.name':  backend?.name || 'unknown',
      },
    }, context.active());
    const startMs = Date.now();
    try {
      await super._healthCheck(backend);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setStatus({ code: SpanStatusCode.OK });
      healthChecksTotal.add(1, { module: MODULE_NAME, backend: backend?.name || 'unknown', result: 'healthy' });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      healthChecksTotal.add(1, { module: MODULE_NAME, backend: backend?.name || 'unknown', result: 'unhealthy' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  getStatus() {
    const span = tracer.startSpan(`${MODULE_NAME}.getStatus`, {
      attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'getStatus' },
    }, context.active());
    try {
      const status = super.getStatus();
      span.setAttribute('failover.primary_healthy', status.primary.healthy);
      span.setAttribute('failover.fallback_active',  status.fallback.active);
      span.setAttribute('failover.count',            status.failoverCount);
      span.setStatus({ code: SpanStatusCode.OK });
      return status;
    } catch (err) {
      failoverErrorsTotal.add(1, { module: MODULE_NAME, method: 'getStatus' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  // W3C propagation helpers
  extractContext(carrier) { return propagation.extract(context.active(), carrier); }
  injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }
}

module.exports = TracedMultiCloudFailover;

/**
 * digital-twin.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/digital-twin.js
 *
 * Metrics:
 *   heady.twin_syncs_total       — counter  (simulate() calls that complete)
 *   heady.twin_drift_score       — histogram (per-scenario error rate as drift measure)
 *   heady.twin_state_size_bytes  — histogram (approx serialised state size in bytes)
 *   heady.twin_scenario_duration_ms — histogram (per-scenario run time)
 *   heady.twin_errors_total      — counter  (failed scenarios / exceptions)
 *
 * @module otel-wrappers/digital-twin.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'digital-twin';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const twinSyncsTotal = meter.createCounter('heady.twin_syncs_total', {
  description: 'Number of completed twin simulations',
  unit: '{syncs}',
});
const twinDriftScore = meter.createHistogram('heady.twin_drift_score', {
  description: 'Per-scenario error rate used as digital-twin drift score (0–1)',
  unit: '1',
});
const twinStateSizeBytes = meter.createHistogram('heady.twin_state_size_bytes', {
  description: 'Approximate serialized twin result size in bytes',
  unit: 'By',
});
const twinScenarioDurationMs = meter.createHistogram('heady.twin_scenario_duration_ms', {
  description: 'Individual scenario execution duration',
  unit: 'ms',
});
const twinErrorsTotal = meter.createCounter('heady.twin_errors_total', {
  description: 'Errors encountered during twin simulations',
  unit: '{errors}',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeArgs(args) {
  try {
    return JSON.stringify(args, (key, value) => {
      if (typeof key === 'string' && /token|secret|password|key|auth/i.test(key)) return '[REDACTED]';
      if (typeof value === 'string' && value.length > 256) return value.slice(0, 256) + '…';
      return value;
    }).slice(0, 1024);
  } catch {
    return '[unserializable]';
  }
}

function approxBytes(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj), 'utf8'); }
  catch { return 0; }
}

// ─── Load original ────────────────────────────────────────────────────────────
const OriginalDigitalTwin = require('../lib/digital-twin');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedDigitalTwin extends OriginalDigitalTwin {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'constructor',
        'twin.name':    opts.name || 'heady-twin',
      },
    }, context.active());
    try {
      super(opts);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      twinErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  addScenario(name, config) {
    const span = tracer.startSpan(`${MODULE_NAME}.addScenario`, {
      attributes: {
        'heady.module':      MODULE_NAME,
        'heady.method':      'addScenario',
        'twin.name':         this.name,
        'scenario.name':     name,
        'scenario.rps':      config?.rps || 10,
        'scenario.duration_ms': config?.duration || 60000,
        'heady.args':        sanitizeArgs([name, config]),
      },
    }, context.active());
    try {
      const result = super.addScenario(name, config);
      span.setAttribute('twin.scenarios_count', this.scenarios.length);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      twinErrorsTotal.add(1, { module: MODULE_NAME, method: 'addScenario' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async simulate(baseUrl) {
    const span = tracer.startSpan(`${MODULE_NAME}.simulate`, {
      attributes: {
        'heady.module':         MODULE_NAME,
        'heady.method':         'simulate',
        'twin.name':            this.name,
        'twin.scenarios_count': this.scenarios.length,
        'twin.base_url':        baseUrl || '',
        'heady.args':           sanitizeArgs([baseUrl]),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super.simulate(baseUrl);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('twin.results_count', result?.results?.length || 0);
      span.setAttribute('twin.all_pass', result?.results?.every(r => r.pass) ?? false);

      const stateBytes = approxBytes(result);
      twinStateSizeBytes.record(stateBytes, { module: MODULE_NAME, twin: this.name });
      twinSyncsTotal.add(1, { module: MODULE_NAME, twin: this.name, all_pass: String(result?.results?.every(r => r.pass) ?? false) });

      // Record per-scenario drift + duration
      for (const r of (result?.results || [])) {
        twinDriftScore.record(r.errorRate || 0, { module: MODULE_NAME, scenario: r.scenario || 'unknown', twin: this.name });
        twinScenarioDurationMs.record(r.avgLatency || 0, { module: MODULE_NAME, scenario: r.scenario || 'unknown', pass: String(r.pass) });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      twinErrorsTotal.add(1, { module: MODULE_NAME, method: 'simulate' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  // _runScenario is internal — we instrument it for per-scenario spans
  async _runScenario(scenario, baseUrl) {
    const span = tracer.startSpan(`${MODULE_NAME}._runScenario`, {
      attributes: {
        'heady.module':              MODULE_NAME,
        'heady.method':              '_runScenario',
        'twin.name':                 this.name,
        'scenario.name':             scenario.name,
        'scenario.rps':              scenario.rps,
        'scenario.duration_ms':      scenario.duration,
        'scenario.expected_latency': scenario.expectedLatency,
        'scenario.expected_error_rate': scenario.expectedErrorRate,
        'scenario.base_url':         baseUrl || '',
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super._runScenario(scenario, baseUrl);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('scenario.total_requests',  result.total);
      span.setAttribute('scenario.successes',        result.successes);
      span.setAttribute('scenario.failures',         result.failures);
      span.setAttribute('scenario.avg_latency_ms',   result.avgLatency);
      span.setAttribute('scenario.error_rate',       result.errorRate);
      span.setAttribute('scenario.pass',             result.pass);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      twinErrorsTotal.add(1, { module: MODULE_NAME, method: '_runScenario', scenario: scenario.name });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  getSummary() {
    const span = tracer.startSpan(`${MODULE_NAME}.getSummary`, {
      attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'getSummary', 'twin.name': this.name },
    }, context.active());
    try {
      const summary = super.getSummary();
      span.setAttribute('twin.scenarios_run',   summary.scenarios);
      span.setAttribute('twin.all_pass',         summary.allPass);
      const stateBytes = approxBytes(summary);
      twinStateSizeBytes.record(stateBytes, { module: MODULE_NAME, twin: this.name, operation: 'getSummary' });
      span.setStatus({ code: SpanStatusCode.OK });
      return summary;
    } catch (err) {
      twinErrorsTotal.add(1, { module: MODULE_NAME, method: 'getSummary' });
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

module.exports = TracedDigitalTwin;

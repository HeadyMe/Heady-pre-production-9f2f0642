/**
 * agent-protocol.traced.js — OpenTelemetry tracing wrapper for AgentProtocolAdapter
 * Drop-in replacement for src/lib/agent-protocol.js
 *
 * Metrics:
 *   heady.a2a_tasks_total          — counter  (A2A task conversions)
 *   heady.agui_events_total        — counter  (AG-UI events emitted per type)
 *   heady.protocol_errors_total    — counter  (all errors in any protocol method)
 *   heady.protocol_duration_ms     — histogram (method execution latency)
 *
 * @module otel-wrappers/agent-protocol.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'agent-protocol';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const a2aTasksTotal = meter.createCounter('heady.a2a_tasks_total', {
  description: 'Total A2A task conversions (fromA2A + toA2A)',
  unit: '{tasks}',
});
const aguiEventsTotal = meter.createCounter('heady.agui_events_total', {
  description: 'Total AG-UI events emitted, labelled by event type',
  unit: '{events}',
});
const protocolErrorsTotal = meter.createCounter('heady.protocol_errors_total', {
  description: 'Total errors thrown by agent-protocol methods',
  unit: '{errors}',
});
const protocolDurationMs = meter.createHistogram('heady.protocol_duration_ms', {
  description: 'Agent-protocol method execution duration',
  unit: 'ms',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
/**
 * Sanitize arguments for span attributes — remove sensitive fields and truncate long strings.
 */
function sanitizeArgs(args) {
  try {
    return JSON.stringify(args, (key, value) => {
      if (typeof key === 'string' && /token|secret|password|key|auth/i.test(key)) return '[REDACTED]';
      if (typeof value === 'string' && value.length > 512) return value.slice(0, 512) + '…';
      return value;
    }).slice(0, 2048);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Generic span wrapper for synchronous and async methods.
 */
function wrapMethod(instance, methodName, fn) {
  return function tracedMethod(...args) {
    const spanName = `${MODULE_NAME}.${methodName}`;
    const span = tracer.startSpan(spanName, {
      attributes: {
        'heady.module':     MODULE_NAME,
        'heady.method':     methodName,
        'heady.args':       sanitizeArgs(args),
        'agent.id':         instance.agentId || 'unknown',
        'agent.protocol_version': instance.protocolVersion || '1.0',
      },
    }, context.active());

    const startMs = Date.now();

    const finish = (success, err) => {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', success);
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: methodName, success: String(success) });
      if (err) {
        protocolErrorsTotal.add(1, { module: MODULE_NAME, method: methodName });
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
    };

    try {
      const result = fn.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then(
          (val) => { finish(true, null); return val; },
          (err) => { finish(false, err); return Promise.reject(err); }
        );
      }
      finish(true, null);
      return result;
    } catch (err) {
      finish(false, err);
      throw err;
    }
  };
}

// ─── Load original module ─────────────────────────────────────────────────────
const OriginalAgentProtocolAdapter = require('../lib/agent-protocol');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedAgentProtocolAdapter extends OriginalAgentProtocolAdapter {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'constructor',
        'agent.id':     opts.agentId || 'heady-agent',
      },
    }, context.active());
    try {
      super(opts);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      protocolErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  getAgentCard() {
    return wrapMethod(this, 'getAgentCard', super.getAgentCard).call(this);
  }

  fromA2A(task) {
    const span = tracer.startSpan(`${MODULE_NAME}.fromA2A`, {
      attributes: {
        'heady.module':  MODULE_NAME,
        'heady.method':  'fromA2A',
        'a2a.task_id':   task?.id || 'unknown',
        'a2a.history_len': (task?.history || []).length,
        'heady.args':    sanitizeArgs([task]),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = super.fromA2A(task);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('a2a.messages_count', result?.messages?.length || 0);
      span.setStatus({ code: SpanStatusCode.OK });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'fromA2A', success: 'true' });
      a2aTasksTotal.add(1, { direction: 'from', module: MODULE_NAME });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      protocolErrorsTotal.add(1, { module: MODULE_NAME, method: 'fromA2A' });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'fromA2A', success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  toA2A(result) {
    const span = tracer.startSpan(`${MODULE_NAME}.toA2A`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'toA2A',
        'a2a.result_id': result?.id || 'unknown',
        'a2a.has_error':  String(!!result?.error),
        'heady.args':    sanitizeArgs([result]),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const a2aResult = super.toA2A(result);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('a2a.artifacts_count', a2aResult?.artifacts?.length || 0);
      span.setAttribute('a2a.final_state', a2aResult?.status?.state || 'unknown');
      span.setStatus({ code: SpanStatusCode.OK });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'toA2A', success: 'true' });
      a2aTasksTotal.add(1, { direction: 'to', module: MODULE_NAME });
      return a2aResult;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      protocolErrorsTotal.add(1, { module: MODULE_NAME, method: 'toA2A' });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'toA2A', success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  toAGUIEvents(result) {
    const span = tracer.startSpan(`${MODULE_NAME}.toAGUIEvents`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'toAGUIEvents',
        'agui.has_thinking':  String(!!result?.thinking),
        'agui.tool_calls':    String((result?.toolCalls || []).length),
        'heady.args':         sanitizeArgs([result]),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const events = super.toAGUIEvents(result);
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('agui.events_count', events.length);
      span.setStatus({ code: SpanStatusCode.OK });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'toAGUIEvents', success: 'true' });

      // Count each event type
      for (const evt of events) {
        aguiEventsTotal.add(1, { event_type: evt.type || 'UNKNOWN', module: MODULE_NAME });
      }
      return events;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      protocolErrorsTotal.add(1, { module: MODULE_NAME, method: 'toAGUIEvents' });
      protocolDurationMs.record(durationMs, { module: MODULE_NAME, method: 'toAGUIEvents', success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  routes(router) {
    return wrapMethod(this, 'routes', super.routes).call(this, router);
  }
}

// ─── W3C propagation helper (attach to prototype) ────────────────────────────
TracedAgentProtocolAdapter.prototype.extractContext = function(carrier) {
  return propagation.extract(context.active(), carrier);
};

TracedAgentProtocolAdapter.prototype.injectContext = function(carrier) {
  propagation.inject(context.active(), carrier);
  return carrier;
};

module.exports = TracedAgentProtocolAdapter;

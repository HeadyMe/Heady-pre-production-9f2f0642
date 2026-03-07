/**
 * circuit-breaker.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/circuit-breaker.js
 *
 * Metrics:
 *   heady.circuit_state_transitions   — counter  (labelled by from_state/to_state)
 *   heady.circuit_open_duration_ms    — histogram (how long circuit stays open)
 *   heady.rate_limit_rejections_total — counter  (rate-limiter denials)
 *   heady.circuit_execute_duration_ms — histogram (execute() latency)
 *   heady.circuit_errors_total        — counter  (failures recorded by breaker)
 *
 * @module otel-wrappers/circuit-breaker.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'circuit-breaker';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const circuitStateTransitions = meter.createCounter('heady.circuit_state_transitions', {
  description: 'Number of circuit breaker state transitions',
  unit: '{transitions}',
});
const circuitOpenDurationMs = meter.createHistogram('heady.circuit_open_duration_ms', {
  description: 'Duration the circuit remains in OPEN state before recovery attempt',
  unit: 'ms',
});
const rateLimitRejectionsTotal = meter.createCounter('heady.rate_limit_rejections_total', {
  description: 'Token bucket rate-limit rejections',
  unit: '{rejections}',
});
const circuitExecuteDurationMs = meter.createHistogram('heady.circuit_execute_duration_ms', {
  description: 'Execution duration of wrapped functions through the circuit breaker',
  unit: 'ms',
});
const circuitErrorsTotal = meter.createCounter('heady.circuit_errors_total', {
  description: 'Failure count increments inside circuit breaker',
  unit: '{errors}',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeArgs(args) {
  try {
    return JSON.stringify(args, (key, value) => {
      if (typeof key === 'string' && /token|secret|password|key|auth/i.test(key)) return '[REDACTED]';
      if (typeof value === 'function') return '[Function]';
      if (typeof value === 'string' && value.length > 256) return value.slice(0, 256) + '…';
      return value;
    }).slice(0, 1024);
  } catch {
    return '[unserializable]';
  }
}

// ─── Load originals ───────────────────────────────────────────────────────────
const { CircuitBreaker: OriginalCircuitBreaker, TokenBucketRateLimiter: OriginalRateLimiter, STATES } = require('../lib/circuit-breaker');

// ─── Traced CircuitBreaker ────────────────────────────────────────────────────
class TracedCircuitBreaker extends OriginalCircuitBreaker {
  constructor(opts = {}) {
    super(opts);
    this._openedAt = null; // track when circuit entered OPEN
  }

  async execute(fn) {
    const prevState = this.state;
    const span = tracer.startSpan(`${MODULE_NAME}.execute`, {
      attributes: {
        'heady.module':             MODULE_NAME,
        'heady.method':             'execute',
        'circuit.state_before':     prevState,
        'circuit.failure_count':    this._failures,
        'circuit.failure_threshold': this.failureThreshold,
        'circuit.recovery_timeout_ms': this.recoveryTimeout,
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super.execute(fn);
      const durationMs = Date.now() - startMs;
      const newState = this.state;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setAttribute('circuit.state_after', newState);
      span.setStatus({ code: SpanStatusCode.OK });

      circuitExecuteDurationMs.record(durationMs, { module: MODULE_NAME, state: prevState, success: 'true' });

      // Detect state transition
      if (prevState !== newState) {
        this._recordStateTransition(prevState, newState);
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const newState = this.state;

      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      span.setAttribute('circuit.state_after', newState);
      span.setAttribute('circuit.failure_count_after', this._failures);

      circuitExecuteDurationMs.record(durationMs, { module: MODULE_NAME, state: prevState, success: 'false' });
      circuitErrorsTotal.add(1, { module: MODULE_NAME, reason: err.message.slice(0, 64) });

      if (prevState !== newState) {
        this._recordStateTransition(prevState, newState);
        if (newState === STATES.OPEN) {
          this._openedAt = Date.now();
        }
      }

      // If circuit opened during this call, start timing open duration
      if (newState === STATES.OPEN && !this._openedAt) {
        this._openedAt = Date.now();
      }

      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  _onSuccess() {
    const prevState = this.state;
    super._onSuccess();
    const newState = this.state;
    if (prevState !== newState) {
      this._recordStateTransition(prevState, newState);
      // Record how long it was open
      if (prevState === STATES.OPEN || prevState === STATES.HALF_OPEN) {
        if (this._openedAt) {
          circuitOpenDurationMs.record(Date.now() - this._openedAt, { module: MODULE_NAME });
          this._openedAt = null;
        }
      }
    }
  }

  _onFailure() {
    const prevState = this.state;
    super._onFailure();
    const newState = this.state;
    if (prevState !== newState) {
      this._recordStateTransition(prevState, newState);
      if (newState === STATES.OPEN) {
        this._openedAt = Date.now();
      }
    }
  }

  _recordStateTransition(from, to) {
    const span = tracer.startSpan(`${MODULE_NAME}.state_transition`, {
      attributes: {
        'heady.module':          MODULE_NAME,
        'circuit.from_state':    from,
        'circuit.to_state':      to,
        'circuit.failure_count': this._failures,
      },
    }, context.active());
    circuitStateTransitions.add(1, { from_state: from, to_state: to, module: MODULE_NAME });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  getState() {
    const span = tracer.startSpan(`${MODULE_NAME}.getState`, {
      attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'getState' },
    }, context.active());
    try {
      const result = super.getState();
      span.setAttribute('circuit.state', result.state);
      span.setAttribute('circuit.failures', result.failures);
      span.setAttribute('circuit.successes', result.successes);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } finally {
      span.end();
    }
  }

  reset() {
    const prevState = this.state;
    const span = tracer.startSpan(`${MODULE_NAME}.reset`, {
      attributes: {
        'heady.module':         MODULE_NAME,
        'heady.method':         'reset',
        'circuit.state_before': prevState,
      },
    }, context.active());
    try {
      super.reset();
      if (prevState === STATES.OPEN) {
        if (this._openedAt) {
          circuitOpenDurationMs.record(Date.now() - this._openedAt, { module: MODULE_NAME, reason: 'manual_reset' });
          this._openedAt = null;
        }
      }
      this._recordStateTransition(prevState, STATES.CLOSED);
      span.setAttribute('circuit.state_after', STATES.CLOSED);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }
}

// ─── Traced TokenBucketRateLimiter ────────────────────────────────────────────
class TracedTokenBucketRateLimiter extends OriginalRateLimiter {
  consume(key, tokens = 1) {
    const span = tracer.startSpan(`${MODULE_NAME}.ratelimiter.consume`, {
      attributes: {
        'heady.module':      MODULE_NAME,
        'heady.method':      'consume',
        'ratelimit.key':     typeof key === 'string' ? key.slice(0, 128) : String(key),
        'ratelimit.tokens_requested': tokens,
        'ratelimit.rate':    this.rate,
        'ratelimit.burst':   this.burst,
      },
    }, context.active());

    try {
      const result = super.consume(key, tokens);
      span.setAttribute('ratelimit.allowed',   result.allowed);
      span.setAttribute('ratelimit.remaining', result.remaining ?? 0);
      if (!result.allowed) {
        span.setAttribute('ratelimit.retry_after_s', result.retryAfter ?? 0);
        rateLimitRejectionsTotal.add(1, { module: MODULE_NAME, key: typeof key === 'string' ? key.slice(0, 64) : 'unknown' });
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Rate limit exceeded' });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      return result;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  // middleware() is inherited and delegates to traced consume()
}

// ─── W3C propagation helpers ──────────────────────────────────────────────────
TracedCircuitBreaker.prototype.extractContext = function(carrier) {
  return propagation.extract(context.active(), carrier);
};
TracedCircuitBreaker.prototype.injectContext = function(carrier) {
  propagation.inject(context.active(), carrier);
  return carrier;
};

module.exports = {
  CircuitBreaker:         TracedCircuitBreaker,
  TokenBucketRateLimiter: TracedTokenBucketRateLimiter,
  STATES,
};

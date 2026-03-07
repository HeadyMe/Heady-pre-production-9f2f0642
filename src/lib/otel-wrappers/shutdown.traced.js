/**
 * shutdown.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/shutdown.js
 *
 * NOTE: shutdown.js exports a singleton (new ShutdownManager()).
 *       This wrapper proxies the singleton's public API.
 *
 * Metrics:
 *   heady.shutdown_hooks_total     — gauge/counter (registered hook count at shutdown time)
 *   heady.shutdown_duration_ms     — histogram (total graceful shutdown duration)
 *   heady.shutdown_errors_total    — counter  (hook execution failures)
 *   heady.shutdown_hook_duration_ms — histogram (per-hook execution time)
 *
 * @module otel-wrappers/shutdown.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'shutdown';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const shutdownHooksTotal = meter.createCounter('heady.shutdown_hooks_total', {
  description: 'Total number of shutdown hooks registered over process lifetime',
  unit: '{hooks}',
});
const shutdownDurationMs = meter.createHistogram('heady.shutdown_duration_ms', {
  description: 'Total graceful shutdown sequence duration',
  unit: 'ms',
});
const shutdownErrorsTotal = meter.createCounter('heady.shutdown_errors_total', {
  description: 'Errors thrown by shutdown hooks during graceful shutdown',
  unit: '{errors}',
});
const shutdownHookDurationMs = meter.createHistogram('heady.shutdown_hook_duration_ms', {
  description: 'Per-hook execution duration during graceful shutdown',
  unit: 'ms',
});

// ─── Load original singleton ──────────────────────────────────────────────────
const originalManager = require('../lib/shutdown');

// ─── Intercept the internal _shutdown to instrument hook execution ────────────
// We monkey-patch _shutdown on the singleton instance to add timing + spans.
// This is safe because we only call it once (graceful shutdown is a one-time event).
const _originalShutdown = originalManager._shutdown.bind(originalManager);
originalManager._shutdown = async function tracedShutdown(signal) {
  if (this._shuttingDown) return; // guard already in original
  // Mark as shutting down immediately (same as original guard)
  this._shuttingDown = true;

  const shutdownSpan = tracer.startSpan(`${MODULE_NAME}._shutdown`, {
    attributes: {
      'heady.module':          MODULE_NAME,
      'heady.method':          '_shutdown',
      'shutdown.signal':        signal,
      'shutdown.hooks_count':   this._hooks.length,
    },
  }, context.active());

  const shutdownStart = Date.now();
  console.log(`[SHUTDOWN:traced] Received ${signal}, starting graceful shutdown (${this._hooks.length} hooks)...`);

  const timeout = setTimeout(() => {
    console.error('[SHUTDOWN:traced] Timeout exceeded, forcing exit');
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10));
  timeout.unref();

  let hookErrors = 0;

  for (const hook of this._hooks) {
    const hookSpan = tracer.startSpan(`${MODULE_NAME}.hook.${hook.name}`, {
      attributes: {
        'heady.module':    MODULE_NAME,
        'heady.method':    `hook.${hook.name}`,
        'shutdown.signal': signal,
        'hook.name':       hook.name,
        'hook.priority':   hook.priority,
      },
    }, context.active());

    const hookStart = Date.now();
    try {
      console.log(`[SHUTDOWN:traced] Running: ${hook.name}`);
      await Promise.resolve(hook.fn());
      const durationMs = Date.now() - hookStart;
      hookSpan.setAttribute('heady.duration_ms', durationMs);
      hookSpan.setAttribute('heady.success',     true);
      hookSpan.setStatus({ code: SpanStatusCode.OK });
      shutdownHookDurationMs.record(durationMs, { module: MODULE_NAME, hook: hook.name, success: 'true' });
      console.log(`[SHUTDOWN:traced] Done: ${hook.name} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = Date.now() - hookStart;
      hookErrors++;
      hookSpan.setAttribute('heady.duration_ms', durationMs);
      hookSpan.setAttribute('heady.success',     false);
      hookSpan.recordException(err);
      hookSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      shutdownErrorsTotal.add(1, { module: MODULE_NAME, hook: hook.name });
      shutdownHookDurationMs.record(durationMs, { module: MODULE_NAME, hook: hook.name, success: 'false' });
      console.error(`[SHUTDOWN:traced] Error in ${hook.name}: ${err.message}`);
    } finally {
      hookSpan.end();
    }
  }

  const totalDurationMs = Date.now() - shutdownStart;
  shutdownDurationMs.record(totalDurationMs, { module: MODULE_NAME, signal, hooks_errors: String(hookErrors) });

  shutdownSpan.setAttribute('heady.duration_ms',      totalDurationMs);
  shutdownSpan.setAttribute('heady.success',           true);
  shutdownSpan.setAttribute('shutdown.hook_errors',    hookErrors);
  shutdownSpan.setAttribute('shutdown.hooks_run',      this._hooks.length);
  shutdownSpan.setStatus({ code: SpanStatusCode.OK });
  shutdownSpan.end();

  console.log(`[SHUTDOWN:traced] All hooks complete (${hookErrors} errors, ${totalDurationMs}ms total), exiting`);
  clearTimeout(timeout);
  process.exit(hookErrors > 0 ? 1 : 0);
};

// ─── Proxy public API ─────────────────────────────────────────────────────────

function register(name, fn, priority = 10) {
  const span = tracer.startSpan(`${MODULE_NAME}.register`, {
    attributes: {
      'heady.module':    MODULE_NAME,
      'heady.method':    'register',
      'hook.name':       name,
      'hook.priority':   priority,
    },
  }, context.active());
  try {
    const result = originalManager.register(name, fn, priority);
    span.setAttribute('heady.success',    true);
    span.setAttribute('hooks.total',       originalManager._hooks.length);
    span.setStatus({ code: SpanStatusCode.OK });
    shutdownHooksTotal.add(1, { module: MODULE_NAME, hook: name });
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

// ─── isShuttingDown getter proxy ──────────────────────────────────────────────
function isShuttingDown() {
  return originalManager.isShuttingDown;
}

// ─── W3C propagation helpers ──────────────────────────────────────────────────
function extractContext(carrier) { return propagation.extract(context.active(), carrier); }
function injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }

// ─── Export as singleton proxy (same shape as original) ───────────────────────
const tracedManager = {
  register,
  get isShuttingDown() { return originalManager.isShuttingDown; },
  extractContext,
  injectContext,
  // Expose original for direct access if needed
  _original: originalManager,
};

module.exports = tracedManager;

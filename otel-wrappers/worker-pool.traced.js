/**
 * worker-pool.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/worker-pool.js
 *
 * Metrics:
 *   heady.pool_tasks_dispatched     — counter  (execute() calls submitted)
 *   heady.pool_workers_active_gauge — observable gauge (current active worker count)
 *   heady.pool_task_duration_ms     — histogram (task execution latency)
 *   heady.pool_task_errors_total    — counter  (task rejections / exceptions)
 *   heady.pool_queue_depth          — histogram (queue depth at dispatch time)
 *
 * @module otel-wrappers/worker-pool.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'worker-pool';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Load originals ───────────────────────────────────────────────────────────
const { WorkerPool: OriginalWorkerPool, batchEmbed: originalBatchEmbed } = require('../lib/worker-pool');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const poolTasksDispatched = meter.createCounter('heady.pool_tasks_dispatched', {
  description: 'Total tasks dispatched to the worker pool',
  unit: '{tasks}',
});
const poolTaskDurationMs = meter.createHistogram('heady.pool_task_duration_ms', {
  description: 'Worker task execution latency from dispatch to completion',
  unit: 'ms',
});
const poolTaskErrorsTotal = meter.createCounter('heady.pool_task_errors_total', {
  description: 'Worker task failures',
  unit: '{errors}',
});
const poolQueueDepth = meter.createHistogram('heady.pool_queue_depth', {
  description: 'Queue depth at the time a task is dispatched',
  unit: '{tasks}',
});

// ─── Traced WorkerPool ────────────────────────────────────────────────────────
class TracedWorkerPool extends OriginalWorkerPool {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module':   MODULE_NAME,
        'heady.method':   'constructor',
        'pool.size':      opts.size || 0, // actual default resolved in super
      },
    }, context.active());
    try {
      super(opts);
      span.setAttribute('pool.actual_size', this.size);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      poolTaskErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }

    // Register observable gauge — callback captures `this`
    meter.createObservableGauge('heady.pool_workers_active_gauge', {
      description: 'Number of currently active workers in the pool',
      unit: '{workers}',
    }).addCallback((result) => {
      result.observe(this.activeJobs, { module: MODULE_NAME, pool_size: this.size });
    });
  }

  async execute(taskFn, data) {
    const queueDepth = this.queue.length;
    const span = tracer.startSpan(`${MODULE_NAME}.execute`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'execute',
        'pool.size':          this.size,
        'pool.active_jobs':   this.activeJobs,
        'pool.queue_depth':   queueDepth,
        'task.fn_length':     taskFn?.toString?.().length || 0,
        'task.data_type':     typeof data,
        'task.queued':        String(this.activeJobs >= this.size),
      },
    }, context.active());

    const startMs = Date.now();
    poolTasksDispatched.add(1, { module: MODULE_NAME, queued: String(this.activeJobs >= this.size) });
    poolQueueDepth.record(queueDepth, { module: MODULE_NAME });

    try {
      const result = await super.execute(taskFn, data);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms',     durationMs);
      span.setAttribute('heady.success',          true);
      span.setAttribute('pool.active_after',      this.activeJobs);
      span.setAttribute('pool.queue_depth_after', this.queue.length);
      span.setStatus({ code: SpanStatusCode.OK });

      poolTaskDurationMs.record(durationMs, { module: MODULE_NAME, success: 'true' });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      poolTaskErrorsTotal.add(1, { module: MODULE_NAME, reason: err.message.slice(0, 64) });
      poolTaskDurationMs.record(durationMs, { module: MODULE_NAME, success: 'false' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  getStats() {
    const span = tracer.startSpan(`${MODULE_NAME}.getStats`, {
      attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'getStats' },
    }, context.active());
    try {
      const stats = super.getStats();
      span.setAttribute('pool.size',   stats.poolSize);
      span.setAttribute('pool.active', stats.active);
      span.setAttribute('pool.queued', stats.queued);
      span.setAttribute('heady.success', true);
      span.setStatus({ code: SpanStatusCode.OK });
      return stats;
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async terminate() {
    const span = tracer.startSpan(`${MODULE_NAME}.terminate`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'terminate',
        'pool.workers_count': this.workers.length,
        'pool.active_jobs':   this.activeJobs,
      },
    }, context.active());
    const startMs = Date.now();
    try {
      await super.terminate();
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', true);
      span.setStatus({ code: SpanStatusCode.OK });
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

  // W3C propagation helpers
  extractContext(carrier) { return propagation.extract(context.active(), carrier); }
  injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }
}

// ─── Traced batchEmbed ────────────────────────────────────────────────────────
async function batchEmbed(texts, embedFn, opts = {}) {
  const span = tracer.startSpan(`${MODULE_NAME}.batchEmbed`, {
    attributes: {
      'heady.module':       MODULE_NAME,
      'heady.method':       'batchEmbed',
      'batch.texts_count':  Array.isArray(texts) ? texts.length : 0,
      'batch.batch_size':   opts.batchSize || 100,
      'batch.concurrency':  opts.concurrency || 4,
    },
  }, context.active());

  const startMs = Date.now();
  poolTasksDispatched.add(Array.isArray(texts) ? texts.length : 0, { module: MODULE_NAME, method: 'batchEmbed' });

  try {
    const results = await originalBatchEmbed(texts, embedFn, opts);
    const durationMs = Date.now() - startMs;

    span.setAttribute('heady.duration_ms',     durationMs);
    span.setAttribute('heady.success',          true);
    span.setAttribute('batch.results_count',    Array.isArray(results) ? results.length : 0);
    span.setStatus({ code: SpanStatusCode.OK });

    poolTaskDurationMs.record(durationMs, { module: MODULE_NAME, method: 'batchEmbed', success: 'true' });
    return results;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    span.setAttribute('heady.duration_ms', durationMs);
    span.setAttribute('heady.success', false);
    poolTaskErrorsTotal.add(1, { module: MODULE_NAME, method: 'batchEmbed' });
    poolTaskDurationMs.record(durationMs, { module: MODULE_NAME, method: 'batchEmbed', success: 'false' });
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();
  }
}

module.exports = { WorkerPool: TracedWorkerPool, batchEmbed };

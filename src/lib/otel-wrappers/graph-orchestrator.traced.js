/**
 * graph-orchestrator.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/graph-orchestrator.js
 *
 * Metrics:
 *   heady.graph_steps_total        — counter  (node executions per graph run)
 *   heady.graph_run_duration_ms    — histogram (full graph run latency)
 *   heady.node_errors_total        — counter  (node execution failures)
 *   heady.graph_edge_transitions   — counter  (edge traversals labelled by from/to)
 *   heady.graph_parallel_branches  — counter  (runParallel() branch dispatches)
 *
 * @module otel-wrappers/graph-orchestrator.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'graph-orchestrator';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const graphStepsTotal = meter.createCounter('heady.graph_steps_total', {
  description: 'Total node executions across all graph runs',
  unit: '{steps}',
});
const graphRunDurationMs = meter.createHistogram('heady.graph_run_duration_ms', {
  description: 'Total graph run duration from entry to completion',
  unit: 'ms',
});
const nodeErrorsTotal = meter.createCounter('heady.node_errors_total', {
  description: 'Node execution errors (exceptions thrown in node functions)',
  unit: '{errors}',
});
const graphEdgeTransitions = meter.createCounter('heady.graph_edge_transitions', {
  description: 'Edge traversals between nodes',
  unit: '{transitions}',
});
const graphParallelBranches = meter.createCounter('heady.graph_parallel_branches', {
  description: 'Branches dispatched in runParallel()',
  unit: '{branches}',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeState(state) {
  try {
    return JSON.stringify(state, (key, value) => {
      if (typeof key === 'string' && /token|secret|password|key|auth/i.test(key)) return '[REDACTED]';
      if (typeof value === 'string' && value.length > 256) return value.slice(0, 256) + '…';
      return value;
    }).slice(0, 1024);
  } catch {
    return '[unserializable]';
  }
}

// ─── Load original ────────────────────────────────────────────────────────────
const OriginalGraphOrchestrator = require('../lib/graph-orchestrator');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedGraphOrchestrator extends OriginalGraphOrchestrator {
  constructor(name) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'constructor',
        'graph.name':   name || 'unnamed',
      },
    }, context.active());
    try {
      super(name);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      nodeErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  addNode(name, fn) {
    // Wrap the node function to emit per-node spans and metrics
    const tracedFn = async (state) => {
      const nodeSpan = tracer.startSpan(`${MODULE_NAME}.node.${name}`, {
        attributes: {
          'heady.module': MODULE_NAME,
          'heady.method': `node.${name}`,
          'graph.name':   this.name,
          'node.name':    name,
          'state.keys':   Object.keys(state || {}).join(',').slice(0, 256),
        },
      }, context.active());
      const startMs = Date.now();
      try {
        const result = await fn(state);
        const durationMs = Date.now() - startMs;
        nodeSpan.setAttribute('heady.duration_ms', durationMs);
        nodeSpan.setAttribute('heady.success',     true);
        nodeSpan.setStatus({ code: SpanStatusCode.OK });
        graphStepsTotal.add(1, { module: MODULE_NAME, graph: this.name, node: name, success: 'true' });
        return result;
      } catch (err) {
        const durationMs = Date.now() - startMs;
        nodeSpan.setAttribute('heady.duration_ms', durationMs);
        nodeSpan.setAttribute('heady.success',     false);
        nodeErrorsTotal.add(1, { module: MODULE_NAME, graph: this.name, node: name });
        graphStepsTotal.add(1, { module: MODULE_NAME, graph: this.name, node: name, success: 'false' });
        nodeSpan.recordException(err);
        nodeSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        nodeSpan.end();
      }
    };
    return super.addNode(name, tracedFn);
  }

  addEdge(from, to) {
    const span = tracer.startSpan(`${MODULE_NAME}.addEdge`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'addEdge',
        'graph.name':   this.name,
        'edge.from':    from,
        'edge.to':      to,
      },
    }, context.active());
    try {
      const result = super.addEdge(from, to);
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

  addConditionalEdge(from, conditionFn) {
    // Wrap condition function to record edge transitions
    const tracedConditionFn = async (state) => {
      const to = await conditionFn(state);
      graphEdgeTransitions.add(1, { module: MODULE_NAME, graph: this.name, from, to: String(to) });
      return to;
    };
    return super.addConditionalEdge(from, tracedConditionFn);
  }

  setEntryPoint(name) {
    const span = tracer.startSpan(`${MODULE_NAME}.setEntryPoint`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'setEntryPoint',
        'graph.name':   this.name,
        'graph.entry':  name,
      },
    }, context.active());
    try {
      const result = super.setEntryPoint(name);
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

  async run(initialState = {}, opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.run`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'run',
        'graph.name':         this.name,
        'graph.entry_point':  this.entryPoint || 'none',
        'graph.nodes_count':  this.nodes.size,
        'graph.max_steps':    opts.maxSteps || 50,
        'graph.initial_state': sanitizeState(initialState),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super.run(initialState, opts);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms',  durationMs);
      span.setAttribute('heady.success',       true);
      span.setAttribute('graph.steps',         result.steps);
      span.setAttribute('graph.completed',     result.completed);
      span.setAttribute('graph.trace_length',  result.trace?.length || 0);
      span.setAttribute('graph.error_nodes',   result.trace?.filter(t => !t.success).length || 0);

      graphRunDurationMs.record(durationMs, {
        module:    MODULE_NAME,
        graph:     this.name,
        completed: String(result.completed),
        success:   'true',
      });

      // Record edge transitions from trace
      const traceArr = result.trace || [];
      for (let i = 0; i < traceArr.length - 1; i++) {
        graphEdgeTransitions.add(1, {
          module: MODULE_NAME,
          graph:  this.name,
          from:   traceArr[i].node,
          to:     traceArr[i + 1].node,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      graphRunDurationMs.record(durationMs, { module: MODULE_NAME, graph: this.name, completed: 'false', success: 'false' });
      nodeErrorsTotal.add(1, { module: MODULE_NAME, graph: this.name, node: 'run' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async runParallel(branches, state) {
    const span = tracer.startSpan(`${MODULE_NAME}.runParallel`, {
      attributes: {
        'heady.module':    MODULE_NAME,
        'heady.method':    'runParallel',
        'graph.name':      this.name,
        'graph.branches':  branches.length,
        'graph.state':     sanitizeState(state),
      },
    }, context.active());

    const startMs = Date.now();
    graphParallelBranches.add(branches.length, { module: MODULE_NAME, graph: this.name });

    try {
      const results = await super.runParallel(branches, state);
      const durationMs = Date.now() - startMs;
      const errors = results.filter(r => r.error).length;
      span.setAttribute('heady.duration_ms',   durationMs);
      span.setAttribute('heady.success',        true);
      span.setAttribute('graph.branches_ok',    results.length - errors);
      span.setAttribute('graph.branches_err',   errors);
      span.setStatus({ code: SpanStatusCode.OK });
      graphRunDurationMs.record(durationMs, { module: MODULE_NAME, graph: this.name + ':parallel', completed: 'true', success: 'true' });
      return results;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      nodeErrorsTotal.add(1, { module: MODULE_NAME, graph: this.name, node: 'runParallel' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  toJSON() {
    const span = tracer.startSpan(`${MODULE_NAME}.toJSON`, {
      attributes: { 'heady.module': MODULE_NAME, 'heady.method': 'toJSON', 'graph.name': this.name },
    }, context.active());
    try {
      const result = super.toJSON();
      span.setAttribute('graph.nodes', result.nodes?.length || 0);
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

  // W3C propagation helpers
  extractContext(carrier) { return propagation.extract(context.active(), carrier); }
  injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }
}

module.exports = TracedGraphOrchestrator;

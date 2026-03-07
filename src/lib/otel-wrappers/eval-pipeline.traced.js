/**
 * eval-pipeline.traced.js — OpenTelemetry tracing wrapper
 * Drop-in replacement for src/lib/eval-pipeline.js
 *
 * Metrics:
 *   heady.eval_score_distribution  — histogram (judge scores 0–1)
 *   heady.eval_pass_rate           — counter of pass/fail outcomes
 *   heady.eval_judge_duration_ms   — histogram (per-judge execution latency)
 *   heady.eval_errors_total        — counter (judge exceptions)
 *   heady.eval_runs_total          — counter (evaluate() calls)
 *
 * @module otel-wrappers/eval-pipeline.traced
 */
'use strict';

const { trace, context, SpanStatusCode, metrics, propagation } = require('@opentelemetry/api');

const MODULE_NAME = 'eval-pipeline';
const tracer = trace.getTracer('heady.' + MODULE_NAME, '3.1.0');
const meter  = metrics.getMeter('heady.' + MODULE_NAME, '3.1.0');

// ─── Metrics ──────────────────────────────────────────────────────────────────
const evalScoreDistribution = meter.createHistogram('heady.eval_score_distribution', {
  description: 'Distribution of judge scores (0 to 1)',
  unit: '1',
});
const evalPassRate = meter.createCounter('heady.eval_pass_rate', {
  description: 'Evaluation pass/fail outcomes (labelled by result)',
  unit: '{evaluations}',
});
const evalJudgeDurationMs = meter.createHistogram('heady.eval_judge_duration_ms', {
  description: 'Per-judge execution latency',
  unit: 'ms',
});
const evalErrorsTotal = meter.createCounter('heady.eval_errors_total', {
  description: 'Judge exceptions during evaluation',
  unit: '{errors}',
});
const evalRunsTotal = meter.createCounter('heady.eval_runs_total', {
  description: 'Total evaluate() calls',
  unit: '{runs}',
});

// ─── Helper ───────────────────────────────────────────────────────────────────
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

// ─── Load original ────────────────────────────────────────────────────────────
const OriginalEvalPipeline = require('../lib/eval-pipeline');

// ─── Traced subclass ──────────────────────────────────────────────────────────
class TracedEvalPipeline extends OriginalEvalPipeline {
  constructor(opts = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.constructor`, {
      attributes: {
        'heady.module':    MODULE_NAME,
        'heady.method':    'constructor',
        'eval.threshold':  opts.threshold || 0.7,
        'eval.ci_mode':    String(!!(opts.ciMode || process.env.CI === 'true')),
      },
    }, context.active());
    try {
      super(opts);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      evalErrorsTotal.add(1, { module: MODULE_NAME, method: 'constructor' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  addJudge(name, judgeFn) {
    const span = tracer.startSpan(`${MODULE_NAME}.addJudge`, {
      attributes: {
        'heady.module': MODULE_NAME,
        'heady.method': 'addJudge',
        'judge.name':   name,
      },
    }, context.active());
    try {
      // Wrap judgeFn to emit per-judge metrics and spans
      const originalJudgeFn = judgeFn;
      const tracedJudgeFn = async (output, ctx) => {
        const judgeSpan = tracer.startSpan(`${MODULE_NAME}.judge.${name}`, {
          attributes: {
            'heady.module':  MODULE_NAME,
            'heady.method':  `judge.${name}`,
            'judge.name':    name,
            'judge.has_ctx': String(!!ctx && Object.keys(ctx).length > 0),
          },
        }, context.active());
        const judgeStart = Date.now();
        try {
          const score = await originalJudgeFn(output, ctx);
          const durationMs = Date.now() - judgeStart;
          const normalized = Math.max(0, Math.min(1, score));
          judgeSpan.setAttribute('judge.score',       normalized);
          judgeSpan.setAttribute('judge.pass',         normalized >= this.threshold);
          judgeSpan.setAttribute('heady.duration_ms', durationMs);
          judgeSpan.setStatus({ code: SpanStatusCode.OK });
          evalScoreDistribution.record(normalized, { judge: name, module: MODULE_NAME });
          evalJudgeDurationMs.record(durationMs, { judge: name, module: MODULE_NAME, pass: String(normalized >= this.threshold) });
          return score;
        } catch (err) {
          const durationMs = Date.now() - judgeStart;
          judgeSpan.setAttribute('heady.duration_ms', durationMs);
          judgeSpan.setAttribute('heady.success', false);
          evalErrorsTotal.add(1, { judge: name, module: MODULE_NAME });
          evalJudgeDurationMs.record(durationMs, { judge: name, module: MODULE_NAME, pass: 'false' });
          judgeSpan.recordException(err);
          judgeSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          throw err;
        } finally {
          judgeSpan.end();
        }
      };
      const result = super.addJudge(name, tracedJudgeFn);
      span.setAttribute('eval.judges_count', this.judges.length);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      evalErrorsTotal.add(1, { module: MODULE_NAME, method: 'addJudge' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  async evaluate(agentOutput, ctx = {}) {
    const span = tracer.startSpan(`${MODULE_NAME}.evaluate`, {
      attributes: {
        'heady.module':       MODULE_NAME,
        'heady.method':       'evaluate',
        'eval.judges_count':  this.judges.length,
        'eval.threshold':     this.threshold,
        'eval.ci_mode':       String(this.ciMode),
        'heady.args':         sanitizeArgs([typeof agentOutput === 'string' ? agentOutput.slice(0, 200) : agentOutput, ctx]),
      },
    }, context.active());

    const startMs = Date.now();
    try {
      const result = await super.evaluate(agentOutput, ctx);
      const durationMs = Date.now() - startMs;

      span.setAttribute('heady.duration_ms',    durationMs);
      span.setAttribute('heady.success',         true);
      span.setAttribute('eval.overall_score',    result.overall);
      span.setAttribute('eval.pass',             result.pass);
      span.setAttribute('eval.results_count',    result.results?.length || 0);

      evalRunsTotal.add(1, { module: MODULE_NAME, pass: String(result.pass) });
      evalPassRate.add(1, { module: MODULE_NAME, outcome: result.pass ? 'pass' : 'fail' });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      span.setAttribute('heady.duration_ms', durationMs);
      span.setAttribute('heady.success', false);
      evalErrorsTotal.add(1, { module: MODULE_NAME, method: 'evaluate' });
      evalRunsTotal.add(1, { module: MODULE_NAME, pass: 'error' });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  }

  // ── Static judges — wrap to emit metrics too ─────────────────────────────
  static relevanceJudge(output, ctx) {
    return OriginalEvalPipeline.relevanceJudge(output, ctx);
  }

  static faithfulnessJudge(output, ctx) {
    return OriginalEvalPipeline.faithfulnessJudge(output, ctx);
  }

  static safetyJudge(output) {
    return OriginalEvalPipeline.safetyJudge(output);
  }

  static trajectoryJudge(output, ctx) {
    return OriginalEvalPipeline.trajectoryJudge(output, ctx);
  }

  static createDefault() {
    const pipeline = new TracedEvalPipeline();
    pipeline.addJudge('relevance',    TracedEvalPipeline.relevanceJudge);
    pipeline.addJudge('faithfulness', TracedEvalPipeline.faithfulnessJudge);
    pipeline.addJudge('safety',       TracedEvalPipeline.safetyJudge);
    pipeline.addJudge('trajectory',   TracedEvalPipeline.trajectoryJudge);
    return pipeline;
  }

  // W3C propagation helpers
  extractContext(carrier) { return propagation.extract(context.active(), carrier); }
  injectContext(carrier)  { propagation.inject(context.active(), carrier); return carrier; }
}

module.exports = TracedEvalPipeline;

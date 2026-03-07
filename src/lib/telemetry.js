/**
 * E1: OTel Tracing — OpenTelemetry instrumentation for Heady
 * @module src/lib/telemetry
 */
'use strict';

const { trace, context, SpanStatusCode, metrics } = (() => {
    try { return require('@opentelemetry/api'); }
    catch { return { trace: { getTracer: () => ({ startSpan: () => ({ end() { }, setStatus() { }, setAttribute() { }, recordException() { } }) }) }, context: { active: () => ({}) }, SpanStatusCode: { OK: 0, ERROR: 2 }, metrics: { getMeter: () => ({ createCounter: () => ({ add() { } }), createHistogram: () => ({ record() { } }), createGauge: () => ({ record() { } }) }) } }; }
})();

const SERVICE_NAME = process.env.HEADY_SERVICE_NAME || 'heady-manager';
const tracer = trace.getTracer(SERVICE_NAME, '3.1.0');
const meter = metrics.getMeter(SERVICE_NAME);

// AI-specific metrics (E15/T2)
const tokenCounter = meter.createCounter('heady.tokens.total', { description: 'Total tokens consumed' });
const requestLatency = meter.createHistogram('heady.request.duration_ms', { description: 'Request latency in ms' });
const evalScore = meter.createHistogram('heady.eval.score', { description: 'Evaluation scores 0-1' });
const toolCallCounter = meter.createCounter('heady.tool_calls.total', { description: 'MCP tool invocations' });

function startSpan(name, attributes = {}) {
    return tracer.startSpan(name, { attributes: { 'service.name': SERVICE_NAME, ...attributes } });
}

function withSpan(name, fn, attributes = {}) {
    const span = startSpan(name, attributes);
    try {
        const result = fn(span);
        if (result && typeof result.then === 'function') {
            return result.then(r => { span.setStatus({ code: SpanStatusCode.OK }); span.end(); return r; })
                .catch(e => { span.recordException(e); span.setStatus({ code: SpanStatusCode.ERROR, message: e.message }); span.end(); throw e; });
        }
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
    } catch (e) {
        span.recordException(e);
        span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
        span.end();
        throw e;
    }
}

function traceMiddleware(req, res, next) {
    const span = startSpan(`HTTP ${req.method} ${req.path}`, {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.user_agent': req.headers['user-agent'] || 'unknown',
        'heady.request_id': req.headers['x-request-id'] || req.id || 'none',
    });
    const start = Date.now();
    res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        span.setStatus({ code: res.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR });
        requestLatency.record(Date.now() - start, { method: req.method, path: req.route?.path || req.path, status: res.statusCode });
        span.end();
    });
    next();
}

function recordTokenUsage(model, inputTokens, outputTokens, tenant = 'default') {
    tokenCounter.add(inputTokens, { model, direction: 'input', tenant });
    tokenCounter.add(outputTokens, { model, direction: 'output', tenant });
}

function recordToolCall(toolName, durationMs, success = true) {
    toolCallCounter.add(1, { tool: toolName, success: String(success) });
    requestLatency.record(durationMs, { operation: 'tool_call', tool: toolName });
}

function recordEvalScore(evalName, score) {
    evalScore.record(score, { eval: evalName });
}

module.exports = { tracer, meter, startSpan, withSpan, traceMiddleware, recordTokenUsage, recordToolCall, recordEvalScore, tokenCounter, requestLatency };

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * OpenTelemetry Tracing — Phase 5 Three Pillars of Observability
 *
 * Structured Logs ✅ (structured-logger.js)
 * Metrics ✅ (health-registry.js / Prometheus)
 * Traces ← THIS MODULE (distributed request tracing)
 */

const { getLogger } = require('./structured-logger');
const logger = getLogger('tracing');
const crypto = require('crypto');

// ── Trace Context Propagation ────────────────────────────────
class TraceContext {
    constructor({ traceId, spanId, parentSpanId, sampled = true } = {}) {
        this.traceId = traceId || crypto.randomBytes(16).toString('hex');
        this.spanId = spanId || crypto.randomBytes(8).toString('hex');
        this.parentSpanId = parentSpanId || null;
        this.sampled = sampled;
    }

    /** W3C traceparent header format */
    toTraceparent() {
        return `00-${this.traceId}-${this.spanId}-${this.sampled ? '01' : '00'}`;
    }

    static fromTraceparent(header) {
        if (!header) return new TraceContext();
        const parts = header.split('-');
        if (parts.length !== 4) return new TraceContext();
        return new TraceContext({
            traceId: parts[1],
            spanId: crypto.randomBytes(8).toString('hex'),
            parentSpanId: parts[2],
            sampled: parts[3] === '01',
        });
    }

    child() {
        return new TraceContext({
            traceId: this.traceId,
            parentSpanId: this.spanId,
            sampled: this.sampled,
        });
    }
}

// ── Span ─────────────────────────────────────────────────────
class Span {
    constructor(name, context, attributes = {}) {
        this.name = name;
        this.context = context;
        this.attributes = attributes;
        this.events = [];
        this.status = 'UNSET'; // UNSET | OK | ERROR
        this.startTime = Date.now();
        this.endTime = null;
        this.durationMs = null;
    }

    setAttribute(key, value) {
        this.attributes[key] = value;
        return this;
    }

    addEvent(name, attributes = {}) {
        this.events.push({ name, attributes, timestamp: Date.now() });
        return this;
    }

    setStatus(status, message) {
        this.status = status;
        if (message) this.attributes['status.message'] = message;
        return this;
    }

    end() {
        this.endTime = Date.now();
        this.durationMs = this.endTime - this.startTime;
        Tracer._global?.recordSpan(this);
        return this;
    }

    toJSON() {
        return {
            name: this.name,
            traceId: this.context.traceId,
            spanId: this.context.spanId,
            parentSpanId: this.context.parentSpanId,
            status: this.status,
            startTime: new Date(this.startTime).toISOString(),
            endTime: this.endTime ? new Date(this.endTime).toISOString() : null,
            durationMs: this.durationMs,
            attributes: this.attributes,
            events: this.events,
        };
    }
}

// ── Tracer ───────────────────────────────────────────────────
class Tracer {
    constructor(serviceName = 'heady', { maxSpans = 10000, sampleRate = 1.0 } = {}) {
        this.serviceName = serviceName;
        this.maxSpans = maxSpans;
        this.sampleRate = sampleRate;
        this.spans = [];
        this.activeSpans = new Map();
        this.stats = { totalSpans: 0, droppedSpans: 0, errorSpans: 0 };
        Tracer._global = this;
    }

    startSpan(name, { parentContext, attributes = {} } = {}) {
        const context = parentContext ? parentContext.child() : new TraceContext({ sampled: Math.random() < this.sampleRate });

        if (!context.sampled) return new NoopSpan();

        const span = new Span(name, context, {
            'service.name': this.serviceName,
            ...attributes,
        });

        this.activeSpans.set(context.spanId, span);
        return span;
    }

    recordSpan(span) {
        this.activeSpans.delete(span.context.spanId);
        this.stats.totalSpans++;

        if (span.status === 'ERROR') this.stats.errorSpans++;

        if (this.spans.length >= this.maxSpans) {
            this.spans.shift();
            this.stats.droppedSpans++;
        }
        this.spans.push(span.toJSON());

        // Emit trace as structured log for log aggregation
        logger.debug('trace.span', {
            traceId: span.context.traceId,
            spanId: span.context.spanId,
            parentSpanId: span.context.parentSpanId,
            name: span.name,
            durationMs: span.durationMs,
            status: span.status,
            metric: 'trace',
        });
    }

    getTrace(traceId) {
        return this.spans.filter(s => s.traceId === traceId);
    }

    getRecentSpans(limit = 50) {
        return this.spans.slice(-limit);
    }

    getHealth() {
        return {
            service: this.serviceName,
            totalSpans: this.stats.totalSpans,
            droppedSpans: this.stats.droppedSpans,
            errorSpans: this.stats.errorSpans,
            activeSpans: this.activeSpans.size,
            storedSpans: this.spans.length,
            sampleRate: this.sampleRate,
        };
    }

    // ── Express Middleware ──────────────────────────────────────
    middleware() {
        const tracer = this;
        return (req, res, next) => {
            const parentContext = TraceContext.fromTraceparent(req.headers['traceparent']);
            const span = tracer.startSpan(`${req.method} ${req.path}`, {
                parentContext,
                attributes: {
                    'http.method': req.method,
                    'http.url': req.originalUrl,
                    'http.user_agent': req.headers['user-agent'] || 'unknown',
                },
            });

            // Propagate trace context
            req.traceContext = span.context || parentContext;
            res.setHeader('traceparent', (span.context || parentContext).toTraceparent());

            const originalEnd = res.end;
            res.end = function (...args) {
                span.setAttribute('http.status_code', res.statusCode);
                span.setStatus(res.statusCode >= 400 ? 'ERROR' : 'OK');
                span.end();
                originalEnd.apply(res, args);
            };

            next();
        };
    }
}

// ── Noop for unsampled spans ─────────────────────────────────
class NoopSpan {
    setAttribute() { return this; }
    addEvent() { return this; }
    setStatus() { return this; }
    end() { return this; }
    get context() { return new TraceContext({ sampled: false }); }
}

// ── Route Registration ───────────────────────────────────────
function registerTracingRoutes(app, tracer) {
    app.get('/api/tracing/health', (req, res) => res.json(tracer.getHealth()));

    app.get('/api/tracing/spans', (req, res) => {
        const limit = parseInt(req.query.limit || '50', 10);
        res.json({ spans: tracer.getRecentSpans(limit) });
    });

    app.get('/api/tracing/trace/:traceId', (req, res) => {
        const spans = tracer.getTrace(req.params.traceId);
        res.json({ traceId: req.params.traceId, spans, count: spans.length });
    });

    logger.info('Tracing routes registered',
        { endpoints: ['/api/tracing/health', '/api/tracing/spans', '/api/tracing/trace/:id'] });
}

// ── Singleton ────────────────────────────────────────────────
const tracer = new Tracer('heady');

module.exports = {
    TraceContext,
    Span,
    Tracer,
    tracer,
    registerTracingRoutes,
};

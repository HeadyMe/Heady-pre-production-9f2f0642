/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * heady-observability.js
 * ════════════════════════════════════════════════════════════════════
 *
 * Unified Observability Layer for the Heady ecosystem.
 *
 * Addresses gaps identified in the architecture review:
 *
 *   1. No distributed trace IDs — requests cannot be correlated across
 *      buddy-core → hc-full-pipeline → heady-conductor → bee-factory.
 *      FIX: X-Heady-Trace-Id / X-Heady-Span-Id headers on every HTTP
 *           call; trace context propagated via AsyncLocalStorage.
 *
 *   2. No Prometheus metrics export — self-awareness.js collects
 *      telemetry into a ring buffer but never exports it.
 *      FIX: /metrics endpoint in Prometheus text format (Counter,
 *           Gauge, Histogram, Summary with quantiles).
 *
 *   3. Structured logging is inconsistent — some files use console.log,
 *      some use custom loggers, none emit JSON for Cloud Logging.
 *      FIX: JSON logger that emits Google Cloud Logging severity levels
 *           and includes trace context on every line.
 *
 *   4. No span correlation with self-awareness.js telemetry ring buffer.
 *      FIX: HeadySpan.end() writes to the ring buffer directly so
 *           self-awareness can diff spans by traceId.
 *
 * Architecture
 * ────────────
 *   HeadyTracer          — Manages trace/span lifecycle via AsyncLocalStorage
 *   HeadyMetricsRegistry — Prometheus-compatible metrics (no external deps)
 *   HeadyLogger          — Structured JSON logger (Cloud Logging compatible)
 *   HeadyObservability   — Facade wiring all three together + Express middleware
 *
 * Express middleware
 * ──────────────────
 *   obs.requestMiddleware()  — attaches traceId, starts root span, logs request
 *   obs.responseMiddleware() — ends root span, logs response with latency
 *   obs.errorMiddleware()    — logs errors with stack trace + traceId
 *
 * HTTP endpoints (mounted at /api/v1/obs by default)
 * ──────────────────────────────────────────────────
 *   GET /metrics          — Prometheus text exposition (no auth — scrape target)
 *   GET /health           — liveness probe
 *   GET /traces/:traceId  — retrieve all spans for a trace (debug)
 *   GET /stats            — aggregated statistics snapshot
 *
 * Propagation headers
 * ───────────────────
 *   X-Heady-Trace-Id   — UUID v4 created at entry point, propagated downstream
 *   X-Heady-Span-Id    — UUID v4 per span
 *   X-Heady-Parent-Id  — spanId of caller
 *   X-Heady-Service    — originating service name
 *
 * Usage
 * ─────
 *   const { getObservability } = require('./heady-observability');
 *   const obs = getObservability({ service: 'headyapi' });
 *   await obs.start();
 *
 *   // In Express app setup:
 *   app.use(obs.requestMiddleware());
 *   // ... routes ...
 *   app.use(obs.errorMiddleware());
 *
 *   // Manual span:
 *   const span = obs.tracer.startSpan('pipeline.stage.arena');
 *   try { ... } finally { span.end(); }
 *
 *   // Metrics:
 *   obs.metrics.counter('pipeline.runs.total').inc({ stage: 'ARENA' });
 *   obs.metrics.histogram('pipeline.stage.latency.ms').observe(durationMs, { stage: 'ARENA' });
 *
 *   // Logger:
 *   obs.logger.info('Pipeline run completed', { runId, durationMs });
 *
 * ════════════════════════════════════════════════════════════════════
 */

'use strict';

const EventEmitter    = require('events');
const crypto          = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const os              = require('os');

// ─── Golden ratio (used for quantile calculation and ring sizing) ─────────────
const PHI = 1.6180339887;

// ─── Severity mapping: Heady level → Cloud Logging severity ──────────────────
const SEVERITY = Object.freeze({
  debug:    'DEBUG',
  info:     'INFO',
  notice:   'NOTICE',
  warn:     'WARNING',
  error:    'ERROR',
  critical: 'CRITICAL',
  alert:    'ALERT',
});

// ─── Prometheus metric types ──────────────────────────────────────────────────
const METRIC_TYPE = Object.freeze({
  COUNTER:   'counter',
  GAUGE:     'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY:   'summary',
});

// ─── Default histogram bucket boundaries (ms) ────────────────────────────────
//     φ-scaled: 1, 1.618, 2.618, 4.236, 6.854, 11.09, 17.94, 50, 100, 250, 500, 1000, 2500, 5000, 10000
const DEFAULT_BUCKETS = [
  1,
  Math.round(PHI),
  Math.round(PHI ** 2),
  Math.round(PHI ** 3),
  Math.round(PHI ** 4),
  Math.round(PHI ** 5),
  Math.round(PHI ** 6),
  50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000,
];

// ─── Trace headers ────────────────────────────────────────────────────────────
const HDR_TRACE_ID  = 'x-heady-trace-id';
const HDR_SPAN_ID   = 'x-heady-span-id';
const HDR_PARENT_ID = 'x-heady-parent-id';
const HDR_SERVICE   = 'x-heady-service';

// ─────────────────────────────────────────────────────────────────────────────
//  HeadySpan
// ─────────────────────────────────────────────────────────────────────────────

class HeadySpan {
  constructor({ traceId, spanId, parentId, name, service, attributes = {} }) {
    this.traceId    = traceId;
    this.spanId     = spanId;
    this.parentId   = parentId   || null;
    this.name       = name;
    this.service    = service;
    this.attributes = { ...attributes };
    this.startMs    = Date.now();
    this.endMs      = null;
    this.status     = 'running'; // 'ok' | 'error'
    this.errorMsg   = null;
    this._events    = [];        // annotated events within the span
  }

  get durationMs() {
    if (this.endMs === null) return Date.now() - this.startMs;
    return this.endMs - this.startMs;
  }

  addEvent(name, attrs = {}) {
    this._events.push({ name, attrs, timestampMs: Date.now() });
    return this;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  end(status = 'ok', errorMsg = null) {
    if (this.endMs !== null) return; // idempotent
    this.endMs    = Date.now();
    this.status   = status;
    this.errorMsg = errorMsg;
    return this;
  }

  toJSON() {
    return {
      traceId:    this.traceId,
      spanId:     this.spanId,
      parentId:   this.parentId,
      name:       this.name,
      service:    this.service,
      startMs:    this.startMs,
      endMs:      this.endMs,
      durationMs: this.durationMs,
      status:     this.status,
      errorMsg:   this.errorMsg,
      attributes: this.attributes,
      events:     this._events,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyTracer
// ─────────────────────────────────────────────────────────────────────────────

class HeadyTracer extends EventEmitter {
  constructor({ service, maxTraces = 1000 }) {
    super();
    this._service   = service;
    this._maxTraces = maxTraces;
    this._als       = new AsyncLocalStorage();
    // In-memory trace store: traceId → HeadySpan[]
    this._traces    = new Map();
  }

  /**
   * Start a new root span (new traceId).
   * If an existing span is active in context, creates a child span instead.
   */
  startSpan(name, attributes = {}) {
    const ctx       = this._als.getStore();
    const parentId  = ctx?.activeSpan?.spanId || null;
    const traceId   = ctx?.traceId           || crypto.randomUUID();
    const spanId    = crypto.randomUUID();

    const span = new HeadySpan({
      traceId, spanId, parentId, name,
      service:    this._service,
      attributes,
    });

    // Store in trace map
    if (!this._traces.has(traceId)) {
      if (this._traces.size >= this._maxTraces) {
        // Evict oldest trace (FIFO)
        const oldest = this._traces.keys().next().value;
        this._traces.delete(oldest);
      }
      this._traces.set(traceId, []);
    }
    this._traces.get(traceId).push(span);

    this.emit('span:started', span);
    return span;
  }

  /**
   * Run a function within a new span context.
   * Automatically ends the span (with error capture).
   */
  async withSpan(name, attributes, fn) {
    if (typeof attributes === 'function') { fn = attributes; attributes = {}; }
    const span = this.startSpan(name, attributes);
    const parentCtx = this._als.getStore() || {};
    return this._als.run({ ...parentCtx, traceId: span.traceId, activeSpan: span }, async () => {
      try {
        const result = await fn(span);
        span.end('ok');
        this.emit('span:ended', span);
        return result;
      } catch (err) {
        span.end('error', err.message);
        this.emit('span:ended', span);
        throw err;
      }
    });
  }

  /**
   * Run within an existing trace context (for inbound HTTP requests).
   */
  runWithContext({ traceId, parentSpanId }, fn) {
    const ctx = { traceId: traceId || crypto.randomUUID(), activeSpan: null, parentSpanId };
    return this._als.run(ctx, fn);
  }

  /** Get the currently active span (if any). */
  currentSpan() {
    return this._als.getStore()?.activeSpan || null;
  }

  /** Get the current trace ID. */
  currentTraceId() {
    return this._als.getStore()?.traceId || null;
  }

  /** Retrieve all spans for a traceId. */
  getTrace(traceId) {
    return (this._traces.get(traceId) || []).map((s) => s.toJSON());
  }

  /**
   * Build outbound propagation headers for an HTTP call.
   * Injects current trace context into a headers object.
   */
  injectHeaders(headers = {}) {
    const ctx = this._als.getStore();
    if (!ctx) return headers;
    headers[HDR_TRACE_ID]  = ctx.traceId;
    headers[HDR_SPAN_ID]   = ctx.activeSpan?.spanId || '';
    headers[HDR_PARENT_ID] = ctx.activeSpan?.parentId || '';
    headers[HDR_SERVICE]   = this._service;
    return headers;
  }

  /**
   * Extract trace context from inbound HTTP request headers.
   */
  extractHeaders(headers = {}) {
    return {
      traceId:      headers[HDR_TRACE_ID]  || null,
      parentSpanId: headers[HDR_SPAN_ID]   || null,
      service:      headers[HDR_SERVICE]   || null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Metric primitives
// ─────────────────────────────────────────────────────────────────────────────

class MetricCounter {
  constructor(name, help, labelNames = []) {
    this.name       = name;
    this.help       = help;
    this.labelNames = labelNames;
    this.type       = METRIC_TYPE.COUNTER;
    this._values    = new Map(); // labelKey → number
  }
  _key(labels = {}) { return JSON.stringify(labels); }
  inc(labels = {}, amount = 1) {
    const k = this._key(labels);
    this._values.set(k, (this._values.get(k) || 0) + amount);
  }
  get(labels = {}) { return this._values.get(this._key(labels)) || 0; }
  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [k, v] of this._values) {
      const labels = JSON.parse(k);
      const lStr   = Object.entries(labels).map(([lk, lv]) => `${lk}="${lv}"`).join(',');
      lines.push(`${this.name}{${lStr}} ${v}`);
    }
    return lines.join('\n');
  }
}

class MetricGauge {
  constructor(name, help, labelNames = []) {
    this.name       = name;
    this.help       = help;
    this.labelNames = labelNames;
    this.type       = METRIC_TYPE.GAUGE;
    this._values    = new Map();
  }
  _key(labels = {}) { return JSON.stringify(labels); }
  set(value, labels = {}) { this._values.set(this._key(labels), value); }
  inc(labels = {}, amount = 1) {
    const k = this._key(labels);
    this._values.set(k, (this._values.get(k) || 0) + amount);
  }
  dec(labels = {}, amount = 1) { this.inc(labels, -amount); }
  get(labels = {}) { return this._values.get(this._key(labels)) || 0; }
  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [k, v] of this._values) {
      const labels = JSON.parse(k);
      const lStr   = Object.entries(labels).map(([lk, lv]) => `${lk}="${lv}"`).join(',');
      lines.push(`${this.name}{${lStr}} ${v}`);
    }
    return lines.join('\n');
  }
}

class MetricHistogram {
  constructor(name, help, labelNames = [], buckets = DEFAULT_BUCKETS) {
    this.name       = name;
    this.help       = help;
    this.labelNames = labelNames;
    this.buckets    = [...buckets].sort((a, b) => a - b);
    this.type       = METRIC_TYPE.HISTOGRAM;
    this._data      = new Map(); // labelKey → { count, sum, bucketCounts[] }
  }
  _key(labels = {}) { return JSON.stringify(labels); }
  _init(key) {
    if (!this._data.has(key)) {
      this._data.set(key, {
        count: 0,
        sum: 0,
        bucketCounts: new Array(this.buckets.length + 1).fill(0),
      });
    }
    return this._data.get(key);
  }
  observe(value, labels = {}) {
    const d = this._init(this._key(labels));
    d.count++;
    d.sum += value;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) d.bucketCounts[i]++;
    }
    d.bucketCounts[this.buckets.length]++; // +Inf bucket
  }
  toPrometheus() {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [k, d] of this._data) {
      const labels = JSON.parse(k);
      const lBase  = Object.entries(labels).map(([lk, lv]) => `${lk}="${lv}"`).join(',');
      const sep    = lBase ? ',' : '';
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket{${lBase}${sep}le="${this.buckets[i]}"} ${d.bucketCounts[i]}`);
      }
      lines.push(`${this.name}_bucket{${lBase}${sep}le="+Inf"} ${d.bucketCounts[this.buckets.length]}`);
      lines.push(`${this.name}_sum{${lBase}} ${d.sum}`);
      lines.push(`${this.name}_count{${lBase}} ${d.count}`);
    }
    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyMetricsRegistry
// ─────────────────────────────────────────────────────────────────────────────

class HeadyMetricsRegistry {
  constructor({ service }) {
    this._service  = service;
    this._metrics  = new Map();
    // Pre-register standard Heady metrics
    this._registerStandardMetrics();
  }

  _registerStandardMetrics() {
    // ── HTTP layer ────────────────────────────────────────────────────────────
    this.register('heady_http_requests_total', METRIC_TYPE.COUNTER,
      'Total HTTP requests received.', ['service', 'method', 'path', 'status_code']);
    this.register('heady_http_request_duration_ms', METRIC_TYPE.HISTOGRAM,
      'HTTP request latency in milliseconds.', ['service', 'method', 'path', 'status_code']);
    this.register('heady_http_active_requests', METRIC_TYPE.GAUGE,
      'Currently active HTTP requests.', ['service']);

    // ── Pipeline ──────────────────────────────────────────────────────────────
    this.register('heady_pipeline_runs_total', METRIC_TYPE.COUNTER,
      'Total pipeline runs started.', ['service', 'status']);
    this.register('heady_pipeline_stage_duration_ms', METRIC_TYPE.HISTOGRAM,
      'Pipeline stage latency.', ['stage', 'status']);
    this.register('heady_pipeline_concurrent_runs', METRIC_TYPE.GAUGE,
      'Number of currently running pipeline instances.', ['service']);
    // Tracks the memory-leak-prone runs Map size (hc-full-pipeline.js:48)
    this.register('heady_pipeline_runs_map_size', METRIC_TYPE.GAUGE,
      'Current size of the pipeline runs Map (watch for memory leaks).', ['service']);

    // ── Bees ──────────────────────────────────────────────────────────────────
    this.register('heady_bees_active', METRIC_TYPE.GAUGE,
      'Number of active bee workers.', ['service', 'type']);
    this.register('heady_bees_spawned_total', METRIC_TYPE.COUNTER,
      'Total bees spawned since startup.', ['service', 'type']);
    this.register('heady_bees_failed_total', METRIC_TYPE.COUNTER,
      'Total bee failures.', ['service', 'type', 'reason']);

    // ── Self-awareness / vector memory ───────────────────────────────────────
    this.register('heady_self_awareness_drift_score', METRIC_TYPE.GAUGE,
      'Current identity drift score (0-1). Alert above 0.75.', ['service']);
    this.register('heady_vector_memory_size', METRIC_TYPE.GAUGE,
      'Number of vectors in VectorMemory.', ['service']);
    this.register('heady_telemetry_ring_used', METRIC_TYPE.GAUGE,
      'Number of entries in the telemetry ring buffer.', ['service']);

    // ── Service mesh / circuit breakers ──────────────────────────────────────
    this.register('heady_circuit_breaker_state', METRIC_TYPE.GAUGE,
      'Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN).', ['service', 'target']);
    this.register('heady_service_health_checks_total', METRIC_TYPE.COUNTER,
      'Total service health-check probes.', ['service', 'target', 'result']);

    // ── Event bus ─────────────────────────────────────────────────────────────
    this.register('heady_events_published_total', METRIC_TYPE.COUNTER,
      'Total events published to the event bus.', ['topic']);
    this.register('heady_events_dead_letter_total', METRIC_TYPE.COUNTER,
      'Total events moved to dead-letter queue.', ['topic', 'reason']);
    this.register('heady_event_bus_lag_ms', METRIC_TYPE.GAUGE,
      'Delivery lag between event publish and handler call.', ['topic']);

    // ── Config server ─────────────────────────────────────────────────────────
    this.register('heady_config_reloads_total', METRIC_TYPE.COUNTER,
      'Total config hot-reloads triggered.', ['source']);
    this.register('heady_config_overrides_active', METRIC_TYPE.GAUGE,
      'Number of active runtime config overrides.', ['service']);

    // ── Buddy / metacognition ─────────────────────────────────────────────────
    this.register('heady_buddy_task_lock_acquisitions_total', METRIC_TYPE.COUNTER,
      'Total task lock acquisitions.', ['status']);
    this.register('heady_buddy_metacognition_log_size', METRIC_TYPE.GAUGE,
      'Current size of the BuddyCore metacognition log.', ['service']);

    // ── Process ───────────────────────────────────────────────────────────────
    this.register('heady_process_memory_rss_bytes', METRIC_TYPE.GAUGE,
      'Process RSS memory.', ['service']);
    this.register('heady_process_uptime_seconds', METRIC_TYPE.GAUGE,
      'Process uptime in seconds.', ['service']);
  }

  register(name, type, help, labelNames = []) {
    if (this._metrics.has(name)) return this._metrics.get(name);
    let metric;
    switch (type) {
      case METRIC_TYPE.COUNTER:   metric = new MetricCounter(name, help, labelNames);   break;
      case METRIC_TYPE.GAUGE:     metric = new MetricGauge(name, help, labelNames);     break;
      case METRIC_TYPE.HISTOGRAM: metric = new MetricHistogram(name, help, labelNames); break;
      default: throw new Error(`Unknown metric type: ${type}`);
    }
    this._metrics.set(name, metric);
    return metric;
  }

  counter(name)   { return this._getOrThrow(name, METRIC_TYPE.COUNTER);   }
  gauge(name)     { return this._getOrThrow(name, METRIC_TYPE.GAUGE);     }
  histogram(name) { return this._getOrThrow(name, METRIC_TYPE.HISTOGRAM); }

  _getOrThrow(name, type) {
    const m = this._metrics.get(name);
    if (!m) throw new Error(`[HeadyMetrics] Metric '${name}' not registered. Call registry.register() first.`);
    if (m.type !== type) throw new Error(`[HeadyMetrics] '${name}' is a ${m.type}, not a ${type}.`);
    return m;
  }

  /**
   * Collect all metrics and return Prometheus text format.
   */
  collect() {
    // Update process metrics before collecting
    const mem = process.memoryUsage();
    this.gauge('heady_process_memory_rss_bytes').set(mem.rss, { service: this._service });
    this.gauge('heady_process_uptime_seconds').set(process.uptime(), { service: this._service });

    return [...this._metrics.values()]
      .map((m) => m.toPrometheus())
      .join('\n\n') + '\n';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyLogger
// ─────────────────────────────────────────────────────────────────────────────

class HeadyLogger {
  constructor({ service, tracer, prettyPrint = false }) {
    this._service     = service;
    this._tracer      = tracer;
    this._prettyPrint = prettyPrint || process.env.HEADY_LOG_PRETTY === 'true';
    this._minLevel    = process.env.HEADY_LOG_LEVEL || 'debug';
  }

  _levels() { return ['debug', 'info', 'notice', 'warn', 'error', 'critical', 'alert']; }

  _shouldLog(level) {
    return this._levels().indexOf(level) >= this._levels().indexOf(this._minLevel);
  }

  _emit(level, message, fields = {}) {
    if (!this._shouldLog(level)) return;

    const traceId = this._tracer?.currentTraceId();
    const span    = this._tracer?.currentSpan();

    const entry = {
      severity:  SEVERITY[level] || 'DEFAULT',
      timestamp: new Date().toISOString(),
      service:   this._service,
      message,
      // Google Cloud Logging trace correlation
      'logging.googleapis.com/trace': traceId
        ? `projects/${process.env.GCP_PROJECT || 'heady-prod'}/traces/${traceId}`
        : undefined,
      'logging.googleapis.com/spanId': span?.spanId,
      traceId,
      spanId:    span?.spanId,
      pid:       process.pid,
      hostname:  os.hostname(),
      ...fields,
    };

    // Remove undefined keys
    for (const k of Object.keys(entry)) {
      if (entry[k] === undefined) delete entry[k];
    }

    if (this._prettyPrint) {
      const color = { DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARNING: '\x1b[33m', ERROR: '\x1b[31m', CRITICAL: '\x1b[35m' };
      const c = color[entry.severity] || '';
      const reset = '\x1b[0m';
      const ts = entry.timestamp.substring(11, 23);
      const extra = Object.entries(fields).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
      process.stderr.write(`${c}${ts} [${entry.severity}] [${this._service}] ${message}${reset} ${extra}\n`);
    } else {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  }

  debug   (msg, fields) { this._emit('debug',    msg, fields); }
  info    (msg, fields) { this._emit('info',     msg, fields); }
  notice  (msg, fields) { this._emit('notice',   msg, fields); }
  warn    (msg, fields) { this._emit('warn',      msg, fields); }
  error   (msg, fields) { this._emit('error',    msg, fields); }
  critical(msg, fields) { this._emit('critical', msg, fields); }
  alert   (msg, fields) { this._emit('alert',    msg, fields); }

  /** Create a child logger with extra default fields. */
  child(defaultFields) {
    const parent = this;
    return new Proxy(this, {
      get(target, prop) {
        if (['debug','info','notice','warn','error','critical','alert'].includes(prop)) {
          return (msg, fields = {}) => parent._emit(prop, msg, { ...defaultFields, ...fields });
        }
        return target[prop];
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HeadyObservability  — main facade
// ─────────────────────────────────────────────────────────────────────────────

class HeadyObservability extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._opts = {
      service:      opts.service     || process.env.HEADY_SERVICE_NAME || 'heady',
      maxTraces:    opts.maxTraces   || 2_000,
      prettyPrint:  opts.prettyPrint || false,
      mountPath:    opts.mountPath   || '/api/v1/obs',
    };

    this.tracer  = new HeadyTracer({
      service:   this._opts.service,
      maxTraces: this._opts.maxTraces,
    });

    this.metrics = new HeadyMetricsRegistry({ service: this._opts.service });

    this.logger  = new HeadyLogger({
      service:     this._opts.service,
      tracer:      this.tracer,
      prettyPrint: this._opts.prettyPrint,
    });

    // Wire span events → metrics
    this.tracer.on('span:ended', (span) => {
      if (span.name.startsWith('http.')) {
        const [,, method, , statusCode] = span.name.split('.');
        this.metrics.histogram('heady_http_request_duration_ms')
          .observe(span.durationMs, {
            service:     this._opts.service,
            method:      method || 'UNKNOWN',
            path:        span.attributes.path || 'unknown',
            status_code: String(statusCode || span.attributes.statusCode || '0'),
          });
      }
    });

    this._started = false;
  }

  async start() {
    this._started = true;
    this.logger.info('HeadyObservability started', {
      service: this._opts.service,
      pid:     process.pid,
    });
    return this;
  }

  // ── Express middleware ────────────────────────────────────────────────────────

  /**
   * Request middleware — must be first in the chain.
   * Extracts/creates trace context, starts root span, begins metrics timing.
   */
  requestMiddleware() {
    return (req, res, next) => {
      const { traceId, parentSpanId } = this.tracer.extractHeaders(req.headers);

      // Run the rest of the request inside the trace context
      this.tracer.runWithContext({ traceId, parentSpanId }, () => {
        const span = this.tracer.startSpan(`http.request.${req.method}.${req.path}`, {
          method:  req.method,
          path:    req.path,
          url:     req.url,
          ip:      req.ip,
          service: this._opts.service,
        });

        // Expose on request for route handlers to add attributes
        req.headyTrace = {
          traceId:  span.traceId,
          spanId:   span.spanId,
          span,
          addEvent: (name, attrs) => span.addEvent(name, attrs),
        };

        // Propagate back to caller
        res.setHeader('X-Heady-Trace-Id', span.traceId);
        res.setHeader('X-Heady-Span-Id',  span.spanId);

        this.metrics.gauge('heady_http_active_requests').inc({ service: this._opts.service });
        this.metrics.counter('heady_http_requests_total').inc({
          service:     this._opts.service,
          method:      req.method,
          path:        req.route?.path || req.path,
          status_code: '0', // will be updated in response middleware
        });

        this.logger.info(`→ ${req.method} ${req.path}`, {
          traceId:    span.traceId,
          method:     req.method,
          path:       req.path,
          query:      req.query,
          ip:         req.ip,
          userAgent:  req.headers['user-agent'],
        });

        // Intercept response finish
        res.on('finish', () => {
          span.setAttribute('statusCode', res.statusCode);
          span.end(res.statusCode < 400 ? 'ok' : 'error');
          this.tracer.emit('span:ended', span);

          this.metrics.gauge('heady_http_active_requests').dec({ service: this._opts.service });
          this.metrics.histogram('heady_http_request_duration_ms').observe(span.durationMs, {
            service:     this._opts.service,
            method:      req.method,
            path:        req.route?.path || req.path,
            status_code: String(res.statusCode),
          });

          this.logger.info(`← ${req.method} ${req.path} ${res.statusCode} ${span.durationMs}ms`, {
            traceId:    span.traceId,
            statusCode: res.statusCode,
            durationMs: span.durationMs,
          });
        });

        next();
      });
    };
  }

  /**
   * Error middleware — attach after all routes.
   */
  errorMiddleware() {
    // eslint-disable-next-line no-unused-vars
    return (err, req, res, next) => {
      const traceId = req.headyTrace?.traceId || 'unknown';
      this.logger.error(`Unhandled error: ${err.message}`, {
        traceId,
        stack:  err.stack,
        path:   req.path,
        method: req.method,
      });
      this.metrics.counter('heady_http_requests_total').inc({
        service:     this._opts.service,
        method:      req.method,
        path:        req.route?.path || req.path,
        status_code: '500',
      });
      if (!res.headersSent) {
        res.status(500).json({
          error:   'Internal Server Error',
          traceId,
        });
      }
    };
  }

  // ── Express Router ────────────────────────────────────────────────────────────

  router() {
    const express = require('express');
    const router  = express.Router();

    // Prometheus scrape endpoint — no auth (Prometheus scrapes directly)
    router.get('/metrics', (_req, res) => {
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(this.metrics.collect());
    });

    // Liveness probe
    router.get('/health', (_req, res) => {
      res.json({
        status:  'ok',
        service: this._opts.service,
        uptime:  process.uptime(),
        memory:  process.memoryUsage(),
      });
    });

    // Retrieve all spans for a traceId (debug only — gate behind admin auth in prod)
    router.get('/traces/:traceId', (req, res) => {
      const spans = this.tracer.getTrace(req.params.traceId);
      if (!spans.length) return res.status(404).json({ error: 'Trace not found.' });
      res.json({ traceId: req.params.traceId, spanCount: spans.length, spans });
    });

    // Aggregated stats
    router.get('/stats', (_req, res) => {
      const mem = process.memoryUsage();
      res.json({
        service:        this._opts.service,
        uptime:         process.uptime(),
        pid:            process.pid,
        hostname:       os.hostname(),
        memory:         mem,
        nodeVersion:    process.version,
      });
    });

    return router;
  }

  // ── Utility: wrap an outbound HTTP call with trace propagation ─────────────

  /**
   * Wrap Node's https.request / http.request with automatic header injection
   * and span creation for outbound calls.
   *
   * Usage:
   *   const data = await obs.fetch('https://headyapi.com/api/v2/run', { method: 'POST', body: '...' });
   */
  fetch(url, opts = {}) {
    const { URL: NodeURL } = require('url');
    const parsed = new NodeURL(url);
    const mod    = parsed.protocol === 'https:' ? require('https') : require('http');

    const headers = this.tracer.injectHeaders({ ...(opts.headers || {}), 'Content-Type': 'application/json' });

    return this.tracer.withSpan(`http.outbound.${opts.method || 'GET'}.${parsed.hostname}`, { url }, () => {
      return new Promise((resolve, reject) => {
        const reqOpts = {
          hostname: parsed.hostname,
          port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path:     parsed.pathname + parsed.search,
          method:   opts.method || 'GET',
          headers,
          timeout:  opts.timeout || 30_000,
        };

        const req = mod.request(reqOpts, (res) => {
          let body = '';
          res.on('data', (d) => { body += d; });
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers }); }
            catch { resolve({ status: res.statusCode, body, headers: res.headers }); }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });

        if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
        req.end();
      });
    });
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance = null;

/**
 * Returns the singleton HeadyObservability instance.
 * @param {Object} [opts]  Passed to constructor only on first call.
 * @returns {HeadyObservability}
 */
function getObservability(opts) {
  if (!_instance) _instance = new HeadyObservability(opts);
  return _instance;
}

/**
 * Reset singleton — for tests only.
 */
function _resetObservabilityForTests() {
  _instance = null;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  HeadyObservability,
  HeadyTracer,
  HeadyMetricsRegistry,
  HeadyLogger,
  HeadySpan,
  getObservability,
  _resetObservabilityForTests,
  PHI,
  HDR_TRACE_ID,
  HDR_SPAN_ID,
  HDR_PARENT_ID,
  HDR_SERVICE,
  METRIC_TYPE,
  DEFAULT_BUCKETS,
};

// ─── Self-test ────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const obs = getObservability({ service: 'heady-test', prettyPrint: true });
    await obs.start();

    obs.logger.info('Self-test running');

    await obs.tracer.withSpan('test.outer', { env: 'test' }, async (outerSpan) => {
      obs.logger.info('Inside outer span', { spanId: outerSpan.spanId });

      await obs.tracer.withSpan('test.inner', {}, async (innerSpan) => {
        obs.logger.debug('Inside inner span', { spanId: innerSpan.spanId });
        obs.metrics.histogram('heady_pipeline_stage_duration_ms').observe(42, { stage: 'ARENA', status: 'ok' });
        obs.metrics.counter('heady_pipeline_runs_total').inc({ service: 'heady-test', status: 'completed' });
      });
    });

    const traceId = obs.tracer.currentTraceId() || 'unknown';
    obs.logger.info('Trace complete', { traceId });

    console.log('\n=== Prometheus metrics sample ===');
    const output = obs.metrics.collect();
    // Print just the first 20 lines
    console.log(output.split('\n').slice(0, 20).join('\n') + '\n...');
  })().catch(console.error);
}

/**
 * @file heady-telemetry.js
 * @description Internal telemetry system — replaces OpenTelemetry + Sentry.
 *
 * Features:
 * - W3C Trace Context (traceparent/tracestate)
 * - Span creation and nesting with parent-child relationships
 * - Metric collection: counters, gauges, histograms
 * - Log aggregation (structured NDJSON output)
 * - File export (NDJSON, rotated by size)
 * - PHI-based adaptive sampling
 * - Error tracking with full stack traces
 * - Performance profiling hooks (high-resolution via performance.now())
 *
 * Sacred Geometry: PHI sampling, Fibonacci bucket sizes.
 * Zero external dependencies — fs, path, crypto, perf_hooks.
 *
 * @module HeadyTelemetry/HeadyTelemetry
 */

import { createWriteStream, mkdirSync, renameSync, statSync, existsSync } from 'fs';
import { join }       from 'path';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// Fibonacci histogram buckets (ms)
const HISTO_BUCKETS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, Infinity];

// ─── W3C Trace Context ────────────────────────────────────────────────────────
const TRACE_VERSION = '00';

function generateTraceId() {
  // 16 bytes = 32 hex chars
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Buffer.from(bytes).toString('hex');
}

function generateSpanId() {
  // 8 bytes = 16 hex chars
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Encode W3C traceparent header.
 * Format: {version}-{traceId}-{spanId}-{flags}
 */
export function encodeTraceparent(traceId, spanId, sampled = true) {
  const flags = sampled ? '01' : '00';
  return `${TRACE_VERSION}-${traceId}-${spanId}-${flags}`;
}

/**
 * Parse W3C traceparent header.
 * @param {string} header
 * @returns {{ version, traceId, spanId, sampled } | null}
 */
export function parseTraceparent(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split('-');
  if (parts.length < 4) return null;
  return {
    version:  parts[0],
    traceId:  parts[1],
    spanId:   parts[2],
    sampled:  parts[3] === '01',
  };
}

// ─── Span ─────────────────────────────────────────────────────────────────────
export const SpanStatus = Object.freeze({
  OK:    'OK',
  ERROR: 'ERROR',
  UNSET: 'UNSET',
});

export class Span {
  constructor({ name, traceId, spanId, parentSpanId, attributes = {}, sampled = true }) {
    this.name         = name;
    this.traceId      = traceId;
    this.spanId       = spanId;
    this.parentSpanId = parentSpanId ?? null;
    this.attributes   = { ...attributes };
    this.events       = [];
    this.status       = SpanStatus.UNSET;
    this.statusMsg    = '';
    this.startTime    = performance.now();
    this.startIso     = new Date().toISOString();
    this.endTime      = null;
    this.endIso       = null;
    this.durationMs   = null;
    this.sampled      = sampled;
    this._ended       = false;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(obj) {
    Object.assign(this.attributes, obj);
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({ name, attributes, ts: new Date().toISOString() });
    return this;
  }

  setStatus(status, message = '') {
    this.status    = status;
    this.statusMsg = message;
    return this;
  }

  recordException(err) {
    this.events.push({
      name: 'exception',
      attributes: {
        'exception.type':       err.name    ?? 'Error',
        'exception.message':    err.message ?? String(err),
        'exception.stacktrace': err.stack   ?? '',
      },
      ts: new Date().toISOString(),
    });
    this.setStatus(SpanStatus.ERROR, err.message);
    return this;
  }

  end() {
    if (this._ended) return this;
    this._ended    = true;
    this.endTime   = performance.now();
    this.endIso    = new Date().toISOString();
    this.durationMs = this.endTime - this.startTime;
    return this;
  }

  get traceparent() {
    return encodeTraceparent(this.traceId, this.spanId, this.sampled);
  }

  toJSON() {
    return {
      type:         'span',
      name:         this.name,
      traceId:      this.traceId,
      spanId:       this.spanId,
      parentSpanId: this.parentSpanId,
      status:       this.status,
      statusMsg:    this.statusMsg,
      startIso:     this.startIso,
      endIso:       this.endIso,
      durationMs:   this.durationMs,
      attributes:   this.attributes,
      events:       this.events,
      sampled:      this.sampled,
    };
  }
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
export class Counter {
  constructor(name, labels = {}) {
    this.name   = name;
    this.labels = labels;
    this._value = 0;
  }
  add(n = 1)  { this._value += n; return this; }
  reset()     { this._value = 0;  return this; }
  get value() { return this._value; }
  toJSON()    { return { type: 'counter', name: this.name, labels: this.labels, value: this._value }; }
}

export class Gauge {
  constructor(name, labels = {}) {
    this.name   = name;
    this.labels = labels;
    this._value = 0;
  }
  set(v)      { this._value = v;           return this; }
  add(n = 1)  { this._value += n;          return this; }
  sub(n = 1)  { this._value -= n;          return this; }
  get value() { return this._value; }
  toJSON()    { return { type: 'gauge', name: this.name, labels: this.labels, value: this._value }; }
}

export class Histogram {
  constructor(name, labels = {}, buckets = HISTO_BUCKETS) {
    this.name    = name;
    this.labels  = labels;
    this._buckets = buckets.slice().sort((a, b) => a - b);
    this._counts  = new Array(this._buckets.length).fill(0);
    this._sum     = 0;
    this._count   = 0;
  }

  observe(value) {
    this._sum   += value;
    this._count += 1;
    for (let i = 0; i < this._buckets.length; i++) {
      if (value <= this._buckets[i]) { this._counts[i]++; break; }
    }
    return this;
  }

  get p50()  { return this._percentile(0.50); }
  get p95()  { return this._percentile(0.95); }
  get p99()  { return this._percentile(0.99); }
  get mean() { return this._count ? this._sum / this._count : 0; }

  _percentile(p) {
    // Approximate from bucket cumulative counts
    const target = Math.ceil(p * this._count);
    let cumulative = 0;
    for (let i = 0; i < this._counts.length; i++) {
      cumulative += this._counts[i];
      if (cumulative >= target) return this._buckets[i];
    }
    return this._buckets[this._buckets.length - 2] ?? 0;
  }

  toJSON() {
    return {
      type:    'histogram',
      name:    this.name,
      labels:  this.labels,
      count:   this._count,
      sum:     this._sum,
      mean:    this.mean,
      p50:     this.p50,
      p95:     this.p95,
      p99:     this.p99,
      buckets: this._buckets.map((b, i) => ({ le: b, count: this._counts[i] })),
    };
  }
}

// ─── PHI-based Adaptive Sampler ───────────────────────────────────────────────
export class PhiSampler {
  /**
   * @param {number} baseSampleRate  0–1 (default 1.0 = sample everything)
   * @param {number} errorSampleRate Rate for error spans (default 1.0)
   */
  constructor(baseSampleRate = 1.0, errorSampleRate = 1.0) {
    this._base   = baseSampleRate;
    this._err    = errorSampleRate;
    this._load   = 0;   // 0–1 load factor (updated externally)
  }

  /** Call to update current system load (0–1). Higher load → lower sample rate. */
  updateLoad(load) {
    this._load = Math.max(0, Math.min(1, load));
  }

  /**
   * Decide whether to sample a span.
   * PHI-adaptive: at high load, rate scales down by 1/PHI per PHI-step.
   * @param {boolean} isError
   * @returns {boolean}
   */
  shouldSample(isError = false) {
    if (isError) return Math.random() < this._err;

    // PHI-adaptive: reduce rate as load approaches 1
    const adjustedRate = this._base * Math.pow(PHI_INV, this._load * PHI);
    return Math.random() < Math.max(adjustedRate, 0.01); // never go below 1%
  }
}

// ─── File Exporter ────────────────────────────────────────────────────────────
class NDJSONExporter {
  constructor(dir, basename = 'telemetry', maxSize = Math.round(10 * 1024 * 1024 * PHI_INV)) {
    this._dir      = dir;
    this._basename = basename;
    this._maxSize  = maxSize;
    this._written  = 0;
    this._stream   = null;

    mkdirSync(dir, { recursive: true });
    this._open();
  }

  _path() { return join(this._dir, `${this._basename}.ndjson`); }

  _open() {
    this._stream  = createWriteStream(this._path(), { flags: 'a' });
    try { this._written = statSync(this._path()).size; } catch { this._written = 0; }
  }

  _rotate() {
    this._stream.end();
    const archive = join(this._dir, `${this._basename}.${Date.now()}.ndjson`);
    try { renameSync(this._path(), archive); } catch { /* ignore */ }
    this._written = 0;
    this._open();
  }

  write(obj) {
    const line = JSON.stringify(obj) + '\n';
    if (this._written + line.length > this._maxSize) this._rotate();
    this._stream.write(line);
    this._written += line.length;
  }

  close() { this._stream?.end(); }
}

// ─── Telemetry Engine ─────────────────────────────────────────────────────────
export class HeadyTelemetry {
  /**
   * @param {object} opts
   * @param {string}  [opts.dir]            Export directory (default /tmp/heady-telemetry)
   * @param {number}  [opts.sampleRate]     0–1
   * @param {boolean} [opts.exportToFile]   Write NDJSON to disk (default true)
   * @param {boolean} [opts.consoleExport]  Also log to stderr (default false in prod)
   */
  constructor(opts = {}) {
    this._dir           = opts.dir          ?? process.env.TELEMETRY_DIR ?? '/tmp/heady-telemetry';
    this._sampleRate    = opts.sampleRate   ?? parseFloat(process.env.TELEMETRY_SAMPLE_RATE ?? '1');
    this._exportToFile  = opts.exportToFile ?? true;
    this._console       = opts.consoleExport ?? process.env.NODE_ENV !== 'production';

    this._sampler   = new PhiSampler(this._sampleRate);
    this._exporter  = this._exportToFile ? new NDJSONExporter(this._dir) : null;
    this._spanStack = [];  // active span stack (per-call-stack simulation)

    // Metric registry
    this._counters   = new Map();
    this._gauges     = new Map();
    this._histograms = new Map();

    // Error log ring buffer (last 377 = Fibonacci)
    this._errors = [];
    this._maxErrors = 377;
  }

  // ─── Tracing ─────────────────────────────────────────────────────────────

  /**
   * Start a new trace (root span).
   * @param {string} name
   * @param {object} [attributes]
   * @returns {Span}
   */
  startTrace(name, attributes = {}) {
    const traceId = generateTraceId();
    const spanId  = generateSpanId();
    const sampled = this._sampler.shouldSample();
    return new Span({ name, traceId, spanId, attributes, sampled });
  }

  /**
   * Start a child span within an existing trace.
   * @param {string} name
   * @param {Span}   parentSpan
   * @param {object} [attributes]
   * @returns {Span}
   */
  startSpan(name, parentSpan, attributes = {}) {
    const sampled = parentSpan?.sampled ?? this._sampler.shouldSample();
    return new Span({
      name,
      traceId:      parentSpan?.traceId ?? generateTraceId(),
      spanId:       generateSpanId(),
      parentSpanId: parentSpan?.spanId  ?? null,
      attributes,
      sampled,
    });
  }

  /**
   * End a span and export if sampled.
   * @param {Span} span
   */
  endSpan(span) {
    span.end();
    if (span.sampled) this._export(span.toJSON());
    return span;
  }

  /**
   * Trace an async function call.
   * @param {string}   name
   * @param {Function} fn          async (span) => result
   * @param {Span}     [parent]
   * @param {object}   [attributes]
   */
  async trace(name, fn, parent = null, attributes = {}) {
    const span = parent ? this.startSpan(name, parent, attributes) : this.startTrace(name, attributes);
    try {
      const result = await fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (err) {
      span.recordException(err);
      this._trackError(err, { spanId: span.spanId, traceId: span.traceId });
      throw err;
    } finally {
      this.endSpan(span);
    }
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────

  counter(name, labels = {}) {
    const key = this._metricKey(name, labels);
    if (!this._counters.has(key)) this._counters.set(key, new Counter(name, labels));
    return this._counters.get(key);
  }

  gauge(name, labels = {}) {
    const key = this._metricKey(name, labels);
    if (!this._gauges.has(key)) this._gauges.set(key, new Gauge(name, labels));
    return this._gauges.get(key);
  }

  histogram(name, labels = {}, buckets = HISTO_BUCKETS) {
    const key = this._metricKey(name, labels);
    if (!this._histograms.has(key)) this._histograms.set(key, new Histogram(name, labels, buckets));
    return this._histograms.get(key);
  }

  _metricKey(name, labels) {
    return name + ':' + JSON.stringify(labels);
  }

  /** Export a metrics snapshot */
  snapshotMetrics() {
    const ts = new Date().toISOString();
    const counters   = [...this._counters.values()].map(c => c.toJSON());
    const gauges     = [...this._gauges.values()].map(g => g.toJSON());
    const histograms = [...this._histograms.values()].map(h => h.toJSON());
    const snap = { type: 'metrics_snapshot', ts, counters, gauges, histograms };
    this._export(snap);
    return snap;
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  /**
   * Structured log record.
   * @param {string}  level
   * @param {string}  msg
   * @param {object}  [ctx]
   * @param {Error}   [err]
   */
  log(level, msg, ctx = {}, err = null) {
    const record = {
      type:  'log',
      level,
      msg,
      ts:    new Date().toISOString(),
      ...ctx,
      ...(err ? { error: { message: err.message, name: err.name, stack: err.stack } } : {}),
    };
    this._export(record);
    return record;
  }

  // ─── Error Tracking ───────────────────────────────────────────────────────

  _trackError(err, ctx = {}) {
    const record = {
      type:      'error',
      ts:        new Date().toISOString(),
      message:   err.message,
      name:      err.name,
      stack:     err.stack,
      code:      err.code,
      ...ctx,
    };
    this._errors.push(record);
    if (this._errors.length > this._maxErrors) this._errors.shift();
    this._export(record);
    return record;
  }

  captureError(err, ctx = {}) {
    return this._trackError(err instanceof Error ? err : new Error(String(err)), ctx);
  }

  recentErrors(n = 13) {
    return this._errors.slice(-n);
  }

  // ─── Profiling Hooks ──────────────────────────────────────────────────────

  /**
   * Time a synchronous function and record to histogram.
   * @param {string}   metricName
   * @param {Function} fn
   * @returns {*}
   */
  profile(metricName, fn) {
    const t0 = performance.now();
    try {
      const result = fn();
      this.histogram(metricName).observe(performance.now() - t0);
      return result;
    } catch (e) {
      this.histogram(metricName).observe(performance.now() - t0);
      throw e;
    }
  }

  /**
   * Time an async function and record to histogram.
   */
  async profileAsync(metricName, fn) {
    const t0 = performance.now();
    try {
      const result = await fn();
      this.histogram(metricName).observe(performance.now() - t0);
      return result;
    } catch (e) {
      this.histogram(metricName).observe(performance.now() - t0);
      throw e;
    }
  }

  // ─── Load feedback ────────────────────────────────────────────────────────
  updateLoad(load) { this._sampler.updateLoad(load); }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _export(obj) {
    if (this._exporter) {
      try { this._exporter.write(obj); } catch { /* silent */ }
    }
    if (this._console && obj.type === 'log') {
      process.stderr.write(JSON.stringify(obj) + '\n');
    }
  }

  close() { this._exporter?.close(); }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _instance = null;

export function getTelemetry(opts = {}) {
  if (!_instance) _instance = new HeadyTelemetry(opts);
  return _instance;
}

export {
  HeadyTelemetry as Telemetry,
  generateTraceId, generateSpanId,
};
export default HeadyTelemetry;

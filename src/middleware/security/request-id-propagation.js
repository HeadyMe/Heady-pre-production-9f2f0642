/**
 * Request ID Propagation Middleware — Distributed Tracing
 * @module security-middleware/request-id-propagation
 *
 * Features:
 *  - Generates X-Request-ID if not present (UUID v4)
 *  - Propagates through all internal service calls (fetch wrapper, axios interceptor)
 *  - Integrates with OpenTelemetry trace context (W3C Trace Context standard)
 *  - Logs request ID in all log entries
 *  - Returns in response headers
 *  - Supports B3 propagation format (Zipkin compatibility)
 *  - Validates incoming request IDs
 *  - Correlates with existing telemetry.js (src/lib/telemetry.js)
 */

'use strict';

const crypto = require('crypto');

// ─── Constants ───────────────────────────────────────────────────────────────

const REQUEST_ID_HEADER    = 'X-Request-ID';
const TRACE_ID_HEADER      = 'traceparent';           // W3C Trace Context
const B3_TRACE_ID_HEADER   = 'X-B3-TraceId';          // B3 (Zipkin)
const B3_SPAN_ID_HEADER    = 'X-B3-SpanId';
const B3_SAMPLED_HEADER    = 'X-B3-Sampled';
const CORRELATION_ID_HEADER = 'X-Correlation-ID';

// Regex for validating incoming request IDs (UUID v4 or custom alphanumeric)
const REQUEST_ID_RE = /^[a-zA-Z0-9_\-:.]{8,128}$/;

// W3C Trace Context version
const TRACEPARENT_VERSION = '00';

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 request ID.
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Generate a W3C traceparent header value.
 * Format: {version}-{trace-id}-{span-id}-{flags}
 *
 * @param {string} [traceId]  - 32-hex trace ID (generates if not provided)
 * @param {string} [spanId]   - 16-hex span ID (generates if not provided)
 * @param {boolean} [sampled] - Whether trace is sampled
 * @returns {string}
 */
function generateTraceparent(traceId, spanId, sampled = true) {
  const tid  = traceId || crypto.randomBytes(16).toString('hex');
  const sid  = spanId  || crypto.randomBytes(8).toString('hex');
  const flags = sampled ? '01' : '00';
  return `${TRACEPARENT_VERSION}-${tid}-${sid}-${flags}`;
}

/**
 * Parse a W3C traceparent header.
 * @param {string} value
 * @returns {{ version, traceId, spanId, sampled }|null}
 */
function parseTraceparent(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('-');
  if (parts.length < 4) return null;
  const [version, traceId, spanId, flags] = parts;
  return {
    version,
    traceId,
    spanId,
    sampled: flags === '01',
    raw:     value,
  };
}

/**
 * Validate an incoming request ID.
 * @param {string} id
 * @returns {boolean}
 */
function isValidRequestId(id) {
  return typeof id === 'string' && REQUEST_ID_RE.test(id);
}

// ─── Tracing Context ──────────────────────────────────────────────────────────

/**
 * Creates a tracing context object attached to each request.
 */
class TracingContext {
  constructor({ requestId, traceId, spanId, parentSpanId, sampled, correlationId }) {
    this.requestId    = requestId;
    this.traceId      = traceId     || crypto.randomBytes(16).toString('hex');
    this.spanId       = spanId      || crypto.randomBytes(8).toString('hex');
    this.parentSpanId = parentSpanId || null;
    this.sampled      = sampled     !== undefined ? sampled : true;
    this.correlationId = correlationId || requestId;
    this.startTime    = Date.now();
    this._spans       = [];
  }

  /**
   * Create a child span context for internal service calls.
   * @param {string} [operationName]
   * @returns {TracingContext}
   */
  createChildSpan(operationName) {
    const child = new TracingContext({
      requestId:    this.requestId,
      traceId:      this.traceId,
      spanId:       crypto.randomBytes(8).toString('hex'),
      parentSpanId: this.spanId,
      sampled:      this.sampled,
      correlationId: this.correlationId,
    });
    child.operationName = operationName;
    this._spans.push(child);
    return child;
  }

  /**
   * Build W3C traceparent value for outbound request headers.
   */
  toTraceparent() {
    return generateTraceparent(this.traceId, this.spanId, this.sampled);
  }

  /**
   * Build propagation headers for outbound HTTP requests.
   * Includes W3C Trace Context + B3 + request ID headers.
   */
  toPropagationHeaders() {
    return {
      [REQUEST_ID_HEADER]:     this.requestId,
      [CORRELATION_ID_HEADER]: this.correlationId,
      [TRACE_ID_HEADER]:       this.toTraceparent(),
      // B3 format for Zipkin compatibility
      [B3_TRACE_ID_HEADER]:    this.traceId,
      [B3_SPAN_ID_HEADER]:     this.spanId,
      [B3_SAMPLED_HEADER]:     this.sampled ? '1' : '0',
    };
  }

  /**
   * Duration in milliseconds since context was created.
   */
  get duration() {
    return Date.now() - this.startTime;
  }

  toJSON() {
    return {
      requestId:    this.requestId,
      traceId:      this.traceId,
      spanId:       this.spanId,
      parentSpanId: this.parentSpanId,
      correlationId: this.correlationId,
      sampled:      this.sampled,
      operationName: this.operationName,
      duration:     this.duration,
    };
  }
}

// ─── OpenTelemetry Integration ────────────────────────────────────────────────

/**
 * Attempt to integrate with the existing telemetry.js module.
 * If @opentelemetry/api is available, attach trace context to the OTel span.
 *
 * @param {TracingContext} ctx
 * @param {object} [otel]  - @opentelemetry/api module (optional)
 */
function attachToOTelContext(ctx, otel) {
  if (!otel) {
    try {
      otel = require('@opentelemetry/api');
    } catch {
      return null; // OTel not installed — skip
    }
  }

  try {
    const activeSpan = otel.trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute('request.id',     ctx.requestId);
      activeSpan.setAttribute('correlation.id', ctx.correlationId);
      activeSpan.setAttribute('request.sampled', ctx.sampled);
    }
    return activeSpan;
  } catch {
    return null;
  }
}

// ─── Fetch Wrapper ────────────────────────────────────────────────────────────

/**
 * Create a fetch wrapper that automatically propagates tracing headers.
 * Use for all internal service-to-service calls.
 *
 * @param {TracingContext} ctx
 * @param {Function} [baseFetch]  - Base fetch implementation (defaults to globalThis.fetch)
 * @returns {Function} fetch-compatible function
 */
function createPropagatingFetch(ctx, baseFetch) {
  const _fetch = baseFetch || globalThis.fetch;
  if (!_fetch) throw new Error('[REQUEST-ID] No fetch implementation available');

  return async (url, options = {}) => {
    const childCtx = ctx.createChildSpan(url.toString());
    const headers  = {
      ...childCtx.toPropagationHeaders(),
      ...(options.headers || {}),
    };

    return _fetch(url, { ...options, headers });
  };
}

/**
 * Patch the Node.js http/https modules to add propagation headers.
 * Call once at app startup.
 * NOTE: Only patches requests made via the http/https modules, not fetch.
 *
 * @param {object} [opts]
 * @param {Function} [opts.getContext]  - fn() → TracingContext | null
 */
function patchNodeHttpModules(opts = {}) {
  const http  = require('http');
  const https = require('https');

  const _originalRequest = http.request.bind(http);
  const _originalHttpsRequest = https.request.bind(https);

  function wrapRequest(original) {
    return function patchedRequest(url, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      const ctx = opts.getContext?.();
      if (ctx) {
        options = options || {};
        options.headers = { ...ctx.toPropagationHeaders(), ...(options.headers || {}) };
      }
      return original(url, options, callback);
    };
  }

  http.request  = wrapRequest(_originalRequest);
  https.request = wrapRequest(_originalHttpsRequest);

  // Restore function
  return () => {
    http.request  = _originalRequest;
    https.request = _originalHttpsRequest;
  };
}

// ─── Logger Patcher ───────────────────────────────────────────────────────────

/**
 * Wrap a logger to automatically inject the current request ID into all log entries.
 *
 * @param {object} logger    - Logger with log/info/warn/error methods
 * @param {Function} getCtx  - fn() → TracingContext | null
 * @returns {object} wrapped logger
 */
function createTracedLogger(logger, getCtx) {
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
  const wrapped = Object.create(logger);

  for (const method of methods) {
    if (typeof logger[method] !== 'function') continue;
    wrapped[method] = function (...args) {
      const ctx = getCtx?.();
      if (ctx) {
        // Inject tracing fields into first argument if it's an object
        if (args.length > 0 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          args[0] = {
            requestId:     ctx.requestId,
            traceId:       ctx.traceId,
            correlationId: ctx.correlationId,
            ...args[0],
          };
        }
      }
      return logger[method].apply(logger, args);
    };
  }

  return wrapped;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that handles request ID and distributed tracing context.
 *
 * @param {object} [opts]
 * @param {string} [opts.headerName]         - Primary request ID header (default: X-Request-ID)
 * @param {boolean} [opts.trustIncoming]     - Accept X-Request-ID from upstream (default: true)
 * @param {boolean} [opts.generateIfMissing] - Generate ID if not provided (default: true)
 * @param {boolean} [opts.propagateW3C]      - Read/write W3C traceparent (default: true)
 * @param {boolean} [opts.propagateB3]       - Read/write B3 headers (default: true)
 * @param {boolean} [opts.attachOTel]        - Attach to OpenTelemetry span (default: true)
 * @param {boolean} [opts.logOnRequest]      - Log request start (default: false)
 * @param {boolean} [opts.logOnResponse]     - Log request completion with duration (default: true)
 * @param {Function} [opts.logger]           - Logger function fn(entry) (default: console)
 * @param {Function} [opts.sanitizeId]       - Custom ID sanitizer fn(id) → string
 * @returns {Function} Express middleware
 */
function requestIdMiddleware(opts = {}) {
  const {
    headerName         = REQUEST_ID_HEADER,
    trustIncoming      = true,
    generateIfMissing  = true,
    propagateW3C       = true,
    propagateB3        = true,
    attachOTel         = true,
    logOnRequest       = false,
    logOnResponse      = true,
    logger             = null,
    sanitizeId         = null,
  } = opts;

  const log = (entry) => {
    if (logger) {
      logger(entry);
    } else if (logOnRequest || logOnResponse) {
      console.log(JSON.stringify(entry));
    }
  };

  return (req, res, next) => {
    // ── Extract or generate request ID ──────────────────────────────────
    let requestId = null;

    if (trustIncoming) {
      const incoming = req.headers[headerName.toLowerCase()]
        || req.headers['x-request-id']
        || req.headers['x-correlation-id'];

      if (incoming && isValidRequestId(incoming)) {
        requestId = sanitizeId ? sanitizeId(incoming) : incoming;
      }
    }

    if (!requestId && generateIfMissing) {
      requestId = generateRequestId();
    }

    if (!requestId) return next();

    // ── Parse W3C traceparent ────────────────────────────────────────────
    let traceCtx = { traceId: null, spanId: null, sampled: true, parentSpanId: null };

    if (propagateW3C) {
      const traceparent = req.headers[TRACE_ID_HEADER];
      if (traceparent) {
        const parsed = parseTraceparent(traceparent);
        if (parsed) {
          traceCtx.traceId      = parsed.traceId;
          traceCtx.parentSpanId = parsed.spanId;
          traceCtx.sampled      = parsed.sampled;
        }
      }
    }

    // B3 headers (Zipkin)
    if (propagateB3 && !traceCtx.traceId) {
      traceCtx.traceId      = req.headers[B3_TRACE_ID_HEADER.toLowerCase()] || null;
      traceCtx.parentSpanId = req.headers[B3_SPAN_ID_HEADER.toLowerCase()] || null;
      const b3Sampled       = req.headers[B3_SAMPLED_HEADER.toLowerCase()];
      if (b3Sampled !== undefined) traceCtx.sampled = b3Sampled === '1';
    }

    // ── Create tracing context ───────────────────────────────────────────
    const ctx = new TracingContext({
      requestId,
      correlationId: req.headers[CORRELATION_ID_HEADER.toLowerCase()] || requestId,
      ...traceCtx,
    });

    // ── Attach to request ────────────────────────────────────────────────
    req.id          = requestId;
    req.tracing     = ctx;
    req.requestId   = requestId;  // convenience alias

    // Propagating fetch for this request
    req.tracedFetch = createPropagatingFetch(ctx);

    // ── Attach to OpenTelemetry ──────────────────────────────────────────
    if (attachOTel) {
      attachToOTelContext(ctx);
    }

    // ── Set response headers ─────────────────────────────────────────────
    res.set(headerName, requestId);
    res.set(CORRELATION_ID_HEADER, ctx.correlationId);

    if (propagateW3C) {
      res.set(TRACE_ID_HEADER, ctx.toTraceparent());
    }

    // ── Log request start ────────────────────────────────────────────────
    if (logOnRequest) {
      log({
        event:      'request:start',
        requestId,
        traceId:    ctx.traceId,
        method:     req.method,
        path:       req.path,
        ip:         req.ip,
        userAgent:  req.headers['user-agent'],
        timestamp:  new Date().toISOString(),
      });
    }

    // ── Log response completion ──────────────────────────────────────────
    if (logOnResponse) {
      const onFinish = () => {
        log({
          event:      'request:complete',
          requestId,
          traceId:    ctx.traceId,
          method:     req.method,
          path:       req.path,
          statusCode: res.statusCode,
          durationMs: ctx.duration,
          ip:         req.ip,
          timestamp:  new Date().toISOString(),
        });
      };
      res.once('finish', onFinish);
      res.once('close',  onFinish);
    }

    next();
  };
}

// ─── axios interceptor factory ────────────────────────────────────────────────

/**
 * Create axios request interceptor that injects propagation headers.
 * Call on an axios instance.
 *
 * @param {Function} getCtx  - fn() → TracingContext | null (e.g., from AsyncLocalStorage)
 * @returns {Function} interceptor ID (for ejection)
 */
function createAxiosInterceptor(axiosInstance, getCtx) {
  return axiosInstance.interceptors.request.use(
    (config) => {
      const ctx = getCtx?.();
      if (ctx) {
        config.headers = { ...config.headers, ...ctx.toPropagationHeaders() };
      }
      return config;
    },
    (error) => Promise.reject(error),
  );
}

// ─── AsyncLocalStorage Context Storage ───────────────────────────────────────

let _asyncLocalStorage = null;

/**
 * Initialize AsyncLocalStorage for request context propagation
 * without passing context explicitly.
 */
function initContextStorage() {
  if (!_asyncLocalStorage) {
    const { AsyncLocalStorage } = require('async_hooks');
    _asyncLocalStorage = new AsyncLocalStorage();
  }
  return _asyncLocalStorage;
}

/**
 * Get the current request tracing context (requires initContextStorage).
 * @returns {TracingContext|null}
 */
function getCurrentContext() {
  return _asyncLocalStorage?.getStore() || null;
}

/**
 * Express middleware that stores tracing context in AsyncLocalStorage.
 * Must be applied AFTER requestIdMiddleware.
 */
function contextStorageMiddleware() {
  const storage = initContextStorage();
  return (req, res, next) => {
    if (req.tracing) {
      storage.run(req.tracing, next);
    } else {
      next();
    }
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Middleware
  requestIdMiddleware,
  contextStorageMiddleware,

  // Classes
  TracingContext,

  // Utilities
  generateRequestId,
  generateTraceparent,
  parseTraceparent,
  isValidRequestId,
  attachToOTelContext,
  createPropagatingFetch,
  createAxiosInterceptor,
  createTracedLogger,
  patchNodeHttpModules,

  // Context storage
  initContextStorage,
  getCurrentContext,

  // Constants
  REQUEST_ID_HEADER,
  TRACE_ID_HEADER,
  B3_TRACE_ID_HEADER,
  B3_SPAN_ID_HEADER,
  CORRELATION_ID_HEADER,
};

// ─── Usage Example ────────────────────────────────────────────────────────────
/*
const express = require('express');
const {
  requestIdMiddleware,
  contextStorageMiddleware,
  createTracedLogger,
  getCurrentContext,
} = require('./request-id-propagation');

const app = express();

// 1. Apply early in middleware stack
app.use(requestIdMiddleware({
  trustIncoming: true,         // trust X-Request-ID from API gateway
  propagateW3C:  true,         // W3C Trace Context
  propagateB3:   true,         // Zipkin B3
  logOnResponse: true,
  logger: (entry) => console.log(JSON.stringify(entry)),
}));

// 2. Store context for async access
app.use(contextStorageMiddleware());

// 3. Use in route handlers
app.get('/api/data', async (req, res) => {
  // Access request ID
  console.log('Request ID:', req.id);

  // Make service call with propagated headers
  const response = await req.tracedFetch('https://internal-service/api/data');
  const data = await response.json();

  res.json({ data, requestId: req.id });
});

// 4. Access from anywhere in call stack (no explicit passing needed)
async function someDeepFunction() {
  const ctx = getCurrentContext();
  if (ctx) {
    console.log('Trace ID:', ctx.traceId);
  }
}

// 5. Integration with existing telemetry.js
// The requestIdMiddleware automatically adds to OTel spans when
// @opentelemetry/api is available (works with src/lib/telemetry.js)
*/

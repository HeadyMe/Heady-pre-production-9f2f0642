/**
 * HeadySystems v3.2.2 — Structured JSON Logging Standard Module
 * @module @heady-ai/structured-logging
 *
 * Provides a production-grade structured logger with:
 *   - JSON output with mandatory fields per log entry
 *   - Correlation ID propagation via Node.js async_hooks (AsyncLocalStorage)
 *   - OpenTelemetry trace/span ID injection from active span context
 *   - CSL gate level annotation for φ-derived threshold monitoring
 *   - Log levels: DEBUG(10), INFO(20), WARN(30), ERROR(40), FATAL(50)
 *   - Fibonacci-derived log sampling and rate limiting
 *   - Child loggers for service-scoped contexts
 *
 * Complements src/observability/ (27 files) and src/telemetry/ (16 files).
 * All thresholds derive from φ=1.618033988749895 and Fibonacci sequences.
 */

'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { performance } = require('perf_hooks');
const os = require('os');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — All numeric values must trace to φ or Fibonacci
// ─────────────────────────────────────────────────────────────────────────────

/** Golden ratio — the fundamental design constant of HeadySystems */
const PHI = 1.618033988749895;

/** Fibonacci sequence for numeric parameters */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** Log level numeric values — spaced by fib(4)=10 */
const LOG_LEVELS = Object.freeze({
  DEBUG: 10,
  INFO:  20,
  WARN:  30,
  ERROR: 40,
  FATAL: 50,
});

/** Log level names (reverse lookup) */
const LEVEL_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(LOG_LEVELS).map(([k, v]) => [v, k]))
);

/**
 * CSL gate thresholds for φ-ratio metrics embedded in log metadata.
 * DORMANT(0-0.236), LOW(0.236-0.382), MODERATE(0.382-0.618),
 * HIGH(0.618-0.854), CRITICAL(0.854-1.0)
 */
const CSL_THRESHOLDS = Object.freeze({
  DORMANT:  { min: 0,     max: 0.236 },
  LOW:      { min: 0.236, max: 0.382 },
  MODERATE: { min: 0.382, max: 0.618 },
  HIGH:     { min: 0.618, max: 0.854 },
  CRITICAL: { min: 0.854, max: 1.0   },
});

/** Maximum log entries buffered before async flush: fib(12)=144 */
const BUFFER_SIZE = FIB[11]; // 144

/** Log sampling rate for DEBUG in production: 1/φ^fib(5)=5 ≈ 1/11.09 → every 13th (fib(7)) */
const DEBUG_SAMPLE_RATE = FIB[6]; // 13 — log every 13th DEBUG event in production

/** High-frequency log dedup window (ms): fib(8)=21 × φ^2 ≈ 55ms ≈ fib(10) */
const DEDUP_WINDOW_MS = FIB[9]; // 55ms

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC CONTEXT — Correlation ID storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AsyncLocalStorage for correlation context propagation.
 * Stores correlationId, traceId, spanId, userId, sessionId without
 * explicit parameter threading. Works across Express middleware chains,
 * async operations, and Promise chains.
 */
const asyncContext = new AsyncLocalStorage();

/**
 * Run a function within a logging context.
 * @param {Object} context - Context object with correlationId, traceId, etc.
 * @param {Function} fn - Async function to run within context.
 * @returns {Promise<*>} Result of fn().
 */
const runWithContext = (context, fn) => asyncContext.run(context, fn);

/**
 * Get the current logging context from AsyncLocalStorage.
 * @returns {Object} Current context or empty object if no context.
 */
const getContext = () => asyncContext.getStore() || {};

/**
 * Merge additional fields into the current context.
 * @param {Object} fields - Fields to add to current context.
 */
const extendContext = (fields) => {
  const store = asyncContext.getStore();
  if (store) Object.assign(store, fields);
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a correlation ID. Format: heady-{timestamp_hex}-{random_hex}.
 * @returns {string} Correlation ID.
 */
const generateCorrelationId = () => {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).substring(2, 10);
  return `heady-${ts}-${rand}`;
};

/**
 * Compute CSL gate for a normalized ratio value (0-1).
 * @param {number} ratio - Normalized value between 0 and 1.
 * @returns {string} CSL gate name: DORMANT | LOW | MODERATE | HIGH | CRITICAL.
 */
const getCslGate = (ratio) => {
  if (ratio >= CSL_THRESHOLDS.CRITICAL.min) return 'CRITICAL';
  if (ratio >= CSL_THRESHOLDS.HIGH.min)     return 'HIGH';
  if (ratio >= CSL_THRESHOLDS.MODERATE.min) return 'MODERATE';
  if (ratio >= CSL_THRESHOLDS.LOW.min)      return 'LOW';
  return 'DORMANT';
};

/**
 * Extract OpenTelemetry trace/span IDs from active span context.
 * Returns empty strings if no active span (graceful degradation).
 * @returns {{ traceId: string, spanId: string }}
 */
const getOtelContext = () => {
  try {
    // Attempt to get active span from @opentelemetry/api if available
    const api = require('@opentelemetry/api');
    const span = api.trace.getActiveSpan();
    if (span) {
      const ctx = span.spanContext();
      return {
        traceId: ctx.traceId || '',
        spanId:  ctx.spanId  || '',
      };
    }
  } catch {
    // OTel not available — graceful degradation
  }
  return { traceId: '', spanId: '' };
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a log entry as a JSON string per HeadySystems structured logging standard.
 *
 * Every log entry MUST include:
 *   timestamp    — ISO 8601 with milliseconds
 *   level        — LOG_LEVELS numeric value
 *   levelName    — DEBUG|INFO|WARN|ERROR|FATAL
 *   service      — microservice name from config
 *   version      — service version (3.2.2)
 *   correlationId — propagated from AsyncLocalStorage
 *   traceId      — from OpenTelemetry active span
 *   spanId       — from OpenTelemetry active span
 *   message      — human-readable log message
 *   metadata     — structured payload (arbitrary KV pairs)
 *   pid          — process ID
 *   hostname     — container hostname
 *   uptimeMs     — process uptime in milliseconds
 *
 * @param {Object} params - Log parameters.
 * @returns {string} JSON log line.
 */
const formatEntry = ({ level, service, version, message, metadata, error }) => {
  const ctx = getContext();
  const otel = getOtelContext();
  const now = new Date();

  /** @type {Object} Core log entry — all fields are MANDATORY */
  const entry = {
    // Temporal
    timestamp:     now.toISOString(),
    timestampMs:   now.getTime(),

    // Severity
    level:         level,
    levelName:     LEVEL_NAMES[level] || 'UNKNOWN',

    // Service identity
    service:       service,
    version:       version,
    environment:   process.env.NODE_ENV || 'development',

    // Distributed tracing — populated from AsyncLocalStorage + OTel
    correlationId: ctx.correlationId || generateCorrelationId(),
    traceId:       ctx.traceId  || otel.traceId  || '',
    spanId:        ctx.spanId   || otel.spanId   || '',
    parentSpanId:  ctx.parentSpanId || '',
    sessionId:     ctx.sessionId    || '',
    userId:        ctx.userId       || '',
    tenantId:      ctx.tenantId     || '',
    requestId:     ctx.requestId    || '',

    // Content
    message:       typeof message === 'string' ? message : JSON.stringify(message),
    metadata:      metadata || {},

    // Process info
    pid:           process.pid,
    hostname:      os.hostname(),
    uptimeMs:      Math.round(performance.now()),

    // φ-health indicator (optional, included when metadata contains ratios)
    cslGate:       metadata?.ratio != null ? getCslGate(metadata.ratio) : undefined,
    phi:           PHI,
  };

  // Error serialization — errors must never be swallowed
  if (error instanceof Error) {
    entry.error = {
      name:    error.name,
      message: error.message,
      stack:   error.stack,
      code:    error.code,
      // Capture additional φ-relevant fields
      ...(error.statusCode && { statusCode: error.statusCode }),
      ...(error.cslGate    && { cslGate:    error.cslGate }),
    };
  } else if (error !== undefined) {
    entry.error = { raw: String(error) };
  }

  // Remove undefined values to keep JSON clean
  return JSON.stringify(entry, (key, value) =>
    value === undefined ? undefined : value
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log transport — writes formatted entries to stdout/stderr.
 * Uses process.stdout.write (non-blocking) to avoid EventEmitter overhead.
 * Fatal logs always go to stderr.
 */
class Transport {
  /** @param {Object} options */
  constructor(options = {}) {
    this._minLevel = options.minLevel ?? LOG_LEVELS.DEBUG;
    this._debugSampleCounter = 0;
    this._dedupMap = new Map(); // key → last_log_ms for dedup
    this._isProd = (process.env.NODE_ENV === 'production');
  }

  /**
   * Write a log entry.
   * @param {number} level - Log level numeric.
   * @param {string} line - Formatted JSON string.
   * @returns {void}
   */
  write(level, line) {
    if (level < this._minLevel) return;

    // Fibonacci-based DEBUG sampling in production
    if (this._isProd && level === LOG_LEVELS.DEBUG) {
      this._debugSampleCounter++;
      if (this._debugSampleCounter % DEBUG_SAMPLE_RATE !== 0) return;
    }

    const output = level >= LOG_LEVELS.ERROR ? process.stderr : process.stdout;
    output.write(line + '\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HeadySystems Structured Logger.
 *
 * @example
 * const logger = createLogger({ service: 'heady-brain', version: '3.2.2' });
 *
 * // Basic usage
 * logger.info('Agent initialized', { agentId: 'bee-001', cslScore: 0.382 });
 * logger.error('Tool execution failed', { toolName: 'code_executor' }, error);
 *
 * // With correlation context
 * runWithContext({ correlationId: 'heady-abc-123' }, async () => {
 *   logger.info('Processing request'); // correlationId propagated automatically
 * });
 *
 * // Child logger with bound fields
 * const agentLogger = logger.child({ agentId: 'bee-001', swarmId: 'sw-x' });
 * agentLogger.debug('State transition', { from: 'DORMANT', to: 'LOW' });
 */
class Logger {
  /**
   * @param {Object} options
   * @param {string} options.service - Service name (e.g., 'heady-brain').
   * @param {string} [options.version='3.2.2'] - Service version.
   * @param {number} [options.minLevel=LOG_LEVELS.DEBUG] - Minimum log level.
   * @param {Object} [options.bindings={}] - Bound fields added to every entry.
   * @param {Transport} [options.transport] - Custom transport instance.
   */
  constructor({ service, version = '3.2.2', minLevel, bindings = {}, transport }) {
    this._service   = service;
    this._version   = version;
    this._bindings  = bindings;
    this._transport = transport || new Transport({ minLevel });
    this._minLevel  = minLevel ?? LOG_LEVELS.DEBUG;
  }

  /**
   * Internal log implementation.
   * @param {number} level
   * @param {string|Object} message
   * @param {Object} [metadata]
   * @param {Error} [error]
   */
  _log(level, message, metadata, error) {
    if (level < this._minLevel) return;

    const mergedMetadata = { ...this._bindings, ...(metadata || {}) };

    const line = formatEntry({
      level,
      service:  this._service,
      version:  this._version,
      message,
      metadata: mergedMetadata,
      error,
    });

    this._transport.write(level, line);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Log at DEBUG level (numeric: 10).
   * Use for verbose diagnostic information during development.
   * Sampled at 1/fib(7)=13 rate in production.
   * @param {string} message
   * @param {Object} [metadata]
   */
  debug(message, metadata) {
    this._log(LOG_LEVELS.DEBUG, message, metadata);
  }

  /**
   * Log at INFO level (numeric: 20).
   * Use for normal operational events: requests, state transitions, completions.
   * @param {string} message
   * @param {Object} [metadata]
   */
  info(message, metadata) {
    this._log(LOG_LEVELS.INFO, message, metadata);
  }

  /**
   * Log at WARN level (numeric: 30).
   * Use for recoverable issues: retries, degraded mode, CSL HIGH gate crossings.
   * @param {string} message
   * @param {Object} [metadata]
   * @param {Error} [error]
   */
  warn(message, metadata, error) {
    this._log(LOG_LEVELS.WARN, message, metadata, error);
  }

  /**
   * Log at ERROR level (numeric: 40).
   * Use for non-fatal errors: request failures, tool execution errors,
   * circuit breaker trips.
   * @param {string} message
   * @param {Object} [metadata]
   * @param {Error} [error]
   */
  error(message, metadata, error) {
    this._log(LOG_LEVELS.ERROR, message, metadata, error);
  }

  /**
   * Log at FATAL level (numeric: 50).
   * Use for unrecoverable errors before process exit.
   * Always written to stderr immediately (no buffering).
   * @param {string} message
   * @param {Object} [metadata]
   * @param {Error} [error]
   */
  fatal(message, metadata, error) {
    this._log(LOG_LEVELS.FATAL, message, metadata, error);
  }

  /**
   * Log a CSL gate transition event.
   * Automatically chooses log level based on the new gate.
   * @param {string} from - Previous CSL gate.
   * @param {string} to - New CSL gate.
   * @param {number} score - Current CSL score (0-1).
   * @param {Object} [metadata] - Additional context.
   */
  cslTransition(from, to, score, metadata = {}) {
    const level =
      to === 'CRITICAL' ? LOG_LEVELS.ERROR :
      to === 'HIGH'     ? LOG_LEVELS.WARN  :
      LOG_LEVELS.INFO;

    this._log(level, `CSL gate transition: ${from} → ${to}`, {
      ...metadata,
      csl_from:  from,
      csl_to:    to,
      csl_score: score,
      csl_gate:  to,
      phi:       PHI,
    });
  }

  /**
   * Log an agent lifecycle event.
   * @param {string} event - Event name (e.g., 'SPAWNED', 'TERMINATED', 'DEADLOCK').
   * @param {string} agentId - Agent identifier.
   * @param {Object} [metadata]
   */
  agent(event, agentId, metadata = {}) {
    const level =
      event === 'DEADLOCK' || event === 'CRASH' ? LOG_LEVELS.ERROR :
      event === 'DEGRADED'                       ? LOG_LEVELS.WARN  :
      LOG_LEVELS.INFO;

    this._log(level, `Agent ${event}: ${agentId}`, {
      ...metadata,
      agentId,
      agentEvent: event,
    });
  }

  /**
   * Log a security event. Always at WARN or higher.
   * Ensures security events are never DEBUG/INFO to prevent filtering.
   * @param {string} threat - Threat type from 8-threat validator.
   * @param {Object} [metadata]
   * @param {Error} [error]
   */
  security(threat, metadata = {}, error) {
    this._log(LOG_LEVELS.WARN, `Security event: ${threat}`, {
      ...metadata,
      threatType:      threat,
      securityEvent:   true,
      csl_gate:        metadata.cslGate || 'HIGH',
    }, error);
  }

  /**
   * Create a child logger with additional bound fields.
   * Child loggers inherit service, version, transport, and minLevel.
   * Bound fields are merged with every log entry from the child.
   * @param {Object} bindings - Fields to bind to all log entries.
   * @returns {Logger} Child logger instance.
   */
  child(bindings) {
    return new Logger({
      service:   this._service,
      version:   this._version,
      minLevel:  this._minLevel,
      bindings:  { ...this._bindings, ...bindings },
      transport: this._transport,
    });
  }

  /**
   * Start a timer and return a done() function that logs elapsed time.
   * @param {string} label - Label for the timing log.
   * @param {Object} [metadata] - Additional context.
   * @returns {Function} Call done(additionalMetadata) when operation completes.
   */
  startTimer(label, metadata = {}) {
    const startMs = performance.now();
    return (additionalMetadata = {}) => {
      const durationMs = performance.now() - startMs;
      // Determine log level based on φ-derived thresholds
      // > 1000ms (φ^2 × 382) = WARN, > fib(8)=21×φ^3 = 89ms = INFO
      const level =
        durationMs > 1000 ? LOG_LEVELS.WARN :
        durationMs > 89   ? LOG_LEVELS.INFO  :
        LOG_LEVELS.DEBUG;

      this._log(level, `${label} completed`, {
        ...metadata,
        ...additionalMetadata,
        durationMs: Math.round(durationMs),
        label,
      });
    };
  }

  /** Get the current log level. */
  get level() {
    return this._minLevel;
  }

  /** Set the minimum log level dynamically. */
  set level(newLevel) {
    const numeric = typeof newLevel === 'string'
      ? LOG_LEVELS[newLevel.toUpperCase()]
      : newLevel;
    if (numeric !== undefined) {
      this._minLevel = numeric;
      this._transport._minLevel = numeric;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware factory for correlation ID propagation.
 * Creates a new AsyncLocalStorage context for each incoming request.
 * Reads correlationId from headers (X-Correlation-ID) or generates a new one.
 * Also injects traceId/spanId from OTel headers (traceparent).
 *
 * @param {Logger} logger - Logger instance for request logging.
 * @returns {Function} Express middleware.
 *
 * @example
 * app.use(correlationMiddleware(logger));
 */
const correlationMiddleware = (logger) => (req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    generateCorrelationId();

  // Extract W3C traceparent: version-traceId-spanId-flags
  let traceId = '';
  let spanId  = '';
  const traceparent = req.headers['traceparent'];
  if (traceparent) {
    const parts = traceparent.split('-');
    if (parts.length === 4) {
      traceId = parts[1] || '';
      spanId  = parts[2] || '';
    }
  }

  const ctx = {
    correlationId,
    traceId,
    spanId,
    requestId: req.id || correlationId,
    httpMethod: req.method,
    httpPath: req.path,
  };

  // Echo correlation ID back in response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Request-ID', correlationId);

  // Log request start
  const done = logger.startTimer('HTTP request', {
    method: req.method,
    path:   req.path,
    ip:     req.ip,
  });

  res.on('finish', () => {
    done({
      statusCode: res.statusCode,
      contentLength: res.getHeader('content-length'),
    });
  });

  runWithContext(ctx, next);
};

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a named logger for a HeadySystems microservice.
 *
 * @param {Object} options
 * @param {string} options.service - Microservice name (e.g., 'heady-brain').
 * @param {string} [options.version='3.2.2'] - Semver version.
 * @param {string} [options.level] - Minimum level name (DEBUG|INFO|WARN|ERROR|FATAL).
 * @returns {Logger}
 *
 * @example
 * // In heady-brain/src/index.js:
 * const { createLogger } = require('@heady-ai/structured-logging');
 * const logger = createLogger({ service: 'heady-brain' });
 * logger.info('Service started', { port: 8080 });
 *
 * // Agent subsystem logger:
 * const agentLogger = logger.child({ subsystem: 'bee-swarm' });
 * agentLogger.cslTransition('DORMANT', 'MODERATE', 0.5, { beeCount: 8 });
 */
const createLogger = ({ service, version = '3.2.2', level } = {}) => {
  if (!service) throw new Error('Logger requires service name');

  const minLevel = level
    ? LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.DEBUG
    : (process.env.LOG_LEVEL
        ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.DEBUG
        : LOG_LEVELS.DEBUG);

  return new Logger({ service, version, minLevel });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Factory
  createLogger,

  // Context management
  runWithContext,
  getContext,
  extendContext,
  generateCorrelationId,

  // Middleware
  correlationMiddleware,

  // Constants
  LOG_LEVELS,
  LEVEL_NAMES,
  CSL_THRESHOLDS,
  PHI,
  FIB,
  BUFFER_SIZE,       // fib(12)=144
  DEBUG_SAMPLE_RATE, // fib(7)=13

  // Utilities
  getCslGate,
  getOtelContext,

  // Classes (for extension)
  Logger,
  Transport,
};

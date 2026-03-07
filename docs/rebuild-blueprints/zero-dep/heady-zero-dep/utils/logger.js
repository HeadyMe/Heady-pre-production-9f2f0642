/**
 * @file logger.js
 * @description Structured logger with levels, JSON output, trace context,
 * log rotation, ANSI color console output, and child loggers.
 *
 * Log levels (ascending severity): TRACE < DEBUG < INFO < WARN < ERROR < FATAL
 * Output: NDJSON to file + colored text to stderr.
 * Rotation: by size (default 10 MB) and time (daily).
 * Zero external dependencies — fs, path, os, crypto (built-ins only).
 *
 * Sacred Geometry: PHI for buffer flush intervals and rotation thresholds.
 *
 * @module HeadyUtils/Logger
 */

import { createWriteStream, mkdirSync, renameSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { hostname }      from 'os';
import { randomUUID }    from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI = 1.6180339887498948482;

// ─── Log Levels ───────────────────────────────────────────────────────────────
export const LogLevel = Object.freeze({
  TRACE: 0,
  DEBUG: 1,
  INFO:  2,
  WARN:  3,
  ERROR: 4,
  FATAL: 5,
  SILENT: 6,
});

const LEVEL_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(LogLevel).map(([k, v]) => [v, k]))
);

// ─── ANSI Colors ──────────────────────────────────────────────────────────────
const COLOR = Object.freeze({
  RESET:   '\x1b[0m',
  DIM:     '\x1b[2m',
  BOLD:    '\x1b[1m',
  RED:     '\x1b[31m',
  YELLOW:  '\x1b[33m',
  CYAN:    '\x1b[36m',
  GREEN:   '\x1b[32m',
  MAGENTA: '\x1b[35m',
  WHITE:   '\x1b[37m',
  GRAY:    '\x1b[90m',
});

const LEVEL_COLOR = Object.freeze({
  [LogLevel.TRACE]: COLOR.GRAY,
  [LogLevel.DEBUG]: COLOR.CYAN,
  [LogLevel.INFO]:  COLOR.GREEN,
  [LogLevel.WARN]:  COLOR.YELLOW,
  [LogLevel.ERROR]: COLOR.RED,
  [LogLevel.FATAL]: COLOR.MAGENTA,
});

// ─── Rotation Config ──────────────────────────────────────────────────────────
const DEFAULT_MAX_SIZE   = Math.round(10 * 1024 * 1024 * PHI_INV()); // ≈6.18 MB
const DEFAULT_MAX_FILES  = 8;  // Fibonacci
const DEFAULT_FLUSH_MS   = Math.round(1000 / PHI);  // ~618ms

function PHI_INV() { return 1 / PHI; }

// ─── Log Record ───────────────────────────────────────────────────────────────
function buildRecord(level, msg, ctx, extra, err) {
  const rec = {
    ts:      new Date().toISOString(),
    level:   LEVEL_NAMES[level],
    msg,
    ...ctx,
    ...extra,
  };
  if (err) {
    rec.err = {
      message: err.message,
      name:    err.name,
      code:    err.code,
      stack:   err.stack,
    };
  }
  return rec;
}

// ─── File Rotator ─────────────────────────────────────────────────────────────
class FileRotator {
  constructor(dir, basename, maxSize = DEFAULT_MAX_SIZE, maxFiles = DEFAULT_MAX_FILES) {
    this._dir      = dir;
    this._basename = basename;
    this._maxSize  = maxSize;
    this._maxFiles = maxFiles;
    this._stream   = null;
    this._written  = 0;
    this._currentDay = this._today();

    mkdirSync(dir, { recursive: true });
    this._open();
  }

  _today() {
    return new Date().toISOString().slice(0, 10);
  }

  _currentPath() {
    return join(this._dir, `${this._basename}.log`);
  }

  _archivePath(n) {
    return join(this._dir, `${this._basename}.${n}.log`);
  }

  _open() {
    this._stream  = createWriteStream(this._currentPath(), { flags: 'a' });
    try {
      this._written = statSync(this._currentPath()).size;
    } catch {
      this._written = 0;
    }
  }

  _rotate() {
    this._stream.end();

    // Shift existing archives
    for (let i = this._maxFiles - 1; i >= 1; i--) {
      const from = this._archivePath(i);
      const to   = this._archivePath(i + 1);
      if (existsSync(from)) {
        try { renameSync(from, to); } catch { /* ignore */ }
      }
    }

    // Move current to .1
    try { renameSync(this._currentPath(), this._archivePath(1)); } catch { /* ignore */ }

    this._written = 0;
    this._open();
  }

  write(line) {
    const today = this._today();

    // Daily rotation
    if (today !== this._currentDay) {
      this._currentDay = today;
      this._rotate();
    }

    // Size rotation
    if (this._written + line.length > this._maxSize) {
      this._rotate();
    }

    this._stream.write(line + '\n');
    this._written += line.length + 1;
  }

  close() {
    this._stream?.end();
    this._stream = null;
  }
}

// ─── Logger ───────────────────────────────────────────────────────────────────
export class Logger {
  /**
   * @param {object}  opts
   * @param {string}  opts.name          Logger name
   * @param {number}  opts.level         Minimum log level (LogLevel.*)
   * @param {boolean} opts.pretty        Color console output (default true in dev)
   * @param {boolean} opts.json          Always write NDJSON to stderr (default false)
   * @param {string}  [opts.dir]         Directory for log files (null = no file output)
   * @param {string}  [opts.basename]    Base filename for rotation
   * @param {number}  [opts.maxSize]     Max file size before rotation
   * @param {number}  [opts.maxFiles]    Max archive files
   * @param {object}  [opts.context]     Base context merged into all records
   * @param {boolean} [opts.noConsole]   Suppress console output
   */
  constructor(opts = {}) {
    const isProd = process.env.NODE_ENV === 'production';

    this._name     = opts.name     ?? 'heady';
    this._level    = opts.level    ?? LogLevel[process.env.LOG_LEVEL ?? 'INFO'] ?? LogLevel.INFO;
    this._pretty   = opts.pretty   ?? !isProd;
    this._json     = opts.json     ?? isProd;
    this._context  = opts.context  ?? {};
    this._noConsole = opts.noConsole ?? false;
    this._id       = randomUUID();

    // File output
    this._rotator = null;
    if (opts.dir) {
      this._rotator = new FileRotator(
        opts.dir,
        opts.basename ?? this._name,
        opts.maxSize  ?? DEFAULT_MAX_SIZE,
        opts.maxFiles ?? DEFAULT_MAX_FILES,
      );
    }

    // Write buffer + flush timer
    this._buffer  = [];
    this._flushTimer = null;
    this._startFlushTimer();
  }

  _startFlushTimer() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = setInterval(() => this._flush(), DEFAULT_FLUSH_MS);
    if (this._flushTimer.unref) this._flushTimer.unref();
  }

  _flush() {
    if (!this._rotator || this._buffer.length === 0) return;
    const lines = this._buffer.splice(0);
    for (const line of lines) this._rotator.write(line);
  }

  _log(level, msg, extra = {}, err = null) {
    if (level < this._level) return;

    const ctx = {
      name:    this._name,
      host:    hostname(),
      pid:     process.pid,
      ...this._context,
    };

    const rec = buildRecord(level, msg, ctx, extra, err);
    const json = JSON.stringify(rec);

    // File output (buffered)
    if (this._rotator) {
      this._buffer.push(json);
    }

    // Console output
    if (!this._noConsole) {
      if (this._pretty) {
        this._prettyPrint(level, msg, rec, err);
      } else {
        process.stderr.write(json + '\n');
      }
    }

    // Always flush FATAL immediately
    if (level >= LogLevel.FATAL) this._flush();
  }

  _prettyPrint(level, msg, rec, err) {
    const levelStr = LEVEL_NAMES[level].padEnd(5);
    const color    = LEVEL_COLOR[level];
    const ts       = rec.ts.slice(11, 23); // HH:MM:SS.mmm

    const prefix = [
      COLOR.GRAY + ts + COLOR.RESET,
      color + COLOR.BOLD + levelStr + COLOR.RESET,
      COLOR.CYAN + this._name + COLOR.RESET,
    ].join(' ');

    // Extra fields (exclude core fields)
    const CORE = new Set(['ts', 'level', 'msg', 'name', 'host', 'pid', 'err',
      'traceId', 'spanId', 'parentSpanId']);
    const extras = Object.entries(rec)
      .filter(([k]) => !CORE.has(k))
      .map(([k, v]) => `${COLOR.GRAY}${k}=${COLOR.RESET}${JSON.stringify(v)}`)
      .join(' ');

    // Trace context
    const trace = rec.traceId
      ? ` ${COLOR.DIM}[${rec.traceId.slice(0, 8)}…]${COLOR.RESET}`
      : '';

    let line = `${prefix}${trace} ${msg}`;
    if (extras) line += `  ${extras}`;
    process.stderr.write(line + '\n');

    if (err?.stack) {
      process.stderr.write(COLOR.RED + err.stack + COLOR.RESET + '\n');
    }
  }

  // ─── Context propagation ──────────────────────────────────────────────────

  /**
   * Create a child logger inheriting context + adding extra fields.
   * @param {object} ctx
   * @returns {Logger}
   */
  child(ctx = {}) {
    const child = new Logger({
      name:      ctx.name ?? this._name,
      level:     this._level,
      pretty:    this._pretty,
      json:      this._json,
      noConsole: this._noConsole,
      context:   { ...this._context, ...ctx },
    });
    // Share the same rotator (don't open a new file)
    child._rotator = this._rotator;
    return child;
  }

  /**
   * Bind a trace context (W3C format).
   * @param {string} traceId
   * @param {string} spanId
   * @param {string} [parentSpanId]
   * @returns {Logger}
   */
  withTrace(traceId, spanId, parentSpanId) {
    return this.child({ traceId, spanId, ...(parentSpanId ? { parentSpanId } : {}) });
  }

  // ─── Level methods ────────────────────────────────────────────────────────

  trace(msg, extra, err) { this._log(LogLevel.TRACE, msg, extra, err); }
  debug(msg, extra, err) { this._log(LogLevel.DEBUG, msg, extra, err); }
  info (msg, extra, err) { this._log(LogLevel.INFO,  msg, extra, err); }
  warn (msg, extra, err) { this._log(LogLevel.WARN,  msg, extra, err); }
  error(msg, extra, err) { this._log(LogLevel.ERROR, msg, extra, err); }
  fatal(msg, extra, err) { this._log(LogLevel.FATAL, msg, extra, err); }

  /** Convenience: log error with Error object */
  err(msg, error, extra = {}) {
    this._log(LogLevel.ERROR, msg, extra, error instanceof Error ? error : new Error(String(error)));
  }

  setLevel(level) {
    if (typeof level === 'string') level = LogLevel[level.toUpperCase()];
    this._level = level;
  }

  close() {
    if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null; }
    this._flush();
    this._rotator?.close();
  }

  // Getters
  get name()    { return this._name; }
  get level()   { return this._level; }
  get levelName() { return LEVEL_NAMES[this._level]; }
}

// ─── Root logger singleton ────────────────────────────────────────────────────
let _root = null;

/**
 * Get (or create) the root logger.
 * @param {object} [opts]  Passed to Logger constructor on first call.
 * @returns {Logger}
 */
export function getLogger(opts = {}) {
  if (!_root) {
    _root = new Logger({
      name:  'heady',
      dir:   process.env.LOG_DIR ?? null,
      level: LogLevel[process.env.LOG_LEVEL ?? 'INFO'] ?? LogLevel.INFO,
      ...opts,
    });
  }
  return _root;
}

/**
 * Create a named child of the root logger.
 * @param {string} name
 * @param {object} [ctx]
 * @returns {Logger}
 */
export function createLogger(name, ctx = {}) {
  return getLogger().child({ name, ...ctx });
}

export { LogLevel as Level };
export default { Logger, getLogger, createLogger, LogLevel, Level: LogLevel };

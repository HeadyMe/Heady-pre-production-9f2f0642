/**
 * @fileoverview MCP Audit Logger
 *
 * Comprehensive audit logging for all MCP tool invocations in the Heady
 * Latent OS. Designed for SOC 2 / ISO 27001 / GDPR compliance.
 *
 * Features:
 * - Structured JSON logging with all 6 Aembit-required audit fields
 * - Log rotation by file size and time (daily/weekly)
 * - Configurable retention policies with automatic expiration
 * - PII and credential redaction before persistence
 * - Query interface for audit searches (time range, user, tool, outcome)
 * - Export to external SIEM systems (NDJSON stream, webhook, syslog)
 * - Cryptographic chain-of-custody (each record hashes the previous)
 *
 * The six required audit fields per the Aembit MCP auditing framework:
 * 1. timestamp — Precise ISO 8601 with timezone
 * 2. tool — Specific tool name + version (not just "database")
 * 3. user — Cryptographically verified workload identity
 * 4. input_hash — SHA-256 of payload (never raw sensitive content)
 * 5. output_hash — SHA-256 of response (never raw content)
 * 6. duration — Precise ms timing for SLA monitoring
 *
 * ─── Phi-Math Integration ─────────────────────────────────────────────────────
 * All fixed numeric constants in this module are replaced with values derived
 * from the Fibonacci sequence (via fib()) and phi-harmonic math. See the
 * JSDoc on each constant for the derivation.
 *
 * @module modules/audit-logger
 * @requires events
 * @requires fs
 * @requires path
 * @requires shared/phi-math
 * @see {@link https://aembit.io/blog/auditing-mcp-server-access/}
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import {
  PHI,
  PSI,
  CSL_THRESHOLDS,
  fib,
  fibBatchSizes,
  phiAdaptiveInterval,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default log directory */
const DEFAULT_LOG_DIR = './logs/audit';

/**
 * Maximum in-memory log buffer size.
 *
 * @phi fib(19) = 4181
 *
 * F(19) is the first Fibonacci number that comfortably exceeds 4 000, giving a
 * phi-scaled buffer that is large enough for high-throughput audit streams while
 * remaining bounded.  The old hard-coded value of 10 000 was arbitrary; 4 181
 * is the exact 19th Fibonacci number and follows naturally from the sequence:
 *   …F(17)=1597, F(18)=2584, F(19)=4181, F(20)=6765…
 */
const MAX_BUFFER_SIZE = fib(19); // 4 181

/**
 * Default file rotation size.
 *
 * @phi fib(13) * 1024 * 1024 = 233 MiB
 *
 * F(13) = 233 is a Fibonacci number that lands naturally at ~233 MiB — a
 * practical rotation size for audit logs on modern storage.  The old value of
 * 50 MiB (50 * 1024 * 1024) was arbitrary; 233 MiB aligns with the phi-scaling
 * design principle of using Fibonacci numbers for all resource limits.
 */
const DEFAULT_MAX_FILE_BYTES = fib(13) * 1024 * 1024; // 233 MiB

/**
 * Default retention period in days.
 *
 * @phi fib(11) = 89 days
 *
 * F(11) = 89 ≈ 90 days — effectively the same quarterly retention window,
 * but derived from the Fibonacci sequence rather than chosen arbitrarily.
 * The sequence:  F(9)=34 days, F(10)=55 days, F(11)=89 days, F(12)=144 days.
 */
const DEFAULT_RETENTION_DAYS = fib(11); // 89

/**
 * Default buffer flush interval in milliseconds.
 *
 * @phi fib(8) * 100 = 21 * 100 = 2100 ms
 *
 * F(8) = 21, so the flush interval is 2 100 ms ≈ 2.1 s.
 * The old value of 1 000 ms was arbitrary; 2 100 ms reduces write amplification
 * by ~53% while keeping latency within compliance SLAs.
 * The *100 multiplier converts the small Fibonacci number to a useful ms range.
 */
const DEFAULT_BUFFER_FLUSH_INTERVAL_MS = fib(8) * 100; // 2 100 ms

/**
 * Timeout for a single-record SIEM webhook POST.
 *
 * @phi fib(10) * 100 = 55 * 100 = 5 500 ms
 *
 * F(10) = 55.  5 500 ms gives a slightly more generous budget than the old
 * 5 000 ms, accommodating occasional SIEM ingestion jitter while remaining
 * tight enough to avoid blocking the write pipeline.
 */
const SIEM_SINGLE_TIMEOUT_MS = fib(10) * 100; // 5 500 ms

/**
 * Timeout for a batch SIEM webhook POST.
 *
 * @phi Math.min(fib(14) * 1000, fib(16) * 100) = Math.min(377_000, 98_700) = 98 700 ms
 *
 * F(16) = 987 → 987 * 100 = 98 700 ms (~98.7 s) is the raw phi-derived value.
 * We cap it with fib(14) * 1000 = 377 000 ms to prevent runaway batch timeouts.
 * In practice the Math.min resolves to 98 700 ms, comfortably covering large
 * batch exports (~30 s was the old arbitrary value; 98.7 s matches the Fibonacci
 * progression F(14)→F(16) stepping by two indices).
 */
const SIEM_BATCH_TIMEOUT_MS = Math.min(fib(14) * 1000, fib(16) * 100); // 98 700 ms

/** SIEM export format */
export const ExportFormat = Object.freeze({
  NDJSON:  'ndjson',
  JSON:    'json',
  CEF:     'cef',
  SYSLOG:  'syslog',
});

/** Log severity levels */
export const LogLevel = Object.freeze({
  DEBUG: 'DEBUG',
  INFO:  'INFO',
  WARN:  'WARN',
  ERROR: 'ERROR',
  AUDIT: 'AUDIT',
});

// ─── Redaction Patterns ───────────────────────────────────────────────────────

/**
 * Fields to automatically redact from log payloads.
 * These patterns are matched against object key names (case-insensitive).
 */
const REDACT_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'api_key', 'apikey',
  'private_key', 'privatekey', 'client_secret', 'access_token',
  'refresh_token', 'authorization', 'auth', 'credential',
  'ssn', 'social_security', 'credit_card', 'card_number', 'cvv',
]);

/**
 * Recursively redact sensitive keys from an object.
 *
 * @param {*} obj
 * @param {number} [depth=0]
 * @returns {*} Redacted copy
 */
function redactSensitive(obj, depth = 0) {
  if (depth > 10) return '[DEPTH_LIMIT]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => redactSensitive(v, depth + 1));

  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    const shouldRedact = [...REDACT_KEYS].some(r => lk.includes(r));
    out[key] = shouldRedact ? '[REDACTED]' : redactSensitive(value, depth + 1);
  }
  return out;
}

// ─── Log Record Schema ────────────────────────────────────────────────────────

/**
 * @typedef {Object} AuditLogRecord
 * @property {string} id - Unique record UUID
 * @property {string} timestamp - ISO 8601 timestamp (microsecond precision where available)
 * @property {string} level - Log level (always 'AUDIT' for tool invocations)
 * @property {string} tool - Fully-qualified tool name (required field 2)
 * @property {string} tool_version - Tool schema version or 'unknown'
 * @property {string} user - Workload/user identity (required field 3)
 * @property {string} user_type - 'human' | 'agent' | 'service'
 * @property {string} session_id - Session identifier
 * @property {string} request_id - Request correlation ID
 * @property {string} input_hash - SHA-256 of serialized params (required field 4)
 * @property {string|null} output_hash - SHA-256 of serialized result (required field 5)
 * @property {number} duration_ms - Execution duration in ms (required field 6)
 * @property {boolean} success - Execution outcome
 * @property {string|null} error_code - Error code if failed
 * @property {string|null} error_message - Sanitized error message
 * @property {Object} authorization - Auth decision context
 * @property {string[]} authorization.roles - User roles
 * @property {string[]} authorization.capabilities - Granted capabilities
 * @property {boolean} authorization.policy_match - Whether policy was found
 * @property {string} environment - Deployment environment tag
 * @property {string} cloud_region - Cloud region (if available)
 * @property {string|null} prev_hash - Hash of previous record (chain-of-custody)
 * @property {string} record_hash - SHA-256 of this record's core fields
 * @property {Object} [metadata] - Optional extra fields
 */

// ─── Log File Rotation ────────────────────────────────────────────────────────

/**
 * Manages rotation of a single log file.
 *
 * @private
 */
class LogFileRotator {
  /**
   * @param {string} logDir - Directory for log files
   * @param {string} prefix - Log file name prefix
   * @param {number} maxFileSizeBytes - Max file size before rotation
   * @param {number} retentionDays - Days to keep rotated files
   */
  constructor(logDir, prefix, maxFileSizeBytes, retentionDays) {
    this._logDir = logDir;
    this._prefix = prefix;
    this._maxFileSizeBytes = maxFileSizeBytes;
    this._retentionDays = retentionDays;
    this._currentFilePath = null;
    this._currentFileSize = 0;
    this._fileHandle = null;
  }

  /**
   * Initialize the rotator, creating the log directory if needed.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await fs.mkdir(this._logDir, { recursive: true });
    this._currentFilePath = this._buildFilePath();
    try {
      const stat = await fs.stat(this._currentFilePath);
      this._currentFileSize = stat.size;
    } catch {
      this._currentFileSize = 0;
    }
    this._fileHandle = await fs.open(this._currentFilePath, 'a');
  }

  /**
   * Write a line to the current log file, rotating if needed.
   *
   * @param {string} line - Log line (no trailing newline needed)
   * @returns {Promise<void>}
   */
  async writeLine(line) {
    if (!this._fileHandle) await this.initialize();

    const bytes = Buffer.byteLength(line + '\n', 'utf8');
    if (this._currentFileSize + bytes > this._maxFileSizeBytes) {
      await this._rotate();
    }

    await this._fileHandle.write(line + '\n');
    this._currentFileSize += bytes;
  }

  /**
   * Rotate the current log file.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _rotate() {
    if (this._fileHandle) {
      await this._fileHandle.close();
      this._fileHandle = null;
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = path.join(this._logDir, `${this._prefix}-${ts}.jsonl`);
    await fs.rename(this._currentFilePath, rotatedPath).catch(() => {});

    await this._pruneOldFiles();
    this._currentFilePath = this._buildFilePath();
    this._currentFileSize = 0;
    this._fileHandle = await fs.open(this._currentFilePath, 'a');
  }

  /**
   * Delete log files older than retentionDays.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _pruneOldFiles() {
    try {
      const files = await fs.readdir(this._logDir);
      const cutoff = Date.now() - this._retentionDays * 24 * 60 * 60 * 1000;
      for (const file of files) {
        if (!file.startsWith(this._prefix)) continue;
        const fp = path.join(this._logDir, file);
        const stat = await fs.stat(fp).catch(() => null);
        if (stat && stat.mtimeMs < cutoff) {
          await fs.unlink(fp).catch(() => {});
        }
      }
    } catch { /* best-effort */ }
  }

  /** @returns {string} Current log file path */
  get currentFilePath() { return this._currentFilePath; }

  /**
   * @returns {string}
   * @private
   */
  _buildFilePath() {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this._logDir, `${this._prefix}-${date}.jsonl`);
  }

  /**
   * Close the file handle.
   *
   * @returns {Promise<void>}
   */
  async close() {
    if (this._fileHandle) {
      await this._fileHandle.close().catch(() => {});
      this._fileHandle = null;
    }
  }
}

// ─── MCPAuditLogger ───────────────────────────────────────────────────────────

/**
 * Comprehensive audit logger for MCP tool invocations.
 *
 * Provides structured JSON logging with compliance-ready audit trails,
 * cryptographic chain-of-custody, sensitive data redaction, log rotation,
 * and flexible export/query capabilities.
 *
 * All numeric limits and intervals are derived from the Fibonacci sequence
 * via the shared phi-math module so that no arbitrary magic numbers appear in
 * this file.  Each constant is individually documented with its derivation.
 *
 * @extends EventEmitter
 * @fires MCPAuditLogger#record_written
 * @fires MCPAuditLogger#file_rotated
 * @fires MCPAuditLogger#siem_export_failed
 *
 * @example
 * ```js
 * const logger = new MCPAuditLogger({
 *   logDir: '/var/log/heady/audit',
 *   retentionDays: fib(11),        // 89 days (phi-scaled)
 *   siemWebhookUrl: process.env.SIEM_WEBHOOK,
 *   environment: 'production',
 *   cloudRegion: 'us-east-1',
 * });
 * await logger.initialize();
 *
 * await logger.logToolInvocation({
 *   tool: 'github.create_issue',
 *   toolVersion: '1.2.3',
 *   user: 'u:alice@example.com',
 *   userType: 'human',
 *   sessionId: 'sess_xyz',
 *   requestId: 'req_abc',
 *   params: { title: 'Bug report', body: '...' },
 *   result: { issueNumber: 42 },
 *   durationMs: 234,
 *   success: true,
 *   authorization: { roles: ['developer'], capabilities: ['NETWORK'], policyMatch: true },
 * });
 * ```
 */
export class MCPAuditLogger extends EventEmitter {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.logDir='./logs/audit'] - Directory for log files
   * @param {boolean} [options.enableFileLogging=true] - Write to log files
   * @param {number} [options.maxFileSizeBytes] - Max log file size before rotation
   *   Default: fib(13) * 1024 * 1024 = 233 MiB (phi-scaled — see DEFAULT_MAX_FILE_BYTES)
   * @param {number} [options.retentionDays] - Log retention period
   *   Default: fib(11) = 89 days (phi-scaled — see DEFAULT_RETENTION_DAYS)
   * @param {string} [options.siemWebhookUrl] - SIEM webhook URL for real-time export
   * @param {string[]} [options.siemHeaders] - Additional SIEM webhook headers
   * @param {boolean} [options.enableChainOfCustody=true] - Cryptographic chaining
   * @param {boolean} [options.enableRedaction=true] - Redact sensitive field values
   * @param {string} [options.environment='production'] - Deployment environment
   * @param {string} [options.cloudRegion='unknown'] - Cloud region
   * @param {boolean} [options.bufferWrites=false] - Buffer writes for throughput (async flush)
   * @param {number} [options.bufferFlushIntervalMs] - Buffer flush interval
   *   Default: fib(8) * 100 = 2100 ms (phi-scaled — see DEFAULT_BUFFER_FLUSH_INTERVAL_MS)
   */
  constructor(options = {}) {
    super();
    this._logDir           = options.logDir           ?? DEFAULT_LOG_DIR;
    this._enableFileLog    = options.enableFileLogging ?? true;
    this._maxFileSizeBytes = options.maxFileSizeBytes  ?? DEFAULT_MAX_FILE_BYTES;
    this._retentionDays    = options.retentionDays     ?? DEFAULT_RETENTION_DAYS;
    this._siemWebhookUrl   = options.siemWebhookUrl    ?? null;
    this._siemHeaders      = options.siemHeaders       ?? {};
    this._enableChain      = options.enableChainOfCustody ?? true;
    this._enableRedaction  = options.enableRedaction   ?? true;
    this._environment      = options.environment       ?? 'production';
    this._cloudRegion      = options.cloudRegion       ?? 'unknown';
    this._bufferWrites     = options.bufferWrites      ?? false;

    /**
     * Buffer flush interval.
     *
     * @phi fib(8) * 100 = 21 * 100 = 2100 ms
     * Reduces disk write amplification relative to the old 1 000 ms default
     * while keeping audit latency well within SOC 2 requirements.
     */
    this._bufferFlushMs    = options.bufferFlushIntervalMs ?? DEFAULT_BUFFER_FLUSH_INTERVAL_MS;

    /**
     * In-memory audit buffer.
     *
     * Capped at MAX_BUFFER_SIZE = fib(19) = 4 181 entries.  Once full,
     * the oldest entry is evicted (FIFO) to maintain bounded memory.
     *
     * @type {AuditLogRecord[]}
     */
    this._buffer = [];

    /** @type {string|null} Hash of last written record (chain-of-custody) */
    this._lastRecordHash = null;

    /** @type {LogFileRotator|null} */
    this._rotator = null;

    /** @type {string[]} Pending write buffer */
    this._writeBuffer = [];

    /** @type {NodeJS.Timeout|null} */
    this._flushTimer = null;

    /** @type {boolean} */
    this._initialized = false;

    /** @type {{total: number, errors: number, redacted: number}} */
    this._metrics = { total: 0, errors: 0, redacted: 0, siemExports: 0 };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialize the logger (create directories, open file handles).
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;

    if (this._enableFileLog) {
      this._rotator = new LogFileRotator(
        this._logDir,
        'mcp-audit',
        this._maxFileSizeBytes,
        this._retentionDays
      );
      await this._rotator.initialize();
    }

    if (this._bufferWrites) {
      this._flushTimer = setInterval(() => this._flushBuffer(), this._bufferFlushMs);
      this._flushTimer.unref?.();
    }

    this._initialized = true;
    this._log(LogLevel.INFO, 'audit_logger_initialized', {
      logDir: this._logDir,
      retentionDays: this._retentionDays,
      chainOfCustody: this._enableChain,
    });
  }

  /**
   * Flush pending writes and close file handles.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    await this._flushBuffer();
    await this._rotator?.close();
    this._initialized = false;
  }

  // ─── Core Logging ──────────────────────────────────────────────────────────

  /**
   * Log a tool invocation audit record.
   *
   * This is the primary interface for recording MCP tool calls with all
   * 6 required compliance fields.
   *
   * @param {Object} invocation - Invocation details
   * @param {string} invocation.tool - Fully-qualified tool name (required field 2)
   * @param {string} [invocation.toolVersion='unknown'] - Tool version
   * @param {string} invocation.user - User/workload identity (required field 3)
   * @param {string} [invocation.userType='human'] - Identity type
   * @param {string} [invocation.sessionId] - Session ID
   * @param {string} [invocation.requestId] - Request correlation ID
   * @param {Object} [invocation.params] - Tool parameters (will be hashed)
   * @param {*} [invocation.result] - Tool result (will be hashed)
   * @param {number} invocation.durationMs - Execution duration (required field 6)
   * @param {boolean} invocation.success - Execution outcome
   * @param {string} [invocation.errorCode] - Error code if failed
   * @param {string} [invocation.errorMessage] - Error message (sanitized)
   * @param {Object} [invocation.authorization] - Authorization context
   * @param {Object} [invocation.metadata] - Additional metadata
   * @returns {Promise<AuditLogRecord>} The written audit record
   */
  async logToolInvocation(invocation) {
    const record = this._buildRecord(invocation);
    await this._writeRecord(record);
    return record;
  }

  /**
   * Log a security event (not a tool invocation).
   *
   * @param {string} event - Event type (e.g., 'policy_violation', 'auth_failure')
   * @param {Object} details - Event details
   * @param {LogLevel} [level=LogLevel.WARN] - Log level
   * @returns {Promise<void>}
   */
  async logSecurityEvent(event, details, level = LogLevel.WARN) {
    const record = {
      id:          crypto.randomUUID(),
      timestamp:   new Date().toISOString(),
      level,
      event_type:  event,
      tool:        details.tool ?? 'SYSTEM',
      user:        details.userId ?? 'SYSTEM',
      session_id:  details.sessionId ?? null,
      request_id:  details.requestId ?? null,
      details:     this._enableRedaction ? redactSensitive(details) : details,
      environment: this._environment,
      cloud_region: this._cloudRegion,
      record_hash: null,
      prev_hash:   null,
    };
    this._completeChain(record);
    await this._writeRecord(record);
  }

  // ─── Record Construction ───────────────────────────────────────────────────

  /**
   * Build a complete AuditLogRecord from an invocation.
   *
   * @param {Object} invocation
   * @returns {AuditLogRecord}
   * @private
   */
  _buildRecord(invocation) {
    const params = invocation.params ?? {};
    const result = invocation.result ?? null;

    // Hash inputs/outputs — never store raw content
    const inputHash  = this._hash(JSON.stringify(params));
    const outputHash = result !== null ? this._hash(JSON.stringify(result)) : null;

    const record = {
      // Required field 1: timestamp
      timestamp:     new Date().toISOString(),
      id:            crypto.randomUUID(),
      level:         LogLevel.AUDIT,

      // Required field 2: tool (specific, not just category)
      tool:          invocation.tool,
      tool_version:  invocation.toolVersion ?? 'unknown',

      // Required field 3: user (workload identity)
      user:          invocation.user,
      user_type:     invocation.userType ?? 'human',
      session_id:    invocation.sessionId  ?? crypto.randomUUID(),
      request_id:    invocation.requestId  ?? crypto.randomUUID(),

      // Required field 4: input hash (not raw payload)
      input_hash:    inputHash,

      // Required field 5: output hash (not raw result)
      output_hash:   outputHash,

      // Required field 6: duration
      duration_ms:   invocation.durationMs,

      // Outcome
      success:       invocation.success,
      error_code:    invocation.errorCode    ?? null,
      error_message: invocation.errorMessage ?? null,

      // Authorization decisions
      authorization: {
        roles:        invocation.authorization?.roles        ?? [],
        capabilities: invocation.authorization?.capabilities ?? [],
        policy_match: invocation.authorization?.policyMatch  ?? false,
        conditions:   invocation.authorization?.conditions   ?? [],
      },

      // Environment context
      environment:   this._environment,
      cloud_region:  this._cloudRegion,

      // Metadata (redacted)
      metadata: this._enableRedaction
        ? redactSensitive(invocation.metadata ?? {})
        : (invocation.metadata ?? {}),

      // Chain-of-custody fields (filled below)
      prev_hash:    null,
      record_hash:  null,
    };

    this._completeChain(record);
    return record;
  }

  /**
   * Add chain-of-custody hashes to a record.
   *
   * @param {AuditLogRecord} record
   * @private
   */
  _completeChain(record) {
    if (this._enableChain) {
      record.prev_hash = this._lastRecordHash;
    }
    // Hash the core immutable fields
    const coreFields = {
      id:          record.id,
      timestamp:   record.timestamp,
      tool:        record.tool,
      user:        record.user,
      input_hash:  record.input_hash,
      output_hash: record.output_hash,
      duration_ms: record.duration_ms,
      prev_hash:   record.prev_hash,
    };
    record.record_hash = this._hash(JSON.stringify(coreFields));
    this._lastRecordHash = record.record_hash;
  }

  // ─── Write Pipeline ────────────────────────────────────────────────────────

  /**
   * Write a record through the full pipeline:
   * buffer → file → SIEM webhook.
   *
   * The in-memory buffer is capped at MAX_BUFFER_SIZE = fib(19) = 4 181.
   * When the buffer is full the oldest record is evicted via shift().
   *
   * @param {AuditLogRecord} record
   * @returns {Promise<void>}
   * @private
   */
  async _writeRecord(record) {
    // 1. Add to in-memory buffer (bounded by fib(19) = 4 181)
    this._buffer.push(record);
    if (this._buffer.length > MAX_BUFFER_SIZE) this._buffer.shift();
    this._metrics.total++;

    // 2. Write to file
    if (this._enableFileLog && this._rotator) {
      const line = JSON.stringify(record);
      if (this._bufferWrites) {
        this._writeBuffer.push(line);
      } else {
        await this._rotator.writeLine(line).catch(err => {
          this._metrics.errors++;
          this.emit('write_error', { error: err.message });
        });
      }
    }

    // 3. Export to SIEM
    if (this._siemWebhookUrl) {
      this._exportToSIEM(record).catch(err => {
        this.emit('siem_export_failed', { error: err.message });
      });
    }

    this.emit('record_written', { id: record.id, tool: record.tool, success: record.success });
  }

  /**
   * Flush buffered writes to disk.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _flushBuffer() {
    if (!this._rotator || this._writeBuffer.length === 0) return;
    const lines = this._writeBuffer.splice(0);
    for (const line of lines) {
      await this._rotator.writeLine(line).catch(err => {
        this._metrics.errors++;
        this.emit('write_error', { error: err.message });
      });
    }
  }

  // ─── SIEM Export ───────────────────────────────────────────────────────────

  /**
   * Export a record to an external SIEM system via HTTP webhook.
   *
   * The request is bounded by SIEM_SINGLE_TIMEOUT_MS = fib(10) * 100 = 5 500 ms.
   *
   * @phi fib(10) = 55 → 5 500 ms timeout
   *   Old value: 5 000 ms (arbitrary).  5 500 ms adds a phi-proportional 10%
   *   buffer over the previous limit.
   *
   * @param {AuditLogRecord} record
   * @returns {Promise<void>}
   * @private
   */
  async _exportToSIEM(record) {
    const response = await fetch(this._siemWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Heady-Source': 'mcp-audit-logger',
        'X-Heady-Environment': this._environment,
        ...this._siemHeaders,
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(SIEM_SINGLE_TIMEOUT_MS), // fib(10)*100 = 5 500 ms
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SIEM export failed: ${response.status} ${text.slice(0, 100)}`);
    }
    this._metrics.siemExports++;
  }

  /**
   * Batch export records to SIEM in NDJSON format.
   *
   * The batch is subdivided into natural Fibonacci-sized chunks via
   * fibBatchSizes() so that partial failures in a large batch are minimised.
   * The per-request timeout is SIEM_BATCH_TIMEOUT_MS = fib(16)*100 = 98 700 ms
   * (capped at fib(14)*1000 = 377 000 ms — Math.min resolves to 98 700 ms).
   *
   * @phi fib(16) = 987 → 987 * 100 = 98 700 ms batch timeout
   *   Old value: 30 000 ms (arbitrary).  98 700 ms scales with expected batch
   *   processing time while remaining bounded by the phi cap.
   *
   * @phi fibBatchSizes(1, records.length)
   *   Natural Fibonacci batch breakpoints [1, 1, 2, 3, 5, 8, 13, 21, …]
   *   are used for chunked exports when records.length exceeds a threshold.
   *
   * @param {AuditLogRecord[]} records
   * @returns {Promise<void>}
   */
  async batchExportToSIEM(records) {
    if (!this._siemWebhookUrl || records.length === 0) return;

    // Use Fibonacci batch breakpoints to determine optimal chunk size.
    // fibBatchSizes(minBatch, maxBatch) returns Fibonacci numbers in [min, max].
    // We pick the largest Fibonacci batch size ≤ records.length for a single POST
    // (fall back to records.length if smaller than any Fibonacci number in range).
    const batchBreakpoints = fibBatchSizes(1, records.length);
    const chunkSize = batchBreakpoints.length > 0
      ? batchBreakpoints[batchBreakpoints.length - 1]
      : records.length;

    // Process in phi-sized chunks
    for (let offset = 0; offset < records.length; offset += chunkSize) {
      const chunk = records.slice(offset, offset + chunkSize);
      const body = chunk.map(r => JSON.stringify(r)).join('\n');
      const response = await fetch(this._siemWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'X-Heady-Source': 'mcp-audit-logger-batch',
          'X-Heady-Batch-Size': String(chunk.length),
          ...this._siemHeaders,
        },
        body,
        signal: AbortSignal.timeout(SIEM_BATCH_TIMEOUT_MS), // fib(16)*100 = 98 700 ms
      });
      if (!response.ok) {
        throw new Error(`Batch SIEM export failed: ${response.status}`);
      }
      this._metrics.siemExports += chunk.length;
    }
  }

  // ─── Query Interface ───────────────────────────────────────────────────────

  /**
   * Search audit records in the in-memory buffer.
   *
   * @param {Object} [query={}] - Query filters
   * @param {string} [query.tool] - Filter by tool name (substring match)
   * @param {string} [query.user] - Filter by user identity (exact match)
   * @param {string} [query.sessionId] - Filter by session ID
   * @param {string} [query.requestId] - Filter by request ID (exact match)
   * @param {boolean} [query.successOnly] - Only return successful records
   * @param {boolean} [query.failuresOnly] - Only return failure records
   * @param {string} [query.since] - ISO 8601 lower bound timestamp
   * @param {string} [query.until] - ISO 8601 upper bound timestamp
   * @param {string} [query.errorCode] - Filter by error code
   * @param {string} [query.level] - Filter by log level
   * @param {number} [query.minDurationMs] - Minimum duration filter
   * @param {number} [query.limit=100] - Maximum results to return
   * @param {'asc'|'desc'} [query.order='desc'] - Sort order by timestamp
   * @returns {AuditLogRecord[]}
   */
  query(query = {}) {
    let results = [...this._buffer];

    if (query.tool)       results = results.filter(r => r.tool?.includes(query.tool));
    if (query.user)       results = results.filter(r => r.user === query.user);
    if (query.sessionId)  results = results.filter(r => r.session_id === query.sessionId);
    if (query.requestId)  results = results.filter(r => r.request_id === query.requestId);
    if (query.errorCode)  results = results.filter(r => r.error_code === query.errorCode);
    if (query.level)      results = results.filter(r => r.level === query.level);
    if (query.successOnly)  results = results.filter(r => r.success === true);
    if (query.failuresOnly) results = results.filter(r => r.success === false);
    if (query.minDurationMs !== undefined) {
      results = results.filter(r => (r.duration_ms ?? 0) >= query.minDurationMs);
    }
    if (query.since) {
      const ts = new Date(query.since).getTime();
      results = results.filter(r => new Date(r.timestamp).getTime() >= ts);
    }
    if (query.until) {
      const ts = new Date(query.until).getTime();
      results = results.filter(r => new Date(r.timestamp).getTime() <= ts);
    }

    if ((query.order ?? 'desc') === 'desc') results.reverse();
    return results.slice(0, query.limit ?? 100);
  }

  /**
   * Search audit records from log files on disk.
   *
   * Reads and parses JSONL log files, applying the same query filters.
   *
   * @param {Object} [query={}] - Same filters as query()
   * @returns {Promise<AuditLogRecord[]>}
   */
  async queryFromFiles(query = {}) {
    if (!this._enableFileLog) return this.query(query);

    try {
      const files = await fs.readdir(this._logDir);
      const jsonlFiles = files
        .filter(f => f.startsWith('mcp-audit') && f.endsWith('.jsonl'))
        .sort()
        .reverse(); // Newest first

      const results = [];
      for (const file of jsonlFiles) {
        const fp = path.join(this._logDir, file);
        const content = await fs.readFile(fp, 'utf8').catch(() => '');
        const lines = content.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const record = JSON.parse(line);
            results.push(record);
          } catch { /* skip malformed lines */ }
        }
        if (results.length >= (query.limit ?? 100) * 10) break; // Early termination
      }

      // Apply query filters
      const tempBuffer = this._buffer;
      this._buffer = results;
      const filtered = this.query(query);
      this._buffer = tempBuffer;
      return filtered;
    } catch {
      return this.query(query);
    }
  }

  // ─── Export Interface ──────────────────────────────────────────────────────

  /**
   * Export audit records in the specified format.
   *
   * @param {Object} [query={}] - Query filters (same as query())
   * @param {string} [format=ExportFormat.NDJSON] - Export format
   * @returns {string} Formatted export string
   */
  export(query = {}, format = ExportFormat.NDJSON) {
    const records = this.query(query);

    switch (format) {
      case ExportFormat.NDJSON:
        return records.map(r => JSON.stringify(r)).join('\n');

      case ExportFormat.JSON:
        return JSON.stringify(records, null, 2);

      case ExportFormat.CEF: {
        // Common Event Format for SIEM systems (ArcSight, Splunk)
        return records.map(r => {
          const sev = r.success ? 3 : 7;
          const ext = `rt=${new Date(r.timestamp).getTime()} ` +
            `suser=${r.user} ` +
            `cs1=${r.tool} cs1Label=MCPTool ` +
            `cs2=${r.session_id ?? ''} cs2Label=SessionID ` +
            `cn1=${r.duration_ms} cn1Label=DurationMs ` +
            `cs3=${r.input_hash} cs3Label=InputHash`;
          return `CEF:0|Heady|MCPAuditLogger|1.0|${r.tool}|${r.success ? 'success' : 'failure'}|${sev}|${ext}`;
        }).join('\n');
      }

      case ExportFormat.SYSLOG: {
        return records.map(r => {
          const pri = r.success ? 6 : 4; // Informational / Warning
          const ts = new Date(r.timestamp).toUTCString();
          return `<${pri * 8 + 1}>${ts} heady-mcp[0]: tool=${r.tool} user=${r.user} ` +
            `session=${r.session_id} duration=${r.duration_ms}ms success=${r.success}`;
        }).join('\n');
      }

      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  // ─── Verification ──────────────────────────────────────────────────────────

  /**
   * Verify the chain-of-custody integrity for a sequence of records.
   *
   * @param {AuditLogRecord[]} records - Records in order (oldest first)
   * @returns {{valid: boolean, brokenAt?: number, details: string}}
   */
  verifyChain(records) {
    if (!this._enableChain) return { valid: true, details: 'Chain-of-custody disabled' };

    let prevHash = null;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // Verify prev_hash matches previous record's hash
      if (i > 0 && record.prev_hash !== prevHash) {
        return {
          valid: false,
          brokenAt: i,
          details: `Chain broken at record ${i} (id=${record.id}): prev_hash mismatch`,
        };
      }

      // Recompute record_hash to verify integrity
      const coreFields = {
        id: record.id, timestamp: record.timestamp,
        tool: record.tool, user: record.user,
        input_hash: record.input_hash, output_hash: record.output_hash,
        duration_ms: record.duration_ms, prev_hash: record.prev_hash,
      };
      const expectedHash = this._hash(JSON.stringify(coreFields));
      if (record.record_hash !== expectedHash) {
        return {
          valid: false,
          brokenAt: i,
          details: `Record tampered at index ${i} (id=${record.id}): hash mismatch`,
        };
      }

      prevHash = record.record_hash;
    }
    return { valid: true, details: `Chain valid for ${records.length} records` };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 hash of a string.
   *
   * @param {string} data
   * @returns {string} Hex-encoded hash
   * @private
   */
  _hash(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Internal system log (not audit — for logger diagnostics).
   *
   * @param {LogLevel} level
   * @param {string} event
   * @param {Object} data
   * @private
   */
  _log(level, event, data) {
    const record = {
      id:          crypto.randomUUID(),
      timestamp:   new Date().toISOString(),
      level,
      event_type:  event,
      tool:        'SYSTEM',
      user:        'SYSTEM',
      input_hash:  null,
      output_hash: null,
      duration_ms: 0,
      success:     true,
      ...data,
    };
    this.emit('system_log', record);
  }

  // ─── Metrics & Diagnostics ─────────────────────────────────────────────────

  /**
   * Get logger statistics.
   *
   * @returns {Object}
   */
  getStats() {
    const total = this._buffer.length;
    const successes = this._buffer.filter(r => r.success === true).length;
    const avgDuration = total > 0
      ? this._buffer.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / total
      : 0;

    return {
      bufferSize: total,
      bufferCapacity: MAX_BUFFER_SIZE,         // fib(19) = 4 181
      totalWritten: this._metrics.total,
      writeErrors: this._metrics.errors,
      siemExports: this._metrics.siemExports,
      successRate: total > 0 ? `${((successes / total) * 100).toFixed(1)}%` : 'N/A',
      avgDurationMs: Math.round(avgDuration),
      currentLogFile: this._rotator?.currentFilePath ?? null,
      pendingWrites: this._writeBuffer.length,
      lastRecordHash: this._lastRecordHash,
      retentionDays: this._retentionDays,      // fib(11) = 89
      maxFileSizeBytes: this._maxFileSizeBytes, // fib(13)*1024*1024 = 233 MiB
    };
  }

  /**
   * Get the current in-memory buffer.
   *
   * @returns {AuditLogRecord[]}
   */
  getBuffer() {
    return [...this._buffer];
  }
}

export { redactSensitive, LogFileRotator };
export default MCPAuditLogger;

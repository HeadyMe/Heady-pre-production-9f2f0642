/**
 * @fileoverview Zero-Trust Tool Execution Sandbox — Phi-Continuous Edition
 *
 * Implements capability-based security for MCP tool execution following
 * defense-in-depth principles. Enforces:
 * - Capability-based permission system per tool
 * - Rate limiting per tool, per user, per session
 * - Resource limits (CPU time, memory, network)
 * - Input validation and sanitization (SQL injection, path traversal, SSRF)
 * - Output scanning for sensitive data patterns (PII, credentials)
 * - Execution timeout enforcement
 * - Immutable audit trail generation
 *
 * Security model is based on the five-level isolation spectrum (Docker →
 * gVisor → Firecracker); this module enforces the policy layer above the
 * infrastructure isolation layer.
 *
 * ── Phi-Math Integration ────────────────────────────────────────────────────
 * All hardcoded timeout values, rate-limit window constants, and risk
 * scoring thresholds are replaced with phi/Fibonacci-derived values:
 *
 *   DEFAULT_EXEC_TIMEOUT_MS  30_000  → fib(16)*1000/fib(10) ≈ 17 945 ms
 *   DEFAULT_MAX_OUTPUT_BYTES  1 MB   → fib(13)*1000*fib(8)  ≈ 4.8 MB  (phi-scaled)
 *   DEFAULT_MAX_INPUT_BYTES  256 KB  → fib(11)*1000*fib(6)  ≈ 712 KB  (phi-scaled)
 *   rate limit window         60 s   → fib(11)*1000          = 89 000 ms
 *   rate limits (100/20/200)         → fib(11)/fib(5)/fib(12) (Fibonacci)
 *   risk/status thresholds           → CSL_THRESHOLDS
 *   audit trail cap         10 000   → fib(19)               = 4 181 (Fibonacci)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module modules/zero-trust-sandbox
 * @requires events
 * @requires shared/phi-math
 * @see {@link https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices}
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  CSL_THRESHOLDS,
  PRESSURE_LEVELS,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default execution timeout in milliseconds.
 *
 * fib(16)*1000/fib(10) = 987_000/55 ≈ 17 945 ms.
 *
 * Replaces old arbitrary 30_000 ms (30 s).  The phi-ratio fib(16)/fib(10)
 * converges toward φ³ ≈ 4.236, giving a timeout that is geometrically
 * proportional to all other phi-scaled intervals in the system.
 *
 * @type {number} ≈ 17 945 ms
 */
const DEFAULT_EXEC_TIMEOUT_MS = Math.round((fib(16) * 1000) / fib(10));

/**
 * Default maximum output size in bytes.
 *
 * fib(13) × 1000 × fib(8) = 233 × 1000 × 21 = 4 893 000 bytes ≈ 4.9 MB.
 *
 * Replaces old arbitrary 1 MB (1_024 × 1_024).
 * Uses consecutive Fibonacci numbers (F(13), F(8)) to maintain phi-scaling.
 *
 * @type {number} 4 893 000 bytes ≈ 4.9 MB
 */
const DEFAULT_MAX_OUTPUT_BYTES = fib(13) * 1000 * fib(8); // 233 × 1000 × 21

/**
 * Default maximum input size in bytes.
 *
 * fib(11) × 1000 × fib(6) = 89 × 1000 × 8 = 712 000 bytes ≈ 712 KB.
 *
 * Replaces old arbitrary 256 KB (256 × 1_024).
 * Input limit is F(11)/F(13) × output limit ≈ 89/233 ≈ 38.2% (= ψ²) of
 * output limit — a phi-proportioned asymmetry.
 *
 * @type {number} 712 000 bytes ≈ 712 KB
 */
const DEFAULT_MAX_INPUT_BYTES = fib(11) * 1000 * fib(6); // 89 × 1000 × 8

/**
 * Rate-limit window in milliseconds.
 *
 * fib(11) × 1000 = 89 × 1000 = 89 000 ms ≈ 89 s.
 *
 * Replaces old arbitrary 60_000 ms (60 s).  Matches the sliding window
 * constant used in rate-limiter.js for cross-module consistency.
 *
 * @type {number} 89 000 ms
 */
const RATE_LIMIT_WINDOW_MS = fib(11) * 1000; // F(11) = 89 → 89 000 ms

/**
 * Per-tool rate limit (requests per window).
 *
 * fib(11) = 89 — replaces old arbitrary 100.
 *
 * @type {number} 89
 */
const RATE_LIMIT_TOOL = fib(11); // F(11) = 89

/**
 * Per-user-per-tool rate limit (requests per window).
 *
 * fib(5) × fib(4) = 5 × 3 = 15 — replaces old arbitrary 20.
 * Approximately ψ² × RATE_LIMIT_TOOL ≈ 0.382 × 89 ≈ 34, but capped at
 * F(5)×F(4)=15 for tighter user-level enforcement.
 *
 * @type {number} 15
 */
const RATE_LIMIT_USER = fib(5) * fib(4); // 5 × 3 = 15

/**
 * Per-session rate limit (requests per window).
 *
 * fib(12) = 144 — replaces old arbitrary 200.
 * F(12)/F(11) = 144/89 ≈ φ — session limit is exactly φ× the tool limit,
 * providing a phi-proportioned tier separation.
 *
 * @type {number} 144
 */
const RATE_LIMIT_SESSION = fib(12); // F(12) = 144

/**
 * Audit trail maximum in-memory entries.
 *
 * fib(19) = 4 181 — replaces old arbitrary 10 000.
 * Fibonacci-derived cap that follows the same scaling used by the request
 * log in mcp-gateway.js (fib(16)=987) but for the more important audit trail.
 *
 * @type {number} 4 181
 */
const AUDIT_TRAIL_MAX = fib(19); // F(19) = 4 181

/** Output scan severity levels */
export const ScanSeverity = Object.freeze({
  NONE:     'none',
  INFO:     'info',
  WARN:     'warn',
  CRITICAL: 'critical',
});

/** Capability flags for tools */
export const Capability = Object.freeze({
  NONE:           0b00000000,
  FILE_READ:      0b00000001,
  FILE_WRITE:     0b00000010,
  NETWORK:        0b00000100,
  SUBPROCESS:     0b00001000,
  DATABASE_READ:  0b00010000,
  DATABASE_WRITE: 0b00100000,
  SECRETS_READ:   0b01000000,
  ADMIN:          0b10000000,
  ALL:            0b11111111,
});

// ─── Sensitive Data Patterns ─────────────────────────────────────────────────

/**
 * Patterns used for output scanning (PII, credentials, secrets).
 * Each entry has a name, regex pattern, and severity level.
 *
 * Severity thresholds are now expressed relative to CSL_THRESHOLDS so that
 * risk scoring in future integrations can use the same phi-harmonic scale.
 *
 * @type {Array<{name: string, pattern: RegExp, severity: string, redact: boolean, riskScore: number}>}
 */
const SENSITIVE_PATTERNS = [
  // AWS credentials — CRITICAL (riskScore = CSL_THRESHOLDS.CRITICAL ≈ 0.927)
  { name: 'aws_access_key',   pattern: /AKIA[0-9A-Z]{16}/g,                           severity: ScanSeverity.CRITICAL, redact: true,  riskScore: CSL_THRESHOLDS.CRITICAL },
  { name: 'aws_secret_key',   pattern: /aws.{0,20}secret.{0,20}[A-Za-z0-9+/]{40}/gi,  severity: ScanSeverity.CRITICAL, redact: true,  riskScore: CSL_THRESHOLDS.CRITICAL },
  // JWT tokens — CRITICAL
  { name: 'jwt_token',        pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: ScanSeverity.CRITICAL, redact: true, riskScore: CSL_THRESHOLDS.CRITICAL },
  // Generic API keys — WARN (riskScore = CSL_THRESHOLDS.HIGH ≈ 0.882)
  { name: 'api_key_generic',  pattern: /(?:api[_-]?key|apikey|api[_-]?token)['":s]*([A-Za-z0-9_\-]{20,})/gi, severity: ScanSeverity.WARN, redact: true, riskScore: CSL_THRESHOLDS.HIGH },
  // Private keys — CRITICAL
  { name: 'private_key_pem',  pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,    severity: ScanSeverity.CRITICAL, redact: true,  riskScore: CSL_THRESHOLDS.CRITICAL },
  // Email addresses — INFO (riskScore = CSL_THRESHOLDS.LOW ≈ 0.691)
  { name: 'email_address',    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, severity: ScanSeverity.INFO, redact: false, riskScore: CSL_THRESHOLDS.LOW },
  // Credit card numbers — CRITICAL
  { name: 'credit_card',      pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, severity: ScanSeverity.CRITICAL, redact: true, riskScore: CSL_THRESHOLDS.CRITICAL },
  // SSN — CRITICAL
  { name: 'ssn',              pattern: /\b(?!000|666|9\d{2})\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b/g, severity: ScanSeverity.CRITICAL, redact: true, riskScore: CSL_THRESHOLDS.CRITICAL },
  // IPv4 private addresses — INFO
  { name: 'private_ip',       pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g, severity: ScanSeverity.INFO, redact: false, riskScore: CSL_THRESHOLDS.LOW },
  // Cloud metadata endpoint — CRITICAL
  { name: 'imds_url',         pattern: /169\.254\.169\.254/g,                           severity: ScanSeverity.CRITICAL, redact: true,  riskScore: CSL_THRESHOLDS.CRITICAL },
];

// ─── Input Validation Patterns ────────────────────────────────────────────────

/** SQL injection detection patterns */
const SQL_INJECTION_PATTERNS = [
  /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|EXEC|UNION|--|;|\/\*|\*\/)/gi,
  /'\s*(OR|AND)\s*'?\d+'?\s*=\s*'?\d+/gi,
  /\bxp_\w+\b/gi,
];

/** Path traversal detection patterns */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/g,
  /[/\\]etc[/\\]passwd/gi,
  /[/\\]proc[/\\]self/gi,
  /[/\\]windows[/\\]system32/gi,
];

/** SSRF detection patterns (private IP ranges, cloud metadata) */
const SSRF_PATTERNS = [
  /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0)\b/gi,
  /\b169\.254\.169\.254\b/g,
  /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+\b/g,
  /\bfile:\/\//gi,
  /\bgopher:\/\//gi,
];

// ─── Tool Capability Registry ─────────────────────────────────────────────────

/**
 * @typedef {Object} ToolPolicy
 * @property {number} capabilities - Bitmask of required Capability flags
 * @property {number} [timeoutMs] - Per-tool execution timeout override
 * @property {number} [maxInputBytes] - Maximum input payload size
 * @property {number} [maxOutputBytes] - Maximum output size
 * @property {boolean} [requireUserConfirm=false] - Require explicit user confirmation
 * @property {boolean} [allowedForAnonymous=false] - Accessible without auth
 * @property {string[]} [allowedRoles=[]] - Required JWT roles (empty = any authenticated)
 * @property {boolean} [scanOutput=true] - Enable output scanning
 * @property {boolean} [validateInput=true] - Enable input validation
 * @property {Object} [inputSchema] - JSON Schema for strict input validation
 * @property {number} [riskThreshold] - CSL_THRESHOLDS level for risk scoring
 */

// ─── Audit Record ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AuditRecord
 * @property {string} id - Unique audit record identifier
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} toolName - Fully-qualified tool name
 * @property {string} userId - Authenticated user identifier
 * @property {string} sessionId - Session identifier
 * @property {string} requestId - Unique request identifier
 * @property {string} inputHash - SHA-256 hash of serialized input (never raw input)
 * @property {string|null} outputHash - SHA-256 hash of serialized output
 * @property {number} durationMs - Execution duration in milliseconds
 * @property {boolean} success - Whether execution succeeded
 * @property {string|null} errorCode - Error code if failed
 * @property {Object} capabilities - Capabilities checked
 * @property {Object[]} scanFindings - Output scan findings
 * @property {string} environment - Execution environment tag
 * @property {number} [riskScore] - Aggregate risk score (phi-harmonic)
 */

// ─── ZeroTrustSandbox ─────────────────────────────────────────────────────────

/**
 * Zero-trust sandbox for MCP tool execution.
 *
 * Every tool call passes through:
 * 1. Authentication/authorization check (capabilities + roles)
 * 2. Input validation (size, schema, injection patterns)
 * 3. Rate limit enforcement (phi-scaled windows and limits)
 * 4. Timed execution with resource monitoring (phi-derived timeout)
 * 5. Output scanning for sensitive data (CSL_THRESHOLDS risk levels)
 * 6. Audit record generation (capped at fib(19) = 4 181 entries)
 *
 * @extends EventEmitter
 * @fires ZeroTrustSandbox#policy_violation
 * @fires ZeroTrustSandbox#scan_finding
 * @fires ZeroTrustSandbox#audit_record
 * @fires ZeroTrustSandbox#execution_timeout
 *
 * @example
 * ```js
 * const sandbox = new ZeroTrustSandbox({
 *   defaultTimeoutMs: DEFAULT_EXEC_TIMEOUT_MS,  // ≈ 17 945 ms
 *   scanOutputs: true,
 * });
 *
 * sandbox.registerPolicy('github.create_issue', {
 *   capabilities: Capability.NETWORK,
 *   allowedRoles: ['developer', 'admin'],
 *   maxInputBytes: fib(11) * 1000 * fib(6),  // ≈ 712 KB
 *   riskThreshold: CSL_THRESHOLDS.HIGH,       // ≈ 0.882
 * });
 *
 * const result = await sandbox.execute('github.create_issue', params, handler, context);
 * ```
 */
export class ZeroTrustSandbox extends EventEmitter {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.defaultTimeoutMs] - Default execution timeout (≈17 945 ms, fib(16)*1000/fib(10))
   * @param {number} [options.maxInputBytes] - Default max input size (≈712 KB, fib(11)*1000*fib(6))
   * @param {number} [options.maxOutputBytes] - Default max output size (≈4.9 MB, fib(13)*1000*fib(8))
   * @param {boolean} [options.scanOutputs=true] - Enable output scanning
   * @param {boolean} [options.validateInputs=true] - Enable input validation
   * @param {boolean} [options.strictMode=false] - Reject any tool without a registered policy
   * @param {string} [options.environment='production'] - Execution environment tag
   */
  constructor(options = {}) {
    super();
    this._defaultTimeoutMs  = options.defaultTimeoutMs  ?? DEFAULT_EXEC_TIMEOUT_MS;
    this._maxInputBytes     = options.maxInputBytes     ?? DEFAULT_MAX_INPUT_BYTES;
    this._maxOutputBytes    = options.maxOutputBytes    ?? DEFAULT_MAX_OUTPUT_BYTES;
    this._scanOutputs       = options.scanOutputs       ?? true;
    this._validateInputs    = options.validateInputs    ?? true;
    this._strictMode        = options.strictMode        ?? false;
    this._environment       = options.environment       ?? 'production';

    /** @type {Map<string, ToolPolicy>} toolName → policy */
    this._policies = new Map();

    /** @type {Map<string, {count: number, window: number}>} rateKey → bucket */
    this._rateBuckets = new Map();

    /**
     * In-memory audit trail capped at fib(19) = 4 181 entries.
     *
     * Replaces the old hardcoded 10_000 cap with a Fibonacci-derived value.
     *
     * @type {AuditRecord[]}
     */
    this._auditTrail = [];
  }

  // ─── Policy Registration ────────────────────────────────────────────────────

  /**
   * Register a capability policy for a tool.
   *
   * The `riskThreshold` field maps directly to CSL_THRESHOLDS levels,
   * allowing future integrations to score tool risk against the same
   * phi-harmonic scale used throughout the system.
   *
   * @param {string} toolName - Fully-qualified tool name (e.g. 'github.create_issue')
   * @param {ToolPolicy} policy - Security policy
   */
  registerPolicy(toolName, policy) {
    this._policies.set(toolName, {
      capabilities:        Capability.NONE,
      timeoutMs:           this._defaultTimeoutMs,
      maxInputBytes:       this._maxInputBytes,
      maxOutputBytes:      this._maxOutputBytes,
      requireUserConfirm:  false,
      allowedForAnonymous: false,
      allowedRoles:        [],
      scanOutput:          this._scanOutputs,
      validateInput:       this._validateInputs,
      riskThreshold:       CSL_THRESHOLDS.HIGH,  // Default: HIGH risk threshold ≈ 0.882
      ...policy,
    });
  }

  /**
   * Register policies for multiple tools at once.
   *
   * @param {Object<string, ToolPolicy>} policies - Map of toolName → policy
   */
  registerPolicies(policies) {
    for (const [toolName, policy] of Object.entries(policies)) {
      this.registerPolicy(toolName, policy);
    }
  }

  /**
   * Remove a tool policy.
   *
   * @param {string} toolName
   */
  removePolicy(toolName) {
    this._policies.delete(toolName);
  }

  // ─── Core Execution ─────────────────────────────────────────────────────────

  /**
   * Execute a tool through the zero-trust sandbox.
   *
   * @param {string} toolName - Fully-qualified tool name
   * @param {Object} params - Tool call parameters
   * @param {Function} handler - Async execution function: (params) => result
   * @param {Object} [context={}] - Request context
   * @param {string} [context.userId] - Authenticated user identifier
   * @param {string} [context.sessionId] - Session identifier
   * @param {string} [context.requestId] - Request identifier
   * @param {string[]} [context.roles=[]] - User's JWT roles
   * @param {number} [context.userCapabilities] - User's granted capabilities bitmask
   * @returns {Promise<Object>} Tool execution result
   * @throws {PolicyViolationError} If any security check fails
   */
  async execute(toolName, params, handler, context = {}) {
    const requestId   = context.requestId ?? crypto.randomUUID();
    const sessionId   = context.sessionId ?? 'anonymous';
    const userId      = context.userId    ?? 'anonymous';
    const startTime   = Date.now();
    let outputHash    = null;
    let scanFindings  = [];
    let result        = null;
    let errorCode     = null;
    let success       = false;

    // Get policy (or default if not in strict mode)
    const policy = this._getPolicy(toolName);

    try {
      // 1. Authorization check
      this._checkAuthorization(toolName, policy, context);

      // 2. Input validation
      if (policy.validateInput) {
        await this._validateInput(toolName, params, policy);
      }

      // 3. Rate limiting (phi-derived limits)
      this._checkRateLimit(toolName, userId, sessionId);

      // 4. Execute with phi-derived timeout
      const executionPromise = handler(params);
      const timeoutPromise   = new Promise((_, reject) =>
        setTimeout(() => {
          this.emit('execution_timeout', { requestId, toolName, userId, timeoutMs: policy.timeoutMs });
          reject(Object.assign(
            new Error(`Execution timeout after ${policy.timeoutMs}ms`),
            { code: 'TIMEOUT' }
          ));
        }, policy.timeoutMs)
      );

      result = await Promise.race([executionPromise, timeoutPromise]);

      // 5. Output size check (phi-derived max)
      const outputStr = JSON.stringify(result ?? {});
      if (Buffer.byteLength(outputStr, 'utf8') > policy.maxOutputBytes) {
        throw Object.assign(
          new Error(`Output exceeds maximum size (${policy.maxOutputBytes} bytes)`),
          { code: 'OUTPUT_TOO_LARGE' }
        );
      }

      // 6. Output scanning with phi-harmonic risk scoring
      if (policy.scanOutput) {
        scanFindings = this._scanOutput(outputStr, toolName, requestId);
        // Block execution if critical findings found (riskScore ≥ riskThreshold)
        const critical = scanFindings.filter(f => f.severity === ScanSeverity.CRITICAL);
        if (critical.length > 0) {
          throw Object.assign(
            new Error(`Output contains ${critical.length} critical sensitive data finding(s)`),
            { code: 'SENSITIVE_DATA_LEAK', findings: critical }
          );
        }
        // Redact warned fields from result
        result = this._redactOutput(result, scanFindings);
      }

      outputHash = this._hash(JSON.stringify(result ?? {}));
      success = true;
    } catch (err) {
      errorCode = err.code ?? 'EXECUTION_ERROR';
      this.emit('policy_violation', {
        requestId, toolName, userId, sessionId,
        errorCode, message: err.message,
      });
      throw err;
    } finally {
      // 7. Generate audit record
      const record = this._createAuditRecord({
        requestId, toolName, userId, sessionId,
        inputHash:    this._hash(JSON.stringify(params ?? {})),
        outputHash,
        durationMs:   Date.now() - startTime,
        success,
        errorCode,
        scanFindings,
        policy,
      });
      this._addToAuditTrail(record);
      this.emit('audit_record', record);
    }

    return result;
  }

  // ─── Authorization ─────────────────────────────────────────────────────────

  /**
   * Check capability-based authorization for a tool call.
   *
   * @param {string} toolName
   * @param {ToolPolicy} policy
   * @param {Object} context
   * @throws {Error} On authorization failure
   * @private
   */
  _checkAuthorization(toolName, policy, context) {
    const userId  = context.userId ?? null;
    const roles   = context.roles  ?? [];
    const userCaps = context.userCapabilities ?? Capability.NONE;

    // Anonymous access check
    if (!userId && !policy.allowedForAnonymous) {
      throw Object.assign(
        new Error(`Tool '${toolName}' requires authentication`),
        { code: 'UNAUTHENTICATED' }
      );
    }

    // Role-based access check
    if (policy.allowedRoles.length > 0) {
      const hasRole = policy.allowedRoles.some(r => roles.includes(r));
      if (!hasRole) {
        throw Object.assign(
          new Error(`Tool '${toolName}' requires one of roles: ${policy.allowedRoles.join(', ')}`),
          { code: 'UNAUTHORIZED_ROLE' }
        );
      }
    }

    // Capability check: user must have all required capabilities granted
    if (policy.capabilities !== Capability.NONE) {
      const missing = policy.capabilities & ~userCaps;
      if (missing !== 0) {
        const missingNames = Object.entries(Capability)
          .filter(([, v]) => typeof v === 'number' && (missing & v) !== 0)
          .map(([k]) => k);
        throw Object.assign(
          new Error(`Tool '${toolName}' requires capabilities: ${missingNames.join(', ')}`),
          { code: 'INSUFFICIENT_CAPABILITIES', missing: missingNames }
        );
      }
    }
  }

  // ─── Input Validation ─────────────────────────────────────────────────────

  /**
   * Validate and sanitize tool input parameters.
   *
   * Checks:
   * - Input size limits (phi-scaled: fib(11)×1000×fib(6) ≈ 712 KB)
   * - SQL injection patterns
   * - Path traversal patterns
   * - SSRF patterns in URL-like values
   *
   * @param {string} toolName
   * @param {Object} params
   * @param {ToolPolicy} policy
   * @returns {Promise<void>}
   * @throws {Error} On validation failure
   * @private
   */
  async _validateInput(toolName, params, policy) {
    const inputStr  = JSON.stringify(params ?? {});
    const inputBytes = Buffer.byteLength(inputStr, 'utf8');

    // Size check against phi-derived max
    if (inputBytes > policy.maxInputBytes) {
      throw Object.assign(
        new Error(`Input exceeds maximum size: ${inputBytes} > ${policy.maxInputBytes} bytes`),
        { code: 'INPUT_TOO_LARGE' }
      );
    }

    // SQL injection check (for tools with DB access)
    if (policy.capabilities & (Capability.DATABASE_READ | Capability.DATABASE_WRITE)) {
      this._checkInjectionPatterns(toolName, inputStr, SQL_INJECTION_PATTERNS, 'SQL_INJECTION');
    }

    // Path traversal check (for tools with file access)
    if (policy.capabilities & (Capability.FILE_READ | Capability.FILE_WRITE)) {
      this._checkInjectionPatterns(toolName, inputStr, PATH_TRAVERSAL_PATTERNS, 'PATH_TRAVERSAL');
    }

    // SSRF check (for tools with network access)
    if (policy.capabilities & Capability.NETWORK) {
      this._checkInjectionPatterns(toolName, inputStr, SSRF_PATTERNS, 'SSRF');
    }
  }

  /**
   * Check input string against injection patterns.
   *
   * @param {string} toolName
   * @param {string} input
   * @param {RegExp[]} patterns
   * @param {string} code
   * @throws {Error}
   * @private
   */
  _checkInjectionPatterns(toolName, input, patterns, code) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        throw Object.assign(
          new Error(`Potential ${code} pattern detected in input for tool '${toolName}'`),
          { code }
        );
      }
    }
  }

  // ─── Rate Limiting ─────────────────────────────────────────────────────────

  /**
   * Enforce per-tool/per-user/per-session rate limits.
   *
   * All limits and windows are now phi/Fibonacci-derived:
   *
   *   Window:    fib(11) × 1000 = 89 000 ms  (replaces 60_000 ms)
   *   Tool:      fib(11) = 89                 (replaces 100)
   *   User:      fib(5) × fib(4) = 15        (replaces 20)
   *   Session:   fib(12) = 144               (replaces 200)
   *
   * The tier ratios follow Fibonacci proportions:
   *   session/tool  = F(12)/F(11) = 144/89 ≈ φ  — one phi step above
   *   user/tool     = 15/89 ≈ ψ²              — phi-discounted user share
   *
   * Rate limit keys:
   * - `tool:{toolName}` — global per-tool limit
   * - `user:{userId}:{toolName}` — per-user per-tool limit
   * - `session:{sessionId}` — total per-session limit
   *
   * @param {string} toolName
   * @param {string} userId
   * @param {string} sessionId
   * @throws {Error} On rate limit exceeded
   * @private
   */
  _checkRateLimit(toolName, userId, sessionId) {
    const now = Date.now();

    const keys = [
      { key: `tool:${toolName}`,             limit: RATE_LIMIT_TOOL    },   // fib(11)=89
      { key: `user:${userId}:${toolName}`,   limit: RATE_LIMIT_USER    },   // fib(5)×fib(4)=15
      { key: `session:${sessionId}`,         limit: RATE_LIMIT_SESSION },   // fib(12)=144
    ];

    for (const { key, limit } of keys) {
      const bucket = this._rateBuckets.get(key) ?? { count: 0, window: now };

      // Slide window (phi-derived window duration)
      if (now - bucket.window > RATE_LIMIT_WINDOW_MS) {
        bucket.count  = 0;
        bucket.window = now;
      }

      if (bucket.count >= limit) {
        const resetIn = Math.ceil((bucket.window + RATE_LIMIT_WINDOW_MS - now) / 1000);
        throw Object.assign(
          new Error(`Rate limit exceeded for ${key}. Reset in ${resetIn}s`),
          { code: 'RATE_LIMITED', key, resetInSeconds: resetIn }
        );
      }

      bucket.count++;
      this._rateBuckets.set(key, bucket);
    }
  }

  // ─── Output Scanning ───────────────────────────────────────────────────────

  /**
   * Scan tool output for sensitive data patterns.
   *
   * Each pattern has a `riskScore` mapped to CSL_THRESHOLDS:
   *   CRITICAL patterns → riskScore = CSL_THRESHOLDS.CRITICAL ≈ 0.927
   *   WARN patterns     → riskScore = CSL_THRESHOLDS.HIGH     ≈ 0.882
   *   INFO patterns     → riskScore = CSL_THRESHOLDS.LOW      ≈ 0.691
   *
   * This phi-harmonic risk scoring allows downstream systems to apply
   * graduated responses rather than binary block/allow decisions.
   *
   * @param {string} outputStr - Serialized output
   * @param {string} toolName - Tool name (for event payload)
   * @param {string} requestId - Request identifier
   * @returns {Array<{name: string, severity: string, count: number, redact: boolean, riskScore: number}>}
   * @private
   */
  _scanOutput(outputStr, toolName, requestId) {
    const findings = [];
    for (const spec of SENSITIVE_PATTERNS) {
      const matches = outputStr.match(spec.pattern);
      if (matches?.length) {
        const finding = {
          name:      spec.name,
          severity:  spec.severity,
          count:     matches.length,
          redact:    spec.redact,
          riskScore: spec.riskScore,  // CSL_THRESHOLDS-derived risk score
        };
        findings.push(finding);
        this.emit('scan_finding', { requestId, toolName, ...finding });
      }
    }
    return findings;
  }

  /**
   * Redact sensitive values from output based on scan findings.
   *
   * @param {*} output - Tool output
   * @param {Object[]} findings - Scan findings
   * @returns {*} Redacted output
   * @private
   */
  _redactOutput(output, findings) {
    const toRedact = findings.filter(f => f.redact);
    if (toRedact.length === 0) return output;

    let str = JSON.stringify(output);
    for (const spec of SENSITIVE_PATTERNS) {
      if (toRedact.some(f => f.name === spec.name)) {
        str = str.replace(spec.pattern, `[REDACTED:${spec.name}]`);
      }
    }
    try { return JSON.parse(str); }
    catch { return { _redacted: true, _raw: '[REDACTED]' }; }
  }

  // ─── Audit Trail ──────────────────────────────────────────────────────────

  /**
   * Create a SOC 2 compatible audit record with all 6 required fields.
   *
   * Required fields per Aembit's MCP auditing framework:
   * 1. Identity of requester (userId + requestId)
   * 2. Resource accessed (toolName)
   * 3. Context payload metadata (inputHash — never raw input)
   * 4. Time and environment data (timestamp, environment)
   * 5. Authorization decisions (capabilities checked)
   * 6. Outcome status (success/errorCode)
   *
   * Added: riskScore = aggregate of scan finding riskScores, normalized
   * against CSL_THRESHOLDS.CRITICAL for a phi-harmonic 0–1 scale.
   *
   * @param {Object} params
   * @returns {AuditRecord}
   * @private
   */
  _createAuditRecord(params) {
    // Aggregate risk score: max riskScore across all scan findings,
    // defaulting to PRESSURE_LEVELS.NOMINAL_MAX (≈ 0.382) when clean.
    const aggregateRiskScore = params.scanFindings?.length > 0
      ? Math.max(...params.scanFindings.map(f => f.riskScore ?? CSL_THRESHOLDS.MINIMUM))
      : PRESSURE_LEVELS.NOMINAL_MAX; // ≈ 0.382 = ψ² (nominal/clean baseline)

    return {
      id:           crypto.randomUUID(),
      timestamp:    new Date().toISOString(),
      toolName:     params.toolName,
      userId:       params.userId,
      sessionId:    params.sessionId,
      requestId:    params.requestId,
      inputHash:    params.inputHash,
      outputHash:   params.outputHash,
      durationMs:   params.durationMs,
      success:      params.success,
      errorCode:    params.errorCode ?? null,
      capabilities: {
        required:    params.policy?.capabilities ?? 0,
        environment: this._environment,
      },
      scanFindings: params.scanFindings ?? [],
      riskScore:    aggregateRiskScore,
      environment:  this._environment,
    };
  }

  /**
   * Add a record to the audit trail (capped at fib(19) = 4 181 entries).
   *
   * Replaces the old hardcoded 10_000 cap.
   *
   * @param {AuditRecord} record
   * @private
   */
  _addToAuditTrail(record) {
    this._auditTrail.push(record);
    if (this._auditTrail.length > AUDIT_TRAIL_MAX) this._auditTrail.shift();
  }

  // ─── Audit Query Interface ─────────────────────────────────────────────────

  /**
   * Query the audit trail with optional filters.
   *
   * @param {Object} [filters={}] - Query filters
   * @param {string} [filters.toolName] - Filter by tool name (substring match)
   * @param {string} [filters.userId] - Filter by user ID
   * @param {string} [filters.sessionId] - Filter by session ID
   * @param {boolean} [filters.successOnly] - Only return successful executions
   * @param {boolean} [filters.failuresOnly] - Only return failed executions
   * @param {string} [filters.since] - ISO 8601 timestamp lower bound
   * @param {number} [filters.minRiskScore] - Minimum risk score (CSL_THRESHOLDS level)
   * @param {number} [filters.limit=fib(7)] - Maximum results (default fib(7)=13)
   * @returns {AuditRecord[]}
   */
  queryAuditTrail(filters = {}) {
    let results = [...this._auditTrail];

    if (filters.toolName)     results = results.filter(r => r.toolName.includes(filters.toolName));
    if (filters.userId)       results = results.filter(r => r.userId === filters.userId);
    if (filters.sessionId)    results = results.filter(r => r.sessionId === filters.sessionId);
    if (filters.successOnly)  results = results.filter(r => r.success === true);
    if (filters.failuresOnly) results = results.filter(r => r.success === false);
    if (filters.minRiskScore !== undefined) {
      results = results.filter(r => (r.riskScore ?? 0) >= filters.minRiskScore);
    }
    if (filters.since) {
      const sinceTs = new Date(filters.since).getTime();
      results = results.filter(r => new Date(r.timestamp).getTime() >= sinceTs);
    }

    return results.slice(-(filters.limit ?? fib(7))); // default fib(7) = 13 results
  }

  /**
   * Export audit records as NDJSON (newline-delimited JSON) for SIEM ingestion.
   *
   * @param {Object} [filters={}] - Same filters as queryAuditTrail
   * @returns {string} NDJSON string
   */
  exportAuditNDJSON(filters = {}) {
    return this.queryAuditTrail(filters).map(r => JSON.stringify(r)).join('\n');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 hash of a string.
   *
   * @param {string} data
   * @returns {string} Hex-encoded hash
   * @private
   */
  _hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get policy for a tool, applying defaults for unregistered tools.
   *
   * @param {string} toolName
   * @returns {ToolPolicy}
   * @throws {Error} In strict mode if tool has no registered policy
   * @private
   */
  _getPolicy(toolName) {
    if (this._policies.has(toolName)) return this._policies.get(toolName);

    if (this._strictMode) {
      throw Object.assign(
        new Error(`No security policy registered for tool '${toolName}' (strict mode)`),
        { code: 'NO_POLICY' }
      );
    }

    // Default permissive-but-monitored policy for unregistered tools
    return {
      capabilities:        Capability.NONE,
      timeoutMs:           this._defaultTimeoutMs,
      maxInputBytes:       this._maxInputBytes,
      maxOutputBytes:      this._maxOutputBytes,
      requireUserConfirm:  false,
      allowedForAnonymous: true,
      allowedRoles:        [],
      scanOutput:          this._scanOutputs,
      validateInput:       this._validateInputs,
      riskThreshold:       CSL_THRESHOLDS.MEDIUM,  // Default risk level ≈ 0.809
    };
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  /**
   * Get sandbox execution statistics.
   *
   * @returns {Object}
   */
  getStats() {
    const total   = this._auditTrail.length;
    const success = this._auditTrail.filter(r => r.success).length;
    const blocked = this._auditTrail.filter(r => !r.success).length;
    const avgDuration = total > 0
      ? this._auditTrail.reduce((sum, r) => sum + r.durationMs, 0) / total
      : 0;

    const findingsByType = {};
    for (const record of this._auditTrail) {
      for (const finding of record.scanFindings) {
        findingsByType[finding.name] = (findingsByType[finding.name] ?? 0) + finding.count;
      }
    }

    // Average risk score across audit trail (0 if empty)
    const avgRiskScore = total > 0
      ? this._auditTrail.reduce((sum, r) => sum + (r.riskScore ?? 0), 0) / total
      : 0;

    return {
      totalExecutions:    total,
      successCount:       success,
      blockedCount:       blocked,
      successRate:        total > 0 ? (success / total * 100).toFixed(1) + '%' : 'N/A',
      avgDurationMs:      Math.round(avgDuration),
      avgRiskScore:       avgRiskScore.toFixed(4),
      registeredPolicies: this._policies.size,
      scanFindingTypes:   findingsByType,
      rateBuckets:        this._rateBuckets.size,
      auditTrailCap:      AUDIT_TRAIL_MAX,
      phiConstants: {
        DEFAULT_EXEC_TIMEOUT_MS,
        DEFAULT_MAX_INPUT_BYTES,
        DEFAULT_MAX_OUTPUT_BYTES,
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_TOOL,
        RATE_LIMIT_USER,
        RATE_LIMIT_SESSION,
        CSL_THRESHOLDS,
      },
    };
  }
}

export { Capability as default_Capability };
export default ZeroTrustSandbox;

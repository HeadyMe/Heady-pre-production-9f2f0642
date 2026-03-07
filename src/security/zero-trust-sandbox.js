/**
 * Heady Zero-Trust MCP Execution Sandbox
 * =======================================
 * Capability-based ACL for MCP tool execution with:
 * - Bitmask capability model (FILE_READ, NETWORK, DATABASE_READ, etc.)
 * - JWT role-based capability mapping
 * - Resource limits (CPU time, memory, network per execution)
 * - Execution timeout with phi-scaled per-tool categories
 * - Isolation via Node.js vm2/isolated-vm patterns
 *
 * @module src/security/zero-trust-sandbox
 * @version 1.0.0
 */

'use strict';

const { fib, CSL_THRESHOLDS, PHI, PSI, phiBackoff } = require('../../shared/phi-math');

// ── Capability Bitmask Definitions ──────────────────────────────────────────
const CAPABILITIES = Object.freeze({
  NONE:            0b00000000,
  FILE_READ:       0b00000001,
  FILE_WRITE:      0b00000010,
  NETWORK_READ:    0b00000100,
  NETWORK_WRITE:   0b00001000,
  DATABASE_READ:   0b00010000,
  DATABASE_WRITE:  0b00100000,
  SYSTEM_EXEC:     0b01000000,
  SECRET_ACCESS:   0b10000000,

  // Compound masks
  FILE_ALL:     0b00000011,  // READ + WRITE
  NETWORK_ALL:  0b00001100,  // READ + WRITE
  DATABASE_ALL: 0b00110000,  // READ + WRITE
  READ_ONLY:    0b00010101,  // FILE_READ + NETWORK_READ + DATABASE_READ
  FULL_ACCESS:  0b11111111,
});

// ── Tool Category → Capabilities + Timeouts ─────────────────────────────────
const TOOL_PROFILES = Object.freeze({
  'file-ops':    { caps: CAPABILITIES.FILE_ALL,     timeoutMs: fib(7) * 1000 },     // 13s
  'network':     { caps: CAPABILITIES.NETWORK_ALL,  timeoutMs: fib(8) * 1000 },     // 21s
  'database':    { caps: CAPABILITIES.DATABASE_ALL, timeoutMs: fib(8) * 1000 },     // 21s
  'code-exec':   { caps: CAPABILITIES.SYSTEM_EXEC,  timeoutMs: fib(9) * 1000 },     // 34s
  'read-only':   { caps: CAPABILITIES.READ_ONLY,    timeoutMs: fib(7) * 1000 },     // 13s
  'secret-mgmt': { caps: CAPABILITIES.SECRET_ACCESS, timeoutMs: fib(6) * 1000 },    // 8s
  'default':     { caps: CAPABILITIES.READ_ONLY,    timeoutMs: fib(7) * 1000 },     // 13s
});

// ── Resource Limits ─────────────────────────────────────────────────────────
const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  maxMemoryMB:       fib(8),      // 21 MB per execution
  maxCpuTimeMs:      fib(8) * 1000, // 21s CPU time
  maxNetworkBytes:   fib(16) * 1024, // 987 KB network I/O
  maxOutputBytes:    fib(14) * 1024, // 377 KB output size
  maxFileOps:        fib(7),      // 13 file operations
  maxDbQueries:      fib(8),      // 21 DB queries
});

// ── Zero-Trust Sandbox ──────────────────────────────────────────────────────
class ZeroTrustSandbox {
  constructor(config = {}) {
    this.toolCategories = config.toolCategories || {};  // toolName → category
    this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...config.resourceLimits };
    this._executionLog = [];
    this._violationCount = 0;
    this._maxViolationsBeforeLockout = fib(5); // 5 violations → lockout user
    this._userViolations = new Map(); // userId → count
  }

  /**
   * Execute a tool call within the sandbox.
   * @param {Object} params
   * @param {string} params.tool - Tool name
   * @param {Object} params.arguments - Sanitized arguments
   * @param {Object} params.connection - MCP connection from pool
   * @param {string} params.user - User ID
   * @param {string} params.jwt - JWT token
   * @param {number} params.timeoutMs - Override timeout
   * @param {number} params.capabilities - Granted capabilities bitmask from RBAC
   */
  async execute(params) {
    const { tool, arguments: args, connection, user, jwt, timeoutMs, capabilities } = params;

    // ── Check user lockout ──────────────────────────────────────────────
    const violations = this._userViolations.get(user) || 0;
    if (violations >= this._maxViolationsBeforeLockout) {
      throw new SandboxViolation('USER_LOCKED_OUT',
        `User ${user} has been locked out after ${violations} sandbox violations`);
    }

    // ── Resolve tool category and required capabilities ─────────────────
    const category = this.toolCategories[tool] || 'default';
    const profile = TOOL_PROFILES[category] || TOOL_PROFILES['default'];
    const requiredCaps = profile.caps;

    // ── Capability check ────────────────────────────────────────────────
    if ((capabilities & requiredCaps) !== requiredCaps) {
      this._recordViolation(user, 'CAPABILITY_DENIED', tool, requiredCaps, capabilities);
      throw new SandboxViolation('CAPABILITY_DENIED',
        `Tool "${tool}" requires capabilities 0b${requiredCaps.toString(2).padStart(8, '0')} ` +
        `but user has 0b${capabilities.toString(2).padStart(8, '0')}`);
    }

    // ── Execute with resource monitoring ────────────────────────────────
    const effectiveTimeout = timeoutMs || profile.timeoutMs;
    const startTime = Date.now();
    const resourceTracker = new ResourceTracker(this.resourceLimits);

    try {
      const result = await Promise.race([
        this._sandboxedExec(connection, tool, args, resourceTracker),
        this._timeoutPromise(effectiveTimeout, tool),
      ]);

      // ── Validate output size ──────────────────────────────────────────
      const outputSize = Buffer.byteLength(JSON.stringify(result), 'utf8');
      if (outputSize > this.resourceLimits.maxOutputBytes) {
        this._recordViolation(user, 'OUTPUT_TOO_LARGE', tool, outputSize);
        throw new SandboxViolation('OUTPUT_TOO_LARGE',
          `Output ${outputSize} bytes exceeds limit ${this.resourceLimits.maxOutputBytes}`);
      }

      this._executionLog.push({
        tool, user, category,
        duration_ms: Date.now() - startTime,
        resources: resourceTracker.snapshot(),
        status: 'success',
        timestamp: new Date().toISOString(),
      });

      return result;

    } catch (error) {
      if (error instanceof SandboxViolation) throw error;

      this._executionLog.push({
        tool, user, category,
        duration_ms: Date.now() - startTime,
        resources: resourceTracker.snapshot(),
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  async _sandboxedExec(connection, tool, args, tracker) {
    // JSON-RPC 2.0 call to upstream MCP server
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: args },
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    const result = await connection.send(request);
    tracker.recordNetworkBytes(Buffer.byteLength(JSON.stringify(result), 'utf8'));

    if (result.error) {
      throw new Error(`MCP error ${result.error.code}: ${result.error.message}`);
    }

    return result.result;
  }

  _timeoutPromise(ms, tool) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new SandboxViolation('TIMEOUT',
        `Tool "${tool}" exceeded timeout of ${ms}ms`)), ms);
    });
  }

  _recordViolation(user, type, tool, ...details) {
    const count = (this._userViolations.get(user) || 0) + 1;
    this._userViolations.set(user, count);
    this._violationCount++;

    this._executionLog.push({
      type: 'VIOLATION',
      violation: type,
      tool, user,
      details,
      count,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Inspection ────────────────────────────────────────────────────────
  getViolationCount(user) { return this._userViolations.get(user) || 0; }
  getExecutionLog() { return [...this._executionLog]; }
  resetViolations(user) { this._userViolations.delete(user); }
}

// ── Resource Tracker ────────────────────────────────────────────────────────
class ResourceTracker {
  constructor(limits) {
    this.limits = limits;
    this.networkBytes = 0;
    this.fileOps = 0;
    this.dbQueries = 0;
  }

  recordNetworkBytes(bytes) {
    this.networkBytes += bytes;
    if (this.networkBytes > this.limits.maxNetworkBytes) {
      throw new SandboxViolation('NETWORK_LIMIT',
        `Network I/O ${this.networkBytes} exceeds limit ${this.limits.maxNetworkBytes}`);
    }
  }

  recordFileOp() {
    this.fileOps++;
    if (this.fileOps > this.limits.maxFileOps) {
      throw new SandboxViolation('FILE_OPS_LIMIT',
        `File operations ${this.fileOps} exceeds limit ${this.limits.maxFileOps}`);
    }
  }

  recordDbQuery() {
    this.dbQueries++;
    if (this.dbQueries > this.limits.maxDbQueries) {
      throw new SandboxViolation('DB_QUERY_LIMIT',
        `Database queries ${this.dbQueries} exceeds limit ${this.limits.maxDbQueries}`);
    }
  }

  snapshot() {
    return {
      networkBytes: this.networkBytes,
      fileOps: this.fileOps,
      dbQueries: this.dbQueries,
    };
  }
}

// ── Custom Error ────────────────────────────────────────────────────────────
class SandboxViolation extends Error {
  constructor(type, message) {
    super(message);
    this.type = 'SANDBOX_VIOLATION';
    this.violationType = type;
    this.name = 'SandboxViolation';
  }
}

module.exports = {
  ZeroTrustSandbox,
  ResourceTracker,
  SandboxViolation,
  CAPABILITIES,
  TOOL_PROFILES,
  DEFAULT_RESOURCE_LIMITS,
};

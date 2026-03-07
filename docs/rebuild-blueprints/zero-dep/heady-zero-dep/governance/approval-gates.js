/**
 * @file approval-gates.js
 * @description Approval workflow engine for Heady governance.
 *
 * Features:
 * - Gate definitions with configurable conditions
 * - Auto-approve for low-risk operations
 * - Manual approve path for high-risk operations
 * - Timeout with escalation chain
 * - Full audit trail (append-only log)
 * - Determinism validation gate: verify same inputs → same outputs
 *
 * Sacred Geometry: PHI-scaled timeouts and risk scoring.
 * Zero external dependencies (events, crypto, fs, path).
 *
 * @module HeadyGovernance/ApprovalGates
 */

import { EventEmitter }               from 'events';
import { createHash, randomUUID }     from 'crypto';
import { writeFileSync, appendFileSync,
         existsSync, mkdirSync }      from 'fs';
import { join, resolve }              from 'path';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBO     = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

/** PHI-scaled timeout: base * φ^level */
function phiTimeout(baseMs, level = 1) {
  return Math.round(baseMs * Math.pow(PHI, level));
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const GateStatus = Object.freeze({
  PENDING:   'PENDING',
  APPROVED:  'APPROVED',
  REJECTED:  'REJECTED',
  ESCALATED: 'ESCALATED',
  EXPIRED:   'EXPIRED',
  BYPASSED:  'BYPASSED',   // auto-approved low-risk
  ERROR:     'ERROR',
});

export const RiskLevel = Object.freeze({
  NONE:     0,
  LOW:      1,
  MEDIUM:   2,
  HIGH:     3,
  CRITICAL: 4,
});

// ─── Audit Trail ──────────────────────────────────────────────────────────────

class AuditTrail {
  /**
   * @param {object} [opts]
   * @param {string}  [opts.logDir]    Directory for audit log files
   * @param {boolean} [opts.persist]   Persist to disk (default: false)
   */
  constructor(opts = {}) {
    this._entries  = [];
    this._persist  = opts.persist ?? false;
    this._logDir   = opts.logDir  ?? null;
    this._logFile  = null;

    if (this._persist && this._logDir) {
      mkdirSync(this._logDir, { recursive: true });
      const stamp   = new Date().toISOString().slice(0, 10);
      this._logFile = join(resolve(this._logDir), `audit-${stamp}.ndjson`);
    }
  }

  /**
   * Append an audit entry.
   * @param {object} entry
   */
  record(entry) {
    const stamped = { ...entry, at: Date.now(), id: randomUUID() };
    this._entries.push(stamped);
    if (this._logFile) {
      try {
        appendFileSync(this._logFile, JSON.stringify(stamped) + '\n', 'utf8');
      } catch { /* non-fatal */ }
    }
    return stamped;
  }

  /** Retrieve entries, optionally filtered by gateId or status. */
  query({ gateId, requestId, status, limit } = {}) {
    let results = this._entries;
    if (gateId)    results = results.filter(e => e.gateId    === gateId);
    if (requestId) results = results.filter(e => e.requestId === requestId);
    if (status)    results = results.filter(e => e.status    === status);
    if (limit)     results = results.slice(-limit);
    return results;
  }

  get count() { return this._entries.length; }
}

// ─── Determinism Validator ────────────────────────────────────────────────────

/**
 * Validates determinism: given the same canonical input hash, output must match.
 * Stores (inputHash → outputHash) mapping and flags deviations.
 */
export class DeterminismValidator {
  constructor() {
    this._map = new Map(); // inputHash → { outputHash, count, firstSeen }
  }

  /**
   * Compute a stable SHA-256 hash of an arbitrary value.
   * @param {*} value
   * @returns {string}  hex digest
   */
  static hash(value) {
    const canonical = typeof value === 'string' ? value : JSON.stringify(value, _jsonReplacer);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Check determinism: record (inputHash, outputHash) and verify consistency.
   *
   * @param {*} input    The inputs
   * @param {*} output   The outputs
   * @returns {{ deterministic: boolean, inputHash: string, outputHash: string, deviation: boolean }}
   */
  check(input, output) {
    const inputHash  = DeterminismValidator.hash(input);
    const outputHash = DeterminismValidator.hash(output);

    if (!this._map.has(inputHash)) {
      this._map.set(inputHash, { outputHash, count: 1, firstSeen: Date.now() });
      return { deterministic: true, inputHash, outputHash, deviation: false, first: true };
    }

    const record = this._map.get(inputHash);
    record.count++;
    const deviation = record.outputHash !== outputHash;

    if (deviation) {
      // Update to latest — log discrepancy externally
      record.outputHash = outputHash;
    }

    return {
      deterministic: !deviation,
      inputHash,
      outputHash,
      deviation,
      expectedHash: deviation ? record.outputHash : undefined,
      seenCount:    record.count,
    };
  }

  /** Clear all stored mappings. */
  clear() { this._map.clear(); }

  get size() { return this._map.size; }
}

function _jsonReplacer(key, val) {
  if (typeof val === 'function') return `[Function: ${val.name}]`;
  if (val instanceof Error)     return { error: val.message, stack: val.stack };
  return val;
}

// ─── Gate Definition ──────────────────────────────────────────────────────────

/**
 * @typedef {object} GateDefinition
 * @property {string}    id              Unique gate identifier
 * @property {string}    name            Human-readable name
 * @property {string}    [description]
 * @property {Function}  riskScore       (context) => number [0–4]
 *   Returns a RiskLevel value.
 * @property {Function}  [condition]     (context) => boolean
 *   If false, gate is skipped entirely (returns BYPASSED).
 * @property {number}    [autoApproveBelow]  Auto-approve if riskScore <= this (default: LOW)
 * @property {string[]}  [approvers]     List of approver IDs for manual gates
 * @property {number}    [timeoutMs]     Base timeout for manual approval (default: 300_000)
 * @property {string[]}  [escalateTo]    Escalation chain after timeout
 * @property {Function}  [onApprove]     async (context, decision) => void
 * @property {Function}  [onReject]      async (context, decision) => void
 */

// ─── ApprovalGates engine ─────────────────────────────────────────────────────

export class ApprovalGates extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {GateDefinition[]} [opts.gates]    Pre-register gate definitions
   * @param {object}           [opts.audit]    Audit trail options
   * @param {number}           [opts.defaultTimeout]  Default manual timeout ms (default: 300_000)
   */
  constructor(opts = {}) {
    super();
    this._gates    = new Map();
    this._requests = new Map();  // requestId → ApprovalRequest
    this._audit    = new AuditTrail(opts.audit ?? {});
    this._determinism = new DeterminismValidator();
    this._defaultTimeout = opts.defaultTimeout ?? 300_000; // 5 min
    this._timers   = new Map(); // requestId → timer handle

    // Register initial gates
    for (const g of (opts.gates ?? [])) {
      this.defineGate(g);
    }
  }

  // ── Gate Registration ──────────────────────────────────────────────────────

  /**
   * Register a gate definition.
   * @param {GateDefinition} def
   */
  defineGate(def) {
    if (!def.id || !def.name) throw new Error('Gate requires id and name');
    this._gates.set(def.id, {
      autoApproveBelow: RiskLevel.LOW,
      timeoutMs:        this._defaultTimeout,
      escalateTo:       [],
      approvers:        [],
      ...def,
    });
    return this;
  }

  /**
   * Remove a gate definition.
   * @param {string} gateId
   */
  removeGate(gateId) {
    this._gates.delete(gateId);
    return this;
  }

  // ── Approval Request Lifecycle ─────────────────────────────────────────────

  /**
   * Submit a request through an approval gate.
   *
   * @param {string}  gateId       Which gate to evaluate
   * @param {object}  context      The operation context (inputs, metadata, requester)
   * @param {object}  [opts]
   * @param {string}  [opts.requestId]  Custom request ID (default: UUID)
   * @returns {Promise<ApprovalResult>}
   *   Resolves when the request is approved, rejected, or expired.
   *   Auto-approved requests resolve immediately.
   *   Manual requests remain PENDING until approved/rejected externally.
   */
  async submit(gateId, context, opts = {}) {
    const gate = this._gates.get(gateId);
    if (!gate) throw new Error(`Gate "${gateId}" not defined`);

    const requestId = opts.requestId ?? randomUUID();

    // 1. Check gate condition (skip gate entirely if false)
    if (gate.condition && !gate.condition(context)) {
      const result = this._settle(requestId, gateId, GateStatus.BYPASSED, {
        reason: 'Gate condition not met — bypassed',
        context,
      });
      return result;
    }

    // 2. Compute risk score
    let risk;
    try {
      risk = gate.riskScore(context);
    } catch (err) {
      risk = RiskLevel.HIGH; // default to high on error
    }

    // 3. Auto-approve low-risk
    if (risk <= gate.autoApproveBelow) {
      const result = this._settle(requestId, gateId, GateStatus.BYPASSED, {
        reason:  `Auto-approved: risk=${risk} ≤ threshold=${gate.autoApproveBelow}`,
        risk,
        context,
      });
      gate.onApprove?.(context, result).catch(() => {});
      return result;
    }

    // 4. Create pending request
    const request = {
      id:          requestId,
      gateId,
      gate,
      context,
      risk,
      status:      GateStatus.PENDING,
      createdAt:   Date.now(),
      expiresAt:   Date.now() + phiTimeout(gate.timeoutMs, risk - 1),
      decisions:   [],
    };
    this._requests.set(requestId, request);

    this._audit.record({
      event:     'gate.submitted',
      requestId,
      gateId,
      risk,
      context:   _sanitizeContext(context),
      status:    GateStatus.PENDING,
    });

    this.emit('submitted', { requestId, gateId, risk, context });

    // 5. Return a promise that resolves when request is settled
    return new Promise((resolve, reject) => {
      request._resolve = resolve;
      request._reject  = reject;

      // Timeout + escalation
      const timeoutMs = request.expiresAt - Date.now();
      const timer = setTimeout(() => {
        this._handleTimeout(requestId);
      }, timeoutMs);
      this._timers.set(requestId, timer);
    });
  }

  /**
   * Approve a pending request.
   *
   * @param {string}  requestId
   * @param {string}  approverId   Who approved
   * @param {string}  [comment]
   * @returns {boolean}  true if approval was accepted
   */
  approve(requestId, approverId, comment = '') {
    return this._recordDecision(requestId, approverId, 'approve', comment);
  }

  /**
   * Reject a pending request.
   *
   * @param {string}  requestId
   * @param {string}  approverId
   * @param {string}  [reason]
   * @returns {boolean}
   */
  reject(requestId, approverId, reason = '') {
    return this._recordDecision(requestId, approverId, 'reject', reason);
  }

  _recordDecision(requestId, approverId, action, comment) {
    const request = this._requests.get(requestId);
    if (!request || request.status !== GateStatus.PENDING) return false;

    const gate = request.gate;
    request.decisions.push({ approverId, action, comment, at: Date.now() });

    this._audit.record({
      event:     `gate.${action}`,
      requestId,
      gateId:    request.gateId,
      approverId,
      comment,
    });

    // Check if enough approvals or any rejection
    if (action === 'reject') {
      this._settle(requestId, request.gateId, GateStatus.REJECTED, {
        reason:    comment,
        approverId,
        risk:      request.risk,
        context:   request.context,
        decisions: request.decisions,
      });
      return true;
    }

    // Count approvals — require majority of defined approvers (or 1 if none defined)
    const approvalCount = request.decisions.filter(d => d.action === 'approve').length;
    const required      = gate.approvers.length ? Math.ceil(gate.approvers.length / 2) : 1;

    if (approvalCount >= required) {
      this._settle(requestId, request.gateId, GateStatus.APPROVED, {
        reason:    comment,
        approverId,
        risk:      request.risk,
        context:   request.context,
        decisions: request.decisions,
      });
      gate.onApprove?.(request.context, { status: GateStatus.APPROVED }).catch(() => {});
    }

    return true;
  }

  _handleTimeout(requestId) {
    const request = this._requests.get(requestId);
    if (!request || request.status !== GateStatus.PENDING) return;

    const gate = request.gate;

    // Escalate if chain is defined
    if (gate.escalateTo?.length > 0) {
      request.status = GateStatus.ESCALATED;
      this._audit.record({
        event:     'gate.escalated',
        requestId,
        gateId:    request.gateId,
        escalateTo: gate.escalateTo,
      });
      this.emit('escalated', {
        requestId,
        gateId:     request.gateId,
        escalateTo: gate.escalateTo,
        context:    request.context,
      });

      // Give escalation chain PHI-scaled extra time
      const extraMs = phiTimeout(gate.timeoutMs, request.risk);
      const timer   = setTimeout(() => {
        this._expireRequest(requestId);
      }, extraMs);
      this._timers.set(requestId, timer);
    } else {
      this._expireRequest(requestId);
    }
  }

  _expireRequest(requestId) {
    const request = this._requests.get(requestId);
    if (!request || request.status === GateStatus.APPROVED ||
        request.status === GateStatus.REJECTED) return;

    this._settle(requestId, request.gateId, GateStatus.EXPIRED, {
      reason:  'Approval timeout — request expired',
      risk:    request.risk,
      context: request.context,
    });
    request.gate.onReject?.(request.context, { status: GateStatus.EXPIRED }).catch(() => {});
  }

  _settle(requestId, gateId, status, details) {
    const request = this._requests.get(requestId);

    const result = {
      requestId,
      gateId,
      status,
      ...details,
      settledAt: Date.now(),
    };

    if (request) {
      request.status    = status;
      request.settledAt = result.settledAt;
      request.result    = result;

      // Clear timer
      const timer = this._timers.get(requestId);
      if (timer) { clearTimeout(timer); this._timers.delete(requestId); }

      // Resolve promise
      if (status === GateStatus.APPROVED || status === GateStatus.BYPASSED) {
        request._resolve?.(result);
      } else {
        // Rejected/Expired/Error: reject the promise with a structured error
        const err = Object.assign(new Error(`Gate ${gateId}: ${status}`), result);
        request._reject?.(err);
      }
    }

    this._audit.record({
      event:  'gate.settled',
      ...result,
      context: _sanitizeContext(details.context),
    });

    this.emit('settled', result);
    this.emit(status.toLowerCase(), result);
    return result;
  }

  // ── Determinism Gate ───────────────────────────────────────────────────────

  /**
   * Check determinism as a governance gate.
   * Verifies that the same inputs produce the same outputs.
   *
   * @param {*}      input
   * @param {*}      output
   * @param {string} [operationId]  Label for the operation
   * @returns {{ passed: boolean, result: object, audit: object }}
   */
  checkDeterminism(input, output, operationId = 'unknown') {
    const result = this._determinism.check(input, output);

    const auditEntry = this._audit.record({
      event:       'determinism.check',
      operationId,
      inputHash:   result.inputHash,
      outputHash:  result.outputHash,
      deterministic: result.deterministic,
      deviation:   result.deviation,
    });

    if (result.deviation) {
      this.emit('determinism:violation', {
        operationId,
        inputHash:     result.inputHash,
        outputHash:    result.outputHash,
        expectedHash:  result.expectedHash,
      });
    }

    return { passed: result.deterministic, result, audit: auditEntry };
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * Get a pending request by ID.
   */
  getRequest(requestId) {
    return this._requests.get(requestId) ?? null;
  }

  /**
   * List all pending requests.
   */
  pendingRequests() {
    return [...this._requests.values()]
      .filter(r => r.status === GateStatus.PENDING || r.status === GateStatus.ESCALATED)
      .map(r => ({
        id:        r.id,
        gateId:    r.gateId,
        risk:      r.risk,
        status:    r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }));
  }

  /**
   * Audit log query.
   */
  auditLog(query = {}) {
    return this._audit.query(query);
  }

  /**
   * Engine status.
   */
  status() {
    const requests  = [...this._requests.values()];
    const byStatus  = {};
    for (const s of Object.values(GateStatus)) {
      byStatus[s] = requests.filter(r => r.status === s).length;
    }
    return {
      gates:              this._gates.size,
      totalRequests:      requests.length,
      byStatus,
      auditEntries:       this._audit.count,
      determinismChecks:  this._determinism.size,
    };
  }

  /**
   * Graceful shutdown: expire all pending requests.
   */
  shutdown() {
    for (const [id, timer] of this._timers) {
      clearTimeout(timer);
      this._expireRequest(id);
    }
    this._timers.clear();
    this.emit('shutdown', { at: Date.now() });
  }
}

// ─── Helper: strip sensitive context fields ───────────────────────────────────

function _sanitizeContext(ctx = {}) {
  if (!ctx) return {};
  const SENSITIVE = ['password', 'secret', 'token', 'key', 'credential', 'auth'];
  const out = { ...ctx };
  for (const key of Object.keys(out)) {
    if (SENSITIVE.some(s => key.toLowerCase().includes(s))) {
      out[key] = '[REDACTED]';
    }
  }
  return out;
}

// ─── Pre-built gates factory ──────────────────────────────────────────────────

/**
 * Returns a set of standard Heady governance gates.
 * @returns {GateDefinition[]}
 */
export function defaultGates() {
  return [
    {
      id:   'deploy',
      name: 'Deployment Approval',
      description: 'Gate for all code deployment operations',
      riskScore: ctx => {
        if (ctx.environment === 'production') return RiskLevel.HIGH;
        if (ctx.environment === 'staging')    return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
      },
      autoApproveBelow: RiskLevel.LOW,
      timeoutMs:        phiTimeout(300_000, 1), // ~485s
    },
    {
      id:   'data-mutation',
      name: 'Data Mutation Approval',
      description: 'Gate for bulk data mutations',
      riskScore: ctx => {
        if (ctx.rowCount > 10_000) return RiskLevel.CRITICAL;
        if (ctx.rowCount > 1_000)  return RiskLevel.HIGH;
        if (ctx.rowCount > 100)    return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
      },
      autoApproveBelow: RiskLevel.LOW,
    },
    {
      id:   'config-change',
      name: 'Configuration Change',
      description: 'Gate for cluster configuration changes',
      riskScore: ctx => {
        if (ctx.scope === 'cluster')  return RiskLevel.HIGH;
        if (ctx.scope === 'node')     return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
      },
      autoApproveBelow: RiskLevel.LOW,
    },
    {
      id:   'api-key-rotation',
      name: 'API Key Rotation',
      description: 'Gate for API key and credential rotation',
      riskScore: () => RiskLevel.HIGH, // always high
      autoApproveBelow: RiskLevel.NONE,
      timeoutMs: phiTimeout(600_000, 1),
    },
    {
      id:   'node-failover',
      name: 'Node Failover',
      description: 'Gate for cluster node failover decisions',
      riskScore: ctx => {
        if (ctx.nodeRole === 'BRAIN')      return RiskLevel.CRITICAL;
        if (ctx.nodeRole === 'CONDUCTOR')  return RiskLevel.HIGH;
        return RiskLevel.MEDIUM;
      },
      autoApproveBelow: RiskLevel.LOW,
      timeoutMs: phiTimeout(60_000, 1), // faster timeout for failover
    },
    {
      id:   'determinism-check',
      name: 'Determinism Validation',
      description: 'Validates that same inputs produce same outputs',
      riskScore: ctx => (ctx.deterministic === false ? RiskLevel.HIGH : RiskLevel.NONE),
      autoApproveBelow: RiskLevel.LOW,
      condition: ctx => ctx.deterministic === false, // only active on violation
    },
  ];
}

export default ApprovalGates;

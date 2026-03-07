/**
 * @file index.js
 * @description Governance layer: unified export + createGovernanceLayer() factory.
 *
 * Provides centralized governance for the Heady cluster:
 * - Approval gates for high-risk operations
 * - Determinism validation
 * - Audit trail management
 *
 * Sacred Geometry: PHI ratios for timing.
 * Zero external dependencies.
 *
 * @module HeadyGovernance
 */

import { EventEmitter } from 'events';
import { randomBytes }  from 'crypto';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// ─── Re-exports ───────────────────────────────────────────────────────────────
export {
  ApprovalGates,
  DeterminismValidator,
  GateStatus,
  RiskLevel,
  defaultGates,
} from './approval-gates.js';

// ─── Module imports for factory ───────────────────────────────────────────────
import { ApprovalGates  as _AG,
         defaultGates   as _defaultGates,
         GateStatus, RiskLevel }  from './approval-gates.js';

// ─── GovernanceLayer class ────────────────────────────────────────────────────

/**
 * Unified governance context for a Heady cluster node.
 *
 * Usage:
 *   const gov = createGovernanceLayer({ nodeId: 'SENTINEL' });
 *
 *   // Gate a deployment
 *   try {
 *     await gov.gates.submit('deploy', { environment: 'production', version: '2.0' });
 *     // Proceed with deployment...
 *   } catch (err) {
 *     console.error('Deployment blocked:', err.status, err.reason);
 *   }
 *
 *   // Validate determinism
 *   gov.checkDeterminism(inputs, outputs, 'llm-response');
 */
export class GovernanceLayer extends EventEmitter {
  /**
   * @param {object} opts
   * @param {_AG}    opts.gates
   * @param {string} [opts.nodeId]
   */
  constructor({ gates, nodeId }) {
    super();
    this.gates   = gates;
    this.nodeId  = nodeId ?? `gov-${randomBytes(4).toString('hex')}`;
    this._booted = Date.now();

    // Forward events
    gates.on('submitted',   evt => this.emit('gate:submitted',   evt));
    gates.on('approved',    evt => this.emit('gate:approved',    evt));
    gates.on('rejected',    evt => this.emit('gate:rejected',    evt));
    gates.on('escalated',   evt => this.emit('gate:escalated',   evt));
    gates.on('expired',     evt => this.emit('gate:expired',     evt));
    gates.on('settled',     evt => this.emit('gate:settled',     evt));
    gates.on('determinism:violation', evt => this.emit('determinism:violation', evt));
  }

  // ── Convenience: gate an async operation ──────────────────────────────────

  /**
   * Gate-protect an async operation.
   * Passes context through the named gate; if approved, executes fn.
   *
   * @param {string}   gateId    Gate to check
   * @param {object}   context   Context for risk scoring
   * @param {Function} fn        Operation to execute if approved
   * @returns {Promise<*>}       fn() result
   */
  async guarded(gateId, context, fn) {
    await this.gates.submit(gateId, context);
    return fn();
  }

  // ── Convenience: determinism check ────────────────────────────────────────

  /**
   * Validate determinism and emit an event + audit entry on violation.
   * @param {*}      input
   * @param {*}      output
   * @param {string} [operationId]
   * @returns {{ passed: boolean, result: object }}
   */
  checkDeterminism(input, output, operationId = 'unknown') {
    const check = this.gates.checkDeterminism(input, output, operationId);
    if (!check.passed) {
      this.emit('determinism:violation', {
        operationId,
        nodeId:  this.nodeId,
        ...check.result,
      });
    }
    return check;
  }

  // ── Convenience: audit trail ──────────────────────────────────────────────

  /**
   * Query the audit log.
   * @param {object} [query]
   * @returns {object[]}
   */
  audit(query = {}) {
    return this.gates.auditLog(query);
  }

  // ── Approval shortcuts ────────────────────────────────────────────────────

  /**
   * Approve a pending gate request.
   * @param {string} requestId
   * @param {string} approverId
   * @param {string} [comment]
   */
  approve(requestId, approverId, comment) {
    return this.gates.approve(requestId, approverId, comment);
  }

  /**
   * Reject a pending gate request.
   */
  reject(requestId, approverId, reason) {
    return this.gates.reject(requestId, approverId, reason);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  /**
   * Governance layer health snapshot.
   */
  health() {
    return {
      nodeId:   this.nodeId,
      uptimeMs: Date.now() - this._booted,
      gates:    this.gates.status(),
    };
  }

  /**
   * Graceful shutdown.
   */
  shutdown() {
    this.gates.shutdown();
    this.emit('shutdown', { nodeId: this.nodeId, at: Date.now() });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a fully-wired governance layer.
 *
 * @param {object} [opts]
 * @param {string}             [opts.nodeId]           Node identifier
 * @param {object}             [opts.audit]            Audit trail options
 * @param {boolean}            [opts.defaultGates]     Register default gates (default: true)
 * @param {GateDefinition[]}   [opts.gates]            Additional gate definitions
 * @param {number}             [opts.defaultTimeout]   Default approval timeout ms
 * @returns {GovernanceLayer}
 */
export function createGovernanceLayer(opts = {}) {
  const approvalGates = new _AG({
    defaultTimeout: opts.defaultTimeout ?? 300_000,
    audit:          opts.audit          ?? {},
  });

  // Register default Heady gates
  if (opts.defaultGates !== false) {
    for (const gate of _defaultGates()) {
      approvalGates.defineGate(gate);
    }
  }

  // Register any additional custom gates
  for (const gate of (opts.gates ?? [])) {
    approvalGates.defineGate(gate);
  }

  return new GovernanceLayer({
    gates:  approvalGates,
    nodeId: opts.nodeId,
  });
}

export default createGovernanceLayer;

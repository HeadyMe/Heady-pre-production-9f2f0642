/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const PHI = 1.6180339887;

// ─── Policy decisions ─────────────────────────────────────────────────────────
const PolicyDecision = Object.freeze({
  ALLOW:    'ALLOW',
  DENY:     'DENY',
  ESCALATE: 'ESCALATE',
});

// ─── Condition operators ──────────────────────────────────────────────────────
const ConditionOp = Object.freeze({
  EQUALS:         'EQUALS',
  NOT_EQUALS:     'NOT_EQUALS',
  CONTAINS:       'CONTAINS',
  NOT_CONTAINS:   'NOT_CONTAINS',
  STARTS_WITH:    'STARTS_WITH',
  IN:             'IN',
  NOT_IN:         'NOT_IN',
  GREATER_THAN:   'GREATER_THAN',
  LESS_THAN:      'LESS_THAN',
  REGEX:          'REGEX',
  EXISTS:         'EXISTS',
  CUSTOM:         'CUSTOM',
});

/**
 * PolicyEngine — Loads, manages, and evaluates declarative policies.
 *
 * Policy format:
 * {
 *   id:        'string',          // Unique policy ID
 *   type:      'string',          // Policy category (access_control, content, etc.)
 *   name:      'string',          // Human-readable name
 *   enabled:   true,              // Whether the policy is active
 *   priority:  100,               // Higher = evaluated first; ties broken alphabetically
 *   condition: {                  // When does this policy apply?
 *     field:    'action.type',    // Dot-path into the evaluated context
 *     operator: 'EQUALS',        // ConditionOp value
 *     value:    'deploy',        // Comparison value
 *   },
 *   action:    'DENY',            // PolicyDecision value
 *   reason:    'string',          // Reason message returned on DENY/ESCALATE
 *   meta:      {}                 // Optional metadata
 * }
 *
 * @extends EventEmitter
 */
class PolicyEngine extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {object[]} [options.builtinPolicies] - Array of built-in policies to seed
   * @param {boolean}  [options.strict=false]    - Deny by default if no policy matches
   */
  constructor(options = {}) {
    super();

    // Policy registry: id → PolicyDefinition
    this._policies = new Map();

    // Ordered array of policy IDs by priority (descending), rebuilt on each change
    this._priorityOrder = [];

    this._strict = options.strict || false;

    // Load built-in policies
    const builtins = options.builtinPolicies || this._defaultPolicies();
    for (const policy of builtins) {
      this._addPolicy(policy);
    }

    logger.info('[PolicyEngine] Initialized', {
      policyCount: this._policies.size,
      strict: this._strict,
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Load policies from a JSON file.
   * The file must be an array of policy objects.
   *
   * @param {string} filePath - Absolute or relative path to a JSON policy file
   * @returns {number} Number of policies loaded
   */
  loadPolicies(filePath) {
    const resolved = path.resolve(filePath);

    let raw;
    try {
      raw = fs.readFileSync(resolved, 'utf8');
    } catch (err) {
      throw new Error(`[PolicyEngine] Cannot read policy file: ${resolved} — ${err.message}`);
    }

    let policies;
    try {
      policies = JSON.parse(raw);
    } catch (err) {
      throw new Error(`[PolicyEngine] Invalid JSON in policy file: ${resolved} — ${err.message}`);
    }

    if (!Array.isArray(policies)) {
      throw new Error(`[PolicyEngine] Policy file must export an array: ${resolved}`);
    }

    let loaded = 0;
    for (const policy of policies) {
      try {
        this._addPolicy(policy);
        loaded++;
      } catch (err) {
        logger.warn('[PolicyEngine] Skipped invalid policy during load', {
          policyId: policy.id, error: err.message,
        });
      }
    }

    this._rebuildPriorityOrder();
    logger.info('[PolicyEngine] Policies loaded from file', { filePath: resolved, loaded });
    return loaded;
  }

  /**
   * Add or replace a single policy.
   *
   * @param {object} policy - Policy definition (see format above)
   * @throws {Error} if policy is invalid
   */
  addPolicy(policy) {
    this._validatePolicy(policy);
    this._addPolicy(policy);
    this._rebuildPriorityOrder();
    logger.debug('[PolicyEngine] Policy added', { id: policy.id, type: policy.type });
    this.emit('policy:added', { id: policy.id });
  }

  /**
   * Remove a policy by ID.
   * @param {string} id
   * @returns {boolean} true if removed
   */
  removePolicy(id) {
    const removed = this._policies.delete(id);
    if (removed) {
      this._rebuildPriorityOrder();
      logger.debug('[PolicyEngine] Policy removed', { id });
      this.emit('policy:removed', { id });
    }
    return removed;
  }

  /**
   * Enable or disable a policy without removing it.
   * @param {string}  id
   * @param {boolean} enabled
   */
  setEnabled(id, enabled) {
    const policy = this._policies.get(id);
    if (!policy) throw new Error(`[PolicyEngine] Policy not found: ${id}`);
    policy.enabled = enabled;
    logger.debug('[PolicyEngine] Policy enabled state changed', { id, enabled });
    this.emit('policy:updated', { id, enabled });
  }

  /**
   * Evaluate an action against all active policies.
   * Returns the first non-ALLOW decision, or ALLOW if all pass.
   *
   * @param {object} action   - The action being evaluated
   * @param {object} context  - Execution context
   * @returns {Promise<PolicyEvalResult>}
   */
  async evaluate(action, context = {}) {
    const evalCtx = { action, context };
    const applied = [];
    let finalDecision = this._strict ? PolicyDecision.DENY : PolicyDecision.ALLOW;
    let finalReason   = this._strict ? 'No matching policy found (strict mode)' : null;
    let matchedPolicy = null;

    for (const id of this._priorityOrder) {
      const policy = this._policies.get(id);

      if (!policy || !policy.enabled) continue;

      const matches = this._evaluateCondition(policy.condition, evalCtx);

      if (matches) {
        applied.push({ policyId: id, type: policy.type, name: policy.name, decision: policy.action });

        if (policy.action !== PolicyDecision.ALLOW) {
          finalDecision = policy.action;
          finalReason   = policy.reason || `Policy ${id} (${policy.name}) triggered`;
          matchedPolicy = policy;
          break; // First non-ALLOW stops evaluation (highest priority wins)
        } else {
          // Explicit ALLOW — override strict mode default
          finalDecision = PolicyDecision.ALLOW;
          finalReason   = null;
          matchedPolicy = policy;
        }
      }
    }

    const result = {
      decision: finalDecision,
      reason: finalReason,
      matchedPolicy: matchedPolicy ? matchedPolicy.id : null,
      appliedPolicies: applied,
      evaluatedAt: Date.now(),
    };

    this.emit('policy:evaluated', {
      actionId: action.id,
      actionType: action.type,
      decision: finalDecision,
      matchedPolicy: result.matchedPolicy,
    });

    return result;
  }

  /**
   * Get all policies (optionally filtered by type).
   * @param {string} [type]
   * @returns {object[]}
   */
  getPolicies(type = null) {
    const all = Array.from(this._policies.values());
    return type ? all.filter((p) => p.type === type) : all;
  }

  /**
   * Get a policy by ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getPolicy(id) {
    return this._policies.get(id);
  }

  // ─── Condition Evaluator ──────────────────────────────────────────────────────

  /**
   * Evaluate a condition against the context.
   * @param {object} condition
   * @param {object} evalCtx  - { action, context }
   * @returns {boolean}
   */
  _evaluateCondition(condition, evalCtx) {
    if (!condition) return true; // No condition = always match

    // Multiple conditions (AND logic)
    if (Array.isArray(condition)) {
      return condition.every((c) => this._evaluateCondition(c, evalCtx));
    }

    // OR group
    if (condition.or && Array.isArray(condition.or)) {
      return condition.or.some((c) => this._evaluateCondition(c, evalCtx));
    }

    // Custom function condition
    if (condition.operator === ConditionOp.CUSTOM && typeof condition.fn === 'function') {
      try {
        return condition.fn(evalCtx);
      } catch {
        return false;
      }
    }

    const actual = this._resolvePath(condition.field, evalCtx);
    const expected = condition.value;
    const op = condition.operator || ConditionOp.EQUALS;

    return this._compare(actual, expected, op);
  }

  /**
   * Resolve a dot-path from the eval context.
   * e.g. 'action.type' → evalCtx.action.type
   */
  _resolvePath(field, evalCtx) {
    if (!field) return undefined;
    const parts = field.split('.');
    let current = evalCtx;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Compare actual vs expected using the given operator.
   */
  _compare(actual, expected, op) {
    switch (op) {
      case ConditionOp.EQUALS:
        return actual === expected;

      case ConditionOp.NOT_EQUALS:
        return actual !== expected;

      case ConditionOp.CONTAINS:
        if (Array.isArray(actual)) return actual.includes(expected);
        if (typeof actual === 'string') return actual.includes(String(expected));
        return false;

      case ConditionOp.NOT_CONTAINS:
        if (Array.isArray(actual)) return !actual.includes(expected);
        if (typeof actual === 'string') return !actual.includes(String(expected));
        return true;

      case ConditionOp.STARTS_WITH:
        return typeof actual === 'string' && actual.startsWith(String(expected));

      case ConditionOp.IN:
        return Array.isArray(expected) && expected.includes(actual);

      case ConditionOp.NOT_IN:
        return Array.isArray(expected) && !expected.includes(actual);

      case ConditionOp.GREATER_THAN:
        return Number(actual) > Number(expected);

      case ConditionOp.LESS_THAN:
        return Number(actual) < Number(expected);

      case ConditionOp.REGEX: {
        const re = expected instanceof RegExp ? expected : new RegExp(expected);
        return re.test(String(actual));
      }

      case ConditionOp.EXISTS:
        return actual !== undefined && actual !== null;

      default:
        logger.warn('[PolicyEngine] Unknown condition operator', { op });
        return false;
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────────

  _addPolicy(policy) {
    this._validatePolicy(policy);
    const normalized = {
      id:       policy.id,
      type:     policy.type || 'general',
      name:     policy.name || policy.id,
      enabled:  policy.enabled !== false, // Default true
      priority: Number(policy.priority) || 0,
      condition: policy.condition || null,
      action:   policy.action || PolicyDecision.ALLOW,
      reason:   policy.reason || null,
      meta:     policy.meta || {},
      addedAt:  Date.now(),
    };
    this._policies.set(policy.id, normalized);
    this._rebuildPriorityOrder();
  }

  _validatePolicy(policy) {
    if (!policy.id || typeof policy.id !== 'string') {
      throw new Error('Policy must have a string id');
    }
    const validActions = Object.values(PolicyDecision);
    if (policy.action && !validActions.includes(policy.action)) {
      throw new Error(`Policy action must be one of: ${validActions.join(', ')}`);
    }
  }

  /**
   * Rebuild the sorted priority order array.
   * Highest priority first; ties broken by ID alphabetically.
   */
  _rebuildPriorityOrder() {
    this._priorityOrder = Array.from(this._policies.keys()).sort((a, b) => {
      const pa = this._policies.get(a).priority;
      const pb = this._policies.get(b).priority;
      if (pb !== pa) return pb - pa; // Higher priority first
      return a.localeCompare(b);    // Alphabetical tiebreak
    });
  }

  // ─── Built-in Policies ────────────────────────────────────────────────────────

  /**
   * Default built-in policies for the Heady AI Platform.
   * @returns {object[]}
   */
  _defaultPolicies() {
    return [
      {
        id: 'deny-unauthenticated-deploy',
        type: 'ACCESS_CONTROL',
        name: 'Deny unauthenticated deployments',
        priority: 1000,
        condition: [
          { field: 'action.type', operator: ConditionOp.EQUALS, value: 'deploy' },
          { field: 'context.userId', operator: ConditionOp.EXISTS },
        ],
        action: PolicyDecision.ALLOW,
        reason: null,
      },
      {
        id: 'deny-deploy-no-user',
        type: 'ACCESS_CONTROL',
        name: 'Deny deploy without userId',
        priority: 999,
        condition: [
          { field: 'action.type', operator: ConditionOp.EQUALS, value: 'deploy' },
          { field: 'context.userId', operator: ConditionOp.EQUALS, value: undefined },
        ],
        action: PolicyDecision.DENY,
        reason: 'Deployments require authenticated user',
      },
      {
        id: 'escalate-sensitive-data-export',
        type: 'DATA_PRIVACY',
        name: 'Escalate sensitive data exports',
        priority: 900,
        condition: { field: 'action.type', operator: ConditionOp.EQUALS, value: 'data_export' },
        action: PolicyDecision.ESCALATE,
        reason: 'Data exports require human review',
      },
      {
        id: 'allow-system-role',
        type: 'ACCESS_CONTROL',
        name: 'Allow all system-role actions',
        priority: 10_000,
        condition: { field: 'context.role', operator: ConditionOp.EQUALS, value: 'system' },
        action: PolicyDecision.ALLOW,
        reason: null,
      },
      {
        id: 'allow-admin-role',
        type: 'ACCESS_CONTROL',
        name: 'Allow all admin-role actions',
        priority: 9_999,
        condition: { field: 'context.role', operator: ConditionOp.EQUALS, value: 'admin' },
        action: PolicyDecision.ALLOW,
        reason: null,
      },
      {
        id: 'deny-user-delete-non-admin',
        type: 'ACCESS_CONTROL',
        name: 'Deny user deletion by non-admins',
        priority: 800,
        condition: [
          { field: 'action.type', operator: ConditionOp.EQUALS, value: 'user_delete' },
          { field: 'context.role', operator: ConditionOp.NOT_EQUALS, value: 'admin' },
        ],
        action: PolicyDecision.DENY,
        reason: 'Only admins can delete users',
      },
    ];
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { PolicyEngine, PolicyDecision, ConditionOp, PHI };

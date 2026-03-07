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
export class PolicyEngine extends EventEmitter<[never]> {
    /**
     * @param {object} [options]
     * @param {object[]} [options.builtinPolicies] - Array of built-in policies to seed
     * @param {boolean}  [options.strict=false]    - Deny by default if no policy matches
     */
    constructor(options?: {
        builtinPolicies?: object[] | undefined;
        strict?: boolean | undefined;
    });
    _policies: Map<any, any>;
    _priorityOrder: any[];
    _strict: boolean;
    /**
     * Load policies from a JSON file.
     * The file must be an array of policy objects.
     *
     * @param {string} filePath - Absolute or relative path to a JSON policy file
     * @returns {number} Number of policies loaded
     */
    loadPolicies(filePath: string): number;
    /**
     * Add or replace a single policy.
     *
     * @param {object} policy - Policy definition (see format above)
     * @throws {Error} if policy is invalid
     */
    addPolicy(policy: object): void;
    /**
     * Remove a policy by ID.
     * @param {string} id
     * @returns {boolean} true if removed
     */
    removePolicy(id: string): boolean;
    /**
     * Enable or disable a policy without removing it.
     * @param {string}  id
     * @param {boolean} enabled
     */
    setEnabled(id: string, enabled: boolean): void;
    /**
     * Evaluate an action against all active policies.
     * Returns the first non-ALLOW decision, or ALLOW if all pass.
     *
     * @param {object} action   - The action being evaluated
     * @param {object} context  - Execution context
     * @returns {Promise<PolicyEvalResult>}
     */
    evaluate(action: object, context?: object): Promise<PolicyEvalResult>;
    /**
     * Get all policies (optionally filtered by type).
     * @param {string} [type]
     * @returns {object[]}
     */
    getPolicies(type?: string): object[];
    /**
     * Get a policy by ID.
     * @param {string} id
     * @returns {object|undefined}
     */
    getPolicy(id: string): object | undefined;
    /**
     * Evaluate a condition against the context.
     * @param {object} condition
     * @param {object} evalCtx  - { action, context }
     * @returns {boolean}
     */
    _evaluateCondition(condition: object, evalCtx: object): boolean;
    /**
     * Resolve a dot-path from the eval context.
     * e.g. 'action.type' → evalCtx.action.type
     */
    _resolvePath(field: any, evalCtx: any): any;
    /**
     * Compare actual vs expected using the given operator.
     */
    _compare(actual: any, expected: any, op: any): boolean;
    _addPolicy(policy: any): void;
    _validatePolicy(policy: any): void;
    /**
     * Rebuild the sorted priority order array.
     * Highest priority first; ties broken by ID alphabetically.
     */
    _rebuildPriorityOrder(): void;
    /**
     * Default built-in policies for the Heady AI Platform.
     * @returns {object[]}
     */
    _defaultPolicies(): object[];
}
export const PolicyDecision: Readonly<{
    ALLOW: "ALLOW";
    DENY: "DENY";
    ESCALATE: "ESCALATE";
}>;
export const ConditionOp: Readonly<{
    EQUALS: "EQUALS";
    NOT_EQUALS: "NOT_EQUALS";
    CONTAINS: "CONTAINS";
    NOT_CONTAINS: "NOT_CONTAINS";
    STARTS_WITH: "STARTS_WITH";
    IN: "IN";
    NOT_IN: "NOT_IN";
    GREATER_THAN: "GREATER_THAN";
    LESS_THAN: "LESS_THAN";
    REGEX: "REGEX";
    EXISTS: "EXISTS";
    CUSTOM: "CUSTOM";
}>;
export const PHI: 1.6180339887;
import { EventEmitter } from "events";
//# sourceMappingURL=policy-engine.d.ts.map
/**
 * GovernanceEngine — The Heady AI Platform policy enforcement and audit layer.
 *
 * Responsibilities:
 *   1. Validate every action against a multi-type policy set
 *   2. Maintain a tamper-evident audit trail
 *   3. Provide quality gate (HeadyCheck) and deployment certification (HeadyAssure)
 *   4. Emit lifecycle events for monitoring
 *
 * @extends EventEmitter
 */
export class GovernanceEngine extends EventEmitter<[never]> {
    /**
     * @param {object} [options]
     * @param {object} [options.policyEngine]     - PolicyEngine instance
     * @param {number} [options.auditMaxEntries]  - Max audit trail entries in memory
     * @param {object} [options.budgetLimits]     - Default budget caps { tokens, usd }
     * @param {object} [options.contentSafety]    - Content safety config
     */
    constructor(options?: {
        policyEngine?: object | undefined;
        auditMaxEntries?: number | undefined;
        budgetLimits?: object | undefined;
        contentSafety?: object | undefined;
    });
    _policyEngine: object;
    _auditMaxEntries: number;
    _auditTrail: any[];
    _budgetLimits: object;
    _contentSafety: object;
    _budgetState: Map<any, any>;
    _qualityGates: Map<any, any>;
    _certifications: Map<any, any>;
    /**
     * Validate an action against all active policies.
     * The primary governance entrypoint.
     *
     * @param {object} action
     * @param {string} action.id           - Action identifier
     * @param {string} action.type         - Action type (e.g. 'llm_call', 'data_access', 'deploy')
     * @param {*}      action.payload      - Action payload
     * @param {object} context
     * @param {string} [context.sessionId]
     * @param {string} [context.userId]
     * @param {string} [context.role]      - 'admin' | 'user' | 'system'
     * @param {object} [context.meta]
     * @returns {Promise<GovernanceResult>}
     */
    validateAction(action: {
        id: string;
        type: string;
        payload: any;
    }, context?: {
        sessionId?: string | undefined;
        userId?: string | undefined;
        role?: string | undefined;
        meta?: object | undefined;
    }): Promise<GovernanceResult>;
    /**
     * HeadyCheck — Quality gate check before execution.
     * Returns a pass/fail quality assessment.
     *
     * @param {object} component   - The component to quality-check
     * @param {string} component.id
     * @param {string} component.type  - 'code' | 'model' | 'config' | 'data'
     * @param {*}      component.content
     * @returns {object} Quality gate result
     */
    headyCheck(component: {
        id: string;
        type: string;
        content: any;
    }): object;
    /**
     * HeadyAssure — Deployment certification gate.
     * Issues a certificate for deploying a component.
     *
     * @param {object} deployment
     * @param {string} deployment.id
     * @param {string} deployment.version
     * @param {object} [deployment.qualityGateId] - Prior HeadyCheck gate ID
     * @returns {object} Certification result
     */
    headyAssure(deployment: {
        id: string;
        version: string;
        qualityGateId?: object | undefined;
    }): object;
    /**
     * Get the full audit trail (or last N entries).
     * @param {number} [limit]
     * @returns {object[]}
     */
    getAuditTrail(limit?: number): object[];
    /**
     * Get budget state for a session.
     * @param {string} sessionId
     * @returns {object}
     */
    getBudgetState(sessionId: string): object;
    _checkAccessControl(action: any, context: any): Promise<{
        decision: "ALLOW";
        reason: string;
    } | {
        decision: "DENY";
        reason: string;
    } | {
        decision: "ALLOW";
        reason?: undefined;
    }>;
    _checkBudgetLimits(action: any, context: any): {
        decision: "ALLOW";
        reason: string;
        budgetState?: undefined;
    } | {
        decision: "DENY";
        reason: string;
        budgetState: any;
    } | {
        decision: "ALLOW";
        budgetState: any;
        reason?: undefined;
    };
    _checkContentSafety(action: any): {
        decision: "DENY";
        reason: string;
    } | {
        decision: "ESCALATE";
        reason: string;
    } | {
        decision: "ALLOW";
        reason?: undefined;
    };
    _checkMissionAlignment(action: any, context: any): {
        decision: "ALLOW";
        reason?: undefined;
    } | {
        decision: "DENY";
        reason: string;
    };
    _audit(result: any): void;
}
export const GovernanceDecision: Readonly<{
    ALLOW: "ALLOW";
    DENY: "DENY";
    ESCALATE: "ESCALATE";
    PENDING: "PENDING";
}>;
export const PolicyType: Readonly<{
    ACCESS_CONTROL: "ACCESS_CONTROL";
    BUDGET_LIMIT: "BUDGET_LIMIT";
    CONTENT_SAFETY: "CONTENT_SAFETY";
    MISSION_ALIGNMENT: "MISSION_ALIGNMENT";
    RATE_LIMIT: "RATE_LIMIT";
    DATA_PRIVACY: "DATA_PRIVACY";
}>;
export const PHI: 1.6180339887;
import { EventEmitter } from "events";
//# sourceMappingURL=governance-engine.d.ts.map
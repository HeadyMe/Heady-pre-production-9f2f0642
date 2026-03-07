export = PolicyEngine;
/**
 * ═══ Policy Engine — SPEC-4 ═══
 *
 * Tool governance: allow/deny per environment, scopes, approval gates,
 * rate limits, and audit logging for all tool invocations.
 */
declare class PolicyEngine {
    constructor(opts?: {});
    policies: Map<any, any>;
    invocations: any[];
    maxInvocations: any;
    rateLimitCounters: Map<any, any>;
    budgetService: any;
    addPolicy(policy: any): void;
    evaluate(toolId: any, context?: {}): Promise<{
        toolId: any;
        environment: any;
        allowed: boolean;
        requiresApproval: boolean;
        reasons: never[];
    }>;
    logInvocation(toolId: any, actor: any, request: any, response: any, status: any, budgetId?: null): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        toolId: any;
        actorType: any;
        actorId: any;
        environment: any;
        budgetId: null;
        request: any;
        response: {
            summary: string;
        } | null;
        status: any;
        ts: string;
    };
    getInvocations(filter?: {}, limit?: number): any[];
    listPolicies(): any[];
    status(): {
        policiesRegistered: number;
        invocationsLogged: number;
    };
}
//# sourceMappingURL=policy-engine.d.ts.map
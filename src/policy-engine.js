/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Policy Engine — SPEC-4 ═══
 *
 * Tool governance: allow/deny per environment, scopes, approval gates,
 * rate limits, and audit logging for all tool invocations.
 */

class PolicyEngine {
    constructor(opts = {}) {
        this.policies = new Map();     // toolId:env → policy
        this.invocations = [];
        this.maxInvocations = opts.maxInvocations || 10000;
        this.rateLimitCounters = new Map(); // toolId:env:minute → count
        this.budgetService = opts.budgetService || null;
    }

    // ─── Register a policy ───────────────────────────────────────
    addPolicy(policy) {
        const key = `${policy.toolId}:${policy.environment}`;
        this.policies.set(key, {
            toolId: policy.toolId,
            environment: policy.environment || "prod",
            requiresApproval: policy.requiresApproval || false,
            allowedRoles: policy.allowedRoles || [],
            rateLimitPerMin: policy.rateLimitPerMin || null,
            riskLevel: policy.riskLevel || "LOW",
            constraints: policy.constraints || {},
            estimatedCost: policy.estimatedCost || 0.00, // Cost policy hook
        });
    }

    // ─── Evaluate a tool call ────────────────────────────────────
    async evaluate(toolId, context = {}) {
        const env = context.environment || "prod";
        const key = `${toolId}:${env}`;
        const policy = this.policies.get(key);

        const result = {
            toolId,
            environment: env,
            allowed: true,
            requiresApproval: false,
            reasons: [],
        };

        // No policy = allow by default (but log)
        if (!policy) {
            result.reasons.push("no_policy_defined");
            return result;
        }

        // Check role
        if (policy.allowedRoles.length > 0 && context.role) {
            if (!policy.allowedRoles.includes(context.role)) {
                result.allowed = false;
                result.reasons.push(`role_denied:${context.role}`);
            }
        }

        // Check rate limit
        if (policy.rateLimitPerMin) {
            const minute = Math.floor(Date.now() / 60000);
            const rateKey = `${key}:${minute}`;
            const current = this.rateLimitCounters.get(rateKey) || 0;
            if (current >= policy.rateLimitPerMin) {
                result.allowed = false;
                result.reasons.push(`rate_limited:${current}/${policy.rateLimitPerMin}`);
            } else {
                this.rateLimitCounters.set(rateKey, current + 1);
            }
        }

        // Check approval requirement
        if (policy.requiresApproval) {
            result.requiresApproval = true;
            if (!context.approved) {
                result.allowed = false;
                result.reasons.push("approval_required");
            }
        }

        // Check budget constraints if budgetService is available
        if (this.budgetService && context.actor) {
            const estimatedCost = context.estimatedCost || policy.estimatedCost || 0.0001;
            const budgetCheck = await this.budgetService.checkBudget(
                context.actor.type || 'USER',
                context.actor.id || 'anonymous',
                estimatedCost
            );

            if (!budgetCheck.allowed) {
                result.allowed = false;
                result.reasons.push(`budget_exceeded:rem=${budgetCheck.remaining}`);
                result.budgetConstraint = true;
                result.budgetRemaining = budgetCheck.remaining;
            } else {
                result.budget_id = budgetCheck.budget_id;
            }
        }

        // Check risk level constraints
        if (policy.riskLevel === "HIGH" || policy.riskLevel === "CRITICAL") {
            if (!context.confirmed) {
                result.allowed = false;
                result.reasons.push(`high_risk_unconfirmed:${policy.riskLevel}`);
            }
        }

        return result;
    }

    // ─── Log an invocation ───────────────────────────────────────
    logInvocation(toolId, actor, request, response, status, budgetId = null) {
        const inv = {
            id: require("crypto").randomUUID(),
            toolId,
            actorType: actor.type || "user",
            actorId: actor.id || "anonymous",
            environment: actor.environment || "prod",
            budgetId: budgetId,
            request,
            response: response ? { summary: typeof response === "string" ? response : JSON.stringify(response).substring(0, 500) } : null,
            status,
            ts: new Date().toISOString(),
        };
        this.invocations.push(inv);
        if (this.invocations.length > this.maxInvocations) this.invocations.shift();
        return inv;
    }

    // ─── Query invocations ───────────────────────────────────────
    getInvocations(filter = {}, limit = 50) {
        let results = this.invocations;
        if (filter.toolId) results = results.filter(i => i.toolId === filter.toolId);
        if (filter.status) results = results.filter(i => i.status === filter.status);
        if (filter.actorId) results = results.filter(i => i.actorId === filter.actorId);
        return results.slice(-limit);
    }

    // ─── List all policies ───────────────────────────────────────
    listPolicies() {
        return [...this.policies.values()];
    }

    status() {
        return {
            policiesRegistered: this.policies.size,
            invocationsLogged: this.invocations.length,
        };
    }
}

module.exports = PolicyEngine;

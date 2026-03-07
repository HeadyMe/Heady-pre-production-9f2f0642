/**
 * Register a project budget. If not registered, DEFAULT_BUDGET applies.
 */
export function setBudget(projectId: any, budget?: {}): void;
/**
 * Check if a call is within budget. Returns { allowed, reason, remaining }.
 */
export function checkBudget(projectId: any, modelId: any, estimatedTokens?: number): {
    allowed: boolean;
    reason: string;
    remaining: {
        daily: number;
        monthly: number;
    };
    alert?: undefined;
    estimatedCostUsd?: undefined;
} | {
    allowed: boolean;
    alert: boolean;
    estimatedCostUsd: number;
    remaining: {
        daily: number;
        monthly: number;
    };
    reason?: undefined;
};
/**
 * Record an LLM call and generate a deterministic receipt.
 */
export function recordUsage(projectId: any, modelId: any, inputTokens: any, outputTokens: any, metadata?: {}): {
    receiptId: `${string}-${string}-${string}-${string}-${string}`;
    projectId: any;
    modelId: any;
    inputTokens: any;
    outputTokens: any;
    costUsd: {
        input: number;
        output: number;
        total: number;
    };
    budget: {
        dailySpent: number;
        dailyLimit: any;
        monthlySpent: number;
        monthlyLimit: any;
    };
    metadata: {
        taskType: any;
        intent: any;
        environment: any;
    };
    timestamp: string;
};
/**
 * Estimate cost for a call (before execution).
 */
export function estimateCost(modelId: any, totalTokens?: number): number;
/**
 * Get usage summary for a project.
 */
export function getUsageSummary(projectId: any): {
    projectId: any;
    budget: any;
    totalCalls: number;
    totalCostUsd: number;
    byModel: {};
    last10: any[];
};
/**
 * Reset daily budget counters (call from scheduler at midnight).
 */
export function resetDailyBudgets(): {
    reset: boolean;
    projectCount: number;
};
/**
 * Express API routes for budget management.
 */
export function budgetRoutes(app: any): void;
export const COST_TABLE: {
    'claude-sonnet': {
        input: number;
        output: number;
    };
    'gemini-pro': {
        input: number;
        output: number;
    };
    'gpt-4o': {
        input: number;
        output: number;
    };
    'perplexity-sonar': {
        input: number;
        output: number;
    };
    'groq-llama': {
        input: number;
        output: number;
    };
    'huggingface-open': {
        input: number;
        output: number;
    };
};
export namespace DEFAULT_BUDGET {
    let dailyLimitUsd: number;
    let monthlyLimitUsd: number;
    let alertThreshold: number;
    let hardStop: boolean;
}
//# sourceMappingURL=budget-tracker.d.ts.map
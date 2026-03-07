/**
 * Route a task to the optimal provider based on cost and capability.
 * @param {object} task - Task object with prompt/message and optional action
 * @param {object} opts - { preferSpeed: bool, preferQuality: bool, maxCostUSD: number }
 * @returns {{ tier: object, reason: string }}
 */
export function route(task: object, opts?: object): {
    tier: object;
    reason: string;
};
/**
 * Route to failover when primary provider (Cloudflare) is down.
 * @param {object} task - Task to route
 * @returns {{ tier: object, reason: string }}
 */
export function routeToFailover(task: object): {
    tier: object;
    reason: string;
};
/**
 * Estimate task complexity (1-10) from request metadata.
 */
export function estimateComplexity(task: any): number;
/**
 * Record a completed transaction for budget tracking.
 */
export function recordTransaction(provider: any, tokensUsed: any, costUSD: any): void;
/**
 * Get current budget status.
 */
export function getBudgetStatus(): {
    remainingUSD: number;
    usagePercent: string;
    transactionCount: number;
    maxDailyCostUSD: number;
    currentDayCost: number;
    dayStart: string;
    transactions: never[];
};
/**
 * Get the Cloud Run failover tier for liquid routing.
 * @returns {object|null} The Cloud Run failover tier, or null if not configured
 */
export function getLiquidFailover(): object | null;
export const PROVIDER_TIERS: ({
    name: string;
    provider: string;
    model: string;
    costPer1kTokens: number;
    maxTokens: number;
    latencyMs: number;
    capabilities: string[];
    complexity: number[];
    endpoint?: undefined;
    isFailover?: undefined;
} | {
    name: string;
    provider: string;
    model: string;
    costPer1kTokens: number;
    maxTokens: number;
    latencyMs: number;
    capabilities: string[];
    complexity: number[];
    endpoint: string;
    isFailover: boolean;
})[];
/**
 * ═══ FinOps Budget Router ═══
 *
 * Cost-aware routing engine that delegates tasks based on complexity,
 * token budget, and provider pricing tiers.
 *
 * Simple tasks → Local models (Ollama/Edge)
 * Medium tasks → Groq/Gemini (fast + cheap)
 * Complex tasks → Claude/GPT-4o (deep reasoning)
 *
 * Tasks: enterprise-007, strategic-001
 */
export const CLOUD_RUN_URL: string;
//# sourceMappingURL=finops-budget-router.d.ts.map
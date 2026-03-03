/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
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

// Provider tiers ordered by cost (cheapest first)
// ═══ CLOUD ONLY — No local resources until authorized ═══
// ═══ Liquid Failover: Cloudflare Worker ↔ GCloud Cloud Run ═══
const CLOUD_RUN_URL = process.env.HEADY_CLOUDRUN_URL || 'https://heady-edge-gateway-609590223909.us-central1.run.app';
const PROVIDER_TIERS = [
    {
        name: "edge",
        provider: "cloudflare",
        model: "llama-3.1-8b",
        costPer1kTokens: 0.0001,
        maxTokens: 8192,
        latencyMs: 50,
        capabilities: ["chat", "embed", "classify"],
        complexity: [1, 4],
    },
    {
        name: "fast",
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        costPer1kTokens: 0.00059,
        maxTokens: 32768,
        latencyMs: 100,
        capabilities: ["chat", "complete", "analyze"],
        complexity: [1, 6],
    },
    {
        name: "balanced",
        provider: "gemini",
        model: "gemini-2.0-flash",
        costPer1kTokens: 0.0001,
        maxTokens: 1048576,
        latencyMs: 300,
        capabilities: ["chat", "analyze", "generate", "multimodal"],
        complexity: [3, 7],
    },
    {
        name: "reasoning",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        costPer1kTokens: 0.003,
        maxTokens: 200000,
        latencyMs: 800,
        capabilities: ["chat", "analyze", "code", "reasoning", "think"],
        complexity: [5, 9],
    },
    {
        name: "frontier",
        provider: "openai",
        model: "gpt-4o",
        costPer1kTokens: 0.005,
        maxTokens: 128000,
        latencyMs: 1000,
        capabilities: ["chat", "analyze", "code", "reasoning", "vision"],
        complexity: [7, 10],
    },
    {
        name: "cloudrun-failover",
        provider: "gcloud-cloudrun",
        model: "heady-brain-liquid",
        costPer1kTokens: 0.0002,
        maxTokens: 128000,
        latencyMs: 900,
        capabilities: ["chat", "analyze", "code", "reasoning", "buddy"],
        complexity: [1, 10],
        endpoint: CLOUD_RUN_URL,
        isFailover: true,
    },
];

// Daily budget tracking
let dailyBudget = {
    maxDailyCostUSD: parseFloat(process.env.HEADY_DAILY_BUDGET || "5.00"),
    currentDayCost: 0,
    dayStart: new Date().toISOString().split("T")[0],
    transactions: [],
};

/**
 * Estimate task complexity (1-10) from request metadata.
 */
function estimateComplexity(task) {
    let score = 3; // default medium-low

    const text = (task.prompt || task.message || task.content || "").toLowerCase();
    const tokenEstimate = text.split(/\s+/).length * 1.3;

    // Heuristics
    if (tokenEstimate > 2000) score += 2;
    if (tokenEstimate > 5000) score += 2;
    if (text.includes("analyze") || text.includes("refactor")) score += 1;
    if (text.includes("architecture") || text.includes("design")) score += 2;
    if (text.includes("security") || text.includes("audit")) score += 1;
    if (text.includes("simple") || text.includes("quick")) score -= 2;
    if (task.action === "think" || task.action === "analyze") score += 2;
    if (task.action === "chat" || task.action === "complete") score -= 1;

    return Math.max(1, Math.min(10, score));
}

/**
 * Route a task to the optimal provider based on cost and capability.
 * @param {object} task - Task object with prompt/message and optional action
 * @param {object} opts - { preferSpeed: bool, preferQuality: bool, maxCostUSD: number }
 * @returns {{ tier: object, reason: string }}
 */
function route(task, opts = {}) {
    const complexity = task.complexity || estimateComplexity(task);
    const requiredCapability = task.action || "chat";

    // Reset daily budget if new day
    const today = new Date().toISOString().split("T")[0];
    if (today !== dailyBudget.dayStart) {
        dailyBudget.currentDayCost = 0;
        dailyBudget.dayStart = today;
        dailyBudget.transactions = [];
    }

    // Filter tiers by capability and complexity range
    let candidates = PROVIDER_TIERS.filter(tier => {
        if (!tier.capabilities.includes(requiredCapability)) return false;
        if (complexity < tier.complexity[0] || complexity > tier.complexity[1]) return false;
        return true;
    });

    if (candidates.length === 0) {
        // Fallback: pick the tier closest to the complexity
        candidates = PROVIDER_TIERS.filter(t => t.capabilities.includes(requiredCapability));
        if (candidates.length === 0) candidates = [PROVIDER_TIERS[2]]; // groq fallback
    }

    // Sort by preference
    if (opts.preferSpeed) {
        candidates.sort((a, b) => a.latencyMs - b.latencyMs);
    } else if (opts.preferQuality) {
        candidates.sort((a, b) => b.complexity[1] - a.complexity[1]);
    } else {
        // Default: cheapest that handles the complexity
        candidates.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
    }

    // Budget guard: if over 80% daily budget, force cheap tier
    const budgetUsage = dailyBudget.currentDayCost / dailyBudget.maxDailyCostUSD;
    if (budgetUsage > 0.8) {
        const cheapest = candidates.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
        return {
            tier: cheapest,
            complexity,
            reason: `Budget guard (${(budgetUsage * 100).toFixed(0)}% used) → forced cheapest: ${cheapest.name}`,
            budgetStatus: { ...dailyBudget, transactions: undefined },
        };
    }

    const selected = candidates[0];
    return {
        tier: selected,
        complexity,
        reason: `Complexity ${complexity}/10 → ${selected.name} (${selected.provider}/${selected.model})`,
        budgetStatus: { ...dailyBudget, transactions: undefined },
    };
}

/**
 * Record a completed transaction for budget tracking.
 */
function recordTransaction(provider, tokensUsed, costUSD) {
    dailyBudget.currentDayCost += costUSD;
    dailyBudget.transactions.push({
        provider,
        tokensUsed,
        costUSD,
        ts: new Date().toISOString(),
    });
}

/**
 * Get current budget status.
 */
function getBudgetStatus() {
    return {
        ...dailyBudget,
        remainingUSD: Math.max(0, dailyBudget.maxDailyCostUSD - dailyBudget.currentDayCost),
        usagePercent: ((dailyBudget.currentDayCost / dailyBudget.maxDailyCostUSD) * 100).toFixed(1),
        transactionCount: dailyBudget.transactions.length,
    };
}

/**
 * Get the Cloud Run failover tier for liquid routing.
 * @returns {object|null} The Cloud Run failover tier, or null if not configured
 */
function getLiquidFailover() {
    return PROVIDER_TIERS.find(t => t.isFailover) || null;
}

/**
 * Route to failover when primary provider (Cloudflare) is down.
 * @param {object} task - Task to route
 * @returns {{ tier: object, reason: string }}
 */
function routeToFailover(task) {
    const failover = getLiquidFailover();
    if (!failover) return route(task); // normal routing
    return {
        tier: failover,
        complexity: task.complexity || estimateComplexity(task),
        reason: `Primary edge down → Liquid failover to ${failover.provider} (${failover.endpoint})`,
        budgetStatus: { ...dailyBudget, transactions: undefined },
    };
}

module.exports = { route, routeToFailover, estimateComplexity, recordTransaction, getBudgetStatus, getLiquidFailover, PROVIDER_TIERS, CLOUD_RUN_URL };

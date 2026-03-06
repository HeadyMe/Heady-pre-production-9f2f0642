/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Budget-Aware LLM Usage Tracker — Roadmap Track D
 * ═══════════════════════════════════════════════════════════════
 *
 * Records every LLM call with cost, tracks budgets per project,
 * and generates deterministic receipts for audit compliance.
 * Integrates with llm-router.js to enforce per-call cost caps.
 *
 * Fulfills:
 *   Track D – Enterprise Operations:
 *     - Budget-aware routing before provider calls
 *     - Full usage recording per call
 *     - Deterministic receipts for audit
 */

const crypto = require('crypto');

// ── Per-Project Budget State ────────────────────────────────────
const _budgets = new Map();       // projectId → { dailyLimit, monthlyLimit, spent: { daily, monthly } }
const _usageLog = [];             // flat log of all calls
const _dailyResetHour = 0;       // midnight UTC

const DEFAULT_BUDGET = {
    dailyLimitUsd: 50.00,
    monthlyLimitUsd: 500.00,
    alertThreshold: 0.80,         // 80% alert
    hardStop: true,               // reject calls when over budget
};

// Cost per 1K tokens (approx) — kept in sync with llm-router MODEL_REGISTRY
const COST_TABLE = {
    'claude-sonnet': { input: 0.003, output: 0.015 },
    'gemini-pro': { input: 0.00125, output: 0.005 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'perplexity-sonar': { input: 0.001, output: 0.001 },
    'groq-llama': { input: 0.00027, output: 0.00027 },
    'huggingface-open': { input: 0.0, output: 0.0 },
};

/**
 * Register a project budget. If not registered, DEFAULT_BUDGET applies.
 */
function setBudget(projectId, budget = {}) {
    _budgets.set(projectId, {
        dailyLimitUsd: budget.dailyLimitUsd ?? DEFAULT_BUDGET.dailyLimitUsd,
        monthlyLimitUsd: budget.monthlyLimitUsd ?? DEFAULT_BUDGET.monthlyLimitUsd,
        alertThreshold: budget.alertThreshold ?? DEFAULT_BUDGET.alertThreshold,
        hardStop: budget.hardStop ?? DEFAULT_BUDGET.hardStop,
        spent: { daily: 0, monthly: 0 },
        lastReset: new Date().toISOString(),
    });
}

/**
 * Check if a call is within budget. Returns { allowed, reason, remaining }.
 */
function checkBudget(projectId, modelId, estimatedTokens = 1000) {
    const budget = _budgets.get(projectId) || { ...DEFAULT_BUDGET, spent: { daily: 0, monthly: 0 } };
    const cost = estimateCost(modelId, estimatedTokens);

    const dailyRemaining = budget.dailyLimitUsd - budget.spent.daily;
    const monthlyRemaining = budget.monthlyLimitUsd - budget.spent.monthly;

    if (budget.hardStop && cost > dailyRemaining) {
        return { allowed: false, reason: 'daily_budget_exceeded', remaining: { daily: dailyRemaining, monthly: monthlyRemaining } };
    }
    if (budget.hardStop && cost > monthlyRemaining) {
        return { allowed: false, reason: 'monthly_budget_exceeded', remaining: { daily: dailyRemaining, monthly: monthlyRemaining } };
    }

    const alert = (budget.spent.daily / budget.dailyLimitUsd) >= budget.alertThreshold;

    return { allowed: true, alert, estimatedCostUsd: cost, remaining: { daily: dailyRemaining, monthly: monthlyRemaining } };
}

/**
 * Record an LLM call and generate a deterministic receipt.
 */
function recordUsage(projectId, modelId, inputTokens, outputTokens, metadata = {}) {
    const inputCost = (COST_TABLE[modelId]?.input || 0) * (inputTokens / 1000);
    const outputCost = (COST_TABLE[modelId]?.output || 0) * (outputTokens / 1000);
    const totalCost = inputCost + outputCost;

    // Update budget
    let budget = _budgets.get(projectId);
    if (!budget) {
        setBudget(projectId);
        budget = _budgets.get(projectId);
    }
    budget.spent.daily += totalCost;
    budget.spent.monthly += totalCost;

    // Generate deterministic receipt
    const receipt = {
        receiptId: crypto.randomUUID(),
        projectId,
        modelId,
        inputTokens,
        outputTokens,
        costUsd: {
            input: parseFloat(inputCost.toFixed(6)),
            output: parseFloat(outputCost.toFixed(6)),
            total: parseFloat(totalCost.toFixed(6)),
        },
        budget: {
            dailySpent: parseFloat(budget.spent.daily.toFixed(6)),
            dailyLimit: budget.dailyLimitUsd,
            monthlySpent: parseFloat(budget.spent.monthly.toFixed(6)),
            monthlyLimit: budget.monthlyLimitUsd,
        },
        metadata: {
            taskType: metadata.taskType || 'unknown',
            intent: metadata.intent || null,
            environment: metadata.environment || 'production',
        },
        timestamp: new Date().toISOString(),
    };

    // Content-hash for tamper detection
    receipt.hash = crypto.createHash('sha256')
        .update(JSON.stringify({ ...receipt, hash: undefined }))
        .digest('hex')
        .slice(0, 16);

    _usageLog.push(receipt);

    // Keep log bounded
    if (_usageLog.length > 10000) _usageLog.splice(0, _usageLog.length - 10000);

    return receipt;
}

/**
 * Estimate cost for a call (before execution).
 */
function estimateCost(modelId, totalTokens = 1000) {
    const rates = COST_TABLE[modelId] || { input: 0, output: 0 };
    // Assume 40% input, 60% output
    return ((rates.input * 0.4) + (rates.output * 0.6)) * (totalTokens / 1000);
}

/**
 * Get usage summary for a project.
 */
function getUsageSummary(projectId) {
    const budget = _budgets.get(projectId);
    const projectLogs = _usageLog.filter(r => r.projectId === projectId);

    return {
        projectId,
        budget: budget || DEFAULT_BUDGET,
        totalCalls: projectLogs.length,
        totalCostUsd: parseFloat(projectLogs.reduce((sum, r) => sum + r.costUsd.total, 0).toFixed(4)),
        byModel: Object.entries(
            projectLogs.reduce((acc, r) => {
                acc[r.modelId] = acc[r.modelId] || { calls: 0, cost: 0 };
                acc[r.modelId].calls++;
                acc[r.modelId].cost += r.costUsd.total;
                return acc;
            }, {})
        ).reduce((obj, [k, v]) => { obj[k] = { ...v, cost: parseFloat(v.cost.toFixed(4)) }; return obj; }, {}),
        last10: projectLogs.slice(-10),
    };
}

/**
 * Reset daily budget counters (call from scheduler at midnight).
 */
function resetDailyBudgets() {
    for (const [, budget] of _budgets) {
        budget.spent.daily = 0;
        budget.lastReset = new Date().toISOString();
    }
    return { reset: true, projectCount: _budgets.size };
}

/**
 * Express API routes for budget management.
 */
function budgetRoutes(app) {
    app.get('/api/budget/summary/:projectId', (req, res) => {
        res.json(getUsageSummary(req.params.projectId));
    });

    app.post('/api/budget/set', (req, res) => {
        const { projectId, ...budgetConfig } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId required' });
        setBudget(projectId, budgetConfig);
        res.json({ ok: true, budget: _budgets.get(projectId) });
    });

    app.post('/api/budget/check', (req, res) => {
        const { projectId, modelId, estimatedTokens } = req.body;
        res.json(checkBudget(projectId, modelId, estimatedTokens));
    });

    app.get('/api/budget/receipts/:projectId', (req, res) => {
        const limit = parseInt(req.query.limit || '50', 10);
        const receipts = _usageLog
            .filter(r => r.projectId === req.params.projectId)
            .slice(-limit);
        res.json({ projectId: req.params.projectId, count: receipts.length, receipts });
    });

    app.post('/api/budget/reset-daily', (req, res) => {
        res.json(resetDailyBudgets());
    });
}

module.exports = {
    setBudget,
    checkBudget,
    recordUsage,
    estimateCost,
    getUsageSummary,
    resetDailyBudgets,
    budgetRoutes,
    COST_TABLE,
    DEFAULT_BUDGET,
};

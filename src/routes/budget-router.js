/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Budget Router — FinOps Cost-Governance Engine
 *
 * Dynamically routes AI requests to the most cost-effective model
 * that meets the quality threshold. Exposes cost data in Proof View
 * receipts showing exactly what was executed, why a model was chosen,
 * and how much money was saved through intelligent routing.
 *
 * Transforms OpEx liability into a competitive differentiator.
 */

const express = require('express');
const router = express.Router();

// ── Model Cost Matrix (per 1K tokens, USD) ──────────────────────────
const MODEL_COSTS = {
    // Local (HeadyLocal) — effectively free
    'llama-3.1-8b': { input: 0.0000, output: 0.0000, quality: 0.65, latencyMs: 200, provider: 'headylocal-local' },
    'codellama-13b': { input: 0.0000, output: 0.0000, quality: 0.60, latencyMs: 300, provider: 'headylocal-local' },
    'mistral-7b': { input: 0.0000, output: 0.0000, quality: 0.62, latencyMs: 250, provider: 'headylocal-local' },

    // Edge (Cloudflare Workers AI) — near-free
    'bge-large-en-v1.5': { input: 0.0001, output: 0.0000, quality: 0.70, latencyMs: 50, provider: 'cloudflare-edge' },

    // Mid-tier API
    'gpt-4o-mini': { input: 0.0003, output: 0.0006, quality: 0.80, latencyMs: 800, provider: 'headycompute' },
    'headypythia-flash': { input: 0.0004, output: 0.0008, quality: 0.78, latencyMs: 600, provider: 'google' },
    'sonar': { input: 0.0010, output: 0.0010, quality: 0.75, latencyMs: 1200, provider: 'perplexity' },

    // Premium API
    'headyjules-opus-4.6': { input: 0.0150, output: 0.0750, quality: 0.97, latencyMs: 1500, provider: 'headynexus' },
    'gpt-5.3-codex': { input: 0.0100, output: 0.0300, quality: 0.95, latencyMs: 1200, provider: 'headycompute' },
    'headypythia-3.1-pro': { input: 0.0070, output: 0.0210, quality: 0.93, latencyMs: 1500, provider: 'google' },
    'sonar-pro': { input: 0.0030, output: 0.0150, quality: 0.88, latencyMs: 2000, provider: 'perplexity' },
    'grok-4': { input: 0.0050, output: 0.0150, quality: 0.90, latencyMs: 2000, provider: 'xai' },
};

// ── Quality Thresholds by Task Type ─────────────────────────────────
const TASK_QUALITY_THRESHOLDS = {
    'simple-chat': 0.60,  // Any model works
    'summarization': 0.65,  // Local models fine
    'code-completion': 0.75,  // Mid-tier minimum
    'code-generation': 0.85,  // Premium preferred
    'code-review': 0.90,  // Premium required
    'architecture': 0.93,  // Top-tier only
    'security-audit': 0.95,  // Top-tier only
    'research': 0.80,  // Mid-tier+ with web access
    'embedding': 0.70,  // Edge is optimal
    'classification': 0.65,  // Local works
};

// ── Session Cost Tracker ────────────────────────────────────────────
const sessionCosts = new Map();

function getSessionCost(sessionId) {
    if (!sessionCosts.has(sessionId)) {
        sessionCosts.set(sessionId, {
            totalCost: 0,
            totalTokens: 0,
            totalSaved: 0,
            requests: 0,
            breakdown: [],
        });
    }
    return sessionCosts.get(sessionId);
}

/**
 * Select the cheapest model meeting the quality threshold.
 * If multiple models tie on cost, prefer lower latency.
 * If budget is constrained, filter out models exceeding remaining budget.
 */
function selectOptimalModel(taskType, constraints = {}) {
    const minQuality = constraints.minQuality || TASK_QUALITY_THRESHOLDS[taskType] || 0.70;
    const maxLatency = constraints.maxLatencyMs || Infinity;
    const maxCostPer1k = constraints.maxCostPer1k || Infinity;
    const preferProvider = constraints.preferProvider || null;
    const remainingBudget = constraints.remainingBudget !== undefined ? constraints.remainingBudget : Infinity;
    const estimatedTokens = constraints.estimatedTokens || 500;

    const candidates = Object.entries(MODEL_COSTS)
        .filter(([, m]) => m.quality >= minQuality)
        .filter(([, m]) => m.latencyMs <= maxLatency)
        .filter(([, m]) => (m.input + m.output) <= maxCostPer1k)
        .filter(([, m]) => {
            // Filter by remaining budget
            const estCost = ((m.input * estimatedTokens / 1000) + (m.output * estimatedTokens / 1000));
            return estCost <= remainingBudget;
        })
        .sort((a, b) => {
            const costA = a[1].input + a[1].output;
            const costB = b[1].input + b[1].output;
            if (costA !== costB) return costA - costB;
            return a[1].latencyMs - b[1].latencyMs;
        });

    if (preferProvider) {
        const providerMatch = candidates.find(([, m]) => m.provider === preferProvider);
        if (providerMatch) return { model: providerMatch[0], ...providerMatch[1] };
    }

    if (candidates.length === 0) {
        // Fallback to highest quality available that FITS the budget
        const affordableFallback = Object.entries(MODEL_COSTS)
            .filter(([, m]) => {
                const estCost = ((m.input * estimatedTokens / 1000) + (m.output * estimatedTokens / 1000));
                return estCost <= remainingBudget;
            })
            .sort((a, b) => b[1].quality - a[1].quality)[0];

        if (affordableFallback) {
            return { model: affordableFallback[0], ...affordableFallback[1], fallback: true, budgetConstrained: true };
        }

        // Absolute fallback to free local model if nothing else fits
        const localFallback = Object.entries(MODEL_COSTS).find(([, m]) => m.input === 0);
        return { model: localFallback[0], ...localFallback[1], fallback: true, budgetConstrained: true, emergency: true };
    }

    const selected = candidates[0];
    const mostExpensive = Object.entries(MODEL_COSTS).sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output))[0];
    const savedPer1k = (mostExpensive[1].input + mostExpensive[1].output) - (selected[1].input + selected[1].output);

    return {
        model: selected[0],
        ...selected[1],
        alternativesConsidered: candidates.length,
        savedPer1kTokens: savedPer1k,
        budgetConstrained: remainingBudget < mostExpensive[1].input + mostExpensive[1].output
    };
}

// ── Routes ──────────────────────────────────────────────────────────

/**
 * POST /budget/route
 * Select optimal model for a task
 */
router.post('/route', (req, res) => {
    const { taskType, constraints, sessionId, estimatedTokens } = req.body;

    if (!taskType) {
        return res.status(400).json({ error: 'taskType is required' });
    }

    const selection = selectOptimalModel(taskType, constraints || {});
    const tokens = estimatedTokens || 500;
    const estimatedCost = ((selection.input * tokens / 1000) + (selection.output * tokens / 1000));
    const maxCost = ((MODEL_COSTS['headyjules-opus-4.6'].input * tokens / 1000) + (MODEL_COSTS['headyjules-opus-4.6'].output * tokens / 1000));
    const savings = maxCost - estimatedCost;
    const savingsPercent = maxCost > 0 ? ((savings / maxCost) * 100).toFixed(1) : 0;

    // Track session cost
    if (sessionId) {
        const session = getSessionCost(sessionId);
        session.totalCost += estimatedCost;
        session.totalSaved += savings;
        session.totalTokens += tokens;
        session.requests += 1;
        session.breakdown.push({
            taskType,
            model: selection.model,
            cost: estimatedCost,
            saved: savings,
            tokens,
            timestamp: new Date().toISOString(),
        });
    }

    res.json({
        selected: {
            model: selection.model,
            provider: selection.provider,
            quality: selection.quality,
            latencyMs: selection.latencyMs,
        },
        cost: {
            estimated: `$${estimatedCost.toFixed(6)}`,
            wouldHaveCost: `$${maxCost.toFixed(6)}`,
            saved: `$${savings.toFixed(6)}`,
            savingsPercent: `${savingsPercent}%`,
        },
        routing: {
            taskType,
            qualityThreshold: TASK_QUALITY_THRESHOLDS[taskType] || 0.70,
            alternativesConsidered: selection.alternativesConsidered || 0,
            fallback: selection.fallback || false,
        },
        receipt: {
            id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            reasoning: selection.fallback
                ? `No model met constraints; fell back to highest quality (${selection.model})`
                : `Selected ${selection.model} (quality: ${selection.quality}) — cheapest model meeting ${taskType} threshold of ${TASK_QUALITY_THRESHOLDS[taskType] || 0.70}. Saved ${savingsPercent}% vs premium.`,
        },
    });
});

/**
 * GET /budget/models
 * List all available models with cost/quality data
 */
router.get('/models', (_req, res) => {
    const models = Object.entries(MODEL_COSTS).map(([name, data]) => ({
        model: name,
        ...data,
        costPer1kTokens: `$${(data.input + data.output).toFixed(4)}`,
        tier: data.input === 0 ? 'free-local' : (data.input + data.output) < 0.005 ? 'mid-tier' : 'premium',
    }));

    res.json({
        models,
        tiers: {
            'free-local': models.filter(m => m.tier === 'free-local').length,
            'mid-tier': models.filter(m => m.tier === 'mid-tier').length,
            'premium': models.filter(m => m.tier === 'premium').length,
        },
        thresholds: TASK_QUALITY_THRESHOLDS,
    });
});

/**
 * GET /budget/session/:sessionId
 * Get cost breakdown for a session
 */
router.get('/session/:sessionId', (req, res) => {
    const session = sessionCosts.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
        sessionId: req.params.sessionId,
        summary: {
            totalCost: `$${session.totalCost.toFixed(6)}`,
            totalSaved: `$${session.totalSaved.toFixed(6)}`,
            totalTokens: session.totalTokens,
            requests: session.requests,
            avgCostPerRequest: `$${(session.totalCost / session.requests).toFixed(6)}`,
            savingsRate: `${((session.totalSaved / (session.totalCost + session.totalSaved)) * 100).toFixed(1)}%`,
        },
        breakdown: session.breakdown,
    });
});

/**
 * GET /budget/health
 */
router.get('/health', (_req, res) => {
    res.json({
        status: 'online',
        service: 'budget-router',
        models: Object.keys(MODEL_COSTS).length,
        taskTypes: Object.keys(TASK_QUALITY_THRESHOLDS).length,
        activeSessions: sessionCosts.size,
    });
});

module.exports = router;

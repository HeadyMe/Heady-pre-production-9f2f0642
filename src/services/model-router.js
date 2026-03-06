/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Multi-Model Routing Matrix — Dynamic LLM Provider Selection
 *
 * Routes AI tasks to the optimal provider/model based on task type.
 * Ensures every micro-agent in the Swarm is armed with the most
 * optimized brain for its specific task.
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 */

const crypto = require('crypto');
const logger = require('../utils/logger').child('model-router');

// ═══════════════════════════════════════════════════════════════
// Routing Matrix — maps task categories to optimal AI providers
// ═══════════════════════════════════════════════════════════════

const ROUTING_MATRIX = {
    'code-refactor': {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        reason: 'Massive context window + structural code generation',
        fallback: { provider: 'google', model: 'gemini-2.5-pro' },
    },
    'code-review': {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        reason: 'Deep structural analysis of code diffs',
        fallback: { provider: 'openai', model: 'gpt-4o' },
    },
    'orchestration': {
        provider: 'google',
        model: 'gemini-2.5-pro',
        reason: 'Complex multi-step reasoning + native gcloud integration',
        fallback: { provider: 'claude', model: 'claude-sonnet-4-20250514' },
    },
    'market-data': {
        provider: 'perplexity',
        model: 'sonar-pro',
        reason: 'Real-time internet-grounded market sentiment and factual synthesis',
        fallback: { provider: 'google', model: 'gemini-2.5-flash' },
    },
    'rapid-test': {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        reason: 'Zero-latency parallel testing at minimal cost',
        fallback: { provider: 'google', model: 'gemini-2.5-flash' },
    },
    'embedding': {
        provider: 'google',
        model: 'text-embedding-004',
        reason: 'High-dimensional vectorization (768d)',
        fallback: { provider: 'openai', model: 'text-embedding-3-large' },
    },
    'research': {
        provider: 'perplexity',
        model: 'sonar-pro',
        reason: 'Grounded web research with citations',
        fallback: { provider: 'google', model: 'gemini-2.5-pro' },
    },
    'creative': {
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
        reason: 'Rich creative generation with nuanced style',
        fallback: { provider: 'openai', model: 'gpt-4o' },
    },
    'vision': {
        provider: 'google',
        model: 'gemini-2.5-flash',
        reason: 'Native multimodal vision with fast inference',
        fallback: { provider: 'openai', model: 'gpt-4o' },
    },
};

// ═══════════════════════════════════════════════════════════════
// Routing Statistics
// ═══════════════════════════════════════════════════════════════

const _routingStats = {
    totalRouted: 0,
    byProvider: {},
    byTask: {},
    failoverCount: 0,
};

// ═══════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Route a task to the optimal AI provider/model.
 *
 * @param {string} taskType - Category of the task (must match ROUTING_MATRIX key)
 * @param {Object} options  - { useFallback, contextSize, urgency }
 * @returns {Object} Routing decision with provider, model, and rationale
 */
function routeTask(taskType, options = {}) {
    const { useFallback = false, contextSize, urgency } = options;

    const route = ROUTING_MATRIX[taskType];
    if (!route) {
        // Default fallback to a versatile model
        logger.warn(`No route for task type '${taskType}', using default`);
        return {
            taskType,
            provider: 'google',
            model: 'gemini-2.5-flash',
            reason: 'Default fallback — no specific route configured',
            isFallback: true,
            routedAt: new Date().toISOString(),
        };
    }

    const target = useFallback && route.fallback ? route.fallback : route;

    // Track stats
    _routingStats.totalRouted++;
    _routingStats.byProvider[target.provider] = (_routingStats.byProvider[target.provider] || 0) + 1;
    _routingStats.byTask[taskType] = (_routingStats.byTask[taskType] || 0) + 1;
    if (useFallback) _routingStats.failoverCount++;

    const decision = {
        taskType,
        provider: target.provider,
        model: target.model,
        reason: target.reason || route.reason,
        isFallback: useFallback,
        routedAt: new Date().toISOString(),
        decisionHash: crypto.createHash('sha256')
            .update(`${taskType}:${target.provider}:${target.model}:${Date.now()}`)
            .digest('hex')
            .slice(0, 16),
    };

    logger.info(`Routed '${taskType}' → ${target.provider}/${target.model}`);
    return decision;
}

/**
 * Get routing statistics.
 */
function getRoutingStats() {
    return {
        ..._routingStats,
        availableRoutes: Object.keys(ROUTING_MATRIX).length,
        providers: [...new Set(Object.values(ROUTING_MATRIX).map(r => r.provider))],
    };
}

/**
 * Get the full routing matrix.
 */
function getRoutingMatrix() {
    return Object.entries(ROUTING_MATRIX).map(([taskType, route]) => ({
        taskType,
        provider: route.provider,
        model: route.model,
        reason: route.reason,
        fallback: route.fallback ? `${route.fallback.provider}/${route.fallback.model}` : null,
    }));
}

/**
 * Add or update a routing entry.
 */
function setRoute(taskType, config) {
    if (!taskType || !config.provider || !config.model) {
        return { success: false, error: 'taskType, provider, and model are required' };
    }
    ROUTING_MATRIX[taskType] = config;
    return { success: true, taskType, route: config };
}

// ═══════════════════════════════════════════════════════════════
// Express API Routes
// ═══════════════════════════════════════════════════════════════

function modelRouterRoutes(app) {
    // Route a task to optimal provider
    app.post('/api/ai/route', (req, res) => {
        const { taskType, useFallback, contextSize, urgency } = req.body;
        if (!taskType) return res.status(400).json({ error: 'taskType is required' });
        const decision = routeTask(taskType, { useFallback, contextSize, urgency });
        res.json({ ok: true, decision });
    });

    // Get the routing matrix
    app.get('/api/ai/matrix', (_req, res) => {
        res.json({ ok: true, matrix: getRoutingMatrix() });
    });

    // Get routing stats
    app.get('/api/ai/stats', (_req, res) => {
        res.json({ ok: true, stats: getRoutingStats() });
    });

    // Update a route
    app.put('/api/ai/route/:taskType', (req, res) => {
        const result = setRoute(req.params.taskType, req.body);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    });
}

module.exports = {
    routeTask,
    getRoutingStats,
    getRoutingMatrix,
    setRoute,
    modelRouterRoutes,
    ROUTING_MATRIX,
};

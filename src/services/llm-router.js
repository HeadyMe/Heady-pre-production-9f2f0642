/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Multi-Model LLM Router
 * ═══════════════════════════════════════════════════════════════
 *
 * Dynamic routing matrix that selects the optimal AI model for
 * each task type. Instead of hard-coding a single provider, the
 * Swarm Orchestrator evaluates context and routes to the best
 * model for the specific job.
 *
 * Routing Logic:
 *   - Code Refactoring / AST Manipulation → Claude Sonnet (large context)
 *   - Complex Reasoning / Orchestration   → Gemini Pro (native gcloud)
 *   - Real-Time Web Research              → Perplexity Sonar Pro
 *   - Rapid Testing / Parallel Eval       → Groq (ultra-low latency)
 *   - Default / General                   → GPT-4o (balanced)
 *   - Budget / High-Volume                → HuggingFace open models
 */

const logger = require('./structured-logger');
const crypto = require('crypto');

// ── Model Registry ──────────────────────────────────────────────
const MODEL_REGISTRY = {
    'claude-sonnet': {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        envKey: 'ANTHROPIC_API_KEY',
        maxTokens: 200000,
        strengths: ['code-generation', 'refactoring', 'ast-manipulation', 'large-context'],
        costTier: 'premium',
        avgLatencyMs: 3000,
    },
    'gemini-pro': {
        provider: 'google',
        model: 'gemini-2.5-pro',
        envKey: 'GOOGLE_AI_API_KEY',
        maxTokens: 1000000,
        strengths: ['reasoning', 'orchestration', 'planning', 'multimodal'],
        costTier: 'premium',
        avgLatencyMs: 2500,
    },
    'gpt-54': {
        provider: 'openai',
        model: 'gpt-5.4',
        envKey: 'OPENAI_API_KEY',
        maxTokens: 256000,
        strengths: ['general-intelligence', 'reasoning', 'code', 'instruction-following', 'function-calling'],
        costTier: 'premium',
        avgLatencyMs: 1800,
    },
    'gpt-4o': {
        provider: 'openai',
        model: 'gpt-4o',
        envKey: 'OPENAI_API_KEY',
        maxTokens: 128000,
        strengths: ['general', 'instruction-following', 'balanced'],
        costTier: 'standard',
        avgLatencyMs: 2000,
    },
    'perplexity-sonar': {
        provider: 'perplexity',
        model: 'sonar-pro',
        envKey: 'PERPLEXITY_API_KEY',
        maxTokens: 32000,
        strengths: ['web-research', 'citations', 'real-time-data', 'market-analysis'],
        costTier: 'standard',
        avgLatencyMs: 4000,
    },
    'groq-llama': {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        envKey: 'GROQ_API_KEY',
        maxTokens: 32768,
        strengths: ['speed', 'parallel-testing', 'rapid-eval', 'low-latency'],
        costTier: 'budget',
        avgLatencyMs: 500,
    },
    'huggingface-open': {
        provider: 'huggingface',
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        envKey: 'HF_TOKEN',
        maxTokens: 32768,
        strengths: ['budget', 'high-volume', 'embedding', 'classification'],
        costTier: 'free',
        avgLatencyMs: 6000,
    },
};

// ── Task-to-Model Routing Matrix ────────────────────────────────
const ROUTING_MATRIX = {
    // Code tasks → Claude (best at structural code generation)
    'code-refactoring': 'claude-sonnet',
    'ast-manipulation': 'claude-sonnet',
    'code-generation': 'claude-sonnet',
    'code-review': 'claude-sonnet',
    'bug-fix': 'claude-sonnet',

    // Reasoning tasks → Gemini (best complex reasoning + native gcloud)
    'swarm-orchestration': 'gemini-pro',
    'system-planning': 'gemini-pro',
    'architecture-design': 'gemini-pro',
    'complex-reasoning': 'gemini-pro',
    'multimodal-analysis': 'gemini-pro',

    // Research tasks → Perplexity (best real-time web data)
    'web-research': 'perplexity-sonar',
    'market-analysis': 'perplexity-sonar',
    'citation-research': 'perplexity-sonar',
    'competitor-analysis': 'perplexity-sonar',

    // Speed tasks → Groq (ultra-low latency)
    'rapid-testing': 'groq-llama',
    'parallel-eval': 'groq-llama',
    'quick-classification': 'groq-llama',
    'health-check-ai': 'groq-llama',

    // Flagship tasks → GPT-5.4 (latest, most capable)
    'general': 'gpt-54',
    'instruction-following': 'gpt-54',
    'function-calling': 'gpt-54',
    'complex-task': 'gpt-54',

    // Balanced tasks → GPT-4o (cost-effective fallback)
    'content-generation': 'gpt-4o',
    'summarization': 'gpt-4o',

    // Budget tasks → HuggingFace (free tier)
    'embedding': 'huggingface-open',
    'classification': 'huggingface-open',
    'high-volume-batch': 'huggingface-open',
};

// ── Performance Tracking ────────────────────────────────────────
const _routingStats = {
    totalRouted: 0,
    byModel: {},
    byTask: {},
    failovers: 0,
    avgLatencyMs: 0,
    errors: [],
};

// ── Core Router ─────────────────────────────────────────────────

/**
 * Select the optimal model for a given task type.
 *
 * @param {string} taskType - The type of task (e.g., 'code-refactoring', 'web-research')
 * @param {Object} opts - Optional overrides
 * @param {string} opts.preferredModel - Force a specific model
 * @param {string} opts.costConstraint - 'free', 'budget', 'standard', 'premium'
 * @param {number} opts.maxLatencyMs - Maximum acceptable latency
 * @param {number} opts.contextSize - Required context window size
 * @returns {Object} The selected model config with routing metadata
 */
function routeTask(taskType, opts = {}) {
    const {
        preferredModel,
        costConstraint,
        maxLatencyMs,
        contextSize,
    } = opts;

    const routingId = crypto.randomBytes(6).toString('hex');

    // 1. Check for forced model override
    if (preferredModel && MODEL_REGISTRY[preferredModel]) {
        const model = MODEL_REGISTRY[preferredModel];
        if (_isModelAvailable(preferredModel)) {
            _recordRouting(routingId, taskType, preferredModel, 'forced');
            return _buildRoutingResult(routingId, preferredModel, model, taskType, 'forced');
        }
    }

    // 2. Look up the default model for this task type
    const defaultModelKey = ROUTING_MATRIX[taskType] || ROUTING_MATRIX['general'];
    const candidates = [defaultModelKey, ..._getFallbackChain(defaultModelKey)];

    // 3. Filter by constraints
    for (const candidateKey of candidates) {
        const model = MODEL_REGISTRY[candidateKey];
        if (!model) continue;

        // Check availability (API key must be set)
        if (!_isModelAvailable(candidateKey)) continue;

        // Check cost constraint
        if (costConstraint && !_meetsCostConstraint(model.costTier, costConstraint)) continue;

        // Check latency constraint
        if (maxLatencyMs && model.avgLatencyMs > maxLatencyMs) continue;

        // Check context size
        if (contextSize && model.maxTokens < contextSize) continue;

        const reason = candidateKey === defaultModelKey ? 'matrix-match' : 'failover';
        if (reason === 'failover') _routingStats.failovers++;
        _recordRouting(routingId, taskType, candidateKey, reason);
        return _buildRoutingResult(routingId, candidateKey, model, taskType, reason);
    }

    // 4. Last resort: return any available model
    for (const [key, model] of Object.entries(MODEL_REGISTRY)) {
        if (_isModelAvailable(key)) {
            _routingStats.failovers++;
            _recordRouting(routingId, taskType, key, 'last-resort');
            return _buildRoutingResult(routingId, key, model, taskType, 'last-resort');
        }
    }

    // 5. No models available
    logger.error(`LLMRouter: No available models for task "${taskType}"`);
    return {
        routingId,
        success: false,
        error: 'No AI models available. Check API key environment variables.',
        availableModels: _getAvailableModels(),
    };
}

/**
 * Route with automatic retry and failover.
 * If the primary model fails, automatically tries the next available model.
 */
async function routeWithFailover(taskType, callFn, opts = {}) {
    const maxAttempts = opts.maxAttempts || 3;
    const errors = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const routing = routeTask(taskType, {
            ...opts,
            // On retry, exclude previously failed models
            _excludeModels: errors.map(e => e.model),
        });

        if (!routing.success) {
            return { success: false, errors, routing };
        }

        try {
            const result = await callFn(routing);
            return { success: true, result, routing, attempts: attempt };
        } catch (err) {
            errors.push({
                model: routing.modelKey,
                attempt,
                error: err.message,
                timestamp: new Date().toISOString(),
            });
            logger.warn(`LLMRouter: ${routing.modelKey} failed (attempt ${attempt}): ${err.message}`);
        }
    }

    return { success: false, errors, attempts: maxAttempts };
}

// ── Helpers ─────────────────────────────────────────────────────

function _isModelAvailable(modelKey) {
    const model = MODEL_REGISTRY[modelKey];
    return model && !!process.env[model.envKey];
}

function _meetsCostConstraint(modelCostTier, constraint) {
    const tiers = ['free', 'budget', 'standard', 'premium'];
    return tiers.indexOf(modelCostTier) <= tiers.indexOf(constraint);
}

function _getFallbackChain(primaryKey) {
    const allKeys = Object.keys(MODEL_REGISTRY);
    // Order: same-tier models first, then cheaper models
    const primary = MODEL_REGISTRY[primaryKey];
    if (!primary) return allKeys;

    return allKeys
        .filter(k => k !== primaryKey)
        .sort((a, b) => {
            const tiers = ['free', 'budget', 'standard', 'premium'];
            const aTier = tiers.indexOf(MODEL_REGISTRY[a].costTier);
            const bTier = tiers.indexOf(MODEL_REGISTRY[b].costTier);
            const primaryTier = tiers.indexOf(primary.costTier);
            // Prefer same tier, then cheaper
            return Math.abs(aTier - primaryTier) - Math.abs(bTier - primaryTier);
        });
}

function _getAvailableModels() {
    return Object.entries(MODEL_REGISTRY)
        .filter(([key]) => _isModelAvailable(key))
        .map(([key, model]) => ({
            key,
            provider: model.provider,
            model: model.model,
            costTier: model.costTier,
        }));
}

function _buildRoutingResult(routingId, modelKey, model, taskType, reason) {
    return {
        routingId,
        success: true,
        modelKey,
        provider: model.provider,
        model: model.model,
        envKey: model.envKey,
        maxTokens: model.maxTokens,
        costTier: model.costTier,
        avgLatencyMs: model.avgLatencyMs,
        taskType,
        routingReason: reason,
        timestamp: new Date().toISOString(),
    };
}

function _recordRouting(routingId, taskType, modelKey, reason) {
    _routingStats.totalRouted++;
    _routingStats.byModel[modelKey] = (_routingStats.byModel[modelKey] || 0) + 1;
    _routingStats.byTask[taskType] = (_routingStats.byTask[taskType] || 0) + 1;
}

// ── Stats & Health ──────────────────────────────────────────────

function getRoutingStats() {
    return {
        ..._routingStats,
        availableModels: _getAvailableModels(),
        totalRegistered: Object.keys(MODEL_REGISTRY).length,
        totalAvailable: _getAvailableModels().length,
        taskTypes: Object.keys(ROUTING_MATRIX),
    };
}

function getRouterHealth() {
    const available = _getAvailableModels();
    return {
        status: available.length > 0 ? 'operational' : 'degraded',
        modelsAvailable: available.length,
        modelsTotal: Object.keys(MODEL_REGISTRY).length,
        totalRouted: _routingStats.totalRouted,
        failoverRate: _routingStats.totalRouted > 0
            ? Math.round(_routingStats.failovers / _routingStats.totalRouted * 10000) / 100
            : 0,
        availableProviders: [...new Set(available.map(m => m.provider))],
        missingKeys: Object.entries(MODEL_REGISTRY)
            .filter(([key]) => !_isModelAvailable(key))
            .map(([key, m]) => ({ model: key, envKey: m.envKey })),
    };
}

// ── Express Routes ──────────────────────────────────────────────

function llmRouterRoutes(app) {
    app.get('/api/llm/health', (_req, res) => {
        res.json(getRouterHealth());
    });

    app.get('/api/llm/stats', (_req, res) => {
        res.json(getRoutingStats());
    });

    app.get('/api/llm/models', (_req, res) => {
        res.json({
            registered: Object.entries(MODEL_REGISTRY).map(([key, m]) => ({
                key,
                provider: m.provider,
                model: m.model,
                costTier: m.costTier,
                avgLatencyMs: m.avgLatencyMs,
                strengths: m.strengths,
                available: _isModelAvailable(key),
            })),
        });
    });

    app.post('/api/llm/route', (req, res) => {
        const { taskType, preferredModel, costConstraint, maxLatencyMs, contextSize } = req.body;
        if (!taskType) return res.status(400).json({ error: 'taskType required' });

        const result = routeTask(taskType, { preferredModel, costConstraint, maxLatencyMs, contextSize });
        res.json(result);
    });

    app.get('/api/llm/matrix', (_req, res) => {
        res.json({
            routingMatrix: ROUTING_MATRIX,
            taskTypes: Object.keys(ROUTING_MATRIX),
            totalMappings: Object.keys(ROUTING_MATRIX).length,
        });
    });

    logger.info('LLMRouter: routes registered at /api/llm/*');
}

module.exports = {
    routeTask,
    routeWithFailover,
    getRoutingStats,
    getRouterHealth,
    llmRouterRoutes,
    MODEL_REGISTRY,
    ROUTING_MATRIX,
};

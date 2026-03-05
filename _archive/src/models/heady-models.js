/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * Heady Models Registry — Branded AI Model Lineup
 * 
 * Each model maps to a specific arena configuration
 * controlling which nodes compete, timeouts, and scoring weights.
 * 
 * OpenAI-compatible: use model names in POST /api/v1/chat/completions
 * 
 * Backed by (March 2026 frontier):
 *   - Gemini 3.1 Pro Preview (1M ctx, 65K output, DeepThink)
 *   - Claude Opus 4.6 (200K ctx)
 *   - Claude Sonnet 4.6 (200K ctx)
 *   - GPT-5.3 Instant (128K ctx)
 *   - GPT-5.4 (1M–2M ctx, extreme reasoning) — PENDING RELEASE
 *   - DeepSeek V3.2 Speciale (131K ctx)
 *   - Gemini 3 Flash (1M ctx, speed-optimized)
 */

const HEADY_MODELS = {
    'heady-battle-v1': {
        id: 'heady-battle-v1',
        name: 'Heady Battle v1',
        description: 'Full 20-node arena competition. Gemini 3.1 Pro + Claude Opus 4.6 + GPT-5.x compete at million-token scale. Highest quality, arena-validated.',
        tier: 'premium',
        context_window: 1048576,  // 1M tokens (Gemini 3.1 Pro)
        max_output: 65536,        // 65K output (Gemini 3.1 Pro max)
        backed_by: ['gemini-3.1-pro-preview', 'claude-opus-4.6', 'gpt-5.3-instant', 'deepseek-v3.2-speciale'],
        pending_models: ['gpt-5.4'],  // Auto-add when released
        pricing: {
            input_per_1k: 0.015,
            output_per_1k: 0.060,
            currency: 'USD',
        },
        arena: {
            nodes: 'all',
            min_competitors: 5,
            max_timeout_ms: 15000,
            scoring: { quality: 0.5, speed: 0.15, relevance: 0.25, creativity: 0.1 },
        },
        capabilities: ['chat', 'code', 'analysis', 'creative', 'reasoning', 'vision', 'deep-think'],
        badge: '🏆 ARENA CHAMPION',
    },

    'heady-flash': {
        id: 'heady-flash',
        name: 'Heady Flash',
        description: 'Ultra-fast responses from the 3 fastest nodes. Gemini 3 Flash + Groq at the speed tier.',
        tier: 'free',
        context_window: 1048576,  // 1M tokens (Gemini 3 Flash)
        max_output: 8192,
        backed_by: ['gemini-3-flash', 'groq-llama-3.3-70b'],
        pricing: {
            input_per_1k: 0.0001,
            output_per_1k: 0.0004,
            currency: 'USD',
        },
        arena: {
            nodes: ['HeadyFast', 'HeadyEdge', 'HeadyCompute'],
            min_competitors: 1,
            max_timeout_ms: 3000,
            scoring: { quality: 0.3, speed: 0.5, relevance: 0.15, creativity: 0.05 },
        },
        capabilities: ['chat', 'code', 'autocomplete'],
        badge: '⚡ LIGHTNING',
    },

    'heady-reason': {
        id: 'heady-reason',
        name: 'Heady Reason',
        description: 'Extended thinking mode. Claude Opus 4.6 + Gemini 3.1 Pro DeepThink collaborate on complex reasoning chains.',
        tier: 'premium',
        context_window: 1048576,  // 1M tokens (Gemini 3.1 Pro DeepThink)
        max_output: 65536,        // 65K output
        backed_by: ['claude-opus-4.6', 'gemini-3.1-pro-preview'],
        pending_models: ['gpt-5.4'],  // Extreme reasoning mode
        pricing: {
            input_per_1k: 0.010,
            output_per_1k: 0.040,
            currency: 'USD',
        },
        arena: {
            nodes: ['HeadyJules', 'HeadyPythia', 'HeadyVinci', 'HeadyDecomp'],
            min_competitors: 2,
            max_timeout_ms: 30000,
            scoring: { quality: 0.4, speed: 0.05, relevance: 0.25, creativity: 0.3 },
            thinking_budget: 65536,
        },
        capabilities: ['chat', 'code', 'analysis', 'reasoning', 'planning', 'math', 'deep-think'],
        badge: '🧠 DEEP THINKER',
    },

    'heady-edge': {
        id: 'heady-edge',
        name: 'Heady Edge',
        description: 'Cloudflare Workers AI inference. Sub-200ms latency, runs at the edge nearest to the user.',
        tier: 'free',
        context_window: 32768,   // Workers AI Llama 3.3
        max_output: 4096,
        backed_by: ['workers-ai-llama-3.3-8b', 'workers-ai-mistral-7b'],
        pricing: {
            input_per_1k: 0.00005,
            output_per_1k: 0.0002,
            currency: 'USD',
        },
        arena: {
            nodes: ['HeadyEdge'],
            min_competitors: 1,
            max_timeout_ms: 1000,
            scoring: { quality: 0.2, speed: 0.7, relevance: 0.1, creativity: 0.0 },
        },
        capabilities: ['chat', 'autocomplete', 'classify', 'embed'],
        badge: '🌐 EDGE NATIVE',
    },

    'heady-buddy': {
        id: 'heady-buddy',
        name: 'Heady Buddy',
        description: 'Conversational AI with persistent memory. Claude Sonnet 4.6 with session awareness.',
        tier: 'pro',
        context_window: 200000,  // 200K tokens (Claude Sonnet 4.6)
        max_output: 8192,
        backed_by: ['claude-sonnet-4.6', 'gpt-5.3-instant'],
        pricing: {
            input_per_1k: 0.003,
            output_per_1k: 0.012,
            currency: 'USD',
        },
        arena: {
            nodes: ['HeadyBuddy', 'HeadyPythia', 'HeadyCompute', 'HeadySoul'],
            min_competitors: 2,
            max_timeout_ms: 8000,
            scoring: { quality: 0.35, speed: 0.2, relevance: 0.3, creativity: 0.15 },
            memory_enabled: true,
        },
        capabilities: ['chat', 'memory', 'tasks', 'assistant', 'personalization'],
        badge: '🤝 COMPANION',
    },
};

// ── GPT-5.4 Readiness ────────────────────────────────────────────────
// When GPT-5.4 releases, add it to backed_by for battle + reason models,
// remove from pending_models, and update context_window if > 1M.
const GPT54_CONFIG = {
    id: 'gpt-5.4',
    expected_context: 2097152,  // 2M tokens (rumored)
    expected_capabilities: ['extreme-reasoning', 'deep-think', 'vision', 'code'],
    target_heady_models: ['heady-battle-v1', 'heady-reason'],
    status: 'pending-release',  // Change to 'active' when available
};

// ── Fine-Tuning Pricing ──────────────────────────────────────────────
const FINE_TUNE_PRICING = {
    'heady-flash': {
        training_per_hour: 8.00,      // $/hr
        hosting_per_hour: 0.50,       // $/hr for serving the custom model
        min_examples: 100,
        max_examples: 100000,
        estimated_time_per_1k: 15,    // minutes per 1K training examples
        currency: 'USD',
    },
    'heady-buddy': {
        training_per_hour: 15.00,
        hosting_per_hour: 1.00,
        min_examples: 200,
        max_examples: 50000,
        estimated_time_per_1k: 25,
        currency: 'USD',
    },
    'heady-battle-v1': {
        training_per_hour: 25.00,
        hosting_per_hour: 2.50,
        min_examples: 500,
        max_examples: 25000,
        estimated_time_per_1k: 40,
        currency: 'USD',
    },
};

// ── API Functions ────────────────────────────────────────────────────

/**
 * List all available models with metadata
 */
function listModels() {
    return Object.values(HEADY_MODELS).map(m => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'heady-systems',
        permission: [],
        root: m.id,
        parent: null,
        // Heady extensions
        tier: m.tier,
        badge: m.badge,
        description: m.description,
        context_window: m.context_window,
        max_output: m.max_output,
        pricing: m.pricing,
        capabilities: m.capabilities,
    }));
}

/**
 * Get a specific model config by name
 * Falls back to heady-flash if not found
 */
function getModelConfig(name) {
    return HEADY_MODELS[name] || HEADY_MODELS['heady-flash'];
}

/**
 * Get fine-tuning pricing for a model
 */
function getFineTunePricing(modelId) {
    return FINE_TUNE_PRICING[modelId] || null;
}

/**
 * Check if a model requires premium access
 */
function isPremium(modelId) {
    const model = HEADY_MODELS[modelId];
    return model ? model.tier === 'premium' || model.tier === 'pro' : false;
}

/**
 * Get the arena config for a model (which nodes compete, scoring, etc.)
 */
function getArenaConfig(modelId) {
    const model = HEADY_MODELS[modelId];
    return model ? model.arena : HEADY_MODELS['heady-flash'].arena;
}

module.exports = {
    HEADY_MODELS,
    GPT54_CONFIG,
    FINE_TUNE_PRICING,
    listModels,
    getModelConfig,
    getFineTunePricing,
    isPremium,
    getArenaConfig,
};

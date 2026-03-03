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
 */

const HEADY_MODELS = {
    'heady-battle-v1': {
        id: 'heady-battle-v1',
        name: 'Heady Battle v1',
        description: 'Full 20-node arena competition. Every node competes, best response wins. Highest quality, arena-validated.',
        tier: 'premium',
        context_window: 128000,
        max_output: 16384,
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
        capabilities: ['chat', 'code', 'analysis', 'creative', 'reasoning', 'vision'],
        badge: '🏆 ARENA CHAMPION',
    },

    'heady-flash': {
        id: 'heady-flash',
        name: 'Heady Flash',
        description: 'Ultra-fast responses from the 3 fastest nodes. Optimized for speed without sacrificing accuracy.',
        tier: 'free',
        context_window: 32000,
        max_output: 8192,
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
        description: 'Extended thinking mode. HeadyJules + HeadyPythia + HeadyVinci collaborate on complex reasoning chains.',
        tier: 'premium',
        context_window: 200000,
        max_output: 32768,
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
        capabilities: ['chat', 'code', 'analysis', 'reasoning', 'planning', 'math'],
        badge: '🧠 DEEP THINKER',
    },

    'heady-edge': {
        id: 'heady-edge',
        name: 'Heady Edge',
        description: 'Cloudflare Workers AI inference. Sub-200ms latency, runs at the edge nearest to the user.',
        tier: 'free',
        context_window: 8192,
        max_output: 4096,
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
        description: 'Conversational AI with persistent memory. Remembers context across sessions, learns your preferences.',
        tier: 'pro',
        context_window: 64000,
        max_output: 8192,
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
    FINE_TUNE_PRICING,
    listModels,
    getModelConfig,
    getFineTunePricing,
    isPremium,
    getArenaConfig,
};

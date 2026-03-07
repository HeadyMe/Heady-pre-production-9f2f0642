/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const logger = require('../../utils/logger');

// ─── Enumerations ─────────────────────────────────────────────────────────────

const PROVIDERS = Object.freeze({
  ANTHROPIC:  'anthropic',
  OPENAI:     'openai',
  GOOGLE:     'google',
  GROQ:       'groq',
  PERPLEXITY: 'perplexity',
  CLOUDFLARE: 'cloudflare',
  OLLAMA:     'ollama',
});

const CAPABILITIES = Object.freeze({
  TEXT_GENERATION:  'text-generation',
  CODE_GENERATION:  'code-generation',
  FUNCTION_CALLING: 'function-calling',
  VISION:           'vision',
  REASONING:        'reasoning',
  LONG_CONTEXT:     'long-context',
  STREAMING:        'streaming',
  JSON_MODE:        'json-mode',
  EMBEDDINGS:       'embeddings',
  REAL_TIME_DATA:   'real-time-data',
  EDGE_INFERENCE:   'edge-inference',
  LOCAL_INFERENCE:  'local-inference',
});

const COST_TIERS = Object.freeze({
  FREE:       'free',
  ECONOMY:    'economy',    // < $0.50 / 1M tokens
  STANDARD:   'standard',   // $0.50 – $5 / 1M tokens
  PREMIUM:    'premium',    // $5 – $20 / 1M tokens
  ULTRA:      'ultra',      // > $20 / 1M tokens
});

// ─── Model catalog ────────────────────────────────────────────────────────────

const CATALOG = [
  // ── Anthropic ──
  {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: PROVIDERS.ANTHROPIC,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.STANDARD,
    contextWindow: 200_000,
    outputWindow: 8_192,
    inputCostPer1MTokens: 3.00,
    outputCostPer1MTokens: 15.00,
    strengths: ['coding', 'reasoning', 'instruction-following', 'vision', 'balanced-quality-cost'],
    latencyProfile: 'medium',
    available: true,
  },
  {
    id: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: PROVIDERS.ANTHROPIC,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.ULTRA,
    contextWindow: 200_000,
    outputWindow: 4_096,
    inputCostPer1MTokens: 15.00,
    outputCostPer1MTokens: 75.00,
    strengths: ['complex-reasoning', 'nuanced-writing', 'research', 'analysis'],
    latencyProfile: 'slow',
    available: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    provider: PROVIDERS.ANTHROPIC,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.ECONOMY,
    contextWindow: 200_000,
    outputWindow: 4_096,
    inputCostPer1MTokens: 0.25,
    outputCostPer1MTokens: 1.25,
    strengths: ['speed', 'cost-efficiency', 'simple-tasks', 'classification'],
    latencyProfile: 'fast',
    available: true,
  },

  // ── OpenAI ──
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: PROVIDERS.OPENAI,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.STANDARD,
    contextWindow: 128_000,
    outputWindow: 16_384,
    inputCostPer1MTokens: 2.50,
    outputCostPer1MTokens: 10.00,
    strengths: ['coding', 'multimodal', 'function-calling', 'instruction-following'],
    latencyProfile: 'medium',
    available: true,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o-mini',
    provider: PROVIDERS.OPENAI,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.ECONOMY,
    contextWindow: 128_000,
    outputWindow: 16_384,
    inputCostPer1MTokens: 0.15,
    outputCostPer1MTokens: 0.60,
    strengths: ['cost-efficiency', 'speed', 'simple-tasks', 'chat'],
    latencyProfile: 'fast',
    available: true,
  },
  {
    id: 'o1',
    displayName: 'OpenAI o1',
    provider: PROVIDERS.OPENAI,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.REASONING,
      CAPABILITIES.FUNCTION_CALLING,
    ],
    costTier: COST_TIERS.ULTRA,
    contextWindow: 200_000,
    outputWindow: 100_000,
    inputCostPer1MTokens: 15.00,
    outputCostPer1MTokens: 60.00,
    strengths: ['advanced-reasoning', 'math', 'science', 'complex-code'],
    latencyProfile: 'very-slow',
    available: true,
  },

  // ── Google ──
  {
    id: 'gemini-2.0-flash-001',
    displayName: 'Gemini 2.0 Flash',
    provider: PROVIDERS.GOOGLE,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
      CAPABILITIES.LONG_CONTEXT,
    ],
    costTier: COST_TIERS.ECONOMY,
    contextWindow: 1_048_576,
    outputWindow: 8_192,
    inputCostPer1MTokens: 0.075,
    outputCostPer1MTokens: 0.30,
    strengths: ['ultra-long-context', 'speed', 'multimodal', 'cost-efficiency'],
    latencyProfile: 'fast',
    available: true,
  },
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini Pro',
    provider: PROVIDERS.GOOGLE,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.VISION,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
      CAPABILITIES.LONG_CONTEXT,
    ],
    costTier: COST_TIERS.STANDARD,
    contextWindow: 2_097_152,
    outputWindow: 8_192,
    inputCostPer1MTokens: 1.25,
    outputCostPer1MTokens: 5.00,
    strengths: ['largest-context-window', 'document-analysis', 'research', 'multimodal'],
    latencyProfile: 'medium',
    available: true,
  },

  // ── Groq ──
  {
    id: 'llama-3.1-70b-versatile',
    displayName: 'Groq Llama 3.1 70B',
    provider: PROVIDERS.GROQ,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.ECONOMY,
    contextWindow: 131_072,
    outputWindow: 8_192,
    inputCostPer1MTokens: 0.59,
    outputCostPer1MTokens: 0.79,
    strengths: ['ultra-fast-inference', 'open-weights', 'cost-efficiency', 'coding'],
    latencyProfile: 'ultra-fast',
    available: true,
  },
  {
    id: 'mixtral-8x7b-32768',
    displayName: 'Groq Mixtral 8x7B',
    provider: PROVIDERS.GROQ,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.FUNCTION_CALLING,
      CAPABILITIES.STREAMING,
      CAPABILITIES.JSON_MODE,
    ],
    costTier: COST_TIERS.ECONOMY,
    contextWindow: 32_768,
    outputWindow: 4_096,
    inputCostPer1MTokens: 0.24,
    outputCostPer1MTokens: 0.24,
    strengths: ['ultra-fast-inference', 'multilingual', 'cost-efficiency'],
    latencyProfile: 'ultra-fast',
    available: true,
  },

  // ── Perplexity ──
  {
    id: 'llama-3.1-sonar-huge-128k-online',
    displayName: 'Perplexity Sonar Pro',
    provider: PROVIDERS.PERPLEXITY,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.REAL_TIME_DATA,
      CAPABILITIES.STREAMING,
    ],
    costTier: COST_TIERS.STANDARD,
    contextWindow: 127_072,
    outputWindow: 8_000,
    inputCostPer1MTokens: 5.00,
    outputCostPer1MTokens: 5.00,
    strengths: ['real-time-web-search', 'up-to-date-information', 'research', 'citations'],
    latencyProfile: 'medium',
    available: true,
  },

  // ── Cloudflare ──
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    displayName: 'Cloudflare Workers AI (Llama 3.1 8B)',
    provider: PROVIDERS.CLOUDFLARE,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.EDGE_INFERENCE,
      CAPABILITIES.STREAMING,
    ],
    costTier: COST_TIERS.FREE,
    contextWindow: 128_000,
    outputWindow: 4_096,
    inputCostPer1MTokens: 0,   // Free on Workers AI free tier
    outputCostPer1MTokens: 0,
    strengths: ['edge-inference', 'zero-latency-to-edge', 'privacy', 'cost-free-tier'],
    latencyProfile: 'fast',
    available: true,
  },

  // ── Ollama (local) ──
  {
    id: 'ollama:llama3.2',
    displayName: 'Local Ollama (Llama 3.2)',
    provider: PROVIDERS.OLLAMA,
    capabilities: [
      CAPABILITIES.TEXT_GENERATION,
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.LOCAL_INFERENCE,
      CAPABILITIES.STREAMING,
    ],
    costTier: COST_TIERS.FREE,
    contextWindow: 128_000,
    outputWindow: 4_096,
    inputCostPer1MTokens: 0,
    outputCostPer1MTokens: 0,
    strengths: ['privacy', 'offline', 'no-api-cost', 'customizable'],
    latencyProfile: 'variable',
    available: false,  // Availability checked at runtime
  },
  {
    id: 'ollama:codellama',
    displayName: 'Local Ollama (CodeLlama)',
    provider: PROVIDERS.OLLAMA,
    capabilities: [
      CAPABILITIES.CODE_GENERATION,
      CAPABILITIES.LOCAL_INFERENCE,
      CAPABILITIES.STREAMING,
    ],
    costTier: COST_TIERS.FREE,
    contextWindow: 16_384,
    outputWindow: 4_096,
    inputCostPer1MTokens: 0,
    outputCostPer1MTokens: 0,
    strengths: ['code-completion', 'privacy', 'offline'],
    latencyProfile: 'variable',
    available: false,
  },
];

// ─── Task-type → optimal model mapping ───────────────────────────────────────

const TASK_BEST_MODEL = {
  'code-generation':     'claude-3-5-sonnet-20241022',
  'code-review':         'claude-3-5-sonnet-20241022',
  'complex-reasoning':   'o1',
  'fast-chat':           'gpt-4o-mini',
  'chat':                'gpt-4o-mini',
  'creative-writing':    'claude-3-5-sonnet-20241022',
  'documentation':       'claude-3-haiku-20240307',
  'classification':      'claude-3-haiku-20240307',
  'summarization':       'gemini-2.0-flash-001',
  'long-document':       'gemini-1.5-pro',
  'real-time-research':  'llama-3.1-sonar-huge-128k-online',
  'structured-output':   'gpt-4o',
  'ultra-fast':          'llama-3.1-70b-versatile',
  'edge-inference':      '@cf/meta/llama-3.1-8b-instruct',
  'local-privacy':       'ollama:llama3.2',
  'math':                'o1',
  'science':             'o1',
  'multimodal':          'gpt-4o',
  'default':             'claude-3-5-sonnet-20241022',
};

// ─── ModelRegistry ────────────────────────────────────────────────────────────

class ModelRegistry {
  /**
   * @param {object} opts
   * @param {object[]} [opts.extraModels]    - Additional model records to merge
   * @param {object}   [opts.taskBestModel]  - Override task→model mappings
   */
  constructor(opts = {}) {
    this._models = new Map();
    this._taskMap = { ...TASK_BEST_MODEL, ...(opts.taskBestModel || {}) };

    for (const model of CATALOG) {
      this._models.set(model.id, { ...model });
    }

    if (opts.extraModels) {
      for (const model of opts.extraModels) {
        this._models.set(model.id, model);
      }
    }

    logger.info('[ModelRegistry] initialized', { modelCount: this._models.size });
  }

  // ─── Query ────────────────────────────────────────────────────────────────────

  /**
   * Get a model by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getModel(id) {
    return this._models.get(id) || null;
  }

  /**
   * Filter models by criteria.
   * @param {object} filter
   * @param {string|string[]}  [filter.capability]  - Must have capability
   * @param {string}           [filter.costTier]    - Exact tier
   * @param {string}           [filter.maxCostTier] - At most this tier
   * @param {string}           [filter.provider]    - Provider name
   * @param {boolean}          [filter.available]   - Only available models
   * @param {number}           [filter.minContextWindow] - Minimum context window
   * @param {string}           [filter.latencyProfile]   - Exact latency profile
   * @returns {object[]}
   */
  getModels(filter = {}) {
    const TIER_ORDER = [COST_TIERS.FREE, COST_TIERS.ECONOMY, COST_TIERS.STANDARD, COST_TIERS.PREMIUM, COST_TIERS.ULTRA];

    return [...this._models.values()].filter(model => {
      if (filter.available !== undefined && model.available !== filter.available) return false;
      if (filter.provider && model.provider !== filter.provider) return false;
      if (filter.costTier && model.costTier !== filter.costTier) return false;
      if (filter.maxCostTier) {
        const maxIdx  = TIER_ORDER.indexOf(filter.maxCostTier);
        const modelIdx = TIER_ORDER.indexOf(model.costTier);
        if (modelIdx > maxIdx) return false;
      }
      if (filter.minContextWindow && model.contextWindow < filter.minContextWindow) return false;
      if (filter.latencyProfile && model.latencyProfile !== filter.latencyProfile) return false;
      if (filter.capability) {
        const caps = Array.isArray(filter.capability) ? filter.capability : [filter.capability];
        if (!caps.every(c => model.capabilities.includes(c))) return false;
      }
      return true;
    });
  }

  /**
   * Get the best model for a given task type.
   * @param {string} taskType
   * @param {object} [constraints]  - { maxCostTier, provider, available }
   * @returns {object|null}
   */
  getBestModel(taskType, constraints = {}) {
    const bestId = this._taskMap[taskType] || this._taskMap['default'];
    const model = this._models.get(bestId);

    if (model && this._meetsConstraints(model, constraints)) {
      return model;
    }

    // Fallback: find any available model for the task type
    logger.debug('[ModelRegistry] preferred model not available, searching fallback', { taskType, bestId });

    const fallbackFilter = {
      available: constraints.available !== false ? true : undefined,
      maxCostTier: constraints.maxCostTier,
      provider: constraints.provider,
    };

    // Remove undefined keys
    Object.keys(fallbackFilter).forEach(k => fallbackFilter[k] === undefined && delete fallbackFilter[k]);

    const candidates = this.getModels(fallbackFilter);
    return candidates.find(m => m.capabilities.includes(CAPABILITIES.TEXT_GENERATION)) || null;
  }

  _meetsConstraints(model, constraints) {
    const TIER_ORDER = [COST_TIERS.FREE, COST_TIERS.ECONOMY, COST_TIERS.STANDARD, COST_TIERS.PREMIUM, COST_TIERS.ULTRA];
    if (constraints.available !== false && !model.available) return false;
    if (constraints.provider && model.provider !== constraints.provider) return false;
    if (constraints.maxCostTier) {
      const maxIdx = TIER_ORDER.indexOf(constraints.maxCostTier);
      if (TIER_ORDER.indexOf(model.costTier) > maxIdx) return false;
    }
    return true;
  }

  // ─── Registration ────────────────────────────────────────────────────────────

  /**
   * Register or update a model.
   * @param {object} model
   */
  registerModel(model) {
    if (!model.id) throw new Error('model.id is required');
    this._models.set(model.id, { ...model });
    logger.info('[ModelRegistry] model registered', { id: model.id, provider: model.provider });
    return this;
  }

  /**
   * Update model availability (e.g., after runtime probing).
   */
  setAvailability(id, available) {
    const model = this._models.get(id);
    if (!model) throw new Error(`Model not found: ${id}`);
    model.available = available;
    logger.debug('[ModelRegistry] availability updated', { id, available });
    return this;
  }

  /**
   * Register a task→model mapping.
   */
  setTaskModel(taskType, modelId) {
    if (!this._models.has(modelId)) {
      logger.warn('[ModelRegistry] setTaskModel: model not in registry', { modelId });
    }
    this._taskMap[taskType] = modelId;
    return this;
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────

  getSummary() {
    const all = [...this._models.values()];
    const byProvider = {};
    for (const m of all) {
      byProvider[m.provider] = (byProvider[m.provider] || 0) + 1;
    }
    return {
      total: all.length,
      available: all.filter(m => m.available).length,
      byProvider,
      taskMappings: { ...this._taskMap },
    };
  }

  listAll() {
    return [...this._models.values()];
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { ModelRegistry, PROVIDERS, CAPABILITIES, COST_TIERS, CATALOG, TASK_BEST_MODEL };

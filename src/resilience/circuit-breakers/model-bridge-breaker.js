/**
 * model-bridge-breaker.js
 * Circuit-breaker wrapper around the heady-model-bridge module.
 *
 * heady-model-bridge is the internal package that replaces:
 *   openai, @anthropic-ai/sdk, @google/genai, groq-sdk, @huggingface/inference
 *
 * Features
 * --------
 * - Intercepts all LLM API calls with per-provider + per-model breakers
 * - Automatic fallback chain: primary → secondary → tertiary → cached response
 * - Token budget enforcement per breaker window (rolling 1-minute window)
 * - Timeout enforcement (30 s default, configurable per provider)
 * - Retry with exponential backoff using phi ratio (1.618)
 * - Per-model and per-provider call/failure metrics
 *
 * @module enterprise-hardening/circuit-breaker/model-bridge-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, EnhancedCircuitBreaker, PHI, SERVICE_CONFIGS } = require('./external-api-breakers');

// ---------------------------------------------------------------------------
// Provider fallback chain
// ---------------------------------------------------------------------------
// Order encodes priority: index 0 = primary, 1 = secondary, 2 = tertiary
const PROVIDER_CHAIN = ['openai', 'anthropic', 'google-genai', 'groq', 'huggingface'];

/**
 * Default timeouts per provider (ms).
 * Overridden by SERVICE_CONFIGS[provider].timeoutMs when present.
 */
const PROVIDER_TIMEOUTS = {
  openai:       30_000,
  anthropic:    30_000,
  'google-genai': 30_000,
  groq:         20_000,
  huggingface:  60_000,
};

// ---------------------------------------------------------------------------
// Token budget — rolling 1-minute window per provider
// ---------------------------------------------------------------------------
const TOKEN_BUDGETS = {
  openai:        100_000,   // tokens per minute
  anthropic:     100_000,
  'google-genai': 60_000,
  groq:          200_000,
  huggingface:    50_000,
};

class TokenBudgetTracker {
  constructor() {
    // Map<provider, { windowStart: number, used: number }>
    this._windows = new Map();
  }

  /** Returns true when call is allowed; false when budget exceeded. */
  canSpend(provider, estimatedTokens) {
    const budget = TOKEN_BUDGETS[provider];
    if (!budget) return true;          // unknown provider: allow

    const now = Date.now();
    let w = this._windows.get(provider);
    if (!w || now - w.windowStart >= 60_000) {
      w = { windowStart: now, used: 0 };
      this._windows.set(provider, w);
    }

    return (w.used + estimatedTokens) <= budget;
  }

  record(provider, actualTokens) {
    const w = this._windows.get(provider);
    if (w) w.used += actualTokens;
  }

  remaining(provider) {
    const budget = TOKEN_BUDGETS[provider];
    if (!budget) return Infinity;
    const w = this._windows.get(provider);
    if (!w) return budget;
    const age = Date.now() - w.windowStart;
    if (age >= 60_000) return budget;
    return Math.max(0, budget - w.used);
  }

  snapshot() {
    const out = {};
    for (const [provider, w] of this._windows.entries()) {
      const budget = TOKEN_BUDGETS[provider] || 0;
      const age = Date.now() - w.windowStart;
      const windowRemaining = Math.max(0, 60_000 - age);
      out[provider] = {
        budget,
        used: w.used,
        remaining: Math.max(0, budget - w.used),
        windowResetMs: windowRemaining,
      };
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Per-model breaker map
// ---------------------------------------------------------------------------
class ModelBreakerMap {
  constructor() {
    // Map<"provider:model", EnhancedCircuitBreaker>
    this._map = new Map();
  }

  key(provider, model) {
    return `${provider}:${model || '_default'}`;
  }

  getOrCreate(provider, model) {
    const k = this.key(provider, model);
    if (!this._map.has(k)) {
      const cfg = SERVICE_CONFIGS[provider] || {
        failureThreshold: 5,
        recoveryTimeout: 30_000,
        halfOpenMaxCalls: 3,
        timeoutMs: 30_000,
      };
      const breaker = new EnhancedCircuitBreaker(`${k}`, cfg);
      this._map.set(k, breaker);
    }
    return this._map.get(k);
  }

  snapshot() {
    const out = {};
    for (const [k, b] of this._map.entries()) {
      out[k] = b.snapshot();
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Response cache — stores last successful response per cache key
// Used as ultimate fallback when all providers are OPEN
// ---------------------------------------------------------------------------
class ResponseCache {
  constructor(maxEntries = 500, ttlMs = 5 * 60_000) {
    this._cache = new Map();
    this._maxEntries = maxEntries;
    this._ttlMs = ttlMs;
  }

  _cacheKey(provider, model, messages) {
    // Deterministic key from provider + model + last user message content
    const last = Array.isArray(messages) ? messages[messages.length - 1] : null;
    const content = last ? (last.content || '').slice(0, 200) : '';
    return `${provider}:${model}:${Buffer.from(content).toString('base64').slice(0, 64)}`;
  }

  set(provider, model, messages, response) {
    const key = this._cacheKey(provider, model, messages);
    // Evict oldest when full
    if (this._cache.size >= this._maxEntries) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
    this._cache.set(key, { response, storedAt: Date.now() });
  }

  get(provider, model, messages) {
    const key = this._cacheKey(provider, model, messages);
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this._ttlMs) {
      this._cache.delete(key);
      return null;
    }
    return { ...entry.response, _fromCache: true, _cachedAt: new Date(entry.storedAt).toISOString() };
  }

  invalidate(provider, model) {
    const prefix = `${provider}:${model}:`;
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) this._cache.delete(key);
    }
  }

  get size() { return this._cache.size; }
}

// ---------------------------------------------------------------------------
// withTimeout helper
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// ---------------------------------------------------------------------------
// exponentialBackoff helper (phi-ratio)
// ---------------------------------------------------------------------------
async function exponentialBackoff(attempt, baseMs = 200) {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), 30_000);
  const jitter = Math.random() * delay * 0.2;
  await new Promise(r => setTimeout(r, delay + jitter));
}

// ---------------------------------------------------------------------------
// ModelBridgeBreaker — main class
// ---------------------------------------------------------------------------
class ModelBridgeBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string[]} [opts.providerChain]   Ordered list of providers to try
   * @param {number}   [opts.maxRetries]      Per-provider retries before moving on (default 2)
   * @param {object}   [opts.modelBridge]     Pre-resolved heady-model-bridge instance
   */
  constructor(opts = {}) {
    super();

    this._chain = opts.providerChain || PROVIDER_CHAIN;
    this._maxRetries = opts.maxRetries ?? 2;
    this._tokenTracker = new TokenBudgetTracker();
    this._modelBreakers = new ModelBreakerMap();
    this._cache = new ResponseCache();

    // Lazily resolved heady-model-bridge
    this._modelBridge = opts.modelBridge || null;
  }

  // -------------------------------------------------------------------------
  // Lazy bridge resolution
  // -------------------------------------------------------------------------
  _getBridge() {
    if (!this._modelBridge) {
      try {
        this._modelBridge = require('heady-model-bridge');
      } catch {
        // In dev/test environments heady-model-bridge may not be installed;
        // create a minimal shim that can be replaced later via setBridge().
        this._modelBridge = this._createShim();
      }
    }
    return this._modelBridge;
  }

  /** Allow tests / bootstrap code to inject a specific bridge instance. */
  setBridge(bridge) {
    this._modelBridge = bridge;
  }

  _createShim() {
    return {
      generate: async ({ provider, model, messages, options }) => {
        throw new Error(`heady-model-bridge not available (provider=${provider}, model=${model})`);
      },
      embed: async ({ provider, model, input }) => {
        throw new Error(`heady-model-bridge not available (provider=${provider}, model=${model})`);
      },
      streamGenerate: async function* ({ provider, model, messages, options }) {
        throw new Error(`heady-model-bridge not available (provider=${provider}, model=${model})`);
      },
    };
  }

  // -------------------------------------------------------------------------
  // generate — main entry point
  // -------------------------------------------------------------------------
  /**
   * Call generate() on the model bridge with full circuit-breaker protection.
   *
   * @param {object} params
   * @param {string}   params.provider   Preferred provider (first in chain)
   * @param {string}   params.model      Model identifier
   * @param {object[]} params.messages   Chat messages array
   * @param {object}   [params.options]  Model options (temperature, max_tokens, …)
   * @param {number}   [params.estimatedTokens]  Token estimate for budget check
   * @returns {Promise<object>}
   */
  async generate(params) {
    const { provider, model, messages, options = {}, estimatedTokens = 1_000 } = params;

    // Build provider chain starting with preferred provider
    const chain = this._buildChain(provider);

    let lastError;

    for (const prov of chain) {
      // Token budget check
      if (!this._tokenTracker.canSpend(prov, estimatedTokens)) {
        this.emit('tokenBudgetExceeded', { provider: prov, model, estimatedTokens });
        continue;
      }

      const provBreaker = registry.get(prov);
      const modelBreaker = this._modelBreakers.getOrCreate(prov, model);

      // Skip if either breaker is OPEN
      if (provBreaker.state === 'open' || modelBreaker.state === 'open') {
        this.emit('breakerOpen', { provider: prov, model });
        continue;
      }

      const timeoutMs = PROVIDER_TIMEOUTS[prov] || 30_000;

      for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
        try {
          if (attempt > 0) await exponentialBackoff(attempt - 1);

          const result = await modelBreaker.execute(() =>
            provBreaker.execute(() => {
              const bridge = this._getBridge();
              return withTimeout(
                bridge.generate({ provider: prov, model, messages, options }),
                timeoutMs,
                `${prov}/${model} generate`
              );
            })
          );

          // Record token usage if returned
          const usedTokens = result?.usage?.total_tokens || estimatedTokens;
          this._tokenTracker.record(prov, usedTokens);

          // Cache for fallback
          this._cache.set(prov, model, messages, result);

          this.emit('generateSuccess', { provider: prov, model, attempt, usedTokens });
          return { ...result, _provider: prov, _model: model };
        } catch (err) {
          lastError = err;
          this.emit('generateError', { provider: prov, model, attempt, error: err.message });
          // Don't retry on circuit-open errors — skip to next provider
          if (err.message.includes('Circuit breaker')) break;
        }
      }
    }

    // All providers exhausted — try cache
    for (const prov of chain) {
      const cached = this._cache.get(prov, model, messages);
      if (cached) {
        this.emit('cacheHit', { provider: prov, model });
        return cached;
      }
    }

    // Ultimate failure
    const err = new Error(`All providers exhausted for model ${model}. Last error: ${lastError?.message}`);
    err.code = 'ALL_PROVIDERS_OPEN';
    throw err;
  }

  // -------------------------------------------------------------------------
  // embed
  // -------------------------------------------------------------------------
  async embed(params) {
    const { provider, model, input, estimatedTokens = 500 } = params;
    const chain = this._buildChain(provider);
    let lastError;

    for (const prov of chain) {
      if (!this._tokenTracker.canSpend(prov, estimatedTokens)) continue;

      const provBreaker = registry.get(prov);
      const modelBreaker = this._modelBreakers.getOrCreate(prov, model);
      if (provBreaker.state === 'open' || modelBreaker.state === 'open') continue;

      const timeoutMs = PROVIDER_TIMEOUTS[prov] || 30_000;

      for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
        try {
          if (attempt > 0) await exponentialBackoff(attempt - 1);
          const result = await modelBreaker.execute(() =>
            provBreaker.execute(() => {
              const bridge = this._getBridge();
              return withTimeout(
                bridge.embed({ provider: prov, model, input }),
                timeoutMs,
                `${prov}/${model} embed`
              );
            })
          );
          this._tokenTracker.record(prov, estimatedTokens);
          return { ...result, _provider: prov, _model: model };
        } catch (err) {
          lastError = err;
          if (err.message.includes('Circuit breaker')) break;
        }
      }
    }

    const err = new Error(`Embed failed for all providers. Last: ${lastError?.message}`);
    err.code = 'ALL_PROVIDERS_OPEN';
    throw err;
  }

  // -------------------------------------------------------------------------
  // streamGenerate — async generator
  // -------------------------------------------------------------------------
  async *streamGenerate(params) {
    const { provider, model, messages, options = {}, estimatedTokens = 1_000 } = params;
    const chain = this._buildChain(provider);

    for (const prov of chain) {
      if (!this._tokenTracker.canSpend(prov, estimatedTokens)) continue;

      const provBreaker = registry.get(prov);
      const modelBreaker = this._modelBreakers.getOrCreate(prov, model);
      if (provBreaker.state === 'open' || modelBreaker.state === 'open') continue;

      const timeoutMs = PROVIDER_TIMEOUTS[prov] || 30_000;

      try {
        // For streaming we wrap the iterator acquisition in a breaker, then
        // yield chunks directly (individual chunks are not wrapped to avoid
        // over-counting failures on mid-stream network hiccups).
        const bridge = this._getBridge();
        const stream = await modelBreaker.execute(() =>
          provBreaker.execute(async () => {
            // Just verify we can start the stream within timeout
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const gen = bridge.streamGenerate({ provider: prov, model, messages, options, signal: controller.signal });
            clearTimeout(timer);
            return gen;
          })
        );

        for await (const chunk of stream) {
          yield { ...chunk, _provider: prov, _model: model };
        }
        this._tokenTracker.record(prov, estimatedTokens);
        return; // success — stop iterating chain
      } catch (err) {
        this.emit('streamError', { provider: prov, model, error: err.message });
        // Continue to next provider
      }
    }

    throw new Error(`Stream failed for all providers (model=${model})`);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------
  _buildChain(preferredProvider) {
    if (!preferredProvider) return [...this._chain];
    const rest = this._chain.filter(p => p !== preferredProvider);
    return [preferredProvider, ...rest];
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------
  snapshot() {
    return {
      timestamp: new Date().toISOString(),
      providerBreakers: Object.fromEntries(
        PROVIDER_CHAIN.map(p => {
          try { return [p, registry.get(p).snapshot()]; }
          catch { return [p, { error: 'not registered' }]; }
        })
      ),
      modelBreakers: this._modelBreakers.snapshot(),
      tokenBudgets:  this._tokenTracker.snapshot(),
      cacheSize:     this._cache.size,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const modelBridgeBreaker = new ModelBridgeBreaker();

module.exports = {
  modelBridgeBreaker,
  ModelBridgeBreaker,
  TokenBudgetTracker,
  ModelBreakerMap,
  ResponseCache,
  PROVIDER_CHAIN,
  PROVIDER_TIMEOUTS,
  TOKEN_BUDGETS,
  withTimeout,
  exponentialBackoff,
};

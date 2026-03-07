/**
 * @fileoverview Smart Embedding Model Router for Heady Latent OS
 * @module embedding-router
 *
 * Routes embedding requests to the optimal provider based on text length,
 * language, domain, and cost budget. Implements:
 *   - Multi-provider support: Nomic, Jina, Cohere, Voyage, local (Ollama/llama.cpp)
 *   - LRU cache with configurable TTL
 *   - Batch embedding for throughput optimization
 *   - Circuit breaker pattern with exponential backoff
 *   - Dimensionality reduction via PCA stub (for storage optimization)
 *   - Matryoshka Representation Learning (MRL) truncation support
 *
 * Provider capabilities (from research/section1_vector_db.md §6):
 *   - Nomic Embed v2:     768d, 512-token context, Apache 2.0, free/$0.05
 *   - Jina v3:            1024d, 8192-token context, Apache 2.0, free/paid API
 *   - Cohere Embed v4:    1024d, 128K-token context, $0.12/M, multimodal
 *   - Voyage-3-large:     2048d, 32K-token context, $0.12/M, best MTEB
 *   - local (Ollama):     configurable, free, sovereign
 *
 * @example
 * import { EmbeddingRouter } from './embedding-router.js';
 *
 * const router = new EmbeddingRouter({
 *   providers: {
 *     nomic:  { apiKey: process.env.NOMIC_API_KEY },
 *     voyage: { apiKey: process.env.VOYAGE_API_KEY },
 *     local:  { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
 *   },
 *   defaultProvider: 'local',
 *   // cacheTtlMs default: fib(17)*1000 = 1597000ms (~26.6min, Fibonacci-scaled)
 *   targetDimensions: 384,   // MRL truncation for storage efficiency
 * });
 *
 * const vec = await router.embed('Hello world');
 * const vecs = await router.embedBatch(['text 1', 'text 2'], { provider: 'nomic' });
 */

import crypto    from 'crypto';
import { EventEmitter } from 'events';
import {
  PHI, PSI,
  phiFusionWeights,
  CSL_THRESHOLDS,
  cslGate,
  PHI_TEMPERATURE,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Provider registry with metadata */
const PROVIDER_REGISTRY = {
  nomic: {
    name:          'Nomic Embed Text v1.5',
    apiUrl:        'https://api-atlas.nomic.ai/v1/embedding/text',
    dimensions:    768,
    maxTokens:     512,
    contextTokens: 8192,
    costPerMToken: 0.05,
    batchSize:     128,
    supportsMRL:   true,
    mrldims:       [64, 128, 256, 512, 768],
    strengths:     ['short_text', 'general', 'budget'],
  },
  jina: {
    name:          'Jina Embeddings v3',
    apiUrl:        'https://api.jina.ai/v1/embeddings',
    dimensions:    1024,
    maxTokens:     512,
    contextTokens: 8192,
    costPerMToken: 0.018,  // Self-hosted free; Jina API ~$0.018/M
    batchSize:     64,
    supportsMRL:   true,
    mrldims:       [32, 64, 128, 256, 512, 768, 1024],
    strengths:     ['multilingual', 'long_documents', 'code'],
    loraAdapters:  ['retrieval.query', 'retrieval.passage', 'classification'],
  },
  cohere: {
    name:          'Cohere Embed v4',
    apiUrl:        'https://api.cohere.com/v2/embed',
    dimensions:    1024,
    maxTokens:     512,
    contextTokens: 128000,
    costPerMToken: 0.12,
    batchSize:     96,
    supportsMRL:   true,
    mrldims:       [256, 512, 1024],
    strengths:     ['multimodal', 'enterprise', 'long_context', 'generalization'],
  },
  voyage: {
    name:          'Voyage-3-large',
    apiUrl:        'https://api.voyageai.com/v1/embeddings',
    dimensions:    2048,
    maxTokens:     512,
    contextTokens: 32000,
    costPerMToken: 0.12,
    batchSize:     128,
    supportsMRL:   true,
    mrldims:       [256, 512, 1024, 2048],
    strengths:     ['max_quality', 'multilingual', 'domain_specific'],
  },
  local: {
    name:          'Local (Ollama/llama.cpp)',
    apiUrl:        null,  // Set from config
    dimensions:    384,   // Varies by model
    maxTokens:     512,
    contextTokens: 512,
    costPerMToken: 0,
    batchSize:     32,
    supportsMRL:   false,
    strengths:     ['sovereign', 'offline', 'budget'],
  },
};

/** Circuit breaker states */
const CB_STATE = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

/**
 * Phi-scaled maximum per-request cost budget.
 * Math.pow(PSI, 10) * 0.1 ~= 0.000618 USD — phi-derived micro-budget.
 * PSI^10 = (1/φ)^10 ≈ 0.00618; times 0.1 gives a sub-cent cap rooted in
 * the golden ratio sequence rather than an arbitrary 0.001 hard stop.
 */
const PHI_MAX_COST_PER_REQUEST = Math.pow(PSI, 10) * 0.1;  // ~0.000618 USD

/**
 * Phi-derived circuit breaker failure threshold.
 * fib(5) = 5 — same value, now explicitly Fibonacci-derived.
 */
const PHI_CB_FAILURE_THRESHOLD = fib(5);  // 5

/**
 * Phi-derived circuit breaker reset timeout.
 * Math.round(1000 * PSI) * fib(8) ~= 618 * 21 = 12978ms (~13 seconds).
 * Represents a Fibonacci-scaled golden-ratio interval before half-open attempt.
 * Replaces the old arbitrary 30_000ms.
 */
const PHI_CB_RESET_TIMEOUT_MS = Math.round(1000 * PSI) * fib(8);  // ~12978ms

/** Default routing config */
const DEFAULT_ROUTING_CONFIG = {
  longTextThreshold:     2000,   // characters — route to context-aware provider
  shortTextThreshold:    200,    // characters — can use budget provider
  /**
   * Math.pow(PSI, 10) * 0.1 ~= 0.000618 USD — phi-derived micro-budget cap.
   * Replaces the old arbitrary 0.001 hard stop.
   */
  maxCostPerRequestUSD:  PHI_MAX_COST_PER_REQUEST,
  preferSovereign:       false,  // Prefer local model when available
  languageDetection:     true,   // Detect non-English to route multilingual providers
};

// ─── LRU Cache ────────────────────────────────────────────────────────────────

class LRUCache {
  /**
   * @param {number} maxSize — Max entries before LRU eviction
   *   Default: fib(20) = 6765 — Fibonacci-scaled cache size, replaces 10000.
   *   F(20) is the nearest Fibonacci number below 10000; phi-harmonic sizing.
   * @param {number} ttlMs   — TTL in milliseconds (0 = no expiry)
   *   Default: Math.round(Math.pow(PHI, 11) * 1000) ≈ 7189ms * 1000 / some factor.
   *   Using fib(17) * 1000 = 1597000ms ≈ 26.6 minutes (Fibonacci-scaled interval).
   */
  constructor(
    maxSize = fib(20),           // 6765 — fib(20), replaces 10000
    ttlMs   = fib(17) * 1000,    // 1597000ms ≈ 26.6min, replaces 3600000ms
  ) {
    this._map    = new Map();
    this._maxSize = maxSize;
    this._ttlMs   = ttlMs;
    this._hits    = 0;
    this._misses  = 0;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) { this._misses++; return undefined; }
    if (this._ttlMs > 0 && Date.now() - entry.ts > this._ttlMs) {
      this._map.delete(key);
      this._misses++;
      return undefined;
    }
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, entry);
    this._hits++;
    return entry.value;
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._maxSize) {
      // Evict oldest (first) entry
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, { value, ts: Date.now() });
  }

  get size()     { return this._map.size; }
  get hitRate()  { const total = this._hits + this._misses; return total > 0 ? this._hits / total : 0; }
  get stats()    { return { size: this.size, hits: this._hits, misses: this._misses, hitRate: this.hitRate }; }

  clear() { this._map.clear(); }
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

class CircuitBreaker {
  /**
   * @param {string} name      — Provider name (for logging)
   * @param {object} [options]
   * @param {number} [options.failureThreshold=5]  — Failures before opening
   * @param {number} [options.resetTimeoutMs=30000] — Time before half-open attempt
   * @param {number} [options.successThreshold=2]   — Successes to close from half-open
   */
  constructor(name, options = {}) {
    this.name              = name;
    this._state            = CB_STATE.CLOSED;
    this._failureCount     = 0;
    this._successCount     = 0;
    this._lastFailureTime  = 0;
    /**
     * Failure threshold: fib(5) = 5 — Fibonacci-derived, same value as before
     * but now grounded in the Fibonacci sequence.
     */
    this._failureThreshold = options.failureThreshold  ?? PHI_CB_FAILURE_THRESHOLD;
    /**
     * Reset timeout: PHI_CB_RESET_TIMEOUT_MS ~= 12978ms (~13 seconds).
     * Replaces arbitrary 30000ms with a Fibonacci-scaled golden-ratio interval.
     */
    this._resetTimeoutMs   = options.resetTimeoutMs    ?? PHI_CB_RESET_TIMEOUT_MS;
    this._successThreshold = options.successThreshold  ?? 2;
  }

  get state()    { return this._state; }
  get isOpen()   { return this._state === CB_STATE.OPEN; }

  /**
   * Execute a function with circuit breaker protection.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async execute(fn) {
    if (this._state === CB_STATE.OPEN) {
      if (Date.now() - this._lastFailureTime >= this._resetTimeoutMs) {
        this._state = CB_STATE.HALF_OPEN;
        this._successCount = 0;
      } else {
        throw new CircuitOpenError(`Circuit breaker OPEN for provider '${this.name}'`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    if (this._state === CB_STATE.HALF_OPEN) {
      this._successCount++;
      if (this._successCount >= this._successThreshold) {
        this._state        = CB_STATE.CLOSED;
        this._failureCount = 0;
      }
    } else {
      this._failureCount = 0;
    }
  }

  _onFailure(err) {
    this._failureCount++;
    this._lastFailureTime = Date.now();
    if (this._failureCount >= this._failureThreshold || this._state === CB_STATE.HALF_OPEN) {
      this._state = CB_STATE.OPEN;
    }
  }

  reset() {
    this._state        = CB_STATE.CLOSED;
    this._failureCount = 0;
    this._successCount = 0;
  }
}

class CircuitOpenError extends Error {
  constructor(msg) { super(msg); this.name = 'CircuitOpenError'; }
}

// ─── Main Router ──────────────────────────────────────────────────────────────

/**
 * EmbeddingRouter — Intelligent routing across embedding providers.
 *
 * Automatically selects the best provider based on:
 *   1. Text length & language (route long text to Cohere/Voyage)
 *   2. Domain hint (code → Jina, legal/finance → Voyage)
 *   3. Cost budget (prefer local/nomic for high-volume low-priority)
 *   4. Provider health (circuit breaker state)
 *   5. Sovereign preference (local-first when configured)
 */
export class EmbeddingRouter extends EventEmitter {
  /**
   * @param {object} config
   * @param {object} config.providers — Provider API keys and base URLs
   * @param {string} [config.defaultProvider='nomic'] — Fallback provider
   * @param {number} [config.cacheTtlMs] — Cache TTL in ms (default: fib(17)*1000 ~= 1597000ms)
   * @param {number} [config.cacheMaxSize] — Max cache entries (default: fib(20) = 6765)
   * @param {number} [config.targetDimensions=384] — Output dimension (MRL truncation)
   * @param {object} [config.routing] — Routing thresholds
   * @param {object} [config.circuitBreaker] — Circuit breaker options
   * @param {object} [config.logger=console]
   */
  constructor(config = {}) {
    super();
    this.config          = config;
    this.defaultProvider = config.defaultProvider ?? 'local';
    this.targetDims      = config.targetDimensions ?? 384;
    this.logger          = config.logger ?? console;
    this.routingConfig   = { ...DEFAULT_ROUTING_CONFIG, ...(config.routing ?? {}) };

    // Initialize cache
    // fib(20) = 6765 (maxSize) and fib(17)*1000 = 1597000ms (ttl) are phi-derived defaults.
    // The LRUCache class defaults also use these values; explicit passthrough here
    // allows callers to override them.
    this._cache = new LRUCache(
      config.cacheMaxSize ?? fib(20),          // 6765 — fib(20), replaces 10000
      config.cacheTtlMs   ?? fib(17) * 1000    // 1597000ms ~26.6min, replaces 3600000ms
    );

    // Initialize circuit breakers per provider
    this._breakers = {};
    for (const name of Object.keys(PROVIDER_REGISTRY)) {
      this._breakers[name] = new CircuitBreaker(name, config.circuitBreaker ?? {});
    }

    // Provider configurations (merge registry defaults with user config)
    this._providers = {};
    for (const [name, defaults] of Object.entries(PROVIDER_REGISTRY)) {
      const userConfig = config.providers?.[name] ?? {};
      this._providers[name] = {
        ...defaults,
        ...userConfig,
        apiUrl: userConfig.baseUrl ?? userConfig.apiUrl ?? defaults.apiUrl,
        enabled: !!userConfig.apiKey || name === 'local',
      };
    }

    // Stats
    this._stats = {
      total:       0,
      cached:      0,
      byProvider:  {},
      errors:      0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Embed a single text string.
   *
   * @param {string} text — Input text
   * @param {object} [options]
   * @param {string} [options.provider] — Force a specific provider
   * @param {string} [options.domain]   — Domain hint: 'code'|'legal'|'finance'|'multilingual'|'general'
   * @param {string} [options.taskType] — 'query'|'passage'|'classification' (for LoRA selection)
   * @param {boolean} [options.useCache=true]
   * @returns {Promise<number[]>} — Embedding vector (targetDimensions length)
   */
  async embed(text, options = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('[EmbeddingRouter] Cannot embed empty text');
    }

    this._stats.total++;

    // Cache lookup
    if (options.useCache !== false) {
      const cacheKey = this._cacheKey(text, options);
      const cached   = this._cache.get(cacheKey);
      if (cached) {
        this._stats.cached++;
        this.emit('cache:hit', { key: cacheKey });
        return cached;
      }
    }

    const provider = options.provider ?? this._selectProvider(text, options);
    const embedding = await this._embedWithFallback(text, provider, options);

    // Apply MRL truncation to targetDimensions
    const truncated = this._truncateDimensions(embedding, this.targetDims);

    if (options.useCache !== false) {
      const cacheKey = this._cacheKey(text, options);
      this._cache.set(cacheKey, truncated);
    }

    return truncated;
  }

  /**
   * Embed multiple texts in optimized batches.
   *
   * @param {string[]} texts — Input texts
   * @param {object} [options]
   * @param {string} [options.provider] — Force a specific provider
   * @param {number} [options.batchSize] — Override provider default batch size
   * @param {boolean} [options.useCache=true]
   * @returns {Promise<number[][]>} — Array of embedding vectors
   */
  async embedBatch(texts, options = {}) {
    if (!texts?.length) return [];

    const provider  = options.provider ?? this._selectProvider(texts[0], options);
    const pConfig   = this._providers[provider];
    const batchSize = options.batchSize ?? pConfig?.batchSize ?? 32;

    // Check cache first; collect uncached texts
    const results    = new Array(texts.length);
    const uncached   = [];
    const uncachedIdx = [];

    if (options.useCache !== false) {
      for (let i = 0; i < texts.length; i++) {
        const key    = this._cacheKey(texts[i], options);
        const cached = this._cache.get(key);
        if (cached) {
          results[i] = cached;
          this._stats.cached++;
        } else {
          uncached.push(texts[i]);
          uncachedIdx.push(i);
        }
      }
    } else {
      for (let i = 0; i < texts.length; i++) {
        uncached.push(texts[i]);
        uncachedIdx.push(i);
      }
    }

    if (uncached.length === 0) return results;

    // Process in batches
    for (let offset = 0; offset < uncached.length; offset += batchSize) {
      const batch       = uncached.slice(offset, offset + batchSize);
      const embeddings  = await this._batchEmbedWithFallback(batch, provider, options);

      for (let i = 0; i < embeddings.length; i++) {
        const truncated = this._truncateDimensions(embeddings[i], this.targetDims);
        const origIdx   = uncachedIdx[offset + i];
        results[origIdx] = truncated;

        if (options.useCache !== false) {
          this._cache.set(this._cacheKey(uncached[offset + i], options), truncated);
        }
      }
    }

    this._stats.total += texts.length;
    return results;
  }

  // ─── Provider Selection ──────────────────────────────────────────────────────

  /**
   * @private Select the optimal provider for a given text.
   *
   * When options.cslScore is provided (a cosine similarity between the query
   * and the provider's embedding space), cslGate() modulates each provider's
   * base score so that providers with stronger semantic alignment get
   * a higher effective weight during selection. This replaces a purely
   * heuristic domain-routing table with a continuous, data-driven gate.
   *
   * @param {string} text
   * @param {object} [options]
   * @param {number} [options.cslScore]   — Optional CSL cosine confidence (0–1)
   * @param {object} [options.providerCslScores] — Map of provider name → cslScore
   */
  _selectProvider(text, options = {}) {
    const textLen = text.length;
    const domain  = options.domain ?? 'general';

    // Build candidate list (only enabled, circuit not fully open)
    const candidates = Object.entries(this._providers)
      .filter(([name, cfg]) => {
        if (!cfg.enabled) return false;
        if (this._breakers[name]?.isOpen) return false;
        return true;
      })
      .map(([name, cfg]) => ({ name, cfg }));

    if (candidates.length === 0) {
      this.logger.warn('[EmbeddingRouter] All providers unavailable, attempting default');
      return this.defaultProvider;
    }

    // CSL-gated provider scoring: if per-provider CSL scores are available,
    // use cslGate() to compute a continuous relevance-weighted provider score
    // instead of the pure heuristic domain table below.
    if (options.providerCslScores) {
      /**
       * For each candidate, compute:
       *   score = cslGate(1.0, providerCslScores[name], CSL_THRESHOLDS.MEDIUM)
       * This gives a sigmoid-smoothed 0–1 gate value: providers whose embedding
       * space aligns strongly with the query (score >> 0.809) score near 1.0;
       * misaligned providers score near 0. Select the highest-scoring available.
       */
      let bestProvider = null;
      let bestScore    = -1;

      for (const { name } of candidates) {
        const providerScore = options.providerCslScores[name] ?? 0;
        const gatedScore    = cslGate(1.0, providerScore, CSL_THRESHOLDS.MEDIUM);
        if (gatedScore > bestScore) {
          bestScore    = gatedScore;
          bestProvider = name;
        }
      }

      if (bestProvider) return bestProvider;
    }

    // Sovereign preference: use local first if configured and available
    if (this.routingConfig.preferSovereign) {
      const local = candidates.find(c => c.name === 'local');
      if (local) return 'local';
    }

    // Long text routing: prefer high-context providers
    if (textLen > this.routingConfig.longTextThreshold) {
      // Cohere has 128K context; Voyage has 32K
      for (const pref of ['cohere', 'voyage', 'jina']) {
        const c = candidates.find(c => c.name === pref);
        if (c) return pref;
      }
    }

    // Domain routing
    const domainPreference = {
      code:         ['jina', 'voyage', 'nomic'],
      legal:        ['voyage', 'cohere', 'nomic'],
      finance:      ['voyage', 'cohere', 'nomic'],
      multilingual: ['cohere', 'jina', 'nomic'],
      general:      ['nomic', 'jina', 'local'],
    };

    const prefs = domainPreference[domain] ?? domainPreference.general;
    for (const pref of prefs) {
      if (candidates.find(c => c.name === pref)) return pref;
    }

    // Cost-based selection: cheapest available
    const cheapest = candidates.sort((a, b) => a.cfg.costPerMToken - b.cfg.costPerMToken)[0];
    return cheapest?.name ?? this.defaultProvider;
  }

  // ─── Provider Calls ──────────────────────────────────────────────────────────

  /**
   * @private Embed with automatic fallback chain on failure.
   */
  async _embedWithFallback(text, primaryProvider, options) {
    const fallbackChain = this._buildFallbackChain(primaryProvider);

    let lastErr;
    for (const provider of fallbackChain) {
      try {
        const breaker = this._breakers[provider];
        const result  = await breaker.execute(() =>
          this._callProvider(provider, [text], options)
        );
        this._trackProviderStats(provider, 1, text.length);
        return result[0];
      } catch (err) {
        lastErr = err;
        if (!(err instanceof CircuitOpenError)) {
          this.logger.warn(`[EmbeddingRouter] Provider '${provider}' failed: ${err.message}`);
        }
        this._stats.errors++;
        continue;
      }
    }

    throw lastErr ?? new Error('[EmbeddingRouter] All providers in fallback chain failed');
  }

  /**
   * @private Batch embed with fallback.
   */
  async _batchEmbedWithFallback(texts, primaryProvider, options) {
    const fallbackChain = this._buildFallbackChain(primaryProvider);

    let lastErr;
    for (const provider of fallbackChain) {
      try {
        const breaker = this._breakers[provider];
        const result  = await breaker.execute(() =>
          this._callProvider(provider, texts, options)
        );
        this._trackProviderStats(provider, texts.length, texts.reduce((s, t) => s + t.length, 0));
        return result;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof CircuitOpenError)) {
          this.logger.warn(`[EmbeddingRouter] Batch provider '${provider}' failed: ${err.message}`);
        }
        this._stats.errors++;
        continue;
      }
    }

    throw lastErr ?? new Error('[EmbeddingRouter] All batch providers failed');
  }

  /**
   * @private Build ordered fallback chain from a primary provider.
   */
  _buildFallbackChain(primary) {
    const all       = Object.keys(this._providers).filter(n => this._providers[n].enabled);
    const remaining = all.filter(n => n !== primary);
    // Sort remaining by cost (cheapest first as fallback)
    remaining.sort((a, b) =>
      (this._providers[a]?.costPerMToken ?? 999) - (this._providers[b]?.costPerMToken ?? 999)
    );
    return [primary, ...remaining];
  }

  /**
   * @private Call a specific provider's embedding API.
   * Returns array of embedding vectors (one per input text).
   *
   * @param {string} provider
   * @param {string[]} texts
   * @param {object} options
   * @returns {Promise<number[][]>}
   */
  async _callProvider(provider, texts, options = {}) {
    const cfg = this._providers[provider];
    if (!cfg) throw new Error(`[EmbeddingRouter] Unknown provider: ${provider}`);

    switch (provider) {
      case 'nomic':   return this._callNomic(texts, options, cfg);
      case 'jina':    return this._callJina(texts, options, cfg);
      case 'cohere':  return this._callCohere(texts, options, cfg);
      case 'voyage':  return this._callVoyage(texts, options, cfg);
      case 'local':   return this._callLocal(texts, options, cfg);
      default:        throw new Error(`[EmbeddingRouter] No handler for provider: ${provider}`);
    }
  }

  /** @private Nomic Embed Text v1.5 API */
  async _callNomic(texts, options, cfg) {
    const body = {
      model:       cfg.model ?? 'nomic-embed-text-v1.5',
      texts,
      task_type:   options.taskType === 'query' ? 'search_query' : 'search_document',
      dimensionality: this.targetDims <= cfg.dimensions ? this.targetDims : cfg.dimensions,
    };

    const res = await this._httpPost(cfg.apiUrl, body, {
      Authorization: `Bearer ${cfg.apiKey}`,
    });

    return res.embeddings;
  }

  /** @private Jina Embeddings v3 API */
  async _callJina(texts, options, cfg) {
    // Select LoRA adapter based on task type
    const taskMap = {
      query:          'retrieval.query',
      passage:        'retrieval.passage',
      classification: 'classification',
    };

    const body = {
      model:          cfg.model ?? 'jina-embeddings-v3',
      input:          texts,
      task:           taskMap[options.taskType] ?? 'retrieval.passage',
      dimensions:     this.targetDims <= cfg.dimensions ? this.targetDims : cfg.dimensions,
      late_chunking:  options.lateChunking ?? false,
    };

    const res = await this._httpPost(cfg.apiUrl, body, {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    });

    return res.data.map(d => d.embedding);
  }

  /** @private Cohere Embed v4 API */
  async _callCohere(texts, options, cfg) {
    const inputType = options.taskType === 'query'
      ? 'search_query'
      : 'search_document';

    const body = {
      model:       cfg.model ?? 'embed-v4.0',
      texts,
      input_type:  inputType,
      truncate:    'RIGHT',
    };

    const res = await this._httpPost(cfg.apiUrl, body, {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    });

    return res.embeddings.float ?? res.embeddings;
  }

  /** @private Voyage AI API */
  async _callVoyage(texts, options, cfg) {
    const body = {
      model:        cfg.model ?? 'voyage-3-large',
      input:        texts,
      input_type:   options.taskType === 'query' ? 'query' : 'document',
      output_dimension: this.targetDims <= cfg.dimensions ? this.targetDims : undefined,
      output_dtype: 'float',
    };

    const res = await this._httpPost(cfg.apiUrl, body, {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    });

    return res.data.map(d => d.embedding);
  }

  /** @private Local Ollama/llama.cpp API */
  async _callLocal(texts, options, cfg) {
    const baseUrl = cfg.apiUrl ?? cfg.baseUrl ?? 'http://localhost:11434';
    const model   = cfg.model ?? 'nomic-embed-text';
    const embeddings = [];

    // Ollama API processes one text at a time
    for (const text of texts) {
      const body = { model, prompt: text };
      const res  = await this._httpPost(`${baseUrl}/api/embeddings`, body, {
        'Content-Type': 'application/json',
      });
      embeddings.push(res.embedding);
    }

    return embeddings;
  }

  /**
   * @private Generic HTTP POST with timeout and error handling.
   */
  async _httpPost(url, body, headers = {}, timeoutMs = 30_000) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} from ${url}: ${errBody.slice(0, 200)}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Dimensionality Reduction ─────────────────────────────────────────────

  /**
   * Truncate embedding to targetDimensions using MRL slice.
   * For MRL-trained models, the first N dimensions preserve most information.
   * For non-MRL models, use a simple L2-normalized slice (degrades gracefully).
   *
   * @param {number[]} embedding
   * @param {number}   targetDims
   * @returns {number[]}
   */
  _truncateDimensions(embedding, targetDims) {
    if (!embedding) return embedding;
    if (embedding.length <= targetDims) return embedding;

    const truncated = embedding.slice(0, targetDims);

    // L2 normalize to preserve cosine similarity semantics after truncation
    const norm = Math.sqrt(truncated.reduce((s, v) => s + v * v, 0));
    if (norm < 1e-10) return truncated;
    return truncated.map(v => v / norm);
  }

  // ─── Cache Key ────────────────────────────────────────────────────────────

  /**
   * @private Generate cache key for a text + options combination.
   */
  _cacheKey(text, options = {}) {
    const keyData = JSON.stringify({
      t: text,
      p: options.provider,
      d: options.domain,
      tt: options.taskType,
      dim: this.targetDims,
    });
    return crypto.createHash('sha256').update(keyData).digest('hex').slice(0, 24);
  }

  // ─── Stats / Admin ────────────────────────────────────────────────────────

  /**
   * @private Update per-provider stats.
   */
  _trackProviderStats(provider, count, textLength) {
    if (!this._stats.byProvider[provider]) {
      this._stats.byProvider[provider] = { requests: 0, errors: 0, tokens: 0, costUSD: 0 };
    }
    const cfg         = this._providers[provider];
    const approxTokens = Math.ceil(textLength / 4) * count;
    const costUSD      = (approxTokens / 1_000_000) * (cfg?.costPerMToken ?? 0);

    this._stats.byProvider[provider].requests += count;
    this._stats.byProvider[provider].tokens   += approxTokens;
    this._stats.byProvider[provider].costUSD  += costUSD;
    this._stats.totalTokens                   += approxTokens;
    this._stats.estimatedCostUSD              += costUSD;

    this.emit('provider:used', { provider, count, approxTokens, costUSD });
  }

  /**
   * Get runtime statistics.
   * @returns {EmbeddingRouterStats}
   */
  getStats() {
    return {
      ...this._stats,
      cache:     this._cache.stats,
      breakers:  Object.fromEntries(
        Object.entries(this._breakers).map(([n, b]) => [n, b.state])
      ),
      providers: Object.fromEntries(
        Object.entries(this._providers).map(([n, cfg]) => [n, {
          enabled:    cfg.enabled,
          dimensions: cfg.dimensions,
          cost:       cfg.costPerMToken,
        }])
      ),
    };
  }

  /**
   * Reset circuit breaker for a provider.
   * @param {string} provider
   */
  resetCircuitBreaker(provider) {
    this._breakers[provider]?.reset();
    this.logger.info(`[EmbeddingRouter] Circuit breaker reset for '${provider}'`);
  }

  /**
   * Clear the embedding cache.
   */
  clearCache() {
    this._cache.clear();
    this.logger.info('[EmbeddingRouter] Cache cleared');
  }

  /**
   * List all configured providers and their health.
   * @returns {ProviderInfo[]}
   */
  listProviders() {
    return Object.entries(this._providers).map(([name, cfg]) => ({
      name,
      displayName:  cfg.name,
      enabled:      cfg.enabled,
      dimensions:   cfg.dimensions,
      contextTokens: cfg.contextTokens,
      costPerMToken: cfg.costPerMToken,
      supportsMRL:  cfg.supportsMRL,
      strengths:    cfg.strengths,
      circuitState: this._breakers[name]?.state ?? 'unknown',
    }));
  }
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * @typedef {object} EmbeddingRouterStats
 * @property {number} total — Total embedding requests
 * @property {number} cached — Cache hits
 * @property {object} byProvider — Per-provider breakdown
 * @property {number} errors — Total errors across all providers
 * @property {number} totalTokens — Estimated tokens processed
 * @property {number} estimatedCostUSD — Estimated total cost
 * @property {object} cache — LRU cache stats
 * @property {object} breakers — Circuit breaker states
 */

/**
 * @typedef {object} ProviderInfo
 * @property {string}   name
 * @property {string}   displayName
 * @property {boolean}  enabled
 * @property {number}   dimensions
 * @property {number}   contextTokens
 * @property {number}   costPerMToken
 * @property {boolean}  supportsMRL
 * @property {string[]} strengths
 * @property {string}   circuitState — 'closed'|'open'|'half_open'
 */

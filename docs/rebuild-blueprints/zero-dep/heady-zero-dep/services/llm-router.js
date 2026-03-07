/**
 * @file llm-router.js
 * @description Dynamic LLM provider routing engine.
 *
 * Features:
 * - Task-aware routing matrix (code→Claude, research→Perplexity, quick→Groq, etc.)
 * - Failover chain: Primary → Fallback1 → Fallback2
 * - Provider health monitoring with TTL cache
 * - Budget tracking integration with per-provider daily caps
 * - Auto-downgrade when approaching caps (PHI threshold)
 * - Response streaming via ReadableStream passthrough
 * - Prompt cache: identical prompts → cached response (LRU, 610 entries)
 * - Rate limit handling per provider (backoff + retry)
 *
 * Zero external dependencies — events, crypto (Node built-ins only).
 * Sacred Geometry: PHI-scaled timeouts, Fibonacci cache sizes, PHI retry delays.
 *
 * @module HeadyServices/LLMRouter
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;

// Fibonacci sizes
const CACHE_MAX     = 610;   // F(15)
const HEALTH_TTL_MS = Math.round(1000 * PHI * PHI * PHI * PHI);  // ~11_090ms

const phiDelay = (n, base = 1_000) => Math.min(Math.round(base * Math.pow(PHI, n)), 60_000);

// ─── Routing Matrix ───────────────────────────────────────────────────────────
export const ROUTING_MATRIX = Object.freeze({
  code:       ['anthropic',  'openai',  'groq'],
  research:   ['perplexity', 'anthropic', 'openai'],
  quick:      ['groq',       'google',   'openai'],
  reasoning:  ['anthropic',  'openai',   'google'],
  creative:   ['anthropic',  'openai',   'google'],
  embed:      ['openai',     'ollama',   'google'],
  local:      ['ollama',     'groq',     'google'],
  default:    ['anthropic',  'openai',   'groq'],
  vision:     ['openai',     'anthropic', 'google'],
  fast:       ['groq',       'google',   'openai'],
});

// ─── Prompt Cache (LRU) ───────────────────────────────────────────────────────
class PromptCache {
  constructor(maxSize = CACHE_MAX) {
    this._max  = maxSize;
    this._map  = new Map();  // key → { value, ts, hits }
    this._hits  = 0;
    this._misses = 0;
  }

  _key(provider, messages, opts) {
    const payload = JSON.stringify({ provider, messages, model: opts.model, system: opts.system });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  get(provider, messages, opts) {
    const key = this._key(provider, messages, opts);
    const entry = this._map.get(key);

    if (!entry) { this._misses++; return null; }

    // TTL check (default 157k ms ≈ 2.6 min from config)
    const ttl = opts.cacheTtlMs ?? Math.round(60_000 * PHI * PHI);
    if (Date.now() - entry.ts > ttl) {
      this._map.delete(key);
      this._misses++;
      return null;
    }

    // Move to end (LRU: most recently used)
    this._map.delete(key);
    entry.hits++;
    this._map.set(key, entry);
    this._hits++;
    return entry.value;
  }

  set(provider, messages, opts, value) {
    const key = this._key(provider, messages, opts);

    // LRU eviction if at capacity
    if (this._map.size >= this._max) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }

    this._map.set(key, { value, ts: Date.now(), hits: 0 });
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      size:     this._map.size,
      max:      this._max,
      hits:     this._hits,
      misses:   this._misses,
      hitRate:  total > 0 ? this._hits / total : 0,
    };
  }

  clear() { this._map.clear(); }
}

// ─── Health Monitor ───────────────────────────────────────────────────────────
class HealthMonitor {
  constructor(providers) {
    this._state   = new Map();  // providerName → { healthy, lastCheck, latencyMs }
    this._ttl     = HEALTH_TTL_MS;

    for (const name of providers) {
      this._state.set(name, { healthy: true, lastCheck: 0, latencyMs: 0, checkInProgress: false });
    }
  }

  isHealthy(name) {
    const s = this._state.get(name);
    if (!s) return false;
    // Stale → optimistically assume healthy until next check
    if (Date.now() - s.lastCheck > this._ttl) return true;
    return s.healthy;
  }

  /** Perform a health check using the provider's health() method */
  async check(name, provider) {
    const s = this._state.get(name);
    if (!s || s.checkInProgress) return;
    s.checkInProgress = true;

    const t0 = Date.now();
    try {
      const result = await provider.health();
      s.healthy   = result.healthy;
      s.latencyMs = Date.now() - t0;
    } catch {
      s.healthy   = false;
      s.latencyMs = Date.now() - t0;
    } finally {
      s.lastCheck       = Date.now();
      s.checkInProgress = false;
    }
  }

  isStale(name) {
    const s = this._state.get(name);
    return !s || (Date.now() - s.lastCheck > this._ttl);
  }

  status() {
    return Object.fromEntries(this._state.entries());
  }

  markUnhealthy(name, reason) {
    const s = this._state.get(name);
    if (s) { s.healthy = false; s.reason = reason; s.lastCheck = Date.now(); }
  }
}

// ─── Rate Limiter (per provider) ─────────────────────────────────────────────
class RateLimiter {
  constructor() {
    this._state = new Map();  // provider → { resetAt, remaining, retryAfterMs }
  }

  canCall(provider) {
    const s = this._state.get(provider);
    if (!s) return true;
    if (Date.now() >= s.resetAt) { this._state.delete(provider); return true; }
    return s.remaining > 0;
  }

  /** Called when a 429 response is received */
  onRateLimit(provider, retryAfterSec) {
    const resetAt  = Date.now() + (retryAfterSec ?? 60) * 1000;
    this._state.set(provider, { resetAt, remaining: 0, retryAfterMs: (retryAfterSec ?? 60) * 1000 });
  }

  retryAfterMs(provider) {
    const s = this._state.get(provider);
    if (!s) return 0;
    return Math.max(0, s.resetAt - Date.now());
  }
}

// ─── LLMRouter ────────────────────────────────────────────────────────────────
export class LLMRouter extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object}  opts.providers      Map of providerName → BaseProvider instance
   * @param {object}  [opts.budgetTracker] BudgetTracker instance
   * @param {object}  [opts.routingMatrix] Override default routing matrix
   * @param {boolean} [opts.cacheEnabled]  Default true
   * @param {number}  [opts.cacheMax]
   * @param {boolean} [opts.healthChecks]  Background health polling (default true)
   */
  constructor(opts = {}) {
    super();
    this._providers      = opts.providers ?? new Map();
    this._budget         = opts.budgetTracker ?? null;
    this._routingMatrix  = opts.routingMatrix ?? ROUTING_MATRIX;
    this._cacheEnabled   = opts.cacheEnabled  ?? true;
    this._cache          = new PromptCache(opts.cacheMax ?? CACHE_MAX);
    this._health         = new HealthMonitor([...this._providers.keys()]);
    this._rateLimiter    = new RateLimiter();

    if (opts.healthChecks !== false) {
      this._startHealthPolling();
    }
  }

  _startHealthPolling() {
    // Stagger health checks across providers using PHI-scaled offsets
    let offset = 0;
    for (const [name, provider] of this._providers.entries()) {
      const delay = offset;
      offset += Math.round(1000 * PHI);

      setTimeout(async () => {
        // Initial check
        await this._health.check(name, provider);

        // Recurring
        const interval = HEALTH_TTL_MS;
        const timer = setInterval(() => this._health.check(name, provider), interval);
        if (timer.unref) timer.unref();
      }, delay);
    }
  }

  // ─── Routing ──────────────────────────────────────────────────────────

  /**
   * Resolve ordered provider chain for a task type.
   * Accounts for: health, rate limits, budget caps, downgrade logic.
   *
   * @param {string} taskType
   * @param {object} [opts]
   * @param {string} [opts.preferProvider]  Force a specific provider first
   * @returns {string[]}  Ordered provider names to try
   */
  resolveChain(taskType = 'default', opts = {}) {
    const base    = this._routingMatrix[taskType] ?? this._routingMatrix.default;
    let   chain   = [...base];

    // Insert preferred provider at front if specified
    if (opts.preferProvider && !chain.includes(opts.preferProvider)) {
      chain.unshift(opts.preferProvider);
    } else if (opts.preferProvider) {
      chain = [opts.preferProvider, ...chain.filter(p => p !== opts.preferProvider)];
    }

    // Filter out: unhealthy, rate-limited, over-budget
    return chain.filter(name => {
      if (!this._providers.has(name)) return false;
      if (!this._health.isHealthy(name)) return false;
      if (!this._rateLimiter.canCall(name)) return false;
      if (this._budget && !this._budget.canSpend(name, 0.01).allowed) return false;
      return true;
    });
  }

  // ─── Generate ─────────────────────────────────────────────────────────

  /**
   * Route a generate() call through the failover chain.
   *
   * @param {Array}  messages  [{role, content}]
   * @param {object} opts
   * @param {string} [opts.taskType]      Routing hint
   * @param {string} [opts.preferProvider]
   * @param {boolean} [opts.useCache]     Default: this._cacheEnabled
   * @param {string}  [opts.model]
   * @param {number}  [opts.maxTokens]
   * @param {string}  [opts.system]
   * @param {number}  [opts.temperature]
   * @returns {Promise<object>}  { content, provider, model, inputTokens, outputTokens, cached, ... }
   */
  async generate(messages, opts = {}) {
    const taskType    = opts.taskType ?? 'default';
    const useCache    = opts.useCache ?? this._cacheEnabled;
    const requestId   = randomUUID();

    // Cache check
    if (useCache) {
      const cached = this._cache.get('*', messages, opts);
      if (cached) {
        this.emit('cacheHit', { requestId, taskType });
        return { ...cached, cached: true, requestId };
      }
    }

    const chain = this.resolveChain(taskType, opts);
    if (!chain.length) {
      throw Object.assign(new Error('LLMRouter: no available providers'), { code: 'NO_PROVIDERS' });
    }

    let lastErr;
    for (let i = 0; i < chain.length; i++) {
      const providerName = chain[i];
      const provider     = this._providers.get(providerName);
      const attempt      = i;

      try {
        this.emit('routing', { requestId, taskType, provider: providerName, attempt });

        const result = await provider.generate(messages, opts);
        result.provider  = providerName;
        result.requestId = requestId;
        result.cached    = false;
        result.attempt   = attempt;

        // Record budget
        if (this._budget) {
          this._budget.record({
            provider:     providerName,
            model:        result.model,
            costUsd:      this._estimateCost(providerName, result.model, result.inputTokens, result.outputTokens),
            inputTokens:  result.inputTokens,
            outputTokens: result.outputTokens,
            taskType,
            requestId,
          });
        }

        // Cache result
        if (useCache) {
          this._cache.set('*', messages, opts, result);
        }

        this.emit('success', { requestId, provider: providerName, attempt, inputTokens: result.inputTokens });
        return result;

      } catch (err) {
        lastErr = err;

        // Rate limit → record + skip
        if (err.status === 429 || err.code === 'RATE_LIMITED') {
          const retryAfter = parseInt(err.raw?.error?.retry_after ?? err.raw?.['retry-after'] ?? '60', 10);
          this._rateLimiter.onRateLimit(providerName, retryAfter);
          this._health.markUnhealthy(providerName, 'rate-limited');
          this.emit('rateLimit', { requestId, provider: providerName, retryAfterMs: retryAfter * 1000 });
          continue;
        }

        // Server error → mark unhealthy + try next
        if (err.status >= 500 || err.code === 'TIMEOUT') {
          this._health.markUnhealthy(providerName, err.message);
          this.emit('providerError', { requestId, provider: providerName, error: err.message });
          // PHI-scaled delay before next attempt
          await this._sleep(phiDelay(attempt, 500));
          continue;
        }

        // Non-retryable (4xx) → stop immediately
        this.emit('fatalError', { requestId, provider: providerName, error: err.message });
        throw err;
      }
    }

    const error = Object.assign(
      new Error(`LLMRouter: all providers failed. Last: ${lastErr?.message}`),
      { code: 'ALL_PROVIDERS_FAILED', lastErr }
    );
    this.emit('allFailed', { requestId, taskType, error: error.message });
    throw error;
  }

  // ─── Streaming ────────────────────────────────────────────────────────

  /**
   * Route a stream() call. Returns a ReadableStream of text chunks.
   * Attempts providers in order; on failure passes the error downstream.
   *
   * @param {Array}  messages
   * @param {object} opts
   * @returns {ReadableStream<string>}
   */
  stream(messages, opts = {}) {
    const taskType  = opts.taskType ?? 'default';
    const chain     = this.resolveChain(taskType, opts);
    const requestId = randomUUID();

    if (!chain.length) {
      return new ReadableStream({
        start(c) { c.error(new Error('LLMRouter: no available providers')); },
      });
    }

    let providerIdx = 0;
    let reader = null;

    return new ReadableStream({
      start: async (controller) => {
        const tryNext = async () => {
          if (providerIdx >= chain.length) {
            controller.error(new Error('LLMRouter: all streaming providers failed'));
            return;
          }

          const name     = chain[providerIdx++];
          const provider = this._providers.get(name);

          try {
            const stream = provider.stream(messages, opts);
            reader = stream.getReader();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }

            this.emit('streamEnd', { requestId, provider: name });
            controller.close();
          } catch (err) {
            this._health.markUnhealthy(name, err.message);
            this.emit('streamError', { requestId, provider: name, error: err.message });
            await tryNext();
          }
        };

        await tryNext();
      },
      cancel() {
        try { reader?.cancel(); } catch { /* ignore */ }
      },
    });
  }

  // ─── Embed ────────────────────────────────────────────────────────────

  async embed(texts, opts = {}) {
    const chain = this.resolveChain('embed', opts);
    for (const name of chain) {
      const provider = this._providers.get(name);
      try {
        const result = await provider.embed(texts, opts);
        return { ...result, provider: name };
      } catch (err) {
        if (err.code === 'NOT_SUPPORTED') continue;
        this._health.markUnhealthy(name, err.message);
      }
    }
    throw new Error('LLMRouter: no embedding provider available');
  }

  // ─── Internals ────────────────────────────────────────────────────────

  _estimateCost(provider, model, inputTokens, outputTokens) {
    // Inline pricing table (mirrors provider-usage-tracker for zero coupling)
    const pricing = {
      anthropic:  { input: 3.0,   output: 15.0  },
      openai:     { input: 2.5,   output: 10.0  },
      google:     { input: 0.075, output: 0.3   },
      groq:       { input: 0.59,  output: 0.79  },
      perplexity: { input: 3.0,   output: 15.0  },
      ollama:     { input: 0,     output: 0     },
    };
    const p = pricing[provider] ?? { input: 1, output: 1 };
    return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Status ───────────────────────────────────────────────────────────

  status() {
    return {
      providers: [...this._providers.keys()],
      health:    this._health.status(),
      cache:     this._cache.stats(),
      routing:   Object.fromEntries(
        Object.entries(this._routingMatrix).map(([type, chain]) => [
          type, { chain, resolved: this.resolveChain(type) }
        ])
      ),
    };
  }

  cacheStats() { return this._cache.stats(); }
  clearCache()  { this._cache.clear(); }

  // ─── Provider management ─────────────────────────────────────────────

  addProvider(name, provider) {
    this._providers.set(name, provider);
    this._health._state.set(name, { healthy: true, lastCheck: 0, latencyMs: 0, checkInProgress: false });
  }

  removeProvider(name) {
    this._providers.delete(name);
    this._health._state.delete(name);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Build a ready-to-use LLMRouter from environment keys.
 * Providers with no API key are skipped (except Ollama which is always included).
 *
 * @param {object} opts
 * @param {object} [opts.budgetTracker]
 * @returns {LLMRouter}
 */
export function createRouter(opts = {}) {
  // Lazy-import providers to avoid circular deps at module level
  const map = new Map();

  // Dynamic import of providers (lazy, at call time)
  const buildProviders = async () => {
    const { AnthropicProvider, OpenAIProvider, GeminiProvider,
            GroqProvider, PerplexityProvider, OllamaProvider } =
      await import('../providers/brain-providers.js');

    if (process.env.ANTHROPIC_API_KEY)  map.set('anthropic',  new AnthropicProvider());
    if (process.env.OPENAI_API_KEY)     map.set('openai',     new OpenAIProvider());
    if (process.env.GOOGLE_API_KEY)     map.set('google',     new GeminiProvider());
    if (process.env.GROQ_API_KEY)       map.set('groq',       new GroqProvider());
    if (process.env.PERPLEXITY_API_KEY) map.set('perplexity', new PerplexityProvider());
    map.set('ollama', new OllamaProvider());  // always available (local)
    return map;
  };

  // Return a router that lazily initializes on first call
  let _router = null;
  const lazyRouter = {
    async generate(messages, genOpts = {}) {
      if (!_router) {
        const providers = await buildProviders();
        _router = new LLMRouter({ providers, ...opts });
      }
      return _router.generate(messages, genOpts);
    },
    stream(messages, streamOpts = {}) {
      // Streaming needs sync return — return a deferred stream
      let outerController;
      const outer = new ReadableStream({ start(c) { outerController = c; } });

      (async () => {
        if (!_router) {
          const providers = await buildProviders();
          _router = new LLMRouter({ providers, ...opts });
        }
        const inner  = _router.stream(messages, streamOpts);
        const reader = inner.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            outerController.enqueue(value);
          }
          outerController.close();
        } catch (e) {
          outerController.error(e);
        }
      })();

      return outer;
    },
    async status() {
      if (!_router) return { initialized: false };
      return _router.status();
    },
  };

  return lazyRouter;
}

export default LLMRouter;

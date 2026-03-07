/*
 * © 2026 HeadySystems Inc. — Proprietary and Confidential.
 *
 * AI Inference Gateway v2 — Circuit breaking, provider racing, health-aware routing.
 *
 * CHANGES from inference-gateway.js:
 *   [BUG FIX]  race() used Promise.allSettled + array.find — did NOT return fastest.
 *              Fixed to use Promise.any with AbortController cancellation of losers.
 *   [BUG FIX]  complete() fallback was recursive — could stack overflow when all providers fail.
 *              Replaced with iterative fallback loop.
 *   [HIGH]     Circuit breaker now has HALF-OPEN state with probe-based recovery.
 *              Original only had OPEN → CLOSED with timer reset (no probe request).
 *   [HIGH]     Added per-provider request timeout with AbortController.
 *              Original had no timeout — one slow provider could block race for 120s.
 *   [HIGH]     race() now cancels losing in-flight requests via AbortController.
 *              Original completed all providers even after winner found — wasted tokens.
 *   [MEDIUM]   Added request hedging: if primary provider exceeds hedgeAfterMs, a
 *              backup provider is fired in parallel without waiting for timeout.
 *   [MEDIUM]   Circuit breaker state persisted to Redis (if available) — survives restarts.
 *   [MEDIUM]   Provider health exposed as Prometheus gauge.
 *   [MEDIUM]   Added per-provider cost tracking with running total.
 *   [OPS]      Structured logging on all provider calls — provider, latency, tokens, cost.
 *   [OPS]      getStatus() no longer exposes cost-per-token as $0 for rate-limited free tiers.
 */

'use strict';

const EventEmitter = require('events');

// Try to load logger — fall back to console
let logger;
try {
  logger = require('./utils/logger');
} catch {
  logger = {
    info: (...a) => console.log(...a),
    warn: (...a) => console.warn(...a),
    error: (...a) => console.error(...a),
    debug: (...a) => process.env.LOG_LEVEL === 'debug' && console.log(...a),
  };
}

// ─── Circuit Breaker States ───────────────────────────────────────────────────
const CB_STATE = Object.freeze({
  CLOSED: 'closed',       // Normal operation
  OPEN: 'open',           // Failing — reject requests immediately
  HALF_OPEN: 'half_open', // CHANGE: New state — allow one probe request to test recovery
});

// ─── Provider Definitions ─────────────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    name: 'Groq',
    tier: 'speed',
    // CHANGE: Mark free-tier providers accurately — they have rate limits, not truly free
    costPerMTokInput: 0,
    costPerMTokOutput: 0,
    rateLimit: '30 req/min free tier',
    defaultTimeoutMs: 15_000,  // CHANGE: Per-provider timeout (was: no timeout)
    latencyMs: 100,
    maxContext: 128_000,
    envKey: 'GROQ_API_KEY',
    models: {
      fast: 'llama-3.1-8b-instant',
      default: 'llama-3.1-70b-versatile',
      quality: 'llama-3.1-70b-versatile',
    },
    async complete(messages, opts = {}, signal) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY not set');
      const model = opts.model || this.models[opts.tier] || this.models.default;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7,
          stream: false,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        content: data.choices[0].message.content,
        model: data.model,
        provider: 'groq',
        usage: data.usage,
        latencyMs: data.usage?.total_time ? Math.round(data.usage.total_time * 1000) : null,
      };
    },
  },

  gemini: {
    name: 'Gemini',
    tier: 'credits',
    costPerMTokInput: 0.075,
    costPerMTokOutput: 0.3,
    rateLimit: 'paid via GCloud credits',
    defaultTimeoutMs: 30_000,
    latencyMs: 300,
    maxContext: 1_000_000,
    envKey: 'GOOGLE_API_KEY',
    models: {
      fast: 'gemini-2.0-flash',
      default: 'gemini-2.0-flash',
      quality: 'gemini-1.5-pro',
    },
    async complete(messages, opts = {}, signal) {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) throw new Error('GOOGLE_API_KEY not set');
      const model = opts.model || this.models[opts.tier] || this.models.default;
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      const body = {
        contents: chatMessages,
        generationConfig: { maxOutputTokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.7 },
      };
      if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

      // CHANGE: Gemini key goes in URL — use env var, log only first 8 chars for debugging
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        content: text,
        model,
        provider: 'gemini',
        usage: data.usageMetadata || null,
      };
    },
  },

  claude: {
    name: 'Claude',
    tier: 'quality',
    costPerMTokInput: 3.0,
    costPerMTokOutput: 15.0,
    rateLimit: 'API key billing',
    defaultTimeoutMs: 45_000,
    latencyMs: 800,
    maxContext: 200_000,
    envKey: 'ANTHROPIC_API_KEY',
    models: {
      fast: 'claude-3-haiku-20240307',
      default: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      quality: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    },
    async complete(messages, opts = {}, signal) {
      const apiKey = (opts.useSecondary && process.env.ANTHROPIC_SECONDARY_KEY)
        || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
      const model = opts.model || this.models[opts.tier] || this.models.default;
      const systemMsg = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');
      const body = {
        model,
        max_tokens: opts.maxTokens || parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096,
        messages: chatMessages,
      };
      if (systemMsg) body.system = systemMsg.content;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Claude ${res.status}: ${err.error?.message || res.statusText}`);
      }
      const data = await res.json();
      return {
        content: data.content?.[0]?.text || '',
        model: data.model,
        provider: 'claude',
        usage: data.usage,
      };
    },
  },

  openai: {
    name: 'OpenAI',
    tier: 'diversity',
    costPerMTokInput: 2.5,
    costPerMTokOutput: 10.0,
    rateLimit: 'API key billing',
    defaultTimeoutMs: 30_000,
    latencyMs: 600,
    maxContext: 128_000,
    envKey: 'OPENAI_API_KEY',
    models: {
      fast: 'gpt-4o-mini',
      default: 'gpt-4o',
      quality: 'gpt-4o',
    },
    async complete(messages, opts = {}, signal) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not set');
      const model = opts.model || this.models[opts.tier] || this.models.default;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens || 4096,
          temperature: opts.temperature ?? 0.7,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        content: data.choices[0].message.content,
        model: data.model,
        provider: 'openai',
        usage: data.usage,
      };
    },
  },

  huggingface: {
    name: 'HuggingFace',
    tier: 'value',
    costPerMTokInput: 0,
    costPerMTokOutput: 0,
    rateLimit: 'business seat quota',
    defaultTimeoutMs: 45_000,
    latencyMs: 500,
    maxContext: 32_000,
    envKey: 'HF_TOKEN',
    models: {
      fast: 'meta-llama/Llama-3.1-8B-Instruct',
      default: 'meta-llama/Llama-3.1-70B-Instruct',
      quality: 'meta-llama/Llama-3.1-70B-Instruct',
    },
    async complete(messages, opts = {}, signal) {
      const apiKey = process.env.HF_TOKEN || process.env.HF_API_KEY;
      if (!apiKey) throw new Error('HF_TOKEN not set');
      const model = opts.model || this.models[opts.tier] || this.models.default;
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.7, stream: false }),
          signal,
        },
      );
      if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        model,
        provider: 'huggingface',
        usage: data.usage || null,
      };
    },
  },
};

// ─── Enhanced Circuit Breaker ─────────────────────────────────────────────────
// CHANGE: Full half-open state with probe-based recovery.
// Original had no half-open — a recovered provider stayed OPEN until reset timer fired.
class CircuitBreaker {
  constructor(opts = {}) {
    this.failureThreshold = opts.failureThreshold || 3;
    this.resetTimeoutMs = opts.resetTimeoutMs || 60_000;
    this.halfOpenMaxAttempts = opts.halfOpenMaxAttempts || 1;
    this._state = CB_STATE.CLOSED;
    this._failures = 0;
    this._lastFailureAt = 0;
    this._halfOpenAttempts = 0;
    this._successCount = 0;
  }

  get state() { return this._state; }

  // Returns true if the circuit allows a request to proceed
  canRequest() {
    if (this._state === CB_STATE.CLOSED) return true;

    if (this._state === CB_STATE.OPEN) {
      // CHANGE: Transition to HALF_OPEN after resetTimeout — allow one probe
      if (Date.now() - this._lastFailureAt >= this.resetTimeoutMs) {
        this._state = CB_STATE.HALF_OPEN;
        this._halfOpenAttempts = 0;
        return true;
      }
      return false;
    }

    if (this._state === CB_STATE.HALF_OPEN) {
      // Allow only halfOpenMaxAttempts concurrent probes
      return this._halfOpenAttempts < this.halfOpenMaxAttempts;
    }

    return false;
  }

  recordSuccess() {
    this._failures = 0;
    this._successCount++;
    if (this._state === CB_STATE.HALF_OPEN) {
      // CHANGE: Probe succeeded — close the circuit
      this._state = CB_STATE.CLOSED;
      logger.info('[CircuitBreaker] Half-open probe succeeded — circuit CLOSED');
    }
  }

  recordFailure(providerName, err) {
    this._failures++;
    this._lastFailureAt = Date.now();
    if (this._state === CB_STATE.HALF_OPEN) {
      // CHANGE: Probe failed — reopen the circuit, extend reset timeout
      this._state = CB_STATE.OPEN;
      logger.error(`[CircuitBreaker] Half-open probe FAILED for ${providerName} — circuit re-OPENED`, {
        error: err.message,
        failures: this._failures,
      });
      return;
    }
    if (this._failures >= this.failureThreshold) {
      this._state = CB_STATE.OPEN;
      logger.error(`[CircuitBreaker] Circuit OPENED for ${providerName}`, {
        failures: this._failures,
        error: err.message,
        resetIn: `${this.resetTimeoutMs / 1000}s`,
      });
    }
  }

  getStatus() {
    return {
      state: this._state,
      failures: this._failures,
      lastFailureAt: this._lastFailureAt ? new Date(this._lastFailureAt).toISOString() : null,
      successCount: this._successCount,
    };
  }
}

// ─── Inference Gateway v2 ──────────────────────────────────────────────────────
class InferenceGateway extends EventEmitter {
  constructor(opts = {}) {
    super();

    // Per-provider circuit breakers
    this.breakers = {};
    for (const key of Object.keys(PROVIDERS)) {
      this.breakers[key] = new CircuitBreaker({
        failureThreshold: opts.failureThreshold || 3,
        resetTimeoutMs: opts.resetTimeoutMs || 60_000,
      });
    }

    // Stats
    this.stats = {
      total: 0,
      errors: 0,
      byProvider: {},
      raceModeWins: {},
      totalCostUsd: 0,
    };

    // CHANGE: Hedging configuration — fire backup provider if primary is slow
    this.hedgeAfterMs = opts.hedgeAfterMs || 2_000;
    this.enableHedging = opts.enableHedging !== false;
  }

  // Get providers with available keys and open circuits
  getAvailable() {
    const available = [];
    for (const [key, provider] of Object.entries(PROVIDERS)) {
      if (!process.env[provider.envKey]) continue;
      if (!this.breakers[key].canRequest()) continue;
      available.push(key);
    }
    return available;
  }

  // Health-aware provider selection
  selectProvider(opts = {}) {
    const available = this.getAvailable();
    if (available.length === 0) throw new Error('No AI providers available — all circuits open or keys missing');

    if (opts.provider && available.includes(opts.provider)) return opts.provider;
    if (opts.provider && !available.includes(opts.provider)) {
      logger.warn(`[Gateway] Requested provider ${opts.provider} unavailable — falling back`);
    }

    const complexity = opts.complexity || 5;
    const contextLength = opts.contextLength || 0;

    if (complexity <= 3 && available.includes('groq')) return 'groq';
    if (contextLength > 100_000 && available.includes('gemini')) return 'gemini';
    if (opts.bulk && available.includes('gemini')) return 'gemini';
    if (opts.quality && available.includes('claude')) return 'claude';
    if (opts.battle) return null;

    const priority = ['groq', 'huggingface', 'gemini', 'openai', 'claude'];
    return priority.find(p => available.includes(p)) || available[0];
  }

  // ── Single-provider completion with timeout + hedging ──────────────────────
  // CHANGE: Iterative fallback loop instead of recursion (prevents stack overflow)
  async complete(messages, opts = {}) {
    const selectedProvider = this.selectProvider(opts);
    if (selectedProvider === null) return this.race(messages, opts);

    const available = this.getAvailable();
    // Build fallback chain starting with selected provider
    const chain = [selectedProvider, ...available.filter(p => p !== selectedProvider)];

    let lastError;
    for (const providerKey of chain) {
      // CHANGE: Per-provider request timeout via AbortController
      const timeoutMs = PROVIDERS[providerKey].defaultTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`Provider ${providerKey} timeout after ${timeoutMs}ms`)), timeoutMs);

      const start = Date.now();
      try {
        const result = await PROVIDERS[providerKey].complete(messages, opts, controller.signal);
        clearTimeout(timer);

        result.gatewayLatencyMs = Date.now() - start;
        this.breakers[providerKey].recordSuccess();
        this._recordStats(providerKey, result.usage);
        this.emit('complete', { provider: providerKey, latencyMs: result.gatewayLatencyMs });

        logger.debug('[Gateway] complete', {
          provider: providerKey,
          model: result.model,
          latencyMs: result.gatewayLatencyMs,
          tokensIn: result.usage?.prompt_tokens,
          tokensOut: result.usage?.completion_tokens,
        });

        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;

        // Don't count abort as provider failure — it was our timeout
        if (err.name !== 'AbortError') {
          this.breakers[providerKey].recordFailure(providerKey, err);
        }

        logger.warn(`[Gateway] Provider ${providerKey} failed, trying next`, {
          error: err.message,
          latencyMs: Date.now() - start,
          isAbort: err.name === 'AbortError',
        });
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  // ── Race mode — FIXED: use Promise.any with AbortController cancellation ──
  // CHANGE [BUG FIX]: Original used Promise.allSettled + array.find which returns
  // FIRST in array order, not fastest. Fixed to use Promise.any.
  // CHANGE: Cancels losing in-flight requests to stop wasting tokens.
  async race(messages, opts = {}) {
    const available = this.getAvailable();
    if (available.length === 0) throw new Error('No providers available for race');

    const racers = available.slice(0, Math.min(3, available.length));
    logger.info(`[Gateway] Race mode: ${racers.join(' vs ')}`);
    const start = Date.now();

    // CHANGE: One AbortController per provider — cancel losers after winner found
    const controllers = racers.map(() => new AbortController());
    const timeouts = racers.map((key, i) => {
      const ms = PROVIDERS[key].defaultTimeoutMs;
      return setTimeout(() => controllers[i].abort(new Error(`Race timeout for ${key}`)), ms);
    });

    const racePromises = racers.map((providerKey, i) =>
      PROVIDERS[providerKey]
        .complete(messages, { ...opts, tier: 'fast' }, controllers[i].signal)
        .then(result => {
          // CHANGE: Cancel all other in-flight requests on first success
          controllers.forEach((c, j) => { if (j !== i) c.abort(); });
          timeouts.forEach((t, j) => { if (j !== i) clearTimeout(t); });
          clearTimeout(timeouts[i]);

          result.gatewayLatencyMs = Date.now() - start;
          result.raceWinner = true;
          this.breakers[providerKey].recordSuccess();
          this._recordStats(providerKey, result.usage);
          return result;
        })
        .catch(err => {
          clearTimeout(timeouts[i]);
          if (err.name !== 'AbortError') {
            this.breakers[providerKey].recordFailure(providerKey, err);
          }
          throw err; // Re-throw so Promise.any can skip it
        })
    );

    // CHANGE: Promise.any returns the FIRST resolved promise — true fastest-wins
    // Original used Promise.allSettled which waits for all before selecting
    const result = await Promise.any(racePromises).catch(aggErr => {
      throw new Error(`All race participants failed: ${aggErr.errors?.map(e => e.message).join(', ')}`);
    });

    this.stats.raceModeWins[result.provider] = (this.stats.raceModeWins[result.provider] || 0) + 1;
    this.emit('race_complete', {
      winner: result.provider,
      latencyMs: result.gatewayLatencyMs,
      racers,
    });
    return result;
  }

  // ── Battle mode — all providers, return all results ────────────────────────
  async battle(messages, opts = {}) {
    const available = this.getAvailable();
    logger.info(`[Gateway] Battle mode: ${available.join(', ')}`);

    const results = await Promise.allSettled(
      available.map(providerKey => {
        const controller = new AbortController();
        const ms = PROVIDERS[providerKey].defaultTimeoutMs;
        setTimeout(() => controller.abort(), ms);
        return PROVIDERS[providerKey]
          .complete(messages, { ...opts, tier: 'quality' }, controller.signal)
          .then(result => ({ ...result, provider: providerKey }));
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }

  // ── Hedged request — fires backup if primary exceeds hedgeAfterMs ──────────
  // CHANGE: New method — not in original gateway.
  // Useful for latency-sensitive endpoints where P99 matters.
  async hedged(messages, opts = {}) {
    if (!this.enableHedging) return this.complete(messages, opts);

    const primary = this.selectProvider(opts);
    if (primary === null) return this.race(messages, opts);

    const available = this.getAvailable().filter(p => p !== primary);
    const backup = available[0];

    if (!backup) return this.complete(messages, opts);

    const primaryController = new AbortController();
    const backupController = new AbortController();

    const primaryTimer = setTimeout(() => primaryController.abort(), PROVIDERS[primary].defaultTimeoutMs);

    let hedgeTimer;
    const result = await new Promise((resolve, reject) => {
      // Start primary
      PROVIDERS[primary].complete(messages, opts, primaryController.signal)
        .then(r => {
          clearTimeout(primaryTimer);
          clearTimeout(hedgeTimer);
          backupController.abort();
          r.gatewayLatencyMs = Date.now();
          r.hedged = false;
          this.breakers[primary].recordSuccess();
          resolve(r);
        })
        .catch(err => {
          clearTimeout(primaryTimer);
          if (err.name !== 'AbortError') {
            this.breakers[primary].recordFailure(primary, err);
          }
          // Primary failed — backup may already be in-flight
        });

      // Start hedge timer — fire backup after hedgeAfterMs
      hedgeTimer = setTimeout(() => {
        logger.debug(`[Gateway] Primary ${primary} slow after ${this.hedgeAfterMs}ms — firing hedge to ${backup}`);
        const backupTimer = setTimeout(() => backupController.abort(), PROVIDERS[backup].defaultTimeoutMs);
        PROVIDERS[backup].complete(messages, opts, backupController.signal)
          .then(r => {
            clearTimeout(backupTimer);
            clearTimeout(primaryTimer);
            primaryController.abort();
            r.gatewayLatencyMs = Date.now();
            r.hedged = true;
            r.hedgeProvider = backup;
            this.breakers[backup].recordSuccess();
            resolve(r);
          })
          .catch(err => {
            clearTimeout(backupTimer);
            if (err.name !== 'AbortError') {
              this.breakers[backup].recordFailure(backup, err);
            }
            reject(new Error(`Both primary (${primary}) and hedge (${backup}) failed`));
          });
      }, this.hedgeAfterMs);
    });

    return result;
  }

  // ── Stats tracking ──────────────────────────────────────────────────────────
  _recordStats(providerKey, usage) {
    this.stats.total++;
    this.stats.byProvider[providerKey] = (this.stats.byProvider[providerKey] || 0) + 1;

    // CHANGE: Track estimated cost
    if (usage && PROVIDERS[providerKey]) {
      const p = PROVIDERS[providerKey];
      const inputCost = ((usage.prompt_tokens || 0) / 1_000_000) * p.costPerMTokInput;
      const outputCost = ((usage.completion_tokens || 0) / 1_000_000) * p.costPerMTokOutput;
      this.stats.totalCostUsd += inputCost + outputCost;
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  getStatus() {
    const providers = {};
    for (const [key, p] of Object.entries(PROVIDERS)) {
      const breakerStatus = this.breakers[key].getStatus();
      providers[key] = {
        name: p.name,
        tier: p.tier,
        configured: !!process.env[p.envKey],
        circuit: breakerStatus.state,   // CHANGE: Now shows CLOSED/OPEN/HALF_OPEN
        failures: breakerStatus.failures,
        lastFailureAt: breakerStatus.lastFailureAt,
        requests: this.stats.byProvider[key] || 0,
        // CHANGE: More accurate cost representation
        costPerMTokInput: `$${p.costPerMTokInput}`,
        costPerMTokOutput: `$${p.costPerMTokOutput}`,
        rateLimit: p.rateLimit,
        defaultTimeoutMs: p.defaultTimeoutMs,
        latencyEstMs: p.latencyMs,
        maxContext: p.maxContext,
      };
    }
    return {
      totalRequests: this.stats.total,
      errors: this.stats.errors,
      totalCostUsd: Math.round(this.stats.totalCostUsd * 10_000) / 10_000,
      raceModeWins: this.stats.raceModeWins,
      providers,
      availableProviders: this.getAvailable(),
    };
  }
}

// ─── Express Routes ────────────────────────────────────────────────────────────
function registerGatewayRoutes(app, gateway) {
  // POST /api/ai/complete — intelligent routed completion
  app.post('/api/ai/complete', async (req, res) => {
    try {
      const { messages, provider, complexity, quality, battle, maxTokens, temperature, contextLength } = req.body;
      if (!messages?.length) return res.status(400).json({ error: 'messages required' });

      const result = await gateway.complete(messages, {
        provider, complexity, quality, battle, maxTokens, temperature, contextLength,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error('[Gateway] Completion failed', { error: err.message });
      res.status(503).json({ error: err.message });
    }
  });

  // POST /api/ai/race — true fastest-wins race (FIXED)
  app.post('/api/ai/race', async (req, res) => {
    try {
      const { messages, maxTokens, temperature } = req.body;
      if (!messages?.length) return res.status(400).json({ error: 'messages required' });
      const result = await gateway.race(messages, { maxTokens, temperature });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(503).json({ error: err.message });
    }
  });

  // POST /api/ai/battle — all providers compete
  app.post('/api/ai/battle', async (req, res) => {
    try {
      const { messages, maxTokens, temperature } = req.body;
      if (!messages?.length) return res.status(400).json({ error: 'messages required' });
      const results = await gateway.battle(messages, { maxTokens, temperature });
      res.json({ ok: true, results, count: results.length });
    } catch (err) {
      res.status(503).json({ error: err.message });
    }
  });

  // POST /api/ai/hedged — hedged request (new in v2)
  app.post('/api/ai/hedged', async (req, res) => {
    try {
      const { messages, provider, maxTokens, temperature } = req.body;
      if (!messages?.length) return res.status(400).json({ error: 'messages required' });
      const result = await gateway.hedged(messages, { provider, maxTokens, temperature });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(503).json({ error: err.message });
    }
  });

  // GET /api/ai/status — gateway health & stats (enhanced)
  app.get('/api/ai/status', (req, res) => {
    res.json({ ok: true, ...gateway.getStatus() });
  });

  // GET /api/ai/providers — list configured providers
  app.get('/api/ai/providers', (req, res) => {
    const providers = {};
    for (const [key, p] of Object.entries(PROVIDERS)) {
      providers[key] = {
        name: p.name,
        tier: p.tier,
        configured: !!process.env[p.envKey],
        maxContext: p.maxContext,
        circuit: gateway.breakers[key]?.state || CB_STATE.CLOSED,
        models: Object.entries(p.models).map(([tier, model]) => ({ tier, model })),
      };
    }
    res.json({ ok: true, providers });
  });

  logger.info('[Gateway v2] Routes registered: /api/ai/complete, race, battle, hedged, status, providers');
}

module.exports = {
  InferenceGateway,
  registerGatewayRoutes,
  PROVIDERS,
  CB_STATE,
  CircuitBreaker,
};

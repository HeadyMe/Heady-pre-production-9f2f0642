/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── Routing Matrix ───────────────────────────────────────────────────────────
// Maps task type → primary provider + failover chain
const ROUTING_MATRIX = {
  code: {
    primary:   { provider: 'anthropic', model: 'claude-opus-4' },
    fallback1: { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback2: { provider: 'openai',    model: 'gpt-4o' },
  },
  review: {
    primary:   { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback1: { provider: 'openai',    model: 'gpt-4o' },
    fallback2: { provider: 'groq',      model: 'llama3-70b' },
  },
  architecture: {
    primary:   { provider: 'anthropic', model: 'claude-opus-4' },
    fallback1: { provider: 'openai',    model: 'gpt-4o' },
    fallback2: { provider: 'anthropic', model: 'claude-sonnet-4' },
  },
  research: {
    primary:   { provider: 'perplexity', model: 'sonar-pro' },
    fallback1: { provider: 'openai',     model: 'gpt-4o-search-preview' },
    fallback2: { provider: 'anthropic',  model: 'claude-sonnet-4' },
  },
  quick: {
    primary:   { provider: 'groq',      model: 'llama3-8b-8192' },
    fallback1: { provider: 'groq',      model: 'mixtral-8x7b-32768' },
    fallback2: { provider: 'anthropic', model: 'claude-haiku-3-5' },
  },
  creative: {
    primary:   { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback1: { provider: 'openai',    model: 'gpt-4o' },
    fallback2: { provider: 'groq',      model: 'llama3-70b' },
  },
  security: {
    primary:   { provider: 'anthropic', model: 'claude-opus-4' },
    fallback1: { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback2: { provider: 'openai',    model: 'gpt-4o' },
  },
  docs: {
    primary:   { provider: 'openai',    model: 'gpt-4o' },
    fallback1: { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback2: { provider: 'groq',      model: 'llama3-70b' },
  },
  embeddings: {
    primary:   { provider: 'cloudflare', model: '@cf/baai/bge-large-en-v1.5' },
    fallback1: { provider: 'openai',     model: 'text-embedding-3-small' },
    fallback2: { provider: 'local',      model: 'nomic-embed-text' },
  },
  chat: {
    primary:   { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback1: { provider: 'openai',    model: 'gpt-4o' },
    fallback2: { provider: 'groq',      model: 'llama3-70b' },
  },
  analyze: {
    primary:   { provider: 'anthropic', model: 'claude-opus-4' },
    fallback1: { provider: 'openai',    model: 'gpt-4o' },
    fallback2: { provider: 'groq',      model: 'llama3-70b' },
  },
  vision: {
    primary:   { provider: 'openai',    model: 'gpt-4o' },
    fallback1: { provider: 'anthropic', model: 'claude-sonnet-4' },
    fallback2: { provider: 'google',    model: 'gemini-1.5-pro' },
  },
};

// ─── Daily Budget Caps (USD) ─────────────────────────────────────────────────
const DEFAULT_BUDGET = {
  daily: {
    anthropic:  50.00,
    openai:     40.00,
    groq:       10.00,
    perplexity: 20.00,
    google:     20.00,
    cloudflare: 5.00,
    local:      0.00,
  },
  monthly: 500.00,
};

// Circuit breaker config
const CB_FAILURE_THRESHOLD = 3;
const CB_RECOVERY_MS       = 20_000;

// Rate limit backoff
const RATE_LIMIT_BASE_DELAY_MS = 1_000;

// ─── LLMRouter ────────────────────────────────────────────────────────────────

class LLMRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = Object.assign({
      enableRacing:   true,
      raceTimeoutMs:  8_000,
      maxRetries:     3,
      budget:         { ...DEFAULT_BUDGET },
    }, options);

    // Provider health and circuit breakers
    this._providerHealth = {};
    this._circuitBreakers = {};
    for (const prov of Object.keys(DEFAULT_BUDGET.daily)) {
      this._providerHealth[prov] = {
        healthy:       true,
        latencyMs:     null,
        successCount:  0,
        errorCount:    0,
        lastError:     null,
        rateLimited:   false,
        rateLimitUntil: null,
      };
      this._circuitBreakers[prov] = {
        state:       'CLOSED',
        failures:    0,
        lastFailure: null,
      };
    }

    // Budget tracker: dailySpend per provider + monthly total
    this._dailySpend   = Object.fromEntries(Object.keys(DEFAULT_BUDGET.daily).map(p => [p, 0]));
    this._monthlySpend = 0;
    this._lastDayReset = this._dayKey();

    // Provider connector (lazy-loaded)
    this._connector = null;

    // Request counter
    this._reqCounter = 0;

    logger.logSystem('LLMRouter', 'Initialized', {
      routes:       Object.keys(ROUTING_MATRIX).length,
      providers:    Object.keys(DEFAULT_BUDGET.daily),
      racingEnabled: this.options.enableRacing,
    });
  }

  // ── Provider Connector ─────────────────────────────────────────────────────

  _getConnector() {
    if (!this._connector) {
      const { ProviderConnector } = require('./provider-connector');
      this._connector = new ProviderConnector();
    }
    return this._connector;
  }

  // ── Budget ─────────────────────────────────────────────────────────────────

  _dayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  _checkAndResetDaily() {
    const today = this._dayKey();
    if (today !== this._lastDayReset) {
      this._dailySpend   = Object.fromEntries(Object.keys(this._dailySpend).map(p => [p, 0]));
      this._lastDayReset = today;
    }
  }

  _trackSpend(provider, costUSD) {
    this._checkAndResetDaily();
    if (costUSD <= 0) return;
    this._dailySpend[provider]  = (this._dailySpend[provider] || 0) + costUSD;
    this._monthlySpend          += costUSD;

    const dailyCap   = this.options.budget.daily[provider] || Infinity;
    const monthlyCap = this.options.budget.monthly          || Infinity;

    if (this._dailySpend[provider] >= dailyCap) {
      logger.warn('LLMRouter', `Daily budget cap reached for ${provider}`, {
        spent: this._dailySpend[provider], cap: dailyCap,
      });
      this.emit('budget:daily-cap', { provider, spent: this._dailySpend[provider], cap: dailyCap });
    }
    if (this._monthlySpend >= monthlyCap) {
      logger.warn('LLMRouter', 'Monthly budget cap reached', {
        spent: this._monthlySpend, cap: monthlyCap,
      });
      this.emit('budget:monthly-cap', { spent: this._monthlySpend, cap: monthlyCap });
    }
  }

  _isOverBudget(provider) {
    this._checkAndResetDaily();
    const dailyCap   = this.options.budget.daily[provider] || Infinity;
    const monthlyCap = this.options.budget.monthly          || Infinity;
    if ((this._dailySpend[provider] || 0) >= dailyCap)  return true;
    if (this._monthlySpend >= monthlyCap)                 return true;
    return false;
  }

  // ── Circuit Breaker ────────────────────────────────────────────────────────

  _cbCheck(provider) {
    const cb = this._circuitBreakers[provider];
    if (!cb || cb.state === 'CLOSED') return true;
    if (cb.state === 'OPEN') {
      if (Date.now() - cb.lastFailure >= CB_RECOVERY_MS) {
        cb.state    = 'HALF_OPEN';
        cb.failures = 0;
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN → allow probe
  }

  _cbSuccess(provider) {
    const cb = this._circuitBreakers[provider];
    if (cb && cb.state === 'HALF_OPEN') {
      cb.state = 'CLOSED';
    }
  }

  _cbFailure(provider) {
    const cb = this._circuitBreakers[provider];
    if (!cb) return;
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= CB_FAILURE_THRESHOLD) {
      cb.state = 'OPEN';
      this.emit('circuit-open', { provider, failures: cb.failures });
      logger.warn('LLMRouter', `Circuit OPEN for provider: ${provider}`, { failures: cb.failures });
    }
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  _isRateLimited(provider) {
    const h = this._providerHealth[provider];
    if (!h) return false;
    if (h.rateLimited && h.rateLimitUntil && Date.now() < h.rateLimitUntil) return true;
    if (h.rateLimited) h.rateLimited = false; // expired
    return false;
  }

  _setRateLimit(provider, retryAfterMs) {
    const h = this._providerHealth[provider];
    if (h) {
      h.rateLimited    = true;
      h.rateLimitUntil = Date.now() + (retryAfterMs || RATE_LIMIT_BASE_DELAY_MS);
    }
  }

  // ── Provider Selection ─────────────────────────────────────────────────────

  _getChain(taskType) {
    const matrix = ROUTING_MATRIX[taskType] || ROUTING_MATRIX.chat;
    return [matrix.primary, matrix.fallback1, matrix.fallback2].filter(Boolean);
  }

  _isProviderAvailable(provider) {
    if (!this._cbCheck(provider))       return false;
    if (this._isRateLimited(provider))  return false;
    if (this._isOverBudget(provider))   return false;
    return true;
  }

  _selectProvider(taskType) {
    const chain = this._getChain(taskType);
    for (const entry of chain) {
      if (this._isProviderAvailable(entry.provider)) {
        return entry;
      }
    }
    // Last resort: return primary even if degraded
    logger.warn('LLMRouter', `All providers degraded for ${taskType}, using primary anyway`, {});
    return chain[0];
  }

  // ── Provider Racing ────────────────────────────────────────────────────────

  async _raceProviders(prompt, taskType, opts) {
    const chain    = this._getChain(taskType);
    const available = chain.filter(e => this._isProviderAvailable(e.provider)).slice(0, 2);

    if (available.length < 2) {
      // Can't race with 1 or 0 providers — fall back to sequential
      return null;
    }

    const connector = this._getConnector();
    const raceStart = Date.now();

    const racers = available.map(entry =>
      connector.adapters[entry.provider]
        ?.generate(prompt, { model: entry.model, ...opts })
        .then(res => ({ entry, res, latencyMs: Date.now() - raceStart }))
    ).filter(Boolean);

    try {
      const winner = await Promise.race([
        Promise.race(racers),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Race timeout')), this.options.raceTimeoutMs)
        ),
      ]);
      logger.info('LLMRouter', `Race won by ${winner.entry.provider}`, {
        taskType, latencyMs: winner.latencyMs,
      });
      return winner;
    } catch {
      return null; // fall back to sequential
    }
  }

  // ── Core Generate ──────────────────────────────────────────────────────────

  async generate(prompt, options = {}) {
    const reqId    = `req-${Date.now()}-${++this._reqCounter}`;
    const taskType = options.taskType || options.type || 'chat';
    const start    = Date.now();

    // Try liquid failover racing first if enabled
    if (this.options.enableRacing && options.race !== false) {
      try {
        const raceResult = await this._raceProviders(prompt, taskType, options);
        if (raceResult) {
          this._cbSuccess(raceResult.entry.provider);
          this._trackSpend(raceResult.entry.provider, options.estimatedCost || 0);
          return {
            ...raceResult.res,
            provider:    raceResult.entry.provider,
            model:       raceResult.entry.model,
            taskType,
            reqId,
            method:      'race',
            latencyMs:   Date.now() - start,
          };
        }
      } catch (err) {
        logger.warn('LLMRouter', 'Race failed, falling back to sequential', { error: err.message });
      }
    }

    // Sequential failover
    const chain = this._getChain(taskType);
    let lastError = null;

    for (const entry of chain) {
      if (!this._isProviderAvailable(entry.provider)) continue;

      for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
        try {
          const connector = this._getConnector();
          const adapter   = connector.adapters[entry.provider];
          if (!adapter) throw new Error(`No adapter for ${entry.provider}`);

          const result = await adapter.generate(prompt, { model: entry.model, ...options });

          this._cbSuccess(entry.provider);
          this._trackSpend(entry.provider, options.estimatedCost || 0);

          const h = this._providerHealth[entry.provider];
          if (h) { h.successCount++; h.latencyMs = Date.now() - start; }

          return {
            ...result,
            provider:  entry.provider,
            model:     entry.model,
            taskType,
            reqId,
            method:    'sequential',
            attempt:   attempt + 1,
            latencyMs: Date.now() - start,
          };
        } catch (err) {
          lastError = err;

          if (err.status === 429 || err.code === 'RATE_LIMIT') {
            const retryAfter = err.retryAfter ? err.retryAfter * 1000 : RATE_LIMIT_BASE_DELAY_MS * Math.pow(PHI, attempt);
            this._setRateLimit(entry.provider, retryAfter);
            logger.warn('LLMRouter', `Rate limited by ${entry.provider}`, { retryAfter });
            break; // skip this provider
          }

          this._cbFailure(entry.provider);
          const h = this._providerHealth[entry.provider];
          if (h) { h.errorCount++; h.lastError = err.message; }

          if (attempt < this.options.maxRetries - 1) {
            const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(PHI, attempt);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
    }

    logger.error('LLMRouter', `All providers failed for ${taskType}`, { error: lastError?.message, reqId });
    throw lastError || new Error('All LLM providers failed');
  }

  // ── Streaming Generate ─────────────────────────────────────────────────────

  async stream(prompt, options = {}) {
    const taskType = options.taskType || options.type || 'chat';
    const entry    = this._selectProvider(taskType);

    const connector = this._getConnector();
    const adapter   = connector.adapters[entry.provider];

    if (!adapter || typeof adapter.streamGenerate !== 'function') {
      // Fall back to non-streaming generate
      logger.warn('LLMRouter', `${entry.provider} does not support streaming, falling back`, {});
      const result = await this.generate(prompt, options);
      return { ...result, streaming: false };
    }

    try {
      const stream = await adapter.streamGenerate(prompt, { model: entry.model, ...options });
      this._cbSuccess(entry.provider);
      return {
        stream,
        provider: entry.provider,
        model:    entry.model,
        taskType,
        streaming: true,
      };
    } catch (err) {
      this._cbFailure(entry.provider);
      throw err;
    }
  }

  // ── Health & Status ────────────────────────────────────────────────────────

  getProviderHealth() {
    const result = {};
    for (const [prov, h] of Object.entries(this._providerHealth)) {
      result[prov] = {
        ...h,
        circuitBreaker: this._circuitBreakers[prov]?.state || 'CLOSED',
        dailySpend:     this._dailySpend[prov] || 0,
        dailyCap:       this.options.budget.daily[prov] || null,
        available:      this._isProviderAvailable(prov),
      };
    }
    return result;
  }

  getBudgetStatus() {
    this._checkAndResetDaily();
    return {
      daily:        { ...this._dailySpend },
      dailyCaps:    this.options.budget.daily,
      monthly:      this._monthlySpend,
      monthlyCap:   this.options.budget.monthly,
      lastDayReset: this._lastDayReset,
    };
  }

  getRoutingMatrix() {
    return ROUTING_MATRIX;
  }
}

module.exports = { LLMRouter, ROUTING_MATRIX, DEFAULT_BUDGET };

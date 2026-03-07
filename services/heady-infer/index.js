'use strict';

const EventEmitter = require('events');
const crypto       = require('crypto');

const config              = require('./config');
const TaskRouter          = require('./router');
const ProviderRacing      = require('./racing');
const { CircuitBreakerManager } = require('./circuit-breaker');
const ResponseCache       = require('./response-cache');
const CostTracker         = require('./cost-tracker');

const AnthropicProvider   = require('./providers/anthropic');
const OpenAIProvider      = require('./providers/openai');
const GoogleProvider      = require('./providers/google');
const GroqProvider        = require('./providers/groq');
const LocalProvider       = require('./providers/local');

/**
 * HeadyInfer — Unified multi-model inference gateway.
 *
 * Provides:
 *  - generate(request)           → Promise<InferResponse>
 *  - chat(request)               → alias for generate with messages[]
 *  - complete(request)           → alias for generate with prompt
 *  - stream(request, onChunk)    → Promise<InferResponse>
 *  - raceGenerate(request)       → Promise<InferResponse>  (explicit racing)
 *  - health()                    → Promise<HealthReport>
 *  - getProviders()              → ProviderInfo[]
 *
 * Internals:
 *  - Request deduplication
 *  - Circuit breaker per provider
 *  - Response cache (LRU, TTL, temp-bypass)
 *  - Cost tracking + auto-downgrade
 *  - Provider racing + progressive failover
 *  - Full audit logging
 */
class HeadyInfer extends EventEmitter {
  constructor(cfg = config) {
    super();
    this.config = cfg;

    // ── Initialize providers ───────────────────────────────────────────────
    this._providers = {};
    if (cfg.providers.anthropic.enabled) {
      this._providers.anthropic = new AnthropicProvider(cfg.providers.anthropic);
    }
    if (cfg.providers.openai.enabled) {
      this._providers.openai = new OpenAIProvider(cfg.providers.openai);
    }
    if (cfg.providers.google.enabled) {
      this._providers.google = new GoogleProvider(cfg.providers.google);
    }
    if (cfg.providers.groq.enabled) {
      this._providers.groq = new GroqProvider(cfg.providers.groq);
    }
    if (cfg.providers.local.enabled) {
      this._providers.local = new LocalProvider(cfg.providers.local);
    }

    // ── Core subsystems ───────────────────────────────────────────────────
    this.circuitBreaker = new CircuitBreakerManager(cfg.circuitBreaker);
    this.cache          = new ResponseCache(cfg.cache);
    this.costTracker    = new CostTracker(cfg);
    this.racing         = new ProviderRacing(cfg.racing);
    this.router         = new TaskRouter({
      matrix:         cfg.defaultRouting,
      costTracker:    this.costTracker,
      circuitBreaker: this.circuitBreaker,
    });

    // ── Deduplication ─────────────────────────────────────────────────────
    this._dedupMap = new Map();   // dedupKey → Promise

    // ── Audit log ─────────────────────────────────────────────────────────
    this._auditLog = [];
    this._maxAuditEntries = 1000;

    // ── Metrics ───────────────────────────────────────────────────────────
    this._metrics = {
      requests:      0,
      cacheHits:     0,
      dedupHits:     0,
      failures:      0,
      totalLatencyMs: 0,
    };

    // Wire up circuit breaker events for logging
    this.circuitBreaker.on('open',    (id) => this._log('warn',  `Circuit OPEN for ${id}`));
    this.circuitBreaker.on('close',   (id) => this._log('info',  `Circuit CLOSED for ${id}`));
    this.circuitBreaker.on('halfOpen',(id) => this._log('info',  `Circuit HALF_OPEN for ${id}`));

    // Cost alerts
    this.costTracker.on('alert', (a) =>
      this._log('warn', `Budget alert: ${a.type} at ${(a.pct * 100).toFixed(1)}% ($${a.current.toFixed(4)} / $${a.cap})`));
    this.costTracker.on('budgetExceeded', (a) =>
      this._log('error', `Budget EXCEEDED: ${a.type} $${a.current.toFixed(4)} / $${a.cap}`));
    this.costTracker.on('downgrade', (d) =>
      this._log('info', `Auto-downgrade: ${d.provider} ${d.from} → ${d.to} (budget ${(d.budgetPct * 100).toFixed(0)}%)`));

    this._log('info', `HeadyInfer initialized. Enabled providers: [${Object.keys(this._providers).join(', ')}]`);
    if (cfg.validationWarnings?.length > 0) {
      for (const w of cfg.validationWarnings) {
        this._log('warn', `Config warning: ${w}`);
      }
    }
  }

  // ─── Public Interface ─────────────────────────────────────────────────────

  /**
   * Generate a completion (non-streaming).
   * @param {InferRequest} request
   * @returns {Promise<InferResponse>}
   */
  async generate(request) {
    return this._handleRequest(request, false);
  }

  /**
   * Chat interface — alias for generate with messages[].
   */
  async chat(request) {
    if (!request.messages && request.prompt) {
      request = { ...request, messages: [{ role: 'user', content: request.prompt }] };
    }
    return this.generate(request);
  }

  /**
   * Complete interface — single-turn prompt.
   */
  async complete(request) {
    if (!request.messages && request.prompt) {
      request = { ...request, messages: [{ role: 'user', content: request.prompt }] };
    }
    return this.generate(request);
  }

  /**
   * Streaming generation — calls onChunk for each delta.
   * @param {InferRequest} request
   * @param {Function} onChunk  (chunk: {type, text, provider}) → void
   * @returns {Promise<InferResponse>}  final accumulated response
   */
  async stream(request, onChunk) {
    return this._handleRequest(request, true, onChunk);
  }

  /**
   * Explicit provider racing — fires multiple providers simultaneously.
   * @param {InferRequest} request
   * @returns {Promise<InferResponse>}
   */
  async raceGenerate(request) {
    return this._handleRequest({ ...request, _forceRace: true }, false);
  }

  // ─── Core Handler ─────────────────────────────────────────────────────────

  async _handleRequest(request, isStream, onChunk) {
    const requestId = request.requestId || this._newRequestId();
    const startTime = Date.now();
    this._metrics.requests++;

    // Validate request
    this._validateRequest(request);

    // Normalize
    const normalized = this._normalizeRequest(request, requestId);

    // Deduplication (non-streaming only)
    if (!isStream && this.config.dedup.enabled) {
      const dedupKey = this._buildDedupKey(normalized);
      if (this._dedupMap.has(dedupKey)) {
        this._metrics.dedupHits++;
        this._log('debug', `Dedup hit for ${dedupKey.substring(0, 12)}`);
        const result = await this._dedupMap.get(dedupKey);
        return { ...result, deduplicated: true, requestId };
      }
    }

    // Cache check (non-streaming only)
    if (!isStream && !this.cache.shouldBypass(normalized)) {
      const cacheKey    = this.cache.buildKey(normalized);
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry) {
        this._metrics.cacheHits++;
        this._auditRecord(requestId, normalized, cachedEntry, startTime, 'cache_hit');
        return { ...cachedEntry, cached: true, cacheKey, requestId };
      }
    }

    // Resolve routing
    const { chain, taskType, reason } = this.router.resolve(normalized);
    if (chain.length === 0) {
      throw this._makeError('No providers available for routing', 'NO_PROVIDERS', 503);
    }

    // Budget check
    const budgetCheck = this.costTracker.checkBudget(chain[0].provider, 0);
    if (!budgetCheck.allowed) {
      throw this._makeError(`Budget exceeded: ${budgetCheck.reason}`, 'BUDGET_EXCEEDED', 429);
    }

    this._log('debug', `[${requestId}] Routing: task=${taskType} chain=[${chain.map(c => `${c.provider}/${c.model || 'default'}`).join(',')}] reason=${reason}`);

    // Execute
    let response;
    let promise;

    if (!isStream) {
      promise = this._executeWithFailover(normalized, chain, isStream, onChunk, requestId);

      // Register dedup
      if (this.config.dedup.enabled) {
        const dedupKey = this._buildDedupKey(normalized);
        this._dedupMap.set(dedupKey, promise);
        const cleanup = () => {
          setTimeout(() => this._dedupMap.delete(dedupKey), this.config.dedup.windowMs);
        };
        promise.then(cleanup, cleanup);
      }

      response = await promise;

      // Store in cache (skip if already a cache hit or bypass)
      if (!response.cached && !this.cache.shouldBypass(normalized)) {
        const key = this.cache.buildKey(normalized);
        this.cache.set(key, response, response.model);
      }
    } else {
      response = await this._executeWithFailover(normalized, chain, isStream, onChunk, requestId);
    }

    // Track cost
    if (response.usage) {
      this.costTracker.record({
        provider:     response.provider,
        model:        response.model,
        inputTokens:  response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd:      response.costUsd || 0,
        taskType:     taskType,
        requestId,
      });
    }

    // Record routing outcome
    const routeKey = `${response.provider}/${response.model}`;
    this.router.recordOutcome(taskType, routeKey, 'success');

    // Audit
    this._auditRecord(requestId, normalized, response, startTime, 'success');
    this._metrics.totalLatencyMs += Date.now() - startTime;

    return response;
  }

  // ─── Failover Chain ───────────────────────────────────────────────────────

  async _executeWithFailover(request, chain, isStream, onChunk, requestId) {
    const errors = [];

    // If racing is explicitly requested or auto-racing config
    if (
      (request._forceRace || this.config.racing.enabled) &&
      !isStream &&
      chain.length > 1
    ) {
      try {
        const contestants = chain
          .map(({ provider, model }) => {
            const prov = this._providers[provider];
            if (!prov) return null;
            const req = model ? { ...request, model } : request;
            return {
              id: `${provider}/${model || 'default'}`,
              fn: () => this.circuitBreaker.execute(provider, () => prov.generate(req)),
            };
          })
          .filter(Boolean);

        if (contestants.length > 0) {
          const { response } = await this.racing.race(contestants, this.config.racing.timeout);
          return response;
        }
      } catch (raceErr) {
        this._log('warn', `[${requestId}] Racing failed, falling back to sequential: ${raceErr.message}`);
        // Fall through to sequential failover
      }
    }

    // Sequential failover
    for (const { provider, model } of chain) {
      const prov = this._providers[provider];
      if (!prov) {
        errors.push({ provider, model, error: 'Provider not initialized' });
        continue;
      }

      const req = model ? { ...request, model } : request;

      try {
        let response;
        if (isStream) {
          response = await this.circuitBreaker.execute(provider, () => prov.stream(req, onChunk || (() => {})));
        } else {
          response = await this.circuitBreaker.execute(provider, () => prov.generate(req));
        }
        return response;
      } catch (err) {
        // Don't continue failover on budget errors
        if (err.code === 'BUDGET_EXCEEDED') throw err;

        this._log('warn', `[${requestId}] Provider ${provider}/${model} failed: ${err.message}`);
        errors.push({ provider, model: model || 'default', error: err.message, code: err.code });

        const taskType = request.taskType || 'general';
        this.router.recordOutcome(taskType, `${provider}/${model || 'default'}`, 'failure');
        this._metrics.failures++;
      }
    }

    // All providers failed
    const err = new Error(
      `All providers exhausted: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`
    );
    err.name           = 'AllProvidersFailedError';
    err.providerErrors = errors;
    err.statusCode     = 503;
    throw err;
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  _validateRequest(request) {
    if (!request) throw this._makeError('Request is required', 'INVALID_REQUEST', 400);
    if (!request.messages && !request.prompt) {
      throw this._makeError('Request must include messages[] or prompt', 'INVALID_REQUEST', 400);
    }
    if (request.messages && !Array.isArray(request.messages)) {
      throw this._makeError('messages must be an array', 'INVALID_REQUEST', 400);
    }
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      throw this._makeError('temperature must be between 0 and 2', 'INVALID_REQUEST', 400);
    }
  }

  _normalizeRequest(request, requestId) {
    const normalized = {
      requestId,
      taskType:    request.taskType    || 'general',
      messages:    request.messages    || (request.prompt ? [{ role: 'user', content: request.prompt }] : []),
      model:       request.model       || null,
      provider:    request.provider    || null,
      temperature: request.temperature ?? 0,
      maxTokens:   request.maxTokens   || 4096,
      stopSequences: request.stopSequences || null,
      noCache:     request.noCache     || false,
      _forceRace:  request._forceRace  || false,
    };

    // Apply cost-tracker auto-downgrade
    if (normalized.provider && normalized.model && this.costTracker) {
      const downgraded = this.costTracker.suggestDowngrade(normalized.provider, normalized.model);
      if (downgraded) normalized.model = downgraded;
    }

    return normalized;
  }

  // ─── Deduplication ────────────────────────────────────────────────────────

  _buildDedupKey(request) {
    const payload = JSON.stringify({
      messages:    request.messages,
      model:       request.model,
      taskType:    request.taskType,
      temperature: request.temperature,
      maxTokens:   request.maxTokens,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async health() {
    const results = await Promise.allSettled(
      Object.entries(this._providers).map(async ([id, prov]) => {
        try {
          const h = await prov.health();
          return { ...h, circuitState: this.circuitBreaker.getCircuit(id).state };
        } catch (err) {
          return { provider: id, status: 'unhealthy', error: err.message };
        }
      })
    );

    const providers = results.map(r =>
      r.status === 'fulfilled' ? r.value : { status: 'unknown', error: r.reason?.message }
    );

    const allHealthy  = providers.every(p => p.status === 'healthy' || p.status === 'disabled');
    const anyHealthy  = providers.some(p  => p.status === 'healthy');

    return {
      status:    allHealthy ? 'healthy' : (anyHealthy ? 'degraded' : 'unhealthy'),
      providers,
      cache:     this.cache.getStats(),
      costs:     this.costTracker.getCurrentTotals(),
      circuits:  this.circuitBreaker.getAllStats(),
      metrics:   this.getMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Providers Info ───────────────────────────────────────────────────────

  getProviders() {
    return Object.entries(this._providers).map(([id, prov]) => {
      const circuit = this.circuitBreaker.getCircuit(id);
      return {
        id,
        enabled:  prov.enabled,
        models:   Object.values(prov.config.models || {}),
        circuit:  circuit.getStats(),
        metrics:  prov.getMetrics(),
      };
    });
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  getMetrics() {
    return {
      ...this._metrics,
      avgLatencyMs: this._metrics.requests > 0
        ? Math.round(this._metrics.totalLatencyMs / this._metrics.requests)
        : 0,
      cacheHitRate: this._metrics.requests > 0
        ? this._metrics.cacheHits / this._metrics.requests
        : 0,
      racing:   this.racing.getAnalytics(),
      routing:  this.router.getStats(),
      circuits: this.circuitBreaker.getAllStats(),
    };
  }

  // ─── Audit ────────────────────────────────────────────────────────────────

  _auditRecord(requestId, request, response, startTime, outcome) {
    if (!this.config.logging.auditEnabled) return;

    const entry = {
      requestId,
      taskType:    request.taskType,
      provider:    response?.provider,
      model:       response?.model,
      outcome,
      latencyMs:   Date.now() - startTime,
      inputTokens: response?.usage?.inputTokens,
      outputTokens:response?.usage?.outputTokens,
      costUsd:     response?.costUsd,
      cached:      response?.cached || false,
      timestamp:   new Date().toISOString(),
    };

    this._auditLog.push(entry);
    if (this._auditLog.length > this._maxAuditEntries) {
      this._auditLog.shift();
    }
    this.emit('audit', entry);
  }

  getAuditLog(limit = 100) {
    return this._auditLog.slice(-limit);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  _newRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  _makeError(message, code, statusCode) {
    const err   = new Error(message);
    err.name    = 'InferError';
    err.code    = code;
    err.statusCode = statusCode;
    return err;
  }

  _log(level, message) {
    const entry = `[HeadyInfer] [${level.toUpperCase()}] ${message}`;
    if (level === 'error')      console.error(entry);
    else if (level === 'warn')  console.warn(entry);
    else if (this.config.logging.level !== 'silent') console.log(entry);
    this.emit('log', { level, message, timestamp: new Date().toISOString() });
  }

  // ─── Graceful Shutdown ────────────────────────────────────────────────────

  async shutdown() {
    this._log('info', 'HeadyInfer shutting down...');
    this._dedupMap.clear();
    this.emit('shutdown');
  }
}

// Factory function for convenience
function createHeadyInfer(cfg) {
  return new HeadyInfer(cfg || config);
}

module.exports = { HeadyInfer, createHeadyInfer };

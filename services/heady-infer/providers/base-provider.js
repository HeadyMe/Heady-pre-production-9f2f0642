'use strict';

const EventEmitter = require('events');

/**
 * BaseProvider — Abstract base class for all LLM provider adapters.
 *
 * Each concrete provider MUST implement:
 *   - generate(request)      → Promise<InferResponse>
 *   - stream(request, sink)  → Promise<void>  (sink is an async generator consumer)
 *   - health()               → Promise<HealthResult>
 *   - getModels()            → Promise<string[]>
 *
 * Optionally override:
 *   - parseResponse(raw)     → InferResponse
 *   - estimateCost(tokens, model) → number (USD)
 */
class BaseProvider extends EventEmitter {
  /**
   * @param {string} id       — Provider identifier (e.g. 'anthropic')
   * @param {object} config   — Provider-specific config slice
   */
  constructor(id, config) {
    super();
    if (new.target === BaseProvider) {
      throw new TypeError('BaseProvider is abstract — instantiate a concrete subclass');
    }
    this.id       = id;
    this.config   = config;
    this.enabled  = config.enabled !== false;
    this._metrics = {
      requests:  0,
      successes: 0,
      failures:  0,
      totalLatencyMs: 0,
      totalInputTokens:  0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
    };
  }

  // ─── Interface ────────────────────────────────────────────────────────────

  /**
   * Generate a completion (non-streaming).
   * @param {InferRequest} request
   * @returns {Promise<InferResponse>}
   */
  // eslint-disable-next-line no-unused-vars
  async generate(request) {
    throw new Error(`${this.id}.generate() not implemented`);
  }

  /**
   * Generate a streaming completion.
   * @param {InferRequest} request
   * @param {function(chunk: StreamChunk): void} onChunk
   * @returns {Promise<InferResponse>}  (final accumulated response)
   */
  // eslint-disable-next-line no-unused-vars
  async stream(request, onChunk) {
    throw new Error(`${this.id}.stream() not implemented`);
  }

  /**
   * Health check — returns quickly.
   * @returns {Promise<HealthResult>}
   */
  async health() {
    throw new Error(`${this.id}.health() not implemented`);
  }

  /**
   * List available models for this provider.
   * @returns {Promise<string[]>}
   */
  async getModels() {
    return Object.values(this.config.models || {});
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Parse raw provider response into a normalized InferResponse.
   * Subclasses should override this.
   */
  parseResponse(raw, model, startTime) {
    const latencyMs = Date.now() - startTime;
    return {
      provider:   this.id,
      model,
      content:    raw.content || raw.text || '',
      role:       'assistant',
      finishReason: raw.finish_reason || raw.stop_reason || 'stop',
      usage: {
        inputTokens:  raw.usage?.input_tokens  || raw.usage?.prompt_tokens     || 0,
        outputTokens: raw.usage?.output_tokens || raw.usage?.completion_tokens || 0,
        totalTokens:  (raw.usage?.input_tokens || raw.usage?.prompt_tokens || 0) +
                      (raw.usage?.output_tokens || raw.usage?.completion_tokens || 0),
      },
      latencyMs,
      costUsd:    this.estimateCost(
        raw.usage?.input_tokens  || raw.usage?.prompt_tokens     || 0,
        raw.usage?.output_tokens || raw.usage?.completion_tokens || 0,
        model
      ),
      timestamp:  new Date().toISOString(),
      raw,
    };
  }

  /**
   * Estimate cost in USD.
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {string} model
   * @returns {number}
   */
  estimateCost(inputTokens, outputTokens, model) {
    const pricing = this.config.pricing?.[model] || { input: 0, output: 0 };
    return (
      (inputTokens  / 1_000_000) * pricing.input  +
      (outputTokens / 1_000_000) * pricing.output
    );
  }

  /**
   * Record outcome metrics.
   * @param {'success'|'failure'} outcome
   * @param {number} latencyMs
   * @param {object} [usage]
   * @param {number} [costUsd]
   */
  recordMetric(outcome, latencyMs = 0, usage = {}, costUsd = 0) {
    this._metrics.requests++;
    this._metrics.totalLatencyMs += latencyMs;
    if (outcome === 'success') {
      this._metrics.successes++;
      this._metrics.totalInputTokens  += usage.inputTokens  || 0;
      this._metrics.totalOutputTokens += usage.outputTokens || 0;
      this._metrics.totalCostUsd      += costUsd;
    } else {
      this._metrics.failures++;
    }
    this.emit('metric', { provider: this.id, outcome, latencyMs, usage, costUsd });
  }

  /**
   * Return a copy of current metrics.
   */
  getMetrics() {
    const m = this._metrics;
    return {
      ...m,
      avgLatencyMs: m.requests > 0 ? Math.round(m.totalLatencyMs / m.requests) : 0,
      successRate:  m.requests > 0 ? (m.successes / m.requests) : 0,
    };
  }

  /**
   * Normalize messages array (handles both chat and legacy prompt formats).
   * @param {InferRequest} request
   * @returns {Array<{role:string, content:string}>}
   */
  normalizeMessages(request) {
    if (Array.isArray(request.messages) && request.messages.length > 0) {
      return request.messages;
    }
    if (request.prompt) {
      return [{ role: 'user', content: request.prompt }];
    }
    throw new Error('Request must include either messages[] or prompt');
  }

  /**
   * Select model: prefer request.model, fall back to task default, then provider default.
   * @param {InferRequest} request
   * @param {string} [taskType]
   * @returns {string}
   */
  selectModel(request, taskType) {
    if (request.model) return request.model;
    if (taskType === 'quick_task') return this.config.models?.fast || this.config.models?.default;
    if (taskType === 'architecture' || taskType === 'security_audit') {
      return this.config.models?.powerful || this.config.models?.default;
    }
    return this.config.models?.default;
  }

  /**
   * Throw a normalized ProviderError.
   */
  providerError(message, code, statusCode, raw) {
    const err = new Error(message);
    err.name        = 'ProviderError';
    err.provider    = this.id;
    err.code        = code;
    err.statusCode  = statusCode;
    err.raw         = raw;
    return err;
  }

  /**
   * Build AbortController with timeout.
   * @param {number} timeoutMs
   * @returns {{ controller: AbortController, clear: Function }}
   */
  withTimeout(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return {
      controller,
      clear: () => clearTimeout(timer),
    };
  }
}

module.exports = BaseProvider;

/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// ─── Base Adapter ─────────────────────────────────────────────────────────────

class BaseAdapter {
  constructor(name, config = {}) {
    this.name    = name;
    this.config  = config;
    this.baseUrl = config.baseUrl || '';
    this.apiKey  = config.apiKey  || process.env[`${name.toUpperCase()}_API_KEY`] || '';
    this._healthy = true;
    this._lastHealthCheck = null;
  }

  // ── Fetch Helper ──────────────────────────────────────────────────────────

  async _fetch(url, options = {}) {
    const controller  = new AbortController();
    const timeoutMs   = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const timeoutId   = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'Content-Type': 'application/json',
      ...this._authHeaders(),
      ...(options.headers || {}),
    };

    try {
      const res = await fetch(url, {
        method:  options.method || 'POST',
        headers,
        body:    options.body ? JSON.stringify(options.body) : undefined,
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        const err = new Error(`${this.name} API error ${res.status}: ${errorBody.slice(0, 200)}`);
        err.status = res.status;
        if (res.status === 429) {
          err.code        = 'RATE_LIMIT';
          err.retryAfter  = parseInt(res.headers.get('retry-after') || '5', 10);
        }
        throw err;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`${this.name} request timed out after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  _authHeaders() { return {}; }

  async health() {
    this._lastHealthCheck = Date.now();
    // Default: attempt a minimal API call; subclasses override
    return { provider: this.name, healthy: this._healthy, ts: new Date().toISOString() };
  }

  // Subclasses must implement:
  async generate()       { throw new Error(`${this.name}.generate not implemented`); }
  async embed()          { throw new Error(`${this.name}.embed not implemented`); }
  async streamGenerate() { throw new Error(`${this.name}.streamGenerate not implemented`); }
}

// ─── Anthropic Adapter ────────────────────────────────────────────────────────

class AnthropicAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('anthropic', { baseUrl: 'https://api.anthropic.com/v1', ...config });
    this.defaultModel = config.defaultModel || 'claude-sonnet-4-5';
  }

  _authHeaders() {
    return {
      'x-api-key':         this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async generate(prompt, opts = {}) {
    const model  = opts.model || this.defaultModel;
    const maxTok = opts.maxTokens || 4096;
    const system = opts.system || '';

    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = {
      model,
      max_tokens: maxTok,
      messages,
      ...(system ? { system } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    };

    const res  = await this._fetch(`${this.baseUrl}/messages`, { body });
    const data = await res.json();

    return {
      text:         data.content?.[0]?.text || '',
      inputTokens:  data.usage?.input_tokens  || 0,
      outputTokens: data.usage?.output_tokens || 0,
      model:        data.model,
      stopReason:   data.stop_reason,
      raw:          data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model  = opts.model || this.defaultModel;
    const maxTok = opts.maxTokens || 4096;

    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { model, max_tokens: maxTok, messages, stream: true };
    const res  = await this._fetch(`${this.baseUrl}/messages`, { body });
    return res.body; // ReadableStream
  }

  async embed() {
    throw new Error('Anthropic does not provide a public embedding endpoint');
  }

  async health() {
    try {
      // Lightweight model list call to verify API key
      const res = await this._fetch(`${this.baseUrl}/models`, { method: 'GET', timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      this._healthy = res.ok;
    } catch {
      this._healthy = false;
    }
    return { provider: 'anthropic', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── OpenAI Adapter ───────────────────────────────────────────────────────────

class OpenAIAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('openai', { baseUrl: 'https://api.openai.com/v1', ...config });
    this.defaultModel      = config.defaultModel      || 'gpt-4o';
    this.defaultEmbedModel = config.defaultEmbedModel || 'text-embedding-3-small';
  }

  _authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async generate(prompt, opts = {}) {
    const model = opts.model || this.defaultModel;

    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = {
      model,
      messages,
      ...(opts.maxTokens     ? { max_tokens:  opts.maxTokens }     : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.stream        ? { stream: true }                     : {}),
    };

    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    const data = await res.json();

    return {
      text:         data.choices?.[0]?.message?.content || '',
      inputTokens:  data.usage?.prompt_tokens     || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      model:        data.model,
      stopReason:   data.choices?.[0]?.finish_reason,
      raw:          data,
    };
  }

  async embed(text, opts = {}) {
    const model = opts.model || this.defaultEmbedModel;
    const input = Array.isArray(text) ? text : [text];

    const body = { model, input };
    const res  = await this._fetch(`${this.baseUrl}/embeddings`, { body });
    const data = await res.json();

    return {
      embeddings:  data.data?.map(d => d.embedding) || [],
      model:       data.model,
      totalTokens: data.usage?.total_tokens || 0,
      raw:         data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { model, messages, stream: true };
    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    return res.body;
  }

  async health() {
    try {
      const res  = await this._fetch(`${this.baseUrl}/models`, { method: 'GET', timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      this._healthy = res.ok;
    } catch {
      this._healthy = false;
    }
    return { provider: 'openai', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── Google Adapter ───────────────────────────────────────────────────────────

class GoogleAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('google', {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      ...config,
    });
    this.defaultModel = config.defaultModel || 'gemini-1.5-pro';
  }

  _authHeaders() {
    // Google uses query param; we'll add it to the URL
    return {};
  }

  _urlWithKey(path) {
    return `${this.baseUrl}${path}?key=${this.apiKey}`;
  }

  async generate(prompt, opts = {}) {
    const model = opts.model || this.defaultModel;
    const url   = this._urlWithKey(`/models/${model}:generateContent`);

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        ...(opts.maxTokens   ? { maxOutputTokens: opts.maxTokens }   : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      },
    };

    const res  = await this._fetch(url, { body });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      text,
      inputTokens:  data.usageMetadata?.promptTokenCount  || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      model,
      stopReason:   data.candidates?.[0]?.finishReason,
      raw:          data,
    };
  }

  async embed(text, opts = {}) {
    const model  = opts.model || 'text-embedding-004';
    const url    = this._urlWithKey(`/models/${model}:embedContent`);
    const input  = Array.isArray(text) ? text[0] : text;

    const body = { content: { parts: [{ text: input }] } };
    const res  = await this._fetch(url, { body });
    const data = await res.json();

    return {
      embeddings:  [data.embedding?.values || []],
      model,
      raw:         data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model = opts.model || this.defaultModel;
    const url   = this._urlWithKey(`/models/${model}:streamGenerateContent`);

    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const res  = await this._fetch(url, { body });
    return res.body;
  }

  async health() {
    try {
      const res = await this._fetch(this._urlWithKey('/models'), { method: 'GET', timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      this._healthy = res.ok;
    } catch {
      this._healthy = false;
    }
    return { provider: 'google', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── Groq Adapter ─────────────────────────────────────────────────────────────

class GroqAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('groq', { baseUrl: 'https://api.groq.com/openai/v1', ...config });
    this.defaultModel = config.defaultModel || 'llama3-8b-8192';
  }

  _authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async generate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = {
      model,
      messages,
      ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    };

    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    const data = await res.json();

    return {
      text:         data.choices?.[0]?.message?.content || '',
      inputTokens:  data.usage?.prompt_tokens     || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      model:        data.model,
      stopReason:   data.choices?.[0]?.finish_reason,
      raw:          data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { model, messages, stream: true };
    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    return res.body;
  }

  async embed() {
    throw new Error('Groq does not provide a public embedding endpoint');
  }

  async health() {
    try {
      const res = await this._fetch(`${this.baseUrl}/models`, { method: 'GET', timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      this._healthy = res.ok;
    } catch {
      this._healthy = false;
    }
    return { provider: 'groq', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── Perplexity Adapter ───────────────────────────────────────────────────────

class PerplexityAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('perplexity', { baseUrl: 'https://api.perplexity.ai', ...config });
    this.defaultModel = config.defaultModel || 'sonar-pro';
  }

  _authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async generate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = {
      model,
      messages,
      ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
    };

    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    const data = await res.json();

    return {
      text:         data.choices?.[0]?.message?.content || '',
      citations:    data.citations || [],
      inputTokens:  data.usage?.prompt_tokens     || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      model:        data.model,
      raw:          data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { model, messages, stream: true };
    const res  = await this._fetch(`${this.baseUrl}/chat/completions`, { body });
    return res.body;
  }

  async embed() {
    throw new Error('Perplexity does not provide a standalone embedding endpoint');
  }

  async health() {
    // Perplexity has no public health endpoint; assume healthy if key set
    this._healthy = Boolean(this.apiKey);
    return { provider: 'perplexity', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── Cloudflare Workers AI Adapter ───────────────────────────────────────────

class CloudflareAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('cloudflare', {
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${config.accountId || process.env.CF_ACCOUNT_ID}/ai/run`,
      ...config,
    });
    this.defaultModel      = config.defaultModel      || '@cf/meta/llama-3.1-8b-instruct';
    this.defaultEmbedModel = config.defaultEmbedModel || '@cf/baai/bge-large-en-v1.5';
    this.accountId         = config.accountId         || process.env.CF_ACCOUNT_ID;
  }

  _authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async generate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { messages };
    const res  = await this._fetch(`${this.baseUrl}/${model}`, { body });
    const data = await res.json();

    return {
      text:       data.result?.response || '',
      model,
      raw:        data,
    };
  }

  async embed(text, opts = {}) {
    const model = opts.model || this.defaultEmbedModel;
    const input = Array.isArray(text) ? text : [text];

    const body = { text: input };
    const res  = await this._fetch(`${this.baseUrl}/${model}`, { body });
    const data = await res.json();

    return {
      embeddings: data.result?.data || [],
      model,
      raw:        data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model    = opts.model || this.defaultModel;
    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];

    const body = { messages, stream: true };
    const res  = await this._fetch(`${this.baseUrl}/${model}`, { body });
    return res.body;
  }

  async health() {
    this._healthy = Boolean(this.apiKey && this.accountId);
    return { provider: 'cloudflare', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── Local (Ollama) Adapter ───────────────────────────────────────────────────

class LocalAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('local', {
      baseUrl: config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      ...config,
    });
    this.defaultModel      = config.defaultModel      || 'llama3';
    this.defaultEmbedModel = config.defaultEmbedModel || 'nomic-embed-text';
  }

  _authHeaders() {
    return {}; // Ollama does not require auth by default
  }

  async generate(prompt, opts = {}) {
    const model = opts.model || this.defaultModel;
    const body  = {
      model,
      prompt,
      stream:  false,
      ...(opts.temperature !== undefined ? { options: { temperature: opts.temperature } } : {}),
    };

    const res  = await this._fetch(`${this.baseUrl}/api/generate`, { body });
    const data = await res.json();

    return {
      text:         data.response || '',
      model:        data.model,
      evalCount:    data.eval_count,
      raw:          data,
    };
  }

  async embed(text, opts = {}) {
    const model = opts.model || this.defaultEmbedModel;
    const input = Array.isArray(text) ? text[0] : text;

    const body = { model, prompt: input };
    const res  = await this._fetch(`${this.baseUrl}/api/embeddings`, { body });
    const data = await res.json();

    return {
      embeddings: [data.embedding || []],
      model,
      raw:        data,
    };
  }

  async streamGenerate(prompt, opts = {}) {
    const model = opts.model || this.defaultModel;
    const body  = { model, prompt, stream: true };
    const res   = await this._fetch(`${this.baseUrl}/api/generate`, { body });
    return res.body;
  }

  async health() {
    try {
      const res = await this._fetch(`${this.baseUrl}/api/tags`, { method: 'GET', timeoutMs: HEALTH_CHECK_TIMEOUT_MS });
      this._healthy = res.ok;
    } catch {
      this._healthy = false;
    }
    return { provider: 'local', healthy: this._healthy, ts: new Date().toISOString() };
  }
}

// ─── ProviderConnector ────────────────────────────────────────────────────────

class ProviderConnector {
  constructor(config = {}) {
    this.config = config;

    this.adapters = {
      anthropic:  new AnthropicAdapter(config.anthropic   || {}),
      openai:     new OpenAIAdapter(config.openai          || {}),
      google:     new GoogleAdapter(config.google          || {}),
      groq:       new GroqAdapter(config.groq              || {}),
      perplexity: new PerplexityAdapter(config.perplexity  || {}),
      cloudflare: new CloudflareAdapter(config.cloudflare  || {}),
      local:      new LocalAdapter(config.local            || {}),
    };

    logger.logSystem('ProviderConnector', 'Initialized', {
      providers: Object.keys(this.adapters),
    });
  }

  // ── Unified Interface ──────────────────────────────────────────────────────

  async generate(provider, prompt, opts = {}) {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    return adapter.generate(prompt, opts);
  }

  async embed(provider, text, opts = {}) {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    return adapter.embed(text, opts);
  }

  async streamGenerate(provider, prompt, opts = {}) {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`Unknown provider: ${provider}`);
    return adapter.streamGenerate(prompt, opts);
  }

  // ── Health Check All ──────────────────────────────────────────────────────

  async healthAll() {
    const results = await Promise.allSettled(
      Object.entries(this.adapters).map(async ([name, adapter]) => {
        const h = await adapter.health();
        return { ...h, provider: name };
      })
    );

    const summary = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        summary[r.value.provider] = r.value;
      } else {
        summary[r.reason?.provider || 'unknown'] = { healthy: false, error: r.reason?.message };
      }
    }

    return summary;
  }

  // ── Register Custom Adapter ────────────────────────────────────────────────

  registerAdapter(name, adapter) {
    if (!(adapter instanceof BaseAdapter)) {
      throw new Error('adapter must extend BaseAdapter');
    }
    this.adapters[name] = adapter;
    logger.logSystem('ProviderConnector', `Registered custom adapter: ${name}`, {});
  }
}

module.exports = {
  ProviderConnector,
  BaseAdapter,
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  GroqAdapter,
  PerplexityAdapter,
  CloudflareAdapter,
  LocalAdapter,
};

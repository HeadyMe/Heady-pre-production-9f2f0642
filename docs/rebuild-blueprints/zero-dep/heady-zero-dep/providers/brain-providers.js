/**
 * @file brain-providers.js
 * @description Unified LLM provider adapters.
 *
 * Unified interface: generate(), stream(), embed(), health(), tokenCount()
 * Providers: Anthropic Claude, OpenAI GPT, Google Gemini, Groq, Perplexity Sonar, Local Ollama
 * Transport: native fetch() only — zero external dependencies.
 * Streaming: ReadableStream (WHATWG) wrapping SSE event streams.
 * Error normalization: all errors become ProviderError with .provider + .status.
 *
 * Sacred Geometry: PHI-scaled timeouts, retry delays.
 *
 * @module HeadyProviders/BrainProviders
 */

import { EventEmitter } from 'events';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;

const phiDelay = (n, base = 1000) => Math.round(base * Math.pow(PHI, n));

// ─── Provider Error ───────────────────────────────────────────────────────────
export class ProviderError extends Error {
  constructor(message, { provider, status, code, retryable = false, raw } = {}) {
    super(message);
    this.name      = 'ProviderError';
    this.provider  = provider  ?? 'unknown';
    this.status    = status    ?? 0;
    this.code      = code      ?? 'PROVIDER_ERROR';
    this.retryable = retryable;
    this.raw       = raw;
  }
}

// ─── Token Estimation ─────────────────────────────────────────────────────────
/**
 * Rough token count (≈4 chars/token for English).
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

// ─── Base Provider ────────────────────────────────────────────────────────────
export class BaseProvider extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name        = name;
    this._config     = config;
    this._healthy    = true;
    this._lastCheck  = 0;
    this._latencyMs  = [];   // rolling window of last 13 (Fibonacci) latencies
  }

  /** Record latency sample (rolling 13-sample window) */
  _recordLatency(ms) {
    this._latencyMs.push(ms);
    if (this._latencyMs.length > 13) this._latencyMs.shift();
  }

  /** Average latency over recent samples */
  avgLatency() {
    if (!this._latencyMs.length) return 0;
    return this._latencyMs.reduce((a, b) => a + b, 0) / this._latencyMs.length;
  }

  async _fetch(url, opts, timeoutMs = 30_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const t0 = Date.now();
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      this._recordLatency(Date.now() - t0);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  _normalizeError(err, provider) {
    if (err instanceof ProviderError) return err;
    if (err.name === 'AbortError') {
      return new ProviderError('Request timed out', { provider, code: 'TIMEOUT', retryable: true });
    }
    return new ProviderError(err.message, { provider, code: 'NETWORK_ERROR', retryable: true });
  }

  /** Parse error from API response body */
  async _parseErrorBody(res, provider) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore */ }
    const msg = body?.error?.message ?? body?.message ?? `HTTP ${res.status}`;
    const retryable = res.status === 429 || res.status >= 500;
    return new ProviderError(msg, { provider, status: res.status, retryable, raw: body });
  }

  /** Must be implemented by subclass */
  async generate(/* messages, opts */)  { throw new Error(`${this.name}.generate() not implemented`); }
  async embed(/* texts */)              { throw new Error(`${this.name}.embed() not implemented`); }
  async health()                        { return { healthy: this._healthy, provider: this.name }; }
  tokenCount(text)                      { return estimateTokens(text); }
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────
export class AnthropicProvider extends BaseProvider {
  static BASE_URL = 'https://api.anthropic.com/v1';
  static API_VERSION = '2023-06-01';

  constructor(config = {}) {
    super('anthropic', config);
    this._apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this._model  = config.model  ?? 'claude-opus-4-5';
  }

  _headers() {
    return {
      'Content-Type':      'application/json',
      'x-api-key':         this._apiKey,
      'anthropic-version': AnthropicProvider.API_VERSION,
    };
  }

  /**
   * @param {Array}  messages  [{role, content}]
   * @param {object} opts
   * @param {string} [opts.model]
   * @param {number} [opts.maxTokens]
   * @param {string} [opts.system]
   * @param {number} [opts.temperature]
   */
  async generate(messages, opts = {}) {
    const model     = opts.model      ?? this._model;
    const maxTokens = opts.maxTokens  ?? 4096;
    const body      = {
      model,
      max_tokens: maxTokens,
      messages,
      ...(opts.system      ? { system: opts.system }           : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    };

    let res;
    try {
      res = await this._fetch(`${AnthropicProvider.BASE_URL}/messages`, {
        method:  'POST',
        headers: this._headers(),
        body:    JSON.stringify(body),
      }, opts.timeoutMs ?? 60_000);
    } catch (e) {
      throw this._normalizeError(e, this.name);
    }

    if (!res.ok) throw await this._parseErrorBody(res, this.name);

    const data = await res.json();
    return {
      content:       data.content?.[0]?.text ?? '',
      model:         data.model,
      inputTokens:   data.usage?.input_tokens  ?? 0,
      outputTokens:  data.usage?.output_tokens ?? 0,
      stopReason:    data.stop_reason,
      raw:           data,
    };
  }

  /**
   * Returns a ReadableStream of text chunks.
   */
  stream(messages, opts = {}) {
    const model     = opts.model     ?? this._model;
    const maxTokens = opts.maxTokens ?? 4096;

    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(`${AnthropicProvider.BASE_URL}/messages`, {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify({
              model, max_tokens: maxTokens, messages,
              ...(opts.system ? { system: opts.system } : {}),
              stream: true,
            }),
          }, opts.timeoutMs ?? 120_000);
        } catch (e) {
          controller.error(this._normalizeError(e, this.name));
          return;
        }

        if (!res.ok) {
          controller.error(await this._parseErrorBody(res, this.name));
          return;
        }

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf      = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          const lines = buf.split('\n');
          buf = lines.pop(); // last partial line

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const evt = JSON.parse(raw);
              const text = evt?.delta?.text ?? evt?.delta?.value ?? '';
              if (text) controller.enqueue(text);
            } catch { /* skip malformed */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(/* texts */) {
    throw new ProviderError('Anthropic does not support embeddings', {
      provider: this.name, code: 'NOT_SUPPORTED',
    });
  }

  async health() {
    try {
      const res = await this._fetch(`${AnthropicProvider.BASE_URL}/models`, {
        headers: this._headers(),
      }, 5_000);
      this._healthy = res.ok || res.status === 403; // 403 = key valid but no permission
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── OpenAI GPT ───────────────────────────────────────────────────────────────
export class OpenAIProvider extends BaseProvider {
  static BASE_URL = 'https://api.openai.com/v1';

  constructor(config = {}) {
    super('openai', config);
    this._apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this._model  = config.model  ?? 'gpt-4o';
    this._org    = config.org    ?? process.env.OPENAI_ORG_ID ?? '';
  }

  _headers() {
    const h = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${this._apiKey}`,
    };
    if (this._org) h['OpenAI-Organization'] = this._org;
    return h;
  }

  async generate(messages, opts = {}) {
    const body = {
      model:       opts.model       ?? this._model,
      messages,
      max_tokens:  opts.maxTokens   ?? 4096,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature }   : {}),
      ...(opts.system      ? { messages: [{ role: 'system', content: opts.system }, ...messages] } : {}),
    };

    let res;
    try {
      res = await this._fetch(`${OpenAIProvider.BASE_URL}/chat/completions`, {
        method: 'POST', headers: this._headers(), body: JSON.stringify(body),
      }, opts.timeoutMs ?? 60_000);
    } catch (e) { throw this._normalizeError(e, this.name); }

    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();

    return {
      content:      data.choices?.[0]?.message?.content ?? '',
      model:        data.model,
      inputTokens:  data.usage?.prompt_tokens     ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      stopReason:   data.choices?.[0]?.finish_reason,
      raw:          data,
    };
  }

  stream(messages, opts = {}) {
    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(`${OpenAIProvider.BASE_URL}/chat/completions`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({
              model:      opts.model ?? this._model,
              messages,
              max_tokens: opts.maxTokens ?? 4096,
              stream:     true,
            }),
          }, opts.timeoutMs ?? 120_000);
        } catch (e) { controller.error(this._normalizeError(e, this.name)); return; }

        if (!res.ok) { controller.error(await this._parseErrorBody(res, this.name)); return; }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const evt = JSON.parse(raw);
              const text = evt?.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(text);
            } catch { /* skip */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(texts, opts = {}) {
    const input = Array.isArray(texts) ? texts : [texts];
    let res;
    try {
      res = await this._fetch(`${OpenAIProvider.BASE_URL}/embeddings`, {
        method: 'POST', headers: this._headers(),
        body: JSON.stringify({ model: opts.model ?? 'text-embedding-3-small', input }),
      }, opts.timeoutMs ?? 30_000);
    } catch (e) { throw this._normalizeError(e, this.name); }

    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();
    return {
      embeddings:   data.data.map(d => d.embedding),
      model:        data.model,
      inputTokens:  data.usage?.prompt_tokens ?? 0,
      raw:          data,
    };
  }

  async health() {
    try {
      const res = await this._fetch(`${OpenAIProvider.BASE_URL}/models`, {
        headers: this._headers(),
      }, 5_000);
      this._healthy = res.ok;
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
export class GeminiProvider extends BaseProvider {
  static BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config = {}) {
    super('google', config);
    this._apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY ?? '';
    this._model  = config.model  ?? 'gemini-2.0-flash';
  }

  _url(path) { return `${GeminiProvider.BASE_URL}${path}?key=${this._apiKey}`; }

  _toGeminiMessages(messages) {
    return messages.map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  async generate(messages, opts = {}) {
    const model  = opts.model ?? this._model;
    const body   = {
      contents: this._toGeminiMessages(messages),
      generationConfig: {
        maxOutputTokens: opts.maxTokens   ?? 4096,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      },
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    };

    let res;
    try {
      res = await this._fetch(this._url(`/models/${model}:generateContent`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }, opts.timeoutMs ?? 60_000);
    } catch (e) { throw this._normalizeError(e, this.name); }

    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();

    return {
      content:      data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      model,
      inputTokens:  data.usageMetadata?.promptTokenCount    ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      stopReason:   data.candidates?.[0]?.finishReason,
      raw:          data,
    };
  }

  stream(messages, opts = {}) {
    const model = opts.model ?? this._model;
    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(this._url(`/models/${model}:streamGenerateContent`), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: this._toGeminiMessages(messages),
              generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
            }),
          }, opts.timeoutMs ?? 120_000);
        } catch (e) { controller.error(this._normalizeError(e, this.name)); return; }

        if (!res.ok) { controller.error(await this._parseErrorBody(res, this.name)); return; }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          // Gemini returns a JSON array of response chunks separated by newlines
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;
            try {
              const evt = JSON.parse(trimmed.replace(/^,/, ''));
              const text = evt?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
              if (text) controller.enqueue(text);
            } catch { /* skip */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(texts, opts = {}) {
    const model  = opts.model ?? 'text-embedding-004';
    const input  = Array.isArray(texts) ? texts : [texts];
    const results = [];
    let totalTokens = 0;

    for (const text of input) {
      let res;
      try {
        res = await this._fetch(this._url(`/models/${model}:embedContent`), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
        }, 30_000);
      } catch (e) { throw this._normalizeError(e, this.name); }
      if (!res.ok) throw await this._parseErrorBody(res, this.name);
      const data = await res.json();
      results.push(data.embedding?.values ?? []);
      totalTokens += estimateTokens(text);
    }

    return { embeddings: results, model, inputTokens: totalTokens, raw: null };
  }

  async health() {
    try {
      const res = await this._fetch(this._url('/models'), {}, 5_000);
      this._healthy = res.ok;
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
export class GroqProvider extends BaseProvider {
  static BASE_URL = 'https://api.groq.com/openai/v1';

  constructor(config = {}) {
    super('groq', config);
    this._apiKey = config.apiKey ?? process.env.GROQ_API_KEY ?? '';
    this._model  = config.model  ?? 'llama-3.3-70b-versatile';
  }

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._apiKey}` };
  }

  async generate(messages, opts = {}) {
    let res;
    try {
      res = await this._fetch(`${GroqProvider.BASE_URL}/chat/completions`, {
        method: 'POST', headers: this._headers(),
        body: JSON.stringify({
          model: opts.model ?? this._model,
          messages,
          max_tokens:  opts.maxTokens ?? 4096,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        }),
      }, opts.timeoutMs ?? 30_000);
    } catch (e) { throw this._normalizeError(e, this.name); }
    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();
    return {
      content:      data.choices?.[0]?.message?.content ?? '',
      model:        data.model,
      inputTokens:  data.usage?.prompt_tokens     ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      stopReason:   data.choices?.[0]?.finish_reason,
      raw:          data,
    };
  }

  stream(messages, opts = {}) {
    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(`${GroqProvider.BASE_URL}/chat/completions`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({ model: opts.model ?? this._model, messages, stream: true }),
          }, opts.timeoutMs ?? 60_000);
        } catch (e) { controller.error(this._normalizeError(e, this.name)); return; }
        if (!res.ok) { controller.error(await this._parseErrorBody(res, this.name)); return; }

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const evt = JSON.parse(raw);
              const text = evt?.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(text);
            } catch { /* skip */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(/* texts */) {
    throw new ProviderError('Groq does not support embeddings', {
      provider: this.name, code: 'NOT_SUPPORTED',
    });
  }

  async health() {
    try {
      const res = await this._fetch(`${GroqProvider.BASE_URL}/models`, {
        headers: this._headers(),
      }, 5_000);
      this._healthy = res.ok;
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── Perplexity Sonar ─────────────────────────────────────────────────────────
export class PerplexityProvider extends BaseProvider {
  static BASE_URL = 'https://api.perplexity.ai';

  constructor(config = {}) {
    super('perplexity', config);
    this._apiKey = config.apiKey ?? process.env.PERPLEXITY_API_KEY ?? '';
    this._model  = config.model  ?? 'sonar-pro';
  }

  _headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._apiKey}` };
  }

  async generate(messages, opts = {}) {
    let res;
    try {
      res = await this._fetch(`${PerplexityProvider.BASE_URL}/chat/completions`, {
        method: 'POST', headers: this._headers(),
        body: JSON.stringify({
          model: opts.model ?? this._model,
          messages,
          max_tokens: opts.maxTokens ?? 4096,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        }),
      }, opts.timeoutMs ?? 60_000);
    } catch (e) { throw this._normalizeError(e, this.name); }
    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();
    return {
      content:      data.choices?.[0]?.message?.content ?? '',
      model:        data.model,
      inputTokens:  data.usage?.prompt_tokens     ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      stopReason:   data.choices?.[0]?.finish_reason,
      citations:    data.citations ?? [],
      raw:          data,
    };
  }

  stream(messages, opts = {}) {
    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(`${PerplexityProvider.BASE_URL}/chat/completions`, {
            method: 'POST', headers: this._headers(),
            body: JSON.stringify({
              model: opts.model ?? this._model, messages, stream: true,
            }),
          }, opts.timeoutMs ?? 120_000);
        } catch (e) { controller.error(this._normalizeError(e, this.name)); return; }
        if (!res.ok) { controller.error(await this._parseErrorBody(res, this.name)); return; }

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const evt  = JSON.parse(raw);
              const text = evt?.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(text);
            } catch { /* skip */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(/* texts */) {
    throw new ProviderError('Perplexity does not support embeddings', {
      provider: this.name, code: 'NOT_SUPPORTED',
    });
  }

  async health() {
    // Perplexity has no explicit health endpoint; attempt a tiny completion
    try {
      const res = await this._fetch(`${PerplexityProvider.BASE_URL}/chat/completions`, {
        method: 'POST', headers: this._headers(),
        body: JSON.stringify({
          model: 'sonar', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1,
        }),
      }, 8_000);
      this._healthy = res.ok || res.status === 400;
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── Ollama (Local) ────────────────────────────────────────────────────────────
export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super('ollama', config);
    this._baseUrl = config.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this._model   = config.model   ?? 'llama3.2';
  }

  async generate(messages, opts = {}) {
    // Ollama /api/chat endpoint (OpenAI-compatible)
    let res;
    try {
      res = await this._fetch(`${this._baseUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:    opts.model ?? this._model,
          messages,
          stream:   false,
          options:  { ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}) },
        }),
      }, opts.timeoutMs ?? 120_000);
    } catch (e) { throw this._normalizeError(e, this.name); }
    if (!res.ok) throw await this._parseErrorBody(res, this.name);
    const data = await res.json();
    return {
      content:      data.message?.content ?? '',
      model:        data.model,
      inputTokens:  data.prompt_eval_count  ?? estimateTokens(messages.map(m => m.content).join(' ')),
      outputTokens: data.eval_count         ?? 0,
      stopReason:   data.done_reason        ?? (data.done ? 'stop' : null),
      raw:          data,
    };
  }

  stream(messages, opts = {}) {
    return new ReadableStream({
      start: async (controller) => {
        let res;
        try {
          res = await this._fetch(`${this._baseUrl}/api/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: opts.model ?? this._model, messages, stream: true }),
          }, opts.timeoutMs ?? 180_000);
        } catch (e) { controller.error(this._normalizeError(e, this.name)); return; }
        if (!res.ok) { controller.error(await this._parseErrorBody(res, this.name)); return; }

        const reader = res.body.getReader();
        const dec    = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              const text = evt?.message?.content ?? '';
              if (text) controller.enqueue(text);
              if (evt?.done) { controller.close(); return; }
            } catch { /* skip */ }
          }
        }
        controller.close();
      },
    });
  }

  async embed(texts, opts = {}) {
    const model = opts.model ?? this._model;
    const input = Array.isArray(texts) ? texts : [texts];
    const results = [];

    for (const prompt of input) {
      let res;
      try {
        res = await this._fetch(`${this._baseUrl}/api/embed`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: prompt }),
        }, 30_000);
      } catch (e) { throw this._normalizeError(e, this.name); }
      if (!res.ok) throw await this._parseErrorBody(res, this.name);
      const data = await res.json();
      results.push(data.embeddings?.[0] ?? data.embedding ?? []);
    }

    return { embeddings: results, model, inputTokens: input.reduce((a, t) => a + estimateTokens(t), 0) };
  }

  async health() {
    try {
      const res = await this._fetch(`${this._baseUrl}/api/tags`, {}, 5_000);
      this._healthy = res.ok;
      return { healthy: this._healthy, provider: this.name, status: res.status };
    } catch (e) {
      this._healthy = false;
      return { healthy: false, provider: this.name, error: e.message };
    }
  }
}

// ─── Provider Registry ────────────────────────────────────────────────────────
export class ProviderRegistry {
  constructor() {
    this._providers = new Map();
  }

  register(provider) {
    this._providers.set(provider.name, provider);
    return this;
  }

  get(name) {
    return this._providers.get(name) ?? null;
  }

  list() {
    return [...this._providers.keys()];
  }

  async healthAll() {
    const results = {};
    await Promise.allSettled(
      [...this._providers.entries()].map(async ([name, p]) => {
        try { results[name] = await p.health(); }
        catch (e) { results[name] = { healthy: false, provider: name, error: e.message }; }
      })
    );
    return results;
  }
}

// ─── Default Registry ─────────────────────────────────────────────────────────
let _registry = null;

export function getProviderRegistry(config = {}) {
  if (_registry) return _registry;
  _registry = new ProviderRegistry()
    .register(new AnthropicProvider  (config.anthropic  ?? {}))
    .register(new OpenAIProvider     (config.openai     ?? {}))
    .register(new GeminiProvider     (config.gemini     ?? {}))
    .register(new GroqProvider       (config.groq       ?? {}))
    .register(new PerplexityProvider (config.perplexity ?? {}))
    .register(new OllamaProvider     (config.ollama     ?? {}));
  return _registry;
}

export default {
  BaseProvider, AnthropicProvider, OpenAIProvider, GeminiProvider,
  GroqProvider, PerplexityProvider, OllamaProvider,
  ProviderRegistry, getProviderRegistry, ProviderError, estimateTokens,
};

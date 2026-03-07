'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const BaseProvider = require('./base-provider');

/**
 * OpenAIProvider — GPT adapter
 * Supports: gpt-4o, gpt-4o-mini, o1
 * Uses the OpenAI Chat Completions API (v1/chat/completions).
 */
class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super('openai', config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
  }

  _buildHeaders(payloadLen) {
    const headers = {
      'Content-Type':   'application/json',
      'Content-Length': payloadLen,
      'Authorization':  `Bearer ${this.config.apiKey}`,
      'User-Agent':     'heady-infer/1.0',
    };
    if (this.config.orgId) headers['OpenAI-Organization'] = this.config.orgId;
    return headers;
  }

  _request(path, body, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(path, this.baseUrl);
      const payload = JSON.stringify(body);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers:  this._buildHeaders(Buffer.byteLength(payload)),
        timeout:  timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(j.error?.message || `HTTP ${res.statusCode}`, j.error?.code || 'api_error', res.statusCode, j));
            } else {
              resolve(j);
            }
          } catch (e) {
            reject(this.providerError(`Parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
      });
      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      req.write(payload);
      req.end();
    });
  }

  _streamRequest(body, onChunk, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const path    = '/v1/chat/completions';
      const parsed  = new URL(path, this.baseUrl);
      const payload = JSON.stringify({ ...body, stream: true });
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers:  this._buildHeaders(Buffer.byteLength(payload)),
        timeout:  timeoutMs,
      };

      let buffer = '';
      let accContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      const model = body.model;

      const req = lib.request(options, (res) => {
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const evt   = JSON.parse(data);
              const delta = evt.choices?.[0]?.delta?.content;
              if (delta) {
                accContent += delta;
                onChunk({ type: 'delta', text: delta, provider: 'openai' });
              }
              if (evt.usage) {
                promptTokens     = evt.usage.prompt_tokens     || 0;
                completionTokens = evt.usage.completion_tokens || 0;
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          onChunk({ type: 'done', provider: 'openai' });
          resolve({
            provider: 'openai',
            model,
            content: accContent,
            role: 'assistant',
            finishReason: 'stop',
            usage: {
              inputTokens:  promptTokens,
              outputTokens: completionTokens,
              totalTokens:  promptTokens + completionTokens,
            },
            costUsd: this.estimateCost(promptTokens, completionTokens, model),
            timestamp: new Date().toISOString(),
          });
        });
        res.on('error', reject);
      });

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Stream timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      req.write(payload);
      req.end();
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async generate(request) {
    if (!this.enabled) throw this.providerError('OpenAI provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);

    // o1 models don't support system messages or temperature
    const isO1 = model.startsWith('o1');
    const filteredMessages = isO1 ? messages.filter(m => m.role !== 'system') : messages;

    const body = {
      model,
      messages: filteredMessages,
      max_tokens:   isO1 ? undefined : (request.maxTokens || 4096),
      ...(request.maxTokens && isO1 && { max_completion_tokens: request.maxTokens }),
      ...(!isO1 && request.temperature !== undefined && { temperature: request.temperature }),
      ...(!isO1 && request.stopSequences && { stop: request.stopSequences }),
      stream_options: undefined,
    };

    // Clean undefined keys
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

    const { controller, clear } = this.withTimeout(this.config.timeout);
    try {
      const raw      = await this._request('/v1/chat/completions', body, this.config.timeout, controller.signal);
      const choice   = raw.choices?.[0];
      const content  = choice?.message?.content || '';
      const response = {
        provider:     'openai',
        model:        raw.model || model,
        content,
        role:         'assistant',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          inputTokens:  raw.usage?.prompt_tokens     || 0,
          outputTokens: raw.usage?.completion_tokens || 0,
          totalTokens:  raw.usage?.total_tokens      || 0,
        },
        latencyMs: Date.now() - startTime,
        costUsd:   this.estimateCost(raw.usage?.prompt_tokens || 0, raw.usage?.completion_tokens || 0, raw.model || model),
        timestamp: new Date().toISOString(),
        raw,
      };
      this.recordMetric('success', response.latencyMs, response.usage, response.costUsd);
      return response;
    } catch (err) {
      this.recordMetric('failure', Date.now() - startTime);
      throw err;
    } finally {
      clear();
    }
  }

  async stream(request, onChunk) {
    if (!this.enabled) throw this.providerError('OpenAI provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);
    const isO1      = model.startsWith('o1');

    const body = {
      model,
      messages,
      max_tokens: isO1 ? undefined : (request.maxTokens || 4096),
      ...(!isO1 && request.temperature !== undefined && { temperature: request.temperature }),
      stream_options: { include_usage: true },
    };
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

    const { controller, clear } = this.withTimeout(this.config.timeout * 4);
    try {
      const response = await this._streamRequest(body, onChunk, this.config.timeout * 4, controller.signal);
      response.latencyMs = Date.now() - startTime;
      this.recordMetric('success', response.latencyMs, response.usage, response.costUsd);
      return response;
    } catch (err) {
      this.recordMetric('failure', Date.now() - startTime);
      throw err;
    } finally {
      clear();
    }
  }

  async health() {
    if (!this.enabled) return { provider: 'openai', status: 'disabled', latencyMs: 0 };
    const start = Date.now();
    try {
      await this._request('/v1/models', null, this.config.timeouts?.health || 5000, null);
      return { provider: 'openai', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      // Fall back to a minimal completion
      try {
        await this._request('/v1/chat/completions', {
          model:      'gpt-4o-mini',
          messages:   [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }, 5000, null);
        return { provider: 'openai', status: 'healthy', latencyMs: Date.now() - start };
      } catch (err2) {
        return { provider: 'openai', status: 'unhealthy', latencyMs: Date.now() - start, error: err2.message };
      }
    }
  }

  _request(path, body, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(path, this.baseUrl);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const method  = body ? 'POST' : 'GET';
      const payload = body ? JSON.stringify(body) : '';

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method,
        headers:  this._buildHeaders(Buffer.byteLength(payload)),
        timeout:  timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(j.error?.message || `HTTP ${res.statusCode}`, j.error?.code || 'api_error', res.statusCode, j));
            } else {
              resolve(j);
            }
          } catch (e) {
            reject(this.providerError(`Parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
      });
      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      if (payload) req.write(payload);
      req.end();
    });
  }

  async getModels() {
    return Object.values(this.config.models || {}).filter(Boolean);
  }
}

module.exports = OpenAIProvider;

'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const BaseProvider = require('./base-provider');

/**
 * GroqProvider — Ultra-fast inference via Groq Cloud
 * Supports: llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
 * API is OpenAI-compatible.
 */
class GroqProvider extends BaseProvider {
  constructor(config) {
    super('groq', config);
    this.baseUrl = config.baseUrl || 'https://api.groq.com/openai';
  }

  _request(path, body, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(path, this.baseUrl);
      const payload = body ? JSON.stringify(body) : '';
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   body ? 'POST' : 'GET',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization':  `Bearer ${this.config.apiKey}`,
          'User-Agent':     'heady-infer/1.0',
        },
        timeout: timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(j.error?.message || `HTTP ${res.statusCode}`, j.error?.type || 'api_error', res.statusCode, j));
            } else {
              resolve(j);
            }
          } catch (e) {
            reject(this.providerError(`Parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      if (payload) req.write(payload);
      req.end();
    });
  }

  _streamRequest(body, onChunk, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL('/v1/chat/completions', this.baseUrl);
      const payload = JSON.stringify({ ...body, stream: true });
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization':  `Bearer ${this.config.apiKey}`,
        },
        timeout: timeoutMs,
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
                onChunk({ type: 'delta', text: delta, provider: 'groq' });
              }
              if (evt.x_groq?.usage) {
                promptTokens     = evt.x_groq.usage.prompt_tokens     || 0;
                completionTokens = evt.x_groq.usage.completion_tokens || 0;
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          onChunk({ type: 'done', provider: 'groq' });
          resolve({
            provider: 'groq',
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

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      req.write(payload);
      req.end();
    });
  }

  async generate(request) {
    if (!this.enabled) throw this.providerError('Groq provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);

    const body = {
      model,
      messages,
      max_tokens: request.maxTokens || 4096,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.stopSequences && { stop: request.stopSequences }),
    };

    const { controller, clear } = this.withTimeout(this.config.timeout);
    try {
      const raw      = await this._request('/v1/chat/completions', body, this.config.timeout, controller.signal);
      const choice   = raw.choices?.[0];
      const response = {
        provider:     'groq',
        model:        raw.model || model,
        content:      choice?.message?.content || '',
        role:         'assistant',
        finishReason: choice?.finish_reason || 'stop',
        usage: {
          inputTokens:  raw.usage?.prompt_tokens     || 0,
          outputTokens: raw.usage?.completion_tokens || 0,
          totalTokens:  raw.usage?.total_tokens       || 0,
        },
        latencyMs: Date.now() - startTime,
        costUsd:   this.estimateCost(raw.usage?.prompt_tokens || 0, raw.usage?.completion_tokens || 0, raw.model || model),
        timestamp: new Date().toISOString(),
        // Groq provides response time metadata
        groqMetrics: raw.usage ? {
          queueTime:  raw.usage.queue_time,
          promptTime: raw.usage.prompt_time,
          completionTime: raw.usage.completion_time,
          totalTime:  raw.usage.total_time,
        } : undefined,
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
    if (!this.enabled) throw this.providerError('Groq provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);

    const body = {
      model,
      messages,
      max_tokens: request.maxTokens || 4096,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

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
    if (!this.enabled) return { provider: 'groq', status: 'disabled', latencyMs: 0 };
    const start = Date.now();
    try {
      await this._request('/v1/models', null, 5000, null);
      return { provider: 'groq', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { provider: 'groq', status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
    }
  }

  async getModels() {
    try {
      const result = await this._request('/v1/models', null, 5000, null);
      return result.data?.map(m => m.id) || Object.values(this.config.models || {}).filter(Boolean);
    } catch (_) {
      return Object.values(this.config.models || {}).filter(Boolean);
    }
  }
}

module.exports = GroqProvider;

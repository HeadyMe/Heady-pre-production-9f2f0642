'use strict';

const http  = require('http');
const https = require('https');
const { URL } = require('url');
const BaseProvider = require('./base-provider');

/**
 * LocalProvider — Ollama adapter for locally-hosted models.
 * Supports any model loaded in Ollama (llama3.1, mistral, codellama, etc.)
 * Uses Ollama's REST API (/api/generate and /api/chat).
 */
class LocalProvider extends BaseProvider {
  constructor(config) {
    super('local', config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
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
          'User-Agent':     'heady-infer/1.0',
        },
        timeout: timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            // Ollama returns NDJSON for some endpoints; try array first
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(j.error || `HTTP ${res.statusCode}`, 'api_error', res.statusCode, j));
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

  /**
   * Convert normalized messages to Ollama chat format.
   */
  _toOllamaMessages(messages) {
    return messages.map(m => ({
      role:    m.role,
      content: m.content,
    }));
  }

  async generate(request) {
    if (!this.enabled) throw this.providerError('Local (Ollama) provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = request.model || this.config.models?.default || 'llama3.1';
    const messages  = this.normalizeMessages(request);

    // Use /api/chat for multi-turn, /api/generate for single prompt
    const body = {
      model,
      messages: this._toOllamaMessages(messages),
      stream:   false,
      options: {
        num_predict: request.maxTokens || 4096,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.stopSequences && { stop: request.stopSequences }),
      },
    };

    const { controller, clear } = this.withTimeout(this.config.timeout);
    try {
      const raw = await this._request('/api/chat', body, this.config.timeout, controller.signal);

      const response = {
        provider:     'local',
        model:        raw.model || model,
        content:      raw.message?.content || raw.response || '',
        role:         'assistant',
        finishReason: raw.done ? 'stop' : 'length',
        usage: {
          inputTokens:  raw.prompt_eval_count  || 0,
          outputTokens: raw.eval_count          || 0,
          totalTokens:  (raw.prompt_eval_count || 0) + (raw.eval_count || 0),
        },
        latencyMs: Date.now() - startTime,
        costUsd:   0,  // local models are free
        localMetrics: {
          evalDurationNs:       raw.eval_duration,
          promptEvalDurationNs: raw.prompt_eval_duration,
          loadDurationNs:       raw.load_duration,
        },
        timestamp: new Date().toISOString(),
        raw,
      };
      this.recordMetric('success', response.latencyMs, response.usage, 0);
      return response;
    } catch (err) {
      this.recordMetric('failure', Date.now() - startTime);
      throw err;
    } finally {
      clear();
    }
  }

  async stream(request, onChunk) {
    if (!this.enabled) throw this.providerError('Local (Ollama) provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = request.model || this.config.models?.default || 'llama3.1';
    const messages  = this.normalizeMessages(request);

    return new Promise((resolve, reject) => {
      const parsed  = new URL('/api/chat', this.baseUrl);
      const payload = JSON.stringify({
        model,
        messages: this._toOllamaMessages(messages),
        stream:   true,
        options: {
          num_predict: request.maxTokens || 4096,
          ...(request.temperature !== undefined && { temperature: request.temperature }),
        },
      });
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
        },
        timeout: this.config.timeout * 4,
      };

      let buffer = '';
      let accContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const req = lib.request(options, (res) => {
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              const text = evt.message?.content || '';
              if (text) {
                accContent += text;
                onChunk({ type: 'delta', text, provider: 'local' });
              }
              if (evt.done) {
                inputTokens  = evt.prompt_eval_count || 0;
                outputTokens = evt.eval_count         || 0;
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          onChunk({ type: 'done', provider: 'local' });
          resolve({
            provider: 'local',
            model,
            content: accContent,
            role: 'assistant',
            finishReason: 'stop',
            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
            costUsd:   0,
            latencyMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          });
        });
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Stream timeout', 'timeout', 408, null)); });
      req.write(payload);
      req.end();
    });
  }

  async health() {
    if (!this.enabled) return { provider: 'local', status: 'disabled', latencyMs: 0 };
    const start = Date.now();
    try {
      const result = await this._request('/', null, 3000, null);
      return {
        provider: 'local',
        status:   'healthy',
        latencyMs: Date.now() - start,
        info:     result,
      };
    } catch (err) {
      return { provider: 'local', status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
    }
  }

  async getModels() {
    try {
      const result = await this._request('/api/tags', null, 5000, null);
      return result.models?.map(m => m.name) || [this.config.models?.default || 'llama3.1'];
    } catch (_) {
      return [this.config.models?.default || 'llama3.1'];
    }
  }

  estimateCost() {
    return 0;  // local is always free
  }
}

module.exports = LocalProvider;

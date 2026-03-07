'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const BaseProvider = require('./base-provider');

/**
 * AnthropicProvider — Claude adapter
 * Supports: claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307
 *
 * Uses raw HTTP (no SDK) to keep the gateway dependency-light.
 * Compatible with the Anthropic Messages API v1.
 */
class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super('anthropic', config);
    this.apiVersion = '2023-06-01';
    this.baseUrl    = config.baseUrl || 'https://api.anthropic.com';
  }

  // ─── Core Request ─────────────────────────────────────────────────────────

  /**
   * Make a raw HTTP request to Anthropic Messages API.
   */
  _request(body, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL('/v1/messages', this.baseUrl);
      const payload = JSON.stringify(body);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'Content-Type':    'application/json',
          'Content-Length':  Buffer.byteLength(payload),
          'x-api-key':       this.config.apiKey,
          'anthropic-version': this.apiVersion,
          'User-Agent':      'heady-infer/1.0',
        },
        timeout: timeoutMs,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(
                parsed.error?.message || `HTTP ${res.statusCode}`,
                parsed.error?.type   || 'api_error',
                res.statusCode,
                parsed
              ));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(this.providerError(`JSON parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
      });

      req.on('error',   reject);
      req.on('timeout', () => {
        req.destroy();
        reject(this.providerError('Request timed out', 'timeout', 408, null));
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          req.destroy();
          reject(this.providerError('Request aborted', 'aborted', 499, null));
        });
      }

      req.write(payload);
      req.end();
    });
  }

  /**
   * Make a streaming request and call onChunk for each delta.
   */
  _streamRequest(body, onChunk, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL('/v1/messages', this.baseUrl);
      const payload = JSON.stringify({ ...body, stream: true });
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'Content-Type':    'application/json',
          'Content-Length':  Buffer.byteLength(payload),
          'x-api-key':       this.config.apiKey,
          'anthropic-version': this.apiVersion,
        },
        timeout: timeoutMs,
      };

      let buffer = '';
      let accContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let model = body.model;

      const req = lib.request(options, (res) => {
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                accContent += evt.delta.text;
                onChunk({ type: 'delta', text: evt.delta.text, provider: 'anthropic' });
              }
              if (evt.type === 'message_delta' && evt.usage) {
                outputTokens = evt.usage.output_tokens || 0;
              }
              if (evt.type === 'message_start' && evt.message?.usage) {
                inputTokens = evt.message.usage.input_tokens || 0;
                model       = evt.message.model || model;
              }
            } catch (_) { /* ignore parse errors on stream */ }
          }
        });

        res.on('end', () => {
          onChunk({ type: 'done', provider: 'anthropic' });
          resolve({
            provider: 'anthropic',
            model,
            content: accContent,
            role: 'assistant',
            finishReason: 'stop',
            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
            costUsd: this.estimateCost(inputTokens, outputTokens, model),
            timestamp: new Date().toISOString(),
          });
        });
        res.on('error', reject);
      });

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(this.providerError('Stream timed out', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { req.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });

      req.write(payload);
      req.end();
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async generate(request) {
    if (!this.enabled) throw this.providerError('Anthropic provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);

    // Anthropic requires first message to be 'user'
    const filteredMessages = messages.filter(m => m.role !== 'system');
    const systemPrompt     = messages.find(m => m.role === 'system')?.content;

    const body = {
      model,
      max_tokens: request.maxTokens || 4096,
      messages:   filteredMessages,
      ...(systemPrompt && { system: systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.stopSequences && { stop_sequences: request.stopSequences }),
    };

    const { controller, clear } = this.withTimeout(this.config.timeout);
    try {
      const raw = await this._request(body, this.config.timeout, controller.signal);
      const content = raw.content?.[0]?.text || '';
      const response = {
        provider:     'anthropic',
        model:        raw.model || model,
        content,
        role:         'assistant',
        finishReason: raw.stop_reason || 'stop',
        usage: {
          inputTokens:  raw.usage?.input_tokens  || 0,
          outputTokens: raw.usage?.output_tokens || 0,
          totalTokens:  (raw.usage?.input_tokens || 0) + (raw.usage?.output_tokens || 0),
        },
        latencyMs: Date.now() - startTime,
        costUsd:   this.estimateCost(raw.usage?.input_tokens || 0, raw.usage?.output_tokens || 0, raw.model || model),
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
    if (!this.enabled) throw this.providerError('Anthropic provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);
    const filteredMessages = messages.filter(m => m.role !== 'system');
    const systemPrompt     = messages.find(m => m.role === 'system')?.content;

    const body = {
      model,
      max_tokens: request.maxTokens || 4096,
      messages:   filteredMessages,
      ...(systemPrompt && { system: systemPrompt }),
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
    if (!this.enabled) {
      return { provider: 'anthropic', status: 'disabled', latencyMs: 0 };
    }
    const start = Date.now();
    try {
      // Minimal ping request
      await this._request({
        model:      this.config.models.fast || 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages:   [{ role: 'user', content: 'ping' }],
      }, this.config.timeouts?.health || 5000, null);
      return { provider: 'anthropic', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { provider: 'anthropic', status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
    }
  }

  async getModels() {
    return Object.values(this.config.models || {}).filter(Boolean);
  }
}

module.exports = AnthropicProvider;

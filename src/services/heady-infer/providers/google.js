'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const BaseProvider = require('./base-provider');

/**
 * GoogleProvider — Gemini adapter
 * Supports: gemini-2.0-flash, gemini-1.5-pro
 * Uses the Google Generative Language REST API.
 */
class GoogleProvider extends BaseProvider {
  constructor(config) {
    super('google', config);
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
  }

  _request(path, body, timeoutMs, signal) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${path}?key=${this.config.apiKey}`, this.baseUrl);
      const payload = JSON.stringify(body);
      const isHttps = url.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     `${url.pathname}${url.search}`,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent':     'heady-infer/1.0',
        },
        timeout: timeoutMs,
      };

      const req = http[isHttps ? 'request' : 'request'](options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              const errMsg = j.error?.message || `HTTP ${res.statusCode}`;
              reject(this.providerError(errMsg, j.error?.status || 'api_error', res.statusCode, j));
            } else {
              resolve(j);
            }
          } catch (e) {
            reject(this.providerError(`Parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
      });

      const realReq = (isHttps ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(this.providerError(j.error?.message || `HTTP ${res.statusCode}`, j.error?.status || 'api_error', res.statusCode, j));
            } else {
              resolve(j);
            }
          } catch (e) {
            reject(this.providerError(`Parse error: ${e.message}`, 'parse_error', res.statusCode, data));
          }
        });
        res.on('error', reject);
      });

      realReq.on('error',   reject);
      realReq.on('timeout', () => { realReq.destroy(); reject(this.providerError('Timeout', 'timeout', 408, null)); });
      if (signal) signal.addEventListener('abort', () => { realReq.destroy(); reject(this.providerError('Aborted', 'aborted', 499, null)); });
      realReq.write(payload);
      realReq.end();
    });
  }

  /**
   * Convert normalized messages to Gemini contents format.
   */
  _toGeminiContents(messages) {
    const systemParts = [];
    const contents    = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push({ text: msg.content });
      } else {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: msg.content }] });
      }
    }

    // Gemini requires alternating user/model messages
    const normalized = [];
    for (let i = 0; i < contents.length; i++) {
      if (i > 0 && normalized[normalized.length - 1]?.role === contents[i].role) {
        // Merge consecutive same-role messages
        normalized[normalized.length - 1].parts.push(...contents[i].parts);
      } else {
        normalized.push({ ...contents[i] });
      }
    }

    return { systemParts, contents: normalized };
  }

  async generate(request) {
    if (!this.enabled) throw this.providerError('Google provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);
    const { systemParts, contents } = this._toGeminiContents(messages);

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4096,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.stopSequences && { stopSequences: request.stopSequences }),
      },
      ...(systemParts.length > 0 && {
        systemInstruction: { parts: systemParts },
      }),
    };

    const path = `/v1beta/models/${model}:generateContent`;
    const { controller, clear } = this.withTimeout(this.config.timeout);

    try {
      const raw     = await this._request(path, body, this.config.timeout, controller.signal);
      const content = raw.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      const usage   = raw.usageMetadata || {};

      const response = {
        provider:     'google',
        model,
        content,
        role:         'assistant',
        finishReason: raw.candidates?.[0]?.finishReason?.toLowerCase() || 'stop',
        usage: {
          inputTokens:  usage.promptTokenCount      || 0,
          outputTokens: usage.candidatesTokenCount  || 0,
          totalTokens:  usage.totalTokenCount        || 0,
        },
        latencyMs: Date.now() - startTime,
        costUsd:   this.estimateCost(usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, model),
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
    if (!this.enabled) throw this.providerError('Google provider disabled', 'disabled', 503, null);

    const startTime = Date.now();
    const model     = this.selectModel(request, request.taskType);
    const messages  = this.normalizeMessages(request);
    const { systemParts, contents } = this._toGeminiContents(messages);

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4096,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
      },
      ...(systemParts.length > 0 && {
        systemInstruction: { parts: systemParts },
      }),
    };

    return new Promise((resolve, reject) => {
      const url = new URL(
        `/v1beta/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`,
        this.baseUrl
      );
      const payload = JSON.stringify(body);
      const lib     = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     `${url.pathname}${url.search}`,
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
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            try {
              const evt     = JSON.parse(data);
              const text    = evt.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              const meta    = evt.usageMetadata;
              if (text) {
                accContent += text;
                onChunk({ type: 'delta', text, provider: 'google' });
              }
              if (meta) {
                inputTokens  = meta.promptTokenCount     || inputTokens;
                outputTokens = meta.candidatesTokenCount || outputTokens;
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          onChunk({ type: 'done', provider: 'google' });
          resolve({
            provider: 'google',
            model,
            content: accContent,
            role: 'assistant',
            finishReason: 'stop',
            usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
            costUsd:   this.estimateCost(inputTokens, outputTokens, model),
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
    if (!this.enabled) return { provider: 'google', status: 'disabled', latencyMs: 0 };
    const start = Date.now();
    try {
      await this.generate({
        messages:  [{ role: 'user', content: 'ping' }],
        model:     this.config.models.fast || 'gemini-2.0-flash',
        maxTokens: 1,
      });
      return { provider: 'google', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { provider: 'google', status: 'unhealthy', latencyMs: Date.now() - start, error: err.message };
    }
  }

  async getModels() {
    return Object.values(this.config.models || {}).filter(Boolean);
  }
}

module.exports = GoogleProvider;

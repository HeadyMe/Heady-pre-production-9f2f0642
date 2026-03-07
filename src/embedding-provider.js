/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Multi-provider embedding generation with LRU cache, circuit breakers,
 * and a deterministic hash-based local fallback.
 */

const crypto = require('crypto');
const { EMBEDDING_DIM } = require('./vector-space-ops');
const logger = require('./utils/logger');

// ─── LRU Cache ────────────────────────────────────────────────────────────────

const LRU_MAX = 10000;

class LRUCache {
  constructor(max) {
    this._max = max;
    this._map = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    // Move to end (most recently used)
    const val = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, val);
    return val;
  }

  set(key, val) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._max) {
      // Evict oldest (first inserted)
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, val);
  }

  has(key) { return this._map.has(key); }
  get size() { return this._map.size; }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

const CB_STATE = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });
const CB_FAILURE_THRESHOLD = 3;
const CB_RESET_TIMEOUT_MS = 30000;

class CircuitBreaker {
  constructor(name) {
    this.name = name;
    this.state = CB_STATE.CLOSED;
    this._failures = 0;
    this._openedAt = null;
  }

  isAvailable() {
    if (this.state === CB_STATE.CLOSED) return true;
    if (this.state === CB_STATE.HALF_OPEN) return true;
    // OPEN — check if cooldown has elapsed
    if (Date.now() - this._openedAt >= CB_RESET_TIMEOUT_MS) {
      this.state = CB_STATE.HALF_OPEN;
      return true;
    }
    return false;
  }

  onSuccess() {
    this._failures = 0;
    this.state = CB_STATE.CLOSED;
  }

  onFailure() {
    this._failures++;
    if (this._failures >= CB_FAILURE_THRESHOLD || this.state === CB_STATE.HALF_OPEN) {
      this.state = CB_STATE.OPEN;
      this._openedAt = Date.now();
      logger.warn({ provider: this.name }, 'EmbeddingProvider: circuit breaker OPEN');
    }
  }
}

// ─── Deterministic local embeddings (no API required) ────────────────────────

/**
 * Produce a deterministic 384-dim unit vector from a SHA-256 hash of the text.
 * The result is reproducible but has no semantic meaning — useful only as fallback.
 */
function _localEmbedding(text) {
  const hash = crypto.createHash('sha256').update(text, 'utf8').digest();
  // Expand 32-byte hash to 384 floats via multiple hashing passes
  const raw = new Float64Array(EMBEDDING_DIM);
  let idx = 0;
  let passInput = text;
  while (idx < EMBEDDING_DIM) {
    const h = crypto.createHash('sha256').update(passInput, 'utf8').digest();
    for (let i = 0; i < h.length && idx < EMBEDDING_DIM; i++, idx++) {
      raw[idx] = (h[i] / 255) * 2 - 1; // scale to [-1, 1]
    }
    passInput = hash.toString('hex') + idx.toString();
  }
  // Normalise
  let mag = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) mag += raw[i] * raw[i];
  mag = Math.sqrt(mag);
  if (mag > 0) for (let i = 0; i < EMBEDDING_DIM; i++) raw[i] /= mag;
  return raw;
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function _cloudflareEmbed(text, opts) {
  const accountId = opts.accountId || process.env.CF_ACCOUNT_ID;
  const apiToken = opts.apiToken || process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) throw new Error('Cloudflare credentials not configured');

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-small-en-v1.5`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) throw new Error(`Cloudflare AI HTTP ${resp.status}`);
  const json = await resp.json();
  const vec = json?.result?.data?.[0];
  if (!Array.isArray(vec)) throw new Error('Cloudflare AI: unexpected response shape');
  return Float64Array.from(vec);
}

async function _openaiEmbed(text, opts) {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: EMBEDDING_DIM }),
  });

  if (!resp.ok) throw new Error(`OpenAI API HTTP ${resp.status}`);
  const json = await resp.json();
  const vec = json?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('OpenAI: unexpected response shape');
  return Float64Array.from(vec);
}

// ─── EmbeddingProvider ────────────────────────────────────────────────────────

const PROVIDER_FNS = {
  cloudflare: _cloudflareEmbed,
  openai: _openaiEmbed,
  local: async (text) => _localEmbedding(text),
};

class EmbeddingProvider {
  /**
   * @param {object} [opts]
   * @param {string[]} [opts.providerChain=['cloudflare','openai','local']]
   * @param {object} [opts.providerOpts={}]   per-provider options (apiKey, accountId, etc.)
   * @param {number} [opts.concurrency=8]     batch concurrency limit
   */
  constructor(opts = {}) {
    this._chain = opts.providerChain || ['cloudflare', 'openai', 'local'];
    this._providerOpts = opts.providerOpts || {};
    this._concurrency = opts.concurrency || 8;
    this._cache = new LRUCache(LRU_MAX);
    this._breakers = {};
    for (const p of this._chain) this._breakers[p] = new CircuitBreaker(p);
  }

  /**
   * Compute the cache key (SHA-256 of content).
   * @param {string} text
   * @returns {string}
   */
  _cacheKey(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /**
   * Generate a 384-dim embedding for a single piece of text.
   * Tries providers in chain order; falls back on circuit-break or error.
   * @param {string} text
   * @param {object} [options={}]
   * @returns {Promise<Float64Array>}
   */
  async generateEmbedding(text, options = {}) {
    const cacheKey = this._cacheKey(text);
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    const chain = options.providerChain || this._chain;
    let lastErr;

    for (const provider of chain) {
      const breaker = this._breakers[provider];
      if (!breaker || !breaker.isAvailable()) {
        logger.debug({ provider }, 'EmbeddingProvider: breaker unavailable, skipping');
        continue;
      }

      try {
        const provOpts = { ...this._providerOpts[provider], ...options };
        const fn = PROVIDER_FNS[provider];
        if (!fn) throw new Error(`Unknown provider: ${provider}`);
        const vec = await fn(text, provOpts);
        breaker.onSuccess();
        this._cache.set(cacheKey, vec);
        logger.debug({ provider, dim: vec.length }, 'EmbeddingProvider: generated embedding');
        return vec;
      } catch (err) {
        breaker.onFailure();
        lastErr = err;
        logger.warn({ provider, err: err.message }, 'EmbeddingProvider: provider failed, trying next');
      }
    }

    // Should never reach here if 'local' is last in chain, but just in case
    throw new Error(`All embedding providers failed. Last error: ${lastErr?.message}`);
  }

  /**
   * Batch embed multiple texts with a concurrency limit.
   * @param {string[]} texts
   * @param {object} [options={}]
   * @returns {Promise<Float64Array[]>}
   */
  async embedBatch(texts, options = {}) {
    const results = new Array(texts.length);
    let idx = 0;

    const worker = async () => {
      while (idx < texts.length) {
        const i = idx++;
        results[i] = await this.generateEmbedding(texts[i], options);
      }
    };

    const workers = [];
    const limit = Math.min(this._concurrency, texts.length);
    for (let w = 0; w < limit; w++) workers.push(worker());
    await Promise.all(workers);

    return results;
  }

  /**
   * Cache stats.
   * @returns {{ size: number, max: number }}
   */
  cacheStats() {
    return { size: this._cache.size, max: LRU_MAX };
  }

  /**
   * Circuit breaker states per provider.
   * @returns {object}
   */
  breakerStates() {
    const out = {};
    for (const [p, cb] of Object.entries(this._breakers)) out[p] = cb.state;
    return out;
  }
}

// Singleton default instance
const defaultProvider = new EmbeddingProvider();

/**
 * Convenience function: generate embedding using the default provider instance.
 * @param {string} text
 * @param {object} [options]
 * @returns {Promise<Float64Array>}
 */
async function generateEmbedding(text, options) {
  return defaultProvider.generateEmbedding(text, options);
}

module.exports = {
  EmbeddingProvider,
  generateEmbedding,
  defaultProvider,
};

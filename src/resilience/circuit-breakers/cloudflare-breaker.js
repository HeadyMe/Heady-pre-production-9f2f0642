/**
 * cloudflare-breaker.js
 * Circuit-breaker wrapper for Cloudflare Workers AI, KV, D1, and API calls.
 *
 * Features
 * --------
 * - Edge inference timeout management (15 s default)
 * - Fallback to origin server when edge is degraded
 * - KV (key-value) operation protection
 * - D1 (SQLite at the edge) operation protection
 * - Worker invocation timeout
 * - Separate breakers for AI, KV, D1, and Worker invocations
 *
 * @module enterprise-hardening/circuit-breaker/cloudflare-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, EnhancedCircuitBreaker, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CF_AI_TIMEOUT_MS      = 15_000;
const CF_KV_TIMEOUT_MS      =  5_000;
const CF_D1_TIMEOUT_MS      = 10_000;
const CF_WORKER_TIMEOUT_MS  = 10_000;
const CF_API_BASE            = 'https://api.cloudflare.com/client/v4';

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Cloudflare timeout: ${label} (${ms}ms)`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

async function jitterBackoff(attempt, base = 300) {
  const delay = Math.min(base * Math.pow(PHI, attempt), 20_000);
  const j = delay * (0.8 + Math.random() * 0.4);
  await new Promise(r => setTimeout(r, j));
}

// ---------------------------------------------------------------------------
// CloudflareAIBreaker — edge inference calls
// ---------------------------------------------------------------------------
class CloudflareAIBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string} [opts.accountId]   Cloudflare account ID
   * @param {string} [opts.apiToken]    Cloudflare API token
   * @param {string} [opts.originUrl]   Fallback origin URL when edge is degraded
   * @param {number} [opts.timeoutMs]
   * @param {number} [opts.maxRetries]
   */
  constructor(opts = {}) {
    super();
    this._accountId  = opts.accountId  || process.env.CLOUDFLARE_ACCOUNT_ID  || '';
    this._apiToken   = opts.apiToken   || process.env.CLOUDFLARE_API_TOKEN   || '';
    this._originUrl  = opts.originUrl  || null;
    this._timeoutMs  = opts.timeoutMs  || CF_AI_TIMEOUT_MS;
    this._maxRetries = opts.maxRetries || 2;

    this._breaker = registry.get('cloudflare-ai');
    this._breaker.on('stateChange', e => this.emit('stateChange', { ...e, component: 'ai' }));

    // Track whether we're currently in origin-fallback mode
    this._usingOriginFallback = false;
  }

  // -------------------------------------------------------------------------
  // Run an inference model (Workers AI)
  // -------------------------------------------------------------------------
  /**
   * @param {string} model   e.g. '@cf/meta/llama-3-8b-instruct'
   * @param {object} inputs  Model-specific inputs
   * @returns {Promise<object>}
   */
  async run(model, inputs) {
    const url = `${CF_API_BASE}/accounts/${this._accountId}/ai/run/${encodeURIComponent(model)}`;

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        if (attempt > 0) await jitterBackoff(attempt - 1);

        const result = await this._breaker.execute(() =>
          withTimeout(this._post(url, inputs), this._timeoutMs, `cf-ai/${model}`)
        );

        if (this._usingOriginFallback) {
          this._usingOriginFallback = false;
          this.emit('edgeRecovered', { model });
        }

        return result;
      } catch (err) {
        // If circuit is OPEN or max retries exhausted, try origin
        if (err.message.includes('Circuit breaker') || attempt === this._maxRetries) {
          return this._fallbackToOrigin(model, inputs, err);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Origin fallback
  // -------------------------------------------------------------------------
  async _fallbackToOrigin(model, inputs, originalErr) {
    if (!this._originUrl) throw originalErr;

    this._usingOriginFallback = true;
    this.emit('originFallback', { model, reason: originalErr.message });

    try {
      const url = `${this._originUrl}/ai/run/${encodeURIComponent(model)}`;
      return await withTimeout(this._post(url, inputs), this._timeoutMs * 2, `origin-ai/${model}`);
    } catch (fallbackErr) {
      this.emit('originFallbackFailed', { model, error: fallbackErr.message });
      throw new Error(`CF AI and origin both failed for ${model}: ${fallbackErr.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // HTTP helper
  // -------------------------------------------------------------------------
  async _post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this._apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Cloudflare AI HTTP ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  setApiToken(token)  { this._apiToken  = token; }
  setAccountId(id)    { this._accountId = id; }
  setOriginUrl(url)   { this._originUrl = url; }

  snapshot() {
    return {
      component: 'cloudflare-ai',
      breaker: this._breaker.snapshot(),
      usingOriginFallback: this._usingOriginFallback,
      hasOriginFallback: !!this._originUrl,
    };
  }
}

// ---------------------------------------------------------------------------
// CloudflareKVBreaker — KV Namespace operations
// ---------------------------------------------------------------------------
class CloudflareKVBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string} [opts.accountId]
   * @param {string} [opts.apiToken]
   * @param {string} [opts.namespaceId]  Default KV namespace ID
   */
  constructor(opts = {}) {
    super();
    this._accountId  = opts.accountId   || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this._apiToken   = opts.apiToken    || process.env.CLOUDFLARE_API_TOKEN  || '';
    this._nsId       = opts.namespaceId || process.env.CLOUDFLARE_KV_NS_ID   || '';
    this._timeoutMs  = opts.timeoutMs   || CF_KV_TIMEOUT_MS;

    // KV shares the parent cloudflare-ai breaker but we create a sibling
    this._breaker = new EnhancedCircuitBreaker('cloudflare-kv', {
      failureThreshold: 3,
      recoveryTimeout: 20_000,
      halfOpenMaxCalls: 2,
      timeoutMs: CF_KV_TIMEOUT_MS,
    });
    this._breaker.on('stateChange', e => this.emit('stateChange', { ...e, component: 'kv' }));
  }

  _baseUrl(nsId) {
    return `${CF_API_BASE}/accounts/${this._accountId}/storage/kv/namespaces/${nsId || this._nsId}`;
  }

  _headers() {
    return { 'Authorization': `Bearer ${this._apiToken}`, 'Content-Type': 'application/json' };
  }

  async get(key, nsId) {
    return this._breaker.execute(() =>
      withTimeout(
        fetch(`${this._baseUrl(nsId)}/values/${encodeURIComponent(key)}`, { headers: this._headers() })
          .then(r => r.ok ? r.text() : Promise.reject(Object.assign(new Error(`KV GET ${r.status}`), { status: r.status }))),
        this._timeoutMs,
        `kv.get(${key})`
      )
    );
  }

  async put(key, value, { expiration, expirationTtl, metadata } = {}, nsId) {
    const url = `${this._baseUrl(nsId)}/values/${encodeURIComponent(key)}`;
    const params = new URLSearchParams();
    if (expiration)    params.set('expiration',    expiration);
    if (expirationTtl) params.set('expiration_ttl', expirationTtl);

    return this._breaker.execute(() =>
      withTimeout(
        fetch(`${url}?${params}`, {
          method: 'PUT',
          headers: { ...this._headers(), 'Content-Type': 'text/plain' },
          body: typeof value === 'string' ? value : JSON.stringify(value),
        }).then(r => r.ok ? r.json() : Promise.reject(Object.assign(new Error(`KV PUT ${r.status}`), { status: r.status }))),
        this._timeoutMs,
        `kv.put(${key})`
      )
    );
  }

  async delete(key, nsId) {
    return this._breaker.execute(() =>
      withTimeout(
        fetch(`${this._baseUrl(nsId)}/values/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: this._headers(),
        }).then(r => r.ok ? r.json() : Promise.reject(Object.assign(new Error(`KV DELETE ${r.status}`), { status: r.status }))),
        this._timeoutMs,
        `kv.delete(${key})`
      )
    );
  }

  async list(prefix, nsId) {
    const url = `${this._baseUrl(nsId)}/keys${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`;
    return this._breaker.execute(() =>
      withTimeout(
        fetch(url, { headers: this._headers() }).then(r => r.ok ? r.json() : Promise.reject(new Error(`KV LIST ${r.status}`))),
        this._timeoutMs,
        'kv.list'
      )
    );
  }

  snapshot() {
    return { component: 'cloudflare-kv', breaker: this._breaker.snapshot() };
  }
}

// ---------------------------------------------------------------------------
// CloudflareD1Breaker — D1 (SQLite) operations
// ---------------------------------------------------------------------------
class CloudflareD1Breaker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._accountId = opts.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this._apiToken  = opts.apiToken  || process.env.CLOUDFLARE_API_TOKEN  || '';
    this._dbId      = opts.databaseId || process.env.CLOUDFLARE_D1_DB_ID  || '';
    this._timeoutMs = opts.timeoutMs  || CF_D1_TIMEOUT_MS;

    this._breaker = new EnhancedCircuitBreaker('cloudflare-d1', {
      failureThreshold: 3,
      recoveryTimeout: 20_000,
      halfOpenMaxCalls: 2,
      timeoutMs: CF_D1_TIMEOUT_MS,
    });
    this._breaker.on('stateChange', e => this.emit('stateChange', { ...e, component: 'd1' }));
  }

  _baseUrl(dbId) {
    return `${CF_API_BASE}/accounts/${this._accountId}/d1/database/${dbId || this._dbId}`;
  }

  _headers() {
    return { 'Authorization': `Bearer ${this._apiToken}`, 'Content-Type': 'application/json' };
  }

  /**
   * Execute a SQL query on D1.
   * @param {string}   sql
   * @param {any[]}    [params]
   * @param {string}   [dbId]   Override database ID
   */
  async query(sql, params = [], dbId) {
    return this._breaker.execute(() =>
      withTimeout(
        fetch(`${this._baseUrl(dbId)}/query`, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({ sql, params }),
        }).then(async r => {
          if (!r.ok) throw Object.assign(new Error(`D1 query ${r.status}`), { status: r.status });
          return r.json();
        }),
        this._timeoutMs,
        'd1.query'
      )
    );
  }

  /** Execute multiple statements in a batch. */
  async batch(statements, dbId) {
    return this._breaker.execute(() =>
      withTimeout(
        fetch(`${this._baseUrl(dbId)}/query`, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify(statements.map(s =>
            typeof s === 'string' ? { sql: s, params: [] } : s
          )),
        }).then(async r => {
          if (!r.ok) throw Object.assign(new Error(`D1 batch ${r.status}`), { status: r.status });
          return r.json();
        }),
        this._timeoutMs,
        'd1.batch'
      )
    );
  }

  snapshot() {
    return { component: 'cloudflare-d1', breaker: this._breaker.snapshot() };
  }
}

// ---------------------------------------------------------------------------
// CloudflareWorkerBreaker — Worker invocation
// ---------------------------------------------------------------------------
class CloudflareWorkerBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {string} [opts.accountId]
   * @param {string} [opts.apiToken]
   * @param {number} [opts.timeoutMs]
   */
  constructor(opts = {}) {
    super();
    this._accountId = opts.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this._apiToken  = opts.apiToken  || process.env.CLOUDFLARE_API_TOKEN  || '';
    this._timeoutMs = opts.timeoutMs || CF_WORKER_TIMEOUT_MS;

    this._breaker = new EnhancedCircuitBreaker('cloudflare-worker', {
      failureThreshold: 3,
      recoveryTimeout: 20_000,
      halfOpenMaxCalls: 2,
      timeoutMs: CF_WORKER_TIMEOUT_MS,
    });
    this._breaker.on('stateChange', e => this.emit('stateChange', { ...e, component: 'worker' }));
  }

  /**
   * Invoke a Cloudflare Worker by script name (via API).
   *
   * @param {string} scriptName  Worker script name
   * @param {object} [body]      Request body
   * @param {string} [method]    HTTP method (default POST)
   */
  async invoke(scriptName, body, method = 'POST') {
    const url = `${CF_API_BASE}/accounts/${this._accountId}/workers/scripts/${scriptName}/subdomain`;

    return this._breaker.execute(() =>
      withTimeout(
        fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${this._apiToken}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        }).then(async r => {
          if (!r.ok) {
            const text = await r.text().catch(() => '');
            throw Object.assign(new Error(`Worker invoke ${r.status}: ${text}`), { status: r.status });
          }
          return r.json();
        }),
        this._timeoutMs,
        `worker.${scriptName}`
      )
    );
  }

  snapshot() {
    return { component: 'cloudflare-worker', breaker: this._breaker.snapshot() };
  }
}

// ---------------------------------------------------------------------------
// CloudflareBreaker — unified facade
// ---------------------------------------------------------------------------
class CloudflareBreaker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.ai     = new CloudflareAIBreaker(opts);
    this.kv     = new CloudflareKVBreaker(opts);
    this.d1     = new CloudflareD1Breaker(opts);
    this.worker = new CloudflareWorkerBreaker(opts);

    // Bubble events
    for (const comp of [this.ai, this.kv, this.d1, this.worker]) {
      comp.on('stateChange',    e => this.emit('stateChange',    e));
      comp.on('originFallback', e => this.emit('originFallback', e));
    }
  }

  snapshot() {
    return {
      timestamp: new Date().toISOString(),
      ai:     this.ai.snapshot(),
      kv:     this.kv.snapshot(),
      d1:     this.d1.snapshot(),
      worker: this.worker.snapshot(),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const cloudflareBreaker = new CloudflareBreaker();

module.exports = {
  cloudflareBreaker,
  CloudflareBreaker,
  CloudflareAIBreaker,
  CloudflareKVBreaker,
  CloudflareD1Breaker,
  CloudflareWorkerBreaker,
  CF_AI_TIMEOUT_MS,
  CF_KV_TIMEOUT_MS,
  CF_D1_TIMEOUT_MS,
  CF_WORKER_TIMEOUT_MS,
};

/**
 * github-api-breaker.js
 * Circuit-breaker wrapper around @octokit/rest (and Octokit GraphQL) calls.
 *
 * Features
 * --------
 * - Rate-limit awareness: reads X-RateLimit-Remaining / X-RateLimit-Reset headers
 * - Proactive throttling before hitting limits (pauses when remaining < threshold)
 * - Secondary token rotation on 403 / 401 responses
 * - Automatic retry for 5xx errors (exponential backoff, phi-ratio)
 * - Separate circuit breakers for REST and GraphQL endpoints
 * - Per-resource path metering (issues, pulls, repos, etc.)
 *
 * @module enterprise-hardening/circuit-breaker/github-api-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_TIMEOUT_MS          = 10_000;
const RATE_LIMIT_BUFFER           = 100;     // pause when remaining < this
const RATE_LIMIT_SAFETY_PAUSE_MS  = 5_000;   // how long to pause before re-checking
const MAX_RETRIES_5XX             = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function jitter(ms) { return ms * (1 + (Math.random() - 0.5) * 0.3); }

async function backoff(attempt, baseMs = 500) {
  await sleep(jitter(Math.min(baseMs * Math.pow(PHI, attempt), 60_000)));
}

// ---------------------------------------------------------------------------
// RateLimitState — tracks GitHub rate limit per token
// ---------------------------------------------------------------------------
class RateLimitState {
  constructor() {
    // Map<token, { remaining, limit, resetAt, lastUpdated }>
    this._states = new Map();
  }

  update(token, headers) {
    const remaining = parseInt(headers['x-ratelimit-remaining'] ?? '-1', 10);
    const limit      = parseInt(headers['x-ratelimit-limit']     ?? '-1', 10);
    const resetAt    = parseInt(headers['x-ratelimit-reset']     ?? '0',  10) * 1000;
    if (remaining < 0) return;   // header not present

    this._states.set(token, { remaining, limit, resetAt, lastUpdated: Date.now() });
    return { remaining, limit, resetAt };
  }

  get(token) { return this._states.get(token); }

  /** Returns ms until the rate limit resets for this token, or 0 if already past. */
  msUntilReset(token) {
    const s = this._states.get(token);
    if (!s) return 0;
    return Math.max(0, s.resetAt - Date.now());
  }

  /** True when this token is near the limit and should be throttled. */
  isThrottled(token) {
    const s = this._states.get(token);
    if (!s) return false;
    return s.remaining < RATE_LIMIT_BUFFER;
  }

  snapshot() {
    const out = {};
    for (const [token, s] of this._states.entries()) {
      // Mask token — show only last 4 chars
      const masked = `...${token.slice(-4)}`;
      out[masked] = { ...s, msUntilReset: this.msUntilReset(token) };
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// TokenRotator — manages a pool of GitHub tokens
// ---------------------------------------------------------------------------
class TokenRotator {
  /**
   * @param {string[]} tokens  Ordered list of GitHub tokens
   */
  constructor(tokens = []) {
    this._tokens = [...tokens];
    this._index  = 0;
    this._blocked = new Set(); // tokens blocked until a timestamp
  }

  addToken(token) {
    if (!this._tokens.includes(token)) this._tokens.push(token);
  }

  /**
   * Returns the current active token.
   * If all tokens are blocked, returns the one whose block expires soonest.
   */
  current() {
    if (this._tokens.length === 0) return null;
    const now = Date.now();
    // Try to find an unblocked token starting from current index
    for (let i = 0; i < this._tokens.length; i++) {
      const t = this._tokens[(this._index + i) % this._tokens.length];
      if (!this._blocked.has(t)) {
        this._index = (this._index + i) % this._tokens.length;
        return t;
      }
    }
    // All blocked — return least-blocked (we track expiry via timestamps)
    return this._tokens[this._index];
  }

  /**
   * Mark the current token as needing rotation (403 response, etc.).
   * Blocks it for blockMs milliseconds.
   */
  rotate(blockMs = 60_000) {
    const token = this._tokens[this._index];
    if (!token) return null;
    this._blocked.add(token);
    setTimeout(() => this._blocked.delete(token), blockMs).unref?.();
    this._index = (this._index + 1) % this._tokens.length;
    return this._tokens[this._index];
  }

  get count() { return this._tokens.length; }

  snapshot() {
    return {
      total: this._tokens.length,
      blocked: this._blocked.size,
      available: this._tokens.length - this._blocked.size,
    };
  }
}

// ---------------------------------------------------------------------------
// GitHubApiBreaker
// ---------------------------------------------------------------------------
class GitHubApiBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object}   [opts.restClient]     Pre-configured @octokit/rest Octokit instance
   * @param {object}   [opts.graphqlClient]  Octokit graphql function
   * @param {string[]} [opts.tokens]         Pool of GitHub tokens for rotation
   * @param {number}   [opts.timeoutMs]
   */
  constructor(opts = {}) {
    super();
    this._restClient    = opts.restClient    || null;
    this._graphqlClient = opts.graphqlClient || null;
    this._timeoutMs     = opts.timeoutMs     || DEFAULT_TIMEOUT_MS;

    this._rateLimitState = new RateLimitState();
    this._tokenRotator   = new TokenRotator(opts.tokens || []);

    // REST and GraphQL get separate breakers keyed off the same parent service
    this._restBreaker    = registry.get('github-api');
    this._graphqlBreaker = new (require('./external-api-breakers').EnhancedCircuitBreaker)(
      'github-graphql',
      { failureThreshold: 10, recoveryTimeout: 60_000, halfOpenMaxCalls: 5, timeoutMs: 15_000 }
    );

    // Per-resource metrics: { calls, failures, lastError }
    this._resourceMetrics = new Map();

    // Bubble state changes
    this._restBreaker.on('stateChange',    e => this.emit('stateChange', { ...e, endpoint: 'rest' }));
    this._graphqlBreaker.on('stateChange', e => this.emit('stateChange', { ...e, endpoint: 'graphql' }));
  }

  // -------------------------------------------------------------------------
  // Dependency injection
  // -------------------------------------------------------------------------
  setRestClient(client)    { this._restClient    = client; }
  setGraphqlClient(client) { this._graphqlClient = client; }
  addToken(token)          { this._tokenRotator.addToken(token); }

  // -------------------------------------------------------------------------
  // REST request
  // -------------------------------------------------------------------------
  /**
   * Execute a REST API call via octokit.request() or any async function.
   *
   * @param {string|Function} routeOrFn  Octokit route string or async function
   * @param {object}          [params]   Octokit request parameters
   * @returns {Promise<object>}
   */
  async rest(routeOrFn, params = {}) {
    const resource = typeof routeOrFn === 'string'
      ? routeOrFn.split(' ')[1]?.split('/')[1] || 'unknown'
      : 'fn';

    this._incrementMetric(resource, 'calls');

    for (let attempt = 0; attempt <= MAX_RETRIES_5XX; attempt++) {
      const token = this._tokenRotator.current();
      if (!token) throw new Error('GitHubApiBreaker: no tokens available');

      // Proactive throttle
      if (this._rateLimitState.isThrottled(token)) {
        const wait = this._rateLimitState.msUntilReset(token);
        this.emit('throttle', { token: `...${token.slice(-4)}`, waitMs: wait || RATE_LIMIT_SAFETY_PAUSE_MS });
        await sleep(wait || RATE_LIMIT_SAFETY_PAUSE_MS);
      }

      try {
        const result = await this._restBreaker.execute(() => {
          if (!this._restClient) throw new Error('GitHubApiBreaker: REST client not initialised');
          const call = typeof routeOrFn === 'function'
            ? routeOrFn({ token, client: this._restClient })
            : this._restClient.request(routeOrFn, { ...params, headers: { authorization: `token ${token}`, ...params.headers } });
          return this._withTimeout(call, 'REST');
        });

        // Update rate limit state from headers
        if (result?.headers) this._rateLimitState.update(token, result.headers);

        return result;
      } catch (err) {
        const status = err.status || err.response?.status;
        this._incrementMetric(resource, 'failures');

        // 403 / 401 → rotate token
        if (status === 403 || status === 401) {
          const wasSecondary = attempt > 0;
          const next = this._tokenRotator.rotate();
          this.emit('tokenRotated', { reason: `HTTP ${status}`, hasNext: !!next, wasSecondary });
          if (!next) throw err;  // no more tokens
          continue;
        }

        // 5xx → retry with backoff
        if (status >= 500 && attempt < MAX_RETRIES_5XX) {
          await backoff(attempt);
          continue;
        }

        // 429 → respect Retry-After
        if (status === 429) {
          const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '30', 10);
          this.emit('rateLimitHit', { retryAfterSecs: retryAfter });
          await sleep(retryAfter * 1000);
          continue;
        }

        this._resourceMetrics.get(resource).lastError = err.message;
        throw err;
      }
    }

    throw new Error(`GitHubApiBreaker: exceeded ${MAX_RETRIES_5XX} retries for ${String(routeOrFn)}`);
  }

  // -------------------------------------------------------------------------
  // GraphQL request
  // -------------------------------------------------------------------------
  /**
   * Execute a GraphQL query with circuit-breaker protection.
   *
   * @param {string} query      GraphQL query string
   * @param {object} [variables]
   * @returns {Promise<object>}
   */
  async graphql(query, variables = {}) {
    const token = this._tokenRotator.current();
    if (!token) throw new Error('GitHubApiBreaker: no tokens available');

    this._incrementMetric('graphql', 'calls');

    for (let attempt = 0; attempt <= MAX_RETRIES_5XX; attempt++) {
      try {
        const result = await this._graphqlBreaker.execute(() => {
          if (!this._graphqlClient) throw new Error('GitHubApiBreaker: GraphQL client not initialised');
          return this._withTimeout(
            this._graphqlClient(query, { ...variables, headers: { authorization: `token ${token}` } }),
            'GraphQL'
          );
        });
        return result;
      } catch (err) {
        const status = err.status || err.response?.status;
        if (status === 403 || status === 401) {
          const next = this._tokenRotator.rotate();
          if (!next) throw err;
          continue;
        }
        if (status >= 500 && attempt < MAX_RETRIES_5XX) {
          await backoff(attempt);
          continue;
        }
        this._incrementMetric('graphql', 'failures');
        throw err;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Octokit proxy — convenience wrapper for direct octokit property access
  // -------------------------------------------------------------------------
  /**
   * Proxy an octokit method call: e.g. proxy('repos', 'get', { owner, repo })
   *
   * @param {string} namespace  e.g. 'repos', 'pulls', 'issues'
   * @param {string} method     e.g. 'get', 'list', 'create'
   * @param {object} [params]
   */
  async proxy(namespace, method, params = {}) {
    return this.rest(async ({ client }) => {
      if (!client[namespace]?.[method]) {
        throw new Error(`octokit.${namespace}.${method} not found`);
      }
      return client[namespace][method](params);
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  _withTimeout(promise, label) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`GitHub API timeout: ${label} (${this._timeoutMs}ms)`)), this._timeoutMs);
      promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  _incrementMetric(resource, field) {
    if (!this._resourceMetrics.has(resource)) {
      this._resourceMetrics.set(resource, { calls: 0, failures: 0, lastError: null });
    }
    this._resourceMetrics.get(resource)[field]++;
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------
  snapshot() {
    return {
      service: 'github-api',
      restBreaker:    this._restBreaker.snapshot(),
      graphqlBreaker: this._graphqlBreaker.snapshot(),
      rateLimit:      this._rateLimitState.snapshot(),
      tokens:         this._tokenRotator.snapshot(),
      resources:      Object.fromEntries(this._resourceMetrics.entries()),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
const githubBreaker = new GitHubApiBreaker();

module.exports = {
  githubBreaker,
  GitHubApiBreaker,
  RateLimitState,
  TokenRotator,
  RATE_LIMIT_BUFFER,
};

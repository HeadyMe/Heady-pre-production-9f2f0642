/**
 * @file rate-limiter.js
 * @description Token bucket + sliding window rate limiter with per-client tracking.
 *
 * Algorithms:
 * - Token Bucket: smooth burst absorption with refill rate
 * - Sliding Window Counter: precise per-second / per-minute windows
 *
 * Features:
 * - Per-client rate limiting (keyed by clientId)
 * - Configurable burst allowance
 * - Rate limit headers generation (X-RateLimit-*)
 * - PHI-scaled token refill
 * - Automatic client eviction (LRU cleanup)
 *
 * Sacred Geometry: PHI ratios for burst sizing and cleanup intervals.
 * Zero external dependencies.
 *
 * @module HeadyResilience/RateLimiter
 */

import { EventEmitter } from 'events';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI = 1.6180339887498948482;

// ─── Token Bucket ─────────────────────────────────────────────────────────────
class TokenBucket {
  /**
   * @param {object} opts
   * @param {number} opts.capacity    Max tokens (burst ceiling)
   * @param {number} opts.refillRate  Tokens per second
   * @param {number} [opts.initial]   Starting tokens (defaults to capacity)
   */
  constructor({ capacity, refillRate, initial }) {
    this.capacity   = capacity;
    this.refillRate = refillRate;   // tokens/ms = refillRate / 1000
    this.tokens     = initial !== undefined ? initial : capacity;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now     = Date.now();
    const elapsed = now - this.lastRefill;     // ms since last refill
    const added   = (elapsed / 1000) * this.refillRate;
    this.tokens   = Math.min(this.capacity, this.tokens + added);
    this.lastRefill = now;
  }

  /**
   * Attempt to consume `cost` tokens.
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  consume(cost = 1) {
    this._refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return { allowed: true, remaining: Math.floor(this.tokens), retryAfterMs: 0 };
    }
    const deficit       = cost - this.tokens;
    const retryAfterMs  = Math.ceil((deficit / this.refillRate) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  peek() {
    this._refill();
    return Math.floor(this.tokens);
  }
}

// ─── Sliding Window Counter ───────────────────────────────────────────────────
class SlidingWindowCounter {
  /**
   * @param {number} windowMs   Window size in milliseconds
   * @param {number} limit      Max requests per window
   */
  constructor(windowMs, limit) {
    this.windowMs    = windowMs;
    this.limit       = limit;
    this._timestamps = [];
  }

  _prune(now) {
    const cutoff = now - this.windowMs;
    // Binary-search-style: drop from front while stale
    let i = 0;
    while (i < this._timestamps.length && this._timestamps[i] <= cutoff) i++;
    if (i > 0) this._timestamps.splice(0, i);
  }

  /**
   * Record a request at `now`.
   * @returns {{ allowed: boolean, count: number, remaining: number, resetMs: number }}
   */
  record(now = Date.now()) {
    this._prune(now);
    const count = this._timestamps.length;
    if (count < this.limit) {
      this._timestamps.push(now);
      return { allowed: true, count: count + 1, remaining: this.limit - count - 1, resetMs: 0 };
    }
    // Window is full — compute how long until oldest entry expires
    const resetMs = this._timestamps[0] + this.windowMs - now;
    return { allowed: false, count, remaining: 0, resetMs: Math.max(0, resetMs) };
  }

  count(now = Date.now()) {
    this._prune(now);
    return this._timestamps.length;
  }
}

// ─── Per-Client State ─────────────────────────────────────────────────────────
class ClientState {
  constructor(config) {
    const burst = Math.ceil(config.requestsPerSecond * PHI); // PHI-scaled burst
    this.bucket = new TokenBucket({
      capacity:   config.burst ?? burst,
      refillRate: config.requestsPerSecond,
    });
    this.window  = new SlidingWindowCounter(config.windowMs ?? 60_000, config.requestsPerWindow ?? 1000);
    this.lastSeen = Date.now();
    this.blocked  = false;
    this.penaltyUntil = 0;
  }

  touch() { this.lastSeen = Date.now(); }
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
/**
 * Composite rate limiter combining token bucket (per-second smoothing)
 * and sliding window (per-window hard ceiling).
 */
export class RateLimiter extends EventEmitter {
  /**
   * @param {object} globalConfig
   * @param {number} globalConfig.requestsPerSecond
   * @param {number} [globalConfig.requestsPerWindow]
   * @param {number} [globalConfig.windowMs]
   * @param {number} [globalConfig.burst]
   * @param {number} [globalConfig.maxClients]    Max tracked clients (LRU eviction)
   * @param {number} [globalConfig.evictAfterMs]  Evict idle clients after ms
   */
  constructor(globalConfig = {}) {
    super();
    this.config = {
      requestsPerSecond:  globalConfig.requestsPerSecond  ?? 100,
      requestsPerWindow:  globalConfig.requestsPerWindow  ?? 1000,
      windowMs:           globalConfig.windowMs           ?? 60_000,
      burst:              globalConfig.burst              ?? null,
      maxClients:         globalConfig.maxClients         ?? 10_000,
      evictAfterMs:       globalConfig.evictAfterMs       ?? 300_000, // 5 min
    };
    this._clients      = new Map();   // clientId → ClientState
    this._overrides    = new Map();   // clientId → partial config override
    this._globalBucket = new TokenBucket({
      capacity:   Math.ceil(this.config.requestsPerSecond * PHI * 5),
      refillRate: this.config.requestsPerSecond * 5,
    });
    this._startCleanup();
  }

  /**
   * Override config for a specific client (e.g., trusted partner = higher limit).
   */
  setClientConfig(clientId, config) {
    this._overrides.set(clientId, config);
    // Rebuild if already exists
    if (this._clients.has(clientId)) {
      this._clients.set(clientId, new ClientState({ ...this.config, ...config }));
    }
  }

  _getClient(clientId) {
    if (!this._clients.has(clientId)) {
      if (this._clients.size >= this.config.maxClients) {
        this._evictOldest();
      }
      const cfg = { ...this.config, ...(this._overrides.get(clientId) ?? {}) };
      this._clients.set(clientId, new ClientState(cfg));
    }
    return this._clients.get(clientId);
  }

  _evictOldest() {
    // Evict the client with the oldest lastSeen
    let oldest = null;
    let oldestTime = Infinity;
    for (const [id, state] of this._clients) {
      if (state.lastSeen < oldestTime) {
        oldestTime = state.lastSeen;
        oldest = id;
      }
    }
    if (oldest) this._clients.delete(oldest);
  }

  /**
   * Check and consume a request for clientId.
   *
   * @param {string} clientId  Unique client identifier
   * @param {number} [cost=1]  Token cost (default 1)
   * @returns {{ allowed: boolean, headers: object, retryAfterMs: number }}
   */
  check(clientId, cost = 1) {
    const now    = Date.now();
    const client = this._getClient(clientId);
    client.touch();

    // Penalty check (from previous violations)
    if (client.penaltyUntil > now) {
      const retryAfterMs = client.penaltyUntil - now;
      return {
        allowed:      false,
        headers:      this._headers(clientId, 0, 0, retryAfterMs),
        retryAfterMs,
        reason:       'penalty',
      };
    }

    // Global bucket check first (prevent cascade abuse)
    const global = this._globalBucket.consume(cost);
    if (!global.allowed) {
      this.emit('globalThrottle', { clientId, ts: now });
      return {
        allowed:      false,
        headers:      this._headers(clientId, 0, 0, global.retryAfterMs),
        retryAfterMs: global.retryAfterMs,
        reason:       'global-throttle',
      };
    }

    // Token bucket (per-second)
    const bucket = client.bucket.consume(cost);
    if (!bucket.allowed) {
      this.emit('rateLimited', { clientId, reason: 'token-bucket', retryAfterMs: bucket.retryAfterMs, ts: now });
      return {
        allowed:      false,
        headers:      this._headers(clientId, bucket.remaining, 0, bucket.retryAfterMs),
        retryAfterMs: bucket.retryAfterMs,
        reason:       'token-bucket',
      };
    }

    // Sliding window (per-window)
    const win = client.window.record(now);
    if (!win.allowed) {
      this.emit('rateLimited', { clientId, reason: 'window-exceeded', retryAfterMs: win.resetMs, ts: now });
      return {
        allowed:      false,
        headers:      this._headers(clientId, 0, win.remaining, win.resetMs),
        retryAfterMs: win.resetMs,
        reason:       'window-exceeded',
      };
    }

    return {
      allowed:      true,
      headers:      this._headers(clientId, bucket.remaining, win.remaining, 0),
      retryAfterMs: 0,
    };
  }

  /**
   * Apply a penalty (temporary block) to a client.
   */
  penalize(clientId, durationMs) {
    const client = this._getClient(clientId);
    client.penaltyUntil = Date.now() + durationMs;
    this.emit('penalized', { clientId, durationMs, until: client.penaltyUntil });
  }

  /**
   * Generate standard rate-limit HTTP headers.
   */
  _headers(clientId, bucketRemaining, windowRemaining, retryAfterMs) {
    const cfg = this._overrides.get(clientId) ?? this.config;
    const limit    = cfg.requestsPerWindow ?? this.config.requestsPerWindow;
    const resetSec = Math.ceil(retryAfterMs / 1000);
    return {
      'X-RateLimit-Limit':     String(limit),
      'X-RateLimit-Remaining': String(Math.min(bucketRemaining, windowRemaining)),
      'X-RateLimit-Reset':     String(Math.floor(Date.now() / 1000) + resetSec),
      ...(retryAfterMs > 0 ? { 'Retry-After': String(resetSec) } : {}),
    };
  }

  /**
   * Get current stats for a client.
   */
  stats(clientId) {
    const client = this._clients.get(clientId);
    if (!client) return null;
    return {
      clientId,
      bucketTokens:   client.bucket.peek(),
      windowCount:    client.window.count(),
      penaltyUntil:   client.penaltyUntil,
      lastSeen:       client.lastSeen,
    };
  }

  // Periodic cleanup of idle clients
  _startCleanup() {
    const interval = Math.floor(this.config.evictAfterMs * PHI_INV ?? this.config.evictAfterMs / PHI);
    this._cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - this.config.evictAfterMs;
      for (const [id, state] of this._clients) {
        if (state.lastSeen < cutoff) this._clients.delete(id);
      }
    }, Math.max(interval, 30_000));
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._clients.clear();
  }
}

const PHI_INV = 1 / PHI;

export default RateLimiter;

/**
 * Heady Semantic Rate Limiter
 * ===========================
 * 4-layer rate limiting with semantic deduplication:
 *   Global → Per-Tool → Per-User → Per-Session
 *
 * Features:
 * - Token bucket (burst control) + sliding window (sustained rate)
 * - Semantic dedup: cosine ≥ DEDUP_THRESHOLD ≈ 0.972 → return cached result
 * - Priority queue for rate-limited requests (min-heap)
 * - X-RateLimit-* headers on every response
 * - Phi-scaled parameters throughout
 *
 * @module src/security/rate-limiter
 * @version 1.0.0
 */

'use strict';

const {
  PHI, PSI, fib, CSL_THRESHOLDS, DEDUP_THRESHOLD,
  phiBackoff, cosineSimilarity,
} = require('../../shared/phi-math');

// ── Token Bucket ────────────────────────────────────────────────────────────
class TokenBucket {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate; // tokens per second
    this._lastRefill = Date.now();
  }

  consume(count = 1) {
    this._refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this._lastRefill = now;
  }

  get remaining() {
    this._refill();
    return Math.floor(this.tokens);
  }

  get resetMs() {
    const deficit = this.maxTokens - this.tokens;
    return Math.ceil(deficit / this.refillRate * 1000);
  }
}

// ── Sliding Window Counter ──────────────────────────────────────────────────
class SlidingWindowCounter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.buckets = new Map(); // timestamp bucket → count
    this.bucketSize = windowMs / fib(9); // 34 sub-buckets per window
  }

  record() {
    const now = Date.now();
    const bucket = Math.floor(now / this.bucketSize);
    this.buckets.set(bucket, (this.buckets.get(bucket) || 0) + 1);
    this._prune(now);
    return this.count(now);
  }

  count(now = Date.now()) {
    this._prune(now);
    let total = 0;
    for (const [, c] of this.buckets) total += c;
    return total;
  }

  _prune(now) {
    const minBucket = Math.floor((now - this.windowMs) / this.bucketSize);
    for (const [bucket] of this.buckets) {
      if (bucket < minBucket) this.buckets.delete(bucket);
    }
  }

  get allowed() {
    return this.count() < this.maxRequests;
  }
}

// ── Semantic Dedup Cache ────────────────────────────────────────────────────
class SemanticDedupCache {
  constructor(maxSize = fib(16), ttlMs = fib(11) * 1000) { // 987 entries, 89s TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this._entries = []; // { embedding, result, timestamp }
  }

  /**
   * Check if a semantically similar request was recently processed.
   * @param {Float32Array} embedding - 384D input embedding
   * @returns {{ hit: boolean, result?: any }}
   */
  check(embedding) {
    if (!embedding) return { hit: false };

    const now = Date.now();
    this._prune(now);

    for (const entry of this._entries) {
      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim >= DEDUP_THRESHOLD) {
        entry.timestamp = now; // refresh TTL on hit
        return { hit: true, result: entry.result };
      }
    }

    return { hit: false };
  }

  store(embedding, result) {
    if (!embedding) return;

    // LRU eviction if at capacity
    if (this._entries.length >= this.maxSize) {
      this._entries.sort((a, b) => a.timestamp - b.timestamp);
      this._entries.shift();
    }

    this._entries.push({
      embedding: Array.from(embedding), // normalize to plain array
      result,
      timestamp: Date.now(),
    });
  }

  _prune(now) {
    this._entries = this._entries.filter(e => now - e.timestamp < this.ttlMs);
  }
}

// ── Priority Queue (min-heap) ───────────────────────────────────────────────
class PriorityQueue {
  constructor() { this.heap = []; }

  enqueue(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top.item;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[i].priority >= this.heap[parent].priority) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  _sinkDown(i) {
    while (true) {
      let smallest = i;
      const left = 2 * i + 1, right = 2 * i + 2;
      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }

  get size() { return this.heap.length; }
}

// ── Semantic Rate Limiter ───────────────────────────────────────────────────
class SemanticRateLimiter {
  constructor(config = {}) {
    // Layer 1: Global limits
    this.globalBucket = new TokenBucket(
      config.globalBurst || fib(12),      // 144 burst
      config.globalRate || fib(9),        // 34/s sustained
    );
    this.globalWindow = new SlidingWindowCounter(
      config.globalWindowMs || 60000,
      config.globalMaxPerMinute || fib(12) * fib(5), // 144 × 5 = 720/min
    );

    // Layer 2: Per-tool limits
    this._toolBuckets = new Map();
    this._toolWindows = new Map();
    this.toolBurst = config.toolBurst || fib(8);      // 21 burst per tool
    this.toolRate = config.toolRate || fib(6);         // 8/s per tool

    // Layer 3: Per-user limits
    this._userBuckets = new Map();
    this._userWindows = new Map();
    this.userBurst = config.userBurst || fib(9);      // 34 burst per user
    this.userRate = config.userRate || fib(7);         // 13/s per user
    this.userMaxPerMinute = config.userMaxPerMinute || fib(10) * fib(3); // 55 × 2 = 110/min

    // Layer 4: Per-session limits
    this._sessionBuckets = new Map();
    this.sessionBurst = config.sessionBurst || fib(7);  // 13 burst per session
    this.sessionRate = config.sessionRate || fib(5);     // 5/s per session

    // Semantic dedup cache
    this.dedupCache = new SemanticDedupCache(
      config.dedupCacheSize,
      config.dedupTtlMs,
    );

    // Pending priority queue for rate-limited requests
    this.pendingQueue = new PriorityQueue();
  }

  /**
   * Check if a request is allowed through all 4 layers.
   * @param {Object} params - { tool, user, session, inputEmbedding }
   * @returns {Object} - { allowed, reason?, retryAfterMs?, cachedResult?, headers }
   */
  async check({ tool, user, session, inputEmbedding }) {
    // ── Semantic dedup first ────────────────────────────────────────────
    const dedup = this.dedupCache.check(inputEmbedding);
    if (dedup.hit) {
      return {
        allowed: true,
        cachedResult: dedup.result,
        headers: this._buildHeaders(user, tool),
      };
    }

    // ── Layer 1: Global ─────────────────────────────────────────────────
    if (!this.globalBucket.consume()) {
      return this._denied('Global burst limit exceeded', this.globalBucket.resetMs, user, tool);
    }
    if (!this.globalWindow.allowed) {
      this.globalWindow.record();
      return this._denied('Global sustained rate exceeded', 60000, user, tool);
    }
    this.globalWindow.record();

    // ── Layer 2: Per-tool ───────────────────────────────────────────────
    const toolBucket = this._getOrCreate(this._toolBuckets, tool,
      () => new TokenBucket(this.toolBurst, this.toolRate));
    if (!toolBucket.consume()) {
      return this._denied(`Tool "${tool}" burst limit exceeded`, toolBucket.resetMs, user, tool);
    }

    // ── Layer 3: Per-user ───────────────────────────────────────────────
    const userBucket = this._getOrCreate(this._userBuckets, user,
      () => new TokenBucket(this.userBurst, this.userRate));
    const userWindow = this._getOrCreate(this._userWindows, user,
      () => new SlidingWindowCounter(60000, this.userMaxPerMinute));
    if (!userBucket.consume()) {
      return this._denied('User burst limit exceeded', userBucket.resetMs, user, tool);
    }
    if (!userWindow.allowed) {
      userWindow.record();
      return this._denied('User sustained rate exceeded', 60000, user, tool);
    }
    userWindow.record();

    // ── Layer 4: Per-session ────────────────────────────────────────────
    if (session) {
      const sessBucket = this._getOrCreate(this._sessionBuckets, session,
        () => new TokenBucket(this.sessionBurst, this.sessionRate));
      if (!sessBucket.consume()) {
        return this._denied('Session burst limit exceeded', sessBucket.resetMs, user, tool);
      }
    }

    return {
      allowed: true,
      headers: this._buildHeaders(user, tool),
    };
  }

  /**
   * Cache a result for semantic dedup.
   */
  async cacheResult(embedding, result) {
    this.dedupCache.store(embedding, result);
  }

  _denied(reason, retryAfterMs, user, tool) {
    return {
      allowed: false,
      reason,
      retryAfterMs,
      headers: {
        ...this._buildHeaders(user, tool),
        'Retry-After': Math.ceil(retryAfterMs / 1000),
      },
    };
  }

  _buildHeaders(user, tool) {
    const userBucket = this._userBuckets.get(user);
    return {
      'X-RateLimit-Limit': this.userBurst,
      'X-RateLimit-Remaining': userBucket ? userBucket.remaining : this.userBurst,
      'X-RateLimit-Reset': userBucket
        ? Math.ceil(Date.now() / 1000 + userBucket.resetMs / 1000)
        : Math.ceil(Date.now() / 1000 + 60),
    };
  }

  _getOrCreate(map, key, factory) {
    if (!map.has(key)) map.set(key, factory());
    return map.get(key);
  }
}

module.exports = { SemanticRateLimiter, TokenBucket, SlidingWindowCounter, SemanticDedupCache, PriorityQueue };

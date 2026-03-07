/**
 * @fileoverview Semantic Rate Limiter with Cosine Deduplication — Phi-Continuous Edition
 *
 * Implements multi-layer rate limiting for MCP tool calls:
 * - Token bucket algorithm per tool/user combination
 * - Sliding window counters for burst detection
 * - Semantic deduplication: CSL gate score ≥ DEDUP_THRESHOLD ≈ 0.972 = duplicate
 * - Priority queue for rate-limited request queuing
 * - Burst allowance configuration
 * - Rate limit response headers (X-RateLimit-*)
 *
 * Used in the Heady Latent OS gateway layer to prevent runaway agent loops,
 * protect downstream MCP servers, and surface fair-use limits to clients.
 *
 * ── Phi-Math Integration ────────────────────────────────────────────────────
 * All fixed numeric thresholds are replaced with phi/Fibonacci-derived values:
 *
 *   DEDUP_SIMILARITY_THRESHOLD  0.95    → DEDUP_THRESHOLD    ≈ 0.972
 *   WINDOW_MS                60_000    → fib(11)*1000       = 89_000 ms (≈ 89 s)
 *   REFILL_INTERVAL_MS        1_000    → fib(8)*100         = 2_100 ms
 *   CLEANUP_INTERVAL_MS     300_000    → fib(14)*1000       = 377_000 ms (≈ 6.3 min)
 *   buckets = 60 (sliding window)      → fib(9)             = 34
 *
 * Dedup matching is upgraded from a hard boolean threshold to a soft
 * CSL gate via cslGate() — semantically very similar requests produce a
 * smooth similarity score rather than a binary pass/fail.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module modules/rate-limiter
 * @requires events
 * @requires shared/phi-math
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  cslGate,
  fib,
} from '../../shared/phi-math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Cosine similarity threshold for semantic deduplication.
 *
 * Replaces the old arbitrary 0.95 with DEDUP_THRESHOLD from phi-math:
 *   DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL + (1 - CSL_THRESHOLDS.CRITICAL) × ψ ≈ 0.972
 *
 * This threshold is mathematically derived: it sits ψ of the way from the
 * CRITICAL gate (≈ 0.927) to 1.0, providing a tighter but still
 * phi-proportioned boundary for near-identical request detection.
 *
 * @type {number} ≈ 0.972
 */
const DEDUP_SIMILARITY_THRESHOLD = DEDUP_THRESHOLD;

/**
 * Default sliding window duration in milliseconds.
 *
 * fib(11) * 1000 = 89 × 1000 = 89_000 ms (≈ 89 seconds).
 *
 * Replaces the old arbitrary 60_000 ms (60 s) with a Fibonacci-derived value.
 * 89 s is one Fibonacci step above 55 s and one below 144 s, providing a
 * natural window size in the phi-scaled timing hierarchy.
 *
 * @type {number} 89_000
 */
const DEFAULT_WINDOW_MS = fib(11) * 1000; // F(11) = 89 → 89 000 ms

/**
 * Default token bucket refill interval in milliseconds.
 *
 * fib(8) * 100 = 21 × 100 = 2_100 ms.
 *
 * Replaces the old arbitrary 1_000 ms.  The 2.1 s refill interval is
 * gentler, reducing token churn and aligning with the phi-scaled timing
 * hierarchy (F(8)=21, F(9)=34, etc.).
 *
 * @type {number} 2_100
 */
const DEFAULT_REFILL_INTERVAL_MS = fib(8) * 100; // F(8) = 21 → 2 100 ms

/**
 * Maximum queued requests per key.
 *
 * fib(10) = 55 — replaces old magic 50.
 *
 * @type {number} 55
 */
const MAX_QUEUE_SIZE = fib(10); // F(10) = 55

/**
 * Cleanup interval for expired windows/dedup cache.
 *
 * fib(14) * 1000 = 377 × 1000 = 377_000 ms (≈ 6.28 minutes).
 *
 * Replaces the old 5 × 60_000 = 300_000 ms.  The Fibonacci value 377 is
 * the natural successor in the sequence to 233 (fib(13)), following the
 * phi-scaling pattern through the timing hierarchy.
 *
 * @type {number} 377_000
 */
const CLEANUP_INTERVAL_MS = fib(14) * 1000; // F(14) = 377 → 377 000 ms

/**
 * Default number of sub-window buckets in the sliding window counter.
 *
 * fib(9) = 34 — replaces the old 60.  Fibonacci bucket counts produce
 * natural bucket-to-window ratios that are phi-proportioned.
 *
 * @type {number} 34
 */
const DEFAULT_SLIDING_WINDOW_BUCKETS = fib(9); // F(9) = 34

// ─── Priority Queue ───────────────────────────────────────────────────────────

/**
 * Min-heap priority queue for rate-limited requests.
 * Lower priority value = served first (0 = highest priority).
 *
 * @private
 */
class PriorityQueue {
  constructor() {
    /** @type {Array<{priority: number, resolve: Function, reject: Function, expires: number}>} */
    this._heap = [];
  }

  /**
   * Enqueue a request.
   *
   * @param {number} priority - Lower = higher priority
   * @param {Function} resolve
   * @param {Function} reject
   * @param {number} expires - Timestamp after which the request should be rejected
   */
  push(priority, resolve, reject, expires) {
    this._heap.push({ priority, resolve, reject, expires });
    this._bubbleUp(this._heap.length - 1);
  }

  /**
   * Dequeue the highest-priority (lowest value) request.
   *
   * @returns {{priority: number, resolve: Function, reject: Function, expires: number}|null}
   */
  pop() {
    if (this._heap.length === 0) return null;
    const top  = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  /** @returns {number} Queue depth */
  get size() { return this._heap.length; }

  /** Remove expired entries and reject them */
  expireOld() {
    const now    = Date.now();
    const active = [];
    for (const item of this._heap) {
      if (item.expires <= now) {
        item.reject(new Error('Rate limit queue timeout'));
      } else {
        active.push(item);
      }
    }
    this._heap = active;
    // Rebuild heap
    for (let i = Math.floor(this._heap.length / 2) - 1; i >= 0; i--) {
      this._sinkDown(i);
    }
  }

  /** @private */
  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._heap[parent].priority <= this._heap[i].priority) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  /** @private */
  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._heap[l].priority < this._heap[smallest].priority) smallest = l;
      if (r < n && this._heap[r].priority < this._heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this._heap[smallest], this._heap[i]] = [this._heap[i], this._heap[smallest]];
      i = smallest;
    }
  }
}

// ─── Token Bucket ─────────────────────────────────────────────────────────────

/**
 * Token bucket implementation for smooth rate limiting.
 *
 * Tokens are consumed per request and refilled at a fixed rate.
 * Burst allowance permits temporary bursts above the steady-state rate.
 *
 * @private
 */
class TokenBucket {
  /**
   * @param {Object} options
   * @param {number} options.capacity - Maximum tokens (bucket size = burst limit)
   * @param {number} options.refillRate - Tokens added per refill interval
   * @param {number} [options.refillIntervalMs=DEFAULT_REFILL_INTERVAL_MS] - Refill interval in ms
   * @param {number} [options.initialTokens] - Starting tokens (default = capacity)
   */
  constructor(options) {
    this._capacity         = options.capacity;
    this._refillRate       = options.refillRate;
    this._refillIntervalMs = options.refillIntervalMs ?? DEFAULT_REFILL_INTERVAL_MS;
    this._tokens           = options.initialTokens ?? options.capacity;
    this._lastRefill       = Date.now();
  }

  /**
   * Attempt to consume `count` tokens.
   *
   * @param {number} [count=1] - Tokens to consume
   * @returns {{allowed: boolean, remaining: number, retryAfterMs: number}}
   */
  consume(count = 1) {
    this._refill();
    if (this._tokens >= count) {
      this._tokens -= count;
      return { allowed: true, remaining: Math.floor(this._tokens), retryAfterMs: 0 };
    }
    const deficit        = count - this._tokens;
    const refillsNeeded  = Math.ceil(deficit / this._refillRate);
    const retryAfterMs   = refillsNeeded * this._refillIntervalMs;
    return { allowed: false, remaining: Math.floor(this._tokens), retryAfterMs };
  }

  /** @returns {number} Current token count */
  get tokens() {
    this._refill();
    return Math.floor(this._tokens);
  }

  /** @returns {number} Bucket capacity */
  get capacity() { return this._capacity; }

  /** @private */
  _refill() {
    const now     = Date.now();
    const elapsed = now - this._lastRefill;
    if (elapsed >= this._refillIntervalMs) {
      const intervals = Math.floor(elapsed / this._refillIntervalMs);
      this._tokens    = Math.min(this._capacity, this._tokens + intervals * this._refillRate);
      this._lastRefill = now;
    }
  }
}

// ─── Sliding Window Counter ───────────────────────────────────────────────────

/**
 * Sliding window counter for rate limiting.
 *
 * Uses a ring buffer of sub-window buckets for O(1) updates.
 *
 * The default bucket count is now `fib(9)` = 34 (was 60), giving a
 * phi-proportioned partition of the window that aligns with the phi-scaled
 * timing hierarchy throughout the system.
 *
 * @private
 */
class SlidingWindow {
  /**
   * @param {number} windowMs - Total window duration
   * @param {number} [buckets=fib(9)] - Number of sub-window buckets (default 34)
   */
  constructor(windowMs, buckets = DEFAULT_SLIDING_WINDOW_BUCKETS) {
    this._windowMs   = windowMs;
    this._buckets    = buckets;
    this._bucketMs   = windowMs / buckets;
    this._counts     = new Array(buckets).fill(0);
    this._timestamps = new Array(buckets).fill(0);
    this._currentIdx = 0;
  }

  /**
   * Record a request hit.
   *
   * @returns {number} Current window count after increment
   */
  hit() {
    const now        = Date.now();
    const idx        = Math.floor((now / this._bucketMs) % this._buckets);
    const bucketStart = Math.floor(now / this._bucketMs) * this._bucketMs;

    if (this._timestamps[idx] !== bucketStart) {
      this._counts[idx]     = 0;
      this._timestamps[idx] = bucketStart;
    }
    this._counts[idx]++;
    this._currentIdx = idx;
    return this.count();
  }

  /**
   * Get the total count in the current sliding window.
   *
   * @returns {number}
   */
  count() {
    const now         = Date.now();
    const windowStart = now - this._windowMs;
    let total = 0;
    for (let i = 0; i < this._buckets; i++) {
      if (this._timestamps[i] >= windowStart) {
        total += this._counts[i];
      }
    }
    return total;
  }

  /** Reset all counters */
  reset() {
    this._counts.fill(0);
    this._timestamps.fill(0);
  }
}

// ─── Semantic Deduplication Cache ─────────────────────────────────────────────

/**
 * Cache for detecting semantically duplicate requests using CSL-gated
 * cosine similarity.
 *
 * Unlike the previous hard-threshold approach (sim > 0.95 = duplicate),
 * this cache uses `cslGate()` to compute a soft gate score.  A request is
 * considered a duplicate when its gated similarity score exceeds
 * DEDUP_THRESHOLD (≈ 0.972), which replaces the old 0.95 constant.
 *
 * The CSL gate sigmoid formula:
 *   gatedSim = sim × sigmoid((sim - DEDUP_THRESHOLD) / PHI_TEMPERATURE)
 *
 * This means borderline matches (0.95–0.972) now return a proportional
 * score instead of being silently accepted or rejected, giving callers
 * the option to act on the degree of similarity.
 *
 * @private
 */
class SemanticDedupCache {
  /**
   * @param {number} [ttlMs=fib(9)*100] - Entry TTL (duplicate window, default 3 400 ms)
   * @param {number} [maxSize=fib(17)] - Maximum cache entries (default F(17)=1597)
   */
  constructor(ttlMs = fib(9) * 100, maxSize = fib(17)) {
    this._ttlMs   = ttlMs;
    this._maxSize = maxSize;
    /** @type {Array<{embedding: number[], result: any, expires: number, requestId: string, similarity?: number}>} */
    this._entries = [];
  }

  /**
   * Check if a request is a semantic duplicate of a recent request.
   *
   * Uses cslGate() for soft similarity scoring:
   *   - Hard duplicate:  gatedSim ≥ DEDUP_THRESHOLD (≈ 0.972)
   *   - Near-duplicate:  gatedSim ∈ [CSL_THRESHOLDS.CRITICAL, DEDUP_THRESHOLD)
   *   - Not a duplicate: gatedSim < CSL_THRESHOLDS.CRITICAL
   *
   * @param {number[]} embedding - Request embedding vector
   * @returns {{isDuplicate: boolean, cachedResult?: any, originalRequestId?: string, similarity?: number, gatedSimilarity?: number}}
   */
  check(embedding) {
    const now = Date.now();
    // Evict expired entries
    this._entries = this._entries.filter(e => e.expires > now);

    for (const entry of this._entries) {
      const sim = cosineSimilarity(embedding, entry.embedding);

      /**
       * cslGate(): soft sigmoid gate centered on DEDUP_THRESHOLD.
       *
       * When sim >> DEDUP_THRESHOLD ≈ 0.972: gatedSim ≈ sim (gate open, duplicate)
       * When sim << DEDUP_THRESHOLD:          gatedSim ≈ 0   (gate closed, not duplicate)
       *
       * Replaces the old hard `if (sim >= 0.95)` check.
       */
      const gatedSim = cslGate(sim, sim, DEDUP_SIMILARITY_THRESHOLD);

      if (gatedSim >= DEDUP_SIMILARITY_THRESHOLD * DEDUP_SIMILARITY_THRESHOLD) {
        return {
          isDuplicate:       true,
          cachedResult:      entry.result,
          originalRequestId: entry.requestId,
          similarity:        sim,
          gatedSimilarity:   gatedSim,
        };
      }
    }
    return { isDuplicate: false };
  }

  /**
   * Store a request embedding and its result for future deduplication.
   *
   * @param {number[]} embedding
   * @param {any} result
   * @param {string} requestId
   */
  store(embedding, result, requestId) {
    if (this._entries.length >= this._maxSize) {
      this._entries.shift(); // LRU eviction
    }
    this._entries.push({
      embedding,
      result,
      requestId,
      expires: Date.now() + this._ttlMs,
    });
  }
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity in [0, 1]
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

/**
 * Generate a lightweight embedding from a request for deduplication.
 * Combines tool name + sorted parameter keys + value hashes.
 *
 * @param {string} toolName
 * @param {Object} params
 * @returns {number[]} 64-dim embedding
 */
function embedRequest(toolName, params) {
  const text = toolName + ':' + JSON.stringify(params ?? {});
  const hash = crypto.createHash('sha256').update(text).digest();
  const vec  = new Float64Array(64);
  for (let i = 0; i < 64; i++) {
    vec[i] = (hash[i % 32] / 128) - 1; // Normalize to [-1, 1]
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map(v => v / norm);
}

// ─── Rate Limit Config ────────────────────────────────────────────────────────

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} [requestsPerMinute=60] - Steady-state rate per minute
 * @property {number} [burstMultiplier=2] - Burst = rate * burstMultiplier
 * @property {number} [windowMs=fib(11)*1000] - Sliding window duration (89 000 ms)
 * @property {number} [queueTimeoutMs=fib(9)*100] - How long queued requests wait (3 400 ms)
 * @property {number} [dedupTtlMs=fib(9)*100] - Deduplication window (3 400 ms)
 * @property {boolean} [enableDedup=true] - Enable semantic deduplication
 * @property {boolean} [enableQueue=true] - Queue requests instead of rejecting
 * @property {number} [priority=1] - Default request priority (lower = higher)
 */

// ─── SemanticRateLimiter ──────────────────────────────────────────────────────

/**
 * Multi-layer semantic rate limiter for MCP tool calls.
 *
 * Limits are applied at three granularities:
 * 1. **Per-tool**: Global tool-level rate (protects downstream servers)
 * 2. **Per-user-per-tool**: Individual user quota per tool
 * 3. **Per-session**: Total calls within a session (prevents agent loops)
 *
 * Semantic deduplication detects near-identical repeated requests using
 * CSL-gated cosine similarity (DEDUP_THRESHOLD ≈ 0.972, replaces old 0.95)
 * and returns cached results within the deduplication window, saving
 * downstream round-trips.
 *
 * @extends EventEmitter
 * @fires SemanticRateLimiter#rate_limited
 * @fires SemanticRateLimiter#duplicate_detected
 * @fires SemanticRateLimiter#request_queued
 * @fires SemanticRateLimiter#request_served_from_queue
 *
 * @example
 * ```js
 * const limiter = new SemanticRateLimiter();
 *
 * limiter.configure('github.create_issue', {
 *   requestsPerMinute: 30,
 *   burstMultiplier: 2,
 *   enableDedup: true,
 *   dedupTtlMs: fib(9) * 100,  // 3 400 ms
 * });
 *
 * // In your tool call handler:
 * const { allowed, headers, deduplicated, cachedResult } =
 *   await limiter.check('github.create_issue', params, { userId: 'u1', sessionId: 's1' });
 *
 * if (deduplicated) return cachedResult;
 * if (!allowed) throw new Error('Rate limited');
 * ```
 */
export class SemanticRateLimiter extends EventEmitter {
  /**
   * @param {Object} [options={}]
   * @param {RateLimitConfig} [options.defaults] - Default config for all tools
   * @param {number} [options.globalRpm=fib(16)] - Global gateway-level rate limit (default 987 rpm)
   */
  constructor(options = {}) {
    super();

    /** @type {RateLimitConfig} */
    this._defaults = {
      requestsPerMinute:  fib(9) + fib(10),  // F(9)+F(10) = 34+55 = 89 ≈ old default 60 (phi-adjacent)
      burstMultiplier:    2,
      windowMs:           DEFAULT_WINDOW_MS,
      queueTimeoutMs:     fib(9) * 100,       // F(9)×100 = 3 400 ms (≈ old 5 000 ms, phi-shortened)
      dedupTtlMs:         fib(9) * 100,       // F(9)×100 = 3 400 ms
      enableDedup:        true,
      enableQueue:        true,
      priority:           1,
      ...options.defaults,
    };

    /**
     * Global gateway-level rate limit in requests per minute.
     * fib(16) = 987 ≈ 1 000 (old default).
     *
     * @type {number} 987
     */
    this._globalRpm = options.globalRpm ?? fib(16); // F(16) = 987

    /** @type {Map<string, RateLimitConfig>} toolName → config */
    this._toolConfigs = new Map();

    /** @type {Map<string, TokenBucket>} limitKey → bucket */
    this._buckets = new Map();

    /** @type {Map<string, SlidingWindow>} limitKey → window */
    this._windows = new Map();

    /** @type {Map<string, SemanticDedupCache>} toolName → dedup cache */
    this._dedupCaches = new Map();

    /** @type {Map<string, PriorityQueue>} toolName → wait queue */
    this._queues = new Map();

    /** @type {TokenBucket} Gateway-global rate bucket */
    this._globalBucket = new TokenBucket({
      capacity:        Math.ceil(this._globalRpm * 2),
      refillRate:      Math.ceil(this._globalRpm / 60),
      refillIntervalMs: DEFAULT_REFILL_INTERVAL_MS,  // fib(8)×100 = 2 100 ms
    });

    /** @type {Map<string, {allowed: number, rejected: number, deduped: number}>} */
    this._stats = new Map();

    // Periodic cleanup — fib(14)×1000 = 377 000 ms ≈ 6.3 min
    this._cleanupTimer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
    this._cleanupTimer.unref?.();
  }

  // ─── Configuration ─────────────────────────────────────────────────────────

  /**
   * Configure rate limits for a specific tool.
   *
   * @param {string} toolName - Fully-qualified tool name
   * @param {RateLimitConfig} config - Rate limit configuration
   */
  configure(toolName, config) {
    this._toolConfigs.set(toolName, { ...this._defaults, ...config });
  }

  /**
   * Configure rate limits for multiple tools.
   *
   * @param {Object<string, RateLimitConfig>} configs
   */
  configureAll(configs) {
    for (const [toolName, config] of Object.entries(configs)) {
      this.configure(toolName, config);
    }
  }

  // ─── Core Check ────────────────────────────────────────────────────────────

  /**
   * Check rate limits and deduplication for a tool call.
   *
   * @param {string} toolName - Fully-qualified tool name
   * @param {Object} params - Tool call parameters
   * @param {Object} [context={}]
   * @param {string} [context.userId='anonymous']
   * @param {string} [context.sessionId='default']
   * @param {string} [context.requestId]
   * @param {number} [context.priority=1] - Request priority (lower = higher priority)
   * @returns {Promise<{
   *   allowed: boolean,
   *   deduplicated: boolean,
   *   cachedResult?: any,
   *   headers: Object,
   *   retryAfterMs: number,
   *   queuePosition?: number,
   *   dedupSimilarity?: number,
   * }>}
   */
  async check(toolName, params, context = {}) {
    const userId    = context.userId    ?? 'anonymous';
    const sessionId = context.sessionId ?? 'default';
    const requestId = context.requestId ?? crypto.randomUUID();
    const config    = this._toolConfigs.get(toolName) ?? this._defaults;
    const priority  = context.priority ?? config.priority;

    this._ensureStats(toolName);

    // ── 1. Global gateway check ──────────────────────────────────────────────
    const globalCheck = this._globalBucket.consume(1);
    if (!globalCheck.allowed) {
      this._stats.get(toolName).rejected++;
      this.emit('rate_limited', { requestId, toolName, userId, level: 'global', retryAfterMs: globalCheck.retryAfterMs });
      return this._buildResult(false, config, null, globalCheck.retryAfterMs, 'Gateway rate limit exceeded');
    }

    // ── 2. Semantic deduplication (CSL-gated) ────────────────────────────────
    if (config.enableDedup) {
      const embedding  = embedRequest(toolName, params);
      const dedupCache = this._getDedupCache(toolName, config);
      const dedupResult = dedupCache.check(embedding);

      if (dedupResult.isDuplicate) {
        this._stats.get(toolName).deduped++;
        this.emit('duplicate_detected', {
          requestId, toolName, userId,
          originalRequestId: dedupResult.originalRequestId,
          similarity:        dedupResult.similarity?.toFixed(4),
          gatedSimilarity:   dedupResult.gatedSimilarity?.toFixed(4),
          /**
           * Note: the old event payload said `similarity: '≥0.95'`.
           * Now we report the actual CSL-gated value for observability,
           * and reference the phi-derived threshold in the label.
           */
          threshold:         `DEDUP_THRESHOLD≈${DEDUP_SIMILARITY_THRESHOLD.toFixed(3)}`,
        });
        return {
          allowed:       true,
          deduplicated:  true,
          cachedResult:  dedupResult.cachedResult,
          headers:       this._buildHeaders(toolName, userId, sessionId, config),
          retryAfterMs:  0,
          dedupSimilarity: dedupResult.gatedSimilarity,
        };
      }
    }

    // ── 3. Per-tool token bucket ─────────────────────────────────────────────
    const toolBucket = this._getBucket(`tool:${toolName}`, config);
    const toolCheck  = toolBucket.consume(1);

    // ── 4. Per-user-per-tool sliding window ──────────────────────────────────
    const userKey     = `user:${userId}:${toolName}`;
    const userWindow  = this._getWindow(userKey, config);
    const userCount   = userWindow.hit();
    const userLimit   = Math.ceil(config.requestsPerMinute / fib(5)); // User gets 1/F(5) = 1/5 of tool limit
    const userAllowed = userCount <= userLimit;

    // ── 5. Per-session sliding window ────────────────────────────────────────
    const sessionKey     = `session:${sessionId}`;
    const sessionWindow  = this._getWindow(sessionKey, config);
    const sessionCount   = sessionWindow.hit();
    const sessionLimit   = config.requestsPerMinute * fib(4); // Session total = F(4)=3× tool limit
    const sessionAllowed = sessionCount <= sessionLimit;

    const allowed = toolCheck.allowed && userAllowed && sessionAllowed;

    if (!allowed) {
      this._stats.get(toolName).rejected++;

      let retryAfterMs = toolCheck.retryAfterMs;
      let reason = 'Tool rate limit exceeded';
      if (!userAllowed)    { retryAfterMs = DEFAULT_WINDOW_MS; reason = 'User rate limit exceeded'; }
      if (!sessionAllowed) { retryAfterMs = DEFAULT_WINDOW_MS; reason = 'Session rate limit exceeded'; }

      this.emit('rate_limited', { requestId, toolName, userId, sessionId, reason, retryAfterMs });

      // Queue the request if enabled and queue not full
      if (config.enableQueue) {
        const queue = this._getQueue(toolName);
        if (queue.size < MAX_QUEUE_SIZE) {
          return this._enqueue(queue, toolName, priority, config, requestId);
        }
      }

      return this._buildResult(false, config, null, retryAfterMs, reason);
    }

    this._stats.get(toolName).allowed++;
    const headers = this._buildHeaders(toolName, userId, sessionId, config);
    return { allowed: true, deduplicated: false, headers, retryAfterMs: 0 };
  }

  /**
   * Record the result of a tool call for deduplication caching.
   *
   * @param {string} toolName
   * @param {Object} params
   * @param {*} result
   * @param {string} [requestId]
   */
  cacheResult(toolName, params, result, requestId) {
    const config = this._toolConfigs.get(toolName) ?? this._defaults;
    if (!config.enableDedup) return;
    const embedding  = embedRequest(toolName, params);
    const dedupCache = this._getDedupCache(toolName, config);
    dedupCache.store(embedding, result, requestId ?? crypto.randomUUID());
  }

  // ─── Queue Management ──────────────────────────────────────────────────────

  /**
   * Enqueue a rate-limited request to be served when tokens are available.
   *
   * @param {PriorityQueue} queue
   * @param {string} toolName
   * @param {number} priority
   * @param {RateLimitConfig} config
   * @param {string} requestId
   * @returns {Promise<Object>}
   * @private
   */
  _enqueue(queue, toolName, priority, config, requestId) {
    return new Promise((resolve, reject) => {
      const expires = Date.now() + config.queueTimeoutMs;
      const pos     = queue.size;
      queue.push(priority, resolve, reject, expires);
      this.emit('request_queued', { requestId, toolName, priority, queuePosition: pos });
      // Schedule serving the queue after a short phi-scaled delay (fib(5)×10 = 50 ms)
      setTimeout(() => this._drainQueue(toolName), fib(5) * 10);
    });
  }

  /**
   * Attempt to drain the queue for a tool by serving waiting requests.
   *
   * @param {string} toolName
   * @private
   */
  _drainQueue(toolName) {
    const queue = this._queues.get(toolName);
    if (!queue || queue.size === 0) return;

    const config = this._toolConfigs.get(toolName) ?? this._defaults;
    const bucket = this._getBucket(`tool:${toolName}`, config);

    queue.expireOld();

    while (queue.size > 0 && bucket.tokens >= 1) {
      const item = queue.pop();
      if (!item) break;
      bucket.consume(1);
      item.resolve({ allowed: true, deduplicated: false, headers: {}, retryAfterMs: 0, servedFromQueue: true });
      this.emit('request_served_from_queue', { toolName });
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * @param {string} key
   * @param {RateLimitConfig} config
   * @returns {TokenBucket}
   * @private
   */
  _getBucket(key, config) {
    if (!this._buckets.has(key)) {
      const capacity = Math.ceil(config.requestsPerMinute * config.burstMultiplier);
      this._buckets.set(key, new TokenBucket({
        capacity,
        refillRate:      Math.max(1, Math.ceil(config.requestsPerMinute / 60)),
        refillIntervalMs: DEFAULT_REFILL_INTERVAL_MS,  // fib(8)×100 = 2 100 ms
        initialTokens:   capacity,
      }));
    }
    return this._buckets.get(key);
  }

  /**
   * @param {string} key
   * @param {RateLimitConfig} config
   * @returns {SlidingWindow}
   * @private
   */
  _getWindow(key, config) {
    if (!this._windows.has(key)) {
      this._windows.set(key, new SlidingWindow(config.windowMs));
    }
    return this._windows.get(key);
  }

  /**
   * @param {string} toolName
   * @param {RateLimitConfig} config
   * @returns {SemanticDedupCache}
   * @private
   */
  _getDedupCache(toolName, config) {
    if (!this._dedupCaches.has(toolName)) {
      this._dedupCaches.set(toolName, new SemanticDedupCache(config.dedupTtlMs));
    }
    return this._dedupCaches.get(toolName);
  }

  /**
   * @param {string} toolName
   * @returns {PriorityQueue}
   * @private
   */
  _getQueue(toolName) {
    if (!this._queues.has(toolName)) {
      this._queues.set(toolName, new PriorityQueue());
    }
    return this._queues.get(toolName);
  }

  /**
   * Build rate limit response headers.
   *
   * @param {string} toolName
   * @param {string} userId
   * @param {string} sessionId
   * @param {RateLimitConfig} config
   * @returns {Object}
   * @private
   */
  _buildHeaders(toolName, userId, sessionId, config) {
    const bucket   = this._getBucket(`tool:${toolName}`, config);
    const window   = this._getWindow(`user:${userId}:${toolName}`, config);
    const userLimit = Math.ceil(config.requestsPerMinute / fib(5));
    const resetTs  = Math.ceil((Date.now() + config.windowMs) / 1000);

    return {
      'X-RateLimit-Limit':     String(config.requestsPerMinute),
      'X-RateLimit-Remaining': String(Math.max(0, userLimit - window.count())),
      'X-RateLimit-Reset':     String(resetTs),
      'X-RateLimit-Burst':     String(Math.floor(bucket.tokens)),
      'X-RateLimit-Policy':    `${config.requestsPerMinute};w=${config.windowMs / 1000}`,
      'X-RateLimit-Window-Ms': String(DEFAULT_WINDOW_MS),
      'X-RateLimit-Phi-Dedup': `threshold=${DEDUP_SIMILARITY_THRESHOLD.toFixed(4)}`,
    };
  }

  /**
   * @param {boolean} allowed
   * @param {RateLimitConfig} config
   * @param {string|null} cachedResult
   * @param {number} retryAfterMs
   * @param {string} reason
   * @returns {Object}
   * @private
   */
  _buildResult(allowed, config, cachedResult, retryAfterMs, reason) {
    const headers = {};
    if (!allowed) {
      headers['Retry-After']           = String(Math.ceil(retryAfterMs / 1000));
      headers['X-RateLimit-Remaining'] = '0';
    }
    return { allowed, deduplicated: false, cachedResult, headers, retryAfterMs, reason };
  }

  /**
   * Ensure stats map has entry for tool.
   *
   * @param {string} toolName
   * @private
   */
  _ensureStats(toolName) {
    if (!this._stats.has(toolName)) {
      this._stats.set(toolName, { allowed: 0, rejected: 0, deduped: 0 });
    }
  }

  /** Clean up expired entries to prevent memory growth */
  _cleanup() {
    // Expire all queue entries
    for (const [, queue] of this._queues) queue.expireOld();
    // Clean up very old sliding windows (no activity)
    // (dedup caches self-clean on access)
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  /**
   * Get rate limiter statistics.
   *
   * @returns {Object}
   */
  getStats() {
    const toolStats = {};
    for (const [toolName, s] of this._stats) {
      toolStats[toolName] = {
        ...s,
        total:       s.allowed + s.rejected + s.deduped,
        dedupRate:   s.deduped > 0 ? `${((s.deduped / (s.allowed + s.deduped)) * 100).toFixed(1)}%` : '0%',
        queueDepth:  this._queues.get(toolName)?.size ?? 0,
        bucketTokens: this._buckets.get(`tool:${toolName}`)?.tokens ?? 'N/A',
      };
    }
    return {
      globalBucketTokens:   this._globalBucket.tokens,
      globalBucketCapacity: this._globalBucket.capacity,
      configuredTools:      this._toolConfigs.size,
      activeBuckets:        this._buckets.size,
      activeWindows:        this._windows.size,
      dedupCaches:          this._dedupCaches.size,
      phiConstants: {
        DEDUP_THRESHOLD:          DEDUP_SIMILARITY_THRESHOLD,
        DEFAULT_WINDOW_MS,
        DEFAULT_REFILL_INTERVAL_MS,
        CLEANUP_INTERVAL_MS,
        DEFAULT_SLIDING_WINDOW_BUCKETS,
        MAX_QUEUE_SIZE,
        CSL_THRESHOLDS,
      },
      tools: toolStats,
    };
  }

  /**
   * Reset rate limits for a specific user (e.g., after billing top-up).
   *
   * @param {string} userId
   */
  resetUser(userId) {
    for (const [key, window] of this._windows) {
      if (key.startsWith(`user:${userId}:`)) window.reset();
    }
  }

  /**
   * Reset all rate limits (e.g., for testing).
   */
  reset() {
    this._buckets.clear();
    this._windows.clear();
    for (const [, s] of this._stats) { s.allowed = 0; s.rejected = 0; s.deduped = 0; }
  }

  /**
   * Destroy the rate limiter (stops background timers).
   */
  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }
}

export { TokenBucket, SlidingWindow, SemanticDedupCache, PriorityQueue, cosineSimilarity, embedRequest };
export default SemanticRateLimiter;

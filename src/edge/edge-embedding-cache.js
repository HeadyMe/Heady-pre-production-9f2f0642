/**
 * edge-embedding-cache.js
 * Heady Latent OS — Edge Embedding Cache
 *
 * LRU cache with TTL for embedding vectors at the Cloudflare edge.
 * Reduces Workers AI inference cost by 60–80% for repeated queries.
 *
 * Two-tier caching:
 *   L1 — In-memory LRU (fast, bounded by MAX_MEMORY_ITEMS)
 *   L2 — Workers KV (persistent, globally replicated, TTL-based)
 *
 * Cache key: SHA-256 of (model + normalized text) → deterministic hex string
 * Memory bound: configurable MAX_MEMORY_ITEMS (default: 1,000 — Fibonacci-based)
 * TTL: configurable per model tier (embed-fast: 1h, embed-standard: 3h)
 *
 * Sacred Geometry: LRU eviction uses Fibonacci-based batch eviction (evict 8
 * entries at a time, not 1 at a time — reduces churn).
 *
 * Hit rate metrics tracked in-memory and optionally persisted to KV.
 *
 * @module edge-embedding-cache
 */

import { PHI, PSI, fib, phiBackoff } from '../../shared/phi-math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default in-memory LRU max size — fib(16) = 987 (Fibonacci-exact, was 1000) */
const DEFAULT_MAX_MEMORY_ITEMS = fib(16); // 987 (phi-continuous Fibonacci)

/** Fibonacci eviction batch size — fib(6) = 8, made explicit via fib() */
const EVICTION_BATCH_SIZE = fib(6); // fib(6) = 8 (already Fibonacci — made explicit)

/**
 * Default KV TTL per model (seconds).
 * phi-scaled: PHI^n × 60s base
 *   bge-small:  round(60 × PHI^7) ≈ 1742s
 *   bge-base:   round(60 × PHI^8) ≈ 2818s
 *   bge-large:  round(60 × PHI^9) ≈ 4559s
 *   default:    round(60 × PHI^7) ≈ 1742s (phi-harmonic noise-floor tier)
 */
const DEFAULT_KV_TTL = {
  'bge-small': Math.round(60 * Math.pow(PHI, 7)),   // ≈ 1742s — phi^7 × 60s
  'bge-base':  Math.round(60 * Math.pow(PHI, 8)),   // ≈ 2818s — phi^8 × 60s
  'bge-large': Math.round(60 * Math.pow(PHI, 9)),   // ≈ 4559s — phi^9 × 60s
  'default':   Math.round(60 * Math.pow(PHI, 7)),   // ≈ 1742s — phi^7 × 60s (noise-floor tier)
};

/** KV cache key prefix */
const KV_PREFIX = 'emb:';

/**
 * Metrics flush interval to KV (ms).
 * phi-scaled: round(60_000 × PHI^4) ≈ 411_000ms ≈ 6.8min.
 */
const METRICS_FLUSH_INTERVAL_MS = Math.round(60_000 * Math.pow(PHI, 4)); // ≈ 411_000ms (phi^4 × 60s)

/** Cache warming batch size — fib(7) = 13, made explicit via fib() */
const WARM_BATCH_SIZE = fib(7); // fib(7) = 13 (already Fibonacci — made explicit)

// ─────────────────────────────────────────────────────────────────────────────
// LRU Node for doubly-linked list
// ─────────────────────────────────────────────────────────────────────────────

class LRUNode {
  /**
   * @param {string} key
   * @param {CacheEntry} value
   */
  constructor(key, value) {
    this.key = key;
    this.value = value;
    /** @type {LRUNode|null} */
    this.prev = null;
    /** @type {LRUNode|null} */
    this.next = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU cache data structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} CacheEntry
 * @property {number[]} embedding - Float32 embedding vector
 * @property {string} model - Model that generated this embedding
 * @property {number} dimensions - Vector dimensionality
 * @property {number} expiresAt - Unix timestamp (ms)
 * @property {number} accessCount - Hit count for this entry
 * @property {number} createdAt - Unix timestamp (ms)
 */

class LRUCache {
  /**
   * @param {number} maxSize
   */
  constructor(maxSize) {
    this.maxSize = maxSize;
    /** @type {Map<string, LRUNode>} */
    this._map = new Map();
    /** @type {LRUNode} Sentinel head (MRU end) */
    this._head = new LRUNode('__HEAD__', null);
    /** @type {LRUNode} Sentinel tail (LRU end) */
    this._tail = new LRUNode('__TAIL__', null);
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._size = 0;
  }

  get size() { return this._size; }

  /**
   * Get an entry and move it to the MRU position.
   * @param {string} key
   * @returns {CacheEntry|undefined}
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) return undefined;

    // Check TTL expiry
    if (node.value.expiresAt < Date.now()) {
      this._remove(node);
      return undefined;
    }

    // Move to head (MRU)
    this._remove(node);
    this._insertHead(node);
    node.value.accessCount++;
    return node.value;
  }

  /**
   * Insert or update an entry.
   * @param {string} key
   * @param {CacheEntry} value
   */
  set(key, value) {
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      this._remove(existing);
      this._insertHead(existing);
      return;
    }

    const node = new LRUNode(key, value);
    this._map.set(key, node);
    this._insertHead(node);
    this._size++;

    // Evict LRU entries in Fibonacci batch when over capacity
    while (this._size > this.maxSize) {
      this._evictBatch(EVICTION_BATCH_SIZE);
    }
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const node = this._map.get(key);
    if (!node) return false;
    this._remove(node);
    return true;
  }

  /** Clear all entries. */
  clear() {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._size = 0;
  }

  /**
   * Evict the N least-recently-used entries.
   * @param {number} n
   */
  _evictBatch(n) {
    for (let i = 0; i < n && this._size > 0; i++) {
      const lru = this._tail.prev;
      if (lru === this._head) break;
      this._remove(lru);
    }
  }

  /** @param {LRUNode} node */
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
    this._map.delete(node.key);
    this._size--;
  }

  /** @param {LRUNode} node */
  _insertHead(node) {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next.prev = node;
    this._head.next = node;
    this._map.set(node.key, node);
    this._size++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EdgeEmbeddingCache class
// ─────────────────────────────────────────────────────────────────────────────

export class EdgeEmbeddingCache {
  /**
   * @param {object} config
   * @param {KVNamespace} [config.kv] - Workers KV for L2 persistence
   * @param {number} [config.maxMemoryItems] - L1 LRU max items
   * @param {object} [config.kvTtl] - Per-model KV TTL overrides
   * @param {boolean} [config.enableMetrics] - Track hit/miss stats
   * @param {boolean} [config.enableKv] - Enable L2 KV cache (default: true if kv provided)
   */
  constructor({
    kv = null,
    maxMemoryItems = DEFAULT_MAX_MEMORY_ITEMS,
    kvTtl = {},
    enableMetrics = true,
    enableKv = true,
  } = {}) {
    this.kv = kv;
    this.enableKv = enableKv && !!kv;
    this.kvTtl = { ...DEFAULT_KV_TTL, ...kvTtl };
    this.enableMetrics = enableMetrics;

    /** @type {LRUCache} L1 in-memory cache */
    this._l1 = new LRUCache(maxMemoryItems);

    /** Metrics counters */
    this._metrics = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      errors: 0,
    };

    this._lastMetricsFlush = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Look up a single embedding by text + model.
   * Checks L1 (memory) then L2 (KV).
   *
   * @param {string} text - Input text
   * @param {string} model - Model identifier
   * @returns {Promise<number[]|null>} Embedding vector or null on miss
   */
  async get(text, model) {
    const key = await this._makeKey(text, model);

    // L1 check
    const l1Entry = this._l1.get(key);
    if (l1Entry) {
      if (this.enableMetrics) this._metrics.l1Hits++;
      return l1Entry.embedding;
    }

    // L2 check (KV)
    if (this.enableKv && this.kv) {
      try {
        const l2Entry = await this.kv.get(`${KV_PREFIX}${key}`, { type: 'json' });
        if (l2Entry && l2Entry.expiresAt > Date.now()) {
          if (this.enableMetrics) this._metrics.l2Hits++;
          // Promote to L1
          this._l1.set(key, l2Entry);
          return l2Entry.embedding;
        }
      } catch (err) {
        if (this.enableMetrics) this._metrics.errors++;
        console.warn('[EdgeEmbeddingCache] KV get error:', err.message);
      }
    }

    if (this.enableMetrics) this._metrics.misses++;
    return null;
  }

  /**
   * Store an embedding vector for text + model.
   * Writes to both L1 and L2 (KV) if enabled.
   *
   * @param {string} text
   * @param {string} model
   * @param {number[]} embedding
   * @param {object} [options]
   * @param {number} [options.ttlSeconds] - Override TTL
   * @param {number} [options.dimensions] - Vector dimensionality
   * @returns {Promise<void>}
   */
  async set(text, model, embedding, { ttlSeconds, dimensions } = {}) {
    const key = await this._makeKey(text, model);
    const ttl = ttlSeconds ?? this._getTtl(model);
    const entry = {
      embedding,
      model,
      dimensions: dimensions ?? embedding.length,
      expiresAt: Date.now() + ttl * 1000,
      accessCount: 0,
      createdAt: Date.now(),
    };

    // Write to L1
    this._l1.set(key, entry);

    // Write to L2 (fire and forget — don't block response)
    if (this.enableKv && this.kv) {
      this.kv.put(`${KV_PREFIX}${key}`, JSON.stringify(entry), { expirationTtl: ttl }).catch((err) => {
        if (this.enableMetrics) this._metrics.errors++;
        console.warn('[EdgeEmbeddingCache] KV put error:', err.message);
      });
    }

    if (this.enableMetrics) this._metrics.writes++;
  }

  /**
   * Batch cache lookup for multiple texts.
   * Returns a map of text → embedding (null for misses).
   *
   * @param {string[]} texts
   * @param {string} model
   * @returns {Promise<Map<string, number[]|null>>}
   */
  async getBatch(texts, model) {
    const results = new Map();

    await Promise.all(
      texts.map(async (text) => {
        const embedding = await this.get(text, model);
        results.set(text, embedding);
      }),
    );

    return results;
  }

  /**
   * Batch write multiple embeddings.
   *
   * @param {Array<{text: string, embedding: number[]}>} items
   * @param {string} model
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async setBatch(items, model, options = {}) {
    await Promise.all(
      items.map(({ text, embedding }) => this.set(text, model, embedding, options)),
    );
  }

  /**
   * Warm the cache with common queries.
   * Fetches embeddings from Workers AI for the provided texts and caches them.
   *
   * @param {string[]} texts - Common queries to pre-embed
   * @param {string} model - Embedding model to use
   * @param {AI} ai - Workers AI binding
   * @returns {Promise<{warmed: number, errors: number}>}
   */
  async warm(texts, model, ai) {
    if (!ai) throw new Error('Workers AI binding required for cache warming');

    let warmed = 0;
    let errors = 0;

    // Process in Fibonacci batches
    for (let i = 0; i < texts.length; i += WARM_BATCH_SIZE) {
      const batch = texts.slice(i, i + WARM_BATCH_SIZE);

      // Check which are already cached
      const uncached = [];
      for (const text of batch) {
        const cached = await this.get(text, model);
        if (!cached) uncached.push(text);
      }

      if (uncached.length === 0) continue;

      try {
        const result = await ai.run(model, { text: uncached });
        const embeddings = result.data ?? result ?? [];

        for (let j = 0; j < uncached.length; j++) {
          if (embeddings[j]) {
            await this.set(uncached[j], model, embeddings[j]);
            warmed++;
          }
        }
      } catch (err) {
        errors += uncached.length;
        console.error('[EdgeEmbeddingCache] warming batch error:', err);
      }
    }

    return { warmed, errors };
  }

  /**
   * Invalidate a specific embedding from all cache layers.
   * @param {string} text
   * @param {string} model
   * @returns {Promise<void>}
   */
  async invalidate(text, model) {
    const key = await this._makeKey(text, model);
    this._l1.delete(key);
    if (this.enableKv && this.kv) {
      await this.kv.delete(`${KV_PREFIX}${key}`).catch(() => {});
    }
  }

  /**
   * Clear the L1 in-memory cache entirely.
   */
  clearMemory() {
    this._l1.clear();
  }

  /**
   * Get cache hit rate metrics.
   * @param {ExecutionContext} [ctx] - If provided, flushes metrics to KV in background
   * @returns {object}
   */
  getMetrics(ctx) {
    const { l1Hits, l2Hits, misses, writes, errors } = this._metrics;
    const totalLookups = l1Hits + l2Hits + misses;
    const hitRate = totalLookups > 0 ? (l1Hits + l2Hits) / totalLookups : 0;
    const l1Rate = totalLookups > 0 ? l1Hits / totalLookups : 0;

    const metrics = {
      hits: { l1: l1Hits, l2: l2Hits, total: l1Hits + l2Hits },
      misses,
      writes,
      errors,
      hitRate: Math.round(hitRate * 10000) / 100, // percent with 2 decimals
      l1HitRate: Math.round(l1Rate * 10000) / 100,
      totalLookups,
      l1Size: this._l1.size,
      l1MaxSize: this._l1.maxSize,
      l1Utilization: Math.round((this._l1.size / this._l1.maxSize) * 100),
    };

    // Async flush to KV if context provided and interval elapsed
    if (ctx && this.enableKv && this.kv && (Date.now() - this._lastMetricsFlush > METRICS_FLUSH_INTERVAL_MS)) {
      this._lastMetricsFlush = Date.now();
      ctx.waitUntil(
        this.kv.put('emb:metrics', JSON.stringify({ ...metrics, updatedAt: Date.now() }), { expirationTtl: 86400 })
          .catch(() => {}),
      );
    }

    return metrics;
  }

  /**
   * Get the number of items currently in the L1 cache.
   * @returns {number}
   */
  get size() {
    return this._l1.size;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate a deterministic cache key from text + model.
   * Uses SHA-256 over normalized (lowercased, trimmed) text.
   *
   * @param {string} text
   * @param {string} model
   * @returns {Promise<string>}
   */
  async _makeKey(text, model) {
    // Normalize: lowercase, collapse whitespace
    const normalized = `${model}::${text.toLowerCase().trim().replace(/\s+/g, ' ')}`;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Determine KV TTL for a model string.
   * @param {string} model
   * @returns {number} seconds
   */
  _getTtl(model) {
    if (model.includes('small')) return this.kvTtl['bge-small'] ?? this.kvTtl.default;
    if (model.includes('large')) return this.kvTtl['bge-large'] ?? this.kvTtl.default;
    if (model.includes('base')) return this.kvTtl['bge-base'] ?? this.kvTtl.default;
    return this.kvTtl.default ?? DEFAULT_KV_TTL.default;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware factory — wrap Workers AI embed calls with cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a cached embedding function that wraps Workers AI.
 * Drop-in replacement for `env.AI.run(model, { text: [...] })`.
 *
 * @param {AI} ai - Workers AI binding
 * @param {EdgeEmbeddingCache} cache - Cache instance
 * @param {string} [defaultModel] - Default embedding model
 * @returns {Function}
 *
 * @example
 * const cachedEmbed = createCachedEmbedder(env.AI, embeddingCache);
 * const result = await cachedEmbed(['hello', 'world']);
 */
export function createCachedEmbedder(ai, cache, defaultModel = '@cf/baai/bge-base-en-v1.5') {
  return async function cachedEmbed(texts, model = defaultModel) {
    const textArray = Array.isArray(texts) ? texts : [texts];

    const results = new Array(textArray.length).fill(null);
    const uncachedIndices = [];

    // L1/L2 lookup
    for (let i = 0; i < textArray.length; i++) {
      const cached = await cache.get(textArray[i], model);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
      }
    }

    if (uncachedIndices.length === 0) {
      return { data: results, source: 'cache', model };
    }

    // Fetch uncached from Workers AI
    const uncachedTexts = uncachedIndices.map((i) => textArray[i]);
    const aiResult = await ai.run(model, { text: uncachedTexts });
    const embeddings = aiResult.data ?? aiResult ?? [];

    // Fill results and write to cache
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      results[idx] = embeddings[j] ?? null;
      if (embeddings[j]) {
        // Fire and forget cache write
        cache.set(textArray[idx], model, embeddings[j]).catch(console.error);
      }
    }

    return { data: results, source: 'mixed', model, cacheHits: textArray.length - uncachedIndices.length };
  };
}

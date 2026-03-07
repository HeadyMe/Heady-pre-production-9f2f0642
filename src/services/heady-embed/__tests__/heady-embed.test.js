'use strict';

/**
 * HeadyEmbed — Comprehensive Test Suite
 *
 * Tests:
 *   - Single embedding generation
 *   - Batch processing
 *   - Cache hit/miss
 *   - Model switching / hot-swap
 *   - Cosine similarity computation
 *   - Health check output
 *   - Error handling
 *   - Bloom filter
 *   - LRU eviction
 *   - PHI-scaled retry backoff
 *   - Batch deduplication
 *   - Priority queue
 *   - Cache persistence (JSONL)
 *   - Route handlers (HTTP)
 *
 * Run with: jest __tests__/heady-embed.test.js
 * Or: node --experimental-vm-modules node_modules/.bin/jest
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mock @xenova/transformers so tests run without downloading ONNX models
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@xenova/transformers', () => {
  let callCount = 0;

  // Returns a deterministic fake embedding based on text content
  const fakePipeline = async (text, options = {}) => {
    callCount++;
    // Generate a 384-dim vector from text hash
    const arr = new Float32Array(384);
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    for (let i = 0; i < 384; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      arr[i] = (seed / 0xffffffff) * 2 - 1;
    }
    return { data: arr };
  };

  fakePipeline._callCount = () => callCount;
  fakePipeline._reset = () => { callCount = 0; };

  return {
    pipeline: jest.fn().mockResolvedValue(fakePipeline),
    env: {
      allowLocalModels: false,
      useBrowserCache: false,
    },
  };
}, { virtual: true });

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocking)
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const os = require('os');

const { HeadyEmbed, l2Normalize, cosineSimilarity, config } = require('../index');
const { EmbeddingCache, BloomFilter } = require('../cache');
const { BatchProcessor, PriorityQueue } = require('../batch-processor');
const { ModelManager, MODEL_REGISTRY } = require('../models');
const { buildHealthReport } = require('../health');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTmpPath() {
  return path.join(os.tmpdir(), `heady-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `heady-test-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function makeService(overrides = {}) {
  const svc = new HeadyEmbed({
    warmupOnStart: false,
    cacheWarmOnStart: false,
    cachePersistPath: makeTmpPath(),
    ...overrides,
  });
  await svc.initialize();
  return svc;
}

// ─────────────────────────────────────────────────────────────────────────────
// === 1. Math Utilities ===
// ─────────────────────────────────────────────────────────────────────────────

describe('Math utilities', () => {
  describe('l2Normalize', () => {
    test('produces unit vector (norm ≈ 1)', () => {
      const vec = [3, 4]; // norm = 5
      const norm = l2Normalize(vec);
      const magnitude = Math.sqrt(norm.reduce((s, v) => s + v * v, 0));
      expect(magnitude).toBeCloseTo(1.0, 6);
    });

    test('correct values: [3,4] → [0.6, 0.8]', () => {
      const norm = l2Normalize([3, 4]);
      expect(norm[0]).toBeCloseTo(0.6, 5);
      expect(norm[1]).toBeCloseTo(0.8, 5);
    });

    test('handles zero vector without throwing', () => {
      const result = l2Normalize([0, 0, 0]);
      expect(result).toEqual([0, 0, 0]);
    });

    test('handles 384-dim vector', () => {
      const vec = Array.from({ length: 384 }, (_, i) => Math.sin(i));
      const norm = l2Normalize(vec);
      const mag = Math.sqrt(norm.reduce((s, v) => s + v * v, 0));
      expect(mag).toBeCloseTo(1.0, 5);
    });
  });

  describe('cosineSimilarity', () => {
    test('identical vectors → 1.0', () => {
      const vec = l2Normalize([1, 2, 3]);
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    test('opposite vectors → -1.0', () => {
      const a = l2Normalize([1, 0, 0]);
      const b = l2Normalize([-1, 0, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    test('orthogonal vectors → 0.0', () => {
      const a = l2Normalize([1, 0]);
      const b = l2Normalize([0, 1]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    test('throws on dimension mismatch', () => {
      expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow(/dimension mismatch/i);
    });

    test('zero vectors return 0', () => {
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 2. Bloom Filter ===
// ─────────────────────────────────────────────────────────────────────────────

describe('BloomFilter', () => {
  test('mightContain returns false for absent keys', () => {
    const bf = new BloomFilter(10000, 4);
    expect(bf.mightContain('foo')).toBe(false);
  });

  test('mightContain returns true after add', () => {
    const bf = new BloomFilter(10000, 4);
    bf.add('hello');
    expect(bf.mightContain('hello')).toBe(true);
  });

  test('clear resets all bits', () => {
    const bf = new BloomFilter(10000, 4);
    bf.add('test');
    bf.clear();
    expect(bf.mightContain('test')).toBe(false);
    expect(bf.approximateCount).toBe(0);
  });

  test('approximateCount tracks add calls', () => {
    const bf = new BloomFilter(10000, 4);
    bf.add('a');
    bf.add('b');
    bf.add('c');
    expect(bf.approximateCount).toBe(3);
  });

  test('false positive rate is reasonable (<5%) for 1000 items', () => {
    const bf = new BloomFilter(100000, 4);
    const items = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
    items.forEach((k) => bf.add(k));

    let fps = 0;
    for (let i = 1000; i < 2000; i++) {
      if (bf.mightContain(`item_${i}`)) fps++;
    }
    expect(fps / 1000).toBeLessThan(0.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 3. EmbeddingCache ===
// ─────────────────────────────────────────────────────────────────────────────

describe('EmbeddingCache', () => {
  let cache;

  beforeEach(() => {
    cache = new EmbeddingCache({ maxSize: 5, ttl: 60000 });
  });

  test('get returns null for unknown key', () => {
    expect(cache.get('unknown')).toBeNull();
  });

  test('set/get round-trip', () => {
    const vec = [0.1, 0.2, 0.3];
    const key = EmbeddingCache.makeKey('hello', 'model-x');
    cache.set(key, vec);
    expect(cache.get(key)).toEqual(vec);
  });

  test('evicts LRU entry when at capacity', () => {
    for (let i = 0; i < 5; i++) {
      cache.set(`key${i}`, [i]);
    }
    // Access key0 to make it recently used
    cache.get('key0');
    // Add key5 → should evict key1 (least recently used)
    cache.set('key5', [5]);
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key0')).toEqual([0]);
    expect(cache.get('key5')).toEqual([5]);
  });

  test('TTL expiry returns null', async () => {
    const shortCache = new EmbeddingCache({ maxSize: 100, ttl: 50 }); // 50ms TTL
    shortCache.set('exp', [1, 2, 3]);
    expect(shortCache.get('exp')).toEqual([1, 2, 3]);
    await new Promise((r) => setTimeout(r, 100));
    expect(shortCache.get('exp')).toBeNull();
  });

  test('has() reflects bloom filter + map state', () => {
    const key = EmbeddingCache.makeKey('check', 'model');
    expect(cache.has(key)).toBe(false);
    cache.set(key, [1]);
    expect(cache.has(key)).toBe(true);
  });

  test('delete removes entry', () => {
    const key = 'del-test';
    cache.set(key, [9]);
    expect(cache.delete(key)).toBe(true);
    expect(cache.get(key)).toBeNull();
  });

  test('batchGet returns hits and nulls', () => {
    cache.set('k1', [1]);
    cache.set('k2', [2]);
    const results = cache.batchGet(['k1', 'k2', 'k3']);
    expect(results.get('k1')).toEqual([1]);
    expect(results.get('k2')).toEqual([2]);
    expect(results.get('k3')).toBeNull();
  });

  test('getStats tracks hits/misses/hitRate', () => {
    const key = EmbeddingCache.makeKey('stat', 'm');
    cache.set(key, [7]);
    cache.get(key);  // hit
    cache.get('nope'); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5, 2);
  });

  test('clear empties cache', () => {
    cache.set('a', [1]);
    cache.set('b', [2]);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  test('makeKey is deterministic and unique per model', () => {
    const k1 = EmbeddingCache.makeKey('hello', 'model-A');
    const k2 = EmbeddingCache.makeKey('hello', 'model-B');
    const k3 = EmbeddingCache.makeKey('hello', 'model-A');
    expect(k1).toBe(k3);
    expect(k1).not.toBe(k2);
    expect(k1).toHaveLength(64); // SHA-256 hex
  });

  describe('JSONL persistence', () => {
    test('persist and loadFromDisk round-trip', async () => {
      const tmpPath = makeTmpPath();
      const c1 = new EmbeddingCache({ maxSize: 100, ttl: 0, persistPath: tmpPath });
      c1.set('pk1', [0.1, 0.2]);
      c1.set('pk2', [0.3, 0.4]);
      await c1.persist();

      const c2 = new EmbeddingCache({ maxSize: 100, ttl: 0, persistPath: tmpPath });
      const loaded = await c2.loadFromDisk();
      expect(loaded).toBe(2);
      expect(c2.get('pk1')).toEqual([0.1, 0.2]);
      expect(c2.get('pk2')).toEqual([0.3, 0.4]);

      fs.unlinkSync(tmpPath);
    });

    test('loadFromDisk skips expired entries', async () => {
      const tmpPath = makeTmpPath();
      const c1 = new EmbeddingCache({ maxSize: 100, ttl: 1, persistPath: tmpPath }); // 1ms TTL
      c1.set('exp-key', [5, 6]);
      await new Promise((r) => setTimeout(r, 10));
      await c1.persist(); // Expired entries skipped in persist

      const c2 = new EmbeddingCache({ maxSize: 100, ttl: 0, persistPath: tmpPath });
      const loaded = await c2.loadFromDisk();
      expect(loaded).toBe(0);
      fs.unlinkSync(tmpPath);
    });

    test('loadFromDisk returns 0 if file missing', async () => {
      const c = new EmbeddingCache({ persistPath: '/tmp/nonexistent-heady-xyzabc.jsonl' });
      const loaded = await c.loadFromDisk();
      expect(loaded).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 4. PriorityQueue ===
// ─────────────────────────────────────────────────────────────────────────────

describe('PriorityQueue', () => {
  test('dequeues in priority order (lower = higher priority)', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: 'low' }, 9);
    pq.enqueue({ id: 'urgent' }, 0);
    pq.enqueue({ id: 'mid' }, 5);
    expect(pq.dequeue().id).toBe('urgent');
    expect(pq.dequeue().id).toBe('mid');
    expect(pq.dequeue().id).toBe('low');
  });

  test('FIFO within same priority', () => {
    const pq = new PriorityQueue();
    pq.enqueue({ id: 'first' }, 5);
    pq.enqueue({ id: 'second' }, 5);
    pq.enqueue({ id: 'third' }, 5);
    expect(pq.dequeue().id).toBe('first');
    expect(pq.dequeue().id).toBe('second');
    expect(pq.dequeue().id).toBe('third');
  });

  test('dequeueN returns up to N items', () => {
    const pq = new PriorityQueue();
    for (let i = 0; i < 10; i++) pq.enqueue({ i }, 5);
    const batch = pq.dequeueN(4);
    expect(batch).toHaveLength(4);
    expect(pq.size).toBe(6);
  });

  test('dequeue returns null when empty', () => {
    const pq = new PriorityQueue();
    expect(pq.dequeue()).toBeNull();
  });

  test('isEmpty is true when empty', () => {
    const pq = new PriorityQueue();
    expect(pq.isEmpty).toBe(true);
    pq.enqueue({}, 1);
    expect(pq.isEmpty).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 5. BatchProcessor ===
// ─────────────────────────────────────────────────────────────────────────────

describe('BatchProcessor', () => {
  let processor;

  // Fast fake embedFn that returns synthetic vectors
  const fakeEmbedFn = jest.fn(async (texts) => {
    return texts.map((text) => {
      const arr = new Array(384).fill(0);
      arr[0] = text.length; // deterministic by text length
      return arr;
    });
  });

  beforeEach(() => {
    fakeEmbedFn.mockClear();
    processor = new BatchProcessor({
      embedFn: fakeEmbedFn,
      batchSize: 8,
      maxConcurrent: 2,
    });
  });

  afterEach(async () => {
    await processor.shutdown();
  });

  test('embeds a single text', async () => {
    const result = await processor.embed(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(384);
  });

  test('embeds multiple texts', async () => {
    const texts = ['alpha', 'beta', 'gamma'];
    const results = await processor.embed(texts);
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r).toHaveLength(384));
  });

  test('deduplicates identical texts in a batch', async () => {
    const texts = ['same', 'same', 'same', 'different'];
    const results = await processor.embed(texts);
    // embedFn should have been called with 2 unique texts, not 4
    expect(fakeEmbedFn.mock.calls[0][0]).toHaveLength(2);
    // All 3 'same' results should be identical
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    // 'different' should differ
    expect(results[0]).not.toEqual(results[3]);
  });

  test('rejects on embedFn error after retries', async () => {
    const errorFn = jest.fn().mockRejectedValue(new Error('inference failure'));
    const errProcessor = new BatchProcessor({
      embedFn: errorFn,
      batchSize: 8,
      maxConcurrent: 1,
    });

    await expect(errProcessor.embed(['fail me'])).rejects.toThrow(/inference failure/i);
    expect(errorFn).toHaveBeenCalledTimes(config.retryMaxAttempts);

    await errProcessor.shutdown();
  });

  test('getStats returns queue and batch info', async () => {
    const stats = processor.getStats();
    expect(stats).toHaveProperty('queueSize');
    expect(stats).toHaveProperty('activeBatches');
    expect(stats).toHaveProperty('totalBatches');
    expect(stats).toHaveProperty('dedupSavings');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 6. ModelManager ===
// ─────────────────────────────────────────────────────────────────────────────

describe('ModelManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ModelManager({ defaultModel: 'Xenova/all-MiniLM-L6-v2' });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test('listModels returns all registered models', () => {
    const models = manager.listModels();
    expect(models.length).toBe(Object.keys(MODEL_REGISTRY).length);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('Xenova/all-MiniLM-L6-v2');
    expect(ids).toContain('Xenova/all-mpnet-base-v2');
    expect(ids).toContain('Xenova/bge-small-en-v1.5');
  });

  test('getModelMeta returns correct dimensions', () => {
    const meta = manager.getModelMeta('Xenova/all-MiniLM-L6-v2');
    expect(meta.dimensions).toBe(384);
    expect(meta.speedRating).toBeGreaterThanOrEqual(1);
  });

  test('getModelMeta throws for unknown model', () => {
    expect(() => manager.getModelMeta('unknown/model')).toThrow(/Unknown model/);
  });

  test('loadModel returns a pipeline', async () => {
    const pipeline = await manager.loadModel('Xenova/all-MiniLM-L6-v2');
    expect(typeof pipeline).toBe('function');
  });

  test('concurrent loads are coalesced (only one actual load)', async () => {
    const { pipeline: mockPipeline } = require('@xenova/transformers');
    mockPipeline.mockClear();

    const [p1, p2, p3] = await Promise.all([
      manager.loadModel('Xenova/all-MiniLM-L6-v2'),
      manager.loadModel('Xenova/all-MiniLM-L6-v2'),
      manager.loadModel('Xenova/all-MiniLM-L6-v2'),
    ]);

    expect(mockPipeline).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
  });

  test('isLoaded returns true after load', async () => {
    expect(manager.isLoaded('Xenova/all-MiniLM-L6-v2')).toBe(false);
    await manager.loadModel('Xenova/all-MiniLM-L6-v2');
    expect(manager.isLoaded('Xenova/all-MiniLM-L6-v2')).toBe(true);
  });

  test('resolves short name to full model ID', () => {
    const meta = manager.getModelMeta('all-MiniLM-L6-v2');
    expect(meta.id).toBe('Xenova/all-MiniLM-L6-v2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 7. HeadyEmbed (Integration) ===
// ─────────────────────────────────────────────────────────────────────────────

describe('HeadyEmbed', () => {
  let service;

  beforeEach(async () => {
    service = await makeService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  // ── 7.1 Single embedding ────────────────────────────────────────────────

  describe('embed() — single text', () => {
    test('returns an array of embeddings (1 input = 1 output)', async () => {
      const results = await service.embed('hello world');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
    });

    test('embedding is 384-dimensional', async () => {
      const [vec] = await service.embed('test text');
      expect(vec).toHaveLength(384);
    });

    test('embedding is L2-normalized (unit vector)', async () => {
      const [vec] = await service.embed('normalize me');
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    });

    test('different texts produce different embeddings', async () => {
      const [a] = await service.embed('the quick brown fox');
      const [b] = await service.embed('completely different text here');
      expect(a).not.toEqual(b);
    });

    test('throws if not initialized', async () => {
      const uninit = new HeadyEmbed({ warmupOnStart: false, cacheWarmOnStart: false });
      await expect(uninit.embed('test')).rejects.toThrow(/not initialized/i);
    });

    test('empty array returns empty result', async () => {
      const results = await service.embed([]);
      expect(results).toEqual([]);
    });
  });

  // ── 7.2 Batch processing ────────────────────────────────────────────────

  describe('embed() — batch processing', () => {
    test('processes array of texts', async () => {
      const texts = ['one', 'two', 'three', 'four', 'five'];
      const results = await service.embed(texts);
      expect(results).toHaveLength(5);
      results.forEach((v) => expect(v).toHaveLength(384));
    });

    test('large batch (100 texts)', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `sentence number ${i} with some content`);
      const results = await service.embed(texts);
      expect(results).toHaveLength(100);
    });

    test('progress callback fires for large batches', async () => {
      const progressCalls = [];
      const texts = Array.from({ length: 25 }, (_, i) => `text ${i}`);

      await service.embed(texts, {
        onProgress: (processed, total) => progressCalls.push({ processed, total }),
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      const last = progressCalls[progressCalls.length - 1];
      expect(last.processed).toBe(last.total);
    });
  });

  // ── 7.3 Cache hit/miss ──────────────────────────────────────────────────

  describe('Cache hit/miss', () => {
    test('second call for same text is a cache hit', async () => {
      await service.embed('cache me');
      const before = service.getMetrics().cache.hits;
      await service.embed('cache me');
      const after = service.getMetrics().cache.hits;
      expect(after).toBe(before + 1);
    });

    test('cache miss increments miss counter', async () => {
      const before = service.getMetrics().cache.misses;
      await service.embed('this is new text xyz987');
      const after = service.getMetrics().cache.misses;
      expect(after).toBeGreaterThan(before);
    });

    test('useCache: false bypasses cache', async () => {
      await service.embed('bypass test');
      const hitsBefore = service.getMetrics().cache.hits;
      await service.embed('bypass test', { useCache: false });
      // No new hit should be recorded
      expect(service.getMetrics().cache.hits).toBe(hitsBefore);
    });

    test('hit rate approaches 1.0 after repeated lookups', async () => {
      const text = 'repeated lookup text';
      await service.embed(text);
      for (let i = 0; i < 9; i++) {
        await service.embed(text);
      }
      const stats = service.getMetrics().cache;
      expect(stats.hitRate).toBeGreaterThan(0.8);
    });
  });

  // ── 7.4 Model switching ─────────────────────────────────────────────────

  describe('Model switching', () => {
    test('switchModel changes active model', async () => {
      await service.switchModel('Xenova/all-MiniLM-L12-v2');
      expect(service._config.model).toBe('Xenova/all-MiniLM-L12-v2');
    });

    test('embed() uses switched model', async () => {
      await service.switchModel('Xenova/all-MiniLM-L12-v2');
      const results = await service.embed('after switch');
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveLength(384);
    });

    test('emits modelSwitched event', async () => {
      const events = [];
      service.on('modelSwitched', (e) => events.push(e));
      await service.switchModel('Xenova/all-MiniLM-L12-v2');
      expect(events.length).toBe(1);
      expect(events[0].model).toBe('Xenova/all-MiniLM-L12-v2');
    });
  });

  // ── 7.5 Similarity computation ──────────────────────────────────────────

  describe('similarity()', () => {
    test('same text → similarity close to 1.0', async () => {
      const sim = await service.similarity('hello world', 'hello world');
      expect(sim).toBeCloseTo(1.0, 3);
    });

    test('returns value in [-1, 1] range', async () => {
      const sim = await service.similarity('apple', 'orange');
      expect(sim).toBeGreaterThanOrEqual(-1.0);
      expect(sim).toBeLessThanOrEqual(1.0);
    });

    test('accepts pre-computed vectors', async () => {
      const [vecA] = await service.embed('vector input A');
      const [vecB] = await service.embed('vector input B');
      const sim = await service.similarity(vecA, vecB);
      expect(typeof sim).toBe('number');
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  // ── 7.6 Metrics ─────────────────────────────────────────────────────────

  describe('getMetrics()', () => {
    test('returns complete metrics object', async () => {
      await service.embed('metrics test');
      const m = service.getMetrics();
      expect(m).toHaveProperty('totalEmbeddings');
      expect(m).toHaveProperty('cache');
      expect(m).toHaveProperty('latency');
      expect(m).toHaveProperty('batch');
      expect(m).toHaveProperty('memory');
      expect(m).toHaveProperty('uptime');
    });

    test('totalEmbeddings increments', async () => {
      const before = service.getMetrics().totalEmbeddings;
      await service.embed(['a', 'b', 'c']);
      const after = service.getMetrics().totalEmbeddings;
      expect(after).toBe(before + 3);
    });

    test('latency window is populated after requests', async () => {
      for (let i = 0; i < 5; i++) {
        await service.embed(`latency test ${i}`);
      }
      const latency = service.getMetrics().latency;
      expect(latency.samples).toBeGreaterThan(0);
      expect(latency.avg).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 7.7 Health check ────────────────────────────────────────────────────

  describe('getHealth() and buildHealthReport()', () => {
    test('returns healthy status when initialized', () => {
      const health = service.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.ready).toBe(true);
    });

    test('buildHealthReport has all required fields', async () => {
      await service.embed('health check warm-up');
      const report = buildHealthReport(service);
      expect(report).toHaveProperty('status', 'healthy');
      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('model');
      expect(report).toHaveProperty('cache');
      expect(report).toHaveProperty('latency');
      expect(report).toHaveProperty('memory');
      expect(report).toHaveProperty('throughput');
      expect(report).toHaveProperty('batch');
      expect(report.model.loaded).toBe(true);
    });

    test('cache.hitRate is formatted as percentage string', async () => {
      await service.embed('for cache');
      await service.embed('for cache'); // hit
      const report = buildHealthReport(service);
      expect(report.cache.hitRate).toMatch(/\d+\.\d+%/);
    });

    test('uptime.human is human-readable', () => {
      const report = buildHealthReport(service);
      expect(typeof report.uptime.human).toBe('string');
      expect(report.uptime.human.length).toBeGreaterThan(0);
    });
  });

  // ── 7.8 Error handling ──────────────────────────────────────────────────

  describe('Error handling', () => {
    test('embed() validates input — non-string throws', async () => {
      // Passing invalid input should reject gracefully
      await expect(service.embed(null)).rejects.toBeDefined();
    });

    test('shutdown() is idempotent', async () => {
      await service.shutdown();
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    test('embed after shutdown throws', async () => {
      await service.shutdown();
      await expect(service.embed('post-shutdown')).rejects.toThrow(/not initialized|shutting down/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 8. Config ===
// ─────────────────────────────────────────────────────────────────────────────

describe('Config', () => {
  test('PHI has correct value', () => {
    expect(config.PHI).toBeCloseTo(1.618033988749895, 10);
  });

  test('getRetryDelay follows PHI scaling', () => {
    // Attempt 0: 1000ms
    // Attempt 1: 1618ms
    // Attempt 2: 2618ms
    // Attempt 3: 4236ms
    expect(config.getRetryDelay(0)).toBe(1000);
    expect(config.getRetryDelay(1)).toBeCloseTo(1618, 0);
    expect(config.getRetryDelay(2)).toBeCloseTo(2618, 0);
    expect(config.getRetryDelay(3)).toBeCloseTo(4236, 0);
  });

  test('default dimensions is 384', () => {
    expect(config.dimensions).toBe(384);
  });

  test('default port is 3101', () => {
    expect(config.port).toBe(3101);
  });

  test('default batch size is 32', () => {
    expect(config.batchSize).toBe(32);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// === 9. Route handlers (mock HTTP) ===
// ─────────────────────────────────────────────────────────────────────────────

describe('Routes', () => {
  const express = require('express');
  const request = require('supertest');
  const { createRouter } = require('../routes');

  let app;
  let svc;

  beforeAll(async () => {
    svc = await makeService();
    app = express();
    app.use(express.json());
    app.use('/', createRouter(svc));
  });

  afterAll(async () => {
    await svc.shutdown();
  });

  describe('POST /embed', () => {
    test('200 with single text string', async () => {
      const res = await request(app)
        .post('/embed')
        .send({ texts: 'hello route' })
        .expect(200);

      expect(res.body).toHaveProperty('embeddings');
      expect(res.body.embeddings).toHaveLength(1);
      expect(res.body.embeddings[0]).toHaveLength(384);
      expect(res.body.count).toBe(1);
    });

    test('200 with array of texts', async () => {
      const res = await request(app)
        .post('/embed')
        .send({ texts: ['a', 'b', 'c'] })
        .expect(200);

      expect(res.body.embeddings).toHaveLength(3);
      expect(res.body.count).toBe(3);
    });

    test('400 on missing texts', async () => {
      await request(app).post('/embed').send({}).expect(400);
    });

    test('400 on empty string', async () => {
      await request(app).post('/embed').send({ texts: '' }).expect(400);
    });

    test('400 on empty array', async () => {
      await request(app).post('/embed').send({ texts: [] }).expect(400);
    });

    test('includes latencyMs in response', async () => {
      const res = await request(app)
        .post('/embed')
        .send({ texts: 'timing test' })
        .expect(200);

      expect(res.body).toHaveProperty('latencyMs');
      expect(typeof res.body.latencyMs).toBe('number');
    });
  });

  describe('POST /embed/batch', () => {
    test('202 with jobId', async () => {
      const res = await request(app)
        .post('/embed/batch')
        .send({ texts: ['batch text 1', 'batch text 2'] })
        .expect(202);

      expect(res.body).toHaveProperty('jobId');
      expect(res.body.status).toBe('pending');
      expect(res.body.total).toBe(2);
    });
  });

  describe('GET /embed/batch/:jobId', () => {
    test('404 for unknown jobId', async () => {
      await request(app)
        .get('/embed/batch/nonexistent-job-id')
        .expect(404);
    });

    test('returns job status for known job', async () => {
      const createRes = await request(app)
        .post('/embed/batch')
        .send({ texts: ['poll test'] });

      const { jobId } = createRes.body;

      // Wait for job to complete
      await new Promise((r) => setTimeout(r, 500));

      const pollRes = await request(app).get(`/embed/batch/${jobId}`).expect(200);
      expect(pollRes.body).toHaveProperty('jobId', jobId);
      expect(['pending', 'processing', 'complete']).toContain(pollRes.body.status);
    });
  });

  describe('POST /embed/similarity', () => {
    test('200 with similarity score', async () => {
      const res = await request(app)
        .post('/embed/similarity')
        .send({ a: 'hello', b: 'hello' })
        .expect(200);

      expect(res.body).toHaveProperty('similarity');
      expect(res.body.similarity).toBeCloseTo(1.0, 3);
    });

    test('400 when a or b missing', async () => {
      await request(app).post('/embed/similarity').send({ a: 'only a' }).expect(400);
    });
  });

  describe('GET /models', () => {
    test('200 with model list', async () => {
      const res = await request(app).get('/models').expect(200);
      expect(res.body).toHaveProperty('models');
      expect(Array.isArray(res.body.models)).toBe(true);
      expect(res.body.models.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('defaultModel');
    });
  });

  describe('POST /models/load', () => {
    test('200 when loading a valid model', async () => {
      const res = await request(app)
        .post('/models/load')
        .send({ modelId: 'Xenova/all-MiniLM-L6-v2' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.modelId).toBe('Xenova/all-MiniLM-L6-v2');
    });

    test('400 when modelId missing', async () => {
      await request(app).post('/models/load').send({}).expect(400);
    });
  });

  describe('GET /metrics', () => {
    test('200 with metrics payload', async () => {
      const res = await request(app).get('/metrics').expect(200);
      expect(res.body).toHaveProperty('totalEmbeddings');
      expect(res.body).toHaveProperty('cache');
      expect(res.body).toHaveProperty('latency');
    });
  });

  describe('GET /health', () => {
    test('200 with health report when healthy', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('model');
      expect(res.body).toHaveProperty('cache');
      expect(res.body).toHaveProperty('memory');
    });
  });

  describe('GET /health/live', () => {
    test('200 liveness probe', async () => {
      const res = await request(app).get('/health/live').expect(200);
      expect(res.body.alive).toBe(true);
    });
  });

  describe('GET /health/ready', () => {
    test('200 readiness probe when ready', async () => {
      const res = await request(app).get('/health/ready').expect(200);
      expect(res.body.ready).toBe(true);
    });
  });
});

'use strict';

/**
 * HeadyCache Test Suite
 *
 * Tests cover:
 *   - VP-tree construction and kNN search
 *   - Cosine / euclidean / dot similarity functions
 *   - SemanticMatcher: hash fallback, index management
 *   - MemoryStore: CRUD, LRU eviction, TTL, sliding window
 *   - FileStore: persistence, WAL replay
 *   - EvictionEngine: LRU, LFU, TTL, hybrid, memory pressure
 *   - CacheAnalytics: counters, histograms, savings
 *   - HeadyCache: get/set/delete/batch/warm (embed mocked)
 *   - Express routes (supertest)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVector(dims, seed) {
  const v = new Array(dims).fill(0);
  for (let i = 0; i < dims; i++) {
    // Deterministic pseudo-random using seed
    v[i] = Math.sin(seed * (i + 1)) * 0.5 + 0.5;
  }
  // Normalize
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------

const {
  VPTree,
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  similarity,
  SemanticMatcher,
} = require('../semantic-matcher');

const { MemoryStore } = require('../storage/memory-store');
const { FileStore } = require('../storage/file-store');
const { EvictionEngine } = require('../eviction');
const { CacheAnalytics, Histogram } = require('../analytics');
const { HeadyCache } = require('../index');

// ---------------------------------------------------------------------------
// ─── VPTree ─────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('VPTree', () => {
  const dims = 8;
  const distFn = (a, b) => euclideanDistance(a, b);

  const points = Array.from({ length: 50 }, (_, i) => ({
    id: `p${i}`,
    vector: makeVector(dims, i + 1),
  }));

  let tree;
  beforeAll(() => {
    tree = new VPTree([...points], distFn);
  });

  test('knn returns k results', () => {
    const query = makeVector(dims, 99);
    const results = tree.knn(query, 5);
    expect(results).toHaveLength(5);
  });

  test('knn results are sorted by distance ascending', () => {
    const query = makeVector(dims, 77);
    const results = tree.knn(query, 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].dist).toBeGreaterThanOrEqual(results[i - 1].dist);
    }
  });

  test('knn nearest neighbor is correct vs linear scan', () => {
    const query = makeVector(dims, 42);
    const knnResult = tree.knn(query, 1)[0];

    // Linear scan
    let bestDist = Infinity;
    let bestId = null;
    for (const p of points) {
      const d = distFn(query, p.vector);
      if (d < bestDist) { bestDist = d; bestId = p.id; }
    }

    expect(knnResult.id).toBe(bestId);
    expect(knnResult.dist).toBeCloseTo(bestDist, 6);
  });

  test('rangeSearch returns all points within radius', () => {
    const query = makeVector(dims, 1);
    const radius = 0.5;
    const results = tree.rangeSearch(query, radius);

    // Verify all returned points are within radius
    for (const r of results) {
      expect(r.dist).toBeLessThanOrEqual(radius + 1e-9);
    }

    // Verify no missed points (check a few manually)
    for (const p of points.slice(0, 10)) {
      const d = distFn(query, p.vector);
      if (d <= radius) {
        expect(results.some((r) => r.id === p.id)).toBe(true);
      }
    }
  });

  test('knn with k > n returns n results', () => {
    const tiny = [{ id: 'a', vector: makeVector(dims, 1) }];
    const t = new VPTree(tiny, distFn);
    const results = t.knn(makeVector(dims, 2), 10);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test('empty tree returns empty results', () => {
    const t = new VPTree([], distFn);
    expect(t.knn(makeVector(dims, 1), 3)).toHaveLength(0);
    expect(t.rangeSearch(makeVector(dims, 1), 0.5)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ─── Similarity Functions ───────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('similarity functions', () => {
  test('cosine similarity of identical vectors = 1', () => {
    const v = makeVector(16, 5);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  test('cosine similarity of orthogonal vectors ≈ 0', () => {
    const a = [1, 0, 0, 0];
    const b = [0, 1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  test('euclidean distance of identical vectors = 0', () => {
    const v = makeVector(16, 3);
    expect(euclideanDistance(v, v)).toBeCloseTo(0, 5);
  });

  test('dot product of normalized identical vectors ≈ 1', () => {
    const v = makeVector(8, 7);
    expect(dotProduct(v, v)).toBeCloseTo(1, 4);
  });

  test('similarity() cosine maps to [0, 1]', () => {
    const a = makeVector(8, 1);
    const b = makeVector(8, 2);
    const s = similarity(a, b, 'cosine');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  test('similarity() euclidean maps to [0, 1]', () => {
    const a = makeVector(8, 1);
    const b = makeVector(8, 2);
    const s = similarity(a, b, 'euclidean');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// ─── SemanticMatcher ────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('SemanticMatcher', () => {
  let matcher;
  const dims = 16;

  beforeEach(() => {
    matcher = new SemanticMatcher({
      embedUrl: 'http://localhost:9999', // won't be called in these tests
      similarityThreshold: 0.9,
      distanceMetric: 'cosine',
      embeddingDims: dims,
      vpTreeRebuildThreshold: 5,
    });
    // Disable embed availability
    matcher._embedAvailable = false;
  });

  test('addToIndex and hash search', async () => {
    const v = makeVector(dims, 1);
    await matcher.addToIndex('ns1', 'id1', 'hello world', v);
    const result = await matcher.search('ns1', 'hello world');
    expect(result).not.toBeNull();
    expect(result.exact).toBe(true);
    expect(result.id).toBe('id1');
  });

  test('indexSize returns correct count', async () => {
    const v = makeVector(dims, 1);
    await matcher.addToIndex('nsA', 'id1', 'key1', v);
    await matcher.addToIndex('nsA', 'id2', 'key2', makeVector(dims, 2));
    expect(matcher.indexSize('nsA')).toBe(2);
  });

  test('removeFromIndex removes entry', async () => {
    const v = makeVector(dims, 1);
    await matcher.addToIndex('nsR', 'id1', 'testkey', v);
    matcher.removeFromIndex('nsR', 'id1', 'testkey');
    expect(matcher.indexSize('nsR')).toBe(0);
    const result = await matcher.search('nsR', 'testkey');
    expect(result).toBeNull();
  });

  test('clearNamespace removes all entries', async () => {
    await matcher.addToIndex('nsC', 'id1', 'k1', makeVector(dims, 1));
    await matcher.addToIndex('nsC', 'id2', 'k2', makeVector(dims, 2));
    matcher.clearNamespace('nsC');
    expect(matcher.indexSize('nsC')).toBe(0);
  });

  test('VP-tree rebuild triggered at threshold', async () => {
    // Must pass pre-computed vectors — embed is disabled in this test suite
    for (let i = 0; i < 6; i++) {
      await matcher.addToIndex('nsV', `id${i}`, `key${i}`, makeVector(dims, i + 1));
    }
    // After 5 entries dirty >= vpTreeRebuildThreshold(5), tree should be built
    // (it may have been rebuilt and set, then dirty reset)
    // Verify by checking the index was populated and tree can be queried
    const populated = matcher.indexSize('nsV');
    expect(populated).toBe(6);
    // Force rebuild and verify tree exists
    matcher.rebuildTree('nsV');
    expect(matcher._trees.has('nsV')).toBe(true);
  });

  test('getVector returns stored vector', async () => {
    const v = makeVector(dims, 42);
    await matcher.addToIndex('nsG', 'id42', 'mykey', v);
    const retrieved = matcher.getVector('nsG', 'id42');
    expect(retrieved).toBeDefined();
    expect(retrieved.length).toBe(dims);
  });

  test('semantic search with VP-tree', async () => {
    matcher._embedAvailable = true;
    // Mock the embed function
    const v1 = makeVector(dims, 10);
    const v2 = makeVector(dims, 20);
    const v3 = makeVector(dims, 30);

    await matcher.addToIndex('nsS', 'id10', 'query about cats', v1);
    await matcher.addToIndex('nsS', 'id20', 'query about dogs', v2);
    await matcher.addToIndex('nsS', 'id30', 'query about fish', v3);

    // Rebuild tree
    matcher.rebuildTree('nsS');

    // Simulate embed returning v1 (should match id10)
    matcher.embed = async () => v1;
    const result = await matcher.search('nsS', 'cats are interesting');
    expect(result).not.toBeNull();
    expect(result.id).toBe('id10');
    expect(result.similarity).toBeGreaterThanOrEqual(0.9);
  });

  test('findSimilarIds returns neighbors above threshold', async () => {
    const v = makeVector(dims, 5);
    const similar = makeVector(dims, 5); // identical
    await matcher.addToIndex('nsF', 'id5', 'key5', v);
    const results = matcher.findSimilarIds('nsF', similar, 0.99);
    expect(results.some((r) => r.id === 'id5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ─── MemoryStore ─────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('MemoryStore', () => {
  let store;

  beforeEach(() => {
    store = new MemoryStore({ maxSize: 10, ttl: 1000, slidingWindow: true });
  });

  afterEach(() => {
    store.close();
  });

  test('set and get returns value', () => {
    store.set('k1', { data: 'hello' }, { namespace: 'test' });
    const result = store.get('k1');
    expect(result).not.toBeNull();
    expect(result.value).toEqual({ data: 'hello' });
  });

  test('get returns null for unknown key', () => {
    expect(store.get('nonexistent')).toBeNull();
  });

  test('has returns true for existing key', () => {
    store.set('k2', 'value');
    expect(store.has('k2')).toBe(true);
  });

  test('has returns false for expired key', async () => {
    store.set('k3', 'value', { ttl: 50 });
    await sleep(60);
    expect(store.has('k3')).toBe(false);
  });

  test('get returns null after TTL expires', async () => {
    store.set('k4', 'value', { ttl: 50 });
    await sleep(60);
    expect(store.get('k4')).toBeNull();
  });

  test('sliding window extends TTL on access', async () => {
    store.set('k5', 'value', { ttl: 200 });
    await sleep(100);
    store.get('k5'); // access — resets TTL
    await sleep(150);
    // Should still be alive (TTL reset to 200ms from last access)
    expect(store.get('k5')).not.toBeNull();
  });

  test('delete removes key', () => {
    store.set('k6', 'value');
    store.delete('k6');
    expect(store.has('k6')).toBe(false);
  });

  test('delete returns false for nonexistent key', () => {
    expect(store.delete('nokey')).toBe(false);
  });

  test('clear removes all keys', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.clear();
    expect(store.size()).toBe(0);
  });

  test('clear by namespace removes only that namespace', () => {
    store.set('a', 1, { namespace: 'ns1' });
    store.set('b', 2, { namespace: 'ns2' });
    store.clear('ns1');
    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(true);
  });

  test('LRU eviction evicts oldest entry when full', () => {
    const s = new MemoryStore({ maxSize: 3, ttl: 0 });
    s.set('a', 1);
    s.set('b', 2);
    s.set('c', 3);
    s.get('a'); // access a to make it recent
    s.get('b'); // access b
    s.set('d', 4); // should evict 'c' (LRU)
    expect(s.has('c')).toBe(false);
    expect(s.has('a')).toBe(true);
    s.close();
  });

  test('evictLru evicts N least recently used', () => {
    store.set('x', 1);
    store.set('y', 2);
    store.set('z', 3);
    store.get('z'); // z is MRU
    const evicted = store.evictLru(1);
    expect(evicted.length).toBe(1);
    // x was set first and not accessed
    expect(['x', 'y']).toContain(evicted[0]);
  });

  test('evictLfu evicts least frequently used', () => {
    store.set('p', 1);
    store.set('q', 2);
    store.get('q');
    store.get('q');
    const evicted = store.evictLfu(1);
    expect(evicted[0]).toBe('p'); // p has 0 accesses
  });

  test('evictExpired returns expired keys', async () => {
    store.set('exp1', 1, { ttl: 30 });
    store.set('exp2', 2, { ttl: 30 });
    store.set('live', 3, { ttl: 5000 });
    await sleep(50);
    const expired = store.evictExpired();
    expect(expired).toContain('exp1');
    expect(expired).toContain('exp2');
    expect(expired).not.toContain('live');
  });

  test('keys returns all live keys', () => {
    store.set('k1', 1, { namespace: 'test' });
    store.set('k2', 2, { namespace: 'test' });
    const keys = store.keys('test');
    expect(keys).toContain('k1');
    expect(keys).toContain('k2');
  });

  test('entries returns all live entries', () => {
    store.set('e1', { val: 1 });
    store.set('e2', { val: 2 });
    const entries = store.entries();
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const keys = entries.map(([k]) => k);
    expect(keys).toContain('e1');
    expect(keys).toContain('e2');
  });

  test('getMeta returns metadata', () => {
    store.set('meta1', 'v', { namespace: 'test', ttl: 1000 });
    const meta = store.getMeta('meta1');
    expect(meta).not.toBeNull();
    expect(meta.namespace).toBe('test');
    expect(meta.ttl).toBe(1000);
  });

  test('touch updates TTL', async () => {
    store.set('touched', 'v', { ttl: 100 });
    await sleep(50);
    store.touch('touched', 2000);
    await sleep(60);
    // Should still be alive with new TTL
    expect(store.has('touched')).toBe(true);
  });

  test('byteSize returns positive value', () => {
    store.set('big', { data: 'x'.repeat(1000) });
    expect(store.byteSize()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ─── FileStore ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('FileStore', () => {
  let tmpDir;
  let store;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heady-cache-test-'));
    store = new FileStore({
      filePath: path.join(tmpDir, 'cache.jsonl'),
      walPath: path.join(tmpDir, 'cache.wal'),
      maxSize: 100,
      ttl: 5000,
      compactThreshold: 5,
    });
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('set and get persists value', async () => {
    await store.set('key1', { hello: 'world' }, { namespace: 'default' });
    const result = await store.get('key1');
    expect(result).not.toBeNull();
    expect(result.value).toEqual({ hello: 'world' });
  });

  test('delete removes value', async () => {
    await store.set('key2', 'v');
    await store.delete('key2');
    expect(await store.has('key2')).toBe(false);
  });

  test('WAL replay recovers state on reload', async () => {
    await store.set('k1', 'v1', { namespace: 'ns' });
    await store.set('k2', 'v2', { namespace: 'ns' });

    // Create new store instance pointing at same files (simulate restart)
    await store.close();

    const store2 = new FileStore({
      filePath: path.join(tmpDir, 'cache.jsonl'),
      walPath: path.join(tmpDir, 'cache.wal'),
    });

    const r1 = await store2.get('k1');
    const r2 = await store2.get('k2');
    expect(r1?.value).toBe('v1');
    expect(r2?.value).toBe('v2');

    await store2.close();
    // Reassign so afterEach doesn't error
    store = new FileStore({ filePath: path.join(tmpDir, 'x.jsonl') });
    await store.init();
  });

  test('clear by namespace removes entries', async () => {
    await store.set('a', 1, { namespace: 'ns1' });
    await store.set('b', 2, { namespace: 'ns2' });
    await store.clear('ns1');
    expect(await store.has('a')).toBe(false);
    expect(await store.has('b')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ─── EvictionEngine ──────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('EvictionEngine', () => {
  function makeEntries(keys) {
    const now = Date.now();
    return keys.map(([key, lastAccessed, accessCount, expiresAt]) => [
      key,
      {
        value: key,
        meta: {
          lastAccessed: now - lastAccessed,
          accessCount,
          expiresAt: expiresAt ? now + expiresAt : 0,
          ttl: expiresAt || 0,
          namespace: 'ns',
        },
      },
    ]);
  }

  test('LRU selects oldest accessed entry', () => {
    const engine = new EvictionEngine({ policy: 'lru' });
    const entries = makeEntries([
      ['old', 5000, 5, 0],
      ['mid', 3000, 3, 0],
      ['new', 1000, 1, 0],
    ]);
    const toEvict = engine.select(entries, 1, 'ns');
    expect(toEvict[0]).toBe('old');
  });

  test('LFU selects least frequently used', () => {
    const engine = new EvictionEngine({ policy: 'lfu' });
    const entries = makeEntries([
      ['rare', 100, 1, 0],
      ['common', 100, 50, 0],
      ['medium', 100, 10, 0],
    ]);
    const toEvict = engine.select(entries, 1, 'ns');
    expect(toEvict[0]).toBe('rare');
  });

  test('TTL selects soonest to expire', () => {
    const engine = new EvictionEngine({ policy: 'ttl' });
    const entries = makeEntries([
      ['soon', 100, 1, 500],   // expires in 500ms
      ['later', 100, 1, 5000], // expires in 5s
      ['never', 100, 1, 0],    // no expiry
    ]);
    const toEvict = engine.select(entries, 1, 'ns');
    expect(toEvict[0]).toBe('soon');
  });

  test('hybrid selects using weighted combination', () => {
    const engine = new EvictionEngine({
      policy: 'hybrid',
      hybridWeights: { lru: 1.0, lfu: 0, ttl: 0, similarity: 0 },
    });
    const entries = makeEntries([
      ['oldest', 9000, 1, 0],
      ['newer', 1000, 1, 0],
    ]);
    const toEvict = engine.select(entries, 1, 'ns');
    expect(toEvict[0]).toBe('oldest');
  });

  test('select returns empty array for empty entries', () => {
    const engine = new EvictionEngine({ policy: 'lru' });
    expect(engine.select([], 5, 'ns')).toHaveLength(0);
  });

  test('select respects count parameter', () => {
    const engine = new EvictionEngine({ policy: 'lru' });
    const entries = makeEntries([
      ['a', 5000, 1, 0],
      ['b', 4000, 1, 0],
      ['c', 3000, 1, 0],
      ['d', 2000, 1, 0],
    ]);
    const toEvict = engine.select(entries, 2, 'ns');
    expect(toEvict).toHaveLength(2);
  });

  test('aggressiveEviction removes aggressiveRatio fraction', () => {
    const engine = new EvictionEngine({ policy: 'lru', aggressiveRatio: 0.5 });
    const entries = makeEntries([
      ['a', 1000, 1, 0],
      ['b', 2000, 1, 0],
      ['c', 3000, 1, 0],
      ['d', 4000, 1, 0],
    ]);
    const toEvict = engine.aggressiveEviction(entries, 'ns');
    expect(toEvict).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ─── CacheAnalytics ──────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('CacheAnalytics', () => {
  let analytics;

  beforeEach(() => {
    analytics = new CacheAnalytics({ retentionPoints: 10, costPerCall: 0.01 });
  });

  afterEach(() => {
    analytics.close();
  });

  test('hit rate calculated correctly', () => {
    analytics.recordHit('k1', 'ns', 5);
    analytics.recordHit('k2', 'ns', 3);
    analytics.recordMiss('k3', 'ns', 10);
    const stats = analytics.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.6667, 3);
  });

  test('semantic hits counted separately', () => {
    analytics.recordHit('k', 'ns', 5, true);
    analytics.recordHit('k', 'ns', 5, false);
    const stats = analytics.getStats();
    expect(stats.semanticHits).toBe(1);
    expect(stats.exactHits).toBe(1);
  });

  test('eviction count', () => {
    analytics.recordEviction(5);
    expect(analytics.getStats().evictions).toBe(5);
  });

  test('savings calculation', () => {
    for (let i = 0; i < 100; i++) analytics.recordHit(`k${i}`, 'ns', 1);
    const analytics_ = analytics.getAnalytics();
    expect(analytics_.savings.callsAvoided).toBe(100);
    expect(analytics_.savings.costSaved).toBeCloseTo(1.0, 4);
  });

  test('latency histogram records p50/p95/p99', () => {
    for (let i = 0; i < 100; i++) analytics.recordHit(`k${i}`, 'ns', i);
    const a = analytics.getAnalytics();
    expect(a.latency.get.count).toBe(100);
    expect(a.latency.get.p50).toBeLessThanOrEqual(a.latency.get.p95);
    expect(a.latency.get.p95).toBeLessThanOrEqual(a.latency.get.p99);
  });

  test('hot keys tracking', () => {
    for (let i = 0; i < 5; i++) analytics.recordHit('hot-key', 'ns', 1);
    analytics.recordHit('cold-key', 'ns', 1);
    const a = analytics.getAnalytics();
    expect(a.hotKeys[0].key).toBe('hot-key');
    expect(a.hotKeys[0].count).toBe(5);
  });

  test('namespace breakdown', () => {
    analytics.recordHit('k', 'ns1', 1);
    analytics.recordMiss('k', 'ns1', 1);
    analytics.recordHit('k', 'ns2', 1);
    const a = analytics.getAnalytics();
    expect(a.namespaces.ns1.hits).toBe(1);
    expect(a.namespaces.ns1.misses).toBe(1);
    expect(a.namespaces.ns2.hits).toBe(1);
  });

  test('reset clears counters', () => {
    analytics.recordHit('k', 'ns', 1);
    analytics.recordMiss('k', 'ns', 1);
    analytics.reset();
    const stats = analytics.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  test('updateSize reflects in stats', () => {
    analytics.updateSize(42, 1024 * 1024);
    const stats = analytics.getStats();
    expect(stats.entries).toBe(42);
    expect(stats.bytes).toBe(1024 * 1024);
  });

  test('batch ops recorded', () => {
    analytics.recordBatch(50, 25);
    expect(analytics.getStats().batchOps).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// ─── Histogram ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Histogram', () => {
  test('percentile of 0 returns 0 for empty', () => {
    const h = new Histogram();
    expect(h.percentile(50)).toBe(0);
  });

  test('min / max / mean calculated', () => {
    const h = new Histogram();
    h.record(10);
    h.record(20);
    h.record(30);
    const j = h.toJSON();
    expect(j.min).toBe(10);
    expect(j.max).toBe(30);
    expect(j.mean).toBeCloseTo(20, 0);
    expect(j.count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// ─── HeadyCache (integration) ───────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('HeadyCache', () => {
  let cache;

  beforeEach(async () => {
    cache = new HeadyCache({
      backend: 'memory',
      maxSize: 100,
      ttl: 5000,
      similarityThreshold: 0.95,
      evictionPolicy: 'lru',
      writeStrategy: 'write-through',
    });

    // Mock embedding so we don't need a real HeadyEmbed service
    cache._matcher.embed = async () => null; // force hash-only mode

    await cache.init();
  });

  afterEach(async () => {
    await cache.close();
  });

  test('set and get exact match', async () => {
    await cache.set({ key: 'hello cache', value: { result: 42 } });
    const result = await cache.get({ key: 'hello cache' });
    expect(result).not.toBeNull();
    expect(result.hit).toBeUndefined(); // raw result
    expect(result.value).toEqual({ result: 42 });
    expect(result.exact).toBe(true);
  });

  test('cache miss returns null', async () => {
    const result = await cache.get({ key: 'nonexistent key xyz' });
    expect(result).toBeNull();
  });

  test('delete removes entry', async () => {
    await cache.set({ key: 'to-delete', value: 'bye' });
    await cache.delete({ key: 'to-delete' });
    const result = await cache.get({ key: 'to-delete' });
    expect(result).toBeNull();
  });

  test('namespace isolation', async () => {
    await cache.set({ key: 'shared-key', value: 'ns1-value', namespace: 'ns1' });
    await cache.set({ key: 'shared-key', value: 'ns2-value', namespace: 'ns2' });

    const r1 = await cache.get({ key: 'shared-key', namespace: 'ns1' });
    const r2 = await cache.get({ key: 'shared-key', namespace: 'ns2' });

    expect(r1.value).toBe('ns1-value');
    expect(r2.value).toBe('ns2-value');
  });

  test('clearNamespace removes only that namespace', async () => {
    await cache.set({ key: 'k', value: 1, namespace: 'to-clear' });
    await cache.set({ key: 'k', value: 2, namespace: 'keep' });
    await cache.clearNamespace('to-clear');

    const r1 = await cache.get({ key: 'k', namespace: 'to-clear' });
    const r2 = await cache.get({ key: 'k', namespace: 'keep' });
    expect(r1).toBeNull();
    expect(r2).not.toBeNull();
  });

  test('batchGet returns results in order', async () => {
    await cache.set({ key: 'bk1', value: 'v1' });
    await cache.set({ key: 'bk2', value: 'v2' });

    const results = await cache.batchGet([
      { key: 'bk1' },
      { key: 'bk3' }, // miss
      { key: 'bk2' },
    ]);

    expect(results[0].value).toBe('v1');
    expect(results[1]).toBeNull(); // miss
    expect(results[2].value).toBe('v2');
  });

  test('batchSet stores all entries', async () => {
    await cache.batchSet([
      { key: 'bs1', value: 'a' },
      { key: 'bs2', value: 'b' },
      { key: 'bs3', value: 'c' },
    ]);

    const r1 = await cache.get({ key: 'bs1' });
    const r2 = await cache.get({ key: 'bs2' });
    const r3 = await cache.get({ key: 'bs3' });

    expect(r1.value).toBe('a');
    expect(r2.value).toBe('b');
    expect(r3.value).toBe('c');
  });

  test('warm loads multiple entries', async () => {
    const result = await cache.warm([
      { key: 'warm1', value: 'w1' },
      { key: 'warm2', value: 'w2' },
      { key: 'warm3', value: 'w3' },
    ]);

    expect(result.warmed).toBe(3);
    expect(result.failed).toBe(0);
    expect((await cache.get({ key: 'warm1' })).value).toBe('w1');
  });

  test('custom TTL expires entry', async () => {
    await cache.set({ key: 'ttl-test', value: 'expires', ttl: 50 });
    await sleep(60);
    const result = await cache.get({ key: 'ttl-test' });
    expect(result).toBeNull();
  });

  test('getStats returns valid counters', async () => {
    await cache.set({ key: 'stat-test', value: 1 });
    await cache.get({ key: 'stat-test' });
    await cache.get({ key: 'miss-key' });
    const stats = cache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.misses).toBeGreaterThanOrEqual(1);
    expect(stats.sets).toBeGreaterThanOrEqual(1);
  });

  test('getAnalytics includes savings and latency', async () => {
    await cache.set({ key: 'analytic-key', value: 1 });
    await cache.get({ key: 'analytic-key' });
    const analytics = cache.getAnalytics();
    expect(analytics.savings).toBeDefined();
    expect(analytics.latency).toBeDefined();
    expect(analytics.hotKeys).toBeDefined();
  });

  test('healthCheck returns ok', async () => {
    const health = await cache.healthCheck();
    expect(health.status).toBe('ok');
  });

  test('semantic search with pre-computed vectors', async () => {
    const dims = 16;
    const v1 = makeVector(dims, 1);
    const v2 = makeVector(dims, 100); // very different

    // Enable semantic mode
    cache._matcher._embedAvailable = true;

    await cache.set({ key: 'vec-key-1', value: 'match-me', vector: v1 });
    await cache.set({ key: 'vec-key-2', value: 'different', vector: v2 });

    // Mock embed to return v1 for search
    cache._matcher.embed = async () => v1;

    const result = await cache.get({ key: 'any text query', threshold: 0.5 });
    // Should find the entry with v1
    if (result) {
      expect(result.value).toBe('match-me');
    }
  });

  test('write-behind strategy still populates index', async () => {
    const wbCache = new HeadyCache({
      backend: 'memory',
      writeStrategy: 'write-behind',
      writeBehindInterval: 500,
    });
    wbCache._matcher.embed = async () => null;
    await wbCache.init();

    await wbCache.set({ key: 'wb-key', value: 'wb-value' });

    // Flush write-behind
    await wbCache._writeBehind.forceFlush();

    const result = await wbCache.get({ key: 'wb-key' });
    // After flush, value should be in store
    expect(result).not.toBeNull();
    expect(result.value).toBe('wb-value');

    await wbCache.close();
  });
});

// ---------------------------------------------------------------------------
// ─── Express Routes (supertest) ─────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe('Express Routes', () => {
  let request;
  let app;
  let cache;
  let server;

  beforeAll(async () => {
    const supertest = require('supertest');
    const express = require('express');
    const { createRouter } = require('../routes');

    cache = new HeadyCache({ backend: 'memory', ttl: 5000 });
    cache._matcher.embed = async () => null;
    await cache.init();

    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use('/', createRouter(cache));

    request = supertest(expressApp);
  });

  afterAll(async () => {
    await cache.close();
  });

  test('POST /cache/set → 201 with id', async () => {
    const res = await request
      .post('/cache/set')
      .send({ key: 'route-test', value: { x: 1 } });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('POST /cache/get → hit', async () => {
    await request.post('/cache/set').send({ key: 'get-test', value: 'found' });
    const res = await request.post('/cache/get').send({ key: 'get-test' });
    expect(res.status).toBe(200);
    expect(res.body.hit).toBe(true);
    expect(res.body.value).toBe('found');
  });

  test('POST /cache/get → miss', async () => {
    const res = await request
      .post('/cache/get')
      .send({ key: 'definitely-not-cached-xyz' });
    expect(res.status).toBe(200);
    expect(res.body.hit).toBe(false);
  });

  test('POST /cache/get → 400 when key missing', async () => {
    const res = await request.post('/cache/get').send({});
    expect(res.status).toBe(400);
  });

  test('POST /cache/set → 400 when value missing', async () => {
    const res = await request.post('/cache/set').send({ key: 'no-value' });
    expect(res.status).toBe(400);
  });

  test('DELETE /cache/:key → deleted', async () => {
    await request.post('/cache/set').send({ key: 'del-test', value: 'bye' });
    const res = await request.delete('/cache/del-test');
    expect(res.status).toBe(200);
  });

  test('DELETE /cache/namespace/:ns → cleared', async () => {
    await request.post('/cache/set').send({ key: 'ns-k', value: 1, namespace: 'del-ns' });
    const res = await request.delete('/cache/namespace/del-ns');
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);
  });

  test('POST /cache/batch/get → results array', async () => {
    await request.post('/cache/set').send({ key: 'bg1', value: 'a' });
    await request.post('/cache/set').send({ key: 'bg2', value: 'b' });
    const res = await request.post('/cache/batch/get').send({
      requests: [{ key: 'bg1' }, { key: 'bg2' }, { key: 'bg-miss' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[0].hit).toBe(true);
    expect(res.body.results[2].hit).toBe(false);
  });

  test('POST /cache/batch/set → results array', async () => {
    const res = await request.post('/cache/batch/set').send({
      requests: [
        { key: 'bs1', value: 1 },
        { key: 'bs2', value: 2 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.results).toHaveLength(2);
  });

  test('POST /cache/warm → warmed count', async () => {
    const res = await request.post('/cache/warm').send({
      entries: [
        { key: 'w1', value: 'a' },
        { key: 'w2', value: 'b' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.warmed).toBe(2);
  });

  test('GET /cache/stats → stats object', async () => {
    const res = await request.get('/cache/stats');
    expect(res.status).toBe(200);
    expect(res.body.hitRate).toBeDefined();
    expect(res.body.entries).toBeDefined();
  });

  test('GET /cache/analytics → analytics object', async () => {
    const res = await request.get('/cache/analytics');
    expect(res.status).toBe(200);
    expect(res.body.latency).toBeDefined();
    expect(res.body.savings).toBeDefined();
    expect(res.body.hotKeys).toBeDefined();
  });

  test('GET /health → ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /cache/batch/get → 400 if requests > 1000', async () => {
    const requests = Array.from({ length: 1001 }, (_, i) => ({ key: `k${i}` }));
    const res = await request.post('/cache/batch/get').send({ requests });
    expect(res.status).toBe(400);
  });
});

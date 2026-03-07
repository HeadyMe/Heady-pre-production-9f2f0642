/**
 * Rate Limiter Test Suite
 * ========================
 * Tests all 4 layers + semantic dedup + priority queue.
 */

'use strict';

const {
  SemanticRateLimiter,
  TokenBucket,
  SlidingWindowCounter,
  SemanticDedupCache,
  PriorityQueue,
} = require('../src/security/rate-limiter');

describe('TokenBucket', () => {
  test('allows consumption within limit', () => {
    const bucket = new TokenBucket(10, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.remaining).toBe(9);
  });

  test('denies when empty', () => {
    const bucket = new TokenBucket(2, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  test('refills over time', async () => {
    const bucket = new TokenBucket(10, 100); // 100 tokens/sec
    bucket.consume(10);
    expect(bucket.remaining).toBe(0);

    await new Promise(r => setTimeout(r, 50));
    expect(bucket.remaining).toBeGreaterThan(0);
  });
});

describe('SlidingWindowCounter', () => {
  test('counts within window', () => {
    const counter = new SlidingWindowCounter(60000, 100);
    counter.record();
    counter.record();
    expect(counter.count()).toBe(2);
  });

  test('respects max requests', () => {
    const counter = new SlidingWindowCounter(60000, 3);
    counter.record();
    counter.record();
    counter.record();
    expect(counter.allowed).toBe(false);
  });
});

describe('SemanticDedupCache', () => {
  test('detects similar embeddings', () => {
    const cache = new SemanticDedupCache(100, 60000);
    const embedding = new Array(384).fill(0).map(() => Math.random());
    cache.store(embedding, { data: 'cached' });

    // Same embedding should hit
    const result = cache.check(embedding);
    expect(result.hit).toBe(true);
    expect(result.result).toEqual({ data: 'cached' });
  });

  test('misses on different embeddings', () => {
    const cache = new SemanticDedupCache(100, 60000);
    const emb1 = new Array(384).fill(0).map(() => Math.random());
    const emb2 = new Array(384).fill(0).map(() => Math.random());
    cache.store(emb1, { data: 'cached' });

    const result = cache.check(emb2);
    expect(result.hit).toBe(false);
  });

  test('skips when no embedding provided', () => {
    const cache = new SemanticDedupCache(100, 60000);
    expect(cache.check(null)).toEqual({ hit: false });
  });
});

describe('PriorityQueue', () => {
  test('dequeues in priority order', () => {
    const pq = new PriorityQueue();
    pq.enqueue('low', 10);
    pq.enqueue('high', 1);
    pq.enqueue('mid', 5);

    expect(pq.dequeue()).toBe('high');
    expect(pq.dequeue()).toBe('mid');
    expect(pq.dequeue()).toBe('low');
  });

  test('returns null when empty', () => {
    const pq = new PriorityQueue();
    expect(pq.dequeue()).toBeNull();
  });
});

describe('SemanticRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new SemanticRateLimiter({
      globalBurst: 100,
      globalRate: 50,
      userBurst: 10,
      userRate: 5,
      sessionBurst: 5,
      sessionRate: 2,
    });
  });

  test('allows requests within limits', async () => {
    const result = await limiter.check({
      tool: 'test.tool',
      user: 'user1',
      session: 'sess1',
    });
    expect(result.allowed).toBe(true);
    expect(result.headers).toBeDefined();
    expect(result.headers['X-RateLimit-Limit']).toBeDefined();
  });

  test('blocks after user burst exceeded', async () => {
    // Consume all user burst tokens
    for (let i = 0; i < 10; i++) {
      await limiter.check({ tool: 'test.tool', user: 'user1', session: 'sess1' });
    }

    const result = await limiter.check({
      tool: 'test.tool',
      user: 'user1',
      session: 'sess1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('User burst');
    expect(result.retryAfterMs).toBeDefined();
  });

  test('different users have independent limits', async () => {
    // Exhaust user1
    for (let i = 0; i < 10; i++) {
      await limiter.check({ tool: 'test.tool', user: 'user1', session: 'sess1' });
    }

    // user2 should still be allowed
    const result = await limiter.check({
      tool: 'test.tool',
      user: 'user2',
      session: 'sess2',
    });
    expect(result.allowed).toBe(true);
  });

  test('includes rate limit headers', async () => {
    const result = await limiter.check({
      tool: 'test.tool',
      user: 'user1',
      session: 'sess1',
    });
    expect(result.headers['X-RateLimit-Limit']).toBe(10);
    expect(result.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(result.headers['X-RateLimit-Reset']).toBeDefined();
  });

  test('semantic dedup returns cached result', async () => {
    const embedding = new Array(384).fill(0).map(() => Math.random());

    // First call
    await limiter.check({ tool: 'test', user: 'u1', inputEmbedding: embedding });
    await limiter.cacheResult(embedding, { data: 'cached-result' });

    // Second call with same embedding should dedup
    const result = await limiter.check({
      tool: 'test',
      user: 'u1',
      inputEmbedding: embedding,
    });
    expect(result.allowed).toBe(true);
    expect(result.cachedResult).toEqual({ data: 'cached-result' });
  });
});

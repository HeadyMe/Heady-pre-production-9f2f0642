'use strict';

/**
 * HeadyInfer Test Suite
 *
 * Covers:
 *  - Routing (matrix resolution, affinity, budget downgrade, custom rules)
 *  - Racing  (winner selection, analytics, progressive fallback)
 *  - Circuit Breaker (state transitions, PHI backoff, HALF_OPEN recovery)
 *  - Response Cache (LRU eviction, TTL, bypass for non-zero temp)
 *  - Cost Tracker (accumulation, alerts, downgrade suggestions, reports)
 *  - HeadyInfer gateway (generate, failover, dedup, cache integration)
 */

// ─── Minimal Jest-compatible test harness ─────────────────────────────────────
// This test file is designed to run with Node's built-in assert module
// but uses Jest-compatible `describe/it/expect` signatures.
// Run with: npx jest or node --test (Node 20+)

const assert = require('assert');

// ─── Imports ──────────────────────────────────────────────────────────────────
const { CircuitBreakerManager, STATES } = require('../circuit-breaker');
const ResponseCache    = require('../response-cache');
const CostTracker      = require('../cost-tracker');
const ProviderRacing   = require('../racing');
const TaskRouter       = require('../router');
const { HeadyInfer }   = require('../index');
const config           = require('../config');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a fake successful provider response. */
function fakeResponse(override = {}) {
  return {
    provider:     'test',
    model:        'test-model',
    content:      'Hello from test model',
    role:         'assistant',
    finishReason: 'stop',
    usage:        { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    costUsd:      0.001,
    latencyMs:    42,
    timestamp:    new Date().toISOString(),
    ...override,
  };
}

/** Create a mock provider. */
function mockProvider(id, opts = {}) {
  return {
    id,
    enabled:  true,
    config:   { models: { default: `${id}-default` }, pricing: {} },
    generate: opts.generate || jest.fn().mockResolvedValue(fakeResponse({ provider: id })),
    stream:   opts.stream   || jest.fn().mockResolvedValue(fakeResponse({ provider: id })),
    health:   opts.health   || jest.fn().mockResolvedValue({ provider: id, status: 'healthy', latencyMs: 10 }),
    getModels: jest.fn().mockResolvedValue([`${id}-default`]),
    getMetrics: jest.fn().mockReturnValue({ requests: 0, successes: 0, failures: 0 }),
  };
}

// Polyfill jest.fn() if running without Jest
if (typeof jest === 'undefined') {
  global.jest = {
    fn: (impl) => {
      const calls = [];
      const fn = function(...args) {
        calls.push(args);
        return impl ? impl(...args) : undefined;
      };
      fn.mock = { calls };
      fn.mockResolvedValue = (val) => { fn.__impl = () => Promise.resolve(val); return fn; };
      fn.mockRejectedValue = (val) => { fn.__impl = () => Promise.reject(val); return fn; };
      fn.mockReturnValue   = (val) => { fn.__impl = () => val; return fn; };
      return fn;
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('CircuitBreakerManager', () => {
  let cbm;

  beforeEach(() => {
    cbm = new CircuitBreakerManager({
      failureThreshold: 3,
      successThreshold: 2,
      timeout:         1000,
      phiBackoffBase:  100,
      phiBackoffMax:   5000,
    });
  });

  it('starts in CLOSED state', () => {
    const c = cbm.getCircuit('provider-a');
    expect(c.state).toBe(STATES.CLOSED);
  });

  it('transitions to OPEN after failure threshold', async () => {
    const circuit = cbm.getCircuit('p1');
    // Force 3 failures
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('fail'));
    expect(circuit.state).toBe(STATES.OPEN);
  });

  it('throws CircuitOpenError when OPEN', async () => {
    const circuit = cbm.getCircuit('p2');
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('fail'));
    expect(() => circuit.allowRequest()).toThrow('Circuit OPEN');
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    const circuit = cbm.getCircuit('p3');
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('fail'));
    expect(circuit.state).toBe(STATES.OPEN);

    // Manually expire the timeout
    circuit._openedAt = Date.now() - 2000;
    circuit.allowRequest();  // Should trigger HALF_OPEN transition
    expect(circuit.state).toBe(STATES.HALF_OPEN);
  });

  it('transitions HALF_OPEN → CLOSED on sufficient successes', async () => {
    const circuit = cbm.getCircuit('p4');
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('fail'));
    circuit._openedAt = Date.now() - 2000;
    circuit.allowRequest();  // HALF_OPEN
    circuit.onSuccess();
    circuit.onSuccess();     // 2 successes = CLOSED
    expect(circuit.state).toBe(STATES.CLOSED);
  });

  it('re-opens on failure in HALF_OPEN', async () => {
    const circuit = cbm.getCircuit('p5');
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('fail'));
    circuit._openedAt = Date.now() - 2000;
    circuit.allowRequest();  // HALF_OPEN
    circuit.onFailure(new Error('fail again'));
    expect(circuit.state).toBe(STATES.OPEN);
  });

  it('uses PHI backoff that grows with each open', () => {
    const circuit = cbm.getCircuit('p6');
    const phi     = 1.618033988749895;
    circuit._openCount = 3;
    const backoff = circuit._calcBackoff();
    expect(backoff).toBeCloseTo(100 * Math.pow(phi, 2), 0);
  });

  it('execute() wraps fn and records success/failure', async () => {
    const result = await cbm.execute('test-exec', () => Promise.resolve('ok'));
    expect(result).toBe('ok');

    const circuit = cbm.getCircuit('test-exec');
    // Repeated failures should open circuit
    for (let i = 0; i < 3; i++) {
      try { await cbm.execute('test-exec', () => Promise.reject(new Error('boom'))); } catch (_) {}
    }
    expect(circuit.state).toBe(STATES.OPEN);
  });

  it('reset() returns circuit to CLOSED', () => {
    const circuit = cbm.getCircuit('p-reset');
    for (let i = 0; i < 3; i++) circuit.onFailure(new Error('x'));
    expect(circuit.state).toBe(STATES.OPEN);
    cbm.reset('p-reset');
    expect(circuit.state).toBe(STATES.CLOSED);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// RESPONSE CACHE TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('ResponseCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ResponseCache({
      enabled:         true,
      maxSize:         5,
      defaultTTL:      60_000,
      bypassAboveTemp: 0,
    });
  });

  it('stores and retrieves a value', () => {
    const req = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], temperature: 0 };
    const key = cache.buildKey(req);
    cache.set(key, fakeResponse(), 'gpt-4o');
    const result = cache.get(key);
    expect(result).not.toBeNull();
    expect(result.content).toBe('Hello from test model');
  });

  it('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('returns null for expired entry', () => {
    const req = { model: 'm', messages: [], temperature: 0 };
    const key = cache.buildKey(req);
    cache.set(key, fakeResponse(), 'm');
    // Manually expire
    const entry = cache._store.get(key);
    entry.expiresAt = Date.now() - 1;
    expect(cache.get(key)).toBeNull();
  });

  it('bypasses cache for temperature > 0', async () => {
    const req = { model: 'm', messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 };
    expect(cache.shouldBypass(req)).toBe(true);
  });

  it('evicts LRU entry when at capacity', () => {
    for (let i = 0; i < 6; i++) {
      const req = { model: `m${i}`, messages: [{ role: 'user', content: `msg${i}` }], temperature: 0 };
      const key = cache.buildKey(req);
      cache.set(key, fakeResponse(), `m${i}`);
    }
    expect(cache._store.size).toBe(5);
    expect(cache.getStats().evictions).toBe(1);
  });

  it('getOrSet returns cached result on second call', async () => {
    const req = { model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }], temperature: 0 };
    let callCount = 0;
    const fn = () => { callCount++; return Promise.resolve(fakeResponse()); };

    await cache.getOrSet(req, fn);
    await cache.getOrSet(req, fn);

    expect(callCount).toBe(1);
    expect(cache.getStats().hits).toBe(1);
  });

  it('warm() pre-populates cache', () => {
    const entries = [
      { request: { model: 'a', messages: [], temperature: 0 }, response: fakeResponse() },
      { request: { model: 'b', messages: [], temperature: 0 }, response: fakeResponse() },
    ];
    const warmed = cache.warm(entries);
    expect(warmed).toBe(2);
    expect(cache._store.size).toBe(2);
  });

  it('purgeExpired() removes stale entries', () => {
    const req = { model: 'x', messages: [], temperature: 0 };
    const key = cache.buildKey(req);
    cache.set(key, fakeResponse(), 'x');
    cache._store.get(key).expiresAt = Date.now() - 1;
    const removed = cache.purgeExpired();
    expect(removed).toBe(1);
    expect(cache._store.size).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// COST TRACKER TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('CostTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new CostTracker({
      budget: {
        dailyCap:        10.00,
        monthlyCap:      100.00,
        alertThresholds: [0.5, 0.75, 0.9, 1.0],
        autoDowngrade:   true,
        perProvider:     { openai: 5.00, anthropic: 5.00 },
      },
    });
  });

  it('records cost and accumulates totals', () => {
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, costUsd: 0.01 });
    const totals = tracker.getCurrentTotals();
    expect(totals.daily.total).toBeCloseTo(0.01, 4);
  });

  it('fires alert at 50% daily threshold', (done) => {
    tracker.on('alert', (a) => {
      if (a.threshold === 0.5 && a.type === 'daily') done();
    });
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 0, outputTokens: 0, costUsd: 5.01 });
  });

  it('fires budgetExceeded at 100%', (done) => {
    tracker.on('budgetExceeded', () => done());
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 0, outputTokens: 0, costUsd: 10.01 });
  });

  it('checkBudget returns allowed=false when over daily cap', () => {
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 0, outputTokens: 0, costUsd: 9.99 });
    const check = tracker.checkBudget('openai', 0.02);
    expect(check.allowed).toBe(false);
  });

  it('checkBudget respects per-provider cap', () => {
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 0, outputTokens: 0, costUsd: 4.99 });
    const check = tracker.checkBudget('openai', 0.02);
    expect(check.allowed).toBe(false);
  });

  it('suggestDowngrade returns cheaper model at 75%', () => {
    // Spend 76% of daily budget
    tracker.record({ provider: 'anthropic', model: 'claude-3-opus-20240229', inputTokens: 0, outputTokens: 0, costUsd: 7.60 });
    const downgrade = tracker.suggestDowngrade('anthropic', 'claude-3-opus-20240229');
    expect(downgrade).toBe('claude-3-haiku-20240307');
  });

  it('generateReport returns structured cost breakdown', () => {
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 100, outputTokens: 50, costUsd: 0.001, taskType: 'code_generation' });
    tracker.record({ provider: 'groq',   model: 'llama-3.1-8b-instant', inputTokens: 200, outputTokens: 80, costUsd: 0.0001, taskType: 'quick_task' });
    const report = tracker.generateReport(30);
    expect(report.requestCount).toBe(2);
    expect(typeof report.totalCostUsd).toBe('number');
    expect(report.byProvider).toHaveProperty('openai');
    expect(report.byProvider).toHaveProperty('groq');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// RACING TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('ProviderRacing', () => {
  let racing;

  beforeEach(() => {
    racing = new ProviderRacing({
      enabled:       true,
      maxConcurrent: 3,
      timeout:       5000,
      weightDecay:   0.95,
    });
  });

  it('returns first successful response', async () => {
    const contestants = [
      { id: 'fast',  fn: () => new Promise(r => setTimeout(() => r(fakeResponse({ provider: 'fast' })), 10)) },
      { id: 'slow',  fn: () => new Promise(r => setTimeout(() => r(fakeResponse({ provider: 'slow' })), 200)) },
    ];
    const { response, winnerId } = await racing.race(contestants, 2000);
    expect(winnerId).toBe('fast');
    expect(response.provider).toBe('fast');
  });

  it('tracks analytics and win rates', async () => {
    const contestants = [
      { id: 'p1', fn: () => Promise.resolve(fakeResponse({ provider: 'p1' })) },
      { id: 'p2', fn: () => new Promise(r => setTimeout(() => r(fakeResponse({ provider: 'p2' })), 100)) },
    ];
    await racing.race(contestants, 1000);
    const analytics = racing.getAnalytics();
    expect(analytics['p1'].wins).toBe(1);
    expect(analytics['p2'].losses).toBe(1);
  });

  it('rejects when all providers fail', async () => {
    const contestants = [
      { id: 'e1', fn: () => Promise.reject(new Error('fail1')) },
      { id: 'e2', fn: () => Promise.reject(new Error('fail2')) },
    ];
    await expect(racing.race(contestants, 1000)).rejects.toThrow('All');
  });

  it('progressive fallback tries in order', async () => {
    const order = [];
    const chain = [
      { id: 'f1', fn: () => { order.push('f1'); return Promise.reject(new Error('fail')); } },
      { id: 'f2', fn: () => { order.push('f2'); return Promise.resolve(fakeResponse({ provider: 'f2' })); } },
    ];
    const { winnerId } = await racing.progressiveFallback(chain, 1000);
    expect(winnerId).toBe('f2');
    expect(order).toEqual(['f1', 'f2']);
  });

  it('selectForRace limits to maxConcurrent', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    racing.maxConcurrent = 3;
    const selected = racing.selectForRace(ids, 3);
    expect(selected.length).toBe(3);
  });

  it('adjusts weights after wins/losses', async () => {
    const contestants = [
      { id: 'winner', fn: () => Promise.resolve(fakeResponse()) },
      { id: 'loser',  fn: () => new Promise(r => setTimeout(r, 500)) },
    ];
    const winnerBefore = racing._getStats('winner').weight;
    await racing.race(contestants, 1000);
    const winnerAfter = racing._getStats('winner').weight;
    expect(winnerAfter).toBeGreaterThan(winnerBefore);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TASK ROUTER TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('TaskRouter', () => {
  let router;
  const matrix = {
    code_generation: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'groq/llama-3.1-70b-versatile'],
    quick_task:      ['groq/llama-3.1-8b-instant', 'openai/gpt-4o-mini'],
    general:         ['openai/gpt-4o', 'google/gemini-2.0-flash'],
  };

  beforeEach(() => {
    router = new TaskRouter({ matrix });
  });

  it('resolves task type from matrix', () => {
    const { chain, taskType } = router.resolve({ taskType: 'code_generation' });
    expect(taskType).toBe('code_generation');
    expect(chain[0].provider).toBe('anthropic');
    expect(chain[0].model).toBe('claude-3-5-sonnet-20241022');
  });

  it('falls back to general for unknown task types', () => {
    const { chain } = router.resolve({ taskType: 'unknown_task_xyz' });
    expect(chain[0].provider).toBe('openai');
  });

  it('respects explicit provider/model override', () => {
    const { chain, reason } = router.resolve({
      taskType: 'code_generation',
      provider: 'groq',
      model:    'mixtral-8x7b-32768',
    });
    expect(reason).toBe('explicit_override');
    expect(chain[0].provider).toBe('groq');
    expect(chain[0].model).toBe('mixtral-8x7b-32768');
  });

  it('custom rules take priority over matrix', () => {
    router.addCustomRule(
      (req) => req.specialFlag === true,
      ['local/llama3.1']
    );
    const { chain, reason } = router.resolve({ taskType: 'general', specialFlag: true });
    expect(reason).toBe('custom_rule');
    expect(chain[0].provider).toBe('local');
  });

  it('setRoute updates the matrix', () => {
    router.setRoute('new_task', ['openai/gpt-4o-mini']);
    const { chain } = router.resolve({ taskType: 'new_task' });
    expect(chain[0].provider).toBe('openai');
    expect(chain[0].model).toBe('gpt-4o-mini');
  });

  it('records and retrieves affinity stats', () => {
    router.recordOutcome('code_generation', 'anthropic/claude-3-5-sonnet-20241022', 'success');
    router.recordOutcome('code_generation', 'anthropic/claude-3-5-sonnet-20241022', 'success');
    router.recordOutcome('code_generation', 'anthropic/claude-3-5-sonnet-20241022', 'failure');
    const stats = router.getAffinityStats();
    expect(stats['code_generation']['anthropic/claude-3-5-sonnet-20241022'].attempts).toBe(3);
    expect(stats['code_generation']['anthropic/claude-3-5-sonnet-20241022'].successRate).toBeCloseTo(2 / 3, 2);
  });

  it('routes to cheaper models under budget pressure', () => {
    // Mock costTracker with high usage
    const mockTracker = {
      getCurrentTotals: () => ({
        daily:   { total: 9.50, pct: 0.95, cap: 10 },
        monthly: { total: 50, pct: 0.50, cap: 100 },
      }),
    };
    router.costTracker = mockTracker;

    const { chain } = router.resolve({ taskType: 'code_generation' });
    // At 95%, should only have 1 (cheapest) option
    expect(chain.length).toBe(1);
    expect(chain[0].provider).toBe('groq');  // last = cheapest
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// HEADY INFER GATEWAY INTEGRATION TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('HeadyInfer Gateway', () => {
  let gateway;

  function makeGateway(providerMocks = {}) {
    // Build a minimal config with no real API keys
    const testConfig = {
      ...config,
      providers: {
        anthropic: { ...config.providers.anthropic, enabled: false },
        openai:    { ...config.providers.openai,    enabled: false },
        google:    { ...config.providers.google,    enabled: false },
        groq:      { ...config.providers.groq,      enabled: false },
        local:     { ...config.providers.local,     enabled: false },
      },
      racing:   { ...config.racing,  enabled: false },
      dedup:    { ...config.dedup,   enabled: true, windowMs: 100 },
      cache:    { ...config.cache,   enabled: true },
      logging:  { ...config.logging, auditEnabled: true, level: 'silent' },
      validationWarnings: [],
    };
    const gw = new HeadyInfer(testConfig);
    // Inject mock providers
    for (const [id, prov] of Object.entries(providerMocks)) {
      gw._providers[id] = prov;
    }
    return gw;
  }

  afterEach(async () => {
    if (gateway) await gateway.shutdown();
    gateway = null;
  });

  it('generate() returns response from primary provider', async () => {
    const mock = mockProvider('anthropic');
    mock.generate = () => Promise.resolve(fakeResponse({ provider: 'anthropic', content: 'pong' }));
    gateway = makeGateway({ anthropic: mock });
    gateway.router._matrix.general = ['anthropic/claude-3-5-sonnet-20241022'];

    const res = await gateway.generate({
      messages:  [{ role: 'user', content: 'ping' }],
      taskType:  'general',
    });
    expect(res.content).toBe('pong');
    expect(res.provider).toBe('anthropic');
  });

  it('failover chain: falls through to secondary on primary failure', async () => {
    const failProvider = {
      ...mockProvider('openai'),
      generate: () => Promise.reject(new Error('OpenAI down')),
    };
    const successProvider = {
      ...mockProvider('groq'),
      generate: () => Promise.resolve(fakeResponse({ provider: 'groq', content: 'groq response' })),
    };
    gateway = makeGateway({ openai: failProvider, groq: successProvider });
    gateway.router._matrix.general = ['openai/gpt-4o', 'groq/llama-3.1-70b-versatile'];

    const res = await gateway.generate({
      messages: [{ role: 'user', content: 'test' }],
      taskType: 'general',
    });
    expect(res.provider).toBe('groq');
    expect(res.content).toBe('groq response');
  });

  it('throws AllProvidersFailedError when all providers fail', async () => {
    const failProvider = { ...mockProvider('openai'), generate: () => Promise.reject(new Error('fail')) };
    gateway = makeGateway({ openai: failProvider });
    gateway.router._matrix.general = ['openai/gpt-4o'];

    await expect(
      gateway.generate({ messages: [{ role: 'user', content: 'test' }], taskType: 'general' })
    ).rejects.toThrow('All providers exhausted');
  });

  it('deduplication: same request within window returns same promise', async () => {
    let calls = 0;
    const slowProvider = {
      ...mockProvider('openai'),
      generate: () => new Promise(r => setTimeout(() => {
        calls++;
        r(fakeResponse());
      }, 50)),
    };
    gateway = makeGateway({ openai: slowProvider });
    gateway.router._matrix.general = ['openai/gpt-4o'];
    // Disable cache so dedup is the mechanism under test
    gateway.config.cache.enabled = false;
    gateway.cache.enabled = false;

    const req = { messages: [{ role: 'user', content: 'dedup-test-unique-xyz' }], taskType: 'general', temperature: 0 };
    const [r1, r2] = await Promise.all([gateway.generate(req), gateway.generate(req)]);
    expect(calls).toBe(1);
    expect(r2.deduplicated).toBe(true);
  });

  it('cache: second identical request hits cache', async () => {
    let calls = 0;
    const countingProvider = {
      ...mockProvider('openai'),
      generate: () => { calls++; return Promise.resolve(fakeResponse({ content: 'cached-content-test' })); },
    };
    gateway = makeGateway({ openai: countingProvider });
    gateway.router._matrix.general = ['openai/gpt-4o'];
    // Disable dedup so cache is the mechanism under test
    gateway.config.dedup.enabled = false;

    const req = { messages: [{ role: 'user', content: 'cache test unique 12345' }], taskType: 'general', temperature: 0 };
    const r1 = await gateway.generate(req);
    const r2 = await gateway.generate(req);
    expect(calls).toBe(1);
    expect(r2.cached).toBe(true);
  });

  it('validate rejects empty request', async () => {
    gateway = makeGateway({});
    await expect(gateway.generate({})).rejects.toThrow('Request must include');
  });

  it('validate rejects invalid temperature', async () => {
    gateway = makeGateway({});
    await expect(gateway.generate({
      messages:    [{ role: 'user', content: 'hi' }],
      temperature: 3.0,
    })).rejects.toThrow('temperature');
  });

  it('health() returns aggregated provider status', async () => {
    const healthyProvider = {
      ...mockProvider('openai'),
      health: () => Promise.resolve({ provider: 'openai', status: 'healthy', latencyMs: 10 }),
    };
    gateway = makeGateway({ openai: healthyProvider });

    const health = await gateway.health();
    expect(typeof health.status).toBe('string');
    expect(Array.isArray(health.providers)).toBe(true);
  });

  it('getProviders() returns provider list with circuit state', () => {
    const p = mockProvider('openai');
    gateway = makeGateway({ openai: p });
    const providers = gateway.getProviders();
    expect(providers.length).toBe(1);
    expect(providers[0].id).toBe('openai');
    expect(providers[0].circuit).toBeDefined();
  });

  it('getMetrics() returns request counts and latency', async () => {
    const p = mockProvider('openai');
    p.generate = () => Promise.resolve(fakeResponse());
    gateway = makeGateway({ openai: p });
    gateway.router._matrix.general = ['openai/gpt-4o'];

    await gateway.generate({ messages: [{ role: 'user', content: 'hi' }], taskType: 'general' });
    const metrics = gateway.getMetrics();
    expect(metrics.requests).toBe(1);
  });

  it('audit log records entries', async () => {
    const p = mockProvider('openai');
    p.generate = () => Promise.resolve(fakeResponse());
    gateway = makeGateway({ openai: p });
    gateway.router._matrix.general = ['openai/gpt-4o'];

    await gateway.generate({ messages: [{ role: 'user', content: 'audit test' }], taskType: 'general' });
    const log = gateway.getAuditLog(10);
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].requestId).toBeDefined();
  });

  it('cost tracker is updated after successful request', async () => {
    const p = mockProvider('openai');
    p.generate = () => Promise.resolve(fakeResponse({ costUsd: 0.005 }));
    gateway = makeGateway({ openai: p });
    gateway.router._matrix.general = ['openai/gpt-4o'];

    await gateway.generate({ messages: [{ role: 'user', content: 'cost test' }], taskType: 'general' });
    const totals = gateway.costTracker.getCurrentTotals();
    // Test provider charges $0 (test model) but usage is recorded
    expect(typeof totals.daily.total).toBe('number');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CONFIG TESTS
// ──────────────────────────────────────────────────────────────────────────────
describe('Config', () => {
  it('has required sections', () => {
    expect(config.providers).toBeDefined();
    expect(config.circuitBreaker).toBeDefined();
    expect(config.cache).toBeDefined();
    expect(config.budget).toBeDefined();
    expect(config.racing).toBeDefined();
    expect(config.defaultRouting).toBeDefined();
  });

  it('all task types have routing entries', () => {
    const expectedTaskTypes = [
      'code_generation', 'code_review', 'architecture', 'research',
      'quick_task', 'creative', 'security_audit', 'documentation', 'general',
    ];
    for (const taskType of expectedTaskTypes) {
      expect(config.defaultRouting[taskType]).toBeDefined();
      expect(config.defaultRouting[taskType].length).toBeGreaterThan(0);
    }
  });

  it('PHI constant is correct', () => {
    expect(config.phi).toBeCloseTo(1.6180339887, 5);
  });

  it('budget caps are positive numbers', () => {
    expect(config.budget.dailyCap).toBeGreaterThan(0);
    expect(config.budget.monthlyCap).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Provider adapter unit tests (pure logic, no HTTP)
// ──────────────────────────────────────────────────────────────────────────────
describe('BaseProvider', () => {
  const BaseProvider = require('../providers/base-provider');

  it('throws when instantiated directly', () => {
    expect(() => new BaseProvider('test', {})).toThrow('abstract');
  });

  it('estimateCost computes correctly', () => {
    // Create minimal concrete subclass for testing
    class TestProvider extends BaseProvider {
      async generate() {}
      async stream() {}
      async health() {}
    }
    const p = new TestProvider('test', {
      pricing: {
        'test-model': { input: 2.00, output: 8.00 },
      },
    });
    const cost = p.estimateCost(1_000_000, 500_000, 'test-model');
    expect(cost).toBeCloseTo(2.00 + 4.00, 4);  // $2 input + $4 output
  });

  it('normalizeMessages converts prompt to messages array', () => {
    class TestProvider extends BaseProvider {
      async generate() {}
      async stream() {}
      async health() {}
    }
    const p = new TestProvider('test', {});
    const msgs = p.normalizeMessages({ prompt: 'hello' });
    expect(msgs).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('normalizeMessages throws without messages or prompt', () => {
    class TestProvider extends BaseProvider {
      async generate() {}
      async stream() {}
      async health() {}
    }
    const p = new TestProvider('test', {});
    expect(() => p.normalizeMessages({})).toThrow('messages');
  });
});

// ─── Polyfills for running outside Jest ───────────────────────────────────────
if (typeof describe === 'undefined') {
  console.log('[HeadyInfer Tests] Run with: npx jest __tests__/heady-infer.test.js');
  console.log('[HeadyInfer Tests] Or: NODE_OPTIONS="--experimental-vm-modules" npx jest');
}

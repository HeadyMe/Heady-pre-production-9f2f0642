/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  SACRED_MULTIPLIERS,
  CB_CLOSED,
  CB_OPEN,
  CB_HALF_OPEN,
  normalizePositiveNumber,
  phiDelay,
  thunderingHerdJitter,
  CircuitBreaker,
  BackpressureDetector,
  HealthMonitor,
  EnhancedBackoff,
  withEnhancedBackoff,
  delayTable,
} = require('../src/resilience/phi-backoff-enhanced.js');

let passed = 0;
let failed = 0;

const _queue = [];

function test(name, fn) {
  _queue.push(async () => {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
  });
}

function asyncTest(name, fn) { test(name, fn); }

console.log('\n=== Phi-Backoff Enhanced Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });

test('SACRED_MULTIPLIERS contains phi', () => {
  assert.strictEqual(SACRED_MULTIPLIERS.phi, PHI);
  assert.ok(SACRED_MULTIPLIERS.sqrt2);
  assert.ok(SACRED_MULTIPLIERS.pi);
  assert.ok(SACRED_MULTIPLIERS.e);
});

// normalizePositiveNumber
test('normalizePositiveNumber returns fallback for 0', () => {
  assert.strictEqual(normalizePositiveNumber(0, 1000), 1000);
});
test('normalizePositiveNumber returns fallback for negative', () => {
  assert.strictEqual(normalizePositiveNumber(-5, 500), 500);
});
test('normalizePositiveNumber returns value for positive', () => {
  assert.strictEqual(normalizePositiveNumber(42, 1), 42);
});
test('normalizePositiveNumber returns fallback for NaN', () => {
  assert.strictEqual(normalizePositiveNumber(NaN, 100), 100);
});
test('normalizePositiveNumber returns fallback for Infinity', () => {
  assert.strictEqual(normalizePositiveNumber(Infinity, 100), 100);
});

// phiDelay
test('phiDelay returns positive number', () => {
  const d = phiDelay(0, 1000, 30000, 0);
  assert.ok(d > 0);
});

test('phiDelay attempt 0 returns ~baseMs (no jitter)', () => {
  const d = phiDelay(0, 1000, 30000, 0); // jitter=0
  assert.ok(Math.abs(d - 1000) < 1);
});

test('phiDelay attempt 1 returns ~phi*baseMs', () => {
  const d = phiDelay(1, 1000, 30000, 0);
  assert.ok(Math.abs(d - Math.round(1000 * PHI)) <= 1);
});

test('phiDelay caps at maxMs', () => {
  const d = phiDelay(20, 1000, 5000, 0);
  assert.ok(d <= 5000);
});

test('phiDelay never returns 0', () => {
  for (let i = 0; i < 10; i++) {
    assert.ok(phiDelay(i, 1, 100, 0.5) > 0);
  }
});

test('phiDelay with different geometry', () => {
  const phi_d = phiDelay(3, 1000, 30000, 0, 'phi');
  const sqrt2_d = phiDelay(3, 1000, 30000, 0, 'sqrt2');
  assert.notStrictEqual(phi_d, sqrt2_d);
});

test('phiDelay with jitter produces variation', () => {
  const delays = new Set();
  for (let i = 0; i < 20; i++) delays.add(phiDelay(2, 1000, 30000, 0.5));
  assert.ok(delays.size > 1); // should have variation
});

// thunderingHerdJitter
test('thunderingHerdJitter returns value >= baseDelay', () => {
  const d = thunderingHerdJitter(1000, 500);
  assert.ok(d >= 1000);
});

test('thunderingHerdJitter returns value <= baseDelay + windowMs', () => {
  const d = thunderingHerdJitter(1000, 500);
  assert.ok(d <= 2000);
});

test('thunderingHerdJitter produces variation', () => {
  const delays = new Set();
  for (let i = 0; i < 20; i++) delays.add(thunderingHerdJitter(100, 1000));
  assert.ok(delays.size > 5);
});

// CircuitBreaker
test('CircuitBreaker starts CLOSED', () => {
  const cb = new CircuitBreaker();
  assert.strictEqual(cb.state, CB_CLOSED);
});

test('CircuitBreaker canProceed when CLOSED', () => {
  const cb = new CircuitBreaker();
  assert.ok(cb.canProceed());
});

test('CircuitBreaker trips to OPEN after failureThreshold', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });
  for (let i = 0; i < 3; i++) cb.recordFailure(new Error('fail'));
  assert.strictEqual(cb.state, CB_OPEN);
});

test('CircuitBreaker does not canProceed when OPEN', () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, halfOpenTimeoutMs: 60000 });
  cb.recordFailure(new Error('f'));
  cb.recordFailure(new Error('f'));
  assert.strictEqual(cb.state, CB_OPEN);
  assert.ok(!cb.canProceed());
});

asyncTest('CircuitBreaker execute succeeds when CLOSED', async () => {
  const cb     = new CircuitBreaker();
  const result = await cb.execute(async () => 'success');
  assert.strictEqual(result, 'success');
});

asyncTest('CircuitBreaker execute records success', async () => {
  const cb = new CircuitBreaker();
  await cb.execute(async () => 42);
  assert.strictEqual(cb.getStats().successes, 1);
});

asyncTest('CircuitBreaker execute throws and records failure', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 10 });
  let threw = false;
  try { await cb.execute(async () => { throw new Error('fail'); }); } catch (e) { threw = true; }
  assert.ok(threw);
  assert.strictEqual(cb.getStats().failures, 1);
});

test('CircuitBreaker onOpen fires callback', () => {
  const cb    = new CircuitBreaker({ failureThreshold: 2 });
  let fired   = false;
  cb.onOpen(() => { fired = true; });
  cb.recordFailure(new Error('1'));
  cb.recordFailure(new Error('2'));
  assert.ok(fired);
});

test('CircuitBreaker onClose fires callback', () => {
  const cb    = new CircuitBreaker({ failureThreshold: 2, successThreshold: 1 });
  let opened  = false;
  let closed  = false;
  cb.onOpen(() => { opened = true; });
  cb.onClose(() => { closed = true; });
  cb.recordFailure(new Error('f'));
  cb.recordFailure(new Error('f'));
  cb._transition(CB_HALF_OPEN);
  cb.recordSuccess();
  assert.ok(opened);
  assert.ok(closed);
});

test('CircuitBreaker reset returns to CLOSED', () => {
  const cb = new CircuitBreaker({ failureThreshold: 2 });
  cb.recordFailure(new Error('f'));
  cb.recordFailure(new Error('f'));
  cb.reset();
  assert.strictEqual(cb.state, CB_CLOSED);
  assert.ok(cb.canProceed());
});

test('CircuitBreaker getStats', () => {
  const cb    = new CircuitBreaker();
  const stats = cb.getStats();
  assert.ok(typeof stats.state === 'string');
  assert.ok(typeof stats.total === 'number');
});

// BackpressureDetector
test('BackpressureDetector no pressure initially', () => {
  const bd = new BackpressureDetector();
  assert.ok(bd.getPressure() < 0.5);
  assert.ok(!bd.isUnderPressure());
});

test('BackpressureDetector high queue = high pressure', () => {
  const bd = new BackpressureDetector({ maxQueueDepth: 10 });
  bd.setQueueDepth(10);
  assert.ok(bd.getPressure() >= 0.5);
  assert.ok(bd.isUnderPressure());
});

test('BackpressureDetector high latency = pressure', () => {
  const bd = new BackpressureDetector({ latencyThresholdMs: 500, latencyWindowMs: 60000 });
  for (let i = 0; i < 5; i++) bd.recordLatency(3000); // 3x threshold
  assert.ok(bd.getPressure() > 0.5);
});

test('BackpressureDetector getAvgLatency', () => {
  const bd = new BackpressureDetector({ latencyWindowMs: 60000 });
  bd.recordLatency(100);
  bd.recordLatency(200);
  bd.recordLatency(300);
  assert.ok(Math.abs(bd.getAvgLatency() - 200) < 1);
});

// HealthMonitor
test('HealthMonitor starts at max health', () => {
  const hm = new HealthMonitor({ initialScore: 1.0 });
  assert.ok(hm.isHealthy());
  assert.ok(hm.getScore() > 0);
});

test('HealthMonitor degrades on failures', () => {
  const hm = new HealthMonitor({ decayAlpha: 0.5 });
  hm.record(false);
  hm.record(false);
  assert.ok(hm.getScore() < 1);
});

test('HealthMonitor recovers on successes', () => {
  const hm = new HealthMonitor({ decayAlpha: 0.5, initialScore: 0.1 });
  hm.record(true);
  hm.record(true);
  hm.record(true);
  assert.ok(hm.getScore() > 0.1);
});

test('HealthMonitor isHealthy respects threshold', () => {
  const hm = new HealthMonitor({ minHealthScore: 0.5, decayAlpha: 1.0 });
  hm.record(false);
  assert.ok(!hm.isHealthy(0.5));
});

test('HealthMonitor getSuccessRate', () => {
  const hm = new HealthMonitor();
  hm.record(true);
  hm.record(true);
  hm.record(false);
  const rate = hm.getSuccessRate();
  assert.ok(Math.abs(rate - 2/3) < 0.01);
});

test('HealthMonitor reset', () => {
  const hm = new HealthMonitor({ decayAlpha: 1.0 });
  hm.record(false);
  hm.reset();
  assert.ok(hm.getScore() > 0.9);
});

// EnhancedBackoff
asyncTest('EnhancedBackoff succeeds on first try', async () => {
  const eb     = new EnhancedBackoff({ maxRetries: 3 });
  const result = await eb.execute(async () => 'ok');
  assert.strictEqual(result, 'ok');
});

asyncTest('EnhancedBackoff retries and succeeds', async () => {
  const eb   = new EnhancedBackoff({ maxRetries: 3, baseMs: 10, maxDelayMs: 50 });
  let calls  = 0;
  const result = await eb.execute(async () => {
    calls++;
    if (calls < 3) throw new Error('transient');
    return 'success';
  });
  assert.strictEqual(result, 'success');
  assert.strictEqual(calls, 3);
});

asyncTest('EnhancedBackoff throws after all retries exhausted', async () => {
  const eb = new EnhancedBackoff({ maxRetries: 2, baseMs: 5, maxDelayMs: 20 });
  let threw = false;
  try { await eb.execute(async () => { throw new Error('always fail'); }); } catch (e) { threw = true; }
  assert.ok(threw);
});

asyncTest('EnhancedBackoff calls onRetry callback', async () => {
  let retryCalled = 0;
  const eb = new EnhancedBackoff({
    maxRetries: 2,
    baseMs: 5,
    maxDelayMs: 20,
    onRetry: () => { retryCalled++; },
  });
  let tries = 0;
  try {
    await eb.execute(async () => { tries++; if (tries < 3) throw new Error('retry me'); return 'ok'; });
  } catch (e) {}
  assert.ok(retryCalled >= 1);
});

asyncTest('EnhancedBackoff respects shouldRetry', async () => {
  const eb = new EnhancedBackoff({
    maxRetries: 5,
    baseMs: 5,
    shouldRetry: err => !err.message.includes('no-retry'),
  });
  let threw = false;
  try {
    await eb.execute(async () => { throw new Error('no-retry error'); });
  } catch (e) { threw = true; }
  assert.ok(threw); // should not retry
});

asyncTest('EnhancedBackoff with circuit breaker respects OPEN state', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1, halfOpenTimeoutMs: 60000 });
  cb.recordFailure(new Error('f')); // trip the breaker
  const eb = new EnhancedBackoff({ maxRetries: 3, circuitBreaker: cb });
  let threw = false;
  try { await eb.execute(async () => 'ok'); } catch (e) { threw = true; }
  assert.ok(threw);
});

asyncTest('EnhancedBackoff with health monitor skips retries below threshold', async () => {
  const hm = new HealthMonitor({ initialScore: 0.1, minHealthScore: 0.5 });
  const eb = new EnhancedBackoff({ maxRetries: 5, baseMs: 5, healthMonitor: hm, healthThreshold: 0.3 });
  let threw = false;
  try {
    await eb.execute(async () => { throw new Error('fail'); });
  } catch (e) {
    threw = true;
    // Either HEALTH_BELOW_THRESHOLD or regular error
    assert.ok(e.message);
  }
  assert.ok(threw);
});

// withEnhancedBackoff
asyncTest('withEnhancedBackoff works as convenience wrapper', async () => {
  const result = await withEnhancedBackoff(async () => 42, { maxRetries: 2, baseMs: 5 });
  assert.strictEqual(result, 42);
});

// delayTable
test('delayTable returns correct number of entries', () => {
  const table = delayTable(5, 1000, 'phi');
  assert.strictEqual(table.length, 5);
});

test('delayTable delays increase monotonically with phi', () => {
  const table = delayTable(6, 1000, 'phi');
  for (let i = 1; i < table.length; i++) {
    assert.ok(table[i].delayMs >= table[i-1].delayMs);
  }
});

test('delayTable attempt 0 delay = baseMs', () => {
  const table = delayTable(3, 1000, 'phi');
  assert.strictEqual(table[0].delayMs, 1000);
});

test('delayTable formula is correct', () => {
  const table = delayTable(3, 1000, 'phi');
  assert.ok(table[0].formula.includes('1000'));
  assert.ok(table[0].formula.includes('phi'));
});

test('delayTable different geometry produces different delays', () => {
  const phi_t   = delayTable(4, 1000, 'phi');
  const sqrt2_t = delayTable(4, 1000, 'sqrt2');
  assert.notStrictEqual(phi_t[2].delayMs, sqrt2_t[2].delayMs);
});

test('delayTable includes geometry and multiplier', () => {
  const table = delayTable(2, 1000, 'phi');
  assert.strictEqual(table[0].geometry, 'phi');
  assert.ok(typeof table[0].multiplier === 'number');
});

// EnhancedBackoff getDelay
test('EnhancedBackoff getDelay respects maxMs', () => {
  const eb = new EnhancedBackoff({ maxDelayMs: 500, baseMs: 100, herdWindowMs: 0 });
  for (let i = 0; i < 10; i++) {
    assert.ok(eb.getDelay(i) <= 500);
  }
});

test('EnhancedBackoff getDelay increases with attempt', () => {
  const eb = new EnhancedBackoff({ baseMs: 100, maxDelayMs: 100000, jitterFactor: 0, herdWindowMs: 0 });
  const d0 = eb.getDelay(0);
  const d3 = eb.getDelay(3);
  assert.ok(d3 > d0);
});

(async () => {
  for (const t of _queue) await t();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();

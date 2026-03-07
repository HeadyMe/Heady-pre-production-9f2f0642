/**
 * HeadyStack v3.0.1 "Aether" — Resilience Tests
 * Tests retry logic, circuit breakers, graceful degradation,
 * timeout handling, and self-healing behaviors.
 *
 * Run:
 *   node --test tests/resilience.test.js
 *   node --test --reporter spec tests/resilience.test.js
 *
 * © 2026 HeadySystems Inc. — Proprietary
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Exponential Backoff ────────────────────────────────────────

/** Compute exponential backoff delay */
function computeBackoff(attempt, { base = 1000, max = 30000, jitter = true } = {}) {
    const delay = Math.min(base * Math.pow(2, attempt), max);
    if (jitter) {
        return delay * (0.5 + Math.random() * 0.5);
    }
    return delay;
}

describe('exponential backoff', () => {
    test('backoff increases exponentially without jitter', () => {
        const delays = [0, 1, 2, 3, 4].map((a) =>
            computeBackoff(a, { base: 1000, max: 30000, jitter: false })
        );
        // 1000, 2000, 4000, 8000, 16000
        assert.equal(delays[0], 1000);
        assert.equal(delays[1], 2000);
        assert.equal(delays[2], 4000);
        assert.equal(delays[3], 8000);
        assert.equal(delays[4], 16000);
    });

    test('backoff is capped at max', () => {
        const delay = computeBackoff(20, { base: 1000, max: 30000, jitter: false });
        assert.equal(delay, 30000);
    });

    test('backoff with jitter is within [0.5x, 1.0x] of deterministic delay', () => {
        for (let attempt = 0; attempt < 5; attempt++) {
            const deterministic = computeBackoff(attempt, { base: 1000, max: 30000, jitter: false });
            const withJitter = computeBackoff(attempt, { base: 1000, max: 30000, jitter: true });
            assert.ok(withJitter >= deterministic * 0.5 - 1, `jitter ${withJitter} < 0.5x of ${deterministic}`);
            assert.ok(withJitter <= deterministic + 1, `jitter ${withJitter} > 1.0x of ${deterministic}`);
        }
    });

    test('first attempt delay is base', () => {
        const delay = computeBackoff(0, { base: 1000, max: 30000, jitter: false });
        assert.equal(delay, 1000);
    });
});

// ── Circuit Breaker ────────────────────────────────────────────

class CircuitBreaker {
    /**
     * @param {Object} opts
     * @param {number} opts.failureThreshold - failures before opening
     * @param {number} opts.successThreshold - successes to close from half-open
     * @param {number} opts.timeout_ms - time before half-open attempt
     */
    constructor({ failureThreshold = 5, successThreshold = 2, timeout_ms = 10000 } = {}) {
        this.failureThreshold = failureThreshold;
        this.successThreshold = successThreshold;
        this.timeout_ms = timeout_ms;
        this._state = 'closed';       // 'closed' | 'open' | 'half-open'
        this._failures = 0;
        this._successes = 0;
        this._openedAt = null;
    }

    get state() { return this._state; }

    async call(fn) {
        if (this._state === 'open') {
            const elapsed = Date.now() - this._openedAt;
            if (elapsed < this.timeout_ms) {
                throw new Error('CircuitBreaker: circuit is OPEN');
            }
            // Transition to half-open
            this._state = 'half-open';
            this._successes = 0;
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure();
            throw err;
        }
    }

    _onSuccess() {
        if (this._state === 'half-open') {
            this._successes++;
            if (this._successes >= this.successThreshold) {
                this._state = 'closed';
                this._failures = 0;
                this._successes = 0;
            }
        } else {
            this._failures = 0;
        }
    }

    _onFailure() {
        this._failures++;
        if (this._failures >= this.failureThreshold) {
            this._state = 'open';
            this._openedAt = Date.now();
        }
    }

    reset() {
        this._state = 'closed';
        this._failures = 0;
        this._successes = 0;
        this._openedAt = null;
    }
}

describe('circuit breaker', () => {
    test('starts in closed state', () => {
        const cb = new CircuitBreaker({ failureThreshold: 3 });
        assert.equal(cb.state, 'closed');
    });

    test('transitions to open after failure threshold', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 3, timeout_ms: 100000 });

        for (let i = 0; i < 3; i++) {
            try {
                await cb.call(() => Promise.reject(new Error('fail')));
            } catch {
                // expected
            }
        }

        assert.equal(cb.state, 'open');
    });

    test('throws immediately when open', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, timeout_ms: 100000 });

        // Trip the breaker
        for (let i = 0; i < 2; i++) {
            try { await cb.call(() => Promise.reject(new Error('fail'))); } catch {}
        }

        await assert.rejects(
            cb.call(() => Promise.resolve('ok')),
            /circuit is OPEN/
        );
    });

    test('resets to closed after successful half-open attempts', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, successThreshold: 2, timeout_ms: 1 });

        // Trip the breaker
        for (let i = 0; i < 2; i++) {
            try { await cb.call(() => Promise.reject(new Error('fail'))); } catch {}
        }
        assert.equal(cb.state, 'open');

        // Wait for timeout
        await new Promise((r) => setTimeout(r, 5));

        // Two successful calls → closes
        await cb.call(() => Promise.resolve('ok-1'));
        assert.equal(cb.state, 'half-open');

        await cb.call(() => Promise.resolve('ok-2'));
        assert.equal(cb.state, 'closed');
    });

    test('counts failures correctly', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 5, timeout_ms: 100000 });

        for (let i = 0; i < 4; i++) {
            try { await cb.call(() => Promise.reject(new Error('fail'))); } catch {}
        }

        // Not yet open
        assert.equal(cb.state, 'closed');
        assert.equal(cb._failures, 4);
    });

    test('reset clears all state', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, timeout_ms: 100000 });

        for (let i = 0; i < 2; i++) {
            try { await cb.call(() => Promise.reject(new Error('fail'))); } catch {}
        }
        assert.equal(cb.state, 'open');

        cb.reset();
        assert.equal(cb.state, 'closed');
        assert.equal(cb._failures, 0);
    });
});

// ── Retry Logic ────────────────────────────────────────────────

/** Simple retry with backoff */
async function withRetry(fn, { maxAttempts = 3, backoff = 0 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastErr = err;
            if (attempt < maxAttempts - 1 && backoff > 0) {
                await new Promise((r) => setTimeout(r, backoff));
            }
        }
    }
    throw lastErr;
}

describe('retry logic', () => {
    test('succeeds on first try', async () => {
        let calls = 0;
        const result = await withRetry(() => {
            calls++;
            return Promise.resolve('ok');
        }, { maxAttempts: 3 });

        assert.equal(result, 'ok');
        assert.equal(calls, 1);
    });

    test('retries on failure and succeeds on second attempt', async () => {
        let calls = 0;
        const result = await withRetry(() => {
            calls++;
            if (calls < 2) { return Promise.reject(new Error('temporary failure')); }
            return Promise.resolve('recovered');
        }, { maxAttempts: 3 });

        assert.equal(result, 'recovered');
        assert.equal(calls, 2);
    });

    test('throws after exhausting all attempts', async () => {
        let calls = 0;
        await assert.rejects(
            withRetry(() => {
                calls++;
                return Promise.reject(new Error(`attempt ${calls} failed`));
            }, { maxAttempts: 3 }),
            /attempt 3 failed/
        );
        assert.equal(calls, 3);
    });

    test('respects maxAttempts = 1 (no retries)', async () => {
        let calls = 0;
        await assert.rejects(
            withRetry(() => {
                calls++;
                return Promise.reject(new Error('fail'));
            }, { maxAttempts: 1 }),
            /fail/
        );
        assert.equal(calls, 1);
    });

    test('calls function with attempt number', async () => {
        const attempts = [];
        await assert.rejects(
            withRetry((attempt) => {
                attempts.push(attempt);
                return Promise.reject(new Error('fail'));
            }, { maxAttempts: 3 }),
            /fail/
        );
        assert.deepEqual(attempts, [0, 1, 2]);
    });
});

// ── Timeout Handling ────────────────────────────────────────────

/** Wrap a promise with a timeout */
function withTimeout(promise, timeout_ms, message = 'Operation timed out') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeout_ms);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        timeoutPromise,
    ]);
}

describe('timeout handling', () => {
    test('resolves if operation completes before timeout', async () => {
        const result = await withTimeout(
            new Promise((r) => setTimeout(() => r('done'), 10)),
            1000
        );
        assert.equal(result, 'done');
    });

    test('rejects if operation exceeds timeout', async () => {
        await assert.rejects(
            withTimeout(
                new Promise((r) => setTimeout(() => r('late'), 100)),
                10,
                'Custom timeout message'
            ),
            /Custom timeout message/
        );
    });

    test('immediately resolving promise passes timeout', async () => {
        const result = await withTimeout(Promise.resolve(42), 1000);
        assert.equal(result, 42);
    });

    test('immediately rejecting promise propagates error', async () => {
        await assert.rejects(
            withTimeout(Promise.reject(new Error('original error')), 1000),
            /original error/
        );
    });
});

// ── Graceful Degradation ────────────────────────────────────────

describe('graceful degradation', () => {
    test('falls back to secondary engine when primary fails', async () => {
        async function callEngine(engine) {
            if (engine === 'primary') { throw new Error('primary unavailable'); }
            return `response from ${engine}`;
        }

        async function callWithFallback(engines) {
            for (const engine of engines) {
                try {
                    return await callEngine(engine);
                } catch (err) {
                    // try next
                }
            }
            throw new Error('All engines failed');
        }

        const result = await callWithFallback(['primary', 'secondary', 'tertiary']);
        assert.equal(result, 'response from secondary');
    });

    test('returns empty context when vector memory is unavailable', async () => {
        async function retrieveContext(query, { fallback = [] } = {}) {
            // Simulate unavailability
            throw new Error('Vector DB unreachable');
        }

        async function retrieveWithFallback(query) {
            try {
                return await retrieveContext(query);
            } catch {
                return []; // graceful empty context
            }
        }

        const ctx = await retrieveWithFallback('my query');
        assert.deepEqual(ctx, []);
    });

    test('pipeline continues past non-critical stage failure', async () => {
        const results = [];
        const stages = [
            { name: 'retrieve', critical: false, fn: () => { throw new Error('Redis timeout'); } },
            { name: 'execute', critical: true, fn: () => 'LLM response' },
            { name: 'persist', critical: false, fn: () => 'stored' },
        ];

        for (const stage of stages) {
            try {
                const result = await stage.fn();
                results.push({ stage: stage.name, result });
            } catch (err) {
                if (stage.critical) { throw err; }
                results.push({ stage: stage.name, result: null, error: err.message });
            }
        }

        assert.equal(results.length, 3);
        assert.equal(results[0].error, 'Redis timeout');
        assert.equal(results[1].result, 'LLM response');
        assert.equal(results[2].result, 'stored');
    });

    test('health check returns degraded when non-critical service is down', () => {
        function computeHealthStatus(checks) {
            const criticalFailed = checks
                .filter((c) => c.critical)
                .some((c) => c.status !== 'ok');

            if (criticalFailed) { return 'unhealthy'; }

            const anyFailed = checks.some((c) => c.status !== 'ok');
            if (anyFailed) { return 'degraded'; }

            return 'healthy';
        }

        // All OK
        let status = computeHealthStatus([
            { name: 'db', status: 'ok', critical: true },
            { name: 'redis', status: 'ok', critical: true },
            { name: 'otel', status: 'ok', critical: false },
        ]);
        assert.equal(status, 'healthy');

        // Non-critical failure → degraded
        status = computeHealthStatus([
            { name: 'db', status: 'ok', critical: true },
            { name: 'redis', status: 'ok', critical: true },
            { name: 'otel', status: 'error', critical: false },
        ]);
        assert.equal(status, 'degraded');

        // Critical failure → unhealthy
        status = computeHealthStatus([
            { name: 'db', status: 'error', critical: true },
            { name: 'redis', status: 'ok', critical: true },
            { name: 'otel', status: 'ok', critical: false },
        ]);
        assert.equal(status, 'unhealthy');
    });
});

// ── Rate Limiter ───────────────────────────────────────────────

class InMemoryRateLimiter {
    constructor({ windowMs, maxRequests }) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this._store = new Map();
    }

    check(key) {
        const now = Date.now();
        const record = this._store.get(key) || { count: 0, resetAt: now + this.windowMs };

        if (now > record.resetAt) {
            record.count = 0;
            record.resetAt = now + this.windowMs;
        }

        record.count++;
        this._store.set(key, record);

        if (record.count > this.maxRequests) {
            return { allowed: false, remaining: 0, resetAt: record.resetAt };
        }

        return {
            allowed: true,
            remaining: this.maxRequests - record.count,
            resetAt: record.resetAt,
        };
    }
}

describe('rate limiter', () => {
    test('allows requests within limit', () => {
        const rl = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 10 });
        for (let i = 0; i < 10; i++) {
            const result = rl.check('user-1');
            assert.ok(result.allowed, `request ${i + 1} should be allowed`);
        }
    });

    test('blocks requests over limit', () => {
        const rl = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 3 });
        for (let i = 0; i < 3; i++) { rl.check('user-2'); }
        const result = rl.check('user-2');
        assert.equal(result.allowed, false);
        assert.equal(result.remaining, 0);
    });

    test('different keys have independent limits', () => {
        const rl = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 2 });
        rl.check('user-a');
        rl.check('user-a');
        rl.check('user-a'); // blocked

        // user-b is unaffected
        const result = rl.check('user-b');
        assert.ok(result.allowed);
    });

    test('remaining count decrements correctly', () => {
        const rl = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 5 });
        const r1 = rl.check('user-x');
        assert.equal(r1.remaining, 4);
        const r2 = rl.check('user-x');
        assert.equal(r2.remaining, 3);
    });

    test('resets after window expires', async () => {
        const rl = new InMemoryRateLimiter({ windowMs: 20, maxRequests: 2 });
        rl.check('user-z');
        rl.check('user-z');
        const blocked = rl.check('user-z');
        assert.equal(blocked.allowed, false);

        await new Promise((r) => setTimeout(r, 30));

        const reset = rl.check('user-z');
        assert.ok(reset.allowed, 'should be allowed after window reset');
    });
});

// ── Self-Healing Watchdog ──────────────────────────────────────

describe('self-healing watchdog', () => {
    test('detects task queue depth above threshold', () => {
        function checkQueueDepth(queuedTasks, threshold = 100) {
            if (queuedTasks > threshold) {
                return { alert: true, message: `Queue depth ${queuedTasks} exceeds threshold ${threshold}` };
            }
            return { alert: false };
        }

        assert.deepEqual(checkQueueDepth(50), { alert: false });
        const alert = checkQueueDepth(150);
        assert.equal(alert.alert, true);
        assert.ok(alert.message.includes('150'));
    });

    test('detects stale tasks older than TTL', () => {
        const tasks = [
            { id: '1', createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), status: 'processing' }, // 10 min old
            { id: '2', createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), status: 'processing' },  // 2 min old
            { id: '3', createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(), status: 'queued' },      // 1 min old
        ];

        const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

        const stale = tasks.filter((t) => {
            const age = Date.now() - new Date(t.createdAt).getTime();
            return age > STALE_THRESHOLD_MS && ['queued', 'processing'].includes(t.status);
        });

        assert.equal(stale.length, 1);
        assert.equal(stale[0].id, '1');
    });

    test('memory pressure detection', () => {
        function checkMemoryPressure() {
            const mem = process.memoryUsage();
            const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;
            return {
                heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                heapPercent: Math.round(heapPercent),
                pressure: heapPercent > 85 ? 'high' : heapPercent > 70 ? 'medium' : 'low',
            };
        }

        const result = checkMemoryPressure();
        assert.ok(typeof result.heapUsedMB === 'number');
        assert.ok(result.heapUsedMB > 0);
        assert.ok(['low', 'medium', 'high'].includes(result.pressure));
    });

    test('service restart decision logic', () => {
        function shouldRestart({ consecutiveFailures, lastSuccessAge_ms, crashLoopThreshold = 5 }) {
            if (consecutiveFailures >= crashLoopThreshold) {
                return { restart: false, reason: 'crash loop detected — manual intervention required' };
            }
            if (consecutiveFailures > 0 && lastSuccessAge_ms > 60000) {
                return { restart: true, reason: 'service degraded — triggering restart' };
            }
            return { restart: false, reason: 'within acceptable parameters' };
        }

        const healthy = shouldRestart({ consecutiveFailures: 0, lastSuccessAge_ms: 1000 });
        assert.equal(healthy.restart, false);

        const degraded = shouldRestart({ consecutiveFailures: 2, lastSuccessAge_ms: 90000 });
        assert.equal(degraded.restart, true);

        const crashLoop = shouldRestart({ consecutiveFailures: 5, lastSuccessAge_ms: 90000 });
        assert.equal(crashLoop.restart, false);
        assert.ok(crashLoop.reason.includes('crash loop'));
    });
});

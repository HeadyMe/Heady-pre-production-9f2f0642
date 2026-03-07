/*
 * © 2026 HeadySystems Inc..
 * Tests for src/resilience/circuit-breaker.js
 */

const {
    CircuitBreaker,
    CircuitOpenError,
    getBreaker,
    getAllBreakers,
    CRITICAL_SERVICES,
} = require('../src/resilience/circuit-breaker');

describe('CircuitBreaker', () => {
    let cb;

    beforeEach(() => {
        cb = new CircuitBreaker('test-service', {
            failureThreshold: 3,
            resetTimeoutMs: 100,
            halfOpenMaxCalls: 2,
        });
    });

    test('starts in CLOSED state', () => {
        expect(cb.state).toBe('CLOSED');
        expect(cb.failures).toBe(0);
    });

    test('successful execution stays CLOSED', async () => {
        const result = await cb.execute(() => Promise.resolve('ok'));
        expect(result).toBe('ok');
        expect(cb.state).toBe('CLOSED');
        expect(cb.metrics.totalSuccesses).toBe(1);
    });

    test('transitions to OPEN after reaching failure threshold', async () => {
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }
        expect(cb.state).toBe('OPEN');
        expect(cb.metrics.trips).toBe(1);
    });

    test('throws CircuitOpenError when OPEN', async () => {
        // Trip the breaker
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }

        await expect(cb.execute(() => Promise.resolve('ok')))
            .rejects.toThrow(CircuitOpenError);
    });

    test('uses fallback when OPEN and fallback is provided', async () => {
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }

        const result = await cb.execute(
            () => Promise.resolve('should not run'),
            () => 'fallback-value'
        );
        expect(result).toBe('fallback-value');
    });

    test('transitions to HALF_OPEN after resetTimeout', async () => {
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }
        expect(cb.state).toBe('OPEN');

        // Wait for resetTimeoutMs
        await new Promise(resolve => setTimeout(resolve, 150));

        // Next call should probe in HALF_OPEN
        const result = await cb.execute(() => Promise.resolve('recovered'));
        expect(result).toBe('recovered');
    });

    test('reset() returns to CLOSED state', async () => {
        for (let i = 0; i < 3; i++) {
            await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => { });
        }
        expect(cb.state).toBe('OPEN');

        cb.reset();
        expect(cb.state).toBe('CLOSED');
        expect(cb.failures).toBe(0);
    });

    test('getStatus() returns complete status object', () => {
        const status = cb.getStatus();
        expect(status.name).toBe('test-service');
        expect(status.state).toBe('CLOSED');
        expect(status.metrics).toBeDefined();
        expect(status.metrics.totalCalls).toBe(0);
    });
});

describe('CircuitOpenError', () => {
    test('has correct name and isCircuitOpen flag', () => {
        const err = new CircuitOpenError('test');
        expect(err.name).toBe('CircuitOpenError');
        expect(err.isCircuitOpen).toBe(true);
        expect(err instanceof Error).toBe(true);
    });
});

describe('Circuit Breaker Registry', () => {
    test('getBreaker returns same instance for same name', () => {
        const a = getBreaker('registry-test');
        const b = getBreaker('registry-test');
        expect(a).toBe(b);
    });

    test('getAllBreakers returns status for all registered breakers', () => {
        const all = getAllBreakers();
        expect(typeof all).toBe('object');
        // Should have at least the pre-registered critical services
        for (const svc of ['brain', 'soul', 'conductor']) {
            expect(all[svc]).toBeDefined();
            expect(all[svc].state).toBe('CLOSED');
        }
    });

    test('CRITICAL_SERVICES contains expected services', () => {
        expect(CRITICAL_SERVICES).toContain('brain');
        expect(CRITICAL_SERVICES).toContain('hcfp');
        expect(CRITICAL_SERVICES).toContain('cloud');
        expect(CRITICAL_SERVICES.length).toBeGreaterThanOrEqual(10);
    });
});

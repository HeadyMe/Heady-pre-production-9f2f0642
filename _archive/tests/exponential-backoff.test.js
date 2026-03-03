const {
    phiDelay,
    withBackoff,
    createResilientFn,
    delayTable,
} = require('../src/resilience/exponential-backoff');

describe('exponential-backoff', () => {
    test('phiDelay clamps invalid inputs to safe values', () => {
        const delay = phiDelay(-2, -100, -1, 10);
        expect(delay).toBeGreaterThanOrEqual(1);
        expect(delay).toBeLessThanOrEqual(30000);
    });

    test('delayTable returns deterministic non-jittered progression', () => {
        const table = delayTable(3, 1000);
        expect(table).toHaveLength(3);
        expect(table[0].attempt).toBe(0);
        expect(table[1].delayMs).toBeGreaterThan(table[0].delayMs);
    });

    test('withBackoff retries and eventually succeeds', async () => {
        let attempts = 0;
        const result = await withBackoff(async () => {
            attempts += 1;
            if (attempts < 2) throw new Error('retry-me');
            return 'ok';
        }, { maxRetries: 2, baseMs: 1, maxDelayMs: 1, jitterFactor: 0 });

        expect(result).toBe('ok');
        expect(attempts).toBe(2);
    });

    test('createResilientFn wraps target function', async () => {
        const fn = jest.fn(async (x) => x + 1);
        const wrapped = createResilientFn(fn, { maxRetries: 0 });

        await expect(wrapped(2)).resolves.toBe(3);
        expect(fn).toHaveBeenCalledWith(2);
    });
});

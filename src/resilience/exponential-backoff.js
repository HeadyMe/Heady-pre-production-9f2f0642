/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Heady Exponential Backoff — φ-Scaled Resilience ═══
 *
 * Unlike traditional base-2 exponential backoff (1s, 2s, 4s, 8s...),
 * Heady uses the Golden Ratio (φ = 1.618...) for delay scaling.
 *
 * PHI-based backoff produces a natural, harmonious delay curve:
 *   Attempt 0: baseMs × φ⁰ = 1000ms
 *   Attempt 1: baseMs × φ¹ = 1618ms
 *   Attempt 2: baseMs × φ² = 2618ms
 *   Attempt 3: baseMs × φ³ = 4236ms
 *   Attempt 4: baseMs × φ⁴ = 6854ms
 *
 * This avoids both the thundering-herd effect (via jitter) and the
 * overly aggressive delay growth of base-2 (which reaches 64s by attempt 6).
 * PHI scaling stays within practical human-attention windows longer.
 *
 * Usage:
 *   const { withBackoff, phiDelay } = require('./exponential-backoff');
 *
 *   // Wrap any async operation
 *   const result = await withBackoff(() => fetchFromAPI(url), {
 *       maxRetries: 5,
 *       baseMs: 1000,
 *       onRetry: (attempt, delay, err) => console.log(`Retry ${attempt} in ${delay}ms`),
 *   });
 *
 *   // Or just get the delay value
 *   const delay = phiDelay(attempt, 1000);
 */

const PHI = 1.6180339887;

/**
 * Calculate a φ-scaled delay with randomized jitter.
 *
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @param {number} baseMs - Base delay in milliseconds (default: 1000)
 * @param {number} maxMs - Maximum delay cap (default: 30000)
 * @param {number} jitterFactor - Jitter range as fraction of delay (default: 0.25)
 * @returns {number} Delay in milliseconds
 */
function phiDelay(attempt, baseMs = 1000, maxMs = 30000, jitterFactor = 0.25) {
    // Core delay: baseMs × φ^attempt
    const raw = baseMs * Math.pow(PHI, attempt);

    // Randomized jitter to prevent thundering herd
    // Range: [delay × (1 - jitter), delay × (1 + jitter)]
    const jitter = raw * jitterFactor * (2 * Math.random() - 1);

    return Math.min(Math.round(raw + jitter), maxMs);
}

/**
 * Execute an async function with φ-scaled exponential backoff.
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} opts - Options
 * @param {number} opts.maxRetries - Maximum number of retries (default: 5)
 * @param {number} opts.baseMs - Base delay in milliseconds (default: 1000)
 * @param {number} opts.maxDelayMs - Maximum delay cap (default: 30000)
 * @param {number} opts.jitterFactor - Jitter range fraction (default: 0.25)
 * @param {Function} opts.onRetry - Callback(attempt, delayMs, error) on each retry
 * @param {Function} opts.shouldRetry - Predicate(error) to decide if retry is warranted (default: always true)
 * @param {Function} opts.onGiveUp - Callback(error, attempts) when all retries exhausted
 * @returns {Promise<any>} Result of fn()
 */
async function withBackoff(fn, opts = {}) {
    const {
        maxRetries = 5,
        baseMs = 1000,
        maxDelayMs = 30000,
        jitterFactor = 0.25,
        onRetry = null,
        shouldRetry = () => true,
        onGiveUp = null,
    } = opts;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;

            // Check if this error is retryable
            if (!shouldRetry(err)) throw err;

            // Last attempt — no more retries
            if (attempt >= maxRetries) break;

            // Calculate φ-scaled delay
            const delay = phiDelay(attempt, baseMs, maxDelayMs, jitterFactor);

            if (onRetry) onRetry(attempt + 1, delay, err);

            // Wait the φ-scaled delay
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    if (onGiveUp) onGiveUp(lastError, maxRetries + 1);
    throw lastError;
}

/**
 * Create a backoff-wrapped version of any async function.
 * Returns a new function that automatically retries on failure.
 *
 * @param {Function} fn - The function to wrap
 * @param {Object} opts - Backoff options (same as withBackoff)
 * @returns {Function} Wrapped function with automatic retry
 */
function createResilientFn(fn, opts = {}) {
    return (...args) => withBackoff(() => fn(...args), opts);
}

/**
 * Delay table — preview the φ-based delay curve for debugging.
 * @param {number} maxAttempts - How many attempts to show
 * @param {number} baseMs - Base delay
 * @returns {Array<{attempt, delayMs, delaySec}>}
 */
function delayTable(maxAttempts = 8, baseMs = 1000) {
    const table = [];
    for (let i = 0; i < maxAttempts; i++) {
        const raw = Math.round(baseMs * Math.pow(PHI, i));
        table.push({
            attempt: i,
            delayMs: raw,
            delaySec: +(raw / 1000).toFixed(2),
            formula: `${baseMs} × φ^${i}`,
        });
    }
    return table;
}

module.exports = {
    PHI,
    phiDelay,
    withBackoff,
    createResilientFn,
    delayTable,
};

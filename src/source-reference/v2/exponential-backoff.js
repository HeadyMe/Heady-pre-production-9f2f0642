/**
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Heady Exponential Backoff — φ-Scaled Resilience ═══
 *
 * Unlike traditional base-2 exponential backoff (1s, 2s, 4s, 8s...),
 * Heady uses the Golden Ratio (φ = 1.618...) for delay scaling.
 */

const PHI = 1.6180339887;

function normalizePositiveNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

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
    const safeAttempt = Math.max(0, Math.floor(Number(attempt) || 0));
    const safeBaseMs = normalizePositiveNumber(baseMs, 1000);
    const safeMaxMs = Math.max(1, Math.floor(normalizePositiveNumber(maxMs, 30000)));
    const safeJitter = Math.min(1, Math.max(0, Number(jitterFactor) || 0));

    const raw = safeBaseMs * Math.pow(PHI, safeAttempt);
    const jitter = raw * safeJitter * (2 * Math.random() - 1);
    const delayed = Math.round(raw + jitter);

    return Math.max(1, Math.min(delayed, safeMaxMs));
}

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

    const safeRetries = Math.max(0, Math.floor(Number(maxRetries) || 0));
    let lastError;

    for (let attempt = 0; attempt <= safeRetries; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;

            if (!shouldRetry(err)) throw err;
            if (attempt >= safeRetries) break;

            const delay = phiDelay(attempt, baseMs, maxDelayMs, jitterFactor);

            if (onRetry) onRetry(attempt + 1, delay, err);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    if (onGiveUp) onGiveUp(lastError, safeRetries + 1);
    throw lastError;
}

function createResilientFn(fn, opts = {}) {
    return (...args) => withBackoff(() => fn(...args), opts);
}

function delayTable(maxAttempts = 8, baseMs = 1000) {
    const safeAttempts = Math.max(0, Math.floor(Number(maxAttempts) || 0));
    const safeBaseMs = normalizePositiveNumber(baseMs, 1000);

    const table = [];
    for (let i = 0; i < safeAttempts; i++) {
        const raw = Math.round(safeBaseMs * Math.pow(PHI, i));
        table.push({
            attempt: i,
            delayMs: raw,
            delaySec: +(raw / 1000).toFixed(2),
            formula: `${safeBaseMs} × φ^${i}`,
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

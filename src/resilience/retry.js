/**
 * Heady Retry — Exponential backoff with jitter
 * Use with circuit breakers for resilient external calls.
 */

const DEFAULT_OPTIONS = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    jitter: true,
    retryableErrors: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN'],
    retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - async function to retry
 * @param {Object} [options] - retry options
 * @returns {Promise<any>}
 */
async function retry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;

            if (attempt === opts.maxAttempts) break;

            // Check if error is retryable
            const isRetryable =
                opts.retryableErrors.includes(err.code) ||
                opts.retryableStatusCodes.includes(err.status || err.statusCode) ||
                err.message?.includes('timeout') ||
                err.message?.includes('ECONNREFUSED');

            if (!isRetryable) throw err;

            // Exponential backoff with optional jitter
            let delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs);
            if (opts.jitter) {
                delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of computed delay
            }

            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw lastError;
}

module.exports = { retry, DEFAULT_OPTIONS };

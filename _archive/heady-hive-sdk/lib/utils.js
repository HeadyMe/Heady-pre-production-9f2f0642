/**
 * Shared utilities for Heady Hive SDK
 */

/** Retry with exponential backoff */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try { return await fn(); }
        catch (err) {
            if (attempt === maxAttempts) throw err;
            await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
        }
    }
}

/** Rate limiter (token bucket) */
class RateLimiter {
    constructor(maxTokens = 10, refillRate = 1) {
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.refillRate = refillRate;
        this.lastRefill = Date.now();
    }
    async acquire() {
        this._refill();
        if (this.tokens < 1) {
            const waitMs = (1 / this.refillRate) * 1000;
            await new Promise(r => setTimeout(r, waitMs));
            this._refill();
        }
        this.tokens--;
    }
    _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}

/** Format bytes for display */
function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

module.exports = { retry, RateLimiter, formatBytes };

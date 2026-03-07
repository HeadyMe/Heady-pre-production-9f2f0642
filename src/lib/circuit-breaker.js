/**
 * E12: Circuit Breaker + Rate Limiter for MCP
 * @module src/lib/circuit-breaker
 */
'use strict';

const STATES = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };

class CircuitBreaker {
    constructor(opts = {}) {
        this.failureThreshold = opts.failureThreshold || 5;
        this.recoveryTimeout = opts.recoveryTimeout || 30000;
        this.halfOpenMaxCalls = opts.halfOpenMaxCalls || 3;
        this.state = STATES.CLOSED;
        this._failures = 0;
        this._successes = 0;
        this._lastFailureTime = 0;
        this._halfOpenCalls = 0;
    }

    async execute(fn) {
        if (this.state === STATES.OPEN) {
            if (Date.now() - this._lastFailureTime >= this.recoveryTimeout) {
                this.state = STATES.HALF_OPEN;
                this._halfOpenCalls = 0;
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        if (this.state === STATES.HALF_OPEN && this._halfOpenCalls >= this.halfOpenMaxCalls) {
            throw new Error('Circuit breaker HALF_OPEN limit reached');
        }

        try {
            if (this.state === STATES.HALF_OPEN) this._halfOpenCalls++;
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure();
            throw err;
        }
    }

    _onSuccess() {
        this._failures = 0;
        this._successes++;
        if (this.state === STATES.HALF_OPEN) this.state = STATES.CLOSED;
    }

    _onFailure() {
        this._failures++;
        this._lastFailureTime = Date.now();
        if (this._failures >= this.failureThreshold) this.state = STATES.OPEN;
    }

    getState() {
        return { state: this.state, failures: this._failures, successes: this._successes };
    }

    reset() { this.state = STATES.CLOSED; this._failures = 0; this._successes = 0; }
}

class TokenBucketRateLimiter {
    constructor(opts = {}) {
        this.rate = opts.rate || 100;
        this.burst = opts.burst || 20;
        this._buckets = new Map();
    }

    consume(key, tokens = 1) {
        const now = Date.now();
        let bucket = this._buckets.get(key);
        if (!bucket) {
            bucket = { tokens: this.burst, lastRefill: now };
            this._buckets.set(key, bucket);
        }
        const elapsed = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed * this.rate);
        bucket.lastRefill = now;
        if (bucket.tokens < tokens) return { allowed: false, retryAfter: Math.ceil((tokens - bucket.tokens) / this.rate) };
        bucket.tokens -= tokens;
        return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    middleware(keyFn) {
        return (req, res, next) => {
            const key = keyFn ? keyFn(req) : req.ip;
            const result = this.consume(key);
            if (!result.allowed) {
                res.set('Retry-After', String(result.retryAfter));
                return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: result.retryAfter });
            }
            res.set('X-RateLimit-Remaining', String(result.remaining));
            next();
        };
    }
}

module.exports = { CircuitBreaker, TokenBucketRateLimiter, STATES };

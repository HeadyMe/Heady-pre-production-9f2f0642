'use strict';

/**
 * Circuit Breaker — Resilience Pattern
 * Netflix Hystrix-inspired circuit breaker for service calls.
 * 
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 * When error rate exceeds threshold, circuit opens and fails fast.
 */

const logger = require('../utils/logger');

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
    constructor(name, opts = {}) {
        this.name = name;
        this.state = STATES.CLOSED;
        this.failureThreshold = opts.failureThreshold || 5;
        this.successThreshold = opts.successThreshold || 3;
        this.timeout = opts.timeout || 30000;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.totalCalls = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
    }

    async exec(fn) {
        this.totalCalls++;

        if (this.state === STATES.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.timeout) {
                this.state = STATES.HALF_OPEN;
                this.successCount = 0;
            } else {
                throw new Error(`Circuit breaker [${this.name}] is OPEN. Failing fast.`);
            }
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
        this.totalSuccesses++;
        if (this.state === STATES.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.state = STATES.CLOSED;
                this.failureCount = 0;
                logger.logSystem(`🔌 [CB:${this.name}] Circuit CLOSED — service recovered`);
            }
        }
        this.failureCount = 0;
    }

    _onFailure() {
        this.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = STATES.OPEN;
            logger.warn(`⚡ [CB:${this.name}] Circuit OPENED — ${this.failureCount} consecutive failures`);
        }
    }

    getStatus() {
        return {
            name: this.name, state: this.state,
            failureCount: this.failureCount, successCount: this.successCount,
            totalCalls: this.totalCalls, totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
        };
    }

    reset() {
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
    }
}

class Bulkhead {
    constructor(name, maxConcurrent = 10) {
        this.name = name;
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        this.rejected = 0;
    }

    async exec(fn) {
        if (this.active >= this.maxConcurrent) {
            this.rejected++;
            throw new Error(`Bulkhead [${this.name}] full: ${this.active}/${this.maxConcurrent} active`);
        }
        this.active++;
        try { return await fn(); } finally { this.active--; }
    }

    getStatus() {
        return { name: this.name, active: this.active, max: this.maxConcurrent, rejected: this.rejected };
    }
}

const _breakers = new Map();
function getCircuitBreaker(name, opts) {
    if (!_breakers.has(name)) _breakers.set(name, new CircuitBreaker(name, opts));
    return _breakers.get(name);
}

function getAllBreakerStatus() {
    return [..._breakers.entries()].map(([name, cb]) => cb.getStatus());
}

module.exports = { CircuitBreaker, Bulkhead, getCircuitBreaker, getAllBreakerStatus, STATES };

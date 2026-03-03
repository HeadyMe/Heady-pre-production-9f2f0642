/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Circuit Breaker — Resilience primitive
 * Prevents cascade failures by tracking error rates per service
 * and opening the circuit when thresholds are exceeded.
 *
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeoutMs = options.resetTimeoutMs || 30000;
        this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
        this.monitorWindowMs = options.monitorWindowMs || 60000;

        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.halfOpenCalls = 0;
        this.lastFailureTime = null;
        this.lastStateChange = Date.now();
        this.metrics = { totalCalls: 0, totalFailures: 0, totalSuccesses: 0, trips: 0 };
    }

    /**
     * Execute a function through the circuit breaker
     * @param {Function} fn - async function to execute
     * @param {Function} [fallback] - optional fallback when circuit is open
     * @returns {Promise<any>} result
     */
    async execute(fn, fallback) {
        this.metrics.totalCalls++;

        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
                this._transition('HALF_OPEN');
            } else {
                if (fallback) return fallback();
                throw new CircuitOpenError(`Circuit "${this.name}" is OPEN — ${this.failures} failures in window`);
            }
        }

        if (this.state === 'HALF_OPEN') {
            this.halfOpenCalls++;
            if (this.halfOpenCalls > this.halfOpenMaxCalls) {
                this._transition('OPEN');
                if (fallback) return fallback();
                throw new CircuitOpenError(`Circuit "${this.name}" re-opened after half-open probe failures`);
            }
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure();
            if (this.state === 'OPEN' && fallback) return fallback();
            throw err;
        }
    }

    _onSuccess() {
        this.successes++;
        this.metrics.totalSuccesses++;
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.halfOpenMaxCalls) {
                this._transition('CLOSED');
            }
        } else {
            this.failures = Math.max(0, this.failures - 1); // decay on success
        }
    }

    _onFailure() {
        this.failures++;
        this.metrics.totalFailures++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            this._transition('OPEN');
        } else if (this.failures >= this.failureThreshold) {
            this._transition('OPEN');
        }
    }

    _transition(newState) {
        const old = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();
        if (newState === 'OPEN') this.metrics.trips++;
        if (newState === 'CLOSED') { this.failures = 0; this.successes = 0; }
        if (newState === 'HALF_OPEN') { this.halfOpenCalls = 0; this.successes = 0; }
        // Emit for HeadyLens
        if (typeof process !== 'undefined') {
            process.emit('heady:circuit', { breaker: this.name, from: old, to: newState, time: new Date().toISOString() });
        }
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            lastStateChange: new Date(this.lastStateChange).toISOString(),
            metrics: { ...this.metrics }
        };
    }

    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.halfOpenCalls = 0;
    }
}

class CircuitOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitOpenError';
        this.isCircuitOpen = true;
    }
}

// ─── Circuit Breaker Registry ──────────────────────────────────────
// One breaker per service, accessible globally
const breakers = new Map();

function getBreaker(name, options) {
    if (!breakers.has(name)) {
        breakers.set(name, new CircuitBreaker(name, options));
    }
    return breakers.get(name);
}

function getAllBreakers() {
    const result = {};
    for (const [name, cb] of breakers) {
        result[name] = cb.getStatus();
    }
    return result;
}

// Pre-register breakers for all critical services (as recommended by registry)
const CRITICAL_SERVICES = [
    'brain', 'soul', 'conductor', 'hcfp', 'patterns',
    'ops', 'maintenance', 'registry', 'auto-success', 'cloud',
    'edge-ai', 'headyjules', 'codex', 'headypythia', 'perplexity', 'grok'
];

for (const svc of CRITICAL_SERVICES) {
    getBreaker(svc, {
        failureThreshold: svc === 'cloud' ? 3 : 5,
        resetTimeoutMs: svc === 'brain' ? 15000 : 30000,
    });
}

module.exports = { CircuitBreaker, CircuitOpenError, getBreaker, getAllBreakers, CRITICAL_SERVICES };

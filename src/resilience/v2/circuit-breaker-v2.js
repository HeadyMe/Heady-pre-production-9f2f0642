'use strict';

/**
 * circuit-breaker-v2.js — Enhanced Circuit Breaker
 *
 * Changes from v1:
 *  - Sliding window error-rate calculation (replaces consecutive-failure counter)
 *  - Single-probe HALF_OPEN guard (prevents concurrent probe storm on recovery)
 *  - Per-instance p50/p99 latency tracking; circuit trips on latency SLA breach
 *  - Cascading failure detection via BreakerRegistry (emits 'cascade-alert')
 *  - Prometheus-compatible metrics export
 *  - Explicit cascade-aware Bulkhead integration
 *
 * @module circuit-breaker-v2
 */

const { EventEmitter } = require('events');
const logger = require('../utils/logger');

// ─── State constants ───────────────────────────────────────────────────────────

/** @enum {string} */
const STATES = Object.freeze({
    CLOSED:    'CLOSED',
    OPEN:      'OPEN',
    HALF_OPEN: 'HALF_OPEN',
});

// ─── Rolling window helpers ────────────────────────────────────────────────────

/**
 * A fixed-size ring buffer of timestamped outcome slots.
 * Used for sliding-window error-rate calculation.
 * @private
 */
class SlidingWindow {
    /**
     * @param {number} windowSizeMs  - Rolling window duration in milliseconds
     * @param {number} minCalls      - Minimum calls before error rate is evaluated
     */
    constructor(windowSizeMs = 10_000, minCalls = 10) {
        this.windowSizeMs = windowSizeMs;
        this.minCalls = minCalls;
        /** @type {Array<{ts: number, success: boolean, durationMs: number}>} */
        this._calls = [];
    }

    /** Record a completed call outcome. */
    record(success, durationMs = 0) {
        const now = Date.now();
        this._calls.push({ ts: now, success, durationMs });
        this._evict(now);
    }

    /** Remove entries outside the rolling window. */
    _evict(now = Date.now()) {
        const cutoff = now - this.windowSizeMs;
        let i = 0;
        while (i < this._calls.length && this._calls[i].ts < cutoff) i++;
        if (i > 0) this._calls.splice(0, i);
    }

    /** @returns {{ total: number, failures: number, errorRate: number, p50Ms: number, p99Ms: number }} */
    stats() {
        this._evict();
        const calls = this._calls;
        const total = calls.length;
        if (total === 0) return { total: 0, failures: 0, errorRate: 0, p50Ms: 0, p99Ms: 0 };

        let failures = 0;
        const durations = [];
        for (const c of calls) {
            if (!c.success) failures++;
            durations.push(c.durationMs);
        }
        durations.sort((a, b) => a - b);

        const p50Ms = durations[Math.floor(durations.length * 0.5)] ?? 0;
        const p99Ms = durations[Math.floor(durations.length * 0.99)] ?? 0;

        return {
            total,
            failures,
            errorRate: failures / total,
            p50Ms,
            p99Ms,
        };
    }

    /** True if we have enough calls to make a decision. */
    hasSufficientCalls() {
        this._evict();
        return this._calls.length >= this.minCalls;
    }
}

// ─── CircuitBreaker v2 ─────────────────────────────────────────────────────────

/**
 * Enhanced Circuit Breaker with sliding window, latency SLA tripping,
 * and single-probe HALF_OPEN guard.
 *
 * @extends EventEmitter
 */
class CircuitBreaker extends EventEmitter {
    /**
     * @param {string} name
     * @param {object} [opts]
     * @param {number} [opts.errorRateThreshold=0.5]   - Error rate (0-1) that trips the breaker
     * @param {number} [opts.windowSizeMs=10000]        - Sliding window size in ms
     * @param {number} [opts.minCalls=10]               - Min calls before tripping
     * @param {number} [opts.openDurationMs=30000]      - How long the circuit stays OPEN
     * @param {number} [opts.successThreshold=3]        - Successes in HALF_OPEN to close
     * @param {number} [opts.latencySlaMs=null]         - If p99 exceeds this, trip the circuit
     * @param {BreakerRegistry} [opts.registry]         - Optional registry for cascade detection
     */
    constructor(name, opts = {}) {
        super();
        this.name                = name;
        this.state               = STATES.CLOSED;

        // Configuration
        this.errorRateThreshold  = opts.errorRateThreshold ?? 0.5;
        this.openDurationMs      = opts.openDurationMs     ?? 30_000;
        this.successThreshold    = opts.successThreshold   ?? 3;
        this.latencySlaMs        = opts.latencySlaMs       ?? null;

        this._window = new SlidingWindow(
            opts.windowSizeMs ?? 10_000,
            opts.minCalls     ?? 10
        );

        // HALF_OPEN single-probe guard
        this._probing        = false;
        this._probeSuccess   = 0;

        // OPEN state timestamp
        this._openedAt       = null;

        // Cumulative counters for observability
        this.metrics = {
            totalCalls:       0,
            totalSuccesses:   0,
            totalFailures:    0,
            totalRejected:    0,  // failed-fast while OPEN
            stateTransitions: [],
        };

        this._registry = opts.registry || null;
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    /**
     * Execute a function guarded by the circuit breaker.
     *
     * @param {() => Promise<any>} fn
     * @returns {Promise<any>}
     * @throws {CircuitOpenError} if the circuit is OPEN and timeout has not elapsed
     */
    async exec(fn) {
        this.metrics.totalCalls++;

        // ── OPEN state ───────────────────────────────────────────────────────
        if (this.state === STATES.OPEN) {
            if (Date.now() - this._openedAt >= this.openDurationMs) {
                // Transition to HALF_OPEN — only if not already probing
                if (!this._probing) {
                    this._transition(STATES.HALF_OPEN);
                } else {
                    // Another request is already probing; fail-fast this one
                    this.metrics.totalRejected++;
                    throw new CircuitOpenError(
                        `[CB:${this.name}] OPEN — probe in progress, failing fast`
                    );
                }
            } else {
                this.metrics.totalRejected++;
                throw new CircuitOpenError(
                    `[CB:${this.name}] OPEN — failing fast (${Math.round((this.openDurationMs - (Date.now() - this._openedAt)) / 1000)}s remaining)`
                );
            }
        }

        // ── HALF_OPEN state ──────────────────────────────────────────────────
        if (this.state === STATES.HALF_OPEN) {
            if (this._probing) {
                // Already running a probe — fail-fast concurrent callers
                this.metrics.totalRejected++;
                throw new CircuitOpenError(
                    `[CB:${this.name}] HALF_OPEN — probe in progress, failing fast`
                );
            }
            this._probing = true;
        }

        // ── Execute ──────────────────────────────────────────────────────────
        const startMs = Date.now();
        try {
            const result = await fn();
            const durationMs = Date.now() - startMs;
            this._onSuccess(durationMs);
            return result;
        } catch (err) {
            const durationMs = Date.now() - startMs;
            this._onFailure(durationMs);
            throw err;
        } finally {
            if (this.state === STATES.HALF_OPEN) {
                this._probing = false;
            }
        }
    }

    // ─── State machine ─────────────────────────────────────────────────────────

    /** @private */
    _onSuccess(durationMs) {
        this.metrics.totalSuccesses++;
        this._window.record(true, durationMs);

        if (this.state === STATES.HALF_OPEN) {
            this._probeSuccess++;
            if (this._probeSuccess >= this.successThreshold) {
                this._transition(STATES.CLOSED);
            }
        } else if (this.state === STATES.CLOSED) {
            // Even in CLOSED, check latency SLA
            if (this.latencySlaMs !== null) {
                const { p99Ms } = this._window.stats();
                if (p99Ms > this.latencySlaMs && this._window.hasSufficientCalls()) {
                    logger.warn(`[CB:${this.name}] Latency SLA breached: p99=${p99Ms}ms > ${this.latencySlaMs}ms`);
                    this.emit('latency-sla-breach', { name: this.name, p99Ms, slaMs: this.latencySlaMs });
                    this._tripOpen('latency-sla-breach');
                }
            }
        }
    }

    /** @private */
    _onFailure(durationMs) {
        this.metrics.totalFailures++;
        this._window.record(false, durationMs);

        if (this.state === STATES.HALF_OPEN) {
            // Probe failed — re-open immediately
            this._probeSuccess = 0;
            this._tripOpen('half-open-probe-failure');
            return;
        }

        if (this.state === STATES.CLOSED && this._window.hasSufficientCalls()) {
            const { errorRate } = this._window.stats();
            if (errorRate >= this.errorRateThreshold) {
                logger.warn(`[CB:${this.name}] Error rate ${(errorRate * 100).toFixed(1)}% >= threshold ${(this.errorRateThreshold * 100).toFixed(1)}%`);
                this._tripOpen('error-rate-threshold');
            }
        }
    }

    /** @private */
    _tripOpen(reason) {
        this._transition(STATES.OPEN, reason);
        this._openedAt = Date.now();
        if (this._registry) {
            this._registry._notifyOpen(this.name);
        }
    }

    /** @private */
    _transition(newState, reason = '') {
        const prev = this.state;
        this.state = newState;
        this.metrics.stateTransitions.push({
            from: prev, to: newState, at: new Date().toISOString(), reason
        });

        if (newState === STATES.CLOSED) {
            this._probeSuccess = 0;
            this._window = new SlidingWindow(this._window.windowSizeMs, this._window.minCalls);
            logger.info(`[CB:${this.name}] CLOSED — service recovered`);
            this.emit('state-change', { name: this.name, state: newState });
        } else if (newState === STATES.OPEN) {
            logger.warn(`[CB:${this.name}] OPEN — reason: ${reason}`);
            this.emit('state-change', { name: this.name, state: newState, reason });
        } else if (newState === STATES.HALF_OPEN) {
            this._probeSuccess = 0;
            logger.info(`[CB:${this.name}] HALF_OPEN — probing recovery`);
            this.emit('state-change', { name: this.name, state: newState });
        }
    }

    // ─── Observability ─────────────────────────────────────────────────────────

    /** @returns {object} Full status snapshot suitable for dashboards */
    getStatus() {
        const windowStats = this._window.stats();
        return {
            name:              this.name,
            state:             this.state,
            errorRateThreshold:this.errorRateThreshold,
            openedAt:          this._openedAt ? new Date(this._openedAt).toISOString() : null,
            window:            windowStats,
            metrics:           { ...this.metrics, stateTransitions: this.metrics.stateTransitions.slice(-10) },
            config: {
                windowSizeMs:     this._window.windowSizeMs,
                minCalls:         this._window.minCalls,
                openDurationMs:   this.openDurationMs,
                successThreshold: this.successThreshold,
                latencySlaMs:     this.latencySlaMs,
            },
        };
    }

    /** Prometheus text-format metrics snippet. */
    prometheusMetrics() {
        const s = this.getStatus();
        const stateValue = s.state === STATES.CLOSED ? 0 : s.state === STATES.OPEN ? 1 : 2;
        const label = `name="${this.name}"`;
        return [
            `circuit_breaker_state{${label}} ${stateValue}`,
            `circuit_breaker_calls_total{${label}} ${s.metrics.totalCalls}`,
            `circuit_breaker_failures_total{${label}} ${s.metrics.totalFailures}`,
            `circuit_breaker_rejected_total{${label}} ${s.metrics.totalRejected}`,
            `circuit_breaker_error_rate{${label}} ${(s.window.errorRate ?? 0).toFixed(4)}`,
            `circuit_breaker_p99_ms{${label}} ${s.window.p99Ms ?? 0}`,
        ].join('\n');
    }

    /** Manual reset (use sparingly — prefer letting the state machine self-recover). */
    reset() {
        this._transition(STATES.CLOSED, 'manual-reset');
        this._openedAt = null;
    }
}

// ─── CircuitOpenError ──────────────────────────────────────────────────────────

/** Thrown when exec() is called on an OPEN circuit. */
class CircuitOpenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitOpenError';
        this.code = 'CIRCUIT_OPEN';
    }
}

// ─── Bulkhead v2 ───────────────────────────────────────────────────────────────

/**
 * Bulkhead isolation pattern.
 * Limits concurrent executions; integrates with the circuit breaker registry
 * to back-pressure cascade detection.
 */
class Bulkhead {
    /**
     * @param {string} name
     * @param {number} [maxConcurrent=10]
     * @param {number} [queueSize=0]  - 0 = no queue (reject immediately)
     */
    constructor(name, maxConcurrent = 10, queueSize = 0) {
        this.name          = name;
        this.maxConcurrent = maxConcurrent;
        this.queueSize     = queueSize;
        this.active        = 0;
        this._queue        = [];
        this.metrics = { active: 0, rejected: 0, queued: 0, completed: 0 };
    }

    async exec(fn) {
        if (this.active < this.maxConcurrent) {
            return this._run(fn);
        }
        if (this.queueSize > 0 && this._queue.length < this.queueSize) {
            return new Promise((resolve, reject) => {
                this._queue.push({ fn, resolve, reject });
                this.metrics.queued++;
            });
        }
        this.metrics.rejected++;
        throw new BulkheadRejectedError(`Bulkhead [${this.name}] full: ${this.active}/${this.maxConcurrent} active`);
    }

    async _run(fn) {
        this.active++;
        this.metrics.active = this.active;
        try {
            return await fn();
        } finally {
            this.active--;
            this.metrics.active = this.active;
            this.metrics.completed++;
            this._drain();
        }
    }

    _drain() {
        if (this._queue.length > 0 && this.active < this.maxConcurrent) {
            const { fn, resolve, reject } = this._queue.shift();
            this._run(fn).then(resolve).catch(reject);
        }
    }

    getStatus() {
        return { name: this.name, active: this.active, max: this.maxConcurrent, metrics: { ...this.metrics } };
    }
}

class BulkheadRejectedError extends Error {
    constructor(msg) { super(msg); this.name = 'BulkheadRejectedError'; }
}

// ─── BreakerRegistry ──────────────────────────────────────────────────────────

/**
 * Central registry for all circuit breakers.
 * Detects cascading failures when multiple breakers open within a time window.
 *
 * @extends EventEmitter
 */
class BreakerRegistry extends EventEmitter {
    /**
     * @param {object} [opts]
     * @param {number} [opts.cascadeThreshold=3]    - Number of open breakers that triggers cascade alert
     * @param {number} [opts.cascadeWindowMs=30000] - Time window for cascade detection
     */
    constructor(opts = {}) {
        super();
        this._breakers           = new Map();
        this.cascadeThreshold    = opts.cascadeThreshold  ?? 3;
        this.cascadeWindowMs     = opts.cascadeWindowMs   ?? 30_000;
        this._recentOpenings     = []; // { name, ts }
        this._cascadeAlertActive = false;
    }

    /**
     * Register or retrieve a circuit breaker.
     * @param {string} name
     * @param {object} [opts] - CircuitBreaker constructor options
     * @returns {CircuitBreaker}
     */
    get(name, opts = {}) {
        if (!this._breakers.has(name)) {
            const cb = new CircuitBreaker(name, { ...opts, registry: this });
            this._breakers.set(name, cb);
        }
        return this._breakers.get(name);
    }

    /**
     * Called by a CircuitBreaker when it opens.
     * @private
     */
    _notifyOpen(name) {
        const now = Date.now();
        const cutoff = now - this.cascadeWindowMs;
        this._recentOpenings = this._recentOpenings.filter(o => o.ts > cutoff);
        this._recentOpenings.push({ name, ts: now });

        const openCount = this._recentOpenings.length;
        if (openCount >= this.cascadeThreshold && !this._cascadeAlertActive) {
            this._cascadeAlertActive = true;
            const affectedBreakers = this._recentOpenings.map(o => o.name);
            logger.warn(`[BreakerRegistry] CASCADE ALERT — ${openCount} breakers opened within ${this.cascadeWindowMs}ms`, { affectedBreakers });
            this.emit('cascade-alert', {
                count:            openCount,
                affectedBreakers,
                windowMs:         this.cascadeWindowMs,
                detectedAt:       new Date().toISOString(),
            });
            // Auto-clear alert after the window
            setTimeout(() => {
                this._cascadeAlertActive = false;
                this.emit('cascade-resolved', { affectedBreakers });
            }, this.cascadeWindowMs);
        }
    }

    /** @returns {object[]} Status of all registered breakers */
    getAllStatus() {
        return [...this._breakers.values()].map(cb => cb.getStatus());
    }

    /** @returns {string} Prometheus text format for all breakers */
    prometheusMetrics() {
        return [...this._breakers.values()].map(cb => cb.prometheusMetrics()).join('\n');
    }
}

// ─── Module-level default registry ────────────────────────────────────────────

const _defaultRegistry = new BreakerRegistry();

/**
 * Get or create a circuit breaker from the default registry.
 * @param {string} name
 * @param {object} [opts]
 * @returns {CircuitBreaker}
 */
function getCircuitBreaker(name, opts) {
    return _defaultRegistry.get(name, opts);
}

/**
 * Get status of all breakers in the default registry.
 * @returns {object[]}
 */
function getAllBreakerStatus() {
    return _defaultRegistry.getAllStatus();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    CircuitBreaker,
    CircuitOpenError,
    Bulkhead,
    BulkheadRejectedError,
    BreakerRegistry,
    SlidingWindow,
    STATES,
    getCircuitBreaker,
    getAllBreakerStatus,
    defaultRegistry: _defaultRegistry,
};

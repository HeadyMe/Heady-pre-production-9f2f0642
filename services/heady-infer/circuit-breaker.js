'use strict';

const EventEmitter = require('events');

/**
 * CircuitBreaker — Per-provider fault isolation with PHI-scaled backoff.
 *
 * States:
 *   CLOSED    — Normal operation. All requests pass through.
 *   OPEN      — Failures exceeded threshold. Requests fail fast.
 *   HALF_OPEN — Recovery probe. Limited requests allowed to test provider health.
 *
 * Events:
 *   'stateChange' (providerId, fromState, toState)
 *   'failure'     (providerId, error)
 *   'success'     (providerId)
 *   'open'        (providerId)
 *   'close'       (providerId)
 *   'halfOpen'    (providerId)
 */

const STATES = {
  CLOSED:    'CLOSED',
  OPEN:      'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class ProviderCircuit {
  constructor(providerId, options = {}) {
    this.providerId        = providerId;
    this.failureThreshold  = options.failureThreshold  || 5;
    this.successThreshold  = options.successThreshold  || 2;
    this.timeout           = options.timeout           || 60000;   // ms before HALF_OPEN
    this.halfOpenProbeMax  = options.halfOpenProbeMax  || 3;
    this.phiBackoffBase    = options.phiBackoffBase    || 5000;
    this.phiBackoffMax     = options.phiBackoffMax     || 300000;
    this.phi               = 1.618033988749895;

    this._state            = STATES.CLOSED;
    this._failures         = 0;
    this._successes        = 0;
    this._halfOpenProbes   = 0;
    this._openedAt         = null;
    this._consecutiveFails = 0;
    this._openCount        = 0;    // how many times we've opened

    // Rolling window for failure rate (60s window)
    this._failureWindow    = [];
    this._windowDurationMs = options.windowDurationMs || 60000;
  }

  get state() { return this._state; }

  /**
   * Check if circuit allows a request through.
   * @throws {CircuitOpenError} if OPEN
   */
  allowRequest() {
    this._purgeOldFailures();

    if (this._state === STATES.CLOSED) return true;

    if (this._state === STATES.OPEN) {
      const elapsed = Date.now() - this._openedAt;
      const backoff  = this._calcBackoff();

      if (elapsed >= backoff) {
        this._transitionTo(STATES.HALF_OPEN);
        this._halfOpenProbes = 0;
        this._successes      = 0;
        return true;
      }

      const err = new Error(`Circuit OPEN for ${this.providerId} — retry in ${Math.round((backoff - elapsed) / 1000)}s`);
      err.name        = 'CircuitOpenError';
      err.provider    = this.providerId;
      err.retryAfterMs = backoff - elapsed;
      throw err;
    }

    if (this._state === STATES.HALF_OPEN) {
      if (this._halfOpenProbes < this.halfOpenProbeMax) {
        this._halfOpenProbes++;
        return true;
      }
      // All probes in-flight — block until result
      const err = new Error(`Circuit HALF_OPEN for ${this.providerId} — probes exhausted`);
      err.name     = 'CircuitOpenError';
      err.provider = this.providerId;
      throw err;
    }

    return true;
  }

  /**
   * Record a successful request.
   */
  onSuccess() {
    this._consecutiveFails = 0;

    if (this._state === STATES.HALF_OPEN) {
      this._successes++;
      if (this._successes >= this.successThreshold) {
        this._transitionTo(STATES.CLOSED);
        this._failures = 0;
      }
    } else if (this._state === STATES.CLOSED) {
      // Decay failures on success
      if (this._failures > 0) this._failures--;
    }
  }

  /**
   * Record a failed request.
   */
  onFailure(error) {
    this._consecutiveFails++;
    this._failureWindow.push(Date.now());
    this._purgeOldFailures();
    this._failures = this._failureWindow.length;

    if (this._state === STATES.HALF_OPEN) {
      // Any failure in HALF_OPEN re-opens immediately
      this._open();
      return;
    }

    if (this._state === STATES.CLOSED && this._failures >= this.failureThreshold) {
      this._open();
    }
  }

  _open() {
    this._openedAt  = Date.now();
    this._openCount++;
    this._transitionTo(STATES.OPEN);
  }

  _transitionTo(newState) {
    const oldState = this._state;
    this._state    = newState;
    this.emit('stateChange', this.providerId, oldState, newState);
    if (newState === STATES.OPEN)      this.emit('open',     this.providerId);
    if (newState === STATES.CLOSED)    this.emit('close',    this.providerId);
    if (newState === STATES.HALF_OPEN) this.emit('halfOpen', this.providerId);
  }

  /**
   * PHI-scaled exponential backoff.
   * backoff = min(base * phi^openCount, max)
   */
  _calcBackoff() {
    return Math.min(
      this.phiBackoffBase * Math.pow(this.phi, this._openCount - 1),
      this.phiBackoffMax
    );
  }

  _purgeOldFailures() {
    const cutoff = Date.now() - this._windowDurationMs;
    this._failureWindow = this._failureWindow.filter(t => t > cutoff);
  }

  getStats() {
    return {
      state:            this._state,
      failures:         this._failures,
      successes:        this._successes,
      consecutiveFails: this._consecutiveFails,
      openCount:        this._openCount,
      openedAt:         this._openedAt,
      backoffMs:        this._state === STATES.OPEN ? this._calcBackoff() : 0,
    };
  }

  // Manually reset (useful for testing / admin override)
  reset() {
    this._state            = STATES.CLOSED;
    this._failures         = 0;
    this._successes        = 0;
    this._halfOpenProbes   = 0;
    this._openedAt         = null;
    this._consecutiveFails = 0;
    this._failureWindow    = [];
    this.emit('stateChange', this.providerId, 'any', STATES.CLOSED);
  }
}

// Mixin EventEmitter manually so ProviderCircuit can emit events
Object.assign(ProviderCircuit.prototype, EventEmitter.prototype);

/**
 * CircuitBreakerManager — Manages per-provider circuit breakers.
 */
class CircuitBreakerManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options  = options;
    this._circuits = new Map();
  }

  /**
   * Get (or create) circuit for a provider.
   * @param {string} providerId
   * @returns {ProviderCircuit}
   */
  getCircuit(providerId) {
    if (!this._circuits.has(providerId)) {
      const circuit = new ProviderCircuit(providerId, this.options);
      // Bubble up events
      circuit.on('stateChange', (pid, from, to) => this.emit('stateChange', pid, from, to));
      circuit.on('open',        (pid) => this.emit('open',     pid));
      circuit.on('close',       (pid) => this.emit('close',    pid));
      circuit.on('halfOpen',    (pid) => this.emit('halfOpen', pid));
      this._circuits.set(providerId, circuit);
    }
    return this._circuits.get(providerId);
  }

  /**
   * Execute fn through the circuit breaker for providerId.
   * @param {string} providerId
   * @param {Function} fn   async function to execute
   * @returns {Promise<any>}
   */
  async execute(providerId, fn) {
    const circuit = this.getCircuit(providerId);
    circuit.allowRequest();  // throws CircuitOpenError if not allowed

    try {
      const result = await fn();
      circuit.onSuccess();
      this.emit('success', providerId);
      return result;
    } catch (err) {
      // Don't trip circuit on user errors (4xx) or aborts
      const shouldTrip = (
        err.name !== 'CircuitOpenError' &&
        err.name !== 'ValidationError'  &&
        (err.statusCode == null || err.statusCode >= 500 || err.code === 'timeout' || err.code === 'aborted')
      );
      if (shouldTrip) {
        circuit.onFailure(err);
        this.emit('failure', providerId, err);
      }
      throw err;
    }
  }

  /**
   * Get all circuit stats.
   */
  getAllStats() {
    const stats = {};
    for (const [id, circuit] of this._circuits) {
      stats[id] = circuit.getStats();
    }
    return stats;
  }

  /**
   * Reset a specific provider's circuit.
   */
  reset(providerId) {
    const circuit = this._circuits.get(providerId);
    if (circuit) circuit.reset();
  }

  /**
   * Check if provider is currently available.
   */
  isAvailable(providerId) {
    const circuit = this._circuits.get(providerId);
    if (!circuit) return true;  // No circuit = unknown = try it
    return circuit.state !== STATES.OPEN ||
      (Date.now() - circuit._openedAt) >= circuit._calcBackoff();
  }
}

module.exports = { CircuitBreakerManager, ProviderCircuit, STATES };

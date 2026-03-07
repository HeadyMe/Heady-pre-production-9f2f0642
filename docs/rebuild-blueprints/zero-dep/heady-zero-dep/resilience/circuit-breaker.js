/**
 * @file circuit-breaker.js
 * @description Multi-service circuit breaker with PHI-scaled cooldowns.
 *
 * State Machine: CLOSED → OPEN → HALF_OPEN → CLOSED
 * - CLOSED:    Normal operation; failures accumulate
 * - OPEN:      Failing fast; cooldown timer active (PHI-scaled)
 * - HALF_OPEN: Probing with limited requests; progressive recovery
 *
 * Features:
 * - 16 pre-registered service slots
 * - Configurable failure thresholds per service
 * - PHI-scaled cooldown periods
 * - Half-open probe with progressive recovery
 * - Event emission on state transitions
 * - Cascade failure prevention (global circuit + per-service)
 *
 * Sacred Geometry: PHI ratios for all timing.
 * Zero external dependencies (events, crypto).
 *
 * @module HeadyResilience/CircuitBreaker
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI = 1.6180339887498948482;
const PHI_INV = 1 / PHI; // 0.618…
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ─── Circuit States ───────────────────────────────────────────────────────────
export const CircuitState = Object.freeze({
  CLOSED:    'CLOSED',
  OPEN:      'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

// ─── Default Config ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  failureThreshold:    5,          // failures before opening
  successThreshold:    3,          // successes in HALF_OPEN before closing
  timeout:             30_000,     // base cooldown ms (PHI-scaled per level)
  halfOpenMaxRequests: 2,          // concurrent probes allowed in HALF_OPEN
  windowSize:          60_000,     // rolling window for failure counting (ms)
  volumeThreshold:     10,         // min calls before threshold triggers
  errorFilter:         null,       // (err) => bool — which errors count
};

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
class Circuit extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.id      = randomUUID();
    this.name    = name;
    this.config  = { ...DEFAULT_CONFIG, ...config };
    this.state   = CircuitState.CLOSED;
    this.level   = 0;    // escalation level → PHI^level multiplier
    this._reset();
  }

  _reset() {
    this.failures          = 0;
    this.successes         = 0;
    this.totalCalls        = 0;
    this.halfOpenProbes    = 0;
    this.lastFailureTime   = 0;
    this.openedAt          = 0;
    this._callTimestamps   = [];   // rolling window timestamps
  }

  // PHI-scaled cooldown based on escalation level
  get cooldownMs() {
    return Math.floor(this.config.timeout * Math.pow(PHI, this.level));
  }

  // Prune timestamps outside rolling window
  _pruneWindow() {
    const cutoff = Date.now() - this.config.windowSize;
    this._callTimestamps = this._callTimestamps.filter(t => t > cutoff);
  }

  get isCallable() {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (Date.now() - this.openedAt >= this.cooldownMs) {
        this._transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }
    if (this.state === CircuitState.HALF_OPEN) {
      return this.halfOpenProbes < this.config.halfOpenMaxRequests;
    }
    return false;
  }

  _transitionTo(newState, meta = {}) {
    const prev = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.openedAt = Date.now();
      this.halfOpenProbes = 0;
      this.level = Math.min(this.level + 1, FIBONACCI.length - 1);
    }
    if (newState === CircuitState.CLOSED) {
      this._reset();
      this.level = Math.max(0, this.level - 1); // gradual de-escalation
    }
    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenProbes = 0;
      this.successes = 0;
    }

    const event = { circuit: this.name, from: prev, to: newState, level: this.level, ts: Date.now(), ...meta };
    this.emit('stateChange', event);
    this.emit(newState.toLowerCase(), event);
  }

  recordSuccess() {
    this._pruneWindow();
    this._callTimestamps.push(Date.now());
    this.totalCalls++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      this.halfOpenProbes = Math.max(0, this.halfOpenProbes - 1);
      if (this.successes >= this.config.successThreshold) {
        this._transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // decay failure count on success (PHI-based decay)
      this.failures = Math.max(0, this.failures - PHI_INV);
    }
  }

  recordFailure(err = null) {
    if (this.config.errorFilter && !this.config.errorFilter(err)) return;

    this._pruneWindow();
    this._callTimestamps.push(Date.now());
    this.totalCalls++;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN re-opens immediately
      this._transitionTo(CircuitState.OPEN, { reason: 'half-open-failure' });
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      const windowCalls = this._callTimestamps.length;
      if (
        windowCalls >= this.config.volumeThreshold &&
        this.failures >= this.config.failureThreshold
      ) {
        this._transitionTo(CircuitState.OPEN, { reason: 'threshold-exceeded', failures: this.failures });
      }
    }
  }

  beginProbe() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenProbes++;
    }
  }

  toJSON() {
    return {
      id:       this.id,
      name:     this.name,
      state:    this.state,
      level:    this.level,
      failures: this.failures,
      successes:this.successes,
      totalCalls:  this.totalCalls,
      cooldownMs:  this.cooldownMs,
      openedAt:    this.openedAt,
      halfOpenProbes: this.halfOpenProbes,
    };
  }
}

// ─── CircuitBreakerManager ───────────────────────────────────────────────────
/**
 * Manages up to 16 named circuit breakers (pre-registered service slots).
 * Emits cascade events when multiple circuits open simultaneously.
 */
export class CircuitBreakerManager extends EventEmitter {
  static MAX_SLOTS = 16;

  constructor() {
    super();
    this._circuits = new Map();   // name → Circuit
    this._cascadeThreshold = 3;   // open circuits to trigger cascade warning
    this._preRegisterDefaults();
  }

  // Pre-register 16 standard service slots
  _preRegisterDefaults() {
    const defaults = [
      'llm-primary', 'llm-fallback', 'vector-db', 'kv-store',
      'github-api',  'embedding',    'swarm',     'pipeline',
      'conductor',   'telemetry',    'auth',      'gateway',
      'file-store',  'scheduler',    'metrics',   'external-api',
    ];
    defaults.forEach(name => this.register(name));
  }

  /**
   * Register a new circuit (or return existing).
   */
  register(name, config = {}) {
    if (this._circuits.size >= CircuitBreakerManager.MAX_SLOTS && !this._circuits.has(name)) {
      throw new Error(`CircuitBreakerManager: max ${CircuitBreakerManager.MAX_SLOTS} slots reached`);
    }
    if (!this._circuits.has(name)) {
      const circuit = new Circuit(name, config);
      circuit.on('stateChange', evt => this._onStateChange(evt));
      this._circuits.set(name, circuit);
    }
    return this._circuits.get(name);
  }

  get(name) {
    return this._circuits.get(name) ?? null;
  }

  /**
   * Execute fn through a named circuit.
   * Returns the result or throws (fast-fail when OPEN).
   */
  async execute(name, fn, fallback = null) {
    const circuit = this._circuits.get(name);
    if (!circuit) throw new Error(`Unknown circuit: ${name}`);

    if (!circuit.isCallable) {
      const err = new Error(`Circuit OPEN: ${name}`);
      err.code  = 'CIRCUIT_OPEN';
      err.circuit = name;
      if (typeof fallback === 'function') return fallback(err);
      throw err;
    }

    if (circuit.state === CircuitState.HALF_OPEN) circuit.beginProbe();

    try {
      const result = await fn();
      circuit.recordSuccess();
      return result;
    } catch (err) {
      circuit.recordFailure(err);
      throw err;
    }
  }

  _onStateChange(evt) {
    this.emit('circuitChange', evt);

    // Cascade detection: count open circuits
    const openCount = [...this._circuits.values()]
      .filter(c => c.state === CircuitState.OPEN).length;

    if (openCount >= this._cascadeThreshold) {
      this.emit('cascadeWarning', {
        openCount,
        circuits: [...this._circuits.values()]
          .filter(c => c.state === CircuitState.OPEN)
          .map(c => c.name),
        ts: Date.now(),
      });
    }
  }

  /**
   * Force-reset a specific circuit.
   */
  reset(name) {
    const c = this._circuits.get(name);
    if (!c) throw new Error(`Unknown circuit: ${name}`);
    c._transitionTo(CircuitState.CLOSED, { reason: 'manual-reset' });
  }

  /**
   * Force-open a circuit (maintenance / manual intervention).
   */
  trip(name, reason = 'manual-trip') {
    const c = this._circuits.get(name);
    if (!c) throw new Error(`Unknown circuit: ${name}`);
    c._transitionTo(CircuitState.OPEN, { reason });
  }

  status() {
    const result = {};
    for (const [name, c] of this._circuits) result[name] = c.toJSON();
    return result;
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
let _instance = null;
export function getCircuitBreakerManager() {
  if (!_instance) _instance = new CircuitBreakerManager();
  return _instance;
}

export default getCircuitBreakerManager;

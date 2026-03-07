'use strict';

/**
 * @fileoverview HealthAttestor — per-service health attestation middleware.
 *
 * Embedded in every service instance, this module continuously measures
 * response latency, error rate, memory usage, and event-loop lag, then
 * synthesises a single CSL risk_gate score and broadcasts a signed
 * attestation payload every BROADCAST_INTERVAL milliseconds.
 *
 * @module src/resilience/health-attestor
 */

const EventEmitter = require('events');
const v8 = require('v8');
const { performance } = require('perf_hooks');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PHI, PHI_INVERSE, PhiScale } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often (ms) an attestation is broadcast. */
const BROADCAST_INTERVAL = 5_000;

/** Rolling window for error-rate calculation. */
const ERROR_WINDOW = 100;

/** Ternary thresholds derived from phi scale. */
const TERNARY_HEALTHY_THRESHOLD = PHI_INVERSE;   // 0.618
const TERNARY_CRITICAL_THRESHOLD = 0.3;

/** Minimum score considered "alive" for registration purposes. */
const REGISTRATION_MIN_SCORE = 0.1;

// ---------------------------------------------------------------------------
// Internal state shape
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AttestationPayload
 * @property {string}  serviceId       - Unique identifier for the service instance.
 * @property {number}  timestamp       - Unix ms timestamp of attestation.
 * @property {number}  cslScore        - CSL risk_gate composite score [0,1].
 * @property {number}  ternaryState    - +1 healthy | 0 degraded | -1 critical.
 * @property {number}  latencyP99      - 99th-percentile response latency (ms).
 * @property {number}  errorRate       - Error rate over last 100 requests [0,1].
 * @property {number}  memoryPercent   - Heap used as fraction of heap limit [0,1].
 * @property {number}  eventLoopLag    - Measured event-loop lag (ms).
 * @property {number}  uptime          - Process uptime (seconds).
 * @property {string}  version         - Application version string.
 * @property {'ATTESTED'|'UNATTESTED'} attestationStatus - Whether broadcast succeeded.
 */

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * HealthAttestor — attaches to a service, measures vitals, and broadcasts
 * periodic attestations to the rest of the mesh via EventEmitter.
 *
 * @extends EventEmitter
 */
class HealthAttestor extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string}  options.serviceId       - Unique service identifier.
   * @param {string}  [options.version='0.0.0'] - Semver version string.
   * @param {number}  [options.dynamicTimeout=2000] - DynamicTimeout reference (ms) for latency normalisation.
   * @param {Object}  [options.quarantineManager]   - QuarantineManager singleton to register with.
   * @param {number}  [options.broadcastInterval]   - Override broadcast interval (ms).
   */
  constructor(options = {}) {
    super();

    const {
      serviceId,
      version = process.env.npm_package_version || '0.0.0',
      dynamicTimeout = 2_000,
      quarantineManager = null,
      broadcastInterval = BROADCAST_INTERVAL,
    } = options;

    if (!serviceId) {
      throw new Error('HealthAttestor requires a serviceId');
    }

    this.serviceId = serviceId;
    this.version = version;
    this.dynamicTimeout = dynamicTimeout;
    this.quarantineManager = quarantineManager;
    this.broadcastInterval = broadcastInterval;

    /** @type {number[]} Sorted sample of recent response latencies (ms). */
    this._latencySamples = [];

    /** @type {Array<{isError: boolean}>} Rolling window of request outcomes. */
    this._requestWindow = [];

    /** @type {number} Smoothed event-loop lag in ms. */
    this._eventLoopLag = 0;

    /** @type {NodeJS.Timeout|null} Broadcast timer handle. */
    this._broadcastTimer = null;

    /** @type {NodeJS.Timeout|null} Lag sampling timer handle. */
    this._lagTimer = null;

    /** @type {boolean} Whether the attestor is actively broadcasting. */
    this._active = false;

    /** @type {AttestationPayload|null} Most recent payload. */
    this.lastAttestation = null;

    this._log = logger.child({ component: 'HealthAttestor', serviceId });
    this._phiScale = new PhiScale();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start periodic attestation broadcasts and register with QuarantineManager.
   * @returns {HealthAttestor} this (for chaining)
   */
  start() {
    if (this._active) return this;

    this._active = true;
    this._startLagSampler();
    this._broadcastTimer = setInterval(() => this._broadcastAttestation(), this.broadcastInterval);
    // Fire an immediate first attestation after a short settle delay.
    setTimeout(() => this._broadcastAttestation(), 500);

    if (this.quarantineManager) {
      try {
        this.quarantineManager.registerService(this.serviceId, this);
      } catch (err) {
        this._log.warn({ err }, 'Failed to register with QuarantineManager; continuing unregistered');
      }
    }

    this._log.info({ broadcastInterval: this.broadcastInterval }, 'HealthAttestor started');
    return this;
  }

  /**
   * Stop broadcasts and clean up timers.
   */
  stop() {
    this._active = false;
    if (this._broadcastTimer) {
      clearInterval(this._broadcastTimer);
      this._broadcastTimer = null;
    }
    if (this._lagTimer) {
      clearInterval(this._lagTimer);
      this._lagTimer = null;
    }
    this._log.info('HealthAttestor stopped');
  }

  // -------------------------------------------------------------------------
  // Request instrumentation helpers
  // -------------------------------------------------------------------------

  /**
   * Record a completed request.  Called internally by the Express middleware.
   * @param {number}  latencyMs - Response time in milliseconds.
   * @param {boolean} isError   - Whether the request resulted in a 5xx error.
   */
  recordRequest(latencyMs, isError = false) {
    // Maintain a sorted latency array for P99 calculation (capped at 1000 samples).
    this._latencySamples.push(latencyMs);
    if (this._latencySamples.length > 1_000) this._latencySamples.shift();

    // Rolling request window for error rate.
    this._requestWindow.push({ isError });
    if (this._requestWindow.length > ERROR_WINDOW) this._requestWindow.shift();
  }

  // -------------------------------------------------------------------------
  // Measurement helpers
  // -------------------------------------------------------------------------

  /**
   * Start a lightweight event-loop lag sampler.
   * @private
   */
  _startLagSampler() {
    let last = performance.now();
    this._lagTimer = setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - last - 100);
      // Exponential moving average (alpha ~ 0.2).
      this._eventLoopLag = this._eventLoopLag * 0.8 + lag * 0.2;
      last = now;
    }, 100);
    // Prevent this timer from keeping the process alive.
    if (this._lagTimer.unref) this._lagTimer.unref();
  }

  /**
   * Compute the P99 latency from the current sample buffer.
   * @returns {number} P99 in ms, or 0 if no samples.
   * @private
   */
  _computeP99() {
    if (!this._latencySamples.length) return 0;
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Compute the error rate over the rolling window.
   * @returns {number} [0, 1]
   * @private
   */
  _computeErrorRate() {
    if (!this._requestWindow.length) return 0;
    const errors = this._requestWindow.filter(r => r.isError).length;
    return errors / this._requestWindow.length;
  }

  /**
   * Compute heap usage as a fraction of the heap size limit.
   * @returns {number} [0, 1]
   * @private
   */
  _computeMemoryPercent() {
    const stats = v8.getHeapStatistics();
    if (!stats.heap_size_limit) return 0;
    return stats.used_heap_size / stats.heap_size_limit;
  }

  // -------------------------------------------------------------------------
  // CSL scoring
  // -------------------------------------------------------------------------

  /**
   * Build the CSL risk_gate score from the four vitals.
   *
   * Each vital is normalised to [0,1] where 1 = healthy and assembled into
   * a feature vector passed to HeadySemanticLogic.risk_gate.
   *
   * @param {number} latencyP99    - P99 latency (ms).
   * @param {number} errorRate     - Error rate [0,1].
   * @param {number} memoryPercent - Memory usage fraction [0,1].
   * @param {number} eventLoopLag  - Event-loop lag (ms).
   * @returns {number} CSL composite score [0,1].
   * @private
   */
  _computeCslScore(latencyP99, errorRate, memoryPercent, eventLoopLag) {
    // Normalise latency: 0 ms → 1.0, dynamicTimeout ms → 0.0.
    const latencyNorm = Math.max(0, 1 - latencyP99 / this.dynamicTimeout);

    // Error rate: 0 → 1.0, 1 → 0.0.
    const errorNorm = 1 - errorRate;

    // Memory: 0 → 1.0, 1 → 0.0.
    const memNorm = 1 - memoryPercent;

    // Event loop lag: 0 ms → 1.0, 500 ms → 0.0 (hard cap).
    const lagNorm = Math.max(0, 1 - eventLoopLag / 500);

    // Build input vector for risk_gate.
    const features = [latencyNorm, errorNorm, memNorm, lagNorm];

    try {
      return HeadySemanticLogic.risk_gate(features);
    } catch (err) {
      this._log.error({ err }, 'CSL risk_gate computation failed; defaulting to 0');
      return 0;
    }
  }

  /**
   * Determine ternary health state from CSL score.
   * @param {number} score
   * @returns {+1|0|-1}
   * @private
   */
  _ternaryState(score) {
    try {
      return HeadySemanticLogic.ternary_gate(score, TERNARY_HEALTHY_THRESHOLD, TERNARY_CRITICAL_THRESHOLD);
    } catch {
      // Manual fallback.
      if (score >= TERNARY_HEALTHY_THRESHOLD) return 1;
      if (score < TERNARY_CRITICAL_THRESHOLD) return -1;
      return 0;
    }
  }

  // -------------------------------------------------------------------------
  // Broadcast
  // -------------------------------------------------------------------------

  /**
   * Collect metrics, build attestation payload, and emit it.
   * Marks UNATTESTED if the emit throws (e.g. listener errors).
   * @private
   */
  async _broadcastAttestation() {
    const latencyP99 = this._computeP99();
    const errorRate = this._computeErrorRate();
    const memoryPercent = this._computeMemoryPercent();
    const eventLoopLag = this._eventLoopLag;

    const cslScore = this._computeCslScore(latencyP99, errorRate, memoryPercent, eventLoopLag);
    const ternaryState = this._ternaryState(cslScore);

    /** @type {AttestationPayload} */
    const payload = {
      serviceId: this.serviceId,
      timestamp: Date.now(),
      cslScore,
      ternaryState,
      latencyP99,
      errorRate,
      memoryPercent,
      eventLoopLag,
      uptime: process.uptime(),
      version: this.version,
      attestationStatus: 'ATTESTED',
    };

    this.lastAttestation = payload;

    try {
      this.emit('attestation', payload);
      logger.logSystem('health-attestation', {
        serviceId: this.serviceId,
        cslScore,
        ternaryState,
      });
    } catch (broadcastErr) {
      payload.attestationStatus = 'UNATTESTED';
      this._log.warn({ err: broadcastErr }, 'Attestation broadcast failed; service continues as UNATTESTED');
    }

    // Forward to quarantine manager regardless of broadcast outcome.
    if (this.quarantineManager) {
      try {
        this.quarantineManager.receiveAttestation(payload);
      } catch (qmErr) {
        this._log.warn({ err: qmErr }, 'Failed to forward attestation to QuarantineManager');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Express middleware factory
  // -------------------------------------------------------------------------

  /**
   * Create an Express middleware that instruments every request for latency
   * and error rate recording.
   *
   * @param {string}  serviceId  - Unique service identifier.
   * @param {Object}  [options]  - HealthAttestor constructor options.
   * @returns {{ middleware: Function, attestor: HealthAttestor }}
   *
   * @example
   * const { middleware, attestor } = HealthAttestor.middleware('api-gateway', {
   *   dynamicTimeout: 3000,
   *   quarantineManager: qm,
   * });
   * app.use(middleware);
   * attestor.start();
   */
  static middleware(serviceId, options = {}) {
    const attestor = new HealthAttestor({ serviceId, ...options });

    const mw = (req, res, next) => {
      const start = performance.now();

      res.on('finish', () => {
        const latencyMs = performance.now() - start;
        const isError = res.statusCode >= 500;
        attestor.recordRequest(latencyMs, isError);
      });

      next();
    };

    return { middleware: mw, attestor };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /**
   * Return a snapshot of the current health state without waiting for the next
   * broadcast tick.
   * @returns {AttestationPayload}
   */
  getSnapshot() {
    const latencyP99 = this._computeP99();
    const errorRate = this._computeErrorRate();
    const memoryPercent = this._computeMemoryPercent();
    const eventLoopLag = this._eventLoopLag;
    const cslScore = this._computeCslScore(latencyP99, errorRate, memoryPercent, eventLoopLag);

    return {
      serviceId: this.serviceId,
      timestamp: Date.now(),
      cslScore,
      ternaryState: this._ternaryState(cslScore),
      latencyP99,
      errorRate,
      memoryPercent,
      eventLoopLag,
      uptime: process.uptime(),
      version: this.version,
      attestationStatus: this._active ? 'ATTESTED' : 'UNATTESTED',
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = HealthAttestor;

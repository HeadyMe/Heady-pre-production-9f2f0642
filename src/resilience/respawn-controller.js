'use strict';

/**
 * @fileoverview RespawnController — orchestrates the recovery of quarantined
 * services using a phi-backoff retry strategy.
 *
 * Recovery flow:
 *  1. QuarantineManager calls respawn(serviceId).
 *  2. RespawnController schedules a restart attempt using PhiBackoff timing.
 *  3. After each restart the controller waits for healthy attestations from
 *     HealthAttestor (ternary_gate +1).
 *  4. Three consecutive healthy attestations → QuarantineManager.release().
 *  5. Five consecutive total failures → PERMANENT_QUARANTINE + alert emission.
 *
 * @module src/resilience/respawn-controller
 */

const EventEmitter = require('events');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PhiBackoff } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Consecutive healthy attestations required before returning to rotation. */
const HEALTHY_CONFIRMATIONS_REQUIRED = 3;

/** Total consecutive failures before PERMANENT_QUARANTINE. */
const PERMANENT_QUARANTINE_THRESHOLD = 5;

/** Ternary +1 means healthy. */
const TERNARY_HEALTHY = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RespawnRecord
 * @property {string}   serviceId              - Service being respawned.
 * @property {number}   attempts               - Total spawn attempts.
 * @property {number}   successes              - Total times service recovered.
 * @property {number}   failures               - Total failed attempts.
 * @property {number}   consecutiveFailures    - Current streak of failures.
 * @property {number}   consecutiveHealthy     - Current streak of healthy confirmations.
 * @property {boolean}  permanentlyQuarantined - Whether max failures exceeded.
 * @property {number}   firstAttemptTime       - Unix ms of first respawn attempt.
 * @property {number}   lastAttemptTime        - Unix ms of most recent attempt.
 * @property {number}   totalDowntime          - Cumulative ms spent quarantined.
 * @property {string[]} log                    - Human-readable history lines.
 */

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * RespawnController manages automatic service recovery with exponential
 * phi-backoff and healthy-confirmation gating.
 *
 * @extends EventEmitter
 */
class RespawnController extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {Object} [options.quarantineManager] - QuarantineManager to notify on release.
   * @param {Function} [options.restartFn]       - Async function that actually restarts a service.
   *                                               Receives (serviceId) → Promise<void>.
   *                                               Defaults to a no-op (caller must wire real logic).
   */
  constructor(options = {}) {
    super();

    const { quarantineManager = null, restartFn = null } = options;

    this._quarantineManager = quarantineManager;
    this._restartFn = restartFn || this._defaultRestart.bind(this);

    /** @type {Map<string, RespawnRecord>} */
    this._history = new Map();

    /** @type {Map<string, NodeJS.Timeout>} Pending retry timers keyed by serviceId. */
    this._pendingTimers = new Map();

    /** @type {Set<string>} Services confirmed permanently quarantined. */
    this._permanentlyQuarantined = new Set();

    this._log = logger.child({ component: 'RespawnController' });
  }

  // -------------------------------------------------------------------------
  // Respawn entry point
  // -------------------------------------------------------------------------

  /**
   * Initiate the respawn sequence for a quarantined service.
   *
   * If the service is already in an active respawn cycle this call is a no-op
   * (idempotent).  If previously permanently quarantined, an error is logged
   * and the method returns.
   *
   * @param {string} serviceId
   */
  respawn(serviceId) {
    if (this._permanentlyQuarantined.has(serviceId)) {
      this._log.error({ serviceId }, 'Respawn requested for permanently quarantined service — ignoring');
      return;
    }

    if (this._pendingTimers.has(serviceId)) {
      this._log.warn({ serviceId }, 'Respawn already in progress — ignoring duplicate request');
      return;
    }

    // Initialise or retrieve history record.
    if (!this._history.has(serviceId)) {
      /** @type {RespawnRecord} */
      const record = {
        serviceId,
        attempts: 0,
        successes: 0,
        failures: 0,
        consecutiveFailures: 0,
        consecutiveHealthy: 0,
        permanentlyQuarantined: false,
        firstAttemptTime: Date.now(),
        lastAttemptTime: Date.now(),
        totalDowntime: 0,
        log: [],
      };
      this._history.set(serviceId, record);
    }

    this._scheduleAttempt(serviceId);
  }

  // -------------------------------------------------------------------------
  // Attempt scheduling
  // -------------------------------------------------------------------------

  /**
   * Schedule the next respawn attempt using PhiBackoff.
   * @param {string} serviceId
   * @private
   */
  _scheduleAttempt(serviceId) {
    const record = this._history.get(serviceId);
    const backoff = new PhiBackoff({ base: 1_000 }); // 1 s base

    // Fast-forward the backoff to the correct step for this attempt count.
    let delay = backoff.next(); // first delay = 1000 ms
    for (let i = 0; i < record.attempts; i++) {
      delay = backoff.next();
    }

    const logLine = `Attempt #${record.attempts + 1} scheduled in ${(delay / 1000).toFixed(3)}s`;
    record.log.push(`[${new Date().toISOString()}] ${logLine}`);
    this._log.info({ serviceId, delay, attempt: record.attempts + 1 }, 'Scheduling respawn attempt');

    const timer = setTimeout(async () => {
      this._pendingTimers.delete(serviceId);
      await this._executeAttempt(serviceId);
    }, delay);

    // Don't block process exit.
    if (timer.unref) timer.unref();
    this._pendingTimers.set(serviceId, timer);
  }

  /**
   * Execute a single respawn attempt.
   * @param {string} serviceId
   * @private
   */
  async _executeAttempt(serviceId) {
    const record = this._history.get(serviceId);
    if (!record) return;

    record.attempts += 1;
    record.lastAttemptTime = Date.now();

    this._log.info({ serviceId, attempt: record.attempts }, 'Executing respawn attempt');
    this.emit('RESPAWN_ATTEMPTED', { serviceId, attempt: record.attempts, timestamp: Date.now() });

    try {
      await this._restartFn(serviceId);

      // Success — wait for healthy confirmations before releasing.
      record.consecutiveFailures = 0;
      record.log.push(`[${new Date().toISOString()}] Restart succeeded (attempt #${record.attempts}); waiting for ${HEALTHY_CONFIRMATIONS_REQUIRED} healthy attestations`);
      this._log.info({ serviceId }, 'Restart function succeeded; awaiting healthy confirmations');
      this.emit('RESPAWN_RESTART_OK', { serviceId, attempt: record.attempts });

      // Confirmation is driven by receiveAttestation() calls.
    } catch (err) {
      record.failures += 1;
      record.consecutiveFailures += 1;
      const logLine = `Attempt #${record.attempts} failed: ${err.message}`;
      record.log.push(`[${new Date().toISOString()}] ${logLine}`);

      logger.logError(err, { serviceId, attempt: record.attempts, context: 'RespawnController' });
      this.emit('RESPAWN_FAILED', { serviceId, attempt: record.attempts, error: err.message, timestamp: Date.now() });

      if (record.consecutiveFailures >= PERMANENT_QUARANTINE_THRESHOLD) {
        this._permanentlyQuarantine(serviceId, record);
      } else {
        this._scheduleAttempt(serviceId);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Healthy attestation ingestion
  // -------------------------------------------------------------------------

  /**
   * Feed an attestation into the controller so it can count healthy confirmations.
   * Should be called every time a service attestation is received.
   *
   * @param {import('./health-attestor').AttestationPayload} payload
   */
  receiveAttestation(payload) {
    const { serviceId, ternaryState } = payload;
    const record = this._history.get(serviceId);
    if (!record) return; // Not tracking this service.
    if (this._permanentlyQuarantined.has(serviceId)) return;

    if (ternaryState === TERNARY_HEALTHY) {
      record.consecutiveHealthy += 1;
      this._log.info(
        { serviceId, consecutiveHealthy: record.consecutiveHealthy },
        'Healthy attestation received during recovery'
      );

      if (record.consecutiveHealthy >= HEALTHY_CONFIRMATIONS_REQUIRED) {
        this._confirmRecovery(serviceId, record);
      }
    } else {
      // Unhealthy attestation resets the confirmation streak.
      if (record.consecutiveHealthy > 0) {
        this._log.warn(
          { serviceId, ternaryState },
          'Unhealthy attestation during recovery; resetting healthy counter'
        );
        record.consecutiveHealthy = 0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Recovery confirmation
  // -------------------------------------------------------------------------

  /**
   * Confirm that a service has recovered and release it from quarantine.
   * @param {string}       serviceId
   * @param {RespawnRecord} record
   * @private
   */
  _confirmRecovery(serviceId, record) {
    const now = Date.now();
    record.successes += 1;
    record.consecutiveHealthy = 0;
    record.consecutiveFailures = 0;

    const downtime = now - (record.lastAttemptTime || record.firstAttemptTime);
    record.totalDowntime += downtime;
    record.log.push(`[${new Date().toISOString()}] Service confirmed healthy after ${HEALTHY_CONFIRMATIONS_REQUIRED} attestations`);

    this._log.info({ serviceId, downtime }, 'Service confirmed healthy; releasing from quarantine');
    this.emit('RESPAWN_SUCCEEDED', { serviceId, downtime, timestamp: now });

    if (this._quarantineManager) {
      try {
        this._quarantineManager.release(serviceId);
      } catch (err) {
        this._log.error({ err, serviceId }, 'Failed to release from QuarantineManager');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Permanent quarantine
  // -------------------------------------------------------------------------

  /**
   * Mark a service as permanently quarantined and fire an alert.
   * @param {string}       serviceId
   * @param {RespawnRecord} record
   * @private
   */
  _permanentlyQuarantine(serviceId, record) {
    record.permanentlyQuarantined = true;
    this._permanentlyQuarantined.add(serviceId);

    const totalDowntime = Date.now() - record.firstAttemptTime;
    record.totalDowntime = totalDowntime;
    record.log.push(`[${new Date().toISOString()}] PERMANENT_QUARANTINE: ${record.consecutiveFailures} consecutive failures`);

    this._log.error(
      { serviceId, attempts: record.attempts, consecutiveFailures: record.consecutiveFailures },
      'PERMANENT_QUARANTINE: max failures exceeded — manual intervention required'
    );

    this.emit('PERMANENT_QUARANTINE', {
      serviceId,
      attempts: record.attempts,
      consecutiveFailures: record.consecutiveFailures,
      totalDowntime,
      timestamp: Date.now(),
      alertLevel: 'CRITICAL',
    });
  }

  // -------------------------------------------------------------------------
  // Default restart function
  // -------------------------------------------------------------------------

  /**
   * Default no-op restart.  Override by passing restartFn to constructor.
   * In a real deployment this would exec a process manager (e.g. PM2, k8s).
   *
   * @param {string} serviceId
   * @returns {Promise<void>}
   * @private
   */
  async _defaultRestart(serviceId) {
    this._log.warn(
      { serviceId },
      'No restartFn provided to RespawnController — no actual restart performed'
    );
    // Simulate async restart.
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /**
   * Return the full respawn history for a service.
   * @param {string} serviceId
   * @returns {RespawnRecord|null}
   */
  getHistory(serviceId) {
    return this._history.get(serviceId) || null;
  }

  /**
   * Return all services currently permanently quarantined.
   * @returns {string[]}
   */
  getPermanentlyQuarantined() {
    return Array.from(this._permanentlyQuarantined);
  }

  /**
   * Return summary statistics across all tracked services.
   * @returns {{ totalTracked: number, totalAttempts: number, totalSuccesses: number, totalFailures: number, permanentlyQuarantined: number }}
   */
  getSummary() {
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    for (const record of this._history.values()) {
      totalAttempts += record.attempts;
      totalSuccesses += record.successes;
      totalFailures += record.failures;
    }

    return {
      totalTracked: this._history.size,
      totalAttempts,
      totalSuccesses,
      totalFailures,
      permanentlyQuarantined: this._permanentlyQuarantined.size,
    };
  }

  /**
   * Cancel any pending retry timer for a service (e.g. during shutdown).
   * @param {string} serviceId
   */
  cancelRetry(serviceId) {
    const timer = this._pendingTimers.get(serviceId);
    if (timer) {
      clearTimeout(timer);
      this._pendingTimers.delete(serviceId);
      this._log.info({ serviceId }, 'Pending respawn timer cancelled');
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = RespawnController;

'use strict';

/**
 * @fileoverview QuarantineManager — singleton tracking service attestation
 * health and enforcing quarantine when a service's CSL risk score degrades
 * below acceptable thresholds for consecutive attestation cycles.
 *
 * Quarantine flow:
 *   1. Service's risk_gate score drops below PHI_INVERSE for N consecutive cycles.
 *   2. QuarantineManager emits QUARANTINE_ENTERED and instructs the MCP router
 *      and load-balancer to remove the service.
 *   3. RespawnController is notified to begin recovery.
 *   4. On confirmed healthy confirmation the service is released via release().
 *
 * Fleet health is computed using CSL.consensus_superposition across all
 * currently non-quarantined service attestations.
 *
 * @module src/resilience/quarantine-manager
 */

const EventEmitter = require('events');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PHI_INVERSE } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of consecutive bad attestations required before quarantine. */
const CONSECUTIVE_BAD_THRESHOLD = 3;

/** Score below which an attestation is considered "bad". */
const BAD_SCORE_THRESHOLD = PHI_INVERSE; // 0.618

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} QuarantineEntry
 * @property {string}   serviceId      - Quarantined service ID.
 * @property {number}   entryTime      - Unix ms timestamp when quarantine began.
 * @property {string}   reason         - Human-readable reason for quarantine.
 * @property {number}   lastScore      - CSL score at time of quarantine.
 * @property {number}   respawnAttempts - How many respawn attempts have been made.
 * @property {string}   [respawnStatus] - Latest status from RespawnController.
 */

/**
 * @typedef {Object} ServiceRecord
 * @property {string}          serviceId          - Service identifier.
 * @property {EventEmitter}    [attestor]         - Linked HealthAttestor instance.
 * @property {number}          consecutiveBad     - Running count of sub-threshold attestations.
 * @property {number}          lastScore          - Most recent CSL score.
 * @property {number}          lastSeen           - Unix ms timestamp of last attestation.
 * @property {'healthy'|'degraded'|'quarantined'} status - Current status.
 */

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance = null;

/**
 * QuarantineManager singleton.  Use QuarantineManager.getInstance() to obtain
 * the shared instance rather than constructing directly.
 *
 * @extends EventEmitter
 */
class QuarantineManager extends EventEmitter {
  constructor() {
    super();

    /** @type {Map<string, ServiceRecord>} All registered services. */
    this._registry = new Map();

    /** @type {Map<string, QuarantineEntry>} Currently quarantined services. */
    this._quarantine = new Map();

    /** @type {Function|null} Optional MCP router adapter. */
    this._mcpRouter = null;

    /** @type {Function|null} Optional load-balancer adapter. */
    this._loadBalancer = null;

    /** @type {Function|null} Optional RespawnController reference. */
    this._respawnController = null;

    this._log = logger.child({ component: 'QuarantineManager' });
  }

  // -------------------------------------------------------------------------
  // Singleton accessor
  // -------------------------------------------------------------------------

  /**
   * Return (or lazily create) the process-level singleton.
   * @returns {QuarantineManager}
   */
  static getInstance() {
    if (!_instance) _instance = new QuarantineManager();
    return _instance;
  }

  // -------------------------------------------------------------------------
  // Dependency injection
  // -------------------------------------------------------------------------

  /**
   * Attach an MCP router so the quarantine manager can deregister routes.
   * @param {{ unregister: Function }} mcpRouter
   */
  setMcpRouter(mcpRouter) {
    this._mcpRouter = mcpRouter;
  }

  /**
   * Attach a load-balancer so the quarantine manager can remove pool members.
   * @param {{ remove: Function, add: Function }} loadBalancer
   */
  setLoadBalancer(loadBalancer) {
    this._loadBalancer = loadBalancer;
  }

  /**
   * Attach a RespawnController that will be notified on quarantine events.
   * @param {{ respawn: Function }} respawnController
   */
  setRespawnController(respawnController) {
    this._respawnController = respawnController;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a service with the manager.  Typically called by HealthAttestor
   * on startup.
   *
   * @param {string}       serviceId - Unique service identifier.
   * @param {EventEmitter} [attestor] - The HealthAttestor instance for this service.
   */
  registerService(serviceId, attestor = null) {
    if (this._registry.has(serviceId)) {
      this._log.warn({ serviceId }, 'Service already registered; overwriting record');
    }

    /** @type {ServiceRecord} */
    const record = {
      serviceId,
      attestor,
      consecutiveBad: 0,
      lastScore: 1,
      lastSeen: Date.now(),
      status: 'healthy',
    };

    this._registry.set(serviceId, record);

    if (attestor && typeof attestor.on === 'function') {
      attestor.on('attestation', payload => this.receiveAttestation(payload));
    }

    this._log.info({ serviceId }, 'Service registered with QuarantineManager');
  }

  /**
   * Deregister a service from the manager.
   * @param {string} serviceId
   */
  deregisterService(serviceId) {
    this._registry.delete(serviceId);
    this._log.info({ serviceId }, 'Service deregistered');
  }

  // -------------------------------------------------------------------------
  // Attestation processing
  // -------------------------------------------------------------------------

  /**
   * Process an incoming attestation payload.  Updates consecutive-bad counter
   * and triggers quarantine if threshold is exceeded.
   *
   * @param {import('./health-attestor').AttestationPayload} payload
   */
  receiveAttestation(payload) {
    const { serviceId, cslScore } = payload;

    // Auto-register previously unknown services (mesh discovery).
    if (!this._registry.has(serviceId)) {
      this.registerService(serviceId);
    }

    const record = this._registry.get(serviceId);
    record.lastScore = cslScore;
    record.lastSeen = payload.timestamp;

    // If already quarantined, just update the last score.
    if (this._quarantine.has(serviceId)) {
      this._quarantine.get(serviceId).lastScore = cslScore;
      return;
    }

    if (cslScore < BAD_SCORE_THRESHOLD) {
      record.consecutiveBad += 1;
      record.status = 'degraded';
      this._log.warn(
        { serviceId, cslScore, consecutiveBad: record.consecutiveBad },
        'Degraded attestation received'
      );

      if (record.consecutiveBad >= CONSECUTIVE_BAD_THRESHOLD) {
        this.quarantine(serviceId, `CSL score ${cslScore.toFixed(3)} below ${BAD_SCORE_THRESHOLD} for ${record.consecutiveBad} consecutive attestations`);
      }
    } else {
      // Good attestation resets the consecutive counter.
      record.consecutiveBad = 0;
      record.status = 'healthy';
    }
  }

  // -------------------------------------------------------------------------
  // Quarantine management
  // -------------------------------------------------------------------------

  /**
   * Place a service into quarantine.
   *
   * Actions performed:
   *  - Record the quarantine entry.
   *  - Remove from MCP router (if adapter present).
   *  - Remove from load balancer (if adapter present).
   *  - Emit QUARANTINE event.
   *  - Notify RespawnController (if adapter present).
   *
   * @param {string} serviceId - Service to quarantine.
   * @param {string} [reason]  - Human-readable reason.
   */
  quarantine(serviceId, reason = 'manual') {
    if (this._quarantine.has(serviceId)) {
      this._log.warn({ serviceId }, 'Service already quarantined');
      return;
    }

    const record = this._registry.get(serviceId);
    const lastScore = record ? record.lastScore : 0;

    /** @type {QuarantineEntry} */
    const entry = {
      serviceId,
      entryTime: Date.now(),
      reason,
      lastScore,
      respawnAttempts: 0,
      respawnStatus: 'pending',
    };

    this._quarantine.set(serviceId, entry);
    if (record) record.status = 'quarantined';

    this._log.error({ serviceId, reason, lastScore }, 'Service quarantined');

    // Remove from MCP router.
    if (this._mcpRouter) {
      try {
        this._mcpRouter.unregister(serviceId);
      } catch (err) {
        this._log.error({ err, serviceId }, 'Failed to unregister from MCP router');
      }
    }

    // Remove from load balancer.
    if (this._loadBalancer) {
      try {
        this._loadBalancer.remove(serviceId);
      } catch (err) {
        this._log.error({ err, serviceId }, 'Failed to remove from load balancer');
      }
    }

    this.emit('QUARANTINE_ENTERED', { serviceId, reason, lastScore, timestamp: entry.entryTime });

    // Trigger respawn.
    if (this._respawnController) {
      try {
        this._respawnController.respawn(serviceId);
        entry.respawnStatus = 'initiated';
        entry.respawnAttempts += 1;
      } catch (err) {
        this._log.error({ err, serviceId }, 'Failed to initiate respawn');
      }
    }
  }

  /**
   * Release a service from quarantine.  Called by RespawnController after
   * 3 consecutive healthy attestations.
   *
   * @param {string} serviceId
   */
  release(serviceId) {
    if (!this._quarantine.has(serviceId)) {
      this._log.warn({ serviceId }, 'release() called for non-quarantined service');
      return;
    }

    const entry = this._quarantine.get(serviceId);
    const downtime = Date.now() - entry.entryTime;
    this._quarantine.delete(serviceId);

    const record = this._registry.get(serviceId);
    if (record) {
      record.status = 'healthy';
      record.consecutiveBad = 0;
    }

    // Re-add to load balancer.
    if (this._loadBalancer) {
      try {
        this._loadBalancer.add(serviceId);
      } catch (err) {
        this._log.error({ err, serviceId }, 'Failed to re-add to load balancer after release');
      }
    }

    this._log.info({ serviceId, downtime }, 'Service released from quarantine');
    this.emit('QUARANTINE_RELEASED', { serviceId, downtime, timestamp: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Fleet health
  // -------------------------------------------------------------------------

  /**
   * Compute aggregate fleet health score using CSL.consensus_superposition
   * across all non-quarantined services.
   *
   * @returns {{ score: number, healthy: number, degraded: number, quarantined: number, total: number }}
   */
  getFleetHealth() {
    const scores = [];
    let healthyCount = 0;
    let degradedCount = 0;

    for (const [, record] of this._registry) {
      if (record.status !== 'quarantined') {
        scores.push(record.lastScore);
        if (record.status === 'healthy') healthyCount += 1;
        else degradedCount += 1;
      }
    }

    let fleetScore = 0;
    if (scores.length > 0) {
      try {
        fleetScore = HeadySemanticLogic.consensus_superposition(scores);
      } catch {
        fleetScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    return {
      score: fleetScore,
      healthy: healthyCount,
      degraded: degradedCount,
      quarantined: this._quarantine.size,
      total: this._registry.size,
    };
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /**
   * Return all quarantined services.
   * @returns {QuarantineEntry[]}
   */
  getQuarantined() {
    return Array.from(this._quarantine.values());
  }

  /**
   * Return all registered service records.
   * @returns {ServiceRecord[]}
   */
  getRegistry() {
    return Array.from(this._registry.values());
  }

  /**
   * Retrieve the quarantine entry for a specific service, or null.
   * @param {string} serviceId
   * @returns {QuarantineEntry|null}
   */
  getQuarantineEntry(serviceId) {
    return this._quarantine.get(serviceId) || null;
  }

  /**
   * Check whether a service is currently quarantined.
   * @param {string} serviceId
   * @returns {boolean}
   */
  isQuarantined(serviceId) {
    return this._quarantine.has(serviceId);
  }

  /**
   * Increment the respawn attempt counter for a quarantined service.
   * @param {string} serviceId
   * @param {string} [status]
   */
  recordRespawnAttempt(serviceId, status = 'attempted') {
    const entry = this._quarantine.get(serviceId);
    if (entry) {
      entry.respawnAttempts += 1;
      entry.respawnStatus = status;
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = QuarantineManager;

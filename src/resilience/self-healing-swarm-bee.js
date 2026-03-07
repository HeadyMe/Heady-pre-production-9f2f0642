'use strict';

/**
 * @fileoverview SelfHealingSwarmBee — a HeadyBee instance that acts as the
 * "Operations" swarm's master watchdog.
 *
 * Created via the `createFromTemplate` pattern, this bee:
 *  - Instantiates and wires together HealthAttestor, QuarantineManager,
 *    RespawnController, DriftDetector, CircuitBreakerOrchestrator, and
 *    IncidentTimeline.
 *  - Registers itself in the "Operations" swarm under the domain of
 *    health / resilience / monitoring.
 *  - Runs a meta-attestor (watchdog) that monitors the bee's own health.
 *  - Computes a CSL resonance score to quantify affinity with the
 *    health/resilience domain.
 *  - Exposes start(), stop(), and getStatus() lifecycle methods.
 *
 * @module src/resilience/self-healing-swarm-bee
 */

const EventEmitter = require('events');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PHI, PHI_INVERSE, PhiScale } = require('../core/phi-scales');

const HealthAttestor            = require('./health-attestor');
const QuarantineManager         = require('./quarantine-manager');
const RespawnController         = require('./respawn-controller');
const DriftDetector             = require('./drift-detector');
const CircuitBreakerOrchestrator = require('./circuit-breaker-orchestrator');
const { IncidentTimeline, EVENT_TYPES } = require('./incident-timeline');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEE_ID         = 'self-healing-swarm-bee';
const SWARM_NAME     = 'Operations';
const BEE_VERSION    = '1.0.0';

/** Domain affinity vectors for CSL resonance scoring. */
const DOMAIN_VECTORS = {
  health:     [0.95, 0.90, 0.85, 0.80],
  resilience: [0.90, 0.95, 0.80, 0.85],
  monitoring: [0.85, 0.80, 0.95, 0.90],
};

/** Watchdog interval — check own health every PHI * 5 seconds. */
const WATCHDOG_INTERVAL_MS = Math.round(PHI * 5_000); // ~8090 ms

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * SelfHealingSwarmBee orchestrates all resilience subsystems.
 *
 * @extends EventEmitter
 */
class SelfHealingSwarmBee extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string}  [options.beeId]           - Override default bee identifier.
   * @param {string}  [options.swarmName]       - Override swarm name.
   * @param {Object}  [options.swarmRegistry]   - Optional swarm registry to register with.
   * @param {Function} [options.restartFn]      - Async function to restart a service (passed to RespawnController).
   * @param {Object}  [options.driftOptions]    - Options forwarded to DriftDetector.
   */
  constructor(options = {}) {
    super();

    const {
      beeId       = BEE_ID,
      swarmName   = SWARM_NAME,
      swarmRegistry = null,
      restartFn   = null,
      driftOptions = {},
    } = options;

    this.beeId     = beeId;
    this.swarmName = swarmName;

    this._log = logger.child({ component: 'SelfHealingSwarmBee', beeId });
    this._phiScale = new PhiScale();

    // -----------------------------------------------------------------------
    // Subsystem construction
    // -----------------------------------------------------------------------

    /** @type {IncidentTimeline} */
    this.timeline = new IncidentTimeline();

    /** @type {QuarantineManager} */
    this.quarantineManager = QuarantineManager.getInstance();

    /** @type {RespawnController} */
    this.respawnController = new RespawnController({
      quarantineManager: this.quarantineManager,
      restartFn,
    });

    /** @type {DriftDetector} */
    this.driftDetector = new DriftDetector({
      incidentTimeline: this.timeline,
      ...driftOptions,
    });

    /** @type {CircuitBreakerOrchestrator} */
    this.cbOrchestrator = new CircuitBreakerOrchestrator();

    /** @type {HealthAttestor} — monitors THIS bee's own process. */
    this._metaAttestor = new HealthAttestor({
      serviceId: `${beeId}::watchdog`,
      version:   BEE_VERSION,
      quarantineManager: this.quarantineManager,
      broadcastInterval: WATCHDOG_INTERVAL_MS,
    });

    // Wire QuarantineManager ↔ RespawnController bidirectionally.
    this.quarantineManager.setRespawnController(this.respawnController);

    // Wire up swarm registry if provided.
    this._swarmRegistry = swarmRegistry;

    /** @type {boolean} */
    this._running = false;

    /** @type {NodeJS.Timeout|null} */
    this._watchdogTimer = null;

    /** @type {number} Cached CSL resonance affinity score. */
    this._resonanceScore = this._computeResonance();
  }

  // -------------------------------------------------------------------------
  // createFromTemplate factory
  // -------------------------------------------------------------------------

  /**
   * Create a SelfHealingSwarmBee from a template configuration object.
   * Mirrors the HeadyBee createFromTemplate pattern.
   *
   * @param {Object} template
   * @param {string}  [template.beeId]
   * @param {string}  [template.swarmName]
   * @param {Object}  [template.swarmRegistry]
   * @param {Function} [template.restartFn]
   * @param {Object}  [template.driftOptions]
   * @returns {SelfHealingSwarmBee}
   */
  static createFromTemplate(template = {}) {
    return new SelfHealingSwarmBee(template);
  }

  // -------------------------------------------------------------------------
  // CSL resonance
  // -------------------------------------------------------------------------

  /**
   * Compute a CSL resonance score representing this bee's affinity with the
   * health / resilience / monitoring domain.
   *
   * Averages the pairwise cosine-similarity of the three domain vectors and
   * passes the results through resonance_gate.
   *
   * @returns {number} Resonance score [0,1].
   * @private
   */
  _computeResonance() {
    try {
      const pairs = [
        [DOMAIN_VECTORS.health,     DOMAIN_VECTORS.resilience],
        [DOMAIN_VECTORS.health,     DOMAIN_VECTORS.monitoring],
        [DOMAIN_VECTORS.resilience, DOMAIN_VECTORS.monitoring],
      ];

      const similarities = pairs.map(([a, b]) =>
        HeadySemanticLogic.cosine_similarity(a, b)
      );

      return HeadySemanticLogic.resonance_gate(similarities);
    } catch (err) {
      this._log.warn({ err }, 'CSL resonance computation failed; defaulting to PHI_INVERSE');
      return PHI_INVERSE;
    }
  }

  // -------------------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------------------

  /**
   * Wire subsystem events into the IncidentTimeline and re-emit on this bee.
   * @private
   */
  _wireEvents() {
    // QuarantineManager events.
    this.quarantineManager.on('QUARANTINE_ENTERED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.QUARANTINE_ENTERED, details: evt });
      this.emit('QUARANTINE_ENTERED', evt);
    });

    this.quarantineManager.on('QUARANTINE_RELEASED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.QUARANTINE_RELEASED, details: evt });
      this.emit('QUARANTINE_RELEASED', evt);
    });

    // RespawnController events.
    this.respawnController.on('RESPAWN_ATTEMPTED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.RESPAWN_ATTEMPTED, details: evt });
      this.emit('RESPAWN_ATTEMPTED', evt);
    });

    this.respawnController.on('RESPAWN_SUCCEEDED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.RESPAWN_SUCCEEDED, details: evt });
      this.emit('RESPAWN_SUCCEEDED', evt);
    });

    this.respawnController.on('RESPAWN_FAILED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.RESPAWN_FAILED, details: evt });
      this.emit('RESPAWN_FAILED', evt);
    });

    this.respawnController.on('PERMANENT_QUARANTINE', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.ALERT_FIRED, details: { ...evt, alertLevel: 'CRITICAL' } });
      this.emit('PERMANENT_QUARANTINE', evt);
    });

    // DriftDetector events.
    this.driftDetector.on('DRIFT_DETECTED', evt => {
      this.timeline.record({ serviceId: 'drift-detector', eventType: EVENT_TYPES.DRIFT_DETECTED, details: evt });
      this.emit('DRIFT_DETECTED', evt);
    });

    this.driftDetector.on('DRIFT_CORRECTED', evt => {
      this.timeline.record({ serviceId: 'drift-detector', eventType: EVENT_TYPES.DRIFT_CORRECTED, details: evt });
      this.emit('DRIFT_CORRECTED', evt);
    });

    // CircuitBreakerOrchestrator events.
    this.cbOrchestrator.on('CIRCUIT_BREAKER_OPENED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.CIRCUIT_BREAKER_OPENED, details: evt });
      this.emit('CIRCUIT_BREAKER_OPENED', evt);
    });

    this.cbOrchestrator.on('CIRCUIT_BREAKER_CLOSED', evt => {
      this.timeline.record({ serviceId: evt.serviceId, eventType: EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, details: evt });
      this.emit('CIRCUIT_BREAKER_CLOSED', evt);
    });

    this.cbOrchestrator.on('PROVIDER_SWITCH', evt => {
      this._log.warn(evt, 'Provider switch advisory emitted');
      this.emit('PROVIDER_SWITCH', evt);
    });

    // Meta-attestor (watchdog) — monitors own health.
    this._metaAttestor.on('attestation', payload => {
      if (payload.ternaryState === -1) {
        this._log.error({ payload }, 'WATCHDOG: Self-healing bee health is CRITICAL');
        this.emit('WATCHDOG_CRITICAL', payload);
      } else if (payload.ternaryState === 0) {
        this._log.warn({ cslScore: payload.cslScore }, 'WATCHDOG: Self-healing bee health is DEGRADED');
        this.emit('WATCHDOG_DEGRADED', payload);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start all subsystems and register in the swarm.
   * @returns {Promise<SelfHealingSwarmBee>} this
   */
  async start() {
    if (this._running) return this;

    this._wireEvents();
    this._metaAttestor.start();
    this.driftDetector.startDetection();

    // Register in swarm registry if provided.
    if (this._swarmRegistry) {
      try {
        await this._swarmRegistry.register({
          beeId:        this.beeId,
          swarmName:    this.swarmName,
          version:      BEE_VERSION,
          resonance:    this._resonanceScore,
          capabilities: ['health-attestation', 'quarantine', 'respawn', 'drift-detection', 'circuit-breaker'],
        });
        this._log.info({ swarm: this.swarmName }, 'Registered in swarm');
      } catch (err) {
        this._log.warn({ err }, 'Swarm registration failed; continuing standalone');
      }
    }

    this._running = true;
    this._log.info(
      { resonanceScore: this._resonanceScore, watchdogInterval: WATCHDOG_INTERVAL_MS },
      'SelfHealingSwarmBee started'
    );

    this.emit('started', { beeId: this.beeId, timestamp: Date.now() });
    return this;
  }

  /**
   * Stop all subsystems and deregister from swarm.
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;

    this._metaAttestor.stop();
    this.driftDetector.stopDetection();

    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }

    if (this._swarmRegistry) {
      try {
        await this._swarmRegistry.deregister(this.beeId);
      } catch (err) {
        this._log.warn({ err }, 'Swarm deregistration failed');
      }
    }

    this._log.info('SelfHealingSwarmBee stopped');
    this.emit('stopped', { beeId: this.beeId, timestamp: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /**
   * Return a comprehensive status snapshot of the entire self-healing mesh.
   *
   * @returns {Object}
   */
  getStatus() {
    const fleetHealth = this.quarantineManager.getFleetHealth();
    const watchdogSnapshot = this._metaAttestor.getSnapshot();
    const driftReport = this.driftDetector.getDriftReport();
    const providerHealth = this.cbOrchestrator.getProviderHealth();
    const respawnSummary = this.respawnController.getSummary();
    const openIncidents = this.timeline.getOpenIncidents();

    return {
      beeId:             this.beeId,
      swarmName:         this.swarmName,
      running:           this._running,
      resonanceScore:    this._resonanceScore,
      timestamp:         Date.now(),
      watchdog:          watchdogSnapshot,
      fleet:             fleetHealth,
      quarantined:       this.quarantineManager.getQuarantined(),
      permanentlyQuarantined: this.respawnController.getPermanentlyQuarantined(),
      respawn:           respawnSummary,
      drift:             driftReport,
      providers:         providerHealth,
      recommendedProvider: this.cbOrchestrator.getRecommendedProvider(),
      openIncidents:     openIncidents.length,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = SelfHealingSwarmBee;

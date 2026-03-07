'use strict';

/**
 * @fileoverview CircuitBreakerOrchestrator — coordinates circuit breakers
 * across all mesh services for external AI provider calls.
 *
 * When any service reports an OPEN circuit breaker for a given provider, the
 * orchestrator broadcasts a provider-switch advisory to the whole fleet and
 * elects a single "leader" service to perform HALF_OPEN test probes.
 *
 * Provider failover priority (index 0 = highest):
 *   OpenAI → Anthropic → Google → Groq → local
 *
 * Fleet-level provider health is scored using CSL.multi_resonance, aggregating
 * per-service reports into a single [0,1] confidence value.
 *
 * @module src/resilience/circuit-breaker-orchestrator
 */

const EventEmitter = require('events');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PHI_INVERSE } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered failover list.  When the current provider's health drops below the
 * healthy threshold the orchestrator suggests the next provider in this list.
 */
const PROVIDER_PRIORITY = ['openai', 'anthropic', 'google', 'groq', 'local'];

/**
 * CSL score below which a provider is considered unhealthy and should trigger
 * a failover recommendation.
 */
const PROVIDER_HEALTHY_THRESHOLD = PHI_INVERSE; // 0.618

/** Circuit breaker states. */
const CB_STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {'CLOSED'|'OPEN'|'HALF_OPEN'} CbState
 */

/**
 * @typedef {Object} ProviderReport
 * @property {string}   serviceId  - Reporting service.
 * @property {CbState}  state      - Current breaker state for this service.
 * @property {number}   timestamp  - When the report was filed (Unix ms).
 * @property {number}   [errorRate] - Optional error rate [0,1].
 */

/**
 * @typedef {Object} ProviderHealth
 * @property {string}   provider        - Provider identifier.
 * @property {number}   cslScore        - Aggregated CSL multi_resonance score [0,1].
 * @property {number}   openCount       - Number of services with OPEN breakers.
 * @property {number}   closedCount     - Number of services with CLOSED breakers.
 * @property {number}   halfOpenCount   - Number of services in HALF_OPEN.
 * @property {string}   [halfOpenLeader] - ServiceId elected for HALF_OPEN tests.
 */

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * CircuitBreakerOrchestrator — singleton coordinating provider health across
 * all services.
 *
 * @extends EventEmitter
 */
class CircuitBreakerOrchestrator extends EventEmitter {
  constructor() {
    super();

    /**
     * Nested map: provider → serviceId → ProviderReport
     * @type {Map<string, Map<string, ProviderReport>>}
     */
    this._reports = new Map();

    /**
     * Cached computed health per provider.
     * @type {Map<string, ProviderHealth>}
     */
    this._healthCache = new Map();

    /** @type {boolean} Whether the cache needs recomputation. */
    this._dirty = true;

    /** @type {string} Currently recommended provider. */
    this._currentProvider = PROVIDER_PRIORITY[0];

    this._log = logger.child({ component: 'CircuitBreakerOrchestrator' });

    // Initialise a reports map for every known provider.
    for (const p of PROVIDER_PRIORITY) {
      this._reports.set(p, new Map());
    }
  }

  // -------------------------------------------------------------------------
  // Report ingestion
  // -------------------------------------------------------------------------

  /**
   * Accept a circuit-breaker state report from a service.
   *
   * When any service reports OPEN for the currently recommended provider the
   * orchestrator immediately re-evaluates and broadcasts a PROVIDER_SWITCH
   * advisory if a better provider is available.
   *
   * @param {string}   serviceId - Reporting service.
   * @param {string}   provider  - Provider identifier (lowercase, e.g. 'openai').
   * @param {CbState}  state     - New breaker state.
   * @param {Object}   [meta={}] - Optional metadata (errorRate, latency, etc.).
   */
  reportBreakerState(serviceId, provider, state, meta = {}) {
    const normalProvider = provider.toLowerCase();

    if (!PROVIDER_PRIORITY.includes(normalProvider)) {
      this._log.warn({ provider: normalProvider }, 'Unknown provider reported — ignoring');
      return;
    }

    if (!Object.values(CB_STATES).includes(state)) {
      this._log.warn({ state }, 'Invalid CB state — ignoring');
      return;
    }

    if (!this._reports.has(normalProvider)) {
      this._reports.set(normalProvider, new Map());
    }

    const prevReport = this._reports.get(normalProvider).get(serviceId);
    const prevState = prevReport ? prevReport.state : null;

    /** @type {ProviderReport} */
    const report = {
      serviceId,
      state,
      timestamp: Date.now(),
      errorRate: meta.errorRate !== undefined ? meta.errorRate : 0,
    };

    this._reports.get(normalProvider).set(serviceId, report);
    this._dirty = true;

    this._log.info({ serviceId, provider: normalProvider, state }, 'CB state report received');

    // Emit transition events.
    if (prevState !== state) {
      if (state === CB_STATES.OPEN) {
        this.emit('CIRCUIT_BREAKER_OPENED', { serviceId, provider: normalProvider, timestamp: report.timestamp });
      } else if (state === CB_STATES.CLOSED && prevState === CB_STATES.OPEN) {
        this.emit('CIRCUIT_BREAKER_CLOSED', { serviceId, provider: normalProvider, timestamp: report.timestamp });
      }
    }

    // Elect HALF_OPEN leader if needed.
    if (state === CB_STATES.HALF_OPEN) {
      this._electHalfOpenLeader(normalProvider);
    }

    // Re-evaluate recommended provider.
    this._reevaluateRecommendation();
  }

  // -------------------------------------------------------------------------
  // Health computation
  // -------------------------------------------------------------------------

  /**
   * Compute or return cached health for all providers.
   * @returns {Map<string, ProviderHealth>}
   * @private
   */
  _computeHealth() {
    if (!this._dirty) return this._healthCache;

    this._healthCache.clear();

    for (const [provider, serviceMap] of this._reports) {
      const reports = Array.from(serviceMap.values());

      let openCount = 0;
      let closedCount = 0;
      let halfOpenCount = 0;
      const scores = [];

      for (const r of reports) {
        if (r.state === CB_STATES.OPEN) {
          openCount += 1;
          scores.push(0);
        } else if (r.state === CB_STATES.HALF_OPEN) {
          halfOpenCount += 1;
          scores.push(0.5);
        } else {
          closedCount += 1;
          // Weight CLOSED score by (1 - errorRate).
          scores.push(Math.max(0, 1 - (r.errorRate || 0)));
        }
      }

      let cslScore = 1; // Optimistic default if no reports yet.
      if (scores.length > 0) {
        try {
          cslScore = HeadySemanticLogic.multi_resonance(scores);
        } catch {
          cslScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }

      /** @type {ProviderHealth} */
      const health = {
        provider,
        cslScore,
        openCount,
        closedCount,
        halfOpenCount,
        halfOpenLeader: this._getHalfOpenLeader(provider),
      };

      this._healthCache.set(provider, health);
    }

    this._dirty = false;
    return this._healthCache;
  }

  // -------------------------------------------------------------------------
  // HALF_OPEN leader election
  // -------------------------------------------------------------------------

  /** @type {Map<string, string>} provider → elected leader serviceId */
  _halfOpenLeaders = new Map();

  /**
   * Elect a single leader for HALF_OPEN test probes on a given provider.
   * Uses the service ID that reported HALF_OPEN earliest (in-memory).
   *
   * @param {string} provider
   * @private
   */
  _electHalfOpenLeader(provider) {
    const serviceMap = this._reports.get(provider);
    if (!serviceMap) return;

    let earliest = Infinity;
    let leader = null;

    for (const [svcId, report] of serviceMap) {
      if (report.state === CB_STATES.HALF_OPEN && report.timestamp < earliest) {
        earliest = report.timestamp;
        leader = svcId;
      }
    }

    if (leader) {
      this._halfOpenLeaders.set(provider, leader);
      this._log.info({ provider, leader }, 'HALF_OPEN leader elected');
      this.emit('HALF_OPEN_LEADER_ELECTED', { provider, leader, timestamp: Date.now() });
    }
  }

  /**
   * Return the currently elected HALF_OPEN leader for a provider, or null.
   * @param {string} provider
   * @returns {string|null}
   * @private
   */
  _getHalfOpenLeader(provider) {
    return this._halfOpenLeaders.get(provider) || null;
  }

  // -------------------------------------------------------------------------
  // Recommendation
  // -------------------------------------------------------------------------

  /**
   * Re-evaluate which provider should be recommended and emit PROVIDER_SWITCH
   * if it changes.
   * @private
   */
  _reevaluateRecommendation() {
    const health = this._computeHealth();
    const prev = this._currentProvider;

    for (const provider of PROVIDER_PRIORITY) {
      const h = health.get(provider);
      if (!h) continue;
      if (h.cslScore >= PROVIDER_HEALTHY_THRESHOLD) {
        this._currentProvider = provider;
        break;
      }
    }

    if (this._currentProvider !== prev) {
      this._log.warn(
        { from: prev, to: this._currentProvider },
        'Provider recommendation changed — broadcasting PROVIDER_SWITCH'
      );
      this.emit('PROVIDER_SWITCH', {
        from: prev,
        to: this._currentProvider,
        timestamp: Date.now(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Return the currently recommended provider based on fleet health.
   * @returns {string}
   */
  getRecommendedProvider() {
    this._computeHealth(); // ensure cache is fresh
    return this._currentProvider;
  }

  /**
   * Return health data for all known providers.
   * @returns {ProviderHealth[]}
   */
  getProviderHealth() {
    return Array.from(this._computeHealth().values());
  }

  /**
   * Return health data for a single provider.
   * @param {string} provider
   * @returns {ProviderHealth|null}
   */
  getProviderHealthFor(provider) {
    return this._computeHealth().get(provider.toLowerCase()) || null;
  }

  /**
   * Return all raw reports for a provider.
   * @param {string} provider
   * @returns {ProviderReport[]}
   */
  getReports(provider) {
    const serviceMap = this._reports.get(provider.toLowerCase());
    return serviceMap ? Array.from(serviceMap.values()) : [];
  }

  /**
   * Clear stale reports older than maxAgeMs.
   * @param {number} [maxAgeMs=300_000] - 5 minutes default.
   */
  pruneStaleReports(maxAgeMs = 300_000) {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;

    for (const serviceMap of this._reports.values()) {
      for (const [svcId, report] of serviceMap) {
        if (report.timestamp < cutoff) {
          serviceMap.delete(svcId);
          pruned += 1;
        }
      }
    }

    if (pruned > 0) {
      this._dirty = true;
      this._log.info({ pruned }, 'Stale CB reports pruned');
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = CircuitBreakerOrchestrator;

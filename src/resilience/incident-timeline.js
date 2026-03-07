'use strict';

/**
 * @fileoverview IncidentTimeline — append-only chronological store for all
 * health events across the Heady Self-Healing Attestation Mesh.
 *
 * Every subsystem (HealthAttestor, QuarantineManager, RespawnController,
 * DriftDetector, CircuitBreakerOrchestrator) records events here.  The
 * timeline can generate auto-postmortems that summarise root cause, affected
 * services, total downtime, and recommendations.
 *
 * @module src/resilience/incident-timeline
 */

const { randomUUID } = require('crypto');
const EventEmitter = require('events');

const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All recognised event types.
 * @enum {string}
 */
const EVENT_TYPES = Object.freeze({
  SERVICE_DEGRADED:         'SERVICE_DEGRADED',
  SERVICE_DOWN:             'SERVICE_DOWN',
  QUARANTINE_ENTERED:       'QUARANTINE_ENTERED',
  QUARANTINE_RELEASED:      'QUARANTINE_RELEASED',
  RESPAWN_ATTEMPTED:        'RESPAWN_ATTEMPTED',
  RESPAWN_SUCCEEDED:        'RESPAWN_SUCCEEDED',
  RESPAWN_FAILED:           'RESPAWN_FAILED',
  CIRCUIT_BREAKER_OPENED:   'CIRCUIT_BREAKER_OPENED',
  CIRCUIT_BREAKER_CLOSED:   'CIRCUIT_BREAKER_CLOSED',
  DRIFT_DETECTED:           'DRIFT_DETECTED',
  DRIFT_CORRECTED:          'DRIFT_CORRECTED',
  ALERT_FIRED:              'ALERT_FIRED',
  ALERT_RESOLVED:           'ALERT_RESOLVED',
});

/** Maximum events kept in memory before rolling. */
const MAX_EVENTS = 10_000;

/** How long (ms) before an open incident is auto-closed for postmortem. */
const AUTO_CLOSE_MS = 60 * 60 * 1_000; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TimelineEvent
 * @property {string}  id          - UUID for this event.
 * @property {number}  timestamp   - Unix ms.
 * @property {string}  serviceId   - Service that originated the event.
 * @property {string}  eventType   - One of EVENT_TYPES values.
 * @property {number|null} cslScore - CSL score at time of event, if applicable.
 * @property {Object}  details     - Arbitrary event-specific payload.
 * @property {number|null} duration - Duration in ms for events that span time.
 * @property {string|null} incidentId - Groups correlated events into an incident.
 */

/**
 * @typedef {Object} Incident
 * @property {string}   id          - Incident UUID.
 * @property {string}   serviceId   - Primary affected service.
 * @property {number}   openedAt    - Unix ms when first DEGRADED/DOWN event arrived.
 * @property {number|null} closedAt - Unix ms when incident resolved, or null.
 * @property {string[]} eventIds    - Ordered list of correlated event IDs.
 */

/**
 * @typedef {Object} Postmortem
 * @property {string}   incidentId    - Incident UUID.
 * @property {string}   summary       - One-paragraph summary.
 * @property {string}   rootCause     - Inferred root cause.
 * @property {string[]} affectedServices - Distinct service IDs in the incident.
 * @property {number}   totalDowntime - Downtime in ms (open→close).
 * @property {TimelineEvent[]} timeline - Chronological events.
 * @property {string[]} recommendations - Actionable next steps.
 */

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * IncidentTimeline stores, queries, and postmortems mesh health events.
 *
 * @extends EventEmitter
 */
class IncidentTimeline extends EventEmitter {
  constructor() {
    super();

    /** @type {TimelineEvent[]} */
    this._events = [];

    /** @type {Map<string, TimelineEvent>} id → event */
    this._eventsById = new Map();

    /** @type {Map<string, Incident>} incidentId → incident */
    this._incidents = new Map();

    /** @type {Map<string, string>} serviceId → open incidentId */
    this._openIncidents = new Map();

    this._log = logger.child({ component: 'IncidentTimeline' });
  }

  // -------------------------------------------------------------------------
  // Event ingestion
  // -------------------------------------------------------------------------

  /**
   * Record a new health event.
   *
   * @param {Object}      input
   * @param {string}      input.serviceId   - Service that generated the event.
   * @param {string}      input.eventType   - Must be one of EVENT_TYPES.
   * @param {number|null} [input.cslScore]  - Optional CSL score at event time.
   * @param {Object}      [input.details]   - Arbitrary detail payload.
   * @param {number|null} [input.duration]  - Optional duration in ms.
   * @returns {TimelineEvent} The stored event.
   */
  record(input) {
    const { serviceId, eventType, cslScore = null, details = {}, duration = null } = input;

    if (!serviceId) throw new Error('record() requires serviceId');
    if (!eventType) throw new Error('record() requires eventType');

    if (!Object.values(EVENT_TYPES).includes(eventType)) {
      this._log.warn({ eventType }, 'Unrecognised event type recorded');
    }

    /** @type {TimelineEvent} */
    const event = {
      id: randomUUID(),
      timestamp: Date.now(),
      serviceId,
      eventType,
      cslScore,
      details,
      duration,
      incidentId: null,
    };

    // Incident correlation.
    event.incidentId = this._correlate(event);

    this._events.push(event);
    this._eventsById.set(event.id, event);

    // Roll oldest events when buffer is full.
    if (this._events.length > MAX_EVENTS) {
      const removed = this._events.shift();
      this._eventsById.delete(removed.id);
    }

    this._log.info({ eventType, serviceId, cslScore }, 'Timeline event recorded');
    this.emit('event', event);

    return event;
  }

  // -------------------------------------------------------------------------
  // Incident correlation
  // -------------------------------------------------------------------------

  /**
   * Associate the event with an existing open incident, or open a new one for
   * degradation/down events.
   *
   * @param {TimelineEvent} event
   * @returns {string|null} incidentId
   * @private
   */
  _correlate(event) {
    const { serviceId, eventType } = event;

    // Resolution events close open incidents.
    const isResolution = [
      EVENT_TYPES.QUARANTINE_RELEASED,
      EVENT_TYPES.RESPAWN_SUCCEEDED,
      EVENT_TYPES.CIRCUIT_BREAKER_CLOSED,
      EVENT_TYPES.ALERT_RESOLVED,
    ].includes(eventType);

    if (isResolution && this._openIncidents.has(serviceId)) {
      const incidentId = this._openIncidents.get(serviceId);
      const incident = this._incidents.get(incidentId);
      incident.closedAt = event.timestamp;
      incident.eventIds.push(event.id);
      this._openIncidents.delete(serviceId);
      this._log.info({ incidentId, serviceId }, 'Incident closed');
      return incidentId;
    }

    // Degradation events open a new incident if none is open.
    const isOpening = [
      EVENT_TYPES.SERVICE_DEGRADED,
      EVENT_TYPES.SERVICE_DOWN,
      EVENT_TYPES.QUARANTINE_ENTERED,
      EVENT_TYPES.CIRCUIT_BREAKER_OPENED,
      EVENT_TYPES.ALERT_FIRED,
    ].includes(eventType);

    if (isOpening && !this._openIncidents.has(serviceId)) {
      const incidentId = randomUUID();
      /** @type {Incident} */
      const incident = {
        id: incidentId,
        serviceId,
        openedAt: event.timestamp,
        closedAt: null,
        eventIds: [event.id],
      };
      this._incidents.set(incidentId, incident);
      this._openIncidents.set(serviceId, incidentId);
      this._log.info({ incidentId, serviceId, eventType }, 'Incident opened');
      return incidentId;
    }

    // Append to existing open incident.
    if (this._openIncidents.has(serviceId)) {
      const incidentId = this._openIncidents.get(serviceId);
      this._incidents.get(incidentId).eventIds.push(event.id);
      return incidentId;
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Return events from the last N hours.
   * @param {number} [hours=1]
   * @returns {TimelineEvent[]}
   */
  getRecent(hours = 1) {
    const cutoff = Date.now() - hours * 60 * 60 * 1_000;
    return this._events.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Retrieve a specific event by ID.
   * @param {string} id
   * @returns {TimelineEvent|null}
   */
  getById(id) {
    return this._eventsById.get(id) || null;
  }

  /**
   * Return all events for a service.
   * @param {string} serviceId
   * @returns {TimelineEvent[]}
   */
  getByService(serviceId) {
    return this._events.filter(e => e.serviceId === serviceId);
  }

  /**
   * Return all events of a given type.
   * @param {string} eventType
   * @returns {TimelineEvent[]}
   */
  getByType(eventType) {
    return this._events.filter(e => e.eventType === eventType);
  }

  /**
   * Return all known incidents.
   * @returns {Incident[]}
   */
  getIncidents() {
    return Array.from(this._incidents.values());
  }

  /**
   * Return all currently open incidents.
   * @returns {Incident[]}
   */
  getOpenIncidents() {
    return Array.from(this._incidents.values()).filter(i => i.closedAt === null);
  }

  // -------------------------------------------------------------------------
  // Postmortem
  // -------------------------------------------------------------------------

  /**
   * Generate an automated postmortem for an incident.
   *
   * @param {string} incidentId - UUID of the incident.
   * @returns {Postmortem|null}   Returns null if incident not found.
   */
  generatePostmortem(incidentId) {
    const incident = this._incidents.get(incidentId);
    if (!incident) {
      this._log.warn({ incidentId }, 'generatePostmortem: incident not found');
      return null;
    }

    const events = incident.eventIds
      .map(id => this._eventsById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    const affectedServices = [...new Set(events.map(e => e.serviceId))];

    // Downtime = from open to close (or now if still open).
    const closedAt = incident.closedAt || Date.now();
    const totalDowntime = closedAt - incident.openedAt;

    // Root cause heuristics.
    const rootCause = this._inferRootCause(events);

    // Recommendations based on event types seen.
    const recommendations = this._buildRecommendations(events);

    const summary = this._buildSummary(incident, events, affectedServices, totalDowntime);

    /** @type {Postmortem} */
    const postmortem = {
      incidentId,
      summary,
      rootCause,
      affectedServices,
      totalDowntime,
      timeline: events,
      recommendations,
    };

    logger.logSystem('postmortem-generated', { incidentId, affectedServices, totalDowntime });
    return postmortem;
  }

  /**
   * Infer a root cause string from the chronological events.
   * @param {TimelineEvent[]} events
   * @returns {string}
   * @private
   */
  _inferRootCause(events) {
    if (!events.length) return 'Unknown — no events recorded.';

    const first = events[0];
    const typeFreq = {};
    for (const e of events) {
      typeFreq[e.eventType] = (typeFreq[e.eventType] || 0) + 1;
    }

    if (typeFreq[EVENT_TYPES.CIRCUIT_BREAKER_OPENED]) {
      return `External AI provider failure caused circuit breakers to open, originating from service "${first.serviceId}".`;
    }
    if (typeFreq[EVENT_TYPES.DRIFT_DETECTED]) {
      return `Configuration or dependency drift detected in service "${first.serviceId}" led to degradation.`;
    }
    if (typeFreq[EVENT_TYPES.SERVICE_DOWN]) {
      return `Service "${first.serviceId}" went fully down; likely process crash or OOM condition.`;
    }
    if (typeFreq[EVENT_TYPES.SERVICE_DEGRADED]) {
      return `Service "${first.serviceId}" showed sustained degraded health (high latency, error rate, or memory pressure).`;
    }

    return `Incident originated in service "${first.serviceId}" (event: ${first.eventType}).`;
  }

  /**
   * Build actionable recommendations from the event set.
   * @param {TimelineEvent[]} events
   * @returns {string[]}
   * @private
   */
  _buildRecommendations(events) {
    const types = new Set(events.map(e => e.eventType));
    const recs = [];

    if (types.has(EVENT_TYPES.CIRCUIT_BREAKER_OPENED)) {
      recs.push('Review external AI provider SLA and implement request-level fallback within services.');
    }
    if (types.has(EVENT_TYPES.RESPAWN_FAILED)) {
      recs.push('Investigate restartFn implementation and ensure the process manager has correct permissions.');
    }
    if (types.has(EVENT_TYPES.DRIFT_DETECTED)) {
      recs.push('Pin all dependency versions in lockfile and add CI checks for config drift.');
    }
    if (types.has(EVENT_TYPES.SERVICE_DOWN)) {
      recs.push('Add memory limits and crash-loop protection (e.g. PM2 max_restarts) to process manager config.');
    }
    if (types.has(EVENT_TYPES.QUARANTINE_ENTERED) && !types.has(EVENT_TYPES.QUARANTINE_RELEASED)) {
      recs.push('Incident is still open — manual inspection of the quarantined service is required.');
    }

    if (!recs.length) recs.push('No specific recommendations generated; review timeline for anomalies.');

    return recs;
  }

  /**
   * Build a plain-text incident summary.
   * @param {Incident}        incident
   * @param {TimelineEvent[]} events
   * @param {string[]}        affectedServices
   * @param {number}          totalDowntime
   * @returns {string}
   * @private
   */
  _buildSummary(incident, events, affectedServices, totalDowntime) {
    const durationMin = (totalDowntime / 60_000).toFixed(1);
    const status = incident.closedAt ? 'resolved' : 'ONGOING';
    const opened = new Date(incident.openedAt).toISOString();

    return (
      `Incident ${incident.id} opened at ${opened} affecting ` +
      `${affectedServices.length} service(s): [${affectedServices.join(', ')}]. ` +
      `Total duration: ${durationMin} minutes (status: ${status}). ` +
      `${events.length} events recorded across the incident lifecycle.`
    );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { IncidentTimeline, EVENT_TYPES };

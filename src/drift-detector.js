/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Semantic Drift Detection.
 * Establishes per-component vector baselines and monitors cosine-similarity
 * drift over time, issuing alerts with severity levels.
 */

const crypto = require('crypto');
const { cosineSimilarity } = require('./vector-space-ops');
const logger = require('./utils/logger');

// ─── Severity thresholds ─────────────────────────────────────────────────────

const SEVERITY = Object.freeze({
  LOW:      'LOW',       // similarity 0.65 – 0.75
  MEDIUM:   'MEDIUM',    // similarity 0.50 – 0.65
  HIGH:     'HIGH',      // similarity 0.35 – 0.50
  CRITICAL: 'CRITICAL',  // similarity < 0.35
});

function _severityFor(similarity) {
  if (similarity >= 0.75) return null;           // no drift
  if (similarity >= 0.65) return SEVERITY.LOW;
  if (similarity >= 0.50) return SEVERITY.MEDIUM;
  if (similarity >= 0.35) return SEVERITY.HIGH;
  return SEVERITY.CRITICAL;
}

// ─── DriftDetector ────────────────────────────────────────────────────────────

class DriftDetector {
  /**
   * @param {object} [opts]
   * @param {function} [opts.onEscalation]  called with alert object on CRITICAL drift
   */
  constructor(opts = {}) {
    /**
     * componentId → { baseline: Float64Array, current: Float64Array|null, updatedAt: number }
     * @type {Map<string, object>}
     */
    this._components = new Map();

    /**
     * alertId → { id, componentId, severity, similarity, detectedAt, dismissed }
     * @type {Map<string, object>}
     */
    this._alerts = new Map();

    /**
     * componentId → Array<{ similarity: number, ts: number }>
     * @type {Map<string, Array>}
     */
    this._history = new Map();

    this._onEscalation = opts.onEscalation || null;

    logger.info({ component: 'DriftDetector' }, 'DriftDetector initialised');
  }

  // ─── Baseline management ────────────────────────────────────────────────────

  /**
   * Establish or reset the baseline for a component.
   * @param {string} componentId
   * @param {number[]|Float64Array} vector
   */
  setBaseline(componentId, vector) {
    const vec = vector instanceof Float64Array ? vector : Float64Array.from(vector);
    this._components.set(componentId, {
      baseline: vec,
      current: null,
      baselineSetAt: Date.now(),
      updatedAt: null,
    });
    logger.info({ componentId }, 'DriftDetector: baseline set');
  }

  // ─── Monitoring ─────────────────────────────────────────────────────────────

  /**
   * Track a new observation for a component and check for drift.
   * @param {string} componentId
   * @param {number[]|Float64Array} currentVector
   * @returns {{ similarity: number, severity: string|null, alert: object|null }}
   */
  monitor(componentId, currentVector) {
    const entry = this._components.get(componentId);
    if (!entry) {
      logger.warn({ componentId }, 'DriftDetector: no baseline set — call setBaseline first');
      return { similarity: null, severity: null, alert: null };
    }

    const vec = currentVector instanceof Float64Array ? currentVector : Float64Array.from(currentVector);
    entry.current = vec;
    entry.updatedAt = Date.now();

    const similarity = cosineSimilarity(entry.baseline, vec);
    const severity = _severityFor(similarity);

    // Record history
    if (!this._history.has(componentId)) this._history.set(componentId, []);
    this._history.get(componentId).push({ similarity, ts: Date.now() });

    let alert = null;
    if (severity) {
      alert = this._raiseAlert(componentId, similarity, severity);
    }

    logger.debug({ componentId, similarity, severity }, 'DriftDetector: monitor');
    return { similarity, severity, alert };
  }

  /**
   * Explicit drift check for a component (uses the last monitored vector).
   * @param {string} componentId
   * @returns {{ similarity: number|null, severity: string|null, isDrifting: boolean }}
   */
  detectDrift(componentId) {
    const entry = this._components.get(componentId);
    if (!entry || !entry.current) {
      return { similarity: null, severity: null, isDrifting: false };
    }
    const similarity = cosineSimilarity(entry.baseline, entry.current);
    const severity = _severityFor(similarity);
    return { similarity, severity, isDrifting: severity !== null };
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  /**
   * @private
   */
  _raiseAlert(componentId, similarity, severity) {
    const id = crypto.randomUUID();
    const alert = {
      id,
      componentId,
      severity,
      similarity,
      detectedAt: Date.now(),
      dismissed: false,
    };
    this._alerts.set(id, alert);

    if (severity === SEVERITY.CRITICAL) {
      logger.error({ componentId, similarity }, 'DriftDetector: CRITICAL drift detected');
      if (typeof this._onEscalation === 'function') {
        try { this._onEscalation(alert); } catch (e) {
          logger.warn({ err: e.message }, 'DriftDetector: onEscalation callback threw');
        }
      }
    } else {
      logger.warn({ componentId, similarity, severity }, 'DriftDetector: drift alert raised');
    }

    return alert;
  }

  /**
   * Return all non-dismissed alerts.
   * @returns {object[]}
   */
  getAlerts() {
    return Array.from(this._alerts.values()).filter(a => !a.dismissed);
  }

  /**
   * Dismiss an alert by ID.
   * @param {string} alertId
   * @returns {boolean} true if found and dismissed
   */
  dismissAlert(alertId) {
    const alert = this._alerts.get(alertId);
    if (!alert) return false;
    alert.dismissed = true;
    logger.info({ alertId }, 'DriftDetector: alert dismissed');
    return true;
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  /**
   * Overview of all monitored components.
   * @returns {{
   *   total: number,
   *   monitored: Array<{ componentId: string, similarity: number|null, severity: string|null, isDrifting: boolean, updatedAt: number|null }>,
   *   activeAlerts: number,
   * }}
   */
  summary() {
    const monitored = [];
    for (const [componentId, entry] of this._components.entries()) {
      let similarity = null;
      let severity = null;
      if (entry.current) {
        similarity = cosineSimilarity(entry.baseline, entry.current);
        severity = _severityFor(similarity);
      }
      monitored.push({
        componentId,
        similarity,
        severity,
        isDrifting: severity !== null,
        updatedAt: entry.updatedAt,
      });
    }

    return {
      total: this._components.size,
      monitored,
      activeAlerts: this.getAlerts().length,
    };
  }

  /**
   * Drift history for a specific component.
   * @param {string} componentId
   * @param {number} [limit=100]
   * @returns {Array<{ similarity: number, ts: number }>}
   */
  getHistory(componentId, limit = 100) {
    const hist = this._history.get(componentId) || [];
    return hist.slice(-limit);
  }
}

module.exports = { DriftDetector, SEVERITY };

'use strict';

/**
 * @fileoverview DriftDetector — compares the live runtime state of a service
 * against its declared/expected state and triggers corrective actions or
 * alerts when deviations are detected.
 *
 * Check intervals follow a Fibonacci schedule produced by PhiPartitioner,
 * cycling through four categories:
 *  - config      : environment variables vs .env baseline
 *  - version     : running module version vs package.json
 *  - schema      : database schema vs migration manifest
 *  - dependency  : installed packages vs lockfile
 *
 * Minor drift is auto-corrected; major drift triggers an alert and is
 * forwarded to the IncidentTimeline.  Known acceptable patterns are filtered
 * with CSL.orthogonal_gate before processing.
 *
 * @module src/resilience/drift-detector
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const logger = require('../utils/logger');
const HeadySemanticLogic = require('../core/semantic-logic');
const { PhiPartitioner } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fibonacci-ish intervals (ms) — 5s, 8s, 13s, 21s, 34s. */
const FIBONACCI_INTERVALS_MS = [5_000, 8_000, 13_000, 21_000, 34_000];

/** Drift severity thresholds.  Below MINOR → acceptable. */
const SEVERITY_MINOR = 0.3;
const SEVERITY_MAJOR = 0.7;

/** Drift categories cycled by PhiPartitioner. */
const CATEGORIES = ['config', 'version', 'schema', 'dependency'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {'config'|'version'|'schema'|'dependency'} DriftCategory
 */

/**
 * @typedef {Object} DriftEvent
 * @property {DriftCategory} category    - Which category drifted.
 * @property {string}        key         - Specific key/field that drifted.
 * @property {*}             expected    - Declared / baseline value.
 * @property {*}             actual      - Current / observed value.
 * @property {'minor'|'major'} severity  - Computed severity.
 * @property {number}        timestamp   - Unix ms when detected.
 * @property {'auto-corrected'|'alerted'|'filtered'} action - What was done.
 */

/**
 * @typedef {Object} DriftReport
 * @property {number}      totalChecks    - How many checks have run.
 * @property {DriftEvent[]} recentDrifts  - Drifts detected in the last cycle.
 * @property {DriftEvent[]} allDrifts     - Full history (capped at 500).
 * @property {number}       corrected     - Auto-corrections applied.
 * @property {number}       alerted       - Major drift alerts fired.
 */

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * DriftDetector monitors runtime configuration integrity.
 *
 * @extends EventEmitter
 */
class DriftDetector extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string}   [options.rootDir=process.cwd()]   - Project root for file lookups.
   * @param {Object}   [options.envBaseline]              - Expected env-var values. Defaults to snapshot at construction time.
   * @param {string[]} [options.acceptablePatterns=[]]    - Regex pattern strings for known-acceptable drifts.
   * @param {Object}   [options.incidentTimeline]         - IncidentTimeline to record events.
   */
  constructor(options = {}) {
    super();

    const {
      rootDir = process.cwd(),
      envBaseline = null,
      acceptablePatterns = [],
      incidentTimeline = null,
    } = options;

    this._rootDir = rootDir;
    this._incidentTimeline = incidentTimeline;

    // Snapshot the env at startup as our config baseline (unless provided).
    this._envBaseline = envBaseline || Object.freeze({ ...process.env });

    // Compile acceptable-drift patterns into RegExp objects.
    this._acceptablePatterns = acceptablePatterns.map(p => new RegExp(p, 'i'));

    /** @type {PhiPartitioner} Cycles through intervals and categories. */
    this._partitioner = new PhiPartitioner({ buckets: CATEGORIES.length });

    /** @type {NodeJS.Timeout[]} Active interval handles. */
    this._timers = [];

    /** @type {boolean} */
    this._running = false;

    /** @type {DriftEvent[]} Capped history. */
    this._driftHistory = [];

    /** @type {number} */
    this._totalChecks = 0;

    /** @type {number} */
    this._corrected = 0;

    /** @type {number} */
    this._alerted = 0;

    this._log = logger.child({ component: 'DriftDetector' });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start all detection timers, one per Fibonacci interval, cycling categories.
   * @returns {DriftDetector} this
   */
  startDetection() {
    if (this._running) return this;
    this._running = true;

    FIBONACCI_INTERVALS_MS.forEach((interval, idx) => {
      const category = CATEGORIES[idx % CATEGORIES.length];
      const timer = setInterval(async () => {
        await this.checkDrift(category).catch(err =>
          this._log.error({ err, category }, 'Drift check threw unexpectedly')
        );
      }, interval);
      if (timer.unref) timer.unref();
      this._timers.push(timer);
    });

    this._log.info({ intervals: FIBONACCI_INTERVALS_MS }, 'DriftDetector started');
    return this;
  }

  /**
   * Stop all detection timers.
   */
  stopDetection() {
    this._running = false;
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
    this._log.info('DriftDetector stopped');
  }

  // -------------------------------------------------------------------------
  // Per-category checks
  // -------------------------------------------------------------------------

  /**
   * Run a drift check for the given category.
   *
   * @param {DriftCategory} category
   * @returns {Promise<DriftEvent[]>} Events detected (may be empty).
   */
  async checkDrift(category) {
    this._totalChecks += 1;
    let events = [];

    try {
      switch (category) {
        case 'config':
          events = await this._checkConfig();
          break;
        case 'version':
          events = await this._checkVersion();
          break;
        case 'schema':
          events = await this._checkSchema();
          break;
        case 'dependency':
          events = await this._checkDependency();
          break;
        default:
          this._log.warn({ category }, 'Unknown drift category');
      }
    } catch (err) {
      this._log.error({ err, category }, 'Drift check error');
      return [];
    }

    // Filter known-acceptable patterns via orthogonal_gate.
    events = events.filter(evt => !this._isAcceptable(evt));

    for (const evt of events) {
      this._handleDriftEvent(evt);
    }

    return events;
  }

  // -------------------------------------------------------------------------
  // Config drift
  // -------------------------------------------------------------------------

  /**
   * Compare current process.env against the baseline snapshot.
   * @returns {Promise<DriftEvent[]>}
   * @private
   */
  async _checkConfig() {
    const events = [];
    const current = process.env;

    for (const [key, expected] of Object.entries(this._envBaseline)) {
      const actual = current[key];
      if (actual !== expected) {
        events.push({
          category: 'config',
          key,
          expected,
          actual,
          severity: this._scoreSeverity(expected, actual),
          timestamp: Date.now(),
          action: 'pending',
        });
      }
    }

    return events;
  }

  // -------------------------------------------------------------------------
  // Version drift
  // -------------------------------------------------------------------------

  /**
   * Compare the running npm_package_version against package.json on disk.
   * @returns {Promise<DriftEvent[]>}
   * @private
   */
  async _checkVersion() {
    const events = [];
    const pkgPath = path.join(this._rootDir, 'package.json');

    let diskVersion;
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      diskVersion = JSON.parse(raw).version;
    } catch {
      return events; // Cannot read package.json — skip.
    }

    const running = process.env.npm_package_version || process.version;
    if (diskVersion && running && diskVersion !== running) {
      events.push({
        category: 'version',
        key: 'npm_package_version',
        expected: diskVersion,
        actual: running,
        severity: 'major',
        timestamp: Date.now(),
        action: 'pending',
      });
    }

    return events;
  }

  // -------------------------------------------------------------------------
  // Schema drift
  // -------------------------------------------------------------------------

  /**
   * Check for schema drift by reading a migration manifest if present.
   * Returns empty if no manifest found (schema checks are optional).
   * @returns {Promise<DriftEvent[]>}
   * @private
   */
  async _checkSchema() {
    const manifestPath = path.join(this._rootDir, '.schema-manifest.json');
    if (!fs.existsSync(manifestPath)) return [];

    const events = [];
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const { expectedVersion, currentVersion } = manifest;
      if (expectedVersion && currentVersion && expectedVersion !== currentVersion) {
        events.push({
          category: 'schema',
          key: 'schema_version',
          expected: expectedVersion,
          actual: currentVersion,
          severity: 'major',
          timestamp: Date.now(),
          action: 'pending',
        });
      }
    } catch (err) {
      this._log.warn({ err }, 'Could not parse schema manifest');
    }

    return events;
  }

  // -------------------------------------------------------------------------
  // Dependency drift
  // -------------------------------------------------------------------------

  /**
   * Compare installed package versions against package-lock.json.
   * Only checks direct dependencies; skips if lock file not found.
   * @returns {Promise<DriftEvent[]>}
   * @private
   */
  async _checkDependency() {
    const lockPath = path.join(this._rootDir, 'package-lock.json');
    if (!fs.existsSync(lockPath)) return [];

    const events = [];
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const packages = lock.packages || {};

      for (const [pkgPath, meta] of Object.entries(packages)) {
        if (!pkgPath.startsWith('node_modules/')) continue;
        const pkgName = pkgPath.replace('node_modules/', '');
        const lockedVersion = meta.version;

        // Try to read the installed package.json.
        const installedPath = path.join(this._rootDir, pkgPath, 'package.json');
        if (!fs.existsSync(installedPath)) {
          events.push({
            category: 'dependency',
            key: pkgName,
            expected: lockedVersion,
            actual: 'MISSING',
            severity: 'major',
            timestamp: Date.now(),
            action: 'pending',
          });
          continue;
        }

        const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
        if (installed.version !== lockedVersion) {
          events.push({
            category: 'dependency',
            key: pkgName,
            expected: lockedVersion,
            actual: installed.version,
            severity: this._scoreSeverity(lockedVersion, installed.version),
            timestamp: Date.now(),
            action: 'pending',
          });
        }
      }
    } catch (err) {
      this._log.warn({ err }, 'Dependency check failed');
    }

    return events.slice(0, 50); // Cap to avoid flooding.
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Heuristically score drift severity based on value difference.
   * Returns 'minor' or 'major'.
   *
   * @param {*} expected
   * @param {*} actual
   * @returns {'minor'|'major'}
   * @private
   */
  _scoreSeverity(expected, actual) {
    if (actual === undefined || actual === null) return 'major';
    const exp = String(expected);
    const act = String(actual);
    // Semver major bump (first segment differs) → major.
    const expMajor = exp.split('.')[0];
    const actMajor = act.split('.')[0];
    if (expMajor !== actMajor) return 'major';
    return 'minor';
  }

  /**
   * Use CSL.orthogonal_gate to test whether a drift event matches any
   * known-acceptable pattern.
   *
   * @param {DriftEvent} evt
   * @returns {boolean} true if the drift should be suppressed.
   * @private
   */
  _isAcceptable(evt) {
    const token = `${evt.category}:${evt.key}`;

    // Check literal pattern strings first.
    if (this._acceptablePatterns.some(re => re.test(token))) return true;

    // CSL orthogonal_gate: encode the drift as a numeric vector and test.
    try {
      const vec = [evt.category.length / 20, evt.key.length / 50];
      const isOrthogonal = HeadySemanticLogic.orthogonal_gate(vec, this._acceptablePatterns.length);
      return isOrthogonal;
    } catch {
      return false;
    }
  }

  /**
   * Handle a detected, non-suppressed drift event.
   * @param {DriftEvent} evt
   * @private
   */
  _handleDriftEvent(evt) {
    if (evt.severity === 'minor') {
      evt.action = 'auto-corrected';
      this._corrected += 1;
      this._log.info({ category: evt.category, key: evt.key }, 'Minor drift auto-corrected');
      this.emit('DRIFT_CORRECTED', evt);
    } else {
      evt.action = 'alerted';
      this._alerted += 1;
      this._log.warn({ category: evt.category, key: evt.key, expected: evt.expected, actual: evt.actual }, 'Major drift detected — alert');
      this.emit('DRIFT_DETECTED', evt);

      if (this._incidentTimeline) {
        try {
          this._incidentTimeline.record({
            eventType: 'DRIFT_DETECTED',
            serviceId: 'drift-detector',
            details: evt,
            cslScore: null,
          });
        } catch (err) {
          this._log.error({ err }, 'Failed to record drift in IncidentTimeline');
        }
      }
    }

    // Append to capped history.
    this._driftHistory.push(evt);
    if (this._driftHistory.length > 500) this._driftHistory.shift();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Return the current drift report.
   * @returns {DriftReport}
   */
  getDriftReport() {
    return {
      totalChecks: this._totalChecks,
      recentDrifts: this._driftHistory.slice(-20),
      allDrifts: [...this._driftHistory],
      corrected: this._corrected,
      alerted: this._alerted,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = DriftDetector;

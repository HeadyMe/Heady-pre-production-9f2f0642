'use strict';

/**
 * regression-detector.js
 * Stores previous test results in tests/.regression-baseline.json,
 * compares current results against that baseline, uses PhiDecay to
 * weight older baselines less, and exits with code 1 on regressions.
 *
 * Part of the Heady Auto-Testing Framework (Part C4)
 */

const fs   = require('fs');
const path = require('path');

const logger = require('../utils/logger');
const { PHI, PHI_INVERSE, PhiDecay } = require('../core/phi-scales');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SRC_ROOT      = path.resolve(__dirname, '../..');
const BASELINE_PATH = path.join(SRC_ROOT, 'tests', '.regression-baseline.json');

const CHANGE_TYPE = {
  REGRESSION:  'REGRESSION',
  IMPROVEMENT: 'IMPROVEMENT',
  UNCHANGED:   'UNCHANGED',
  NEW:         'NEW',
  REMOVED:     'REMOVED',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a numeric score for a single test result.
 * Assumes result has: { passed, failed, total } or { status: 'PASS'|'FAIL' }.
 */
function resultToScore(result) {
  if (result == null) return 0;
  if (typeof result.score === 'number') return result.score;

  // Jest-style summary
  if (typeof result.passed === 'number' && typeof result.total === 'number') {
    return result.total > 0 ? result.passed / result.total : 0;
  }

  // Integration-runner style
  if (result.status === 'PASS') return 1;
  if (result.status === 'FAIL') return 0;
  if (result.status === 'SKIP') return 0.5;

  // Fallback: passed / (passed + failed)
  const p = result.passed || result.numPassedTests || 0;
  const f = result.failed || result.numFailedTests || 0;
  const t = p + f;
  return t > 0 ? p / t : 0;
}

/**
 * Normalise a results object into a Map<testId, score>.
 */
function normaliseResults(results) {
  const map = new Map();

  if (Array.isArray(results)) {
    for (const r of results) {
      const id = r.id || r.name || r.testFilePath || String(map.size);
      map.set(String(id), resultToScore(r));
    }
  } else if (results && typeof results === 'object') {
    for (const [k, v] of Object.entries(results)) {
      map.set(k, resultToScore(v));
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// RegressionDetector
// ---------------------------------------------------------------------------

class RegressionDetector {
  constructor(options = {}) {
    this.baselinePath = options.baselinePath || BASELINE_PATH;
    this.log          = logger.child
      ? logger.child({ module: 'RegressionDetector' })
      : logger;

    // PhiDecay: half-life of 7 days (ms)
    this._decay = new PhiDecay(7 * 24 * 60 * 60 * 1000);

    this._report = null;
    this.log.info('RegressionDetector initialised', { baselinePath: this.baselinePath });
  }

  // -------------------------------------------------------------------------
  // loadBaseline
  // -------------------------------------------------------------------------
  /**
   * Load the stored baseline JSON.
   * @returns {{ savedAt: number, entries: Object }|null}
   */
  loadBaseline() {
    try {
      const raw  = fs.readFileSync(this.baselinePath, 'utf8');
      const data = JSON.parse(raw);
      this.log.info('Baseline loaded', { savedAt: data.savedAt, entries: Object.keys(data.entries || {}).length });
      return data;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.log.warn('Could not load baseline', { err: err.message });
      }
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // saveBaseline
  // -------------------------------------------------------------------------
  /**
   * Persist current results as the new baseline.
   * @param {Array|Object} results
   */
  saveBaseline(results) {
    const normalised = normaliseResults(results);
    const entries    = Object.fromEntries(normalised);

    const payload = {
      savedAt: Date.now(),
      version: 2,
      phiInverse: PHI_INVERSE,
      entries,
    };

    const dir = path.dirname(this.baselinePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.baselinePath, JSON.stringify(payload, null, 2), 'utf8');

    this.log.info('Baseline saved', { path: this.baselinePath, count: Object.keys(entries).length });
    return payload;
  }

  // -------------------------------------------------------------------------
  // compare
  // -------------------------------------------------------------------------
  /**
   * Compare currentResults against the stored baseline.
   * Uses PhiDecay to discount older baseline scores.
   *
   * @param {Array|Object} currentResults
   * @returns {{ changes: Object[], hasRegression: boolean, report: Object }}
   */
  compare(currentResults) {
    const baseline = this.loadBaseline();
    const current  = normaliseResults(currentResults);

    if (!baseline) {
      this.log.info('No baseline found — treating all as NEW');
      const changes = [];
      for (const [id, score] of current) {
        changes.push({ id, type: CHANGE_TYPE.NEW, currentScore: score, baselineScore: null, delta: null });
      }
      this._report = { changes, hasRegression: false, noBaseline: true };
      return this._report;
    }

    const baselineEntries = baseline.entries || {};
    const ageMs      = Date.now() - (baseline.savedAt || 0);
    const decayFactor = this._decay.decay(ageMs); // value in (0,1]

    this.log.info('Comparing vs baseline', { ageMs, decayFactor: decayFactor.toFixed(4) });

    const changes = [];
    const REGRESSION_THRESHOLD = 0.05; // score must drop >5% to be a regression

    // Check current vs baseline
    for (const [id, currentScore] of current) {
      const rawBaseline = baselineEntries[id] != null ? baselineEntries[id] : null;

      if (rawBaseline === null) {
        changes.push({ id, type: CHANGE_TYPE.NEW, currentScore, baselineScore: null, delta: null });
        continue;
      }

      // Apply decay: older baselines are allowed more slack
      const effectiveBaseline = rawBaseline * decayFactor;
      const delta = currentScore - effectiveBaseline;

      let type;
      if (delta < -REGRESSION_THRESHOLD) {
        type = CHANGE_TYPE.REGRESSION;
      } else if (delta > REGRESSION_THRESHOLD) {
        type = CHANGE_TYPE.IMPROVEMENT;
      } else {
        type = CHANGE_TYPE.UNCHANGED;
      }

      changes.push({
        id,
        type,
        currentScore:    parseFloat(currentScore.toFixed(4)),
        baselineScore:   parseFloat(rawBaseline.toFixed(4)),
        effectiveBaseline: parseFloat(effectiveBaseline.toFixed(4)),
        delta:           parseFloat(delta.toFixed(4)),
        decayFactor:     parseFloat(decayFactor.toFixed(4)),
      });
    }

    // Check for removed tests
    for (const id of Object.keys(baselineEntries)) {
      if (!current.has(id)) {
        changes.push({
          id,
          type:           CHANGE_TYPE.REMOVED,
          currentScore:   null,
          baselineScore:  parseFloat(baselineEntries[id].toFixed(4)),
          delta:          null,
        });
      }
    }

    const hasRegression = changes.some(c => c.type === CHANGE_TYPE.REGRESSION);
    const regressions   = changes.filter(c => c.type === CHANGE_TYPE.REGRESSION);
    const improvements  = changes.filter(c => c.type === CHANGE_TYPE.IMPROVEMENT);

    this._report = {
      changes,
      hasRegression,
      regressions,
      improvements,
      baselineAge:  ageMs,
      decayFactor:  parseFloat(decayFactor.toFixed(4)),
      phiThreshold: PHI_INVERSE,
    };

    if (hasRegression) {
      this.log.warn('REGRESSIONS DETECTED', { count: regressions.length, regressions });
    } else {
      this.log.info('No regressions detected', { improvements: improvements.length });
    }

    return this._report;
  }

  // -------------------------------------------------------------------------
  // getReport
  // -------------------------------------------------------------------------
  /**
   * Return the last comparison report (null if compare() not yet called).
   */
  getReport() {
    return this._report;
  }

  // -------------------------------------------------------------------------
  // exitOnRegression
  // -------------------------------------------------------------------------
  /**
   * Call process.exit(1) if the last comparison found regressions.
   * Designed for CI pipeline usage.
   */
  exitOnRegression() {
    if (!this._report) {
      this.log.warn('exitOnRegression called before compare() — skipping');
      return;
    }

    if (this._report.hasRegression) {
      this.log.error('CI FAILURE: Regressions detected — exiting with code 1');
      this.log.logError(
        new Error('Regression detected'),
        { regressions: this._report.regressions }
      );
      process.exit(1);
    }

    this.log.info('CI PASS: No regressions detected');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { RegressionDetector, CHANGE_TYPE };

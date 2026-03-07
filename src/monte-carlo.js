/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * Monte Carlo Simulation Engine for operational readiness and risk assessment.
 * Uses Mulberry32 seeded PRNG for reproducible simulations.
 */

const logger = require('./utils/logger');

// ─── Mulberry32 PRNG ─────────────────────────────────────────────────────────

/**
 * Create a seeded Mulberry32 PRNG.
 * @param {number} seed  32-bit unsigned integer
 * @returns {function(): number} returns floats in [0, 1)
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Risk grades ─────────────────────────────────────────────────────────────

const RISK_GRADE = Object.freeze({
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  ORANGE: 'ORANGE',
  RED: 'RED',
});

function _scoreToGrade(score) {
  if (score >= 80) return RISK_GRADE.GREEN;
  if (score >= 60) return RISK_GRADE.YELLOW;
  if (score >= 40) return RISK_GRADE.ORANGE;
  return RISK_GRADE.RED;
}

// ─── MonteCarloEngine ─────────────────────────────────────────────────────────

class MonteCarloEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.defaultSeed=42]  default PRNG seed
   */
  constructor(opts = {}) {
    this._defaultSeed = opts.defaultSeed !== undefined ? opts.defaultSeed : 42;
    /** @type {Array<{ scenario: string, result: object, runAt: number }>} */
    this._history = [];
    logger.info({ component: 'MonteCarloEngine' }, 'MonteCarloEngine initialised');
  }

  // ─── Quick readiness ────────────────────────────────────────────────────────

  /**
   * Fast readiness score from operational signals.
   *
   * @param {object} signals
   * @param {number} [signals.errorRate=0]          fraction 0-1 (lower is better)
   * @param {boolean} [signals.lastDeploySuccess=true]
   * @param {number} [signals.cpuPressure=0]        fraction 0-1 (lower is better)
   * @param {number} [signals.memoryPressure=0]     fraction 0-1 (lower is better)
   * @param {number} [signals.serviceHealthRatio=1] fraction 0-1 (higher is better)
   * @param {number} [signals.openIncidents=0]      integer (lower is better)
   * @returns {{ score: number, grade: string, breakdown: object }}
   */
  quickReadiness(signals = {}) {
    const {
      errorRate = 0,
      lastDeploySuccess = true,
      cpuPressure = 0,
      memoryPressure = 0,
      serviceHealthRatio = 1,
      openIncidents = 0,
    } = signals;

    // Score components (each 0-100, weighted)
    const errorScore      = Math.max(0, 100 - errorRate * 200);          // weight 25%
    const deployScore     = lastDeploySuccess ? 100 : 30;                // weight 20%
    const cpuScore        = Math.max(0, 100 - cpuPressure * 100);        // weight 15%
    const memScore        = Math.max(0, 100 - memoryPressure * 100);     // weight 15%
    const healthScore     = serviceHealthRatio * 100;                    // weight 20%
    const incidentScore   = Math.max(0, 100 - openIncidents * 15);       // weight 5%

    const score = Math.round(
      errorScore    * 0.25 +
      deployScore   * 0.20 +
      cpuScore      * 0.15 +
      memScore      * 0.15 +
      healthScore   * 0.20 +
      incidentScore * 0.05,
    );

    const grade = _scoreToGrade(score);

    logger.debug({ score, grade }, 'MonteCarloEngine: quickReadiness');
    return {
      score,
      grade,
      breakdown: { errorScore, deployScore, cpuScore, memScore, healthScore, incidentScore },
    };
  }

  // ─── Full simulation ────────────────────────────────────────────────────────

  /**
   * Run a full Monte Carlo cycle.
   *
   * @param {object} scenario
   * @param {string} [scenario.name='unnamed']
   * @param {number} [scenario.seed]           PRNG seed (defaults to timestamp)
   * @param {Array<{ name: string, probability: number, impact: number, mitigation?: string }>} [scenario.riskFactors=[]]
   * @param {number} [iterations=10000]
   * @returns {{
   *   scenario: string,
   *   iterations: number,
   *   confidence: number,
   *   failureRate: number,
   *   riskGrade: string,
   *   topMitigations: string[],
   *   outcomes: { success: number, partial: number, failure: number },
   *   confidenceBounds: { lower: number, upper: number },
   *   seed: number,
   * }}
   */
  runFullCycle(scenario = {}, iterations = 10000) {
    const name = scenario.name || 'unnamed';
    const seed = scenario.seed !== undefined ? scenario.seed : (Date.now() & 0xffffffff);
    const riskFactors = scenario.riskFactors || [];
    const rand = mulberry32(seed);

    let successCount = 0;
    let partialCount = 0;
    let failureCount = 0;
    const mitigationHits = {};

    for (let i = 0; i < iterations; i++) {
      let totalImpact = 0;

      for (const factor of riskFactors) {
        const { probability = 0.1, impact = 0.5, mitigation } = factor;
        const roll = rand();
        if (roll < probability) {
          // Mitigation reduces impact by 50% when applied
          const effectiveImpact = mitigation ? impact * 0.5 : impact;
          totalImpact += effectiveImpact;
          if (mitigation) mitigationHits[mitigation] = (mitigationHits[mitigation] || 0) + 1;
        }
      }

      if (totalImpact < 0.3)       successCount++;
      else if (totalImpact < 0.7)  partialCount++;
      else                          failureCount++;
    }

    const failureRate = failureCount / iterations;
    const successRate = successCount / iterations;

    // 95% Wilson confidence interval for failure rate
    const z = 1.96;
    const n = iterations;
    const p = failureRate;
    const denominator = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
    const confidenceBounds = {
      lower: Math.max(0, centre - margin),
      upper: Math.min(1, centre + margin),
    };

    // Confidence in the simulation: 1 - failureRate, scaled
    const confidence = Math.round(successRate * 100);
    const riskGrade = _scoreToGrade(confidence);

    // Top mitigations by hit frequency
    const topMitigations = Object.entries(mitigationHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m]) => m);

    const result = {
      scenario: name,
      iterations,
      confidence,
      failureRate: Math.round(failureRate * 10000) / 10000,
      riskGrade,
      topMitigations,
      outcomes: {
        success: successCount,
        partial: partialCount,
        failure: failureCount,
      },
      confidenceBounds,
      seed,
    };

    this._history.push({ scenario: name, result, runAt: Date.now() });
    logger.info({ scenario: name, confidence, riskGrade }, 'MonteCarloEngine: full cycle complete');
    return result;
  }

  // ─── History & status ───────────────────────────────────────────────────────

  /**
   * Return recent simulation history.
   * @param {number} [limit=20]
   * @returns {Array<{ scenario: string, result: object, runAt: number }>}
   */
  getHistory(limit = 20) {
    return this._history.slice(-limit);
  }

  /**
   * Engine status summary.
   * @returns {{ totalRuns: number, lastRun: number|null }}
   */
  status() {
    const last = this._history[this._history.length - 1];
    return {
      totalRuns: this._history.length,
      lastRun: last ? last.runAt : null,
    };
  }
}

module.exports = {
  MonteCarloEngine,
  mulberry32,
  RISK_GRADE,
};

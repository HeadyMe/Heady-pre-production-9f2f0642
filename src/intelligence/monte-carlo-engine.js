/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Monte Carlo Simulation Engine — Risk Assessment and Pipeline Integration
 *
 * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
 *
 * Full production Monte Carlo engine for risk assessment, probabilistic outcome
 * distribution, confidence intervals, and scenario analysis.
 *
 * PHI = 1.6180339887
 *
 * Features:
 *   - runSimulation(params, iterations) — primary simulation entry point
 *   - probabilistic outcome distribution (success / partial / failure)
 *   - risk scoring with GREEN / YELLOW / ORANGE / RED grades
 *   - 95% Wilson confidence intervals for failure rate
 *   - scenario analysis (multi-scenario comparison)
 *   - configurable distributions: normal, uniform, triangular
 *   - pipeline stage integration hooks
 *   - quickReadiness() from operational signals
 *   - Mulberry32 seeded PRNG for reproducibility
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const RISK_GRADE = Object.freeze({
  GREEN:  'GREEN',
  YELLOW: 'YELLOW',
  ORANGE: 'ORANGE',
  RED:    'RED',
});

const DISTRIBUTION = Object.freeze({
  UNIFORM:    'uniform',
  NORMAL:     'normal',
  TRIANGULAR: 'triangular',
});

/** Impact thresholds that delineate simulation outcome buckets. */
const OUTCOME_THRESHOLDS = Object.freeze({
  SUCCESS_MAX: 0.30,  // total impact < 0.30 → success
  PARTIAL_MAX: 0.70,  // total impact < 0.70 → partial
                      // total impact >= 0.70 → failure
});

// ─── Mulberry32 PRNG ──────────────────────────────────────────────────────────

/**
 * Mulberry32 seeded PRNG — fast, high-quality, reproducible.
 * Returns floats uniformly distributed in [0, 1).
 *
 * @param {number} seed - 32-bit unsigned integer seed
 * @returns {function(): number}
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s  += 0x6d2b79f5;
    let z = s;
    z     = Math.imul(z ^ (z >>> 15), z | 1);
    z    ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Distribution Samplers ────────────────────────────────────────────────────

/**
 * Sample from a uniform distribution [min, max].
 * @param {function} rand - PRNG
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function sampleUniform(rand, min = 0, max = 1) {
  return min + rand() * (max - min);
}

/**
 * Sample from a normal distribution using Box-Muller transform.
 * @param {function} rand - PRNG
 * @param {number} mean
 * @param {number} stddev
 * @returns {number}
 */
function sampleNormal(rand, mean = 0, stddev = 1) {
  const u1 = rand();
  const u2 = rand();
  const z0 = Math.sqrt(-2.0 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

/**
 * Sample from a triangular distribution defined by [min, mode, max].
 * @param {function} rand - PRNG
 * @param {number} min
 * @param {number} mode  - Most likely value (peak of triangle)
 * @param {number} max
 * @returns {number}
 */
function sampleTriangular(rand, min = 0, mode = 0.5, max = 1) {
  const u = rand();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/**
 * Dispatch to the appropriate distribution sampler.
 * @param {function} rand
 * @param {string} distribution
 * @param {object} params
 * @returns {number}
 */
function sample(rand, distribution, params = {}) {
  switch (distribution) {
    case DISTRIBUTION.NORMAL:
      return sampleNormal(rand, params.mean, params.stddev);
    case DISTRIBUTION.TRIANGULAR:
      return sampleTriangular(rand, params.min, params.mode, params.max);
    case DISTRIBUTION.UNIFORM:
    default:
      return sampleUniform(rand, params.min !== undefined ? params.min : 0, params.max !== undefined ? params.max : 1);
  }
}

// ─── Statistical Helpers ──────────────────────────────────────────────────────

/**
 * Map a 0-100 score to a risk grade.
 * @param {number} score
 * @returns {string} RISK_GRADE value
 */
function scoreToGrade(score) {
  if (score >= 80) return RISK_GRADE.GREEN;
  if (score >= 60) return RISK_GRADE.YELLOW;
  if (score >= 40) return RISK_GRADE.ORANGE;
  return RISK_GRADE.RED;
}

/**
 * Compute the 95% Wilson score confidence interval for a proportion.
 * More accurate than normal approximation for small samples or extreme proportions.
 *
 * @param {number} p          - Observed proportion (0–1)
 * @param {number} n          - Sample size
 * @param {number} [z=1.96]   - Z-score for desired confidence level
 * @returns {{ lower: number, upper: number, centre: number }}
 */
function wilsonInterval(p, n, z = 1.96) {
  if (n === 0) return { lower: 0, upper: 1, centre: 0.5 };
  const z2         = z * z;
  const denominator = 1 + z2 / n;
  const centre      = (p + z2 / (2 * n)) / denominator;
  const margin      = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;
  return {
    lower:  +Math.max(0, centre - margin).toFixed(6),
    upper:  +Math.min(1, centre + margin).toFixed(6),
    centre: +centre.toFixed(6),
  };
}

/**
 * Compute descriptive statistics for an array of numbers.
 * @param {number[]} arr
 * @returns {{ mean: number, stddev: number, min: number, max: number, p25: number, p50: number, p75: number, p95: number }}
 */
function descriptiveStats(arr) {
  if (arr.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0, p25: 0, p50: 0, p75: 0, p95: 0 };

  const sorted = [...arr].sort((a, b) => a - b);
  const n      = sorted.length;
  const sum    = sorted.reduce((a, b) => a + b, 0);
  const mean   = sum / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stddev   = Math.sqrt(variance);

  const pct = (p) => {
    const idx = Math.floor(p * (n - 1));
    return +sorted[idx].toFixed(6);
  };

  return {
    mean:   +mean.toFixed(6),
    stddev: +stddev.toFixed(6),
    min:    +sorted[0].toFixed(6),
    max:    +sorted[n - 1].toFixed(6),
    p25:    pct(0.25),
    p50:    pct(0.50),
    p75:    pct(0.75),
    p95:    pct(0.95),
  };
}

// ─── MonteCarloEngine ─────────────────────────────────────────────────────────

/**
 * Monte Carlo Engine — production risk assessment and pipeline simulation.
 * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
 */
class MonteCarloEngine {
  /**
   * @param {object} [opts]
   * @param {number} [opts.defaultSeed=42]           - Default PRNG seed
   * @param {number} [opts.defaultIterations=10000]  - Default iteration count
   */
  constructor(opts = {}) {
    this._defaultSeed       = opts.defaultSeed       !== undefined ? opts.defaultSeed : 42;
    this._defaultIterations = opts.defaultIterations !== undefined ? opts.defaultIterations : 10000;
    this._history           = [];
    this._pipelineHooks     = new Map();
    this._createdAt         = Date.now();
  }

  // ── Primary Simulation Entry Point ───────────────────────────────────────

  /**
   * Run a full Monte Carlo simulation.
   * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
   *
   * @param {object} params                     - Simulation parameters
   * @param {string}  [params.name='unnamed']   - Scenario label
   * @param {number}  [params.seed]             - PRNG seed (defaults to timestamp)
   * @param {Array<{
   *   name: string,
   *   probability: number,
   *   impact: number,
   *   distribution?: string,
   *   distributionParams?: object,
   *   mitigation?: string,
   *   mitigationReduction?: number
   * }>} [params.riskFactors=[]]               - Risk factors to simulate
   * @param {string}  [params.pipelineStage]    - Pipeline stage name for hook integration
   * @param {number}  [iterations=this._defaultIterations]
   * @returns {object} Simulation result
   */
  runSimulation(params = {}, iterations) {
    const iters       = iterations !== undefined ? iterations : this._defaultIterations;
    const name        = params.name        || 'unnamed';
    const seed        = params.seed        !== undefined ? params.seed : (Date.now() & 0xffffffff);
    const riskFactors = params.riskFactors || [];
    const rand        = mulberry32(seed);

    let successCount = 0;
    let partialCount = 0;
    let failureCount = 0;

    const totalImpacts        = new Float64Array(iters);
    const mitigationHits      = {};
    const riskFactorHitCounts = riskFactors.map(() => 0);

    for (let i = 0; i < iters; i++) {
      let totalImpact = 0;

      for (let fi = 0; fi < riskFactors.length; fi++) {
        const factor = riskFactors[fi];
        const {
          probability        = 0.1,
          impact             = 0.5,
          distribution       = DISTRIBUTION.UNIFORM,
          distributionParams = {},
          mitigation,
          mitigationReduction = 0.5,
        } = factor;

        // Determine if this risk factor triggers this iteration
        const roll = rand();
        if (roll < probability) {
          riskFactorHitCounts[fi]++;

          // Sample the effective impact from the specified distribution
          let effectiveImpact;
          if (distribution !== DISTRIBUTION.UNIFORM ||
              distributionParams.min !== undefined || distributionParams.max !== undefined) {
            effectiveImpact = Math.max(0, Math.min(1,
              sample(rand, distribution, { ...distributionParams, mean: impact, mode: impact })
            ));
          } else {
            effectiveImpact = impact;
          }

          // Apply mitigation if specified
          if (mitigation) {
            effectiveImpact *= (1 - mitigationReduction);
            mitigationHits[mitigation] = (mitigationHits[mitigation] || 0) + 1;
          }

          totalImpact += effectiveImpact;
        }
      }

      totalImpacts[i] = totalImpact;

      if (totalImpact < OUTCOME_THRESHOLDS.SUCCESS_MAX)      successCount++;
      else if (totalImpact < OUTCOME_THRESHOLDS.PARTIAL_MAX) partialCount++;
      else                                                    failureCount++;
    }

    const failureRate   = failureCount / iters;
    const successRate   = successCount / iters;
    const partialRate   = partialCount / iters;
    const confidence    = Math.round(successRate * 100);
    const riskGrade     = scoreToGrade(confidence);

    // Wilson 95% CI for failure rate
    const confidenceBounds = wilsonInterval(failureRate, iters);

    // Impact distribution statistics
    const impactArr   = Array.from(totalImpacts);
    const impactStats = descriptiveStats(impactArr);

    // Top mitigations by hit frequency
    const topMitigations = Object.entries(mitigationHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, count]) => ({ name: m, activations: count, activationRate: +(count / iters).toFixed(4) }));

    // Per-risk-factor hit rates
    const riskFactorStats = riskFactors.map((f, i) => ({
      name:            f.name || `factor-${i}`,
      probability:     f.probability || 0.1,
      observedHitRate: +(riskFactorHitCounts[i] / iters).toFixed(4),
      mitigation:      f.mitigation || null,
    }));

    const result = {
      // RTP: Monte Carlo Simulation - HCFullPipeline Stage
      scenario:         name,
      iterations:       iters,
      seed,
      confidence,
      riskGrade,
      failureRate:      +failureRate.toFixed(4),
      partialRate:      +partialRate.toFixed(4),
      successRate:      +successRate.toFixed(4),
      outcomes: {
        success: successCount,
        partial: partialCount,
        failure: failureCount,
      },
      confidenceBounds,
      impactDistribution: impactStats,
      topMitigations,
      riskFactorStats,
      phi:              PHI,
      simulatedAt:      Date.now(),
    };

    // Run pipeline hooks if a stage was specified
    if (params.pipelineStage) {
      this._runPipelineHooks(params.pipelineStage, result);
    }

    this._history.push({ scenario: name, result, runAt: Date.now() });
    return result;
  }

  // ── Quick Readiness (Operational Signals) ────────────────────────────────

  /**
   * Fast operational readiness score from live system signals.
   * No PRNG required — deterministic scoring for real-time use.
   *
   * @param {object} [signals={}]
   * @param {number}  [signals.errorRate=0]          - Fraction 0-1 (lower is better)
   * @param {boolean} [signals.lastDeploySuccess=true]
   * @param {number}  [signals.cpuPressure=0]        - Fraction 0-1
   * @param {number}  [signals.memoryPressure=0]     - Fraction 0-1
   * @param {number}  [signals.serviceHealthRatio=1] - Fraction 0-1 (higher is better)
   * @param {number}  [signals.openIncidents=0]      - Integer count
   * @returns {{ score: number, grade: string, breakdown: object }}
   */
  quickReadiness(signals = {}) {
    const {
      errorRate          = 0,
      lastDeploySuccess  = true,
      cpuPressure        = 0,
      memoryPressure     = 0,
      serviceHealthRatio = 1,
      openIncidents      = 0,
    } = signals;

    const errorScore    = Math.max(0, 100 - errorRate * 200);        // weight 25%
    const deployScore   = lastDeploySuccess ? 100 : 30;              // weight 20%
    const cpuScore      = Math.max(0, 100 - cpuPressure * 100);      // weight 15%
    const memScore      = Math.max(0, 100 - memoryPressure * 100);   // weight 15%
    const healthScore   = serviceHealthRatio * 100;                  // weight 20%
    const incidentScore = Math.max(0, 100 - openIncidents * 15);     // weight 5%

    const score = Math.round(
      errorScore    * 0.25 +
      deployScore   * 0.20 +
      cpuScore      * 0.15 +
      memScore      * 0.15 +
      healthScore   * 0.20 +
      incidentScore * 0.05,
    );

    return {
      score,
      grade:     scoreToGrade(score),
      breakdown: { errorScore, deployScore, cpuScore, memScore, healthScore, incidentScore },
    };
  }

  // ── Scenario Analysis ────────────────────────────────────────────────────

  /**
   * Run multiple scenarios and produce a comparative report.
   * @param {Array<{ name: string, params: object, iterations?: number }>} scenarios
   * @returns {{ scenarios: Array<object>, comparison: object }}
   */
  analyseScenarios(scenarios) {
    const results = scenarios.map(({ name, params, iterations }) =>
      this.runSimulation({ ...params, name }, iterations)
    );

    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

    return {
      scenarios: results,
      comparison: {
        best:    sorted[0] ? { name: sorted[0].scenario, confidence: sorted[0].confidence, grade: sorted[0].riskGrade } : null,
        worst:   sorted[sorted.length - 1] ? { name: sorted[sorted.length - 1].scenario, confidence: sorted[sorted.length - 1].confidence, grade: sorted[sorted.length - 1].riskGrade } : null,
        average: results.length > 0 ? +(results.reduce((a, b) => a + b.confidence, 0) / results.length).toFixed(1) : 0,
        allGreen: results.every(r => r.riskGrade === RISK_GRADE.GREEN),
        anyRed:   results.some(r => r.riskGrade === RISK_GRADE.RED),
      },
    };
  }

  // ── Pipeline Stage Integration ───────────────────────────────────────────

  /**
   * Register a hook function to be called after a simulation for a specific pipeline stage.
   * // RTP: Monte Carlo Simulation - HCFullPipeline Stage
   *
   * @param {string} stageName
   * @param {Function} hookFn  - Called with (result) — may be async
   */
  registerPipelineHook(stageName, hookFn) {
    if (!this._pipelineHooks.has(stageName)) {
      this._pipelineHooks.set(stageName, []);
    }
    this._pipelineHooks.get(stageName).push(hookFn);
  }

  /**
   * Run all registered hooks for a pipeline stage.
   * @private
   */
  _runPipelineHooks(stageName, result) {
    const hooks = this._pipelineHooks.get(stageName) || [];
    for (const hook of hooks) {
      try { hook(result); } catch { /* hooks must not break simulation */ }
    }
  }

  /**
   * Remove all hooks for a pipeline stage.
   * @param {string} stageName
   */
  clearPipelineHooks(stageName) {
    this._pipelineHooks.delete(stageName);
  }

  // ── Risk Scoring Utility ─────────────────────────────────────────────────

  /**
   * Compute a standalone risk score for a set of factors (no full simulation).
   * Returns a deterministic score 0-100 based on factor probabilities and impacts.
   *
   * @param {Array<{ probability: number, impact: number, mitigation?: boolean }>} riskFactors
   * @returns {{ score: number, grade: string, expectedImpact: number }}
   */
  scoreRisk(riskFactors = []) {
    let expectedImpact = 0;
    for (const f of riskFactors) {
      const raw       = (f.probability || 0.1) * (f.impact || 0.5);
      const effective = f.mitigation ? raw * 0.5 : raw;
      expectedImpact += effective;
    }
    // Clamp to [0, 1] and invert for score
    const score = Math.round(Math.max(0, 1 - expectedImpact) * 100);
    return { score, grade: scoreToGrade(score), expectedImpact: +expectedImpact.toFixed(4) };
  }

  // ── History & Status ─────────────────────────────────────────────────────

  /**
   * Return recent simulation history.
   * @param {number} [limit=20]
   * @returns {Array<object>}
   */
  getHistory(limit = 20) {
    return this._history.slice(-limit);
  }

  /**
   * Clear simulation history.
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Engine status summary.
   * @returns {{ totalRuns: number, lastRun: number|null, pipelineStages: string[] }}
   */
  status() {
    const last = this._history[this._history.length - 1];
    return {
      totalRuns:      this._history.length,
      lastRun:        last ? last.runAt : null,
      pipelineStages: Array.from(this._pipelineHooks.keys()),
      phi:            PHI,
      createdAt:      this._createdAt,
    };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  MonteCarloEngine,

  // Distribution samplers (exported for custom integrations)
  mulberry32,
  sampleUniform,
  sampleNormal,
  sampleTriangular,
  sample,

  // Statistical utilities
  wilsonInterval,
  descriptiveStats,
  scoreToGrade,

  // Constants
  PHI,
  RISK_GRADE,
  DISTRIBUTION,
  OUTCOME_THRESHOLDS,
};

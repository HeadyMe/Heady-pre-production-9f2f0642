'use strict';
/**
 * @module ab-framework
 * @description A/B testing framework for HeadySystems
 *
 * Features:
 *   - φ-weighted variant allocation (61.8% control / 38.2% variant)
 *   - Conversion metric tracking per variant
 *   - Chi-squared statistical significance test
 *   - Minimum sample size: fib(16)=987 per variant
 *   - Auto-conclude when significance reached
 *   - Results export
 *
 * φ = 1.618033988749895
 * Control split:  1/φ  ≈ 61.8%
 * Variant split:  1-1/φ ≈ 38.2%
 * Min sample:     fib(16) = 987 per variant
 */

const crypto = require('crypto');
const EventEmitter = require('events');

const PHI  = 1.618033988749895;
const FIB  = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

const CONTROL_RATIO  = 1 / PHI;          // 0.618033…
const VARIANT_RATIO  = 1 - (1 / PHI);   // 0.381966…
const MIN_SAMPLE     = FIB[16];          // 987 per variant
const P_VALUE_THRESHOLD = 0.05;          // 95% confidence
const REDIS_NS        = 'heady:ab';

// ─────────────────────────────────────────────────────────────────────────────
// Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chi-squared test for two proportions (2x2 contingency table).
 * H0: conversion rates are equal between control and variant.
 *
 * @param {number} controlN          - Control group size
 * @param {number} controlConversions
 * @param {number} variantN
 * @param {number} variantConversions
 * @returns {{ chiSquare: number, pValue: number, significant: boolean, lift: number }}
 */
function chiSquaredTest(controlN, controlConversions, variantN, variantConversions) {
  const controlNonConv = controlN - controlConversions;
  const variantNonConv = variantN - variantConversions;

  const total         = controlN + variantN;
  const totalConv     = controlConversions + variantConversions;
  const totalNonConv  = controlNonConv + variantNonConv;

  if (total === 0 || totalConv === 0 || totalNonConv === 0) {
    return { chiSquare: 0, pValue: 1, significant: false, lift: 0 };
  }

  // Expected values
  const eCC = (controlN * totalConv) / total;
  const eCN = (controlN * totalNonConv) / total;
  const eVC = (variantN * totalConv) / total;
  const eVN = (variantN * totalNonConv) / total;

  // Guard against zero expected values
  if (eCC === 0 || eCN === 0 || eVC === 0 || eVN === 0) {
    return { chiSquare: 0, pValue: 1, significant: false, lift: 0 };
  }

  // χ² statistic with Yates' continuity correction
  const chiSquare = (
    Math.pow(Math.abs(controlConversions - eCC) - 0.5, 2) / eCC +
    Math.pow(Math.abs(controlNonConv    - eCN) - 0.5, 2) / eCN +
    Math.pow(Math.abs(variantConversions - eVC) - 0.5, 2) / eVC +
    Math.pow(Math.abs(variantNonConv    - eVN) - 0.5, 2) / eVN
  );

  // p-value from chi-squared distribution (1 degree of freedom)
  // Approximation using regularized incomplete gamma function
  const pValue = chiSquarePValue(chiSquare, 1);

  const controlRate = controlN > 0 ? controlConversions / controlN : 0;
  const variantRate = variantN > 0 ? variantConversions / variantN : 0;
  const lift        = controlRate > 0 ? (variantRate - controlRate) / controlRate : 0;

  return {
    chiSquare:   Number(chiSquare.toFixed(6)),
    pValue:      Number(pValue.toFixed(6)),
    significant: pValue <= P_VALUE_THRESHOLD,
    lift:        Number(lift.toFixed(4)),
    controlRate: Number(controlRate.toFixed(4)),
    variantRate: Number(variantRate.toFixed(4)),
    powerLevel:  1 - pValue,
  };
}

/**
 * Chi-squared CDF p-value for df=1 (approximation).
 * Uses the regularized incomplete gamma function.
 * @param {number} x - chi-squared value
 * @param {number} df - degrees of freedom
 * @returns {number} p-value
 */
function chiSquarePValue(x, df) {
  if (x <= 0) return 1;
  // Approximation for df=1 using the relationship with the normal distribution
  // P(χ²₁ ≥ x) = P(|Z| ≥ √x) = 2 * (1 - Φ(√x))
  const z = Math.sqrt(x);
  return 2 * (1 - normalCDF(z));
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun).
 * @param {number} x
 * @returns {number}
 */
function normalCDF(x) {
  const t  = 1 / (1 + 0.2316419 * Math.abs(x));
  const y  = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const z  = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-x * x / 2) * y;
  return x >= 0 ? z : 1 - z;
}

/**
 * Compute minimum sample size per variant.
 * Uses power analysis: n = (φ·z_α/2 + z_β)² / (2·δ²)
 * Simplified: we use fib(16)=987 as default minimum.
 *
 * @param {Object} opts
 * @param {number} opts.baseRate      - Baseline conversion rate
 * @param {number} opts.minDetectable  - Minimum detectable effect (e.g. 0.05 = 5% lift)
 * @param {number} [opts.alpha=0.05]  - Significance level
 * @param {number} [opts.power=0.80]  - Statistical power
 * @returns {number} Required sample size per variant
 */
function minimumSampleSize({ baseRate, minDetectable, alpha = 0.05, power = 0.80 }) {
  const zAlpha = 1.96;  // 95% confidence
  const zBeta  = 0.842; // 80% power
  const variantRate = baseRate * (1 + minDetectable);
  const pooled  = (baseRate + variantRate) / 2;
  const stddev  = Math.sqrt(2 * pooled * (1 - pooled));
  const delta   = Math.abs(variantRate - baseRate);

  if (delta <= 0) return MIN_SAMPLE;

  const n = Math.ceil(Math.pow(zAlpha + zBeta, 2) * Math.pow(stddev, 2) / Math.pow(delta, 2));
  return Math.max(n, MIN_SAMPLE);   // Never below fib(16)=987
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic user assignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic hash → variant assignment.
 * @param {string} experimentId
 * @param {string} userId
 * @returns {'control'|'variant'} Stable assignment
 */
function assignVariant(experimentId, userId) {
  const hash = crypto.createHash('sha256').update(`${experimentId}:${userId}`).digest('hex');
  const ratio = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;
  return ratio < CONTROL_RATIO ? 'control' : 'variant';
}

// ─────────────────────────────────────────────────────────────────────────────
// Experiment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Experiment
 * @property {string}   id
 * @property {string}   name
 * @property {string}   description
 * @property {'draft'|'running'|'paused'|'concluded'} status
 * @property {string}   hypothesis
 * @property {string}   primaryMetric    - e.g. 'task.completed', 'billing.upgraded'
 * @property {string[]} secondaryMetrics
 * @property {number}   controlRatio     - 0.618033 (1/φ)
 * @property {number}   variantRatio     - 0.381966 (1-1/φ)
 * @property {number}   minSampleSize    - fib(16)=987 per variant
 * @property {Object}   segments         - Targeting rules
 * @property {string}   startedAt
 * @property {string|null} concludedAt
 * @property {Object}   conclusion       - Set when status='concluded'
 */

// ─────────────────────────────────────────────────────────────────────────────
// AB Framework
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class ABFramework
 * Full A/B testing lifecycle management.
 *
 * @extends EventEmitter
 *
 * Events:
 *   experiment-created({experiment})
 *   experiment-started({experiment})
 *   experiment-concluded({experiment, result})
 *   conversion-tracked({experimentId, userId, variant, metric})
 */
class ABFramework extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {Object} opts.redis   - Connected Redis client
   */
  constructor(opts) {
    super();
    this._redis = opts.redis;
  }

  // ───────────────────────────────────────────────
  // Redis keys
  // ───────────────────────────────────────────────
  _expKey(id)         { return `${REDIS_NS}:exp:${id}`; }
  _assignKey(id)      { return `${REDIS_NS}:assign:${id}`; }
  _convKey(id, var_)  { return `${REDIS_NS}:conv:${id}:${var_}`; }
  _exposKey(id, var_) { return `${REDIS_NS}:expos:${id}:${var_}`; }
  _indexKey()         { return `${REDIS_NS}:index`; }

  // ───────────────────────────────────────────────
  // CRUD
  // ───────────────────────────────────────────────

  /**
   * Create a new A/B experiment.
   * @param {Partial<Experiment>} opts
   * @returns {Promise<Experiment>}
   */
  async create(opts) {
    const experiment = {
      id:               opts.id ?? crypto.randomUUID(),
      name:             opts.name,
      description:      opts.description ?? '',
      status:           'draft',
      hypothesis:       opts.hypothesis ?? '',
      primaryMetric:    opts.primaryMetric ?? 'task.completed',
      secondaryMetrics: opts.secondaryMetrics ?? [],
      controlRatio:     CONTROL_RATIO,   // 0.618033 (1/φ)
      variantRatio:     VARIANT_RATIO,   // 0.381966 (1-1/φ)
      minSampleSize:    opts.minSampleSize ?? MIN_SAMPLE,   // 987
      segments:         opts.segments ?? {},
      startedAt:        null,
      concludedAt:      null,
      conclusion:       null,
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
      phi:              PHI,
    };

    await this._redis.set(this._expKey(experiment.id), JSON.stringify(experiment));
    await this._redis.sAdd(this._indexKey(), experiment.id);
    this.emit('experiment-created', { experiment });
    return experiment;
  }

  async _get(id) {
    const raw = await this._redis.get(this._expKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  async _save(experiment) {
    experiment.updatedAt = new Date().toISOString();
    await this._redis.set(this._expKey(experiment.id), JSON.stringify(experiment));
    return experiment;
  }

  /** Start an experiment. */
  async start(id) {
    const exp = await this._get(id);
    if (!exp) throw new Error(`Experiment not found: ${id}`);
    if (exp.status !== 'draft') throw new Error(`Cannot start experiment in status: ${exp.status}`);
    exp.status    = 'running';
    exp.startedAt = new Date().toISOString();
    await this._save(exp);
    this.emit('experiment-started', { experiment: exp });
    return exp;
  }

  /** Pause a running experiment. */
  async pause(id) {
    const exp = await this._get(id);
    if (exp?.status !== 'running') throw new Error('Can only pause a running experiment');
    exp.status = 'paused';
    return this._save(exp);
  }

  // ───────────────────────────────────────────────
  // Assignment & Exposure
  // ───────────────────────────────────────────────

  /**
   * Assign a user to a variant. Stores assignment in Redis for consistency.
   * @param {string} experimentId
   * @param {string} userId
   * @returns {Promise<'control'|'variant'>}
   */
  async assign(experimentId, userId) {
    const exp = await this._get(experimentId);
    if (!exp || exp.status !== 'running') return null;

    // Check for existing sticky assignment
    const existing = await this._redis.hGet(this._assignKey(experimentId), userId);
    if (existing) return existing;

    const variant = assignVariant(experimentId, userId);
    await this._redis.hSet(this._assignKey(experimentId), userId, variant);
    // Track exposure
    await this._redis.incr(this._exposKey(experimentId, variant));
    return variant;
  }

  // ───────────────────────────────────────────────
  // Conversion Tracking
  // ───────────────────────────────────────────────

  /**
   * Track a conversion event for a user.
   * @param {string} experimentId
   * @param {string} userId
   * @param {string} metric         - Metric name (e.g. 'billing.upgraded')
   * @returns {Promise<void>}
   */
  async trackConversion(experimentId, userId, metric) {
    const exp = await this._get(experimentId);
    if (!exp || exp.status !== 'running') return;

    const variant = await this._redis.hGet(this._assignKey(experimentId), userId);
    if (!variant) return;

    // Track conversion only for primary metric (or any metric)
    if (metric === exp.primaryMetric || exp.secondaryMetrics.includes(metric)) {
      await this._redis.incr(this._convKey(experimentId, variant));
      this.emit('conversion-tracked', { experimentId, userId, variant, metric });
    }

    // Auto-check if we should conclude
    await this._maybeAutoConclude(experimentId);
  }

  // ───────────────────────────────────────────────
  // Analysis
  // ───────────────────────────────────────────────

  /**
   * Compute current experiment results.
   * @param {string} id
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(id) {
    const exp          = await this._get(id);
    if (!exp) throw new Error(`Experiment not found: ${id}`);

    const [controlExp, variantExp, controlConv, variantConv] = await Promise.all([
      this._redis.get(this._exposKey(id, 'control')).then(v => parseInt(v ?? '0', 10)),
      this._redis.get(this._exposKey(id, 'variant')).then(v => parseInt(v ?? '0', 10)),
      this._redis.get(this._convKey(id, 'control')).then(v => parseInt(v ?? '0', 10)),
      this._redis.get(this._convKey(id, 'variant')).then(v => parseInt(v ?? '0', 10)),
    ]);

    const stats = chiSquaredTest(controlExp, controlConv, variantExp, variantConv);
    const hasMinSample = controlExp >= exp.minSampleSize && variantExp >= exp.minSampleSize;

    return {
      experimentId:    id,
      name:            exp.name,
      status:          exp.status,
      primaryMetric:   exp.primaryMetric,
      phi:             PHI,

      variants: {
        control: {
          exposures:       controlExp,
          conversions:     controlConv,
          conversionRate:  controlExp > 0 ? Number((controlConv / controlExp).toFixed(4)) : 0,
          allocation:      CONTROL_RATIO,   // 61.8%
        },
        variant: {
          exposures:       variantExp,
          conversions:     variantConv,
          conversionRate:  variantExp > 0 ? Number((variantConv / variantExp).toFixed(4)) : 0,
          allocation:      VARIANT_RATIO,   // 38.2%
        },
      },

      statistics:      stats,
      hasMinSample,
      minSampleSize:   exp.minSampleSize,   // 987

      recommendation: (() => {
        if (!hasMinSample) return 'INSUFFICIENT_SAMPLE';
        if (!stats.significant) return 'NO_SIGNIFICANT_DIFFERENCE';
        if (stats.lift > 0) return 'SHIP_VARIANT';
        return 'KEEP_CONTROL';
      })(),

      readyToConclude: hasMinSample && stats.significant,
      startedAt:       exp.startedAt,
      analyzedAt:      new Date().toISOString(),
    };
  }

  /**
   * Manually conclude an experiment.
   * @param {string} id
   * @param {'control'|'variant'|'inconclusive'} winner
   * @returns {Promise<Experiment>}
   */
  async conclude(id, winner) {
    const exp      = await this._get(id);
    if (!exp) throw new Error(`Experiment not found: ${id}`);
    const analysis = await this.analyze(id);

    exp.status       = 'concluded';
    exp.concludedAt  = new Date().toISOString();
    exp.conclusion   = { winner, analysis, concludedBy: 'manual' };

    await this._save(exp);
    this.emit('experiment-concluded', { experiment: exp, result: analysis });
    return exp;
  }

  /** @private Auto-conclude when significance + sample size reached */
  async _maybeAutoConclude(id) {
    const analysis = await this.analyze(id);
    if (analysis.readyToConclude) {
      const winner = analysis.recommendation === 'SHIP_VARIANT' ? 'variant'
                   : analysis.recommendation === 'KEEP_CONTROL' ? 'control'
                   : 'inconclusive';
      await this._concludeAuto(id, winner, analysis);
    }
  }

  async _concludeAuto(id, winner, analysis) {
    const exp = await this._get(id);
    if (!exp || exp.status !== 'running') return;
    exp.status      = 'concluded';
    exp.concludedAt = new Date().toISOString();
    exp.conclusion  = { winner, analysis, concludedBy: 'auto' };
    await this._save(exp);
    this.emit('experiment-concluded', { experiment: exp, result: analysis });
  }

  // ───────────────────────────────────────────────
  // Export
  // ───────────────────────────────────────────────

  /**
   * Export full experiment results as JSON.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async export(id) {
    const [exp, analysis] = await Promise.all([this._get(id), this.analyze(id)]);
    return {
      experiment: exp,
      analysis,
      exportedAt: new Date().toISOString(),
      phi:        PHI,
      phiConfig: {
        controlAllocation:  CONTROL_RATIO,   // 61.8%
        variantAllocation:  VARIANT_RATIO,   // 38.2%
        minSampleSize:      MIN_SAMPLE,      // 987
        pValueThreshold:    P_VALUE_THRESHOLD,
      },
    };
  }

  /**
   * List all experiments.
   * @returns {Promise<Experiment[]>}
   */
  async list() {
    const ids = await this._redis.sMembers(this._indexKey());
    return Promise.all(ids.map(id => this._get(id))).then(es => es.filter(Boolean));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  ABFramework,
  chiSquaredTest,
  minimumSampleSize,
  assignVariant,
  normalCDF,
  CONTROL_RATIO,     // 0.618033 (1/φ)
  VARIANT_RATIO,     // 0.381966 (1-1/φ)
  MIN_SAMPLE,        // 987 (fib16)
  P_VALUE_THRESHOLD, // 0.05
  PHI,
  FIB,
};

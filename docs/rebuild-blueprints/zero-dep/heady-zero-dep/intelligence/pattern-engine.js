/**
 * @file pattern-engine.js
 * @description Pattern detection engine for time-series and sequence data.
 *
 * Features:
 * - Time-series anomaly detection (Z-score, IQR, rolling stats)
 * - Recurring pattern identification (autocorrelation, period detection)
 * - Trend analysis (linear regression, moving averages, EMA)
 * - Correlation detection (Pearson, Spearman, cross-correlation)
 * - Pattern classification (spike, dip, plateau, oscillation, drift)
 *
 * Sacred Geometry: PHI ratios for window sizes and thresholds.
 * Zero external dependencies (events only).
 *
 * @module HeadyIntelligence/PatternEngine
 */

import { EventEmitter } from 'events';

// ─── Sacred Geometry ──────────────────────────────────────────────────────────
const PHI      = 1.6180339887498948482;
const PHI_INV  = 1 / PHI;
const FIBO     = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610];

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr, mu) {
  const m = mu ?? mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function stddev(arr, mu) {
  return Math.sqrt(variance(arr, mu));
}

function sortedCopy(arr) {
  return [...arr].sort((a, b) => a - b);
}

function quantile(arr, q) {
  const s   = sortedCopy(arr);
  const idx = q * (s.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return s[lo] + (idx - lo) * (s[hi] - s[lo]);
}

// ─── Anomaly Detectors ────────────────────────────────────────────────────────

/**
 * Z-score anomaly detection over a rolling window.
 *
 * @param {number[]} series     Time series values
 * @param {object}  [opts]
 * @param {number}  [opts.windowSize]  Rolling window (default: PHI-scaled 34)
 * @param {number}  [opts.zThreshold] Z-score threshold (default: 3.0)
 * @returns {AnomalyResult[]}
 */
export function detectAnomaliesZScore(series, opts = {}) {
  const window    = opts.windowSize  ?? Math.round(FIBO[8] * PHI_INV); // ~21
  const threshold = opts.zThreshold  ?? 3.0;
  const anomalies = [];

  for (let i = window; i < series.length; i++) {
    const slice = series.slice(i - window, i);
    const mu    = mean(slice);
    const sd    = stddev(slice, mu);
    if (sd === 0) continue;
    const z = (series[i] - mu) / sd;
    if (Math.abs(z) >= threshold) {
      anomalies.push({
        index: i,
        value: series[i],
        zscore: z,
        type: z > 0 ? 'spike' : 'dip',
        windowMean: mu,
        windowStd:  sd,
      });
    }
  }
  return anomalies;
}

/**
 * IQR-based anomaly detection (robust to non-normal distributions).
 *
 * @param {number[]} series
 * @param {object}  [opts]
 * @param {number}  [opts.iqrMultiplier]  Fence multiplier (default: 1.5 * PHI ≈ 2.43)
 * @returns {AnomalyResult[]}
 */
export function detectAnomaliesIQR(series, opts = {}) {
  const k    = opts.iqrMultiplier ?? (1.5 * PHI_INV + 1.5);
  const q1   = quantile(series, 0.25);
  const q3   = quantile(series, 0.75);
  const iqr  = q3 - q1;
  const lo   = q1 - k * iqr;
  const hi   = q3 + k * iqr;

  return series
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v < lo || v > hi)
    .map(({ v, i }) => ({
      index: i,
      value: v,
      type:  v > hi ? 'spike' : 'dip',
      bounds: { lower: lo, upper: hi },
      q1, q3, iqr,
    }));
}

/**
 * CUSUM (Cumulative Sum) change-point detection.
 *
 * @param {number[]} series
 * @param {object}  [opts]
 * @param {number}  [opts.k]  Allowance parameter (default: 0.5 * stddev)
 * @param {number}  [opts.h]  Decision threshold (default: 5 * stddev)
 * @returns {{ changePoints: number[], cusumPos: number[], cusumNeg: number[] }}
 */
export function detectChangepointsCUSUM(series, opts = {}) {
  const mu  = mean(series);
  const sd  = stddev(series, mu);
  const k   = opts.k ?? 0.5 * sd;
  const h   = opts.h ?? 5.0 * sd;

  const cusumPos = new Array(series.length).fill(0);
  const cusumNeg = new Array(series.length).fill(0);
  const changePoints = [];

  for (let i = 1; i < series.length; i++) {
    cusumPos[i] = Math.max(0, cusumPos[i - 1] + (series[i] - mu) - k);
    cusumNeg[i] = Math.max(0, cusumNeg[i - 1] - (series[i] - mu) - k);
    if (cusumPos[i] > h || cusumNeg[i] > h) {
      changePoints.push({ index: i, value: series[i], type: cusumPos[i] > h ? 'upshift' : 'downshift' });
      // Reset
      cusumPos[i] = 0;
      cusumNeg[i] = 0;
    }
  }

  return { changePoints, cusumPos, cusumNeg };
}

// ─── Trend Analysis ───────────────────────────────────────────────────────────

/**
 * Ordinary least squares linear regression on a series.
 *
 * @param {number[]} series
 * @returns {{ slope: number, intercept: number, r2: number, trend: 'up'|'down'|'flat' }}
 */
export function linearTrend(series) {
  const n  = series.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xm = (n - 1) / 2;
  const ym = mean(series);

  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - xm) * (series[i] - ym);
    ssxx += (xs[i] - xm) ** 2;
    ssyy += (series[i] - ym) ** 2;
  }

  const slope     = ssxx === 0 ? 0 : ssxy / ssxx;
  const intercept = ym - slope * xm;
  const r2        = ssyy === 0 ? 1 : (ssxy ** 2) / (ssxx * ssyy);

  let trend = 'flat';
  const slopeThreshold = stddev(series, ym) * 0.01;
  if (slope > slopeThreshold)  trend = 'up';
  if (slope < -slopeThreshold) trend = 'down';

  return { slope, intercept, r2, trend, n };
}

/**
 * Simple Moving Average (SMA).
 *
 * @param {number[]} series
 * @param {number}   window
 * @returns {number[]}  (length = series.length - window + 1)
 */
export function movingAverage(series, window) {
  const result = [];
  let sum = series.slice(0, window).reduce((s, v) => s + v, 0);
  result.push(sum / window);
  for (let i = window; i < series.length; i++) {
    sum += series[i] - series[i - window];
    result.push(sum / window);
  }
  return result;
}

/**
 * Exponential Moving Average (EMA).
 * Alpha = 2 / (window + 1) using PHI-scaled smoothing.
 *
 * @param {number[]} series
 * @param {number}   window
 * @returns {number[]}
 */
export function exponentialMovingAverage(series, window) {
  const alpha  = 2 / (window + 1);
  const result = [series[0]];
  for (let i = 1; i < series.length; i++) {
    result.push(alpha * series[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * PHI-scaled EMA: uses α = PHI_INV / window for golden-ratio smoothing.
 */
export function phiEMA(series, window) {
  const alpha  = PHI_INV / window;
  const result = [series[0]];
  for (let i = 1; i < series.length; i++) {
    result.push(alpha * series[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

// ─── Correlation Detection ────────────────────────────────────────────────────

/**
 * Pearson correlation coefficient between two series.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number}  [-1, 1]
 */
export function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/**
 * Spearman rank correlation.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number}  [-1, 1]
 */
export function spearmanCorrelation(x, y) {
  const n  = Math.min(x.length, y.length);
  const rx = _rankArray(x.slice(0, n));
  const ry = _rankArray(y.slice(0, n));
  return pearsonCorrelation(rx, ry);
}

function _rankArray(arr) {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks   = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const rank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = rank;
    i = j;
  }
  return ranks;
}

/**
 * Cross-correlation between two series at various lags.
 * @param {number[]} x
 * @param {number[]} y
 * @param {number}   maxLag
 * @returns {{ lag: number, correlation: number }[]}
 */
export function crossCorrelation(x, y, maxLag = 10) {
  const results = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let xi, yi;
    if (lag >= 0) {
      xi = x.slice(0, x.length - lag);
      yi = y.slice(lag);
    } else {
      xi = x.slice(-lag);
      yi = y.slice(0, y.length + lag);
    }
    const n = Math.min(xi.length, yi.length);
    results.push({
      lag,
      correlation: pearsonCorrelation(xi.slice(0, n), yi.slice(0, n)),
    });
  }
  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

// ─── Recurring Pattern / Periodicity ─────────────────────────────────────────

/**
 * Detect periodicity via autocorrelation.
 *
 * @param {number[]} series
 * @param {object}  [opts]
 * @param {number}  [opts.maxPeriod]   Maximum period to test (default: series.length/3)
 * @param {number}  [opts.threshold]   Minimum correlation to call a period (default: 0.5)
 * @returns {{ period: number, strength: number }[]}  Sorted by strength desc
 */
export function detectPeriodicity(series, opts = {}) {
  const maxPeriod = opts.maxPeriod ?? Math.floor(series.length / 3);
  const threshold = opts.threshold ?? 0.5;
  const mu        = mean(series);
  const centered  = series.map(v => v - mu);

  const autocorr = [];
  const denom    = centered.reduce((s, v) => s + v * v, 0);

  for (let lag = 1; lag <= maxPeriod; lag++) {
    let num = 0;
    for (let i = lag; i < centered.length; i++) {
      num += centered[i] * centered[i - lag];
    }
    const r = denom === 0 ? 0 : num / denom;
    autocorr.push({ period: lag, strength: r });
  }

  return autocorr
    .filter(a => a.strength >= threshold)
    .sort((a, b) => b.strength - a.strength);
}

// ─── Pattern Classifier ───────────────────────────────────────────────────────

/**
 * Classify the dominant pattern type in a series.
 *
 * @param {number[]} series
 * @returns {{ type: PatternType, confidence: number, details: object }}
 */
export function classifyPattern(series) {
  if (series.length < 4) return { type: 'unknown', confidence: 0, details: {} };

  const trend  = linearTrend(series);
  const mu     = mean(series);
  const sd     = stddev(series, mu);
  const cv     = sd / Math.abs(mu || 1);  // coefficient of variation

  // Check for plateau: very low CV
  if (cv < 0.05) {
    return { type: 'plateau', confidence: 1 - cv / 0.05, details: { mean: mu, cv } };
  }

  // Check for oscillation: high autocorrelation at small lags
  const periods = detectPeriodicity(series, { maxPeriod: Math.min(20, Math.floor(series.length / 4)), threshold: 0.4 });
  if (periods.length > 0 && periods[0].strength > 0.6) {
    return { type: 'oscillation', confidence: periods[0].strength, details: { period: periods[0].period } };
  }

  // Check for strong trend
  if (trend.r2 > 0.7) {
    return {
      type:       trend.trend === 'up' ? 'uptrend' : 'downtrend',
      confidence: trend.r2,
      details:    { slope: trend.slope, r2: trend.r2 },
    };
  }

  // Check for spike pattern: high kurtosis
  const kurtosis = _kurtosis(series, mu, sd);
  if (kurtosis > 4) {
    return { type: 'spiky', confidence: Math.min(1, (kurtosis - 4) / 10), details: { kurtosis } };
  }

  // Drift: moderate trend + noise
  if (Math.abs(trend.slope) > sd * 0.01) {
    return {
      type:       'drift',
      confidence: trend.r2,
      details:    { slope: trend.slope, noise: cv },
    };
  }

  return {
    type:       'noisy',
    confidence: 1 - trend.r2,
    details:    { cv, trend: trend.trend },
  };
}

function _kurtosis(arr, mu, sd) {
  if (sd === 0) return 0;
  const n = arr.length;
  const k4 = arr.reduce((s, v) => s + ((v - mu) / sd) ** 4, 0) / n;
  return k4 - 3; // excess kurtosis
}

// ─── PatternEngine class ──────────────────────────────────────────────────────

export class PatternEngine extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.anomalyWindow]    Default rolling window for anomaly detection
   * @param {number}  [opts.anomalyThreshold] Default Z-score threshold
   * @param {boolean} [opts.autoEmit]         Emit events for detected patterns (default: true)
   */
  constructor(opts = {}) {
    super();
    this._anomalyWindow    = opts.anomalyWindow    ?? Math.round(21 * PHI_INV + 13); // ~26
    this._anomalyThreshold = opts.anomalyThreshold ?? 3.0;
    this._autoEmit         = opts.autoEmit         ?? true;
    this._history          = new Map(); // seriesId → samples[]
    this._patterns         = new Map(); // seriesId → last detected pattern
  }

  /**
   * Ingest a data point into a named time series.
   *
   * @param {string}   seriesId
   * @param {number}   value
   * @param {object}   [meta]
   * @param {number}   [meta.timestamp]  Unix ms
   * @param {number}   [meta.maxLength]  Max history length (default: PHI-scaled 610)
   */
  ingest(seriesId, value, meta = {}) {
    if (!this._history.has(seriesId)) {
      this._history.set(seriesId, []);
    }
    const series    = this._history.get(seriesId);
    const maxLength = meta.maxLength ?? Math.round(FIBO[10] * PHI); // ~987 * PHI ≈ 144
    series.push({ value, timestamp: meta.timestamp ?? Date.now() });
    if (series.length > maxLength) series.shift();
    return this;
  }

  /**
   * Analyze a named time series.
   *
   * @param {string} seriesId
   * @returns {SeriesAnalysis}
   */
  analyze(seriesId) {
    const series  = this._history.get(seriesId) ?? [];
    const values  = series.map(p => p.value);

    if (values.length < 4) {
      return { seriesId, status: 'insufficient_data', count: values.length };
    }

    const anomalies   = detectAnomaliesZScore(values, {
      windowSize:  this._anomalyWindow,
      zThreshold:  this._anomalyThreshold,
    });
    const trend       = linearTrend(values);
    const pattern     = classifyPattern(values);
    const periodicity = detectPeriodicity(values, { maxPeriod: Math.min(30, Math.floor(values.length / 4)) });

    const analysis = {
      seriesId,
      count:        values.length,
      latest:       values[values.length - 1],
      mean:         mean(values),
      stddev:       stddev(values),
      trend,
      pattern,
      periodicity:  periodicity.slice(0, 3),
      anomalies:    anomalies.slice(-20), // last 20 anomalies
      recentAnomaly: anomalies[anomalies.length - 1] ?? null,
      analyzedAt:   Date.now(),
    };

    this._patterns.set(seriesId, analysis);

    if (this._autoEmit) {
      if (anomalies.length > 0) {
        this.emit('anomaly', { seriesId, anomaly: anomalies[anomalies.length - 1] });
      }
      this.emit('analysis', analysis);
    }

    return analysis;
  }

  /**
   * Analyze all known series.
   * @returns {SeriesAnalysis[]}
   */
  analyzeAll() {
    return [...this._history.keys()].map(id => this.analyze(id));
  }

  /**
   * Compare two series for correlation.
   * @param {string} seriesA
   * @param {string} seriesB
   * @param {number} [maxLag]
   * @returns {{ pearson: number, spearman: number, crossCorrelation: object[] }}
   */
  correlate(seriesA, seriesB, maxLag = 5) {
    const a = (this._history.get(seriesA) ?? []).map(p => p.value);
    const b = (this._history.get(seriesB) ?? []).map(p => p.value);
    const n = Math.min(a.length, b.length);
    return {
      seriesA, seriesB,
      pearson:          pearsonCorrelation(a.slice(-n), b.slice(-n)),
      spearman:         spearmanCorrelation(a.slice(-n), b.slice(-n)),
      crossCorrelation: crossCorrelation(a.slice(-n), b.slice(-n), maxLag),
    };
  }

  /**
   * Forecast next N values using linear extrapolation + EMA.
   * @param {string} seriesId
   * @param {number} steps
   * @returns {number[]}
   */
  forecast(seriesId, steps = 5) {
    const series = (this._history.get(seriesId) ?? []).map(p => p.value);
    if (series.length < 2) return [];

    const trend   = linearTrend(series);
    const emaVals = exponentialMovingAverage(series, Math.max(2, Math.round(series.length * PHI_INV)));
    const lastEMA = emaVals[emaVals.length - 1];
    const n       = series.length;

    return Array.from({ length: steps }, (_, i) => {
      const trendValue = trend.intercept + trend.slope * (n + i);
      const alpha      = PHI_INV * 0.5;
      return alpha * trendValue + (1 - alpha) * lastEMA;
    });
  }

  /**
   * Clear history for a series.
   */
  clearSeries(seriesId) {
    this._history.delete(seriesId);
    this._patterns.delete(seriesId);
    return this;
  }

  /**
   * Engine status.
   */
  status() {
    return {
      trackedSeries: this._history.size,
      analyzedSeries: this._patterns.size,
      series: [...this._history.keys()].map(id => ({
        id,
        count: this._history.get(id).length,
        lastPattern: this._patterns.get(id)?.pattern?.type ?? 'unanalyzed',
      })),
    };
  }
}

export default PatternEngine;

/**
 * @file provider-usage-tracker.js
 * @description LLM provider usage tracking with token counting, cost calculation,
 * usage trending, and anomaly detection on usage spikes.
 *
 * Cost model: per-provider per-model token pricing (USD per 1M tokens).
 * Trending: sliding window with PHI-weighted exponential moving average.
 * Anomaly: Z-score based detection with PHI-scaled sigma threshold.
 *
 * Zero external dependencies — pure Node.js + EventEmitter.
 * Sacred Geometry: PHI weighting for trend smoothing.
 *
 * @module HeadyTelemetry/ProviderUsageTracker
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// ─── Provider Pricing (USD per 1M tokens, as of 2026-Q1) ─────────────────────
// Input / Output pricing separately
export const PROVIDER_PRICING = Object.freeze({
  anthropic: {
    'claude-opus-4-5':    { input: 15.00, output: 75.00 },
    'claude-sonnet-4-5':  { input:  3.00, output: 15.00 },
    'claude-haiku-4-5':   { input:  0.25, output:  1.25 },
    default:              { input:  3.00, output: 15.00 },
  },
  openai: {
    'gpt-4o':             { input:  2.50, output: 10.00 },
    'gpt-4o-mini':        { input:  0.15, output:  0.60 },
    'text-embedding-3-small': { input: 0.02, output: 0 },
    default:              { input:  2.50, output: 10.00 },
  },
  google: {
    'gemini-2.0-flash':   { input:  0.075, output: 0.30 },
    'gemini-2.0-flash-lite': { input: 0.0375, output: 0.15 },
    'text-embedding-004': { input:  0.00,  output: 0.00 },
    default:              { input:  0.075, output: 0.30 },
  },
  groq: {
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'llama-3.1-8b-instant':    { input: 0.05, output: 0.08 },
    default:                   { input: 0.59, output: 0.79 },
  },
  perplexity: {
    'sonar-pro':  { input: 3.00, output: 15.00 },
    'sonar':      { input: 1.00, output:  1.00 },
    default:      { input: 3.00, output: 15.00 },
  },
  ollama: {
    default: { input: 0, output: 0 },  // local, no cost
  },
});

/**
 * Calculate cost in USD for a given token count.
 * @param {string} provider
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} cost in USD
 */
export function calculateCost(provider, model, inputTokens, outputTokens) {
  const providerPricing = PROVIDER_PRICING[provider] ?? PROVIDER_PRICING.openai;
  const pricing = providerPricing[model] ?? providerPricing.default;
  return (
    (inputTokens  / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ─── Usage Record ─────────────────────────────────────────────────────────────
/**
 * @typedef {object} UsageRecord
 * @property {string} id
 * @property {string} ts
 * @property {string} provider
 * @property {string} model
 * @property {string} taskType
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {number} costUsd
 * @property {number} latencyMs
 * @property {boolean} cached
 * @property {string} [spanId]
 * @property {string} [traceId]
 */

// ─── Trend EMA ────────────────────────────────────────────────────────────────
class PhiEMA {
  /**
   * PHI-weighted exponential moving average.
   * alpha = 1 - 1/PHI ≈ 0.382
   */
  constructor(alpha = 1 - PHI_INV) {
    this._alpha = alpha;
    this._value = null;
  }

  update(x) {
    if (this._value === null) { this._value = x; }
    else { this._value = this._alpha * x + (1 - this._alpha) * this._value; }
    return this._value;
  }

  get value() { return this._value ?? 0; }
  reset()     { this._value = null; }
}

// ─── Anomaly Detector (Z-score) ────────────────────────────────────────────────
class AnomalyDetector {
  /**
   * @param {number} windowSize  Rolling window of recent values
   * @param {number} threshold   Z-score threshold (PHI * 2 ≈ 3.236 by default)
   */
  constructor(windowSize = 21, threshold = PHI * 2) {
    this._window    = [];
    this._windowSize = windowSize;
    this._threshold  = threshold;
  }

  observe(value) {
    this._window.push(value);
    if (this._window.length > this._windowSize) this._window.shift();
  }

  check(value) {
    if (this._window.length < 5) return { anomaly: false };

    const mean = this._window.reduce((a, b) => a + b, 0) / this._window.length;
    const std  = Math.sqrt(
      this._window.reduce((a, b) => a + (b - mean) ** 2, 0) / this._window.length
    );

    if (std === 0) return { anomaly: false, mean, std, z: 0 };

    const z = (value - mean) / std;
    return {
      anomaly:   Math.abs(z) >= this._threshold,
      z,
      mean,
      std,
      threshold: this._threshold,
      direction: z > 0 ? 'HIGH' : 'LOW',
    };
  }
}

// ─── ProviderUsageTracker ─────────────────────────────────────────────────────
export class ProviderUsageTracker extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}  [opts.windowMs]   Rolling window size ms (default 1h)
   * @param {number}  [opts.maxRecords] Max records in ring buffer
   */
  constructor(opts = {}) {
    super();
    this._windowMs  = opts.windowMs  ?? 3_600_000;   // 1 hour
    this._maxRecords = opts.maxRecords ?? 1597;       // Fibonacci

    // Per-provider state
    this._records    = [];   // ring buffer of UsageRecord
    this._byProvider = new Map();  // provider → { totalCost, inputTokens, outputTokens, count, ema, anomaly }
    this._emaTokens  = new Map();  // provider → PhiEMA on total tokens per request
    this._anomaly    = new Map();  // provider → AnomalyDetector

    // Global daily totals (reset at midnight)
    this._dayStart = this._todayStart();
    this._dailyCost = 0;
    this._dailyTokens = 0;
  }

  _todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  _ensureProvider(provider) {
    if (!this._byProvider.has(provider)) {
      this._byProvider.set(provider, {
        totalCost:    0,
        inputTokens:  0,
        outputTokens: 0,
        count:        0,
        lastTs:       null,
      });
      this._emaTokens.set(provider, new PhiEMA());
      this._anomaly.set(provider, new AnomalyDetector(21, PHI * 2));
    }
  }

  _checkDayRollover() {
    if (Date.now() - this._dayStart >= 86_400_000) {
      this._dayStart    = this._todayStart();
      this._dailyCost   = 0;
      this._dailyTokens = 0;
      this.emit('dayRollover', { ts: new Date().toISOString() });
    }
  }

  /**
   * Record a usage event.
   * @param {object} params
   * @param {string} params.provider
   * @param {string} params.model
   * @param {number} params.inputTokens
   * @param {number} params.outputTokens
   * @param {string} [params.taskType]
   * @param {number} [params.latencyMs]
   * @param {boolean} [params.cached]
   * @param {string}  [params.spanId]
   * @param {string}  [params.traceId]
   * @returns {UsageRecord}
   */
  record({ provider, model, inputTokens, outputTokens, taskType = 'default',
           latencyMs = 0, cached = false, spanId, traceId }) {
    this._checkDayRollover();
    this._ensureProvider(provider);

    const costUsd      = calculateCost(provider, model, inputTokens, outputTokens);
    const totalTokens  = inputTokens + outputTokens;

    const rec = {
      id:           randomUUID(),
      ts:           new Date().toISOString(),
      provider,
      model,
      taskType,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      latencyMs,
      cached,
      spanId:       spanId  ?? null,
      traceId:      traceId ?? null,
    };

    // Ring buffer
    this._records.push(rec);
    if (this._records.length > this._maxRecords) this._records.shift();

    // Per-provider accumulate
    const ps = this._byProvider.get(provider);
    ps.totalCost    += costUsd;
    ps.inputTokens  += inputTokens;
    ps.outputTokens += outputTokens;
    ps.count        += 1;
    ps.lastTs        = rec.ts;

    // Daily totals
    this._dailyCost   += costUsd;
    this._dailyTokens += totalTokens;

    // Trend update
    const ema     = this._emaTokens.get(provider);
    const trendVal = ema.update(totalTokens);

    // Anomaly check
    const detector = this._anomaly.get(provider);
    const anomalyResult = detector.check(totalTokens);
    detector.observe(totalTokens);

    if (anomalyResult.anomaly) {
      this.emit('anomaly', { ...anomalyResult, provider, model, totalTokens, ts: rec.ts });
    }

    // Cost events
    this.emit('usage', { ...rec, trend: trendVal });

    return rec;
  }

  /**
   * Get rolling window stats for a provider.
   * @param {string} provider
   * @param {number} [windowMs]  Override default window
   * @returns {object}
   */
  windowStats(provider, windowMs) {
    const cutoff = Date.now() - (windowMs ?? this._windowMs);
    const records = this._records.filter(
      r => r.provider === provider && new Date(r.ts).getTime() > cutoff
    );

    if (!records.length) return { provider, count: 0, totalCost: 0, totalTokens: 0 };

    return {
      provider,
      count:        records.length,
      totalCost:    records.reduce((a, r) => a + r.costUsd, 0),
      totalTokens:  records.reduce((a, r) => a + r.totalTokens, 0),
      inputTokens:  records.reduce((a, r) => a + r.inputTokens, 0),
      outputTokens: records.reduce((a, r) => a + r.outputTokens, 0),
      avgTokens:    records.reduce((a, r) => a + r.totalTokens, 0) / records.length,
      avgLatency:   records.reduce((a, r) => a + r.latencyMs,   0) / records.length,
      cacheHitRate: records.filter(r => r.cached).length / records.length,
      windowMs:     windowMs ?? this._windowMs,
    };
  }

  /** All-time provider totals */
  providerTotals(provider) {
    const ps = this._byProvider.get(provider);
    if (!ps) return null;
    return {
      provider,
      ...ps,
      ema: this._emaTokens.get(provider)?.value ?? 0,
    };
  }

  /** Daily totals */
  dailyTotals() {
    return {
      ts:          new Date().toISOString(),
      dayStart:    new Date(this._dayStart).toISOString(),
      totalCostUsd: this._dailyCost,
      totalTokens:  this._dailyTokens,
      byProvider:   Object.fromEntries(
        [...this._byProvider.entries()].map(([p, s]) => [p, { ...s }])
      ),
    };
  }

  /**
   * Cost prediction: extrapolate current daily rate to end-of-day.
   * @returns {{ predictedDailyCost, hoursElapsed, ratePerHour }}
   */
  predictDailyCost() {
    const now        = Date.now();
    const elapsed    = now - this._dayStart;
    const hoursElapsed = elapsed / 3_600_000;
    const ratePerHour  = hoursElapsed > 0 ? this._dailyCost / hoursElapsed : 0;
    const remaining  = 24 - hoursElapsed;
    return {
      predictedDailyCost: this._dailyCost + ratePerHour * remaining,
      dailyCostSoFar:     this._dailyCost,
      hoursElapsed,
      ratePerHour,
      hoursRemaining:     remaining,
    };
  }

  /** Recent records (last n) */
  recent(n = 21) {
    return this._records.slice(-n);
  }

  /** Usage report */
  report() {
    return {
      ts:           new Date().toISOString(),
      daily:        this.dailyTotals(),
      prediction:   this.predictDailyCost(),
      providers:    Object.fromEntries(
        [...this._byProvider.keys()].map(p => [p, this.windowStats(p)])
      ),
      totalRecords: this._records.length,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _tracker = null;

export function getUsageTracker(opts = {}) {
  if (!_tracker) _tracker = new ProviderUsageTracker(opts);
  return _tracker;
}

export default ProviderUsageTracker;

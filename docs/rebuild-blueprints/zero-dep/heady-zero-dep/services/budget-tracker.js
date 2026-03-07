/**
 * @file budget-tracker.js
 * @description Financial tracking for LLM API spending.
 *
 * Features:
 * - Per-provider cost tracking (daily / weekly / monthly)
 * - Daily/weekly/monthly caps with hard and soft thresholds
 * - Cost prediction via PHI-weighted linear extrapolation
 * - Alert thresholds with event emission
 * - Usage reports in multiple formats
 * - Auto-downgrade recommendation when approaching cap
 *
 * Sacred Geometry: PHI-weighted smoothing, Fibonacci alert levels.
 * Zero external dependencies — events, crypto (Node built-ins only).
 *
 * @module HeadyServices/BudgetTracker
 */

import { EventEmitter } from 'events';
import { randomUUID }   from 'crypto';

// ─── Sacred Geometry ─────────────────────────────────────────────────────────
const PHI     = 1.6180339887498948482;
const PHI_INV = 1 / PHI;

// Alert levels (Fibonacci fractions of cap)
const ALERT_LEVELS = [
  { name: 'warn',     threshold: PHI_INV * PHI_INV },  // ≈38.2%
  { name: 'high',     threshold: PHI_INV             }, // ≈61.8%
  { name: 'critical', threshold: PHI_INV * PHI        }, // ≈100%  (really 1.0)
];

// ─── Caps ─────────────────────────────────────────────────────────────────────
export const DEFAULT_CAPS = Object.freeze({
  daily:   { anthropic: 10, openai: 10, google: 5, groq: 3, perplexity: 5, ollama: 0, total: 33 },
  weekly:  { anthropic: 60, openai: 60, google: 30, groq: 18, perplexity: 30, ollama: 0, total: 198 },
  monthly: { anthropic: 250, openai: 250, google: 125, groq: 75, perplexity: 125, ollama: 0, total: 825 },
});

// ─── Spend Entry ──────────────────────────────────────────────────────────────
/**
 * @typedef {object} SpendEntry
 * @property {string} id
 * @property {string} ts        ISO timestamp
 * @property {string} provider
 * @property {string} model
 * @property {number} costUsd
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {string} [taskType]
 * @property {string} [requestId]
 */

// ─── Period Utils ─────────────────────────────────────────────────────────────
function dayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function monthStart(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── BudgetTracker ────────────────────────────────────────────────────────────
export class BudgetTracker extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object} [opts.caps]     Override DEFAULT_CAPS
   * @param {number} [opts.maxEntries] Ring buffer size (default 10946 = Fibonacci)
   */
  constructor(opts = {}) {
    super();
    this._caps    = opts.caps ?? structuredClone(DEFAULT_CAPS);
    this._maxEntries = opts.maxEntries ?? 10_946;  // Fibonacci
    this._entries = [];
    this._alertedLevels = new Map();  // `provider:period:level` → last alerted ts
  }

  // ─── Record ───────────────────────────────────────────────────────────

  /**
   * Record a spend event.
   * @param {object} params
   * @returns {SpendEntry}
   */
  record({ provider, model, costUsd, inputTokens = 0, outputTokens = 0,
           taskType = 'default', requestId }) {
    const entry = {
      id:           randomUUID(),
      ts:           new Date().toISOString(),
      provider,
      model:        model ?? 'unknown',
      costUsd,
      inputTokens,
      outputTokens,
      taskType,
      requestId:    requestId ?? null,
    };

    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) this._entries.shift();

    // Check thresholds
    this._checkAlerts(provider);
    this.emit('spend', entry);
    return entry;
  }

  // ─── Aggregation ──────────────────────────────────────────────────────

  /**
   * Sum spending for a provider and period.
   * @param {string} provider   'anthropic' | 'openai' | ... | 'total'
   * @param {string} period     'daily' | 'weekly' | 'monthly' | 'all'
   * @returns {number} USD
   */
  total(provider, period = 'daily') {
    const now = Date.now();
    const from = period === 'daily'   ? dayStart()   :
                 period === 'weekly'  ? weekStart()  :
                 period === 'monthly' ? monthStart() : 0;

    return this._entries
      .filter(e => {
        const ts = new Date(e.ts).getTime();
        if (ts < from) return false;
        if (provider === 'total') return true;
        return e.provider === provider;
      })
      .reduce((sum, e) => sum + e.costUsd, 0);
  }

  /**
   * Per-provider breakdown for a period.
   * @param {string} period
   * @returns {object} provider → { costUsd, inputTokens, outputTokens, requests }
   */
  breakdown(period = 'daily') {
    const now  = Date.now();
    const from = period === 'daily'   ? dayStart()   :
                 period === 'weekly'  ? weekStart()  :
                 period === 'monthly' ? monthStart() : 0;

    const result = {};
    for (const e of this._entries) {
      if (new Date(e.ts).getTime() < from) continue;
      if (!result[e.provider]) {
        result[e.provider] = { costUsd: 0, inputTokens: 0, outputTokens: 0, requests: 0 };
      }
      result[e.provider].costUsd      += e.costUsd;
      result[e.provider].inputTokens  += e.inputTokens;
      result[e.provider].outputTokens += e.outputTokens;
      result[e.provider].requests     += 1;
    }
    return result;
  }

  // ─── Cap Checks ───────────────────────────────────────────────────────

  /**
   * Get current cap utilization for a provider+period.
   * @returns {{ used, cap, pct, remaining, willExceed }}
   */
  capStatus(provider, period = 'daily') {
    const used = this.total(provider, period);
    const cap  = this._caps[period]?.[provider] ?? Infinity;
    const pct  = cap === Infinity ? 0 : used / cap;
    return {
      provider, period,
      used,
      cap,
      pct,
      remaining: Math.max(0, cap - used),
      willExceed: pct >= 1,
      downgradeNeeded: pct >= PHI_INV,  // ≥61.8% → recommend downgrade
    };
  }

  /**
   * Check if a spend amount would exceed any cap.
   * @param {string} provider
   * @param {number} amount  USD
   * @returns {{ allowed, period, remaining }}
   */
  canSpend(provider, amount) {
    for (const period of ['daily', 'weekly', 'monthly']) {
      const status = this.capStatus(provider, period);
      if (status.remaining < amount) {
        return { allowed: false, period, remaining: status.remaining };
      }
    }
    // Check global total
    for (const period of ['daily', 'weekly', 'monthly']) {
      const status = this.capStatus('total', period);
      if (status.remaining < amount) {
        return { allowed: false, period, remaining: status.remaining, global: true };
      }
    }
    return { allowed: true };
  }

  _checkAlerts(provider) {
    for (const period of ['daily', 'weekly', 'monthly']) {
      const status = this.capStatus(provider, period);
      for (const level of ALERT_LEVELS) {
        if (status.pct >= level.threshold) {
          const key = `${provider}:${period}:${level.name}`;
          // Debounce: only fire once per hour per level per provider+period
          const lastFired = this._alertedLevels.get(key) ?? 0;
          if (Date.now() - lastFired > 3_600_000) {
            this._alertedLevels.set(key, Date.now());
            this.emit('alert', {
              level:    level.name,
              provider,
              period,
              used:     status.used,
              cap:      status.cap,
              pct:      status.pct,
              ts:       new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // ─── Prediction ───────────────────────────────────────────────────────

  /**
   * Predict end-of-period spend using PHI-weighted rate extrapolation.
   * @param {string} provider
   * @param {string} period   'daily' | 'weekly' | 'monthly'
   * @returns {object}
   */
  predict(provider, period = 'daily') {
    const periodStart = period === 'daily'   ? dayStart()   :
                        period === 'weekly'  ? weekStart()  :
                        period === 'monthly' ? monthStart() : 0;
    const periodDuration = period === 'daily'   ? 86_400_000 :
                           period === 'weekly'  ? 604_800_000 :
                           period === 'monthly' ? 2_592_000_000 : 86_400_000;

    const elapsed   = Date.now() - periodStart;
    const remaining = periodDuration - elapsed;
    const spent     = this.total(provider, period);
    const rate      = elapsed > 0 ? spent / elapsed : 0;  // USD/ms

    // PHI-weighted: recent rate matters more
    const recentWindow = Math.min(elapsed, 3_600_000);  // last 1h or elapsed
    const recentCutoff = Date.now() - recentWindow;
    const recentSpent  = this._entries
      .filter(e => e.provider === (provider === 'total' ? e.provider : provider)
                && new Date(e.ts).getTime() > recentCutoff)
      .reduce((s, e) => s + e.costUsd, 0);
    const recentRate = recentWindow > 0 ? recentSpent / recentWindow : 0;

    // Blend: PHI_INV * recentRate + (1-PHI_INV) * historicRate
    const blendedRate = PHI_INV * recentRate + (1 - PHI_INV) * rate;
    const projected   = spent + blendedRate * remaining;

    const cap = this._caps[period]?.[provider] ?? Infinity;
    const hoursRemaining = remaining / 3_600_000;

    return {
      provider, period,
      spent, projected,
      cap,
      projectedPct:   cap === Infinity ? 0 : projected / cap,
      willExceedCap:  cap !== Infinity && projected > cap,
      exceedBy:       cap !== Infinity ? Math.max(0, projected - cap) : 0,
      ratePerHour:    blendedRate * 3_600_000,
      hoursRemaining,
      elapsedHours:   elapsed / 3_600_000,
    };
  }

  // ─── Reports ──────────────────────────────────────────────────────────

  /**
   * Full budget report.
   */
  report() {
    const ts = new Date().toISOString();
    const periods = ['daily', 'weekly', 'monthly'];
    const providers = ['anthropic', 'openai', 'google', 'groq', 'perplexity', 'ollama'];

    const caps = {};
    for (const period of periods) {
      caps[period] = {};
      for (const p of [...providers, 'total']) {
        caps[period][p] = this.capStatus(p, period);
      }
    }

    const predictions = {};
    for (const period of periods) {
      predictions[period] = {};
      for (const p of [...providers, 'total']) {
        predictions[period][p] = this.predict(p, period);
      }
    }

    return {
      ts,
      caps,
      predictions,
      breakdowns: Object.fromEntries(periods.map(p => [p, this.breakdown(p)])),
      totalEntries: this._entries.length,
    };
  }

  // ─── Cap management ───────────────────────────────────────────────────

  setCap(provider, period, amount) {
    if (!this._caps[period]) this._caps[period] = {};
    this._caps[period][provider] = amount;
    this.emit('capUpdated', { provider, period, amount });
  }

  getCap(provider, period) {
    return this._caps[period]?.[provider] ?? Infinity;
  }

  reset(provider, period) {
    // Clear entries for this provider+period (for testing / manual reset)
    const from = period === 'daily'   ? dayStart()   :
                 period === 'weekly'  ? weekStart()  :
                 period === 'monthly' ? monthStart() : 0;
    this._entries = this._entries.filter(e => {
      if (new Date(e.ts).getTime() < from) return true;
      if (provider === 'total') return false;
      return e.provider !== provider;
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _tracker = null;

export function getBudgetTracker(opts = {}) {
  if (!_tracker) _tracker = new BudgetTracker(opts);
  return _tracker;
}

export default BudgetTracker;

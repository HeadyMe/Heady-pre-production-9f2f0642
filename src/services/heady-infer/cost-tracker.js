'use strict';

const EventEmitter = require('events');

/**
 * CostTracker — Real-time cost accumulation and budget enforcement.
 *
 * Features:
 *  - Per-provider token rates (input/output)
 *  - Daily/monthly budget caps (global + per-provider)
 *  - Auto-downgrade to cheaper models as budget approaches limits
 *  - Alert thresholds: 50%, 75%, 90%, 100%
 *  - Cost reports and projections
 *  - Event emissions: 'alert', 'budgetExceeded', 'downgrade'
 */
class CostTracker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.budget        = config.budget        || {};
    this.dailyCap      = this.budget.dailyCap  || 50;
    this.monthlyCap    = this.budget.monthlyCap || 500;
    this.alertThresholds = this.budget.alertThresholds || [0.5, 0.75, 0.9, 1.0];
    this.autoDowngrade = this.budget.autoDowngrade !== false;
    this.perProvider   = this.budget.perProvider || {};

    // In-memory ledger: buckets by day/month key
    this._ledger = [];           // array of CostEntry
    this._dailyTotals   = new Map();   // 'YYYY-MM-DD'  → { total, byProvider }
    this._monthlyTotals = new Map();   // 'YYYY-MM'     → { total, byProvider }
    this._alertsFired   = new Set();   // 'daily:0.5', 'monthly:0.75', etc.

    // Downgrade tiers: ordered cheapest→most-expensive within each provider
    this._downgradeTiers = config.downgradeTiers || {
      anthropic: ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
      openai:    ['gpt-4o-mini', 'gpt-4o', 'o1'],
      google:    ['gemini-2.0-flash', 'gemini-1.5-pro'],
      groq:      ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
      local:     ['llama3.1'],
    };
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  /**
   * Record a completed request's cost.
   * @param {object} entry
   * @param {string} entry.provider
   * @param {string} entry.model
   * @param {number} entry.inputTokens
   * @param {number} entry.outputTokens
   * @param {number} entry.costUsd
   * @param {string} [entry.taskType]
   * @param {string} [entry.requestId]
   */
  record(entry) {
    const now      = new Date();
    const dayKey   = now.toISOString().substring(0, 10);      // 'YYYY-MM-DD'
    const monthKey = now.toISOString().substring(0, 7);       // 'YYYY-MM'
    const cost     = entry.costUsd || 0;

    // Append to ledger
    this._ledger.push({
      ...entry,
      timestamp: now.toISOString(),
      dayKey,
      monthKey,
    });

    // Accumulate daily
    if (!this._dailyTotals.has(dayKey)) {
      this._dailyTotals.set(dayKey, { total: 0, byProvider: {} });
    }
    const daily = this._dailyTotals.get(dayKey);
    daily.total += cost;
    daily.byProvider[entry.provider] = (daily.byProvider[entry.provider] || 0) + cost;

    // Accumulate monthly
    if (!this._monthlyTotals.has(monthKey)) {
      this._monthlyTotals.set(monthKey, { total: 0, byProvider: {} });
    }
    const monthly = this._monthlyTotals.get(monthKey);
    monthly.total += cost;
    monthly.byProvider[entry.provider] = (monthly.byProvider[entry.provider] || 0) + cost;

    // Check alerts
    this._checkAlerts(dayKey, monthKey);

    this.emit('recorded', entry);
    return { dayKey, monthKey, dailyTotal: daily.total, monthlyTotal: monthly.total };
  }

  // ─── Budget Checks ────────────────────────────────────────────────────────

  /**
   * Check if a request should be allowed based on budgets.
   * @param {string} provider
   * @param {number} estimatedCost  estimated cost for the upcoming request
   * @returns {{ allowed: boolean, reason?: string }}
   */
  checkBudget(provider, estimatedCost = 0) {
    const dayKey   = new Date().toISOString().substring(0, 10);
    const monthKey = new Date().toISOString().substring(0, 7);

    const dailyTotal   = (this._dailyTotals.get(dayKey)   || { total: 0 }).total;
    const monthlyTotal = (this._monthlyTotals.get(monthKey) || { total: 0 }).total;
    const providerDailyCap = this.perProvider[provider] || Infinity;
    const providerDaily = (this._dailyTotals.get(dayKey)?.byProvider?.[provider] || 0);

    if (dailyTotal + estimatedCost > this.dailyCap) {
      return { allowed: false, reason: `Daily budget cap exceeded ($${this.dailyCap.toFixed(2)})` };
    }
    if (monthlyTotal + estimatedCost > this.monthlyCap) {
      return { allowed: false, reason: `Monthly budget cap exceeded ($${this.monthlyCap.toFixed(2)})` };
    }
    if (providerDaily + estimatedCost > providerDailyCap) {
      return { allowed: false, reason: `Provider ${provider} daily cap exceeded ($${providerDailyCap.toFixed(2)})` };
    }

    return { allowed: true };
  }

  /**
   * Suggest a downgraded model if budget is approaching a threshold.
   * @param {string} provider
   * @param {string} model
   * @returns {string|null} downgraded model name, or null if no downgrade needed
   */
  suggestDowngrade(provider, model) {
    if (!this.autoDowngrade) return null;

    const dayKey     = new Date().toISOString().substring(0, 10);
    const monthKey   = new Date().toISOString().substring(0, 7);
    const dailyUsage = (this._dailyTotals.get(dayKey)   || { total: 0 }).total;
    const monthUsage = (this._monthlyTotals.get(monthKey) || { total: 0 }).total;

    const dailyPct   = dailyUsage  / this.dailyCap;
    const monthlyPct = monthUsage  / this.monthlyCap;
    const maxPct     = Math.max(dailyPct, monthlyPct);

    // Downgrade if at 75%+ of budget
    if (maxPct < 0.75) return null;

    const tiers    = this._downgradeTiers[provider];
    if (!tiers) return null;
    const idx = tiers.indexOf(model);
    if (idx <= 0) return null;  // already cheapest or not in tiers

    const downgraded = tiers[0];  // use cheapest
    this.emit('downgrade', { provider, from: model, to: downgraded, budgetPct: maxPct });
    return downgraded;
  }

  // ─── Alerts ───────────────────────────────────────────────────────────────

  _checkAlerts(dayKey, monthKey) {
    const daily   = this._dailyTotals.get(dayKey)   || { total: 0 };
    const monthly = this._monthlyTotals.get(monthKey) || { total: 0 };

    for (const threshold of this.alertThresholds) {
      // Daily alert
      const dailyKey = `daily:${dayKey}:${threshold}`;
      if (!this._alertsFired.has(dailyKey) && (daily.total / this.dailyCap) >= threshold) {
        this._alertsFired.add(dailyKey);
        this.emit('alert', {
          type:      'daily',
          threshold,
          current:   daily.total,
          cap:       this.dailyCap,
          pct:       daily.total / this.dailyCap,
          dayKey,
        });
        if (threshold >= 1.0) {
          this.emit('budgetExceeded', { type: 'daily', current: daily.total, cap: this.dailyCap });
        }
      }

      // Monthly alert
      const monthlyKey = `monthly:${monthKey}:${threshold}`;
      if (!this._alertsFired.has(monthlyKey) && (monthly.total / this.monthlyCap) >= threshold) {
        this._alertsFired.add(monthlyKey);
        this.emit('alert', {
          type:      'monthly',
          threshold,
          current:   monthly.total,
          cap:       this.monthlyCap,
          pct:       monthly.total / this.monthlyCap,
          monthKey,
        });
        if (threshold >= 1.0) {
          this.emit('budgetExceeded', { type: 'monthly', current: monthly.total, cap: this.monthlyCap });
        }
      }
    }
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  /**
   * Get current day/month totals.
   */
  getCurrentTotals() {
    const dayKey   = new Date().toISOString().substring(0, 10);
    const monthKey = new Date().toISOString().substring(0, 7);
    const daily    = this._dailyTotals.get(dayKey)   || { total: 0, byProvider: {} };
    const monthly  = this._monthlyTotals.get(monthKey) || { total: 0, byProvider: {} };

    return {
      daily: {
        total:    daily.total,
        cap:      this.dailyCap,
        pct:      daily.total / this.dailyCap,
        remaining: Math.max(0, this.dailyCap - daily.total),
        byProvider: daily.byProvider,
      },
      monthly: {
        total:    monthly.total,
        cap:      this.monthlyCap,
        pct:      monthly.total / this.monthlyCap,
        remaining: Math.max(0, this.monthlyCap - monthly.total),
        byProvider: monthly.byProvider,
      },
    };
  }

  /**
   * Generate a detailed cost report.
   * @param {number} [days=30]
   */
  generateReport(days = 30) {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const recent = this._ledger.filter(e => new Date(e.timestamp) > cutoff);

    const byProvider = {};
    const byModel    = {};
    const byTaskType = {};
    const byDay      = {};
    let   totalCost  = 0;
    let   totalTokens = 0;

    for (const e of recent) {
      totalCost   += e.costUsd   || 0;
      totalTokens += (e.inputTokens || 0) + (e.outputTokens || 0);

      byProvider[e.provider]   = (byProvider[e.provider]   || 0) + (e.costUsd || 0);
      byModel[e.model]         = (byModel[e.model]         || 0) + (e.costUsd || 0);
      byTaskType[e.taskType || 'unknown'] = (byTaskType[e.taskType || 'unknown'] || 0) + (e.costUsd || 0);

      const dayKey = e.dayKey || e.timestamp?.substring(0, 10) || 'unknown';
      byDay[dayKey] = (byDay[dayKey] || 0) + (e.costUsd || 0);
    }

    const avgDailyCost = totalCost / Math.max(1, days);
    const projectedMonthly = avgDailyCost * 30;

    return {
      periodDays:       days,
      totalCostUsd:     Number(totalCost.toFixed(6)),
      totalTokens,
      requestCount:     recent.length,
      avgCostPerRequest: recent.length > 0 ? totalCost / recent.length : 0,
      avgDailyCost,
      projectedMonthlyCost: projectedMonthly,
      byProvider:  this._sortByValue(byProvider),
      byModel:     this._sortByValue(byModel),
      byTaskType:  this._sortByValue(byTaskType),
      byDay,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Dashboard summary data.
   */
  getDashboard() {
    return {
      totals:   this.getCurrentTotals(),
      report:   this.generateReport(7),
      alerts:   [...this._alertsFired],
    };
  }

  _sortByValue(obj) {
    return Object.fromEntries(
      Object.entries(obj).sort(([, a], [, b]) => b - a)
    );
  }
}

module.exports = CostTracker;

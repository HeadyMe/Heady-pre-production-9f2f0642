'use strict';
/**
 * @module revenue-metrics
 * @description Revenue metrics calculator for HeadySystems
 *
 * Metrics:
 *   - MRR / ARR (from subscription data)
 *   - Churn rate (monthly/annual)
 *   - LTV = ARPU / churn_rate
 *   - CAC (customer acquisition cost)
 *   - LTV:CAC ratio (healthy > φ ≈ 1.618)
 *   - Net Revenue Retention (NRR, target > 115%)
 *   - ARPU by plan tier
 *
 * φ = 1.618033988749895
 * LTV:CAC health threshold: > φ = 1.618 (healthy), > φ² = 2.618 (excellent)
 * NRR target: > 115%
 */

const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// ─────────────────────────────────────────────────────────────────────────────
// Plan Pricing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plan tier pricing in USD/month.
 * Prices are φ-derived: each tier × φ from previous.
 *
 * free:       $0
 * pro:        $55/mo (fib10)
 * enterprise: $89/mo base × φ^n for seats
 */
const PLAN_PRICING = {
  free:       0,
  pro:        FIB[10],     // 55
  enterprise: FIB[11],     // 89 (base, per seat)
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Revenue Calculations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Subscription
 * @property {string} userId
 * @property {string} orgId
 * @property {'free'|'pro'|'enterprise'} plan
 * @property {number} mrr            - Monthly recurring revenue (USD)
 * @property {'active'|'churned'|'trial'} status
 * @property {string} startDate      - ISO date
 * @property {string|null} endDate   - ISO date or null if active
 * @property {string} billingCycle   - 'monthly' | 'annual'
 */

/**
 * Calculate MRR and ARR from active subscriptions.
 *
 * @param {Subscription[]} subscriptions
 * @returns {{mrr: number, arr: number, byPlan: Object}}
 */
function calculateMRR(subscriptions) {
  const active    = subscriptions.filter(s => s.status === 'active');
  const mrr       = active.reduce((sum, s) => sum + s.mrr, 0);
  const arr       = mrr * 12;

  const byPlan = {};
  for (const [plan] of Object.entries(PLAN_PRICING)) {
    const planSubs = active.filter(s => s.plan === plan);
    byPlan[plan] = {
      count: planSubs.length,
      mrr:   planSubs.reduce((sum, s) => sum + s.mrr, 0),
    };
  }

  return {
    mrr:    Number(mrr.toFixed(2)),
    arr:    Number(arr.toFixed(2)),
    byPlan,
    totalActive: active.length,
  };
}

/**
 * Calculate churn rate for a given period.
 *
 * Monthly churn rate = churned customers / customers at start of period.
 * Annual  churn rate = 1 - (1 - monthly_churn)^12
 *
 * @param {Object} opts
 * @param {number} opts.customersAtStart    - Active customers at period start
 * @param {number} opts.churnedDuringPeriod - Customers who cancelled
 * @param {'monthly'|'annual'} [opts.period='monthly']
 * @returns {Object} Churn metrics
 */
function calculateChurn({ customersAtStart, churnedDuringPeriod, period = 'monthly' }) {
  if (customersAtStart <= 0) return { monthlyRate: 0, annualRate: 0, churnedCount: 0 };

  const monthlyRate = churnedDuringPeriod / customersAtStart;
  const annualRate  = 1 - Math.pow(1 - monthlyRate, 12);

  // Revenue churn (MRR lost)
  return {
    churnedCount:  churnedDuringPeriod,
    monthlyRate:   Number(monthlyRate.toFixed(6)),
    annualRate:    Number(annualRate.toFixed(6)),
    // CSL classification
    cslLevel: (() => {
      if (monthlyRate < 0.01)  return 'EXCELLENT';   // < 1%/mo
      if (monthlyRate < 0.02)  return 'HEALTHY';     // < 2%/mo
      if (monthlyRate < 0.382) return 'MODERATE';    // CSL MODERATE
      if (monthlyRate < 0.618) return 'HIGH';        // CSL HIGH
      return                          'CRITICAL';
    })(),
    // φ-health: monthly churn < 1/φ² ≈ 0.382 is acceptable
    phiThreshold: 1 / (PHI * PHI),
    healthy: monthlyRate < (1 / (PHI * PHI)),
  };
}

/**
 * Calculate Average Revenue Per User (ARPU) by plan tier.
 *
 * @param {Subscription[]} subscriptions
 * @returns {Object} ARPU by plan
 */
function calculateARPU(subscriptions) {
  const active = subscriptions.filter(s => s.status === 'active');
  const total  = active.length;
  const totalMRR = active.reduce((sum, s) => sum + s.mrr, 0);

  const overall = total > 0 ? totalMRR / total : 0;

  const byPlan = {};
  for (const [plan] of Object.entries(PLAN_PRICING)) {
    const planSubs = active.filter(s => s.plan === plan);
    byPlan[plan] = {
      count: planSubs.length,
      arpu:  planSubs.length > 0
        ? Number((planSubs.reduce((s, sub) => s + sub.mrr, 0) / planSubs.length).toFixed(2))
        : 0,
    };
  }

  return {
    overall: Number(overall.toFixed(2)),
    byPlan,
    totalCustomers: total,
  };
}

/**
 * Calculate Customer Lifetime Value (LTV).
 *
 * LTV = ARPU / monthly_churn_rate
 *
 * φ health thresholds:
 *   Excellent: LTV > φ² × CAC
 *   Healthy:   LTV > φ  × CAC
 *   Warning:   LTV < φ  × CAC
 *
 * @param {Object} opts
 * @param {number} opts.arpu            - Average revenue per user (monthly USD)
 * @param {number} opts.monthlyChurnRate - Decimal churn rate (e.g. 0.03 = 3%)
 * @param {number} [opts.grossMargin=0.854] - Gross margin (default CSL CRITICAL = 85.4%)
 * @returns {Object} LTV metrics
 */
function calculateLTV({ arpu, monthlyChurnRate, grossMargin = 0.854 }) {
  if (monthlyChurnRate <= 0) {
    return { ltv: Infinity, avgLifetimeMonths: Infinity, grossLTV: Infinity };
  }

  const avgLifetimeMonths = 1 / monthlyChurnRate;
  const ltv               = arpu * avgLifetimeMonths;
  const grossLTV          = ltv * grossMargin;

  return {
    ltv:                 Number(ltv.toFixed(2)),
    grossLTV:            Number(grossLTV.toFixed(2)),
    avgLifetimeMonths:   Number(avgLifetimeMonths.toFixed(2)),
    avgLifetimeYears:    Number((avgLifetimeMonths / 12).toFixed(2)),
    grossMargin,
    // φ-derived lifetime: how many months of healthy engagement
    phiLifetimeMonths:   Number((PHI * PHI * 12).toFixed(1)),   // φ²×12 ≈ 31.4 months
  };
}

/**
 * Calculate Customer Acquisition Cost (CAC).
 *
 * CAC = total_sales_and_marketing_spend / new_customers_acquired
 *
 * @param {Object} opts
 * @param {number} opts.salesSpend       - Sales team cost (monthly USD)
 * @param {number} opts.marketingSpend   - Marketing spend (monthly USD)
 * @param {number} opts.newCustomers     - New customers acquired this month
 * @param {string[]} [opts.channels]     - Acquisition channels
 * @returns {Object} CAC metrics
 */
function calculateCAC({ salesSpend, marketingSpend, newCustomers, channels = [] }) {
  const totalSpend = salesSpend + marketingSpend;
  const cac        = newCustomers > 0 ? totalSpend / newCustomers : 0;

  return {
    cac:           Number(cac.toFixed(2)),
    totalSpend:    Number(totalSpend.toFixed(2)),
    salesSpend:    Number(salesSpend.toFixed(2)),
    marketingSpend: Number(marketingSpend.toFixed(2)),
    newCustomers,
    channels,
    blendedCac:    Number(cac.toFixed(2)),
  };
}

/**
 * Calculate LTV:CAC ratio.
 * Healthy:   ratio > φ ≈ 1.618
 * Excellent: ratio > φ² ≈ 2.618
 * SaaS best: ratio > φ³ ≈ 4.236
 *
 * @param {number} ltv
 * @param {number} cac
 * @returns {Object} LTV:CAC analysis
 */
function calculateLTVtoCAC(ltv, cac) {
  if (cac <= 0) return { ratio: Infinity, healthy: true };

  const ratio = ltv / cac;

  return {
    ratio:      Number(ratio.toFixed(4)),
    healthy:    ratio >= PHI,                    // > φ = 1.618
    excellent:  ratio >= PHI * PHI,              // > φ² = 2.618
    saasIdeal:  ratio >= PHI * PHI * PHI,        // > φ³ = 4.236
    thresholds: {
      phi:      Number(PHI.toFixed(4)),           // 1.618 — minimum healthy
      phi2:     Number((PHI * PHI).toFixed(4)),   // 2.618 — excellent
      phi3:     Number((PHI * PHI * PHI).toFixed(4)), // 4.236 — SaaS ideal
    },
    // CSL classification
    cslLevel: (() => {
      if (ratio >= PHI * PHI * PHI) return 'EXCELLENT';
      if (ratio >= PHI * PHI)       return 'HEALTHY';
      if (ratio >= PHI)             return 'MODERATE';
      if (ratio >= 1)               return 'LOW';
      return                               'CRITICAL';
    })(),
    paybackMonths: Number(cac / (ltv / (1 / 0.03)).toFixed(2)),   // approx payback
  };
}

/**
 * Calculate Net Revenue Retention (NRR).
 *
 * NRR = (starting_MRR + expansion - contraction - churn) / starting_MRR
 * Target: > 115% (industry SaaS benchmark)
 * Heady target: > φ × 100 = 161.8% (ambitious)
 *
 * @param {Object} opts
 * @param {number} opts.startingMRR     - MRR at start of period
 * @param {number} opts.expansionMRR    - New MRR from upgrades/seats
 * @param {number} opts.contractionMRR  - MRR lost to downgrades
 * @param {number} opts.churnedMRR      - MRR lost to cancellation
 * @returns {Object} NRR metrics
 */
function calculateNRR({ startingMRR, expansionMRR, contractionMRR, churnedMRR }) {
  if (startingMRR <= 0) return { nrr: 0, grr: 0 };

  const endMRR = startingMRR + expansionMRR - contractionMRR - churnedMRR;
  const nrr    = endMRR / startingMRR;

  // Gross Revenue Retention (no expansion)
  const grrMRR = startingMRR - contractionMRR - churnedMRR;
  const grr    = grrMRR / startingMRR;

  return {
    startingMRR:   Number(startingMRR.toFixed(2)),
    endMRR:        Number(endMRR.toFixed(2)),
    expansionMRR:  Number(expansionMRR.toFixed(2)),
    contractionMRR: Number(contractionMRR.toFixed(2)),
    churnedMRR:    Number(churnedMRR.toFixed(2)),
    nrr:           Number(nrr.toFixed(4)),
    nrrPercent:    Number((nrr * 100).toFixed(2)),
    grr:           Number(grr.toFixed(4)),
    grrPercent:    Number((grr * 100).toFixed(2)),
    // Benchmarks
    healthy:       nrr >= 1.15,                    // > 115%
    excellent:     nrr >= 1.30,                    // > 130%
    phiTarget:     nrr >= PHI,                     // > 161.8%
    thresholds: {
      minimum:     1.0,    // 100%
      healthy:     1.15,   // 115%
      excellent:   1.30,   // 130%
      phi:         Number(PHI.toFixed(4)),          // 161.8%
    },
    cslLevel: (() => {
      if (nrr >= PHI)   return 'EXCELLENT';
      if (nrr >= 1.30)  return 'HIGH';
      if (nrr >= 1.15)  return 'HEALTHY';
      if (nrr >= 1.00)  return 'MODERATE';
      return                   'CRITICAL';
    })(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Dashboard Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class RevenueMetricsCalculator
 * Orchestrates all revenue metric calculations into a unified dashboard.
 */
class RevenueMetricsCalculator {
  /**
   * @param {Object} opts
   * @param {Subscription[]} opts.subscriptions
   * @param {Object} opts.periodData   - { customersAtStart, churnedDuringPeriod, startingMRR, ... }
   * @param {Object} opts.costData     - { salesSpend, marketingSpend, newCustomers }
   */
  constructor(opts = {}) {
    this.subscriptions = opts.subscriptions ?? [];
    this.periodData    = opts.periodData    ?? {};
    this.costData      = opts.costData      ?? {};
  }

  /**
   * Compute full revenue metrics report.
   * @returns {Object} Revenue dashboard
   */
  compute() {
    const mrrData = calculateMRR(this.subscriptions);
    const arpu    = calculateARPU(this.subscriptions);

    const churn   = calculateChurn({
      customersAtStart:    this.periodData.customersAtStart    ?? 0,
      churnedDuringPeriod: this.periodData.churnedDuringPeriod ?? 0,
    });

    const ltv     = calculateLTV({
      arpu:             arpu.overall,
      monthlyChurnRate: churn.monthlyRate,
    });

    const cac     = calculateCAC({
      salesSpend:    this.costData.salesSpend    ?? 0,
      marketingSpend: this.costData.marketingSpend ?? 0,
      newCustomers:  this.costData.newCustomers  ?? 1,
    });

    const ltvCac  = calculateLTVtoCAC(ltv.ltv, cac.cac);

    const nrr     = calculateNRR({
      startingMRR:    this.periodData.startingMRR    ?? mrrData.mrr,
      expansionMRR:   this.periodData.expansionMRR   ?? 0,
      contractionMRR: this.periodData.contractionMRR ?? 0,
      churnedMRR:     this.periodData.churnedMRR     ?? 0,
    });

    return {
      generatedAt: new Date().toISOString(),
      phi:         PHI,

      mrr:       mrrData.mrr,
      arr:       mrrData.arr,
      byPlan:    mrrData.byPlan,

      arpu,
      churn,
      ltv,
      cac,
      ltvCac,
      nrr,

      // Summary health score (φ-weighted composite)
      healthScore: this._healthScore({ churn, ltvCac, nrr }),

      // φ benchmarks
      benchmarks: {
        ltvCacMinimum:  PHI,                   // 1.618
        ltvCacExcellent: PHI * PHI,            // 2.618
        nrrHealthy:     1.15,
        nrrPhi:         PHI,                   // 1.618 (161.8%)
        monthlyChurnMax: 1 / (PHI * PHI),      // 0.382
      },
    };
  }

  /** @private Compute composite health score (0–1, CSL-compatible) */
  _healthScore({ churn, ltvCac, nrr }) {
    const churnScore  = Math.max(0, 1 - (churn.monthlyRate / 0.05));  // 0% churn = 1.0
    const ltvScore    = Math.min(1, ltvCac.ratio / (PHI * PHI * PHI)); // φ³ = full score
    const nrrScore    = Math.min(1, nrr.nrr / PHI);                   // φ = full score

    // φ-weighted composite
    const w1 = 1 / PHI;         // churn weight: 0.618
    const w2 = 1 / (PHI * PHI); // LTV:CAC weight: 0.382
    const w3 = 1 / PHI;         // NRR weight: 0.618

    const weighted = (churnScore * w1 + ltvScore * w2 + nrrScore * w3) / (w1 + w2 + w3);
    return {
      score:    Number(Math.min(1, weighted).toFixed(4)),
      cslLevel: (() => {
        if (weighted < 0.236) return 'DORMANT';
        if (weighted < 0.382) return 'LOW';
        if (weighted < 0.618) return 'MODERATE';
        if (weighted < 0.854) return 'HIGH';
        return 'EXCELLENT';
      })(),
      components: { churnScore: Number(churnScore.toFixed(4)), ltvScore: Number(ltvScore.toFixed(4)), nrrScore: Number(nrrScore.toFixed(4)) },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  RevenueMetricsCalculator,
  calculateMRR,
  calculateChurn,
  calculateARPU,
  calculateLTV,
  calculateCAC,
  calculateLTVtoCAC,
  calculateNRR,
  PLAN_PRICING,
  PHI,
  FIB,
};

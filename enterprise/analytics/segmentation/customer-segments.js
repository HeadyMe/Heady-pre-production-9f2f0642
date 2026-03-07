'use strict';
/**
 * @module customer-segments
 * @description Customer segmentation engine for HeadySystems
 *
 * Segments:
 *   Champion  — High usage, high engagement, recent activity
 *   Active    — Regular usage, engaged
 *   Slipping  — Declining usage trend
 *   At-Risk   — Low usage, infrequent, disengaged
 *   Churned   — No activity > fib(10)=55 days
 *
 * Scoring:
 *   Multi-factor φ-weighted score across:
 *     - Usage volume (task completions)
 *     - Feature adoption breadth
 *     - Engagement frequency (login cadence)
 *     - Recency (days since last activity)
 *     - Team expansion (seat growth)
 *
 * φ = 1.618033988749895
 */

const EventEmitter = require('events');

const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// ─────────────────────────────────────────────────────────────────────────────
// Segment Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** CSL-scored segment boundaries */
const SEGMENTS = {
  CHAMPION:  { id: 'champion', label: 'Champion',  cslMin: 0.854, cslMax: 1.0,   color: '#22c55e' },
  ACTIVE:    { id: 'active',   label: 'Active',    cslMin: 0.618, cslMax: 0.854, color: '#3b82f6' },
  SLIPPING:  { id: 'slipping', label: 'Slipping',  cslMin: 0.382, cslMax: 0.618, color: '#f59e0b' },
  AT_RISK:   { id: 'at_risk',  label: 'At-Risk',   cslMin: 0.236, cslMax: 0.382, color: '#ef4444' },
  CHURNED:   { id: 'churned',  label: 'Churned',   cslMin: 0.0,   cslMax: 0.236, color: '#6b7280' },
};

/** Automated action triggers per segment */
const SEGMENT_ACTIONS = {
  champion: [
    { type: 'email',   template: 'champion_referral',    trigger: 'daily_check',   priority: FIB[3] },
    { type: 'in_app',  template: 'champion_badge',       trigger: 'on_enter',      priority: FIB[4] },
  ],
  active: [
    { type: 'email',   template: 'feature_spotlight',    trigger: 'weekly_check',  priority: FIB[2] },
  ],
  slipping: [
    { type: 'email',   template: 'reengagement',         trigger: 'on_enter',      priority: FIB[5] },
    { type: 'in_app',  template: 'slipping_nudge',       trigger: 'on_login',      priority: FIB[4] },
  ],
  at_risk: [
    { type: 'email',   template: 'win_back_offer',       trigger: 'on_enter',      priority: FIB[6] },
    { type: 'support', template: 'proactive_check_in',   trigger: 'on_enter',      priority: FIB[7] },
    { type: 'in_app',  template: 'at_risk_banner',       trigger: 'on_login',      priority: FIB[8] },
  ],
  churned: [
    { type: 'email',   template: 'churn_recovery',       trigger: 'on_enter',      priority: FIB[9] },
    { type: 'support', template: 'churn_analysis_call',  trigger: 'after_21_days', priority: FIB[8] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Factors (φ-weighted)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factor weights sum to 1.0 (normalized).
 * Weights are Fibonacci-derived and normalized to φ-proportions.
 */
const FACTOR_WEIGHTS = (() => {
  // Raw φ-proportional weights
  const raw = {
    recency:         PHI * PHI,    // Most important — when did they last use?
    usageVolume:     PHI,          // Task completions
    featureAdoption: 1.0,          // Breadth of feature usage
    loginFrequency:  1 / PHI,      // How often they log in
    teamExpansion:   1 / (PHI * PHI), // Seat growth
  };

  // Normalize to sum = 1.0
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v / total])
  );
})();

// ─────────────────────────────────────────────────────────────────────────────
// Individual factor scorers (all return 0.0–1.0)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score recency: 1.0 = active today, 0.0 = inactive > fib(10)=55 days
 * Decay: exponential with φ-scaling
 * @param {number} daysSinceLastActivity
 * @returns {number} 0.0–1.0
 */
function scoreRecency(daysSinceLastActivity) {
  if (daysSinceLastActivity <= 0) return 1.0;
  if (daysSinceLastActivity >= FIB[10]) return 0.0;  // 55 days = churned
  // φ-decay: score = (1/φ)^(days/fib7) where fib7=13
  return Math.max(0, Math.pow(1 / PHI, daysSinceLastActivity / FIB[7]));
}

/**
 * Score usage volume: task completion count vs. φ-scaled benchmark.
 * Excellent: > fib(11)=89 tasks/month
 * Good:      > fib(7)=13 tasks/month
 * Poor:      < fib(4)=3 tasks/month
 * @param {number} tasksLastMonth
 * @returns {number} 0.0–1.0
 */
function scoreUsageVolume(tasksLastMonth) {
  if (tasksLastMonth <= 0) return 0;
  if (tasksLastMonth >= FIB[11]) return 1.0;           // 89+ excellent
  if (tasksLastMonth >= FIB[9])  return 0.854;         // 34+ CSL CRITICAL
  if (tasksLastMonth >= FIB[7])  return 0.618;         // 13+ CSL HIGH
  if (tasksLastMonth >= FIB[5])  return 0.382;         // 5+ CSL MODERATE
  return tasksLastMonth / FIB[7];                      // linear below 13
}

/**
 * Score feature adoption breadth.
 * Score = adopted / total_features, φ-boosted for critical features.
 * @param {string[]} adoptedFeatures - Features the user has used
 * @param {string[]} allFeatures     - All available features
 * @returns {number} 0.0–1.0
 */
function scoreFeatureAdoption(adoptedFeatures, allFeatures) {
  if (!allFeatures?.length) return 0;
  const adopted = new Set(adoptedFeatures);

  // Critical features get φ-boost
  const CRITICAL_FEATURES = ['agent.created', 'task.completed', 'billing.upgraded'];
  let score = adopted.size / allFeatures.length;

  // Bonus for critical feature adoption
  const criticalAdopted = CRITICAL_FEATURES.filter(f => adopted.has(f)).length;
  score += (criticalAdopted / CRITICAL_FEATURES.length) * (1 / PHI);

  return Math.min(1.0, score);
}

/**
 * Score login frequency (0.0–1.0).
 * Benchmark: fib(6)=8 logins/month = excellent.
 * @param {number} loginsLastMonth
 * @returns {number} 0.0–1.0
 */
function scoreLoginFrequency(loginsLastMonth) {
  return Math.min(1.0, loginsLastMonth / FIB[6]);  // fib(6)=8
}

/**
 * Score team expansion (seat growth over last 90 days).
 * @param {number} currentSeats
 * @param {number} seatsAt90DaysAgo
 * @returns {number} 0.0–1.0
 */
function scoreTeamExpansion(currentSeats, seatsAt90DaysAgo) {
  if (!seatsAt90DaysAgo || seatsAt90DaysAgo <= 0) return currentSeats > 1 ? 0.5 : 0;
  const growth = (currentSeats - seatsAt90DaysAgo) / seatsAt90DaysAgo;
  return Math.min(1.0, Math.max(0, growth + 0.5));   // 0 growth = 0.5
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment classifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute φ-weighted composite score for a customer.
 * @param {Object} metrics
 * @returns {{ score: number, factors: Object, segment: string, actions: Object[] }}
 */
function scoreCustomer(metrics) {
  const {
    daysSinceLastActivity = 999,
    tasksLastMonth        = 0,
    adoptedFeatures       = [],
    allFeatures           = [],
    loginsLastMonth       = 0,
    currentSeats          = 1,
    seatsAt90DaysAgo      = 1,
  } = metrics;

  const factors = {
    recency:         scoreRecency(daysSinceLastActivity),
    usageVolume:     scoreUsageVolume(tasksLastMonth),
    featureAdoption: scoreFeatureAdoption(adoptedFeatures, allFeatures),
    loginFrequency:  scoreLoginFrequency(loginsLastMonth),
    teamExpansion:   scoreTeamExpansion(currentSeats, seatsAt90DaysAgo),
  };

  // φ-weighted composite
  const score = Object.entries(factors).reduce((sum, [k, v]) => {
    return sum + v * FACTOR_WEIGHTS[k];
  }, 0);

  // Classify into segment
  const segment = Object.values(SEGMENTS).find(
    s => score >= s.cslMin && score < s.cslMax
  ) ?? SEGMENTS.CHURNED;

  return {
    score:     Number(Math.min(1.0, score).toFixed(4)),
    factors:   Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, Number(v.toFixed(4))])),
    weights:   FACTOR_WEIGHTS,
    segment:   segment.id,
    segmentLabel: segment.label,
    cslLevel:  (() => {
      if (score < 0.236) return 'DORMANT';
      if (score < 0.382) return 'LOW';
      if (score < 0.618) return 'MODERATE';
      if (score < 0.854) return 'HIGH';
      return 'CRITICAL';
    })(),
    actions:   SEGMENT_ACTIONS[segment.id] ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Segmentation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CustomerSegmentationEngine
 * Batch segment all customers and emit automated action triggers.
 *
 * @extends EventEmitter
 *
 * Events:
 *   segment-changed({customerId, before, after, actions})
 *   action-triggered({customerId, segment, action})
 */
class CustomerSegmentationEngine extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._prevSegments = new Map();   // customerId → previous segment
    this.allFeatures   = opts.allFeatures ?? [
      'user.signup', 'user.login', 'agent.created', 'agent.invoked',
      'task.submitted', 'task.completed', 'mcp.tool.called',
      'memory.stored', 'memory.searched', 'billing.upgraded',
    ];
  }

  /**
   * Segment a single customer.
   * @param {string} customerId
   * @param {Object} metrics  - Usage metrics for this customer
   * @returns {Object} Segmentation result
   */
  segmentOne(customerId, metrics) {
    const result = scoreCustomer({ ...metrics, allFeatures: this.allFeatures });
    const prev   = this._prevSegments.get(customerId);

    if (prev && prev !== result.segment) {
      this.emit('segment-changed', {
        customerId,
        before:  prev,
        after:   result.segment,
        score:   result.score,
        actions: result.actions,
      });

      // Trigger automated actions for the new segment
      for (const action of result.actions) {
        if (action.trigger === 'on_enter') {
          this.emit('action-triggered', { customerId, segment: result.segment, action });
        }
      }
    }

    this._prevSegments.set(customerId, result.segment);
    return { customerId, ...result };
  }

  /**
   * Segment all customers in batch.
   * @param {Array<{customerId: string, metrics: Object}>} customers
   * @returns {Object[]} Array of segmentation results
   */
  segmentAll(customers) {
    return customers.map(({ customerId, metrics }) =>
      this.segmentOne(customerId, metrics)
    );
  }

  /**
   * Aggregate segment distribution.
   * @param {Object[]} segmentationResults
   * @returns {Object} Distribution report
   */
  distribution(segmentationResults) {
    const counts = Object.fromEntries(
      Object.values(SEGMENTS).map(s => [s.id, 0])
    );
    for (const r of segmentationResults) {
      counts[r.segment] = (counts[r.segment] ?? 0) + 1;
    }

    const total = segmentationResults.length;
    const pct   = (n) => total > 0 ? Number((n / total).toFixed(4)) : 0;
    const avgScore = total > 0
      ? Number((segmentationResults.reduce((s, r) => s + r.score, 0) / total).toFixed(4))
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      phi:         PHI,
      total,
      avgScore,
      distribution: Object.fromEntries(
        Object.entries(counts).map(([id, count]) => [id, {
          count,
          percent:     pct(count),
          // φ-health: Champion + Active ≥ 1/φ of total = healthy
          segment:     SEGMENTS[id.toUpperCase()] ?? SEGMENTS[id],
        }])
      ),
      healthScore: (() => {
        const healthy = (counts.champion ?? 0) + (counts.active ?? 0);
        const ratio   = pct(healthy);
        return {
          ratio,
          healthy: ratio >= (1 / PHI),   // ≥ 61.8% healthy = good
          phi:     Number((1 / PHI).toFixed(4)),
        };
      })(),
      factorWeights: FACTOR_WEIGHTS,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  CustomerSegmentationEngine,
  scoreCustomer,
  scoreRecency,
  scoreUsageVolume,
  scoreFeatureAdoption,
  scoreLoginFrequency,
  scoreTeamExpansion,
  SEGMENTS,
  SEGMENT_ACTIONS,
  FACTOR_WEIGHTS,
  PHI,
  FIB,
};

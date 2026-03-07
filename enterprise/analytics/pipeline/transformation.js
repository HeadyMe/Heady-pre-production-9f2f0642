'use strict';
/**
 * @module analytics-transformation
 * @description Data transformation layer for HeadySystems analytics
 *
 * Responsibilities:
 *   - Aggregate raw events → DAU, WAU, MAU, session duration, feature usage
 *   - Cohort retention tables (day 1, day fib(5)=5, day fib(7)=13, day fib(10)=55)
 *   - Funnel analysis: signup → onboard → activate → retain
 *   - φ-weighted engagement scoring
 *
 * φ = 1.618033988749895
 */

const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// φ-derived retention checkpoints (days)
const RETENTION_DAYS = [1, FIB[5], FIB[7], FIB[10], FIB[11]]; // [1, 5, 13, 55, 89]

// Funnel steps (signup → activate → retain)
const FUNNEL_STEPS = [
  { id: 'signup',    event: 'user.signup',    label: 'Signed Up',       cslWeight: 1.0 },
  { id: 'onboard',   event: 'agent.created',  label: 'Created Agent',   cslWeight: PHI / (PHI + 1) },
  { id: 'activate',  event: 'task.completed', label: 'Completed Task',  cslWeight: 1 / PHI },
  { id: 'retain',    event: 'billing.upgraded', label: 'Converted',     cslWeight: 1 / (PHI * PHI) },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Get UTC date string (YYYY-MM-DD) from timestamp */
const toDateStr  = (ts) => new Date(ts).toISOString().slice(0, 10);
/** Get UTC week key (YYYY-WW) */
const toWeekStr  = (ts) => {
  const d = new Date(ts);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};
/** Get UTC month key (YYYY-MM) */
const toMonthStr = (ts) => new Date(ts).toISOString().slice(0, 7);
/** Timestamp for start of day (UTC) */
const dayStart   = (dateStr) => new Date(dateStr + 'T00:00:00.000Z').getTime();

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group events by a key function.
 * @param {Object[]} events
 * @param {Function} keyFn
 * @returns {Map<string, Object[]>}
 */
function groupBy(events, keyFn) {
  const map = new Map();
  for (const e of events) {
    const k = keyFn(e);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

/**
 * Count unique values by a key function.
 * @param {Object[]} events
 * @param {Function} keyFn
 * @returns {number}
 */
function countUnique(events, keyFn) {
  return new Set(events.map(keyFn)).size;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAU / WAU / MAU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Daily Active Users (DAU) from event stream.
 * A user is "active" if they emitted ≥ 1 event on that day.
 *
 * @param {Object[]} events  - Raw events with userId, timestamp
 * @returns {Map<string, number>}  date → DAU count
 */
function computeDAU(events) {
  const byDate = groupBy(
    events.filter(e => e.userId),
    e => toDateStr(new Date(e.timestamp).getTime())
  );
  const dau = new Map();
  for (const [date, evts] of byDate) {
    dau.set(date, countUnique(evts, e => e.userId));
  }
  return dau;
}

/**
 * Compute Weekly Active Users (WAU).
 * @param {Object[]} events
 * @returns {Map<string, number>}  week → WAU count
 */
function computeWAU(events) {
  const byWeek = groupBy(
    events.filter(e => e.userId),
    e => toWeekStr(new Date(e.timestamp).getTime())
  );
  const wau = new Map();
  for (const [week, evts] of byWeek) {
    wau.set(week, countUnique(evts, e => e.userId));
  }
  return wau;
}

/**
 * Compute Monthly Active Users (MAU).
 * @param {Object[]} events
 * @returns {Map<string, number>}  month → MAU count
 */
function computeMAU(events) {
  const byMonth = groupBy(
    events.filter(e => e.userId),
    e => toMonthStr(new Date(e.timestamp).getTime())
  );
  const mau = new Map();
  for (const [month, evts] of byMonth) {
    mau.set(month, countUnique(evts, e => e.userId));
  }
  return mau;
}

/**
 * Compute DAU/MAU ratio (stickiness). Healthy > 1/φ ≈ 0.618
 * @param {Map<string, number>} dau
 * @param {Map<string, number>} mau
 * @returns {Map<string, number>}  month → avg DAU/MAU ratio
 */
function computeStickiness(dau, mau) {
  const stickiness = new Map();
  for (const [month, mauCount] of mau) {
    const dauValues = [];
    for (const [date, dauCount] of dau) {
      if (date.startsWith(month)) dauValues.push(dauCount);
    }
    const avgDAU = dauValues.length > 0
      ? dauValues.reduce((s, v) => s + v, 0) / dauValues.length
      : 0;
    const ratio = mauCount > 0 ? avgDAU / mauCount : 0;
    stickiness.set(month, Number(ratio.toFixed(4)));
  }
  return stickiness;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Duration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute session durations from events.
 * Session = sequence of events from same sessionId, gap > fib(9)=34min → new session.
 *
 * @param {Object[]} events
 * @returns {Object} { avgMs, medianMs, p75Ms, p95Ms, sessionCount }
 */
function computeSessionDurations(events) {
  const SESSION_GAP_MS = FIB[9] * 60 * 1000;  // fib(9)=34 min idle gap

  const bySess = groupBy(events, e => e.sessionId);
  const durations = [];

  for (const [, evts] of bySess) {
    const sorted = [...evts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Split into sub-sessions by idle gap
    let segStart = new Date(sorted[0].timestamp).getTime();
    let prevTs   = segStart;

    for (let i = 1; i < sorted.length; i++) {
      const ts = new Date(sorted[i].timestamp).getTime();
      if (ts - prevTs > SESSION_GAP_MS) {
        // Close current segment
        const dur = prevTs - segStart;
        if (dur > 0) durations.push(dur);
        segStart = ts;
      }
      prevTs = ts;
    }
    const finalDur = prevTs - segStart;
    if (finalDur >= 0) durations.push(Math.max(finalDur, 1000));   // min 1s
  }

  if (durations.length === 0) return { avgMs: 0, medianMs: 0, p75Ms: 0, p95Ms: 0, sessionCount: 0 };

  durations.sort((a, b) => a - b);
  const pct = (p) => durations[Math.floor(durations.length * p)] ?? 0;

  return {
    avgMs:      Math.round(durations.reduce((s, v) => s + v, 0) / durations.length),
    medianMs:   pct(0.50),
    p75Ms:      pct(0.75),
    p95Ms:      pct(0.95),
    p99Ms:      pct(0.99),
    sessionCount: durations.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Usage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute feature adoption rates from events.
 * φ-weighted scoring: events closer to "critical" CSL get higher weight.
 *
 * @param {Object[]} events
 * @returns {Object} Feature adoption report
 */
function computeFeatureUsage(events) {
  // Feature definitions with φ-weights
  const FEATURES = [
    { id: 'agent_creation',    event: 'agent.created',      weight: PHI },
    { id: 'agent_invocation',  event: 'agent.invoked',      weight: PHI },
    { id: 'task_completion',   event: 'task.completed',     weight: PHI / (PHI + 1) },
    { id: 'mcp_tools',         event: 'mcp.tool.called',    weight: 1.0 },
    { id: 'vector_memory',     event: 'memory.stored',      weight: 1.0 },
    { id: 'memory_search',     event: 'memory.searched',    weight: 1 / PHI },
    { id: 'billing_upgrade',   event: 'billing.upgraded',   weight: PHI * PHI },
    { id: 'feedback',          event: 'feedback.submitted', weight: 1 / PHI },
  ];

  const totalUsers = countUnique(events.filter(e => e.userId), e => e.userId);

  return FEATURES.map(f => {
    const featureEvents = events.filter(e => e.event === f.event && e.userId);
    const uniqueUsers   = countUnique(featureEvents, e => e.userId);
    const adoptionRate  = totalUsers > 0 ? uniqueUsers / totalUsers : 0;
    const cslScore      = Math.min(1.0, adoptionRate * f.weight);

    return {
      feature:      f.id,
      event:        f.event,
      totalUses:    featureEvents.length,
      uniqueUsers,
      adoptionRate: Number(adoptionRate.toFixed(4)),
      cslScore:     Number(cslScore.toFixed(4)),
      weight:       f.weight,
    };
  }).sort((a, b) => b.adoptionRate - a.adoptionRate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohort Retention
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build cohort retention table.
 * Retention checked at φ-derived day intervals: [1, 5, 13, 55, 89]
 *
 * @param {Object[]} signupEvents    - user.signup events
 * @param {Object[]} activityEvents  - Any active events per user
 * @returns {Object[]} Cohort retention rows
 */
function computeCohortRetention(signupEvents, activityEvents) {
  // Group signups by week (cohort)
  const cohorts = groupBy(
    signupEvents.filter(e => e.userId),
    e => toWeekStr(new Date(e.timestamp).getTime())
  );

  // Build activity index: userId → Set<dateStr>
  const activityIndex = new Map();
  for (const e of activityEvents) {
    if (!e.userId) continue;
    if (!activityIndex.has(e.userId)) activityIndex.set(e.userId, new Set());
    activityIndex.get(e.userId).add(toDateStr(new Date(e.timestamp).getTime()));
  }

  return Array.from(cohorts.entries()).map(([week, evts]) => {
    const cohortUsers  = [...new Set(evts.map(e => e.userId))];
    const cohortSize   = cohortUsers.length;
    const cohortStart  = dayStart(toDateStr(new Date(evts[0].timestamp).getTime()));

    const retention = {};
    for (const day of RETENTION_DAYS) {
      const checkDate = toDateStr(cohortStart + day * 86400000);
      const retained  = cohortUsers.filter(uid => {
        const activity = activityIndex.get(uid);
        return activity && activity.has(checkDate);
      }).length;
      retention[`day_${day}`] = {
        retained,
        rate: cohortSize > 0 ? Number((retained / cohortSize).toFixed(4)) : 0,
      };
    }

    return {
      cohort:     week,
      size:       cohortSize,
      retention,
      // φ-health: retention ≥ 1/φ at day 13 = healthy
      healthy:    (retention[`day_${FIB[7]}`]?.rate ?? 0) >= (1 / PHI),
    };
  }).sort((a, b) => a.cohort.localeCompare(b.cohort));
}

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Analysis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute funnel conversion rates: signup → onboard → activate → retain.
 * Uses φ-weighted step values.
 *
 * @param {Object[]} events
 * @returns {Object} Funnel report with per-step counts and drop-off rates
 */
function computeFunnel(events) {
  // Build user → Set<stepId> map
  const userSteps = new Map();
  for (const e of events.filter(e => e.userId)) {
    if (!userSteps.has(e.userId)) userSteps.set(e.userId, new Set());
    const step = FUNNEL_STEPS.find(s => s.event === e.event);
    if (step) userSteps.get(e.userId).add(step.id);
  }

  const steps = FUNNEL_STEPS.map((step, i) => {
    const usersAtStep = [...userSteps.values()].filter(s => s.has(step.id)).length;
    const prevStep    = i > 0 ? FUNNEL_STEPS[i - 1] : null;
    const prevCount   = prevStep
      ? [...userSteps.values()].filter(s => s.has(prevStep.id)).length
      : usersAtStep;

    const conversionRate = prevCount > 0 ? usersAtStep / prevCount : (i === 0 ? 1 : 0);
    const dropOff        = 1 - conversionRate;

    return {
      step:           step.id,
      event:          step.event,
      label:          step.label,
      users:          usersAtStep,
      conversionRate: Number(conversionRate.toFixed(4)),
      dropOff:        Number(dropOff.toFixed(4)),
      cslWeight:      step.cslWeight,
      // φ-health: conversion ≥ 1/φ is healthy
      healthy:        conversionRate >= (1 / PHI) || i === 0,
    };
  });

  const totalSignups   = steps[0]?.users ?? 0;
  const totalConverted = steps[steps.length - 1]?.users ?? 0;
  const overallRate    = totalSignups > 0 ? totalConverted / totalSignups : 0;

  return {
    steps,
    totalSignups,
    totalConverted,
    overallConversionRate: Number(overallRate.toFixed(4)),
    // φ-health: overall ≥ 1/φ²
    healthy:       overallRate >= (1 / (PHI * PHI)),
    phi:           PHI,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class AnalyticsTransformationEngine
 * Runs all transformations against a set of events.
 */
class AnalyticsTransformationEngine {
  /**
   * @param {Object} [opts]
   * @param {Function} [opts.fetchEvents] - async (filter) => events[]
   */
  constructor(opts = {}) {
    this._fetchEvents = opts.fetchEvents ?? null;
  }

  /**
   * Run all transformations against a raw events array.
   * @param {Object[]} events
   * @returns {Object} Full analytics report
   */
  transform(events) {
    const signupEvents   = events.filter(e => e.event === 'user.signup');
    const activityEvents = events.filter(e => e.userId);

    const dau         = computeDAU(events);
    const wau         = computeWAU(events);
    const mau         = computeMAU(events);
    const stickiness  = computeStickiness(dau, mau);

    return {
      generatedAt:   new Date().toISOString(),
      phi:           PHI,
      eventCount:    events.length,
      dateRange: {
        from: events.length > 0 ? events.reduce((m, e) => e.timestamp < m ? e.timestamp : m, events[0].timestamp) : null,
        to:   events.length > 0 ? events.reduce((m, e) => e.timestamp > m ? e.timestamp : m, events[0].timestamp) : null,
      },

      // Active users
      dau:            Object.fromEntries(dau),
      wau:            Object.fromEntries(wau),
      mau:            Object.fromEntries(mau),
      stickiness:     Object.fromEntries(stickiness),

      // Engagement
      sessionMetrics: computeSessionDurations(events),
      featureUsage:   computeFeatureUsage(events),

      // Growth
      cohortRetention: computeCohortRetention(signupEvents, activityEvents),
      funnel:          computeFunnel(events),

      // Summary
      summary: this._summary(events, dau, mau, stickiness),
    };
  }

  /** @private Generate executive summary */
  _summary(events, dau, mau, stickiness) {
    const dauValues  = [...dau.values()];
    const mauValues  = [...mau.values()];
    const stickyVals = [...stickiness.values()];

    return {
      avgDAU:         dauValues.length ? Math.round(dauValues.reduce((s, v) => s + v, 0) / dauValues.length) : 0,
      peakDAU:        dauValues.length ? Math.max(...dauValues) : 0,
      latestMAU:      mauValues.length ? mauValues[mauValues.length - 1] : 0,
      avgStickiness:  stickyVals.length ? Number((stickyVals.reduce((s, v) => s + v, 0) / stickyVals.length).toFixed(4)) : 0,
      phiStickyTarget: Number((1 / PHI).toFixed(4)),   // 0.618 — healthy stickiness
      totalEvents:    events.length,
      uniqueUsers:    countUnique(events.filter(e => e.userId), e => e.userId),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  AnalyticsTransformationEngine,
  computeDAU,
  computeWAU,
  computeMAU,
  computeStickiness,
  computeSessionDurations,
  computeFeatureUsage,
  computeCohortRetention,
  computeFunnel,
  FUNNEL_STEPS,
  RETENTION_DAYS,
  PHI,
  FIB,
};

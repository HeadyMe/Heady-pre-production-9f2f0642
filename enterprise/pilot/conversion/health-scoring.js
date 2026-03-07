/**
 * @fileoverview HeadyOS Pilot — Customer Health Score Calculator
 * @module pilot/conversion/health-scoring
 *
 * φ-weighted health score (0–100) based on:
 *   - Login frequency
 *   - API usage
 *   - Feature breadth
 *   - Team size
 *   - Support tickets
 *   - NPS score
 *
 * Thresholds (φ-derived):
 *   CRITICAL (<38.2)            — Immediate CSM intervention
 *   AT_RISK  (38.2–61.8)        — Proactive outreach
 *   HEALTHY  (61.8–85.4)        — Normal nurture cadence
 *   CHAMPION (>85.4)            — Expansion/advocacy focus
 *
 * φ = 1.618033988749895
 */

'use strict';

const crypto = require('crypto');

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * φ-derived health score thresholds.
 * 38.2 = (1 - 1/φ) × 100 — the minor Fibonacci ratio
 * 61.8 = (1/φ) × 100     — the major Fibonacci ratio
 * 85.4 = (1/φ + 1/φ²) × 100 — φ² - 1 scaled
 */
const THRESHOLDS = {
  CRITICAL:  { min: 0,     max: 38.2  },   // (1 - PHI^-1) × 100
  AT_RISK:   { min: 38.2,  max: 61.8  },   // PHI^-1 × 100
  HEALTHY:   { min: 61.8,  max: 85.4  },   // up to PHI^-1 + PHI^-2
  CHAMPION:  { min: 85.4,  max: 100.0 },   // top tier
};

/**
 * φ-weighted signal weights.
 * Total: PHI^0 + PHI^1 + PHI^2 + PHI^3 + PHI^4 + PHI^5
 *        = 1 + 1.618 + 2.618 + 4.236 + 6.854 + 11.09 = 27.416
 * Normalized to 100 by dividing by total weight.
 */
const SIGNAL_WEIGHTS = {
  loginFrequency:    PHI ** 0,  // 1.0
  apiUsage:          PHI ** 1,  // 1.618
  featureBreadth:    PHI ** 2,  // 2.618
  teamSize:          PHI ** 1,  // 1.618
  supportTickets:    PHI ** 2,  // 2.618 (negative signal)
  npsScore:          PHI ** 3,  // 4.236 — highest weight
};

const TOTAL_WEIGHT = Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);

/* ── Signal Normalizers ─────────────────────────────────────── */

/**
 * Normalize login frequency to 0–1.
 * Perfect: login every day (pilot days logged).
 * Fibonacci reference: ideally fib(7)=13+ logins over 13 days.
 *
 * @param {number} loginsLast13Days - Login events in last 13 days
 * @returns {number} 0–1
 */
const normalizeLoginFrequency = (loginsLast13Days) => {
  const perfect = FIB[6]; // 13 logins in 13 days
  return Math.min(loginsLast13Days / perfect, 1);
};

/**
 * Normalize API usage to 0–1.
 * Target: fib(10)=55 calls/day (milestone trigger threshold).
 * Cap at fib(12)=144 (pilot rate limit).
 *
 * @param {number} avgDailyApiCalls
 * @returns {number} 0–1
 */
const normalizeApiUsage = (avgDailyApiCalls) => {
  const target = FIB[9];  // 55 calls/day
  const cap    = FIB[11]; // 144 (rate limit)
  return Math.min(avgDailyApiCalls / target, cap / target) / (cap / target);
};

/**
 * Normalize feature breadth to 0–1.
 * Perfect: used fib(5)=5+ features (milestone trigger).
 * Available features: up to fib(7)=13.
 *
 * @param {number} uniqueFeaturesUsed
 * @returns {number} 0–1
 */
const normalizeFeatureBreadth = (uniqueFeaturesUsed) => {
  const target = FIB[4]; // 5 features
  const max    = FIB[6]; // 13 features available
  return Math.min(uniqueFeaturesUsed / target, max / target) / (max / target);
};

/**
 * Normalize team size to 0–1.
 * Perfect: fib(5)=5 seats all used.
 * Minimum meaningful: fib(3)=2 (trigger threshold).
 *
 * @param {number} activeTeamMembers
 * @returns {number} 0–1
 */
const normalizeTeamSize = (activeTeamMembers) => {
  const max = FIB[4]; // 5 seats
  return Math.min(activeTeamMembers / max, 1);
};

/**
 * Normalize support tickets (inverted — more tickets = lower health).
 * 0 tickets = 1.0; fib(5)=5+ tickets = 0.0
 *
 * @param {number} openSupportTickets
 * @returns {number} 0–1
 */
const normalizeSupportTickets = (openSupportTickets) => {
  if (openSupportTickets === 0) return 1.0;
  // Decay by φ per ticket: 1/φ^n
  return Math.max(0, Math.pow(1 / PHI, openSupportTickets));
};

/**
 * Normalize NPS score to 0–1.
 * 10 = 1.0, 0 = 0.0. Target >= 8 (fib(6)).
 *
 * @param {number|null} npsScore - 0–10 or null (not surveyed)
 * @returns {number} 0–1
 */
const normalizeNPS = (npsScore) => {
  if (npsScore === null || npsScore === undefined) return 0.5; // unknown = neutral
  return Math.max(0, Math.min(npsScore / 10, 1));
};

/* ── Main Score Calculator ──────────────────────────────────── */

/**
 * @typedef {Object} HealthInputs
 * @property {number} loginsLast13Days      - Login count in last 13 days
 * @property {number} avgDailyApiCalls      - Average API calls per day
 * @property {number} uniqueFeaturesUsed    - Count of distinct features used
 * @property {number} activeTeamMembers     - Active team member count
 * @property {number} openSupportTickets    - Open/unresolved support tickets
 * @property {number|null} npsScore         - Latest NPS score (0–10) or null
 */

/**
 * Calculate φ-weighted customer health score.
 * @param {HealthInputs} inputs
 * @returns {Object} Full health assessment
 */
const calculateHealthScore = (inputs) => {
  const {
    loginsLast13Days    = 0,
    avgDailyApiCalls    = 0,
    uniqueFeaturesUsed  = 0,
    activeTeamMembers   = 1,
    openSupportTickets  = 0,
    npsScore            = null,
  } = inputs;

  // Normalize each signal to 0–1
  const signals = {
    loginFrequency:  normalizeLoginFrequency(loginsLast13Days),
    apiUsage:        normalizeApiUsage(avgDailyApiCalls),
    featureBreadth:  normalizeFeatureBreadth(uniqueFeaturesUsed),
    teamSize:        normalizeTeamSize(activeTeamMembers),
    supportTickets:  normalizeSupportTickets(openSupportTickets),
    npsScore:        normalizeNPS(npsScore),
  };

  // Weighted sum
  let weightedSum = 0;
  let weightedMax = 0;

  Object.entries(SIGNAL_WEIGHTS).forEach(([key, weight]) => {
    weightedSum += signals[key] * weight;
    weightedMax += weight;
  });

  const rawScore = (weightedSum / weightedMax) * 100;
  const score    = Math.round(rawScore * 10) / 10;

  // Classify
  const tier =
    score < THRESHOLDS.CRITICAL.max  ? 'CRITICAL'  :
    score < THRESHOLDS.AT_RISK.max   ? 'AT_RISK'   :
    score < THRESHOLDS.HEALTHY.max   ? 'HEALTHY'   :
    'CHAMPION';

  // CSM action recommendation
  const csmAction = {
    CRITICAL:  'IMMEDIATE_INTERVENTION',   // Phone call within fib(3)=2 business days
    AT_RISK:   'PROACTIVE_OUTREACH',       // Email + Slack within fib(4)=3 business days
    HEALTHY:   'NORMAL_NURTURE',           // Regular office hours cadence
    CHAMPION:  'EXPANSION_ADVOCACY',       // Referral program + case study ask
  }[tier];

  // Identify top risk signals
  const riskSignals = Object.entries(signals)
    .map(([key, value]) => ({ key, normalizedValue: value, weight: SIGNAL_WEIGHTS[key] }))
    .sort((a, b) => a.normalizedValue * a.weight - b.normalizedValue * b.weight)
    .slice(0, FIB[3]) // top 3 risks
    .filter(s => s.normalizedValue < 0.618); // only if below φ^-1 threshold

  // Identify strength signals
  const strengthSignals = Object.entries(signals)
    .map(([key, value]) => ({ key, normalizedValue: value, weight: SIGNAL_WEIGHTS[key] }))
    .sort((a, b) => b.normalizedValue * b.weight - a.normalizedValue * a.weight)
    .slice(0, FIB[3]) // top 3 strengths
    .filter(s => s.normalizedValue >= 0.618);

  return {
    score,
    tier,
    csmAction,
    signals: Object.entries(signals).map(([key, value]) => ({
      signal:          key,
      normalizedValue: Math.round(value * 1000) / 1000,
      weight:          Math.round(SIGNAL_WEIGHTS[key] * 1000) / 1000,
      contribution:    Math.round(value * SIGNAL_WEIGHTS[key] / TOTAL_WEIGHT * 100 * 10) / 10,
      inputValue: {
        loginFrequency:  loginsLast13Days,
        apiUsage:        avgDailyApiCalls,
        featureBreadth:  uniqueFeaturesUsed,
        teamSize:        activeTeamMembers,
        supportTickets:  openSupportTickets,
        npsScore,
      }[key],
    })),
    riskSignals: riskSignals.map(s => s.key),
    strengthSignals: strengthSignals.map(s => s.key),
    thresholds: THRESHOLDS,
    conversionReadiness: {
      isReady:    tier === 'CHAMPION' || (tier === 'HEALTHY' && score > 75),
      probability: Math.round(score / 100 * PHI / (1 + PHI / 100) * 100) / 100,
      recommendedTier: score > 85.4 ? 'ENTERPRISE' : score > 61.8 ? 'PRO' : 'PILOT_EXTEND',
    },
    metadata: {
      formula: 'score = Σ(normalize(signal_i) × weight_i) / Σ(weight_i) × 100',
      phi: PHI,
      totalWeight: Math.round(TOTAL_WEIGHT * 1000) / 1000,
      weights: Object.fromEntries(
        Object.entries(SIGNAL_WEIGHTS).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
      ),
      calculatedAt: new Date().toISOString(),
    },
  };
};

/* ── Batch Health Report ─────────────────────────────────────── */

/**
 * Generate a health report for multiple tenants.
 * @param {Array<{tenantId: string, inputs: HealthInputs}>} tenantData
 * @returns {Object} Cohort health summary
 */
const generateCohortReport = (tenantData) => {
  const results = tenantData.map(({ tenantId, inputs }) => ({
    tenantId,
    ...calculateHealthScore(inputs),
  }));

  const tierCounts = { CRITICAL: 0, AT_RISK: 0, HEALTHY: 0, CHAMPION: 0 };
  results.forEach(r => tierCounts[r.tier]++);

  const scores = results.map(r => r.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    cohortSize: tenantData.length,
    avgScore:   Math.round(avgScore * 10) / 10,
    tierCounts,
    tierPcts: Object.fromEntries(
      Object.entries(tierCounts).map(([tier, count]) => [
        tier,
        Math.round(count / tenantData.length * 100),
      ])
    ),
    atRiskOrCritical: tierCounts.AT_RISK + tierCounts.CRITICAL,
    readyToConvert:   results.filter(r => r.conversionReadiness.isReady).length,
    results,
    generatedAt: new Date().toISOString(),
  };
};

/* ── Export ──────────────────────────────────────────────────── */
module.exports = {
  calculateHealthScore,
  generateCohortReport,
  normalizeLoginFrequency,
  normalizeApiUsage,
  normalizeFeatureBreadth,
  normalizeTeamSize,
  normalizeSupportTickets,
  normalizeNPS,
  THRESHOLDS,
  SIGNAL_WEIGHTS,
  TOTAL_WEIGHT,
  PHI,
  FIB,
};

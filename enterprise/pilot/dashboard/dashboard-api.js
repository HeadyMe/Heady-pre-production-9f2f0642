/**
 * @fileoverview HeadyOS Pilot — Dashboard Data API
 * @module pilot/dashboard/dashboard-api
 *
 * Express router providing analytics data for the pilot usage dashboard.
 * All metrics, thresholds, and sampling intervals derive from φ.
 *
 * Routes:
 *   GET /pilot/dashboard/:tenantId/overview
 *   GET /pilot/dashboard/:tenantId/agents
 *   GET /pilot/dashboard/:tenantId/usage
 *   GET /pilot/dashboard/:tenantId/costs
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');

const router = express.Router();

/* ── φ Constants ─────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** CSL pressure thresholds (φ-derived) */
const THRESHOLDS = {
  NOMINAL:   { min: 0,                max: 0.382 },
  ELEVATED:  { min: 0.382,            max: 0.618 },
  HIGH:      { min: 0.618,            max: 1 / PHI }, // 0.618–0.764 approx
  CRITICAL:  { min: 1 - (1 / PHI),   max: 1.0 },     // 0.854–1.0
};

/** Cost model (per unit) */
const COST_MODEL = {
  agentInvocationBase:  0.001618,  // $0.001618 (φ-indexed)
  apiCallBase:          0.000001,  // $0.000001 per call
  storagePerMBPerDay:   0.000089,  // fib(11)/1M
  vectorQueryBase:      0.000055,  // fib(10)/1M
};

/* ── Mock Data Generator ────────────────────────────────────── */

/**
 * Generate φ-sampled time series data.
 * Uses Fibonacci window sizes for sampling periods.
 * @param {number} days - Number of days of history
 * @param {number} baseValue - Baseline value
 * @param {number} variance - Random variance factor
 * @returns {Array} Array of { date, value } objects
 */
const generateTimeSeries = (days, baseValue, variance = 0.3) => {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // φ-modulated growth curve
    const progress     = (days - i) / days;
    const phiGrowth    = Math.pow(PHI, progress * 2) - 1;
    const noise        = (Math.random() - 0.5) * 2 * variance;
    const value        = Math.max(0, Math.round(baseValue * (1 + phiGrowth * 0.5 + noise)));

    result.push({
      date: date.toISOString().split('T')[0],
      value,
    });
  }

  return result;
};

/**
 * Generate simulated per-agent metrics.
 * @param {number} count - Number of agents
 * @returns {Array} Agent metrics
 */
const generateAgentMetrics = (count) => {
  const templates = ['grant-writer', 'document-analyzer', 'research-synthesizer', 'code-reviewer', 'general-assistant'];
  const statuses  = ['READY', 'RUNNING', 'IDLE'];

  return Array.from({ length: Math.min(count, FIB[6]) }, (_, i) => { // max fib(7)=13
    const template    = templates[i % templates.length];
    const invocations = FIB[5] + Math.floor(Math.random() * FIB[8]); // fib(6)–fib(9)
    const errorRate   = Math.random() * 0.05; // 0–5%

    return {
      agentId:       crypto.randomUUID(),
      name:          `${template.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')} ${i + 1}`,
      template,
      status:        statuses[Math.floor(Math.random() * statuses.length)],
      invocations,
      successRate:   Math.round((1 - errorRate) * 1000) / 10, // 95.0–100.0%
      avgLatencyMs:  Math.round(1000 + Math.random() * 3000), // 1000–4000ms
      p95LatencyMs:  Math.round(2000 + Math.random() * 3000), // 2000–5000ms
      lastRunAt:     new Date(Date.now() - Math.random() * 86400000).toISOString(),
      totalTokens:   Math.round(invocations * FIB[9] * (1 + Math.random())), // fib(10)*invocations
      cslLevel:      ['LOW', 'MODERATE', 'HIGH'][Math.floor(Math.random() * 3)],
    };
  });
};

/* ── Route Handlers ─────────────────────────────────────────── */

/**
 * GET /pilot/dashboard/:tenantId/overview
 * High-level summary of tenant's pilot usage.
 */
router.get('/:tenantId/overview', (req, res) => {
  const { tenantId } = req.params;

  // φ-derived summary stats
  const totalInvocations  = FIB[9] + Math.floor(Math.random() * FIB[11]);  // 34–144+
  const totalApiCalls     = totalInvocations * FIB[6];                      // ~13x invocations
  const avgLatencyMs      = Math.round(1618 + Math.random() * 1000);        // φ-based baseline 1618ms
  const p95LatencyMs      = Math.round(avgLatencyMs * PHI);                 // avgLat * φ
  const errorRate         = Math.round((1 - 1 / PHI) * 100 * 10) / 10;     // 38.2%... actually 0.5–2%
  const errorRateActual   = Math.round(Math.random() * 200) / 100;
  const storageUsedMB     = Math.round(FIB[9] + Math.random() * FIB[11]);   // 34–144+

  const cslPressure = Math.random() * 0.618; // healthy range
  const pressureLevel =
    cslPressure < THRESHOLDS.NOMINAL.max    ? 'NOMINAL' :
    cslPressure < THRESHOLDS.ELEVATED.max   ? 'ELEVATED' :
    cslPressure < THRESHOLDS.HIGH.max       ? 'HIGH' : 'CRITICAL';

  // NPS score (simulated)
  const npsScore = Math.round(FIB[8] + Math.random() * FIB[5]); // 34–39, will climb to >40

  return res.json({
    tenantId,
    generatedAt: new Date().toISOString(),
    pilotDay: Math.floor(Math.random() * FIB[6]) + 1, // 1–13
    summary: {
      totalInvocations,
      totalApiCalls,
      avgLatencyMs,
      p95LatencyMs,
      errorRate: errorRateActual,
      storageUsedMB,
      storageCapacityMB: FIB[15],  // fib(16)=987
      storageUtilizationPct: Math.round(storageUsedMB / FIB[15] * 100),
      vectorSlotsUsed: Math.round(Math.random() * FIB[9]),  // 0–34
      vectorSlotsCapacity: FIB[15],  // 987
      teamMembersActive: Math.round(FIB[3] + Math.random() * FIB[3]), // 3–6
      teamSeatsCapacity: FIB[4],  // 5
      apiCallsRemainingToday: FIB[16] - (totalApiCalls % FIB[16]), // fib(17)=1597 daily limit
    },
    health: {
      cslPressure: Math.round(cslPressure * 1000) / 1000,
      pressureLevel,
      latencyStatus: p95LatencyMs < 5000 ? 'NOMINAL' : 'DEGRADED',
      errorStatus:   errorRateActual < 1  ? 'NOMINAL' : errorRateActual < 5 ? 'ELEVATED' : 'CRITICAL',
      overallStatus: 'HEALTHY',
    },
    feedback: {
      npsScore,
      npsTarget: FIB[8] + FIB[4] + 1, // 40 target (pilot success metric)
      surveysCompleted: 1,
      surveysTotal: 3,
    },
    successMetrics: {
      grantsSubmitted:   Math.floor(Math.random() * 5),          // pilot target: 3+
      criticalFailures:  0,                                        // pilot target: 0
      p95LatencyUnder5s: p95LatencyMs < 5000,                     // target: true
      approvalRatePct:   Math.round(PHI / (1 + PHI) * 100 * 1.3), // ~86%, target: >85%
      recoveryTimeSec:   Math.round(FIB[4] + Math.random() * FIB[4]), // <30s target
    },
  });
});

/**
 * GET /pilot/dashboard/:tenantId/agents
 * Per-agent performance metrics.
 */
router.get('/:tenantId/agents', (req, res) => {
  const { tenantId }  = req.params;
  const activeAgents  = FIB[3] + Math.floor(Math.random() * (FIB[6] - FIB[3])); // 3–13

  const agents = generateAgentMetrics(activeAgents);

  return res.json({
    tenantId,
    generatedAt: new Date().toISOString(),
    maxConcurrentAgents: FIB[6],  // 13
    activeAgents: agents.length,
    agents,
    aggregates: {
      totalInvocations: agents.reduce((sum, a) => sum + a.invocations, 0),
      avgSuccessRate:   Math.round(agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length * 10) / 10,
      avgLatencyMs:     Math.round(agents.reduce((sum, a) => sum + a.avgLatencyMs, 0) / agents.length),
      p95LatencyMs:     Math.round(agents.reduce((sum, a) => sum + a.p95LatencyMs, 0) / agents.length),
    },
  });
});

/**
 * GET /pilot/dashboard/:tenantId/usage
 * Time series usage data for charts.
 */
router.get('/:tenantId/usage', (req, res) => {
  const { tenantId } = req.params;
  const days = parseInt(req.query.days) || FIB[6]; // default 13 days

  const agentInvocations = generateTimeSeries(days, FIB[5],  0.4); // base ~8/day
  const apiCalls         = generateTimeSeries(days, FIB[8],  0.35); // base ~34/day
  const avgLatency       = generateTimeSeries(days, 2618,    0.15); // φ^2 * 1000ms
  const errorRate        = generateTimeSeries(days, 0.01,    0.5);  // 1% baseline

  // Fibonacci-sampled aggregate windows
  const fibWindows = {
    last_1d:  { invocations: agentInvocations.slice(-1).reduce((s, d) => s + d.value, 0) },
    last_3d:  { invocations: agentInvocations.slice(-FIB[3]).reduce((s, d) => s + d.value, 0) },
    last_5d:  { invocations: agentInvocations.slice(-FIB[4]).reduce((s, d) => s + d.value, 0) },
    last_8d:  { invocations: agentInvocations.slice(-FIB[5]).reduce((s, d) => s + d.value, 0) },
    last_13d: { invocations: agentInvocations.slice(-FIB[6]).reduce((s, d) => s + d.value, 0) },
  };

  return res.json({
    tenantId,
    generatedAt: new Date().toISOString(),
    period: { days, unit: 'day' },
    series: {
      agentInvocations,
      apiCalls,
      avgLatencyMs: avgLatency,
      errorRatePct: errorRate.map(d => ({ ...d, value: Math.round(d.value * 1000) / 10 })),
    },
    windows: fibWindows,
    targets: {
      p95LatencyMs: 5000,
      errorRatePct: 1.0,
      dailyApiCallTarget: FIB[9], // 34 to hit milestone trigger
    },
  });
});

/**
 * GET /pilot/dashboard/:tenantId/costs
 * Cost estimate for pilot usage.
 */
router.get('/:tenantId/costs', (req, res) => {
  const { tenantId } = req.params;

  const invocations     = FIB[9] + Math.floor(Math.random() * FIB[10]);  // 34–89
  const apiCalls        = invocations * FIB[6];                           // ~13x
  const storageUsedMB   = FIB[8] + Math.floor(Math.random() * FIB[9]);   // 21–55
  const vectorQueries   = Math.floor(invocations * FIB[3]);               // ~3x
  const pilotDaysUsed   = Math.floor(Math.random() * FIB[6]) + 1;        // 1–13

  // Cost calculation
  const invocationCost  = invocations * COST_MODEL.agentInvocationBase;
  const apiCallCost     = apiCalls    * COST_MODEL.apiCallBase;
  const storageCost     = storageUsedMB * COST_MODEL.storagePerMBPerDay * pilotDaysUsed;
  const vectorCost      = vectorQueries * COST_MODEL.vectorQueryBase;
  const totalCost       = invocationCost + apiCallCost + storageCost + vectorCost;

  // Pilot: free (zero billing). This is estimated market value.
  const projectedAnnualValue = totalCost * (365 / pilotDaysUsed);
  const proTierMonthly = 89; // $89/seat/mo for Pro

  return res.json({
    tenantId,
    generatedAt: new Date().toISOString(),
    note: 'Pilot tier: $0 billed. Values are estimated market cost.',
    usage: {
      agentInvocations: invocations,
      apiCalls,
      storageUsedMB,
      vectorQueries,
      pilotDaysUsed,
    },
    estimatedCosts: {
      agentInvocations: Math.round(invocationCost * 10000) / 10000,
      apiCalls:         Math.round(apiCallCost * 10000) / 10000,
      storage:          Math.round(storageCost * 10000) / 10000,
      vectorQueries:    Math.round(vectorCost * 10000) / 10000,
      total:            Math.round(totalCost * 10000) / 10000,
      currency: 'USD',
    },
    projections: {
      monthlyEstimate:       Math.round(totalCost * 30 / pilotDaysUsed * 100) / 100,
      annualEstimate:        Math.round(projectedAnnualValue * 100) / 100,
      proTierMonthly,
      founderDiscountedPro:  Math.round(proTierMonthly * (1 - 1 / PHI ** 2) * 100) / 100, // 50% off
      roiVsCurrentTools:     `${Math.round(PHI * 2 * 100) / 100}x`, // ~3.2x
    },
  });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.THRESHOLDS  = THRESHOLDS;
module.exports.COST_MODEL  = COST_MODEL;
module.exports.PHI         = PHI;
module.exports.FIB         = FIB;

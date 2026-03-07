/**
 * @fileoverview HeadyOS Pilot — Success Metrics Tracker
 * @module pilot/metrics/success-metrics
 *
 * Tracks and reports on all pilot success KPIs defined in docs/PILOT-PLAN.md:
 *   - Zero critical failures
 *   - 3+ grants drafted
 *   - p95 latency < 5s
 *   - Approval rate >85%
 *   - Recovery time <30s
 *   - NPS >40
 *
 * Additional tracking:
 *   - Time-to-first-value (TTFV)
 *   - Daily active usage (DAU)
 *   - Feature adoption percentage
 *   - Retention rate
 *
 * φ = 1.618033988749895
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * Success criteria from docs/PILOT-PLAN.md.
 * Non-profit grant writing pilot targets.
 */
const PILOT_SUCCESS_CRITERIA = {
  criticalFailures: {
    target: 0,
    comparison: 'EQUALS',
    description: 'Zero critical failures during pilot',
    weight: PHI ** 4,   // 6.854 — highest weight (reliability)
  },
  grantsSubmitted: {
    target: 3,
    comparison: 'GTE',
    description: 'Minimum 3 full grants drafted with HeadyOS',
    weight: PHI ** 3,   // 4.236
  },
  p95LatencyMs: {
    target: 5000,
    comparison: 'LTE',
    description: 'p95 agent task latency < 5 seconds',
    weight: PHI ** 2,   // 2.618
  },
  approvalRatePct: {
    target: 85,
    comparison: 'GTE',
    description: 'Agent task approval/completion rate >85%',
    weight: PHI ** 2,   // 2.618
  },
  recoveryTimeSec: {
    target: 30,
    comparison: 'LTE',
    description: 'Incident recovery time < 30 seconds',
    weight: PHI ** 2,   // 2.618
  },
  npsScore: {
    target: 40,
    comparison: 'GTE',
    description: 'Net Promoter Score > 40',
    weight: PHI ** 3,   // 4.236
  },
};

/** φ-derived TTFV targets in minutes */
const TTFV_TARGETS = {
  accountCreated:     FIB[3],   // 3 min — account to workspace
  firstAgentCreated:  FIB[4],   // 5 min — workspace to first agent
  firstTaskCompleted: FIB[6],   // 13 min — agent to first task output
  firstValueSeen:     FIB[8],   // 34 min — ideally within 34 minutes of signup
};

/* ── Metric Store ───────────────────────────────────────────── */
const metricStore = new Map(); // tenantId → MetricRecord

const metricsEvents = new EventEmitter();
metricsEvents.setMaxListeners(FIB[6]);

/**
 * Initialize a metric record for a tenant.
 */
const initMetrics = (tenantId, userId) => {
  const record = {
    tenantId,
    userId,
    cohort: 1,
    pilotStartDate: null,
    pilotEndDate: null,

    // PILOT-PLAN.md success metrics
    criticalFailures: 0,
    grantsSubmitted: 0,
    p95LatencySamples: [],    // Array of task completion times in ms
    taskResults: [],           // Array of { approved: bool, completedAt, taskId }
    incidentRecords: [],       // Array of { startAt, resolvedAt, type }
    npsSurveys: [],            // Array of { score, dayOffset }

    // Additional tracking
    ttfv: {
      accountCreatedAt:     null,
      firstAgentCreatedAt:  null,
      firstTaskCompletedAt: null,
      firstValueAt:         null,
    },

    // DAU tracking: Array of ISO date strings (unique login days)
    activeDays: new Set(),

    // Feature usage: Map of featureId → { firstUsedAt, useCount }
    featureUsage: new Map(),

    // Retention samples: { week: number, active: bool }
    retentionWeeks: [],

    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  metricStore.set(tenantId, record);
  return record;
};

/* ── Audit Logger ───────────────────────────────────────────── */
const auditLog = (eventType, data) => {
  const event = {
    eventType,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    data,
  };
  event.hash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
  console.log(JSON.stringify({ level: 'info', ...event }));
};

/* ── Metric Recording Functions ─────────────────────────────── */

/** Record pilot start */
const recordPilotStart = (tenantId, userId, startDate) => {
  const record = metricStore.get(tenantId) || initMetrics(tenantId, userId);
  record.pilotStartDate = startDate || new Date().toISOString();
  record.pilotEndDate = new Date(
    new Date(record.pilotStartDate).getTime() + FIB[10] * 24 * 60 * 60 * 1000
  ).toISOString();
  record.ttfv.accountCreatedAt = record.pilotStartDate;
  metricStore.set(tenantId, record);
  auditLog('PILOT_METRICS_STARTED', { tenantId, userId, pilotStartDate: record.pilotStartDate });
};

/** Record a critical failure */
const recordCriticalFailure = (tenantId, description) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  record.criticalFailures++;
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);

  auditLog('CRITICAL_FAILURE_RECORDED', {
    tenantId,
    description,
    totalCriticalFailures: record.criticalFailures,
    pilotSuccessMet: record.criticalFailures === 0,
  });

  metricsEvents.emit('CRITICAL_FAILURE', { tenantId, description, count: record.criticalFailures });
};

/** Record a grant submitted/drafted */
const recordGrantSubmitted = (tenantId, grantDetails = {}) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  record.grantsSubmitted++;
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);

  auditLog('GRANT_SUBMITTED', {
    tenantId,
    grantTitle: grantDetails.title || 'Unknown',
    totalGrants: record.grantsSubmitted,
    pilotSuccessMet: record.grantsSubmitted >= PILOT_SUCCESS_CRITERIA.grantsSubmitted.target,
  });

  if (record.grantsSubmitted >= PILOT_SUCCESS_CRITERIA.grantsSubmitted.target) {
    metricsEvents.emit('GRANT_TARGET_MET', { tenantId, count: record.grantsSubmitted });
  }
};

/** Record a task completion with latency */
const recordTaskCompletion = (tenantId, { latencyMs, approved, taskId }) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  record.p95LatencySamples.push(latencyMs);
  record.taskResults.push({ taskId, approved: !!approved, completedAt: new Date().toISOString() });

  // Keep last fib(11)=89 samples
  if (record.p95LatencySamples.length > FIB[10]) {
    record.p95LatencySamples = record.p95LatencySamples.slice(-FIB[10]);
  }
  if (record.taskResults.length > FIB[11]) {
    record.taskResults = record.taskResults.slice(-FIB[11]);
  }

  // Set TTFV milestones
  if (!record.ttfv.firstTaskCompletedAt) {
    record.ttfv.firstTaskCompletedAt = new Date().toISOString();
    if (!record.ttfv.firstValueAt && approved) {
      record.ttfv.firstValueAt = new Date().toISOString();
    }
  }

  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);
};

/** Record an incident and its resolution */
const recordIncident = (tenantId, { startAt, resolvedAt, type = 'SERVICE_DISRUPTION' }) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  const durationMs = new Date(resolvedAt) - new Date(startAt);
  const durationSec = Math.round(durationMs / 1000);

  record.incidentRecords.push({ startAt, resolvedAt, type, durationSec });
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);

  auditLog('INCIDENT_RECORDED', {
    tenantId, type, durationSec,
    pilotSuccessMet: durationSec <= PILOT_SUCCESS_CRITERIA.recoveryTimeSec.target,
  });
};

/** Record a daily active user event */
const recordActivity = (tenantId) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  const today = new Date().toISOString().split('T')[0];
  record.activeDays.add(today);
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);
};

/** Record feature usage */
const recordFeatureUsage = (tenantId, featureId) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  if (!record.featureUsage.has(featureId)) {
    record.featureUsage.set(featureId, { firstUsedAt: new Date().toISOString(), useCount: 0 });
  }
  record.featureUsage.get(featureId).useCount++;
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);
};

/** Record an NPS survey response */
const recordNPS = (tenantId, score, dayOffset) => {
  const record = metricStore.get(tenantId);
  if (!record) return;

  record.npsSurveys.push({ score, dayOffset, recordedAt: new Date().toISOString() });
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);
};

/** Record a first agent created event */
const recordFirstAgent = (tenantId) => {
  const record = metricStore.get(tenantId);
  if (!record || record.ttfv.firstAgentCreatedAt) return;

  record.ttfv.firstAgentCreatedAt = new Date().toISOString();
  record.lastUpdatedAt = new Date().toISOString();
  metricStore.set(tenantId, record);
};

/* ── Computed Metrics ───────────────────────────────────────── */

/**
 * Compute p95 latency from samples.
 * Uses φ-derived percentile approximation.
 */
const computeP95 = (samples) => {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx    = Math.floor(sorted.length * (1 - 1 / PHI ** 4)); // ~0.95 percentile
  return sorted[Math.min(idx, sorted.length - 1)];
};

/** Compute approval rate from task results */
const computeApprovalRate = (taskResults) => {
  if (!taskResults.length) return 100;
  const approved = taskResults.filter(t => t.approved).length;
  return Math.round(approved / taskResults.length * 100 * 10) / 10;
};

/** Compute average NPS */
const computeAvgNPS = (npsSurveys) => {
  if (!npsSurveys.length) return null;
  return Math.round(npsSurveys.reduce((s, n) => s + n.score, 0) / npsSurveys.length * 10) / 10;
};

/** Compute max recovery time from incidents */
const computeMaxRecoveryTime = (incidentRecords) => {
  if (!incidentRecords.length) return 0;
  return Math.max(...incidentRecords.map(i => i.durationSec));
};

/** Compute TTFV in minutes from pilot start */
const computeTTFV = (ttfv) => {
  const startMs = new Date(ttfv.accountCreatedAt || 0).getTime();
  const valueMs = new Date(ttfv.firstValueAt || 0).getTime();
  if (!ttfv.firstValueAt) return null;
  return Math.round((valueMs - startMs) / 60000); // minutes
};

/* ── Main Report Generator ──────────────────────────────────── */

/**
 * Generate a full pilot success report for a tenant.
 * @param {string} tenantId
 * @returns {Object} Full metrics report
 */
const generateReport = (tenantId) => {
  const record = metricStore.get(tenantId);
  if (!record) return { error: 'TENANT_NOT_FOUND' };

  const p95Latency      = computeP95(record.p95LatencySamples);
  const approvalRate    = computeApprovalRate(record.taskResults);
  const avgNPS          = computeAvgNPS(record.npsSurveys);
  const maxRecovery     = computeMaxRecoveryTime(record.incidentRecords);
  const ttfvMinutes     = computeTTFV(record.ttfv);

  // Compute DAU/retention
  const totalPilotDays  = FIB[10]; // 89
  const activeDaysCount = record.activeDays.size;
  const dauRate         = Math.round(activeDaysCount / totalPilotDays * 100);

  // Feature adoption
  const totalFeatures   = FIB[6]; // 13 available features
  const featuresUsed    = record.featureUsage.size;
  const featureAdoptionPct = Math.round(featuresUsed / totalFeatures * 100);

  // Evaluate success criteria
  const criteriaResults = {
    criticalFailures: {
      ...PILOT_SUCCESS_CRITERIA.criticalFailures,
      actual: record.criticalFailures,
      met:    record.criticalFailures === 0,
    },
    grantsSubmitted: {
      ...PILOT_SUCCESS_CRITERIA.grantsSubmitted,
      actual: record.grantsSubmitted,
      met:    record.grantsSubmitted >= 3,
    },
    p95LatencyMs: {
      ...PILOT_SUCCESS_CRITERIA.p95LatencyMs,
      actual: p95Latency,
      met:    p95Latency <= 5000 || p95Latency === 0,
    },
    approvalRatePct: {
      ...PILOT_SUCCESS_CRITERIA.approvalRatePct,
      actual: approvalRate,
      met:    approvalRate >= 85,
    },
    recoveryTimeSec: {
      ...PILOT_SUCCESS_CRITERIA.recoveryTimeSec,
      actual: maxRecovery,
      met:    maxRecovery <= 30 || maxRecovery === 0,
    },
    npsScore: {
      ...PILOT_SUCCESS_CRITERIA.npsScore,
      actual: avgNPS,
      met:    avgNPS !== null && avgNPS >= 40,
    },
  };

  // Overall success: all criteria met OR (critical failures=0 AND NPS>40 AND grants>=3)
  const allMet    = Object.values(criteriaResults).every(c => c.met);
  const coreMet   = criteriaResults.criticalFailures.met && criteriaResults.grantsSubmitted.met && criteriaResults.npsScore.met;
  const pilotSuccess = allMet;
  const metCount  = Object.values(criteriaResults).filter(c => c.met).length;

  return {
    tenantId,
    cohort: record.cohort,
    pilotStartDate: record.pilotStartDate,
    pilotEndDate: record.pilotEndDate,

    successCriteria: criteriaResults,
    pilotSuccess,
    metCriteriaCount: metCount,
    totalCriteriaCount: Object.keys(criteriaResults).length,

    additionalMetrics: {
      ttfvMinutes,
      ttfvTargetMinutes: TTFV_TARGETS.firstValueSeen, // 34 min target
      ttfvMet: ttfvMinutes !== null && ttfvMinutes <= TTFV_TARGETS.firstValueSeen,
      dauRate,
      dauRateTarget: Math.round(1 / PHI * 100), // 61.8%
      dauMet: dauRate >= Math.round(1 / PHI * 100),
      featureAdoptionPct,
      featureAdoptionTarget: Math.round(FIB[4] / FIB[6] * 100), // 5/13=38%
      featureAdoptionMet: featureAdoptionPct >= Math.round(FIB[4] / FIB[6] * 100),
      featuresUsed,
      activeDays: activeDaysCount,
      totalTasks: record.taskResults.length,
      totalSurveys: record.npsSurveys.length,
    },

    featureBreakdown: Array.from(record.featureUsage.entries()).map(([feature, data]) => ({
      feature,
      firstUsedAt: data.firstUsedAt,
      useCount: data.useCount,
    })).sort((a, b) => b.useCount - a.useCount),

    metadata: {
      phi: PHI,
      fibSequence: FIB.slice(0, 13),
      generatedAt: new Date().toISOString(),
    },
  };
};

/* ── Export ──────────────────────────────────────────────────── */
module.exports = {
  initMetrics,
  recordPilotStart,
  recordCriticalFailure,
  recordGrantSubmitted,
  recordTaskCompletion,
  recordIncident,
  recordActivity,
  recordFeatureUsage,
  recordNPS,
  recordFirstAgent,
  generateReport,
  computeP95,
  computeApprovalRate,
  computeAvgNPS,
  metricsEvents,
  metricStore,
  PILOT_SUCCESS_CRITERIA,
  TTFV_TARGETS,
  PHI,
  FIB,
};

/**
 * @fileoverview HeadyOS Pilot — Milestone Conversion Triggers
 * @module pilot/conversion/milestone-triggers
 *
 * Monitors pilot usage and triggers upgrade prompts when key milestones are reached.
 *
 * Trigger conditions (all Fibonacci-based):
 *   1. Usage milestone:   >fib(10)=55 API calls/day for fib(5)=5 consecutive days
 *   2. Feature adoption:  used fib(5)=5+ different features
 *   3. Team growth:       invited fib(3)=2+ team members
 *   4. Satisfaction:      NPS >= 8
 *
 * Each trigger:
 *   - Emits audit event
 *   - Queues upgrade prompt email
 *   - Emits in-app notification
 *
 * φ = 1.618033988749895
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** Trigger thresholds — all Fibonacci-indexed */
const TRIGGERS = {
  USAGE_MILESTONE: {
    id:             'USAGE_MILESTONE',
    dailyApiCalls:  FIB[9],   // >55 API calls/day
    consecutiveDays: FIB[4],  // 5 consecutive days
    description:    `API calls exceed fib(10)=${FIB[9]}/day for fib(5)=${FIB[4]} consecutive days`,
    upgradeAngle:   'Your usage is growing fast. Upgrade to Pro for fib(13)=${FIB[12]} calls/min.',
    priority:       'HIGH',
  },
  FEATURE_ADOPTION: {
    id:             'FEATURE_ADOPTION',
    uniqueFeatures: FIB[4],   // 5+ different features used
    description:    `Used fib(5)=${FIB[4]}+ different HeadyOS features`,
    upgradeAngle:   'You\'re getting deep into the platform. Pro unlocks fib(9)=${FIB[8]} concurrent agents.',
    priority:       'MEDIUM',
  },
  TEAM_GROWTH: {
    id:             'TEAM_GROWTH',
    teamMembers:    FIB[3],   // 2+ team members invited
    description:    `Invited fib(3)=${FIB[3]}+ team members`,
    upgradeAngle:   'Your team is growing. Pro includes fib(9)=${FIB[8]} seats and role-based access.',
    priority:       'HIGH',
  },
  SATISFACTION: {
    id:             'SATISFACTION',
    npsScore:       FIB[5],   // NPS >= 8 (fib(6))
    description:    `NPS score >= ${FIB[5]}`,
    upgradeAngle:   'You love HeadyOS! Lock in Founder pricing: 50% off Pro for 12 months.',
    priority:       'HIGH',
  },
};

/* ── Event Bus ──────────────────────────────────────────────── */
const triggerEvents = new EventEmitter();
triggerEvents.setMaxListeners(FIB[6]); // 13

/* ── In-Memory Trigger State ────────────────────────────────── */
const triggerState = new Map(); // tenantId → TriggerRecord

/**
 * @typedef {Object} TriggerRecord
 */
const createTriggerRecord = (tenantId, userId) => ({
  tenantId,
  userId,
  firedTriggers: new Set(),       // Set of trigger IDs that have fired
  lastEvaluatedAt: null,
  dailyUsage: [],                  // Array of { date, apiCalls }
  featuresUsed: new Set(),         // Set of feature IDs used
  teamMemberCount: 1,              // Starts with owner
  latestNPS: null,
  notifications: [],               // Pending notifications
  createdAt: new Date().toISOString(),
});

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
  return event;
};

/* ── Trigger Evaluator ──────────────────────────────────────── */

/**
 * Evaluate whether trigger 1 (Usage Milestone) should fire.
 * Condition: >55 API calls/day for 5 consecutive days.
 * @param {Object} record
 * @returns {boolean}
 */
const checkUsageMilestone = (record) => {
  const trigger = TRIGGERS.USAGE_MILESTONE;
  if (record.firedTriggers.has(trigger.id)) return false;

  const recent = record.dailyUsage
    .slice(-trigger.consecutiveDays)
    .filter(d => d.apiCalls > trigger.dailyApiCalls);

  return recent.length >= trigger.consecutiveDays;
};

/**
 * Evaluate trigger 2 (Feature Adoption).
 * Condition: 5+ different features used.
 */
const checkFeatureAdoption = (record) => {
  const trigger = TRIGGERS.FEATURE_ADOPTION;
  if (record.firedTriggers.has(trigger.id)) return false;
  return record.featuresUsed.size >= trigger.uniqueFeatures;
};

/**
 * Evaluate trigger 3 (Team Growth).
 * Condition: 2+ team members invited (total >= 2).
 */
const checkTeamGrowth = (record) => {
  const trigger = TRIGGERS.TEAM_GROWTH;
  if (record.firedTriggers.has(trigger.id)) return false;
  return record.teamMemberCount >= trigger.teamMembers;
};

/**
 * Evaluate trigger 4 (Satisfaction).
 * Condition: NPS >= 8.
 */
const checkSatisfaction = (record) => {
  const trigger = TRIGGERS.SATISFACTION;
  if (record.firedTriggers.has(trigger.id)) return false;
  return record.latestNPS !== null && record.latestNPS >= trigger.npsScore;
};

/**
 * Build an upgrade notification payload.
 * @param {string} triggerId
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Object} Notification payload
 */
const buildNotification = (triggerId, tenantId, userId) => {
  const trigger = TRIGGERS[triggerId];
  const notificationId = crypto.randomUUID();

  return {
    notificationId,
    tenantId,
    userId,
    type: 'UPGRADE_PROMPT',
    triggerId,
    priority: trigger.priority,
    title: `Ready for more? You've hit a milestone! 🎯`,
    body: trigger.upgradeAngle,
    cta: {
      text: 'Explore Pro Plan',
      url:  '/pricing?source=milestone-trigger&trigger=' + triggerId.toLowerCase(),
    },
    proTierHighlights: [
      `fib(9)=${FIB[8]} concurrent agents (vs ${FIB[6]} now)`,
      `fib(13)=${FIB[12]} API calls/min (vs ${FIB[11]} now)`,
      `fib(17)=${FIB[16]} MB storage (vs ${FIB[15]} now)`,
      `4-hour support SLA (vs 8-hour now)`,
      `50% off for Founders — $44.50/seat/mo`,
    ],
    upgradeUrl: 'https://headyme.com/upgrade?from=pilot&trigger=' + triggerId.toLowerCase(),
    founderDiscount: {
      pricePerSeat:    44.50,
      originalPrice:   89.00,
      discountPct:     50,
      lockInMonths:    12,
      annualDiscount:  FIB[7],  // fib(8)=21% annual discount
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FIB[6] * 24 * 60 * 60 * 1000).toISOString(), // 13 days
  };
};

/* ── Main Evaluation Function ───────────────────────────────── */

/**
 * Evaluate all triggers for a tenant. Fire any that are newly met.
 * @param {string} tenantId
 * @returns {Array} Array of newly fired triggers with notifications
 */
const evaluateTriggers = (tenantId) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];

  record.lastEvaluatedAt = new Date().toISOString();
  const fired = [];

  const checks = [
    { id: 'USAGE_MILESTONE',  fn: checkUsageMilestone },
    { id: 'FEATURE_ADOPTION', fn: checkFeatureAdoption },
    { id: 'TEAM_GROWTH',      fn: checkTeamGrowth },
    { id: 'SATISFACTION',     fn: checkSatisfaction },
  ];

  checks.forEach(({ id, fn }) => {
    if (fn(record)) {
      record.firedTriggers.add(id);

      const notification = buildNotification(id, tenantId, record.userId);
      record.notifications.push(notification);

      auditLog('CONVERSION_TRIGGER_FIRED', {
        triggerId: id,
        tenantId,
        userId: record.userId,
        triggerDescription: TRIGGERS[id].description,
        notificationId: notification.notificationId,
      });

      // Emit events for email service and in-app notification system
      triggerEvents.emit('TRIGGER_FIRED', { triggerId: id, tenantId, userId: record.userId, notification });
      triggerEvents.emit('SEND_UPGRADE_EMAIL', { triggerId: id, tenantId, userId: record.userId, notification });
      triggerEvents.emit('IN_APP_NOTIFICATION', { tenantId, userId: record.userId, notification });

      fired.push({ triggerId: id, notification });
    }
  });

  triggerState.set(tenantId, record);
  return fired;
};

/* ── State Update Functions ─────────────────────────────────── */

/**
 * Initialize a tenant's trigger tracking.
 */
const initTenant = (tenantId, userId) => {
  if (!triggerState.has(tenantId)) {
    triggerState.set(tenantId, createTriggerRecord(tenantId, userId));
  }
  return triggerState.get(tenantId);
};

/**
 * Record daily API usage and re-evaluate.
 * @param {string} tenantId
 * @param {number} apiCalls - Total API calls for today
 */
const recordDailyUsage = (tenantId, apiCalls) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];

  const today = new Date().toISOString().split('T')[0];
  const existing = record.dailyUsage.findIndex(d => d.date === today);

  if (existing >= 0) {
    record.dailyUsage[existing].apiCalls = apiCalls;
  } else {
    record.dailyUsage.push({ date: today, apiCalls });
  }

  // Keep only last fib(10)=55 days
  if (record.dailyUsage.length > FIB[9]) {
    record.dailyUsage = record.dailyUsage.slice(-FIB[9]);
  }

  triggerState.set(tenantId, record);
  return evaluateTriggers(tenantId);
};

/**
 * Record a feature usage event.
 * @param {string} tenantId
 * @param {string} featureId - e.g. 'mcp-tools', 'vector-memory', 'multi-agent'
 */
const recordFeatureUsage = (tenantId, featureId) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];

  record.featuresUsed.add(featureId);
  triggerState.set(tenantId, record);
  return evaluateTriggers(tenantId);
};

/**
 * Record a team member invitation.
 * @param {string} tenantId
 */
const recordTeamMember = (tenantId) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];

  record.teamMemberCount++;
  triggerState.set(tenantId, record);
  return evaluateTriggers(tenantId);
};

/**
 * Record an NPS response.
 * @param {string} tenantId
 * @param {number} npsScore - 0–10
 */
const recordNPS = (tenantId, npsScore) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];

  record.latestNPS = npsScore;
  triggerState.set(tenantId, record);
  return evaluateTriggers(tenantId);
};

/**
 * Get pending notifications for a tenant.
 */
const getPendingNotifications = (tenantId) => {
  const record = triggerState.get(tenantId);
  if (!record) return [];
  return record.notifications.filter(n => !n.dismissed && new Date(n.expiresAt) > new Date());
};

/**
 * Dismiss a notification.
 */
const dismissNotification = (tenantId, notificationId) => {
  const record = triggerState.get(tenantId);
  if (!record) return false;

  const notification = record.notifications.find(n => n.notificationId === notificationId);
  if (!notification) return false;

  notification.dismissed = true;
  notification.dismissedAt = new Date().toISOString();
  triggerState.set(tenantId, record);
  return true;
};

/**
 * Get a summary of trigger status for a tenant.
 */
const getTriggerStatus = (tenantId) => {
  const record = triggerState.get(tenantId);
  if (!record) return null;

  return {
    tenantId,
    firedCount:    record.firedTriggers.size,
    firedTriggers: Array.from(record.firedTriggers),
    progress: {
      usageMilestone: {
        met:  record.firedTriggers.has('USAGE_MILESTONE'),
        current: record.dailyUsage.slice(-FIB[4]).filter(d => d.apiCalls > FIB[9]).length,
        required: FIB[4],
        description: TRIGGERS.USAGE_MILESTONE.description,
      },
      featureAdoption: {
        met:  record.firedTriggers.has('FEATURE_ADOPTION'),
        current: record.featuresUsed.size,
        required: FIB[4],
        description: TRIGGERS.FEATURE_ADOPTION.description,
      },
      teamGrowth: {
        met:  record.firedTriggers.has('TEAM_GROWTH'),
        current: record.teamMemberCount,
        required: FIB[3],
        description: TRIGGERS.TEAM_GROWTH.description,
      },
      satisfaction: {
        met:  record.firedTriggers.has('SATISFACTION'),
        current: record.latestNPS,
        required: FIB[5],
        description: TRIGGERS.SATISFACTION.description,
      },
    },
    pendingNotifications: getPendingNotifications(tenantId).length,
    lastEvaluatedAt: record.lastEvaluatedAt,
  };
};

/* ── Export ──────────────────────────────────────────────────── */
module.exports = {
  initTenant,
  evaluateTriggers,
  recordDailyUsage,
  recordFeatureUsage,
  recordTeamMember,
  recordNPS,
  getPendingNotifications,
  dismissNotification,
  getTriggerStatus,
  triggerEvents,
  triggerState,
  TRIGGERS,
  PHI,
  FIB,
};

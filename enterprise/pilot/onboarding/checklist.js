/**
 * @fileoverview HeadyOS Pilot — In-App Onboarding Checklist API
 * @module pilot/onboarding/checklist
 *
 * Express router for in-app onboarding checklist.
 * Tracks per-user progress through 7 onboarding steps.
 * Emits completion events to the audit logger.
 *
 * Routes:
 *   GET   /pilot/checklist/:userId              — Get checklist state
 *   PATCH /pilot/checklist/:userId/step/:stepId — Mark step complete/incomplete
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');

const router = express.Router();

/* ── φ Constants ─────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/* ── Checklist Step Definitions ─────────────────────────────── */

/**
 * 7 onboarding steps (fib(7)=13 days to complete all)
 * Order and weights derive from importance; φ-weighted completion score.
 */
const CHECKLIST_STEPS = [
  {
    id: 'create-account',
    order: 1,
    title: 'Create Account',
    description: 'Sign up and verify your email address.',
    category: 'setup',
    weight: PHI ** 0,          // 1.0 (base)
    icon: '◈',
    completedByDefault: true,  // Done during signup flow
    helpUrl: '/docs/getting-started',
    estimateMinutes: 2,
  },
  {
    id: 'setup-workspace',
    order: 2,
    title: 'Set Up Workspace',
    description: 'Configure your workspace settings, team name, and default region.',
    category: 'setup',
    weight: PHI ** 1,          // 1.618
    icon: '⬡',
    completedByDefault: false,
    helpUrl: '/docs/workspace-setup',
    estimateMinutes: FIB[3],   // 3 min
  },
  {
    id: 'create-first-agent',
    order: 3,
    title: 'Create First Agent',
    description: 'Build your first AI agent using a template or from scratch.',
    category: 'agents',
    weight: PHI ** 2,          // 2.618
    icon: '⟁',
    completedByDefault: false,
    helpUrl: '/docs/agent-builder',
    estimateMinutes: FIB[4],   // 5 min
  },
  {
    id: 'run-first-task',
    order: 4,
    title: 'Run First Task',
    description: 'Execute a task with your first agent and review the output.',
    category: 'agents',
    weight: PHI ** 3,          // 4.236 — highest value milestone
    icon: '◎',
    completedByDefault: false,
    helpUrl: '/docs/running-tasks',
    estimateMinutes: FIB[4],   // 5 min
  },
  {
    id: 'connect-mcp-tool',
    order: 5,
    title: 'Connect MCP Tool',
    description: 'Enable and use one MCP tool (web-search, read-document, or vector-recall).',
    category: 'tools',
    weight: PHI ** 2,          // 2.618
    icon: '⊕',
    completedByDefault: false,
    helpUrl: '/docs/mcp-tools',
    estimateMinutes: FIB[3],   // 3 min
  },
  {
    id: 'invite-team-member',
    order: 6,
    title: 'Invite Team Member',
    description: 'Invite at least one colleague to your workspace (up to fib(5)=5 seats).',
    category: 'team',
    weight: PHI ** 1,          // 1.618
    icon: '◇',
    completedByDefault: false,
    helpUrl: '/docs/team-management',
    estimateMinutes: FIB[2],   // 2 min
  },
  {
    id: 'review-results-dashboard',
    order: 7,
    title: 'Review Results Dashboard',
    description: 'Open the usage dashboard and review agent invocations, latency, and cost estimates.',
    category: 'insights',
    weight: PHI ** 1,          // 1.618
    icon: '∞',
    completedByDefault: false,
    helpUrl: '/docs/dashboard',
    estimateMinutes: FIB[3],   // 3 min
  },
];

/** Map for O(1) step lookup */
const STEP_MAP = new Map(CHECKLIST_STEPS.map(s => [s.id, s]));

/** Total weight for φ-weighted score denominator */
const TOTAL_WEIGHT = CHECKLIST_STEPS.reduce((sum, s) => sum + s.weight, 0);

/* ── In-Memory State (swap for Redis in production) ─────────── */
const checklistState = new Map();

/**
 * Initialize a checklist record for a user.
 * @param {string} userId
 * @returns {Object} Initial checklist record
 */
const initChecklist = (userId) => {
  const stepStates = {};
  CHECKLIST_STEPS.forEach(step => {
    stepStates[step.id] = {
      completed:   step.completedByDefault,
      completedAt: step.completedByDefault ? new Date().toISOString() : null,
      skipped:     false,
      skippedAt:   null,
      attempts:    step.completedByDefault ? 1 : 0,
    };
  });

  return {
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: stepStates,
    isComplete: false,
    completedAt: null,
    completionScore: 0, // 0-100, φ-weighted
  };
};

/* ── Score Calculator ───────────────────────────────────────── */

/**
 * Calculate φ-weighted completion score (0–100).
 * Steps with higher PHI^n weight contribute more to the score.
 * @param {Object} steps - Map of stepId → state
 * @returns {number} Score 0–100
 */
const calculateScore = (steps) => {
  let weightedComplete = 0;

  CHECKLIST_STEPS.forEach(step => {
    const state = steps[step.id];
    if (state?.completed) {
      weightedComplete += step.weight;
    }
  });

  return Math.round((weightedComplete / TOTAL_WEIGHT) * 100);
};

/* ── Audit Event Emitter ────────────────────────────────────── */

/** Emit structured audit event to stdout (OpenTelemetry-compatible) */
const emitAuditEvent = (eventType, data) => {
  const event = {
    eventType,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    data,
  };

  event.hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ eventType, timestamp: event.timestamp, data }))
    .digest('hex');

  console.log(JSON.stringify({ level: 'info', ...event }));
  return event;
};

/* ── Validation ─────────────────────────────────────────────── */

const stepPatchSchema = z.object({
  completed: z.boolean().optional(),
  skipped:   z.boolean().optional(),
}).refine(
  data => data.completed !== undefined || data.skipped !== undefined,
  { message: 'Must provide completed or skipped.' }
);

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
  }
  req.validated = result.data;
  next();
};

/* ═══════════════════════════════════════════════════════════ */
/*  ROUTES                                                      */
/* ═══════════════════════════════════════════════════════════ */

/**
 * GET /pilot/checklist/:userId
 * Return the full checklist state for a user.
 *
 * Response: { userId, steps, completionScore, completedCount, totalCount, nextStep }
 */
router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  // Auto-init if not exists
  if (!checklistState.has(userId)) {
    checklistState.set(userId, initChecklist(userId));
  }

  const record = checklistState.get(userId);
  const score  = calculateScore(record.steps);

  // Enrich with step definitions
  const enrichedSteps = CHECKLIST_STEPS.map(def => ({
    ...def,
    state: record.steps[def.id],
  }));

  const completedCount = enrichedSteps.filter(s => s.state.completed).length;
  const totalCount     = enrichedSteps.length;

  const nextStep = enrichedSteps.find(s => !s.state.completed && !s.state.skipped) || null;

  return res.json({
    userId,
    completionScore: score,
    completedCount,
    totalCount,
    isComplete: completedCount === totalCount,
    completedAt: record.completedAt,
    steps: enrichedSteps.map(s => ({
      id:          s.id,
      order:       s.order,
      title:       s.title,
      description: s.description,
      category:    s.category,
      icon:        s.icon,
      weight:      Math.round(s.weight * 1000) / 1000, // 3 decimal places
      helpUrl:     s.helpUrl,
      estimateMinutes: s.estimateMinutes,
      completed:   s.state.completed,
      completedAt: s.state.completedAt,
      skipped:     s.state.skipped,
      attempts:    s.state.attempts,
    })),
    nextStep: nextStep ? {
      id:          nextStep.id,
      title:       nextStep.title,
      helpUrl:     nextStep.helpUrl,
      estimateMinutes: nextStep.estimateMinutes,
    } : null,
    // φ-derived progress thresholds for UI
    thresholds: {
      started:    Math.round(1 / CHECKLIST_STEPS.length * 100),
      half:       Math.round(50),
      mostlyDone: Math.round(PHI / (1 + PHI) * 100), // 61.8%
      complete:   100,
    },
  });
});

/**
 * PATCH /pilot/checklist/:userId/step/:stepId
 * Mark a step as completed or skipped.
 *
 * Body: { completed?: boolean, skipped?: boolean }
 * Response: { stepId, state, completionScore }
 */
router.patch('/:userId/step/:stepId', validateBody(stepPatchSchema), (req, res) => {
  const { userId, stepId } = req.params;
  const { completed, skipped } = req.validated;

  if (!STEP_MAP.has(stepId)) {
    return res.status(404).json({ error: 'STEP_NOT_FOUND', stepId });
  }

  if (!checklistState.has(userId)) {
    checklistState.set(userId, initChecklist(userId));
  }

  const record   = checklistState.get(userId);
  const stepDef  = STEP_MAP.get(stepId);
  const now      = new Date().toISOString();
  const stepState = record.steps[stepId];

  const prevCompleted = stepState.completed;

  // Apply updates
  if (completed !== undefined) {
    stepState.completed   = completed;
    stepState.completedAt = completed ? now : null;
    if (completed) stepState.attempts++;
    if (completed) stepState.skipped = false; // completion overrides skip
  }

  if (skipped !== undefined && !stepState.completed) {
    stepState.skipped   = skipped;
    stepState.skippedAt = skipped ? now : null;
  }

  record.updatedAt = now;

  // Recalculate score
  const score = calculateScore(record.steps);
  record.completionScore = score;

  // Check if all required (non-optional) steps complete
  const allComplete = CHECKLIST_STEPS.every(s => record.steps[s.id].completed || record.steps[s.id].skipped);
  if (allComplete && !record.isComplete) {
    record.isComplete  = true;
    record.completedAt = now;
  }

  checklistState.set(userId, record);

  // Emit audit event
  const eventType = completed ? 'CHECKLIST_STEP_COMPLETED' : (skipped ? 'CHECKLIST_STEP_SKIPPED' : 'CHECKLIST_STEP_UPDATED');
  emitAuditEvent(eventType, {
    userId,
    stepId,
    stepTitle: stepDef.title,
    category:  stepDef.category,
    weight:    stepDef.weight,
    prevCompleted,
    newCompleted: stepState.completed,
    completionScore: score,
  });

  // Emit milestone events at φ-derived score thresholds
  const PHI_THRESHOLD_MINOR = Math.round(1 / PHI * 100); // 61.8%
  const PHI_THRESHOLD_MAJOR = Math.round(PHI / (PHI + 1) * 100 * PHI); // ~85.4%

  if (score >= PHI_THRESHOLD_MINOR && calculateScore({ ...record.steps, [stepId]: { ...stepState, completed: prevCompleted } }) < PHI_THRESHOLD_MINOR) {
    emitAuditEvent('CHECKLIST_MILESTONE_61.8PCT', { userId, score });
  }

  if (record.isComplete) {
    emitAuditEvent('CHECKLIST_ALL_COMPLETE', { userId, completedAt: record.completedAt, finalScore: score });
  }

  return res.json({
    userId,
    stepId,
    state: {
      completed:   stepState.completed,
      completedAt: stepState.completedAt,
      skipped:     stepState.skipped,
      attempts:    stepState.attempts,
    },
    stepDefinition: {
      title:           stepDef.title,
      description:     stepDef.description,
      weight:          stepDef.weight,
      estimateMinutes: stepDef.estimateMinutes,
    },
    completionScore: score,
    isFullyComplete: record.isComplete,
    completedAt:     record.completedAt,
  });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.checklistState   = checklistState;
module.exports.CHECKLIST_STEPS  = CHECKLIST_STEPS;
module.exports.calculateScore   = calculateScore;
module.exports.initChecklist    = initChecklist;
module.exports.PHI              = PHI;
module.exports.FIB              = FIB;

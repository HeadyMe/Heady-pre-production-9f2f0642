/**
 * @fileoverview HeadyOS Pilot — NPS Survey Module
 * @module pilot/feedback/nps-survey
 *
 * NPS (Net Promoter Score) survey system with:
 * - 0–10 score collection
 * - Follow-up open-text question
 * - Scheduled delivery at Fibonacci days: 8, 21, 55
 * - POST /nps/:userId endpoint for submission
 * - GET /nps/results for aggregate reporting
 *
 * φ = 1.618033988749895
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');

const router = express.Router();

/* ── Constants ──────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * NPS delivery schedule — Fibonacci days from activation.
 * Day 8  = fib(6)  — First impression
 * Day 21 = fib(8)  — Post-onboarding
 * Day 55 = fib(10) — Pre-conversion
 */
const NPS_SCHEDULE = [
  {
    surveyIndex: 0,
    dayOffset:   FIB[5],   // 8
    title:       'First Impressions',
    context:     'You\'ve been using HeadyOS for 8 days. How is it going so far?',
    followUpPromptPromoter:   'Glad you love it! What\'s been the most valuable part so far?',
    followUpPromptPassive:    'Thanks for the feedback! What would make HeadyOS a 9 or 10 for you?',
    followUpPromptDetractor:  'We\'re sorry to hear that. What\'s your biggest frustration?',
  },
  {
    surveyIndex: 1,
    dayOffset:   FIB[7],   // 21
    title:       'Mid-Pilot Check-In',
    context:     'You\'re 21 days into your pilot. How likely are you to recommend HeadyOS to a colleague?',
    followUpPromptPromoter:   'That\'s great! What feature or workflow has been most impactful?',
    followUpPromptPassive:    'Thanks! What one change would move your score higher?',
    followUpPromptDetractor:  'We value your candor. What\'s blocking you from getting more value?',
  },
  {
    surveyIndex: 2,
    dayOffset:   FIB[9],   // 55
    title:       'Pre-Conversion Survey',
    context:     'Day 55 of your Founder\'s Pilot. As you approach the end, would you recommend HeadyOS?',
    followUpPromptPromoter:   'Excellent! Are you ready to convert to a paid plan? What tier fits best?',
    followUpPromptPassive:    'Noted. What would need to change before you\'d become a paying customer?',
    followUpPromptDetractor:  'Thank you for your honesty. Let\'s schedule a call to address your concerns.',
  },
];

/* ── NPS Category Logic (φ-inspired) ───────────────────────── */

/**
 * Classify NPS score into Promoter/Passive/Detractor.
 * Standard NPS: 9–10 = Promoter, 7–8 = Passive, 0–6 = Detractor.
 * φ threshold curiosity: PHI/1+PHI ≈ 0.618 → φ maps nicely to 6.18 ≈ 6-7 border.
 */
const classifyScore = (score) => {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
};

/**
 * Compute NPS = % Promoters - % Detractors (range: -100 to +100).
 * @param {Array} scores - Array of 0–10 NPS scores
 * @returns {number} NPS score
 */
const computeNPS = (scores) => {
  if (!scores.length) return 0;
  const promoters   = scores.filter(s => s >= 9).length;
  const detractors  = scores.filter(s => s <= 6).length;
  return Math.round((promoters - detractors) / scores.length * 100);
};

/* ── In-Memory Store ─────────────────────────────────────────── */
const surveyStore = new Map(); // userId → Array<surveyResponse>

/* ── Validation Schemas ─────────────────────────────────────── */
const submitSchema = z.object({
  score:       z.number().int().min(0).max(10),
  followUp:    z.string().max(FIB[13]).optional(), // max 377 chars
  surveyIndex: z.number().int().min(0).max(2),
  dayOffset:   z.number().int().min(FIB[5]).max(FIB[9]), // 8–55
  context:     z.record(z.string()).optional(),
});

/* ── Routes ─────────────────────────────────────────────────── */

/**
 * POST /nps/:userId
 * Submit an NPS survey response.
 */
router.post('/:userId', (req, res) => {
  const { userId } = req.params;
  const result = submitSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
  }

  const { score, followUp, surveyIndex, dayOffset, context } = result.data;
  const category = classifyScore(score);
  const schedule = NPS_SCHEDULE[surveyIndex] || NPS_SCHEDULE[0];

  const response = {
    responseId:  crypto.randomUUID(),
    userId,
    surveyIndex,
    dayOffset,
    surveyTitle: schedule.title,
    score,
    category,
    followUp:    followUp || null,
    context:     context || {},
    createdAt:   new Date().toISOString(),
  };

  // Append to user's survey history
  if (!surveyStore.has(userId)) {
    surveyStore.set(userId, []);
  }
  surveyStore.get(userId).push(response);

  // Emit audit event
  const auditHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ userId, score, surveyIndex, createdAt: response.createdAt }))
    .digest('hex');

  console.log(JSON.stringify({
    level: 'info',
    eventType: 'NPS_SURVEY_SUBMITTED',
    traceId: crypto.randomUUID(),
    hash: auditHash,
    data: {
      responseId: response.responseId,
      userId,
      score,
      category,
      surveyIndex,
      dayOffset,
    },
  }));

  // Determine follow-up prompt based on category
  const followUpPrompt =
    category === 'PROMOTER' ? schedule.followUpPromptPromoter :
    category === 'PASSIVE'  ? schedule.followUpPromptPassive  :
    schedule.followUpPromptDetractor;

  // If detractor, flag for CSM follow-up
  if (category === 'DETRACTOR') {
    console.log(JSON.stringify({
      level: 'warn',
      eventType: 'NPS_DETRACTOR_FLAGGED',
      data: { userId, score, surveyIndex, requiresFollowUp: true },
    }));
  }

  // If score >= 8 (promoter), trigger conversion prompt
  if (score >= FIB[5]) { // fib(6)=8
    console.log(JSON.stringify({
      level: 'info',
      eventType: 'NPS_CONVERSION_TRIGGER',
      data: { userId, score, shouldSendUpgradePrompt: true },
    }));
  }

  return res.status(201).json({
    responseId:     response.responseId,
    category,
    score,
    followUpPrompt,
    message: category === 'PROMOTER'
      ? `Score of ${score} — you're a HeadyOS champion! We'd love to share your story.`
      : category === 'PASSIVE'
      ? `Score of ${score} — thanks for the honest feedback. Let's close the gap.`
      : `Score of ${score} — we hear you. A team member will reach out within fib(3)=2 business days.`,
    nextSurvey: NPS_SCHEDULE[surveyIndex + 1] || null,
  });
});

/**
 * GET /nps/:userId/history
 * Get all NPS responses for a user.
 */
router.get('/:userId/history', (req, res) => {
  const { userId } = req.params;
  const history = surveyStore.get(userId) || [];

  const scores = history.map(r => r.score);
  const nps = computeNPS(scores);

  return res.json({
    userId,
    history,
    aggregate: {
      npsScore:         nps,
      npsTarget:        FIB[8] + FIB[4] + 1, // 40 (pilot success metric)
      responseCount:    history.length,
      averageScore:     scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : 0,
      promoterCount:    history.filter(r => r.category === 'PROMOTER').length,
      passiveCount:     history.filter(r => r.category === 'PASSIVE').length,
      detractorCount:   history.filter(r => r.category === 'DETRACTOR').length,
    },
    schedule: NPS_SCHEDULE.map(s => ({
      surveyIndex: s.surveyIndex,
      dayOffset:   s.dayOffset,
      title:       s.title,
      completed:   history.some(r => r.surveyIndex === s.surveyIndex),
    })),
  });
});

/**
 * GET /nps/results
 * Aggregate NPS results across all pilot users (admin/internal use).
 */
router.get('/results', (req, res) => {
  const allResponses = [];
  surveyStore.forEach(responses => allResponses.push(...responses));

  if (!allResponses.length) {
    return res.json({ count: 0, npsScore: 0, breakdown: {}, byDay: {} });
  }

  const allScores = allResponses.map(r => r.score);
  const nps = computeNPS(allScores);

  // Breakdown by survey index
  const byDay = {};
  NPS_SCHEDULE.forEach(s => {
    const dayResponses = allResponses.filter(r => r.surveyIndex === s.surveyIndex);
    const dayScores = dayResponses.map(r => r.score);
    byDay[`day${s.dayOffset}`] = {
      surveyTitle: s.title,
      count:       dayResponses.length,
      npsScore:    computeNPS(dayScores),
      avgScore:    dayScores.length ? Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length * 10) / 10 : 0,
    };
  });

  return res.json({
    count:        allResponses.length,
    uniqueUsers:  surveyStore.size,
    npsScore:     nps,
    npsTarget:    FIB[8] + FIB[4] + 1, // 40
    meetsTarget:  nps >= FIB[8] + FIB[4] + 1,
    avgScore:     Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10,
    promoterPct:  Math.round(allResponses.filter(r => r.category === 'PROMOTER').length / allResponses.length * 100),
    passivePct:   Math.round(allResponses.filter(r => r.category === 'PASSIVE').length / allResponses.length * 100),
    detractorPct: Math.round(allResponses.filter(r => r.category === 'DETRACTOR').length / allResponses.length * 100),
    byDay,
  });
});

/**
 * GET /nps/prompt/:userId
 * Check if a user is due for an NPS survey (based on activation date).
 */
router.get('/prompt/:userId', (req, res) => {
  const { userId } = req.params;
  const { activationDate } = req.query;

  if (!activationDate) {
    return res.status(400).json({ error: 'activationDate query param required' });
  }

  const activation = new Date(activationDate);
  const now = new Date();
  const daysSinceActivation = Math.floor((now - activation) / (24 * 60 * 60 * 1000));

  const history = surveyStore.get(userId) || [];
  const completedIndices = new Set(history.map(r => r.surveyIndex));

  const pending = NPS_SCHEDULE.filter(s =>
    daysSinceActivation >= s.dayOffset && !completedIndices.has(s.surveyIndex)
  );

  const nextDue = pending[0] || null;

  return res.json({
    userId,
    daysSinceActivation,
    shouldPrompt: pending.length > 0,
    nextSurvey: nextDue,
    completedCount: completedIndices.size,
    totalSurveys: NPS_SCHEDULE.length,
  });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.surveyStore  = surveyStore;
module.exports.NPS_SCHEDULE = NPS_SCHEDULE;
module.exports.classifyScore = classifyScore;
module.exports.computeNPS   = computeNPS;
module.exports.PHI          = PHI;
module.exports.FIB          = FIB;

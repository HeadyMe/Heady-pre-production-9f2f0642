/**
 * @fileoverview HeadyOS Pilot — Feature Request Voting System
 * @module pilot/feedback/feature-voting
 *
 * POST /features/request    — Submit a feature request
 * POST /features/:id/vote   — Vote on a feature (up or down)
 * GET  /features/ranked     — Get features ranked by φ-weighted score
 *
 * φ = 1.618033988749895
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { z }   = require('zod');

const router = express.Router();

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/* ── Feature Categories ─────────────────────────────────────── */
const CATEGORIES = [
  'agent-orchestration',
  'mcp-tools',
  'vector-memory',
  'ui-dashboard',
  'integrations',
  'security',
  'performance',
  'documentation',
  'other',
];

/** φ-weighted category priorities (higher = more valuable to roadmap) */
const CATEGORY_WEIGHTS = {
  'agent-orchestration': PHI ** 3,  // 4.236 — core feature
  'mcp-tools':           PHI ** 2,  // 2.618
  'vector-memory':       PHI ** 2,  // 2.618
  'ui-dashboard':        PHI ** 1,  // 1.618
  'integrations':        PHI ** 1,  // 1.618
  'security':            PHI ** 2,  // 2.618
  'performance':         PHI ** 2,  // 2.618
  'documentation':       PHI ** 0,  // 1.0
  'other':               PHI ** 0,  // 1.0
};

/* ── In-Memory Store ─────────────────────────────────────────── */
const featureStore = new Map();   // featureId → feature record
const voteStore    = new Map();   // `${userId}:${featureId}` → vote record

/* ── Schemas ────────────────────────────────────────────────── */
const requestSchema = z.object({
  userId:      z.string().min(1),
  tenantId:    z.string().min(1),
  title:       z.string().min(FIB[3]).max(FIB[11]),       // 3–144 chars
  description: z.string().min(FIB[9]).max(FIB[14]),       // 34–610 chars
  category:    z.enum(CATEGORIES),
  useCase:     z.string().max(FIB[11]).optional(),         // optional use case
  priority:    z.enum(['NICE_TO_HAVE', 'IMPORTANT', 'CRITICAL']).default('IMPORTANT'),
  tags:        z.array(z.string().max(FIB[5])).max(FIB[4]).optional(), // max 5 tags, 8 chars each
});

const voteSchema = z.object({
  userId:    z.string().min(1),
  direction: z.enum(['UP', 'DOWN']).default('UP'),
  comment:   z.string().max(FIB[11]).optional(),  // optional 144-char comment
});

/* ── φ-Weighted Score Formula ───────────────────────────────── */

/**
 * Compute φ-weighted feature score.
 * Formula: (upvotes × φ - downvotes) × categoryWeight × recencyFactor
 *
 * @param {Object} feature - Feature record
 * @returns {number} Weighted score
 */
const computeScore = (feature) => {
  const now = Date.now();
  const ageMs = now - new Date(feature.createdAt).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  // Recency factor: decays by 1/φ^(ageDays/13) — half-life of ~13 days (fib(7))
  const recencyFactor = Math.pow(1 / PHI, ageDays / FIB[6]);

  // Net vote score
  const netVotes = feature.upvotes * PHI - feature.downvotes;

  // Category weight
  const categoryWeight = CATEGORY_WEIGHTS[feature.category] ?? 1;

  // Priority multiplier
  const priorityMultiplier = {
    CRITICAL:    PHI,     // 1.618
    IMPORTANT:   1,       // 1.0
    NICE_TO_HAVE: 1 / PHI, // 0.618
  }[feature.priority] ?? 1;

  return Math.max(0, netVotes * categoryWeight * priorityMultiplier * (1 + recencyFactor));
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

/* ── Routes ─────────────────────────────────────────────────── */

/**
 * POST /features/request
 * Submit a new feature request.
 */
router.post('/request', (req, res) => {
  const result = requestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
  }

  const data = result.data;
  const featureId = crypto.randomUUID();
  const now = new Date().toISOString();

  const feature = {
    featureId,
    title:        data.title,
    description:  data.description,
    category:     data.category,
    useCase:      data.useCase || null,
    priority:     data.priority,
    tags:         data.tags || [],
    submittedBy:  data.userId,
    tenantId:     data.tenantId,
    upvotes:      1,  // Author auto-upvotes
    downvotes:    0,
    commentCount: 0,
    status:       'UNDER_REVIEW',  // UNDER_REVIEW | PLANNED | IN_PROGRESS | SHIPPED | DECLINED
    statusNote:   null,
    createdAt:    now,
    updatedAt:    now,
    score:        0,  // computed below
  };

  feature.score = computeScore(feature);
  featureStore.set(featureId, feature);

  // Register author's auto-upvote
  voteStore.set(`${data.userId}:${featureId}`, {
    userId: data.userId,
    featureId,
    direction: 'UP',
    createdAt: now,
  });

  auditLog('FEATURE_REQUEST_SUBMITTED', {
    featureId,
    userId: data.userId,
    tenantId: data.tenantId,
    category: data.category,
    priority: data.priority,
    title: data.title,
  });

  return res.status(201).json({
    featureId,
    title: feature.title,
    status: feature.status,
    score: Math.round(feature.score * 100) / 100,
    upvotes: feature.upvotes,
    message: 'Feature request submitted. It\'s now open for community voting.',
    voteUrl: `/features/${featureId}/vote`,
  });
});

/**
 * POST /features/:id/vote
 * Vote on a feature request.
 */
router.post('/:id/vote', (req, res) => {
  const { id: featureId } = req.params;
  const result = voteSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: result.error.issues });
  }

  if (!featureStore.has(featureId)) {
    return res.status(404).json({ error: 'FEATURE_NOT_FOUND' });
  }

  const { userId, direction, comment } = result.data;
  const voteKey = `${userId}:${featureId}`;
  const feature = featureStore.get(featureId);

  // Check existing vote
  const existingVote = voteStore.get(voteKey);
  const now = new Date().toISOString();

  if (existingVote) {
    if (existingVote.direction === direction) {
      // Remove vote (toggle off)
      voteStore.delete(voteKey);
      if (direction === 'UP') feature.upvotes = Math.max(0, feature.upvotes - 1);
      else feature.downvotes = Math.max(0, feature.downvotes - 1);

      feature.updatedAt = now;
      feature.score = computeScore(feature);
      featureStore.set(featureId, feature);

      return res.json({
        featureId,
        action: 'VOTE_REMOVED',
        direction,
        upvotes: feature.upvotes,
        downvotes: feature.downvotes,
        score: Math.round(feature.score * 100) / 100,
      });
    } else {
      // Switch vote direction
      if (existingVote.direction === 'UP') { feature.upvotes = Math.max(0, feature.upvotes - 1); feature.downvotes++; }
      else { feature.downvotes = Math.max(0, feature.downvotes - 1); feature.upvotes++; }
    }
  } else {
    // New vote
    if (direction === 'UP') feature.upvotes++;
    else feature.downvotes++;
  }

  // Store/update vote
  voteStore.set(voteKey, { userId, featureId, direction, comment: comment || null, createdAt: now });

  feature.updatedAt = now;
  feature.score = computeScore(feature);
  featureStore.set(featureId, feature);

  auditLog('FEATURE_VOTE_CAST', {
    featureId,
    userId,
    direction,
    newUpvotes: feature.upvotes,
    newDownvotes: feature.downvotes,
    newScore: feature.score,
  });

  return res.json({
    featureId,
    action: 'VOTE_CAST',
    direction,
    upvotes: feature.upvotes,
    downvotes: feature.downvotes,
    score: Math.round(feature.score * 100) / 100,
    message: direction === 'UP' ? 'Upvoted! This helps us prioritize.' : 'Downvote recorded.',
  });
});

/**
 * GET /features/ranked
 * Get all features sorted by φ-weighted score.
 */
router.get('/ranked', (req, res) => {
  const { category, status, limit } = req.query;
  const maxResults = Math.min(parseInt(limit) || FIB[10], FIB[11]); // default 89, max 144

  let features = Array.from(featureStore.values());

  // Filter
  if (category && CATEGORIES.includes(category)) {
    features = features.filter(f => f.category === category);
  }
  if (status) {
    features = features.filter(f => f.status === status);
  }

  // Recompute scores (recency changes over time)
  features.forEach(f => {
    f.score = computeScore(f);
    featureStore.set(f.featureId, f);
  });

  // Sort by score descending
  features.sort((a, b) => b.score - a.score);

  // Fibonacci-grouped ranking tiers
  const topN = FIB[5];   // Top 8: HOT
  const midN = FIB[7];   // Next 21: RISING

  const ranked = features.slice(0, maxResults).map((f, i) => ({
    rank: i + 1,
    tier: i < topN ? 'HOT' : i < midN ? 'RISING' : 'TRACKING',
    featureId: f.featureId,
    title: f.title,
    description: f.description,
    category: f.category,
    categoryWeight: CATEGORY_WEIGHTS[f.category],
    priority: f.priority,
    status: f.status,
    statusNote: f.statusNote,
    tags: f.tags,
    upvotes: f.upvotes,
    downvotes: f.downvotes,
    netVotes: f.upvotes - f.downvotes,
    score: Math.round(f.score * 100) / 100,
    createdAt: f.createdAt,
  }));

  return res.json({
    total: features.length,
    returned: ranked.length,
    categories: CATEGORIES,
    filters: { category: category || null, status: status || null },
    ranked,
    metadata: {
      scoringFormula: 'score = (upvotes × φ - downvotes) × categoryWeight × priorityMultiplier × recencyFactor',
      phi: PHI,
      recencyHalfLifeDays: FIB[6], // 13 days
      lastRefreshed: new Date().toISOString(),
    },
  });
});

/**
 * GET /features/:id
 * Get a single feature by ID.
 */
router.get('/:id', (req, res) => {
  const feature = featureStore.get(req.params.id);
  if (!feature) return res.status(404).json({ error: 'FEATURE_NOT_FOUND' });

  feature.score = computeScore(feature);
  featureStore.set(feature.featureId, feature);

  return res.json(feature);
});

/**
 * PATCH /features/:id/status
 * Admin: update feature status.
 */
router.patch('/:id/status', (req, res) => {
  const feature = featureStore.get(req.params.id);
  if (!feature) return res.status(404).json({ error: 'FEATURE_NOT_FOUND' });

  const { status, statusNote } = req.body;
  const validStatuses = ['UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'SHIPPED', 'DECLINED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'INVALID_STATUS', validStatuses });
  }

  feature.status     = status;
  feature.statusNote = statusNote || null;
  feature.updatedAt  = new Date().toISOString();
  featureStore.set(feature.featureId, feature);

  auditLog('FEATURE_STATUS_UPDATED', {
    featureId: feature.featureId,
    newStatus: status,
    statusNote,
  });

  return res.json({ featureId: feature.featureId, status, statusNote });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.featureStore    = featureStore;
module.exports.voteStore       = voteStore;
module.exports.computeScore    = computeScore;
module.exports.CATEGORIES      = CATEGORIES;
module.exports.CATEGORY_WEIGHTS = CATEGORY_WEIGHTS;
module.exports.PHI             = PHI;
module.exports.FIB             = FIB;

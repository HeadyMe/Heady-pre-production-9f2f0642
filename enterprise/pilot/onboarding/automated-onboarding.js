/**
 * @fileoverview HeadyOS Pilot — Automated Onboarding Router
 * @module pilot/onboarding/automated-onboarding
 *
 * Express router implementing the full pilot onboarding flow.
 * All timeouts and thresholds derive from φ = 1.618033988749895.
 *
 * Routes:
 *   POST /pilot/signup           — Validate application, create account
 *   POST /pilot/provision        — Create workspace, provision resources
 *   POST /pilot/first-agent      — Create first agent from template
 *   GET  /pilot/status/:userId   — Check onboarding progress
 *   POST /pilot/confirm          — Mark onboarding complete
 */

'use strict';

const express    = require('express');
const { z }      = require('zod');
const crypto     = require('crypto');
const EventEmitter = require('events');

const router = express.Router();

/* ── φ Constants ─────────────────────────────────────────────── */
const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/** Pilot resource limits (all Fibonacci-indexed) */
const PILOT_LIMITS = {
  maxConcurrentAgents:  FIB[6],   // fib(7)=13
  apiCallsPerMinute:    FIB[11],  // fib(12)=144
  storageMB:            FIB[15],  // fib(16)=987
  vectorMemorySlots:    FIB[15],  // fib(16)=987
  teamSeats:            FIB[4],   // fib(5)=5
  pilotDays:            FIB[10],  // fib(11)=89
  graceDays:            FIB[6],   // fib(7)=13
};

/** φ-derived retry backoff (ms) */
const BACKOFF = [
  1000,
  Math.round(1000 * PHI),         // 1618
  Math.round(1000 * PHI ** 2),    // 2618
  Math.round(1000 * PHI ** 3),    // 4236
  Math.round(1000 * PHI ** 4),    // 6854
];

/* ── Onboarding Event Bus ───────────────────────────────────── */
const onboardingEvents = new EventEmitter();
onboardingEvents.setMaxListeners(FIB[11]); // fib(12)=144

/** Emit a structured audit event */
const emitAuditEvent = (eventType, data) => {
  const event = {
    eventType,
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    hash: null,
    data,
  };

  // SHA-256 chain link
  event.hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ eventType, timestamp: event.timestamp, data }))
    .digest('hex');

  onboardingEvents.emit('audit', event);
  onboardingEvents.emit(eventType, event);

  // Structured JSON log
  console.log(JSON.stringify({ level: 'info', ...event }));
};

/* ── In-Memory State Store (swap for Redis in production) ───── */
const onboardingState = new Map();

/**
 * Onboarding steps and their status flags.
 * @typedef {Object} OnboardingRecord
 */
const createOnboardingRecord = (userId, orgType) => ({
  userId,
  orgType,
  tier: 'FOUNDER',
  cohort: 1,
  steps: {
    signup:       { completed: false, completedAt: null, attempts: 0 },
    provision:    { completed: false, completedAt: null, attempts: 0 },
    firstAgent:   { completed: false, completedAt: null, attempts: 0 },
    confirmed:    { completed: false, completedAt: null, attempts: 0 },
  },
  createdAt: new Date().toISOString(),
  activationDate: null,
  expiresAt: null,
  resourceLimits: { ...PILOT_LIMITS },
  workspaceId: null,
  tenantId: null,
  emailSequenceStarted: false,
  healthScore: 0,
});

/* ── Validation Schemas ─────────────────────────────────────── */
const signupSchema = z.object({
  firstName:    z.string().min(1).max(FIB[9]),      // max fib(10)=55 chars
  lastName:     z.string().min(1).max(FIB[9]),
  email:        z.string().email(),
  orgName:      z.string().min(1).max(FIB[11]),     // max fib(12)=144 chars
  orgType:      z.enum(['nonprofit', 'startup', 'research', 'enterprise', 'government', 'other']),
  teamSize:     z.string().optional(),
  useCase:      z.string().min(1),
  description:  z.string().min(FIB[10]).max(FIB[14]), // min 89, max 610 chars
  githubUrl:    z.string().url().optional().nullable(),
  termsAccepted: z.literal(true),
  newsletter:   z.boolean().default(false),
  pilotTier:    z.literal('FOUNDER'),
  cohort:       z.literal(1),
});

const provisionSchema = z.object({
  userId:     z.string().uuid(),
  workspaceName: z.string().min(1).max(FIB[9]).optional(),
  region:     z.enum(['us-central1', 'us-east1', 'europe-west1']).default('us-central1'),
});

const firstAgentSchema = z.object({
  userId:       z.string().uuid(),
  workspaceId:  z.string().uuid(),
  agentTemplate: z.enum([
    'grant-writer',
    'document-analyzer',
    'research-synthesizer',
    'code-reviewer',
    'general-assistant',
  ]).default('grant-writer'),
  agentName: z.string().min(1).max(FIB[9]).optional(),
});

const confirmSchema = z.object({
  userId: z.string().uuid(),
});

/* ── Helper: validate request body ─────────────────────────── */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      issues: result.error.issues,
    });
  }
  req.validated = result.data;
  next();
};

/* ── Helper: simulate async provisioning ───────────────────── */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Simulate account creation in the user store.
 * In production, this calls heady-security's identity service.
 */
const createUserAccount = async (data) => {
  await sleep(FIB[4] * 100); // fib(5)*100ms = 500ms simulated latency
  const userId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  return { userId, tenantId };
};

/**
 * Simulate workspace provisioning.
 * In production, calls heady-orchestration to set up tenant workspace.
 */
const provisionWorkspace = async (userId, tenantId, region) => {
  await sleep(FIB[5] * 100); // fib(6)*100ms = 800ms
  return {
    workspaceId: crypto.randomUUID(),
    redisNamespace: `pilot:${tenantId}`,
    pgSchema: `tenant_${tenantId.replace(/-/g, '_')}`,
    vectorNamespace: `vec:${tenantId}`,
    storagePrefix: `gs://heady-pilot/${tenantId}/`,
    region,
  };
};

/**
 * Create first agent from a template.
 * In production, calls heady-conductor to instantiate agent.
 */
const createAgentFromTemplate = async (userId, workspaceId, template, name) => {
  await sleep(FIB[4] * 100); // 500ms
  const agentTemplates = {
    'grant-writer': {
      name: name || 'Grant Writer v1',
      description: 'Analyzes RFPs and drafts complete grant proposals using vector memory and MCP tools.',
      model: 'gpt-4o',
      tools: ['read-document', 'web-search', 'write-document', 'vector-recall'],
      systemPrompt: 'You are an expert grant writer. Analyze the provided RFP, retrieve relevant past grants from memory, and produce a complete, compelling grant proposal.',
      maxTokens: FIB[11] * FIB[4], // 144*5=720
      cslLevel: 'MODERATE',
    },
    'document-analyzer': {
      name: name || 'Document Analyzer v1',
      description: 'Extracts key information, summaries, and action items from documents.',
      model: 'gpt-4o-mini',
      tools: ['read-document', 'summarize', 'extract-entities'],
      systemPrompt: 'Analyze documents precisely. Extract key claims, action items, dates, and parties.',
      maxTokens: FIB[10] * FIB[4], // 89*5=445
      cslLevel: 'LOW',
    },
    'research-synthesizer': {
      name: name || 'Research Synthesizer v1',
      description: 'Synthesizes research across multiple sources into structured reports.',
      model: 'gpt-4o',
      tools: ['web-search', 'read-document', 'vector-recall', 'write-document'],
      systemPrompt: 'Synthesize research from multiple sources. Identify consensus, disagreements, and knowledge gaps.',
      maxTokens: FIB[12] * FIB[3], // 144*3=432
      cslLevel: 'MODERATE',
    },
    'code-reviewer': {
      name: name || 'Code Reviewer v1',
      description: 'Reviews code for bugs, security issues, and style compliance.',
      model: 'gpt-4o',
      tools: ['read-file', 'analyze-code', 'write-comment'],
      systemPrompt: 'Review code for correctness, security (OWASP), performance, and maintainability.',
      maxTokens: FIB[12], // 144
      cslLevel: 'LOW',
    },
    'general-assistant': {
      name: name || 'General Assistant v1',
      description: 'General-purpose AI assistant with access to all enabled MCP tools.',
      model: 'gpt-4o-mini',
      tools: ['web-search', 'read-document', 'vector-recall', 'write-document'],
      systemPrompt: 'You are a helpful, precise AI assistant. Always cite sources and acknowledge uncertainty.',
      maxTokens: FIB[11], // 144
      cslLevel: 'LOW',
    },
  };

  return {
    agentId: crypto.randomUUID(),
    workspaceId,
    userId,
    ...agentTemplates[template],
    createdAt: new Date().toISOString(),
    status: 'READY',
  };
};

/* ═══════════════════════════════════════════════════════════ */
/*  ROUTES                                                      */
/* ═══════════════════════════════════════════════════════════ */

/**
 * POST /pilot/signup
 * Step 1: Validate application and create user account.
 *
 * Body: signupSchema
 * Response: { userId, tenantId, status: 'ACCOUNT_CREATED' }
 */
router.post('/signup', validateBody(signupSchema), async (req, res) => {
  const data = req.validated;

  try {
    emitAuditEvent('PILOT_SIGNUP_INITIATED', {
      email: data.email,
      orgType: data.orgType,
      cohort: data.cohort,
    });

    // Create account
    const { userId, tenantId } = await createUserAccount(data);

    // Initialize onboarding record
    const record = createOnboardingRecord(userId, data.orgType);
    record.tenantId = tenantId;
    record.steps.signup.completed = true;
    record.steps.signup.completedAt = new Date().toISOString();
    onboardingState.set(userId, record);

    emitAuditEvent('PILOT_ACCOUNT_CREATED', {
      userId,
      tenantId,
      email: data.email,
      orgType: data.orgType,
      pilotTier: 'FOUNDER',
      cohort: 1,
      resourceLimits: PILOT_LIMITS,
    });

    return res.status(201).json({
      userId,
      tenantId,
      status: 'ACCOUNT_CREATED',
      nextStep: 'provision',
      nextStepUrl: '/pilot/provision',
      resourceLimits: PILOT_LIMITS,
      pilotDays: FIB[10],      // 89
      graceDays: FIB[6],       // 13
      message: `Account created. Proceed to workspace provisioning.`,
    });

  } catch (err) {
    emitAuditEvent('PILOT_SIGNUP_ERROR', { error: err.message });
    return res.status(500).json({ error: 'SIGNUP_FAILED', message: err.message });
  }
});

/**
 * POST /pilot/provision
 * Step 2: Create workspace and provision all Founder Tier resources.
 *
 * Body: provisionSchema
 * Response: { workspaceId, resources, status: 'PROVISIONED' }
 */
router.post('/provision', validateBody(provisionSchema), async (req, res) => {
  const { userId, workspaceName, region } = req.validated;

  const record = onboardingState.get(userId);
  if (!record) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  if (!record.steps.signup.completed) {
    return res.status(409).json({ error: 'SIGNUP_STEP_INCOMPLETE' });
  }

  record.steps.provision.attempts++;

  try {
    emitAuditEvent('PILOT_PROVISION_INITIATED', { userId, region });

    const workspace = await provisionWorkspace(userId, record.tenantId, region);
    record.workspaceId = workspace.workspaceId;

    // Calculate activation + expiry dates
    const now = new Date();
    const expiresAt = new Date(now.getTime() + FIB[10] * 24 * 60 * 60 * 1000); // +89 days
    record.activationDate = now.toISOString();
    record.expiresAt = expiresAt.toISOString();

    record.steps.provision.completed = true;
    record.steps.provision.completedAt = now.toISOString();
    onboardingState.set(userId, record);

    emitAuditEvent('PILOT_WORKSPACE_PROVISIONED', {
      userId,
      workspaceId: workspace.workspaceId,
      tenantId: record.tenantId,
      region,
      activationDate: record.activationDate,
      expiresAt: record.expiresAt,
      resourceLimits: PILOT_LIMITS,
    });

    return res.status(201).json({
      status: 'PROVISIONED',
      workspaceId: workspace.workspaceId,
      tenantId: record.tenantId,
      activationDate: record.activationDate,
      expiresAt: record.expiresAt,
      pilotDays: FIB[10],
      graceDays: FIB[6],
      resources: {
        redis: workspace.redisNamespace,
        postgres: workspace.pgSchema,
        vector: workspace.vectorNamespace,
        storage: workspace.storagePrefix,
        region,
      },
      limits: PILOT_LIMITS,
      nextStep: 'first-agent',
      nextStepUrl: '/pilot/first-agent',
    });

  } catch (err) {
    emitAuditEvent('PILOT_PROVISION_ERROR', { userId, error: err.message, attempt: record.steps.provision.attempts });

    // Retry with φ-backoff if under fib(5)=5 attempts
    if (record.steps.provision.attempts < FIB[4]) {
      const delay = BACKOFF[Math.min(record.steps.provision.attempts - 1, BACKOFF.length - 1)];
      return res.status(503).json({
        error: 'PROVISION_FAILED_RETRY',
        retryAfterMs: delay,
        attempt: record.steps.provision.attempts,
        maxAttempts: FIB[4],
      });
    }

    return res.status(500).json({ error: 'PROVISION_FAILED', message: err.message });
  }
});

/**
 * POST /pilot/first-agent
 * Step 3: Create the user's first agent from a template.
 *
 * Body: firstAgentSchema
 * Response: { agentId, agentConfig, status: 'AGENT_CREATED' }
 */
router.post('/first-agent', validateBody(firstAgentSchema), async (req, res) => {
  const { userId, workspaceId, agentTemplate, agentName } = req.validated;

  const record = onboardingState.get(userId);
  if (!record) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  if (!record.steps.provision.completed) return res.status(409).json({ error: 'PROVISION_STEP_INCOMPLETE' });

  record.steps.firstAgent.attempts++;

  try {
    emitAuditEvent('PILOT_FIRST_AGENT_INITIATED', { userId, workspaceId, agentTemplate });

    const agent = await createAgentFromTemplate(userId, workspaceId, agentTemplate, agentName);

    record.steps.firstAgent.completed = true;
    record.steps.firstAgent.completedAt = new Date().toISOString();
    onboardingState.set(userId, record);

    emitAuditEvent('PILOT_FIRST_AGENT_CREATED', {
      userId,
      workspaceId,
      agentId: agent.agentId,
      template: agentTemplate,
      model: agent.model,
    });

    return res.status(201).json({
      status: 'AGENT_CREATED',
      agentId: agent.agentId,
      agentConfig: agent,
      nextStep: 'confirm',
      nextStepUrl: '/pilot/confirm',
      message: `Your first ${agentTemplate} agent is ready. Run your first task to complete onboarding.`,
    });

  } catch (err) {
    emitAuditEvent('PILOT_FIRST_AGENT_ERROR', { userId, error: err.message });
    return res.status(500).json({ error: 'AGENT_CREATION_FAILED', message: err.message });
  }
});

/**
 * GET /pilot/status/:userId
 * Check onboarding progress for a given user.
 *
 * Response: { userId, steps, completionPercentage, nextStep }
 */
router.get('/status/:userId', (req, res) => {
  const { userId } = req.params;
  const record = onboardingState.get(userId);

  if (!record) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  const steps = record.steps;
  const completed = Object.values(steps).filter(s => s.completed).length;
  const total = Object.keys(steps).length;

  // Fibonacci-index the completion percentage
  const rawPct   = (completed / total) * 100;
  const nextStep = !steps.signup.completed ? 'signup'
    : !steps.provision.completed          ? 'provision'
    : !steps.firstAgent.completed         ? 'first-agent'
    : !steps.confirmed.completed          ? 'confirm'
    : null;

  return res.json({
    userId,
    tier: record.tier,
    cohort: record.cohort,
    steps: {
      signup:     { ...steps.signup,     stepName: 'Account Created' },
      provision:  { ...steps.provision,  stepName: 'Workspace Provisioned' },
      firstAgent: { ...steps.firstAgent, stepName: 'First Agent Created' },
      confirmed:  { ...steps.confirmed,  stepName: 'Onboarding Confirmed' },
    },
    completedSteps: completed,
    totalSteps: total,
    completionPercentage: Math.round(rawPct),
    nextStep,
    nextStepUrl: nextStep ? `/pilot/${nextStep}` : null,
    activationDate: record.activationDate,
    expiresAt: record.expiresAt,
    workspaceId: record.workspaceId,
    resourceLimits: record.resourceLimits,
    isFullyOnboarded: nextStep === null,
  });
});

/**
 * POST /pilot/confirm
 * Step 4: Mark onboarding complete and trigger welcome email sequence.
 *
 * Body: { userId }
 * Response: { status: 'ONBOARDING_COMPLETE' }
 */
router.post('/confirm', validateBody(confirmSchema), async (req, res) => {
  const { userId } = req.validated;
  const record = onboardingState.get(userId);

  if (!record) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  if (!record.steps.firstAgent.completed) return res.status(409).json({ error: 'FIRST_AGENT_STEP_INCOMPLETE' });
  if (record.steps.confirmed.completed) return res.status(409).json({ error: 'ALREADY_CONFIRMED' });

  record.steps.confirmed.completed   = true;
  record.steps.confirmed.completedAt = new Date().toISOString();
  record.emailSequenceStarted        = true;
  onboardingState.set(userId, record);

  emitAuditEvent('PILOT_ONBOARDING_COMPLETE', {
    userId,
    tenantId: record.tenantId,
    workspaceId: record.workspaceId,
    cohort: record.cohort,
    activationDate: record.activationDate,
    expiresAt: record.expiresAt,
    completedAllSteps: true,
  });

  // Trigger welcome email sequence (Day 0)
  onboardingEvents.emit('EMAIL_SEQUENCE_START', { userId, tenantId: record.tenantId });

  // Schedule NPS surveys at Fibonacci days
  const npsDays = [FIB[5], FIB[7], FIB[9]]; // 8, 21, 55
  npsDays.forEach(day => {
    onboardingEvents.emit('NPS_SCHEDULE', {
      userId,
      tenantId: record.tenantId,
      dayOffset: day,
      scheduledFor: new Date(
        new Date(record.activationDate).getTime() + day * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
  });

  return res.json({
    status: 'ONBOARDING_COMPLETE',
    userId,
    workspaceId: record.workspaceId,
    activationDate: record.activationDate,
    expiresAt: record.expiresAt,
    pilotDays: FIB[10],
    graceDays: FIB[6],
    resourceLimits: PILOT_LIMITS,
    message: `Welcome to the HeadyOS Founder's Pilot! Check your email for getting started resources.`,
    emailSequenceStarted: true,
    npsSurveyDays: npsDays,
    officeHoursDays: [FIB[6], FIB[6]*2, FIB[6]*3, FIB[6]*4, FIB[6]*5, FIB[6]*6, FIB[10]],
  });
});

/* ── Export ──────────────────────────────────────────────────── */
module.exports = router;
module.exports.onboardingEvents = onboardingEvents;
module.exports.onboardingState  = onboardingState;
module.exports.PILOT_LIMITS     = PILOT_LIMITS;
module.exports.PHI              = PHI;
module.exports.FIB              = FIB;

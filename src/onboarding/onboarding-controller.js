/**
 * @file onboarding-controller.js
 * @description Master onboarding orchestrator for HeadyBuddy.
 *   Manages the full multi-step onboarding flow for headyme.com users from
 *   first landing through companion configuration. Progress is persisted in
 *   Redis so users can resume across sessions and devices.
 *
 * @module onboarding/onboarding-controller
 * @author HeadyConnection <eric@headyconnection.org>
 * @version 1.0.0
 */

import { createClient } from 'redis';
import { EventEmitter } from 'events';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Constants & Enumerations
// ---------------------------------------------------------------------------

/**
 * All defined onboarding steps in their canonical execution order.
 * @readonly
 * @enum {string}
 */
export const Steps = Object.freeze({
  WELCOME:          'WELCOME',
  AUTH:             'AUTH',
  PERMISSIONS:      'PERMISSIONS',
  ACCOUNT_SETUP:    'ACCOUNT_SETUP',
  EMAIL_SETUP:      'EMAIL_SETUP',
  UI_CUSTOMIZATION: 'UI_CUSTOMIZATION',
  COMPANION_CONFIG: 'COMPANION_CONFIG',
  COMPLETE:         'COMPLETE',
});

/** Ordered array of steps, used to determine next/previous positions. */
export const STEP_ORDER = [
  Steps.WELCOME,
  Steps.AUTH,
  Steps.PERMISSIONS,
  Steps.ACCOUNT_SETUP,
  Steps.EMAIL_SETUP,
  Steps.UI_CUSTOMIZATION,
  Steps.COMPANION_CONFIG,
  Steps.COMPLETE,
];

/**
 * Steps that users are permitted to skip entirely.
 * @type {Set<string>}
 */
const SKIPPABLE_STEPS = new Set([
  Steps.EMAIL_SETUP,
  Steps.COMPANION_CONFIG,
]);

/**
 * Steps that require a prior step to be completed before they can begin.
 * Maps stepName → prerequisite stepName.
 * @type {Map<string, string>}
 */
const STEP_PREREQUISITES = new Map([
  [Steps.PERMISSIONS,      Steps.AUTH],
  [Steps.ACCOUNT_SETUP,    Steps.PERMISSIONS],
  [Steps.EMAIL_SETUP,      Steps.ACCOUNT_SETUP],
  [Steps.UI_CUSTOMIZATION, Steps.ACCOUNT_SETUP],
  [Steps.COMPANION_CONFIG, Steps.UI_CUSTOMIZATION],
  [Steps.COMPLETE,         Steps.COMPANION_CONFIG],
]);

/** Redis key namespace for onboarding progress records. */
const REDIS_NAMESPACE = 'heady:onboarding';

/** TTL in seconds for onboarding progress (30 days). */
const PROGRESS_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Webhook endpoint for onboarding completion events. */
const COMPLETION_WEBHOOK_URL = process.env.ONBOARDING_WEBHOOK_URL || null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current Unix timestamp in milliseconds.
 * @returns {number}
 */
const now = () => Date.now();

/**
 * Builds the Redis key for a given user's onboarding record.
 * @param {string} userId
 * @returns {string}
 */
const redisKey = (userId) => `${REDIS_NAMESPACE}:${userId}`;

/**
 * Builds the Redis key for step-level analytics events.
 * @param {string} userId
 * @param {string} stepName
 * @returns {string}
 */
const analyticsKey = (userId, stepName) =>
  `${REDIS_NAMESPACE}:analytics:${userId}:${stepName}`;

// ---------------------------------------------------------------------------
// OnboardingController
// ---------------------------------------------------------------------------

/**
 * @class OnboardingController
 * @extends EventEmitter
 *
 * @description
 * Manages the complete HeadyBuddy onboarding lifecycle for a single user
 * session or across sessions (via Redis-backed persistence). Orchestrates
 * step transitions, validation, skip logic, analytics capture, and the
 * completion webhook.
 *
 * @fires OnboardingController#step:entered
 * @fires OnboardingController#step:completed
 * @fires OnboardingController#step:skipped
 * @fires OnboardingController#onboarding:completed
 * @fires OnboardingController#onboarding:reset
 *
 * @example
 * const controller = new OnboardingController({ redis: redisClient, logger });
 * await controller.startOnboarding({ userId: 'user-123', deviceInfo });
 * await controller.advanceStep('user-123', Steps.AUTH, { provider: 'google' });
 */
export class OnboardingController extends EventEmitter {
  /**
   * @param {object}  opts
   * @param {import('redis').RedisClientType} opts.redis  - Connected Redis client
   * @param {object}  [opts.logger]                       - Pino / console compatible logger
   * @param {boolean} [opts.strictMode=false]             - Throw on invalid transitions
   * @param {Function} [opts.webhookFn]                   - Custom webhook dispatch function
   */
  constructor({ redis, logger = console, strictMode = false, webhookFn } = {}) {
    super();
    /** @private */
    this._redis = redis;
    /** @private */
    this._logger = logger;
    /** @private */
    this._strictMode = strictMode;
    /** @private */
    this._webhookFn = webhookFn || this._defaultWebhookDispatch.bind(this);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Initialises (or resumes) an onboarding session for the given user.
   * If progress already exists the user is returned to their last incomplete
   * step; otherwise a fresh record is seeded starting at WELCOME.
   *
   * @param {object}  opts
   * @param {string}  opts.userId      - Unique user identifier
   * @param {string}  [opts.sessionId] - Optional session token for analytics
   * @param {object}  [opts.deviceInfo]- UA / device information
   * @param {string}  [opts.referrer]  - Traffic referrer
   * @returns {Promise<OnboardingProgress>}
   */
  async startOnboarding({ userId, sessionId, deviceInfo = {}, referrer = null } = {}) {
    this._assertUserId(userId);

    const existing = await this._loadProgress(userId);
    if (existing && existing.status !== 'complete') {
      this._logger.info({ userId, currentStep: existing.currentStep },
        '[Onboarding] Resuming existing session');
      await this._recordAnalyticsEvent(userId, existing.currentStep, 'resume', {
        sessionId, deviceInfo,
      });
      this.emit('step:entered', { userId, step: existing.currentStep, resumed: true });
      return existing;
    }

    const progress = this._seedProgress({ userId, sessionId, deviceInfo, referrer });
    await this._saveProgress(userId, progress);

    this._logger.info({ userId }, '[Onboarding] Started new onboarding session');
    await this._recordAnalyticsEvent(userId, Steps.WELCOME, 'start', {
      sessionId, deviceInfo, referrer,
    });
    this.emit('step:entered', { userId, step: Steps.WELCOME, resumed: false });

    return progress;
  }

  /**
   * Advances the user past the given step, persisting submitted data and
   * recording analytics before moving to the next step in the sequence.
   *
   * @param {string} userId
   * @param {string} stepName      - The step being completed (use Steps enum)
   * @param {object} [stepData={}] - Form data / choices submitted for this step
   * @returns {Promise<OnboardingProgress>}
   * @throws {OnboardingError} If the step cannot be advanced at this time
   */
  async advanceStep(userId, stepName, stepData = {}) {
    this._assertUserId(userId);
    this._assertStepName(stepName);

    const progress = await this._requireProgress(userId);
    const validation = this._validateStepTransition(progress, stepName, 'complete');
    if (!validation.valid) {
      throw new OnboardingError(validation.reason, { userId, stepName });
    }

    // Record time spent on this step
    const enterTime = progress.stepTimestamps?.[stepName]?.entered || progress.updatedAt;
    const duration  = now() - enterTime;

    await this._recordAnalyticsEvent(userId, stepName, 'complete', {
      duration,
      choices: this._sanitiseStepData(stepName, stepData),
    });

    // Merge submitted data into progress record
    progress.stepData[stepName]       = stepData;
    progress.completedSteps[stepName] = true;
    progress.stepTimestamps[stepName] = {
      ...(progress.stepTimestamps[stepName] || {}),
      completed: now(),
      durationMs: duration,
    };

    // Determine next step
    const nextStep = this._resolveNextStep(progress, stepName);
    progress.currentStep = nextStep;
    progress.updatedAt   = now();

    if (nextStep !== Steps.COMPLETE) {
      progress.stepTimestamps[nextStep] = {
        ...(progress.stepTimestamps[nextStep] || {}),
        entered: now(),
      };
    }

    await this._saveProgress(userId, progress);

    this._logger.info({ userId, completedStep: stepName, nextStep },
      '[Onboarding] Step advanced');
    this.emit('step:completed', { userId, step: stepName, stepData, nextStep });
    this.emit('step:entered',   { userId, step: nextStep });

    // Auto-complete if we reached the COMPLETE sentinel
    if (nextStep === Steps.COMPLETE) {
      return this.completeOnboarding(userId);
    }

    return progress;
  }

  /**
   * Skips an optional step and moves to the next applicable step.
   *
   * @param {string} userId
   * @param {string} stepName - Step to skip (must be in SKIPPABLE_STEPS)
   * @param {string} [reason='user_declined'] - Analytics reason code
   * @returns {Promise<OnboardingProgress>}
   * @throws {OnboardingError} If the step is not skippable
   */
  async skipStep(userId, stepName, reason = 'user_declined') {
    this._assertUserId(userId);
    this._assertStepName(stepName);

    if (!SKIPPABLE_STEPS.has(stepName)) {
      throw new OnboardingError(`Step "${stepName}" cannot be skipped.`, { userId, stepName });
    }

    const progress = await this._requireProgress(userId);
    const validation = this._validateStepTransition(progress, stepName, 'skip');
    if (!validation.valid) {
      throw new OnboardingError(validation.reason, { userId, stepName });
    }

    await this._recordAnalyticsEvent(userId, stepName, 'skip', { reason });

    progress.skippedSteps[stepName]   = true;
    progress.completedSteps[stepName] = true; // treat skip as satisfied for prerequisite checks
    progress.stepTimestamps[stepName] = {
      ...(progress.stepTimestamps[stepName] || {}),
      skipped: now(),
      reason,
    };

    const nextStep      = this._resolveNextStep(progress, stepName);
    progress.currentStep = nextStep;
    progress.updatedAt   = now();

    if (nextStep !== Steps.COMPLETE) {
      progress.stepTimestamps[nextStep] = {
        ...(progress.stepTimestamps[nextStep] || {}),
        entered: now(),
      };
    }

    await this._saveProgress(userId, progress);

    this._logger.info({ userId, skippedStep: stepName, nextStep },
      '[Onboarding] Step skipped');
    this.emit('step:skipped', { userId, step: stepName, reason, nextStep });
    this.emit('step:entered',  { userId, step: nextStep });

    if (nextStep === Steps.COMPLETE) {
      return this.completeOnboarding(userId);
    }

    return progress;
  }

  /**
   * Returns the current onboarding progress record for a user.
   *
   * @param {string} userId
   * @returns {Promise<OnboardingProgress|null>}
   */
  async getProgress(userId) {
    this._assertUserId(userId);
    return this._loadProgress(userId);
  }

  /**
   * Marks onboarding as complete, fires the completion webhook, and emits
   * the `onboarding:completed` event.
   *
   * @param {string} userId
   * @returns {Promise<OnboardingProgress>}
   */
  async completeOnboarding(userId) {
    this._assertUserId(userId);

    const progress = await this._requireProgress(userId);
    if (progress.status === 'complete') {
      return progress; // idempotent
    }

    progress.status      = 'complete';
    progress.currentStep = Steps.COMPLETE;
    progress.completedAt = now();
    progress.updatedAt   = now();

    const totalDurationMs = progress.completedAt - progress.startedAt;
    progress.analytics    = {
      ...(progress.analytics || {}),
      totalDurationMs,
      completedAt: progress.completedAt,
    };

    await this._saveProgress(userId, progress);
    await this._recordAnalyticsEvent(userId, Steps.COMPLETE, 'onboarding_complete', {
      totalDurationMs,
      skippedSteps: Object.keys(progress.skippedSteps),
    });

    this._logger.info({ userId, totalDurationMs }, '[Onboarding] Onboarding complete');
    this.emit('onboarding:completed', { userId, progress });

    // Fire completion webhook (non-blocking)
    this._webhookFn({ userId, progress }).catch((err) => {
      this._logger.warn({ err, userId }, '[Onboarding] Webhook dispatch failed');
    });

    return progress;
  }

  /**
   * Resets onboarding for a user, clearing all progress. Use with caution.
   *
   * @param {string} userId
   * @param {string} [reason='manual_reset'] - Why the reset was triggered
   * @returns {Promise<void>}
   */
  async resetOnboarding(userId, reason = 'manual_reset') {
    this._assertUserId(userId);

    await this._redis.del(redisKey(userId));

    this._logger.warn({ userId, reason }, '[Onboarding] Onboarding reset');
    this.emit('onboarding:reset', { userId, reason });
  }

  // -------------------------------------------------------------------------
  // Private: Progress Helpers
  // -------------------------------------------------------------------------

  /**
   * Seeds a brand-new progress record for a user.
   * @private
   * @param {object} opts
   * @returns {OnboardingProgress}
   */
  _seedProgress({ userId, sessionId, deviceInfo, referrer }) {
    const ts = now();
    return {
      userId,
      sessionId: sessionId || crypto.randomUUID(),
      currentStep:     Steps.WELCOME,
      status:          'in_progress',
      completedSteps:  {},
      skippedSteps:    {},
      stepData:        {},
      stepTimestamps:  {
        [Steps.WELCOME]: { entered: ts },
      },
      analytics:  {},
      deviceInfo,
      referrer,
      startedAt:  ts,
      updatedAt:  ts,
      completedAt: null,
    };
  }

  /**
   * Loads a user's progress record from Redis.
   * @private
   * @param {string} userId
   * @returns {Promise<OnboardingProgress|null>}
   */
  async _loadProgress(userId) {
    const raw = await this._redis.get(redisKey(userId));
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Saves a progress record to Redis with TTL refresh.
   * @private
   * @param {string} userId
   * @param {OnboardingProgress} progress
   * @returns {Promise<void>}
   */
  async _saveProgress(userId, progress) {
    await this._redis.set(
      redisKey(userId),
      JSON.stringify(progress),
      { EX: PROGRESS_TTL_SECONDS },
    );
  }

  /**
   * Loads progress or throws if not found.
   * @private
   * @param {string} userId
   * @returns {Promise<OnboardingProgress>}
   */
  async _requireProgress(userId) {
    const progress = await this._loadProgress(userId);
    if (!progress) {
      throw new OnboardingError(
        `No onboarding session found for user "${userId}". Call startOnboarding() first.`,
        { userId },
      );
    }
    return progress;
  }

  // -------------------------------------------------------------------------
  // Private: Step Transition Logic
  // -------------------------------------------------------------------------

  /**
   * Validates whether a given step transition (complete or skip) is legal
   * given the user's current progress state.
   *
   * @private
   * @param {OnboardingProgress} progress
   * @param {string} stepName
   * @param {'complete'|'skip'} action
   * @returns {{ valid: boolean, reason?: string }}
   */
  _validateStepTransition(progress, stepName, action) {
    if (progress.status === 'complete') {
      return { valid: false, reason: 'Onboarding is already complete.' };
    }

    // Check prerequisite
    const prereq = STEP_PREREQUISITES.get(stepName);
    if (prereq && !progress.completedSteps[prereq]) {
      return {
        valid: false,
        reason: `Step "${stepName}" requires "${prereq}" to be completed first.`,
      };
    }

    // Can only work on steps at or before currentStep in the order
    const currentIdx = STEP_ORDER.indexOf(progress.currentStep);
    const targetIdx  = STEP_ORDER.indexOf(stepName);
    if (targetIdx > currentIdx + 1) {
      return {
        valid: false,
        reason: `Cannot jump to step "${stepName}" — earlier steps are pending.`,
      };
    }

    return { valid: true };
  }

  /**
   * Resolves the next step after completing or skipping `stepName`.
   * Accounts for steps that were already skipped.
   *
   * @private
   * @param {OnboardingProgress} progress
   * @param {string} completedStep
   * @returns {string} Next step name
   */
  _resolveNextStep(progress, completedStep) {
    const currentIdx = STEP_ORDER.indexOf(completedStep);
    for (let i = currentIdx + 1; i < STEP_ORDER.length; i++) {
      const candidate = STEP_ORDER[i];
      // If already skipped, keep walking forward
      if (progress.skippedSteps[candidate]) continue;
      return candidate;
    }
    return Steps.COMPLETE;
  }

  // -------------------------------------------------------------------------
  // Private: Analytics
  // -------------------------------------------------------------------------

  /**
   * Records an analytics event for a step to Redis (append to a list).
   * Each event is a JSON-serialised object with event type, timestamp,
   * and arbitrary metadata.
   *
   * @private
   * @param {string} userId
   * @param {string} stepName
   * @param {string} eventType
   * @param {object} [meta={}]
   * @returns {Promise<void>}
   */
  async _recordAnalyticsEvent(userId, stepName, eventType, meta = {}) {
    const event = {
      userId,
      stepName,
      eventType,
      timestamp: now(),
      ...meta,
    };
    const key = analyticsKey(userId, stepName);
    try {
      await this._redis.rPush(key, JSON.stringify(event));
      await this._redis.expire(key, PROGRESS_TTL_SECONDS);
    } catch (err) {
      // Analytics failures should never break the onboarding flow
      this._logger.warn({ err, userId, stepName, eventType },
        '[Onboarding] Analytics event failed to record');
    }
  }

  /**
   * Sanitises step data before storing in analytics — redacts sensitive fields.
   * @private
   * @param {string} stepName
   * @param {object} data
   * @returns {object}
   */
  _sanitiseStepData(stepName, data) {
    const redactedFields = new Set([
      'password', 'confirmPassword', 'secret', 'token',
      'privateKey', 'ssn', 'creditCard',
    ]);
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        redactedFields.has(k) ? '[REDACTED]' : v,
      ]),
    );
  }

  // -------------------------------------------------------------------------
  // Private: Webhook
  // -------------------------------------------------------------------------

  /**
   * Default webhook dispatch — POSTs the completion payload to the configured
   * ONBOARDING_WEBHOOK_URL environment variable (if set).
   *
   * @private
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async _defaultWebhookDispatch(payload) {
    if (!COMPLETION_WEBHOOK_URL) return;

    const body = JSON.stringify({
      event:     'onboarding.completed',
      timestamp: now(),
      ...payload,
    });

    const res = await fetch(COMPLETION_WEBHOOK_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Heady-Event': 'onboarding.completed',
        'X-Heady-Sig':   this._computeWebhookSignature(body),
      },
      body,
    });

    if (!res.ok) {
      this._logger.warn({ status: res.status }, '[Onboarding] Webhook returned non-2xx');
    }
  }

  /**
   * Computes an HMAC-SHA256 signature for webhook payloads.
   * @private
   * @param {string} body
   * @returns {string}
   */
  _computeWebhookSignature(body) {
    const secret = process.env.ONBOARDING_WEBHOOK_SECRET || 'heady-default-secret';
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  // -------------------------------------------------------------------------
  // Private: Assertion Helpers
  // -------------------------------------------------------------------------

  /** @private */
  _assertUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new OnboardingError('userId must be a non-empty string.');
    }
  }

  /** @private */
  _assertStepName(stepName) {
    if (!Object.values(Steps).includes(stepName)) {
      throw new OnboardingError(
        `"${stepName}" is not a valid onboarding step. Valid steps: ${STEP_ORDER.join(', ')}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// OnboardingError
// ---------------------------------------------------------------------------

/**
 * @class OnboardingError
 * @extends Error
 * @description Structured error class for all onboarding controller failures.
 */
export class OnboardingError extends Error {
  /**
   * @param {string} message
   * @param {object} [context={}] - Additional context (userId, stepName, etc.)
   */
  constructor(message, context = {}) {
    super(message);
    this.name    = 'OnboardingError';
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

/**
 * Creates and returns a fully initialised OnboardingController with a
 * connected Redis client using the REDIS_URL environment variable.
 *
 * @param {object} [opts={}] - Additional options forwarded to OnboardingController
 * @returns {Promise<OnboardingController>}
 */
export async function createOnboardingController(opts = {}) {
  const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  redis.on('error', (err) => {
    (opts.logger || console).error({ err }, '[Onboarding] Redis client error');
  });
  await redis.connect();
  return new OnboardingController({ redis, ...opts });
}

// ---------------------------------------------------------------------------
// JSDoc typedef
// ---------------------------------------------------------------------------

/**
 * @typedef {object} OnboardingProgress
 * @property {string}  userId
 * @property {string}  sessionId
 * @property {string}  currentStep        - Current step name (Steps enum value)
 * @property {string}  status             - 'in_progress' | 'complete'
 * @property {object}  completedSteps     - Map of stepName → true
 * @property {object}  skippedSteps       - Map of stepName → true
 * @property {object}  stepData           - Map of stepName → submitted form data
 * @property {object}  stepTimestamps     - Map of stepName → { entered, completed, durationMs }
 * @property {object}  analytics          - Aggregate analytics metadata
 * @property {object}  deviceInfo         - Client device / UA information
 * @property {string|null} referrer       - Traffic referrer
 * @property {number}  startedAt          - Unix ms when onboarding began
 * @property {number}  updatedAt          - Unix ms of last update
 * @property {number|null} completedAt    - Unix ms when onboarding completed
 */

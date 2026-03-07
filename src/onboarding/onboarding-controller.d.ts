/**
 * Creates and returns a fully initialised OnboardingController with a
 * connected Redis client using the REDIS_URL environment variable.
 *
 * @param {object} [opts={}] - Additional options forwarded to OnboardingController
 * @returns {Promise<OnboardingController>}
 */
export function createOnboardingController(opts?: object): Promise<OnboardingController>;
/**
 * All defined onboarding steps in their canonical execution order.
 */
export type Steps = string;
/**
 * All defined onboarding steps in their canonical execution order.
 * @readonly
 * @enum {string}
 */
export const Steps: Readonly<{
    WELCOME: "WELCOME";
    AUTH: "AUTH";
    PERMISSIONS: "PERMISSIONS";
    ACCOUNT_SETUP: "ACCOUNT_SETUP";
    EMAIL_SETUP: "EMAIL_SETUP";
    UI_CUSTOMIZATION: "UI_CUSTOMIZATION";
    COMPANION_CONFIG: "COMPANION_CONFIG";
    COMPLETE: "COMPLETE";
}>;
/** Ordered array of steps, used to determine next/previous positions. */
export const STEP_ORDER: ("AUTH" | "WELCOME" | "PERMISSIONS" | "ACCOUNT_SETUP" | "EMAIL_SETUP" | "UI_CUSTOMIZATION" | "COMPANION_CONFIG" | "COMPLETE")[];
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
export class OnboardingController extends EventEmitter<[never]> {
    /**
     * @param {object}  opts
     * @param {import('redis').RedisClientType} opts.redis  - Connected Redis client
     * @param {object}  [opts.logger]                       - Pino / console compatible logger
     * @param {boolean} [opts.strictMode=false]             - Throw on invalid transitions
     * @param {Function} [opts.webhookFn]                   - Custom webhook dispatch function
     */
    constructor({ redis, logger, strictMode, webhookFn }?: {
        redis: import("redis").RedisClientType;
        logger?: object | undefined;
        strictMode?: boolean | undefined;
        webhookFn?: Function | undefined;
    });
    /** @private */
    private _redis;
    /** @private */
    private _logger;
    /** @private */
    private _strictMode;
    /** @private */
    private _webhookFn;
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
    startOnboarding({ userId, sessionId, deviceInfo, referrer }?: {
        userId: string;
        sessionId?: string | undefined;
        deviceInfo?: object | undefined;
        referrer?: string | undefined;
    }): Promise<OnboardingProgress>;
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
    advanceStep(userId: string, stepName: string, stepData?: object): Promise<OnboardingProgress>;
    /**
     * Skips an optional step and moves to the next applicable step.
     *
     * @param {string} userId
     * @param {string} stepName - Step to skip (must be in SKIPPABLE_STEPS)
     * @param {string} [reason='user_declined'] - Analytics reason code
     * @returns {Promise<OnboardingProgress>}
     * @throws {OnboardingError} If the step is not skippable
     */
    skipStep(userId: string, stepName: string, reason?: string): Promise<OnboardingProgress>;
    /**
     * Returns the current onboarding progress record for a user.
     *
     * @param {string} userId
     * @returns {Promise<OnboardingProgress|null>}
     */
    getProgress(userId: string): Promise<OnboardingProgress | null>;
    /**
     * Marks onboarding as complete, fires the completion webhook, and emits
     * the `onboarding:completed` event.
     *
     * @param {string} userId
     * @returns {Promise<OnboardingProgress>}
     */
    completeOnboarding(userId: string): Promise<OnboardingProgress>;
    /**
     * Resets onboarding for a user, clearing all progress. Use with caution.
     *
     * @param {string} userId
     * @param {string} [reason='manual_reset'] - Why the reset was triggered
     * @returns {Promise<void>}
     */
    resetOnboarding(userId: string, reason?: string): Promise<void>;
    /**
     * Seeds a brand-new progress record for a user.
     * @private
     * @param {object} opts
     * @returns {OnboardingProgress}
     */
    private _seedProgress;
    /**
     * Loads a user's progress record from Redis.
     * @private
     * @param {string} userId
     * @returns {Promise<OnboardingProgress|null>}
     */
    private _loadProgress;
    /**
     * Saves a progress record to Redis with TTL refresh.
     * @private
     * @param {string} userId
     * @param {OnboardingProgress} progress
     * @returns {Promise<void>}
     */
    private _saveProgress;
    /**
     * Loads progress or throws if not found.
     * @private
     * @param {string} userId
     * @returns {Promise<OnboardingProgress>}
     */
    private _requireProgress;
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
    private _validateStepTransition;
    /**
     * Resolves the next step after completing or skipping `stepName`.
     * Accounts for steps that were already skipped.
     *
     * @private
     * @param {OnboardingProgress} progress
     * @param {string} completedStep
     * @returns {string} Next step name
     */
    private _resolveNextStep;
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
    private _recordAnalyticsEvent;
    /**
     * Sanitises step data before storing in analytics — redacts sensitive fields.
     * @private
     * @param {string} stepName
     * @param {object} data
     * @returns {object}
     */
    private _sanitiseStepData;
    /**
     * Default webhook dispatch — POSTs the completion payload to the configured
     * ONBOARDING_WEBHOOK_URL environment variable (if set).
     *
     * @private
     * @param {object} payload
     * @returns {Promise<void>}
     */
    private _defaultWebhookDispatch;
    /**
     * Computes an HMAC-SHA256 signature for webhook payloads.
     * @private
     * @param {string} body
     * @returns {string}
     */
    private _computeWebhookSignature;
    /** @private */
    private _assertUserId;
    /** @private */
    private _assertStepName;
}
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
    constructor(message: string, context?: object);
    context: object;
}
export type OnboardingProgress = {
    userId: string;
    sessionId: string;
    /**
     * - Current step name (Steps enum value)
     */
    currentStep: string;
    /**
     * - 'in_progress' | 'complete'
     */
    status: string;
    /**
     * - Map of stepName → true
     */
    completedSteps: object;
    /**
     * - Map of stepName → true
     */
    skippedSteps: object;
    /**
     * - Map of stepName → submitted form data
     */
    stepData: object;
    /**
     * - Map of stepName → { entered, completed, durationMs }
     */
    stepTimestamps: object;
    /**
     * - Aggregate analytics metadata
     */
    analytics: object;
    /**
     * - Client device / UA information
     */
    deviceInfo: object;
    /**
     * - Traffic referrer
     */
    referrer: string | null;
    /**
     * - Unix ms when onboarding began
     */
    startedAt: number;
    /**
     * - Unix ms of last update
     */
    updatedAt: number;
    /**
     * - Unix ms when onboarding completed
     */
    completedAt: number | null;
};
import { EventEmitter } from 'events';
//# sourceMappingURL=onboarding-controller.d.ts.map
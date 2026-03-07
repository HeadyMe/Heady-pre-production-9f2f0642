/**
 * @file onboarding-routes.js
 * @description Express router providing all HTTP endpoints for the HeadyBuddy
 *   onboarding flow at headyme.com. Each route validates JWT auth, delegates
 *   to OnboardingController, and returns consistent JSON responses.
 *
 * @module onboarding/onboarding-routes
 * @author HeadyConnection <eric@headyconnection.org>
 * @version 1.0.0
 */

import { Router }                 from 'express';
import { Steps, STEP_ORDER }      from './onboarding-controller.js';
import { UIProjectionEngine }     from './ui-projection-engine.js';
import { HEADYBEE_TEMPLATES }     from './headybee-ui-templates.js';
import { OnboardingError }        from './onboarding-controller.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTP status codes used across all routes. */
const HTTP = Object.freeze({
  OK:            200,
  CREATED:       201,
  BAD_REQUEST:   400,
  UNAUTHORIZED:  401,
  FORBIDDEN:     403,
  NOT_FOUND:     404,
  CONFLICT:      409,
  UNPROCESSABLE: 422,
  SERVER_ERROR:  500,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an async route handler, forwarding thrown errors to Express's `next`.
 *
 * @param {Function} fn - Async route handler (req, res, next)
 * @returns {Function}
 */
const asyncRoute = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Builds a standardised JSON success envelope.
 *
 * @param {*}      data
 * @param {string} [message]
 * @returns {object}
 */
const success = (data, message) => ({
  success: true,
  message: message || null,
  data,
  timestamp: Date.now(),
});

/**
 * Builds a standardised JSON error envelope.
 *
 * @param {string} error
 * @param {*}      [details]
 * @returns {object}
 */
const failure = (error, details) => ({
  success:   false,
  error,
  details:   details || null,
  timestamp: Date.now(),
});

/**
 * Extracts the authenticated user ID from `req.user` (set by upstream JWT
 * middleware). Falls back to a header for internal service calls.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractUserId = (req) =>
  req.user?.id || req.user?.sub || req.headers['x-heady-user-id'] || null;

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns the onboarding Express Router.
 *
 * @param {object} deps
 * @param {import('./onboarding-controller.js').OnboardingController} deps.controller
 * @param {UIProjectionEngine} deps.projectionEngine
 * @param {object} [deps.logger] - Pino / console compatible logger
 * @returns {import('express').Router}
 */
export function createOnboardingRouter({ controller, projectionEngine, logger = console }) {
  const router = Router();

  // -------------------------------------------------------------------------
  // Auth guard middleware — all /onboarding routes require a valid session
  // except /start and /templates (which can be browsed pre-auth).
  // -------------------------------------------------------------------------

  /**
   * Lightweight JWT-presence guard. Full JWT verification is handled by the
   * global auth middleware upstream; here we only confirm the user object
   * was successfully attached.
   */
  const requireAuth = (req, res, next) => {
    // /start and /templates are accessible to unauthenticated visitors
    const publicPaths = ['/start', '/templates'];
    const isPublic    = publicPaths.some((p) => req.path.startsWith(p));
    if (isPublic) return next();

    const userId = extractUserId(req);
    if (!userId) {
      return res.status(HTTP.UNAUTHORIZED).json(
        failure('Authentication required. Please sign in to continue.'),
      );
    }
    next();
  };

  router.use(requireAuth);

  // =========================================================================
  // GET /onboarding/start
  // =========================================================================

  /**
   * @route GET /onboarding/start
   * @summary Begin or resume an onboarding session.
   * @description
   *   For unauthenticated visitors returns the welcome payload.
   *   For authenticated users, initialises or resumes their onboarding
   *   session and returns current progress + next-step instructions.
   *
   * @queryparam {string} [referrer] - Traffic referrer for analytics
   */
  router.get('/start', asyncRoute(async (req, res) => {
    const userId     = extractUserId(req);
    const deviceInfo = parseDeviceInfo(req);
    const referrer   = req.query.referrer || req.headers.referer || null;

    if (!userId) {
      // Unauthenticated: return welcome screen data only
      return res.json(success({
        step:       Steps.WELCOME,
        message:    'Welcome to HeadyBuddy! Please sign in or create an account.',
        authMethods: ['oauth_google', 'oauth_github', 'email_password'],
        headybuddyIntro: buildHeadyBuddyIntro(),
      }, 'Welcome to headyme.com'));
    }

    const progress = await controller.startOnboarding({ userId, deviceInfo, referrer });

    res.json(success({
      progress,
      currentStep: progress.currentStep,
      nextAction:  buildNextAction(progress),
    }, progress.status === 'complete'
      ? 'Onboarding already complete!'
      : `Resuming at step: ${progress.currentStep}`));
  }));

  // =========================================================================
  // GET /onboarding/progress
  // =========================================================================

  /**
   * @route GET /onboarding/progress
   * @summary Retrieve current onboarding progress for the authenticated user.
   */
  router.get('/progress', asyncRoute(async (req, res) => {
    const userId   = extractUserId(req);
    const progress = await controller.getProgress(userId);

    if (!progress) {
      return res.status(HTTP.NOT_FOUND).json(
        failure('No onboarding session found. Call /start first.'),
      );
    }

    res.json(success({
      progress,
      percentComplete: computePercentComplete(progress),
      nextAction:      buildNextAction(progress),
    }));
  }));

  // =========================================================================
  // POST /onboarding/step/:stepName
  // =========================================================================

  /**
   * @route POST /onboarding/step/:stepName
   * @summary Submit data for a specific onboarding step and advance to next.
   *
   * @pathparam {string} stepName - One of the Steps enum values
   * @body {object} Arbitrary step-specific payload (validated per step)
   */
  router.post('/step/:stepName', asyncRoute(async (req, res) => {
    const userId   = extractUserId(req);
    const stepName = req.params.stepName?.toUpperCase();
    const stepData = req.body || {};

    if (!Object.values(Steps).includes(stepName)) {
      return res.status(HTTP.BAD_REQUEST).json(
        failure(`Unknown step "${req.params.stepName}".`),
      );
    }

    const stepValidation = validateStepPayload(stepName, stepData);
    if (!stepValidation.valid) {
      return res.status(HTTP.UNPROCESSABLE).json(
        failure('Step data validation failed.', stepValidation.errors),
      );
    }

    const progress = await controller.advanceStep(userId, stepName, stepData);

    res.json(success({
      progress,
      completedStep: stepName,
      nextStep:      progress.currentStep,
      nextAction:    buildNextAction(progress),
    }, `Step "${stepName}" completed successfully.`));
  }));

  // =========================================================================
  // POST /onboarding/skip/:stepName
  // =========================================================================

  /**
   * @route POST /onboarding/skip/:stepName
   * @summary Skip an optional onboarding step.
   *
   * @pathparam {string} stepName
   * @body {string} [reason] - Optional reason code for analytics
   */
  router.post('/skip/:stepName', asyncRoute(async (req, res) => {
    const userId   = extractUserId(req);
    const stepName = req.params.stepName?.toUpperCase();
    const reason   = req.body?.reason || 'user_declined';

    if (!Object.values(Steps).includes(stepName)) {
      return res.status(HTTP.BAD_REQUEST).json(
        failure(`Unknown step "${req.params.stepName}".`),
      );
    }

    const progress = await controller.skipStep(userId, stepName, reason);

    res.json(success({
      progress,
      skippedStep: stepName,
      nextStep:    progress.currentStep,
      nextAction:  buildNextAction(progress),
    }, `Step "${stepName}" skipped.`));
  }));

  // =========================================================================
  // POST /onboarding/permissions
  // =========================================================================

  /**
   * @route POST /onboarding/permissions
   * @summary Submit filesystem / service permission grants.
   *
   * @body {object} permissions
   * @body {string[]} [permissions.filesystem]  - Array of allowed filesystem paths
   * @body {string[]} [permissions.integrations] - Approved service integrations
   * @body {boolean}  [permissions.cloudStorage] - Allow cloud storage access
   * @body {string}   [permissions.scope]        - 'full' | 'restricted' | 'custom'
   */
  router.post('/permissions', asyncRoute(async (req, res) => {
    const userId = extractUserId(req);
    const {
      filesystem    = [],
      integrations  = [],
      cloudStorage  = false,
      scope         = 'restricted',
    } = req.body || {};

    const permissionsPayload = {
      filesystem:   filesystem.map(normalisePath),
      integrations,
      cloudStorage,
      scope,
      grantedAt:    Date.now(),
    };

    const progress = await controller.advanceStep(
      userId, Steps.PERMISSIONS, permissionsPayload,
    );

    res.status(HTTP.CREATED).json(success({
      progress,
      permissions: permissionsPayload,
      nextStep:    progress.currentStep,
    }, 'Permissions saved successfully.'));
  }));

  // =========================================================================
  // POST /onboarding/account
  // =========================================================================

  /**
   * @route POST /onboarding/account
   * @summary Create {username}@headyme.com account.
   *
   * @body {string} username       - Desired username (alphanumeric + hyphen, 3-24 chars)
   * @body {string} displayName    - Publicly visible display name
   * @body {string} [timezone]     - IANA timezone string
   * @body {string} [language]     - BCP-47 language tag
   * @body {string} [tier]         - Subscription tier (free | pro | enterprise)
   */
  router.post('/account', asyncRoute(async (req, res) => {
    const userId = extractUserId(req);
    const {
      username,
      displayName,
      timezone  = 'UTC',
      language  = 'en',
      tier      = 'free',
    } = req.body || {};

    // Validate username
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(HTTP.UNPROCESSABLE).json(failure(usernameError));
    }

    const accountPayload = {
      username:    username.toLowerCase().trim(),
      email:       `${username.toLowerCase().trim()}@headyme.com`,
      displayName: displayName?.trim() || username,
      timezone,
      language,
      tier,
      createdAt:   Date.now(),
    };

    const progress = await controller.advanceStep(
      userId, Steps.ACCOUNT_SETUP, accountPayload,
    );

    res.status(HTTP.CREATED).json(success({
      progress,
      account:  accountPayload,
      nextStep: progress.currentStep,
    }, `Account ${accountPayload.email} created successfully.`));
  }));

  // =========================================================================
  // POST /onboarding/email-setup
  // =========================================================================

  /**
   * @route POST /onboarding/email-setup
   * @summary Opt into secure headyme.com email provisioning.
   *
   * @body {boolean} [enable=true]       - Whether to activate the email address
   * @body {string}  [forwardTo]         - Optional external address to forward to
   * @body {boolean} [encryptionEnabled] - Enable end-to-end encryption (ProtonMail-style)
   * @body {string}  [signatureHtml]     - HTML email signature
   */
  router.post('/email-setup', asyncRoute(async (req, res) => {
    const userId = extractUserId(req);
    const {
      enable            = true,
      forwardTo         = null,
      encryptionEnabled = true,
      signatureHtml     = '',
    } = req.body || {};

    const emailPayload = {
      enable,
      forwardTo,
      encryptionEnabled,
      signatureHtml,
      configuredAt: Date.now(),
    };

    const progress = await controller.advanceStep(
      userId, Steps.EMAIL_SETUP, emailPayload,
    );

    res.json(success({
      progress,
      emailConfig: emailPayload,
      nextStep:    progress.currentStep,
    }, enable ? 'Secure email setup complete.' : 'Email setup declined.'));
  }));

  // =========================================================================
  // POST /onboarding/ui-config
  // =========================================================================

  /**
   * @route POST /onboarding/ui-config
   * @summary Save UI customisation preferences and generate an initial projection.
   *
   * @body {string}  [templateId]   - Selected HeadyBee template ID
   * @body {string}  [theme]        - 'dark' | 'light' | 'auto'
   * @body {string}  [density]      - 'comfortable' | 'compact' | 'spacious'
   * @body {boolean} [reducedMotion]
   * @body {boolean} [highContrast]
   * @body {string}  [colorAccent]  - Hex color override
   */
  router.post('/ui-config', asyncRoute(async (req, res) => {
    const userId = extractUserId(req);
    const {
      templateId    = 'heady-onboarding-lite',
      theme         = 'dark',
      density       = 'comfortable',
      reducedMotion = false,
      highContrast  = false,
      colorAccent   = null,
    } = req.body || {};

    const deviceInfo = parseDeviceInfo(req);

    const uiConfig = {
      templateId,
      theme,
      density,
      reducedMotion,
      highContrast,
      colorAccent,
      deviceType: deviceInfo.deviceType,
      savedAt:    Date.now(),
    };

    // Generate the initial projection for the chosen template
    const projection = await projectionEngine.generateProjection({
      userId,
      templateId,
      deviceInfo,
      preferences: uiConfig,
    });

    const progress = await controller.advanceStep(
      userId, Steps.UI_CUSTOMIZATION, { uiConfig, projection },
    );

    res.json(success({
      progress,
      uiConfig,
      projection,
      nextStep: progress.currentStep,
    }, 'UI configuration saved and projection generated.'));
  }));

  // =========================================================================
  // POST /onboarding/companion
  // =========================================================================

  /**
   * @route POST /onboarding/companion
   * @summary Configure HeadyBuddy companion personality and preferences.
   *
   * @body {string}  [name]           - Custom name for the companion instance
   * @body {string}  [persona]        - 'professional' | 'casual' | 'technical' | 'creative'
   * @body {string}  [voice]          - TTS voice preference
   * @body {boolean} [proactiveMode]  - Allow companion to proactively offer suggestions
   * @body {string[]} [capabilities]  - Enabled capability modules
   * @body {object}  [memorySettings] - Memory retention preferences
   */
  router.post('/companion', asyncRoute(async (req, res) => {
    const userId = extractUserId(req);
    const {
      name           = 'HeadyBuddy',
      persona        = 'professional',
      voice          = 'sage',
      proactiveMode  = true,
      capabilities   = ['research', 'code', 'creative', 'data'],
      memorySettings = { retentionDays: 30, contextWindow: 50 },
    } = req.body || {};

    const companionConfig = {
      name,
      persona,
      voice,
      proactiveMode,
      capabilities,
      memorySettings,
      configuredAt: Date.now(),
    };

    const progress = await controller.advanceStep(
      userId, Steps.COMPANION_CONFIG, companionConfig,
    );

    res.json(success({
      progress,
      companionConfig,
      nextStep: progress.currentStep,
    }, `HeadyBuddy companion "${name}" configured successfully.`));
  }));

  // =========================================================================
  // POST /onboarding/complete
  // =========================================================================

  /**
   * @route POST /onboarding/complete
   * @summary Finalise the onboarding flow and trigger completion hooks.
   */
  router.post('/complete', asyncRoute(async (req, res) => {
    const userId   = extractUserId(req);
    const progress = await controller.completeOnboarding(userId);

    res.json(success({
      progress,
      dashboardUrl: '/dashboard',
      message:      'Welcome to HeadyBuddy! Your workspace is ready.',
    }, 'Onboarding complete!'));
  }));

  // =========================================================================
  // GET /onboarding/templates
  // =========================================================================

  /**
   * @route GET /onboarding/templates
   * @summary List all available HeadyBee / HeadySwarm UI templates.
   *
   * @queryparam {string} [category]  - Filter by template category
   * @queryparam {string} [tier]      - Filter by recommended tier
   * @queryparam {string} [role]      - Filter by recommended role
   */
  router.get('/templates', asyncRoute(async (req, res) => {
    const { category, tier, role } = req.query;

    let templates = Object.values(HEADYBEE_TEMPLATES);

    if (category) {
      templates = templates.filter((t) =>
        t.category?.toLowerCase() === category.toLowerCase());
    }
    if (tier) {
      templates = templates.filter((t) =>
        t.recommendedTiers?.includes(tier.toLowerCase()));
    }
    if (role) {
      templates = templates.filter((t) =>
        t.recommendedRoles?.includes(role.toLowerCase()));
    }

    // Return summary view (no internal config blobs)
    const summaries = templates.map((t) => ({
      id:                t.id,
      name:              t.name,
      description:       t.description,
      category:          t.category,
      thumbnailUrl:      t.thumbnailUrl || `/assets/templates/${t.id}.png`,
      recommendedRoles:  t.recommendedRoles,
      recommendedTiers:  t.recommendedTiers,
      sacredGeometryScore: t.sacredGeometryScore,
      widgetCount:       t.widgetLayout?.widgets?.length || 0,
      swarmId:           t.headySwarmConfig?.swarmId,
    }));

    res.json(success({ templates: summaries, total: summaries.length }));
  }));

  // =========================================================================
  // GET /onboarding/templates/:templateId/preview
  // =========================================================================

  /**
   * @route GET /onboarding/templates/:templateId/preview
   * @summary Return the full template definition and a generated preview
   *   projection for the requesting user's device.
   *
   * @pathparam {string} templateId
   */
  router.get('/templates/:templateId/preview', asyncRoute(async (req, res) => {
    const { templateId } = req.params;
    const template       = HEADYBEE_TEMPLATES[templateId];

    if (!template) {
      return res.status(HTTP.NOT_FOUND).json(
        failure(`Template "${templateId}" not found.`),
      );
    }

    const userId     = extractUserId(req);
    const deviceInfo = parseDeviceInfo(req);

    const projection = await projectionEngine.generateProjection({
      userId: userId || 'preview',
      templateId,
      deviceInfo,
      preferences: { theme: 'dark' },
      previewMode:  true,
    });

    res.json(success({
      template,
      projection,
      previewMode: true,
    }));
  }));

  // =========================================================================
  // Error handler (scoped to this router)
  // =========================================================================

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, _next) => {
    logger.error({ err, path: req.path }, '[OnboardingRoutes] Unhandled error');

    if (err instanceof OnboardingError) {
      return res.status(HTTP.UNPROCESSABLE).json(
        failure(err.message, err.context),
      );
    }

    res.status(HTTP.SERVER_ERROR).json(
      failure('An internal error occurred. Please try again.'),
    );
  });

  return router;
}

// ---------------------------------------------------------------------------
// Internal Utility Functions
// ---------------------------------------------------------------------------

/**
 * Builds the HeadyBuddy welcome introduction payload for the WELCOME step.
 * @returns {object}
 */
function buildHeadyBuddyIntro() {
  return {
    greeting:    'Hi! I\'m HeadyBuddy, your intelligent workspace companion.',
    description: 'I\'ll help you set up your personalised headyme.com workspace — ' +
                 'AI tools, secure communication, and a UI tuned exactly to how you work.',
    features: [
      { icon: 'brain',     label: 'AI-Powered',    description: 'Multi-LLM routing via HeadyBee workers' },
      { icon: 'lock',      label: 'Secure Email',   description: 'End-to-end encrypted @headyme.com address' },
      { icon: 'layout',    label: 'Custom UI',      description: 'Sacred-Geometry-optimised dashboard layouts' },
      { icon: 'zap',       label: 'HeadySwarm',     description: 'Fibonacci-allocated worker swarms for peak performance' },
      { icon: 'heart',     label: 'Open Source',    description: 'Built on HeadyConnection nonprofit values' },
    ],
    estimatedMinutes: 3,
  };
}

/**
 * Builds a next-action descriptor from the current progress state.
 * @param {import('./onboarding-controller.js').OnboardingProgress} progress
 * @returns {object}
 */
function buildNextAction(progress) {
  const stepMeta = {
    [Steps.WELCOME]: {
      title:  'Welcome to HeadyBuddy',
      action: 'Learn about HeadyBuddy and continue to sign-in',
      route:  '/onboarding/start',
    },
    [Steps.AUTH]: {
      title:  'Sign In or Register',
      action: 'Authenticate with OAuth or create an email/password account',
      route:  '/auth/login',
    },
    [Steps.PERMISSIONS]: {
      title:  'Configure Permissions',
      action: 'Choose which files and services HeadyBuddy can access',
      route:  '/onboarding/permissions',
    },
    [Steps.ACCOUNT_SETUP]: {
      title:  'Create Your Account',
      action: 'Choose your @headyme.com username',
      route:  '/onboarding/account',
    },
    [Steps.EMAIL_SETUP]: {
      title:  'Set Up Secure Email',
      action: 'Activate your encrypted @headyme.com mailbox (optional)',
      route:  '/onboarding/email-setup',
    },
    [Steps.UI_CUSTOMIZATION]: {
      title:  'Customise Your Workspace',
      action: 'Pick a dashboard template and colour theme',
      route:  '/onboarding/ui-config',
    },
    [Steps.COMPANION_CONFIG]: {
      title:  'Configure HeadyBuddy',
      action: 'Personalise your AI companion (optional)',
      route:  '/onboarding/companion',
    },
    [Steps.COMPLETE]: {
      title:  'All Set!',
      action: 'Go to your dashboard',
      route:  '/dashboard',
    },
  };

  return {
    step:            progress.currentStep,
    percentComplete: computePercentComplete(progress),
    ...(stepMeta[progress.currentStep] || {}),
  };
}

/**
 * Computes the overall onboarding completion percentage (0–100).
 * @param {import('./onboarding-controller.js').OnboardingProgress} progress
 * @returns {number}
 */
function computePercentComplete(progress) {
  if (progress.status === 'complete') return 100;
  const totalSteps     = STEP_ORDER.length - 1; // exclude COMPLETE itself
  const completedCount = Object.keys(progress.completedSteps || {}).length;
  return Math.round((completedCount / totalSteps) * 100);
}

/**
 * Per-step payload validation rules.
 *
 * @param {string} stepName
 * @param {object} data
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateStepPayload(stepName, data) {
  const errors = [];

  switch (stepName) {
    case Steps.AUTH: {
      if (!data.provider && !data.email) {
        errors.push('Either "provider" (OAuth) or "email" is required.');
      }
      break;
    }
    case Steps.PERMISSIONS: {
      if (data.scope && !['full', 'restricted', 'custom'].includes(data.scope)) {
        errors.push('"scope" must be one of: full, restricted, custom.');
      }
      break;
    }
    case Steps.ACCOUNT_SETUP: {
      const usernameErr = validateUsername(data.username);
      if (usernameErr) errors.push(usernameErr);
      break;
    }
    case Steps.UI_CUSTOMIZATION: {
      if (data.theme && !['dark', 'light', 'auto'].includes(data.theme)) {
        errors.push('"theme" must be one of: dark, light, auto.');
      }
      break;
    }
    default:
      break;
  }

  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validates a proposed @headyme.com username.
 * @param {string} username
 * @returns {string|null} Error message or null if valid
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return '"username" is required.';
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3)  return 'Username must be at least 3 characters.';
  if (trimmed.length > 24) return 'Username must be 24 characters or fewer.';
  if (!/^[a-z0-9][a-z0-9-_]*[a-z0-9]$/.test(trimmed)) {
    return 'Username may only contain letters, numbers, hyphens, and underscores, ' +
           'and must start and end with a letter or number.';
  }
  const reserved = new Set(['admin', 'root', 'heady', 'headybuddy', 'support',
                             'noreply', 'postmaster', 'abuse', 'security']);
  if (reserved.has(trimmed)) return `"${trimmed}" is a reserved username.`;
  return null;
}

/**
 * Normalises a filesystem path for storage.
 * @param {string} p
 * @returns {string}
 */
function normalisePath(p) {
  if (typeof p !== 'string') return '';
  // Strip trailing slashes, resolve simple ../ sequences defensively
  return p.replace(/\/+$/, '').replace(/\.\./g, '').replace(/\/\//g, '/') || '/';
}

/**
 * Parses device / UA info from the incoming Express request.
 * @param {import('express').Request} req
 * @returns {object}
 */
function parseDeviceInfo(req) {
  const ua         = req.headers['user-agent'] || '';
  const isMobile   = /Mobile|Android|iPhone|iPad/i.test(ua);
  const isTablet   = /iPad|Tablet/i.test(ua);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  return {
    userAgent:   ua,
    deviceType,
    ip:          req.ip || req.headers['x-forwarded-for'] || null,
    acceptLang:  req.headers['accept-language'] || 'en',
    screenWidth:  parseInt(req.headers['x-screen-width']  || '0', 10) || null,
    screenHeight: parseInt(req.headers['x-screen-height'] || '0', 10) || null,
  };
}

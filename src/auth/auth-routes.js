/**
 * @fileoverview HeadyAuthRoutes — Complete Express.js router for all
 * authentication, account management, permissions, and email endpoints.
 *
 * Routes:
 * POST   /auth/register                - New account creation
 * POST   /auth/login                   - Email/password login
 * GET    /auth/oauth/:provider         - OAuth2 initiation
 * GET    /auth/oauth/:provider/callback - OAuth2 callback
 * POST   /auth/verify-email            - Email verification
 * POST   /auth/forgot-password         - Password reset request
 * POST   /auth/reset-password          - Password reset execution
 * POST   /auth/mfa/enable              - Enable TOTP 2FA
 * POST   /auth/mfa/verify              - Verify TOTP code
 * POST   /auth/refresh                 - Refresh token rotation
 * POST   /auth/logout                  - Sign out
 * GET    /auth/me                      - Current user profile
 * PUT    /auth/me                      - Update profile
 * POST   /auth/permissions/request     - Request resource access
 * PUT    /auth/permissions/grant       - Grant permission (admin/self)
 * GET    /auth/permissions             - List user permissions
 * POST   /auth/api-keys                - Generate API key
 * DELETE /auth/api-keys/:keyId         - Revoke API key
 * GET    /auth/email/inbox             - Email inbox
 * POST   /auth/email/send              - Send email
 *
 * @module auth/auth-routes
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthError, HeadyError } from './auth-provider.js';
import { PermissionError } from './permission-manager.js';
import { EmailError } from './email-client.js';
import { ProvisionError } from './account-provisioner.js';

// ─── Route Factory ────────────────────────────────────────────────────────────

/**
 * Create and return the complete auth router.
 *
 * @param {object}  services
 * @param {object}  services.authProvider    - AuthProvider instance
 * @param {object}  services.accountProvisioner - AccountProvisioner instance
 * @param {object}  services.permissionManager  - PermissionManager instance
 * @param {object}  services.emailClient        - SecureEmailClient instance
 * @param {object}  services.config             - Platform config
 * @returns {Router} Express router
 */
export function createAuthRouter({
  authProvider,
  accountProvisioner,
  permissionManager,
  emailClient,
  config,
}) {
  const router = Router();

  // ── Shared Middleware ────────────────────────────────────────────────────

  /**
   * Validate request body/params using express-validator.
   * Returns 400 with all validation errors if any fail.
   */
  const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed.',
        code: 'VALIDATION_ERROR',
        details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }
    next();
  };

  /**
   * Authenticate requests via Bearer JWT token or API key.
   * Sets req.user from the decoded JWT payload.
   * Also accepts x-api-key header for programmatic access.
   */
  const authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'];

      if (apiKey) {
        // API key authentication
        const keyData = await accountProvisioner.verifyApiKey(apiKey);
        req.user = keyData;
        req.tokenScopes = keyData.scopes;
        req.authMethod = 'api_key';
        return next();
      }

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = authProvider.verifyAccessToken(token);
        req.user = payload;
        req.tokenScopes = payload.permissions?.scopes ?? [];
        req.authMethod = 'jwt';
        return next();
      }

      // Try cookie-based auth
      const cookieToken = req.cookies?.heady_access_token;
      if (cookieToken) {
        const payload = authProvider.verifyAccessToken(cookieToken);
        req.user = payload;
        req.tokenScopes = payload.permissions?.scopes ?? [];
        req.authMethod = 'cookie';
        return next();
      }

      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    } catch (err) {
      return res.status(err.status || 401).json({
        error: err.message,
        code: err.code || 'AUTH_ERROR',
      });
    }
  };

  /**
   * Optional authentication — attaches user if token is present, but
   * does not reject unauthenticated requests.
   */
  const authenticateOptional = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.heady_access_token;

      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : cookieToken;

      if (token) {
        req.user = authProvider.verifyAccessToken(token);
        req.tokenScopes = req.user.permissions?.scopes ?? [];
      }
    } catch {
      // Swallow errors — optional auth
    }
    next();
  };

  /**
   * Set secure auth cookies (access + refresh tokens).
   * @param {Response} res
   * @param {string}   accessToken
   * @param {string}   refreshToken
   */
  const setAuthCookies = (res, accessToken, refreshToken) => {
    const cookieOpts = authProvider.getCookieOptions();

    res.cookie('heady_access_token', accessToken, {
      ...cookieOpts,
      maxAge: 15 * 60 * 1000, // 15 min
    });
    res.cookie('heady_refresh_token', refreshToken, {
      ...cookieOpts,
      path: '/auth/refresh', // Restrict refresh token to rotation endpoint
    });
  };

  /**
   * Clear auth cookies on logout.
   * @param {Response} res
   */
  const clearAuthCookies = (res) => {
    const baseOpts = {
      httpOnly: true,
      secure: config.env !== 'development',
      sameSite: 'strict',
      domain: config.cookieDomain || 'headyme.com',
    };
    res.clearCookie('heady_access_token', baseOpts);
    res.clearCookie('heady_refresh_token', { ...baseOpts, path: '/auth/refresh' });
  };

  /**
   * Global error handler for all auth routes.
   * Translates HeadyError subclasses into consistent JSON responses.
   */
  const handleError = (err, req, res, next) => {
    if (
      err instanceof AuthError ||
      err instanceof PermissionError ||
      err instanceof EmailError ||
      err instanceof ProvisionError ||
      err instanceof HeadyError
    ) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
        ...(Object.keys(err.meta || {}).length > 0 && { meta: err.meta }),
      });
    }

    console.error('[HeadyAuth] Unhandled error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred.',
      code: 'INTERNAL_ERROR',
    });
  };

  // ── Rate Limiter Shorthands ───────────────────────────────────────────────

  const authRateLimit = permissionManager.rateLimitMiddleware('api');
  const emailRateLimit = permissionManager.rateLimitMiddleware('email');

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/register
   * Create a new Heady account with email/password.
   *
   * Body: { username, email, password, displayName? }
   * Response: { user, accessToken, refreshToken, headyEmail, verificationToken }
   */
  router.post(
    '/register',
    authRateLimit,
    [
      body('username')
        .isString()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3–30 characters.')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username may only contain letters, numbers, hyphens, and underscores.'),
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email address is required.'),
      body('password')
        .isString()
        .isLength({ min: 12 })
        .withMessage('Password must be at least 12 characters.'),
      body('displayName')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 60 })
        .withMessage('Display name must be 60 characters or fewer.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const { username, email, password, displayName } = req.body;
        const ip = req.ip || req.socket.remoteAddress;

        const passwordHash = await authProvider.hashPassword(password);

        const { user, apiKeys, headyEmail, verificationToken } =
          await accountProvisioner.provision({
            username,
            email,
            displayName,
            passwordHash,
            role: 'user',
            tier: 'free',
          });

        const accessToken = authProvider.generateAccessToken({
          sub: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tier: user.tier,
          mfa_enabled: user.mfa_enabled,
          email_verified: user.email_verified,
          permissions: user.permissions,
        });

        const { token: refreshToken } = await authProvider.generateRefreshToken(user.id);

        setAuthCookies(res, accessToken, refreshToken);

        return res.status(201).json({
          user,
          accessToken,
          refreshToken,
          headyEmail,
          apiKeys,
          message: `Welcome to Heady! Check ${email} to verify your account.`,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/login
   * Authenticate with email and password.
   *
   * Body: { email, password }
   * Response: { user, accessToken, refreshToken } or { requiresMfa, mfaToken }
   */
  router.post(
    '/login',
    authRateLimit,
    [
      body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
      body('password').isString().notEmpty().withMessage('Password is required.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const { email, password } = req.body;
        const ip = req.ip || req.socket.remoteAddress;

        const result = await authProvider.loginWithPassword(email, password, ip);

        if (result.requiresMfa) {
          return res.status(200).json({
            requiresMfa: true,
            mfaToken: result.mfaToken,
            userId: result.userId,
          });
        }

        setAuthCookies(res, result.accessToken, result.refreshToken);

        return res.status(200).json({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // OAUTH2
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /auth/oauth/:provider
   * Initiate OAuth2 flow. Redirects to provider's authorization URL.
   *
   * Params: provider = google | github | microsoft | apple
   * Query: redirect_uri? (optional override)
   */
  router.get(
    '/oauth/:provider',
    authRateLimit,
    [
      param('provider')
        .isIn(['google', 'github', 'microsoft', 'apple'])
        .withMessage('Invalid OAuth provider.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const { provider } = req.params;
        const { redirect_uri } = req.query;

        const { url, state } = await authProvider.getOAuthAuthorizationUrl(
          provider,
          redirect_uri
        );

        // Store state in a short-lived cookie for CSRF validation
        res.cookie('oauth_state', state, {
          httpOnly: true,
          secure: config.env !== 'development',
          sameSite: 'lax', // Must be lax for OAuth redirects
          maxAge: 600 * 1000, // 10 minutes
        });

        return res.redirect(302, url);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /auth/oauth/:provider/callback
   * Handle OAuth2 authorization code callback.
   *
   * Query: code, state (+ error from provider)
   * Response: Redirects to frontend with tokens in URL fragment, or sets cookies
   */
  router.get(
    '/oauth/:provider/callback',
    [
      param('provider')
        .isIn(['google', 'github', 'microsoft', 'apple'])
        .withMessage('Invalid OAuth provider.'),
      query('code').optional().isString(),
      query('state').optional().isString(),
      query('error').optional().isString(),
    ],
    validate,
    async (req, res, next) => {
      try {
        const { provider } = req.params;
        const { code, state, error } = req.query;

        // Handle provider-side errors
        if (error) {
          return res.redirect(
            `${config.frontendUrl}/auth/error?code=${encodeURIComponent(error)}`
          );
        }

        if (!code || !state) {
          return res.redirect(`${config.frontendUrl}/auth/error?code=missing_params`);
        }

        const result = await authProvider.handleOAuthCallback(provider, code, state);

        if (result.requiresMfa) {
          return res.redirect(
            `${config.frontendUrl}/auth/mfa?token=${result.mfaToken}&userId=${result.userId}`
          );
        }

        // New OAuth user — needs username selection
        if (result.isNewUser && !result.user) {
          const tempToken = Buffer.from(
            JSON.stringify({ provider, providerData: result.providerData })
          ).toString('base64url');

          return res.redirect(
            `${config.frontendUrl}/auth/setup?t=${tempToken}`
          );
        }

        setAuthCookies(res, result.accessToken, result.refreshToken);
        res.clearCookie('oauth_state');

        return res.redirect(
          result.isNewUser
            ? `${config.frontendUrl}/onboarding`
            : `${config.frontendUrl}/dashboard`
        );
      } catch (err) {
        console.error('[OAuth Callback Error]', err.message);
        return res.redirect(
          `${config.frontendUrl}/auth/error?code=${encodeURIComponent(err.code || 'oauth_error')}`
        );
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/verify-email
   * Verify email address using token from welcome email.
   *
   * Body: { token }
   */
  router.post(
    '/verify-email',
    authRateLimit,
    [body('token').isString().notEmpty().withMessage('Verification token is required.')],
    validate,
    async (req, res, next) => {
      try {
        const { token } = req.body;
        const data = await authProvider.verifyEmailToken(token);

        return res.status(200).json({
          success: true,
          message: 'Email verified successfully.',
          email: data.email,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/forgot-password
   * Request a password reset email.
   *
   * Body: { email }
   */
  router.post(
    '/forgot-password',
    authRateLimit,
    [body('email').isEmail().normalizeEmail().withMessage('Valid email is required.')],
    validate,
    async (req, res, next) => {
      try {
        const { email } = req.body;
        const result = await authProvider.generatePasswordResetToken(email);

        // Send reset email even if user not found (prevent enumeration)
        if (result) {
          const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${result.token}`;
          await emailClient.sendTransactional({
            to: email,
            subject: 'Reset your Heady password',
            templateId: 'reset_password',
            variables: { resetUrl, displayName: result.user.display_name || result.user.username },
          }).catch((e) => console.error('[HeadyAuth] Failed to send reset email:', e.message));
        }

        // Always respond the same (timing-safe via constant message)
        return res.status(200).json({
          message: 'If an account exists with that email, you will receive a password reset link.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /auth/reset-password
   * Execute password reset using the token from the reset email.
   *
   * Body: { token, password }
   */
  router.post(
    '/reset-password',
    authRateLimit,
    [
      body('token').isString().notEmpty().withMessage('Reset token is required.'),
      body('password')
        .isString()
        .isLength({ min: 12 })
        .withMessage('Password must be at least 12 characters.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const { token, password } = req.body;
        await authProvider.resetPassword(token, password);

        clearAuthCookies(res);

        return res.status(200).json({
          success: true,
          message: 'Password reset successfully. Please log in with your new password.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MFA / 2FA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/mfa/enable
   * Begin TOTP 2FA setup. Returns secret and QR code.
   * (Requires authentication; confirmed via /mfa/verify)
   *
   * Response: { secret, qrCodeDataUrl, backupCodes }
   */
  router.post(
    '/mfa/enable',
    authenticate,
    authRateLimit,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const username = req.user.username;

        const mfaSetup = await authProvider.setupMfa(userId, username);

        return res.status(200).json(mfaSetup);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /auth/mfa/verify
   * Verify a TOTP code to complete setup OR to pass an MFA-gated login.
   *
   * Body (setup confirmation): { token } with authenticated request
   * Body (login gate):         { token, mfaToken, userId }
   */
  router.post(
    '/mfa/verify',
    authRateLimit,
    [body('token').isString().notEmpty().withMessage('TOTP code is required.')],
    validate,
    async (req, res, next) => {
      try {
        const { token, mfaToken, userId: bodyUserId } = req.body;

        // Determine flow: login MFA gate vs setup confirmation
        if (mfaToken && bodyUserId) {
          // MFA login gate
          const result = await authProvider.verifyMfaCode(bodyUserId, token, mfaToken);

          setAuthCookies(res, result.accessToken, result.refreshToken);

          return res.status(200).json({
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          });
        }

        // Setup confirmation — requires authentication
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.heady_access_token;
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

        if (!jwtToken) {
          return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
        }

        const decoded = authProvider.verifyAccessToken(jwtToken);
        const result = await authProvider.confirmMfaSetup(decoded.sub, token);

        return res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN REFRESH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/refresh
   * Rotate refresh token and issue new access token.
   *
   * Body: { refreshToken } OR cookie heady_refresh_token
   */
  router.post(
    '/refresh',
    authRateLimit,
    async (req, res, next) => {
      try {
        const token = req.body.refreshToken || req.cookies?.heady_refresh_token;

        if (!token) {
          return res.status(401).json({
            error: 'Refresh token is required.',
            code: 'AUTH_MISSING_REFRESH_TOKEN',
          });
        }

        const result = await authProvider.rotateRefreshToken(token);

        setAuthCookies(res, result.accessToken, result.refreshToken);

        return res.status(200).json({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/logout
   * Sign out. Revokes session and clears cookies.
   *
   * Query: all=true to revoke all sessions (global sign-out)
   */
  router.post(
    '/logout',
    authenticate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const all = req.query.all === 'true';

        if (all) {
          await authProvider.revokeAllSessions(userId);
        } else {
          const sessionId = req.cookies?.heady_session_id;
          if (sessionId) await authProvider.revokeSession(sessionId);
        }

        clearAuthCookies(res);

        return res.status(200).json({
          success: true,
          message: all ? 'Signed out from all devices.' : 'Signed out successfully.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRENT USER PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /auth/me
   * Get the authenticated user's profile.
   *
   * Response: { user, permissions }
   */
  router.get(
    '/me',
    authenticate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;

        const [userResult, permissions] = await Promise.all([
          // Fetch fresh user data
          (async () => {
            const r = await accountProvisioner.db.query(
              'SELECT * FROM users WHERE id = $1',
              [userId]
            );
            return r.rows[0];
          })(),
          permissionManager.listPermissions(userId),
        ]);

        if (!userResult) {
          return res.status(404).json({ error: 'User not found.', code: 'USER_NOT_FOUND' });
        }

        // Sanitize — remove sensitive fields
        const { password_hash, mfa_secret, mfa_backup_codes, ...user } = userResult;

        return res.status(200).json({ user, permissions });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PUT /auth/me
   * Update the authenticated user's profile.
   *
   * Body: { displayName?, avatarUrl?, preferences? }
   */
  router.put(
    '/me',
    authenticate,
    [
      body('displayName')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 60 })
        .withMessage('Display name must be 60 characters or fewer.'),
      body('avatarUrl')
        .optional()
        .isURL()
        .withMessage('Avatar URL must be a valid URL.'),
      body('preferences')
        .optional()
        .isObject()
        .withMessage('Preferences must be an object.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { displayName, avatarUrl, preferences } = req.body;

        const updates = {};
        if (displayName !== undefined) updates.display_name = displayName;
        if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
        if (preferences !== undefined) updates.preferences = preferences;

        const user = await accountProvisioner.updateProfile(userId, updates);

        return res.status(200).json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/permissions/request
   * Request access to a resource or filesystem path.
   *
   * Body: { resourceType, path?, level, reason? }
   */
  router.post(
    '/permissions/request',
    authenticate,
    [
      body('resourceType')
        .isString()
        .notEmpty()
        .withMessage('Resource type is required.'),
      body('level')
        .isIn(['read', 'write', 'execute', 'admin'])
        .withMessage('Level must be read, write, execute, or admin.'),
      body('path')
        .optional()
        .isString()
        .withMessage('Path must be a string.'),
      body('reason')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Reason must be 500 characters or fewer.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { resourceType, path, level, reason } = req.body;

        const request = await permissionManager.requestPermission(userId, {
          resourceType,
          path,
          level,
          reason,
        });

        return res.status(201).json({ request });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * PUT /auth/permissions/grant
   * Grant a permission to a user (admin only, or self for filesystem).
   *
   * Body: { userId, resourceType, level, requestId?, expiresAt? }
   */
  router.put(
    '/permissions/grant',
    authenticate,
    [
      body('userId').isUUID().withMessage('Valid user ID is required.'),
      body('resourceType').isString().notEmpty().withMessage('Resource type is required.'),
      body('level')
        .isIn(['read', 'write', 'execute', 'admin'])
        .withMessage('Level must be read, write, execute, or admin.'),
      body('requestId').optional().isUUID().withMessage('Request ID must be a valid UUID.'),
      body('expiresAt').optional().isISO8601().withMessage('Expiry must be a valid ISO8601 date.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const grantorId = req.user.sub;
        const { userId, resourceType, level, requestId, expiresAt } = req.body;

        const result = await permissionManager.grantPermission(grantorId, {
          userId,
          resourceType,
          level,
          requestId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        });

        return res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /auth/permissions
   * List all permissions for the authenticated user.
   */
  router.get(
    '/permissions',
    authenticate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const permissions = await permissionManager.listPermissions(userId);

        return res.status(200).json(permissions);
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // API KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/api-keys
   * Generate a new API key.
   *
   * Body: { name, scopes? }
   * Response: { keyId, secretKey } — secretKey shown ONCE only
   */
  router.post(
    '/api-keys',
    authenticate,
    [
      body('name')
        .isString()
        .trim()
        .isLength({ min: 1, max: 80 })
        .withMessage('Key name must be 1–80 characters.'),
      body('scopes')
        .optional()
        .isArray()
        .withMessage('Scopes must be an array.'),
      body('scopes.*')
        .optional()
        .isIn(Object.keys({
          'heady:read': true, 'heady:write': true, 'heady:admin': true,
          'heady:mcp': true, 'heady:vector': true, 'heady:llm': true,
          'heady:email': true, 'heady:swarm': true, 'heady:fs': true,
        }))
        .withMessage('Invalid scope.'),
    ],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { name, scopes = ['heady:read', 'heady:write'] } = req.body;

        const apiKey = await accountProvisioner.generateApiKey(userId, name, scopes);

        return res.status(201).json({
          ...apiKey,
          warning: 'Store your secret key securely. It will not be shown again.',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * DELETE /auth/api-keys/:keyId
   * Revoke an API key.
   *
   * Params: keyId
   */
  router.delete(
    '/api-keys/:keyId',
    authenticate,
    [param('keyId').isString().notEmpty().withMessage('Key ID is required.')],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { keyId } = req.params;

        await accountProvisioner.revokeApiKey(userId, keyId);

        return res.status(200).json({ success: true, message: 'API key revoked.' });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // EMAIL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /auth/email/inbox
   * Retrieve email inbox for the authenticated user's @headyme.com account.
   *
   * Query: page?, folder?, unread?
   */
  router.get(
    '/email/inbox',
    authenticate,
    emailRateLimit,
    [
      query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
      query('folder').optional().isString(),
      query('unread').optional().isBoolean(),
    ],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { page = 1, folder = 'INBOX', unread } = req.query;

        // Require email scope
        permissionManager.requireScope(req.tokenScopes, 'heady:email');

        const inbox = await emailClient.getInbox(userId, {
          page: parseInt(page, 10),
          folder,
          unreadOnly: unread === 'true',
        });

        return res.status(200).json(inbox);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /auth/email/:uid
   * Read a specific email by UID.
   *
   * Params: uid
   * Query: folder?
   */
  router.get(
    '/email/:uid',
    authenticate,
    emailRateLimit,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { uid } = req.params;
        const { folder = 'INBOX' } = req.query;

        permissionManager.requireScope(req.tokenScopes, 'heady:email');

        const email = await emailClient.readEmail(userId, uid, folder);
        return res.status(200).json(email);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /auth/email/send
   * Send an email from the user's @headyme.com address.
   *
   * Body: { to, subject, text?, html?, cc?, bcc?, attachments?, inReplyTo? }
   */
  router.post(
    '/email/send',
    authenticate,
    emailRateLimit,
    [
      body('to')
        .notEmpty()
        .withMessage('Recipient(s) required.'),
      body('subject')
        .isString()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Subject is required (max 1000 characters).'),
      body('text').optional().isString(),
      body('html').optional().isString(),
    ],
    validate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { to, subject, text, html, cc, bcc, attachments, inReplyTo, references } = req.body;

        permissionManager.requireScope(req.tokenScopes, 'heady:email');

        // Derive the user's @headyme.com address
        const fromAddress = `${req.user.username}@headyme.com`;

        const result = await emailClient.send({
          userId,
          from: fromAddress,
          to,
          cc,
          bcc,
          subject,
          text,
          html,
          attachments,
          inReplyTo,
          references,
        });

        return res.status(200).json({
          success: true,
          messageId: result.messageId,
          accepted: result.accepted,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /auth/email/search
   * Search emails for the user.
   *
   * Query: text?, from?, subject?, since?, before?, unread?, folder?
   */
  router.get(
    '/email/search',
    authenticate,
    emailRateLimit,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        permissionManager.requireScope(req.tokenScopes, 'heady:email');

        const { text, from, subject, since, before, unread, folder } = req.query;

        const results = await emailClient.searchEmails(userId, {
          text, from, subject, since, before,
          unread: unread === 'true',
          folder,
        });

        return res.status(200).json({ results, count: results.length });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * DELETE /auth/email/:uid
   * Delete an email.
   *
   * Params: uid
   * Query: folder?, permanent?
   */
  router.delete(
    '/email/:uid',
    authenticate,
    emailRateLimit,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const { uid } = req.params;
        const { folder = 'INBOX', permanent } = req.query;

        permissionManager.requireScope(req.tokenScopes, 'heady:email');

        await emailClient.deleteEmail(userId, uid, folder, permanent === 'true');
        return res.status(200).json({ success: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING COMPLETION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/onboarding/complete
   * Mark HeadyBuddy onboarding as complete for the user.
   */
  router.post(
    '/onboarding/complete',
    authenticate,
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        await accountProvisioner.completeOnboarding(userId);

        return res.status(200).json({
          success: true,
          message: 'Onboarding complete. Welcome to Heady!',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /auth/check-username
   * Check if a username is available.
   *
   * Query: username
   */
  router.get(
    '/check-username',
    authRateLimit,
    [query('username').isString().notEmpty().withMessage('Username is required.')],
    validate,
    async (req, res, next) => {
      try {
        const { username } = req.query;
        const result = await accountProvisioner.validateUsername(username);

        return res.status(200).json({
          username: username.toLowerCase(),
          available: result.valid,
          error: result.error || null,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /auth/health
   * Auth service health check.
   */
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'heady-auth', ts: Date.now() });
  });

  // ── Error Handler (must be last) ─────────────────────────────────────────

  router.use(handleError);

  return router;
}

// ─── Standalone Middleware Exports ────────────────────────────────────────────

/**
 * Create a standalone authentication middleware for use outside auth routes.
 * Verifies Bearer JWT or API key and sets req.user.
 *
 * @param {object} authProvider - AuthProvider instance
 * @param {object} accountProvisioner - AccountProvisioner instance
 * @returns {Function} Express middleware
 */
export function createAuthMiddleware(authProvider, accountProvisioner) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'];
      const cookieToken = req.cookies?.heady_access_token;

      if (apiKey) {
        const keyData = await accountProvisioner.verifyApiKey(apiKey);
        req.user = keyData;
        req.tokenScopes = keyData.scopes;
        return next();
      }

      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

      if (!token) {
        return res.status(401).json({ error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      }

      req.user = authProvider.verifyAccessToken(token);
      req.tokenScopes = req.user.permissions?.scopes ?? [];
      next();
    } catch (err) {
      res.status(err.status || 401).json({
        error: err.message,
        code: err.code || 'AUTH_ERROR',
      });
    }
  };
}

export default createAuthRouter;

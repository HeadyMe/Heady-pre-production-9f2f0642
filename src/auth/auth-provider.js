/**
 * @fileoverview HeadyAuthProvider — Complete OAuth2/OIDC authentication provider
 * for the Heady sovereign AI platform (headyme.com).
 *
 * Supports: Google, GitHub, Microsoft, Apple, Email/Password
 * Security: RS256 JWT signing, refresh token rotation, Redis sessions,
 *           TOTP 2FA, rate limiting, CSRF protection, argon2 password hashing,
 *           account lockout, HttpOnly/Secure/SameSite=Strict cookies.
 *
 * @module auth/auth-provider
 */

import crypto from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

const randomBytes = promisify(crypto.randomBytes);

// ─── Custom Error Classes ────────────────────────────────────────────────────

/**
 * Base error class for all Heady platform errors.
 */
export class HeadyError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} code    - Machine-readable error code (e.g. AUTH_INVALID_CREDENTIALS)
   * @param {number} status  - HTTP status code
   * @param {object} [meta]  - Optional additional metadata
   */
  constructor(message, code = 'HEADY_ERROR', status = 500, meta = {}) {
    super(message);
    this.name = 'HeadyError';
    this.code = code;
    this.status = status;
    this.meta = meta;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends HeadyError {
  constructor(message, code = 'AUTH_ERROR', status = 401, meta = {}) {
    super(message, code, status, meta);
    this.name = 'AuthError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** JWT access token lifetime in seconds (15 minutes) */
const ACCESS_TOKEN_TTL = 15 * 60;

/** Refresh token lifetime in seconds (30 days) */
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

/** Number of failed attempts before account lockout */
const MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration in seconds (15 minutes) */
const LOCKOUT_DURATION = 15 * 60;

/** CSRF token byte length */
const CSRF_TOKEN_BYTES = 32;

/** Supported OAuth providers */
const SUPPORTED_PROVIDERS = ['google', 'github', 'microsoft', 'apple'];

/** OAuth2 provider configurations */
const OAUTH_CONFIGS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'read:user'],
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: null, // Apple returns user info in the id_token only
    scopes: ['name', 'email'],
  },
};

// ─── Argon2 Configuration (OWASP recommended) ────────────────────────────────

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

// ─── AuthProvider Class ──────────────────────────────────────────────────────

/**
 * AuthProvider handles all authentication concerns for the Heady platform.
 *
 * Usage:
 * ```js
 * const auth = new AuthProvider({ db, redis, config });
 * await auth.initialize();
 * ```
 */
export class AuthProvider {
  /**
   * @param {object}  opts
   * @param {object}  opts.db      - PostgreSQL client (pg.Pool)
   * @param {object}  opts.redis   - Redis client (ioredis)
   * @param {object}  opts.config  - Platform configuration object
   */
  constructor({ db, redis, config }) {
    this.db = db;
    this.redis = redis;
    this.config = config;

    /** @type {crypto.KeyObject} RS256 private key for signing JWTs */
    this._privateKey = null;

    /** @type {crypto.KeyObject} RS256 public key for verifying JWTs */
    this._publicKey = null;
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize the auth provider. Must be called before use.
   * Loads or generates RS256 key pair.
   */
  async initialize() {
    await this._loadOrGenerateKeyPair();
  }

  /**
   * Load RS256 key pair from config or generate new ones.
   * @private
   */
  async _loadOrGenerateKeyPair() {
    if (this.config.jwt?.privateKey && this.config.jwt?.publicKey) {
      this._privateKey = crypto.createPrivateKey(this.config.jwt.privateKey);
      this._publicKey = crypto.createPublicKey(this.config.jwt.publicKey);
    } else {
      // Generate new RS256 key pair (4096-bit for production security)
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this._privateKey = crypto.createPrivateKey(privateKey);
      this._publicKey = crypto.createPublicKey(publicKey);

      console.warn(
        '[HeadyAuth] Generated ephemeral RS256 key pair. ' +
        'Set config.jwt.privateKey and config.jwt.publicKey in production.'
      );
    }
  }

  // ── Password Utilities ─────────────────────────────────────────────────────

  /**
   * Hash a plaintext password using argon2id.
   * @param {string} password - Plaintext password
   * @returns {Promise<string>} Argon2id hash
   */
  async hashPassword(password) {
    this._validatePasswordStrength(password);
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verify a plaintext password against an argon2id hash.
   * @param {string} password - Plaintext password
   * @param {string} hash     - Stored argon2id hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    return argon2.verify(hash, password);
  }

  /**
   * Enforce minimum password strength requirements.
   * @private
   * @param {string} password
   * @throws {AuthError} If password is too weak
   */
  _validatePasswordStrength(password) {
    if (!password || password.length < 12) {
      throw new AuthError(
        'Password must be at least 12 characters long.',
        'AUTH_WEAK_PASSWORD',
        400
      );
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new AuthError(
        'Password must contain uppercase, lowercase, a digit, and a special character.',
        'AUTH_WEAK_PASSWORD',
        400
      );
    }
  }

  // ── JWT Tokens ─────────────────────────────────────────────────────────────

  /**
   * Generate a signed RS256 JWT access token.
   * @param {object} payload - Token payload (userId, username, role, tier, permissions, etc.)
   * @returns {string} Signed JWT
   */
  generateAccessToken(payload) {
    const jwtId = uuidv4();
    return jwt.sign(
      {
        ...payload,
        jti: jwtId,
        iss: 'https://headyme.com',
        aud: 'heady-platform',
        iat: Math.floor(Date.now() / 1000),
      },
      this._privateKey,
      {
        algorithm: 'RS256',
        expiresIn: ACCESS_TOKEN_TTL,
      }
    );
  }

  /**
   * Generate a cryptographically random refresh token and store it in Redis.
   * @param {string} userId  - User UUID
   * @param {string} [sessionId] - Optional session ID to associate
   * @returns {Promise<{token: string, expiresAt: Date}>}
   */
  async generateRefreshToken(userId, sessionId = uuidv4()) {
    const tokenBytes = await randomBytes(64);
    const token = tokenBytes.toString('base64url');
    const key = this._refreshTokenKey(token);

    await this.redis.setex(
      key,
      REFRESH_TOKEN_TTL,
      JSON.stringify({ userId, sessionId, createdAt: Date.now() })
    );

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
    return { token, expiresAt, sessionId };
  }

  /**
   * Rotate refresh token: invalidate old one, issue new one.
   * @param {string} oldToken - Current refresh token
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: Date}>}
   * @throws {AuthError} If token is invalid or expired
   */
  async rotateRefreshToken(oldToken) {
    const key = this._refreshTokenKey(oldToken);
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new AuthError(
        'Refresh token is invalid or expired.',
        'AUTH_INVALID_REFRESH_TOKEN',
        401
      );
    }

    const { userId, sessionId } = JSON.parse(raw);

    // Delete old token immediately (single-use rotation)
    await this.redis.del(key);

    // Fetch fresh user data for new access token
    const user = await this._getUserById(userId);
    if (!user) {
      throw new AuthError('User not found.', 'AUTH_USER_NOT_FOUND', 401);
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthError('Account is locked.', 'AUTH_ACCOUNT_LOCKED', 403);
    }

    const accessToken = this.generateAccessToken(this._buildTokenPayload(user));
    const { token: newRefreshToken, expiresAt } = await this.generateRefreshToken(userId, sessionId);

    return { accessToken, refreshToken: newRefreshToken, expiresAt };
  }

  /**
   * Verify and decode a JWT access token.
   * @param {string} token - JWT string
   * @returns {object} Decoded payload
   * @throws {AuthError} If token is invalid
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this._publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://headyme.com',
        audience: 'heady-platform',
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthError('Access token has expired.', 'AUTH_TOKEN_EXPIRED', 401);
      }
      throw new AuthError('Invalid access token.', 'AUTH_TOKEN_INVALID', 401);
    }
  }

  /**
   * Build the JWT payload from a user DB record.
   * @private
   * @param {object} user - User database row
   * @returns {object} JWT payload
   */
  _buildTokenPayload(user) {
    return {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tier: user.tier,
      mfa_enabled: user.mfa_enabled,
      email_verified: user.email_verified,
      permissions: user.permissions ?? {},
    };
  }

  // ── Email/Password Authentication ──────────────────────────────────────────

  /**
   * Authenticate a user with email and password.
   * Handles account lockout and failed attempt tracking.
   *
   * @param {string} email    - User email address
   * @param {string} password - Plaintext password
   * @param {string} ip       - Client IP address (for rate limiting)
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string, requiresMfa: boolean}>}
   * @throws {AuthError}
   */
  async loginWithPassword(email, password, ip) {
    if (!email || !password) {
      throw new AuthError('Email and password are required.', 'AUTH_MISSING_CREDENTIALS', 400);
    }

    // Check IP-based rate limit
    await this._checkIpRateLimit(ip, 'login');

    const user = await this._getUserByEmail(email.toLowerCase().trim());

    if (!user) {
      // Use constant-time dummy comparison to prevent user enumeration
      await argon2.hash('dummy-password-to-prevent-timing-attacks', ARGON2_OPTIONS);
      throw new AuthError(
        'Invalid email or password.',
        'AUTH_INVALID_CREDENTIALS',
        401
      );
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
      throw new AuthError(
        `Account is locked. Try again in ${remaining} minute(s).`,
        'AUTH_ACCOUNT_LOCKED',
        403,
        { lockedUntil: user.locked_until }
      );
    }

    const passwordValid = await this.verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      await this._recordFailedAttempt(user.id, ip);
      throw new AuthError(
        'Invalid email or password.',
        'AUTH_INVALID_CREDENTIALS',
        401
      );
    }

    // Reset failed attempts on success
    await this._clearFailedAttempts(user.id);

    // Update last_login
    await this.db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    if (user.mfa_enabled) {
      // Return partial session — requires MFA verification
      const mfaToken = await this._generateMfaToken(user.id);
      return { requiresMfa: true, mfaToken, userId: user.id };
    }

    const accessToken = this.generateAccessToken(this._buildTokenPayload(user));
    const { token: refreshToken, expiresAt } = await this.generateRefreshToken(user.id);

    return {
      requiresMfa: false,
      user: this._sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  // ── OAuth2 / OIDC ──────────────────────────────────────────────────────────

  /**
   * Generate the OAuth2 authorization URL for the given provider.
   * Stores a PKCE verifier and state token in Redis.
   *
   * @param {string} provider - One of: google, github, microsoft, apple
   * @param {string} [redirectUri] - Override redirect URI
   * @returns {Promise<{url: string, state: string}>}
   */
  async getOAuthAuthorizationUrl(provider, redirectUri) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new AuthError(
        `Unsupported OAuth provider: ${provider}`,
        'AUTH_UNSUPPORTED_PROVIDER',
        400
      );
    }

    const providerConfig = OAUTH_CONFIGS[provider];
    const oauthConfig = this.config.oauth?.[provider];

    if (!oauthConfig?.clientId) {
      throw new AuthError(
        `OAuth provider "${provider}" is not configured.`,
        'AUTH_PROVIDER_NOT_CONFIGURED',
        500
      );
    }

    // Generate PKCE verifier and challenge
    const verifier = (await randomBytes(32)).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    // Generate state token (CSRF protection for OAuth flow)
    const state = (await randomBytes(32)).toString('base64url');

    // Store in Redis for 10 minutes
    await this.redis.setex(
      `oauth:state:${state}`,
      600,
      JSON.stringify({ provider, verifier, redirectUri })
    );

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: redirectUri || this._oauthRedirectUri(provider),
      response_type: 'code',
      scope: providerConfig.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    // Apple requires response_mode=form_post
    if (provider === 'apple') {
      params.set('response_mode', 'form_post');
    }

    return { url: `${providerConfig.authUrl}?${params}`, state };
  }

  /**
   * Handle the OAuth2 callback and exchange the authorization code for tokens.
   * Creates or links the user account as needed.
   *
   * @param {string} provider - OAuth provider name
   * @param {string} code     - Authorization code from provider
   * @param {string} state    - State token for CSRF validation
   * @returns {Promise<{user: object, accessToken: string, refreshToken: string, isNewUser: boolean}>}
   */
  async handleOAuthCallback(provider, code, state) {
    // Validate and consume state token
    const stateKey = `oauth:state:${state}`;
    const stateRaw = await this.redis.get(stateKey);
    if (!stateRaw) {
      throw new AuthError(
        'OAuth state token is invalid or expired.',
        'AUTH_INVALID_STATE',
        400
      );
    }
    await this.redis.del(stateKey);
    const { verifier, redirectUri } = JSON.parse(stateRaw);

    // Exchange code for tokens with the provider
    const oauthTokens = await this._exchangeOAuthCode(provider, code, verifier, redirectUri);

    // Fetch user info from provider
    const providerUser = await this._fetchOAuthUserInfo(provider, oauthTokens);

    // Find or create local user account
    const { user, isNewUser } = await this._findOrCreateOAuthUser(provider, providerUser);

    // Update last_login
    await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    if (user.mfa_enabled) {
      const mfaToken = await this._generateMfaToken(user.id);
      return { requiresMfa: true, mfaToken, userId: user.id, isNewUser };
    }

    const accessToken = this.generateAccessToken(this._buildTokenPayload(user));
    const { token: refreshToken, expiresAt } = await this.generateRefreshToken(user.id);

    return {
      requiresMfa: false,
      user: this._sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresAt,
      isNewUser,
    };
  }

  /**
   * Exchange an OAuth authorization code for access tokens.
   * @private
   */
  async _exchangeOAuthCode(provider, code, verifier, redirectUri) {
    const providerConfig = OAUTH_CONFIGS[provider];
    const oauthConfig = this.config.oauth[provider];

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || this._oauthRedirectUri(provider),
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      code_verifier: verifier,
    });

    const resp = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new AuthError(
        `OAuth token exchange failed for ${provider}: ${text}`,
        'AUTH_OAUTH_TOKEN_EXCHANGE_FAILED',
        502
      );
    }

    return resp.json();
  }

  /**
   * Fetch user profile information from an OAuth provider.
   * @private
   */
  async _fetchOAuthUserInfo(provider, tokens) {
    const providerConfig = OAUTH_CONFIGS[provider];

    // Apple returns user info in the id_token, not a separate endpoint
    if (provider === 'apple') {
      const decoded = jwt.decode(tokens.id_token);
      return {
        id: decoded.sub,
        email: decoded.email,
        name: tokens.user ? JSON.parse(tokens.user).name : null,
        provider: 'apple',
      };
    }

    const resp = await fetch(providerConfig.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!resp.ok) {
      throw new AuthError(
        `Failed to fetch user info from ${provider}.`,
        'AUTH_OAUTH_USERINFO_FAILED',
        502
      );
    }

    const info = await resp.json();

    // Normalize to a common shape
    const normalizers = {
      google: (u) => ({ id: u.sub, email: u.email, name: u.name, avatar: u.picture, provider: 'google' }),
      github: (u) => ({ id: String(u.id), email: u.email, name: u.name || u.login, avatar: u.avatar_url, provider: 'github' }),
      microsoft: (u) => ({ id: u.id, email: u.mail || u.userPrincipalName, name: u.displayName, avatar: null, provider: 'microsoft' }),
    };

    return normalizers[provider](info);
  }

  /**
   * Find an existing user by OAuth identity or create a new one.
   * @private
   */
  async _findOrCreateOAuthUser(provider, providerUser) {
    // Look up by oauth_accounts table
    const existing = await this.db.query(
      `SELECT u.* FROM users u
       JOIN oauth_accounts oa ON oa.user_id = u.id
       WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
      [provider, providerUser.id]
    );

    if (existing.rows.length > 0) {
      return { user: existing.rows[0], isNewUser: false };
    }

    // Check if email already exists (link accounts)
    if (providerUser.email) {
      const byEmail = await this._getUserByEmail(providerUser.email);
      if (byEmail) {
        // Link OAuth identity to existing account
        await this.db.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token_hash, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (provider, provider_user_id) DO NOTHING`,
          [byEmail.id, provider, providerUser.id, this._hashToken(provider + ':' + providerUser.id)]
        );
        return { user: byEmail, isNewUser: false };
      }
    }

    // New user — will be provisioned by AccountProvisioner in the route layer
    return {
      user: null,
      isNewUser: true,
      providerData: providerUser,
    };
  }

  // ── Multi-Factor Authentication (TOTP) ────────────────────────────────────

  /**
   * Set up TOTP 2FA for a user. Returns the secret and QR code data URL.
   * The secret should be stored only after verification (confirmMfaSetup).
   *
   * @param {string} userId   - User UUID
   * @param {string} username - Username for the TOTP label
   * @returns {Promise<{secret: string, qrCodeDataUrl: string, backupCodes: string[]}>}
   */
  async setupMfa(userId, username) {
    const secret = speakeasy.generateSecret({
      name: `Heady:${username}@headyme.com`,
      issuer: 'Heady',
      length: 32,
    });

    // Store pending secret in Redis (not committed until verification)
    await this.redis.setex(
      `mfa:pending:${userId}`,
      300, // 5 minutes to complete setup
      JSON.stringify({ secret: secret.base32 })
    );

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Generate 8 one-time backup codes
    const backupCodes = await this._generateBackupCodes(8);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Confirm MFA setup by verifying the first TOTP code.
   * Persists the secret and backup codes if successful.
   *
   * @param {string} userId - User UUID
   * @param {string} token  - 6-digit TOTP code
   * @returns {Promise<boolean>}
   */
  async confirmMfaSetup(userId, token) {
    const pending = await this.redis.get(`mfa:pending:${userId}`);
    if (!pending) {
      throw new AuthError(
        'MFA setup session expired. Please restart setup.',
        'AUTH_MFA_SETUP_EXPIRED',
        400
      );
    }
    const { secret } = JSON.parse(pending);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      throw new AuthError(
        'Invalid TOTP code. Please check your authenticator app.',
        'AUTH_MFA_INVALID_CODE',
        400
      );
    }

    // Persist MFA secret (encrypted)
    const encryptedSecret = this._encryptMfaSecret(secret);
    const backupCodes = await this._generateBackupCodes(8);
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c, ARGON2_OPTIONS))
    );

    await this.db.query(
      `UPDATE users SET mfa_enabled = TRUE, mfa_secret = $1, mfa_backup_codes = $2, updated_at = NOW()
       WHERE id = $3`,
      [encryptedSecret, JSON.stringify(hashedCodes), userId]
    );

    await this.redis.del(`mfa:pending:${userId}`);

    return { success: true, backupCodes };
  }

  /**
   * Verify a TOTP code or backup code for an MFA-protected login.
   *
   * @param {string} userId - User UUID
   * @param {string} token  - 6-digit TOTP code or 8-char backup code
   * @param {string} mfaToken - Short-lived MFA session token from initial login
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
   */
  async verifyMfaCode(userId, token, mfaToken) {
    // Validate MFA session token
    const mfaSessionKey = `mfa:session:${mfaToken}`;
    const sessionRaw = await this.redis.get(mfaSessionKey);
    if (!sessionRaw) {
      throw new AuthError('MFA session expired.', 'AUTH_MFA_SESSION_EXPIRED', 401);
    }
    const session = JSON.parse(sessionRaw);
    if (session.userId !== userId) {
      throw new AuthError('MFA session mismatch.', 'AUTH_MFA_SESSION_MISMATCH', 401);
    }

    const user = await this._getUserById(userId);
    if (!user?.mfa_secret) {
      throw new AuthError('MFA is not configured.', 'AUTH_MFA_NOT_CONFIGURED', 400);
    }

    const secret = this._decryptMfaSecret(user.mfa_secret);

    const totpValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!totpValid) {
      // Try backup codes
      const backupValid = await this._verifyAndConsumeBackupCode(user, token);
      if (!backupValid) {
        throw new AuthError(
          'Invalid authentication code.',
          'AUTH_MFA_INVALID_CODE',
          401
        );
      }
    }

    // Consume MFA session
    await this.redis.del(mfaSessionKey);

    // Issue tokens
    const accessToken = this.generateAccessToken(this._buildTokenPayload(user));
    const { token: refreshToken, expiresAt } = await this.generateRefreshToken(user.id);

    await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return {
      user: this._sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  // ── Session Management ─────────────────────────────────────────────────────

  /**
   * Create a new user session in Redis.
   * @param {string} userId    - User UUID
   * @param {object} metadata  - Session metadata (ip, userAgent, etc.)
   * @returns {Promise<string>} Session ID
   */
  async createSession(userId, metadata = {}) {
    const sessionId = uuidv4();
    const sessionKey = `session:${sessionId}`;

    await this.redis.setex(
      sessionKey,
      REFRESH_TOKEN_TTL,
      JSON.stringify({
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      })
    );

    // Track sessions per user for session listing/revocation
    await this.redis.sadd(`user:sessions:${userId}`, sessionId);

    return sessionId;
  }

  /**
   * Invalidate a specific session.
   * @param {string} sessionId - Session ID to revoke
   */
  async revokeSession(sessionId) {
    const sessionKey = `session:${sessionId}`;
    const raw = await this.redis.get(sessionKey);

    if (raw) {
      const { userId } = JSON.parse(raw);
      await this.redis.del(sessionKey);
      await this.redis.srem(`user:sessions:${userId}`, sessionId);
    }
  }

  /**
   * Revoke all sessions for a user (global sign-out).
   * @param {string} userId - User UUID
   */
  async revokeAllSessions(userId) {
    const sessionIds = await this.redis.smembers(`user:sessions:${userId}`);
    if (sessionIds.length > 0) {
      const keys = sessionIds.map((id) => `session:${id}`);
      await this.redis.del(...keys);
    }
    await this.redis.del(`user:sessions:${userId}`);
  }

  // ── CSRF Protection ────────────────────────────────────────────────────────

  /**
   * Generate a CSRF token and associate it with a session.
   * @param {string} sessionId - Session ID
   * @returns {Promise<string>} CSRF token
   */
  async generateCsrfToken(sessionId) {
    const token = (await randomBytes(CSRF_TOKEN_BYTES)).toString('base64url');
    await this.redis.setex(`csrf:${sessionId}`, 3600, token);
    return token;
  }

  /**
   * Validate a CSRF token for a session.
   * @param {string} sessionId    - Session ID
   * @param {string} clientToken  - Token from request header/body
   * @throws {AuthError} If invalid
   */
  async validateCsrfToken(sessionId, clientToken) {
    const storedToken = await this.redis.get(`csrf:${sessionId}`);
    if (!storedToken) {
      throw new AuthError('CSRF token missing or expired.', 'AUTH_CSRF_MISSING', 403);
    }
    // Constant-time comparison
    const stored = Buffer.from(storedToken);
    const client = Buffer.from(clientToken || '');
    if (stored.length !== client.length || !crypto.timingSafeEqual(stored, client)) {
      throw new AuthError('CSRF token validation failed.', 'AUTH_CSRF_INVALID', 403);
    }
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  /**
   * Check IP-based rate limits for an auth action.
   * @param {string} ip     - Client IP address
   * @param {string} action - Action identifier (login, register, etc.)
   * @throws {AuthError} If rate limit exceeded
   */
  async _checkIpRateLimit(ip, action) {
    const limits = {
      login: { max: 20, window: 900 },      // 20 per 15 min
      register: { max: 5, window: 3600 },   // 5 per hour
      'forgot-password': { max: 3, window: 3600 }, // 3 per hour
      mfa: { max: 10, window: 300 },        // 10 per 5 min
    };

    const limit = limits[action] || { max: 30, window: 60 };
    const key = `rate:${action}:${ip}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, limit.window);
    }

    if (count > limit.max) {
      const ttl = await this.redis.ttl(key);
      throw new AuthError(
        `Too many ${action} attempts. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
        'AUTH_RATE_LIMIT_EXCEEDED',
        429,
        { retryAfter: ttl }
      );
    }
  }

  // ── Account Lockout ────────────────────────────────────────────────────────

  /**
   * Record a failed login attempt and lock the account if threshold reached.
   * @private
   */
  async _recordFailedAttempt(userId, ip) {
    const key = `failedAttempts:${userId}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, LOCKOUT_DURATION);

    if (count >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION * 1000);
      await this.db.query(
        'UPDATE users SET locked_until = $1, failed_attempts = $2 WHERE id = $3',
        [lockedUntil, count, userId]
      );
    } else {
      await this.db.query(
        'UPDATE users SET failed_attempts = $1 WHERE id = $2',
        [count, userId]
      );
    }
  }

  /**
   * Clear failed login attempts after a successful login.
   * @private
   */
  async _clearFailedAttempts(userId) {
    await this.redis.del(`failedAttempts:${userId}`);
    await this.db.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [userId]
    );
  }

  // ── Email Verification ─────────────────────────────────────────────────────

  /**
   * Generate a signed email verification token.
   * @param {string} userId - User UUID
   * @param {string} email  - Email to verify
   * @returns {Promise<string>} Verification token
   */
  async generateEmailVerificationToken(userId, email) {
    const token = (await randomBytes(32)).toString('base64url');
    await this.redis.setex(
      `email:verify:${token}`,
      86400, // 24 hours
      JSON.stringify({ userId, email })
    );
    return token;
  }

  /**
   * Consume and validate an email verification token.
   * @param {string} token - Verification token from email link
   * @returns {Promise<{userId: string, email: string}>}
   */
  async verifyEmailToken(token) {
    const key = `email:verify:${token}`;
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new AuthError(
        'Email verification token is invalid or expired.',
        'AUTH_VERIFY_TOKEN_INVALID',
        400
      );
    }

    const data = JSON.parse(raw);
    await this.redis.del(key);

    await this.db.query(
      'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [data.userId]
    );

    return data;
  }

  // ── Password Reset ─────────────────────────────────────────────────────────

  /**
   * Generate a password reset token for a user.
   * @param {string} email - User email
   * @returns {Promise<{token: string, user: object}|null>}
   */
  async generatePasswordResetToken(email) {
    const user = await this._getUserByEmail(email.toLowerCase().trim());
    if (!user) return null; // Silent — don't reveal whether email exists

    const token = (await randomBytes(32)).toString('base64url');
    await this.redis.setex(
      `pw:reset:${token}`,
      3600, // 1 hour
      JSON.stringify({ userId: user.id, email: user.email, createdAt: Date.now() })
    );

    return { token, user };
  }

  /**
   * Reset user password using a valid reset token.
   * @param {string} token    - Reset token from email
   * @param {string} newPassword - New plaintext password
   */
  async resetPassword(token, newPassword) {
    const key = `pw:reset:${token}`;
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new AuthError(
        'Password reset token is invalid or expired.',
        'AUTH_RESET_TOKEN_INVALID',
        400
      );
    }

    const { userId } = JSON.parse(raw);

    const passwordHash = await this.hashPassword(newPassword);
    await this.db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = $2',
      [passwordHash, userId]
    );

    await this.redis.del(key);

    // Revoke all existing sessions (security best practice)
    await this.revokeAllSessions(userId);
  }

  // ── Cookie Helpers ─────────────────────────────────────────────────────────

  /**
   * Produce secure cookie options for auth cookies.
   * @param {number} [maxAge] - Override max age in seconds
   * @returns {object} Express cookie options
   */
  getCookieOptions(maxAge = REFRESH_TOKEN_TTL) {
    return {
      httpOnly: true,
      secure: this.config.env !== 'development', // HTTPS only in production
      sameSite: 'strict',
      maxAge: maxAge * 1000, // Express uses milliseconds
      path: '/',
      domain: this.config.cookieDomain || 'headyme.com',
    };
  }

  // ── Private Utilities ──────────────────────────────────────────────────────

  /** @private */
  async _getUserById(id) {
    const result = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /** @private */
  async _getUserByEmail(email) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows[0] || null;
  }

  /** @private */
  _sanitizeUser(user) {
    const { password_hash, mfa_secret, mfa_backup_codes, ...safe } = user;
    return safe;
  }

  /** @private */
  _oauthRedirectUri(provider) {
    return `${this.config.baseUrl}/auth/oauth/${provider}/callback`;
  }

  /** @private */
  _refreshTokenKey(token) {
    return `refresh:${crypto.createHash('sha256').update(token).digest('hex')}`;
  }

  /** @private */
  _hashToken(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /** @private */
  _encryptMfaSecret(secret) {
    const iv = crypto.randomBytes(12);
    const key = Buffer.from(this.config.mfaEncryptionKey || crypto.randomBytes(32));
    const cipher = crypto.createCipheriv('aes-256-gcm', key.slice(0, 32), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  /** @private */
  _decryptMfaSecret(encryptedBase64) {
    const data = Buffer.from(encryptedBase64, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const key = Buffer.from(this.config.mfaEncryptionKey || crypto.randomBytes(32));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key.slice(0, 32), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  /** @private */
  async _generateMfaToken(userId) {
    const token = (await randomBytes(32)).toString('base64url');
    await this.redis.setex(
      `mfa:session:${token}`,
      300, // 5 minutes to complete MFA
      JSON.stringify({ userId, createdAt: Date.now() })
    );
    return token;
  }

  /** @private */
  async _generateBackupCodes(count) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const bytes = await randomBytes(5);
      codes.push(bytes.toString('hex').toUpperCase().slice(0, 8));
    }
    return codes;
  }

  /** @private */
  async _verifyAndConsumeBackupCode(user, token) {
    const stored = JSON.parse(user.mfa_backup_codes || '[]');
    for (let i = 0; i < stored.length; i++) {
      const match = await argon2.verify(stored[i], token);
      if (match) {
        // Remove used backup code
        stored.splice(i, 1);
        await this.db.query(
          'UPDATE users SET mfa_backup_codes = $1 WHERE id = $2',
          [JSON.stringify(stored), user.id]
        );
        return true;
      }
    }
    return false;
  }
}

export default AuthProvider;

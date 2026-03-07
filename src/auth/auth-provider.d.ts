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
    constructor(message: string, code?: string, status?: number, meta?: object);
    code: string;
    status: number;
    meta: object;
}
export class AuthError extends HeadyError {
    constructor(message: any, code?: string, status?: number, meta?: {});
}
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
    constructor({ db, redis, config }: {
        db: object;
        redis: object;
        config: object;
    });
    db: object;
    redis: object;
    config: object;
    /** @type {crypto.KeyObject} RS256 private key for signing JWTs */
    _privateKey: crypto.KeyObject;
    /** @type {crypto.KeyObject} RS256 public key for verifying JWTs */
    _publicKey: crypto.KeyObject;
    /**
     * Initialize the auth provider. Must be called before use.
     * Loads or generates RS256 key pair.
     */
    initialize(): Promise<void>;
    /**
     * Load RS256 key pair from config or generate new ones.
     * @private
     */
    private _loadOrGenerateKeyPair;
    /**
     * Hash a plaintext password using argon2id.
     * @param {string} password - Plaintext password
     * @returns {Promise<string>} Argon2id hash
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verify a plaintext password against an argon2id hash.
     * @param {string} password - Plaintext password
     * @param {string} hash     - Stored argon2id hash
     * @returns {Promise<boolean>}
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Enforce minimum password strength requirements.
     * @private
     * @param {string} password
     * @throws {AuthError} If password is too weak
     */
    private _validatePasswordStrength;
    /**
     * Generate a signed RS256 JWT access token.
     * @param {object} payload - Token payload (userId, username, role, tier, permissions, etc.)
     * @returns {string} Signed JWT
     */
    generateAccessToken(payload: object): string;
    /**
     * Generate a cryptographically random refresh token and store it in Redis.
     * @param {string} userId  - User UUID
     * @param {string} [sessionId] - Optional session ID to associate
     * @returns {Promise<{token: string, expiresAt: Date}>}
     */
    generateRefreshToken(userId: string, sessionId?: string): Promise<{
        token: string;
        expiresAt: Date;
    }>;
    /**
     * Rotate refresh token: invalidate old one, issue new one.
     * @param {string} oldToken - Current refresh token
     * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: Date}>}
     * @throws {AuthError} If token is invalid or expired
     */
    rotateRefreshToken(oldToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
    }>;
    /**
     * Verify and decode a JWT access token.
     * @param {string} token - JWT string
     * @returns {object} Decoded payload
     * @throws {AuthError} If token is invalid
     */
    verifyAccessToken(token: string): object;
    /**
     * Build the JWT payload from a user DB record.
     * @private
     * @param {object} user - User database row
     * @returns {object} JWT payload
     */
    private _buildTokenPayload;
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
    loginWithPassword(email: string, password: string, ip: string): Promise<{
        user: object;
        accessToken: string;
        refreshToken: string;
        requiresMfa: boolean;
    }>;
    /**
     * Generate the OAuth2 authorization URL for the given provider.
     * Stores a PKCE verifier and state token in Redis.
     *
     * @param {string} provider - One of: google, github, microsoft, apple
     * @param {string} [redirectUri] - Override redirect URI
     * @returns {Promise<{url: string, state: string}>}
     */
    getOAuthAuthorizationUrl(provider: string, redirectUri?: string): Promise<{
        url: string;
        state: string;
    }>;
    /**
     * Handle the OAuth2 callback and exchange the authorization code for tokens.
     * Creates or links the user account as needed.
     *
     * @param {string} provider - OAuth provider name
     * @param {string} code     - Authorization code from provider
     * @param {string} state    - State token for CSRF validation
     * @returns {Promise<{user: object, accessToken: string, refreshToken: string, isNewUser: boolean}>}
     */
    handleOAuthCallback(provider: string, code: string, state: string): Promise<{
        user: object;
        accessToken: string;
        refreshToken: string;
        isNewUser: boolean;
    }>;
    /**
     * Exchange an OAuth authorization code for access tokens.
     * @private
     */
    private _exchangeOAuthCode;
    /**
     * Fetch user profile information from an OAuth provider.
     * @private
     */
    private _fetchOAuthUserInfo;
    /**
     * Find an existing user by OAuth identity or create a new one.
     * @private
     */
    private _findOrCreateOAuthUser;
    /**
     * Set up TOTP 2FA for a user. Returns the secret and QR code data URL.
     * The secret should be stored only after verification (confirmMfaSetup).
     *
     * @param {string} userId   - User UUID
     * @param {string} username - Username for the TOTP label
     * @returns {Promise<{secret: string, qrCodeDataUrl: string, backupCodes: string[]}>}
     */
    setupMfa(userId: string, username: string): Promise<{
        secret: string;
        qrCodeDataUrl: string;
        backupCodes: string[];
    }>;
    /**
     * Confirm MFA setup by verifying the first TOTP code.
     * Persists the secret and backup codes if successful.
     *
     * @param {string} userId - User UUID
     * @param {string} token  - 6-digit TOTP code
     * @returns {Promise<boolean>}
     */
    confirmMfaSetup(userId: string, token: string): Promise<boolean>;
    /**
     * Verify a TOTP code or backup code for an MFA-protected login.
     *
     * @param {string} userId - User UUID
     * @param {string} token  - 6-digit TOTP code or 8-char backup code
     * @param {string} mfaToken - Short-lived MFA session token from initial login
     * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
     */
    verifyMfaCode(userId: string, token: string, mfaToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: object;
    }>;
    /**
     * Create a new user session in Redis.
     * @param {string} userId    - User UUID
     * @param {object} metadata  - Session metadata (ip, userAgent, etc.)
     * @returns {Promise<string>} Session ID
     */
    createSession(userId: string, metadata?: object): Promise<string>;
    /**
     * Invalidate a specific session.
     * @param {string} sessionId - Session ID to revoke
     */
    revokeSession(sessionId: string): Promise<void>;
    /**
     * Revoke all sessions for a user (global sign-out).
     * @param {string} userId - User UUID
     */
    revokeAllSessions(userId: string): Promise<void>;
    /**
     * Generate a CSRF token and associate it with a session.
     * @param {string} sessionId - Session ID
     * @returns {Promise<string>} CSRF token
     */
    generateCsrfToken(sessionId: string): Promise<string>;
    /**
     * Validate a CSRF token for a session.
     * @param {string} sessionId    - Session ID
     * @param {string} clientToken  - Token from request header/body
     * @throws {AuthError} If invalid
     */
    validateCsrfToken(sessionId: string, clientToken: string): Promise<void>;
    /**
     * Check IP-based rate limits for an auth action.
     * @param {string} ip     - Client IP address
     * @param {string} action - Action identifier (login, register, etc.)
     * @throws {AuthError} If rate limit exceeded
     */
    _checkIpRateLimit(ip: string, action: string): Promise<void>;
    /**
     * Record a failed login attempt and lock the account if threshold reached.
     * @private
     */
    private _recordFailedAttempt;
    /**
     * Clear failed login attempts after a successful login.
     * @private
     */
    private _clearFailedAttempts;
    /**
     * Generate a signed email verification token.
     * @param {string} userId - User UUID
     * @param {string} email  - Email to verify
     * @returns {Promise<string>} Verification token
     */
    generateEmailVerificationToken(userId: string, email: string): Promise<string>;
    /**
     * Consume and validate an email verification token.
     * @param {string} token - Verification token from email link
     * @returns {Promise<{userId: string, email: string}>}
     */
    verifyEmailToken(token: string): Promise<{
        userId: string;
        email: string;
    }>;
    /**
     * Generate a password reset token for a user.
     * @param {string} email - User email
     * @returns {Promise<{token: string, user: object}|null>}
     */
    generatePasswordResetToken(email: string): Promise<{
        token: string;
        user: object;
    } | null>;
    /**
     * Reset user password using a valid reset token.
     * @param {string} token    - Reset token from email
     * @param {string} newPassword - New plaintext password
     */
    resetPassword(token: string, newPassword: string): Promise<void>;
    /**
     * Produce secure cookie options for auth cookies.
     * @param {number} [maxAge] - Override max age in seconds
     * @returns {object} Express cookie options
     */
    getCookieOptions(maxAge?: number): object;
    /** @private */
    private _getUserById;
    /** @private */
    private _getUserByEmail;
    /** @private */
    private _sanitizeUser;
    /** @private */
    private _oauthRedirectUri;
    /** @private */
    private _refreshTokenKey;
    /** @private */
    private _hashToken;
    /** @private */
    private _encryptMfaSecret;
    /** @private */
    private _decryptMfaSecret;
    /** @private */
    private _generateMfaToken;
    /** @private */
    private _generateBackupCodes;
    /** @private */
    private _verifyAndConsumeBackupCode;
}
export default AuthProvider;
import crypto from 'crypto';
//# sourceMappingURL=auth-provider.d.ts.map
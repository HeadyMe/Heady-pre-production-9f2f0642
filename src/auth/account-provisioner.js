/**
 * @fileoverview HeadyAccountProvisioner — Complete account creation system for
 * the Heady sovereign AI platform (headyme.com).
 *
 * Responsibilities:
 * - Creates {username}@headyme.com accounts in PostgreSQL
 * - Validates username format and availability
 * - Provisions vector memory namespace
 * - Configures email routing (Cloudflare / Mailcow)
 * - Sends welcome email with verification link
 * - Sets up default HeadyBuddy companion preferences
 * - Creates initial HeadyBee swarm configuration
 * - Generates API key pairs for programmatic access
 *
 * @module auth/account-provisioner
 */

import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { HeadyError, AuthError } from './auth-provider.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum username length */
const USERNAME_MIN = 3;
/** Maximum username length */
const USERNAME_MAX = 30;
/** Username regex: alphanumeric plus hyphens, no leading/trailing hyphen */
const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_]{1,28}[a-zA-Z0-9]$|^[a-zA-Z0-9]{3}$/;

/** Reserved usernames that cannot be registered */
const RESERVED_USERNAMES = new Set([
  'admin', 'heady', 'headyme', 'headybuddy', 'headybee', 'support', 'security',
  'billing', 'legal', 'privacy', 'abuse', 'postmaster', 'webmaster', 'root',
  'help', 'info', 'contact', 'no-reply', 'noreply', 'feedback', 'api',
  'www', 'mail', 'ftp', 'smtp', 'imap', 'pop3', 'bot', 'system', 'staff',
  'team', 'official', 'heady-official', 'founder', 'ceo', 'hello',
]);

/** Default user preferences scaffold */
const DEFAULT_PREFERENCES = {
  theme: 'system', // 'light' | 'dark' | 'system'
  language: 'en',
  timezone: 'UTC',
  notifications: {
    email: true,
    push: true,
    in_app: true,
    marketing: false,
  },
  privacy: {
    showActivity: false,
    showEmail: false,
  },
  editor: {
    fontSize: 14,
    fontFamily: 'monospace',
    tabSize: 2,
    lineNumbers: true,
  },
};

/** Default HeadyBuddy companion configuration */
const DEFAULT_BUDDY_CONFIG = {
  name: 'HeadyBuddy',
  personality: 'helpful',
  tone: 'casual',
  capabilities: [
    'research', 'writing', 'coding', 'analysis',
    'image_generation', 'web_search', 'memory_recall',
  ],
  memory: {
    enabled: true,
    persistenceLevel: 'session', // 'none' | 'session' | 'persistent'
    maxContextTokens: 128000,
  },
  voice: {
    enabled: false,
    voiceId: 'heady-default',
  },
  greeting: 'Hey! I\'m HeadyBuddy. How can I help you today?',
  onboarding_completed: false,
};

/** Default HeadyBee swarm configuration */
const DEFAULT_BEE_CONFIG = {
  enabled: false, // Enabled when user upgrades
  maxWorkers: 3,
  defaultModel: 'gpt-4o',
  capabilities: {
    webSearch: true,
    codeExecution: false, // Pro+ only
    fileSystem: false,    // Requires explicit grant
    emailAccess: false,   // Requires explicit grant
  },
  queues: {
    research: { concurrency: 1, priority: 'normal' },
    writing: { concurrency: 1, priority: 'normal' },
    analysis: { concurrency: 1, priority: 'normal' },
  },
  autoAssign: true,
  notifications: true,
};

// ─── ProvisionError ───────────────────────────────────────────────────────────

/**
 * Provisioning-specific error.
 */
export class ProvisionError extends HeadyError {
  constructor(message, code = 'PROVISION_ERROR', status = 400, meta = {}) {
    super(message, code, status, meta);
    this.name = 'ProvisionError';
  }
}

// ─── AccountProvisioner Class ─────────────────────────────────────────────────

/**
 * AccountProvisioner handles complete user account creation and setup.
 *
 * Usage:
 * ```js
 * const provisioner = new AccountProvisioner({ db, redis, emailClient, config });
 * const account = await provisioner.provision({ username, email, displayName, role });
 * ```
 */
export class AccountProvisioner {
  /**
   * @param {object}  opts
   * @param {object}  opts.db          - PostgreSQL client (pg.Pool)
   * @param {object}  opts.redis       - Redis client (ioredis)
   * @param {object}  opts.emailClient - SecureEmailClient instance
   * @param {object}  opts.authProvider - AuthProvider instance (for verification tokens)
   * @param {object}  opts.config      - Platform configuration
   */
  constructor({ db, redis, emailClient, authProvider, config }) {
    this.db = db;
    this.redis = redis;
    this.emailClient = emailClient;
    this.authProvider = authProvider;
    this.config = config;
  }

  // ── Username Validation ────────────────────────────────────────────────────

  /**
   * Validate a username against all format and availability rules.
   *
   * @param {string} username - Desired username
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required.' };
    }

    const trimmed = username.trim().toLowerCase();

    if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
      return {
        valid: false,
        error: `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`,
      };
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: 'Username may only contain letters, numbers, hyphens, and underscores. It cannot start or end with a hyphen.',
      };
    }

    if (RESERVED_USERNAMES.has(trimmed)) {
      return { valid: false, error: 'This username is reserved.' };
    }

    // Check profanity / blocklist
    if (await this._isBlockedUsername(trimmed)) {
      return { valid: false, error: 'This username is not available.' };
    }

    // Check database availability
    const existing = await this.db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [trimmed]
    );
    if (existing.rows.length > 0) {
      return { valid: false, error: 'Username is already taken.' };
    }

    return { valid: true };
  }

  /**
   * Check a blocklist stored in Redis for banned usernames.
   * @private
   */
  async _isBlockedUsername(username) {
    return this.redis.sismember('blocked:usernames', username.toLowerCase());
  }

  // ── Core Provision Flow ───────────────────────────────────────────────────

  /**
   * Provision a complete new user account.
   *
   * This is the single entry point for all new account creation — whether
   * from email/password registration, OAuth signup, or HeadyBuddy onboarding.
   *
   * @param {object}  opts
   * @param {string}  opts.username      - Desired username (becomes @headyme.com email)
   * @param {string}  opts.email         - User's personal/backup email
   * @param {string}  [opts.displayName] - Display name (defaults to username)
   * @param {string}  [opts.avatarUrl]   - Profile picture URL
   * @param {string}  [opts.role]        - User role (default: 'user')
   * @param {string}  [opts.tier]        - Billing tier (default: 'free')
   * @param {string}  [opts.passwordHash] - Pre-hashed password (omit for OAuth users)
   * @param {string}  [opts.oauthProvider] - OAuth provider if OAuth registration
   * @param {string}  [opts.oauthProviderId] - OAuth provider user ID
   * @param {object}  [opts.metadata]    - Any extra metadata to store
   * @returns {Promise<{user: object, apiKeys: object, verificationToken: string}>}
   */
  async provision({
    username,
    email,
    displayName,
    avatarUrl = null,
    role = 'user',
    tier = 'free',
    passwordHash = null,
    oauthProvider = null,
    oauthProviderId = null,
    metadata = {},
  }) {
    // Validate username
    const validation = await this.validateUsername(username);
    if (!validation.valid) {
      throw new ProvisionError(validation.error, 'PROVISION_INVALID_USERNAME', 400);
    }

    // Validate email
    if (!this._isValidEmail(email)) {
      throw new ProvisionError('Invalid email address.', 'PROVISION_INVALID_EMAIL', 400);
    }

    // Check email uniqueness
    const emailCheck = await this.db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      throw new ProvisionError(
        'An account with this email already exists.',
        'PROVISION_EMAIL_TAKEN',
        409
      );
    }

    const userId = randomUUID();
    const headyEmail = `${username.toLowerCase()}@headyme.com`;
    const now = new Date().toISOString();

    // ── Database Transaction ──────────────────────────────────────────────────
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Create user record
      await client.query(
        `INSERT INTO users (
          id, username, email, heady_email, display_name, avatar_url,
          role, tier, password_hash, created_at, updated_at,
          last_login, mfa_enabled, email_verified,
          permissions, preferences, onboarding_completed,
          failed_attempts, locked_until
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          NULL, FALSE, FALSE,
          $12, $13, FALSE,
          0, NULL
        )`,
        [
          userId,
          username.toLowerCase(),
          email.toLowerCase(),
          headyEmail,
          displayName || username,
          avatarUrl,
          role,
          tier,
          passwordHash,
          now,
          now,
          JSON.stringify(this._defaultPermissions(role, tier)),
          JSON.stringify(DEFAULT_PREFERENCES),
        ]
      );

      // Link OAuth account if applicable
      if (oauthProvider && oauthProviderId) {
        await client.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, created_at)
           VALUES ($1, $2, $3, $4)`,
          [userId, oauthProvider, oauthProviderId, now]
        );
      }

      // Create HeadyBuddy configuration
      await client.query(
        `INSERT INTO buddy_configs (user_id, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, JSON.stringify(DEFAULT_BUDDY_CONFIG), now, now]
      );

      // Create HeadyBee swarm configuration
      await client.query(
        `INSERT INTO bee_configs (user_id, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, JSON.stringify(DEFAULT_BEE_CONFIG), now, now]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new ProvisionError(
        `Failed to create user record: ${err.message}`,
        'PROVISION_DB_ERROR',
        500
      );
    } finally {
      client.release();
    }

    // ── Post-creation Tasks (non-transactional, best-effort) ──────────────────
    const results = await Promise.allSettled([
      this._createVectorMemoryNamespace(userId, username),
      this._provisionEmailAccount(username, headyEmail, userId),
      this._generateApiKeyPair(userId),
      this._sendWelcomeEmail(userId, email, username, displayName),
    ]);

    // Collect API keys (must succeed)
    const apiKeyResult = results[2];
    let apiKeys = null;
    if (apiKeyResult.status === 'fulfilled') {
      apiKeys = apiKeyResult.value;
    } else {
      console.error('[AccountProvisioner] API key generation failed:', apiKeyResult.reason);
      // Retry synchronously — API keys are critical
      try {
        apiKeys = await this._generateApiKeyPair(userId);
      } catch (e) {
        console.error('[AccountProvisioner] API key retry failed:', e.message);
      }
    }

    // Log any non-critical failures
    results.forEach((r, i) => {
      if (r.status === 'rejected' && i !== 2) {
        const tasks = ['vector-namespace', 'email-provisioning', 'api-keys', 'welcome-email'];
        console.error(`[AccountProvisioner] ${tasks[i]} failed:`, r.reason?.message);
      }
    });

    // Generate email verification token
    const verificationToken = await this.authProvider.generateEmailVerificationToken(
      userId,
      email
    );

    // Fetch the created user
    const userResult = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    return {
      user: this._sanitizeUser(user),
      apiKeys,
      verificationToken,
      headyEmail,
    };
  }

  // ── Vector Memory Namespace ────────────────────────────────────────────────

  /**
   * Create a dedicated vector memory namespace for the user in the vector DB.
   * Supports Pinecone, Weaviate, and Qdrant.
   *
   * @param {string} userId   - User UUID
   * @param {string} username - Username (used as namespace name)
   */
  async _createVectorMemoryNamespace(userId, username) {
    const namespace = `user_${userId.replace(/-/g, '_')}`;

    if (this.config.vectorDb?.provider === 'pinecone') {
      await this._createPineconeNamespace(namespace);
    } else if (this.config.vectorDb?.provider === 'qdrant') {
      await this._createQdrantCollection(namespace);
    } else if (this.config.vectorDb?.provider === 'weaviate') {
      await this._createWeaviateClass(namespace, userId);
    }

    // Store namespace mapping
    await this.db.query(
      `INSERT INTO vector_namespaces (user_id, namespace, provider, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET namespace = $2, provider = $3`,
      [userId, namespace, this.config.vectorDb?.provider || 'none']
    );

    console.log(`[AccountProvisioner] Vector namespace "${namespace}" created for user ${userId}`);
    return namespace;
  }

  /** @private */
  async _createPineconeNamespace(namespace) {
    // Pinecone namespaces are implicit — a metadata-filtered upsert initializes them.
    // We upsert a sentinel record to mark namespace creation.
    const apiKey = this.config.vectorDb.apiKey;
    const indexUrl = this.config.vectorDb.indexUrl;

    const resp = await fetch(`${indexUrl}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namespace,
        vectors: [{
          id: '__init__',
          values: new Array(1536).fill(0),
          metadata: { type: 'namespace_init', created_at: new Date().toISOString() },
        }],
      }),
    });
    if (!resp.ok) throw new Error(`Pinecone upsert failed: ${await resp.text()}`);
  }

  /** @private */
  async _createQdrantCollection(namespace) {
    const url = this.config.vectorDb.url;
    const resp = await fetch(`${url}/collections/${namespace}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: { size: 1536, distance: 'Cosine' },
        optimizers_config: { default_segment_number: 2 },
      }),
    });
    if (!resp.ok && resp.status !== 409) { // 409 = already exists
      throw new Error(`Qdrant collection creation failed: ${await resp.text()}`);
    }
  }

  /** @private */
  async _createWeaviateClass(namespace, userId) {
    const url = this.config.vectorDb.url;
    const className = `HeadyMemory_${namespace}`;
    const resp = await fetch(`${url}/v1/schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.vectorDb.apiKey}` },
      body: JSON.stringify({
        class: className,
        description: `HeadyBuddy memory for user ${userId}`,
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'content', dataType: ['text'] },
          { name: 'userId', dataType: ['string'] },
          { name: 'timestamp', dataType: ['date'] },
          { name: 'category', dataType: ['string'] },
        ],
      }),
    });
    if (!resp.ok && resp.status !== 422) { // 422 = class already exists
      throw new Error(`Weaviate class creation failed: ${await resp.text()}`);
    }
  }

  // ── Email Account Provisioning ─────────────────────────────────────────────

  /**
   * Provision a {username}@headyme.com email account.
   * Supports Cloudflare Email Routing (forwarding) or Mailcow (full mailbox).
   *
   * @param {string} username   - Username
   * @param {string} headyEmail - Full @headyme.com email address
   * @param {string} userId     - User UUID
   */
  async _provisionEmailAccount(username, headyEmail, userId) {
    const provider = this.config.email?.provider;

    if (provider === 'cloudflare') {
      await this._provisionCloudflareEmailRouting(username, headyEmail, userId);
    } else if (provider === 'mailcow') {
      await this._provisionMailcowMailbox(username, headyEmail, userId);
    } else {
      // No email provider configured — store as placeholder
      console.warn('[AccountProvisioner] No email provider configured. Email routing skipped.');
    }

    // Store email provisioning record
    await this.db.query(
      `INSERT INTO email_accounts (user_id, address, provider, status, created_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [userId, headyEmail, provider || 'none']
    );
  }

  /** @private */
  async _provisionCloudflareEmailRouting(username, headyEmail, userId) {
    const { accountId, zoneId, apiToken } = this.config.email.cloudflare;
    const forwardTo = (await this.db.query('SELECT email FROM users WHERE id = $1', [userId])).rows[0]?.email;

    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actions: [{ type: 'forward', value: [forwardTo] }],
          enabled: true,
          matchers: [{ field: 'to', type: 'literal', value: headyEmail }],
          name: `User routing: ${username}`,
          priority: 1,
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json();
      throw new ProvisionError(
        `Cloudflare email routing failed: ${JSON.stringify(err.errors)}`,
        'PROVISION_EMAIL_ROUTING_FAILED',
        502
      );
    }

    const data = await resp.json();
    return data.result;
  }

  /** @private */
  async _provisionMailcowMailbox(username, headyEmail, userId) {
    const { apiUrl, apiKey } = this.config.email.mailcow;

    // Generate a strong random mailbox password
    const mailboxPassword = crypto.randomBytes(20).toString('base64url');

    const resp = await fetch(`${apiUrl}/api/v1/add/mailbox`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        local_part: username.toLowerCase(),
        domain: 'headyme.com',
        name: username,
        password: mailboxPassword,
        password2: mailboxPassword,
        active: 1,
        quota: this._getMailboxQuota(this.config.tier || 'free'),
      }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new ProvisionError(
        `Mailcow mailbox creation failed: ${JSON.stringify(err)}`,
        'PROVISION_MAILBOX_FAILED',
        502
      );
    }

    // Store the generated password encrypted (user can change later)
    const encryptedPw = this._encryptValue(mailboxPassword);
    await this.db.query(
      `UPDATE email_accounts SET mailbox_password_enc = $1 WHERE user_id = $2`,
      [encryptedPw, userId]
    );

    return { success: true };
  }

  /** @private */
  _getMailboxQuota(tier) {
    const quotas = { free: 1024, pro: 10240, enterprise: 102400 }; // MB
    return quotas[tier] || quotas.free;
  }

  // ── API Key Generation ─────────────────────────────────────────────────────

  /**
   * Generate a public/private API key pair for programmatic access.
   * Returns the plaintext key only once — only the hash is stored.
   *
   * @param {string} userId   - User UUID
   * @param {string} [name]   - Key name/label (default: 'Default Key')
   * @param {string[]} [scopes] - Allowed scopes
   * @returns {Promise<{keyId: string, publicKey: string, secretKey: string}>}
   */
  async _generateApiKeyPair(userId, name = 'Default Key', scopes = ['heady:read', 'heady:write']) {
    const keyId = `hk_${randomUUID().replace(/-/g, '')}`;
    const secretBytes = crypto.randomBytes(40);
    const secretKey = `hs_${secretBytes.toString('base64url')}`;

    // Hash with SHA-256 for storage (fast lookup, not password storage)
    const secretHash = crypto.createHash('sha256').update(secretKey).digest('hex');

    await this.db.query(
      `INSERT INTO api_keys (id, user_id, name, secret_hash, scopes, created_at, last_used, active)
       VALUES ($1, $2, $3, $4, $5, NOW(), NULL, TRUE)`,
      [keyId, userId, name, secretHash, JSON.stringify(scopes)]
    );

    // Return plaintext secret only once
    return { keyId, secretKey };
  }

  /**
   * Generate an additional API key for a user (via API endpoint).
   * @param {string}   userId  - User UUID
   * @param {string}   name    - Key name
   * @param {string[]} scopes  - Requested scopes
   * @returns {Promise<{keyId: string, secretKey: string}>}
   */
  async generateApiKey(userId, name, scopes) {
    // Check per-user key limits
    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND active = TRUE',
      [userId]
    );
    const count = parseInt(countResult.rows[0].count, 10);
    const maxKeys = this.config.limits?.maxApiKeys ?? 10;

    if (count >= maxKeys) {
      throw new ProvisionError(
        `Maximum of ${maxKeys} API keys allowed. Revoke existing keys to create new ones.`,
        'PROVISION_API_KEY_LIMIT',
        400
      );
    }

    return this._generateApiKeyPair(userId, name, scopes);
  }

  /**
   * Revoke an API key.
   * @param {string} userId - User UUID (ownership check)
   * @param {string} keyId  - Key ID to revoke
   */
  async revokeApiKey(userId, keyId) {
    const result = await this.db.query(
      'UPDATE api_keys SET active = FALSE, revoked_at = NOW() WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );
    if (result.rowCount === 0) {
      throw new ProvisionError('API key not found.', 'PROVISION_KEY_NOT_FOUND', 404);
    }
  }

  /**
   * Verify an API key and return the associated user/scopes.
   * @param {string} secretKey - Plaintext secret key from request header
   * @returns {Promise<{userId: string, scopes: string[], keyId: string}>}
   */
  async verifyApiKey(secretKey) {
    if (!secretKey?.startsWith('hs_')) {
      throw new AuthError('Invalid API key format.', 'AUTH_INVALID_API_KEY', 401);
    }

    const secretHash = crypto.createHash('sha256').update(secretKey).digest('hex');
    const result = await this.db.query(
      `SELECT ak.*, u.role, u.tier FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.secret_hash = $1 AND ak.active = TRUE`,
      [secretHash]
    );

    if (result.rows.length === 0) {
      throw new AuthError('Invalid or revoked API key.', 'AUTH_INVALID_API_KEY', 401);
    }

    const key = result.rows[0];

    // Update last_used asynchronously (non-blocking)
    this.db.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [key.id]).catch(() => {});

    return {
      userId: key.user_id,
      keyId: key.id,
      scopes: JSON.parse(key.scopes),
      role: key.role,
      tier: key.tier,
    };
  }

  // ── Welcome Email ──────────────────────────────────────────────────────────

  /**
   * Send a welcome email with the email verification link.
   * @private
   */
  async _sendWelcomeEmail(userId, email, username, displayName) {
    const token = await this.authProvider.generateEmailVerificationToken(userId, email);
    const verifyUrl = `${this.config.baseUrl}/auth/verify-email?token=${token}`;

    await this.emailClient.sendTransactional({
      to: email,
      subject: 'Welcome to Heady — Verify your email',
      templateId: 'welcome',
      variables: {
        displayName: displayName || username,
        username,
        headyEmail: `${username}@headyme.com`,
        verifyUrl,
        loginUrl: `${this.config.baseUrl}/login`,
        year: new Date().getFullYear(),
      },
    });
  }

  // ── Profile Updates ────────────────────────────────────────────────────────

  /**
   * Update user profile fields.
   * @param {string} userId  - User UUID
   * @param {object} updates - Fields to update (display_name, avatar_url, preferences)
   * @returns {Promise<object>} Updated user record
   */
  async updateProfile(userId, updates) {
    const allowed = ['display_name', 'avatar_url', 'preferences'];
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      fields.push(`${key} = $${idx++}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    if (fields.length === 0) {
      throw new ProvisionError('No valid fields to update.', 'PROVISION_NO_FIELDS', 400);
    }

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(userId);

    const result = await this.db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return this._sanitizeUser(result.rows[0]);
  }

  /**
   * Mark onboarding as completed for a user.
   * @param {string} userId - User UUID
   */
  async completeOnboarding(userId) {
    await this.db.query(
      'UPDATE users SET onboarding_completed = TRUE, updated_at = NOW() WHERE id = $1',
      [userId]
    );
    await this.db.query(
      `UPDATE buddy_configs SET config = jsonb_set(config, '{onboarding_completed}', 'true'), updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }

  // ── Private Utilities ──────────────────────────────────────────────────────

  /** @private */
  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** @private */
  _sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, mfa_secret, mfa_backup_codes, ...safe } = user;
    return safe;
  }

  /** @private */
  _defaultPermissions(role, tier) {
    const base = {
      scopes: ['heady:read'],
      filesystem: { access: false, paths: [] },
      vector_memory: { read: true, write: true, admin: false },
      llm_providers: { models: ['gpt-4o-mini'], customProviders: false },
      mcp_tools: { enabled: false, tools: [] },
      api_endpoints: { rateLimit: 100 }, // requests/minute
    };

    if (tier === 'pro' || tier === 'enterprise') {
      base.scopes.push('heady:write', 'heady:mcp', 'heady:vector', 'heady:llm');
      base.llm_providers.models = ['gpt-4o', 'claude-3-5-sonnet', 'gemini-2-0-flash'];
      base.mcp_tools.enabled = true;
      base.api_endpoints.rateLimit = 1000;
    }

    if (tier === 'enterprise' || role === 'admin') {
      base.scopes.push('heady:admin');
      base.llm_providers.customProviders = true;
      base.api_endpoints.rateLimit = 10000;
    }

    return base;
  }

  /** @private */
  _encryptValue(value) {
    const key = Buffer.from(this.config.encryptionKey || crypto.randomBytes(32).toString('hex'), 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key.slice(0, 32), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }
}

export default AccountProvisioner;

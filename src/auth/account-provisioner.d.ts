/**
 * Provisioning-specific error.
 */
export class ProvisionError extends HeadyError {
    constructor(message: any, code?: string, status?: number, meta?: {});
}
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
    constructor({ db, redis, emailClient, authProvider, config }: {
        db: object;
        redis: object;
        emailClient: object;
        authProvider: object;
        config: object;
    });
    db: object;
    redis: object;
    emailClient: object;
    authProvider: object;
    config: object;
    /**
     * Validate a username against all format and availability rules.
     *
     * @param {string} username - Desired username
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    validateUsername(username: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Check a blocklist stored in Redis for banned usernames.
     * @private
     */
    private _isBlockedUsername;
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
    provision({ username, email, displayName, avatarUrl, role, tier, passwordHash, oauthProvider, oauthProviderId, metadata, }: {
        username: string;
    }): Promise<{
        user: object;
        apiKeys: object;
        verificationToken: string;
    }>;
    /**
     * Create a dedicated vector memory namespace for the user in the vector DB.
     * Supports Pinecone, Weaviate, and Qdrant.
     *
     * @param {string} userId   - User UUID
     * @param {string} username - Username (used as namespace name)
     */
    _createVectorMemoryNamespace(userId: string, username: string): Promise<string>;
    /** @private */
    private _createPineconeNamespace;
    /** @private */
    private _createQdrantCollection;
    /** @private */
    private _createWeaviateClass;
    /**
     * Provision a {username}@headyme.com email account.
     * Supports Cloudflare Email Routing (forwarding) or Mailcow (full mailbox).
     *
     * @param {string} username   - Username
     * @param {string} headyEmail - Full @headyme.com email address
     * @param {string} userId     - User UUID
     */
    _provisionEmailAccount(username: string, headyEmail: string, userId: string): Promise<void>;
    /** @private */
    private _provisionCloudflareEmailRouting;
    /** @private */
    private _provisionMailcowMailbox;
    /** @private */
    private _getMailboxQuota;
    /**
     * Generate a public/private API key pair for programmatic access.
     * Returns the plaintext key only once — only the hash is stored.
     *
     * @param {string} userId   - User UUID
     * @param {string} [name]   - Key name/label (default: 'Default Key')
     * @param {string[]} [scopes] - Allowed scopes
     * @returns {Promise<{keyId: string, publicKey: string, secretKey: string}>}
     */
    _generateApiKeyPair(userId: string, name?: string, scopes?: string[]): Promise<{
        keyId: string;
        publicKey: string;
        secretKey: string;
    }>;
    /**
     * Generate an additional API key for a user (via API endpoint).
     * @param {string}   userId  - User UUID
     * @param {string}   name    - Key name
     * @param {string[]} scopes  - Requested scopes
     * @returns {Promise<{keyId: string, secretKey: string}>}
     */
    generateApiKey(userId: string, name: string, scopes: string[]): Promise<{
        keyId: string;
        secretKey: string;
    }>;
    /**
     * Revoke an API key.
     * @param {string} userId - User UUID (ownership check)
     * @param {string} keyId  - Key ID to revoke
     */
    revokeApiKey(userId: string, keyId: string): Promise<void>;
    /**
     * Verify an API key and return the associated user/scopes.
     * @param {string} secretKey - Plaintext secret key from request header
     * @returns {Promise<{userId: string, scopes: string[], keyId: string}>}
     */
    verifyApiKey(secretKey: string): Promise<{
        userId: string;
        scopes: string[];
        keyId: string;
    }>;
    /**
     * Send a welcome email with the email verification link.
     * @private
     */
    private _sendWelcomeEmail;
    /**
     * Update user profile fields.
     * @param {string} userId  - User UUID
     * @param {object} updates - Fields to update (display_name, avatar_url, preferences)
     * @returns {Promise<object>} Updated user record
     */
    updateProfile(userId: string, updates: object): Promise<object>;
    /**
     * Mark onboarding as completed for a user.
     * @param {string} userId - User UUID
     */
    completeOnboarding(userId: string): Promise<void>;
    /** @private */
    private _isValidEmail;
    /** @private */
    private _sanitizeUser;
    /** @private */
    private _defaultPermissions;
    /** @private */
    private _encryptValue;
}
export default AccountProvisioner;
import { HeadyError } from './auth-provider.js';
//# sourceMappingURL=account-provisioner.d.ts.map
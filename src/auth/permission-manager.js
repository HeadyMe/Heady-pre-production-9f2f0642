/**
 * @fileoverview HeadyPermissionManager — Role-based access control and resource
 * permission system for the Heady sovereign AI platform.
 *
 * Features:
 * - RBAC with roles: admin, enterprise, pro, user, guest
 * - Resource types: filesystem, vector-memory, llm-providers, mcp-tools,
 *   api-endpoints, ui-projections
 * - Permission levels: read, write, execute, admin
 * - Filesystem access control with explicit user grants
 * - Permission request/approval flow
 * - Scope-based API permissions (heady:*)
 * - Rate limit tiers per role
 *
 * @module auth/permission-manager
 */

import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { HeadyError } from './auth-provider.js';

// ─── Permission Error ─────────────────────────────────────────────────────────

export class PermissionError extends HeadyError {
  constructor(message, code = 'PERMISSION_DENIED', status = 403, meta = {}) {
    super(message, code, status, meta);
    this.name = 'PermissionError';
  }
}

// ─── Role Definitions ─────────────────────────────────────────────────────────

/**
 * Role hierarchy — higher index = more privilege.
 * A role implicitly has all permissions of lower-indexed roles.
 */
export const ROLES = ['guest', 'user', 'pro', 'enterprise', 'admin'];

/**
 * Role → level index mapping for quick comparison.
 * @type {Object<string, number>}
 */
export const ROLE_LEVELS = Object.fromEntries(ROLES.map((r, i) => [r, i]));

// ─── Resource Type Definitions ────────────────────────────────────────────────

export const RESOURCE_TYPES = {
  FILESYSTEM: 'filesystem',
  VECTOR_MEMORY: 'vector-memory',
  LLM_PROVIDERS: 'llm-providers',
  MCP_TOOLS: 'mcp-tools',
  API_ENDPOINTS: 'api-endpoints',
  UI_PROJECTIONS: 'ui-projections',
  EMAIL: 'email',
  SWARM: 'swarm',
};

// ─── Permission Levels ────────────────────────────────────────────────────────

export const PERMISSION_LEVELS = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  EXECUTE: 3,
  ADMIN: 4,
};

export const PERMISSION_NAMES = Object.fromEntries(
  Object.entries(PERMISSION_LEVELS).map(([k, v]) => [v, k.toLowerCase()])
);

// ─── API Scopes ───────────────────────────────────────────────────────────────

export const API_SCOPES = {
  'heady:read': { description: 'Read access to user data and resources', level: PERMISSION_LEVELS.READ },
  'heady:write': { description: 'Write access to user data and resources', level: PERMISSION_LEVELS.WRITE },
  'heady:admin': { description: 'Administrative access', level: PERMISSION_LEVELS.ADMIN },
  'heady:mcp': { description: 'Access to MCP tool integrations', level: PERMISSION_LEVELS.EXECUTE },
  'heady:vector': { description: 'Vector memory read/write', level: PERMISSION_LEVELS.WRITE },
  'heady:llm': { description: 'LLM provider access', level: PERMISSION_LEVELS.EXECUTE },
  'heady:email': { description: 'Email account access', level: PERMISSION_LEVELS.WRITE },
  'heady:swarm': { description: 'HeadyBee swarm control', level: PERMISSION_LEVELS.EXECUTE },
  'heady:fs': { description: 'Filesystem access (explicitly granted paths)', level: PERMISSION_LEVELS.READ },
};

// ─── Rate Limit Tiers ─────────────────────────────────────────────────────────

/**
 * Rate limit configurations per role.
 * Values are requests per window period.
 */
export const RATE_LIMITS = {
  guest: {
    api: { requests: 10, windowSeconds: 60 },
    llm: { requests: 5, windowSeconds: 60 },
    search: { requests: 20, windowSeconds: 60 },
    email: { requests: 0, windowSeconds: 60 },
  },
  user: {
    api: { requests: 100, windowSeconds: 60 },
    llm: { requests: 30, windowSeconds: 60 },
    search: { requests: 100, windowSeconds: 60 },
    email: { requests: 10, windowSeconds: 60 },
  },
  pro: {
    api: { requests: 1000, windowSeconds: 60 },
    llm: { requests: 200, windowSeconds: 60 },
    search: { requests: 500, windowSeconds: 60 },
    email: { requests: 100, windowSeconds: 60 },
  },
  enterprise: {
    api: { requests: 5000, windowSeconds: 60 },
    llm: { requests: 1000, windowSeconds: 60 },
    search: { requests: 2000, windowSeconds: 60 },
    email: { requests: 500, windowSeconds: 60 },
  },
  admin: {
    api: { requests: 100000, windowSeconds: 60 },
    llm: { requests: 10000, windowSeconds: 60 },
    search: { requests: 10000, windowSeconds: 60 },
    email: { requests: 10000, windowSeconds: 60 },
  },
};

// ─── Default Role Permissions ─────────────────────────────────────────────────

/**
 * Default resource permissions granted to each role.
 * These are evaluated when no user-specific override exists.
 */
const DEFAULT_ROLE_PERMISSIONS = {
  guest: {
    [RESOURCE_TYPES.VECTOR_MEMORY]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.LLM_PROVIDERS]: PERMISSION_LEVELS.READ,
    [RESOURCE_TYPES.MCP_TOOLS]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.API_ENDPOINTS]: PERMISSION_LEVELS.READ,
    [RESOURCE_TYPES.UI_PROJECTIONS]: PERMISSION_LEVELS.READ,
    [RESOURCE_TYPES.EMAIL]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.SWARM]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.FILESYSTEM]: PERMISSION_LEVELS.NONE,
  },
  user: {
    [RESOURCE_TYPES.VECTOR_MEMORY]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.LLM_PROVIDERS]: PERMISSION_LEVELS.READ,
    [RESOURCE_TYPES.MCP_TOOLS]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.API_ENDPOINTS]: PERMISSION_LEVELS.READ,
    [RESOURCE_TYPES.UI_PROJECTIONS]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.EMAIL]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.SWARM]: PERMISSION_LEVELS.NONE,
    [RESOURCE_TYPES.FILESYSTEM]: PERMISSION_LEVELS.NONE, // Must be explicitly granted
  },
  pro: {
    [RESOURCE_TYPES.VECTOR_MEMORY]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.LLM_PROVIDERS]: PERMISSION_LEVELS.EXECUTE,
    [RESOURCE_TYPES.MCP_TOOLS]: PERMISSION_LEVELS.EXECUTE,
    [RESOURCE_TYPES.API_ENDPOINTS]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.UI_PROJECTIONS]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.EMAIL]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.SWARM]: PERMISSION_LEVELS.WRITE,
    [RESOURCE_TYPES.FILESYSTEM]: PERMISSION_LEVELS.NONE,
  },
  enterprise: {
    [RESOURCE_TYPES.VECTOR_MEMORY]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.LLM_PROVIDERS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.MCP_TOOLS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.API_ENDPOINTS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.UI_PROJECTIONS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.EMAIL]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.SWARM]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.FILESYSTEM]: PERMISSION_LEVELS.NONE,
  },
  admin: {
    [RESOURCE_TYPES.VECTOR_MEMORY]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.LLM_PROVIDERS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.MCP_TOOLS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.API_ENDPOINTS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.UI_PROJECTIONS]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.EMAIL]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.SWARM]: PERMISSION_LEVELS.ADMIN,
    [RESOURCE_TYPES.FILESYSTEM]: PERMISSION_LEVELS.ADMIN,
  },
};

// ─── PermissionManager Class ──────────────────────────────────────────────────

/**
 * PermissionManager enforces RBAC and resource-level access control
 * across the entire Heady platform.
 *
 * Usage:
 * ```js
 * const pm = new PermissionManager({ db, redis, config });
 *
 * // Check if user can access a resource
 * await pm.require(userId, RESOURCE_TYPES.MCP_TOOLS, PERMISSION_LEVELS.EXECUTE);
 *
 * // Check filesystem access to a specific path
 * await pm.requireFilesystemAccess(userId, '/home/user/projects', 'write');
 * ```
 */
export class PermissionManager {
  /**
   * @param {object} opts
   * @param {object} opts.db     - PostgreSQL client (pg.Pool)
   * @param {object} opts.redis  - Redis client (ioredis)
   * @param {object} opts.config - Platform config
   */
  constructor({ db, redis, config }) {
    this.db = db;
    this.redis = redis;
    this.config = config;
  }

  // ── Permission Checks ──────────────────────────────────────────────────────

  /**
   * Check if a user has at least the specified permission level on a resource.
   *
   * @param {string} userId       - User UUID
   * @param {string} resourceType - One of RESOURCE_TYPES
   * @param {number} required     - Minimum PERMISSION_LEVELS value required
   * @returns {Promise<boolean>}
   */
  async check(userId, resourceType, required) {
    const user = await this._getCachedUser(userId);
    if (!user) return false;

    // Admins have full access to everything
    if (user.role === 'admin') return true;

    // Get effective permission (user-specific override or role default)
    const effective = await this._effectivePermission(user, resourceType);
    return effective >= required;
  }

  /**
   * Require a permission level — throws PermissionError if denied.
   *
   * @param {string} userId       - User UUID
   * @param {string} resourceType - Resource type
   * @param {number} required     - Required permission level
   * @throws {PermissionError}
   */
  async require(userId, resourceType, required) {
    const granted = await this.check(userId, resourceType, required);
    if (!granted) {
      const levelName = PERMISSION_NAMES[required] || 'unknown';
      throw new PermissionError(
        `You do not have ${levelName} permission for resource type: ${resourceType}.`,
        'PERMISSION_DENIED',
        403,
        { resourceType, required: levelName }
      );
    }
  }

  /**
   * Check scope-based API permission.
   * @param {string[]} userScopes    - Scopes granted to the token/key
   * @param {string}   requiredScope - Scope required for the action
   * @returns {boolean}
   */
  checkScope(userScopes, requiredScope) {
    if (!Array.isArray(userScopes)) return false;

    // Admin scope grants everything
    if (userScopes.includes('heady:admin')) return true;

    return userScopes.includes(requiredScope);
  }

  /**
   * Require a scope — throws PermissionError if not present.
   * @param {string[]} userScopes    - Token scopes
   * @param {string}   requiredScope - Required scope
   */
  requireScope(userScopes, requiredScope) {
    if (!this.checkScope(userScopes, requiredScope)) {
      throw new PermissionError(
        `Missing required scope: ${requiredScope}.`,
        'PERMISSION_MISSING_SCOPE',
        403,
        { requiredScope }
      );
    }
  }

  // ── Filesystem Access Control ──────────────────────────────────────────────

  /**
   * Check if a user has access to a specific filesystem path.
   * Filesystem access is never granted by default — it must be explicitly
   * granted by the user themselves.
   *
   * @param {string} userId      - User UUID
   * @param {string} path        - Filesystem path being accessed
   * @param {string} [level]     - 'read' | 'write' | 'execute' | 'admin'
   * @returns {Promise<boolean>}
   */
  async checkFilesystemAccess(userId, path, level = 'read') {
    const required = PERMISSION_LEVELS[level.toUpperCase()] ?? PERMISSION_LEVELS.READ;

    const grants = await this._getFilesystemGrants(userId);
    if (!grants.length) return false;

    const normalizedPath = this._normalizePath(path);

    for (const grant of grants) {
      if (!grant.active) continue;
      if (grant.expires_at && new Date(grant.expires_at) < new Date()) continue;

      const grantedPath = this._normalizePath(grant.path);
      const grantLevel = PERMISSION_LEVELS[grant.level.toUpperCase()] ?? PERMISSION_LEVELS.NONE;

      // Check if path is within the granted path (prefix match)
      if (normalizedPath.startsWith(grantedPath) && grantLevel >= required) {
        return true;
      }
    }

    return false;
  }

  /**
   * Require filesystem access — throws if denied.
   * @param {string} userId - User UUID
   * @param {string} path   - Path being accessed
   * @param {string} level  - Access level required
   */
  async requireFilesystemAccess(userId, path, level = 'read') {
    const granted = await this.checkFilesystemAccess(userId, path, level);
    if (!granted) {
      throw new PermissionError(
        `Filesystem ${level} access is not granted for path: ${path}. ` +
        'Grant access via Settings > Permissions.',
        'PERMISSION_FILESYSTEM_DENIED',
        403,
        { path, level }
      );
    }
  }

  // ── Permission Request / Approval Flow ────────────────────────────────────

  /**
   * Request access to a resource or filesystem path.
   * Creates a pending permission request that must be approved.
   *
   * @param {string}  requestorId  - User UUID requesting access
   * @param {object}  request
   * @param {string}  request.resourceType - Resource type (or 'filesystem')
   * @param {string}  [request.path]       - Filesystem path (if resourceType='filesystem')
   * @param {string}  request.level        - Desired permission level
   * @param {string}  [request.reason]     - Reason for the request
   * @param {string}  [request.targetId]   - Target resource or user ID (if applicable)
   * @returns {Promise<object>} Permission request record
   */
  async requestPermission(requestorId, { resourceType, path, level, reason, targetId }) {
    if (!Object.values(RESOURCE_TYPES).includes(resourceType)) {
      throw new PermissionError(
        `Invalid resource type: ${resourceType}.`,
        'PERMISSION_INVALID_RESOURCE',
        400
      );
    }

    const validLevels = ['read', 'write', 'execute', 'admin'];
    if (!validLevels.includes(level)) {
      throw new PermissionError(
        `Invalid permission level: ${level}. Must be one of: ${validLevels.join(', ')}.`,
        'PERMISSION_INVALID_LEVEL',
        400
      );
    }

    const requestId = randomUUID();

    await this.db.query(
      `INSERT INTO permission_requests
         (id, requestor_id, resource_type, path, level, reason, target_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
      [requestId, requestorId, resourceType, path || null, level, reason || null, targetId || null]
    );

    // If it's a filesystem request, auto-approve since the user is granting
    // access to their own filesystem (self-sovereign model)
    if (resourceType === RESOURCE_TYPES.FILESYSTEM) {
      await this._autoApproveFilesystemRequest(requestId, requestorId, path, level);
    }

    const result = await this.db.query(
      'SELECT * FROM permission_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0];
  }

  /**
   * Filesystem requests are self-approved — the user is granting Heady access
   * to their own files. This is the explicit consent model.
   * @private
   */
  async _autoApproveFilesystemRequest(requestId, userId, path, level) {
    await this.db.query(
      `UPDATE permission_requests
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2`,
      [userId, requestId]
    );

    await this.grantFilesystemAccess(userId, path, level, userId);
  }

  /**
   * Grant a permission (admin action, or self for filesystem).
   *
   * @param {string}  grantorId   - Admin or self user UUID
   * @param {object}  grant
   * @param {string}  grant.userId       - User to grant permission to
   * @param {string}  grant.resourceType - Resource type
   * @param {string}  grant.level        - Permission level to grant
   * @param {string}  [grant.requestId]  - Optional request ID this resolves
   * @param {Date}    [grant.expiresAt]  - Optional expiry
   * @returns {Promise<object>} Updated permissions
   */
  async grantPermission(grantorId, { userId, resourceType, level, requestId, expiresAt }) {
    const grantor = await this._getCachedUser(grantorId);
    if (!grantor) throw new PermissionError('Grantor not found.', 'PERMISSION_GRANTOR_NOT_FOUND', 403);

    // Only admins can grant non-filesystem permissions
    if (resourceType !== RESOURCE_TYPES.FILESYSTEM && grantor.role !== 'admin' && grantorId !== userId) {
      throw new PermissionError(
        'Only administrators can grant non-filesystem permissions.',
        'PERMISSION_GRANT_UNAUTHORIZED',
        403
      );
    }

    const permId = randomUUID();
    const levelValue = PERMISSION_LEVELS[level.toUpperCase()] ?? PERMISSION_LEVELS.READ;

    await this.db.query(
      `INSERT INTO user_permissions
         (id, user_id, resource_type, permission_level, granted_by, granted_at, expires_at, active)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, TRUE)
       ON CONFLICT (user_id, resource_type)
       DO UPDATE SET permission_level = $4, granted_by = $5, granted_at = NOW(),
                     expires_at = $6, active = TRUE`,
      [permId, userId, resourceType, levelValue, grantorId, expiresAt || null]
    );

    // Resolve request if provided
    if (requestId) {
      await this.db.query(
        `UPDATE permission_requests
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [grantorId, requestId]
      );
    }

    // Invalidate permission cache
    await this._invalidatePermissionCache(userId);

    return { success: true, permId, userId, resourceType, level, grantedBy: grantorId };
  }

  /**
   * Grant filesystem access to a specific path.
   *
   * @param {string} userId     - User UUID
   * @param {string} path       - Filesystem path
   * @param {string} level      - 'read' | 'write' | 'execute'
   * @param {string} grantedBy  - UUID of who granted access
   * @param {object} [options]
   * @param {Date}   [options.expiresAt] - Expiry date
   * @param {string} [options.type]      - 'local' | 'cloud' | 'repo'
   */
  async grantFilesystemAccess(userId, path, level, grantedBy, options = {}) {
    const normalizedPath = this._normalizePath(path);

    await this.db.query(
      `INSERT INTO filesystem_grants
         (id, user_id, path, level, type, granted_by, granted_at, expires_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, TRUE)
       ON CONFLICT (user_id, path)
       DO UPDATE SET level = $4, granted_by = $6, granted_at = NOW(), expires_at = $7, active = TRUE`,
      [
        randomUUID(), userId, normalizedPath, level.toLowerCase(),
        options.type || 'local', grantedBy, options.expiresAt || null,
      ]
    );

    await this._invalidatePermissionCache(userId);
    return { success: true, path: normalizedPath, level };
  }

  /**
   * Revoke filesystem access to a path.
   * @param {string} userId - User UUID
   * @param {string} path   - Path to revoke
   */
  async revokeFilesystemAccess(userId, path) {
    const normalizedPath = this._normalizePath(path);
    await this.db.query(
      'UPDATE filesystem_grants SET active = FALSE WHERE user_id = $1 AND path = $2',
      [userId, normalizedPath]
    );
    await this._invalidatePermissionCache(userId);
  }

  /**
   * List all permissions for a user.
   * @param {string} userId - User UUID
   * @returns {Promise<object>} All permission data
   */
  async listPermissions(userId) {
    const [resourcePerms, fsGrants, pendingRequests] = await Promise.all([
      this.db.query(
        'SELECT * FROM user_permissions WHERE user_id = $1 AND active = TRUE ORDER BY resource_type',
        [userId]
      ),
      this.db.query(
        'SELECT * FROM filesystem_grants WHERE user_id = $1 AND active = TRUE ORDER BY path',
        [userId]
      ),
      this.db.query(
        `SELECT * FROM permission_requests WHERE requestor_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    const user = await this._getCachedUser(userId);

    return {
      role: user?.role,
      tier: user?.tier,
      roleDefaults: DEFAULT_ROLE_PERMISSIONS[user?.role] ?? DEFAULT_ROLE_PERMISSIONS.user,
      resourcePermissions: resourcePerms.rows.map((r) => ({
        ...r,
        levelName: PERMISSION_NAMES[r.permission_level] || 'none',
      })),
      filesystemGrants: fsGrants.rows,
      pendingRequests: pendingRequests.rows,
      rateLimits: RATE_LIMITS[user?.role] ?? RATE_LIMITS.user,
      scopes: user?.permissions?.scopes ?? [],
    };
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────

  /**
   * Check and increment rate limit for a user action.
   * Uses a sliding window counter in Redis.
   *
   * @param {string} userId      - User UUID
   * @param {string} action      - Action type (api, llm, search, email)
   * @param {string} role        - User role
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
   */
  async checkRateLimit(userId, action, role) {
    const limits = RATE_LIMITS[role] ?? RATE_LIMITS.user;
    const limit = limits[action] ?? limits.api;

    const windowKey = `rl:${userId}:${action}:${Math.floor(Date.now() / (limit.windowSeconds * 1000))}`;

    const count = await this.redis.incr(windowKey);
    if (count === 1) {
      await this.redis.expire(windowKey, limit.windowSeconds + 10);
    }

    const remaining = Math.max(0, limit.requests - count);
    const windowEnd = (Math.floor(Date.now() / (limit.windowSeconds * 1000)) + 1) * limit.windowSeconds * 1000;

    return {
      allowed: count <= limit.requests,
      remaining,
      limit: limit.requests,
      resetAt: windowEnd,
    };
  }

  /**
   * Express middleware factory for rate limiting.
   * @param {string} action - Action type
   */
  rateLimitMiddleware(action) {
    return async (req, res, next) => {
      try {
        const userId = req.user?.sub;
        const role = req.user?.role ?? 'guest';

        if (!userId) {
          // Guest rate limiting by IP
          const ip = req.ip || req.socket.remoteAddress;
          const key = `rl:ip:${ip}:${action}:${Math.floor(Date.now() / 60000)}`;
          const count = await this.redis.incr(key);
          if (count === 1) await this.redis.expire(key, 70);

          if (count > 10) {
            return res.status(429).json({
              error: 'Rate limit exceeded.',
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter: 60,
            });
          }
          return next();
        }

        const result = await this.checkRateLimit(userId, action, role);

        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

        if (!result.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
          });
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  }

  // ── Express Middleware Helpers ─────────────────────────────────────────────

  /**
   * Express middleware: require a minimum role level.
   * @param {string} minRole - Minimum role required (guest/user/pro/enterprise/admin)
   */
  requireRole(minRole) {
    const minLevel = ROLE_LEVELS[minRole] ?? 1;

    return (req, res, next) => {
      const userRole = req.user?.role ?? 'guest';
      const userLevel = ROLE_LEVELS[userRole] ?? 0;

      if (userLevel < minLevel) {
        return res.status(403).json({
          error: `This action requires a ${minRole} account or higher.`,
          code: 'PERMISSION_ROLE_REQUIRED',
          required: minRole,
          current: userRole,
        });
      }
      next();
    };
  }

  /**
   * Express middleware: require a specific API scope.
   * @param {string} scope - Required scope (e.g., 'heady:write')
   */
  requireScopeMiddleware(scope) {
    return (req, res, next) => {
      const scopes = req.user?.permissions?.scopes ?? req.tokenScopes ?? [];

      if (!this.checkScope(scopes, scope)) {
        return res.status(403).json({
          error: `Missing required scope: ${scope}.`,
          code: 'PERMISSION_MISSING_SCOPE',
          required: scope,
        });
      }
      next();
    };
  }

  // ── Private Utilities ──────────────────────────────────────────────────────

  /** @private */
  async _getCachedUser(userId) {
    const cacheKey = `user:cache:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.db.query(
      'SELECT id, role, tier, permissions, email_verified FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0] || null;

    if (user) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(user)); // Cache 5 min
    }
    return user;
  }

  /** @private */
  async _effectivePermission(user, resourceType) {
    // Check user-specific override first
    const override = await this.db.query(
      `SELECT permission_level FROM user_permissions
       WHERE user_id = $1 AND resource_type = $2 AND active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [user.id, resourceType]
    );

    if (override.rows.length > 0) {
      return override.rows[0].permission_level;
    }

    // Fall back to role default
    const roleDefaults = DEFAULT_ROLE_PERMISSIONS[user.role] ?? DEFAULT_ROLE_PERMISSIONS.user;
    return roleDefaults[resourceType] ?? PERMISSION_LEVELS.NONE;
  }

  /** @private */
  async _getFilesystemGrants(userId) {
    const cacheKey = `fs:grants:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await this.db.query(
      'SELECT * FROM filesystem_grants WHERE user_id = $1 AND active = TRUE',
      [userId]
    );

    await this.redis.setex(cacheKey, 60, JSON.stringify(result.rows));
    return result.rows;
  }

  /** @private */
  async _invalidatePermissionCache(userId) {
    await this.redis.del(
      `user:cache:${userId}`,
      `fs:grants:${userId}`,
      `perms:${userId}`
    );
  }

  /** @private */
  _normalizePath(path) {
    // Normalize to absolute-style path, trailing slash only for directories
    return path
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/') || '/';
  }
}

export default PermissionManager;

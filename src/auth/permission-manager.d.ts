export class PermissionError extends HeadyError {
    constructor(message: any, code?: string, status?: number, meta?: {});
}
/**
 * Role hierarchy — higher index = more privilege.
 * A role implicitly has all permissions of lower-indexed roles.
 */
export const ROLES: string[];
/**
 * Role → level index mapping for quick comparison.
 * @type {Object<string, number>}
 */
export const ROLE_LEVELS: {
    [x: string]: number;
};
export namespace RESOURCE_TYPES {
    let FILESYSTEM: string;
    let VECTOR_MEMORY: string;
    let LLM_PROVIDERS: string;
    let MCP_TOOLS: string;
    let API_ENDPOINTS: string;
    let UI_PROJECTIONS: string;
    let EMAIL: string;
    let SWARM: string;
}
export namespace PERMISSION_LEVELS {
    let NONE: number;
    let READ: number;
    let WRITE: number;
    let EXECUTE: number;
    let ADMIN: number;
}
export const PERMISSION_NAMES: {
    [k: string]: string;
};
export const API_SCOPES: {
    'heady:read': {
        description: string;
        level: number;
    };
    'heady:write': {
        description: string;
        level: number;
    };
    'heady:admin': {
        description: string;
        level: number;
    };
    'heady:mcp': {
        description: string;
        level: number;
    };
    'heady:vector': {
        description: string;
        level: number;
    };
    'heady:llm': {
        description: string;
        level: number;
    };
    'heady:email': {
        description: string;
        level: number;
    };
    'heady:swarm': {
        description: string;
        level: number;
    };
    'heady:fs': {
        description: string;
        level: number;
    };
};
export namespace RATE_LIMITS {
    namespace guest {
        namespace api {
            let requests: number;
            let windowSeconds: number;
        }
        namespace llm {
            let requests_1: number;
            export { requests_1 as requests };
            let windowSeconds_1: number;
            export { windowSeconds_1 as windowSeconds };
        }
        namespace search {
            let requests_2: number;
            export { requests_2 as requests };
            let windowSeconds_2: number;
            export { windowSeconds_2 as windowSeconds };
        }
        namespace email {
            let requests_3: number;
            export { requests_3 as requests };
            let windowSeconds_3: number;
            export { windowSeconds_3 as windowSeconds };
        }
    }
    namespace user {
        export namespace api_1 {
            let requests_4: number;
            export { requests_4 as requests };
            let windowSeconds_4: number;
            export { windowSeconds_4 as windowSeconds };
        }
        export { api_1 as api };
        export namespace llm_1 {
            let requests_5: number;
            export { requests_5 as requests };
            let windowSeconds_5: number;
            export { windowSeconds_5 as windowSeconds };
        }
        export { llm_1 as llm };
        export namespace search_1 {
            let requests_6: number;
            export { requests_6 as requests };
            let windowSeconds_6: number;
            export { windowSeconds_6 as windowSeconds };
        }
        export { search_1 as search };
        export namespace email_1 {
            let requests_7: number;
            export { requests_7 as requests };
            let windowSeconds_7: number;
            export { windowSeconds_7 as windowSeconds };
        }
        export { email_1 as email };
    }
    namespace pro {
        export namespace api_2 {
            let requests_8: number;
            export { requests_8 as requests };
            let windowSeconds_8: number;
            export { windowSeconds_8 as windowSeconds };
        }
        export { api_2 as api };
        export namespace llm_2 {
            let requests_9: number;
            export { requests_9 as requests };
            let windowSeconds_9: number;
            export { windowSeconds_9 as windowSeconds };
        }
        export { llm_2 as llm };
        export namespace search_2 {
            let requests_10: number;
            export { requests_10 as requests };
            let windowSeconds_10: number;
            export { windowSeconds_10 as windowSeconds };
        }
        export { search_2 as search };
        export namespace email_2 {
            let requests_11: number;
            export { requests_11 as requests };
            let windowSeconds_11: number;
            export { windowSeconds_11 as windowSeconds };
        }
        export { email_2 as email };
    }
    namespace enterprise {
        export namespace api_3 {
            let requests_12: number;
            export { requests_12 as requests };
            let windowSeconds_12: number;
            export { windowSeconds_12 as windowSeconds };
        }
        export { api_3 as api };
        export namespace llm_3 {
            let requests_13: number;
            export { requests_13 as requests };
            let windowSeconds_13: number;
            export { windowSeconds_13 as windowSeconds };
        }
        export { llm_3 as llm };
        export namespace search_3 {
            let requests_14: number;
            export { requests_14 as requests };
            let windowSeconds_14: number;
            export { windowSeconds_14 as windowSeconds };
        }
        export { search_3 as search };
        export namespace email_3 {
            let requests_15: number;
            export { requests_15 as requests };
            let windowSeconds_15: number;
            export { windowSeconds_15 as windowSeconds };
        }
        export { email_3 as email };
    }
    namespace admin {
        export namespace api_4 {
            let requests_16: number;
            export { requests_16 as requests };
            let windowSeconds_16: number;
            export { windowSeconds_16 as windowSeconds };
        }
        export { api_4 as api };
        export namespace llm_4 {
            let requests_17: number;
            export { requests_17 as requests };
            let windowSeconds_17: number;
            export { windowSeconds_17 as windowSeconds };
        }
        export { llm_4 as llm };
        export namespace search_4 {
            let requests_18: number;
            export { requests_18 as requests };
            let windowSeconds_18: number;
            export { windowSeconds_18 as windowSeconds };
        }
        export { search_4 as search };
        export namespace email_4 {
            let requests_19: number;
            export { requests_19 as requests };
            let windowSeconds_19: number;
            export { windowSeconds_19 as windowSeconds };
        }
        export { email_4 as email };
    }
}
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
    constructor({ db, redis, config }: {
        db: object;
        redis: object;
        config: object;
    });
    db: object;
    redis: object;
    config: object;
    /**
     * Check if a user has at least the specified permission level on a resource.
     *
     * @param {string} userId       - User UUID
     * @param {string} resourceType - One of RESOURCE_TYPES
     * @param {number} required     - Minimum PERMISSION_LEVELS value required
     * @returns {Promise<boolean>}
     */
    check(userId: string, resourceType: string, required: number): Promise<boolean>;
    /**
     * Require a permission level — throws PermissionError if denied.
     *
     * @param {string} userId       - User UUID
     * @param {string} resourceType - Resource type
     * @param {number} required     - Required permission level
     * @throws {PermissionError}
     */
    require(userId: string, resourceType: string, required: number): Promise<void>;
    /**
     * Check scope-based API permission.
     * @param {string[]} userScopes    - Scopes granted to the token/key
     * @param {string}   requiredScope - Scope required for the action
     * @returns {boolean}
     */
    checkScope(userScopes: string[], requiredScope: string): boolean;
    /**
     * Require a scope — throws PermissionError if not present.
     * @param {string[]} userScopes    - Token scopes
     * @param {string}   requiredScope - Required scope
     */
    requireScope(userScopes: string[], requiredScope: string): void;
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
    checkFilesystemAccess(userId: string, path: string, level?: string): Promise<boolean>;
    /**
     * Require filesystem access — throws if denied.
     * @param {string} userId - User UUID
     * @param {string} path   - Path being accessed
     * @param {string} level  - Access level required
     */
    requireFilesystemAccess(userId: string, path: string, level?: string): Promise<void>;
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
    requestPermission(requestorId: string, { resourceType, path, level, reason, targetId }: {
        resourceType: string;
        path?: string | undefined;
        level: string;
        reason?: string | undefined;
        targetId?: string | undefined;
    }): Promise<object>;
    /**
     * Filesystem requests are self-approved — the user is granting Heady access
     * to their own files. This is the explicit consent model.
     * @private
     */
    private _autoApproveFilesystemRequest;
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
    grantPermission(grantorId: string, { userId, resourceType, level, requestId, expiresAt }: {
        userId: string;
        resourceType: string;
        level: string;
        requestId?: string | undefined;
        expiresAt?: Date | undefined;
    }): Promise<object>;
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
    grantFilesystemAccess(userId: string, path: string, level: string, grantedBy: string, options?: {
        expiresAt?: Date | undefined;
        type?: string | undefined;
    }): Promise<{
        success: boolean;
        path: any;
        level: string;
    }>;
    /**
     * Revoke filesystem access to a path.
     * @param {string} userId - User UUID
     * @param {string} path   - Path to revoke
     */
    revokeFilesystemAccess(userId: string, path: string): Promise<void>;
    /**
     * List all permissions for a user.
     * @param {string} userId - User UUID
     * @returns {Promise<object>} All permission data
     */
    listPermissions(userId: string): Promise<object>;
    /**
     * Check and increment rate limit for a user action.
     * Uses a sliding window counter in Redis.
     *
     * @param {string} userId      - User UUID
     * @param {string} action      - Action type (api, llm, search, email)
     * @param {string} role        - User role
     * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
     */
    checkRateLimit(userId: string, action: string, role: string): Promise<{
        allowed: boolean;
        remaining: number;
        resetAt: number;
    }>;
    /**
     * Express middleware factory for rate limiting.
     * @param {string} action - Action type
     */
    rateLimitMiddleware(action: string): (req: any, res: any, next: any) => Promise<any>;
    /**
     * Express middleware: require a minimum role level.
     * @param {string} minRole - Minimum role required (guest/user/pro/enterprise/admin)
     */
    requireRole(minRole: string): (req: any, res: any, next: any) => any;
    /**
     * Express middleware: require a specific API scope.
     * @param {string} scope - Required scope (e.g., 'heady:write')
     */
    requireScopeMiddleware(scope: string): (req: any, res: any, next: any) => any;
    /** @private */
    private _getCachedUser;
    /** @private */
    private _effectivePermission;
    /** @private */
    private _getFilesystemGrants;
    /** @private */
    private _invalidatePermissionCache;
    /** @private */
    private _normalizePath;
}
export default PermissionManager;
import { HeadyError } from './auth-provider.js';
//# sourceMappingURL=permission-manager.d.ts.map
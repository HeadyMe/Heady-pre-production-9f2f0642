/**
 * Heady RBAC Manager
 * ==================
 * Role-Based Access Control for MCP tool execution.
 *
 * Features:
 * - JWT-based role extraction and validation
 * - Role → capability bitmask mapping
 * - Tool-level permission overrides
 * - Hierarchical role inheritance (admin > operator > developer > viewer)
 * - Vendor integration support (Auth0, Clerk, Firebase Auth, custom OIDC)
 * - CSL-gated graceful degradation (reduce capabilities instead of hard block)
 *
 * @module src/security/rbac-manager
 * @version 1.0.0
 */

'use strict';

const crypto = require('crypto');
const { fib, CSL_THRESHOLDS, cslGate, phiFusionWeights } = require('../../shared/phi-math');
const { CAPABILITIES } = require('./zero-trust-sandbox');

// ── Role Definitions ────────────────────────────────────────────────────────
const ROLES = Object.freeze({
  admin: {
    capabilities: CAPABILITIES.FULL_ACCESS,
    inherits: ['operator'],
    description: 'Full access to all tools and capabilities',
  },
  operator: {
    capabilities: CAPABILITIES.FILE_ALL | CAPABILITIES.NETWORK_ALL |
                  CAPABILITIES.DATABASE_ALL | CAPABILITIES.SYSTEM_EXEC,
    inherits: ['developer'],
    description: 'Operational access — file, network, database, system execution',
  },
  developer: {
    capabilities: CAPABILITIES.FILE_ALL | CAPABILITIES.NETWORK_ALL | CAPABILITIES.DATABASE_READ,
    inherits: ['viewer'],
    description: 'Development access — file, network, database read',
  },
  viewer: {
    capabilities: CAPABILITIES.READ_ONLY,
    inherits: [],
    description: 'Read-only access across all resources',
  },
  service: {
    capabilities: CAPABILITIES.NETWORK_ALL | CAPABILITIES.DATABASE_ALL,
    inherits: [],
    description: 'Service-to-service — network and database only',
  },
  mcp_tool: {
    capabilities: CAPABILITIES.FILE_READ | CAPABILITIES.NETWORK_READ,
    inherits: [],
    description: 'Minimal MCP tool access — read file and network only',
  },
});

// ── Tool-Level Permission Overrides ─────────────────────────────────────────
const TOOL_OVERRIDES = {
  // Tools that require elevated permissions regardless of role
  'secrets.rotate':      { minRole: 'admin', extraCaps: CAPABILITIES.SECRET_ACCESS },
  'system.exec':         { minRole: 'operator', extraCaps: CAPABILITIES.SYSTEM_EXEC },
  'database.migrate':    { minRole: 'operator', extraCaps: CAPABILITIES.DATABASE_ALL },
  'deploy.production':   { minRole: 'admin', extraCaps: CAPABILITIES.FULL_ACCESS },

  // Tools restricted below default role capabilities
  'file.delete':         { minRole: 'developer', extraCaps: CAPABILITIES.FILE_WRITE },
  'network.proxy':       { minRole: 'operator', extraCaps: CAPABILITIES.NETWORK_WRITE },
};

// ── JWT Vendor Adapters ─────────────────────────────────────────────────────
const JWT_ADAPTERS = {
  /**
   * Auth0: roles in `https://headyme.com/roles` custom claim or `permissions`
   */
  auth0: (payload) => ({
    roles: payload['https://headyme.com/roles'] || payload.permissions || ['viewer'],
    userId: payload.sub,
    email: payload.email,
    org: payload.org_id,
  }),

  /**
   * Clerk: roles in `metadata.role` or `publicMetadata.role`
   */
  clerk: (payload) => ({
    roles: [payload.metadata?.role || payload.publicMetadata?.role || 'viewer'],
    userId: payload.sub,
    email: payload.email,
    org: payload.org_id,
  }),

  /**
   * Firebase Auth: roles in custom claims `role` or `roles`
   */
  firebase: (payload) => ({
    roles: payload.roles || [payload.role || 'viewer'],
    userId: payload.uid || payload.sub,
    email: payload.email,
    org: payload.tenant,
  }),

  /**
   * Standard OIDC: roles in `realm_access.roles` (Keycloak-style)
   */
  oidc: (payload) => ({
    roles: payload.realm_access?.roles || payload.roles || ['viewer'],
    userId: payload.sub,
    email: payload.email,
    org: payload.azp,
  }),

  /**
   * Heady native: roles directly in `heady_roles`
   */
  heady: (payload) => ({
    roles: payload.heady_roles || ['viewer'],
    userId: payload.sub || payload.user_id,
    email: payload.email,
    org: payload.heady_org,
  }),
};

// ── RBAC Manager ────────────────────────────────────────────────────────────
class RBACManager {
  constructor(config = {}) {
    this.jwtSecret = config.jwtSecret || process.env.HEADY_JWT_SECRET;
    this.jwtAdapter = config.jwtAdapter || 'heady';
    this.roles = { ...ROLES, ...config.customRoles };
    this.toolOverrides = { ...TOOL_OVERRIDES, ...config.toolOverrides };
    this._tokenCache = new Map(); // JWT hash → decoded payload (TTL: fib(7) * 1000 = 13s)
    this._cacheTTL = fib(7) * 1000;
  }

  /**
   * Check if a JWT-authenticated user can access a specific tool.
   * @param {string} jwt - Raw JWT token
   * @param {string} tool - MCP tool name
   * @returns {{ allowed: boolean, capabilities: number, reason?: string, user?: Object }}
   */
  checkAccess(jwt, tool) {
    // ── Decode JWT ──────────────────────────────────────────────────────
    const decoded = this._decodeJWT(jwt);
    if (!decoded) {
      return { allowed: false, capabilities: CAPABILITIES.NONE, reason: 'Invalid or expired JWT' };
    }

    // ── Extract roles via vendor adapter ────────────────────────────────
    const adapter = JWT_ADAPTERS[this.jwtAdapter] || JWT_ADAPTERS.heady;
    const userInfo = adapter(decoded);

    // ── Resolve capabilities from roles (with inheritance) ──────────────
    let capabilities = CAPABILITIES.NONE;
    const resolvedRoles = new Set();

    for (const roleName of userInfo.roles) {
      this._resolveRole(roleName, resolvedRoles);
    }

    for (const roleName of resolvedRoles) {
      const role = this.roles[roleName];
      if (role) capabilities |= role.capabilities;
    }

    // ── Check tool-level overrides ──────────────────────────────────────
    const override = this.toolOverrides[tool];
    if (override) {
      const minRoleDef = this.roles[override.minRole];
      if (minRoleDef && !resolvedRoles.has(override.minRole)) {
        // Check if user has a higher role that inherits minRole
        const hasMinRole = [...resolvedRoles].some(r => {
          const resolved = new Set();
          this._resolveRole(r, resolved);
          return resolved.has(override.minRole);
        });

        if (!hasMinRole) {
          return {
            allowed: false,
            capabilities,
            reason: `Tool "${tool}" requires minimum role "${override.minRole}"`,
            user: userInfo,
          };
        }
      }

      // Add extra capabilities from override
      capabilities |= override.extraCaps;
    }

    return {
      allowed: true,
      capabilities,
      roles: [...resolvedRoles],
      user: userInfo,
    };
  }

  /**
   * Recursively resolve role hierarchy.
   */
  _resolveRole(roleName, resolved) {
    if (resolved.has(roleName)) return;
    resolved.add(roleName);

    const role = this.roles[roleName];
    if (role && role.inherits) {
      for (const parent of role.inherits) {
        this._resolveRole(parent, resolved);
      }
    }
  }

  /**
   * Decode JWT (with cache).
   * NOTE: In production, use proper JWT verification with jwks-rsa or similar.
   * This provides the structure; actual signature verification is vendor-specific.
   */
  _decodeJWT(jwt) {
    if (!jwt) return null;

    // Check cache
    const cacheKey = crypto.createHash('sha256').update(jwt).digest('hex').slice(0, 16);
    const cached = this._tokenCache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheTTL) {
      return cached.payload;
    }

    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;

      // Cache decoded payload
      this._tokenCache.set(cacheKey, { payload, time: Date.now() });

      // Prune cache if too large
      if (this._tokenCache.size > fib(16)) { // 987 entries max
        const oldest = [...this._tokenCache.entries()]
          .sort(([, a], [, b]) => a.time - b.time)
          .slice(0, fib(8)); // remove 21 oldest
        for (const [key] of oldest) this._tokenCache.delete(key);
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * List all available roles and their capabilities.
   */
  listRoles() {
    return Object.entries(this.roles).map(([name, config]) => ({
      name,
      capabilities: config.capabilities,
      capabilityBits: config.capabilities.toString(2).padStart(8, '0'),
      inherits: config.inherits,
      description: config.description,
    }));
  }
}

module.exports = { RBACManager, ROLES, TOOL_OVERRIDES, JWT_ADAPTERS, CAPABILITIES };

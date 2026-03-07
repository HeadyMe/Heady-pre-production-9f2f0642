/**
 * ═══════════════════════════════════════════════════════════════
 * SEC-002: Role Isolation Enforcer
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Zero-trust role-based access control with permission scoping,
 * audit logging, and dynamic policy enforcement.
 */

'use strict';

const ROLES = {
    ADMIN: 'admin',
    OPERATOR: 'operator',
    DEVELOPER: 'developer',
    VIEWER: 'viewer',
    AGENT: 'agent',
    SERVICE: 'service',
};

const PERMISSIONS = {
    // System
    'system.read': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.VIEWER],
    'system.write': [ROLES.ADMIN, ROLES.OPERATOR],
    'system.deploy': [ROLES.ADMIN, ROLES.OPERATOR],
    'system.destroy': [ROLES.ADMIN],

    // Secrets
    'secrets.read': [ROLES.ADMIN, ROLES.SERVICE],
    'secrets.write': [ROLES.ADMIN],
    'secrets.rotate': [ROLES.ADMIN, ROLES.OPERATOR],

    // Agents
    'agent.spawn': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.AGENT],
    'agent.kill': [ROLES.ADMIN, ROLES.OPERATOR],
    'agent.configure': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER],
    'agent.read': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.VIEWER, ROLES.AGENT],

    // Data
    'data.read': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.VIEWER, ROLES.SERVICE],
    'data.write': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.SERVICE],
    'data.delete': [ROLES.ADMIN, ROLES.OPERATOR],
    'data.export': [ROLES.ADMIN],

    // MCP
    'mcp.tools.read': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.AGENT, ROLES.SERVICE],
    'mcp.tools.execute': [ROLES.ADMIN, ROLES.OPERATOR, ROLES.DEVELOPER, ROLES.AGENT],
    'mcp.tools.register': [ROLES.ADMIN, ROLES.OPERATOR],

    // Billing
    'billing.read': [ROLES.ADMIN],
    'billing.manage': [ROLES.ADMIN],
};

class RoleEnforcer {
    constructor(options = {}) {
        this.permissions = new Map(Object.entries(PERMISSIONS));
        this.customPolicies = new Map();
        this.auditLog = [];
        this.strictMode = options.strictMode !== false;
    }

    /**
     * Check if a role has a specific permission
     */
    hasPermission(role, permission) {
        const allowed = this.permissions.get(permission);
        if (!allowed) {
            if (this.strictMode) return false;
            return role === ROLES.ADMIN;
        }
        return allowed.includes(role);
    }

    /**
     * Enforce a permission check — throws if denied
     */
    enforce(context, permission) {
        const { role, userId, service, action } = context;
        const allowed = this.hasPermission(role, permission);

        this._audit({
            userId: userId || 'unknown',
            service: service || 'unknown',
            role,
            permission,
            action: action || permission,
            allowed,
            timestamp: new Date().toISOString(),
        });

        if (!allowed) {
            throw new AccessDeniedError(
                `Access denied: role '${role}' lacks permission '${permission}'`,
                { role, permission, userId }
            );
        }

        return true;
    }

    /**
     * Create Express middleware for route protection
     */
    middleware(requiredPermission) {
        return (req, res, next) => {
            const role = req.user?.role || req.headers['x-heady-role'] || ROLES.VIEWER;
            const userId = req.user?.id || req.headers['x-heady-user-id'] || 'anonymous';

            try {
                this.enforce(
                    { role, userId, service: req.baseUrl, action: `${req.method} ${req.path}` },
                    requiredPermission
                );
                next();
            } catch (err) {
                res.status(403).json({
                    error: 'Access Denied',
                    message: err.message,
                    required: requiredPermission,
                    yourRole: role,
                });
            }
        };
    }

    /**
     * Add a custom policy
     */
    addPolicy(name, evaluator) {
        this.customPolicies.set(name, evaluator);
    }

    /**
     * Check a custom policy
     */
    checkPolicy(name, context) {
        const evaluator = this.customPolicies.get(name);
        if (!evaluator) throw new Error(`Unknown policy: ${name}`);
        return evaluator(context);
    }

    /**
     * Get all permissions for a role
     */
    getPermissions(role) {
        const perms = [];
        for (const [perm, roles] of this.permissions) {
            if (roles.includes(role)) perms.push(perm);
        }
        return perms;
    }

    /**
     * Get audit log
     */
    getAuditLog(options = {}) {
        let log = [...this.auditLog];
        if (options.userId) log = log.filter(e => e.userId === options.userId);
        if (options.denied) log = log.filter(e => !e.allowed);
        if (options.limit) log = log.slice(-options.limit);
        return log;
    }

    _audit(entry) {
        this.auditLog.push(entry);
        if (this.auditLog.length > 10000) this.auditLog.shift();
    }
}

class AccessDeniedError extends Error {
    constructor(message, context) {
        super(message);
        this.name = 'AccessDeniedError';
        this.context = context;
        this.statusCode = 403;
    }
}

if (require.main === module) {
    const enforcer = new RoleEnforcer();

    console.log('═══ Role Isolation Enforcer ═══\n');
    for (const role of Object.values(ROLES)) {
        const perms = enforcer.getPermissions(role);
        console.log(`${role}: ${perms.length} permissions`);
    }

    // Demo enforce
    try {
        enforcer.enforce({ role: 'viewer', userId: 'test' }, 'system.deploy');
    } catch (e) {
        console.log(`\nDenied: ${e.message}`);
    }

    enforcer.enforce({ role: 'admin', userId: 'admin' }, 'system.deploy');
    console.log('Allowed: admin → system.deploy');

    console.log(`\nAudit log: ${enforcer.getAuditLog().length} entries`);
    console.log('✅ Role Enforcer operational');
}

module.exports = { RoleEnforcer, AccessDeniedError, ROLES, PERMISSIONS };

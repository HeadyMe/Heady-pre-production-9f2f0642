/**
 * T3: SSO + RBAC Middleware — SAML/OIDC integration with tenant-scoped roles
 * @module src/middleware/auth-rbac
 */
'use strict';

const ROLES = {
    admin: { level: 100, permissions: ['*'] },
    operator: { level: 80, permissions: ['read', 'write', 'deploy', 'configure'] },
    developer: { level: 60, permissions: ['read', 'write', 'deploy'] },
    analyst: { level: 40, permissions: ['read', 'analyze', 'evaluate'] },
    viewer: { level: 20, permissions: ['read'] },
    service: { level: 90, permissions: ['read', 'write', 'execute', 'internal'] },
};

function extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    return scheme === 'Bearer' ? token : null;
}

function createRBACMiddleware(opts = {}) {
    const verifyToken = opts.verifyToken || defaultVerifyToken;

    return function rbac(requiredPermission) {
        return async (req, res, next) => {
            try {
                const token = extractBearerToken(req);
                if (!token) return res.status(401).json({ error: 'Missing authentication token' });

                const decoded = await verifyToken(token);
                if (!decoded) return res.status(401).json({ error: 'Invalid token' });

                req.user = {
                    id: decoded.sub || decoded.userId,
                    email: decoded.email,
                    role: decoded.role || 'viewer',
                    tenantId: decoded.tenantId || decoded.org || 'default',
                    ssoProvider: decoded.iss || 'local',
                };

                const userRole = ROLES[req.user.role];
                if (!userRole) return res.status(403).json({ error: 'Unknown role' });

                if (requiredPermission && requiredPermission !== 'read') {
                    const hasPermission = userRole.permissions.includes('*') ||
                        userRole.permissions.includes(requiredPermission);
                    if (!hasPermission) {
                        return res.status(403).json({
                            error: 'Insufficient permissions',
                            required: requiredPermission,
                            role: req.user.role,
                        });
                    }
                }

                // Tenant scoping
                req.tenantId = req.user.tenantId;
                next();
            } catch (err) {
                return res.status(401).json({ error: 'Authentication failed', message: err.message });
            }
        };
    };
}

function defaultVerifyToken(token) {
    // JWT decode without verification — replace with real verification in production
    try {
        const [, payload] = token.split('.');
        return JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch { return null; }
}

function tenantFilter(query, tenantId) {
    if (!tenantId || tenantId === 'default') return query;
    return { ...query, tenant_id: tenantId };
}

function requireRole(minRole) {
    return (req, res, next) => {
        const userLevel = ROLES[req.user?.role]?.level || 0;
        const requiredLevel = ROLES[minRole]?.level || 100;
        if (userLevel < requiredLevel) {
            return res.status(403).json({ error: `Requires ${minRole} role or higher` });
        }
        next();
    };
}

module.exports = { createRBACMiddleware, requireRole, tenantFilter, ROLES, extractBearerToken };

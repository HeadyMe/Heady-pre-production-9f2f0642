/**
 * Multi-Tenant Isolation Layer — Tenant context management for
 * Cloud Run SaaS deployment of Heady™ Latent OS.
 *
 * Provides per-tenant data isolation, request context, resource
 * quotas, and tenant-aware routing for shared infrastructure.
 *
 * @module src/services/tenant-isolation
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

/**
 * TenantContext — carries tenant identity through async execution.
 * Uses AsyncLocalStorage for zero-overhead request-scoped isolation.
 */
class TenantContext {
    constructor() {
        const { AsyncLocalStorage } = require('async_hooks');
        this.storage = new AsyncLocalStorage();
    }

    /** Run callback within a tenant context */
    run(tenantId, callback) {
        return this.storage.run({ tenantId, startedAt: Date.now() }, callback);
    }

    /** Get current tenant ID (or null if outside tenant context) */
    getTenantId() {
        return this.storage.getStore()?.tenantId || null;
    }

    /** Get full tenant store */
    getStore() {
        return this.storage.getStore();
    }
}

/**
 * TenantIsolation — manages tenant lifecycle, quotas, and data isolation.
 */
class TenantIsolation {
    constructor(opts = {}) {
        this.context = new TenantContext();
        this.events = new EventEmitter();
        this.tenants = new Map();

        // Default quotas (φ-scaled)
        this.defaultQuotas = {
            maxAgents: Math.round(FIB[8] * PHI),       // ~55 agents
            maxProjections: FIB[7],                     // 13 projections
            maxVectorMemoryMB: Math.round(FIB[10] * PHI), // ~89 MB
            maxRequestsPerMinute: FIB[12],              // 144 req/min
            maxConcurrentTasks: FIB[6],                 // 8 tasks
            vectorDimensionLimit: FIB[13],              // 377 dimensions
        };

        this.plans = {
            free: { multiplier: 1, features: ['basic_agents', 'vector_memory'] },
            starter: { multiplier: PHI, features: ['basic_agents', 'vector_memory', 'projections', 'mcp'] },
            pro: { multiplier: PHI * PHI, features: ['basic_agents', 'vector_memory', 'projections', 'mcp', 'spatial_debug', 'midi'] },
            enterprise: { multiplier: PHI * PHI * PHI, features: ['all'] },
        };
    }

    // ─── Tenant Lifecycle ───────────────────────────────────────────

    /**
     * Register a new tenant.
     * @param {string} tenantId
     * @param {Object} opts — { plan, displayName, email }
     */
    registerTenant(tenantId, opts = {}) {
        const plan = opts.plan || 'free';
        const multiplier = this.plans[plan]?.multiplier || 1;

        const tenant = {
            id: tenantId,
            plan,
            displayName: opts.displayName || tenantId,
            email: opts.email || null,
            apiKey: crypto.randomBytes(32).toString('hex'),
            createdAt: Date.now(),
            quotas: {},
            usage: { agents: 0, projections: 0, vectorMemoryMB: 0, requests: 0, tasks: 0 },
            active: true,
        };

        // Apply plan-scaled quotas
        for (const [key, baseValue] of Object.entries(this.defaultQuotas)) {
            tenant.quotas[key] = Math.round(baseValue * multiplier);
        }

        this.tenants.set(tenantId, tenant);
        this.events.emit('tenant:registered', { tenantId, plan });
        return { id: tenantId, apiKey: tenant.apiKey, quotas: tenant.quotas };
    }

    /**
     * Deactivate a tenant (soft delete).
     */
    deactivateTenant(tenantId) {
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.active = false;
            this.events.emit('tenant:deactivated', { tenantId });
        }
    }

    /**
     * Get tenant info.
     */
    getTenant(tenantId) {
        return this.tenants.get(tenantId) || null;
    }

    // ─── Middleware ─────────────────────────────────────────────────

    /**
     * Express middleware — extracts tenant from header or API key.
     */
    middleware() {
        return (req, res, next) => {
            const tenantId = req.headers['x-heady-tenant'] ||
                req.headers['x-tenant-id'] ||
                this._extractFromApiKey(req.headers.authorization);

            if (!tenantId) {
                return res.status(401).json({ error: 'Missing tenant context' });
            }

            const tenant = this.tenants.get(tenantId);
            if (!tenant || !tenant.active) {
                return res.status(403).json({ error: 'Invalid or inactive tenant' });
            }

            // Run within tenant context
            this.context.run(tenantId, () => {
                req.tenantId = tenantId;
                req.tenant = tenant;
                next();
            });
        };
    }

    /**
     * Rate limiting middleware (per-tenant).
     */
    rateLimiter() {
        const windows = new Map(); // tenantId → { count, resetAt }

        return (req, res, next) => {
            const tenantId = req.tenantId;
            if (!tenantId) return next();

            const tenant = this.tenants.get(tenantId);
            if (!tenant) return next();

            const now = Date.now();
            const windowKey = tenantId;

            if (!windows.has(windowKey) || windows.get(windowKey).resetAt < now) {
                windows.set(windowKey, { count: 0, resetAt: now + 60000 });
            }

            const window = windows.get(windowKey);
            window.count++;
            tenant.usage.requests = window.count;

            if (window.count > tenant.quotas.maxRequestsPerMinute) {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    limit: tenant.quotas.maxRequestsPerMinute,
                    retryAfter: Math.ceil((window.resetAt - now) / 1000),
                });
            }

            next();
        };
    }

    // ─── Quota Enforcement ──────────────────────────────────────────

    /**
     * Check if tenant can create a new resource.
     * @param {string} tenantId
     * @param {string} resourceType — 'agents' | 'projections' | 'tasks'
     * @returns {{ allowed: boolean, reason?: string }}
     */
    checkQuota(tenantId, resourceType) {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) return { allowed: false, reason: 'Unknown tenant' };

        const quotaMap = {
            agents: 'maxAgents',
            projections: 'maxProjections',
            tasks: 'maxConcurrentTasks',
        };

        const quotaKey = quotaMap[resourceType];
        if (!quotaKey) return { allowed: true };

        const current = tenant.usage[resourceType] || 0;
        const limit = tenant.quotas[quotaKey];

        if (current >= limit) {
            return { allowed: false, reason: `${resourceType} limit reached (${current}/${limit})` };
        }
        return { allowed: true };
    }

    /**
     * Increment usage counter.
     */
    incrementUsage(tenantId, resourceType, delta = 1) {
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            tenant.usage[resourceType] = (tenant.usage[resourceType] || 0) + delta;
        }
    }

    // ─── Data Isolation ─────────────────────────────────────────────

    /**
     * Get tenant-scoped database schema prefix.
     */
    getSchemaPrefix(tenantId) {
        return `tenant_${tenantId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    /**
     * Get tenant-scoped Redis key prefix.
     */
    getRedisPrefix(tenantId) {
        return `heady:t:${tenantId}`;
    }

    /**
     * Get tenant-scoped vector collection name.
     */
    getVectorCollection(tenantId) {
        return `vectors_${tenantId}`;
    }

    // ─── Internal ───────────────────────────────────────────────────

    _extractFromApiKey(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const key = authHeader.slice(7);
        for (const [id, tenant] of this.tenants) {
            if (tenant.apiKey === key) return id;
        }
        return null;
    }
}

module.exports = { TenantIsolation, TenantContext };

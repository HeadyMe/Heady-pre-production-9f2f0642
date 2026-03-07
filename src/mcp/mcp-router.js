'use strict';

/**
 * MCP Gateway Router — CONN-002
 * Intelligent routing for MCP tool requests with multi-tenant support,
 * auto-discovery, and capability-based matching.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class MCPRouter extends EventEmitter {
    constructor() {
        super();
        this.servers = new Map();       // serverId → { name, url, capabilities, latency, lastSeen }
        this.tenants = new Map();       // tenantId → { serverId[], permissions }
        this.routeCache = new Map();    // toolName → serverId (LRU-style)
        this.metrics = { routed: 0, cached: 0, discovered: 0, errors: 0 };
    }

    /**
     * Register an MCP server with its capabilities.
     */
    registerServer(serverId, info) {
        this.servers.set(serverId, {
            name: info.name || serverId,
            url: info.url,
            capabilities: info.capabilities || [],
            tools: info.tools || [],
            latency: info.latency || 0,
            lastSeen: Date.now(),
            healthy: true,
        });
        this.metrics.discovered++;
        logger.logSystem(`  🔌 [MCPRouter] Registered server: ${serverId} (${(info.tools || []).length} tools)`);
        this.emit('server:registered', { serverId, info });
    }

    /**
     * Route a tool request to the best server.
     */
    route(toolName, tenantId = 'default') {
        // Check cache first
        if (this.routeCache.has(toolName)) {
            const cached = this.routeCache.get(toolName);
            const server = this.servers.get(cached);
            if (server && server.healthy) {
                this.metrics.cached++;
                return { serverId: cached, server, cached: true };
            }
            this.routeCache.delete(toolName);
        }

        // Find servers that provide this tool
        const candidates = [];
        for (const [id, server] of this.servers) {
            if (!server.healthy) continue;
            if (server.tools.includes(toolName) || server.capabilities.some(c => toolName.startsWith(c))) {
                candidates.push({ id, server });
            }
        }

        if (candidates.length === 0) {
            this.metrics.errors++;
            return { serverId: null, error: `No server found for tool: ${toolName}` };
        }

        // Tenant filtering
        const tenant = this.tenants.get(tenantId);
        let filtered = candidates;
        if (tenant && tenant.allowedServers) {
            filtered = candidates.filter(c => tenant.allowedServers.includes(c.id));
            if (filtered.length === 0) filtered = candidates; // fallback
        }

        // Pick lowest latency
        const best = filtered.sort((a, b) => a.server.latency - b.server.latency)[0];
        this.routeCache.set(toolName, best.id);
        if (this.routeCache.size > 500) {
            const firstKey = this.routeCache.keys().next().value;
            this.routeCache.delete(firstKey);
        }

        this.metrics.routed++;
        return { serverId: best.id, server: best.server, cached: false };
    }

    /**
     * Register a tenant with allowed servers and permissions.
     */
    registerTenant(tenantId, config) {
        this.tenants.set(tenantId, {
            allowedServers: config.allowedServers || null,
            permissions: config.permissions || ['read', 'execute'],
        });
    }

    /**
     * Auto-discover servers from a list of endpoints.
     */
    async discover(endpoints = []) {
        for (const ep of endpoints) {
            try {
                const serverId = `auto-${ep.replace(/[^a-z0-9]/gi, '-')}`;
                this.registerServer(serverId, { name: serverId, url: ep, capabilities: ['*'], tools: [] });
            } catch (err) {
                logger.warn(`  ⚠ [MCPRouter] Discovery failed for ${ep}: ${err.message}`);
            }
        }
        return { discovered: endpoints.length };
    }

    /**
     * Health check all servers.
     */
    healthCheck() {
        const results = [];
        for (const [id, server] of this.servers) {
            const stale = Date.now() - server.lastSeen > 300000; // 5 min
            if (stale) server.healthy = false;
            results.push({ id, name: server.name, healthy: server.healthy, stale, lastSeen: server.lastSeen });
        }
        return results;
    }

    getStatus() {
        return {
            ok: true,
            serverCount: this.servers.size,
            tenantCount: this.tenants.size,
            cacheSize: this.routeCache.size,
            metrics: { ...this.metrics },
            servers: [...this.servers.entries()].map(([id, s]) => ({
                id, name: s.name, tools: s.tools.length, healthy: s.healthy,
            })),
        };
    }

    registerRoutes(app) {
        app.get('/api/mcp/router/status', (req, res) => res.json(this.getStatus()));
        app.get('/api/mcp/router/health', (req, res) => res.json({ ok: true, servers: this.healthCheck() }));
        app.post('/api/mcp/router/route', (req, res) => {
            const { tool, tenant } = req.body || {};
            if (!tool) return res.status(400).json({ error: 'tool required' });
            res.json(this.route(tool, tenant));
        });
        logger.logSystem('  🔌 [MCPRouter] Routes: /api/mcp/router/status, /health, /route');
    }
}

let _router = null;
function getMCPRouter() {
    if (!_router) _router = new MCPRouter();
    return _router;
}

module.exports = { MCPRouter, getMCPRouter };

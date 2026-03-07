'use strict';

/**
 * MCP Gateway Router — CONN-002 + CSL Integration
 * Intelligent routing for MCP tool requests with multi-tenant support,
 * auto-discovery, capability-based matching, and Continuous Semantic Logic gates.
 *
 * CSL gates used:
 *   - multi_resonance  → Score candidate servers against intent vector
 *   - route_gate       → Select best server with soft activation
 *   - soft_gate        → Continuous latency/health scoring (replaces hard cutoffs)
 *   - risk_gate        → Evaluate server health risk (stale/latency proximity)
 *   - ternary_gate     → Classify server state: resonant / ephemeral / repel
 *   - orthogonal_gate  → Strip blacklisted capability influence from intent
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');

// ── Helpers: deterministic pseudo-embeddings for tool/capability names ─────
// In production these come from the vector-memory system (384D embeddings).
// Here we use a deterministic hash → Float32Array so routing is reproducible.
const _vecCache = new Map();

function _textToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

class MCPRouter extends EventEmitter {
    constructor(config = {}) {
        super();
        this.servers = new Map();       // serverId → { name, url, capabilities, latency, lastSeen, vector }
        this.tenants = new Map();       // tenantId → { serverId[], permissions }
        this.routeCache = new Map();    // toolName → serverId (LRU-style)
        this.blacklist = [];            // capability vectors to reject
        this.cslConfig = {
            resonanceThreshold: config.resonanceThreshold || 0.3,
            riskSensitivity: config.riskSensitivity || 0.8,
            staleTimeoutMs: config.staleTimeoutMs || 300000,
            latencyLimitMs: config.latencyLimitMs || 5000,
            ...config,
        };
        this.metrics = { routed: 0, cached: 0, discovered: 0, errors: 0, cslRouted: 0 };
    }

    /**
     * Register an MCP server with its capabilities.
     * Builds a composite semantic vector from tools + capabilities for CSL routing.
     */
    registerServer(serverId, info) {
        // Build composite vector: superposition of all tool/capability vectors
        const toolVecs = (info.tools || []).map(t => _textToVec(t));
        const capVecs = (info.capabilities || []).map(c => _textToVec(c));
        const allVecs = [...toolVecs, ...capVecs];
        const vector = allVecs.length > 0
            ? CSL.consensus_superposition(allVecs)
            : _textToVec(serverId);

        this.servers.set(serverId, {
            name: info.name || serverId,
            url: info.url,
            capabilities: info.capabilities || [],
            tools: info.tools || [],
            latency: info.latency || 0,
            lastSeen: Date.now(),
            healthy: true,
            vector,
        });
        this.metrics.discovered++;
        logger.logSystem(`  🔌 [MCPRouter] Registered server: ${serverId} (${(info.tools || []).length} tools, vec:${vector.length}D)`);
        this.emit('server:registered', { serverId, info });
    }

    /**
     * Route a tool request to the best server using CSL multi-resonance scoring.
     *
     * Flow:
     *   1. Check route cache (LRU)
     *   2. Build intent vector from toolName (optionally strip blacklist via orthogonal_gate)
     *   3. Collect healthy server candidates
     *   4. Apply tenant filtering
     *   5. Score candidates with CSL.route_gate (multi_resonance + soft_gate)
     *   6. Apply latency risk via risk_gate — penalize high-latency servers
     *   7. Return best candidate with full CSL scores
     */
    route(toolName, tenantId = 'default') {
        // 1. Check cache
        if (this.routeCache.has(toolName)) {
            const cached = this.routeCache.get(toolName);
            const server = this.servers.get(cached);
            if (server && server.healthy) {
                this.metrics.cached++;
                return { serverId: cached, server, cached: true };
            }
            this.routeCache.delete(toolName);
        }

        // 2. Build intent vector
        let intentVec = _textToVec(toolName);

        // Strip blacklisted capability influence
        if (this.blacklist.length > 0) {
            intentVec = CSL.batch_orthogonal(intentVec, this.blacklist);
        }

        // 3. Collect healthy candidates with their vectors
        const candidates = [];
        for (const [id, server] of this.servers) {
            if (!server.healthy) continue;
            candidates.push({ id: id, vector: server.vector, server });
        }

        if (candidates.length === 0) {
            this.metrics.errors++;
            return { serverId: null, error: `No server found for tool: ${toolName}` };
        }

        // 4. Tenant filtering
        const tenant = this.tenants.get(tenantId);
        let filtered = candidates;
        if (tenant && tenant.allowedServers) {
            const tenantFiltered = candidates.filter(c => tenant.allowedServers.includes(c.id));
            if (tenantFiltered.length > 0) filtered = tenantFiltered;
        }

        // 5. CSL route_gate — multi-resonance with soft activation
        const routeResult = CSL.route_gate(
            intentVec,
            filtered,
            this.cslConfig.resonanceThreshold
        );

        // 6. Apply latency risk scoring to all candidates
        const scoredCandidates = routeResult.scores.map(s => {
            const cand = filtered.find(c => c.id === s.id);
            const risk = CSL.risk_gate(
                cand.server.latency,
                this.cslConfig.latencyLimitMs,
                this.cslConfig.riskSensitivity
            );
            // Composite: semantic resonance penalized by latency risk
            const composite = s.score * (1 - risk.riskLevel * 0.5);
            return { ...s, risk, composite: +composite.toFixed(6) };
        }).sort((a, b) => b.composite - a.composite);

        // 7. Select best
        const best = scoredCandidates[0];
        if (!best) {
            this.metrics.errors++;
            return { serverId: null, error: `CSL found no viable server for: ${toolName}`, scores: scoredCandidates };
        }

        const bestServer = filtered.find(c => c.id === best.id);
        this.routeCache.set(toolName, best.id);
        if (this.routeCache.size > 500) {
            const firstKey = this.routeCache.keys().next().value;
            this.routeCache.delete(firstKey);
        }

        this.metrics.routed++;
        this.metrics.cslRouted++;
        return {
            serverId: best.id,
            server: bestServer.server,
            cached: false,
            csl: {
                resonanceScore: best.score,
                activation: best.activation,
                latencyRisk: best.risk.riskLevel,
                composite: best.composite,
                fallback: routeResult.fallback,
                candidatesScored: scoredCandidates.length,
            },
        };
    }

    /**
     * Add a capability to the blacklist.
     * Its vector will be stripped from intent via orthogonal_gate during routing.
     */
    blacklistCapability(capability) {
        this.blacklist.push(_textToVec(capability));
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
     * Health check all servers using CSL risk_gate for continuous evaluation.
     * Returns ternary classification per server: +1 (healthy), 0 (degraded), -1 (down).
     */
    healthCheck() {
        const results = [];
        for (const [id, server] of this.servers) {
            const staleness = Date.now() - server.lastSeen;
            const staleRisk = CSL.risk_gate(
                staleness,
                this.cslConfig.staleTimeoutMs,
                this.cslConfig.riskSensitivity
            );
            const latencyRisk = CSL.risk_gate(
                server.latency,
                this.cslConfig.latencyLimitMs,
                this.cslConfig.riskSensitivity
            );

            // Combined health: average of inverse risks
            const healthScore = 1 - (staleRisk.riskLevel + latencyRisk.riskLevel) / 2;
            const ternary = CSL.ternary_gate(healthScore, 0.7, 0.3);

            if (ternary.state === -1) server.healthy = false;
            else if (ternary.state === +1) server.healthy = true;
            // state === 0 → ephemeral, keep current status

            results.push({
                id, name: server.name,
                healthy: server.healthy,
                csl: {
                    healthScore: +healthScore.toFixed(4),
                    state: ternary.state,
                    staleRisk: staleRisk.riskLevel,
                    latencyRisk: latencyRisk.riskLevel,
                },
                lastSeen: server.lastSeen,
            });
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
            cslStats: CSL.getStats(),
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
        logger.logSystem('  🔌 [MCPRouter] Routes: /api/mcp/router/status, /health, /route (CSL-gated)');
    }
}

let _router = null;
function getMCPRouter(config) {
    if (!_router) _router = new MCPRouter(config);
    return _router;
}

module.exports = { MCPRouter, getMCPRouter, _textToVec };

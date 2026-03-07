/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Global Node Network — Strategic Priority
 *
 * Federation layer for distributed Heady nodes across regions.
 * Node discovery, heartbeat, cross-node routing, geo-awareness.
 */

const { getLogger } = require('./structured-logger');
const logger = getLogger('global-nodes');
const crypto = require('crypto');

const NODE_ROLES = {
    PRIMARY: 'primary',
    REPLICA: 'replica',
    EDGE: 'edge',
    RELAY: 'relay',
};

class GlobalNodeNetwork {
    constructor({ heartbeatIntervalMs = 30000, staleThresholdMs = 90000, maxNodes = 500 } = {}) {
        this.heartbeatIntervalMs = heartbeatIntervalMs;
        this.staleThresholdMs = staleThresholdMs;
        this.maxNodes = maxNodes;
        this.nodes = new Map();
        this.regions = new Map();
        this.routes = new Map();
        this.stats = { totalRegistered: 0, totalDeregistered: 0, totalRouted: 0, totalHeartbeats: 0 };
        this._heartbeatTimer = null;
    }

    // ── Node Registration ────────────────────────────────────
    registerNode(nodeId, { region, country, role = NODE_ROLES.REPLICA, capabilities = [], endpoint } = {}) {
        const node = {
            nodeId,
            region,
            country,
            role,
            capabilities: new Set(capabilities),
            endpoint,
            status: 'active',
            lastHeartbeat: Date.now(),
            registeredAt: new Date().toISOString(),
            load: 0,
            tasksProcessed: 0,
            latencyMs: 0,
        };

        this.nodes.set(nodeId, node);
        this.stats.totalRegistered++;

        // Update region index
        if (!this.regions.has(region)) this.regions.set(region, new Set());
        this.regions.get(region).add(nodeId);

        logger.info('Node registered', { nodeId, region, country, role });
        return node;
    }

    deregisterNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Clear from region index
        const regionNodes = this.regions.get(node.region);
        if (regionNodes) regionNodes.delete(nodeId);

        this.nodes.delete(nodeId);
        this.stats.totalDeregistered++;
        logger.info('Node deregistered', { nodeId });
    }

    // ── Heartbeat ────────────────────────────────────────────
    heartbeat(nodeId, { load = 0, latencyMs = 0 } = {}) {
        const node = this.nodes.get(nodeId);
        if (!node) return null;

        node.lastHeartbeat = Date.now();
        node.load = load;
        node.latencyMs = latencyMs;
        node.status = 'active';
        this.stats.totalHeartbeats++;
        return node;
    }

    startHeartbeatMonitor() {
        this._heartbeatTimer = setInterval(() => {
            const now = Date.now();
            for (const [nodeId, node] of this.nodes) {
                if (now - node.lastHeartbeat > this.staleThresholdMs) {
                    node.status = 'stale';
                    logger.warn('Node stale — no heartbeat', { nodeId, lastHeartbeat: node.lastHeartbeat });
                }
            }
        }, this.heartbeatIntervalMs);
    }

    stopHeartbeatMonitor() {
        clearInterval(this._heartbeatTimer);
    }

    // ── Routing ──────────────────────────────────────────────
    routeToNearest(requiredCapability, { preferRegion, excludeNodes = [] } = {}) {
        const candidates = [];

        for (const [nodeId, node] of this.nodes) {
            if (node.status !== 'active') continue;
            if (excludeNodes.includes(nodeId)) continue;
            if (requiredCapability && !node.capabilities.has(requiredCapability)) continue;
            if (node.load >= 100) continue;

            let score = 100 - node.load;
            if (preferRegion && node.region === preferRegion) score += 50;
            score -= (node.latencyMs / 10);

            candidates.push({ nodeId, node, score });
        }

        if (candidates.length === 0) {
            logger.warn('No node available', { capability: requiredCapability, preferRegion });
            return null;
        }

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        best.node.tasksProcessed++;
        this.stats.totalRouted++;
        logger.debug('Routed to node', { nodeId: best.nodeId, score: best.score, capability: requiredCapability });

        return { nodeId: best.nodeId, endpoint: best.node.endpoint, region: best.node.region };
    }

    // ── Queries ──────────────────────────────────────────────
    getNodesByRegion(region) {
        const nodeIds = this.regions.get(region) || new Set();
        return [...nodeIds].map(id => this.nodes.get(id)).filter(Boolean);
    }

    getActiveNodes() {
        return [...this.nodes.values()].filter(n => n.status === 'active');
    }

    getRegionStats() {
        const stats = {};
        for (const [region, nodeIds] of this.regions) {
            const nodes = [...nodeIds].map(id => this.nodes.get(id)).filter(Boolean);
            stats[region] = {
                total: nodes.length,
                active: nodes.filter(n => n.status === 'active').length,
                stale: nodes.filter(n => n.status === 'stale').length,
                avgLoad: nodes.length ? Math.round(nodes.reduce((a, n) => a + n.load, 0) / nodes.length) : 0,
                countries: [...new Set(nodes.map(n => n.country))],
            };
        }
        return stats;
    }

    getHealth() {
        return {
            totalNodes: this.nodes.size,
            activeNodes: [...this.nodes.values()].filter(n => n.status === 'active').length,
            staleNodes: [...this.nodes.values()].filter(n => n.status === 'stale').length,
            regions: this.regions.size,
            stats: this.stats,
            regionStats: this.getRegionStats(),
        };
    }
}

// ── Route Registration ───────────────────────────────────────
function registerGlobalNodeRoutes(app) {
    const network = new GlobalNodeNetwork();
    network.startHeartbeatMonitor();

    // Seed with current known deployment regions
    network.registerNode('heady-cloudrun-us', {
        region: 'us-central1', country: 'US', role: NODE_ROLES.PRIMARY,
        capabilities: ['mcp', 'vector-memory', 'bee-factory', 'governance'],
        endpoint: 'https://heady-manager-609590223909.us-central1.run.app',
    });
    network.registerNode('heady-edge-global', {
        region: 'edge-global', country: 'GLOBAL', role: NODE_ROLES.EDGE,
        capabilities: ['ai-inference', 'vectorize', 'kv', 'mcp'],
        endpoint: 'https://heady.headyme.com',
    });

    app.get('/api/global-nodes/health', (req, res) => res.json(network.getHealth()));

    app.post('/api/global-nodes/register', (req, res) => {
        const node = network.registerNode(req.body.nodeId || crypto.randomUUID(), req.body);
        res.json(node);
    });

    app.post('/api/global-nodes/:nodeId/heartbeat', (req, res) => {
        const result = network.heartbeat(req.params.nodeId, req.body);
        res.json(result || { error: 'Unknown node' });
    });

    app.post('/api/global-nodes/route', (req, res) => {
        const { capability, preferRegion, excludeNodes } = req.body;
        const route = network.routeToNearest(capability, { preferRegion, excludeNodes });
        res.json(route || { error: 'No available node' });
    });

    app.get('/api/global-nodes/regions', (req, res) => res.json(network.getRegionStats()));

    logger.info('Global node network routes registered');
    return network;
}

module.exports = { GlobalNodeNetwork, NODE_ROLES, registerGlobalNodeRoutes };

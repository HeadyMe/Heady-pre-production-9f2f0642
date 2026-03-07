'use strict';

/**
 * Connector Auto-Discovery Protocol — CONN-003
 * Discovers MCP servers, API endpoints, and services
 * on the network via well-known paths and registry polling.
 */

const logger = require('../utils/logger');

const WELL_KNOWN_PATHS = ['/sse', '/.well-known/mcp', '/mcp/discover', '/health'];

class ConnectorDiscovery {
    constructor(opts = {}) {
        this.registry = new Map();
        this.scanInterval = opts.scanIntervalMs || 60000;
        this.endpoints = opts.endpoints || [];
        this._timer = null;
    }

    /**
     * Probe an endpoint for MCP capabilities.
     */
    async probe(endpoint) {
        const result = { endpoint, alive: false, capabilities: [], ts: Date.now() };
        try {
            const http = endpoint.startsWith('https') ? require('https') : require('http');
            for (const path of WELL_KNOWN_PATHS) {
                const url = `${endpoint}${path}`;
                const alive = await new Promise((resolve) => {
                    const req = http.get(url, { timeout: 5000 }, (res) => {
                        resolve(res.statusCode >= 200 && res.statusCode < 400);
                    });
                    req.on('error', () => resolve(false));
                    req.on('timeout', () => { req.destroy(); resolve(false); });
                });
                if (alive) {
                    result.alive = true;
                    result.capabilities.push(path);
                }
            }
        } catch (err) {
            result.error = err.message;
        }

        this.registry.set(endpoint, result);
        return result;
    }

    /**
     * Scan all configured endpoints.
     */
    async scan() {
        const results = [];
        for (const ep of this.endpoints) {
            const r = await this.probe(ep);
            results.push(r);
        }
        logger.logSystem(`  🔍 [Discovery] Scanned ${results.length} endpoints, ${results.filter(r => r.alive).length} alive`);
        return results;
    }

    /**
     * Start periodic scanning.
     */
    start() {
        if (this._timer) return;
        this._timer = setInterval(() => this.scan(), this.scanInterval);
        if (this._timer.unref) this._timer.unref();
        this.scan(); // immediate first scan
        return this;
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }

    getStatus() {
        return {
            ok: true,
            endpointCount: this.endpoints.length,
            scanned: this.registry.size,
            alive: [...this.registry.values()].filter(r => r.alive).length,
            endpoints: [...this.registry.values()],
        };
    }
}

let _discovery = null;
function getDiscovery(opts) {
    if (!_discovery) _discovery = new ConnectorDiscovery(opts);
    return _discovery;
}

module.exports = { ConnectorDiscovery, getDiscovery };

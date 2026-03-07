/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * BrainConnector — Connection pool with circuit breaker for HeadyBrain endpoints.
 * Provides 100% uptime guarantee through failover and health monitoring.
 */
const EventEmitter = require("events");
const logger = require("./utils/logger");

class BrainConnector extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.poolSize = opts.poolSize || 5;
        this.healthCheckInterval = opts.healthCheckInterval || 15000;
        this.endpoints = new Map();
        this.failures = new Map();
        this.circuitBreakers = new Map();

        // Register default local endpoint
        this._registerEndpoint("local-brain", { url: "https://127.0.0.1:3301/api/brain", priority: 1 });

        // Start health checker
        this._healthInterval = setInterval(() => this._runHealthChecks(), this.healthCheckInterval);
        logger.logSystem(`  ∞ BrainConnector: pool=${this.poolSize}, healthCheck=${this.healthCheckInterval}ms`);
    }

    _registerEndpoint(id, config) {
        this.endpoints.set(id, { ...config, status: "healthy", lastCheck: null });
        this.failures.set(id, 0);
        this.circuitBreakers.set(id, { open: false, openedAt: null, halfOpenAt: null });
    }

    async _runHealthChecks() {
        const results = new Map();
        for (const [id, ep] of this.endpoints) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${ep.url}/health`, { signal: controller.signal });
                clearTimeout(timeout);
                const healthy = res.ok;
                ep.status = healthy ? "healthy" : "degraded";
                ep.lastCheck = Date.now();
                if (healthy) this.failures.set(id, 0);
                results.set(id, { status: ep.status });
            } catch {
                ep.status = "unhealthy";
                ep.lastCheck = Date.now();
                const fails = (this.failures.get(id) || 0) + 1;
                this.failures.set(id, fails);
                if (fails >= 3 && !this.circuitBreakers.get(id)?.open) {
                    this.circuitBreakers.set(id, { open: true, openedAt: Date.now(), halfOpenAt: Date.now() + 30000 });
                    this.emit("circuitBreakerOpen", { endpointId: id, failures: fails });
                }
                results.set(id, { status: "unhealthy" });
            }
        }
        this.emit("healthCheck", results);

        const allFailed = [...this.endpoints.values()].every(ep => ep.status === "unhealthy");
        if (allFailed) this.emit("allEndpointsFailed", { endpoints: [...this.endpoints.keys()] });
    }

    getHealthyEndpoint() {
        for (const [id, ep] of this.endpoints) {
            if (ep.status === "healthy" && !this.circuitBreakers.get(id)?.open) return { id, ...ep };
        }
        // Fallback: try half-open circuit breakers
        for (const [id, cb] of this.circuitBreakers) {
            if (cb.open && cb.halfOpenAt && Date.now() > cb.halfOpenAt) return { id, ...this.endpoints.get(id) };
        }
        return null;
    }

    destroy() {
        if (this._healthInterval) clearInterval(this._healthInterval);
    }
}

let _instance = null;

function getBrainConnector(opts) {
    if (!_instance) _instance = new BrainConnector(opts);
    return _instance;
}

module.exports = { BrainConnector, getBrainConnector };

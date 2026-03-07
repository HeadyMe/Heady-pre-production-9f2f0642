/**
 * E17 + T9: Multi-cloud failover + Edge agent runtime
 * @module src/lib/failover
 */
'use strict';

class MultiCloudFailover {
    constructor(opts = {}) {
        this.primary = opts.primary || { name: 'gcp-cloud-run', url: process.env.PRIMARY_BACKEND_URL };
        this.fallback = opts.fallback || { name: 'aws-lambda', url: process.env.FALLBACK_BACKEND_URL };
        this.healthCheckInterval = opts.healthCheckInterval || 15000;
        this._primaryHealthy = true;
        this._failoverCount = 0;
        this._lastCheck = 0;
    }

    async route(request) {
        if (this._primaryHealthy) {
            try {
                return await this._fetch(this.primary, request);
            } catch (err) {
                console.error(`[FAILOVER] Primary (${this.primary.name}) failed:`, err.message);
                this._primaryHealthy = false;
                this._failoverCount++;
                return this._fetch(this.fallback, request);
            }
        }

        // Check if primary recovered
        if (Date.now() - this._lastCheck > this.healthCheckInterval) {
            this._lastCheck = Date.now();
            try {
                await this._healthCheck(this.primary);
                this._primaryHealthy = true;
                console.log(`[FAILOVER] Primary recovered, routing restored`);
                return this._fetch(this.primary, request);
            } catch { /* still down */ }
        }

        return this._fetch(this.fallback, request);
    }

    async _fetch(backend, request) {
        if (!backend.url) throw new Error(`No URL configured for ${backend.name}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const resp = await fetch(`${backend.url}${request.path || ''}`, {
                method: request.method || 'GET',
                headers: request.headers || {},
                body: request.body ? JSON.stringify(request.body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            return { backend: backend.name, status: resp.status, data: await resp.json().catch(() => null) };
        } catch (err) {
            clearTimeout(timeout);
            throw err;
        }
    }

    async _healthCheck(backend) {
        const resp = await fetch(`${backend.url}/health/live`, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) throw new Error(`Health check failed: ${resp.status}`);
    }

    getStatus() {
        return {
            primary: { ...this.primary, healthy: this._primaryHealthy },
            fallback: { ...this.fallback, active: !this._primaryHealthy },
            failoverCount: this._failoverCount,
        };
    }
}

module.exports = MultiCloudFailover;

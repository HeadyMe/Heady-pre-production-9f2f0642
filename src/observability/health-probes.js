/**
 * Heady™ Enterprise Health Probes
 * PR 7: Kubernetes-style liveness + readiness probes with dependency checks
 */

class HealthProbes {
    constructor(options = {}) {
        this.service = options.service || 'heady-manager';
        this.version = options.version || process.env.npm_package_version || '3.0.1';
        this.startTime = Date.now();
        this.checks = new Map();
        this.ready = false;
    }

    /** Register a dependency health check */
    registerCheck(name, checkFn) {
        this.checks.set(name, { name, checkFn, lastResult: null, lastCheck: null });
    }

    /** Mark the service as ready (call after boot completes) */
    markReady() { this.ready = true; }

    /** Liveness probe — is the process alive? */
    async liveness() {
        return {
            status: 'ok',
            service: this.service,
            version: this.version,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            timestamp: new Date().toISOString(),
        };
    }

    /** Readiness probe — is the service ready to handle traffic? */
    async readiness() {
        const results = {};
        let allHealthy = this.ready;

        for (const [name, check] of this.checks) {
            try {
                const start = Date.now();
                const result = await Promise.race([
                    check.checkFn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
                ]);
                results[name] = { status: 'healthy', latencyMs: Date.now() - start, ...result };
                check.lastResult = 'healthy';
            } catch (err) {
                results[name] = { status: 'unhealthy', error: err.message };
                check.lastResult = 'unhealthy';
                allHealthy = false;
            }
            check.lastCheck = new Date().toISOString();
        }

        return {
            status: allHealthy ? 'ready' : 'not_ready',
            service: this.service,
            version: this.version,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            checks: results,
            timestamp: new Date().toISOString(),
        };
    }

    /** Mount Express routes */
    mount(app) {
        app.get('/health/live', async (_req, res) => {
            const result = await this.liveness();
            res.json(result);
        });

        app.get('/health/ready', async (_req, res) => {
            const result = await this.readiness();
            res.status(result.status === 'ready' ? 200 : 503).json(result);
        });

        app.get('/health', async (_req, res) => {
            const [live, ready] = await Promise.all([this.liveness(), this.readiness()]);
            res.status(ready.status === 'ready' ? 200 : 503).json({ ...live, ...ready });
        });
    }
}

module.exports = { HealthProbes };

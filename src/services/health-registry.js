/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Health Endpoint Registry — P1 Assessment Item
 *
 * Standardizes /health/* endpoints for all service modules.
 * Auto-discovers services and provides unified health aggregation.
 */

const { getLogger } = require('./structured-logger');
const log = getLogger('health-registry');

class HealthRegistry {
    constructor() {
        this.services = new Map();
        this.startedAt = Date.now();
    }

    /**
     * Register a service for health monitoring.
     * @param {string} name - Service name
     * @param {Function|Object} healthFn - Function returning health status or object with getHealth()
     */
    register(name, healthFn) {
        if (typeof healthFn === 'object' && typeof healthFn.getHealth === 'function') {
            this.services.set(name, () => healthFn.getHealth());
        } else if (typeof healthFn === 'function') {
            this.services.set(name, healthFn);
        } else {
            this.services.set(name, () => ({ status: 'unknown', message: 'No health function provided' }));
        }
        log.info(`Service registered: ${name}`, { service: name });
    }

    /**
     * Unregister a service.
     */
    unregister(name) {
        this.services.delete(name);
    }

    /**
     * Get health status for a specific service.
     */
    async getServiceHealth(name) {
        const fn = this.services.get(name);
        if (!fn) return { service: name, status: 'not_found' };
        try {
            const result = await fn();
            return { service: name, status: 'healthy', ...result };
        } catch (err) {
            log.error(`Health check failed: ${name}`, { error: err.message });
            return { service: name, status: 'unhealthy', error: err.message };
        }
    }

    /**
     * Get aggregated health for all registered services.
     */
    async getAggregatedHealth() {
        const results = {};
        let healthy = 0;
        let unhealthy = 0;

        for (const [name] of this.services) {
            const health = await this.getServiceHealth(name);
            results[name] = health;
            if (health.status === 'healthy') healthy++;
            else unhealthy++;
        }

        return {
            status: unhealthy === 0 ? 'healthy' : (healthy > 0 ? 'degraded' : 'unhealthy'),
            services: results,
            summary: {
                total: this.services.size,
                healthy,
                unhealthy,
                uptime: Math.floor((Date.now() - this.startedAt) / 1000),
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Register Express routes for health endpoints.
     * Provides: /health, /health/:service, /health/metrics
     */
    registerRoutes(app) {
        // Aggregated health
        app.get('/health', async (req, res) => {
            try {
                const health = await this.getAggregatedHealth();
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (err) {
                res.status(500).json({ status: 'error', error: err.message });
            }
        });

        // Individual service health
        app.get('/health/:service', async (req, res) => {
            try {
                const health = await this.getServiceHealth(req.params.service);
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (err) {
                res.status(500).json({ status: 'error', error: err.message });
            }
        });

        // Metrics endpoint
        app.get('/health/metrics', async (req, res) => {
            try {
                const health = await this.getAggregatedHealth();
                // Prometheus-compatible output
                let prometheus = '';
                prometheus += `# HELP heady_services_total Total registered services\n`;
                prometheus += `# TYPE heady_services_total gauge\n`;
                prometheus += `heady_services_total ${health.summary.total}\n`;
                prometheus += `# HELP heady_services_healthy Healthy services\n`;
                prometheus += `# TYPE heady_services_healthy gauge\n`;
                prometheus += `heady_services_healthy ${health.summary.healthy}\n`;
                prometheus += `# HELP heady_uptime_seconds Service uptime\n`;
                prometheus += `# TYPE heady_uptime_seconds gauge\n`;
                prometheus += `heady_uptime_seconds ${health.summary.uptime}\n`;

                for (const [name, svc] of Object.entries(health.services)) {
                    prometheus += `heady_service_status{service="${name}"} ${svc.status === 'healthy' ? 1 : 0}\n`;
                }

                res.type('text/plain').send(prometheus);
            } catch (err) {
                res.status(500).send(`# error: ${err.message}\n`);
            }
        });

        log.info('Health routes registered: /health, /health/:service, /health/metrics');
    }
}

// Singleton
const healthRegistry = new HealthRegistry();

module.exports = { HealthRegistry, healthRegistry };

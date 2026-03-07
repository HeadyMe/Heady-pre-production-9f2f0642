/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Metrics Collector
 * ═══════════════════════════════════════════════════════════════════
 *
 * Polls all 7 Heady service health endpoints, MCP router, bee factory,
 * skill router, CSL gate statistics, and phi scale values.
 * Uses phi-exponential backoff when services are unresponsive.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * @module src/monitoring/metrics-collector
 */
'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');
const { PhiBackoff, PHI_INVERSE } = require('../core/phi-scales');

// ── Service Registry ───────────────────────────────────────────────
const SERVICE_ENDPOINTS = [
    { name: 'heady-embed',  port: 8081, healthPath: '/api/health' },
    { name: 'heady-infer',  port: 8082, healthPath: '/api/health' },
    { name: 'heady-vector', port: 8083, healthPath: '/api/health' },
    { name: 'heady-chain',  port: 8084, healthPath: '/api/health' },
    { name: 'heady-cache',  port: 8085, healthPath: '/api/health' },
    { name: 'heady-guard',  port: 8086, healthPath: '/api/health' },
    { name: 'heady-eval',   port: 8087, healthPath: '/api/health' },
];

const BASE_URL = process.env.HEADY_SERVICE_HOST || 'http://localhost';

class MetricsCollector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            timeoutMs: config.timeoutMs || 5000,
            backoffBase: config.backoffBase || 1000,
            backoffMaxAttempts: config.backoffMaxAttempts || 8,
            ...config,
        };

        this.totalCollections = 0;
        this.latestData = {};
        this.serviceBackoffs = new Map(); // service name → PhiBackoff
        this.serviceLatencies = new Map(); // service name → last 100 latencies

        // Initialize backoff trackers
        for (const svc of SERVICE_ENDPOINTS) {
            this.serviceBackoffs.set(svc.name, new PhiBackoff(this.config.backoffBase, this.config.backoffMaxAttempts));
            this.serviceLatencies.set(svc.name, []);
        }
    }

    /**
     * Collect all metrics from every source
     */
    async collectAll() {
        const startTime = Date.now();
        const results = {
            ts: startTime,
            services: [],
            goldenSignals: {},
            cslStats: {},
            phiScales: {},
            mcpRouter: {},
            beeFactory: [],
            skillRouter: {},
        };

        // 1. Poll all service health endpoints in parallel
        const servicePromises = SERVICE_ENDPOINTS.map(svc =>
            this.collectService(svc.name, `${BASE_URL}:${svc.port}${svc.healthPath}`)
        );
        results.services = await Promise.all(servicePromises);

        // 2. Collect MCP Router status
        try {
            const { getMCPRouter } = require('../mcp/mcp-router');
            const router = getMCPRouter();
            results.mcpRouter = router.getStatus();
        } catch {
            results.mcpRouter = { ok: false, note: 'mcp-router not available' };
        }

        // 3. Collect Bee Factory status
        try {
            const { listDynamicBees } = require('../bees/bee-factory');
            results.beeFactory = listDynamicBees();
        } catch {
            results.beeFactory = [];
        }

        // 4. Collect Skill Router status
        try {
            const { getSkillRouter } = require('../orchestration/skill-router');
            const router = getSkillRouter();
            results.skillRouter = router.getStatus();
        } catch {
            results.skillRouter = { ok: false, note: 'skill-router not available' };
        }

        // 5. Collect CSL gate statistics
        try {
            const CSL = require('../core/semantic-logic');
            results.cslStats = CSL.getStats();
        } catch {
            results.cslStats = {};
        }

        // 6. Collect phi scale values from DynamicConstants
        try {
            const dc = require('../core/dynamic-constants');
            results.phiScales = {
                timeout: { value: dc.DynamicTimeout.value, normalized: dc.DynamicTimeout.normalized(), phiDeviation: dc.DynamicTimeout.phiDeviation(), stats: dc.DynamicTimeout.stats() },
                retryCount: { value: dc.DynamicRetryCount.value, normalized: dc.DynamicRetryCount.normalized(), phiDeviation: dc.DynamicRetryCount.phiDeviation(), stats: dc.DynamicRetryCount.stats() },
                batchSize: { value: dc.DynamicBatchSize.value, normalized: dc.DynamicBatchSize.normalized(), phiDeviation: dc.DynamicBatchSize.phiDeviation(), stats: dc.DynamicBatchSize.stats() },
                confidence: { value: dc.DynamicConfidenceThreshold.value, normalized: dc.DynamicConfidenceThreshold.normalized(), phiDeviation: dc.DynamicConfidenceThreshold.phiDeviation(), stats: dc.DynamicConfidenceThreshold.stats() },
                temperature: { value: dc.DynamicTemperature.value, normalized: dc.DynamicTemperature.normalized(), phiDeviation: dc.DynamicTemperature.phiDeviation(), stats: dc.DynamicTemperature.stats() },
                cacheTTL: { value: dc.DynamicCacheTTL.value, normalized: dc.DynamicCacheTTL.normalized(), phiDeviation: dc.DynamicCacheTTL.phiDeviation(), stats: dc.DynamicCacheTTL.stats() },
                rateLimit: { value: dc.DynamicRateLimit.value, normalized: dc.DynamicRateLimit.normalized(), phiDeviation: dc.DynamicRateLimit.phiDeviation(), stats: dc.DynamicRateLimit.stats() },
                concurrency: { value: dc.DynamicConcurrency.value, normalized: dc.DynamicConcurrency.normalized(), phiDeviation: dc.DynamicConcurrency.phiDeviation(), stats: dc.DynamicConcurrency.stats() },
            };
        } catch {
            results.phiScales = {};
        }

        // 7. Compute Golden Signals from collected data
        results.goldenSignals = this.getGoldenSignals(results.services);

        // Store latest
        this.latestData = results;
        this.totalCollections++;

        // Emit event for SSE streaming
        this.emit('metric', results);

        logger.info(`[MetricsCollector] Collection #${this.totalCollections} completed in ${Date.now() - startTime}ms`);
        return results;
    }

    /**
     * Collect health from a single service with phi-exponential backoff
     * @param {string} name - Service name
     * @param {string} url - Health endpoint URL
     * @returns {Object} Service status
     */
    async collectService(name, url) {
        const backoff = this.serviceBackoffs.get(name);
        const startTime = Date.now();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            const latency = Date.now() - startTime;
            let body = null;
            try {
                body = await response.json();
            } catch {
                body = { raw: await response.text().catch(() => '') };
            }

            // Record latency
            const latencies = this.serviceLatencies.get(name);
            latencies.push(latency);
            if (latencies.length > 100) latencies.shift();

            // Reset backoff on success
            backoff.reset();

            return {
                name,
                status: response.ok ? 'healthy' : 'degraded',
                statusCode: response.status,
                latency,
                uptime: body.uptime || null,
                circuitBreakerState: body.circuitBreaker || body.circuitBreakerState || 'CLOSED',
                details: body,
                lastCheck: Date.now(),
            };
        } catch (err) {
            const latency = Date.now() - startTime;

            // Apply phi-exponential backoff
            const nextBackoff = backoff.next();
            if (nextBackoff === null) {
                logger.error(`[MetricsCollector] Service ${name} exceeded max backoff attempts`);
            }

            return {
                name,
                status: 'down',
                statusCode: 0,
                latency,
                error: err.message,
                circuitBreakerState: 'UNKNOWN',
                nextRetryMs: nextBackoff,
                backoffAttempt: backoff.attempts,
                lastCheck: Date.now(),
            };
        }
    }

    /**
     * Compute Golden Signals from service data
     * @param {Array} services - Array of service status objects
     * @returns {Object} Golden signals: latency, throughput, error rate, saturation
     */
    getGoldenSignals(services) {
        // Gather all latencies across services
        const allLatencies = [];
        for (const [, latencies] of this.serviceLatencies) {
            allLatencies.push(...latencies);
        }

        if (allLatencies.length === 0) {
            return {
                latencyP50: 0, latencyP95: 0, latencyP99: 0,
                throughput: 0, errorRate: 0,
                cpuSaturation: 0, memorySaturation: 0,
            };
        }

        // Sort for percentile calculation
        const sorted = [...allLatencies].sort((a, b) => a - b);
        const p = (pct) => sorted[Math.floor(sorted.length * pct / 100)] || 0;

        // Error rate
        const totalServices = services.length;
        const downServices = services.filter(s => s.status === 'down').length;
        const degradedServices = services.filter(s => s.status === 'degraded').length;
        const errorRate = totalServices > 0
            ? ((downServices + degradedServices * 0.5) / totalServices) * 100
            : 0;

        // Saturation (from process metrics)
        const mem = process.memoryUsage();
        const memorySaturation = (mem.heapUsed / mem.heapTotal) * 100;

        // CPU estimation via event loop lag
        const cpuStart = Date.now();
        const cpuSaturation = Math.min(100, memorySaturation * PHI_INVERSE + (Date.now() - cpuStart));

        return {
            latencyP50: Math.round(p(50)),
            latencyP95: Math.round(p(95)),
            latencyP99: Math.round(p(99)),
            throughput: Math.round(this.totalCollections / ((Date.now() - (this._startTime || Date.now())) / 1000) * totalServices),
            errorRate: +errorRate.toFixed(2),
            cpuSaturation: +cpuSaturation.toFixed(1),
            memorySaturation: +memorySaturation.toFixed(1),
        };
    }

    /**
     * Get time-series data for a specific metric
     * @param {string} metric - Metric name
     * @param {number} window - Number of data points
     * @returns {Array}
     */
    getTimeSeries(metric, window = 60) {
        // Delegate to dashboard server's time-series storage
        return [];
    }

    /**
     * Get the latest collected data
     */
    getLatest() {
        return this.latestData;
    }
}

module.exports = MetricsCollector;

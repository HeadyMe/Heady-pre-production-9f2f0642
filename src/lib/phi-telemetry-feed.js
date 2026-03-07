/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Telemetry Feed
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Collect real-time system metrics to feed into PhiScale adjustments.
 * Monitors CPU, memory, latency, throughput, error rates, etc.
 * ═══════════════════════════════════════════════════════════════════
 */

const os = require('os');
const logger = require('../utils/logger');

class PhiTelemetryFeed {
    constructor() {
        this.metrics = {
            cpuUsage: 0,
            memoryUsage: 0,
            latencyP50: 0,
            latencyP95: 0,
            latencyP99: 0,
            throughput: 0,
            errorRate: 0,
            queueDepth: 0,
            avgWaitTime: 0,
            cacheHitRate: 0,
            avgResponseTime: 0,
            retrySuccessRate: 0,
            accuracy: 0,
            responseDiversity: 0
        };

        this.latencyHistory = [];
        this.requestHistory = [];
        this.errorHistory = [];
        this.maxHistorySize = 1000;

        this.startTime = Date.now();
        this.requestCount = 0;
        this.errorCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;

        this.monitoringInterval = null;
    }

    /**
     * Start continuous monitoring
     */
    start(intervalMs = 1000) {
        if (this.monitoringInterval) {
            logger.warn('Telemetry monitoring already running');
            return;
        }

        logger.info(`Starting phi telemetry monitoring (interval: ${intervalMs}ms)`);

        this.monitoringInterval = setInterval(() => {
            this.updateSystemMetrics();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('Stopped phi telemetry monitoring');
        }
    }

    /**
     * Update CPU and memory metrics
     */
    updateSystemMetrics() {
        try {
            // CPU usage
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;

            cpus.forEach(cpu => {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            });

            this.metrics.cpuUsage = 1 - (totalIdle / totalTick);

            // Memory usage
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            this.metrics.memoryUsage = 1 - (freeMem / totalMem);

        } catch (err) {
            logger.error('Failed to update system metrics:', err);
        }
    }

    /**
     * Record request latency
     */
    recordLatency(latencyMs) {
        this.latencyHistory.push({
            timestamp: Date.now(),
            latency: latencyMs
        });

        if (this.latencyHistory.length > this.maxHistorySize) {
            this.latencyHistory.shift();
        }

        // Update percentiles
        this.updateLatencyPercentiles();
    }

    /**
     * Calculate latency percentiles
     */
    updateLatencyPercentiles() {
        if (this.latencyHistory.length === 0) return;

        const latencies = this.latencyHistory.map(h => h.latency).sort((a, b) => a - b);
        const len = latencies.length;

        this.metrics.latencyP50 = latencies[Math.floor(len * 0.5)];
        this.metrics.latencyP95 = latencies[Math.floor(len * 0.95)];
        this.metrics.latencyP99 = latencies[Math.floor(len * 0.99)];
        this.metrics.avgResponseTime = latencies.reduce((a, b) => a + b, 0) / len;
    }

    /**
     * Record successful request
     */
    recordRequest() {
        this.requestCount++;
        this.requestHistory.push({
            timestamp: Date.now(),
            success: true
        });

        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.shift();
        }

        this.updateThroughput();
    }

    /**
     * Record error
     */
    recordError() {
        this.errorCount++;
        this.errorHistory.push({
            timestamp: Date.now()
        });

        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }

        this.updateErrorRate();
    }

    /**
     * Calculate throughput (requests per second)
     */
    updateThroughput() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;

        const recentRequests = this.requestHistory.filter(r => r.timestamp > oneSecondAgo);
        this.metrics.throughput = recentRequests.length;
    }

    /**
     * Calculate error rate
     */
    updateErrorRate() {
        if (this.requestCount === 0) {
            this.metrics.errorRate = 0;
            return;
        }

        this.metrics.errorRate = this.errorCount / this.requestCount;
    }

    /**
     * Record cache hit
     */
    recordCacheHit() {
        this.cacheHits++;
        this.updateCacheHitRate();
    }

    /**
     * Record cache miss
     */
    recordCacheMiss() {
        this.cacheMisses++;
        this.updateCacheHitRate();
    }

    /**
     * Calculate cache hit rate
     */
    updateCacheHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        if (total === 0) {
            this.metrics.cacheHitRate = 0;
            return;
        }

        this.metrics.cacheHitRate = this.cacheHits / total;
    }

    /**
     * Set queue depth (from external queue monitor)
     */
    setQueueDepth(depth) {
        this.metrics.queueDepth = depth;
    }

    /**
     * Set average wait time (from external queue monitor)
     */
    setAvgWaitTime(timeMs) {
        this.metrics.avgWaitTime = timeMs;
    }

    /**
     * Set retry success rate (from retry logic)
     */
    setRetrySuccessRate(rate) {
        this.metrics.retrySuccessRate = rate;
    }

    /**
     * Set model accuracy (from validation system)
     */
    setAccuracy(accuracy) {
        this.metrics.accuracy = accuracy;
    }

    /**
     * Set response diversity (from output analysis)
     */
    setResponseDiversity(diversity) {
        this.metrics.responseDiversity = diversity;
    }

    /**
     * Get current metrics snapshot
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Get detailed statistics
     */
    getStats() {
        return {
            metrics: this.getMetrics(),
            uptime: Date.now() - this.startTime,
            totalRequests: this.requestCount,
            totalErrors: this.errorCount,
            cacheStats: {
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRate: this.metrics.cacheHitRate
            },
            historySize: {
                latency: this.latencyHistory.length,
                requests: this.requestHistory.length,
                errors: this.errorHistory.length
            }
        };
    }

    /**
     * Reset all counters
     */
    reset() {
        this.metrics = {
            cpuUsage: 0,
            memoryUsage: 0,
            latencyP50: 0,
            latencyP95: 0,
            latencyP99: 0,
            throughput: 0,
            errorRate: 0,
            queueDepth: 0,
            avgWaitTime: 0,
            cacheHitRate: 0,
            avgResponseTime: 0,
            retrySuccessRate: 0,
            accuracy: 0,
            responseDiversity: 0
        };

        this.latencyHistory = [];
        this.requestHistory = [];
        this.errorHistory = [];
        this.requestCount = 0;
        this.errorCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.startTime = Date.now();

        logger.info('Reset phi telemetry feed');
    }
}

// Singleton instance
const telemetryFeed = new PhiTelemetryFeed();

module.exports = telemetryFeed;
module.exports.PhiTelemetryFeed = PhiTelemetryFeed;

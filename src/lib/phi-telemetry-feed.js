/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Telemetry Feed
 * ═══════════════════════════════════════════════════════════════════
 *
 * Comprehensive telemetry collector that feeds real-time system
 * metrics into PhiScale adjustment. Monitors CPU, memory, latency,
 * throughput, error rates, GC, event loop lag, network I/O, disk,
 * cache performance, retry success, and active connections.
 *
 * Exports singleton instance as default + named PhiTelemetryFeed class.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const os = require('os');
const logger = require('../utils/logger');

// ───────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────

const DEFAULT_MAX_HISTORY_SIZE = 1000;
const DEFAULT_INTERVAL_MS = 1000;

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

/**
 * Compute a percentile value from a pre-sorted numeric array.
 * @param {number[]} sorted - ascending-sorted array
 * @param {number} p - percentile in [0, 1]
 * @returns {number}
 */
function percentile(sorted, p) {
    if (!sorted || sorted.length === 0) return 0;
    const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
    return sorted[idx];
}

/**
 * Safely read process.memoryUsage(), returning null on failure.
 * @returns {NodeJS.MemoryUsage|null}
 */
function safeMemoryUsage() {
    try {
        return process.memoryUsage();
    } catch (_) {
        return null;
    }
}

/**
 * Push a value onto a capped circular-style array.
 * @param {Array} arr
 * @param {*} value
 * @param {number} maxSize
 */
function cappedPush(arr, value, maxSize) {
    arr.push(value);
    if (arr.length > maxSize) {
        arr.shift();
    }
}

// ───────────────────────────────────────────────────────────────────
// PhiTelemetryFeed
// ───────────────────────────────────────────────────────────────────

class PhiTelemetryFeed {
    /**
     * @param {object} [options]
     * @param {number} [options.maxHistorySize=1000]
     * @param {string} [options.name='root']
     */
    constructor(options = {}) {
        this.name = options.name || 'root';
        this.maxHistorySize = options.maxHistorySize || DEFAULT_MAX_HISTORY_SIZE;

        // ── Metric fields ────────────────────────────────────────────
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.latencyP50 = 0;
        this.latencyP95 = 0;
        this.latencyP99 = 0;
        this.throughput = 0;
        this.errorRate = 0;
        this.queueDepth = 0;
        this.avgWaitTime = 0;
        this.cacheHitRate = 0;
        this.avgResponseTime = 0;
        this.retrySuccessRate = 0;
        this.accuracy = 0;
        this.responseDiversity = 0;
        this.activeConnections = 0;
        this.gcPauseDuration = 0;
        this.eventLoopLag = 0;
        this.diskUsage = 0;
        this.networkBytesIn = 0;
        this.networkBytesOut = 0;
        this.openFileDescriptors = 0;
        this.heapUsedPercent = 0;

        // ── History arrays (capped at maxHistorySize) ────────────────
        this.latencyHistory = [];   // [{ timestamp, latency }]
        this.requestHistory = [];   // [{ timestamp, success }]
        this.errorHistory = [];     // [{ timestamp, errorType }]

        // ── Counters ─────────────────────────────────────────────────
        this.requestCount = 0;
        this.errorCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.retryCount = 0;
        this.retrySuccessCount = 0;
        this.startTime = Date.now();

        // ── Internal state ───────────────────────────────────────────
        this._monitoringInterval = null;
        this._cleanupInterval = null;
        this._prevCpuTimes = null;          // for differential CPU tracking
        this._prevNetworkStats = null;      // for differential network I/O
        this._childFeeds = new Map();       // name -> PhiTelemetryFeed

        // Event loop lag baseline using hrtime
        this._loopLagRef = null;
        this._loopLagTimer = null;
    }

    // ══════════════════════════════════════════════════════════════════
    // Lifecycle
    // ══════════════════════════════════════════════════════════════════

    /**
     * Start continuous monitoring.
     * @param {number} [intervalMs=1000]
     */
    start(intervalMs = DEFAULT_INTERVAL_MS) {
        if (this._monitoringInterval) {
            logger.warn(`[PhiTelemetryFeed:${this.name}] Monitoring already running`);
            return;
        }

        logger.info(`[PhiTelemetryFeed:${this.name}] Starting monitoring (interval: ${intervalMs}ms)`);

        // Immediate first sample
        this.updateSystemMetrics();

        this._monitoringInterval = setInterval(() => {
            this.updateSystemMetrics();
        }, intervalMs);

        // Start event loop lag measurement
        this._startEventLoopLagMonitor(intervalMs);

        // Start child feeds
        for (const child of this._childFeeds.values()) {
            child.start(intervalMs);
        }
    }

    /**
     * Stop monitoring.
     */
    stop() {
        if (this._monitoringInterval) {
            clearInterval(this._monitoringInterval);
            this._monitoringInterval = null;
        }

        if (this._loopLagTimer) {
            clearTimeout(this._loopLagTimer);
            this._loopLagTimer = null;
        }

        // Stop child feeds
        for (const child of this._childFeeds.values()) {
            child.stop();
        }

        logger.info(`[PhiTelemetryFeed:${this.name}] Stopped monitoring`);
    }

    /**
     * Start periodic event-loop-lag measurement.
     * @private
     */
    _startEventLoopLagMonitor(intervalMs) {
        const measure = () => {
            const start = process.hrtime.bigint();
            this._loopLagTimer = setTimeout(() => {
                const lag = Number(process.hrtime.bigint() - start) / 1e6 - intervalMs;
                this.eventLoopLag = Math.max(0, lag);
                measure();
            }, intervalMs);
        };
        measure();
    }

    // ══════════════════════════════════════════════════════════════════
    // System Metric Collection
    // ══════════════════════════════════════════════════════════════════

    /**
     * Read CPU, memory, heap, disk and network metrics from the OS.
     */
    updateSystemMetrics() {
        try {
            this._updateCpuUsage();
            this._updateMemoryUsage();
            this._updateHeapStats();
            this._updateNetworkStats();
        } catch (err) {
            logger.error(`[PhiTelemetryFeed:${this.name}] System metrics update failed:`, err);
        }
    }

    /** @private */
    _updateCpuUsage() {
        const cpus = os.cpus();

        let idleNow = 0;
        let totalNow = 0;

        for (const cpu of cpus) {
            for (const type of Object.keys(cpu.times)) {
                totalNow += cpu.times[type];
            }
            idleNow += cpu.times.idle;
        }

        if (this._prevCpuTimes) {
            const { idle: idlePrev, total: totalPrev } = this._prevCpuTimes;
            const idleDelta = idleNow - idlePrev;
            const totalDelta = totalNow - totalPrev;

            if (totalDelta > 0) {
                this.cpuUsage = Math.max(0, Math.min(1, 1 - idleDelta / totalDelta));
            }
        }

        this._prevCpuTimes = { idle: idleNow, total: totalNow };
    }

    /** @private */
    _updateMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        this.memoryUsage = totalMem > 0 ? Math.max(0, Math.min(1, 1 - freeMem / totalMem)) : 0;
    }

    /** @private */
    _updateHeapStats() {
        const mem = safeMemoryUsage();
        if (!mem) return;

        const { heapUsed, heapTotal, rss } = mem;

        // heapUsedPercent: fraction of heap total consumed
        this.heapUsedPercent = heapTotal > 0 ? Math.min(1, heapUsed / heapTotal) : 0;

        // Attempt GC pause via process.cpuUsage if perf_hooks are not available
        // GC pause is populated externally via recordGcPause(); here we just hold the field.
    }

    /** @private */
    _updateNetworkStats() {
        // os.networkInterfaces() gives cumulative stats on some platforms.
        // We use a delta approach but fall back gracefully if not available.
        try {
            const ifaces = os.networkInterfaces();
            let rxBytes = 0;
            let txBytes = 0;

            for (const iface of Object.values(ifaces)) {
                for (const addr of iface) {
                    // Some Node builds expose rx_bytes/tx_bytes; most don't.
                    if (addr.rx_bytes !== undefined) rxBytes += addr.rx_bytes;
                    if (addr.tx_bytes !== undefined) txBytes += addr.tx_bytes;
                }
            }

            if (this._prevNetworkStats && (rxBytes > 0 || txBytes > 0)) {
                this.networkBytesIn = Math.max(0, rxBytes - this._prevNetworkStats.rx);
                this.networkBytesOut = Math.max(0, txBytes - this._prevNetworkStats.tx);
            }

            if (rxBytes > 0 || txBytes > 0) {
                this._prevNetworkStats = { rx: rxBytes, tx: txBytes };
            }
        } catch (_) {
            // Network stats not available on this platform; silently skip
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // Latency Tracking
    // ══════════════════════════════════════════════════════════════════

    /**
     * Record a single request latency sample.
     * @param {number} latencyMs
     */
    recordLatency(latencyMs) {
        if (typeof latencyMs !== 'number' || !isFinite(latencyMs)) return;

        cappedPush(this.latencyHistory, { timestamp: Date.now(), latency: latencyMs }, this.maxHistorySize);
        this.updateLatencyPercentiles();
    }

    /**
     * Recompute P50, P95, P99 and avgResponseTime from latency history.
     */
    updateLatencyPercentiles() {
        if (this.latencyHistory.length === 0) return;

        const sorted = this.latencyHistory.map(h => h.latency).sort((a, b) => a - b);

        this.latencyP50 = percentile(sorted, 0.50);
        this.latencyP95 = percentile(sorted, 0.95);
        this.latencyP99 = percentile(sorted, 0.99);
        this.avgResponseTime = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    }

    // ══════════════════════════════════════════════════════════════════
    // Request / Error Tracking
    // ══════════════════════════════════════════════════════════════════

    /**
     * Record a completed request.
     */
    recordRequest() {
        this.requestCount++;
        cappedPush(this.requestHistory, { timestamp: Date.now(), success: true }, this.maxHistorySize);
        this.updateThroughput();
        this.updateErrorRate();
    }

    /**
     * Record a request error.
     * @param {string} [errorType='unknown']
     */
    recordError(errorType = 'unknown') {
        this.errorCount++;
        cappedPush(this.errorHistory, { timestamp: Date.now(), errorType }, this.maxHistorySize);
        this.updateErrorRate();
    }

    /**
     * Recompute throughput (requests per second) from the last 1-second window.
     */
    updateThroughput() {
        const cutoff = Date.now() - 1000;
        let count = 0;
        // Scan from the end for efficiency
        for (let i = this.requestHistory.length - 1; i >= 0; i--) {
            if (this.requestHistory[i].timestamp >= cutoff) {
                count++;
            } else {
                break;
            }
        }
        this.throughput = count;
    }

    /**
     * Recompute error rate as errorCount / requestCount.
     */
    updateErrorRate() {
        this.errorRate = this.requestCount > 0
            ? Math.min(1, this.errorCount / this.requestCount)
            : 0;
    }

    // ══════════════════════════════════════════════════════════════════
    // Cache Tracking
    // ══════════════════════════════════════════════════════════════════

    recordCacheHit() {
        this.cacheHits++;
        this.updateCacheHitRate();
    }

    recordCacheMiss() {
        this.cacheMisses++;
        this.updateCacheHitRate();
    }

    updateCacheHitRate() {
        const total = this.cacheHits + this.cacheMisses;
        this.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
    }

    // ══════════════════════════════════════════════════════════════════
    // Retry Tracking
    // ══════════════════════════════════════════════════════════════════

    /**
     * Record a retry attempt and whether it succeeded.
     * @param {boolean} success
     */
    recordRetry(success) {
        this.retryCount++;
        if (success) this.retrySuccessCount++;
        this.retrySuccessRate = this.retryCount > 0
            ? this.retrySuccessCount / this.retryCount
            : 0;
    }

    // ══════════════════════════════════════════════════════════════════
    // Setter Methods
    // ══════════════════════════════════════════════════════════════════

    /**
     * @param {number} depth
     */
    setQueueDepth(depth) {
        this.queueDepth = Math.max(0, depth);
    }

    /**
     * @param {number} timeMs
     */
    setAvgWaitTime(timeMs) {
        this.avgWaitTime = Math.max(0, timeMs);
    }

    /**
     * @param {number} accuracy - value in [0, 1]
     */
    setAccuracy(accuracy) {
        this.accuracy = Math.max(0, Math.min(1, accuracy));
    }

    /**
     * @param {number} diversity - value in [0, 1]
     */
    setResponseDiversity(diversity) {
        this.responseDiversity = Math.max(0, Math.min(1, diversity));
    }

    /**
     * @param {number} count
     */
    setActiveConnections(count) {
        this.activeConnections = Math.max(0, count);
    }

    /**
     * Record an external GC pause measurement.
     * @param {number} durationMs
     */
    recordGcPause(durationMs) {
        this.gcPauseDuration = Math.max(0, durationMs);
    }

    /**
     * Manually override disk usage fraction [0, 1].
     * @param {number} fraction
     */
    setDiskUsage(fraction) {
        this.diskUsage = Math.max(0, Math.min(1, fraction));
    }

    /**
     * Manually set open file descriptor count.
     * @param {number} count
     */
    setOpenFileDescriptors(count) {
        this.openFileDescriptors = Math.max(0, count);
    }

    // ══════════════════════════════════════════════════════════════════
    // Read Methods
    // ══════════════════════════════════════════════════════════════════

    /**
     * Return a flat copy of all current metrics.
     * @returns {object}
     */
    getMetrics() {
        return {
            cpuUsage: this.cpuUsage,
            memoryUsage: this.memoryUsage,
            latencyP50: this.latencyP50,
            latencyP95: this.latencyP95,
            latencyP99: this.latencyP99,
            throughput: this.throughput,
            errorRate: this.errorRate,
            queueDepth: this.queueDepth,
            avgWaitTime: this.avgWaitTime,
            cacheHitRate: this.cacheHitRate,
            avgResponseTime: this.avgResponseTime,
            retrySuccessRate: this.retrySuccessRate,
            accuracy: this.accuracy,
            responseDiversity: this.responseDiversity,
            activeConnections: this.activeConnections,
            gcPauseDuration: this.gcPauseDuration,
            eventLoopLag: this.eventLoopLag,
            diskUsage: this.diskUsage,
            networkBytesIn: this.networkBytesIn,
            networkBytesOut: this.networkBytesOut,
            openFileDescriptors: this.openFileDescriptors,
            heapUsedPercent: this.heapUsedPercent,
        };
    }

    /**
     * Return detailed statistics including uptime, totals, and history sizes.
     * @returns {object}
     */
    getStats() {
        const now = Date.now();
        const uptime = now - this.startTime;

        return {
            name: this.name,
            uptime,
            uptimeSeconds: Math.floor(uptime / 1000),
            metrics: this.getMetrics(),
            totals: {
                requests: this.requestCount,
                errors: this.errorCount,
                cacheHits: this.cacheHits,
                cacheMisses: this.cacheMisses,
                retries: this.retryCount,
                retrySuccesses: this.retrySuccessCount,
            },
            historySizes: {
                latency: this.latencyHistory.length,
                requests: this.requestHistory.length,
                errors: this.errorHistory.length,
                maxAllowed: this.maxHistorySize,
            },
            health: this._computeHealth(),
            childFeeds: Array.from(this._childFeeds.keys()),
            timestamp: new Date(now).toISOString(),
        };
    }

    /**
     * Compute a simple system health assessment.
     * @returns {{ status: string, issues: string[] }}
     * @private
     */
    _computeHealth() {
        const issues = [];

        if (this.cpuUsage > 0.9) issues.push('CPU critically high');
        else if (this.cpuUsage > 0.75) issues.push('CPU elevated');

        if (this.memoryUsage > 0.9) issues.push('Memory critically high');
        else if (this.memoryUsage > 0.8) issues.push('Memory elevated');

        if (this.errorRate > 0.1) issues.push('Error rate high (>10%)');
        else if (this.errorRate > 0.05) issues.push('Error rate elevated (>5%)');

        if (this.latencyP99 > 5000) issues.push('P99 latency critical (>5s)');
        else if (this.latencyP99 > 2000) issues.push('P99 latency elevated (>2s)');

        if (this.eventLoopLag > 500) issues.push('Event loop lag critical (>500ms)');
        else if (this.eventLoopLag > 100) issues.push('Event loop lag elevated (>100ms)');

        if (this.queueDepth > 200) issues.push('Queue depth critical (>200)');
        else if (this.queueDepth > 50) issues.push('Queue depth elevated (>50)');

        if (this.heapUsedPercent > 0.95) issues.push('Heap nearly full (>95%)');

        const status = issues.length === 0
            ? 'healthy'
            : issues.some(i => i.includes('critical') || i.includes('Critical'))
                ? 'critical'
                : 'degraded';

        return { status, issues };
    }

    /**
     * Return a latency histogram across the given bucket boundaries (ms).
     * @param {number[]} [buckets=[10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]]
     * @returns {object[]} Array of { le, count, cumulative } objects
     */
    getLatencyHistogram(buckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]) {
        const sorted = [...buckets].sort((a, b) => a - b);
        const counts = new Array(sorted.length + 1).fill(0); // +Inf bucket

        for (const entry of this.latencyHistory) {
            let placed = false;
            for (let i = 0; i < sorted.length; i++) {
                if (entry.latency <= sorted[i]) {
                    counts[i]++;
                    placed = true;
                    break;
                }
            }
            if (!placed) counts[sorted.length]++;
        }

        const result = [];
        let cumulative = 0;

        for (let i = 0; i < sorted.length; i++) {
            cumulative += counts[i];
            result.push({ le: sorted[i], count: counts[i], cumulative });
        }

        cumulative += counts[sorted.length];
        result.push({ le: '+Inf', count: counts[sorted.length], cumulative });

        return result;
    }

    /**
     * Return a time-series snapshot of a named metric over the given window.
     * For latency: returns the latencyHistory entries within the window.
     * For request/error: returns the respective history entries.
     * For scalar metrics: returns the current value with the timestamp.
     *
     * @param {string} metricName
     * @param {number} [durationMs=60000] - lookback window in milliseconds
     * @returns {object[]}
     */
    getTimeSeriesMetric(metricName, durationMs = 60000) {
        const cutoff = Date.now() - durationMs;

        switch (metricName) {
            case 'latency':
            case 'latencyHistory':
                return this.latencyHistory.filter(e => e.timestamp >= cutoff);

            case 'requests':
            case 'requestHistory':
                return this.requestHistory.filter(e => e.timestamp >= cutoff);

            case 'errors':
            case 'errorHistory':
                return this.errorHistory.filter(e => e.timestamp >= cutoff);

            default: {
                // Return single-point snapshot for any other metric field
                const value = this[metricName];
                if (value === undefined) {
                    logger.warn(`[PhiTelemetryFeed:${this.name}] Unknown metric: ${metricName}`);
                    return [];
                }
                return [{ timestamp: Date.now(), value }];
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // Reset
    // ══════════════════════════════════════════════════════════════════

    /**
     * Zero all counters and clear all histories.
     */
    reset() {
        this.cpuUsage = 0;
        this.memoryUsage = 0;
        this.latencyP50 = 0;
        this.latencyP95 = 0;
        this.latencyP99 = 0;
        this.throughput = 0;
        this.errorRate = 0;
        this.queueDepth = 0;
        this.avgWaitTime = 0;
        this.cacheHitRate = 0;
        this.avgResponseTime = 0;
        this.retrySuccessRate = 0;
        this.accuracy = 0;
        this.responseDiversity = 0;
        this.activeConnections = 0;
        this.gcPauseDuration = 0;
        this.eventLoopLag = 0;
        this.diskUsage = 0;
        this.networkBytesIn = 0;
        this.networkBytesOut = 0;
        this.openFileDescriptors = 0;
        this.heapUsedPercent = 0;

        this.latencyHistory = [];
        this.requestHistory = [];
        this.errorHistory = [];

        this.requestCount = 0;
        this.errorCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.retryCount = 0;
        this.retrySuccessCount = 0;
        this.startTime = Date.now();

        this._prevCpuTimes = null;
        this._prevNetworkStats = null;

        logger.info(`[PhiTelemetryFeed:${this.name}] Feed reset`);
    }

    // ══════════════════════════════════════════════════════════════════
    // Serialization
    // ══════════════════════════════════════════════════════════════════

    /**
     * Return a plain serializable representation of this feed.
     * @returns {object}
     */
    toJSON() {
        return {
            name: this.name,
            startTime: this.startTime,
            maxHistorySize: this.maxHistorySize,
            metrics: this.getMetrics(),
            counters: {
                requestCount: this.requestCount,
                errorCount: this.errorCount,
                cacheHits: this.cacheHits,
                cacheMisses: this.cacheMisses,
                retryCount: this.retryCount,
                retrySuccessCount: this.retrySuccessCount,
            },
            historySnapshot: {
                latency: this.latencyHistory.slice(-10),    // last 10 samples
                requests: this.requestHistory.slice(-10),
                errors: this.errorHistory.slice(-10),
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════
    // Child Feeds
    // ══════════════════════════════════════════════════════════════════

    /**
     * Create a named sub-feed that records its own metrics while
     * also propagating latency, request, and error events to this parent.
     *
     * @param {string} name - identifier for the child feed
     * @returns {PhiTelemetryFeed}
     */
    createChildFeed(name) {
        if (this._childFeeds.has(name)) {
            logger.warn(`[PhiTelemetryFeed:${this.name}] Child feed '${name}' already exists — returning existing`);
            return this._childFeeds.get(name);
        }

        const child = new PhiTelemetryFeed({ name, maxHistorySize: this.maxHistorySize });

        // Proxy: propagate events from child up to parent
        const parentRecordLatency = this.recordLatency.bind(this);
        const parentRecordRequest = this.recordRequest.bind(this);
        const parentRecordError = this.recordError.bind(this);

        const origRecordLatency = child.recordLatency.bind(child);
        child.recordLatency = (latencyMs) => {
            origRecordLatency(latencyMs);
            parentRecordLatency(latencyMs);
        };

        const origRecordRequest = child.recordRequest.bind(child);
        child.recordRequest = () => {
            origRecordRequest();
            parentRecordRequest();
        };

        const origRecordError = child.recordError.bind(child);
        child.recordError = (errorType) => {
            origRecordError(errorType);
            parentRecordError(errorType);
        };

        this._childFeeds.set(name, child);
        logger.info(`[PhiTelemetryFeed:${this.name}] Created child feed '${name}'`);

        return child;
    }

    /**
     * Retrieve a previously created child feed by name.
     * @param {string} name
     * @returns {PhiTelemetryFeed|undefined}
     */
    getChildFeed(name) {
        return this._childFeeds.get(name);
    }
}

// ───────────────────────────────────────────────────────────────────
// Singleton
// ───────────────────────────────────────────────────────────────────

const telemetryFeed = new PhiTelemetryFeed({ name: 'root' });

module.exports = telemetryFeed;
module.exports.PhiTelemetryFeed = PhiTelemetryFeed;

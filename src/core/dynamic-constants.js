/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Dynamic Constants
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Replace EVERY hardcoded constant with self-adjusting PhiScale instances.
 * These values continuously adapt based on real-time telemetry.
 * ═══════════════════════════════════════════════════════════════════
 */

const { PhiScale, PHI, PHI_INVERSE } = require('./phi-scales');
const logger = require('../utils/logger');

// Telemetry adjustment functions
const telemetryFeeds = {
    // Timeout adjusts based on p99 latency
    timeout: (metrics, scale) => {
        const p99 = metrics.latencyP99 || 1000;
        const target = p99 * PHI; // Target: φ × p99
        return (target - scale.current) * 0.1; // 10% adjustment
    },

    // Retry count adjusts based on error rate
    retryCount: (metrics, scale) => {
        const errorRate = metrics.errorRate || 0;
        if (errorRate > 0.1) return 0.5; // Increase retries
        if (errorRate < 0.01) return -0.2; // Decrease retries
        return 0;
    },

    // Batch size adjusts based on throughput
    batchSize: (metrics, scale) => {
        const throughput = metrics.throughput || 1;
        const cpuUsage = metrics.cpuUsage || 0.5;

        if (cpuUsage > 0.8) return -2; // Reduce batch size
        if (cpuUsage < 0.4 && throughput > 100) return 3; // Increase batch size
        return 0;
    },

    // Confidence threshold adjusts based on accuracy
    confidence: (metrics, scale) => {
        const accuracy = metrics.accuracy || 0.9;
        const target = PHI_INVERSE; // Natural phi-point

        if (accuracy > 0.95) return -0.02; // Lower threshold
        if (accuracy < 0.85) return 0.03; // Raise threshold
        return (target - scale.current) * 0.05;
    },

    // Priority adjusts based on queue depth
    priority: (metrics, scale) => {
        const queueDepth = metrics.queueDepth || 0;
        const avgWait = metrics.avgWaitTime || 0;

        if (queueDepth > 100 || avgWait > 5000) return 0.3;
        if (queueDepth < 10) return -0.1;
        return 0;
    },

    // Temperature adjusts based on creativity needs
    temperature: (metrics, scale) => {
        const diversity = metrics.responseDiversity || 0.5;

        if (diversity < 0.3) return 0.05; // Increase randomness
        if (diversity > 0.8) return -0.03; // Decrease randomness
        return 0;
    },

    // Cache TTL adjusts based on hit rate
    cacheTTL: (metrics, scale) => {
        const hitRate = metrics.cacheHitRate || 0.5;
        const memoryUsage = metrics.memoryUsage || 0.5;

        if (hitRate > 0.9 && memoryUsage < 0.7) return 1000; // Extend TTL
        if (hitRate < 0.5) return -500; // Reduce TTL
        return 0;
    },

    // Rate limit adjusts based on system load
    rateLimit: (metrics, scale) => {
        const cpuUsage = metrics.cpuUsage || 0.5;
        const memoryUsage = metrics.memoryUsage || 0.5;
        const load = (cpuUsage + memoryUsage) / 2;

        if (load > 0.85) return -5; // Decrease rate limit
        if (load < 0.5) return 3; // Increase rate limit
        return 0;
    },

    // Concurrency adjusts based on response time
    concurrency: (metrics, scale) => {
        const avgResponseTime = metrics.avgResponseTime || 100;
        const cpuUsage = metrics.cpuUsage || 0.5;

        if (avgResponseTime > 1000 && cpuUsage < 0.7) return 1;
        if (avgResponseTime < 100 && cpuUsage > 0.8) return -1;
        return 0;
    },

    // Backoff interval adjusts based on retry success
    backoffInterval: (metrics, scale) => {
        const retrySuccess = metrics.retrySuccessRate || 0.5;

        if (retrySuccess > 0.8) return -50; // Faster retries
        if (retrySuccess < 0.3) return 100; // Slower retries
        return 0;
    }
};

// ═══════════════════════════════════════════════════════════════════
// DYNAMIC CONSTANTS - All continuously adjusting via PhiScale
// ═══════════════════════════════════════════════════════════════════

const DynamicTimeout = new PhiScale({
    name: 'Timeout',
    baseValue: 5000,
    min: 1000,
    max: 30000,
    phiNormalized: false,
    sensitivity: 0.15,
    telemetryFeed: telemetryFeeds.timeout
});

const DynamicRetryCount = new PhiScale({
    name: 'RetryCount',
    baseValue: 3,
    min: 1,
    max: 8,
    phiNormalized: false,
    sensitivity: 0.2,
    telemetryFeed: telemetryFeeds.retryCount
});

const DynamicBatchSize = new PhiScale({
    name: 'BatchSize',
    baseValue: 21, // Fibonacci number
    min: 5,
    max: 144, // Fibonacci number
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.batchSize
});

const DynamicConfidenceThreshold = new PhiScale({
    name: 'ConfidenceThreshold',
    baseValue: PHI_INVERSE, // Golden ratio as natural threshold
    min: 0.3,
    max: 0.95,
    phiNormalized: true,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.confidence
});

const DynamicPriority = new PhiScale({
    name: 'Priority',
    baseValue: PHI_INVERSE,
    min: 0,
    max: PHI,
    phiNormalized: true,
    sensitivity: 0.12,
    telemetryFeed: telemetryFeeds.priority
});

const DynamicTemperature = new PhiScale({
    name: 'Temperature',
    baseValue: 0.7,
    min: 0.0,
    max: 1.5,
    phiNormalized: true,
    sensitivity: 0.05,
    telemetryFeed: telemetryFeeds.temperature
});

const DynamicCacheTTL = new PhiScale({
    name: 'CacheTTL',
    baseValue: 3600000, // 1 hour
    min: 60000, // 1 minute
    max: 86400000, // 24 hours
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.cacheTTL
});

const DynamicRateLimit = new PhiScale({
    name: 'RateLimit',
    baseValue: 100,
    min: 10,
    max: 1000,
    phiNormalized: false,
    sensitivity: 0.15,
    telemetryFeed: telemetryFeeds.rateLimit
});

const DynamicConcurrency = new PhiScale({
    name: 'Concurrency',
    baseValue: 8, // Fibonacci number
    min: 2,
    max: 55, // Fibonacci number
    phiNormalized: false,
    sensitivity: 0.18,
    telemetryFeed: telemetryFeeds.concurrency
});

const DynamicBackoffInterval = new PhiScale({
    name: 'BackoffInterval',
    baseValue: 1000,
    min: 100,
    max: 10000,
    phiNormalized: false,
    sensitivity: 0.12,
    telemetryFeed: telemetryFeeds.backoffInterval
});

// CSL-specific thresholds (used in semantic-logic.js)
const DynamicResonanceThreshold = new PhiScale({
    name: 'ResonanceThreshold',
    baseValue: 0.95,
    min: 0.7,
    max: 0.99,
    phiNormalized: true,
    sensitivity: 0.05,
    telemetryFeed: telemetryFeeds.confidence
});

const DynamicTernaryPositiveThreshold = new PhiScale({
    name: 'TernaryPositiveThreshold',
    baseValue: 0.72,
    min: 0.6,
    max: 0.85,
    phiNormalized: true,
    sensitivity: 0.06
});

const DynamicTernaryNegativeThreshold = new PhiScale({
    name: 'TernaryNegativeThreshold',
    baseValue: 0.35,
    min: 0.2,
    max: 0.5,
    phiNormalized: true,
    sensitivity: 0.06
});

const DynamicSoftGateSteepness = new PhiScale({
    name: 'SoftGateSteepness',
    baseValue: 20,
    min: 5,
    max: 50,
    phiNormalized: false,
    sensitivity: 0.1
});

const DynamicRiskSensitivity = new PhiScale({
    name: 'RiskSensitivity',
    baseValue: 0.8,
    min: 0.5,
    max: 0.95,
    phiNormalized: true,
    sensitivity: 0.08
});

// ═══════════════════════════════════════════════════════════════════
// ADJUSTMENT API
// ═══════════════════════════════════════════════════════════════════

let adjustmentInterval = null;

/**
 * Start automatic adjustment loop
 */
function startAdjustment(telemetryProvider, intervalMs = 5000) {
    if (adjustmentInterval) {
        logger.warn('Dynamic constants adjustment already running');
        return;
    }

    logger.info(`Starting dynamic constants adjustment (interval: ${intervalMs}ms)`);

    adjustmentInterval = setInterval(async () => {
        try {
            const metrics = await telemetryProvider();

            // Adjust all scales
            DynamicTimeout.adjust(metrics);
            DynamicRetryCount.adjust(metrics);
            DynamicBatchSize.adjust(metrics);
            DynamicConfidenceThreshold.adjust(metrics);
            DynamicPriority.adjust(metrics);
            DynamicTemperature.adjust(metrics);
            DynamicCacheTTL.adjust(metrics);
            DynamicRateLimit.adjust(metrics);
            DynamicConcurrency.adjust(metrics);
            DynamicBackoffInterval.adjust(metrics);
            DynamicResonanceThreshold.adjust(metrics);
            DynamicTernaryPositiveThreshold.adjust(metrics);
            DynamicTernaryNegativeThreshold.adjust(metrics);
            DynamicSoftGateSteepness.adjust(metrics);
            DynamicRiskSensitivity.adjust(metrics);

        } catch (err) {
            logger.error('Dynamic constants adjustment error:', err);
        }
    }, intervalMs);
}

/**
 * Stop automatic adjustment
 */
function stopAdjustment() {
    if (adjustmentInterval) {
        clearInterval(adjustmentInterval);
        adjustmentInterval = null;
        logger.info('Stopped dynamic constants adjustment');
    }
}

/**
 * Get all current values as object
 */
function getAllValues() {
    return {
        timeout: DynamicTimeout.value,
        retryCount: DynamicRetryCount.asInt(),
        batchSize: DynamicBatchSize.asInt(),
        confidenceThreshold: DynamicConfidenceThreshold.value,
        priority: DynamicPriority.value,
        temperature: DynamicTemperature.value,
        cacheTTL: DynamicCacheTTL.asMs(),
        rateLimit: DynamicRateLimit.asInt(),
        concurrency: DynamicConcurrency.asInt(),
        backoffInterval: DynamicBackoffInterval.asMs(),
        resonanceThreshold: DynamicResonanceThreshold.value,
        ternaryPositiveThreshold: DynamicTernaryPositiveThreshold.value,
        ternaryNegativeThreshold: DynamicTernaryNegativeThreshold.value,
        softGateSteepness: DynamicSoftGateSteepness.value,
        riskSensitivity: DynamicRiskSensitivity.value
    };
}

/**
 * Get statistics for all scales
 */
function getAllStats() {
    return {
        timeout: DynamicTimeout.stats(),
        retryCount: DynamicRetryCount.stats(),
        batchSize: DynamicBatchSize.stats(),
        confidenceThreshold: DynamicConfidenceThreshold.stats(),
        priority: DynamicPriority.stats(),
        temperature: DynamicTemperature.stats(),
        cacheTTL: DynamicCacheTTL.stats(),
        rateLimit: DynamicRateLimit.stats(),
        concurrency: DynamicConcurrency.stats(),
        backoffInterval: DynamicBackoffInterval.stats()
    };
}

/**
 * Reset all scales to base values
 */
function resetAll() {
    DynamicTimeout.reset();
    DynamicRetryCount.reset();
    DynamicBatchSize.reset();
    DynamicConfidenceThreshold.reset();
    DynamicPriority.reset();
    DynamicTemperature.reset();
    DynamicCacheTTL.reset();
    DynamicRateLimit.reset();
    DynamicConcurrency.reset();
    DynamicBackoffInterval.reset();
    DynamicResonanceThreshold.reset();
    DynamicTernaryPositiveThreshold.reset();
    DynamicTernaryNegativeThreshold.reset();
    DynamicSoftGateSteepness.reset();
    DynamicRiskSensitivity.reset();

    logger.info('Reset all dynamic constants to base values');
}

module.exports = {
    // Dynamic scale instances
    DynamicTimeout,
    DynamicRetryCount,
    DynamicBatchSize,
    DynamicConfidenceThreshold,
    DynamicPriority,
    DynamicTemperature,
    DynamicCacheTTL,
    DynamicRateLimit,
    DynamicConcurrency,
    DynamicBackoffInterval,

    // CSL-specific
    DynamicResonanceThreshold,
    DynamicTernaryPositiveThreshold,
    DynamicTernaryNegativeThreshold,
    DynamicSoftGateSteepness,
    DynamicRiskSensitivity,

    // Management API
    startAdjustment,
    stopAdjustment,
    getAllValues,
    getAllStats,
    resetAll
};

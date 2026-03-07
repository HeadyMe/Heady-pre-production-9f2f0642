/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Dynamic Constants
 * ═══════════════════════════════════════════════════════════════════
 *
 * Replaces EVERY hardcoded constant in the orchestration platform with
 * self-adjusting PhiScale instances. Values continuously adapt based on
 * real-time telemetry, bounded by phi-harmonic ranges.
 *
 * φ  = 1.618033988749895   (golden ratio)
 * 1/φ = 0.618033988749895  (phi inverse — natural balance point)
 *
 * Fibonacci bounds used where noted:
 *   batch sizes: 5, 8, 13, 21, 34, 55, 89, 144
 *   circuit breaker: 2, 3, 5, 8, 13
 *   pool percents:   8, 13, 21, 34, 55
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const { PhiScale, PHI, PHI_INVERSE } = require('./phi-scales');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════
// TELEMETRY FEED FUNCTIONS
// Each takes (metrics, scale) and returns a numeric delta.
// ═══════════════════════════════════════════════════════════════════

const telemetryFeeds = {

    /**
     * timeout — adjusts based on latencyP99.
     * Target = p99 × φ  (phi cushion above observed worst-case).
     */
    timeout: (metrics, scale) => {
        const p99 = metrics.latencyP99 || 1000;
        const target = p99 * PHI;
        return (target - scale.current) * 0.1;
    },

    /**
     * retryCount — increases when errorRate > 0.1, decreases when < 0.01.
     */
    retryCount: (metrics, scale) => {
        const errorRate = metrics.errorRate || 0;
        if (errorRate > 0.1) return 0.5;
        if (errorRate < 0.01) return -0.2;
        return 0;
    },

    /**
     * batchSize — reduces under high CPU load, grows when idle and throughput is high.
     */
    batchSize: (metrics, scale) => {
        const throughput = metrics.throughput || 1;
        const cpuUsage = metrics.cpuUsage || 0.5;
        if (cpuUsage > 0.8) return -2;
        if (cpuUsage < 0.4 && throughput > 100) return 3;
        return 0;
    },

    /**
     * confidence — tracks accuracy against PHI_INVERSE as natural equilibrium.
     */
    confidence: (metrics, scale) => {
        const accuracy = metrics.accuracy || 0.9;
        const target = PHI_INVERSE;
        if (accuracy > 0.95) return -0.02;
        if (accuracy < 0.85) return 0.03;
        return (target - scale.current) * 0.05;
    },

    /**
     * priority — escalates under deep queues or elevated wait times.
     */
    priority: (metrics, scale) => {
        const queueDepth = metrics.queueDepth || 0;
        const avgWait = metrics.avgWaitTime || 0;
        if (queueDepth > 100 || avgWait > 5000) return 0.3;
        if (queueDepth < 10) return -0.1;
        return 0;
    },

    /**
     * temperature — nudges toward higher randomness when responses are homogeneous.
     */
    temperature: (metrics, scale) => {
        const diversity = metrics.responseDiversity || 0.5;
        if (diversity < 0.3) return 0.05;
        if (diversity > 0.8) return -0.03;
        return 0;
    },

    /**
     * cacheTTL — extends when hit rate is high and memory is available;
     *            shrinks on low hit rate to reduce stale data risk.
     */
    cacheTTL: (metrics, scale) => {
        const hitRate = metrics.cacheHitRate || 0.5;
        const memoryUsage = metrics.memoryUsage || 0.5;
        if (hitRate > 0.9 && memoryUsage < 0.7) return 1000;
        if (hitRate < 0.5) return -500;
        return 0;
    },

    /**
     * rateLimit — reduces under high combined CPU+memory load, grows when idle.
     */
    rateLimit: (metrics, scale) => {
        const cpuUsage = metrics.cpuUsage || 0.5;
        const memoryUsage = metrics.memoryUsage || 0.5;
        const load = (cpuUsage + memoryUsage) / 2;
        if (load > 0.85) return -5;
        if (load < 0.5) return 3;
        return 0;
    },

    /**
     * concurrency — adds workers when response time is slow but CPU is free;
     *               removes workers when response time is fast but CPU is hot.
     */
    concurrency: (metrics, scale) => {
        const avgResponseTime = metrics.avgResponseTime || 100;
        const cpuUsage = metrics.cpuUsage || 0.5;
        if (avgResponseTime > 1000 && cpuUsage < 0.7) return 1;
        if (avgResponseTime < 100 && cpuUsage > 0.8) return -1;
        return 0;
    },

    /**
     * backoffInterval — shortens when retries are succeeding; lengthens when failing.
     */
    backoffInterval: (metrics, scale) => {
        const retrySuccess = metrics.retrySuccessRate || 0.5;
        if (retrySuccess > 0.8) return -50;
        if (retrySuccess < 0.3) return 100;
        return 0;
    },

    /**
     * circuitBreaker — adjusts the failure threshold based on overall system health.
     * Unhealthy system → lower threshold (trip faster); healthy → higher tolerance.
     */
    circuitBreaker: (metrics, scale) => {
        const systemHealth = metrics.systemHealth || 0.8;
        // systemHealth in [0,1]; 1.0 = fully healthy
        if (systemHealth < 0.5) return -0.5;  // Trip circuit sooner
        if (systemHealth > 0.9) return 0.3;   // Tolerate more failures
        return 0;
    },

    /**
     * governance — widens the policy priority spread when violations are frequent;
     *              compresses spread when the system is well-behaved.
     */
    governance: (metrics, scale) => {
        const violationRate = metrics.violationRate || 0;
        if (violationRate > 0.05) return 50;   // Widen priority separation
        if (violationRate < 0.005) return -20; // Compress priority spread
        return 0;
    },

    /**
     * tokenBudget — trims budget when latency is high or cost per token spikes;
     *               grows budget when conditions are favourable.
     */
    tokenBudget: (metrics, scale) => {
        const latency = metrics.latencyP99 || 500;
        const costPerToken = metrics.costPerToken || 0.00001;
        const costPressure = costPerToken > 0.00005 ? 1 : 0;

        if (latency > 5000 || costPressure) return -128;
        if (latency < 500 && !costPressure) return 64;
        return 0;
    },

    /**
     * queueLimit — expands when processing throughput is high;
     *              contracts when processing is slow to avoid memory bloat.
     */
    queueLimit: (metrics, scale) => {
        const throughput = metrics.throughput || 50;
        if (throughput > 200) return 5;
        if (throughput < 20) return -5;
        return 0;
    }
};

// ═══════════════════════════════════════════════════════════════════
// DYNAMIC CONSTANTS — All PhiScale instances, fully instantiated
// ═══════════════════════════════════════════════════════════════════

// ── Network & Resilience ─────────────────────────────────────────

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

const DynamicBackoffInterval = new PhiScale({
    name: 'BackoffInterval',
    baseValue: 1000,
    min: 100,
    max: 10000,
    phiNormalized: false,
    sensitivity: 0.12,
    telemetryFeed: telemetryFeeds.backoffInterval
});

const DynamicJitterFactor = new PhiScale({
    name: 'JitterFactor',
    baseValue: 0.15,
    min: 0.05,
    max: 0.4,
    phiNormalized: true,
    sensitivity: 0.05
    // No telemetry feed; passively adjusted via snapshot/restore or manual tuning
});

// ── Processing & Throughput ──────────────────────────────────────

const DynamicBatchSize = new PhiScale({
    name: 'BatchSize',
    baseValue: 21,    // Fibonacci
    min: 5,           // Fibonacci
    max: 144,         // Fibonacci
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.batchSize
});

const DynamicConcurrency = new PhiScale({
    name: 'Concurrency',
    baseValue: 8,     // Fibonacci
    min: 2,           // Fibonacci
    max: 55,          // Fibonacci
    phiNormalized: false,
    sensitivity: 0.18,
    telemetryFeed: telemetryFeeds.concurrency
});

const DynamicQueueLimit = new PhiScale({
    name: 'QueueLimit',
    baseValue: 100,
    min: 10,
    max: 1000,
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.queueLimit
});

// ── Inference & Model Tuning ─────────────────────────────────────

const DynamicConfidenceThreshold = new PhiScale({
    name: 'ConfidenceThreshold',
    baseValue: PHI_INVERSE,
    min: 0.3,
    max: 0.95,
    phiNormalized: true,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.confidence
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

const DynamicMaxTokens = new PhiScale({
    name: 'MaxTokens',
    baseValue: 4096,
    min: 256,
    max: 32768,
    phiNormalized: false,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.tokenBudget
});

// ── Learning & Adaptation ─────────────────────────────────────────

const DynamicLearningRate = new PhiScale({
    name: 'LearningRate',
    baseValue: 0.01,
    min: 0.001,
    max: 0.1,
    phiNormalized: true,
    sensitivity: 0.05
});

const DynamicMomentumDecay = new PhiScale({
    name: 'MomentumDecay',
    baseValue: 0.9,
    min: 0.7,
    max: 0.99,
    phiNormalized: true,
    sensitivity: 0.03
});

const DynamicCoherenceThreshold = new PhiScale({
    name: 'CoherenceThreshold',
    baseValue: 0.75,
    min: 0.5,
    max: 0.95,
    phiNormalized: true,
    sensitivity: 0.06,
    telemetryFeed: telemetryFeeds.confidence
});

const DynamicDriftAlertThreshold = new PhiScale({
    name: 'DriftAlertThreshold',
    baseValue: 0.75,
    min: 0.5,
    max: 0.9,
    phiNormalized: true,
    sensitivity: 0.06
});

// ── Caching & Infrastructure ─────────────────────────────────────

const DynamicCacheTTL = new PhiScale({
    name: 'CacheTTL',
    baseValue: 3600000,   // 1 hour
    min: 60000,           // 1 minute
    max: 86400000,        // 24 hours
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

// ── Priority ─────────────────────────────────────────────────────

const DynamicPriority = new PhiScale({
    name: 'Priority',
    baseValue: PHI_INVERSE,
    min: 0,
    max: PHI,
    phiNormalized: true,
    sensitivity: 0.12,
    telemetryFeed: telemetryFeeds.priority
});

const DynamicGovernancePriority = new PhiScale({
    name: 'GovernancePriority',
    baseValue: 1000,
    min: 100,
    max: 10000,
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.governance
});

// ── Circuit Breaker ───────────────────────────────────────────────

const DynamicCircuitBreakerFailures = new PhiScale({
    name: 'CircuitBreakerFailures',
    baseValue: 5,     // Fibonacci
    min: 2,           // Fibonacci
    max: 13,          // Fibonacci
    phiNormalized: false,
    sensitivity: 0.15,
    telemetryFeed: telemetryFeeds.circuitBreaker
});

const DynamicCircuitBreakerTimeout = new PhiScale({
    name: 'CircuitBreakerTimeout',
    baseValue: 30000,
    min: 5000,
    max: 120000,
    phiNormalized: false,
    sensitivity: 0.12,
    telemetryFeed: telemetryFeeds.timeout
});

const DynamicCircuitBreakerSuccessThreshold = new PhiScale({
    name: 'CircuitBreakerSuccessThreshold',
    baseValue: 3,     // Fibonacci
    min: 1,
    max: 8,           // Fibonacci
    phiNormalized: false,
    sensitivity: 0.1,
    telemetryFeed: telemetryFeeds.retryCount
});

// ── CSL (Cognitive Semantic Logic) Thresholds ────────────────────

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

// ── Embeddings & Vector Space ─────────────────────────────────────

const DynamicEmbeddingDimension = new PhiScale({
    name: 'EmbeddingDimension',
    baseValue: 384,
    min: 128,
    max: 1536,
    phiNormalized: false,
    sensitivity: 0.05
    // Discrete; use .asInt() when reading
});

// ── Agent Pool Composition (Fibonacci percentages) ───────────────

const DynamicPoolHotPercent = new PhiScale({
    name: 'PoolHotPercent',
    baseValue: 34,    // Fibonacci
    min: 20,
    max: 55,          // Fibonacci
    phiNormalized: false,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.concurrency
});

const DynamicPoolWarmPercent = new PhiScale({
    name: 'PoolWarmPercent',
    baseValue: 21,    // Fibonacci
    min: 13,          // Fibonacci
    max: 34,          // Fibonacci
    phiNormalized: false,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.concurrency
});

const DynamicPoolColdPercent = new PhiScale({
    name: 'PoolColdPercent',
    baseValue: 13,    // Fibonacci
    min: 8,           // Fibonacci
    max: 21,          // Fibonacci
    phiNormalized: false,
    sensitivity: 0.08,
    telemetryFeed: telemetryFeeds.concurrency
});

// ═══════════════════════════════════════════════════════════════════
// REGISTRY — ordered array of all scales for bulk operations
// ═══════════════════════════════════════════════════════════════════

const ALL_SCALES = [
    DynamicTimeout,
    DynamicRetryCount,
    DynamicBackoffInterval,
    DynamicJitterFactor,
    DynamicBatchSize,
    DynamicConcurrency,
    DynamicQueueLimit,
    DynamicConfidenceThreshold,
    DynamicTemperature,
    DynamicMaxTokens,
    DynamicLearningRate,
    DynamicMomentumDecay,
    DynamicCoherenceThreshold,
    DynamicDriftAlertThreshold,
    DynamicCacheTTL,
    DynamicRateLimit,
    DynamicPriority,
    DynamicGovernancePriority,
    DynamicCircuitBreakerFailures,
    DynamicCircuitBreakerTimeout,
    DynamicCircuitBreakerSuccessThreshold,
    DynamicResonanceThreshold,
    DynamicTernaryPositiveThreshold,
    DynamicTernaryNegativeThreshold,
    DynamicSoftGateSteepness,
    DynamicRiskSensitivity,
    DynamicEmbeddingDimension,
    DynamicPoolHotPercent,
    DynamicPoolWarmPercent,
    DynamicPoolColdPercent
];

// ═══════════════════════════════════════════════════════════════════
// MANAGEMENT API
// ═══════════════════════════════════════════════════════════════════

let adjustmentInterval = null;

/**
 * Start the automatic telemetry-driven adjustment loop.
 *
 * @param {Function} telemetryProvider  Async function () => metrics object
 * @param {number}   intervalMs         Polling interval (default 5000 ms)
 */
function startAdjustment(telemetryProvider, intervalMs = 5000) {
    if (adjustmentInterval) {
        logger.warn('Dynamic constants adjustment already running — skipping duplicate start');
        return;
    }

    logger.info(`Starting dynamic constants adjustment loop (interval: ${intervalMs}ms, scales: ${ALL_SCALES.length})`);

    adjustmentInterval = setInterval(async () => {
        try {
            const metrics = await telemetryProvider();
            for (const scale of ALL_SCALES) {
                scale.adjust(metrics);
            }
        } catch (err) {
            logger.error('Dynamic constants adjustment error:', err);
        }
    }, intervalMs);
}

/**
 * Stop the automatic adjustment loop.
 */
function stopAdjustment() {
    if (adjustmentInterval) {
        clearInterval(adjustmentInterval);
        adjustmentInterval = null;
        logger.info('Stopped dynamic constants adjustment loop');
    }
}

/**
 * Return all current values as a flat object.
 * Integer-type scales use .asInt(); time-type scales use .asMs().
 */
function getAllValues() {
    return {
        // Network & Resilience
        timeout:                        DynamicTimeout.asMs(),
        retryCount:                     DynamicRetryCount.asInt(),
        backoffInterval:                DynamicBackoffInterval.asMs(),
        jitterFactor:                   DynamicJitterFactor.value,

        // Processing & Throughput
        batchSize:                      DynamicBatchSize.asInt(),
        concurrency:                    DynamicConcurrency.asInt(),
        queueLimit:                     DynamicQueueLimit.asInt(),

        // Inference & Model Tuning
        confidenceThreshold:            DynamicConfidenceThreshold.value,
        temperature:                    DynamicTemperature.value,
        maxTokens:                      DynamicMaxTokens.asInt(),

        // Learning & Adaptation
        learningRate:                   DynamicLearningRate.value,
        momentumDecay:                  DynamicMomentumDecay.value,
        coherenceThreshold:             DynamicCoherenceThreshold.value,
        driftAlertThreshold:            DynamicDriftAlertThreshold.value,

        // Caching & Infrastructure
        cacheTTL:                       DynamicCacheTTL.asMs(),
        rateLimit:                      DynamicRateLimit.asInt(),

        // Priority
        priority:                       DynamicPriority.value,
        governancePriority:             DynamicGovernancePriority.asInt(),

        // Circuit Breaker
        circuitBreakerFailures:         DynamicCircuitBreakerFailures.asInt(),
        circuitBreakerTimeout:          DynamicCircuitBreakerTimeout.asMs(),
        circuitBreakerSuccessThreshold: DynamicCircuitBreakerSuccessThreshold.asInt(),

        // CSL Thresholds
        resonanceThreshold:             DynamicResonanceThreshold.value,
        ternaryPositiveThreshold:       DynamicTernaryPositiveThreshold.value,
        ternaryNegativeThreshold:       DynamicTernaryNegativeThreshold.value,
        softGateSteepness:              DynamicSoftGateSteepness.value,
        riskSensitivity:                DynamicRiskSensitivity.value,

        // Embeddings & Vector Space
        embeddingDimension:             DynamicEmbeddingDimension.asInt(),

        // Pool Composition
        poolHotPercent:                 DynamicPoolHotPercent.asInt(),
        poolWarmPercent:                DynamicPoolWarmPercent.asInt(),
        poolColdPercent:                DynamicPoolColdPercent.asInt()
    };
}

/**
 * Return statistics objects for all scales.
 */
function getAllStats() {
    const stats = {};
    for (const scale of ALL_SCALES) {
        stats[scale.name] = scale.stats();
    }
    return stats;
}

/**
 * Reset every scale to its base value and clear history.
 */
function resetAll() {
    for (const scale of ALL_SCALES) {
        scale.reset();
    }
    logger.info(`Reset all ${ALL_SCALES.length} dynamic constants to base values`);
}

/**
 * Look up a PhiScale instance by its name property.
 *
 * @param  {string}        name  The scale name (e.g. 'Timeout', 'BatchSize')
 * @returns {PhiScale|null}
 */
function getScaleByName(name) {
    return ALL_SCALES.find(s => s.name === name) || null;
}

/**
 * Return the array of all PhiScale instances.
 *
 * @returns {PhiScale[]}
 */
function getAllScales() {
    return [...ALL_SCALES];
}

/**
 * Serialize all current scale states to a plain JSON-safe object.
 * Use in conjunction with restore() for checkpoint/rollback patterns.
 *
 * @returns {Object}
 */
function snapshot() {
    const data = {
        timestamp: Date.now(),
        version: 1,
        scales: {}
    };

    for (const scale of ALL_SCALES) {
        data.scales[scale.name] = {
            current: scale.current,
            momentum: scale.momentum,
            adjustmentHistory: scale.adjustmentHistory.slice() // shallow copy
        };
    }

    logger.debug(`Snapshot captured for ${ALL_SCALES.length} scales`);
    return data;
}

/**
 * Restore scale states from a previously captured snapshot.
 * Missing keys in the snapshot are silently skipped.
 *
 * @param {Object} data  Object previously returned by snapshot()
 */
function restore(data) {
    if (!data || !data.scales) {
        logger.warn('restore() called with invalid snapshot data — ignoring');
        return;
    }

    let restored = 0;
    for (const scale of ALL_SCALES) {
        const entry = data.scales[scale.name];
        if (!entry) continue;

        scale.current = typeof entry.current === 'number' ? entry.current : scale.baseValue;
        scale.momentum = typeof entry.momentum === 'number' ? entry.momentum : 0;

        if (Array.isArray(entry.adjustmentHistory)) {
            scale.adjustmentHistory = entry.adjustmentHistory.slice();
            // Enforce max history size
            if (scale.adjustmentHistory.length > scale.maxHistorySize) {
                scale.adjustmentHistory = scale.adjustmentHistory.slice(-scale.maxHistorySize);
            }
        }

        // Re-clamp to bounds
        if (scale.enforceBounds) {
            scale.current = Math.max(scale.min, Math.min(scale.max, scale.current));
        }

        restored++;
    }

    logger.info(`Restored ${restored}/${ALL_SCALES.length} scales from snapshot (timestamp: ${data.timestamp || 'unknown'})`);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // ── Network & Resilience ────────────────────────────────────────
    DynamicTimeout,
    DynamicRetryCount,
    DynamicBackoffInterval,
    DynamicJitterFactor,

    // ── Processing & Throughput ─────────────────────────────────────
    DynamicBatchSize,
    DynamicConcurrency,
    DynamicQueueLimit,

    // ── Inference & Model Tuning ────────────────────────────────────
    DynamicConfidenceThreshold,
    DynamicTemperature,
    DynamicMaxTokens,

    // ── Learning & Adaptation ───────────────────────────────────────
    DynamicLearningRate,
    DynamicMomentumDecay,
    DynamicCoherenceThreshold,
    DynamicDriftAlertThreshold,

    // ── Caching & Infrastructure ────────────────────────────────────
    DynamicCacheTTL,
    DynamicRateLimit,

    // ── Priority ────────────────────────────────────────────────────
    DynamicPriority,
    DynamicGovernancePriority,

    // ── Circuit Breaker ─────────────────────────────────────────────
    DynamicCircuitBreakerFailures,
    DynamicCircuitBreakerTimeout,
    DynamicCircuitBreakerSuccessThreshold,

    // ── CSL Thresholds ──────────────────────────────────────────────
    DynamicResonanceThreshold,
    DynamicTernaryPositiveThreshold,
    DynamicTernaryNegativeThreshold,
    DynamicSoftGateSteepness,
    DynamicRiskSensitivity,

    // ── Embeddings & Vector Space ───────────────────────────────────
    DynamicEmbeddingDimension,

    // ── Pool Composition ────────────────────────────────────────────
    DynamicPoolHotPercent,
    DynamicPoolWarmPercent,
    DynamicPoolColdPercent,

    // ── Management API ──────────────────────────────────────────────
    startAdjustment,
    stopAdjustment,
    getAllValues,
    getAllStats,
    resetAll,
    getScaleByName,
    getAllScales,
    snapshot,
    restore,

    // ── Telemetry feeds (exported for testing / custom injection) ───
    telemetryFeeds
};

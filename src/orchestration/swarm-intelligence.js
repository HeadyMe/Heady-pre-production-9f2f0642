/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

/**
 * Swarm Intelligence — Dynamic resource allocation for bee swarms.
 * Computes target bee counts, concurrency limits, and strategy
 * based on live system load metrics.
 */

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

/**
 * Compute optimal swarm allocation based on current load.
 * @param {Object} input — { loadScore, pendingTasks, p95LatencyMs, errorRate }
 * @returns {{ targetBees, targetSwarms, asyncConcurrency, strategy, score }}
 */
function computeSwarmAllocation(input = {}) {
    const loadScore = clamp(Number(input.loadScore) || 0, 0, 1);
    const pendingTasks = Math.max(0, Number(input.pendingTasks) || 0);
    const p95LatencyMs = Math.max(0, Number(input.p95LatencyMs) || 0);
    const errorRate = clamp(Number(input.errorRate) || 0, 0, 1);

    const baseBees = 8;
    const baseSwarms = 2;

    const loadBoost = Math.round(loadScore * 16);
    const pendingBoost = Math.round(Math.min(24, pendingTasks / 8));
    const latencyPenalty = p95LatencyMs > 800 ? 2 : p95LatencyMs > 500 ? 1 : 0;
    const errorPenalty = errorRate > 0.1 ? 2 : errorRate > 0.05 ? 1 : 0;

    const targetBees = clamp(baseBees + loadBoost + pendingBoost - latencyPenalty - errorPenalty, 6, 64);
    const targetSwarms = clamp(baseSwarms + Math.ceil(targetBees / 12), 2, 12);
    const asyncConcurrency = clamp(targetBees * 2 + targetSwarms * 3, 16, 180);

    return {
        targetBees,
        targetSwarms,
        asyncConcurrency,
        strategy: errorRate > 0.08 ? 'stability-first' : loadScore > 0.6 ? 'throughput-first' : 'balanced',
        score: { loadScore, pendingTasks, p95LatencyMs, errorRate },
    };
}

/**
 * Evaluate live cloud status based on heartbeat and service health.
 */
function evaluateLiveCloudStatus(input = {}) {
    const cloudUrl = String(input.cloudUrl || '').trim();
    const heartbeatAgeMs = Math.max(0, Number(input.heartbeatAgeMs) || 0);
    const serviceHealth = clamp(Number(input.serviceHealth) || 0, 0, 1);

    const hasCloudUrl = cloudUrl.startsWith('https://');
    const heartbeatHealthy = heartbeatAgeMs <= 30_000;
    const servicesHealthy = serviceHealth >= 0.9;

    return {
        hasCloudUrl,
        heartbeatHealthy,
        servicesHealthy,
        liveReady: hasCloudUrl && heartbeatHealthy && servicesHealthy,
    };
}

module.exports = {
    computeSwarmAllocation,
    evaluateLiveCloudStatus,
};

'use strict';

/**
 * Monte Carlo Resource Scheduler — ORCH-001
 * Runs N simulations to find optimal node allocation across cloud/edge/local.
 */

const logger = require('../utils/logger');

const DEFAULT_SIMULATIONS = 10000;
const RESOURCE_POOLS = ['colab-brain', 'colab-memory', 'colab-conductor', 'cloudrun-prod', 'cloudrun-staging', 'edge-cf', 'local-ryzen'];

class MonteCarloScheduler {
    constructor(opts = {}) {
        this.simulations = opts.simulations || DEFAULT_SIMULATIONS;
        this.pools = opts.pools || RESOURCE_POOLS;
        this.history = [];
    }

    /**
     * Run Monte Carlo simulation for task allocation.
     * @param {Object} task - { type, priority, requiredMemoryMB, estimatedDurationMs }
     * @returns {Object} - { bestPool, confidence, simResults }
     */
    simulate(task) {
        const start = Date.now();
        const scores = {};
        for (const pool of this.pools) scores[pool] = 0;

        for (let i = 0; i < this.simulations; i++) {
            const poolScores = this.pools.map(pool => {
                const latency = this._estimateLatency(pool, task);
                const cost = this._estimateCost(pool, task);
                const availability = this._estimateAvailability(pool);
                const memFit = this._estimateMemoryFit(pool, task.requiredMemoryMB || 512);
                // UCB1-inspired scoring: exploitation + exploration
                const exploitation = (1 / (latency + 1)) * availability * memFit;
                const exploration = Math.sqrt(2 * Math.log(i + 1) / ((scores[pool] || 1) + 1));
                return { pool, score: exploitation + exploration * 0.1 - cost * 0.01 + Math.random() * 0.05 };
            });

            const best = poolScores.sort((a, b) => b.score - a.score)[0];
            scores[best.pool]++;
        }

        const sortedPools = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const bestPool = sortedPools[0][0];
        const confidence = sortedPools[0][1] / this.simulations;

        const result = {
            bestPool,
            confidence: Math.round(confidence * 100),
            runnerUp: sortedPools[1] ? { pool: sortedPools[1][0], confidence: Math.round((sortedPools[1][1] / this.simulations) * 100) } : null,
            allPools: sortedPools.map(([pool, wins]) => ({ pool, wins, pct: Math.round((wins / this.simulations) * 100) })),
            simulationCount: this.simulations,
            latencyMs: Date.now() - start,
            task: { type: task.type, priority: task.priority },
        };

        this.history.push(result);
        if (this.history.length > 100) this.history = this.history.slice(-50);
        return result;
    }

    _estimateLatency(pool, task) {
        const base = {
            'colab-brain': 200, 'colab-memory': 150, 'colab-conductor': 120,
            'cloudrun-prod': 80, 'cloudrun-staging': 100, 'edge-cf': 20, 'local-ryzen': 5,
        };
        return (base[pool] || 100) * (1 + Math.random() * 0.3);
    }

    _estimateCost(pool, task) {
        const costs = {
            'colab-brain': 0, 'colab-memory': 0, 'colab-conductor': 0,
            'cloudrun-prod': 0.00024, 'cloudrun-staging': 0.00012, 'edge-cf': 0.00005, 'local-ryzen': 0,
        };
        const duration = task.estimatedDurationMs || 1000;
        return (costs[pool] || 0.001) * (duration / 1000);
    }

    _estimateAvailability(pool) {
        const base = {
            'colab-brain': 0.85, 'colab-memory': 0.85, 'colab-conductor': 0.85,
            'cloudrun-prod': 0.999, 'cloudrun-staging': 0.99, 'edge-cf': 0.9999, 'local-ryzen': 0.95,
        };
        return (base[pool] || 0.9) * (0.9 + Math.random() * 0.1);
    }

    _estimateMemoryFit(pool, requiredMB) {
        const capacity = {
            'colab-brain': 51200, 'colab-memory': 51200, 'colab-conductor': 12800,
            'cloudrun-prod': 4096, 'cloudrun-staging': 2048, 'edge-cf': 128, 'local-ryzen': 32768,
        };
        return Math.min(1, (capacity[pool] || 2048) / requiredMB);
    }

    getStatus() {
        return {
            ok: true,
            simulations: this.simulations,
            pools: this.pools,
            historySize: this.history.length,
            lastResult: this.history[this.history.length - 1] || null,
        };
    }
}

let _scheduler = null;
function getMonteCarloScheduler(opts) {
    if (!_scheduler) _scheduler = new MonteCarloScheduler(opts);
    return _scheduler;
}

module.exports = { MonteCarloScheduler, getMonteCarloScheduler };

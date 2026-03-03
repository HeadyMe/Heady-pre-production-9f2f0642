/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Monte Carlo Engine — SPEC-1 ═══
 *
 * Quick readiness checks for routine actions.
 * Full simulations for critical actions (10,000 iterations default).
 * Confidence bounds + risk grading + top mitigations.
 */

const crypto = require("crypto");

class MonteCarloEngine {
    constructor(opts = {}) {
        this.defaultIterations = opts.iterations || 10000;
        this.seed = opts.seed || Date.now();
        this.history = [];
    }

    // ─── Seeded PRNG (Mulberry32) ────────────────────────────────
    _seededRandom(seed) {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // ─── Quick Readiness Check ───────────────────────────────────
    quickReadiness(signals = {}) {
        const {
            errorRate = 0,
            lastDeploySuccess = true,
            cpuPressure = 0.3,
            memoryPressure = 0.4,
            serviceHealthRatio = 1.0,
            openIncidents = 0,
        } = signals;

        const weights = {
            errorRate: -40,
            lastDeploy: 15,
            cpu: -20,
            memory: -15,
            health: 30,
            incidents: -10,
        };

        let score = 50; // baseline
        score += (1 - errorRate) * weights.errorRate * -1;
        score += (lastDeploySuccess ? 1 : 0) * weights.lastDeploy;
        score += (1 - cpuPressure) * Math.abs(weights.cpu);
        score += (1 - memoryPressure) * Math.abs(weights.memory);
        score += serviceHealthRatio * weights.health;
        score += Math.max(0, 1 - openIncidents * 0.2) * Math.abs(weights.incidents);

        score = Math.max(0, Math.min(100, Math.round(score)));

        const grade =
            score >= 80 ? "GREEN" :
                score >= 60 ? "YELLOW" :
                    score >= 40 ? "ORANGE" : "RED";

        return {
            score,
            grade,
            signals,
            ts: new Date().toISOString(),
            recommendation: score >= 60 ? "PROCEED" : "HOLD",
        };
    }

    // ─── Full Monte Carlo Simulation ─────────────────────────────
    runFullCycle(scenario = {}, iterations = this.defaultIterations) {
        const {
            name = "unnamed",
            baseSuccessRate = 0.85,
            riskFactors = [],
            mitigations = [],
        } = scenario;

        const seed = this.seed;
        const outcomes = { success: 0, partial: 0, failure: 0 };
        const riskHits = {};

        riskFactors.forEach(r => { riskHits[r.name] = 0; });

        for (let i = 0; i < iterations; i++) {
            const rand = this._seededRandom(seed + i);
            let effectiveRate = baseSuccessRate;

            // Apply risk factors
            for (const risk of riskFactors) {
                const riskRand = this._seededRandom(seed + i + risk.name.length * 1000);
                if (riskRand < (risk.probability || 0.1)) {
                    effectiveRate *= (1 - (risk.impact || 0.3));
                    riskHits[risk.name]++;
                }
            }

            // Apply mitigations
            for (const mit of mitigations) {
                effectiveRate = Math.min(1, effectiveRate + (mit.boost || 0.05));
            }

            if (rand < effectiveRate) outcomes.success++;
            else if (rand < effectiveRate + 0.1) outcomes.partial++;
            else outcomes.failure++;
        }

        const confidence = outcomes.success / iterations;
        const failureRate = outcomes.failure / iterations;

        const riskGrade =
            failureRate < 0.05 ? "LOW" :
                failureRate < 0.15 ? "MEDIUM" :
                    failureRate < 0.30 ? "HIGH" : "CRITICAL";

        // Top mitigations ranked by impact
        const topMitigations = riskFactors
            .sort((a, b) => (riskHits[b.name] || 0) - (riskHits[a.name] || 0))
            .slice(0, 5)
            .map(r => ({
                risk: r.name,
                hitRate: (riskHits[r.name] / iterations * 100).toFixed(1) + "%",
                recommendation: r.mitigation || "Add circuit breaker / retry logic",
            }));

        const result = {
            scenario: name,
            iterations,
            seed,
            outcomes,
            confidence: +(confidence * 100).toFixed(2),
            failureRate: +(failureRate * 100).toFixed(2),
            riskGrade,
            topMitigations,
            ts: new Date().toISOString(),
        };

        this.history.push(result);
        return result;
    }

    // ─── History ─────────────────────────────────────────────────
    getHistory(limit = 20) {
        return this.history.slice(-limit);
    }

    status() {
        const last = this.history[this.history.length - 1];
        return {
            runsCompleted: this.history.length,
            lastRun: last || null,
            defaultIterations: this.defaultIterations,
        };
    }
}

module.exports = MonteCarloEngine;

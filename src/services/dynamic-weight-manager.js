/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── Sacred Geometry v2.5 — Dynamic Weighting ───────────────────
 *
 * Extends Sacred Geometry orchestration with dynamic weight adjustment.
 * Agent priority shifts based on real-time task latency, error rates,
 * and load — ensuring the Master Agent always has the fastest compute path.
 *
 * Weight Formula:
 *   W(agent) = φ * (1/latency) * successRate * (1 - loadFactor)
 *
 * where φ = 1.6180339887 (Golden Ratio)
 *
 * Architecture:
 *   - Collects real-time metrics from all agents
 *   - Recalculates weights every φ² seconds (~2.618s)
 *   - Master Agent always gets the highest-weighted compute path
 *   - Weights decay exponentially if agent goes silent
 *   - Geometric alignment score factors into weight
 *
 * ──────────────────────────────────────────────────────────────────
 */

const logger = require('../utils/logger');

const PHI = 1.6180339887;
const REWEIGHT_INTERVAL_MS = Math.round(PHI * PHI * 1000); // ~2618ms
const DECAY_RATE = 0.95; // per interval
const MIN_WEIGHT = 0.01;
const MAX_WEIGHT = PHI * PHI * PHI; // ~4.236

class DynamicWeightManager {
    constructor() {
        this.agents = new Map(); // agentId → AgentMetrics
        this.weights = new Map(); // agentId → current weight
        this.masterAgentId = null;
        this.reweightTimer = null;
        this.epoch = 0;
    }

    // ── Agent Registration ──────────────────────────────────────
    register(agentId, config = {}) {
        this.agents.set(agentId, {
            id: agentId,
            role: config.role || 'worker',
            latencyMs: config.initialLatency || 100,
            successRate: 1.0,
            loadFactor: 0.0,
            geometricAlignment: config.alignment || 1.0,
            lastSeen: Date.now(),
            totalTasks: 0,
            totalErrors: 0,
        });
        this.weights.set(agentId, 1.0);

        if (config.role === 'master') {
            this.masterAgentId = agentId;
        }

        return this.weights.get(agentId);
    }

    // ── Metrics Update ──────────────────────────────────────────
    reportMetrics(agentId, metrics) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        if (metrics.latencyMs !== undefined) agent.latencyMs = metrics.latencyMs;
        if (metrics.success !== undefined) {
            agent.totalTasks++;
            if (!metrics.success) agent.totalErrors++;
            agent.successRate = (agent.totalTasks - agent.totalErrors) / agent.totalTasks;
        }
        if (metrics.loadFactor !== undefined) agent.loadFactor = Math.min(1, Math.max(0, metrics.loadFactor));
        if (metrics.geometricAlignment !== undefined) agent.geometricAlignment = metrics.geometricAlignment;
        agent.lastSeen = Date.now();
    }

    // ── Dynamic Weight Calculation ──────────────────────────────
    recalculate() {
        this.epoch++;
        const now = Date.now();

        for (const [agentId, agent] of this.agents) {
            // Decay weight if agent hasn't reported
            const silenceMs = now - agent.lastSeen;
            const silenceIntervals = silenceMs / REWEIGHT_INTERVAL_MS;

            let weight;
            if (silenceIntervals > 10) {
                // Agent is gone
                weight = MIN_WEIGHT;
            } else {
                // W = φ * (1/latency) * successRate * (1-load) * alignment * decay
                const latencyFactor = 1000 / Math.max(1, agent.latencyMs); // normalize to ~1 for 1000ms
                const decayFactor = Math.pow(DECAY_RATE, Math.max(0, silenceIntervals - 1));

                weight = PHI * latencyFactor * agent.successRate * (1 - agent.loadFactor) * agent.geometricAlignment * decayFactor;
            }

            // Clamp
            weight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, weight));
            this.weights.set(agentId, weight);
        }

        // Ensure master agent has highest weight (if designated)
        if (this.masterAgentId && this.agents.has(this.masterAgentId)) {
            const maxNonMaster = Math.max(...[...this.weights.entries()]
                .filter(([id]) => id !== this.masterAgentId)
                .map(([, w]) => w), 0);
            const masterWeight = this.weights.get(this.masterAgentId);
            if (masterWeight <= maxNonMaster) {
                this.weights.set(this.masterAgentId, maxNonMaster * PHI);
            }
        }

        if (global.eventBus) {
            global.eventBus.emit('geometry:weights-updated', {
                epoch: this.epoch,
                weights: Object.fromEntries(this.weights),
            });
        }
    }

    // ── Routing ─────────────────────────────────────────────────
    /**
     * Get the best agent for a task, weighted by dynamic scores.
     */
    getBestAgent(excludeIds = []) {
        let bestId = null, bestWeight = -1;
        for (const [id, weight] of this.weights) {
            if (excludeIds.includes(id)) continue;
            const agent = this.agents.get(id);
            if (!agent || agent.loadFactor >= 0.95) continue;
            if (weight > bestWeight) {
                bestWeight = weight;
                bestId = id;
            }
        }
        return bestId ? { agentId: bestId, weight: bestWeight } : null;
    }

    /**
     * Get ranked agents by weight.
     */
    getRanking() {
        return [...this.weights.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, weight]) => ({
                agentId: id,
                weight: Math.round(weight * 1000) / 1000,
                metrics: this.agents.get(id),
            }));
    }

    // ── Lifecycle ───────────────────────────────────────────────
    start() {
        if (this.reweightTimer) return;
        this.reweightTimer = setInterval(() => this.recalculate(), REWEIGHT_INTERVAL_MS);
        logger.info(`[DynamicWeightManager] Started — reweighting every ${REWEIGHT_INTERVAL_MS}ms`);
    }

    stop() {
        if (this.reweightTimer) {
            clearInterval(this.reweightTimer);
            this.reweightTimer = null;
        }
    }

    getHealth() {
        return {
            epoch: this.epoch,
            totalAgents: this.agents.size,
            masterAgent: this.masterAgentId,
            ranking: this.getRanking().slice(0, 10),
            reweightIntervalMs: REWEIGHT_INTERVAL_MS,
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const dynamicWeights = new DynamicWeightManager();

// ── REST Endpoints ────────────────────────────────────────────
function registerDynamicWeightRoutes(app) {
    app.post('/api/geometry/register', (req, res) => {
        const weight = dynamicWeights.register(req.body.agentId, req.body);
        res.json({ ok: true, weight });
    });

    app.post('/api/geometry/metrics', (req, res) => {
        dynamicWeights.reportMetrics(req.body.agentId, req.body);
        res.json({ ok: true });
    });

    app.get('/api/geometry/ranking', (req, res) => {
        res.json({ ok: true, ranking: dynamicWeights.getRanking() });
    });

    app.get('/api/geometry/best', (req, res) => {
        const best = dynamicWeights.getBestAgent();
        res.json({ ok: true, best });
    });

    app.get('/api/geometry/health', (req, res) => {
        res.json({ ok: true, ...dynamicWeights.getHealth() });
    });
}

module.exports = { DynamicWeightManager, dynamicWeights, registerDynamicWeightRoutes };

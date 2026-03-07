'use strict';

/**
 * Skill-Based Agent Router — CSL-Gated Intelligent Task Assignment
 * Routes tasks to agents using Continuous Semantic Logic gates instead of
 * discrete skill-matching and weighted arithmetic.
 *
 * CSL gates used:
 *   - multi_resonance       → Score all agents against task intent vector
 *   - route_gate            → Select best agent with soft activation
 *   - resonance_gate        → Direct skill-to-task semantic matching
 *   - soft_gate             → Continuous load/capacity scoring (replaces linear ratio)
 *   - ternary_gate          → Classify agent reliability: core / ephemeral / degraded
 *   - risk_gate             → Evaluate overload risk per agent
 *   - superposition_gate    → Build composite skill vectors per agent
 *   - orthogonal_gate       → Exclude specific skill influence from routing
 */

const logger = require('../utils/logger');
const CSL = require('../core/semantic-logic');

// ── CSL Helpers ─────────────────────────────────────────────────────────
const _vecCache = new Map();

function _skillToVec(text, dim = 64) {
    if (_vecCache.has(text)) return _vecCache.get(text);
    const v = new Float32Array(dim);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < dim; i++) {
        hash = ((hash << 5) + hash + i) >>> 0;
        v[i] = ((hash % 2000) - 1000) / 1000;
    }
    const result = CSL.normalize(v);
    _vecCache.set(text, result);
    return result;
}

class SkillRouter {
    constructor(config = {}) {
        this.agents = new Map(); // agentId → { skills, load, successRate, vector, ... }
        this.routeHistory = [];
        this.totalRouted = 0;
        this.cslConfig = {
            resonanceThreshold: config.resonanceThreshold || 0.3,
            overloadSensitivity: config.overloadSensitivity || 0.8,
            reliabilityThresholdHigh: config.reliabilityThresholdHigh || 0.72,
            reliabilityThresholdLow: config.reliabilityThresholdLow || 0.35,
            ...config,
        };
    }

    /**
     * Register an agent with its capabilities.
     * Builds a composite semantic vector from all skills using consensus_superposition.
     */
    register(agentId, skills = [], capacity = 10) {
        // CSL: Build composite skill vector
        const skillVecs = skills.map(s => _skillToVec(s));
        const vector = skillVecs.length > 0
            ? CSL.consensus_superposition(skillVecs)
            : _skillToVec(agentId);

        this.agents.set(agentId, {
            skills, capacity, currentLoad: 0,
            successCount: 0, failCount: 0,
            successRate: 1.0,
            vector,
            skillVecs,
        });
    }

    /**
     * Route a task to the best agent using CSL multi-resonance scoring.
     *
     * Flow:
     *   1. Build intent vector from required skill
     *   2. Optionally strip excluded skills via orthogonal_gate
     *   3. Score all agents with route_gate (multi_resonance + soft_gate)
     *   4. Apply overload risk via risk_gate
     *   5. Apply reliability classification via ternary_gate
     *   6. Compute composite score and select best
     *
     * @param {string} requiredSkill - The skill/capability needed
     * @param {string} priority - 'low', 'medium', 'high', 'critical'
     * @param {Object} options - Additional routing options
     * @param {string[]} options.exclude - Skills to strip from intent via orthogonal_gate
     * @returns {Object} Routing result with CSL metadata
     */
    route(requiredSkill, priority = 'medium', options = {}) {
        const { exclude = [] } = options;

        // 1. Build intent vector
        let intentVec = _skillToVec(requiredSkill);

        // 2. Strip excluded skill influence
        if (exclude.length > 0) {
            const excludeVecs = exclude.map(e => _skillToVec(e));
            intentVec = CSL.batch_orthogonal(intentVec, excludeVecs);
        }

        // 3. Collect eligible agents (not at max capacity)
        const candidates = [];
        for (const [id, agent] of this.agents) {
            if (agent.currentLoad >= agent.capacity) continue;
            candidates.push({ id, vector: agent.vector, agent });
        }

        if (candidates.length === 0) {
            return { assigned: null, reason: 'No capable agent available' };
        }

        // 4. CSL route_gate — multi-resonance + soft activation
        const routeResult = CSL.route_gate(
            intentVec,
            candidates,
            this.cslConfig.resonanceThreshold
        );

        // 5. Enrich each candidate with risk and reliability assessments
        const priorityBoost = priority === 'critical' ? 0.2
            : priority === 'high' ? 0.1 : 0;

        const scored = routeResult.scores.map(s => {
            const cand = candidates.find(c => c.id === s.id);
            const agent = cand.agent;

            // Overload risk: how close to capacity?
            const overloadRisk = CSL.risk_gate(
                agent.currentLoad,
                agent.capacity,
                this.cslConfig.overloadSensitivity
            );

            // Reliability classification via ternary_gate
            const reliability = CSL.ternary_gate(
                agent.successRate,
                this.cslConfig.reliabilityThresholdHigh,
                this.cslConfig.reliabilityThresholdLow
            );

            // Load availability as soft_gate activation
            const loadRatio = agent.currentLoad / (agent.capacity || 1);
            const availability = CSL.soft_gate(1 - loadRatio, 0.5, 10);

            // Composite: semantic resonance * availability * reliability, penalized by overload risk
            const composite = (
                s.score * 0.4 +
                availability * 0.25 +
                agent.successRate * 0.25 +
                priorityBoost
            ) * (1 - overloadRisk.riskLevel * 0.3);

            return {
                id: s.id,
                resonance: s.score,
                activation: s.activation,
                availability: +availability.toFixed(6),
                reliability: reliability.state,
                reliabilityActivation: reliability.resonanceActivation,
                overloadRisk: overloadRisk.riskLevel,
                composite: +composite.toFixed(6),
            };
        }).sort((a, b) => b.composite - a.composite);

        // 6. Select best
        const best = scored[0];
        if (!best) {
            return { assigned: null, reason: 'CSL found no viable agent' };
        }

        const bestAgent = this.agents.get(best.id);
        bestAgent.currentLoad++;
        this.totalRouted++;

        const result = {
            assigned: best.id,
            score: best.composite,
            skill: requiredSkill,
            csl: {
                resonance: best.resonance,
                activation: best.activation,
                availability: best.availability,
                reliability: best.reliability,
                overloadRisk: best.overloadRisk,
                fallback: routeResult.fallback,
                candidatesScored: scored.length,
            },
        };
        this.routeHistory.push(result);
        if (this.routeHistory.length > 200) this.routeHistory = this.routeHistory.slice(-100);

        return result;
    }

    /**
     * Record task completion for an agent.
     * Updates success rate which feeds into CSL ternary_gate reliability classification.
     */
    complete(agentId, success = true) {
        const agent = this.agents.get(agentId);
        if (!agent) return;
        agent.currentLoad = Math.max(0, agent.currentLoad - 1);
        if (success) agent.successCount++; else agent.failCount++;
        const total = agent.successCount + agent.failCount;
        agent.successRate = total > 0 ? agent.successCount / total : 1.0;
    }

    /**
     * Get status with CSL-enriched agent profiles.
     */
    getStatus() {
        return {
            ok: true, totalRouted: this.totalRouted,
            cslStats: CSL.getStats(),
            agents: [...this.agents.entries()].map(([id, a]) => {
                const reliability = CSL.ternary_gate(
                    a.successRate,
                    this.cslConfig.reliabilityThresholdHigh,
                    this.cslConfig.reliabilityThresholdLow
                );
                return {
                    id, skills: a.skills,
                    load: `${a.currentLoad}/${a.capacity}`,
                    successRate: Math.round(a.successRate * 100) + '%',
                    csl: {
                        reliabilityState: reliability.state,
                        reliabilityActivation: reliability.resonanceActivation,
                        vectorDim: a.vector.length,
                    },
                };
            }),
        };
    }
}

let _router = null;
function getSkillRouter(config) {
    if (!_router) _router = new SkillRouter(config);
    return _router;
}

module.exports = { SkillRouter, getSkillRouter, _skillToVec };

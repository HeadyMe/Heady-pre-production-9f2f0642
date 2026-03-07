'use strict';

/**
 * Skill-Based Agent Router — Intelligent task assignment
 * Routes tasks to agents based on capabilities, load, and history.
 */

const logger = require('../utils/logger');

class SkillRouter {
    constructor() {
        this.agents = new Map(); // agentId → { skills: string[], load: number, successRate: number }
        this.routeHistory = [];
        this.totalRouted = 0;
    }

    /**
     * Register an agent with its capabilities.
     */
    register(agentId, skills = [], capacity = 10) {
        this.agents.set(agentId, {
            skills, capacity, currentLoad: 0,
            successCount: 0, failCount: 0,
            successRate: 1.0,
        });
    }

    /**
     * Route a task to the best agent based on skill match + load + success rate.
     */
    route(requiredSkill, priority = 'medium') {
        const candidates = [];
        for (const [id, agent] of this.agents) {
            if (!agent.skills.includes(requiredSkill)) continue;
            if (agent.currentLoad >= agent.capacity) continue;

            const loadScore = 1 - (agent.currentLoad / agent.capacity);
            const skillScore = agent.skills.includes(requiredSkill) ? 1 : 0;
            const reliabilityScore = agent.successRate;
            const priorityBoost = priority === 'critical' ? 0.2 : priority === 'high' ? 0.1 : 0;

            candidates.push({
                id, agent,
                score: skillScore * 0.4 + loadScore * 0.3 + reliabilityScore * 0.3 + priorityBoost,
            });
        }

        if (candidates.length === 0) return { assigned: null, reason: 'No capable agent available' };

        const best = candidates.sort((a, b) => b.score - a.score)[0];
        best.agent.currentLoad++;
        this.totalRouted++;

        const result = { assigned: best.id, score: best.score, skill: requiredSkill };
        this.routeHistory.push(result);
        if (this.routeHistory.length > 200) this.routeHistory = this.routeHistory.slice(-100);

        return result;
    }

    /**
     * Record task completion for an agent.
     */
    complete(agentId, success = true) {
        const agent = this.agents.get(agentId);
        if (!agent) return;
        agent.currentLoad = Math.max(0, agent.currentLoad - 1);
        if (success) agent.successCount++; else agent.failCount++;
        const total = agent.successCount + agent.failCount;
        agent.successRate = total > 0 ? agent.successCount / total : 1.0;
    }

    getStatus() {
        return {
            ok: true, totalRouted: this.totalRouted,
            agents: [...this.agents.entries()].map(([id, a]) => ({
                id, skills: a.skills, load: `${a.currentLoad}/${a.capacity}`,
                successRate: Math.round(a.successRate * 100) + '%',
            })),
        };
    }
}

let _router = null;
function getSkillRouter() {
    if (!_router) _router = new SkillRouter();
    return _router;
}

module.exports = { SkillRouter, getSkillRouter };

/**
 * Template Engine — Situation-Aware Agent Template Selection
 *
 * Multi-dimensional weighted scoring to select optimal templates
 * from a registry, using Fibonacci-derived scoring weights.
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const { PHI, BASE, phiScale } = require('./principles');

class TemplateEngine {
    constructor(options = {}) {
        this.weights = options.weights || {
            skills: 0.20,
            workflows: 0.20,
            nodes: 0.10,
            headyswarmTasks: 0.25,
            bees: 0.15,
            situations: 0.10,
        };
        this.limits = options.limits || {
            skills: 10, workflows: 8, nodes: 5,
            headyswarmTasks: 8, bees: 6, situations: 6,
        };
        this.templates = [];
    }

    /**
     * Load templates from an array or registry object
     */
    loadTemplates(input) {
        if (Array.isArray(input)) {
            this.templates = input;
        } else if (input && input.templates) {
            this.templates = input.templates;
        }
        return this;
    }

    /**
     * Score a single template using 6-dimensional weighted evaluation
     * @param {object} template
     * @returns {number} score (0-1)
     */
    score(template) {
        const dims = ['skills', 'workflows', 'nodes', 'headyswarmTasks', 'bees', 'situations'];
        let total = 0;
        for (const dim of dims) {
            const count = (template[dim] || []).length;
            const limit = this.limits[dim] || 1;
            const weight = this.weights[dim] || 0;
            total += (count / limit) * weight;
        }
        return Number(total.toFixed(6));
    }

    /**
     * Select optimal templates for a given situation
     * @param {string} situation - predicted situation name
     * @param {number} limit - max templates to return
     * @returns {Array} sorted templates with scores
     */
    select(situation, limit = 3) {
        return this.templates
            .filter(t => (t.situations || []).includes(situation))
            .map(t => ({ ...t, optimizationScore: this.score(t) }))
            .sort((a, b) => b.optimizationScore - a.optimizationScore)
            .slice(0, limit);
    }

    /**
     * Get coverage report — which situations have templates
     */
    coverageReport(situations = []) {
        const report = {};
        for (const s of situations) {
            const matching = this.templates.filter(t => (t.situations || []).includes(s));
            report[s] = { count: matching.length, templates: matching.map(t => t.id) };
        }
        return report;
    }

    /**
     * Rank all templates by score
     */
    rankAll() {
        return this.templates
            .map(t => ({ id: t.id, name: t.name, score: this.score(t) }))
            .sort((a, b) => b.score - a.score);
    }
}

module.exports = { TemplateEngine };

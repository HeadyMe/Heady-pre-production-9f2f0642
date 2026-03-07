/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Vector Template Bee — Powers the 3D vector template instantiation swarm.
 *
 * This bee integrates the VectorTemplateEngine into the Heady bee swarm,
 * allowing any task to be matched against 3D-indexed artifact templates
 * and instantiated across all liquid nodes simultaneously.
 */
const domain = 'vector-templates';
const description = '3D vector storage → template instantiation → bee swarming engine';
const priority = 0.95; // highest priority — this IS the swarm engine

function getWork(ctx = {}) {
    return [
        async () => {
            try {
                const vte = require('../vector-template-engine');
                const stats = vte.getStats();
                return {
                    bee: domain,
                    action: 'status',
                    templates: stats.templates,
                    templateNames: stats.templateNames,
                    zoneMapping: stats.zoneMapping,
                    status: 'active',
                };
            } catch (err) {
                return { bee: domain, action: 'status', error: err.message };
            }
        },
        async () => {
            try {
                const vte = require('../vector-template-engine');
                return {
                    bee: domain,
                    action: 'list-templates',
                    templates: vte.listTemplates(),
                };
            } catch (err) {
                return { bee: domain, action: 'list-templates', error: err.message };
            }
        },
        async () => {
            try {
                const vte = require('../vector-template-engine');
                // Auto-detect and report what templates are available for swarming
                const templates = vte.listTemplates();
                const ready = templates.filter(t => t.priority >= 0.8);
                return {
                    bee: domain,
                    action: 'swarm-readiness',
                    totalTemplates: templates.length,
                    highPriority: ready.length,
                    readyToSwarm: ready.map(t => t.name),
                    status: 'ready',
                };
            } catch (err) {
                return { bee: domain, action: 'swarm-readiness', error: err.message };
            }
        },
    ];
}

module.exports = { domain, description, priority, getWork };

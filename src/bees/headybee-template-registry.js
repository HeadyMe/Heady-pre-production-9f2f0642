/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyBee Template Registry
 * Maintains a deterministic catalog of scenario-ready bee templates,
 * validates coverage, and builds optimized execution plans.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

const DEFAULT_TEMPLATES = [
    {
        id: 'incident-response',
        name: 'Incident Response Swarm',
        scenarios: ['outage', 'latency-spike', 'dependency-failure'],
        skills: ['detect', 'triage', 'mitigate', 'postmortem'],
        nodes: ['OBSERVER', 'CONDUCTOR', 'PATTERNS', 'HCFP'],
        workflows: ['health-blast', 'provider-failover', 'root-cause-loop'],
        tasks: ['capture-state', 'stabilize-services', 'publish-status'],
        priority: 1.0,
    },
    {
        id: 'growth-campaign',
        name: 'Digital Presence Growth',
        scenarios: ['launch', 'campaign', 'traffic-growth'],
        skills: ['content-strategy', 'seo', 'channel-scheduling', 'analytics'],
        nodes: ['BUILDER', 'ATLAS', 'LENS', 'CONDUCTOR'],
        workflows: ['content-factory', 'distribution-plan', 'feedback-loop'],
        tasks: ['generate-assets', 'sync-channels', 'measure-attribution'],
        priority: 0.83,
    },
    {
        id: 'projection-sync',
        name: 'Projection Source-of-Truth Sync',
        scenarios: ['projection-drift', 'repo-divergence', 'deployment-window'],
        skills: ['git-sync', 'artifact-verification', 'config-lint'],
        nodes: ['CONDUCTOR', 'BRANCH', 'OBSERVER'],
        workflows: ['projection-diff', 'sync-projection', 'drift-repair'],
        tasks: ['scan-projections', 'sync-github', 'record-evidence'],
        priority: 0.91,
    },
    {
        id: 'maintenance-ops',
        name: 'Maintenance and Hygiene Ops',
        scenarios: ['stale-files', 'obsolete-tunnels', 'runtime-artifact-risk'],
        skills: ['artifact-audit', 'safe-cleanup', 'governance-check'],
        nodes: ['OPS', 'OBSERVER', 'PATTERNS'],
        workflows: ['file-maintenance', 'config-rationalization', 'safety-review'],
        tasks: ['find-unnecessary-files', 'verify-cloud-config', 'emit-remediation-plan'],
        priority: 0.88,
    },
];

const REQUIRED_SCENARIOS = [
    'outage',
    'projection-drift',
    'launch',
    'stale-files',
];

function normalizeTemplate(template = {}) {
    return {
        id: String(template.id || '').trim(),
        name: String(template.name || '').trim(),
        scenarios: Array.isArray(template.scenarios) ? [...new Set(template.scenarios.map(String))] : [],
        skills: Array.isArray(template.skills) ? [...new Set(template.skills.map(String))] : [],
        nodes: Array.isArray(template.nodes) ? [...new Set(template.nodes.map(String))] : [],
        workflows: Array.isArray(template.workflows) ? [...new Set(template.workflows.map(String))] : [],
        tasks: Array.isArray(template.tasks) ? [...new Set(template.tasks.map(String))] : [],
        priority: Number.isFinite(template.priority) ? template.priority : 0.5,
        version: template.version || '1.0.0',
        status: template.status || 'active',
    };
}

function scoreTemplate(template, signal = {}) {
    const normalized = normalizeTemplate(template);
    const scenarioHits = normalized.scenarios.filter((s) => (signal.scenarios || []).includes(s)).length;
    const skillHits = normalized.skills.filter((s) => (signal.skills || []).includes(s)).length;
    const workflowHits = normalized.workflows.filter((w) => (signal.workflows || []).includes(w)).length;

    const score = (scenarioHits * 0.45) + (skillHits * 0.25) + (workflowHits * 0.2) + (normalized.priority * 0.1);

    return {
        id: normalized.id,
        score: Number(score.toFixed(4)),
        scenarioHits,
        skillHits,
        workflowHits,
    };
}

class HeadyBeeTemplateRegistry {
    constructor(templates = DEFAULT_TEMPLATES) {
        this.templates = new Map();
        templates.map(normalizeTemplate).forEach((template) => {
            if (template.id) this.templates.set(template.id, template);
        });
    }

    list() {
        return [...this.templates.values()];
    }

    register(template) {
        const normalized = normalizeTemplate(template);
        if (!normalized.id) throw new Error('template.id is required');
        this.templates.set(normalized.id, normalized);
        return normalized;
    }

    recommend(signal = {}) {
        const ranked = this.list()
            .map((template) => ({ template, match: scoreTemplate(template, signal) }))
            .sort((a, b) => b.match.score - a.match.score);
        return ranked;
    }

    buildSwarmPlan(signal = {}) {
        const [best] = this.recommend(signal);
        if (!best) return { selected: null, tasks: [], skills: [], nodes: [] };

        const selected = best.template;
        return {
            selected,
            score: best.match,
            tasks: selected.tasks,
            skills: selected.skills,
            nodes: selected.nodes,
            workflows: selected.workflows,
            vectorProjection: this._buildVectorProjection(selected, signal),
        };
    }

    validateCoverage(requiredScenarios = REQUIRED_SCENARIOS) {
        const provided = new Set(this.list().flatMap((template) => template.scenarios));
        const missing = requiredScenarios.filter((scenario) => !provided.has(scenario));
        const healthy = missing.length === 0;

        return {
            healthy,
            requiredScenarios,
            coveredScenarios: [...provided].sort(),
            missing,
            templateCount: this.templates.size,
        };
    }

    buildMaintenanceAudit(input = {}) {
        const files = Array.isArray(input.files) ? input.files : [];
        const staleCandidates = files.filter((file) => (
            file.endsWith('.log') ||
            file.endsWith('.pid') ||
            file.includes('service-worker') ||
            file.includes('cloudflared') ||
            file.includes('ngrok')
        ));

        return {
            checkedAt: new Date().toISOString(),
            staleCandidates,
            shouldReviewCount: staleCandidates.length,
            notes: [
                'Audit is non-destructive. Review candidates before deletion.',
                'Prefer config-level disablement for tunnels and service workers if cloud-native deploy is active.',
            ],
        };
    }

    _buildVectorProjection(template, signal) {
        const payload = JSON.stringify({
            id: template.id,
            scenarios: signal.scenarios || [],
            ts: Date.now(),
        });
        const digest = crypto.createHash('sha256').update(payload).digest();
        const x = digest[0] / 255;
        const y = digest[1] / 255;
        const z = digest[2] / 255;
        return {
            space: 'headybee-template-space',
            vector3: [Number(x.toFixed(6)), Number(y.toFixed(6)), Number(z.toFixed(6))],
            hash: digest.toString('hex').slice(0, 16),
        };
    }
}

function registerRoutes(app, registry = new HeadyBeeTemplateRegistry()) {
    app.get('/api/bees/templates/health', (_req, res) => {
        const coverage = registry.validateCoverage();
        res.json({
            status: coverage.healthy ? 'HEALTHY' : 'DEGRADED',
            service: 'headybee-template-registry',
            coverage,
            ts: new Date().toISOString(),
        });
    });

    app.get('/api/bees/templates', (_req, res) => {
        res.json({ templates: registry.list() });
    });

    app.post('/api/bees/templates/plan', (req, res) => {
        const signal = req.body || {};
        res.json(registry.buildSwarmPlan(signal));
    });

    app.post('/api/bees/templates/validate', (req, res) => {
        const required = Array.isArray(req.body?.requiredScenarios) ? req.body.requiredScenarios : REQUIRED_SCENARIOS;
        res.json(registry.validateCoverage(required));
    });

    app.post('/api/bees/templates/maintenance/audit', (req, res) => {
        res.json(registry.buildMaintenanceAudit(req.body || {}));
    });

    logger.logSystem('  ∞ HeadyBeeTemplateRegistry: routes registered (/api/bees/templates/*)');
}

module.exports = {
    DEFAULT_TEMPLATES,
    REQUIRED_SCENARIOS,
    HeadyBeeTemplateRegistry,
    normalizeTemplate,
    scoreTemplate,
    registerRoutes,
};

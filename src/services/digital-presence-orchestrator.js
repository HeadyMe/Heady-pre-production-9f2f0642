/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('../core/heady-yaml');
const logger = require('../utils/logger');
const { HeadybeeTemplateRegistryService } = require('./headybee-template-registry');
const { UnifiedEnterpriseAutonomyService } = require('./unified-enterprise-autonomy');
const { detectCandidates } = require('../../scripts/ops/projection-maintenance-ops');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS_PATH = path.join(ROOT, 'configs', 'agent-profiles', 'skills-registry.yaml');
const PRODUCT_REPOS_PATH = path.join(ROOT, 'configs', 'services', 'product-repos.yaml');
const PROJECTION_MANIFEST_PATH = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');
const SCENARIOS_PATH = path.join(ROOT, 'configs', 'services', 'digital-presence-scenarios.yaml');

function readYaml(filePath) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function deterministicReceipt(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

class DigitalPresenceOrchestratorService {
    constructor() {
        this.startedAt = null;
        this.templateRegistry = new HeadybeeTemplateRegistryService();
        this.unifiedAutonomy = new UnifiedEnterpriseAutonomyService();
        this.skills = readYaml(SKILLS_PATH);
        this.scenarios = readYaml(SCENARIOS_PATH);
    }

    start() {
        this.startedAt = new Date().toISOString();
        this.templateRegistry.start();
        this.unifiedAutonomy.start();
        logger.logSystem('∞ DigitalPresenceOrchestratorService: STARTED');
    }

    getHealth() {
        return {
            ok: true,
            service: 'digital-presence-orchestrator',
            startedAt: this.startedAt,
            templateRegistry: this.templateRegistry.getHealth(),
            unifiedAutonomy: this.unifiedAutonomy.getHealth(),
            scenarios: (this.scenarios.scenarios || []).length,
        };
    }

    recommendTemplateAndWorkflow({ scenario = '', tags = [] } = {}) {
        const recommendation = this.templateRegistry.recommend({ scenario, tags });
        const templateTags = new Set([...(recommendation.top?.tags || []), ...tags.map((t) => String(t).toLowerCase())]);
        const skills = this.getSkillsForTags(Array.from(templateTags), 5);

        return {
            scenario,
            recommendation,
            workflows: skills,
            receipt: deterministicReceipt({ scenario, tags, template: recommendation.top?.id || null, workflows: skills.map((s) => s.id) }),
        };
    }

    getSkillsForTags(tags = [], limit = 5) {
        const normalized = tags.map((item) => String(item).toLowerCase());
        const entries = Object.entries(this.skills.skills || {}).map(([id, skill]) => ({ id, ...skill }));

        return entries
            .map((entry) => {
                const skillTags = (entry.tags || []).map((item) => String(item).toLowerCase());
                const overlap = normalized.filter((tag) => skillTags.includes(tag)).length;
                return { ...entry, overlap };
            })
            .filter((entry) => entry.overlap > 0)
            .sort((a, b) => b.overlap - a.overlap || String(a.name).localeCompare(String(b.name)))
            .slice(0, limit);
    }

    evaluateTemplateCoverage() {
        const scenarios = this.scenarios.scenarios || [];
        const minTemplateScore = Number(this.scenarios.coverage?.min_template_score || 0.8);
        const minSkillMatches = Number(this.scenarios.coverage?.min_skill_matches || 1);

        const evaluated = scenarios.map((scenario) => {
            const recommendation = this.templateRegistry.recommend({ scenario: scenario.id, tags: scenario.tags || [] });
            const workflowMatches = this.getSkillsForTags(scenario.tags || [], 5);
            const templateScore = Number(recommendation.top?.computedScore || 0);
            const capabilityHits = (scenario.required_capabilities || []).filter((capability) =>
                (recommendation.top?.capabilities || []).includes(capability));

            const ok = templateScore >= minTemplateScore
                && workflowMatches.length >= minSkillMatches
                && capabilityHits.length === (scenario.required_capabilities || []).length;

            return {
                scenario: scenario.id,
                priority: scenario.priority || 'medium',
                recommendedTemplate: recommendation.top?.id || null,
                templateScore,
                workflowMatches: workflowMatches.map((item) => item.id),
                capabilityHits,
                requiredCapabilities: scenario.required_capabilities || [],
                ok,
                receipt: deterministicReceipt({ scenario: scenario.id, template: recommendation.top?.id || null, workflowMatches: workflowMatches.map((item) => item.id) }),
            };
        });

        const healthy = evaluated.filter((item) => item.ok).length;
        const coverage = evaluated.length === 0 ? 1 : Number((healthy / evaluated.length).toFixed(4));

        return {
            ok: coverage >= 0.95,
            coverage,
            healthy,
            total: evaluated.length,
            scenarios: evaluated,
            receipt: deterministicReceipt({ coverage, healthy, total: evaluated.length }),
        };
    }

    buildSwarmTaskPlan({ queuePressure = {} } = {}) {
        const dispatch = this.unifiedAutonomy.dispatch(queuePressure);
        const coverage = this.evaluateTemplateCoverage();

        const tasks = coverage.scenarios.map((scenario) => ({
            taskId: `swarm_${scenario.scenario}`,
            queue: scenario.priority === 'critical' ? 'deterministic-replay' : 'swarm-burst',
            template: scenario.recommendedTemplate,
            status: scenario.ok ? 'ready' : 'needs-optimization',
            workflow: scenario.workflowMatches,
        }));

        return {
            ok: true,
            dispatch,
            coverage,
            tasks,
            receipt: deterministicReceipt({ dispatchAt: dispatch.at, tasks }),
        };
    }

    buildUnifiedSystemProjection({ queuePressure = {}, scenario = 'instantaneous-unified-build' } = {}) {
        const autonomyHealth = this.unifiedAutonomy.getHealth();
        const dispatch = this.unifiedAutonomy.dispatch(queuePressure);
        const embeddingPlan = this.unifiedAutonomy.buildEmbeddingPlan();
        const projectionStatus = this.getProjectionStatus();
        const templateCoverage = this.evaluateTemplateCoverage();
        const recommendation = this.recommendTemplateAndWorkflow({
            scenario,
            tags: ['headyswarm', 'headybees', 'template', 'vector', 'cloud', 'ableton', 'instant'],
        });

        const cloudOnlyExecution = {
            localResourceUsage: 'minimal-projection-only',
            preferredExecutionPlane: 'cloud-gpu',
            colabWorkers: autonomyHealth.workerCount,
            queues: dispatch.assignments.map((assignment) => ({
                queue: assignment.queue,
                worker: assignment.selectedWorker,
            })),
        };

        const runtime = {
            architecture: 'liquid-unified-microservice-mesh',
            serviceModel: 'capability-services-no-frontend-backend-split',
            orchestration: ['HeadyConductor', 'HeadyCloudConductor', 'HeadySwarm', 'Headybees'],
            templateInjection: {
                source: '3d-vector-workspace',
                registryTemplate: recommendation.recommendation.top?.id || null,
                swarmReady: templateCoverage.ok,
            },
            livePerformance: {
                midiBridge: '/api/midi/health',
                target: 'ableton-live',
                mode: 'instantaneous-action-path',
            },
        };

        return {
            ok: true,
            generatedAt: new Date().toISOString(),
            runtime,
            cloudOnlyExecution,
            projectionStatus,
            embeddingPlan,
            dispatch,
            recommendation,
            templateCoverage,
            receipt: deterministicReceipt({ runtime, cloudOnlyExecution, dispatch, templateCoverage }),
        };
    }

    getProjectionStatus() {
        const repos = readYaml(PRODUCT_REPOS_PATH).products || {};
        let manifest = null;
        if (fs.existsSync(PROJECTION_MANIFEST_PATH)) {
            manifest = JSON.parse(fs.readFileSync(PROJECTION_MANIFEST_PATH, 'utf8'));
        }

        const entries = manifest?.entries || [];
        const projected = entries.length;
        const totalRepos = Object.keys(repos).length;
        const missing = Object.keys(repos).filter((name) => !entries.some((entry) => entry.id === name));

        return {
            ok: true,
            sourceOfTruth: 'github-product-repos',
            totalRepos,
            projected,
            missing,
            coverage: totalRepos === 0 ? 1 : Number((projected / totalRepos).toFixed(4)),
            generatedAt: manifest?.generatedAt || null,
            receipt: deterministicReceipt({ totalRepos, projected, missing, generatedAt: manifest?.generatedAt || null }),
        };
    }

    getMaintenancePlan(files = []) {
        const scoped = files.length ? files : fs.existsSync(path.join(ROOT, '.git'))
            ? require('child_process').execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
            : [];

        const candidates = detectCandidates(scoped);
        return {
            ok: true,
            staleCount: candidates.stale.length,
            staleWorkers: candidates.staleWorkers,
            staleTunnels: candidates.staleTunnels,
            staleServiceWorkers: candidates.staleServiceWorkers || [],
            staleGCloud: candidates.staleGCloud || [],
            protected: candidates.protected || [],
            receipt: deterministicReceipt(candidates),
        };
    }
}

function registerDigitalPresenceOrchestratorRoutes(app, service = new DigitalPresenceOrchestratorService()) {
    service.start();

    app.get('/api/digital-presence/health', (_req, res) => {
        res.json(service.getHealth());
    });

    app.post('/api/digital-presence/recommend', (req, res) => {
        res.json({ ok: true, result: service.recommendTemplateAndWorkflow(req.body || {}) });
    });

    app.get('/api/digital-presence/projections/status', (_req, res) => {
        res.json(service.getProjectionStatus());
    });

    app.get('/api/digital-presence/maintenance/plan', (_req, res) => {
        res.json(service.getMaintenancePlan());
    });

    app.get('/api/digital-presence/template-coverage', (_req, res) => {
        res.json(service.evaluateTemplateCoverage());
    });

    app.post('/api/digital-presence/swarm-plan', (req, res) => {
        res.json(service.buildSwarmTaskPlan(req.body || {}));
    });

    app.post('/api/digital-presence/system-projection', (req, res) => {
        res.json(service.buildUnifiedSystemProjection(req.body || {}));
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/digital-presence/health, /recommend, /projections/status, /maintenance/plan, /template-coverage, /swarm-plan, /system-projection');
    return service;
}

module.exports = {
    DigitalPresenceOrchestratorService,
    registerDigitalPresenceOrchestratorRoutes,
    deterministicReceipt,
};

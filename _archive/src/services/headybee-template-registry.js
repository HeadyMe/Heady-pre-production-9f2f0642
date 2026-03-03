const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'configs', 'services', 'headybee-template-registry.json');
const OPTIMIZATION_POLICY_PATH = path.join(ROOT, 'configs', 'services', 'headybee-optimization-policy.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRegistry(filePath = REGISTRY_PATH) {
    const parsed = readJson(filePath);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.templates)) {
        throw new Error(`Invalid HeadyBee registry: ${filePath}`);
    }
    return parsed;
}

function readOptimizationPolicy(filePath = OPTIMIZATION_POLICY_PATH) {
    const parsed = readJson(filePath);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid HeadyBee optimization policy: ${filePath}`);
    }
    // Normalize v2 (scoring.weights/limits) and v1 (weights/max) structures
    const weights = parsed.scoring?.weights || parsed.weights || {};
    const max = parsed.scoring?.limits || parsed.max || {};
    return { ...parsed, weights, max };
}

function hashRegistry(registry) {
    return crypto.createHash('sha256').update(JSON.stringify(registry)).digest('hex');
}

function validateRegistry(registry) {
    const errors = [];
    const warnings = [];
    const templateIds = new Set();
    const coveredSituations = new Set();

    for (const template of registry.templates) {
        if (!template.id || templateIds.has(template.id)) {
            errors.push(`Template id is missing or duplicated: ${template.id || '<missing>'}`);
        }
        templateIds.add(template.id);

        if (!Array.isArray(template.skills) || template.skills.length === 0) {
            errors.push(`Template ${template.id} is missing skills.`);
        }
        if (!Array.isArray(template.workflows) || template.workflows.length === 0) {
            errors.push(`Template ${template.id} is missing workflows.`);
        }
        if (!Array.isArray(template.nodes) || template.nodes.length === 0) {
            errors.push(`Template ${template.id} is missing node bindings.`);
        }
        if (!Array.isArray(template.headyswarmTasks) || template.headyswarmTasks.length === 0) {
            errors.push(`Template ${template.id} is missing headyswarm tasks.`);
        }
        if (!template.healthEndpoint || !template.healthEndpoint.startsWith('/api/')) {
            errors.push(`Template ${template.id} healthEndpoint must start with /api/.`);
        }

        if (!Array.isArray(template.situations) || template.situations.length === 0) {
            warnings.push(`Template ${template.id} does not explicitly map to predicted situations.`);
            continue;
        }
        template.situations.forEach((situation) => coveredSituations.add(situation));
    }

    const predicted = new Set(registry.predictedSituations || []);
    const uncoveredPredictions = [...predicted].filter((situation) => !coveredSituations.has(situation));
    if (uncoveredPredictions.length > 0) {
        errors.push(`Predicted situations without templates: ${uncoveredPredictions.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        totalTemplates: registry.templates.length,
        coverage: predicted.size === 0 ? 0 : (predicted.size - uncoveredPredictions.length) / predicted.size,
        uncoveredPredictions,
        registryHash: hashRegistry(registry),
    };
}

function scoreTemplate(template, policy = readOptimizationPolicy()) {
    const weights = policy.weights || {};
    const max = policy.max || {};

    const weighted = [
        ((template.skills || []).length / (max.skills || 1)) * (weights.skills || 0),
        ((template.workflows || []).length / (max.workflows || 1)) * (weights.workflows || 0),
        ((template.nodes || []).length / (max.nodes || 1)) * (weights.nodes || 0),
        ((template.headyswarmTasks || []).length / (max.headyswarmTasks || 1)) * (weights.headyswarmTasks || 0),
        ((template.bees || []).length / (max.bees || 1)) * (weights.bees || 0),
        ((template.situations || []).length / (max.situations || 1)) * (weights.situations || 0),
    ];

    return Number(weighted.reduce((sum, value) => sum + value, 0).toFixed(6));
}

function selectTemplatesForSituation(registry, situation, limit = 3, policy = readOptimizationPolicy()) {
    return registry.templates
        .filter((template) => (template.situations || []).includes(situation))
        .map((template) => ({ ...template, optimizationScore: scoreTemplate(template, policy) }))
        .sort((a, b) => b.optimizationScore - a.optimizationScore)
        .slice(0, limit);
}

function buildOptimizationReport(registry = readRegistry(), policy = readOptimizationPolicy()) {
    const validation = validateRegistry(registry);
    const bySituation = {};

    for (const situation of registry.predictedSituations || []) {
        bySituation[situation] = selectTemplatesForSituation(registry, situation, policy.defaults?.templatesPerSituation || 3, policy);
    }

    const scoredTemplates = registry.templates
        .map((template) => ({ id: template.id, score: scoreTemplate(template, policy) }))
        .sort((a, b) => b.score - a.score);

    return {
        generatedAt: new Date().toISOString(),
        sourceOfTruth: registry.sourceOfTruth,
        registryHash: validation.registryHash,
        valid: validation.valid,
        coverage: validation.coverage,
        topTemplates: scoredTemplates.slice(0, policy.defaults?.topTemplates || 5),
        bySituation,
        warnings: validation.warnings,
        errors: validation.errors,
    };
}

function getHealthStatus() {
    const registry = readRegistry();
    const validation = validateRegistry(registry);
    return {
        endpoint: '/api/headybee-template-registry/health',
        status: validation.valid ? 'healthy' : 'degraded',
        templateCount: validation.totalTemplates,
        coverage: validation.coverage,
        registryHash: validation.registryHash,
    };
}

function getOptimizationState() {
    const registry = readRegistry();
    const validation = validateRegistry(registry);
    logger.logSystem(`[HeadyBeeRegistry] validation=${validation.valid ? 'pass' : 'fail'} templates=${validation.totalTemplates} coverage=${(validation.coverage * 100).toFixed(1)}%`);

    return {
        sourceOfTruth: registry.sourceOfTruth,
        version: registry.version,
        updatedAt: registry.updatedAt,
        validation,
        health: getHealthStatus(),
    };
}

function registerHeadybeeTemplateRegistryRoutes(app) {
    app.get('/api/headybee-template-registry/health', (_req, res) => {
        try { res.json(getHealthStatus()); }
        catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.get('/api/headybee-template-registry/state', (_req, res) => {
        try { res.json(getOptimizationState()); }
        catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.get('/api/headybee-template-registry/report', (_req, res) => {
        try { res.json(buildOptimizationReport()); }
        catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.post('/api/headybee-template-registry/select', (req, res) => {
        try {
            const { situation, limit } = req.body || {};
            const registry = readRegistry();
            const policy = readOptimizationPolicy();
            const templates = selectTemplatesForSituation(registry, situation || 'digital-presence-launch', limit || 3, policy);
            res.json({ ok: true, situation, templates });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });
}

class HeadybeeTemplateRegistryService {
    constructor(options = {}) {
        this.registryPath = options.registryPath || REGISTRY_PATH;
        this.optimizationPolicyPath = options.optimizationPolicyPath || OPTIMIZATION_POLICY_PATH;
        this.startedAt = null;
    }

    start() {
        this.startedAt = new Date().toISOString();
        logger.logSystem('∞ HeadybeeTemplateRegistryService: STARTED');
        return this.getHealth();
    }

    stop() {
        logger.logSystem('∞ HeadybeeTemplateRegistryService: STOPPED');
    }

    getRegistry() {
        return readRegistry(this.registryPath);
    }

    getOptimizationPolicy() {
        return readOptimizationPolicy(this.optimizationPolicyPath);
    }

    getHealth() {
        const health = getHealthStatus();
        return {
            ...health,
            service: 'headybee-template-registry',
            startedAt: this.startedAt,
        };
    }

    report() {
        return buildOptimizationReport(this.getRegistry(), this.getOptimizationPolicy());
    }

    recommend({ scenario = 'digital-presence-launch', tags = [], limit } = {}) {
        const normalizedTags = tags.map((tag) => String(tag).toLowerCase().trim()).filter(Boolean);
        const registry = this.getRegistry();
        const policy = this.getOptimizationPolicy();
        const maxTemplates = Number(limit || policy.defaults?.templatesPerSituation || 3);

        const candidates = registry.templates
            .map((template) => {
                const situationMatch = (template.situations || []).includes(scenario) ? 1 : 0;
                const tagOverlap = normalizedTags.filter((tag) =>
                    [...(template.skills || []), ...(template.workflows || []), ...(template.nodes || []), ...(template.capabilities || [])]
                        .map((item) => String(item).toLowerCase())
                        .some((item) => item.includes(tag) || tag.includes(item))).length;
                const optimizationScore = scoreTemplate(template, policy);
                const computedScore = Number((optimizationScore + (situationMatch * 0.6) + (tagOverlap * 0.08)).toFixed(6));
                return {
                    ...template,
                    optimizationScore,
                    computedScore,
                    situationMatch,
                    tagOverlap,
                };
            })
            .sort((a, b) => b.computedScore - a.computedScore)
            .slice(0, maxTemplates);

        return {
            scenario,
            tags: normalizedTags,
            top: candidates[0] || null,
            candidates,
        };
    }
}

module.exports = {
    REGISTRY_PATH,
    OPTIMIZATION_POLICY_PATH,
    readRegistry,
    readOptimizationPolicy,
    hashRegistry,
    validateRegistry,
    scoreTemplate,
    selectTemplatesForSituation,
    buildOptimizationReport,
    HeadybeeTemplateRegistryService,
    getHealthStatus,
    getOptimizationState,
    registerHeadybeeTemplateRegistryRoutes,
};

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

const ROOT = path.join(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'configs', 'services', 'headybee-template-registry.yaml');

function readRegistry(filePath = REGISTRY_PATH) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function deterministicHash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function templateScore(template) {
    const metrics = template.metrics || {};
    const quality = Number(metrics.quality || 0);
    const confidence = Number(metrics.confidence || 0);
    const successRate = Number(metrics.success_rate || 0);
    const usage = Number(metrics.usage_count || 0);
    const usageFactor = Math.min(1, usage / 200);
    return Number(((quality * 0.35) + (confidence * 0.25) + (successRate * 0.25) + (usageFactor * 0.15)).toFixed(4));
}

class HeadybeeTemplateRegistryService {
    constructor(opts = {}) {
        this.registryPath = opts.registryPath || REGISTRY_PATH;
        this.state = readRegistry(this.registryPath);
        this.startedAt = null;
        this.lastRecommendation = null;
    }

    start() {
        this.startedAt = new Date().toISOString();
        logger.logSystem('∞ HeadybeeTemplateRegistryService: STARTED');
    }

    refresh() {
        this.state = readRegistry(this.registryPath);
        return this.state;
    }

    listTemplates() {
        const templates = this.state.registry?.templates || [];
        return templates.map((template) => ({
            ...template,
            computedScore: templateScore(template),
            deterministicReceipt: deterministicHash({
                id: template.id,
                metrics: template.metrics,
                capabilities: template.capabilities,
            }),
        })).sort((a, b) => b.computedScore - a.computedScore);
    }

    recommend({ scenario = '', tags = [] } = {}) {
        const normalizedTags = Array.isArray(tags) ? tags.map((item) => String(item).toLowerCase()) : [];
        const text = String(scenario || '').toLowerCase();

        const ranked = this.listTemplates().map((template) => {
            const templateTags = (template.tags || []).map((item) => String(item).toLowerCase());
            const matchesTags = normalizedTags.filter((tag) => templateTags.includes(tag)).length;
            const matchesScenario = templateTags.some((tag) => text.includes(tag)) ? 1 : 0;
            const recommendationScore = Number((template.computedScore + (matchesTags * 0.06) + (matchesScenario * 0.08)).toFixed(4));
            return { ...template, recommendationScore };
        }).sort((a, b) => b.recommendationScore - a.recommendationScore);

        this.lastRecommendation = {
            at: new Date().toISOString(),
            scenario,
            tags: normalizedTags,
            template: ranked[0]?.id || null,
        };

        return {
            top: ranked[0] || null,
            ranked,
            receipt: deterministicHash({ scenario, tags: normalizedTags, top: ranked[0]?.id || null }),
        };
    }

    validateRegistry() {
        const rules = this.state.registry?.validation || {};
        const templates = this.listTemplates();
        const violations = [];

        templates.forEach((template) => {
            if (template.metrics.quality < rules.min_quality_score) {
                violations.push({ template: template.id, reason: 'quality_below_threshold' });
            }
            if (template.metrics.confidence < rules.min_confidence_score) {
                violations.push({ template: template.id, reason: 'confidence_below_threshold' });
            }
            if (rules.require_research_tag && !(template.tags || []).includes('research')) {
                violations.push({ template: template.id, reason: 'missing_research_tag' });
            }
        });

        return {
            ok: violations.length === 0,
            totalTemplates: templates.length,
            violations,
            receipt: deterministicHash({ violations, totalTemplates: templates.length }),
        };
    }

    getHealth() {
        return {
            ok: true,
            service: 'headybee-template-registry',
            startedAt: this.startedAt,
            templateCount: (this.state.registry?.templates || []).length,
            lastRecommendationAt: this.lastRecommendation?.at || null,
        };
    }
}

function registerHeadybeeTemplateRegistryRoutes(app, service = new HeadybeeTemplateRegistryService()) {
    service.start();

    app.get('/api/headybee-registry/health', (_req, res) => {
        res.json(service.getHealth());
    });

    app.get('/api/headybee-registry/templates', (_req, res) => {
        res.json({ ok: true, templates: service.listTemplates() });
    });

    app.post('/api/headybee-registry/recommend', (req, res) => {
        res.json({ ok: true, recommendation: service.recommend(req.body || {}) });
    });

    app.get('/api/headybee-registry/validate', (_req, res) => {
        res.json(service.validateRegistry());
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/headybee-registry/health, /templates, /recommend, /validate');

    return service;
}

module.exports = {
    HeadybeeTemplateRegistryService,
    registerHeadybeeTemplateRegistryRoutes,
    templateScore,
    deterministicHash,
};

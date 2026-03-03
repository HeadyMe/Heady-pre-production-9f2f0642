/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const yaml = require("js-yaml");
const providerUsageTracker = require("../telemetry/provider-usage-tracker");
let selfAwareness = null;
try { selfAwareness = require("../self-awareness"); } catch { /* optional */ }

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const TEMPLATE_MATRIX_PATH = path.join(PROJECT_ROOT, "configs", "autonomy", "headybee-template-matrix.yaml");
const DEFAULT_SCENARIOS = [
    { id: "incident-response", keywords: ["incident", "error", "degraded", "failure"], preferredTemplate: "health-check" },
    { id: "traffic-spike", keywords: ["traffic", "scale", "latency", "burst"], preferredTemplate: "monitor" },
    { id: "data-pipeline", keywords: ["pipeline", "processing", "batch", "ingest"], preferredTemplate: "processor" },
    { id: "security-sweep", keywords: ["security", "audit", "scan", "vulnerability"], preferredTemplate: "scanner" },
];

function safeReadJson(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return fallback;
    }
}


function safeReadYaml(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return yaml.load(fs.readFileSync(filePath, "utf8"));
    } catch {
        return fallback;
    }
}

function getFactoryTemplates() {
    return ["health-check", "monitor", "processor", "scanner"];
}

function getVectorTemplates() {
    try {
        const vte = require("../vector-template-engine");
        return vte.listTemplates().map((template) => template.name || template.id).filter(Boolean);
    } catch {
        return [];
    }
}

class HeadyTemplateRegistry {
    constructor({ vectorMemory, tracker = providerUsageTracker } = {}) {
        this.vectorMemory = vectorMemory;
        this.tracker = tracker;
        this.state = {
            generatedAt: null,
            templates: [],
            validation: null,
            projection: null,
            outcomes: {},
        };
    }

    loadScenarioMatrix() {
        const matrix = safeReadYaml(TEMPLATE_MATRIX_PATH, null);
        if (!matrix || !Array.isArray(matrix.situations)) {
            return {
                defaultTemplate: "health-check",
                situations: DEFAULT_SCENARIOS.map((scenario) => ({
                    id: scenario.id,
                    keywords: scenario.keywords,
                    preferred_template: scenario.preferredTemplate,
                    node: "conductor",
                    workflow: "generic",
                    headyswarm_task: "route-task",
                    required_skills: [],
                })),
            };
        }

        return {
            defaultTemplate: matrix.default_template || "health-check",
            situations: matrix.situations,
        };
    }

    loadRegistry() {
        const factoryTemplates = getFactoryTemplates().map((id) => ({
            id,
            source: "bee-factory",
            class: "core",
            confidence: 0.95,
        }));

        const vectorTemplates = getVectorTemplates().map((id) => ({
            id,
            source: "vector-template-engine",
            class: "vector",
            confidence: 0.85,
        }));

        const mergedById = new Map();
        [...factoryTemplates, ...vectorTemplates].forEach((template) => {
            if (!mergedById.has(template.id)) mergedById.set(template.id, template);
        });

        const templates = Array.from(mergedById.values());
        this.state.generatedAt = new Date().toISOString();
        this.state.templates = templates;
        return templates;
    }


    _getOutcomeScore(templateId) {
        const stats = this.state.outcomes[templateId];
        if (!stats || stats.total === 0) return 0;
        return (stats.successes / stats.total) - (stats.failures / stats.total);
    }

    async rankTemplatesForSituation(situation = "") {
        const templates = this.state.templates.length > 0 ? this.state.templates : this.loadRegistry();
        const rec = this.recommendTemplate(situation);

        let awarenessFactor = 1;
        if (selfAwareness && typeof selfAwareness.assessSystemState === "function") {
            try {
                const assessment = await selfAwareness.assessSystemState(situation);
                awarenessFactor = Number(assessment.confidence) || 1;
            } catch {
                awarenessFactor = 1;
            }
        }

        const ranked = templates.map((template) => {
            const isRecommended = rec.selected.id === template.id ? 1 : 0;
            const outcomeScore = this._getOutcomeScore(template.id);
            const score = (isRecommended * 0.6) + (template.confidence * 0.25) + (outcomeScore * 0.15);
            return {
                id: template.id,
                source: template.source,
                confidence: template.confidence,
                outcomeScore,
                score: +(score * awarenessFactor).toFixed(4),
            };
        }).sort((a, b) => b.score - a.score);

        return {
            ok: true,
            situation,
            awarenessFactor,
            recommended: rec,
            ranked,
            generatedAt: new Date().toISOString(),
        };
    }

    async recordTemplateOutcome({ templateId, situation = "", status = "success", latencyMs = 0, metadata = {} } = {}) {
        const id = String(templateId || "").trim();
        if (!id) return { ok: false, error: "template_id_required" };

        if (!this.state.outcomes[id]) {
            this.state.outcomes[id] = { total: 0, successes: 0, failures: 0, lastStatus: null, lastLatencyMs: 0 };
        }

        const bucket = this.state.outcomes[id];
        bucket.total += 1;
        bucket.lastStatus = status;
        bucket.lastLatencyMs = Number(latencyMs) || 0;
        if (status === "success") bucket.successes += 1;
        else bucket.failures += 1;

        if (this.vectorMemory && typeof this.vectorMemory.ingestMemory === "function") {
            await this.vectorMemory.ingestMemory({
                content: JSON.stringify({ templateId: id, situation, status, latencyMs: bucket.lastLatencyMs, metadata }),
                metadata: { type: "headybee_template_outcome", templateId: id, status },
            });
        }

        return { ok: true, templateId: id, stats: bucket };
    }

    recommendTemplate(situation = "") {
        const normalized = String(situation || "").toLowerCase();
        const templates = this.state.templates.length > 0 ? this.state.templates : this.loadRegistry();
        const matrix = this.loadScenarioMatrix();

        let best = { id: matrix.defaultTemplate || templates[0]?.id || "health-check", score: 0, scenario: null };
        for (const scenario of matrix.situations) {
            const keywords = Array.isArray(scenario.keywords) ? scenario.keywords : [];
            const score = keywords.reduce((sum, kw) => sum + (normalized.includes(String(kw).toLowerCase()) ? 1 : 0), 0);
            if (score > best.score) {
                best = {
                    id: scenario.preferred_template || matrix.defaultTemplate || "health-check",
                    score,
                    scenario,
                };
            }
        }

        const selected = templates.find((template) => template.id === best.id) || templates[0] || { id: "health-check", source: "fallback" };
        return {
            ok: true,
            selected,
            confidence: Math.min(1, 0.5 + (best.score * 0.1)),
            situation,
            node: best.scenario?.node || "conductor",
            workflow: best.scenario?.workflow || "generic",
            headyswarmTask: best.scenario?.headyswarm_task || "route-task",
            requiredSkills: best.scenario?.required_skills || [],
            generatedAt: new Date().toISOString(),
        };
    }

    validateCoverage() {
        const templates = this.state.templates.length > 0 ? this.state.templates : this.loadRegistry();
        const available = new Set(templates.map((template) => template.id));

        const matrix = this.loadScenarioMatrix();
        const scenarioCoverage = matrix.situations.map((scenario) => ({
            scenarioId: scenario.id,
            preferredTemplate: scenario.preferred_template,
            covered: available.has(scenario.preferred_template),
            node: scenario.node || "conductor",
            headyswarmTask: scenario.headyswarm_task || "route-task",
        }));

        const coveredCount = scenarioCoverage.filter((entry) => entry.covered).length;
        const result = {
            ok: coveredCount === scenarioCoverage.length,
            coverageRatio: scenarioCoverage.length > 0 ? coveredCount / scenarioCoverage.length : 0,
            totalTemplates: templates.length,
            scenarioCoverage,
            generatedAt: new Date().toISOString(),
        };

        this.state.validation = result;
        return result;
    }

    getProjectionStatus() {
        try {
            const syncBee = require("../bees/sync-projection-bee");
            const state = syncBee.getSyncState();
            const hash = syncBee.computeRAMStateHash();
            const status = {
                ok: true,
                sourceOfTruth: "ram-vector-space",
                hash,
                lastProjectionTime: state.lastProjectionTime,
                projectionCount: state.projectionCount,
                targets: state.targets,
                generatedAt: new Date().toISOString(),
            };
            this.state.projection = status;
            return status;
        } catch (error) {
            return { ok: false, error: error.message, generatedAt: new Date().toISOString() };
        }
    }

    async embedRegistrySnapshot(trigger = "manual") {
        const provider = "heady_template_registry";
        const budget = this.tracker.checkProviderBudget(provider);
        if (budget.status === "exceeded") {
            return { ok: false, error: "budget_exceeded", budget };
        }

        if (!this.vectorMemory || typeof this.vectorMemory.ingestMemory !== "function") {
            return { ok: false, error: "vector_memory_unavailable" };
        }

        const snapshot = {
            templates: this.loadRegistry(),
            validation: this.validateCoverage(),
            projection: this.getProjectionStatus(),
            trigger,
            generatedAt: new Date().toISOString(),
        };

        const content = JSON.stringify(snapshot);
        const id = await this.vectorMemory.ingestMemory({
            content,
            metadata: {
                type: "headybee_template_registry",
                trigger,
                templates: snapshot.templates.length,
                coverageRatio: snapshot.validation.coverageRatio,
                sourceOfTruth: "ram-vector-space",
            },
        });

        this.tracker.record({
            provider,
            account: "heady-core",
            model: "template-registry-v1",
            tokensIn: Math.ceil(content.length / 4),
            tokensOut: 0,
            costUsd: 0,
            latencyMs: 0,
            endpoint: "/api/autonomy/templates/embed",
            status: "success",
        });

        return { ok: true, id, snapshot };
    }

    syncProjection({ apply = false } = {}) {
        const projection = this.getProjectionStatus();
        if (!projection.ok) return { ok: false, error: projection.error };

        if (!apply) {
            return { ok: true, dryRun: true, projection };
        }

        try {
            const syncBee = require("../bees/sync-projection-bee");
            const injectResults = syncBee.injectTemplatesIntoHFSpaces();
            const changedFiles = injectResults
                .filter((entry) => entry.injected && entry.space)
                .map((entry) => `heady-hf-spaces/${entry.space}/index.html`);
            const github = changedFiles.length > 0 ? syncBee.projectToGitHub(changedFiles) : { ok: true, files: 0 };
            return {
                ok: true,
                dryRun: false,
                injectResults,
                github,
                projection: this.getProjectionStatus(),
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }


    getOptimizationPlan() {
        const validation = this.validateCoverage();
        const templates = this.state.templates.length > 0 ? this.state.templates : this.loadRegistry();
        const weakTemplates = Object.entries(this.state.outcomes)
            .map(([id, stats]) => ({
                id,
                total: stats.total,
                successRate: stats.total > 0 ? +(stats.successes / stats.total).toFixed(4) : 0,
                avgLatencyMs: stats.lastLatencyMs || 0,
            }))
            .filter((entry) => entry.total >= 3 && entry.successRate < 0.7)
            .sort((a, b) => a.successRate - b.successRate);

        const uncovered = validation.scenarioCoverage.filter((entry) => !entry.covered);
        const matrix = this.loadScenarioMatrix();

        return {
            ok: true,
            totalTemplates: templates.length,
            coverageRatio: validation.coverageRatio,
            uncoveredScenarios: uncovered,
            weakTemplates,
            recommendedActions: [
                ...(uncovered.length > 0 ? ["create_or_import_missing_templates"] : ["coverage_complete"]),
                ...(weakTemplates.length > 0 ? ["run_template_research_and_retrain"] : ["template_performance_nominal"]),
                "record_template_outcomes_continuously",
                "sync_projection_to_github_source_of_truth",
            ],
            matrixVersion: matrix.version || 1,
            generatedAt: new Date().toISOString(),
        };
    }

    health() {
        const templates = this.state.templates.length > 0 ? this.state.templates : this.loadRegistry();
        const validation = this.state.validation || this.validateCoverage();
        return {
            ok: true,
            templates: templates.length,
            coverageRatio: validation.coverageRatio,
            generatedAt: this.state.generatedAt,
            sourceOfTruth: "ram-vector-space",
        };
    }
}

function registerTemplateRegistryRoutes(app, registry) {
    if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
        throw new Error("Express app required to register template registry routes.");
    }

    const controller = registry || new HeadyTemplateRegistry();

    app.get("/api/autonomy/templates/health", (req, res) => {
        res.json(controller.health());
    });

    app.get("/api/autonomy/templates/validate", (req, res) => {
        res.json(controller.validateCoverage());
    });

    app.get("/api/autonomy/templates/recommend", (req, res) => {
        res.json(controller.recommendTemplate(req.query.situation || ""));
    });

    app.get("/api/autonomy/templates/rank", async (req, res) => {
        const result = await controller.rankTemplatesForSituation(req.query.situation || "");
        res.json(result);
    });

    app.get("/api/autonomy/templates/projection", (req, res) => {
        res.json(controller.getProjectionStatus());
    });

    app.get("/api/autonomy/templates/optimize-plan", (req, res) => {
        res.json(controller.getOptimizationPlan());
    });

    app.post("/api/autonomy/templates/projection/sync", (req, res) => {
        const apply = req.body?.apply === true;
        const result = controller.syncProjection({ apply });
        res.status(result.ok ? 200 : 503).json(result);
    });

    app.post("/api/autonomy/templates/outcome", async (req, res) => {
        const result = await controller.recordTemplateOutcome({
            templateId: req.body?.templateId,
            situation: req.body?.situation || "",
            status: req.body?.status || "success",
            latencyMs: req.body?.latencyMs || 0,
            metadata: req.body?.metadata || {},
        });
        res.status(result.ok ? 200 : 400).json(result);
    });

    app.post("/api/autonomy/templates/embed", async (req, res) => {
        const result = await controller.embedRegistrySnapshot(req.body?.trigger || "api");
        res.status(result.ok ? 200 : 503).json(result);
    });

    logger.logSystem("Heady template registry routes registered");
    return controller;
}

module.exports = {
    HeadyTemplateRegistry,
    registerTemplateRegistryRoutes,
    DEFAULT_SCENARIOS,
    safeReadJson,
    safeReadYaml,
};

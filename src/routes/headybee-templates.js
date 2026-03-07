/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const express = require('../core/heady-server');
const logger = require("../utils/logger");
const {
    TEMPLATE_REGISTRY,
    recommendTemplates,
    validateTemplateCoverage,
    buildGithubSourceOfTruthProjection,
    auditInfrastructureDrift,
} = require("../headybee-template-registry");

const router = express.Router();

router.get("/health", (req, res) => {
    const coverage = validateTemplateCoverage();
    res.json({
        ok: true,
        service: "headybee-template-registry",
        templates: TEMPLATE_REGISTRY.length,
        coverage,
        ts: new Date().toISOString(),
    });
});

router.get("/registry", (req, res) => {
    res.json({
        ok: true,
        templates: TEMPLATE_REGISTRY,
        coverage: validateTemplateCoverage(),
        ts: new Date().toISOString(),
    });
});

router.post("/optimize", (req, res) => {
    const context = req.body || {};
    const recommendations = recommendTemplates(context, Number(req.query.limit || 5));

    logger.logNodeActivity("CONDUCTOR", "Headybee template optimization computed", {
        intents: context.intents || [],
        tags: context.tags || [],
        recommended: recommendations.map((item) => item.templateId),
    });

    res.json({
        ok: true,
        recommendations,
        coverage: validateTemplateCoverage(),
        ts: new Date().toISOString(),
    });
});

router.post("/projection", (req, res) => {
    const projection = buildGithubSourceOfTruthProjection(req.body || {});
    res.json({ ok: true, projection });
});

router.post("/maintenance/audit", (req, res) => {
    const audit = auditInfrastructureDrift(req.body || {});
    res.json({ ok: true, audit, ts: new Date().toISOString() });
});

module.exports = router;

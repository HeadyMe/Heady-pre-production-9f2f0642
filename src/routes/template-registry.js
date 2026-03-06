/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const express = require("express");
const registryService = require("../services/headybee-template-registry");

const router = express.Router();

router.get("/health", (_req, res) => {
    res.json(registryService.health());
});

router.get("/templates", (req, res) => {
    const { query, category } = req.query;
    const templates = registryService.listTemplates({ query, category });
    res.json({
        ok: true,
        total: templates.length,
        templates,
        ts: new Date().toISOString(),
    });
});

router.get("/templates/:id", (req, res) => {
    const template = registryService.getTemplate(req.params.id);
    if (!template) {
        return res.status(404).json({ ok: false, error: "Template not found" });
    }

    return res.json({ ok: true, template, ts: new Date().toISOString() });
});

router.post("/validate", (_req, res) => {
    const report = registryService.validateAllTemplates();
    res.json({ ok: true, report, ts: new Date().toISOString() });
});

router.post("/optimize", (req, res) => {
    const sweep = registryService.runOptimizationSweep(req.body || {});
    res.json({ ok: true, sweep, ts: new Date().toISOString() });
});

router.get("/projection", (_req, res) => {
    res.json({ ok: true, projection: registryService.getProjectionStatus(), ts: new Date().toISOString() });
});

module.exports = router;

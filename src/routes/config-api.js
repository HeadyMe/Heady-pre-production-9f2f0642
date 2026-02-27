/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Config API Router — IDE spec, playbook, agentic, activation, public-domain
 * Extracted from heady-manager.js — Phase 2 Liquid Architecture.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const router = express.Router();

const projectRoot = path.resolve(__dirname, '..', '..');

function loadYamlConfig(filename) {
    const filePath = path.join(projectRoot, "configs", filename);
    if (!fs.existsSync(filePath)) return null;
    try { return yaml.load(fs.readFileSync(filePath, "utf8")); }
    catch { return null; }
}

/**
 * @swagger
 * /api/ide/spec:
 *   get:
 *     summary: Get HeadyAutoIDE spec
 */
router.get("/ide/spec", (req, res) => {
    const spec = loadYamlConfig("heady-auto-ide.yaml");
    if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
    res.json({ ok: true, ...spec, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/ide/agents:
 *   get:
 *     summary: Get HeadyAutoIDE agents
 */
router.get("/ide/agents", (req, res) => {
    const spec = loadYamlConfig("heady-auto-ide.yaml");
    if (!spec) return res.status(404).json({ error: "HeadyAutoIDE spec not found" });
    res.json({ ok: true, agents: spec.agentRoles || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/playbook:
 *   get:
 *     summary: Get playbook
 */
router.get("/playbook", (req, res) => {
    const playbook = loadYamlConfig("build-playbook.yaml");
    if (!playbook) return res.status(404).json({ error: "Build Playbook not found" });
    res.json({ ok: true, ...playbook, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/agentic:
 *   get:
 *     summary: Get agentic coding config
 */
router.get("/agentic", (req, res) => {
    const agentic = loadYamlConfig("agentic-coding.yaml");
    if (!agentic) return res.status(404).json({ error: "Agentic Coding config not found" });
    res.json({ ok: true, ...agentic, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/activation:
 *   get:
 *     summary: Get activation manifest
 */
router.get("/activation", (req, res) => {
    const manifest = loadYamlConfig("activation-manifest.yaml");
    if (!manifest) return res.status(404).json({ error: "Activation Manifest not found" });

    let loadRegistry;
    try { loadRegistry = require("../utils/registry-loader").loadRegistry; } catch { loadRegistry = () => ({ nodes: {} }); }
    const reg = loadRegistry();
    const nodeList = Object.entries(reg.nodes || {});
    const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

    res.json({
        ok: true,
        status: manifest.status || "PENDING",
        activatedAt: manifest.activatedAt,
        version: manifest.version,
        verifiedResources: {
            configs: (manifest.verifiedResources?.configs || []).length,
            coreEngines: (manifest.verifiedResources?.coreEngines || []).length,
            companionSystems: (manifest.verifiedResources?.companionSystems || []).length,
            registryNodes: { total: nodeList.length, active: activeNodes },
        },
        operatingDirectives: (manifest.operatingDirectives || []).length,
        pipelineStages: (manifest.pipelineInitTemplate?.stages || []).length,
        ts: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /api/public-domain:
 *   get:
 *     summary: Get public domain integration config
 */
router.get("/public-domain", (req, res) => {
    const pdi = loadYamlConfig("public-domain-integration.yaml");
    if (!pdi) return res.status(404).json({ error: "Public Domain Integration config not found" });
    res.json({ ok: true, ...pdi, ts: new Date().toISOString() });
});

module.exports = router;

/**
 * src/routes/config.js — YAML Config & IDE Spec API routes
 * Extracted from heady-manager.js monolith
 *
 * Handles: /api/ide/spec, /api/playbook, /api/agentic,
 * /api/manifest, /api/public-domain
 */

const express = require("express");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const CONFIGS_DIR = path.join(__dirname, "..", "..", "configs");

function loadYamlConfig(filename) {
    try {
        return yaml.load(fs.readFileSync(path.join(CONFIGS_DIR, filename), "utf8"));
    } catch {
        return null;
    }
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
 * /api/playbook:
 *   get:
 *     summary: Get methodology playbook
 */
router.get("/playbook", (req, res) => {
    const playbook = loadYamlConfig("heady-code-methodology.yaml");
    if (!playbook) return res.status(404).json({ error: "Methodology playbook not found" });
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
 * /api/manifest:
 *   get:
 *     summary: Get system manifest
 */
router.get("/manifest", (req, res) => {
    const manifest = loadYamlConfig("Heady-manifest.yaml");
    if (!manifest) return res.status(404).json({ error: "Manifest not found" });
    res.json({
        ok: true,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        modules: (manifest.modules || []).length,
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
    const pdConfig = loadYamlConfig("public-domain-integration.yaml");
    if (!pdConfig) return res.status(404).json({ error: "Public Domain Integration config not found" });
    res.json({ ok: true, ...pdConfig, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/intelligence:
 *   get:
 *     summary: Get ensemble intelligence configuration (HeadyCoder v2.0)
 */
router.get("/intelligence", (req, res) => {
    const intel = loadYamlConfig("heady-intelligence.yaml");
    if (!intel) return res.status(404).json({ error: "Intelligence config not found" });
    res.json({ ok: true, ...intel, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/coder:
 *   get:
 *     summary: Get HeadyCoder architecture config
 */
router.get("/coder", (req, res) => {
    const coder = loadYamlConfig("heady-coder.yaml");
    if (!coder) return res.status(404).json({ error: "HeadyCoder config not found" });
    res.json({ ok: true, ...coder, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/routing:
 *   get:
 *     summary: Get AI routing configuration
 */
router.get("/routing", (req, res) => {
    const routing = loadYamlConfig("ai-routing.yaml");
    if (!routing) return res.status(404).json({ error: "AI routing config not found" });
    res.json({ ok: true, ...routing, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/governance:
 *   get:
 *     summary: Get file governance policy
 */
router.get("/governance", (req, res) => {
    const governance = loadYamlConfig("file-governance.yaml");
    if (!governance) return res.status(404).json({ error: "Governance config not found" });
    res.json({ ok: true, ...governance, ts: new Date().toISOString() });
});

module.exports = { router, loadYamlConfig };

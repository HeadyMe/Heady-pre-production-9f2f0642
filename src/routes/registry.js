/**
 * src/routes/registry.js — Registry API routes
 * Extracted from heady-manager.js monolith
 *
 * Handles: /api/registry, /api/registry/component/:id,
 * /api/registry/environments, /api/registry/docs,
 * /api/registry/notebooks, /api/registry/patterns
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

function readJsonSafe(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
    catch { return null; }
}

const HEADY_DIR = path.join(__dirname, "..", "..");
const REGISTRY_PATH = path.join(HEADY_DIR, ".heady", "registry.json");

function loadRegistry() {
    return readJsonSafe(REGISTRY_PATH) || { nodes: {}, tools: [], workflows: [], services: [] };
}

function saveRegistry(data) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
}

/**
 * @swagger
 * /api/registry:
 *   get:
 *     summary: Get registry data
 */
router.get("/", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ ok: true, ...registry, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/component/:id:
 *   get:
 *     summary: Get a single component from registry
 */
router.get("/component/:id", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    const comp = (registry.components || []).find(c => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: `Component '${req.params.id}' not found` });
    res.json(comp);
});

/**
 * @swagger
 * /api/registry/environments:
 *   get:
 *     summary: Get environments data
 */
router.get("/environments", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ environments: registry.environments || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/docs:
 *   get:
 *     summary: Get docs data
 */
router.get("/docs", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ docs: registry.docs || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/notebooks:
 *   get:
 *     summary: Get notebooks data
 */
router.get("/notebooks", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ notebooks: registry.notebooks || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/patterns:
 *   get:
 *     summary: Get patterns data
 */
router.get("/patterns", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ patterns: registry.patterns || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/ai-nodes:
 *   get:
 *     summary: Get AI nodes from registry (HeadyCoder v2.0)
 */
router.get("/ai-nodes", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({ aiNodes: registry.aiNodes || [], ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/registry/ensemble:
 *   get:
 *     summary: Get ensemble defaults from registry
 */
router.get("/ensemble", (req, res) => {
    const registry = readJsonSafe(path.join(HEADY_DIR, "heady-registry.json"));
    if (!registry) return res.status(404).json({ error: "Registry not found" });
    res.json({
        ensembleDefaults: registry.ensembleDefaults || {},
        aiNodeCount: (registry.aiNodes || []).length,
        componentCount: (registry.components || []).length,
        ts: new Date().toISOString()
    });
});

module.exports = { router, loadRegistry, saveRegistry, readJsonSafe };

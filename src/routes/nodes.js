/**
 * src/routes/nodes.js — Node Management & System Status API routes
 * Extracted from heady-manager.js monolith
 *
 * Handles: /api/nodes, /api/nodes/:nodeId/activate,
 * /api/nodes/:nodeId/deactivate, /api/system/status,
 * /api/system/production
 */

const express = require("express");
const { loadRegistry, saveRegistry } = require("./registry");

const router = express.Router();

/**
 * @swagger
 * /api/nodes:
 *   get:
 *     summary: Get all nodes and their status
 */
router.get("/", (req, res) => {
    const reg = loadRegistry();
    const nodeList = Object.entries(reg.nodes || {}).map(([name, node]) => ({
        id: name,
        ...node,
    }));
    res.json({ nodes: nodeList, total: nodeList.length, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/nodes/:nodeId/activate:
 *   post:
 *     summary: Activate a node
 */
router.post("/:nodeId/activate", (req, res) => {
    const reg = loadRegistry();
    const id = req.params.nodeId.toUpperCase();
    if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
    reg.nodes[id].status = "active";
    reg.nodes[id].activatedAt = new Date().toISOString();
    saveRegistry(reg);
    res.json({ ok: true, node: id, status: "active", ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/nodes/:nodeId/deactivate:
 *   post:
 *     summary: Deactivate a node
 */
router.post("/:nodeId/deactivate", (req, res) => {
    const reg = loadRegistry();
    const id = req.params.nodeId.toUpperCase();
    if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
    reg.nodes[id].status = "inactive";
    reg.nodes[id].deactivatedAt = new Date().toISOString();
    saveRegistry(reg);
    res.json({ ok: true, node: id, status: "inactive", ts: new Date().toISOString() });
});

module.exports = router;

/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * src/routes/nodes.js — Node Management & System Status API routes
 * Extracted from heady-manager.js monolith
 *
 * Handles: /api/nodes, /api/nodes/:nodeId, /api/nodes/:nodeId/activate,
 * /api/nodes/:nodeId/deactivate
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
    const nodeList = Object.entries(reg.nodes || {}).map(([id, node]) => ({
        id,
        ...node,
    }));
    res.json({ total: nodeList.length, active: nodeList.filter(n => n.status === "active").length, nodes: nodeList, ts: new Date().toISOString() });
});

/**
 * @swagger
 * /api/nodes/{nodeId}:
 *   get:
 *     summary: Get node data
 */
router.get("/:nodeId", (req, res) => {
    const reg = loadRegistry();
    const nodes = reg.nodes || {};
    const node = nodes[req.params.nodeId.toUpperCase()];
    if (!node) return res.status(404).json({ error: `Node '${req.params.nodeId}' not found` });
    res.json({ id: req.params.nodeId.toUpperCase(), ...node });
});

/**
 * @swagger
 * /api/nodes/:nodeId/activate:
 *   post:
 *     summary: Activate a node
 */
router.post("/:nodeId/activate", (req, res) => {
    const reg = loadRegistry();
    reg.nodes = reg.nodes || {};
    const id = req.params.nodeId.toUpperCase();
    if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
    reg.nodes[id].status = "active";
    reg.nodes[id].last_invoked = new Date().toISOString();
    saveRegistry(reg);
    res.json({ success: true, node: id, status: "active" });
});

/**
 * @swagger
 * /api/nodes/:nodeId/deactivate:
 *   post:
 *     summary: Deactivate a node
 */
router.post("/:nodeId/deactivate", (req, res) => {
    const reg = loadRegistry();
    reg.nodes = reg.nodes || {};
    const id = req.params.nodeId.toUpperCase();
    if (!reg.nodes[id]) return res.status(404).json({ error: `Node '${id}' not found` });
    reg.nodes[id].status = "available";
    saveRegistry(reg);
    res.json({ success: true, node: id, status: "available" });
});

module.exports = router;

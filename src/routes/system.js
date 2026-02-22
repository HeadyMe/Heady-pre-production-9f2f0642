/**
 * src/routes/system.js — System Status & Production Activation routes
 * Extracted from heady-manager.js monolith
 *
 * Handles: /api/system/status, /api/system/production
 */

const express = require("express");
const { loadRegistry, saveRegistry } = require("./registry");

const router = express.Router();

/**
 * @swagger
 * /api/system/status:
 *   get:
 *     summary: Get full system status
 */
router.get("/status", (req, res) => {
    const reg = loadRegistry();
    const nodeList = Object.entries(reg.nodes || {});
    const activeNodes = nodeList.filter(([, n]) => n.status === "active").length;

    res.json({
        system: "Heady Systems",
        version: "3.3.0",
        nodes: {
            total: nodeList.length,
            active: activeNodes,
            inactive: nodeList.length - activeNodes,
        },
        tools: (reg.tools || []).length,
        workflows: (reg.workflows || []).length,
        services: (reg.services || []).length,
        ts: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /api/system/production:
 *   post:
 *     summary: Activate production mode
 */
router.post("/production", (req, res) => {
    const reg = loadRegistry();
    const ts = new Date().toISOString();
    const report = { nodes: [], tools: [], workflows: [], services: [] };

    for (const [name, node] of Object.entries(reg.nodes || {})) {
        node.status = "active";
        node.activatedAt = ts;
        report.nodes.push(name);
    }
    for (const tool of reg.tools || []) {
        tool.status = "active";
        report.tools.push(tool.id || tool.name);
    }
    for (const wf of reg.workflows || []) {
        wf.status = "active";
        report.workflows.push(wf.id || wf.name);
    }
    for (const svc of reg.services || []) {
        svc.status = "active";
        report.services.push(svc.id || svc.name);
    }

    saveRegistry(reg);
    res.json({
        ok: true,
        message: "All systems activated for production",
        activated: report,
        sacred_geometry: "FULLY_ACTIVATED",
        ts,
    });
});

module.exports = router;

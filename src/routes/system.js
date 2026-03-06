/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * src/routes/system.js — System Status API routes
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
    version: "3.0.0",
    environment: (reg.metadata || {}).environment || "development",
    production_ready: activeNodes === nodeList.length && nodeList.length > 0,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    capabilities: {
      nodes: { total: nodeList.length, active: activeNodes },
      tools: { total: Object.keys(reg.tools || {}).length },
      workflows: { total: Object.keys(reg.workflows || {}).length },
      services: { total: Object.keys(reg.services || {}).length },
    },
    sacred_geometry: { architecture: "active", organic_systems: activeNodes === nodeList.length },
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
  const expectedAdminToken = process.env.ADMIN_TOKEN || process.env.HEADY_ADMIN_TOKEN || "";
  if (expectedAdminToken) {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const providedToken = req.headers["x-admin-token"] || bearerToken;
    if (providedToken !== expectedAdminToken) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
  }

  const reg = loadRegistry();
  const ts = new Date().toISOString();
  const report = { nodes: [], tools: [], workflows: [], services: [] };

  for (const [name, node] of Object.entries(reg.nodes || {})) {
    node.status = "active"; node.last_invoked = ts; report.nodes.push(name);
  }
  for (const [name, tool] of Object.entries(reg.tools || {})) {
    tool.status = "active"; report.tools.push(name);
  }
  for (const [name, wf] of Object.entries(reg.workflows || {})) {
    wf.status = "active"; report.workflows.push(name);
  }
  for (const [name, svc] of Object.entries(reg.services || {})) {
    svc.status = name === "heady-manager" ? "healthy" : "active"; report.services.push(name);
  }
  for (const [, sk] of Object.entries(reg.skills || {})) { sk.status = "active"; }

  reg.metadata = { ...reg.metadata, last_updated: ts, version: "3.0.0-production", environment: "production", all_nodes_active: true, production_activated_at: ts };
  saveRegistry(reg);

  res.json({
    success: true,
    environment: "production",
    activated: { nodes: report.nodes.length, tools: report.tools.length, workflows: report.workflows.length, services: report.services.length },
    sacred_geometry: "FULLY_ACTIVATED",
    ts,
  });
});

module.exports = router;

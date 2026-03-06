/**
 * HCSysOrchestrator — Multi-Brain Task Router
 * Routes tasks across brain layers and manages orchestration.
 */
const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "hc-sys-orchestrator",
        version: "2.0.0",
        activeBrains: 1,
        ts: new Date().toISOString(),
    });
});

router.post("/route", (req, res) => {
    const { task, targetBrain, priority } = req.body;
    res.json({
        ok: true,
        routeId: `route-${Date.now()}`,
        task: task || "unnamed",
        routed_to: targetBrain || "heady-brain",
        priority: priority || "normal",
        ts: new Date().toISOString(),
    });
});

router.get("/brains", (req, res) => {
    res.json({
        ok: true,
        brains: [
            { id: "heady-brain", status: "active", type: "primary" },
        ],
        ts: new Date().toISOString(),
    });
});

router.get("/layers", (req, res) => {
    res.json({
        ok: true,
        layers: [
            { id: "perception", status: "active" },
            { id: "reasoning", status: "active" },
            { id: "action", status: "active" },
        ],
        ts: new Date().toISOString(),
    });
});

module.exports = router;

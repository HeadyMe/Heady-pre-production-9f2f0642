/**
 * HeadyBrain API — Per-Layer Intelligence Routes
 * Provides /plan, /feedback, /status endpoints for the brain orchestration layer.
 */
const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "heady-brain-api",
        layer: "orchestrator",
        version: "2.0.0",
        ts: new Date().toISOString(),
    });
});

router.post("/plan", (req, res) => {
    const { task, context, priority } = req.body;
    res.json({
        ok: true,
        planId: `plan-${Date.now()}`,
        task: task || "unnamed",
        status: "accepted",
        message: "Plan submitted to brain orchestrator layer",
        ts: new Date().toISOString(),
    });
});

router.post("/feedback", (req, res) => {
    const { planId, feedback, rating } = req.body;
    res.json({
        ok: true,
        planId: planId || "unknown",
        feedbackReceived: true,
        rating: rating || "neutral",
        ts: new Date().toISOString(),
    });
});

router.get("/status", (req, res) => {
    res.json({
        ok: true,
        activePlans: 0,
        completedPlans: 0,
        status: "idle",
        ts: new Date().toISOString(),
    });
});

module.exports = router;

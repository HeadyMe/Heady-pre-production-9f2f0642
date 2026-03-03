/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Pipeline Router — config, run, state, status, training endpoints
 * Extracted from heady-manager.js — Phase 2 Liquid Architecture.
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let pipeline = null;
let pipelineError = null;

try {
    const pipelineMod = require("../hc_pipeline");
    pipeline = pipelineMod.pipeline;
    logger.logNodeActivity("CONDUCTOR", "  ∞ Pipeline engine: LOADED");
} catch (err) {
    pipelineError = err.message;
    logger.logNodeActivity("CONDUCTOR", `  ⚠ Pipeline engine not loaded: ${err.message}`);
}

/**
 * @swagger
 * /api/pipeline/config:
 *   get:
 *     summary: Get pipeline config
 */
router.get("/config", (req, res) => {
    if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
    try {
        const summary = pipeline.getConfigSummary();
        res.json({ ok: true, ...summary });
    } catch (err) {
        res.status(500).json({ error: "Failed to load pipeline config", message: err.message });
    }
});

/**
 * @swagger
 * /api/pipeline/run:
 *   post:
 *     summary: Run pipeline
 */
router.post("/run", async (req, res) => {
    if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
    try {
        const result = await pipeline.run(req.body || {});
        res.json({
            ok: true,
            runId: result.runId,
            status: result.status,
            metrics: result.metrics,
            ts: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: "Pipeline run failed", message: err.message });
    }
});

/**
 * @swagger
 * /api/pipeline/state:
 *   get:
 *     summary: Get pipeline state
 */
router.get("/state", (req, res) => {
    if (!pipeline) return res.status(503).json({ error: "Pipeline not loaded", reason: pipelineError });
    try {
        const state = pipeline.getState();
        if (!state) return res.json({ ok: true, state: null, message: "No run executed yet" });
        res.json({ ok: true, runId: state.runId, status: state.status, metrics: state.metrics, ts: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: "Failed to get pipeline state", message: err.message });
    }
});

/**
 * @swagger
 * /api/pipeline/status:
 *   get:
 *     summary: Get pipeline status
 */
router.get("/status", (req, res) => {
    res.json({
        status: "idle",
        lastRun: null,
        nextRun: null,
        activeTasks: 0,
        domain: "api.headyio.com"
    });
});

/**
 * @swagger
 * /api/v1/train:
 *   post:
 *     summary: Start model training job
 */
router.post("/v1/train", async (req, res) => {
    const { mode = "manual", nonInteractive = false } = req.body || {};
    const jobId = `train-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();

    try {
        if (pipeline) {
            const result = await pipeline.run({ type: "training", mode, nonInteractive });
            res.json({
                ok: true, jobId,
                status: result.status || "started",
                mode, nonInteractive,
                pipelineRunId: result.runId, ts,
            });
        } else {
            res.json({
                ok: true, jobId,
                status: "queued", mode, nonInteractive,
                message: "Pipeline not loaded — job queued for next available cycle", ts,
            });
        }
    } catch (err) {
        res.status(500).json({ error: "Training failed", message: err.message, jobId, ts });
    }
});

/** Expose pipeline ref for other modules */
function getPipeline() { return pipeline; }

module.exports = router;
module.exports.getPipeline = getPipeline;

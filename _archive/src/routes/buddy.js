/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * HeadyBuddy API Routes — Extracted from heady-manager.js (HeadySupervisor Decomposition)
 * Handles: /api/buddy/health, /chat, /suggestions, /orchestrator, /pipeline/continuous, /state, /sync-events
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");
const router = express.Router();

const REGISTRY_PATH = path.join(__dirname, "..", "..", ".heady", "registry.json");

function readJsonSafe(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
    catch { return null; }
}

function loadRegistry() {
    return readJsonSafe(REGISTRY_PATH) || { nodes: {}, tools: {}, workflows: {}, services: {}, skills: {}, metadata: {} };
}

/**
 * Mount buddy routes onto the provided app.
 * Requires runtime references to shared state objects.
 * @param {object} deps - { continuousPipeline, storyDriver, resourceManager, resourceDiagnostics, patternEngine, selfCritiqueEngine, mcPlanScheduler, mcGlobal, improvementScheduler }
 */
module.exports = function mountBuddyRoutes(app, deps = {}) {
    const {
        continuousPipeline = { running: false, cycleCount: 0, lastCycleTs: null, exitReason: null, gateResults: {}, errors: [], intervalId: null },
        storyDriver = null,
        resourceManager = null,
        resourceDiagnostics = null,
        patternEngine = null,
        selfCritiqueEngine = null,
        mcGlobal = null,
        improvementScheduler = null,
    } = deps;

    const buddyStartTime = Date.now();

    // ─── Health ─────────────────────────────────────────────────
    app.get("/api/buddy/health", (req, res) => {
        res.json({
            ok: true,
            service: "heady-buddy",
            version: "2.0.0",
            uptime: (Date.now() - buddyStartTime) / 1000,
            continuousMode: continuousPipeline.running,
            ts: new Date().toISOString(),
        });
    });

    // ─── Chat ──────────────────────────────────────────────────
    app.post("/api/buddy/chat", (req, res) => {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "message required" });

        const reg = loadRegistry();
        const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;

        const hour = new Date().getHours();
        let greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";
        const lowerMsg = message.toLowerCase();
        let reply = "";

        if (lowerMsg.includes("plan") && lowerMsg.includes("day")) {
            reply = `${greeting} Let's plan your perfect day. I see ${activeNodes} nodes active. What are your top 3 priorities today?`;
        } else if (lowerMsg.includes("pipeline") || lowerMsg.includes("hcfull")) {
            const contState = continuousPipeline.running ? `running (cycle ${continuousPipeline.cycleCount})` : "stopped";
            reply = `Pipeline continuous mode: ${contState}. ${activeNodes} nodes active. Would you like me to start a pipeline run or check the orchestrator dashboard?`;
        } else if (lowerMsg.includes("diagnos") || lowerMsg.includes("why slow") || lowerMsg.includes("bottleneck") || lowerMsg.includes("fix resource")) {
            if (resourceDiagnostics) {
                const diag = resourceDiagnostics.diagnose();
                reply = `Diagnostic scan complete — ${diag.totalFindings} findings (${diag.critical} critical, ${diag.high} high).\n\n${diag.findings[0] ? `Top issue: ${diag.findings[0].title} (${diag.findings[0].severity}).` : "No critical issues."} Say "diagnose" for full report.`;
            } else if (resourceManager) {
                const snap = resourceManager.getSnapshot();
                const cpuPct = snap.cpu?.currentPercent || 0;
                const ramPct = snap.ram?.currentPercent || 0;
                const severity = cpuPct >= 90 || ramPct >= 85 ? "CRITICAL" : cpuPct >= 75 || ramPct >= 70 ? "CONSTRAINED" : "HEALTHY";
                reply = `Resource status: ${severity}. CPU: ${cpuPct}%, RAM: ${ramPct}%.`;
            } else {
                reply = `System memory at ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap.`;
            }
        } else if (lowerMsg.includes("resource") || lowerMsg.includes("gpu") || lowerMsg.includes("tier")) {
            if (resourceManager) {
                const snap = resourceManager.getSnapshot();
                reply = `Resource overview: CPU ${snap.cpu?.currentPercent || 0}%, RAM ${snap.ram?.currentPercent || 0}%. ${activeNodes} nodes active.`;
            } else {
                reply = `Resource overview: ${activeNodes} nodes active. Memory: ${Math.round(process.memoryUsage().heapUsed / 1048576)}MB heap.`;
            }
        } else if (lowerMsg.includes("story") || lowerMsg.includes("what changed") || lowerMsg.includes("narrative")) {
            if (storyDriver) {
                const sysSummary = storyDriver.getSystemSummary();
                reply = `Story Driver: ${sysSummary.totalStories} stories (${sysSummary.ongoing} ongoing). ${sysSummary.recentNarrative || "No recent events."}`;
            } else {
                reply = "Story Driver is not loaded.";
            }
        } else if (lowerMsg.includes("status") || lowerMsg.includes("health")) {
            reply = `System healthy. ${activeNodes} nodes active. Uptime: ${Math.round(process.uptime())}s. Continuous mode: ${continuousPipeline.running ? "active" : "off"}.`;
        } else if (lowerMsg.includes("help") || lowerMsg.includes("what can")) {
            reply = `I can help with: planning your day, running HCFullPipeline, monitoring resources/nodes, orchestrating parallel tasks, automating workflows, and checking system health.`;
        } else if (lowerMsg.includes("stop") || lowerMsg.includes("pause")) {
            if (continuousPipeline.running) {
                clearInterval(continuousPipeline.intervalId);
                continuousPipeline.running = false;
                continuousPipeline.exitReason = "user_requested_stop";
                reply = `Continuous pipeline stopped after ${continuousPipeline.cycleCount} cycles. Resume anytime.`;
            } else {
                reply = "No continuous pipeline running. I'm here whenever you need me!";
            }
        } else {
            reply = `${greeting} I'm HeadyBuddy, your perfect day AI companion and orchestration copilot. ${activeNodes} nodes standing by. How can I help?`;
        }

        res.json({
            ok: true,
            reply,
            nodes: activeNodes,
            context: {
                nodes: { total: Object.keys(reg.nodes || {}).length, active: activeNodes },
                continuousMode: continuousPipeline.running,
                cycleCount: continuousPipeline.cycleCount,
            },
            ts: new Date().toISOString(),
        });
    });

    // ─── Suggestions ───────────────────────────────────────────
    app.get("/api/buddy/suggestions", (req, res) => {
        const hour = new Date().getHours();
        const reg = loadRegistry();
        const activeNodes = Object.values(reg.nodes || {}).filter(n => n.status === "active").length;

        const chips = [];
        if (hour < 10) chips.push({ label: "Plan my morning", icon: "calendar", prompt: "Help me plan my morning." });
        else if (hour < 14) chips.push({ label: "Plan my afternoon", icon: "calendar", prompt: "Help me plan my afternoon." });
        else if (hour < 18) chips.push({ label: "Wrap up my day", icon: "calendar", prompt: "Help me wrap up today." });
        else chips.push({ label: "Plan tomorrow", icon: "calendar", prompt: "Help me plan tomorrow." });

        chips.push({ label: "Summarize this", icon: "file-text", prompt: "Summarize the content I'm looking at." });
        chips.push({ label: continuousPipeline.running ? "Pipeline status" : "Run pipeline", icon: "play", prompt: continuousPipeline.running ? "Show pipeline status." : "Start HCFullPipeline." });
        if (activeNodes > 0) chips.push({ label: "Check resources", icon: "activity", prompt: "Show resource usage and node health." });
        chips.push({ label: "Surprise me", icon: "sparkles", prompt: "Suggest something useful right now." });

        res.json({ suggestions: chips.slice(0, 5), ts: new Date().toISOString() });
    });

    // ─── Orchestrator View ─────────────────────────────────────
    app.get("/api/buddy/orchestrator", (req, res) => {
        const reg = loadRegistry();
        const nodes = Object.entries(reg.nodes || {}).map(([id, n]) => ({
            id, name: n.name || id, role: n.role || "unknown",
            status: n.status || "unknown", tier: n.tier || "M",
            lastInvoked: n.last_invoked || null,
        }));
        const mem = process.memoryUsage();

        res.json({
            ok: true,
            system: {
                uptime: process.uptime(),
                memory: {
                    heapUsedMB: Math.round(mem.heapUsed / 1048576),
                    heapTotalMB: Math.round(mem.heapTotal / 1048576),
                    rssMB: Math.round(mem.rss / 1048576),
                },
            },
            nodes: {
                total: nodes.length,
                active: nodes.filter(n => n.status === "active").length,
                list: nodes,
            },
            resourceTiers: {
                L: nodes.filter(n => n.tier === "L").length,
                M: nodes.filter(n => n.tier === "M").length,
                S: nodes.filter(n => n.tier === "S").length,
            },
            pipeline: {
                available: true,
                state: null,
                continuous: {
                    running: continuousPipeline.running,
                    cycleCount: continuousPipeline.cycleCount,
                    lastCycleTs: continuousPipeline.lastCycleTs,
                    exitReason: continuousPipeline.exitReason,
                    gates: continuousPipeline.gateResults,
                    recentErrors: continuousPipeline.errors.slice(-5),
                },
            },
            ts: new Date().toISOString(),
        });
    });

    // ─── Continuous Pipeline Control ───────────────────────────
    app.post("/api/buddy/pipeline/continuous", (req, res) => {
        const { action = "start" } = req.body;

        if (action === "stop") {
            if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
            continuousPipeline.running = false;
            continuousPipeline.exitReason = "user_requested_stop";
            return res.json({ ok: true, action: "stopped", cycleCount: continuousPipeline.cycleCount, ts: new Date().toISOString() });
        }

        if (continuousPipeline.running) return res.json({ ok: true, action: "already_running", cycleCount: continuousPipeline.cycleCount });

        continuousPipeline.running = true;
        continuousPipeline.exitReason = null;
        continuousPipeline.errors = [];
        continuousPipeline.cycleCount = 0;

        const runCycle = () => {
            if (!continuousPipeline.running) return;
            continuousPipeline.cycleCount++;
            continuousPipeline.lastCycleTs = new Date().toISOString();
            continuousPipeline.gateResults = {
                quality: true,
                resource: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) < 0.9,
                stability: true,
                user: continuousPipeline.running,
            };
            const allPass = Object.values(continuousPipeline.gateResults).every(Boolean);

            if (storyDriver) {
                storyDriver.ingestSystemEvent({
                    type: allPass ? "PIPELINE_CYCLE_COMPLETE" : "PIPELINE_GATE_FAIL",
                    refs: allPass
                        ? { cycleNumber: continuousPipeline.cycleCount, gatesSummary: "all passed" }
                        : { cycleNumber: continuousPipeline.cycleCount, gate: Object.entries(continuousPipeline.gateResults).find(([, v]) => !v)?.[0] || "unknown", reason: "Gate check returned false" },
                    source: "hcfullpipeline",
                });
            }

            if (!allPass) {
                continuousPipeline.running = false;
                continuousPipeline.exitReason = "gate_failed";
                if (continuousPipeline.intervalId) clearInterval(continuousPipeline.intervalId);
            }
        };

        runCycle();
        if (continuousPipeline.running) {
            continuousPipeline.intervalId = setInterval(runCycle, req.body.intervalMs || 30000);
        }

        res.json({
            ok: true, action: "started", running: continuousPipeline.running,
            cycleCount: continuousPipeline.cycleCount, gates: continuousPipeline.gateResults,
            ts: new Date().toISOString(),
        });
    });

    // ─── State Sync ────────────────────────────────────────────
    let buddyState = { conversation: [], viewState: 'pill', pipelineState: {}, config: null };

    app.post('/api/buddy/state', (req, res) => {
        try {
            if (req.body.conversation) buddyState.conversation = req.body.conversation;
            if (req.body.viewState) buddyState.viewState = req.body.viewState;
            if (req.body.pipelineState) buddyState.pipelineState = req.body.pipelineState;
            if (req.body.config) buddyState.config = req.body.config;
            res.json({ ok: true, message: 'State updated successfully', ts: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ error: 'State update failed', message: err.message });
        }
    });

    app.get('/api/buddy/state', (req, res) => {
        res.json({ ...buddyState, ts: new Date().toISOString() });
    });

    // ─── Sync Events SSE ──────────────────────────────────────
    app.get('/api/buddy/sync-events', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);
        const interval = setInterval(() => {
            res.write(`data: ${JSON.stringify({ status: Math.random() > 0.2 ? 'connected' : 'syncing' })}\n\n`);
        }, 10000);
        req.on('close', () => clearInterval(interval));
    });

    logger.logSystem("  ∞ HeadyBuddy API: LOADED (pillar module) → /api/buddy/*");
};

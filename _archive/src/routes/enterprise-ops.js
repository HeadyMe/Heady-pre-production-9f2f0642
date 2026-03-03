/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const SWARM_NUDGE_PATH = path.join(__dirname, "..", "..", "data", "swarm-nudges.json");

function appendSwarmNudges(entries) {
    let nudges = [];
    try {
        if (fs.existsSync(SWARM_NUDGE_PATH)) {
            nudges = JSON.parse(fs.readFileSync(SWARM_NUDGE_PATH, "utf8"));
        }
        if (!Array.isArray(nudges)) nudges = [];
    } catch {
        nudges = [];
    }

    nudges.push(...entries);
    fs.writeFileSync(SWARM_NUDGE_PATH, JSON.stringify(nudges.slice(-2000), null, 2));
}

module.exports = function createEnterpriseOpsRouter(deps = {}) {
    const router = express.Router();

    const {
        orchestrator = null,
        engines = {},
        midiBus = null,
        policyEngine = null,
        approvalGates = null,
    } = deps;

    function snapshot() {
        const orchestratorStats = orchestrator && typeof orchestrator.getStats === "function"
            ? orchestrator.getStats()
            : null;
        const autoSuccess = engines.autoSuccessEngine && typeof engines.autoSuccessEngine.getStatus === "function"
            ? engines.autoSuccessEngine.getStatus()
            : null;
        const realtime = engines.realtimeIntelligenceEngine && typeof engines.realtimeIntelligenceEngine.getStatus === "function"
            ? engines.realtimeIntelligenceEngine.getStatus()
            : null;

        const governance = {
            policyEngine: policyEngine && typeof policyEngine.status === "function" ? policyEngine.status() : null,
            approvalPending: approvalGates && typeof approvalGates.getPending === "function" ? approvalGates.getPending().length : null,
        };

        const score = Math.max(
            0,
            1
            - Math.min(0.4, (orchestratorStats?.queueDepth || 0) / 150)
            - Math.min(0.2, (orchestratorStats?.failedTasks || 0) / 100)
            - Math.min(0.2, (realtime?.queueDepth || 0) / 500)
            - Math.min(0.2, (governance.approvalPending || 0) / 50)
        );

        return {
            ts: new Date().toISOString(),
            readinessScore: Number(score.toFixed(3)),
            productionLive: score >= 0.85,
            orchestrator: orchestratorStats,
            autoSuccess,
            realtime,
            governance,
        };
    }

    router.get("/status", (req, res) => {
        res.json({ ok: true, ...snapshot() });
    });

    router.post("/activate-full-throttle", async (req, res) => {
        const actions = [];

        if (engines.autoSuccessEngine && typeof engines.autoSuccessEngine.start === "function") {
            try {
                engines.autoSuccessEngine.start();
                actions.push({ action: "auto-success:start", ok: true });
            } catch (error) {
                actions.push({ action: "auto-success:start", ok: false, error: error.message });
            }
        }

        if (engines.realtimeIntelligenceEngine && typeof engines.realtimeIntelligenceEngine.start === "function") {
            try {
                engines.realtimeIntelligenceEngine.start();
                actions.push({ action: "realtime-intelligence:start", ok: true });
            } catch (error) {
                actions.push({ action: "realtime-intelligence:start", ok: false, error: error.message });
            }
        }

        if (orchestrator && typeof orchestrator.scaleUp === "function") {
            const groups = ["swarm", "intelligence", "ops", "reasoning"];
            for (const group of groups) {
                const spawned = orchestrator.scaleUp(group, 2);
                actions.push({ action: "orchestrator:scale-up", group, spawned: spawned.length });
            }
        }

        const nudges = [
            { id: `nudge-${Date.now()}-swarm`, priority: "critical", task: "Enable HeadySwarm + HeadyBees full-throttle auto-flow", createdAt: new Date().toISOString() },
            { id: `nudge-${Date.now()}-memory`, priority: "high", task: "Prioritize 3D vector persistence for all high-value task outputs", createdAt: new Date().toISOString() },
            { id: `nudge-${Date.now()}-governance`, priority: "high", task: "Run governance gates and policy checks continuously for production safety", createdAt: new Date().toISOString() },
        ];
        appendSwarmNudges(nudges);
        actions.push({ action: "swarm:nudge", count: nudges.length });

        if (midiBus && typeof midiBus.sysex === "function") {
            midiBus.sysex(0x77, 0x7f, { event: "enterprise-full-throttle" });
            actions.push({ action: "midi:sysex", ok: true });
        }

        return res.json({ ok: true, actions, status: snapshot() });
    });

    router.post("/task-blast", async (req, res) => {
        const { tasks = [], priority = "high", persistContext = true } = req.body || {};
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ ok: false, error: "tasks array is required" });
        }

        const work = tasks.slice(0, 200).map((task, i) => ({
            action: task.action || "analyze",
            payload: {
                ...task.payload,
                source: "enterprise-task-blast",
                priority,
                idx: i,
            },
        }));

        let results = [];
        if (orchestrator && typeof orchestrator.parallel === "function") {
            results = await orchestrator.parallel(work);
        } else if (orchestrator && typeof orchestrator.submit === "function") {
            results = await Promise.all(work.map((w) => orchestrator.submit(w)));
        } else {
            results = work.map((w) => ({ ok: true, action: w.action, payload: w.payload, note: "No orchestrator available" }));
        }

        if (persistContext && engines.realtimeIntelligenceEngine && typeof engines.realtimeIntelligenceEngine.ingestExternalEvent === "function") {
            engines.realtimeIntelligenceEngine.ingestExternalEvent({
                source: "enterprise-task-blast",
                eventType: "task-blast",
                status: 0x90,
                channel: 0,
                data1: Math.min(127, work.length),
                data2: Math.min(127, results.length),
                metadata: { priority },
            }, { highPriority: true });
        }

        res.json({ ok: true, submitted: work.length, completed: results.length, priority, results: results.slice(0, 100) });
    });

    return router;
};

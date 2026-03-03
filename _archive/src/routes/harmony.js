/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */

const express = require("express");

module.exports = function createHarmonyRouter(deps = {}) {
    const router = express.Router();
    const {
        orchestrator = null,
        engines = {},
        authEngine = null,
        midiBus = null,
    } = deps;

    function buildSnapshot() {
        const orchStats = orchestrator && typeof orchestrator.getStats === "function"
            ? orchestrator.getStats()
            : null;
        const realtimeStatus = engines.realtimeIntelligenceEngine && typeof engines.realtimeIntelligenceEngine.getStatus === "function"
            ? engines.realtimeIntelligenceEngine.getStatus()
            : null;
        const autoSuccessStatus = engines.autoSuccessEngine && typeof engines.autoSuccessEngine.getStatus === "function"
            ? engines.autoSuccessEngine.getStatus()
            : null;
        const authStatus = authEngine && typeof authEngine.getStatus === "function"
            ? authEngine.getStatus()
            : null;
        const midiMetrics = midiBus && typeof midiBus.getMetrics === "function"
            ? midiBus.getMetrics()
            : null;

        const pressures = {
            queuePressure: orchStats?.queueDepth || 0,
            failedTasks: orchStats?.failedTasks || 0,
            realtimeQueueDepth: realtimeStatus?.queueDepth || 0,
            realtimeTransportFailures: realtimeStatus?.metrics?.transportFailed || 0,
        };

        const harmonyScore = Math.max(
            0,
            1
            - Math.min(0.4, pressures.queuePressure / 100)
            - Math.min(0.3, pressures.failedTasks / 100)
            - Math.min(0.2, pressures.realtimeQueueDepth / 500)
            - Math.min(0.1, pressures.realtimeTransportFailures / 100)
        );

        return {
            ts: new Date().toISOString(),
            harmonyScore: Number(harmonyScore.toFixed(3)),
            status: harmonyScore > 0.85 ? "harmonious" : harmonyScore > 0.65 ? "stable" : "degraded",
            pressures,
            orchestrator: orchStats,
            realtime: realtimeStatus,
            autoSuccess: autoSuccessStatus,
            auth: authStatus,
            midi: midiMetrics,
        };
    }

    router.get("/status", (req, res) => {
        res.json({ ok: true, ...buildSnapshot() });
    });

    router.post("/rebalance", (req, res) => {
        const before = buildSnapshot();
        const actions = [];

        if (orchestrator && before.pressures.queuePressure > 3) {
            const spawned = orchestrator.scaleUp("ops", Math.min(3, before.pressures.queuePressure));
            actions.push({ type: "scale_up", group: "ops", count: spawned.length });
        }

        if (engines.realtimeIntelligenceEngine && before.pressures.realtimeQueueDepth > 0) {
            engines.realtimeIntelligenceEngine.flush().catch(() => { });
            actions.push({ type: "flush", target: "realtime-intelligence" });
        }

        if (engines.autoSuccessEngine && typeof engines.autoSuccessEngine.forceCycle === "function") {
            engines.autoSuccessEngine.forceCycle().catch(() => { });
            actions.push({ type: "force-cycle", target: "auto-success" });
        }

        if (midiBus) {
            midiBus.sysex(0x4a, Math.min(127, Math.round(before.harmonyScore * 127)), {
                event: "harmony-rebalance",
                score: before.harmonyScore,
            });
            actions.push({ type: "midi_sysex", target: "global-broadcast" });
        }

        const after = buildSnapshot();
        res.json({ ok: true, actions, before, after });
    });

    return router;
};

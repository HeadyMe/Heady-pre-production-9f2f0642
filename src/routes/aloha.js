/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * Aloha Protocol Routes — Extracted from heady-manager.js (HeadySupervisor Decomposition)
 * Handles: /api/aloha/status, /protocol, /de-optimization, /stability, /priorities,
 *          /checklist, /crash-report, /de-opt-check, /web-baseline
 */
const fs = require("fs");
const yaml = require("js-yaml");
const logger = require("../utils/logger");

module.exports = function mountAlohaRoutes(app, deps = {}) {
    const {
        selfCritiqueEngine = null,
        storyDriver = null,
        resourceManager = null,
        continuousPipeline = {},
        mcGlobal = null,
        improvementScheduler = null,
        patternEngine = null,
    } = deps;

    // Load protocol configs
    let alohaProtocol = null, deOptProtocol = null, stabilityFirst = null;
    try { alohaProtocol = yaml.load(fs.readFileSync('./configs/aloha-protocol.yaml', 'utf8')); } catch { }
    try { deOptProtocol = yaml.load(fs.readFileSync('./configs/de-optimization-protocol.yaml', 'utf8')); } catch { }
    try { stabilityFirst = yaml.load(fs.readFileSync('./configs/stability-first.yaml', 'utf8')); } catch { }

    const alohaState = {
        mode: "aloha",
        activeSince: new Date().toISOString(),
        protocols: { aloha: !!alohaProtocol, deOptimization: !!deOptProtocol, stabilityFirst: !!stabilityFirst },
        stabilityDiagnosticMode: false,
        crashReports: [],
        deOptChecks: 0,
    };

    // Expose alohaState for pulse endpoint
    app.locals.alohaState = alohaState;

    if (alohaProtocol) logger.logSystem("  ∞ Aloha Protocol: LOADED (always-on)");
    if (deOptProtocol) logger.logSystem("  ∞ De-Optimization Protocol: LOADED (simplicity > speed)");
    if (stabilityFirst) logger.logSystem("  ∞ Stability First: LOADED (the canoe must not sink)");

    app.get("/api/aloha/status", (req, res) => {
        res.json({
            ok: true, mode: alohaState.mode, activeSince: alohaState.activeSince,
            protocols: alohaState.protocols, stabilityDiagnosticMode: alohaState.stabilityDiagnosticMode,
            crashReportCount: alohaState.crashReports.length, deOptChecksRun: alohaState.deOptChecks,
            priorities: alohaProtocol ? alohaProtocol.priorities : null, ts: new Date().toISOString(),
        });
    });

    app.get("/api/aloha/protocol", (req, res) => {
        if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
        res.json({ ok: true, ...alohaProtocol, ts: new Date().toISOString() });
    });

    app.get("/api/aloha/de-optimization", (req, res) => {
        if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
        res.json({ ok: true, ...deOptProtocol, ts: new Date().toISOString() });
    });

    app.get("/api/aloha/stability", (req, res) => {
        if (!stabilityFirst) return res.status(404).json({ error: "Stability first protocol not found" });
        res.json({ ok: true, ...stabilityFirst, ts: new Date().toISOString() });
    });

    app.get("/api/aloha/priorities", (req, res) => {
        if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
        res.json({ ok: true, priorities: alohaProtocol.priorities, no_assist: alohaProtocol.no_assist, web_baseline: alohaProtocol.web_baseline, ts: new Date().toISOString() });
    });

    app.get("/api/aloha/checklist", (req, res) => {
        if (!deOptProtocol) return res.status(404).json({ error: "De-optimization protocol not found" });
        res.json({ ok: true, checklist: deOptProtocol.checklist, code_rules: deOptProtocol.code_generation, arch_rules: deOptProtocol.architecture_suggestions, prompt_rules: deOptProtocol.prompt_and_workflow, ts: new Date().toISOString() });
    });

    app.post("/api/aloha/crash-report", (req, res) => {
        const { description, context, severity } = req.body;
        const report = {
            id: `crash-${Date.now()}`,
            description: description || "IDE/system crash reported",
            context: context || "unknown",
            severity: severity || "high",
            ts: new Date().toISOString(),
        };
        alohaState.crashReports.push(report);
        alohaState.stabilityDiagnosticMode = true;

        if (selfCritiqueEngine) {
            selfCritiqueEngine.recordCritique({
                context: "stability:crash", weaknesses: [`System crash: ${report.description}`],
                severity: "critical", suggestedImprovements: ["Enter Stability Diagnostic Mode", "Reduce local resource usage"],
            });
        }

        if (storyDriver) {
            storyDriver.ingestSystemEvent({ type: "STABILITY_CRASH_REPORTED", refs: { crashId: report.id, description: report.description }, source: "aloha_protocol" });
        }

        logger.logError('HCFP', `CRASH REPORT ${report.id}: ${report.description}`, report.severity);
        const recentCrashes = alohaState.crashReports.filter(r => new Date(r.ts) > new Date(Date.now() - 3600000));

        let emergencyActivated = false;
        if (recentCrashes.length >= 3) {
            alohaState.mode = "emergency_stability";
            emergencyActivated = true;
            logger.logError('HCFP', 'Emergency stability mode activated - multiple crashes detected', new Error('crash_threshold'));

            if (resourceManager && !resourceManager.safeMode) {
                try { resourceManager.enterSafeMode("aloha_crash_threshold"); } catch { }
            }
            if (continuousPipeline.running) {
                continuousPipeline.running = false;
                continuousPipeline.exitReason = "aloha_emergency_stability";
                if (continuousPipeline.intervalId) { clearInterval(continuousPipeline.intervalId); continuousPipeline.intervalId = null; }
                if (storyDriver) {
                    storyDriver.ingestSystemEvent({ type: "PIPELINE_EMERGENCY_SHUTDOWN", refs: { reason: "aloha_emergency_stability", crashCount: recentCrashes.length }, source: "aloha_protocol" });
                }
            }
            if (mcGlobal && typeof mcGlobal.stopAutoRun === 'function') { try { mcGlobal.stopAutoRun(); } catch { } }
            if (improvementScheduler && typeof improvementScheduler.pause === 'function') { try { improvementScheduler.pause(); } catch { } }
            if (patternEngine && typeof patternEngine.pause === 'function') { try { patternEngine.pause(); } catch { } }
        }

        res.json({
            ok: true, report, diagnosticMode: true, emergencyMode: emergencyActivated,
            recentCrashCount: recentCrashes.length,
            checklist: stabilityFirst?.crash_response?.diagnostic_mode?.checks || [],
            message: emergencyActivated ? "Emergency stability mode activated. All non-essential services paused." : "Stability Diagnostic Mode activated. Follow the checklist.",
        });
    });

    app.post("/api/aloha/de-opt-check", (req, res) => {
        const { suggestion, context } = req.body;
        alohaState.deOptChecks++;
        res.json({
            ok: true, checkNumber: alohaState.deOptChecks, suggestion: suggestion || "unnamed",
            context: context || "general", questions: deOptProtocol ? deOptProtocol.checklist.steps : [],
            recommendation: "Prefer the simpler alternative unless measured need exists", ts: new Date().toISOString(),
        });
    });

    app.get("/api/aloha/web-baseline", (req, res) => {
        if (!alohaProtocol) return res.status(404).json({ error: "Aloha protocol not found" });
        res.json({ ok: true, non_negotiable: true, requirements: alohaProtocol.web_baseline, message: "Websites must be fully functional as baseline.", ts: new Date().toISOString() });
    });
};

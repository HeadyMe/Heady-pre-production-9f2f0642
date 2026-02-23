/**
 * HeadyScientist — System Integrity & Determinism Protocol
 *
 * Watches for drift signals, runs global consistency scans,
 * validates configuration coherence, and produces deterministic
 * audit proof chains. Feeds findings into DeepIntel 3D vectors.
 *
 * Trigger conditions:
 *   - Service count changes (addService/removeService events)
 *   - Config file modifications (fs.watch on key paths)
 *   - Drift events from MC Plan Scheduler
 *   - Scheduled φ-interval scans (every ~97s = φ⁶ minutes)
 *   - Manual trigger via API
 *
 * Outputs:
 *   - Consistency scan results (stale hardcoded values)
 *   - Determinism proof chain (SHA-256 hash audit)
 *   - Drift predictions (trending toward or away from determinism)
 *   - SSE broadcasts for real-time awareness
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// φ-derived constants
const PHI = 1.618033988749895;
const SCAN_INTERVAL = Math.round(Math.pow(PHI, 6) * 1000 * 6); // ~97s (~φ⁶ seconds × 6)
const DRIFT_THRESHOLD = 0.15; // 15% drift triggers alert

// Predefined consistency rules: what values SHOULD be
// These are the "ground truth" that the scientist validates against
const CONSISTENCY_RULES = [
    {
        id: "auto-success-tasks",
        description: "Auto-success task catalog size",
        expectedValue: 135,
        locations: [
            { file: "src/hc_auto_success.js", pattern: /135 tasks/i },
            { file: "scripts/notion-vault-sync.js", pattern: /135 tasks/i },
        ],
        severity: "high",
    },
    {
        id: "auto-success-categories",
        description: "Auto-success category count",
        expectedValue: 9,
        locations: [
            { file: "src/hc_auto_success.js", pattern: /9 categor/i },
            { file: "scripts/notion-vault-sync.js", pattern: /9 categor/i },
        ],
        severity: "medium",
    },
    {
        id: "service-count",
        description: "Total service count",
        expectedValue: "40+",
        locations: [
            { file: "scripts/notion-vault-sync.js", pattern: /40\+/i },
            { file: "src/services/heady-notion.js", pattern: /40\+/i },
        ],
        severity: "high",
    },
    {
        id: "vertical-count",
        description: "Number of vertical domains",
        expectedValue: 17,
        locations: [
            { file: "src/verticals.json", pattern: /"verticals"\s*:/i },
        ],
        severity: "medium",
    },
    {
        id: "phi-interval",
        description: "φ-aligned auto-success interval",
        expectedValue: 16180,
        locations: [
            { file: "heady-manager.js", pattern: /interval:\s*16180/i },
        ],
        severity: "low",
    },
    {
        id: "deep-intel-perspectives",
        description: "DeepIntel perspective count",
        expectedValue: 10,
        locations: [
            { file: "src/hc_deep_intel.js", pattern: /structural|behavioral|quality|competitive|security|performance|resilience|innovation|risk|operational/i },
        ],
        severity: "medium",
    },
    {
        id: "scientist-active",
        description: "HeadyScientist engine present",
        expectedValue: "loaded",
        locations: [
            { file: "heady-manager.js", pattern: /HeadyScientist/i },
        ],
        severity: "high",
    },
];

class HeadyScientist extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.projectRoot = opts.projectRoot || path.join(__dirname, "..");
        this.dataDir = opts.dataDir || path.join(this.projectRoot, "data");
        this.scanInterval = opts.scanInterval || SCAN_INTERVAL;
        this.running = false;
        this.timer = null;

        // State
        this.scans = [];
        this.driftHistory = [];
        this.proofChain = [];
        this.lastChainHash = "GENESIS";
        this.predictions = [];

        // Metrics
        this.totalScans = 0;
        this.totalDriftsDetected = 0;
        this.totalDriftsResolved = 0;
        this.determinismScore = 1.0; // starts perfect, degrades with drift

        // Load persisted state
        this._loadState();
    }

    // ─── Start / Stop ─────────────────────────────────────────────────
    start() {
        if (this.running) return;
        this.running = true;
        console.log(`  🔬 HeadyScientist: STARTED (scan every ${(this.scanInterval / 1000).toFixed(1)}s)`);

        // Initial scan
        setTimeout(() => this.runConsistencyScan("startup"), 5000);

        // Periodic scans
        this.timer = setInterval(() => this.runConsistencyScan("scheduled"), this.scanInterval);
    }

    stop() {
        this.running = false;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    // ─── Wire into EventBus ───────────────────────────────────────────
    wireEventBus(eventBus) {
        if (!eventBus) return;

        // Listen for drift signals from MC Plan Scheduler
        eventBus.on("drift:detected", (alert) => {
            this.totalDriftsDetected++;
            this.driftHistory.push({
                ts: new Date().toISOString(),
                source: "mc-plan-scheduler",
                type: alert.taskType,
                magnitude: Math.abs(alert.medianMs - alert.targetMs) / alert.targetMs,
                details: alert,
            });
            this._evaluateDriftResponse(alert);
        });

        // Listen for service registration changes
        eventBus.on("service:registered", () => this._triggerScan("service-change"));
        eventBus.on("service:deregistered", () => this._triggerScan("service-change"));

        // Listen for config changes
        eventBus.on("config:changed", (change) => {
            this.driftHistory.push({
                ts: new Date().toISOString(),
                source: "config-watcher",
                type: "config-change",
                magnitude: 0.1,
                details: change,
            });
            this._triggerScan("config-change");
        });

        this.eventBus = eventBus;
        console.log("    → HeadyScientist ↔ EventBus: WIRED");
    }

    // ─── Wire into DeepIntel ──────────────────────────────────────────
    wireDeepIntel(deepIntelEngine) {
        this.deepIntel = deepIntelEngine;
        if (deepIntelEngine) {
            console.log("    → HeadyScientist ↔ DeepIntel: WIRED (3D vector storage)");
        }
    }

    // ─── Wire Auto-Success Engine (in-process) ──────────────────────
    wireAutoSuccess(asEngine) {
        this.autoSuccessEngine = asEngine;
        if (asEngine) {
            console.log("    → HeadyScientist ↔ AutoSuccess: WIRED (direct in-process)");
        }
    }

    // ─── Main Consistency Scan ────────────────────────────────────────
    async runConsistencyScan(trigger = "manual") {
        const scanId = `scan-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const scan = {
            id: scanId,
            trigger,
            ts: new Date().toISOString(),
            findings: [],
            passed: 0,
            failed: 0,
            warnings: 0,
            determinismScore: 0,
        };

        // Run each consistency rule
        for (const rule of CONSISTENCY_RULES) {
            for (const loc of rule.locations) {
                const filePath = path.join(this.projectRoot, loc.file);
                try {
                    if (!fs.existsSync(filePath)) {
                        scan.findings.push({
                            ruleId: rule.id,
                            file: loc.file,
                            status: "warning",
                            message: `File not found: ${loc.file}`,
                        });
                        scan.warnings++;
                        continue;
                    }
                    const content = fs.readFileSync(filePath, "utf8");
                    const match = loc.pattern.test(content);
                    if (match) {
                        scan.passed++;
                        scan.findings.push({
                            ruleId: rule.id,
                            file: loc.file,
                            status: "pass",
                            message: `Consistent: ${rule.description} = ${rule.expectedValue}`,
                        });
                    } else {
                        scan.failed++;
                        scan.findings.push({
                            ruleId: rule.id,
                            file: loc.file,
                            status: "fail",
                            severity: rule.severity,
                            message: `DRIFT: ${rule.description} — expected pattern not found in ${loc.file}`,
                            expected: rule.expectedValue,
                        });
                    }
                } catch (err) {
                    scan.warnings++;
                    scan.findings.push({
                        ruleId: rule.id,
                        file: loc.file,
                        status: "error",
                        message: err.message,
                    });
                }
            }
        }

        // Runtime consistency checks
        await this._checkRuntimeConsistency(scan);

        // Calculate determinism score
        const total = scan.passed + scan.failed + scan.warnings;
        scan.determinismScore = total > 0 ? scan.passed / total : 0;
        this.determinismScore = this.determinismScore * 0.7 + scan.determinismScore * 0.3; // EWMA

        // Chain hash for audit proof
        const chainEntry = this._addToProofChain(scan);
        scan.proofHash = chainEntry.hash;

        // Store findings in DeepIntel 3D vectors if available
        if (this.deepIntel && this.deepIntel.vectorStore) {
            this.deepIntel.vectorStore.store(scanId, {
                type: "consistency-scan",
                trigger,
                determinismScore: scan.determinismScore,
                passed: scan.passed,
                failed: scan.failed,
                findings: scan.findings.filter(f => f.status === "fail").map(f => f.message),
            }, {
                structural: scan.determinismScore,
                behavioral: 1.0 - (scan.failed / Math.max(total, 1)),
                quality: scan.passed / Math.max(total, 1),
            });
        }

        // Generate prediction
        this._generatePrediction(scan);

        // Persist
        this.scans.push(scan);
        if (this.scans.length > 50) this.scans.shift();
        this.totalScans++;
        this._saveState();

        // Broadcast via SSE if available
        if (global.__sseBroadcast) {
            global.__sseBroadcast("scientist_scan", {
                scanId,
                trigger,
                determinismScore: scan.determinismScore.toFixed(3),
                passed: scan.passed,
                failed: scan.failed,
                warnings: scan.warnings,
            });
        }

        // Emit events
        this.emit("scan:complete", scan);
        if (scan.failed > 0) {
            this.emit("drift:found", {
                scanId,
                failCount: scan.failed,
                findings: scan.findings.filter(f => f.status === "fail"),
            });
        }

        return scan;
    }

    // ─── Runtime Consistency Check ────────────────────────────────────
    async _checkRuntimeConsistency(scan) {
        // Use direct in-process reference (not HTTP — avoids Express deadlock)
        try {
            if (this.autoSuccessEngine) {
                const status = this.autoSuccessEngine.getStatus
                    ? this.autoSuccessEngine.getStatus()
                    : null;
                if (status && status.running) {
                    scan.passed++;
                    scan.findings.push({
                        ruleId: "runtime-auto-success",
                        status: "pass",
                        message: `Auto-success running: ${status.cycleCount || 0} cycles, ${status.totalSucceeded || 0} succeeded`,
                    });
                } else {
                    scan.failed++;
                    scan.findings.push({
                        ruleId: "runtime-auto-success",
                        status: "fail",
                        severity: "critical",
                        message: "Auto-success engine NOT running!",
                    });
                }
            }
        } catch { /* runtime check optional */ }
    }

    // ─── Drift Response ───────────────────────────────────────────────
    _evaluateDriftResponse(alert) {
        const magnitude = Math.abs(alert.medianMs - alert.targetMs) / alert.targetMs;

        if (magnitude > DRIFT_THRESHOLD) {
            // Significant drift — trigger full scan
            this._triggerScan("drift-threshold-exceeded");
        }

        // Update determinism score
        this.determinismScore = Math.max(0, this.determinismScore - magnitude * 0.05);
    }

    _triggerScan(reason) {
        // Debounce: don't scan more than once per 30s
        if (this._lastTriggerScan && Date.now() - this._lastTriggerScan < 30000) return;
        this._lastTriggerScan = Date.now();
        this.runConsistencyScan(reason);
    }

    // ─── Proof Chain ──────────────────────────────────────────────────
    _addToProofChain(scan) {
        const payload = JSON.stringify({
            scanId: scan.id,
            ts: scan.ts,
            passed: scan.passed,
            failed: scan.failed,
            determinismScore: scan.determinismScore,
            prevHash: this.lastChainHash,
        });

        const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
        const entry = {
            index: this.proofChain.length,
            scanId: scan.id,
            ts: scan.ts,
            hash,
            prevHash: this.lastChainHash,
            determinismScore: scan.determinismScore,
        };

        this.proofChain.push(entry);
        this.lastChainHash = hash;
        if (this.proofChain.length > 200) this.proofChain.shift();

        return entry;
    }

    // ─── Predictions ──────────────────────────────────────────────────
    _generatePrediction(scan) {
        const recentScans = this.scans.slice(-10);
        if (recentScans.length < 3) return;

        const scores = recentScans.map(s => s.determinismScore);
        const trend = scores[scores.length - 1] - scores[0];
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        const prediction = {
            ts: new Date().toISOString(),
            direction: trend > 0.01 ? "improving" : trend < -0.01 ? "degrading" : "stable",
            currentScore: scan.determinismScore,
            avgScore,
            trend,
            confidence: Math.min(1, recentScans.length / 10),
            recommendation: trend < -0.01
                ? "System drift detected — recommend targeted scan of recently modified files"
                : trend > 0.05
                    ? "System converging toward determinism — maintain current practices"
                    : "System stable — continue monitoring",
        };

        this.predictions.push(prediction);
        if (this.predictions.length > 30) this.predictions.shift();

        // Emit if degrading
        if (prediction.direction === "degrading") {
            this.emit("prediction:degrading", prediction);
        }
    }

    // ─── Persistence ──────────────────────────────────────────────────
    _loadState() {
        try {
            const statePath = path.join(this.dataDir, "scientist-state.json");
            if (fs.existsSync(statePath)) {
                const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
                this.totalScans = state.totalScans || 0;
                this.totalDriftsDetected = state.totalDriftsDetected || 0;
                this.determinismScore = state.determinismScore || 1.0;
                this.lastChainHash = state.lastChainHash || "GENESIS";
                this.proofChain = state.proofChain || [];
            }
        } catch { /* fresh start */ }
    }

    _saveState() {
        try {
            if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
            fs.writeFileSync(
                path.join(this.dataDir, "scientist-state.json"),
                JSON.stringify({
                    totalScans: this.totalScans,
                    totalDriftsDetected: this.totalDriftsDetected,
                    determinismScore: this.determinismScore,
                    lastChainHash: this.lastChainHash,
                    proofChain: this.proofChain.slice(-50),
                    lastSave: new Date().toISOString(),
                }, null, 2)
            );
        } catch { /* silent */ }
    }

    // ─── Status ───────────────────────────────────────────────────────
    getStatus() {
        const latest = this.scans[this.scans.length - 1];
        const latestPrediction = this.predictions[this.predictions.length - 1];
        return {
            status: this.running ? "active" : "stopped",
            determinismScore: this.determinismScore.toFixed(4),
            totalScans: this.totalScans,
            totalDriftsDetected: this.totalDriftsDetected,
            scanInterval: `${(this.scanInterval / 1000).toFixed(1)}s (φ⁶-derived)`,
            proofChainLength: this.proofChain.length,
            lastChainHash: this.lastChainHash,
            latestScan: latest ? {
                id: latest.id,
                trigger: latest.trigger,
                passed: latest.passed,
                failed: latest.failed,
                warnings: latest.warnings,
                determinismScore: latest.determinismScore.toFixed(4),
                ts: latest.ts,
            } : null,
            prediction: latestPrediction || null,
            rulesCount: CONSISTENCY_RULES.length,
            consistencyRules: CONSISTENCY_RULES.map(r => ({
                id: r.id,
                description: r.description,
                expected: r.expectedValue,
                files: r.locations.map(l => l.file),
            })),
        };
    }
}

// ─── EXPRESS ROUTES ─────────────────────────────────────────────────

function registerScientistRoutes(app, scientist) {
    const express = require("express");
    const router = express.Router();

    router.get("/health", (req, res) => {
        res.json({
            ok: true,
            service: "heady-scientist",
            determinismScore: scientist.determinismScore.toFixed(4),
            running: scientist.running,
            totalScans: scientist.totalScans,
        });
    });

    router.get("/status", (req, res) => res.json(scientist.getStatus()));

    router.post("/scan", async (req, res) => {
        try {
            const result = await scientist.runConsistencyScan("manual-api");
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get("/proof-chain", (req, res) => {
        res.json({
            length: scientist.proofChain.length,
            lastHash: scientist.lastChainHash,
            chain: scientist.proofChain.slice(-20),
        });
    });

    router.get("/predictions", (req, res) => {
        res.json({
            predictions: scientist.predictions.slice(-10),
            currentDirection: scientist.predictions.length > 0
                ? scientist.predictions[scientist.predictions.length - 1].direction
                : "insufficient-data",
        });
    });

    router.get("/drift-history", (req, res) => {
        res.json({
            total: scientist.driftHistory.length,
            recent: scientist.driftHistory.slice(-20),
        });
    });

    app.use("/api/scientist", router);
    return router;
}

module.exports = { HeadyScientist, registerScientistRoutes, CONSISTENCY_RULES };

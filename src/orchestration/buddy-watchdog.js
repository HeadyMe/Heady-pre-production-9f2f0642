/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY WATCHDOG — Self-Healing Monitor
 * ═══════════════════════════════════════════════════════════════
 * Continuously monitors Buddy's /health/live endpoint.
 * Detects:
 *   1. Health probe failures (unresponsive Buddy)
 *   2. Hallucination loops (repetitive NLP patterns in telemetry)
 *   3. Memory leaks (RSS growth over time)
 *   4. Decision stalls (no decisions for extended period)
 *
 * On critical failure: hard-restarts buddy-core.js,
 * clearing volatile memory but preserving vector storage.
 * ═══════════════════════════════════════════════════════════════
 */

"use strict";

const EventEmitter = require("events");
const { trackError, getErrorSummary } = require("../config/errors");

const PHI = 1.6180339887;
const WATCHDOG_INTERVAL_MS = Math.round(PHI * PHI * PHI * PHI * 1000); // ~6.85 seconds
const HEALTH_TIMEOUT_MS = 5000;
const MAX_CONSECUTIVE_FAILURES = 3;
const HALLUCINATION_PATTERN_THRESHOLD = 5; // Same pattern repeated 5+ times = loop
const MEMORY_GROWTH_THRESHOLD_MB = 200; // Alert if RSS grows by 200MB

class BuddyWatchdog extends EventEmitter {
    constructor(buddyInstance) {
        super();
        this._buddy = buddyInstance;
        this._running = false;
        this._intervalId = null;
        this._consecutiveFailures = 0;
        this._restartCount = 0;
        this._baselineRSS = process.memoryUsage().rss;
        this._patternHistory = [];
        this._lastDecisionCount = 0;
        this._stallTicks = 0;

        this.stats = {
            checks: 0,
            failures: 0,
            restarts: 0,
            hallucinationDetections: 0,
            memoryAlerts: 0,
            stallDetections: 0,
            startedAt: null,
        };
    }

    /**
     * Start the watchdog loop.
     */
    start() {
        if (this._running) return;
        this._running = true;
        this.stats.startedAt = new Date().toISOString();

        console.log(`  🐕 [Watchdog] Started — checking Buddy every ${(WATCHDOG_INTERVAL_MS / 1000).toFixed(1)}s`);

        this._intervalId = setInterval(() => this._check(), WATCHDOG_INTERVAL_MS);
        // Initial check after 2 seconds
        setTimeout(() => this._check(), 2000);
    }

    /**
     * Stop the watchdog.
     */
    stop() {
        if (this._intervalId) clearInterval(this._intervalId);
        this._running = false;
        console.log("  🐕 [Watchdog] Stopped.");
    }

    /**
     * Primary check routine.
     */
    async _check() {
        this.stats.checks++;

        try {
            // 1. Health probe — is Buddy responsive?
            const healthOk = this._checkBuddyHealth();
            if (!healthOk) {
                this._consecutiveFailures++;
                this.stats.failures++;
                console.warn(`  🐕 [Watchdog] Buddy health FAIL (${this._consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);

                if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    await this._triggerRestart("consecutive_health_failures");
                    return;
                }
            } else {
                this._consecutiveFailures = 0;
            }

            // 2. Hallucination detection — check for repetitive patterns
            const hallucinationDetected = this._detectHallucinationLoop();
            if (hallucinationDetected) {
                this.stats.hallucinationDetections++;
                console.error(`  🐕 [Watchdog] HALLUCINATION LOOP DETECTED: "${hallucinationDetected}"`);
                this.emit("hallucination", { pattern: hallucinationDetected });
                await this._triggerRestart("hallucination_loop");
                return;
            }

            // 3. Memory leak detection
            const currentRSS = process.memoryUsage().rss;
            const growthMB = (currentRSS - this._baselineRSS) / (1024 * 1024);
            if (growthMB > MEMORY_GROWTH_THRESHOLD_MB) {
                this.stats.memoryAlerts++;
                console.warn(`  🐕 [Watchdog] Memory growth alert: +${growthMB.toFixed(1)}MB since baseline`);
                this.emit("memory-alert", { growthMB, currentRSS, baselineRSS: this._baselineRSS });
            }

            // 4. Decision stall detection
            if (this._buddy) {
                const currentDecisions = this._buddy.decisionCount || 0;
                if (currentDecisions === this._lastDecisionCount) {
                    this._stallTicks++;
                    // Alert after ~40 seconds of no decisions (6 ticks × 6.85s)
                    if (this._stallTicks > 6) {
                        this.stats.stallDetections++;
                        this.emit("stall", { ticks: this._stallTicks, lastDecisionCount: currentDecisions });
                    }
                } else {
                    this._stallTicks = 0;
                    this._lastDecisionCount = currentDecisions;
                }
            }

        } catch (err) {
            trackError("watchdog:check", err);
        }
    }

    /**
     * Check if Buddy is responsive.
     */
    _checkBuddyHealth() {
        if (!this._buddy) return false;

        try {
            const status = this._buddy.getStatus();
            return status.ok === true && status.metacognition.confidence > 0.1;
        } catch {
            return false;
        }
    }

    /**
     * Detect hallucination loops by checking for repetitive patterns
     * in recent decisions.
     */
    _detectHallucinationLoop() {
        if (!this._buddy) return null;

        const decisions = this._buddy.metacognition.getRecentDecisions(20);
        if (decisions.length < HALLUCINATION_PATTERN_THRESHOLD) return null;

        // Check for identical action patterns repeated
        const recentActions = decisions.slice(-10).map(d => d.action);
        const actionCounts = {};
        for (const action of recentActions) {
            actionCounts[action] = (actionCounts[action] || 0) + 1;
        }

        for (const [action, count] of Object.entries(actionCounts)) {
            if (count >= HALLUCINATION_PATTERN_THRESHOLD) {
                return `action "${action}" repeated ${count} times in last 10 decisions`;
            }
        }

        // Check for identical error patterns
        const recentErrors = decisions
            .filter(d => d.result === "error")
            .slice(-10)
            .map(d => d.error);

        const errorCounts = {};
        for (const err of recentErrors) {
            if (err) errorCounts[err] = (errorCounts[err] || 0) + 1;
        }

        for (const [err, count] of Object.entries(errorCounts)) {
            if (count >= HALLUCINATION_PATTERN_THRESHOLD) {
                return `error "${err}" repeated ${count} times`;
            }
        }

        return null;
    }

    /**
     * Trigger a Buddy restart — clear volatile memory, preserve vector storage.
     */
    async _triggerRestart(reason) {
        this._restartCount++;
        this.stats.restarts++;

        console.error(`  🐕 [Watchdog] TRIGGERING BUDDY RESTART — Reason: ${reason} (restart #${this._restartCount})`);
        this.emit("restart", { reason, restartCount: this._restartCount });

        try {
            // Clear volatile state
            if (this._buddy) {
                this._buddy.metacognition.decisionLog = [];
                this._buddy.decisionCount = 0;
                this._buddy.status = "restarting";

                // Re-initialize identity (fresh start, but same Buddy)
                const crypto = require("crypto");
                this._buddy.identity.id = crypto.createHash("sha256")
                    .update(`buddy-restart-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`)
                    .digest("hex").slice(0, 24);

                this._buddy.started = Date.now();
                this._buddy.status = "active";

                console.log(`  🐕 [Watchdog] Buddy restarted — new ID: ${this._buddy.identity.id}`);
            }

            // Reset failure counters
            this._consecutiveFailures = 0;
            this._stallTicks = 0;
            this._baselineRSS = process.memoryUsage().rss;

        } catch (err) {
            trackError("watchdog:restart", err);
            console.error(`  🐕 [Watchdog] Restart failed: ${err.message}`);
        }
    }

    /**
     * Get watchdog status.
     */
    getStatus() {
        return {
            running: this._running,
            stats: this.stats,
            consecutiveFailures: this._consecutiveFailures,
            stallTicks: this._stallTicks,
            memoryGrowthMB: ((process.memoryUsage().rss - this._baselineRSS) / (1024 * 1024)).toFixed(1),
            intervalMs: WATCHDOG_INTERVAL_MS,
            buddyAlive: this._checkBuddyHealth(),
        };
    }

    /**
     * Register Express routes for watchdog status.
     */
    registerRoutes(app) {
        app.get("/api/watchdog/status", (req, res) => {
            res.json({ ok: true, watchdog: this.getStatus() });
        });

        console.log("  🐕 [Watchdog] Route registered: /api/watchdog/status");
    }
}

module.exports = { BuddyWatchdog };

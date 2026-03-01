#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Autonomous Health Loop ═══
 *
 * Continuously monitors production endpoints and triggers auto-remediation.
 * Designed to run as a persistent PM2 process.
 *
 * Behavior:
 *   - Pings all production URLs every 60 seconds
 *   - Tracks consecutive failures per service
 *   - Emits warning after 2 consecutive failures
 *   - Triggers auto-redeploy hook after 5 consecutive failures
 *   - Persists state to data/health-loop-state.json
 *
 * Usage:
 *   node scripts/autonomous/health-loop.js          # run continuously
 *   node scripts/autonomous/health-loop.js --once   # single pass (for testing)
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ── Configuration ───────────────────────────────────────────────
const CONFIG = {
    intervalMs: 60_000,             // check every 60 seconds
    warnAfterFailures: 2,          // warn after 2 consecutive fails
    redeployAfterFailures: 5,      // trigger redeploy after 5 consecutive fails
    requestTimeoutMs: 12_000,      // per-request timeout
    stateFile: path.join(__dirname, "..", "..", "data", "health-loop-state.json"),
    logFile: path.join(__dirname, "..", "..", "logs", "health-loop.log"),
};

const SERVICES = [
    {
        name: "heady-manager",
        url: "https://manager.headysystems.com/api/pulse",
        critical: true,
        redeployHook: process.env.RENDER_DEPLOY_HOOK || null,
    },
    {
        name: "heady-manager-health",
        url: "https://manager.headysystems.com/health/live",
        critical: true,
        redeployHook: process.env.RENDER_DEPLOY_HOOK || null,
    },
    {
        name: "headyme",
        url: "https://headyme.com",
        critical: false,
        redeployHook: null,
    },
    {
        name: "1ime1",
        url: "https://1ime1.com",
        critical: false,
        redeployHook: null,
    },
    {
        name: "edge-proxy",
        url: "https://heady-edge-proxy.emailheadyconnection.workers.dev",
        critical: false,
        redeployHook: null,
    },
];

const SINGLE_PASS = process.argv.includes("--once");

// ── State ───────────────────────────────────────────────────────
const state = {
    startedAt: new Date().toISOString(),
    checkCount: 0,
    services: {},
    lastCheck: null,
    redeploysTrigger: 0,
};

for (const svc of SERVICES) {
    state.services[svc.name] = {
        consecutiveFailures: 0,
        totalChecks: 0,
        totalFailures: 0,
        lastStatus: null,
        lastCheckAt: null,
        lastError: null,
        redeploysTriggered: 0,
    };
}

// ── Logging ─────────────────────────────────────────────────────
function log(level, msg) {
    const line = `[HEALTH-LOOP] [${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(line);
    try {
        const dir = path.dirname(CONFIG.logFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(CONFIG.logFile, line + "\n");
    } catch { /* best-effort */ }
}

// ── Persistence ─────────────────────────────────────────────────
function saveState() {
    try {
        const dir = path.dirname(CONFIG.stateFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
    } catch (err) {
        log("ERROR", `Failed to save state: ${err.message}`);
    }
}

function loadState() {
    try {
        if (fs.existsSync(CONFIG.stateFile)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG.stateFile, "utf-8"));
            // Restore consecutive failure counts (survive restarts)
            for (const [name, svcState] of Object.entries(saved.services || {})) {
                if (state.services[name]) {
                    state.services[name].consecutiveFailures = svcState.consecutiveFailures || 0;
                    state.services[name].totalChecks = svcState.totalChecks || 0;
                    state.services[name].totalFailures = svcState.totalFailures || 0;
                    state.services[name].redeploysTriggered = svcState.redeploysTriggered || 0;
                }
            }
            log("INFO", "Restored state from previous run");
        }
    } catch { /* fresh start */ }
}

// ── HTTP Check ──────────────────────────────────────────────────
function checkService(svc) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const urlObj = new URL(svc.url);
        const client = urlObj.protocol === "https:" ? https : http;

        const req = client.get(
            svc.url,
            {
                timeout: CONFIG.requestTimeoutMs,
                headers: { "User-Agent": "HeadyHealthLoop/1.0" },
            },
            (res) => {
                let body = "";
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    resolve({
                        name: svc.name,
                        ok: res.statusCode >= 200 && res.statusCode < 500,
                        status: res.statusCode,
                        durationMs: Date.now() - startTime,
                        error: null,
                    });
                });
            }
        );

        req.on("timeout", () => {
            req.destroy();
            resolve({
                name: svc.name,
                ok: false,
                status: "TIMEOUT",
                durationMs: CONFIG.requestTimeoutMs,
                error: `Timed out after ${CONFIG.requestTimeoutMs}ms`,
            });
        });

        req.on("error", (err) => {
            resolve({
                name: svc.name,
                ok: false,
                status: "ERROR",
                durationMs: Date.now() - startTime,
                error: err.message,
            });
        });
    });
}

// ── Auto-Redeploy ───────────────────────────────────────────────
async function triggerRedeploy(svc) {
    if (!svc.redeployHook) {
        log("WARN", `No redeploy hook configured for ${svc.name} — skipping`);
        return;
    }

    log("ACTION", `🚀 Triggering auto-redeploy for ${svc.name}`);

    return new Promise((resolve) => {
        const urlObj = new URL(svc.redeployHook);
        const client = urlObj.protocol === "https:" ? https : http;

        const req = client.request(svc.redeployHook, { method: "POST", timeout: 15000 }, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    log("ACTION", `✅ Redeploy triggered for ${svc.name}: ${res.statusCode}`);
                } else {
                    log("ERROR", `Redeploy failed for ${svc.name}: ${res.statusCode} ${body}`);
                }
                resolve();
            });
        });

        req.on("error", (err) => {
            log("ERROR", `Redeploy request failed for ${svc.name}: ${err.message}`);
            resolve();
        });

        req.end();
    });
}

// ── Main Check Cycle ────────────────────────────────────────────
async function runCheck() {
    state.checkCount++;
    state.lastCheck = new Date().toISOString();

    const results = await Promise.all(SERVICES.map(checkService));

    for (const result of results) {
        const svcState = state.services[result.name];
        const svc = SERVICES.find((s) => s.name === result.name);
        svcState.totalChecks++;
        svcState.lastCheckAt = new Date().toISOString();
        svcState.lastStatus = result.status;

        if (result.ok) {
            if (svcState.consecutiveFailures > 0) {
                log("INFO", `✅ ${result.name} recovered after ${svcState.consecutiveFailures} failures (${result.durationMs}ms)`);
            }
            svcState.consecutiveFailures = 0;
            svcState.lastError = null;
        } else {
            svcState.consecutiveFailures++;
            svcState.totalFailures++;
            svcState.lastError = result.error;

            if (svcState.consecutiveFailures === CONFIG.warnAfterFailures) {
                log("WARN", `⚠️ ${result.name} failed ${svcState.consecutiveFailures}x consecutively: ${result.error}`);
            }

            if (svcState.consecutiveFailures === CONFIG.redeployAfterFailures && svc) {
                log("ACTION", `🚨 ${result.name} failed ${svcState.consecutiveFailures}x — initiating auto-redeploy`);
                await triggerRedeploy(svc);
                svcState.redeploysTriggered++;
                state.redeploysTrigger++;
                // Reset counter to avoid infinite redeploy loop
                svcState.consecutiveFailures = 0;
            }
        }
    }

    // Log summary periodically
    if (state.checkCount % 10 === 0 || state.checkCount === 1) {
        const healthy = results.filter((r) => r.ok).length;
        log("INFO", `Check #${state.checkCount}: ${healthy}/${results.length} healthy`);
    }

    saveState();
}

// ── Lifecycle ───────────────────────────────────────────────────
async function main() {
    log("INFO", "═══ Heady Autonomous Health Loop starting ═══");
    log("INFO", `Interval: ${CONFIG.intervalMs / 1000}s | Warn after: ${CONFIG.warnAfterFailures} | Redeploy after: ${CONFIG.redeployAfterFailures}`);
    log("INFO", `Monitoring ${SERVICES.length} services: ${SERVICES.map((s) => s.name).join(", ")}`);

    loadState();

    // Initial check
    await runCheck();

    if (SINGLE_PASS) {
        log("INFO", "Single-pass mode — exiting after one check");
        console.log(JSON.stringify(state, null, 2));
        process.exit(0);
    }

    // Continuous loop
    setInterval(runCheck, CONFIG.intervalMs);

    // Graceful shutdown
    const shutdown = () => {
        log("INFO", "═══ Health Loop shutting down ═══");
        saveState();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}

main().catch((err) => {
    log("ERROR", `Health loop crashed: ${err.message}`);
    process.exit(1);
});

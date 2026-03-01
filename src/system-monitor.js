/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Heady System Monitor — OS-Level Watchdog ═══
 *
 * Monitors local system health: runaway processes, memory pressure,
 * swap thrashing, disk usage, and core dump accumulation.
 * Auto-remediates by killing offending processes and logging incidents.
 *
 * Zero npm dependencies — uses only child_process and fs.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Configuration ───────────────────────────────────────────────
const CONFIG = {
    intervalMs: 30_000,               // scan every 30 seconds
    cpu: {
        threshold: 95,                // % CPU to flag a process
        graceSeconds: 300,            // 5 min before auto-kill
    },
    git: {
        maxRuntimeSeconds: 600,       // 10 min for git operations
        commands: ["git add", "git commit", "git gc", "git repack", "git fsck"],
    },
    memory: {
        minFreeMB: 500,               // warn if free RAM drops below this
    },
    swap: {
        kswapCpuThreshold: 5,         // kswapd CPU% that indicates thrashing
    },
    disk: {
        usageThreshold: 90,           // % disk used
        mountPoints: ["/", "/home"],
    },
    ripgrep: {
        maxRuntimeSeconds: 300,       // 5 min for rg file searches
    },
    coreDumpDir: "/home/headyme/Heady",
    logFile: "/home/headyme/Heady/logs/watchdog.log",
};

// ── Process Safelist — NEVER kill these ─────────────────────────
const SAFE_PROCESSES = new Set([
    "heady-manager",
    "heady-manager.js",
    "system-monitor.js",
    "pm2",
    "PM2",
    "God Daemon",
    "Xorg",
    "lightdm",
    "systemd",
    "sshd",
    "dbus-daemon",
    "NetworkManager",
    "pulseaudio",
    "pipewire",
    "antigravity",            // the IDE itself
    "gnome-shell",
    "gdm",
    "init",
    "kworker",
    "kswapd0",
    "ksoftirqd",
    "migration",
    "watchdog",
]);

// ── State ───────────────────────────────────────────────────────
const state = {
    lastScan: null,
    scanCount: 0,
    kills: [],
    warnings: [],
    incidents: [],
    cpuOffenders: new Map(),  // pid → { firstSeen, cmd }
    startedAt: new Date().toISOString(),
};

let incidentManager = null;
let intervalId = null;

// ── Logging ─────────────────────────────────────────────────────
function log(level, msg) {
    const line = `[WATCHDOG] [${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(line);
    try {
        const dir = path.dirname(CONFIG.logFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(CONFIG.logFile, line + "\n");
    } catch { /* best-effort */ }
}

// ── Utility: exec with fallback ─────────────────────────────────
function safeExec(cmd, opts = {}) {
    try {
        return execSync(cmd, { encoding: "utf-8", timeout: 10_000, ...opts }).trim();
    } catch {
        return "";
    }
}

// ── Utility: check if process is safe ───────────────────────────
function isSafe(cmd, pid) {
    if (+pid <= 2) return true;  // PID 0, 1, 2 are kernel
    for (const safe of SAFE_PROCESSES) {
        if (cmd.includes(safe)) return true;
    }
    // Never kill our own PID or parent
    if (+pid === process.pid || +pid === process.ppid) return true;
    return false;
}

// ── Utility: kill a process with escalation ─────────────────────
function killProcess(pid, reason) {
    try {
        log("ACTION", `Killing PID ${pid}: ${reason}`);
        execSync(`kill ${pid}`, { timeout: 5000 });
        // Check if still alive after 10s, escalate to SIGKILL
        setTimeout(() => {
            try {
                execSync(`kill -0 ${pid} 2>/dev/null`, { timeout: 2000 });
                log("ACTION", `PID ${pid} still alive, sending SIGKILL`);
                execSync(`kill -9 ${pid}`, { timeout: 5000 });
            } catch { /* already dead — good */ }
        }, 10_000);

        const entry = {
            pid, reason,
            killedAt: new Date().toISOString(),
        };
        state.kills.push(entry);
        if (state.kills.length > 200) state.kills.shift();

        // Log incident if IncidentManager is wired
        if (incidentManager) {
            incidentManager.create({
                severity: "high",
                title: `Watchdog killed PID ${pid}`,
                source: "system-monitor",
                details: { pid, reason },
            });
        }
        state.incidents.push(entry);
        if (state.incidents.length > 200) state.incidents.shift();
        return true;
    } catch (err) {
        log("ERROR", `Failed to kill PID ${pid}: ${err.message}`);
        return false;
    }
}

// ── Utility: add a warning (no kill) ────────────────────────────
function addWarning(severity, msg, details = {}) {
    log("WARN", msg);
    const entry = { severity, message: msg, details, ts: new Date().toISOString() };
    state.warnings.push(entry);
    if (state.warnings.length > 200) state.warnings.shift();

    if (incidentManager && (severity === "critical" || severity === "high")) {
        incidentManager.create({
            severity,
            title: msg,
            source: "system-monitor",
            details,
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// CHECKS
// ═══════════════════════════════════════════════════════════════

// ── 1. Runaway CPU Processes ────────────────────────────────────
function checkRunawayCPU() {
    const results = { killed: 0, tracked: 0 };
    const raw = safeExec("ps aux --sort=-%cpu --no-headers");
    if (!raw) return results;

    const lines = raw.split("\n").slice(0, 30); // top 30
    const now = Date.now();

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parts[1];
        const cpu = parseFloat(parts[2]);
        const cmd = parts.slice(10).join(" ");

        if (cpu < CONFIG.cpu.threshold) continue;
        if (isSafe(cmd, pid)) continue;

        // Track first-seen time
        if (!state.cpuOffenders.has(pid)) {
            state.cpuOffenders.set(pid, { firstSeen: now, cmd, cpu });
            results.tracked++;
            log("TRACK", `Tracking PID ${pid} at ${cpu}% CPU: ${cmd.substring(0, 80)}`);
            continue;
        }

        const offender = state.cpuOffenders.get(pid);
        const elapsedSec = (now - offender.firstSeen) / 1000;

        if (elapsedSec >= CONFIG.cpu.graceSeconds) {
            killProcess(pid, `CPU at ${cpu}% for ${Math.round(elapsedSec)}s: ${cmd.substring(0, 100)}`);
            state.cpuOffenders.delete(pid);
            results.killed++;
        } else {
            results.tracked++;
        }
    }

    // Prune offenders that are no longer in the process list
    const currentPids = new Set(
        raw.split("\n").map(l => l.trim().split(/\s+/)[1]).filter(Boolean)
    );
    for (const [pid] of state.cpuOffenders) {
        if (!currentPids.has(pid)) state.cpuOffenders.delete(pid);
    }

    return results;
}

// ── 2. Hung Git Operations ──────────────────────────────────────
function checkHungGit() {
    const results = { killed: 0, found: 0 };
    const raw = safeExec("ps aux --no-headers");
    if (!raw) return results;

    for (const line of raw.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parts[1];
        const cmd = parts.slice(10).join(" ");

        const isGit = CONFIG.git.commands.some(gc => cmd.includes(gc));
        if (!isGit) continue;
        results.found++;

        // Parse the elapsed time from ps — column 9 is START time
        // Use ps -o etimes for actual elapsed seconds
        const elapsed = safeExec(`ps -o etimes= -p ${pid}`);
        const elapsedSec = parseInt(elapsed, 10);
        if (isNaN(elapsedSec)) continue;

        if (elapsedSec > CONFIG.git.maxRuntimeSeconds) {
            killProcess(pid, `Hung git operation (${Math.round(elapsedSec / 60)}min): ${cmd.substring(0, 100)}`);
            results.killed++;
        }
    }
    return results;
}

// ── 3. Runaway Ripgrep / IDE Indexing ───────────────────────────
function checkRunawayRipgrep() {
    const results = { killed: 0, found: 0 };
    const raw = safeExec("ps aux --no-headers | grep 'rg --files' | grep -v grep");
    if (!raw) return results;

    for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parts[1];
        const cmd = parts.slice(10).join(" ");
        results.found++;

        const elapsed = safeExec(`ps -o etimes= -p ${pid}`);
        const elapsedSec = parseInt(elapsed, 10);
        if (isNaN(elapsedSec)) continue;

        if (elapsedSec > CONFIG.ripgrep.maxRuntimeSeconds) {
            killProcess(pid, `Runaway ripgrep (${Math.round(elapsedSec / 60)}min): ${cmd.substring(0, 100)}`);
            results.killed++;
        }
    }
    return results;
}

// ── 4. Memory Pressure ──────────────────────────────────────────
function checkMemory() {
    const raw = safeExec("free -m");
    if (!raw) return { ok: true };

    const lines = raw.split("\n");
    const memLine = lines.find(l => l.startsWith("Mem:"));
    if (!memLine) return { ok: true };

    const parts = memLine.split(/\s+/);
    const totalMB = parseInt(parts[1], 10);
    const availableMB = parseInt(parts[6], 10); // "available" column

    const result = { totalMB, availableMB, ok: availableMB >= CONFIG.memory.minFreeMB };

    if (!result.ok) {
        addWarning("high",
            `Low memory: ${availableMB}MB available (threshold: ${CONFIG.memory.minFreeMB}MB)`,
            { totalMB, availableMB }
        );
    }
    return result;
}

// ── 5. Swap Thrashing ───────────────────────────────────────────
function checkSwap() {
    const raw = safeExec("ps aux --no-headers | grep kswapd | grep -v grep");
    if (!raw) return { thrashing: false };

    for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        const cpu = parseFloat(parts[2]);
        if (cpu > CONFIG.swap.kswapCpuThreshold) {
            addWarning("high",
                `Swap thrashing detected: kswapd at ${cpu}% CPU`,
                { kswapCpu: cpu }
            );
            return { thrashing: true, cpu };
        }
    }
    return { thrashing: false };
}

// ── 6. Disk Usage ───────────────────────────────────────────────
function checkDisk() {
    const results = {};
    for (const mount of CONFIG.disk.mountPoints) {
        const raw = safeExec(`df -h ${mount} --output=pcent 2>/dev/null`);
        if (!raw) continue;
        const lines = raw.split("\n").filter(l => l.trim() && !l.includes("Use%"));
        if (lines.length === 0) continue;

        const pct = parseInt(lines[0].trim().replace("%", ""), 10);
        results[mount] = pct;

        if (pct >= CONFIG.disk.usageThreshold) {
            addWarning("high",
                `Disk usage critical: ${mount} at ${pct}%`,
                { mount, usagePercent: pct }
            );
        }
    }
    return results;
}

// ── 7. Core Dump Cleanup ────────────────────────────────────────
function cleanCoreDumps() {
    const results = { deleted: 0, freedBytes: 0 };
    try {
        const files = fs.readdirSync(CONFIG.coreDumpDir);
        for (const f of files) {
            if (/^core\.\d+$/.test(f)) {
                const fullPath = path.join(CONFIG.coreDumpDir, f);
                try {
                    const stat = fs.statSync(fullPath);
                    fs.unlinkSync(fullPath);
                    results.deleted++;
                    results.freedBytes += stat.size;
                    log("CLEANUP", `Deleted core dump: ${f} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
                } catch { /* skip if locked */ }
            }
        }
        if (results.deleted > 0) {
            log("CLEANUP", `Cleaned ${results.deleted} core dumps, freed ${(results.freedBytes / 1024 / 1024).toFixed(1)}MB`);
        }
    } catch { /* directory not readable */ }
    return results;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCAN CYCLE
// ═══════════════════════════════════════════════════════════════

function runScan() {
    const scanStart = Date.now();
    const report = {
        ts: new Date().toISOString(),
        checks: {},
    };

    try {
        report.checks.cpu = checkRunawayCPU();
        report.checks.git = checkHungGit();
        report.checks.ripgrep = checkRunawayRipgrep();
        report.checks.memory = checkMemory();
        report.checks.swap = checkSwap();
        report.checks.disk = checkDisk();
        report.checks.coreDumps = cleanCoreDumps();

        report.durationMs = Date.now() - scanStart;
        state.lastScan = report;
        state.scanCount++;

        if (state.scanCount % 10 === 0 || state.scanCount === 1) {
            log("INFO", `Scan #${state.scanCount} complete in ${report.durationMs}ms — ` +
                `CPU tracked: ${report.checks.cpu.tracked}, Memory: ${report.checks.memory.availableMB || "?"}MB avail`);
        }
    } catch (err) {
        log("ERROR", `Scan failed: ${err.message}`);
    }

    return report;
}

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════

function start(opts = {}) {
    if (opts.incidentManager) {
        incidentManager = opts.incidentManager;
    }
    if (opts.config) {
        Object.assign(CONFIG, opts.config);
    }

    log("INFO", "═══ Heady System Monitor starting ═══");
    log("INFO", `Interval: ${CONFIG.intervalMs / 1000}s | CPU threshold: ${CONFIG.cpu.threshold}% | ` +
        `Grace: ${CONFIG.cpu.graceSeconds}s | Min free RAM: ${CONFIG.memory.minFreeMB}MB`);

    // Initial scan
    runScan();

    // Recurring scans
    intervalId = setInterval(runScan, CONFIG.intervalMs);
    return state;
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    log("INFO", "═══ Heady System Monitor stopped ═══");
}

function getStatus() {
    return {
        running: intervalId !== null,
        startedAt: state.startedAt,
        scanCount: state.scanCount,
        lastScan: state.lastScan,
        totalKills: state.kills.length,
        recentKills: state.kills.slice(-10),
        recentWarnings: state.warnings.slice(-10),
        cpuTracked: state.cpuOffenders.size,
        config: {
            intervalMs: CONFIG.intervalMs,
            cpuThreshold: CONFIG.cpu.threshold,
            cpuGraceSeconds: CONFIG.cpu.graceSeconds,
            gitMaxRuntime: CONFIG.git.maxRuntimeSeconds,
            minFreeMB: CONFIG.memory.minFreeMB,
            diskThreshold: CONFIG.disk.usageThreshold,
        },
    };
}

// ── Express route registration ──────────────────────────────────
function registerRoutes(app) {
    app.get("/api/system-monitor/status", (_req, res) => {
        res.json(getStatus());
    });

    app.post("/api/system-monitor/scan", (_req, res) => {
        const report = runScan();
        res.json({ ok: true, report });
    });

    log("INFO", "Registered /api/system-monitor routes");
}

// ── Standalone mode ─────────────────────────────────────────────
if (require.main === module) {
    start();
    process.on("SIGINT", () => { stop(); process.exit(0); });
    process.on("SIGTERM", () => { stop(); process.exit(0); });
}

module.exports = {
    start,
    stop,
    runScan,
    getStatus,
    registerRoutes,
    CONFIG,
    // Exported for testing
    _internals: {
        checkRunawayCPU,
        checkHungGit,
        checkRunawayRipgrep,
        checkMemory,
        checkSwap,
        checkDisk,
        cleanCoreDumps,
        isSafe,
        state,
    },
};

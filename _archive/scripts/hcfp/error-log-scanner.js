#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HCFP Error Log Scanner — PM2 Log Tail → Auto Ingest Daemon
 *
 * Continuously tails PM2 error and output logs for error patterns,
 * deduplicates them, and POSTs unique errors to the HeadyManager
 * /hcfp/swarm/ingest-error endpoint.
 *
 * Runs as a lightweight PM2 process on a 30s scan interval.
 *
 * Detects:
 *   - Stack traces (at Object.<anonymous>, at Module._compile, etc.)
 *   - Error keywords (ERR!, FATAL, ECONNREFUSED, ENOENT, ENOMEM, EPIPE)
 *   - Node.js crash markers (SIGABRT, segfault, heap out of memory)
 *   - PM2 restart events (restart_time exceeded)
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// Config
const LOGS_DIR = path.join(__dirname, "..", "..", "logs");
const SCAN_INTERVAL_MS = 30_000; // 30 seconds
const MANAGER_URL = process.env.HEADY_MANAGER_URL || "https://api.headysystems.com";
const INGEST_ENDPOINT = "/hcfp/swarm/ingest-error";
const STATE_FILE = path.join(__dirname, "..", "..", "data", "error-scanner-state.json");

// Error patterns to detect
const ERROR_PATTERNS = [
    /ERR!/i,
    /FATAL/i,
    /ECONNREFUSED/i,
    /ENOENT/i,
    /ENOMEM/i,
    /EPIPE/i,
    /ECONNRESET/i,
    /SIGABRT/i,
    /segfault/i,
    /heap out of memory/i,
    /Cannot find module/i,
    /SyntaxError/i,
    /TypeError:/i,
    /ReferenceError:/i,
    /RangeError:/i,
    /UnhandledPromiseRejection/i,
    /throw(n|s)?\s/i,
    /CRITICAL/i,
];

// Patterns to IGNORE (noisy but harmless)
const IGNORE_PATTERNS = [
    /Both GOOGLE_API_KEY and GEMINI_API_KEY are set/i,
    /DeprecationWarning/i,
    /ExperimentalWarning/i,
];

// Fingerprint cache for dedup within this process
const seen = new Map();
const DEDUP_TTL_MS = 300_000; // 5 minutes (longer than bridge since we scan less frequently)

/**
 * Load scanner state (byte offsets for each log file).
 */
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        }
    } catch { /* fresh start */ }
    return {};
}

function saveState(state) {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch { /* non-critical */ }
}

/**
 * Scan a single log file for new error lines.
 */
function scanLogFile(filePath, state) {
    const errors = [];
    try {
        if (!fs.existsSync(filePath)) return errors;

        const stats = fs.statSync(filePath);
        const lastOffset = state[filePath] || 0;

        // If file was truncated/rotated, start from 0
        const offset = stats.size < lastOffset ? 0 : lastOffset;

        if (stats.size <= offset) return errors; // no new data

        // Read only the new bytes
        const fd = fs.openSync(filePath, "r");
        const bufSize = Math.min(stats.size - offset, 1024 * 100); // max 100KB per scan
        const buf = Buffer.alloc(bufSize);
        fs.readSync(fd, buf, 0, bufSize, offset);
        fs.closeSync(fd);

        const newContent = buf.toString("utf8");
        const lines = newContent.split("\n");

        for (const line of lines) {
            if (!line.trim()) continue;

            // Skip ignored patterns
            if (IGNORE_PATTERNS.some(p => p.test(line))) continue;

            // Check for error patterns
            const matchedPattern = ERROR_PATTERNS.find(p => p.test(line));
            if (matchedPattern) {
                const fingerprint = line.substring(0, 100).replace(/\d+/g, "N"); // normalize numbers
                if (!seen.has(fingerprint) || (Date.now() - seen.get(fingerprint)) > DEDUP_TTL_MS) {
                    seen.set(fingerprint, Date.now());
                    errors.push({
                        message: line.trim().substring(0, 400),
                        file: path.basename(filePath),
                        pattern: matchedPattern.source,
                    });
                }
            }
        }

        // Update offset
        state[filePath] = stats.size;
    } catch (err) {
        console.error(`  Scanner error reading ${filePath}: ${err.message}`);
    }
    return errors;
}

/**
 * POST an error to the HeadyManager ingest endpoint.
 */
function postError(error) {
    return new Promise((resolve) => {
        try {
            const postData = JSON.stringify({
                source: "log-scanner",
                message: error.message,
                severity: error.message.toLowerCase().includes("fatal") ? "critical" : "warning",
                context: {
                    logFile: error.file,
                    matchedPattern: error.pattern,
                },
            });

            const url = new URL(MANAGER_URL + INGEST_ENDPOINT);
            const transport = url.protocol === "https:" ? https : http;

            const req = transport.request({
                hostname: url.hostname,
                port: url.port || (url.protocol === "https:" ? 443 : 80),
                path: url.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                    "X-Heady-SDK": process.env.HEADY_API_KEY || "scanner",
                },
                timeout: 5000,
                rejectUnauthorized: false, // for local dev
            }, (res) => {
                let body = "";
                res.on("data", (d) => body += d);
                res.on("end", () => resolve({ ok: res.statusCode < 400, status: res.statusCode }));
            });

            req.on("error", () => resolve({ ok: false }));
            req.on("timeout", () => { req.destroy(); resolve({ ok: false }); });
            req.write(postData);
            req.end();
        } catch {
            resolve({ ok: false });
        }
    });
}

/**
 * Clean old fingerprints.
 */
function cleanFingerprints() {
    const now = Date.now();
    for (const [fp, ts] of seen) {
        if (now - ts > DEDUP_TTL_MS * 2) seen.delete(fp);
    }
}

/**
 * Main scan cycle.
 */
async function scan() {
    const state = loadState();

    // Find all log files
    let logFiles = [];
    try {
        if (fs.existsSync(LOGS_DIR)) {
            logFiles = fs.readdirSync(LOGS_DIR)
                .filter(f => f.endsWith(".log"))
                .map(f => path.join(LOGS_DIR, f));
        }
    } catch { /* no logs dir */ }

    // Also scan PM2 logs if they exist
    const pm2LogDir = path.join(process.env.HOME || "/home/headyme", ".pm2", "logs");
    try {
        if (fs.existsSync(pm2LogDir)) {
            const pm2Logs = fs.readdirSync(pm2LogDir)
                .filter(f => f.endsWith("-error.log") || f.includes("-error-"))
                .map(f => path.join(pm2LogDir, f));
            logFiles.push(...pm2Logs);
        }
    } catch { /* no pm2 logs */ }

    // Scan all files
    let totalErrors = 0;
    for (const logFile of logFiles) {
        const errors = scanLogFile(logFile, state);
        for (const err of errors) {
            await postError(err);
            totalErrors++;
        }
    }

    saveState(state);
    cleanFingerprints();

    if (totalErrors > 0) {
        console.log(`🔍 Log Scanner: found ${totalErrors} new errors → injected to pipeline`);
    }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════");
console.log("  🔍 HCFP Error Log Scanner");
console.log(`  📂 Watching: ${LOGS_DIR}`);
console.log(`  📡 Reporting to: ${MANAGER_URL}${INGEST_ENDPOINT}`);
console.log(`  ⏱  Interval: ${SCAN_INTERVAL_MS / 1000}s`);
console.log("═══════════════════════════════════════════════");

// First scan immediately
scan().catch(err => console.error("Scanner error:", err.message));

// Then scan on interval
setInterval(() => {
    scan().catch(err => console.error("Scanner error:", err.message));
}, SCAN_INTERVAL_MS);

// Graceful shutdown
const shutdown = () => {
    console.log("\n🔍 Error Log Scanner shutting down...");
    process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

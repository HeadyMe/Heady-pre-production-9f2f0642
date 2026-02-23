#!/usr/bin/env node
/**
 * ─── Heady Overnight Monitor ──────────────────────────────────────
 * Continuous health monitoring + auto-restart + audit trail
 * Runs from 3am-12pm, checks every 5 minutes
 * Logs everything to /home/headyme/Heady/data/overnight-audit.jsonl
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

const MANAGER_URL = "http://127.0.0.1:3301";
const AUDIT_LOG = path.join(__dirname, "..", "data", "overnight-audit.jsonl");
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const END_TIME = new Date();
END_TIME.setHours(12, 0, 0, 0); // noon today
if (END_TIME < new Date()) END_TIME.setDate(END_TIME.getDate() + 1);

// Ensure data dir
const dataDir = path.dirname(AUDIT_LOG);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function log(entry) {
    const line = JSON.stringify({ ...entry, ts: new Date().toISOString() });
    fs.appendFileSync(AUDIT_LOG, line + "\n");
    console.log(`[${new Date().toLocaleTimeString()}] ${entry.type}: ${entry.message}`);
}

async function httpGet(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.get(`${MANAGER_URL}${urlPath}`, { timeout: 10000 }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    });
}

async function httpPost(urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request(`${MANAGER_URL}${urlPath}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(payload);
        req.end();
    });
}

async function checkHealth() {
    try {
        const pulse = await httpGet("/api/pulse");
        const vectorStats = await httpGet("/api/vector/stats");
        const vectorData = vectorStats.body;

        log({
            type: "health",
            message: `Manager ${pulse.body.status} v${pulse.body.version} | Vectors: ${vectorData.total_vectors} | Source: ${vectorData.embedding_source}`,
            manager: pulse.body,
            vectors: vectorData,
        });
        return true;
    } catch (err) {
        log({ type: "health_fail", message: `Manager unreachable: ${err.message}` });
        return false;
    }
}

async function autoRestart() {
    log({ type: "restart", message: "Auto-restarting Heady Manager..." });
    try {
        execSync("pkill -f 'node heady-manager' 2>/dev/null", { timeout: 5000 });
    } catch { }
    await new Promise(r => setTimeout(r, 3000));

    const mgr = spawn("node", ["heady-manager.js"], {
        cwd: path.join(__dirname, ".."),
        stdio: "ignore",
        detached: true,
    });
    mgr.unref();

    await new Promise(r => setTimeout(r, 7000));
    const alive = await checkHealth();
    log({ type: "restart_result", message: alive ? "✅ Restart successful" : "❌ Restart failed" });
    return alive;
}

async function learningPulse() {
    // Store a learning interaction in vector memory every cycle
    const topics = [
        "Heady system architecture patterns and optimization",
        "AI response psychology and conflict avoidance",
        "Behavior analysis for HeadyCorrections vertical",
        "Cross-device authentication and permission management",
        "Voice UX design patterns for mobile AI companions",
        "3D vector storage schema optimization and indexing",
        "Audit trail completeness and regulatory compliance",
        "Service mesh orchestration and load balancing",
        "Real-time streaming and WebSocket patterns",
        "Code generation and refactoring best practices",
    ];
    const topic = topics[Math.floor(Date.now() / CHECK_INTERVAL) % topics.length];

    try {
        // Store learning context
        await httpPost("/api/vector/store", {
            content: `Learning pulse: ${topic} — Overnight learning cycle at ${new Date().toISOString()}`,
            metadata: { type: "learning_pulse", topic, cycle: "overnight" },
        });

        // Embed for future retrieval
        await httpPost("/api/brain/embed", { text: topic });

        log({ type: "learning", message: `Stored learning context: ${topic}` });
    } catch (err) {
        log({ type: "learning_fail", message: `Learning pulse failed: ${err.message}` });
    }
}

async function auditCycle() {
    const cycle = {
        type: "audit_cycle",
        timestamp: new Date().toISOString(),
        checks: {},
    };

    // Check all critical endpoints
    const endpoints = ["pulse", "health", "vector/stats", "voice/sessions"];
    for (const ep of endpoints) {
        try {
            const r = await httpGet(`/api/${ep}`);
            cycle.checks[ep] = { status: r.status, ok: r.status === 200 };
        } catch (err) {
            cycle.checks[ep] = { status: 0, ok: false, error: err.message };
        }
    }

    // Resource check
    try {
        const memUsage = process.memoryUsage();
        cycle.resources = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
            rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
        };
    } catch { }

    log({ ...cycle, message: `Audit: ${Object.values(cycle.checks).filter(c => c.ok).length}/${endpoints.length} endpoints healthy` });
}

// ── Main Loop ──────────────────────────────────────────────────────
async function run() {
    log({ type: "start", message: `Overnight monitor started. Running until ${END_TIME.toLocaleString()}` });

    let consecutiveFailures = 0;

    while (new Date() < END_TIME) {
        const healthy = await checkHealth();

        if (!healthy) {
            consecutiveFailures++;
            if (consecutiveFailures >= 2) {
                await autoRestart();
                consecutiveFailures = 0;
            }
        } else {
            consecutiveFailures = 0;
        }

        await auditCycle();
        await learningPulse();

        // Wait for next cycle
        await new Promise(r => setTimeout(r, CHECK_INTERVAL));
    }

    log({ type: "end", message: "Overnight monitor completed" });
}

run().catch(err => {
    log({ type: "fatal", message: `Monitor crashed: ${err.message}` });
    process.exit(1);
});

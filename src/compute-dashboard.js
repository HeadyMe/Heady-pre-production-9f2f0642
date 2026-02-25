/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Compute Dashboard ──────────────────────────────────────
 * Real-time compute resource monitoring across local + remote nodes.
 * 
 * Tracks: CPU, memory, active agents, provider health, queue depth,
 * vector store size, overnight audit progress, and all node statuses.
 * 
 * Endpoint: GET /api/compute/dashboard
 * SSE Stream: GET /api/compute/stream (near real-time updates)
 * ──────────────────────────────────────────────────────────────────
 */

const os = require("os");
const fs = require("fs");
const path = require("path");
const http = require("http");

const AUDIT_DIR = path.join(__dirname, "..", "data");

// ── Local Resource Snapshot ──────────────────────────────────────
function getLocalResources() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpu: {
            cores: cpus.length,
            model: cpus[0]?.model || "unknown",
            loadAvg1m: +loadAvg[0].toFixed(2),
            loadAvg5m: +loadAvg[1].toFixed(2),
            loadAvg15m: +loadAvg[2].toFixed(2),
            utilization: +(loadAvg[0] / cpus.length * 100).toFixed(1),
        },
        memory: {
            total: Math.round(totalMem / 1024 / 1024) + "MB",
            free: Math.round(freeMem / 1024 / 1024) + "MB",
            used: Math.round((totalMem - freeMem) / 1024 / 1024) + "MB",
            utilization: +((1 - freeMem / totalMem) * 100).toFixed(1),
        },
        uptime: Math.round(os.uptime()),
        nodeVersion: process.version,
        processMemory: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        },
    };
}

// ── Remote Node Status ──────────────────────────────────────────
async function checkRemoteNode(name, url, timeout = 5000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.get(url, { timeout }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                resolve({
                    name, url, status: "online",
                    latency: Date.now() - start,
                    httpStatus: res.statusCode,
                });
            });
        });
        req.on("error", () => resolve({ name, url, status: "offline", latency: Date.now() - start }));
        req.on("timeout", () => { req.destroy(); resolve({ name, url, status: "timeout", latency: timeout }); });
    });
}

// ── Compute Provider Status ─────────────────────────────────────
function getProviderStatus() {
    const providers = [];

    // Check which API keys are configured
    const checks = [
        { name: "heady-reasoning", keys: ["HEADY_NEXUS_KEY", "HEADY_NEXUS_KEY_SECONDARY"], type: "remote" },
        { name: "heady-multimodal", keys: ["GOOGLE_API_KEY", "HEADY_PYTHIA_KEY_HEADY", "HEADY_PYTHIA_KEY_GCLOUD"], type: "remote" },
        { name: "heady-open-weights", keys: ["HF_TOKEN", "HF_TOKEN_2", "HF_TOKEN_3"], type: "remote" },
        { name: "heady-enterprise", keys: ["HEADY_COMPUTE_KEY"], type: "remote" },
        { name: "heady-local", keys: ["HEADY_LOCAL_HOST"], type: "local" },
    ];

    for (const check of checks) {
        const configuredKeys = check.keys.filter(k => {
            const val = process.env[k];
            return val && !val.includes("placeholder") && !val.includes("your_");
        });
        providers.push({
            service: check.name,
            type: check.type,
            configured: configuredKeys.length > 0,
            keyCount: configuredKeys.length,
            totalKeys: check.keys.length,
        });
    }

    return providers;
}

// ── Audit & Data Stats ──────────────────────────────────────────
function getDataStats() {
    const stats = {};

    const files = [
        { name: "overnight-audit", path: path.join(AUDIT_DIR, "overnight-audit.jsonl") },
        { name: "corrections-audit", path: path.join(AUDIT_DIR, "corrections-audit.jsonl") },
        { name: "agent-orchestrator-audit", path: path.join(AUDIT_DIR, "agent-orchestrator-audit.jsonl") },
        { name: "vector-memory", path: path.join(AUDIT_DIR, "vector-memory.json") },
        { name: "behavior-patterns", path: path.join(AUDIT_DIR, "behavior-patterns.json") },
    ];

    for (const f of files) {
        try {
            const stat = fs.statSync(f.path);
            if (f.path.endsWith(".jsonl")) {
                const lines = fs.readFileSync(f.path, "utf-8").trim().split("\n").length;
                stats[f.name] = { entries: lines, size: Math.round(stat.size / 1024) + "KB", modified: stat.mtime.toISOString() };
            } else {
                stats[f.name] = { size: Math.round(stat.size / 1024) + "KB", modified: stat.mtime.toISOString() };
            }
        } catch {
            stats[f.name] = { entries: 0, size: "0KB", status: "not created" };
        }
    }
    return stats;
}

// ── Full Dashboard ──────────────────────────────────────────────
async function getDashboard(orchestrator) {
    const local = getLocalResources();
    const providers = getProviderStatus();
    const data = getDataStats();

    // Check remote nodes
    const remoteNodes = await Promise.allSettled([
        checkRemoteNode("heady-manager", "http://127.0.0.1:3301/api/pulse"),
        checkRemoteNode("heady-edge", "https://headysystems.com/api/health", 8000),
    ]);

    const nodes = remoteNodes.map(r => r.status === "fulfilled" ? r.value : { status: "error" });
    const orchestratorStats = orchestrator ? orchestrator.getStats() : { totalAgents: 0, completedTasks: 0 };

    return {
        ts: new Date().toISOString(),
        local,
        providers,
        nodes,
        orchestrator: orchestratorStats,
        data,
        summary: {
            cpuUtil: local.cpu.utilization + "%",
            memUtil: local.memory.utilization + "%",
            activeProviders: providers.filter(p => p.configured).length + "/" + providers.length,
            activeAgents: orchestratorStats.totalAgents,
            completedTasks: orchestratorStats.completedTasks,
            vectorEntries: data["vector-memory"]?.size || "0KB",
            auditEntries: data["overnight-audit"]?.entries || 0,
        },
    };
}

// ── SSE Stream ──────────────────────────────────────────────────
const sseClients = new Set();

function startSSEBroadcast(orchestrator) {
    setInterval(async () => {
        if (sseClients.size === 0) return;
        const dashboard = await getDashboard(orchestrator);
        const payload = `data: ${JSON.stringify(dashboard.summary)}\n\n`;
        sseClients.forEach(res => {
            try { res.write(payload); } catch { sseClients.delete(res); }
        });
    }, 5000); // every 5 seconds
}

// ── Express Routes ──────────────────────────────────────────────
function registerRoutes(app, orchestrator) {
    app.get("/api/compute/dashboard", async (req, res) => {
        const dashboard = await getDashboard(orchestrator);
        res.json({ ok: true, ...dashboard });
    });

    app.get("/api/compute/stream", (req, res) => {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
        });
        res.write(`data: ${JSON.stringify({ type: "connected", ts: new Date().toISOString() })}\n\n`);
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
    });

    app.get("/api/compute/providers", (req, res) => {
        res.json({ ok: true, providers: getProviderStatus() });
    });

    app.get("/api/compute/local", (req, res) => {
        res.json({ ok: true, ...getLocalResources() });
    });

    startSSEBroadcast(orchestrator);
    console.log("  ∞ ComputeDashboard: LOADED (GET /api/compute/dashboard + SSE /api/compute/stream)");
}

module.exports = { registerRoutes, getDashboard, getLocalResources, getProviderStatus };

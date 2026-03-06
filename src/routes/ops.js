/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyOps — Infrastructure & Deployment Router
 * Manages container, service, and deployment operations.
 */
const express = require("express");
const router = express.Router();
const { execSync } = require("child_process");

const opsLog = [];
const startTime = Date.now();

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE", service: "heady-ops", mode: "infrastructure",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        operations: opsLog.length,
        ts: new Date().toISOString(),
    });
});

router.post("/deploy", (req, res) => {
    const { service, target, version } = req.body;
    const entry = { id: `ops-${Date.now()}`, action: "deploy", service: service || "all", target: target || "local", version: version || "latest", ts: new Date().toISOString() };
    opsLog.push(entry);
    if (opsLog.length > 200) opsLog.splice(0, opsLog.length - 200);
    res.json({
        ok: true, service: "heady-ops", action: "deploy", requestId: entry.id,
        deploy: { service: entry.service, target: entry.target, version: entry.version, status: "queued" },
        ts: entry.ts,
    });
});

router.post("/infrastructure", (req, res) => {
    const { action, resource } = req.body;
    const entry = { id: `ops-${Date.now()}`, action: action || "status", resource: resource || "all", ts: new Date().toISOString() };
    opsLog.push(entry);
    if (opsLog.length > 200) opsLog.splice(0, opsLog.length - 200);

    // Gather real system info where safe
    let systemInfo = {};
    try {
        systemInfo.hostname = execSync("hostname", { timeout: 2000 }).toString().trim();
        systemInfo.loadAvg = execSync("cat /proc/loadavg 2>/dev/null || echo 'N/A'", { timeout: 2000 }).toString().trim();
        systemInfo.memFree = execSync("free -m 2>/dev/null | awk '/^Mem:/ {print $4\"MB free of \"$2\"MB\"}' || echo 'N/A'", { timeout: 2000 }).toString().trim();
        systemInfo.diskFree = execSync("df -h / 2>/dev/null | awk 'NR==2 {print $4\" free of \"$2}' || echo 'N/A'", { timeout: 2000 }).toString().trim();
    } catch { systemInfo.error = "Could not gather system info"; }

    res.json({
        ok: true, service: "heady-ops", action: entry.action, requestId: entry.id,
        infrastructure: { ...systemInfo, containers: "podman", uptime: Math.floor((Date.now() - startTime) / 1000) },
        ts: entry.ts,
    });
});

router.get("/deploy", (req, res) => res.json({ ok: true, recentDeploys: opsLog.filter(e => e.action === "deploy").slice(-10) }));
router.get("/infrastructure", (req, res) => res.json({ ok: true, recentOps: opsLog.filter(e => e.action !== "deploy").slice(-10) }));

module.exports = router;

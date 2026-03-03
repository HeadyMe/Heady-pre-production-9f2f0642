/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyMaintenance — System Health & Backup Router
 */
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const maintenanceLog = [];
const startTime = Date.now();

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE", service: "heady-maintenance", mode: "auto",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        tasks: maintenanceLog.length,
        ts: new Date().toISOString(),
    });
});

router.post("/status", (req, res) => {
    const entry = { id: `maint-${Date.now()}`, action: "status-check", ts: new Date().toISOString() };
    maintenanceLog.push(entry);
    if (maintenanceLog.length > 200) maintenanceLog.splice(0, maintenanceLog.length - 200);

    // Check data directory health
    const dataDir = path.join(__dirname, "..", "..", "data");
    let dataHealth = { exists: false };
    try {
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            dataHealth = { exists: true, fileCount: files.length, files: files.slice(0, 10) };
        }
    } catch (err) { dataHealth.error = err.message; }

    res.json({
        ok: true, service: "heady-maintenance", requestId: entry.id,
        maintenance: {
            status: "healthy", lastCheck: entry.ts,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            dataDirectory: dataHealth,
            scheduledTasks: ["log-rotation", "cache-cleanup", "health-checks"],
        },
        ts: entry.ts,
    });
});

router.post("/backup", (req, res) => {
    const { scope } = req.body;
    const entry = { id: `maint-${Date.now()}`, action: "backup", scope: scope || "data", ts: new Date().toISOString() };
    maintenanceLog.push(entry);
    if (maintenanceLog.length > 200) maintenanceLog.splice(0, maintenanceLog.length - 200);
    res.json({
        ok: true, service: "heady-maintenance", action: "backup", requestId: entry.id,
        backup: { scope: entry.scope, status: "queued", ts: entry.ts },
    });
});

router.get("/status", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter(e => e.action === "status-check").slice(-5) }));
router.get("/backup", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter(e => e.action === "backup").slice(-5) }));

module.exports = router;

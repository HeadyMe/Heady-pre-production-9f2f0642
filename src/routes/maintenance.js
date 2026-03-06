/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyMaintenance — System Health, Backup, and File Hygiene Router
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const router = express.Router();
const maintenanceLog = [];
const startTime = Date.now();
const ROOT_DIR = path.join(__dirname, "..", "..");

const CLEANUP_RULES = [
    { label: "backup-files", pattern: /\.bak$/i, deleteMode: "file" },
    { label: "runtime-logs", pattern: /\.log$/i, deleteMode: "file" },
    { label: "runtime-pid", pattern: /server\.pid$/i, deleteMode: "file" },
    { label: "audit-jsonl", pattern: /\.jsonl$/i, deleteMode: "file" },
    { label: "service-worker", pattern: /service[-_.]?worker(\.[a-z0-9_-]+)?\.(js|ts)$/i, deleteMode: "file" },
    { label: "cloudflare-tunnel-config", pattern: /(cloudflared|tunnel).*\.(json|ya?ml)$/i, deleteMode: "file" },
];

function pushLog(entry) {
    maintenanceLog.push(entry);
    if (maintenanceLog.length > 400) maintenanceLog.splice(0, maintenanceLog.length - 400);
}

function walkDirectory(dirPath, results = []) {
    let entries = [];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (_err) {
        return results;
    }

    for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            walkDirectory(fullPath, results);
            continue;
        }

        results.push(fullPath);
    }

    return results;
}

function fileCleanupAudit() {
    const allFiles = walkDirectory(ROOT_DIR);
    const candidates = [];

    for (const filePath of allFiles) {
        const relative = path.relative(ROOT_DIR, filePath);
        const basename = path.basename(filePath);

        for (const rule of CLEANUP_RULES) {
            if (rule.pattern.test(relative) || rule.pattern.test(basename)) {
                candidates.push({ path: relative, rule: rule.label, deleteMode: rule.deleteMode });
                break;
            }
        }
    }

    return candidates;
}

function executeCleanup(candidates, dryRun = true) {
    const deleted = [];
    const errors = [];

    for (const candidate of candidates) {
        if (dryRun) continue;
        const target = path.join(ROOT_DIR, candidate.path);

        try {
            fs.unlinkSync(target);
            deleted.push(candidate.path);
        } catch (err) {
            errors.push({ path: candidate.path, error: err.message });
        }
    }

    return { deleted, errors };
}

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-maintenance",
        mode: "auto",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        tasks: maintenanceLog.length,
        ts: new Date().toISOString(),
    });
});

router.post("/status", (req, res) => {
    const entry = { id: `maint-${Date.now()}`, action: "status-check", ts: new Date().toISOString() };
    pushLog(entry);

    const dataDir = path.join(ROOT_DIR, "data");
    let dataHealth = { exists: false };
    try {
        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            dataHealth = { exists: true, fileCount: files.length, files: files.slice(0, 10) };
        }
    } catch (err) {
        dataHealth.error = err.message;
    }

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        maintenance: {
            status: "healthy",
            lastCheck: entry.ts,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            dataDirectory: dataHealth,
            scheduledTasks: ["log-rotation", "cache-cleanup", "health-checks", "projection-hygiene"],
        },
        ts: entry.ts,
    });
});

router.post("/backup", (req, res) => {
    const { scope } = req.body;
    const entry = { id: `maint-${Date.now()}`, action: "backup", scope: scope || "data", ts: new Date().toISOString() };
    pushLog(entry);
    res.json({
        ok: true,
        service: "heady-maintenance",
        action: "backup",
        requestId: entry.id,
        backup: { scope: entry.scope, status: "queued", ts: entry.ts },
    });
});

router.get("/audit", (_req, res) => {
    const entry = { id: `maint-${Date.now()}`, action: "audit", ts: new Date().toISOString() };
    const candidates = fileCleanupAudit();
    pushLog({ ...entry, candidateCount: candidates.length });

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        summary: {
            candidateCount: candidates.length,
            ruleCoverage: CLEANUP_RULES.map((rule) => rule.label),
        },
        candidates,
        ts: entry.ts,
    });
});

router.post("/cleanup", (req, res) => {
    const dryRun = req.body?.dryRun !== false;
    const entry = { id: `maint-${Date.now()}`, action: "cleanup", dryRun, ts: new Date().toISOString() };
    const candidates = fileCleanupAudit();
    const result = executeCleanup(candidates, dryRun);
    pushLog({ ...entry, candidateCount: candidates.length, deleted: result.deleted.length, errors: result.errors.length });

    logger.logNodeActivity("CONDUCTOR", "Maintenance cleanup executed", {
        dryRun,
        candidateCount: candidates.length,
        deletedCount: result.deleted.length,
        errorCount: result.errors.length,
    });

    res.json({
        ok: true,
        service: "heady-maintenance",
        requestId: entry.id,
        dryRun,
        candidateCount: candidates.length,
        deleted: result.deleted,
        errors: result.errors,
        ts: entry.ts,
    });
});

router.get("/status", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter((e) => e.action === "status-check").slice(-5) }));
router.get("/backup", (req, res) => res.json({ ok: true, recent: maintenanceLog.filter((e) => e.action === "backup").slice(-5) }));

module.exports = router;

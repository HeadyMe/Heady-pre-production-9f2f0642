/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const MAX_SCAN_FILES = 10_000;
const PRUNE_CANDIDATE_PATTERNS = [
    /service-worker(\..+)?\.js$/i,
    /\.tunnel\./i,
    /cloudflared\/.*legacy/i,
    /gcloud\/.*deprecated/i,
];
const NEVER_DELETE_PATTERNS = [/node_modules\//, /\.git\//, /\/tests\//, /configs\/cloudflared\//];

function walkFiles(rootDir) {
    const out = [];
    const stack = [rootDir];

    while (stack.length && out.length < MAX_SCAN_FILES) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            const rel = path.relative(PROJECT_ROOT, full).replace(/\\/g, "/");
            if (entry.isDirectory()) {
                if (entry.name === ".git" || entry.name === "node_modules") continue;
                stack.push(full);
                continue;
            }
            out.push(rel);
            if (out.length >= MAX_SCAN_FILES) break;
        }
    }

    return out;
}


function findStaleProjectionReferences(files, rootDir) {
    const flagged = [];
    for (const relPath of files) {
        if (!relPath.endsWith(".yaml") && !relPath.endsWith(".yml") && !relPath.endsWith(".json") && !relPath.endsWith(".js")) continue;
        const fullPath = path.join(rootDir, relPath);
        try {
            const content = fs.readFileSync(fullPath, "utf8");
            if (/service-worker/i.test(content) || /cloudflared.*tunnel/i.test(content) || /gcloud.*deprecated/i.test(content)) {
                flagged.push(relPath);
            }
        } catch {
            // ignore unreadable files
        }
    }
    return flagged;
}


function getGitSourceOfTruthStatus(rootDir) {
    try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: rootDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        const remotes = execSync("git remote", { cwd: rootDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim().split(/\n+/).filter(Boolean);
        const origin = remotes.includes("origin")
            ? execSync("git remote get-url origin", { cwd: rootDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim()
            : null;
        const dirty = execSync("git status --porcelain", { cwd: rootDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        return {
            ok: true,
            branch,
            origin,
            hasOrigin: !!origin,
            workingTreeClean: dirty.length === 0,
        };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

function buildPrunePlan(files) {
    const pruneCandidates = findPruneCandidates(files);
    return {
        dryRun: true,
        candidateCount: pruneCandidates.length,
        candidates: pruneCandidates,
        applyCommand: "POST /api/autonomy/maintenance/cleanup { \"apply\": true }",
    };
}

function isNeverDelete(filePath) {
    return NEVER_DELETE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function findPruneCandidates(files) {
    return files.filter((filePath) => PRUNE_CANDIDATE_PATTERNS.some((pattern) => pattern.test(filePath)))
        .filter((filePath) => !isNeverDelete(filePath));
}

class HeadyMaintenanceOps {
    constructor({ rootDir = PROJECT_ROOT } = {}) {
        this.rootDir = rootDir;
        this.lastAudit = null;
    }

    audit() {
        const files = walkFiles(this.rootDir);
        const pruneCandidates = findPruneCandidates(files);
        const staleProjectionReferences = findStaleProjectionReferences(files, this.rootDir);
        const gitSourceOfTruth = getGitSourceOfTruthStatus(this.rootDir);
        const prunePlan = buildPrunePlan(files);

        let projection = { ok: false, reason: "sync_projection_unavailable" };
        try {
            const syncBee = require("../bees/sync-projection-bee");
            const state = syncBee.getSyncState();
            projection = {
                ok: true,
                projectionCount: state.projectionCount,
                lastProjectionTime: state.lastProjectionTime,
                targets: state.targets,
            };
        } catch (error) {
            projection = { ok: false, reason: error.message };
        }

        const report = {
            ok: true,
            scannedFiles: files.length,
            pruneCandidates,
            projection,
            staleProjectionReferences,
            gitSourceOfTruth,
            prunePlan,
            generatedAt: new Date().toISOString(),
        };

        this.lastAudit = report;
        return report;
    }

    cleanup({ dryRun = true } = {}) {
        const report = this.audit();
        if (dryRun) {
            return { ok: true, dryRun: true, removed: [], ...report };
        }

        const removed = [];
        for (const relPath of report.pruneCandidates) {
            const fullPath = path.join(this.rootDir, relPath);
            try {
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    removed.push(relPath);
                }
            } catch (error) {
                logger.logError("SYSTEM", `Maintenance cleanup failed for ${relPath}`, error);
            }
        }

        return {
            ok: true,
            dryRun: false,
            removed,
            removedCount: removed.length,
            gitSourceOfTruth: report.gitSourceOfTruth,
            prunePlan: report.prunePlan,
            generatedAt: new Date().toISOString(),
        };
    }


    reconcileProjectionState() {
        const audit = this.audit();
        const healthyProjectionTargets = audit.projection?.ok
            ? Object.values(audit.projection.targets || {}).filter((target) => target.status === "synced").length
            : 0;

        return {
            ok: true,
            projectionOk: !!audit.projection?.ok,
            healthyProjectionTargets,
            staleReferenceCount: audit.staleProjectionReferences.length,
            pruneCandidateCount: audit.pruneCandidates.length,
            recommendation: audit.staleProjectionReferences.length > 0
                ? "run_maintenance_cleanup_and_projection_sync"
                : "projection_state_nominal",
            gitSourceOfTruth: audit.gitSourceOfTruth,
            prunePlan: audit.prunePlan,
            generatedAt: new Date().toISOString(),
        };
    }

    health() {
        return {
            ok: true,
            hasAudit: !!this.lastAudit,
            lastAuditAt: this.lastAudit?.generatedAt || null,
        };
    }
}

function registerMaintenanceOpsRoutes(app, maintenanceOps) {
    if (!app || typeof app.get !== "function" || typeof app.post !== "function") {
        throw new Error("Express app required to register maintenance routes.");
    }

    const controller = maintenanceOps || new HeadyMaintenanceOps();

    app.get("/api/autonomy/maintenance/health", (req, res) => {
        res.json(controller.health());
    });

    app.get("/api/autonomy/maintenance/audit", (req, res) => {
        res.json(controller.audit());
    });

    app.get("/api/autonomy/maintenance/prune-plan", (req, res) => {
        const audit = controller.audit();
        res.json({ ok: true, prunePlan: audit.prunePlan, generatedAt: audit.generatedAt });
    });

    app.get("/api/autonomy/maintenance/source-truth", (req, res) => {
        const audit = controller.audit();
        res.json({ ok: true, gitSourceOfTruth: audit.gitSourceOfTruth, generatedAt: audit.generatedAt });
    });

    app.get("/api/autonomy/maintenance/reconcile", (req, res) => {
        res.json(controller.reconcileProjectionState());
    });

    app.post("/api/autonomy/maintenance/cleanup", (req, res) => {
        const apply = req.body?.apply === true;
        const result = controller.cleanup({ dryRun: !apply });
        res.json(result);
    });

    logger.logSystem("Heady maintenance ops routes registered");
    return controller;
}

module.exports = {
    HeadyMaintenanceOps,
    registerMaintenanceOpsRoutes,
    findPruneCandidates,
    isNeverDelete,
    findStaleProjectionReferences,
    getGitSourceOfTruthStatus,
    buildPrunePlan,
};

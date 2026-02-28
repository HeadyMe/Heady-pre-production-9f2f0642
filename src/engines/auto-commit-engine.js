/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/engines/auto-commit-engine.js                        ║
// ║  LAYER: engines                                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * AutoCommitEngine — HCFP-integrated automatic git commit & push
 *
 * Features:
 *  - flock-based locking (prevents concurrent git operations)
 *  - Smart commit messages derived from git diff --stat
 *  - Exponential backoff on push failures
 *  - EventEmitter for pipeline integration
 *  - Registers as an HCFP task handler via registerWithPipeline()
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOCK_FILE = path.join(REPO_ROOT, ".git", "heady-auto-commit.lock");
const MAX_BACKOFF_MS = 300_000; // 5 minutes max backoff

class AutoCommitEngine extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.repoRoot = opts.repoRoot || REPO_ROOT;
        this.branch = opts.branch || "main";
        this.remote = opts.remote || "origin";
        this.consecutiveFailures = 0;
        this.lastCommitHash = null;
        this.lastPushAt = null;
        this.stats = {
            totalCommits: 0,
            totalPushes: 0,
            failedPushes: 0,
            filesCommitted: 0,
        };
    }

    // ── Logging (stdout/stderr — captured by PM2/Cloud Run) ────────────

    _log(level, msg) {
        const ts = new Date().toISOString();
        const line = `[auto-commit] [${ts}] [${level.toUpperCase()}] ${msg}`;
        if (level === "error") {
            console.error(line);
        } else {
            console.log(line);
        }
        this.emit("log", { ts, level, message: msg });
    }

    // ── Flock-based locking ──────────────────────────────────────────────

    _acquireLock() {
        // Check if lock exists and if owning process is still alive
        if (fs.existsSync(LOCK_FILE)) {
            try {
                const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
                if (pid && !isNaN(pid)) {
                    try {
                        process.kill(pid, 0); // check if alive
                        return false; // still alive, can't acquire
                    } catch (_) {
                        // PID is dead, stale lock — remove it
                        this._log("warn", `Removing stale lock from dead PID ${pid}`);
                    }
                }
            } catch (_) {
                // corrupt lock file, remove it
            }
            fs.unlinkSync(LOCK_FILE);
        }

        // Also clean up stale .git/index.lock from crashed git processes
        const indexLock = path.join(this.repoRoot, ".git", "index.lock");
        if (fs.existsSync(indexLock)) {
            this._log("warn", "Removing stale .git/index.lock");
            try { fs.unlinkSync(indexLock); } catch (_) { }
        }

        // Write our PID as the lock
        fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
        return true;
    }

    _releaseLock() {
        try {
            if (fs.existsSync(LOCK_FILE)) {
                const pid = fs.readFileSync(LOCK_FILE, "utf8").trim();
                if (pid === String(process.pid)) {
                    fs.unlinkSync(LOCK_FILE);
                }
            }
        } catch (_) { }
    }

    // ── Git helpers ──────────────────────────────────────────────────────

    _exec(cmd) {
        return execSync(cmd, {
            cwd: this.repoRoot,
            encoding: "utf8",
            timeout: 60_000,
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
    }

    _hasChanges() {
        try {
            const status = this._exec("git status --porcelain");
            return status.length > 0;
        } catch (err) {
            this._log("error", `git status failed: ${err.message}`);
            return false;
        }
    }

    _getChangeSummary() {
        try {
            // Stage everything first to get accurate diffstat
            this._exec("git add -A");
            const stat = this._exec("git diff --cached --stat --stat-width=80");
            if (!stat) return null;

            const lines = stat.split("\n").filter(Boolean);
            const summaryLine = lines[lines.length - 1]; // e.g. "5 files changed, 120 insertions(+), 30 deletions(-)"

            // Extract notable filenames (top 3 by change size)
            const fileLines = lines.slice(0, -1);
            const notable = fileLines
                .map((l) => {
                    const match = l.match(/^\s*(.+?)\s+\|\s+(\d+)/);
                    return match ? { file: path.basename(match[1].trim()), changes: parseInt(match[2], 10) } : null;
                })
                .filter(Boolean)
                .sort((a, b) => b.changes - a.changes)
                .slice(0, 3)
                .map((f) => f.file);

            const fileCount = fileLines.length;
            return { fileCount, notable, summaryLine };
        } catch (err) {
            this._log("error", `Change summary failed: ${err.message}`);
            return null;
        }
    }

    _buildCommitMessage(summary) {
        if (!summary) return "HCFP-AUTO: synchronize repository state";

        const notableStr = summary.notable.length > 0
            ? ` — ${summary.notable.join(", ")}`
            : "";

        return `HCFP-AUTO: ${summary.fileCount} file(s) changed${notableStr}`;
    }

    // ── Core operations ──────────────────────────────────────────────────

    /**
     * Main entry point — commit all pending changes and push.
     * @param {Object} opts
     * @param {string} opts.context - Optional context (e.g. "pipeline_run:run_123")
     * @returns {Object} { committed, pushed, commitHash, message, error }
     */
    async autoCommitAndPush(opts = {}) {
        if (!this._acquireLock()) {
            const msg = "Another auto-commit process is running, skipping";
            this._log("info", msg);
            return { committed: false, pushed: false, skipped: true, reason: msg };
        }

        try {
            // Check for changes
            if (!this._hasChanges()) {
                this._log("info", "No changes to commit. Repository is clean.");
                return { committed: false, pushed: false, clean: true };
            }

            // Build smart commit message
            const summary = this._getChangeSummary();
            let message = this._buildCommitMessage(summary);

            // Append pipeline context if provided
            if (opts.context) {
                message += `\n\nTriggered by: ${opts.context}`;
            }

            // Commit
            try {
                const commitOutput = this._exec(`git commit --no-verify -m "${message.replace(/"/g, '\\"')}"`);
                this.stats.totalCommits++;
                this.stats.filesCommitted += summary ? summary.fileCount : 0;

                // Get the commit hash
                this.lastCommitHash = this._exec("git rev-parse --short HEAD");
                this._log("info", `Committed ${this.lastCommitHash}: ${message.split("\n")[0]}`);
                this.emit("commit:success", {
                    hash: this.lastCommitHash,
                    message: message.split("\n")[0],
                    fileCount: summary ? summary.fileCount : 0,
                    context: opts.context,
                });
            } catch (err) {
                // git commit can fail if there's truly nothing to commit after staging
                if (err.message.includes("nothing to commit")) {
                    this._log("info", "Nothing to commit after staging.");
                    return { committed: false, pushed: false, clean: true };
                }
                throw err;
            }

            // Push with backoff
            try {
                this._exec(`git push ${this.remote} ${this.branch}`);
                this.stats.totalPushes++;
                this.consecutiveFailures = 0;
                this.lastPushAt = new Date().toISOString();
                this._log("info", `Successfully pushed ${this.lastCommitHash} to ${this.remote}/${this.branch}`);
                this.emit("push:success", {
                    hash: this.lastCommitHash,
                    remote: this.remote,
                    branch: this.branch,
                });

                return {
                    committed: true,
                    pushed: true,
                    commitHash: this.lastCommitHash,
                    message: message.split("\n")[0],
                    fileCount: summary ? summary.fileCount : 0,
                };
            } catch (pushErr) {
                this.consecutiveFailures++;
                this.stats.failedPushes++;
                const backoff = Math.min(
                    1000 * Math.pow(2, this.consecutiveFailures),
                    MAX_BACKOFF_MS
                );
                this._log(
                    "error",
                    `Push failed (attempt ${this.consecutiveFailures}), next backoff: ${backoff}ms — ${pushErr.message}`
                );
                this.emit("push:failed", {
                    hash: this.lastCommitHash,
                    error: pushErr.message,
                    consecutiveFailures: this.consecutiveFailures,
                    nextBackoffMs: backoff,
                });

                return {
                    committed: true,
                    pushed: false,
                    commitHash: this.lastCommitHash,
                    error: pushErr.message,
                    consecutiveFailures: this.consecutiveFailures,
                    nextBackoffMs: backoff,
                };
            }
        } catch (err) {
            this._log("error", `Auto-commit failed: ${err.message}`);
            this.emit("commit:failed", { error: err.message });
            return { committed: false, pushed: false, error: err.message };
        } finally {
            this._releaseLock();
        }
    }

    // ── Status ───────────────────────────────────────────────────────────

    async getStatus() {
        const hasChanges = this._hasChanges();
        let pendingCount = 0;
        if (hasChanges) {
            try {
                const status = this._exec("git status --porcelain");
                pendingCount = status.split("\n").filter(Boolean).length;
            } catch (_) { }
        }

        return {
            engine: "auto-commit-engine",
            version: "1.0.0",
            repoRoot: this.repoRoot,
            branch: this.branch,
            remote: this.remote,
            hasUncommittedChanges: hasChanges,
            pendingFileCount: pendingCount,
            lastCommitHash: this.lastCommitHash,
            lastPushAt: this.lastPushAt,
            consecutiveFailures: this.consecutiveFailures,
            stats: { ...this.stats },
        };
    }

    // ── Pipeline integration ─────────────────────────────────────────────

    /**
     * Register this engine as an HCFP pipeline task handler.
     * @param {Function} registerTaskHandler - from hc_pipeline.js
     */
    registerWithPipeline(registerTaskHandler) {
        const self = this;

        registerTaskHandler("auto_commit_and_push", async (context) => {
            const result = await self.autoCommitAndPush({
                context: `pipeline_run:${context.runId}`,
            });
            return {
                task: "auto_commit_and_push",
                status: result.error && !result.committed ? "failed" : "completed",
                result,
                durationMs: 0,
            };
        });

        this._log("info", "Registered auto_commit_and_push as HCFP pipeline task");
    }
}

// Singleton
const autoCommitEngine = new AutoCommitEngine();

module.exports = {
    AutoCommitEngine,
    autoCommitEngine,
};

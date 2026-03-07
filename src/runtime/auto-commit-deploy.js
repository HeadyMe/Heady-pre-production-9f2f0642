/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * AutoCommitDeploy — Permanent Git Auto-Commit, Push & Deploy Cycle
 *
 * Runs on a configurable interval (default: every 5 minutes).
 * Detects dirty working tree → stages all → commits with timestamp → pushes → logs.
 * Designed to be wired into the HCFullPipeline / AutoSuccessEngine lifecycle.
 *
 * ENV controls:
 *   AUTO_DEPLOY_INTERVAL_MS  — cycle interval (default 300000 = 5 min)
 *   AUTO_DEPLOY_BRANCH       — branch to push (default "main")
 *   AUTO_DEPLOY_REMOTE       — remote name (default "origin")
 *   AUTO_DEPLOY_ENABLED      — set to "false" to disable (default "true")
 */

const { execSync, exec } = require("child_process");
const path = require("path");
const logger = require("./utils/logger");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BRANCH = process.env.AUTO_DEPLOY_BRANCH || "main";
const REMOTE = process.env.AUTO_DEPLOY_REMOTE || "origin";

class AutoCommitDeploy {
    constructor(opts = {}) {
        this.interval = opts.interval || parseInt(process.env.AUTO_DEPLOY_INTERVAL_MS, 10) || DEFAULT_INTERVAL;
        this.enabled = (process.env.AUTO_DEPLOY_ENABLED || "true") !== "false";
        this.running = false;
        this.timer = null;
        this.cycleCount = 0;
        this.lastCommitHash = null;
        this.lastPushTs = null;
        this.stats = { commits: 0, pushes: 0, errors: 0, noChanges: 0 };
    }

    /** Start the auto-commit/push cycle */
    start() {
        if (!this.enabled) {
            logger.info("[AutoCommitDeploy] Disabled via AUTO_DEPLOY_ENABLED=false");
            return;
        }
        if (this.running) return;
        this.running = true;
        logger.info(`[AutoCommitDeploy] Started — cycling every ${this.interval / 1000}s on ${REMOTE}/${BRANCH}`);

        // Run immediately, then schedule
        this._cycle();
        this.timer = setInterval(() => this._cycle(), this.interval);
    }

    /** Stop the cycle */
    stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        logger.info("[AutoCommitDeploy] Stopped", { stats: this.stats });
    }

    /** Single commit-push cycle */
    _cycle() {
        this.cycleCount++;
        try {
            // 1. Check for dirty working tree
            const status = this._exec("git status --porcelain").trim();
            if (!status) {
                this.stats.noChanges++;
                return; // Nothing to commit — clean exit
            }

            // 2. Stage all changes
            this._exec("git add -A");

            // 3. Commit with auto-generated message
            const ts = new Date().toISOString();
            const fileCount = status.split("\n").length;
            const msg = `auto: pipeline cycle #${this.cycleCount} — ${fileCount} file(s) @ ${ts}`;
            this._exec(`git commit -m "${msg}"`);

            // 4. Capture commit hash
            this.lastCommitHash = this._exec("git rev-parse --short HEAD").trim();
            this.stats.commits++;
            logger.info(`[AutoCommitDeploy] Committed ${this.lastCommitHash}: ${fileCount} file(s)`);

            // 5. Push (async to avoid blocking the event loop)
            this._pushAsync();

        } catch (err) {
            this.stats.errors++;
            logger.error("[AutoCommitDeploy] Cycle error", { cycle: this.cycleCount, error: err.message });
        }
    }

    /** Async push to avoid blocking the Node.js event loop */
    _pushAsync() {
        exec(`git push ${REMOTE} ${BRANCH}`, { cwd: REPO_ROOT }, (err, stdout, stderr) => {
            if (err) {
                this.stats.errors++;
                logger.error("[AutoCommitDeploy] Push failed", { error: err.message, stderr });
                return;
            }
            this.lastPushTs = Date.now();
            this.stats.pushes++;
            logger.info(`[AutoCommitDeploy] Pushed ${this.lastCommitHash} → ${REMOTE}/${BRANCH}`);

            // Emit event for downstream deploy triggers (CI/CD webhooks handle actual deployment)
            if (global.eventBus) {
                global.eventBus.emit("auto-deploy:pushed", {
                    commit: this.lastCommitHash,
                    branch: BRANCH,
                    remote: REMOTE,
                    ts: this.lastPushTs,
                    cycle: this.cycleCount,
                });
            }
        });
    }

    /** Synchronous exec helper */
    _exec(cmd) {
        return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000 });
    }

    /** Get current status */
    getStatus() {
        return {
            enabled: this.enabled,
            running: this.running,
            cycleCount: this.cycleCount,
            intervalMs: this.interval,
            lastCommitHash: this.lastCommitHash,
            lastPushTs: this.lastPushTs,
            stats: { ...this.stats },
        };
    }
}

// Singleton
const autoCommitDeploy = new AutoCommitDeploy();
module.exports = autoCommitDeploy;

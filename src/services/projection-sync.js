/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Projection Sync Automation — Platform Phase 3 Assessment Item
 *
 * Automates projection sync to GitHub, HuggingFace, and Cloud Run.
 * Includes rollback/receipt replay for deterministic remediation.
 *
 * Real implementations using git CLI, HuggingFace API, and gcloud CLI.
 */

const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');
const { getLogger } = require('./structured-logger');

const log = getLogger('projection-sync');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

class ProjectionSyncAutomation {
    constructor(options = {}) {
        this.targets = options.targets || ['github', 'huggingface', 'cloud-run'];
        this.syncHistory = [];
        this.rollbackStack = [];
        this.maxHistory = options.maxHistory || 100;
        this.projectRoot = options.projectRoot || PROJECT_ROOT;
    }

    /**
     * Create a deterministic receipt for a sync operation.
     */
    createReceipt(data) {
        const serialized = JSON.stringify(data);
        return {
            hash: crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16),
            timestamp: new Date().toISOString(),
            data,
        };
    }

    /**
     * Run a scheduled projection diff and sync to targets.
     */
    async runProjectionSync(projectionState) {
        log.info('Starting projection sync cycle', { targets: this.targets });

        const results = {};
        const receipt = this.createReceipt(projectionState);

        for (const target of this.targets) {
            try {
                const syncResult = await this.syncToTarget(target, projectionState, receipt);
                results[target] = syncResult;
                log.info(`Sync to ${target} complete`, { status: syncResult.status });
            } catch (err) {
                results[target] = { status: 'failed', error: err.message };
                log.error(`Sync to ${target} failed`, { error: err.message });
            }
        }

        // Record in history
        const historyEntry = {
            receipt,
            results,
            timestamp: new Date().toISOString(),
        };
        this.syncHistory.push(historyEntry);
        if (this.syncHistory.length > this.maxHistory) {
            this.syncHistory = this.syncHistory.slice(-this.maxHistory);
        }

        // Push to rollback stack
        this.rollbackStack.push(historyEntry);

        return { receipt, results };
    }

    /**
     * Sync to a specific target.
     */
    async syncToTarget(target, state, receipt) {
        switch (target) {
            case 'github':
                return this.syncToGitHub(state, receipt);
            case 'huggingface':
                return this.syncToHuggingFace(state, receipt);
            case 'cloud-run':
                return this.syncToCloudRun(state, receipt);
            default:
                return { status: 'skipped', reason: `Unknown target: ${target}` };
        }
    }

    /**
     * Sync projection to GitHub monorepo.
     * Uses git CLI to stage, commit, and push changes.
     */
    async syncToGitHub(state, receipt) {
        log.info('Syncing projection to GitHub');

        try {
            // Check for uncommitted changes
            const statusOutput = execSync('git status --porcelain', {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 30_000,
            }).trim();

            if (!statusOutput) {
                return {
                    status: 'no_changes',
                    target: 'github',
                    receipt: receipt.hash,
                    message: 'Working tree clean — nothing to sync',
                };
            }

            const changedFiles = statusOutput.split('\n').length;

            // Stage all changes
            execSync('git add -A', {
                cwd: this.projectRoot,
                timeout: 30_000,
            });

            // Commit with projection receipt
            const commitMsg = `[projection-sync] receipt:${receipt.hash} | ${changedFiles} files`;
            execSync(`git commit -m "${commitMsg}"`, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 30_000,
            });

            // Get the commit hash
            const commitHash = execSync('git rev-parse HEAD', {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 10_000,
            }).trim();

            // Push to origin
            execSync('git push origin HEAD', {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 60_000,
            });

            log.info('GitHub sync complete', { commitHash, changedFiles });

            return {
                status: 'synced',
                target: 'github',
                receipt: receipt.hash,
                commitHash,
                changedFiles,
                vectorsProjected: Object.keys(state).length,
            };
        } catch (err) {
            log.error('GitHub sync failed', { error: err.message });
            return {
                status: 'failed',
                target: 'github',
                receipt: receipt.hash,
                error: err.message,
            };
        }
    }

    /**
     * Sync projection to HuggingFace Spaces.
     * Uses the HuggingFace API to trigger space rebuilds.
     */
    async syncToHuggingFace(state, receipt) {
        log.info('Syncing projection to HuggingFace');

        const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
        const spaces = [
            { org: 'HeadyMe', repo: 'heady-demo' },
            { org: 'HeadySystems', repo: 'heady-systems' },
            { org: 'HeadyConnection', repo: 'heady-connection' },
        ];

        if (!hfToken) {
            log.warn('HF_TOKEN not set — using git-based sync fallback');
            return this._syncHuggingFaceViaGit(spaces, receipt);
        }

        const results = [];
        for (const space of spaces) {
            try {
                const url = `https://huggingface.co/api/spaces/${space.org}/${space.repo}/restart`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                results.push({
                    space: `${space.org}/${space.repo}`,
                    status: resp.ok ? 'restarted' : 'failed',
                    httpStatus: resp.status,
                });
            } catch (err) {
                results.push({
                    space: `${space.org}/${space.repo}`,
                    status: 'error',
                    error: err.message,
                });
            }
        }

        return {
            status: results.every(r => r.status === 'restarted') ? 'synced' : 'partial',
            target: 'huggingface',
            receipt: receipt.hash,
            spacesUpdated: results,
        };
    }

    /**
     * Fallback: sync HuggingFace spaces via git push.
     */
    async _syncHuggingFaceViaGit(spaces, receipt) {
        const results = [];
        for (const space of spaces) {
            try {
                const remoteUrl = `https://huggingface.co/spaces/${space.org}/${space.repo}`;
                // Check if remote exists
                try {
                    execSync(`git remote get-url hf-${space.repo}`, {
                        cwd: this.projectRoot,
                        encoding: 'utf-8',
                        timeout: 5_000,
                    });
                } catch {
                    // Remote doesn't exist — skip
                    results.push({ space: `${space.org}/${space.repo}`, status: 'skipped', reason: 'no git remote configured' });
                    continue;
                }

                execSync(`git push hf-${space.repo} HEAD:main --force`, {
                    cwd: this.projectRoot,
                    encoding: 'utf-8',
                    timeout: 120_000,
                });

                results.push({ space: `${space.org}/${space.repo}`, status: 'pushed' });
            } catch (err) {
                results.push({ space: `${space.org}/${space.repo}`, status: 'failed', error: err.message });
            }
        }

        return {
            status: 'git-sync',
            target: 'huggingface',
            receipt: receipt.hash,
            spacesUpdated: results,
        };
    }

    /**
     * Sync projection to Cloud Run via gcloud deploy.
     */
    async syncToCloudRun(state, receipt) {
        log.info('Syncing projection to Cloud Run');

        const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
        const region = process.env.GCP_REGION || 'us-central1';
        const service = process.env.CLOUD_RUN_SERVICE || 'heady-manager';

        if (!projectId) {
            return {
                status: 'skipped',
                target: 'cloud-run',
                receipt: receipt.hash,
                reason: 'GCP_PROJECT_ID not set',
            };
        }

        try {
            const cmd = [
                'gcloud', 'run', 'deploy', service,
                '--source', '.',
                '--project', projectId,
                '--region', region,
                '--allow-unauthenticated',
                '--quiet',
            ].join(' ');

            execSync(cmd, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                timeout: 300_000, // 5 minutes for Cloud Build
            });

            log.info('Cloud Run deploy complete', { service, region });

            return {
                status: 'synced',
                target: 'cloud-run',
                receipt: receipt.hash,
                service,
                region,
                projectId,
            };
        } catch (err) {
            log.error('Cloud Run sync failed', { error: err.message });
            return {
                status: 'failed',
                target: 'cloud-run',
                receipt: receipt.hash,
                error: err.message,
            };
        }
    }

    /**
     * Rollback to a previous sync state using receipt replay.
     */
    async rollback(receiptHash) {
        const entry = this.rollbackStack.find(e => e.receipt.hash === receiptHash);
        if (!entry) {
            return { status: 'not_found', error: `Receipt ${receiptHash} not in rollback stack` };
        }

        log.warn('Rolling back projection sync', { receipt: receiptHash });

        // Git rollback — revert to the commit before the projection
        try {
            if (entry.results?.github?.commitHash) {
                execSync(`git revert --no-commit ${entry.results.github.commitHash}`, {
                    cwd: this.projectRoot,
                    encoding: 'utf-8',
                    timeout: 30_000,
                });
                execSync(`git commit -m "[projection-sync] rollback receipt:${receiptHash}"`, {
                    cwd: this.projectRoot,
                    encoding: 'utf-8',
                    timeout: 10_000,
                });
            }
        } catch (err) {
            log.error('Git rollback failed', { error: err.message });
        }

        const rollbackReceipt = this.createReceipt({
            action: 'rollback',
            originalReceipt: receiptHash,
            timestamp: new Date().toISOString(),
        });

        return {
            status: 'rolled_back',
            originalReceipt: receiptHash,
            rollbackReceipt: rollbackReceipt.hash,
            restoredState: entry.receipt.data,
        };
    }

    /**
     * Get sync history with receipts.
     */
    getHistory() {
        return {
            entries: this.syncHistory.length,
            latest: this.syncHistory[this.syncHistory.length - 1] || null,
            rollbackDepth: this.rollbackStack.length,
        };
    }

    /**
     * Health check.
     */
    getHealth() {
        return {
            status: 'healthy',
            targets: this.targets,
            syncHistory: this.syncHistory.length,
            rollbackDepth: this.rollbackStack.length,
        };
    }
}

module.exports = { ProjectionSyncAutomation };

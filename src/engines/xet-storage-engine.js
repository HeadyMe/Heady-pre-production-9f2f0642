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
// ║  FILE: src/engines/xet-storage-engine.js                        ║
// ║  LAYER: engines                                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * XetStorageEngine — Hugging Face Datasets / Xet Integration
 *
 * This engine synchronizes massive volumes of local state (e.g., Vector Shards,
 * Simulation Outputs, and Model Checkpoints) directly to Hugging Face Datasets
 * via the Hub API, leveraging Xet's underlying block-level deduplication tech.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class XetStorageEngine {
    constructor(opts = {}) {
        this.hfToken = opts.hfToken || process.env.HF_TOKEN;
        this.org = opts.org || 'HeadyMe';
        this.datasetTemplate = opts.datasetTemplate || 'heady-liquid-state';
        this.enabled = !!this.hfToken;
        this.baseUrl = 'https://huggingface.co/api';

        // Config for chunked upload vs direct
        this.maxDirectUploadBytes = 10 * 1024 * 1024; // 10MB
    }

    _log(level, msg) {
        const ts = new Date().toISOString();
        const line = `[xet-storage] [${ts}] [${level.toUpperCase()}] ${msg}`;
        if (level === 'error') console.error(line);
        else console.log(line);
        if (global.eventBus) global.eventBus.emit('log', { source: 'xet-storage', level, msg });
    }

    /**
     * Ensures the target dataset repository exists on HF.
     * Creates it if it doesn't.
     */
    async _ensureDataset(repoName) {
        if (!this.enabled) return false;

        try {
            const checkRes = await fetch(`${this.baseUrl}/datasets/${this.org}/${repoName}`, {
                headers: {
                    'Authorization': `Bearer ${this.hfToken}`
                }
            });

            if (checkRes.ok) return true; // Exists

            if (checkRes.status === 404 || checkRes.status === 401) {
                // Attempt creation
                const createRes = await fetch(`${this.baseUrl}/repos/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.hfToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: repoName,
                        organization: this.org,
                        type: 'dataset',
                        private: true
                    })
                });

                if (createRes.ok) {
                    this._log('info', `Created new HF Dataset Xet repository: ${this.org}/${repoName}`);
                    return true;
                } else {
                    const errBody = await createRes.text();
                    this._log('error', `Failed to create repository ${repoName}: ${errBody}`);
                    return false;
                }
            }

            this._log('error', `Unexpected status checking repo ${repoName}: ${checkRes.status}`);
            return false;
        } catch (err) {
            this._log('error', `Error ensuring dataset: ${err.message}`);
            return false;
        }
    }

    /**
     * Syncs a single file to Hugging Face Datasets utilizing the Commit API.
     * This is optimal for updating configuration states and vector shards.
     */
    async syncFileToXet(datasetName, localFilePath, targetPathInRepo, commitMessage = "HCFP-AUTO: Sync local state to Xet") {
        if (!this.enabled) {
            this._log('warn', 'HF_TOKEN missing, Xet sync disabled');
            return { success: false, reason: 'missing_token' };
        }

        if (!fs.existsSync(localFilePath)) {
            this._log('error', `Local file not found: ${localFilePath}`);
            throw new Error(`Local file missing: ${localFilePath}`);
        }

        const repoName = datasetName || this.datasetTemplate;
        const isReady = await _ensureDataset(repoName);
        if (!isReady) throw new Error("Dataset repository not ready.");

        try {
            // For large files we'd use LFS chunking, but for most state this is sufficient
            // Read file in base64 to avoid encoding issues with binary shards
            const fileBuffer = fs.readFileSync(localFilePath);
            const base64Content = fileBuffer.toString('base64');

            const payload = {
                operations: [
                    {
                        operation: "addOrUpdate",
                        path: targetPathInRepo,
                        content: base64Content,
                        encoding: "base64"
                    }
                ],
                commit_message: commitMessage
            };

            const res = await fetch(`${this.baseUrl}/datasets/${this.org}/${repoName}/commit/main`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.hfToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                this._log('info', `Successfully synced ${targetPathInRepo} to Xet storage: ${data.commit.oid}`);
                return { success: true, commitHash: data.commit.oid };
            } else {
                const errText = await res.text();
                this._log('error', `Failed to sync ${targetPathInRepo}: ${errText}`);
                return { success: false, error: errText };
            }
        } catch (err) {
            this._log('error', `Xet sync exception for ${targetPathInRepo}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Sync an entire directory recursively to Xet
     * Pushes all files in a single commit via the HF API
     */
    async syncDirectoryToXet(datasetName, localDirPath, targetDirInRepo, commitMessage = "HCFP-AUTO: Sync vector shards to Xet") {
        if (!this.enabled) return { success: false, reason: 'missing_token' };

        if (!fs.existsSync(localDirPath)) {
            this._log('error', `Directory not found: ${localDirPath}`);
            return { success: false, error: 'dir_not_found' };
        }

        const repoName = datasetName || this.datasetTemplate;
        const isReady = await this._ensureDataset(repoName);
        if (!isReady) return { success: false, error: 'repo_setup_failed' };

        try {
            // Find all files
            const operations = [];

            const walkSync = (dir, filelist = []) => {
                fs.readdirSync(dir).forEach(file => {
                    const filepath = path.join(dir, file);
                    if (fs.statSync(filepath).isDirectory()) {
                        filelist = walkSync(filepath, filelist);
                    } else {
                        // Relpath calculation
                        const relPath = path.relative(localDirPath, filepath);
                        const repoPath = targetDirInRepo ? path.posix.join(targetDirInRepo, relPath) : relPath;

                        operations.push({
                            operation: "addOrUpdate",
                            path: repoPath,
                            content: fs.readFileSync(filepath).toString('base64'),
                            encoding: "base64"
                        });
                    }
                });
                return filelist;
            };

            walkSync(localDirPath);

            if (operations.length === 0) {
                this._log('info', 'No files to sync in directory.');
                return { success: true, files: 0 };
            }

            this._log('info', `Syncing ${operations.length} files to Xet ${this.org}/${repoName}...`);

            const payload = {
                operations,
                commit_message: `${commitMessage} (${operations.length} files)`
            };

            const res = await fetch(`${this.baseUrl}/datasets/${this.org}/${repoName}/commit/main`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.hfToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                this._log('info', `Successfully synced directory to Xet. Commit: ${data.commit.oid}`);
                return { success: true, filesSynced: operations.length, commitHash: data.commit.oid };
            } else {
                const errText = await res.text();
                this._log('error', `Failed to sync directory: ${errText}`);
                return { success: false, error: errText };
            }
        } catch (err) {
            this._log('error', `Directory sync exception: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Retrieves a file from Xet dataset and writes it locally.
     */
    async pullFileFromXet(datasetName, repoFilePath, localDestPath) {
        if (!this.enabled) return { success: false, reason: 'missing_token' };

        const repoName = datasetName || this.datasetTemplate;

        try {
            // Fetch raw file content
            const res = await fetch(`https://huggingface.co/datasets/${this.org}/${repoName}/resolve/main/${repoFilePath}`, {
                headers: {
                    'Authorization': `Bearer ${this.hfToken}`
                }
            });

            if (!res.ok) {
                if (res.status === 404) {
                    this._log('warn', `File not found in Xet: ${repoFilePath}`);
                    return { success: false, error: 'not_found' };
                }
                throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
            }

            // Ensure local destination directory exists
            const dir = path.dirname(localDestPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const dest = fs.createWriteStream(localDestPath);
            res.body.pipe(dest);

            return new Promise((resolve, reject) => {
                dest.on('finish', () => {
                    this._log('info', `Pulled ${repoFilePath} from Xet to ${localDestPath}`);
                    resolve({ success: true, path: localDestPath });
                });
                dest.on('error', (err) => {
                    this._log('error', `Write stream error pulling ${repoFilePath}: ${err.message}`);
                    reject(err);
                });
            });
        } catch (err) {
            this._log('error', `Failed to pull ${repoFilePath} from Xet: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
}

// Singleton export
const xetStorageEngine = new XetStorageEngine();

module.exports = {
    XetStorageEngine,
    xetStorageEngine
};

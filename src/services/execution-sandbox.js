/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ExecutionSandbox — Isolated execution contexts for subtasks.
 * Each subtask runs in its own sandbox with a dedicated working
 * directory, environment variables, and cleanup lifecycle.
 *
 * For local execution: uses tmp directories with process isolation.
 * For cloud execution: spawns Cloud Run jobs (future).
 *
 * @module execution-sandbox
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

const SANDBOX_BASE = path.join(os.tmpdir(), 'heady-sandbox');

class SandboxContext {
    /**
     * @param {object} opts
     * @param {string} opts.id       - Unique sandbox ID
     * @param {string} opts.cwd      - Sandbox working directory
     * @param {string} opts.taskId   - Parent task ID
     * @param {string} opts.subtaskId - Subtask ID
     * @param {string} opts.type     - Subtask type
     * @param {boolean} opts.isRetry - Whether this is a retry attempt
     */
    constructor(opts) {
        this.id = opts.id;
        this.cwd = opts.cwd;
        this.taskId = opts.taskId;
        this.subtaskId = opts.subtaskId;
        this.type = opts.type;
        this.isRetry = opts.isRetry || false;
        this.createdAt = Date.now();
        this.cleanedUp = false;
        this.artifacts = [];
    }

    /**
     * Run a function inside the sandbox context.
     * @param {Function} fn - async (env) => result
     * @returns {Promise<*>}
     */
    async run(fn) {
        const env = {
            cwd: this.cwd,
            sandboxId: this.id,
            taskId: this.taskId,
            subtaskId: this.subtaskId,
            writeFile: (name, content) => this._writeFile(name, content),
            readFile: (name) => this._readFile(name),
            exec: (cmd) => this._exec(cmd),
            listFiles: () => this._listFiles(),
        };

        return fn(env);
    }

    /** Write a file inside the sandbox. */
    _writeFile(name, content) {
        const filePath = path.join(this.cwd, name);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        this.artifacts.push(filePath);
        return filePath;
    }

    /** Read a file from the sandbox. */
    _readFile(name) {
        const filePath = path.join(this.cwd, name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Sandbox file not found: ${name}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    }

    /** Execute a command in the sandbox. */
    _exec(cmd) {
        try {
            return execSync(cmd, {
                cwd: this.cwd,
                timeout: 30_000,
                encoding: 'utf-8',
                stdio: 'pipe',
            });
        } catch (err) {
            throw new Error(`Sandbox exec failed: ${err.message}\nstderr: ${(err.stderr || '').slice(0, 300)}`);
        }
    }

    /** List all files in the sandbox. */
    _listFiles() {
        if (!fs.existsSync(this.cwd)) return [];
        return fs.readdirSync(this.cwd, { recursive: true })
            .filter(f => !f.startsWith('.'));
    }

    /**
     * Cleanup the sandbox — remove temporary files.
     */
    async cleanup() {
        if (this.cleanedUp) return;
        try {
            if (fs.existsSync(this.cwd)) {
                fs.rmSync(this.cwd, { recursive: true, force: true });
            }
            this.cleanedUp = true;
        } catch (err) {
            logger.warn({ sandboxId: this.id, err: err.message }, 'Sandbox cleanup failed');
        }
    }
}

class ExecutionSandbox {
    constructor(opts = {}) {
        this.baseDir = opts.baseDir || SANDBOX_BASE;
        this.activeSandboxes = new Map();
        this.stats = { created: 0, cleaned: 0 };

        // Ensure base directory exists
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Create an isolated sandbox context for a subtask.
     *
     * @param {object} opts
     * @param {string} opts.taskId
     * @param {string} opts.subtaskId
     * @param {string} opts.type
     * @param {boolean} [opts.isRetry]
     * @returns {Promise<SandboxContext>}
     */
    async create(opts) {
        const sandboxId = `sb_${crypto.randomBytes(6).toString('hex')}`;
        const cwd = path.join(this.baseDir, sandboxId);

        fs.mkdirSync(cwd, { recursive: true });

        const ctx = new SandboxContext({
            id: sandboxId,
            cwd,
            taskId: opts.taskId,
            subtaskId: opts.subtaskId,
            type: opts.type,
            isRetry: opts.isRetry,
        });

        this.activeSandboxes.set(sandboxId, ctx);
        this.stats.created++;

        logger.debug({ sandboxId, taskId: opts.taskId, subtaskId: opts.subtaskId }, 'Sandbox created');
        return ctx;
    }

    /**
     * Cleanup all active sandboxes.
     */
    async cleanupAll() {
        for (const [id, ctx] of this.activeSandboxes) {
            await ctx.cleanup();
            this.activeSandboxes.delete(id);
            this.stats.cleaned++;
        }
    }

    /** Get stats. */
    getStats() {
        return {
            ...this.stats,
            active: this.activeSandboxes.size,
        };
    }
}

module.exports = { ExecutionSandbox, SandboxContext };

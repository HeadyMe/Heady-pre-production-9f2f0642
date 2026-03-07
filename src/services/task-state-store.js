/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * TaskStateStore — Persistent task state using vector memory.
 * Stores and retrieves task state so tasks survive process restarts,
 * deployments, and machine migrations. Any agent can pick up where
 * another left off by querying the task's state.
 *
 * Currently uses filesystem-backed JSON with future pgvector integration.
 *
 * @module task-state-store
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'task-state');

class TaskStateStore {
    /**
     * @param {object} opts
     * @param {string} [opts.stateDir] - Directory for state files
     * @param {object} [opts.vectorMemory] - pgvector memory service (optional)
     */
    constructor(opts = {}) {
        this.stateDir = opts.stateDir || STATE_DIR;
        this.vectorMemory = opts.vectorMemory || null;
        this.cache = new Map();

        // Ensure state directory exists
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
    }

    /**
     * Save task state.
     * @param {string} taskId
     * @param {object} state
     */
    async save(taskId, state) {
        // Merge with existing state
        const existing = await this.load(taskId);
        const merged = { ...existing, ...state, updatedAt: new Date().toISOString() };

        // Write to filesystem
        const filePath = this._filePath(taskId);
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');

        // Update cache
        this.cache.set(taskId, merged);

        // Embed in vector memory if available
        if (this.vectorMemory) {
            try {
                await this.vectorMemory.store({
                    content: JSON.stringify({ taskId, ...merged }),
                    metadata: { type: 'task_state', taskId },
                });
            } catch (err) {
                logger.warn({ taskId, err: err.message }, 'Failed to embed task state');
            }
        }
    }

    /**
     * Load task state.
     * @param {string} taskId
     * @returns {Promise<object|null>}
     */
    async load(taskId) {
        // Check cache first
        if (this.cache.has(taskId)) {
            return this.cache.get(taskId);
        }

        // Check filesystem
        const filePath = this._filePath(taskId);
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                this.cache.set(taskId, data);
                return data;
            } catch (err) {
                logger.warn({ taskId, err: err.message }, 'Failed to load task state from file');
            }
        }

        return null;
    }

    /**
     * List all stored task states.
     * @param {object} [filters] - { status, since }
     * @returns {Promise<object[]>}
     */
    async list(filters = {}) {
        const results = [];

        if (!fs.existsSync(this.stateDir)) return results;

        const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), 'utf-8'));

                if (filters.status && data.status !== filters.status) continue;
                if (filters.since && new Date(data.updatedAt) < new Date(filters.since)) continue;

                results.push(data);
            } catch {
                // Skip corrupt files
            }
        }

        return results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    /**
     * Delete task state.
     * @param {string} taskId
     */
    async delete(taskId) {
        this.cache.delete(taskId);
        const filePath = this._filePath(taskId);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    /**
     * Cleanup old completed/failed task states.
     * @param {number} [maxAgeDays=7]
     * @returns {Promise<number>} Number of cleaned up states
     */
    async cleanup(maxAgeDays = 7) {
        const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        let cleaned = 0;

        if (!fs.existsSync(this.stateDir)) return 0;

        const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), 'utf-8'));
                if (['completed', 'failed'].includes(data.status) &&
                    new Date(data.updatedAt).getTime() < cutoff) {
                    fs.unlinkSync(path.join(this.stateDir, file));
                    cleaned++;
                }
            } catch {
                // Skip corrupt files
            }
        }

        logger.info({ cleaned, maxAgeDays }, 'Task state cleanup complete');
        return cleaned;
    }

    /** @private */
    _filePath(taskId) {
        return path.join(this.stateDir, `${taskId}.json`);
    }
}

module.exports = { TaskStateStore };

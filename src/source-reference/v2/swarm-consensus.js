/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ─── SwarmConsensus — Distributed File Locking & Heartbeat ─────
 *
 * Concurrency control for multi-agent codebase editing.
 * Prevents conflicting edits when multiple bees or nodes
 * operate on the same file simultaneously.
 *
 * Architecture:
 *   Lock request → acquire(file, owner) → heartbeat → release/expire
 *   All locks are RAM-first (no external DB dependency).
 *   Lock state can be persisted to vector memory for audit.
 *
 * Lock Types:
 *   exclusive  — only one writer at a time (default)
 *   shared     — multiple readers, no writers while readers active
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 * ──────────────────────────────────────────────────────────────────
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

const PHI = (1 + Math.sqrt(5)) / 2;
const DEFAULT_LOCK_TTL_MS = Math.round(PHI * 30000); // ~48.5s
const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 5000); // ~8.09s
const STALE_CHECK_INTERVAL_MS = Math.round(PHI * 10000); // ~16.18s

class SwarmConsensus extends EventEmitter {
    constructor() {
        super();
        this.locks = new Map();          // filePath → { owner, type, acquiredAt, expiresAt, heartbeats }
        this.waitQueues = new Map();     // filePath → [{ owner, resolve, reject }]
        this.staleTimer = null;
        this.totalAcquired = 0;
        this.totalReleased = 0;
        this.totalExpired = 0;
        this.totalConflicts = 0;
    }

    // ── Lock Acquisition ────────────────────────────────────────
    /**
     * Acquire a lock on a file path.
     * @param {string} filePath  - Path to lock
     * @param {string} owner     - Owner identifier (beeId, nodeId, etc.)
     * @param {object} opts      - { type: 'exclusive'|'shared', ttlMs, wait }
     * @returns {Promise<object>} Lock result
     */
    async acquire(filePath, owner, opts = {}) {
        const type = opts.type || 'exclusive';
        const ttlMs = opts.ttlMs || DEFAULT_LOCK_TTL_MS;

        const existing = this.locks.get(filePath);

        if (existing) {
            // Shared locks can coexist with other shared locks
            if (type === 'shared' && existing.type === 'shared') {
                existing.owners = existing.owners || [existing.owner];
                if (!existing.owners.includes(owner)) {
                    existing.owners.push(owner);
                }
                this.totalAcquired++;
                return { ok: true, filePath, owner, type: 'shared', coOwners: existing.owners };
            }

            // Conflict: file is already locked
            this.totalConflicts++;

            if (opts.wait) {
                // Queue and wait for release
                return new Promise((resolve, reject) => {
                    if (!this.waitQueues.has(filePath)) {
                        this.waitQueues.set(filePath, []);
                    }
                    const timeout = setTimeout(() => {
                        reject(new Error(`Lock wait timeout for ${filePath}`));
                    }, opts.waitTimeout || 30000);

                    this.waitQueues.get(filePath).push({
                        owner,
                        type,
                        ttlMs,
                        resolve: (result) => { clearTimeout(timeout); resolve(result); },
                        reject: (err) => { clearTimeout(timeout); reject(err); },
                    });
                });
            }

            return {
                ok: false,
                error: `File locked by ${existing.owner}`,
                filePath,
                lockedBy: existing.owner,
                expiresAt: existing.expiresAt,
            };
        }

        // Acquire
        const now = Date.now();
        const lock = {
            owner,
            type,
            acquiredAt: now,
            expiresAt: now + ttlMs,
            heartbeats: 0,
        };

        this.locks.set(filePath, lock);
        this.totalAcquired++;
        this.emit('lock:acquired', { filePath, owner, type });
        logger.info(`[SwarmConsensus] Lock acquired: ${filePath} by ${owner}`);

        return { ok: true, filePath, owner, type, expiresAt: lock.expiresAt };
    }

    // ── Lock Release ────────────────────────────────────────────
    release(filePath, owner) {
        const lock = this.locks.get(filePath);
        if (!lock) return { ok: false, error: 'No lock exists' };

        // For shared locks, remove only this owner
        if (lock.type === 'shared' && lock.owners) {
            lock.owners = lock.owners.filter(o => o !== owner);
            if (lock.owners.length > 0) {
                return { ok: true, filePath, remainingOwners: lock.owners };
            }
        }

        if (lock.owner !== owner && !lock.owners?.includes(owner)) {
            return { ok: false, error: `Lock owned by ${lock.owner}, not ${owner}` };
        }

        this.locks.delete(filePath);
        this.totalReleased++;
        this.emit('lock:released', { filePath, owner });

        // Process wait queue
        this._processWaitQueue(filePath);

        return { ok: true, filePath, released: true };
    }

    // ── Heartbeat ───────────────────────────────────────────────
    /**
     * Extend a lock's TTL (called by the lock holder to keep it alive).
     */
    heartbeat(filePath, owner) {
        const lock = this.locks.get(filePath);
        if (!lock) return { ok: false, error: 'No lock exists' };
        if (lock.owner !== owner) return { ok: false, error: 'Not lock owner' };

        lock.expiresAt = Date.now() + DEFAULT_LOCK_TTL_MS;
        lock.heartbeats++;

        return { ok: true, filePath, newExpiry: lock.expiresAt, heartbeats: lock.heartbeats };
    }

    // ── Stale Lock Cleanup ──────────────────────────────────────
    startStaleCheck() {
        if (this.staleTimer) return;
        this.staleTimer = setInterval(() => {
            const now = Date.now();
            for (const [filePath, lock] of this.locks) {
                if (now > lock.expiresAt) {
                    logger.warn(`[SwarmConsensus] Expired lock: ${filePath} (owner: ${lock.owner})`);
                    this.locks.delete(filePath);
                    this.totalExpired++;
                    this.emit('lock:expired', { filePath, owner: lock.owner });
                    this._processWaitQueue(filePath);
                }
            }
        }, STALE_CHECK_INTERVAL_MS);
    }

    stopStaleCheck() {
        if (this.staleTimer) {
            clearInterval(this.staleTimer);
            this.staleTimer = null;
        }
    }

    // ── Wait Queue Processing ───────────────────────────────────
    async _processWaitQueue(filePath) {
        const queue = this.waitQueues.get(filePath);
        if (!queue || queue.length === 0) return;

        const next = queue.shift();
        if (queue.length === 0) this.waitQueues.delete(filePath);

        try {
            const result = await this.acquire(filePath, next.owner, {
                type: next.type,
                ttlMs: next.ttlMs,
            });
            next.resolve(result);
        } catch (err) {
            next.reject(err);
        }
    }

    // ── Query ───────────────────────────────────────────────────
    getLocks() {
        const result = {};
        for (const [filePath, lock] of this.locks) {
            result[filePath] = {
                owner: lock.owner,
                type: lock.type,
                acquiredAt: lock.acquiredAt,
                expiresAt: lock.expiresAt,
                heartbeats: lock.heartbeats,
                remainingMs: Math.max(0, lock.expiresAt - Date.now()),
            };
        }
        return result;
    }

    isLocked(filePath) {
        const lock = this.locks.get(filePath);
        if (!lock) return false;
        if (Date.now() > lock.expiresAt) {
            this.locks.delete(filePath);
            this.totalExpired++;
            return false;
        }
        return true;
    }

    // ── Status ──────────────────────────────────────────────────
    getStatus() {
        return {
            activeLocks: this.locks.size,
            waitQueueDepth: Array.from(this.waitQueues.values()).reduce((s, q) => s + q.length, 0),
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            totalExpired: this.totalExpired,
            totalConflicts: this.totalConflicts,
            staleCheckActive: !!this.staleTimer,
            lockTtlMs: DEFAULT_LOCK_TTL_MS,
            locks: this.getLocks(),
        };
    }
}

// ── Singleton ─────────────────────────────────────────────────
const consensus = new SwarmConsensus();

// ── REST Endpoints ────────────────────────────────────────────
function registerConsensusRoutes(app) {
    app.post('/api/consensus/acquire', async (req, res) => {
        try {
            const { filePath, owner, type, ttlMs, wait } = req.body;
            if (!filePath || !owner) return res.status(400).json({ ok: false, error: 'filePath and owner required' });
            const result = await consensus.acquire(filePath, owner, { type, ttlMs, wait });
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.post('/api/consensus/release', (req, res) => {
        const { filePath, owner } = req.body;
        if (!filePath || !owner) return res.status(400).json({ ok: false, error: 'filePath and owner required' });
        res.json(consensus.release(filePath, owner));
    });

    app.post('/api/consensus/heartbeat', (req, res) => {
        const { filePath, owner } = req.body;
        res.json(consensus.heartbeat(filePath, owner));
    });

    app.get('/api/consensus/status', (req, res) => {
        res.json({ ok: true, ...consensus.getStatus() });
    });

    app.get('/api/consensus/check/:filePath', (req, res) => {
        const filePath = decodeURIComponent(req.params.filePath);
        res.json({ ok: true, filePath, locked: consensus.isLocked(filePath) });
    });
}

module.exports = { SwarmConsensus, consensus, registerConsensusRoutes };

/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Redis Connection Pool — Phase 5 Performance Hardening
 *
 * High-performance Redis connection pooling for Buddy chat messages,
 * vector cache, and session state. Prevents connection exhaustion
 * under high-frequency multi-agent workloads.
 */

const { getLogger } = require('./structured-logger');
const logger = getLogger('redis-pool');

// ── Pool Configuration ───────────────────────────────────────
const DEFAULT_CONFIG = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxConnections: parseInt(process.env.REDIS_POOL_MAX || '20', 10),
    minConnections: parseInt(process.env.REDIS_POOL_MIN || '3', 10),
    acquireTimeoutMs: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT || '5000', 10),
    idleTimeoutMs: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000', 10),
    retryDelayMs: 1000,
    maxRetries: 3,
};

// ── Connection Pool Implementation ──────────────────────────
class RedisConnectionPool {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.pool = [];
        this.inUse = new Set();
        this.waitQueue = [];
        this.stats = {
            totalAcquired: 0,
            totalReleased: 0,
            totalCreated: 0,
            totalDestroyed: 0,
            totalTimeouts: 0,
            peakConnections: 0,
            avgAcquireTimeMs: 0,
            _acquireTimes: [],
        };
        this._maintenanceTimer = null;
        this._initialized = false;
    }

    async initialize() {
        if (this._initialized) return;

        // Pre-warm the pool with minimum connections
        for (let i = 0; i < this.config.minConnections; i++) {
            try {
                const conn = await this._createConnection();
                this.pool.push(conn);
            } catch (err) {
                logger.warn('Pool pre-warm connection failed', { error: err.message });
            }
        }

        // Start idle connection reaper
        this._maintenanceTimer = setInterval(() => this._runMaintenance(), this.config.idleTimeoutMs);
        this._initialized = true;

        logger.info('Redis connection pool initialized', {
            minConnections: this.config.minConnections,
            maxConnections: this.config.maxConnections,
            poolSize: this.pool.length,
        });
    }

    async acquire() {
        const startTime = Date.now();

        // Try to get an idle connection from pool
        if (this.pool.length > 0) {
            const conn = this.pool.pop();
            if (this._isAlive(conn)) {
                this.inUse.add(conn);
                this._recordAcquire(startTime);
                return conn;
            }
            // Dead connection, destroy it
            this._destroyConnection(conn);
        }

        // Create a new connection if under max
        if (this.inUse.size + this.pool.length < this.config.maxConnections) {
            try {
                const conn = await this._createConnection();
                this.inUse.add(conn);
                this._recordAcquire(startTime);
                return conn;
            } catch (err) {
                logger.error('Failed to create Redis connection', { error: err.message });
                throw err;
            }
        }

        // Wait for a connection to be released
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.stats.totalTimeouts++;
                const idx = this.waitQueue.findIndex(w => w.resolve === resolve);
                if (idx !== -1) this.waitQueue.splice(idx, 1);
                reject(new Error(`Redis pool acquire timeout after ${this.config.acquireTimeoutMs}ms`));
            }, this.config.acquireTimeoutMs);

            this.waitQueue.push({
                resolve: (conn) => {
                    clearTimeout(timeout);
                    this.inUse.add(conn);
                    this._recordAcquire(startTime);
                    resolve(conn);
                },
                reject,
            });
        });
    }

    release(conn) {
        if (!this.inUse.has(conn)) return;

        this.inUse.delete(conn);
        this.stats.totalReleased++;

        // If someone is waiting, give them this connection
        if (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift();
            waiter.resolve(conn);
            return;
        }

        // Return to pool if alive
        if (this._isAlive(conn)) {
            conn._lastUsed = Date.now();
            this.pool.push(conn);
        } else {
            this._destroyConnection(conn);
        }
    }

    async withConnection(fn) {
        const conn = await this.acquire();
        try {
            return await fn(conn);
        } finally {
            this.release(conn);
        }
    }

    // ── Internal Methods ────────────────────────────────────────

    async _createConnection() {
        this.stats.totalCreated++;

        // Create a Redis-compatible connection wrapper
        // Uses native net.Socket for zero-dependency operation
        const net = require('net');
        const conn = new net.Socket();

        return new Promise((resolve, reject) => {
            let retries = 0;

            const tryConnect = () => {
                conn.connect(this.config.port, this.config.host, () => {
                    conn._poolId = `redis-${this.stats.totalCreated}`;
                    conn._createdAt = Date.now();
                    conn._lastUsed = Date.now();
                    conn._alive = true;

                    // AUTH if password set
                    if (this.config.password) {
                        conn.write(`AUTH ${this.config.password}\r\n`);
                    }

                    // SELECT db
                    if (this.config.db > 0) {
                        conn.write(`SELECT ${this.config.db}\r\n`);
                    }

                    this.stats.peakConnections = Math.max(
                        this.stats.peakConnections,
                        this.inUse.size + this.pool.length + 1
                    );

                    logger.debug('Redis connection created', { id: conn._poolId });
                    resolve(conn);
                });

                conn.on('error', (err) => {
                    conn._alive = false;
                    if (retries < this.config.maxRetries) {
                        retries++;
                        logger.warn('Redis connection retry', { attempt: retries, error: err.message });
                        setTimeout(tryConnect, this.config.retryDelayMs * retries);
                    } else {
                        reject(err);
                    }
                });

                conn.on('close', () => {
                    conn._alive = false;
                });
            };

            tryConnect();
        });
    }

    _isAlive(conn) {
        return conn && conn._alive && !conn.destroyed;
    }

    _destroyConnection(conn) {
        this.stats.totalDestroyed++;
        try {
            conn.destroy();
        } catch (e) { /* ignore */ }
    }

    _recordAcquire(startTime) {
        const elapsed = Date.now() - startTime;
        this.stats.totalAcquired++;
        this.stats._acquireTimes.push(elapsed);
        if (this.stats._acquireTimes.length > 100) this.stats._acquireTimes.shift();
        this.stats.avgAcquireTimeMs = Math.round(
            this.stats._acquireTimes.reduce((a, b) => a + b, 0) / this.stats._acquireTimes.length
        );
    }

    _runMaintenance() {
        const now = Date.now();
        const idleTimeout = this.config.idleTimeoutMs;

        // Reap idle connections above minimum
        while (this.pool.length > this.config.minConnections) {
            const conn = this.pool[0];
            if (now - conn._lastUsed > idleTimeout) {
                this.pool.shift();
                this._destroyConnection(conn);
                logger.debug('Reaped idle Redis connection', { id: conn._poolId });
            } else {
                break;
            }
        }
    }

    getHealth() {
        return {
            pool: {
                idle: this.pool.length,
                inUse: this.inUse.size,
                waiting: this.waitQueue.length,
                max: this.config.maxConnections,
            },
            stats: {
                totalAcquired: this.stats.totalAcquired,
                totalReleased: this.stats.totalReleased,
                totalCreated: this.stats.totalCreated,
                totalDestroyed: this.stats.totalDestroyed,
                totalTimeouts: this.stats.totalTimeouts,
                peakConnections: this.stats.peakConnections,
                avgAcquireTimeMs: this.stats.avgAcquireTimeMs,
            },
        };
    }

    async shutdown() {
        clearInterval(this._maintenanceTimer);
        // Wait queue: reject all
        this.waitQueue.forEach(w => w.reject(new Error('Pool shutting down')));
        this.waitQueue = [];
        // Destroy all connections
        [...this.pool, ...this.inUse].forEach(c => this._destroyConnection(c));
        this.pool = [];
        this.inUse.clear();
        this._initialized = false;
        logger.info('Redis connection pool shutdown complete');
    }
}

// ── Singleton ────────────────────────────────────────────────
let _pool = null;
function getPool(config) {
    if (!_pool) {
        _pool = new RedisConnectionPool(config);
    }
    return _pool;
}

module.exports = { RedisConnectionPool, getPool };

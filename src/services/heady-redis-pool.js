/**
 * HeadyRedisPool — Optimized connection pool with pipelining,
 * health checks, and φ-scaled pool sizing for <50ms p99 handoff latency.
 *
 * Addresses Redis pooling bottleneck identified in infrastructure audit:
 *   Before: avg=27ms, p99=143ms (sequential, no pool)
 *   Target: avg=5ms, p99=<50ms (pooled + pipelined)
 *
 * @module src/services/heady-redis-pool
 * @version 1.0.0
 * @author HeadySystems™
 * @license Proprietary — HeadySystems™ & HeadyConnection™
 */

'use strict';

const { EventEmitter } = require('events');

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;

/**
 * HeadyRedisPool — managed connection pool for multi-agent handoffs.
 */
class HeadyRedisPool {
    /**
     * @param {Object} opts
     * @param {Function} opts.createClient — factory: () => RedisClient
     * @param {number} opts.poolSize — max connections (default: auto-calculated)
     * @param {number} opts.healthCheckInterval — ms between health checks (default: 30000)
     * @param {number} opts.maxRetries — connection retry count (default: 3)
     * @param {number} opts.retryBaseMs — base retry delay (default: 100)
     */
    constructor(opts = {}) {
        this.createClient = opts.createClient;
        this.poolSize = opts.poolSize || HeadyRedisPool.calculatePoolSize();
        this.healthCheckInterval = opts.healthCheckInterval || 30000;
        this.maxRetries = opts.maxRetries || 3;
        this.retryBaseMs = opts.retryBaseMs || 100;

        this.pool = [];
        this.available = [];
        this.waiting = [];
        this.events = new EventEmitter();
        this.stats = {
            acquired: 0,
            released: 0,
            errors: 0,
            healthChecks: 0,
            pipelineOps: 0,
            avgLatencyMs: 0,
        };
        this._healthTimer = null;
        this._latencies = [];
        this._maxLatencyWindow = 100;
    }

    /**
     * Calculate optimal pool size using Little's Law.
     * poolSize = ceil(concurrentRequests × opsPerRequest × opLatencyMs / totalRequestMs)
     *
     * @param {number} concurrent — peak concurrent requests (default: 100)
     * @param {number} opsPerReq — Redis ops per request (default: 5)
     * @param {number} opLatencyMs — single op latency target (default: 1)
     * @param {number} reqDurationMs — total request duration (default: 50)
     * @returns {number}
     */
    static calculatePoolSize(concurrent = 100, opsPerReq = 5, opLatencyMs = 1, reqDurationMs = 50) {
        const raw = Math.ceil((concurrent * opsPerReq * opLatencyMs) / reqDurationMs);
        // Apply φ-factor for headroom
        return Math.max(4, Math.round(raw * PHI));
    }

    /**
     * Initialize the pool — creates all connections.
     */
    async initialize() {
        if (!this.createClient) throw new Error('createClient factory required');

        for (let i = 0; i < this.poolSize; i++) {
            const client = await this._createWithRetry();
            client._poolIndex = i;
            client._createdAt = Date.now();
            client._useCount = 0;
            this.pool.push(client);
            this.available.push(client);
        }

        // Start health checks
        this._healthTimer = setInterval(() => this._healthCheck(), this.healthCheckInterval);

        this.events.emit('ready', { poolSize: this.poolSize });
        return this;
    }

    /**
     * Acquire a connection from the pool.
     * @param {number} timeoutMs — max wait time (default: 5000)
     * @returns {Promise<RedisClient>}
     */
    async acquire(timeoutMs = 5000) {
        const start = Date.now();

        if (this.available.length > 0) {
            const client = this.available.pop();
            client._useCount++;
            this.stats.acquired++;
            return client;
        }

        // Wait for a connection to become available
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const idx = this.waiting.indexOf(waiter);
                if (idx >= 0) this.waiting.splice(idx, 1);
                reject(new Error(`Pool exhausted — waited ${timeoutMs}ms`));
            }, timeoutMs);

            const waiter = { resolve, reject, timer, start };
            this.waiting.push(waiter);
        });
    }

    /**
     * Release a connection back to the pool.
     */
    release(client) {
        this.stats.released++;
        const latency = Date.now() - (client._acquiredAt || Date.now());
        this._recordLatency(latency);

        // Serve waiting requests first
        if (this.waiting.length > 0) {
            const waiter = this.waiting.shift();
            clearTimeout(waiter.timer);
            client._useCount++;
            this.stats.acquired++;
            waiter.resolve(client);
            return;
        }

        this.available.push(client);
    }

    /**
     * Execute a pipelined batch of Redis operations.
     * @param {Function} fn — receives pipeline object, add commands to it
     * @returns {Promise<Array>} — pipeline results
     */
    async pipeline(fn) {
        const client = await this.acquire();
        try {
            const pipe = client.pipeline();
            fn(pipe);
            this.stats.pipelineOps++;
            const results = await pipe.exec();
            return results;
        } finally {
            this.release(client);
        }
    }

    /**
     * Execute a single command via the pool.
     * @param {string} cmd — Redis command
     * @param {...any} args — command arguments
     */
    async exec(cmd, ...args) {
        const client = await this.acquire();
        try {
            return await client[cmd](...args);
        } finally {
            this.release(client);
        }
    }

    /**
     * Optimized HMGET — only fetch needed fields (not HGETALL).
     */
    async hmget(key, ...fields) {
        return this.exec('hmget', key, ...fields);
    }

    /**
     * Optimized batch HMGET via pipeline.
     */
    async batchHmget(keys, fields) {
        return this.pipeline((pipe) => {
            for (const key of keys) {
                pipe.hmget(key, ...fields);
            }
        });
    }

    /**
     * Get pool statistics.
     */
    getStats() {
        return {
            ...this.stats,
            poolSize: this.poolSize,
            available: this.available.length,
            inUse: this.poolSize - this.available.length,
            waiting: this.waiting.length,
            utilization: ((this.poolSize - this.available.length) / this.poolSize * 100).toFixed(1) + '%',
            avgLatencyMs: this.stats.avgLatencyMs.toFixed(2),
        };
    }

    /**
     * Gracefully shutdown the pool.
     */
    async shutdown() {
        clearInterval(this._healthTimer);

        // Reject all waiting
        for (const waiter of this.waiting) {
            clearTimeout(waiter.timer);
            waiter.reject(new Error('Pool shutting down'));
        }
        this.waiting = [];

        // Close all connections
        for (const client of this.pool) {
            try { await client.quit(); } catch (e) { /* ignore */ }
        }
        this.pool = [];
        this.available = [];
        this.events.emit('shutdown');
    }

    // ─── Internal ───────────────────────────────────────────────────

    async _createWithRetry() {
        let lastErr;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                return await this.createClient();
            } catch (err) {
                lastErr = err;
                this.stats.errors++;
                const delay = this.retryBaseMs * Math.pow(PHI, i) * (1 + Math.random() * PSI);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        throw lastErr;
    }

    async _healthCheck() {
        this.stats.healthChecks++;
        const dead = [];

        for (const client of this.pool) {
            try {
                await Promise.race([
                    client.ping(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
                ]);
            } catch (e) {
                dead.push(client);
            }
        }

        // Replace dead connections
        for (const client of dead) {
            const idx = this.pool.indexOf(client);
            if (idx < 0) continue;

            try { await client.quit(); } catch (e) { /* ignore */ }

            const availIdx = this.available.indexOf(client);
            if (availIdx >= 0) this.available.splice(availIdx, 1);

            try {
                const replacement = await this._createWithRetry();
                replacement._poolIndex = client._poolIndex;
                replacement._createdAt = Date.now();
                replacement._useCount = 0;
                this.pool[idx] = replacement;
                this.available.push(replacement);
                this.events.emit('reconnected', { index: idx });
            } catch (e) {
                this.events.emit('connection_failed', { index: idx, error: e.message });
            }
        }
    }

    _recordLatency(ms) {
        this._latencies.push(ms);
        if (this._latencies.length > this._maxLatencyWindow) this._latencies.shift();
        this.stats.avgLatencyMs = this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length;
    }
}

module.exports = { HeadyRedisPool };

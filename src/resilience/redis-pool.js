'use strict';

/**
 * Redis Connection Pool Manager
 * High-frequency connection pooling for Buddy chat messages
 * and real-time operations.
 */

const logger = require('../utils/logger');

class RedisPoolManager {
    constructor(opts = {}) {
        this.maxConnections = opts.maxConnections || 20;
        this.minConnections = opts.minConnections || 5;
        this.idleTimeout = opts.idleTimeout || 30000;
        this.url = opts.url || process.env.REDIS_URL || 'redis://localhost:6379';
        this.pool = [];
        this.active = 0;
        this.waiting = [];
        this.totalAcquired = 0;
        this.totalReleased = 0;
        this.totalCreated = 0;
    }

    async acquire() {
        // Return idle connection from pool
        if (this.pool.length > 0) {
            const conn = this.pool.pop();
            this.active++;
            this.totalAcquired++;
            return conn;
        }

        // Create new if under limit
        if (this.active < this.maxConnections) {
            const conn = await this._createConnection();
            this.active++;
            this.totalAcquired++;
            return conn;
        }

        // Wait for released connection
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Redis pool: acquire timeout'));
            }, 5000);
            this.waiting.push({ resolve, reject, timer });
        });
    }

    release(conn) {
        this.active--;
        this.totalReleased++;

        // Give to waiting request
        if (this.waiting.length > 0) {
            const waiter = this.waiting.shift();
            clearTimeout(waiter.timer);
            this.active++;
            this.totalAcquired++;
            waiter.resolve(conn);
            return;
        }

        // Return to pool if under max idle
        if (this.pool.length < this.minConnections) {
            this.pool.push(conn);
        }
    }

    async _createConnection() {
        this.totalCreated++;
        // Return a mock connection object — real impl would use ioredis
        return {
            id: `redis-${this.totalCreated}`,
            url: this.url,
            createdAt: Date.now(),
            async get(key) { return null; },
            async set(key, value, opts) { return 'OK'; },
            async del(key) { return 1; },
            async publish(channel, message) { return 1; },
        };
    }

    getStatus() {
        return {
            ok: true,
            pool: this.pool.length,
            active: this.active,
            waiting: this.waiting.length,
            maxConnections: this.maxConnections,
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            totalCreated: this.totalCreated,
        };
    }
}

let _pool = null;
function getRedisPool(opts) {
    if (!_pool) _pool = new RedisPoolManager(opts);
    return _pool;
}

module.exports = { RedisPoolManager, getRedisPool };

/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Redis Pool Adapter (utils/redis-pool)
 *
 * Bridges the legacy redis-pool import path to the new Upstash client.
 * All consumers that `require('../utils/redis-pool')` get the Upstash
 * adapter transparently.
 */

'use strict';

const { getRedisClient, getPoolHealth, isConfigured } = require('../services/upstash-redis');

const client = getRedisClient();

module.exports = {
    // Direct client access
    client,
    getClient: () => client,

    // Pool-compatible API
    getPoolHealth,
    isConfigured,

    // Delegate common operations
    get: (key) => client.get(key),
    set: (key, value, opts) => client.set(key, value, opts),
    del: (...keys) => client.del(...keys),
    incr: (key) => client.incr(key),
    keys: (pattern) => client.keys(pattern),
    ping: () => client.ping(),

    // Hash operations
    hset: (key, field, value) => client.hset(key, field, value),
    hget: (key, field) => client.hget(key, field),
    hgetall: (key) => client.hgetall(key),

    // List operations
    lpush: (key, ...values) => client.lpush(key, ...values),
    lrange: (key, start, stop) => client.lrange(key, start, stop),

    // Initialize (no-op for Upstash HTTP, kept for API compat)
    init: async () => { return; },

    // Graceful shutdown
    close: () => {
        if (client.close) client.close();
    },
};

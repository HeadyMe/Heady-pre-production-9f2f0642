/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Upstash Redis Client — Zero-Dependency HTTP REST Adapter
 *
 * Uses Upstash's REST API over HTTPS, eliminating the need for
 * persistent TCP connections. Ideal for Cloud Run and serverless.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
 * Falls back to in-memory cache when Upstash is not configured.
 */

'use strict';

const { getLogger } = require('./structured-logger');
const logger = getLogger('upstash-redis');

// ── Configuration ────────────────────────────────────────────
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const isConfigured = !!(UPSTASH_URL && UPSTASH_TOKEN);

// ── In-Memory Fallback ──────────────────────────────────────
class MemoryStore {
    constructor() {
        this._data = new Map();
        this._expiry = new Map();
        // Reap expired keys every 60s
        this._reaper = setInterval(() => this._prune(), 60000);
        if (this._reaper.unref) this._reaper.unref();
    }

    async get(key) {
        if (this._isExpired(key)) { this._data.delete(key); this._expiry.delete(key); return null; }
        return this._data.get(key) ?? null;
    }

    async set(key, value, opts = {}) {
        this._data.set(key, value);
        if (opts.ex) this._expiry.set(key, Date.now() + opts.ex * 1000);
        else if (opts.px) this._expiry.set(key, Date.now() + opts.px);
        return 'OK';
    }

    async del(...keys) {
        let count = 0;
        for (const k of keys) { if (this._data.delete(k)) count++; this._expiry.delete(k); }
        return count;
    }

    async incr(key) {
        const val = parseInt(await this.get(key) || '0', 10) + 1;
        this._data.set(key, String(val));
        return val;
    }

    async expire(key, seconds) {
        if (!this._data.has(key)) return 0;
        this._expiry.set(key, Date.now() + seconds * 1000);
        return 1;
    }

    async ttl(key) {
        const exp = this._expiry.get(key);
        if (!exp) return this._data.has(key) ? -1 : -2;
        const remaining = Math.ceil((exp - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    async keys(pattern) {
        const prefix = pattern.replace(/\*/g, '');
        const results = [];
        for (const k of this._data.keys()) {
            if (k.startsWith(prefix) && !this._isExpired(k)) results.push(k);
        }
        return results;
    }

    async hset(key, field, value) { return this._hashOp(key, (h) => { h[field] = value; return 1; }); }
    async hget(key, field) { const h = this._data.get(key); return h?.[field] ?? null; }
    async hgetall(key) { return this._data.get(key) || {}; }
    async hdel(key, ...fields) { return this._hashOp(key, (h) => { let c = 0; for (const f of fields) { if (f in h) { delete h[f]; c++; } } return c; }); }

    async lpush(key, ...values) {
        if (!this._data.has(key)) this._data.set(key, []);
        const list = this._data.get(key);
        list.unshift(...values);
        return list.length;
    }

    async lrange(key, start, stop) {
        const list = this._data.get(key) || [];
        return list.slice(start, stop === -1 ? undefined : stop + 1);
    }

    async sadd(key, ...members) {
        if (!this._data.has(key)) this._data.set(key, new Set());
        const set = this._data.get(key);
        let added = 0;
        for (const m of members) { if (!set.has(m)) { set.add(m); added++; } }
        return added;
    }

    async smembers(key) { return [...(this._data.get(key) || [])]; }

    async ping() { return 'PONG'; }

    async dbsize() { return this._data.size; }

    async flushdb() { this._data.clear(); this._expiry.clear(); return 'OK'; }

    _isExpired(key) {
        const exp = this._expiry.get(key);
        return exp && Date.now() > exp;
    }

    _prune() {
        for (const [k] of this._expiry) {
            if (this._isExpired(k)) { this._data.delete(k); this._expiry.delete(k); }
        }
    }

    _hashOp(key, fn) {
        if (!this._data.has(key)) this._data.set(key, {});
        return fn(this._data.get(key));
    }

    close() { clearInterval(this._reaper); }
}

// ── Upstash REST Client ─────────────────────────────────────
class UpstashClient {
    constructor(url, token) {
        this.url = url.replace(/\/$/, '');
        this.token = token;
        this._stats = { requests: 0, errors: 0, latencySum: 0 };
    }

    async _exec(command) {
        const start = Date.now();
        this._stats.requests++;

        try {
            const res = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(command),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Upstash ${res.status}: ${text}`);
            }

            const data = await res.json();
            this._stats.latencySum += Date.now() - start;

            if (data.error) throw new Error(data.error);
            return data.result;
        } catch (err) {
            this._stats.errors++;
            throw err;
        }
    }

    // Pipeline: execute multiple commands in one HTTP request
    async pipeline(commands) {
        const start = Date.now();
        this._stats.requests++;

        try {
            const res = await fetch(`${this.url}/pipeline`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commands),
            });

            if (!res.ok) throw new Error(`Upstash pipeline ${res.status}`);

            const data = await res.json();
            this._stats.latencySum += Date.now() - start;
            return data.map(d => d.result);
        } catch (err) {
            this._stats.errors++;
            throw err;
        }
    }

    // ── Redis Commands ──────────────────────────────────────
    async get(key) { return this._exec(['GET', key]); }
    async set(key, value, opts = {}) {
        const cmd = ['SET', key, value];
        if (opts.ex) cmd.push('EX', opts.ex);
        if (opts.px) cmd.push('PX', opts.px);
        if (opts.nx) cmd.push('NX');
        return this._exec(cmd);
    }
    async del(...keys) { return this._exec(['DEL', ...keys]); }
    async incr(key) { return this._exec(['INCR', key]); }
    async expire(key, seconds) { return this._exec(['EXPIRE', key, seconds]); }
    async ttl(key) { return this._exec(['TTL', key]); }
    async keys(pattern) { return this._exec(['KEYS', pattern]); }

    async hset(key, field, value) { return this._exec(['HSET', key, field, value]); }
    async hget(key, field) { return this._exec(['HGET', key, field]); }
    async hgetall(key) { return this._exec(['HGETALL', key]); }
    async hdel(key, ...fields) { return this._exec(['HDEL', key, ...fields]); }

    async lpush(key, ...values) { return this._exec(['LPUSH', key, ...values]); }
    async lrange(key, start, stop) { return this._exec(['LRANGE', key, start, stop]); }

    async sadd(key, ...members) { return this._exec(['SADD', key, ...members]); }
    async smembers(key) { return this._exec(['SMEMBERS', key]); }

    async ping() { return this._exec(['PING']); }
    async dbsize() { return this._exec(['DBSIZE']); }
    async flushdb() { return this._exec(['FLUSHDB']); }

    getStats() {
        return {
            requests: this._stats.requests,
            errors: this._stats.errors,
            avgLatencyMs: this._stats.requests > 0
                ? Math.round(this._stats.latencySum / this._stats.requests)
                : 0,
            errorRate: this._stats.requests > 0
                ? (this._stats.errors / this._stats.requests * 100).toFixed(1) + '%'
                : '0%',
        };
    }

    close() { /* HTTP — no persistent connection to close */ }
}

// ── Singleton Factory ───────────────────────────────────────
let _instance = null;

function getRedisClient() {
    if (_instance) return _instance;

    if (isConfigured) {
        _instance = new UpstashClient(UPSTASH_URL, UPSTASH_TOKEN);
        logger.info('Upstash Redis client initialized (REST/HTTPS)', {
            url: UPSTASH_URL.replace(/\/\/.*@/, '//***@'),
        });
    } else {
        _instance = new MemoryStore();
        logger.info('Using in-memory Redis fallback (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for Upstash)');
    }

    return _instance;
}

// ── Pool Health API (compatible with redis-health route) ─────
async function getPoolHealth() {
    const client = getRedisClient();
    try {
        const pong = await client.ping();
        const mode = client instanceof UpstashClient ? 'upstash' : 'in-memory';
        const stats = client instanceof UpstashClient ? client.getStats() : { entries: client._data?.size || 0 };

        return {
            connected: pong === 'PONG',
            mode,
            stats,
            ts: new Date().toISOString(),
        };
    } catch (err) {
        return { connected: false, mode: 'error', error: err.message, ts: new Date().toISOString() };
    }
}

// ── Express Routes ──────────────────────────────────────────
function redisRoutes(app) {
    const prefix = '/api/redis';
    const client = getRedisClient();

    app.get(`${prefix}/health`, async (_req, res) => {
        const health = await getPoolHealth();
        res.status(health.connected ? 200 : 503).json({
            ok: health.connected,
            service: 'upstash-redis',
            ...health,
        });
    });

    app.get(`${prefix}/stats`, async (_req, res) => {
        const health = await getPoolHealth();
        res.json({ ok: true, ...health });
    });

    app.post(`${prefix}/set`, async (req, res) => {
        try {
            const { key, value, ttl } = req.body || {};
            if (!key) return res.status(400).json({ error: 'key required' });
            const opts = ttl ? { ex: ttl } : {};
            await client.set(key, JSON.stringify(value), opts);
            res.json({ ok: true, key });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get(`${prefix}/get/:key`, async (req, res) => {
        try {
            const raw = await client.get(req.params.key);
            const value = raw ? JSON.parse(raw) : null;
            res.json({ ok: true, key: req.params.key, value });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete(`${prefix}/del/:key`, async (req, res) => {
        try {
            const count = await client.del(req.params.key);
            res.json({ ok: true, deleted: count });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = {
    UpstashClient,
    MemoryStore,
    getRedisClient,
    getPoolHealth,
    redisRoutes,
    isConfigured,
};

/**
 * database-breaker.js
 * Circuit-breaker wrappers for PostgreSQL/Neon (heady-neon) and Redis (heady-kv).
 *
 * Features
 * --------
 * - Connection pool health monitoring (periodic ping)
 * - Query timeout enforcement: 5 s reads, 30 s writes
 * - Read replica failover (primary → replica on read-class queries)
 * - Connection draining on circuit OPEN
 * - Reconnection with exponential backoff + random jitter (phi-ratio)
 *
 * @module enterprise-hardening/circuit-breaker/database-breaker
 */
'use strict';

const { EventEmitter } = require('events');
const { registry, PHI } = require('./external-api-breakers');
const { STATES } = require('../../circuit-breaker');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const READ_TIMEOUT_MS  =  5_000;
const WRITE_TIMEOUT_MS = 30_000;
const HEALTH_PING_INTERVAL_MS = 15_000;
const MAX_RECONNECT_ATTEMPTS  = 10;
const BASE_RECONNECT_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`DB timeout: ${label} (${ms}ms)`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

function jitter(ms) {
  return ms * (1 + (Math.random() - 0.5) * 0.4); // ±20 % jitter
}

async function reconnectDelay(attempt) {
  const base = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(PHI, attempt), 30_000);
  await new Promise(r => setTimeout(r, jitter(base)));
}

/**
 * Classify a SQL string as a read or write operation.
 * Conservative: anything not clearly SELECT/WITH/SHOW/EXPLAIN is a write.
 */
function classifyQuery(sql = '') {
  return /^\s*(SELECT|WITH|SHOW|EXPLAIN|DESCRIBE)\b/i.test(sql) ? 'read' : 'write';
}

// ---------------------------------------------------------------------------
// PostgresBreaker
// ---------------------------------------------------------------------------
class PostgresBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.primaryPool]   heady-neon primary pool instance
   * @param {object} [opts.replicaPool]   heady-neon read-replica pool instance
   * @param {number} [opts.readTimeoutMs]
   * @param {number} [opts.writeTimeoutMs]
   */
  constructor(opts = {}) {
    super();
    this._primaryPool  = opts.primaryPool  || null;
    this._replicaPool  = opts.replicaPool  || null;
    this._readTimeoutMs  = opts.readTimeoutMs  || READ_TIMEOUT_MS;
    this._writeTimeoutMs = opts.writeTimeoutMs || WRITE_TIMEOUT_MS;

    // Active connections being drained on OPEN
    this._activeConnections = 0;
    this._draining = false;

    // Reconnect state
    this._reconnectAttempt = 0;
    this._reconnectTimer   = null;

    // Health-ping timer
    this._healthTimer = null;

    // Circuit breakers from master registry
    this._breaker = registry.get('postgresql-neon');
    this._breaker.on('stateChange', ({ to }) => this._onStateChange(to));
  }

  // -------------------------------------------------------------------------
  // Pool injection (for DI / testing)
  // -------------------------------------------------------------------------
  setPrimaryPool(pool)  { this._primaryPool  = pool; }
  setReplicaPool(pool)  { this._replicaPool  = pool; }

  // -------------------------------------------------------------------------
  // Query execution
  // -------------------------------------------------------------------------
  /**
   * Execute a SQL query with circuit-breaker protection.
   *
   * @param {string|object} sql      SQL string or {text, values} object
   * @param {any[]}         [params] Bind parameters (if sql is a string)
   * @returns {Promise<object>}      Query result
   */
  async query(sql, params) {
    const sqlText = typeof sql === 'string' ? sql : sql.text;
    const queryType = classifyQuery(sqlText);
    const timeoutMs = queryType === 'read' ? this._readTimeoutMs : this._writeTimeoutMs;

    // For reads, attempt replica first
    if (queryType === 'read' && this._replicaPool) {
      try {
        return await this._executeOnPool(this._replicaPool, sql, params, timeoutMs, 'replica');
      } catch (err) {
        this.emit('replicaFallback', { reason: err.message });
        // Fall through to primary
      }
    }

    return this._executeOnPool(this._primaryPool, sql, params, timeoutMs, 'primary');
  }

  async _executeOnPool(pool, sql, params, timeoutMs, poolLabel) {
    if (!pool) throw new Error(`PostgresBreaker: ${poolLabel} pool not initialised`);

    this._activeConnections++;
    try {
      return await this._breaker.execute(() =>
        withTimeout(
          typeof sql === 'string' ? pool.query(sql, params) : pool.query(sql),
          timeoutMs,
          `postgres-${poolLabel}`
        )
      );
    } finally {
      this._activeConnections--;
      if (this._draining && this._activeConnections === 0) {
        this.emit('drained');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Transaction helper
  // -------------------------------------------------------------------------
  /**
   * Run a callback inside a transaction.
   * The callback receives a client with a .query() method.
   * Commits on success, rolls back on error.
   *
   * @param {Function} fn  async (client) => result
   */
  async transaction(fn) {
    if (!this._primaryPool) throw new Error('PostgresBreaker: primary pool not initialised');
    if (this._draining) throw new Error('PostgresBreaker: connection draining, rejecting new transactions');

    const client = await withTimeout(
      this._primaryPool.connect(),
      this._writeTimeoutMs,
      'postgres-connect'
    );
    this._activeConnections++;

    try {
      await client.query('BEGIN');
      const result = await this._breaker.execute(() =>
        withTimeout(fn(client), this._writeTimeoutMs, 'postgres-transaction')
      );
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
      this._activeConnections--;
      if (this._draining && this._activeConnections === 0) this.emit('drained');
    }
  }

  // -------------------------------------------------------------------------
  // Health monitoring
  // -------------------------------------------------------------------------
  startHealthMonitor() {
    if (this._healthTimer) return; // already running
    this._healthTimer = setInterval(async () => {
      try {
        await this.query('SELECT 1');
        this.emit('healthOk', { pool: 'primary' });
      } catch (err) {
        this.emit('healthFail', { pool: 'primary', error: err.message });
      }
    }, HEALTH_PING_INTERVAL_MS);
    this._healthTimer.unref?.();
  }

  stopHealthMonitor() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Circuit state callbacks
  // -------------------------------------------------------------------------
  _onStateChange(newState) {
    if (newState === STATES.OPEN) {
      this._startDraining();
      this._scheduleReconnect();
    } else if (newState === STATES.CLOSED) {
      this._draining = false;
      this._reconnectAttempt = 0;
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
    }
  }

  _startDraining() {
    this._draining = true;
    this.emit('draining', { activeConnections: this._activeConnections });
    if (this._activeConnections === 0) this.emit('drained');
  }

  _scheduleReconnect() {
    if (this._reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('reconnectGiveUp', { attempts: this._reconnectAttempt });
      return;
    }

    const attempt = this._reconnectAttempt++;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(PHI, attempt), 30_000);
    const delayWithJitter = jitter(delay);

    this._reconnectTimer = setTimeout(async () => {
      this.emit('reconnectAttempt', { attempt, delayMs: delayWithJitter });
      try {
        await this.query('SELECT 1');
        this._breaker.reset();
        this._draining = false;
        this._reconnectAttempt = 0;
        this.emit('reconnected', { attempt });
      } catch {
        this._scheduleReconnect();
      }
    }, delayWithJitter);

    this._reconnectTimer.unref?.();
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------
  snapshot() {
    return {
      service: 'postgresql-neon',
      breaker: this._breaker.snapshot(),
      activeConnections: this._activeConnections,
      draining: this._draining,
      reconnectAttempt: this._reconnectAttempt,
      hasPrimary: !!this._primaryPool,
      hasReplica:  !!this._replicaPool,
    };
  }
}

// ---------------------------------------------------------------------------
// RedisBreaker
// ---------------------------------------------------------------------------
class RedisBreaker extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.client]          heady-kv Redis client
   * @param {number} [opts.readTimeoutMs]
   * @param {number} [opts.writeTimeoutMs]
   */
  constructor(opts = {}) {
    super();
    this._client = opts.client || null;
    this._readTimeoutMs  = opts.readTimeoutMs  || READ_TIMEOUT_MS;
    this._writeTimeoutMs = opts.writeTimeoutMs || WRITE_TIMEOUT_MS;

    this._activeOps = 0;
    this._draining  = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer   = null;
    this._healthTimer      = null;

    this._breaker = registry.get('redis');
    this._breaker.on('stateChange', ({ to }) => this._onStateChange(to));
  }

  setClient(client) { this._client = client; }

  // -------------------------------------------------------------------------
  // Core execute
  // -------------------------------------------------------------------------
  async _exec(op, timeoutMs, label) {
    if (!this._client) throw new Error('RedisBreaker: client not initialised');
    if (this._draining) throw new Error('RedisBreaker: draining, rejecting new operations');

    this._activeOps++;
    try {
      return await this._breaker.execute(() =>
        withTimeout(op(), timeoutMs, label)
      );
    } finally {
      this._activeOps--;
      if (this._draining && this._activeOps === 0) this.emit('drained');
    }
  }

  // -------------------------------------------------------------------------
  // Key-value operations
  // -------------------------------------------------------------------------
  get(key)            { return this._exec(() => this._client.get(key),         this._readTimeoutMs,  `redis.get(${key})`); }
  set(key, val, opts) { return this._exec(() => this._client.set(key, val, opts), this._writeTimeoutMs, `redis.set(${key})`); }
  del(...keys)        { return this._exec(() => this._client.del(...keys),     this._writeTimeoutMs, `redis.del`); }
  exists(key)         { return this._exec(() => this._client.exists(key),      this._readTimeoutMs,  `redis.exists(${key})`); }
  expire(key, secs)   { return this._exec(() => this._client.expire(key, secs), this._writeTimeoutMs, `redis.expire`); }
  ttl(key)            { return this._exec(() => this._client.ttl(key),         this._readTimeoutMs,  `redis.ttl`); }
  incr(key)           { return this._exec(() => this._client.incr(key),        this._writeTimeoutMs, `redis.incr`); }
  hget(key, field)    { return this._exec(() => this._client.hget(key, field), this._readTimeoutMs,  `redis.hget`); }
  hset(key, field, v) { return this._exec(() => this._client.hset(key, field, v), this._writeTimeoutMs, `redis.hset`); }
  hgetall(key)        { return this._exec(() => this._client.hgetall(key),     this._readTimeoutMs,  `redis.hgetall`); }
  lpush(key, ...vals) { return this._exec(() => this._client.lpush(key, ...vals), this._writeTimeoutMs, `redis.lpush`); }
  lrange(key, s, e)   { return this._exec(() => this._client.lrange(key, s, e),   this._readTimeoutMs,  `redis.lrange`); }

  /** Pipeline — runs multiple commands; entire pipeline is one breaker call. */
  async pipeline(commands) {
    return this._exec(async () => {
      const pipe = this._client.pipeline?.() || this._client.multi?.();
      if (!pipe) throw new Error('RedisBreaker: client does not support pipeline/multi');
      for (const [cmd, ...args] of commands) pipe[cmd](...args);
      return pipe.exec();
    }, this._writeTimeoutMs, 'redis.pipeline');
  }

  // -------------------------------------------------------------------------
  // Health monitoring
  // -------------------------------------------------------------------------
  startHealthMonitor() {
    if (this._healthTimer) return;
    this._healthTimer = setInterval(async () => {
      try {
        await this._exec(() => this._client.ping(), this._readTimeoutMs, 'redis.ping');
        this.emit('healthOk');
      } catch (err) {
        this.emit('healthFail', { error: err.message });
      }
    }, HEALTH_PING_INTERVAL_MS);
    this._healthTimer.unref?.();
  }

  stopHealthMonitor() {
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
  }

  // -------------------------------------------------------------------------
  // State callbacks
  // -------------------------------------------------------------------------
  _onStateChange(newState) {
    if (newState === STATES.OPEN) {
      this._startDraining();
      this._scheduleReconnect();
    } else if (newState === STATES.CLOSED) {
      this._draining = false;
      this._reconnectAttempt = 0;
      if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    }
  }

  _startDraining() {
    this._draining = true;
    this.emit('draining', { activeOps: this._activeOps });
    if (this._activeOps === 0) this.emit('drained');
  }

  _scheduleReconnect() {
    if (this._reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('reconnectGiveUp', { attempts: this._reconnectAttempt });
      return;
    }
    const attempt = this._reconnectAttempt++;
    const delay = jitter(Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(PHI, attempt), 30_000));

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this._exec(() => this._client.ping(), this._readTimeoutMs, 'redis.ping');
        this._breaker.reset();
        this._draining = false;
        this._reconnectAttempt = 0;
        this.emit('reconnected', { attempt });
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
    this._reconnectTimer.unref?.();
  }

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------
  snapshot() {
    return {
      service: 'redis',
      breaker: this._breaker.snapshot(),
      activeOps: this._activeOps,
      draining:  this._draining,
      reconnectAttempt: this._reconnectAttempt,
      hasClient: !!this._client,
    };
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------
const postgresBreaker = new PostgresBreaker();
const redisBreaker    = new RedisBreaker();

module.exports = {
  postgresBreaker,
  redisBreaker,
  PostgresBreaker,
  RedisBreaker,
  classifyQuery,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
};

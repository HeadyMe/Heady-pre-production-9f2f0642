/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../../utils/logger');
const CircuitBreaker = require('../../resilience/circuit-breaker');
const HeadyKV = require('../../core/heady-kv');

// ─── Constants ────────────────────────────────────────────────────────────────

const CONNECTOR_STATUS = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  DEGRADED:     'degraded',
  ERROR:        'error',
});

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Backoff sequence

// ─── ConnectorManager ────────────────────────────────────────────────────────

class ConnectorManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {object}  [opts.kv]           - HeadyKV for state caching
   * @param {boolean} [opts.autoConnect=true]
   * @param {number}  [opts.healthIntervalMs=30000]
   */
  constructor(opts = {}) {
    super();

    this._kv = opts.kv || new HeadyKV({ namespace: 'connectors' });
    this.autoConnect = opts.autoConnect !== false;
    this.healthIntervalMs = opts.healthIntervalMs ?? 30_000;

    /** @type {Map<string, ConnectorEntry>} */
    this._connectors = new Map();

    /** @type {Map<string, CircuitBreaker>} */
    this._breakers = new Map();

    this._healthTimer = null;

    logger.info('[ConnectorManager] initialized');
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async init() {
    if (this.autoConnect) {
      await this._connectAll();
    }
    this._startHealthLoop();
    return this;
  }

  async shutdown() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }

    await Promise.allSettled(
      [...this._connectors.keys()].map(name => this._disconnect(name))
    );

    logger.info('[ConnectorManager] shutdown complete');
  }

  // ─── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a named connector.
   * @param {string} name
   * @param {object} connector
   * @param {Function}  connector.connect      - async () => void
   * @param {Function}  connector.disconnect   - async () => void
   * @param {Function}  connector.health       - async () => { healthy, details? }
   * @param {Function}  [connector.getClient]  - () => underlying client (pool, etc.)
   * @param {object}    [connector.config]     - Connector-specific config
   */
  register(name, connector) {
    if (this._connectors.has(name)) {
      logger.warn('[ConnectorManager] overwriting existing connector', { name });
    }

    const entry = {
      name,
      connector,
      status: CONNECTOR_STATUS.DISCONNECTED,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastHealthAt: null,
      lastHealthResult: null,
      registeredAt: new Date().toISOString(),
    };

    this._connectors.set(name, entry);

    this._breakers.set(name, new CircuitBreaker({
      name: `connector:${name}`,
      failureThreshold: connector.failureThreshold ?? 3,
      recoveryTimeMs: connector.recoveryTimeMs ?? 30_000,
    }));

    logger.info('[ConnectorManager] connector registered', { name });
    this.emit('registered', { name });

    if (this.autoConnect) {
      this._connect(name).catch(err =>
        logger.warn('[ConnectorManager] auto-connect failed', { name, err: err.message })
      );
    }

    return this;
  }

  // ─── Get connector client ────────────────────────────────────────────────────

  /**
   * Get the underlying client/pool for a connector.
   * @param {string} name
   * @returns {any}
   */
  get(name) {
    const entry = this._connectors.get(name);
    if (!entry) throw new Error(`Connector not found: ${name}`);
    if (entry.status === CONNECTOR_STATUS.DISCONNECTED || entry.status === CONNECTOR_STATUS.ERROR) {
      throw new Error(`Connector ${name} is ${entry.status}`);
    }
    if (typeof entry.connector.getClient === 'function') {
      return entry.connector.getClient();
    }
    return entry.connector;
  }

  /**
   * Execute a function with the connector, routing through circuit breaker.
   * @param {string}   name
   * @param {Function} fn  - async (client) => result
   */
  async use(name, fn) {
    const entry = this._connectors.get(name);
    if (!entry) throw new Error(`Connector not found: ${name}`);

    const breaker = this._breakers.get(name);
    return breaker.fire(async () => {
      const client = this.get(name);
      return fn(client);
    });
  }

  // ─── Health ──────────────────────────────────────────────────────────────────

  /**
   * Run a health check on a connector.
   * @param {string} name
   * @returns {Promise<{ name, status, healthy, details? }>}
   */
  async health(name) {
    const entry = this._connectors.get(name);
    if (!entry) return { name, status: 'not-found', healthy: false };

    try {
      const result = await Promise.race([
        entry.connector.health(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('health timeout')), 5000)),
      ]);

      entry.lastHealthAt = new Date().toISOString();
      entry.lastHealthResult = result;
      const healthy = result.healthy !== false;
      entry.status = healthy ? CONNECTOR_STATUS.CONNECTED : CONNECTOR_STATUS.DEGRADED;

      return { name, status: entry.status, healthy, details: result.details || null };
    } catch (err) {
      entry.status = CONNECTOR_STATUS.ERROR;
      entry.lastHealthResult = { healthy: false, error: err.message };
      return { name, status: CONNECTOR_STATUS.ERROR, healthy: false, error: err.message };
    }
  }

  /**
   * Health check all connectors.
   * @returns {Promise<object[]>}
   */
  async healthAll() {
    const names = [...this._connectors.keys()];
    return Promise.all(names.map(n => this.health(n)));
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

  getStatus(name) {
    const entry = this._connectors.get(name);
    if (!entry) return null;
    return {
      name,
      status: entry.status,
      reconnectAttempts: entry.reconnectAttempts,
      lastConnectedAt: entry.lastConnectedAt,
      lastHealthAt: entry.lastHealthAt,
      lastHealthResult: entry.lastHealthResult,
      circuitBreaker: this._breakers.get(name)?.getState(),
    };
  }

  getAllStatuses() {
    return [...this._connectors.keys()].map(n => this.getStatus(n));
  }

  listConnectors() {
    return [...this._connectors.keys()];
  }

  // ─── Connect / disconnect helpers ────────────────────────────────────────────

  async _connect(name) {
    const entry = this._connectors.get(name);
    if (!entry) return;
    if (entry.status === CONNECTOR_STATUS.CONNECTED) return;

    entry.status = CONNECTOR_STATUS.CONNECTING;
    this.emit('connecting', { name });

    try {
      await entry.connector.connect();
      entry.status = CONNECTOR_STATUS.CONNECTED;
      entry.lastConnectedAt = new Date().toISOString();
      entry.reconnectAttempts = 0;
      logger.info('[ConnectorManager] connected', { name });
      this.emit('connected', { name });
    } catch (err) {
      entry.status = CONNECTOR_STATUS.ERROR;
      entry.reconnectAttempts++;
      logger.error('[ConnectorManager] connect failed', { name, err: err.message, attempt: entry.reconnectAttempts });
      this.emit('connectFailed', { name, error: err.message });
      this._scheduleReconnect(name);
      throw err;
    }
  }

  async _disconnect(name) {
    const entry = this._connectors.get(name);
    if (!entry) return;
    try {
      await entry.connector.disconnect();
      entry.status = CONNECTOR_STATUS.DISCONNECTED;
      logger.info('[ConnectorManager] disconnected', { name });
      this.emit('disconnected', { name });
    } catch (err) {
      logger.warn('[ConnectorManager] disconnect error', { name, err: err.message });
    }
  }

  _scheduleReconnect(name) {
    const entry = this._connectors.get(name);
    if (!entry) return;
    const delayMs = RECONNECT_DELAYS[Math.min(entry.reconnectAttempts - 1, RECONNECT_DELAYS.length - 1)];
    logger.debug('[ConnectorManager] scheduling reconnect', { name, delayMs });
    setTimeout(() => {
      this._connect(name).catch(() => {});
    }, delayMs);
  }

  async _connectAll() {
    await Promise.allSettled(
      [...this._connectors.keys()].map(n => this._connect(n))
    );
  }

  _startHealthLoop() {
    this._healthTimer = setInterval(() => {
      this.healthAll().catch(err =>
        logger.warn('[ConnectorManager] health loop error', { err: err.message })
      );
    }, this.healthIntervalMs);
    this._healthTimer.unref?.();
  }
}

// ─── Built-in connector factories ────────────────────────────────────────────

/**
 * Build a GitHub (Octokit) connector.
 * @param {object} opts - { auth, baseUrl }
 */
function buildGitHubConnector(opts = {}) {
  let client = null;
  return {
    async connect() {
      // Lazy-load Octokit to avoid hard dependency
      const { Octokit } = require('@octokit/rest');
      client = new Octokit({
        auth: opts.auth || process.env.GITHUB_TOKEN,
        baseUrl: opts.baseUrl,
      });
      // Validate credentials
      await client.users.getAuthenticated();
    },
    async disconnect() { client = null; },
    async health() {
      if (!client) return { healthy: false, details: 'not connected' };
      try {
        const { data } = await client.meta.get();
        return { healthy: true, details: { version: data.installed_version } };
      } catch (err) {
        return { healthy: false, details: err.message };
      }
    },
    getClient() { return client; },
  };
}

/**
 * Build a Cloudflare API connector.
 * @param {object} opts - { apiToken, accountId }
 */
function buildCloudflareConnector(opts = {}) {
  const config = {
    apiToken: opts.apiToken || process.env.CF_API_TOKEN,
    accountId: opts.accountId || process.env.CF_ACCOUNT_ID,
    baseUrl: 'https://api.cloudflare.com/client/v4',
  };
  let connected = false;
  const headyFetch = require('../../core/heady-fetch');

  return {
    async connect() {
      const res = await headyFetch(`${config.baseUrl}/user/tokens/verify`, {
        headers: { Authorization: `Bearer ${config.apiToken}` },
      });
      if (!res.ok) throw new Error(`CF auth failed: ${res.status}`);
      connected = true;
    },
    async disconnect() { connected = false; },
    async health() {
      if (!connected) return { healthy: false };
      const res = await headyFetch(`${config.baseUrl}/user/tokens/verify`, {
        headers: { Authorization: `Bearer ${config.apiToken}` },
      });
      return { healthy: res.ok, details: { status: res.status } };
    },
    getClient() {
      return {
        fetch: (path, init = {}) => headyFetch(`${config.baseUrl}${path}`, {
          ...init,
          headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
        }),
        accountId: config.accountId,
      };
    },
  };
}

/**
 * Build a PostgreSQL connector via heady-neon pooler.
 * @param {object} opts - { connectionString }
 */
function buildPostgresConnector(opts = {}) {
  let pool = null;
  const connectionString = opts.connectionString || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  return {
    async connect() {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString, max: opts.poolSize || 10 });
      // Test connection
      const client = await pool.connect();
      client.release();
    },
    async disconnect() {
      if (pool) { await pool.end(); pool = null; }
    },
    async health() {
      if (!pool) return { healthy: false, details: 'pool not created' };
      try {
        const { rows } = await pool.query('SELECT 1 AS alive');
        return { healthy: rows[0].alive === 1, details: { poolTotal: pool.totalCount, poolIdle: pool.idleCount } };
      } catch (err) {
        return { healthy: false, details: err.message };
      }
    },
    getClient() { return pool; },
  };
}

/**
 * Build a Redis connector via HeadyKV.
 * @param {object} opts - { url }
 */
function buildRedisConnector(opts = {}) {
  const kv = new HeadyKV({ url: opts.url || process.env.REDIS_URL, namespace: 'default' });
  return {
    async connect() { await kv.ping?.(); },
    async disconnect() { await kv.close?.(); },
    async health() {
      try {
        await kv.set('__health__', 'ok', { ttlMs: 5000 });
        const val = await kv.get('__health__');
        return { healthy: val === 'ok' };
      } catch (err) {
        return { healthy: false, details: err.message };
      }
    },
    getClient() { return kv; },
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  ConnectorManager,
  CONNECTOR_STATUS,
  buildGitHubConnector,
  buildCloudflareConnector,
  buildPostgresConnector,
  buildRedisConnector,
};

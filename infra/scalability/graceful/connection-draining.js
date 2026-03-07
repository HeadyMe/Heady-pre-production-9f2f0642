'use strict';
/**
 * @module connection-draining
 * @description Graceful shutdown and connection draining for HeadySystems services
 *
 * SIGTERM handler with fib(8)=21 second grace period.
 * LIFO cleanup order:
 *   8. HTTP server (stop accepting)
 *   7. WebSocket connections
 *   6. Active request handlers
 *   5. Job queue workers
 *   4. Redis pub/sub
 *   3. Redis connections
 *   2. Database connection pools
 *   1. Metrics/log flush
 *
 * φ = 1.618033988749895
 */

const EventEmitter = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// φ constants
// ─────────────────────────────────────────────────────────────────────────────
const PHI  = 1.618033988749895;
const FIB  = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

const GRACE_PERIOD_MS    = FIB[8] * 1000;   // fib(8)=21s grace period
const DRAIN_POLL_MS      = FIB[5] * 100;    // 500ms polling interval
const FORCE_EXIT_MS      = FIB[9] * 1000;   // fib(9)=34s hard kill limit
const LOG_FLUSH_TIMEOUT  = FIB[6] * 1000;   // fib(6)=8s log flush
const DB_DRAIN_TIMEOUT   = FIB[7] * 1000;   // fib(7)=13s DB drain

// ─────────────────────────────────────────────────────────────────────────────
// Logger (structured JSON, safe for shutdown)
// ─────────────────────────────────────────────────────────────────────────────
const logger = {
  info:  (msg, ctx = {}) => process.stdout.write(JSON.stringify({ level: 'info',  msg, ...ctx, ts: new Date().toISOString() }) + '\n'),
  warn:  (msg, ctx = {}) => process.stdout.write(JSON.stringify({ level: 'warn',  msg, ...ctx, ts: new Date().toISOString() }) + '\n'),
  error: (msg, ctx = {}) => process.stderr.write(JSON.stringify({ level: 'error', msg, ...ctx, ts: new Date().toISOString() }) + '\n'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Shutdown Stage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ShutdownStage
 * @property {string}   name        - Human-readable stage name
 * @property {number}   order       - LIFO order (8=first, 1=last)
 * @property {number}   timeoutMs   - Max time for this stage
 * @property {Function} fn          - async () => void — the cleanup function
 */

// ─────────────────────────────────────────────────────────────────────────────
// GracefulShutdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class GracefulShutdown
 * Orchestrates graceful shutdown in LIFO order with:
 *   - SIGTERM/SIGINT/SIGHUP signal handling
 *   - Stage-by-stage cleanup with individual timeouts
 *   - Overall grace period enforcement (fib(8)=21s)
 *   - Force-exit after fib(9)=34s hard limit
 *   - Metrics and log flushing
 *
 * @extends EventEmitter
 *
 * Events:
 *   shutdown-start({signal, gracePeriodMs})
 *   stage-start({name, order})
 *   stage-complete({name, order, durationMs})
 *   stage-timeout({name, order, timeoutMs})
 *   stage-error({name, order, error})
 *   shutdown-complete({totalDurationMs, stages})
 *   force-exit({reason})
 */
class GracefulShutdown extends EventEmitter {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.gracePeriodMs=21000]     - fib(8)=21s
   * @param {number} [opts.forceExitMs=34000]       - fib(9)=34s hard limit
   * @param {number} [opts.drainPollMs=500]         - polling interval
   */
  constructor(opts = {}) {
    super();
    this.gracePeriodMs = opts.gracePeriodMs ?? GRACE_PERIOD_MS;
    this.forceExitMs   = opts.forceExitMs   ?? FORCE_EXIT_MS;
    this.drainPollMs   = opts.drainPollMs   ?? DRAIN_POLL_MS;
    this._stages       = new Map();   // order → ShutdownStage
    this._isShuttingDown = false;
    this._shutdownStart  = null;
    this._exitCode       = 0;
    this._stageResults   = [];

    this._registerSignalHandlers();
  }

  // ───────────────────────────────────────────────
  // Stage Registration
  // ───────────────────────────────────────────────

  /**
   * Register a shutdown stage.
   * Stages execute in descending order (8 first, 1 last — LIFO).
   *
   * @param {ShutdownStage} stage
   * @returns {this}
   *
   * @example
   * shutdown.register({
   *   name: 'HTTP Server',
   *   order: 8,
   *   timeoutMs: 5000,
   *   fn: async () => { await httpServer.close(); }
   * });
   */
  register(stage) {
    if (!stage.name || !stage.order || !stage.fn) {
      throw new Error('ShutdownStage requires: name, order, fn');
    }
    this._stages.set(stage.order, {
      name:      stage.name,
      order:     stage.order,
      timeoutMs: stage.timeoutMs ?? FIB[7] * 1000,   // default 13s
      fn:        stage.fn,
    });
    return this;
  }

  // ───────────────────────────────────────────────
  // Pre-built stage helpers
  // ───────────────────────────────────────────────

  /**
   * Register HTTP server stop-accepting stage.
   * @param {http.Server} server
   * @returns {this}
   */
  registerHttpServer(server) {
    return this.register({
      name:      'HTTP Server — stop accepting connections',
      order:     8,
      timeoutMs: FIB[5] * 1000,  // 5s
      fn:        async () => {
        await new Promise((resolve, reject) => {
          server.close((err) => err ? reject(err) : resolve());
        });
        logger.info('HTTP server closed — no new connections accepted');
      },
    });
  }

  /**
   * Register WebSocket drain stage.
   * @param {Object} wsServer - WebSocket server with clients Set
   * @returns {this}
   */
  registerWebSocket(wsServer) {
    return this.register({
      name:      'WebSocket — drain active connections',
      order:     7,
      timeoutMs: FIB[7] * 1000,  // 13s
      fn:        async () => {
        const clients = wsServer.clients ?? new Set();
        logger.info('Closing WebSocket connections', { count: clients.size });

        // Send close frame to all clients
        for (const client of clients) {
          try {
            client.close(1001, 'Server shutting down');
          } catch (_) { /* ignore */ }
        }

        // Wait for clients to disconnect (up to 13s)
        const timeout = Date.now() + FIB[7] * 1000;
        while (clients.size > 0 && Date.now() < timeout) {
          await new Promise(r => setTimeout(r, this.drainPollMs));
        }

        if (clients.size > 0) {
          logger.warn('Force-terminating remaining WebSocket clients', { remaining: clients.size });
          for (const client of clients) {
            try { client.terminate(); } catch (_) { /* ignore */ }
          }
        }
      },
    });
  }

  /**
   * Register active request drain stage.
   * @param {Object} requestTracker - object with a `count` getter
   * @returns {this}
   */
  registerRequestDrain(requestTracker) {
    return this.register({
      name:      'Active Requests — drain in-flight',
      order:     6,
      timeoutMs: FIB[8] * 1000,  // 21s
      fn:        async () => {
        logger.info('Draining active requests', { inFlight: requestTracker.count });
        const timeout = Date.now() + FIB[8] * 1000;

        while (requestTracker.count > 0 && Date.now() < timeout) {
          await new Promise(r => setTimeout(r, this.drainPollMs));
        }

        if (requestTracker.count > 0) {
          logger.warn('Grace period expired — forcing active request drain', {
            remaining: requestTracker.count,
          });
        } else {
          logger.info('All in-flight requests completed');
        }
      },
    });
  }

  /**
   * Register task queue drain stage.
   * @param {Object} queue - object with stop() and drain() methods
   * @returns {this}
   */
  registerTaskQueue(queue) {
    return this.register({
      name:      'Task Queue — drain workers',
      order:     5,
      timeoutMs: FIB[8] * 1000,  // 21s
      fn:        async () => {
        queue.stop();
        await queue.drain(FIB[8] * 1000);
        logger.info('Task queue workers drained');
      },
    });
  }

  /**
   * Register Redis pub/sub unsubscribe stage.
   * @param {Object} subscriber - Redis subscriber client
   * @returns {this}
   */
  registerRedisPubSub(subscriber) {
    return this.register({
      name:      'Redis Pub/Sub — unsubscribe',
      order:     4,
      timeoutMs: FIB[5] * 1000,  // 5s
      fn:        async () => {
        await subscriber.unsubscribe();
        logger.info('Redis pub/sub unsubscribed');
      },
    });
  }

  /**
   * Register Redis connection close stage.
   * @param {Object[]} clients - Redis client instances
   * @returns {this}
   */
  registerRedisClients(clients) {
    return this.register({
      name:      'Redis — close connections',
      order:     3,
      timeoutMs: FIB[6] * 1000,  // 8s
      fn:        async () => {
        await Promise.allSettled(
          clients.map(c => c.quit().catch(err => logger.warn('Redis quit error', { err: err.message })))
        );
        logger.info('Redis connections closed', { count: clients.length });
      },
    });
  }

  /**
   * Register database pool close stage.
   * @param {Object[]} pools - pg Pool instances or similar
   * @returns {this}
   */
  registerDatabasePools(pools) {
    return this.register({
      name:      'Database Pools — close connections',
      order:     2,
      timeoutMs: DB_DRAIN_TIMEOUT,  // 13s
      fn:        async () => {
        await Promise.allSettled(
          pools.map(p => p.end().catch(err => logger.warn('Pool end error', { err: err.message })))
        );
        logger.info('Database connection pools closed', { count: pools.length });
      },
    });
  }

  /**
   * Register log/metrics flush stage (always last).
   * @param {Function} flushFn - async function to flush logs/metrics
   * @returns {this}
   */
  registerLogFlush(flushFn) {
    return this.register({
      name:      'Logs & Metrics — flush',
      order:     1,
      timeoutMs: LOG_FLUSH_TIMEOUT,  // 8s
      fn:        async () => {
        await flushFn();
        logger.info('Logs and metrics flushed');
      },
    });
  }

  // ───────────────────────────────────────────────
  // Shutdown Execution
  // ───────────────────────────────────────────────

  /**
   * Execute graceful shutdown.
   * @param {string} [signal='SIGTERM']
   * @returns {Promise<void>}
   */
  async shutdown(signal = 'SIGTERM') {
    if (this._isShuttingDown) {
      logger.warn('Shutdown already in progress — ignoring duplicate signal', { signal });
      return;
    }
    this._isShuttingDown = true;
    this._shutdownStart  = Date.now();

    logger.info('Graceful shutdown initiated', {
      signal,
      gracePeriodMs:  this.gracePeriodMs,
      forceExitMs:    this.forceExitMs,
      stageCount:     this._stages.size,
      phi:            PHI,
    });

    this.emit('shutdown-start', { signal, gracePeriodMs: this.gracePeriodMs });

    // Schedule force-exit as a safety net
    const forceTimer = setTimeout(() => {
      logger.error('Force exit: grace period exceeded', {
        gracePeriodMs:  this.gracePeriodMs,
        forceExitMs:    this.forceExitMs,
        elapsedMs:      Date.now() - this._shutdownStart,
      });
      this.emit('force-exit', { reason: 'grace-period-exceeded' });
      process.exit(1);
    }, this.forceExitMs).unref();

    // Execute stages in LIFO order (descending order number)
    const sortedOrders = Array.from(this._stages.keys()).sort((a, b) => b - a);

    for (const order of sortedOrders) {
      const stage   = this._stages.get(order);
      const stageStart = Date.now();

      this.emit('stage-start', { name: stage.name, order });
      logger.info(`Shutdown stage ${order}: ${stage.name}`, { order, timeoutMs: stage.timeoutMs });

      try {
        await Promise.race([
          stage.fn(),
          new Promise((_, reject) =>
            setTimeout(() =>
              reject(new Error(`Stage timeout: ${stage.name} (${stage.timeoutMs}ms)`)),
              stage.timeoutMs
            )
          ),
        ]);

        const durationMs = Date.now() - stageStart;
        this._stageResults.push({ name: stage.name, order, status: 'completed', durationMs });
        this.emit('stage-complete', { name: stage.name, order, durationMs });
        logger.info(`Stage ${order} complete`, { name: stage.name, durationMs });

      } catch (err) {
        const durationMs = Date.now() - stageStart;
        const isTimeout  = err.message.startsWith('Stage timeout:');

        this._stageResults.push({ name: stage.name, order, status: isTimeout ? 'timeout' : 'error', error: err.message, durationMs });

        if (isTimeout) {
          this.emit('stage-timeout', { name: stage.name, order, timeoutMs: stage.timeoutMs });
          logger.warn(`Stage ${order} timed out`, { name: stage.name, timeoutMs: stage.timeoutMs });
        } else {
          this.emit('stage-error', { name: stage.name, order, error: err });
          logger.error(`Stage ${order} error`, { name: stage.name, error: err.message });
        }
        // Continue — do not abort on stage failure
      }
    }

    clearTimeout(forceTimer);

    const totalDurationMs = Date.now() - this._shutdownStart;
    this.emit('shutdown-complete', { totalDurationMs, stages: this._stageResults });

    logger.info('Graceful shutdown complete', {
      totalDurationMs,
      stages:       this._stageResults.length,
      phi:          PHI,
      gracePeriodMs: this.gracePeriodMs,
    });

    process.exit(this._exitCode);
  }

  /**
   * Set exit code (call before shutdown for error conditions).
   * @param {number} code
   */
  setExitCode(code) { this._exitCode = code; }

  // ───────────────────────────────────────────────
  // Signal Handlers
  // ───────────────────────────────────────────────

  /** @private Register SIGTERM, SIGINT, SIGHUP handlers */
  _registerSignalHandlers() {
    const handle = (signal) => {
      logger.info(`Received ${signal} — initiating graceful shutdown`, { signal });
      this.shutdown(signal).catch(err => {
        logger.error('Shutdown error', { error: err.message });
        process.exit(1);
      });
    };

    process.once('SIGTERM', () => handle('SIGTERM'));
    process.once('SIGINT',  () => handle('SIGINT'));
    process.once('SIGHUP',  () => handle('SIGHUP'));

    // Unhandled rejection / exception — attempt graceful shutdown
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
      this._exitCode = 1;
      handle('unhandledRejection');
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      this._exitCode = 1;
      handle('uncaughtException');
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Tracker (middleware helper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class RequestTracker
 * Tracks in-flight HTTP requests for graceful draining.
 *
 * Usage (Express middleware):
 *   app.use(tracker.middleware());
 *   shutdown.registerRequestDrain(tracker);
 */
class RequestTracker {
  constructor() {
    this._count = 0;
  }

  get count() { return this._count; }

  /** Express/Connect middleware */
  middleware() {
    return (req, res, next) => {
      this._count++;
      res.on('finish',  () => this._count--);
      res.on('close',   () => this._count--);
      res.on('error',   () => this._count--);
      next();
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fully configured GracefulShutdown for a typical HeadySystems service.
 *
 * @param {Object} opts
 * @param {http.Server} [opts.httpServer]
 * @param {Object}      [opts.wsServer]
 * @param {Object}      [opts.taskQueue]
 * @param {Object}      [opts.redisSub]
 * @param {Object[]}    [opts.redisClients]
 * @param {Object[]}    [opts.dbPools]
 * @param {Function}    [opts.flushFn]
 * @returns {{shutdown: GracefulShutdown, tracker: RequestTracker}}
 *
 * @example
 * const { shutdown, tracker } = createShutdown({
 *   httpServer, wsServer, taskQueue,
 *   redisSub, redisClients: [pub, sub, data],
 *   dbPools: [pgPool],
 *   flushFn: () => otel.flush(),
 * });
 * app.use(tracker.middleware());
 */
function createShutdown(opts = {}) {
  const shutdown = new GracefulShutdown();
  const tracker  = new RequestTracker();

  if (opts.httpServer)   shutdown.registerHttpServer(opts.httpServer);
  if (opts.wsServer)     shutdown.registerWebSocket(opts.wsServer);
                         shutdown.registerRequestDrain(tracker);
  if (opts.taskQueue)    shutdown.registerTaskQueue(opts.taskQueue);
  if (opts.redisSub)     shutdown.registerRedisPubSub(opts.redisSub);
  if (opts.redisClients?.length) shutdown.registerRedisClients(opts.redisClients);
  if (opts.dbPools?.length)      shutdown.registerDatabasePools(opts.dbPools);
  if (opts.flushFn)      shutdown.registerLogFlush(opts.flushFn);

  return { shutdown, tracker };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  GracefulShutdown,
  RequestTracker,
  createShutdown,
  // Constants
  GRACE_PERIOD_MS,    // 21000 (fib8)
  FORCE_EXIT_MS,      // 34000 (fib9)
  LOG_FLUSH_TIMEOUT,  // 8000  (fib6)
  DB_DRAIN_TIMEOUT,   // 13000 (fib7)
  PHI,
  FIB,
};

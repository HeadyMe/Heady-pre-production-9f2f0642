/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Scale Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Express middleware that applies phi-scaled timeouts, rate limits,
 * concurrency controls, adaptive response headers, request telemetry,
 * and a combined middleware runner to incoming requests.
 *
 * All numeric thresholds are sourced from DynamicTimeout,
 * DynamicRateLimit, and DynamicConcurrency — continuously adjusting
 * PhiScale instances — so every limit adapts to live system load.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

const {
    DynamicTimeout,
    DynamicRateLimit,
    DynamicConcurrency,
    getAllValues,
} = require('../core/dynamic-constants');

const telemetryFeed = require('../lib/phi-telemetry-feed');
const logger = require('../utils/logger');

// ───────────────────────────────────────────────────────────────────
// Module-level state shared across middleware instances
// ───────────────────────────────────────────────────────────────────

/** Number of requests currently being processed. */
let activeRequests = 0;

/**
 * Queue of deferred request-resolution functions waiting for a
 * concurrency slot to become free.
 *
 * Each entry: { resolve, reject, timestamp, timeoutHandle }
 */
const requestQueue = [];

// ───────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────

/**
 * Attempt to drain the next queued request into an available slot.
 * Should be called whenever activeRequests decreases.
 */
function _dequeueNext() {
    if (requestQueue.length === 0) return;

    const entry = requestQueue.shift();
    clearTimeout(entry.timeoutHandle);

    const waitTime = Date.now() - entry.timestamp;
    telemetryFeed.setAvgWaitTime(waitTime);
    telemetryFeed.setQueueDepth(requestQueue.length);

    entry.resolve();
}

/**
 * Remove an entry from the request queue by reference.
 * @param {{ resolve, reject, timestamp, timeoutHandle }} entry
 */
function _removeFromQueue(entry) {
    const idx = requestQueue.indexOf(entry);
    if (idx > -1) {
        requestQueue.splice(idx, 1);
        telemetryFeed.setQueueDepth(requestQueue.length);
    }
}

// ───────────────────────────────────────────────────────────────────
// 1. phiTimeout
// ───────────────────────────────────────────────────────────────────

/**
 * Set a per-request timeout sourced from DynamicTimeout.asMs().
 * On expiry: records an error, sends 504 with timeout metadata.
 *
 * @returns {function} Express middleware
 */
function phiTimeout() {
    return (req, res, next) => {
        const timeoutMs = DynamicTimeout.asMs();

        const handle = setTimeout(() => {
            if (res.headersSent) return;

            logger.warn(
                `[phiTimeout] Request timed out after ${timeoutMs}ms: ${req.method} ${req.path}`
            );

            telemetryFeed.recordError('timeout');

            res.status(504).json({
                error: 'Gateway Timeout',
                timeout: timeoutMs,
                message: `Request exceeded dynamically adjusted timeout of ${timeoutMs}ms`,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString(),
            });
        }, timeoutMs);

        // Clear the timer once the response is fully sent
        res.on('finish', () => clearTimeout(handle));
        res.on('close', () => clearTimeout(handle));

        next();
    };
}

// ───────────────────────────────────────────────────────────────────
// 2. phiRateLimit
// ───────────────────────────────────────────────────────────────────

/**
 * IP-based rate limiter keyed by a configurable key function.
 * The request limit per window is sourced from DynamicRateLimit.asInt().
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000]         - rolling window size in ms
 * @param {function} [options.keyFn]                - (req) => string key; defaults to req.ip
 * @returns {function} Express middleware
 */
function phiRateLimit(options = {}) {
    const windowMs = options.windowMs !== undefined ? options.windowMs : 60000;
    const keyFn = typeof options.keyFn === 'function'
        ? options.keyFn
        : (req) => req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';

    /**
     * Map of key -> { count: number, resetTime: number }
     * @type {Map<string, { count: number, resetTime: number }>}
     */
    const windows = new Map();

    // Periodic cleanup of stale windows to prevent unbounded growth
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        let pruned = 0;
        for (const [key, win] of windows) {
            if (now > win.resetTime) {
                windows.delete(key);
                pruned++;
            }
        }
        if (pruned > 0) {
            logger.debug(`[phiRateLimit] Pruned ${pruned} expired windows. Active: ${windows.size}`);
        }
    }, 60000);

    // Don't keep the process alive just for cleanup
    if (cleanupInterval.unref) cleanupInterval.unref();

    return (req, res, next) => {
        const key = keyFn(req);
        const now = Date.now();
        const limit = DynamicRateLimit.asInt();

        let win = windows.get(key);

        if (!win || now > win.resetTime) {
            win = { count: 0, resetTime: now + windowMs };
            windows.set(key, win);
        }

        win.count++;

        const remaining = Math.max(0, limit - win.count);
        const resetIso = new Date(win.resetTime).toISOString();

        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', resetIso);

        if (win.count > limit) {
            const retryAfterSeconds = Math.ceil((win.resetTime - now) / 1000);

            logger.warn(
                `[phiRateLimit] Rate limit exceeded for key=${key}: ${win.count}/${limit}`
            );

            telemetryFeed.recordError('rate_limit');

            res.setHeader('Retry-After', String(retryAfterSeconds));

            return res.status(429).json({
                error: 'Too Many Requests',
                limit,
                current: win.count,
                retryAfter: retryAfterSeconds,
                resetAt: resetIso,
                message: `Rate limit of ${limit} req/${windowMs}ms exceeded. ` +
                    `Retry after ${retryAfterSeconds}s. ` +
                    `Limit is dynamically adjusted based on system load.`,
            });
        }

        next();
    };
}

// ───────────────────────────────────────────────────────────────────
// 3. phiConcurrency
// ───────────────────────────────────────────────────────────────────

/**
 * Tracks active request count. When the count reaches the dynamic
 * concurrency ceiling, queues the request as a Promise.
 * Queue entries have a timeout equal to DynamicTimeout.asMs().
 * On completion, decrements active count and dequeues the next.
 *
 * @returns {function} Express async middleware
 */
function phiConcurrency() {
    return async (req, res, next) => {
        const maxConcurrency = DynamicConcurrency.asInt();

        if (activeRequests >= maxConcurrency) {
            const queueTimeoutMs = DynamicTimeout.asMs();

            logger.debug(
                `[phiConcurrency] Concurrency limit reached (${activeRequests}/${maxConcurrency}). ` +
                `Queueing request. Queue depth: ${requestQueue.length + 1}`
            );

            let queueEntry = null;

            const queued = new Promise((resolve, reject) => {
                queueEntry = {
                    resolve,
                    reject,
                    timestamp: Date.now(),
                    timeoutHandle: null,
                };

                queueEntry.timeoutHandle = setTimeout(() => {
                    _removeFromQueue(queueEntry);
                    telemetryFeed.recordError('queue_timeout');

                    reject(Object.assign(new Error('Queue timeout'), {
                        code: 'QUEUE_TIMEOUT',
                        queueTimeoutMs,
                    }));
                }, queueTimeoutMs);

                requestQueue.push(queueEntry);
                telemetryFeed.setQueueDepth(requestQueue.length);
            });

            try {
                await queued;
            } catch (err) {
                if (res.headersSent) return;

                logger.warn(`[phiConcurrency] Queue timeout for ${req.method} ${req.path}: ${err.message}`);

                return res.status(503).json({
                    error: 'Service Unavailable',
                    code: 'QUEUE_TIMEOUT',
                    queueDepth: requestQueue.length,
                    maxConcurrency,
                    queueTimeoutMs,
                    message: `System at capacity (${maxConcurrency} concurrent requests). ` +
                        `Request queued for ${err.queueTimeoutMs}ms and timed out. ` +
                        `Concurrency limit is dynamically adjusted.`,
                });
            }
        }

        // Slot acquired — begin processing
        activeRequests++;
        telemetryFeed.setActiveConnections(activeRequests);

        const requestStart = Date.now();

        const onFinish = () => {
            activeRequests = Math.max(0, activeRequests - 1);
            telemetryFeed.setActiveConnections(activeRequests);

            const latency = Date.now() - requestStart;
            telemetryFeed.recordLatency(latency);
            telemetryFeed.recordRequest();

            _dequeueNext();

            cleanup();
        };

        const onError = () => {
            telemetryFeed.recordError('response_error');
            cleanup();
        };

        const cleanup = () => {
            res.removeListener('finish', onFinish);
            res.removeListener('close', onFinish);
            res.removeListener('error', onError);
        };

        res.on('finish', onFinish);
        res.on('close', onFinish);
        res.on('error', onError);

        next();
    };
}

// ───────────────────────────────────────────────────────────────────
// 4. phiAdaptiveHeaders
// ───────────────────────────────────────────────────────────────────

/**
 * Appends response headers that expose current dynamic values:
 *   X-Phi-Timeout, X-Phi-RateLimit, X-Phi-Concurrency, X-Phi-Timestamp
 *
 * @returns {function} Express middleware
 */
function phiAdaptiveHeaders() {
    return (req, res, next) => {
        // Use res.on('finish') hook so we don't accidentally override headers
        // set by other middleware, but also surface values before the route runs.
        const applyHeaders = () => {
            if (!res.headersSent) return; // nothing to do after finish event
        };

        // Set headers eagerly — dynamic values as of this moment
        res.setHeader('X-Phi-Timeout', String(DynamicTimeout.asMs()));
        res.setHeader('X-Phi-RateLimit', String(DynamicRateLimit.asInt()));
        res.setHeader('X-Phi-Concurrency', String(DynamicConcurrency.asInt()));
        res.setHeader('X-Phi-Timestamp', new Date().toISOString());

        res.on('finish', applyHeaders);
        next();
    };
}

// ───────────────────────────────────────────────────────────────────
// 5. phiRequestTelemetry
// ───────────────────────────────────────────────────────────────────

/**
 * Records request start time. On response finish, records latency and
 * request count. On response error, records the error.
 *
 * @returns {function} Express middleware
 */
function phiRequestTelemetry() {
    return (req, res, next) => {
        const start = Date.now();

        const onFinish = () => {
            const latency = Date.now() - start;
            telemetryFeed.recordLatency(latency);
            telemetryFeed.recordRequest();
            cleanup();
        };

        const onError = (err) => {
            const errorType = (err && err.code) ? err.code : 'response_error';
            telemetryFeed.recordError(errorType);
            cleanup();
        };

        const cleanup = () => {
            res.removeListener('finish', onFinish);
            res.removeListener('close', onClose);
            res.removeListener('error', onError);
        };

        const onClose = () => {
            // Client disconnect before finish — still record metrics
            if (!res.writableEnded) {
                telemetryFeed.recordError('client_disconnect');
            }
            cleanup();
        };

        res.on('finish', onFinish);
        res.on('close', onClose);
        res.on('error', onError);

        next();
    };
}

// ───────────────────────────────────────────────────────────────────
// 6. phiMiddleware
// ───────────────────────────────────────────────────────────────────

/**
 * Combined middleware runner. Chains enabled middlewares in order:
 *   telemetry → concurrency → rateLimit → timeout → adaptiveHeaders
 *
 * @param {object} [options]
 * @param {boolean} [options.timeout=true]
 * @param {boolean} [options.rateLimit=true]
 * @param {boolean} [options.concurrency=true]
 * @param {boolean} [options.headers=false]
 * @param {boolean} [options.telemetry=true]
 * @param {object}  [options.rateLimitOptions]   - forwarded to phiRateLimit()
 * @returns {function} Express middleware
 */
function phiMiddleware(options = {}) {
    const enableTimeout = options.timeout !== false;
    const enableRateLimit = options.rateLimit !== false;
    const enableConcurrency = options.concurrency !== false;
    const enableHeaders = options.headers === true;
    const enableTelemetry = options.telemetry !== false;
    const rateLimitOptions = options.rateLimitOptions || {};

    const chain = [];

    // Order: telemetry first (captures full request lifecycle),
    // then concurrency gate, rate limit, timeout guard, and finally headers.
    if (enableTelemetry) chain.push(phiRequestTelemetry());
    if (enableConcurrency) chain.push(phiConcurrency());
    if (enableRateLimit) chain.push(phiRateLimit(rateLimitOptions));
    if (enableTimeout) chain.push(phiTimeout());
    if (enableHeaders) chain.push(phiAdaptiveHeaders());

    if (chain.length === 0) {
        // No-op passthrough
        return (_req, _res, next) => next();
    }

    return (req, res, next) => {
        let idx = 0;

        function runNext(err) {
            if (err) return next(err);
            if (idx >= chain.length) return next();

            const mw = chain[idx++];
            try {
                mw(req, res, runNext);
            } catch (syncErr) {
                next(syncErr);
            }
        }

        runNext();
    };
}

// ───────────────────────────────────────────────────────────────────
// 7. phiMetrics
// ───────────────────────────────────────────────────────────────────

/**
 * Returns an Express (req, res) handler that responds with a JSON
 * payload containing telemetry stats, all dynamic constant values,
 * activeRequests, queueDepth, and a system health assessment.
 *
 * Intended for use as a dedicated metrics endpoint:
 *   app.get('/metrics/phi', phiMetrics());
 *
 * @returns {function} Express (req, res) handler
 */
function phiMetrics() {
    return (req, res) => {
        try {
            const stats = telemetryFeed.getStats();
            const dynamicConstants = getAllValues();

            const payload = {
                telemetry: stats,
                dynamicConstants,
                runtime: {
                    activeRequests,
                    queueDepth: requestQueue.length,
                    maxConcurrency: DynamicConcurrency.asInt(),
                    currentTimeout: DynamicTimeout.asMs(),
                    currentRateLimit: DynamicRateLimit.asInt(),
                },
                health: stats.health,
                generatedAt: new Date().toISOString(),
            };

            res.status(200).json(payload);
        } catch (err) {
            logger.error('[phiMetrics] Failed to generate metrics response:', err);
            res.status(500).json({
                error: 'Failed to collect metrics',
                message: err.message,
            });
        }
    };
}

// ───────────────────────────────────────────────────────────────────
// Exports
// ───────────────────────────────────────────────────────────────────

module.exports = {
    phiTimeout,
    phiRateLimit,
    phiConcurrency,
    phiAdaptiveHeaders,
    phiRequestTelemetry,
    phiMiddleware,
    phiMetrics,
};

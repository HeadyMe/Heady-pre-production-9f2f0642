/**
 * ═══════════════════════════════════════════════════════════════════
 * Heady Phi Scale Middleware
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Express middleware that applies phi-scaled timeouts, rate limits,
 * and concurrency controls to incoming requests based on current load.
 * ═══════════════════════════════════════════════════════════════════
 */

const {
    DynamicTimeout,
    DynamicRateLimit,
    DynamicConcurrency
} = require('../core/dynamic-constants');
const telemetryFeed = require('../lib/phi-telemetry-feed');
const logger = require('../utils/logger');

// Track active requests for concurrency control
let activeRequests = 0;
const requestQueue = [];

/**
 * Phi-scaled timeout middleware
 */
function phiTimeout() {
    return (req, res, next) => {
        const timeoutMs = DynamicTimeout.asMs();

        const timeoutHandle = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn(`Request timeout after ${timeoutMs}ms: ${req.method} ${req.path}`);
                telemetryFeed.recordError();
                res.status(504).json({
                    error: 'Request timeout',
                    timeout: timeoutMs,
                    message: 'Request exceeded dynamically adjusted timeout threshold'
                });
            }
        }, timeoutMs);

        res.on('finish', () => {
            clearTimeout(timeoutHandle);
        });

        next();
    };
}

/**
 * Phi-scaled rate limiter
 */
function phiRateLimit() {
    const windows = new Map(); // IP -> { count, resetTime }

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowMs = 60000; // 1 minute window
        const limit = DynamicRateLimit.asInt();

        let window = windows.get(ip);

        if (!window || now > window.resetTime) {
            window = {
                count: 0,
                resetTime: now + windowMs
            };
            windows.set(ip, window);
        }

        window.count++;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - window.count));
        res.setHeader('X-RateLimit-Reset', new Date(window.resetTime).toISOString());

        if (window.count > limit) {
            logger.warn(`Rate limit exceeded for ${ip}: ${window.count}/${limit}`);
            telemetryFeed.recordError();
            return res.status(429).json({
                error: 'Rate limit exceeded',
                limit,
                retryAfter: Math.ceil((window.resetTime - now) / 1000),
                message: 'Too many requests. Rate limit is dynamically adjusted based on system load.'
            });
        }

        next();
    };
}

/**
 * Phi-scaled concurrency limiter
 */
function phiConcurrency() {
    return async (req, res, next) => {
        const maxConcurrency = DynamicConcurrency.asInt();

        if (activeRequests >= maxConcurrency) {
            logger.debug(`Concurrency limit reached: ${activeRequests}/${maxConcurrency}, queueing request`);

            // Queue the request
            await new Promise((resolve, reject) => {
                const queueEntry = {
                    resolve,
                    reject,
                    timestamp: Date.now()
                };

                requestQueue.push(queueEntry);
                telemetryFeed.setQueueDepth(requestQueue.length);

                // Timeout if queued too long
                const queueTimeout = setTimeout(() => {
                    const index = requestQueue.indexOf(queueEntry);
                    if (index > -1) {
                        requestQueue.splice(index, 1);
                        telemetryFeed.setQueueDepth(requestQueue.length);
                        telemetryFeed.recordError();
                        reject(new Error('Queue timeout'));
                    }
                }, DynamicTimeout.asMs());

                queueEntry.timeoutHandle = queueTimeout;
            }).catch(err => {
                logger.warn(`Request queue timeout: ${err.message}`);
                return res.status(503).json({
                    error: 'Service overloaded',
                    queueDepth: requestQueue.length,
                    maxConcurrency,
                    message: 'System is at capacity. Concurrency limit is dynamically adjusted.'
                });
            });
        }

        activeRequests++;
        const requestStart = Date.now();

        // Process next queued request when this one completes
        res.on('finish', () => {
            activeRequests--;

            const latency = Date.now() - requestStart;
            telemetryFeed.recordLatency(latency);
            telemetryFeed.recordRequest();

            // Dequeue next request
            if (requestQueue.length > 0) {
                const next = requestQueue.shift();
                clearTimeout(next.timeoutHandle);

                const waitTime = Date.now() - next.timestamp;
                telemetryFeed.setAvgWaitTime(waitTime);
                telemetryFeed.setQueueDepth(requestQueue.length);

                next.resolve();
            }
        });

        res.on('error', () => {
            telemetryFeed.recordError();
        });

        next();
    };
}

/**
 * Combined phi middleware (timeout + rate limit + concurrency)
 */
function phiMiddleware(options = {}) {
    const enableTimeout = options.timeout !== false;
    const enableRateLimit = options.rateLimit !== false;
    const enableConcurrency = options.concurrency !== false;

    const middlewares = [];

    if (enableConcurrency) {
        middlewares.push(phiConcurrency());
    }

    if (enableRateLimit) {
        middlewares.push(phiRateLimit());
    }

    if (enableTimeout) {
        middlewares.push(phiTimeout());
    }

    return (req, res, next) => {
        let index = 0;

        function runNext(err) {
            if (err) return next(err);

            if (index >= middlewares.length) {
                return next();
            }

            const middleware = middlewares[index++];
            middleware(req, res, runNext);
        }

        runNext();
    };
}

/**
 * Metrics endpoint middleware
 */
function phiMetrics() {
    return (req, res) => {
        const stats = telemetryFeed.getStats();
        const dynamicValues = require('../core/dynamic-constants').getAllValues();

        res.json({
            telemetry: stats,
            dynamicConstants: dynamicValues,
            activeRequests,
            queueDepth: requestQueue.length
        });
    };
}

module.exports = {
    phiTimeout,
    phiRateLimit,
    phiConcurrency,
    phiMiddleware,
    phiMetrics
};

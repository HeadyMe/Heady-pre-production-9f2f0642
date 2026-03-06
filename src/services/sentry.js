/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Sentry Error Tracking — Zero-Dependency HTTP Integration
 *
 * Sends error events to Sentry using the store/envelope HTTP API.
 * No SDK dependency needed — works in any Node.js/Cloud Run environment.
 *
 * Set SENTRY_DSN in env to override the default project DSN.
 */

'use strict';

const https = require('https');
const { URL } = require('url');
const os = require('os');
const { getLogger } = require('./structured-logger');
const logger = getLogger('sentry');

// ── DSN Parsing ─────────────────────────────────────────────
const DSN = process.env.SENTRY_DSN
    || 'https://1b34e12c988678f066c6948a31d43ff0@o4510998791192576.ingest.us.sentry.io/4510998806069248';

function parseDSN(dsn) {
    try {
        const url = new URL(dsn);
        const publicKey = url.username;
        const projectId = url.pathname.replace('/', '');
        const host = url.hostname;
        return {
            publicKey,
            projectId,
            host,
            storeUrl: `https://${host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`,
            envelopeUrl: `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`,
        };
    } catch {
        return null;
    }
}

const config = parseDSN(DSN);
const isEnabled = !!config;

// ── Event Builder ───────────────────────────────────────────
function buildEvent(err, extra = {}) {
    const now = new Date();

    return {
        event_id: randomHex(32),
        timestamp: now.toISOString(),
        platform: 'node',
        level: extra.level || 'error',
        server_name: os.hostname(),
        environment: process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || 'heady-manager@3.0.0',
        transaction: extra.transaction || undefined,

        exception: err ? {
            values: [{
                type: err.name || 'Error',
                value: err.message || String(err),
                stacktrace: err.stack ? parseStack(err.stack) : undefined,
            }],
        } : undefined,

        message: !err ? extra.message : undefined,

        tags: {
            service: 'heady-manager',
            'os.platform': os.platform(),
            'node.version': process.version,
            ...extra.tags,
        },

        extra: {
            ...extra.extra,
        },

        request: extra.request ? {
            method: extra.request.method,
            url: extra.request.originalUrl || extra.request.url,
            headers: sanitizeHeaders(extra.request.headers),
            query_string: extra.request.query,
            data: extra.request.body,
        } : undefined,

        user: extra.user || undefined,

        contexts: {
            os: { name: os.platform(), version: os.release() },
            runtime: { name: 'node', version: process.version },
        },
    };
}

function parseStack(stack) {
    const lines = stack.split('\n').slice(1);
    const frames = [];

    for (const line of lines) {
        const match = line.match(/^\s+at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
            line.match(/^\s+at\s+(.+?):(\d+):(\d+)/);
        if (match) {
            if (match.length === 5) {
                frames.push({
                    function: match[1],
                    filename: match[2],
                    lineno: parseInt(match[3], 10),
                    colno: parseInt(match[4], 10),
                    in_app: !match[2].includes('node_modules'),
                });
            } else if (match.length === 4) {
                frames.push({
                    function: '<anonymous>',
                    filename: match[1],
                    lineno: parseInt(match[2], 10),
                    colno: parseInt(match[3], 10),
                    in_app: !match[1].includes('node_modules'),
                });
            }
        }
    }

    return { frames: frames.reverse() }; // Sentry expects most recent last
}

function sanitizeHeaders(headers) {
    if (!headers) return {};
    const safe = { ...headers };
    delete safe.authorization;
    delete safe.cookie;
    delete safe['x-api-key'];
    return safe;
}

function randomHex(length) {
    const bytes = require('crypto').randomBytes(length / 2);
    return bytes.toString('hex');
}

// ── HTTP Sender ─────────────────────────────────────────────
const _queue = [];
let _sending = false;
let _stats = { sent: 0, errors: 0, dropped: 0 };

function sendEvent(event) {
    if (!isEnabled) return;
    if (_queue.length > 100) { _stats.dropped++; return; } // Backpressure
    _queue.push(event);
    if (!_sending) _flush();
}

async function _flush() {
    if (_queue.length === 0) { _sending = false; return; }
    _sending = true;
    const event = _queue.shift();

    try {
        const body = JSON.stringify(event);
        const url = new URL(config.storeUrl);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        _stats.sent++;
                    } else {
                        _stats.errors++;
                        logger.warn('Sentry rejected event', { status: res.statusCode, body: data.substring(0, 200) });
                    }
                    resolve();
                });
            });

            req.on('error', (err) => {
                _stats.errors++;
                logger.warn('Sentry send failed', { error: err.message });
                resolve(); // Don't reject — we don't want to crash on telemetry failure
            });

            req.write(body);
            req.end();
        });
    } catch (err) {
        _stats.errors++;
    }

    // Process next in queue
    setImmediate(_flush);
}

// ── Public API ──────────────────────────────────────────────

/**
 * Capture an exception and send to Sentry.
 */
function captureException(err, extra = {}) {
    const event = buildEvent(err, extra);
    sendEvent(event);
    logger.debug('Sentry: captured exception', { type: err.name, message: err.message });
    return event.event_id;
}

/**
 * Capture a plain message.
 */
function captureMessage(message, level = 'info', extra = {}) {
    const event = buildEvent(null, { message, level, ...extra });
    sendEvent(event);
    return event.event_id;
}

/**
 * Express error-handling middleware.
 * Use: app.use(sentry.errorHandler())
 */
function errorHandler() {
    return (err, req, res, next) => {
        captureException(err, {
            request: req,
            transaction: `${req.method} ${req.route?.path || req.originalUrl}`,
            tags: { status_code: err.status || 500 },
            user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
        });
        next(err); // Pass to the next error handler
    };
}

/**
 * Express request handler middleware (adds Sentry context to req).
 * Use: app.use(sentry.requestHandler())
 */
function requestHandler() {
    return (req, _res, next) => {
        req.sentry = {
            captureException: (err) => captureException(err, { request: req }),
            captureMessage: (msg, level) => captureMessage(msg, level, { request: req }),
        };
        next();
    };
}

function getStats() {
    return {
        enabled: isEnabled,
        dsn: isEnabled ? DSN.replace(/\/\/.*@/, '//***@') : null,
        org: 'headyconnection-inc',
        project: 'heady-manager',
        ...(_stats),
        queueLength: _queue.length,
    };
}

// ── Express Routes ──────────────────────────────────────────
function sentryRoutes(app) {
    app.get('/api/sentry/health', (_req, res) => {
        res.json({ ok: isEnabled, service: 'sentry', ...getStats() });
    });

    app.post('/api/sentry/test', (req, res) => {
        const eventId = captureMessage('Sentry test event from Heady Manager', 'info', {
            tags: { source: 'test-endpoint' },
        });
        res.json({ ok: true, eventId, message: 'Test event sent to Sentry' });
    });
}

module.exports = {
    captureException,
    captureMessage,
    errorHandler,
    requestHandler,
    sentryRoutes,
    getStats,
    isEnabled,
    DSN,
};

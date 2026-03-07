/**
 * Heady™ Enterprise Structured Logger
 * PR 7: JSON-formatted structured logging with correlation IDs
 * 
 * Replaces raw console.log with deterministic, searchable log output.
 * Every log line is valid JSON with timestamp, level, correlationId, and context.
 */

const crypto = require('crypto');

class StructuredLogger {
    constructor(options = {}) {
        this.service = options.service || 'heady-manager';
        this.version = options.version || process.env.npm_package_version || '3.0.1';
        this.environment = process.env.NODE_ENV || 'development';
        this.minLevel = this._levelToNumber(options.minLevel || process.env.LOG_LEVEL || 'info');
    }

    _levelToNumber(level) {
        const levels = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };
        return levels[level] || 2;
    }

    _log(level, message, context = {}) {
        if (this._levelToNumber(level) < this.minLevel) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            version: this.version,
            environment: this.environment,
            correlationId: context.correlationId || context.requestId || undefined,
            message,
            ...context,
        };

        // Remove undefined values
        Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

        const output = JSON.stringify(entry);
        if (level === 'error' || level === 'fatal') {
            process.stderr.write(output + '\n');
        } else {
            process.stdout.write(output + '\n');
        }
        return entry;
    }

    trace(msg, ctx) { return this._log('trace', msg, ctx); }
    debug(msg, ctx) { return this._log('debug', msg, ctx); }
    info(msg, ctx) { return this._log('info', msg, ctx); }
    warn(msg, ctx) { return this._log('warn', msg, ctx); }
    error(msg, ctx) { return this._log('error', msg, ctx); }
    fatal(msg, ctx) { return this._log('fatal', msg, ctx); }

    /** Create a child logger with preset context */
    child(context) {
        const child = new StructuredLogger({
            service: this.service,
            version: this.version,
            minLevel: Object.keys({ trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 })
                .find(k => ({ trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 })[k] === this.minLevel),
        });
        const parentLog = child._log.bind(child);
        child._log = (level, message, ctx = {}) => parentLog(level, message, { ...context, ...ctx });
        return child;
    }

    /** Generate a correlation ID */
    static generateCorrelationId() {
        return `hdy-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    }
}

/**
 * Express middleware: attach correlationId to every request
 */
function correlationMiddleware(logger) {
    return (req, res, next) => {
        req.correlationId = req.headers['x-correlation-id'] ||
            req.headers['x-request-id'] ||
            StructuredLogger.generateCorrelationId();

        res.setHeader('x-correlation-id', req.correlationId);

        const start = Date.now();
        const originalEnd = res.end;
        res.end = function (...args) {
            const duration = Date.now() - start;
            logger.info('request', {
                correlationId: req.correlationId,
                method: req.method,
                path: req.path,
                status: res.statusCode,
                durationMs: duration,
                userAgent: req.headers['user-agent']?.substring(0, 100),
            });
            originalEnd.apply(res, args);
        };

        next();
    };
}

module.exports = { StructuredLogger, correlationMiddleware };

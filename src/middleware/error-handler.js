/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Error Handler — Standardized error responses
 * Catches all Express errors and returns consistent JSON error objects.
 * Masks internal details in production, logs full stack traces.
 */

const logger = require('../utils/logger');
const log = { error: (msg, data) => logger.logError('ERROR-HANDLER', msg, data), info: (msg) => logger.logSystem(msg), warn: (msg) => logger.logNodeActivity('ERROR-HANDLER', msg) };

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
    }
}

// Common error factories
const Errors = {
    badRequest: (msg, details) => new AppError(msg || 'Bad Request', 400, 'BAD_REQUEST', details),
    unauthorized: (msg) => new AppError(msg || 'Unauthorized', 401, 'UNAUTHORIZED'),
    forbidden: (msg) => new AppError(msg || 'Forbidden', 403, 'FORBIDDEN'),
    notFound: (msg) => new AppError(msg || 'Not Found', 404, 'NOT_FOUND'),
    conflict: (msg) => new AppError(msg || 'Conflict', 409, 'CONFLICT'),
    rateLimit: (msg) => new AppError(msg || 'Too Many Requests', 429, 'RATE_LIMIT_EXCEEDED'),
    internal: (msg) => new AppError(msg || 'Internal Server Error', 500, 'INTERNAL_ERROR'),
    unavailable: (msg) => new AppError(msg || 'Service Unavailable', 503, 'SERVICE_UNAVAILABLE'),
};

/**
 * Express error handling middleware (4 args)
 */
function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const isProd = process.env.NODE_ENV === 'production';

    // Log the full error
    log.error('Request error', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode,
        code,
        message: err.message,
        stack: isProd ? undefined : err.stack,
        ip: req.ip,
    });

    const response = {
        error: {
            code,
            message: statusCode >= 500 && isProd ? 'Internal Server Error' : err.message,
            ...(err.details && !isProd ? { details: err.details } : {}),
            ...(req.requestId ? { requestId: req.requestId } : {}),
        },
        timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
}

/**
 * 404 catch-all middleware
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
            requestId: req.requestId,
        },
        timestamp: new Date().toISOString(),
    });
}

module.exports = { AppError, Errors, errorHandler, notFoundHandler };

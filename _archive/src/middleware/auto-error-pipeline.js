/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Auto-Error Pipeline — Express Middleware
 *
 * Global Express error-handling middleware that captures ALL HTTP errors
 * and injects them into the HCFP auto-success pipeline.
 *
 * Must be mounted LAST via app.use(autoErrorPipeline) after all routes.
 *
 * What it captures:
 *   - Thrown errors in route handlers (next(err) or throw)
 *   - 5xx server errors
 *   - 4xx client errors (for pattern analysis)
 *   - Timeouts and connection resets
 *
 * What it does NOT do:
 *   - Swallow errors — the client still gets the error response
 *   - Crash the process — all captures are try/caught
 */

const errorBridge = require("../lifecycle/error-pipeline-bridge");

/**
 * Express error-handling middleware.
 * Must have exactly 4 params (err, req, res, next) for Express to recognize it.
 */
function autoErrorPipeline(err, req, res, next) {
    try {
        const statusCode = err.status || err.statusCode || 500;
        const route = req.originalUrl || req.url || "unknown";
        const method = req.method || "?";

        errorBridge.capture({
            source: "express",
            message: err.message || "Unknown Express error",
            stack: err.stack,
            severity: statusCode >= 500 ? "critical" : "warning",
            context: {
                statusCode,
                route,
                method,
                ip: req.ip,
                userAgent: (req.headers?.["user-agent"] || "").substring(0, 100),
            },
        });
    } catch {
        // Never let the error pipeline itself crash the request
    }

    // Pass the error down so Express sends the actual response
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message || "Internal Server Error",
        statusCode,
        pipelined: true, // signal that this error was auto-captured
    });
}

/**
 * 404 catch-all middleware. Mount before the error handler.
 * Captures missing routes for pattern analysis.
 */
function notFoundCapture(req, res, next) {
    // Only capture if no route matched (avoid capturing static file 404s)
    if (!res.headersSent) {
        try {
            errorBridge.capture({
                source: "express",
                message: `404 Not Found: ${req.method} ${req.originalUrl}`,
                severity: "info",
                context: {
                    statusCode: 404,
                    route: req.originalUrl || req.url,
                    method: req.method,
                },
            });
        } catch { /* non-critical */ }
    }
    next();
}

module.exports = autoErrorPipeline;
module.exports.notFoundCapture = notFoundCapture;

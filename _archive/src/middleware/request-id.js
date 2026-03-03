/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Request ID Middleware — Distributed tracing via X-Request-ID
 * Generates or propagates request IDs for full-stack correlation.
 */

const crypto = require('crypto');

function requestId() {
    return (req, res, next) => {
        // Propagate existing ID or generate new one
        const id = req.headers['x-request-id']
            || req.headers['x-correlation-id']
            || `hdy-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

        req.requestId = id;
        res.setHeader('X-Request-ID', id);

        next();
    };
}

module.exports = { requestId };

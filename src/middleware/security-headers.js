/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Security Headers Middleware
 * Sets security headers on every response to prevent common web attacks.
 */

function securityHeaders() {
    return (req, res, next) => {
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');

        // Enable XSS filter
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Control referrer info
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Prevent caching of API responses
        if (req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
        }

        // CSP for HTML responses
        if (req.accepts('html')) {
            res.setHeader('Content-Security-Policy',
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src 'self' https://fonts.gstatic.com; " +
                "img-src 'self' data: https:; " +
                "connect-src 'self' https://*.headysystems.com https://*.headyme.com https://*.headymcp.com;"
            );
        }

        // Strict Transport Security (1 year)
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        // Permissions Policy
        res.setHeader('Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        );

        next();
    };
}

module.exports = { securityHeaders };

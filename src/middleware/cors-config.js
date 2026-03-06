/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady CORS Configuration — Production-grade origin control
 * Whitelists known Heady domains and rejects unknown origins.
 */

const ALLOWED_ORIGINS = [
    // Production domains
    'https://headyme.com', 'https://www.headyme.com',
    'https://headysystems.com', 'https://www.headysystems.com',
    'https://headyconnection.org', 'https://www.headyconnection.org',
    'https://headymcp.com', 'https://www.headymcp.com',
    'https://headyio.com', 'https://www.headyio.com',
    'https://headybuddy.org', 'https://www.headybuddy.org',
    'https://1ime1.com', 'https://www.1ime1.com',
    // App subdomains
    'https://app.headyme.com',
    'https://app.headysystems.com',
    'https://dashboard.headysystems.com',
    'https://api.headysystems.com',
    // Development (only in non-production environments)
    ...(process.env.NODE_ENV !== 'production' ? [
        `http://${process.env.DEV_HOST || '0.0.0.0'}:3000`,
        `http://${process.env.DEV_HOST || '0.0.0.0'}:3301`,
        `http://${process.env.DEV_HOST || '0.0.0.0'}:5173`,
        `http://${process.env.DEV_HOST || '0.0.0.0'}:9000`,
    ] : []),
];

// Dynamic origin matcher for wildcard subdomains
const ALLOWED_PATTERNS = [
    /^https:\/\/.*\.headyme\.com$/,
    /^https:\/\/.*\.headysystems\.com$/,
    /^https:\/\/.*\.headyconnection\.org$/,
    /^https:\/\/.*\.headymcp\.com$/,
];

function corsConfig() {
    return (req, res, next) => {
        const origin = req.headers.origin;

        if (!origin) {
            // No origin = same-origin or non-browser (allow)
            next();
            return;
        }

        const isAllowed =
            ALLOWED_ORIGINS.includes(origin) ||
            ALLOWED_PATTERNS.some(p => p.test(origin));

        if (isAllowed) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-API-Key');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24h preflight cache
            res.setHeader('Vary', 'Origin');
        }

        if (req.method === 'OPTIONS') {
            res.status(204).end();
            return;
        }

        next();
    };
}

module.exports = { corsConfig, ALLOWED_ORIGINS, ALLOWED_PATTERNS };

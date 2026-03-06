/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Dynamic Domain Router
 * ═══════════════════════════════════════════════════════════════
 *
 * When a user visits any Heady domain (headymcp.com, headysystems.com,
 * headyconnection.org, etc.), DNS points to the HeadyWeb Universal Shell.
 * This router reads the incoming hostname and projects the corresponding
 * UI from the monorepo.
 *
 * Integration: Plugs into the ui-registry.js manifest system.
 */

const logger = require('./structured-logger');

// ── Domain → UI Projection Matrix ───────────────────────────────
const DOMAIN_PROJECTIONS = {
    // Master Control Program
    'headymcp.com': { uiId: 'heady-ide', module: 'AdminCore', category: 'admin' },
    'www.headymcp.com': { uiId: 'heady-ide', module: 'AdminCore', category: 'admin' },

    // Corporate / Systems Vertical
    'headysystems.com': { uiId: 'systems-landing', module: 'SystemsLanding', category: 'corporate' },
    'www.headysystems.com': { uiId: 'systems-landing', module: 'SystemsLanding', category: 'corporate' },

    // Community / Connection Portal
    'headyconnection.org': { uiId: 'connection-portal', module: 'UserHub', category: 'community' },
    'www.headyconnection.org': { uiId: 'connection-portal', module: 'UserHub', category: 'community' },

    // HeadyMe main site
    'headyme.com': { uiId: 'landing', module: 'MainLanding', category: 'main' },
    'www.headyme.com': { uiId: 'landing', module: 'MainLanding', category: 'main' },

    // AI / Hugging Face Integration Hub
    'ai.headyme.com': { uiId: 'ai-playground', module: 'ModelPlayground', category: 'ai' },

    // API / Edge
    'heady.headyme.com': { uiId: 'antigravity', module: 'Antigravity3D', category: 'edge' },
    'api.headyme.com': { uiId: 'api-docs', module: 'APIDocs', category: 'api' },

    // Hugging Face Spaces (proxied)
    'demo.headyme.com': { uiId: 'hf-demo', module: 'HFDemo', category: 'demos' },

    // HeadyOS — Operating System for AI
    'headyos.com': { uiId: 'heady-os', module: 'HeadyOS', category: 'operating-system' },
    'www.headyos.com': { uiId: 'heady-os', module: 'HeadyOS', category: 'operating-system' },

    // HeadyAPI — Public API Gateway
    'headyapi.com': { uiId: 'api-docs', module: 'APIDocs', category: 'public-api' },
    'www.headyapi.com': { uiId: 'api-docs', module: 'APIDocs', category: 'public-api' },

    // HeadyBot — Automation & Webhooks
    'headybot.com': { uiId: 'heady-bot', module: 'HeadyBot', category: 'automation' },
    'www.headybot.com': { uiId: 'heady-bot', module: 'HeadyBot', category: 'automation' },

    // HeadyIO — Developer Portal
    'headyio.com': { uiId: 'heady-io', module: 'HeadyIO', category: 'developer-platform' },
    'www.headyio.com': { uiId: 'heady-io', module: 'HeadyIO', category: 'developer-platform' },

    // HeadyBuddy — AI Assistant
    'headybuddy.org': { uiId: 'heady-buddy', module: 'HeadyBuddy', category: 'ai-assistant' },
    'www.headybuddy.org': { uiId: 'heady-buddy', module: 'HeadyBuddy', category: 'ai-assistant' },
    'headybuddy.com': { uiId: 'heady-buddy', module: 'HeadyBuddy', category: 'ai-assistant' },

    // Localhost development
    'localhost': { uiId: 'antigravity', module: 'Antigravity3D', category: 'dev' },
};

// ── Core Router ─────────────────────────────────────────────────

/**
 * Resolve which UI to project based on the incoming hostname.
 *
 * @param {string} hostname - The incoming request hostname
 * @returns {Object} The matched projection config, or the default fallback
 */
function resolveProjection(hostname) {
    if (!hostname) return _getDefault();

    // Strip port number if present
    const cleanHost = hostname.split(':')[0].toLowerCase();

    // Direct match
    if (DOMAIN_PROJECTIONS[cleanHost]) {
        return {
            matched: true,
            hostname: cleanHost,
            ...DOMAIN_PROJECTIONS[cleanHost],
        };
    }

    // Wildcard subdomain match (*.headyme.com)
    const parts = cleanHost.split('.');
    if (parts.length >= 3) {
        const baseDomain = parts.slice(-2).join('.');
        const subdomain = parts.slice(0, -2).join('.');

        // Check for subdomain.headyme.com pattern
        const subdomainKey = `${subdomain}.${baseDomain}`;
        if (DOMAIN_PROJECTIONS[subdomainKey]) {
            return {
                matched: true,
                hostname: cleanHost,
                subdomain,
                ...DOMAIN_PROJECTIONS[subdomainKey],
            };
        }
    }

    return _getDefault(cleanHost);
}

function _getDefault(hostname) {
    return {
        matched: false,
        hostname: hostname || 'unknown',
        uiId: 'landing',
        module: 'MainLanding',
        category: 'default',
    };
}

/**
 * Express middleware that injects the domain projection into req.headyProjection.
 */
function domainRoutingMiddleware(req, _res, next) {
    const hostname = req.hostname || req.headers.host || 'localhost';
    req.headyProjection = resolveProjection(hostname);
    next();
}

/**
 * Register a custom domain → UI mapping at runtime.
 */
function registerDomain(hostname, uiId, module, category = 'custom') {
    DOMAIN_PROJECTIONS[hostname.toLowerCase()] = { uiId, module, category };
    logger.info(`DomainRouter: registered ${hostname} → ${uiId}`);
}

/**
 * Get all registered domain projections.
 */
function getDomainMatrix() {
    return Object.entries(DOMAIN_PROJECTIONS).map(([hostname, config]) => ({
        hostname,
        ...config,
    }));
}

// ── Express Routes ──────────────────────────────────────────────

function domainRouterRoutes(app) {
    // Resolve a hostname
    app.get('/api/domains/resolve', (req, res) => {
        const hostname = req.query.hostname || req.hostname || req.headers.host;
        res.json(resolveProjection(hostname));
    });

    // List all domain projections
    app.get('/api/domains/matrix', (_req, res) => {
        res.json({
            totalDomains: Object.keys(DOMAIN_PROJECTIONS).length,
            categories: [...new Set(Object.values(DOMAIN_PROJECTIONS).map(p => p.category))],
            projections: getDomainMatrix(),
        });
    });

    // Register a new domain
    app.post('/api/domains/register', (req, res) => {
        const { hostname, uiId, module, category } = req.body;
        if (!hostname || !uiId || !module) {
            return res.status(400).json({ error: 'hostname, uiId, and module required' });
        }
        registerDomain(hostname, uiId, module, category);
        res.json({ ok: true, registered: hostname });
    });

    // Current projection for this request
    app.get('/api/domains/current', (req, res) => {
        const hostname = req.hostname || req.headers.host || 'localhost';
        res.json(resolveProjection(hostname));
    });

    logger.info('DomainRouter: routes registered at /api/domains/*');
}

module.exports = {
    resolveProjection,
    domainRoutingMiddleware,
    registerDomain,
    getDomainMatrix,
    domainRouterRoutes,
    DOMAIN_PROJECTIONS,
};

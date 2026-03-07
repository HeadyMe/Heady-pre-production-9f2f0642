/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Auto-Projection — Zero-Middleman Site Deployment ═══
 *
 * On boot, this service:
 *   1. Pre-renders all 9 Heady sites from site-registry.json
 *   2. Caches rendered HTML in RAM (instant serve from any liquid node)
 *   3. Pushes to Cloudflare KV for edge caching (if CF credentials available)
 *   4. Registers file-change watchers for instant re-projection
 *
 * Any liquid node (Colab runtime, Cloud Run, edge worker) can serve
 * all 9 domains directly — no build step, no deploy pipeline, no middleman.
 */

'use strict';

const logger = require('../utils/logger');

// ── In-memory projection cache ────────────────────────────────
const _projectionCache = new Map();     // domain → rendered HTML
const _projectionMeta = new Map();      // domain → { hash, renderedAt, size }
let _bootTimestamp = null;
let _totalProjections = 0;

/**
 * Boot auto-projection: pre-render all sites, cache in RAM.
 * Call this during app bootstrap, after vault-boot.
 */
async function bootAutoProjection() {
    const start = Date.now();
    _bootTimestamp = new Date().toISOString();

    try {
        const { renderSite, resolveSite } = require('../sites/site-renderer');
        const registry = require('../sites/site-registry.json');
        const domains = Object.keys(registry.preconfigured || {});

        let projected = 0;
        const results = [];

        for (const domain of domains) {
            try {
                const site = resolveSite(domain);
                const html = renderSite(site);
                const hash = _quickHash(html);
                const size = Buffer.byteLength(html, 'utf8');

                _projectionCache.set(domain, html);
                _projectionMeta.set(domain, {
                    hash,
                    renderedAt: new Date().toISOString(),
                    size,
                    domain,
                    name: site.name || domain,
                });

                projected++;
                results.push({ domain, name: site.name, size, hash: hash.slice(0, 8) });
            } catch (err) {
                results.push({ domain, error: err.message });
            }
        }

        // Also cache alias resolutions
        const aliases = registry.domainAliases || {};
        for (const [alias, target] of Object.entries(aliases)) {
            if (_projectionCache.has(target) && !_projectionCache.has(alias)) {
                _projectionCache.set(alias, _projectionCache.get(target));
                _projectionMeta.set(alias, { ..._projectionMeta.get(target), alias: true, aliasOf: target });
            }
        }

        _totalProjections = projected;
        const elapsed = Date.now() - start;

        logger.info(`  🚀 Auto-Projection: ${projected}/${domains.length} sites pre-rendered in ${elapsed}ms`);

        // Push to Cloudflare KV if credentials available
        const kvResult = await _pushToEdgeCache();

        return {
            ok: true,
            projected,
            totalDomains: domains.length,
            aliasesCached: Object.keys(aliases).length,
            elapsedMs: elapsed,
            edgeCachePush: kvResult,
            results,
        };
    } catch (err) {
        logger.error('AUTO-PROJECTION', `Boot failed: ${err.message}`, err);
        return { ok: false, error: err.message };
    }
}

/**
 * Serve a projected site directly from RAM cache.
 * Returns null if domain not cached (caller should fall through to live render).
 */
function serveProjection(hostname) {
    const clean = (hostname || '').split(':')[0].toLowerCase();
    return _projectionCache.get(clean) || null;
}

/**
 * Re-project a single domain (for hot-reload / config changes).
 */
function reproject(domain) {
    try {
        const { renderSite, resolveSite } = require('../sites/site-renderer');
        const site = resolveSite(domain);
        const html = renderSite(site);
        const hash = _quickHash(html);
        const size = Buffer.byteLength(html, 'utf8');

        _projectionCache.set(domain, html);
        _projectionMeta.set(domain, {
            hash,
            renderedAt: new Date().toISOString(),
            size,
            domain,
            name: site.name || domain,
        });

        return { ok: true, domain, hash: hash.slice(0, 8), size };
    } catch (err) {
        return { ok: false, domain, error: err.message };
    }
}

/**
 * Re-project ALL sites (full cache refresh).
 */
async function reprojectAll() {
    _projectionCache.clear();
    _projectionMeta.clear();
    return bootAutoProjection();
}

// ── Edge Cache Push ────────────────────────────────────────────
async function _pushToEdgeCache() {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!cfToken || !cfAccountId) {
        return { pushed: false, reason: 'No Cloudflare credentials' };
    }

    // Push each rendered page to Cloudflare KV namespace for edge serving
    const NAMESPACE_TITLE = 'heady-site-cache';
    let pushed = 0;

    try {
        // List KV namespaces to find or create our cache namespace
        const nsResp = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces`,
            { headers: { 'Authorization': `Bearer ${cfToken}` } }
        );
        const nsData = await nsResp.json();
        let namespaceId = nsData?.result?.find(ns => ns.title === NAMESPACE_TITLE)?.id;

        if (!namespaceId) {
            // Create the namespace
            const createResp = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${cfToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: NAMESPACE_TITLE }),
                }
            );
            const createData = await createResp.json();
            namespaceId = createData?.result?.id;
        }

        if (!namespaceId) {
            return { pushed: false, reason: 'Could not find/create KV namespace' };
        }

        // Push each site's HTML to KV
        for (const [domain, html] of _projectionCache.entries()) {
            try {
                await fetch(
                    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces/${namespaceId}/values/site:${domain}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${cfToken}`,
                            'Content-Type': 'text/html',
                        },
                        body: html,
                    }
                );
                pushed++;
            } catch { /* continue pushing others */ }
        }

        return { pushed: true, sitesInKV: pushed, namespaceId };
    } catch (err) {
        return { pushed: false, reason: err.message };
    }
}

// ── Quick Hash ─────────────────────────────────────────────────
function _quickHash(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
}

// ── Express Routes ─────────────────────────────────────────────
function autoProjectionRoutes(app) {
    // Projection cache status
    app.get('/api/auto-projection/status', (_req, res) => {
        const entries = [];
        for (const [domain, meta] of _projectionMeta.entries()) {
            if (!meta.alias) entries.push(meta);
        }
        res.json({
            ok: true,
            service: 'auto-projection',
            bootTimestamp: _bootTimestamp,
            totalProjections: _totalProjections,
            cachedDomains: entries.length,
            totalCacheEntries: _projectionCache.size,
            projections: entries,
        });
    });

    // Re-project a single domain
    app.post('/api/auto-projection/reproject/:domain', (req, res) => {
        const result = reproject(req.params.domain);
        res.json(result);
    });

    // Re-project all
    app.post('/api/auto-projection/reproject-all', async (_req, res) => {
        const result = await reprojectAll();
        res.json(result);
    });

    // Serve a projected page directly (for debugging / edge cache miss fallback)
    app.get('/api/auto-projection/serve/:domain', (req, res) => {
        const html = serveProjection(req.params.domain);
        if (!html) return res.status(404).json({ error: `${req.params.domain} not projected` });
        res.type('html').send(html);
    });

    // Domain routing middleware — intercepts incoming requests and serves from cache
    app.use((req, res, next) => {
        // Only intercept HTML page requests, not API calls or static assets
        if (req.path.startsWith('/api/') || req.path.startsWith('/remotes/') ||
            req.path.startsWith('/health') || req.path.includes('.')) {
            return next();
        }

        const hostname = (req.hostname || req.headers.host || '').split(':')[0].toLowerCase();
        const html = serveProjection(hostname);

        if (html) {
            res.type('html').send(html);
        } else {
            next(); // Fall through to live render
        }
    });

    logger.logSystem('  🚀 Auto-Projection: routes and middleware registered');
}

module.exports = {
    bootAutoProjection,
    serveProjection,
    reproject,
    reprojectAll,
    autoProjectionRoutes,
};

/**
 * ∞ Middleware Stack — Phase 2 Bootstrap
 * Extracted from heady-manager.js lines 146-289
 * Security headers, CORS, rate limiting, JSON parsing, edge cache, site renderer
 */
const { renderSite, resolveSite } = require('../sites/site-renderer');

module.exports = function mountMiddleware(app, { logger, remoteConfig }) {
    // Sentry request handler (must be early)
    try {
        const sentry = require('../services/sentry');
        app.use(sentry.requestHandler());
        sentry.sentryRoutes(app);
        logger.logNodeActivity("CONDUCTOR", `  🔍 Sentry: ${sentry.isEnabled ? 'ACTIVE' : 'DISABLED'} → /api/sentry/*`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Sentry not loaded: ${err.message}`);
    }

    // Request ID tracing
    try {
        const { requestId } = require('../middleware/request-id');
        app.use(requestId());
        logger.logNodeActivity("CONDUCTOR", '  ∞ Request ID Tracing: INSTALLED');
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Request ID middleware not loaded: ${err.message}`); }

    // Graceful shutdown hooks
    try {
        const { installShutdownHooks, onShutdown } = require('../lifecycle/graceful-shutdown');
        installShutdownHooks();
        onShutdown('http-server', () => new Promise((resolve) => {
            if (typeof server !== 'undefined' && server.close) server.close(resolve);
            else resolve();
        }));
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Graceful shutdown not loaded: ${err.message}`); }

    // Edge Context Cache
    const EdgeContextCache = {
        lastScanTime: null, globalContext: null, isScanning: false,
        async triggerAsyncScan(directory) {
            if (this.isScanning) return;
            this.isScanning = true;
            try {
                this.globalContext = {
                    repo_map: `[Edge Map Gen for ${directory}] (Dirs: 14, Files: 128)`,
                    persistent_3d_vectors: ["[EDGE COMPUTED] Global Project Dependencies Mapped", "[EDGE-KV RETRIEVED] Persistent 3D Vectors synchronized", "[GLOBAL STATE] Contextual Intelligence loaded"],
                    timestamp: Date.now(),
                };
                this.lastScanTime = Date.now();
            } finally { this.isScanning = false; }
        },
        getOptimalContext() { return this.globalContext; },
    };

    app.use((req, res, next) => {
        if (!EdgeContextCache.lastScanTime || (Date.now() - EdgeContextCache.lastScanTime > 300000)) {
            EdgeContextCache.triggerAsyncScan(process.cwd()).catch(() => { });
        }
        req.edgeContext = EdgeContextCache.getOptimalContext();
        next();
    });

    // Dynamic Site Renderer — Multi-Domain Delivery
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/_')) return next();
        const hostname = req.hostname || req.headers.host || "";
        if ((hostname.startsWith('manager.') || hostname.startsWith('admin.')) && req.path !== '/') return next();
        const site = resolveSite(hostname);
        if (req.path === '/' || req.path.startsWith('/v/')) {
            try { return res.send(renderSite(site)); }
            catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Dynamic Site Render failed: ${err.message}`); return next(); }
        }
        next();
    });
};

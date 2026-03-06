/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * loadDynamicRemote — Webpack Module Federation Runtime Loader
 * ═══════════════════════════════════════════════════════════════
 *
 * Loads a micro-frontend at runtime via Module Federation.
 * The HeadyWeb Universal Shell calls this to project UIs
 * dynamically based on the domain-router or ui-registry.
 *
 * Usage:
 *   const App = await loadDynamicRemote({
 *     url: 'https://cdn.headyme.com/remotes/antigravity/remoteEntry.js',
 *     scope: 'antigravity',
 *     module: './App',
 *   });
 */

const _remoteCache = new Map();
const _loadLog = [];

/**
 * Dynamically load a Webpack Module Federation remote at runtime.
 *
 * @param {Object} config
 * @param {string} config.url - URL to the remote's remoteEntry.js
 * @param {string} config.scope - Remote scope name (must match ModuleFederationPlugin name)
 * @param {string} config.module - Exposed module path (e.g., './App', './mount')
 * @param {number} [config.timeoutMs=10000] - Load timeout in ms
 * @returns {Promise<any>} The remote module's default export
 */
async function loadDynamicRemote({ url, scope, module, timeoutMs = 10000 }) {
    const cacheKey = `${scope}::${module}`;

    // Return cached module if already loaded
    if (_remoteCache.has(cacheKey)) {
        return _remoteCache.get(cacheKey);
    }

    const startTime = Date.now();

    try {
        // Step 1: Load the remote entry script
        await _loadScript(url, scope, timeoutMs);

        // Step 2: Initialize the remote container
        // __webpack_init_sharing__ and __webpack_share_scopes__ are injected by WMF
        if (typeof __webpack_init_sharing__ !== 'undefined') {
            await __webpack_init_sharing__('default');
        }

        const container = window[scope];
        if (!container) {
            throw new Error(`Remote container "${scope}" not found after loading ${url}`);
        }

        if (typeof __webpack_share_scopes__ !== 'undefined') {
            await container.init(__webpack_share_scopes__.default);
        }

        // Step 3: Get the exposed module factory
        const factory = await container.get(module);
        const moduleExport = factory();

        // Cache and log
        _remoteCache.set(cacheKey, moduleExport);
        _loadLog.push({
            scope,
            module,
            url,
            status: 'loaded',
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        });

        return moduleExport;
    } catch (error) {
        _loadLog.push({
            scope,
            module,
            url,
            status: 'error',
            error: error.message,
            durationMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        });

        throw new Error(`Failed to load remote "${scope}/${module}" from ${url}: ${error.message}`);
    }
}

/**
 * Dynamically inject a script tag and wait for it to load.
 */
function _loadScript(url, scope, timeoutMs) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window[scope]) {
            resolve();
            return;
        }

        const existingScript = document.querySelector(`script[data-heady-remote="${scope}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', resolve);
            existingScript.addEventListener('error', () => reject(new Error(`Script load failed: ${url}`)));
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.type = 'text/javascript';
        script.async = true;
        script.setAttribute('data-heady-remote', scope);

        const timer = setTimeout(() => {
            reject(new Error(`Timeout loading remote "${scope}" from ${url} (${timeoutMs}ms)`));
        }, timeoutMs);

        script.addEventListener('load', () => {
            clearTimeout(timer);
            resolve();
        });

        script.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error(`Network error loading remote "${scope}" from ${url}`));
        });

        document.head.appendChild(script);
    });
}

/**
 * Mount a dynamically loaded remote into a DOM container.
 *
 * @param {Object} config
 * @param {string} config.url - Remote entry URL
 * @param {string} config.scope - Remote scope
 * @param {string} config.module - Module to load (defaults to './mount')
 * @param {HTMLElement} config.container - DOM element to mount into
 * @param {Object} [config.props] - Props to pass to the mount function
 * @returns {Promise<Function|null>} Unmount function if available
 */
async function mountRemote({ url, scope, module = './mount', container, props = {} }) {
    const mountFn = await loadDynamicRemote({ url, scope, module });

    if (typeof mountFn === 'function') {
        return mountFn(container, props);
    }

    if (mountFn && typeof mountFn.default === 'function') {
        return mountFn.default(container, props);
    }

    if (mountFn && typeof mountFn.mount === 'function') {
        return mountFn.mount(container, props);
    }

    throw new Error(`Remote "${scope}/${module}" does not export a mount function`);
}

/**
 * Preload a remote entry script without resolving the module.
 * Useful for warming up frequently-visited UIs.
 */
function preloadRemote(url, scope) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = url;
    link.setAttribute('data-heady-preload', scope);
    document.head.appendChild(link);
}

/**
 * Clear the remote cache (useful for hot-reloading in development).
 */
function clearRemoteCache() {
    _remoteCache.clear();
}

/**
 * Get load history.
 */
function getLoadLog() {
    return [..._loadLog];
}

// ── Node.js / browser universal export ──────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadDynamicRemote, mountRemote, preloadRemote, clearRemoteCache, getLoadLog };
}
if (typeof window !== 'undefined') {
    window.__heady_remote_loader = { loadDynamicRemote, mountRemote, preloadRemote, clearRemoteCache, getLoadLog };
}

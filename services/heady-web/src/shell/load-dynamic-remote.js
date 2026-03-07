/**
 * HeadyWeb — Module Federation Runtime Loader
 *
 * Provides utilities for dynamically loading and mounting remote micro-frontends
 * at runtime using Webpack 5's Module Federation sharing and container APIs.
 *
 * Key API:
 *  - loadDynamicRemote({ url, scope, module, timeoutMs }) → factory function
 *  - mountRemote({ url, scope, module, container, props }) → { unmount }
 *  - preloadRemote(url, scope) → void
 *  - clearRemoteCache() → void
 *  - getLoadLog() → LoadLogEntry[]
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module shell/load-dynamic-remote
 */

'use strict';

// ── Internal State ────────────────────────────────────────────────────────────

/**
 * Cache of already-loaded remotes, keyed by URL.
 * Prevents duplicate script injection and double-initialization.
 * @type {Map<string, Promise<unknown>>}
 */
const _remoteCache = new Map();

/**
 * Diagnostic log of all remote load attempts.
 * @type {Array<{url: string, scope: string, status: 'ok'|'error', timestamp: number, durationMs: number, error?: string}>}
 */
const _loadLog = [];

// ── Script Loader ─────────────────────────────────────────────────────────────

/**
 * Inject a script tag for a remote entry and wait for it to load.
 * Idempotent — if the script already exists in the DOM, resolves immediately.
 *
 * @param {string} url - The remote entry URL (e.g. /remotes/antigravity/remoteEntry.js)
 * @param {string} scope - The Module Federation scope name (e.g. 'antigravity')
 * @param {number} [timeoutMs=10000] - Timeout before rejecting
 * @returns {Promise<void>}
 */
function _loadScript(url, scope, timeoutMs = 10000) {
  // Return cached promise if already loading/loaded
  if (_remoteCache.has(url)) {
    return _remoteCache.get(url);
  }

  // Check if script tag already in DOM
  const existing = document.querySelector(`script[data-heady-remote="${scope}"]`);
  if (existing) {
    const resolved = Promise.resolve();
    _remoteCache.set(url, resolved);
    return resolved;
  }

  const promise = new Promise((resolve, reject) => {
    const startTime = Date.now();

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.setAttribute('data-heady-remote', scope);
    script.setAttribute('data-heady-url', url);

    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      cleanup();
      const durationMs = Date.now() - startTime;
      _loadLog.push({ url, scope, status: 'ok', timestamp: startTime, durationMs });
      resolve();
    };

    const onError = (event) => {
      cleanup();
      const durationMs = Date.now() - startTime;
      const message = `Failed to load remote script: ${url}`;
      _loadLog.push({ url, scope, status: 'error', timestamp: startTime, durationMs, error: message });
      // Remove the failed script tag so it can be retried
      script.remove();
      _remoteCache.delete(url);
      reject(new Error(message));
    };

    timer = setTimeout(() => {
      cleanup();
      script.remove();
      _remoteCache.delete(url);
      const message = `Remote script load timed out after ${timeoutMs}ms: ${url}`;
      _loadLog.push({ url, scope, status: 'error', timestamp: startTime, durationMs: timeoutMs, error: message });
      reject(new Error(message));
    }, timeoutMs);

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    document.head.appendChild(script);
  });

  _remoteCache.set(url, promise);
  return promise;
}

// ── Module Federation Init ────────────────────────────────────────────────────

/**
 * Initialize Module Federation's shared scope and get the factory for a module.
 *
 * @param {string} scope - The container scope name on window
 * @param {string} module - The module path exposed by the remote (e.g. './App')
 * @returns {Promise<() => unknown>}
 */
async function _initContainer(scope, module) {
  const container = window[scope];

  if (!container) {
    throw new Error(
      `Module Federation container "${scope}" not found on window. ` +
      `Ensure the remote entry script was loaded correctly.`
    );
  }

  // Initialize the container with the current shared scope
  // This wires up shared dependencies (e.g. three.js singleton)
  await __webpack_init_sharing__('default');
  await container.init(__webpack_share_scopes__.default);

  // Get the factory for the requested module
  const factory = await container.get(module);
  if (!factory) {
    throw new Error(`Module "${module}" not found in container "${scope}"`);
  }

  return factory;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Dynamically load a Module Federation remote and return the factory function
 * for the requested module.
 *
 * @param {object} options
 * @param {string} options.url          - Remote entry URL
 * @param {string} options.scope        - MF container scope name
 * @param {string} options.module       - Exposed module path (e.g. './App')
 * @param {number} [options.timeoutMs=10000] - Script load timeout
 * @returns {Promise<() => unknown>} The module factory
 *
 * @example
 * const factory = await loadDynamicRemote({
 *   url: '/remotes/antigravity/remoteEntry.js',
 *   scope: 'antigravity',
 *   module: './App',
 * });
 * const AppModule = factory();
 */
async function loadDynamicRemote({ url, scope, module: modulePath, timeoutMs = 10000 }) {
  if (!url || !scope || !modulePath) {
    throw new TypeError('loadDynamicRemote: url, scope, and module are all required');
  }

  try {
    await _loadScript(url, scope, timeoutMs);
    const factory = await _initContainer(scope, modulePath);
    return factory;
  } catch (err) {
    throw new Error(`[HeadyShell] loadDynamicRemote failed for "${scope}/${modulePath}": ${err.message}`);
  }
}

/**
 * Load a remote module and call its mount lifecycle function.
 *
 * The remote is expected to expose one of:
 *  - `./mount` — preferred: export { mount, unmount }
 *  - `./App`   — fallback: default export is a component/factory
 *
 * @param {object} options
 * @param {string} options.url          - Remote entry URL
 * @param {string} options.scope        - MF container scope name
 * @param {string} options.module       - Exposed module path
 * @param {HTMLElement} options.container - DOM element to mount into
 * @param {object} [options.props={}]   - Props passed to mount()
 * @returns {Promise<{ unmount: () => void }>}
 *
 * @example
 * const { unmount } = await mountRemote({
 *   url: '/remotes/landing/remoteEntry.js',
 *   scope: 'headyLanding',
 *   module: './App',
 *   container: document.getElementById('heady-root'),
 *   props: { theme: 'dark' },
 * });
 */
async function mountRemote({ url, scope, module: modulePath, container, props = {} }) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('mountRemote: container must be an HTMLElement');
  }

  let mountFn = null;
  let unmountFn = null;

  // ── Try ./mount first (preferred lifecycle API) ───────────────────────────
  try {
    const mountFactory = await loadDynamicRemote({
      url,
      scope,
      module: './mount',
    });
    const mountModule = mountFactory();
    const defaultExport = mountModule?.default || mountModule;

    if (typeof defaultExport?.mount === 'function') {
      mountFn = defaultExport.mount;
      unmountFn = defaultExport.unmount;
    } else if (typeof defaultExport === 'function') {
      mountFn = defaultExport;
    }
  } catch (_) {
    // ./mount not available — fall through to ./App
  }

  // ── Fall back to ./App ────────────────────────────────────────────────────
  if (!mountFn) {
    const factory = await loadDynamicRemote({ url, scope, module: modulePath });
    const appModule = factory();
    const appExport = appModule?.default || appModule;

    if (typeof appExport?.mount === 'function') {
      mountFn = appExport.mount;
      unmountFn = appExport.unmount;
    } else if (typeof appExport === 'function') {
      // Treat the export itself as the mount function
      mountFn = appExport;
    } else {
      throw new Error(
        `Remote "${scope}" does not export a mount function. ` +
        `Expected export { mount } or default function.`
      );
    }
  }

  // ── Call mount ────────────────────────────────────────────────────────────
  const result = await mountFn(container, props);

  // Normalize return value — some remotes return { unmount }, others return unmount directly
  let finalUnmount = () => {};
  if (typeof result?.unmount === 'function') {
    finalUnmount = result.unmount;
  } else if (typeof result === 'function') {
    finalUnmount = result;
  } else if (typeof unmountFn === 'function') {
    finalUnmount = () => unmountFn(container);
  }

  return { unmount: finalUnmount };
}

/**
 * Emit a `<link rel="preload">` hint for a remote entry script.
 * Called eagerly for frequently-used remotes to reduce load latency.
 *
 * @param {string} url   - Remote entry URL
 * @param {string} scope - MF scope name (used as id for deduplication)
 */
function preloadRemote(url, scope) {
  if (!url) return;

  const existingLink = document.querySelector(`link[data-heady-preload="${scope}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = url;
  link.setAttribute('data-heady-preload', scope);
  document.head.appendChild(link);
}

/**
 * Clear the internal remote cache.
 * Useful for hot-reloading or testing scenarios.
 */
function clearRemoteCache() {
  _remoteCache.clear();
}

/**
 * Return a copy of the diagnostic load log.
 * @returns {Array<object>}
 */
function getLoadLog() {
  return [..._loadLog];
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  loadDynamicRemote,
  mountRemote,
  preloadRemote,
  clearRemoteCache,
  getLoadLog,
};

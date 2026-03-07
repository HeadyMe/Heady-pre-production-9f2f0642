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
export function loadDynamicRemote({ url, scope, module, timeoutMs }: {
    url: string;
    scope: string;
    module: string;
    timeoutMs?: number | undefined;
}): Promise<any>;
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
export function mountRemote({ url, scope, module, container, props }: {
    url: string;
    scope: string;
    module: string;
    container: HTMLElement;
    props?: Object | undefined;
}): Promise<Function | null>;
/**
 * Preload a remote entry script without resolving the module.
 * Useful for warming up frequently-visited UIs.
 */
export function preloadRemote(url: any, scope: any): void;
/**
 * Clear the remote cache (useful for hot-reloading in development).
 */
export function clearRemoteCache(): void;
/**
 * Get load history.
 */
export function getLoadLog(): any[];
//# sourceMappingURL=load-dynamic-remote.d.ts.map
/**
 * Register a cleanup handler to run during shutdown
 * @param {string} name - handler name for logging
 * @param {Function} fn - async cleanup function
 */
export function onShutdown(name: string, fn: Function): void;
/**
 * Execute all shutdown handlers in reverse registration order
 * @param {string} signal - the signal that triggered shutdown
 */
export function gracefulShutdown(signal: string): Promise<void>;
/**
 * Install global signal and error handlers
 * Call this once at app startup.
 */
export function installShutdownHooks(): void;
export declare function isShuttingDown(): boolean;
//# sourceMappingURL=graceful-shutdown.d.ts.map
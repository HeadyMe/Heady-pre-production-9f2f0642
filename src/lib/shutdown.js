/**
 * E3: Graceful Shutdown Manager
 * SIGTERM → drain connections → close DB pools → flush telemetry → exit
 * @module src/lib/shutdown
 */
'use strict';

const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '15000', 10);

class ShutdownManager {
    constructor() {
        this._hooks = [];
        this._shuttingDown = false;
        this._registered = false;
    }

    register(name, fn, priority = 10) {
        this._hooks.push({ name, fn, priority });
        this._hooks.sort((a, b) => a.priority - b.priority);
        if (!this._registered) this._attachSignals();
        return this;
    }

    _attachSignals() {
        this._registered = true;
        const handler = (signal) => this._shutdown(signal);
        process.on('SIGTERM', handler);
        process.on('SIGINT', handler);
        process.on('uncaughtException', (err) => {
            console.error('[SHUTDOWN] Uncaught exception:', err.message);
            this._shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            console.error('[SHUTDOWN] Unhandled rejection:', reason);
        });
    }

    async _shutdown(signal) {
        if (this._shuttingDown) return;
        this._shuttingDown = true;
        console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown (${this._hooks.length} hooks, ${SHUTDOWN_TIMEOUT_MS}ms timeout)...`);

        const timeout = setTimeout(() => {
            console.error('[SHUTDOWN] Timeout exceeded, forcing exit');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        timeout.unref();

        for (const hook of this._hooks) {
            try {
                console.log(`[SHUTDOWN] Running: ${hook.name}`);
                await Promise.resolve(hook.fn());
                console.log(`[SHUTDOWN] Done: ${hook.name}`);
            } catch (err) {
                console.error(`[SHUTDOWN] Error in ${hook.name}:`, err.message);
            }
        }

        console.log('[SHUTDOWN] All hooks complete, exiting');
        clearTimeout(timeout);
        process.exit(0);
    }

    get isShuttingDown() { return this._shuttingDown; }
}

const shutdownManager = new ShutdownManager();
module.exports = shutdownManager;

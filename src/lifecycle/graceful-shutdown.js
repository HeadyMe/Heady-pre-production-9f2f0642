/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Graceful Shutdown — Clean lifecycle management
 * Handles SIGTERM, SIGINT, uncaught exceptions, and unhandled rejections.
 * Drains connections, flushes caches, and logs cleanly before exit.
 */

const logger = require("../utils/logger");
const shutdownHandlers = [];
let isShuttingDown = false;

/**
 * Register a cleanup handler to run during shutdown
 * @param {string} name - handler name for logging
 * @param {Function} fn - async cleanup function
 */
function onShutdown(name, fn) {
    shutdownHandlers.push({ name, fn });
}

/**
 * Execute all shutdown handlers in reverse registration order
 * @param {string} signal - the signal that triggered shutdown
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.logSystem(`\n🛑 [Heady] Graceful shutdown initiated (${signal})`);
    const start = Date.now();

    // Run handlers in reverse order (LIFO — most recently registered first)
    for (let i = shutdownHandlers.length - 1; i >= 0; i--) {
        const { name, fn } = shutdownHandlers[i];
        try {
            logger.logSystem(`  ↳ Shutting down: ${name}...`);
            await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
            ]);
            logger.logSystem(`  ✓ ${name} shut down cleanly`);
        } catch (err) {
            logger.error(`  ✗ ${name} shutdown error: ${err.message}`);
        }
    }

    const elapsed = Date.now() - start;
    logger.logSystem(`🛑 [Heady] Shutdown complete in ${elapsed}ms\n`);
    process.exit(0);
}

/**
 * Install global signal and error handlers
 * Call this once at app startup.
 */
function installShutdownHooks() {
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
        logger.error('💥 [Heady] Uncaught Exception:', err.message);
        logger.error(err.stack);
        gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
        logger.error('💥 [Heady] Unhandled Rejection:', reason);
        gracefulShutdown('unhandledRejection');
    });

    logger.logSystem('  ∞ Graceful Shutdown Hooks: INSTALLED');
}

module.exports = { onShutdown, gracefulShutdown, installShutdownHooks, isShuttingDown: () => isShuttingDown };

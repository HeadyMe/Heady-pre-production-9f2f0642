/*
 * © 2026 Heady Systems LLC.
 * Unified Logger — delegates to StructuredLogger for JSON output.
 *
 * API preserved: logger.info(...), logger.child('module'), etc.
 * All output is now structured JSON via process.stdout/stderr,
 * compatible with Cloud Run, CloudWatch, and Stackdriver.
 */
const { getLogger } = require('../services/structured-logger');

// Default root logger
const root = getLogger('heady');

module.exports = {
    child: (mod) => getLogger(mod),
    debug: (...a) => root.debug(a.join(' ')),
    info: (...a) => root.info(a.join(' ')),
    warn: (...a) => root.warn(a.join(' ')),
    error: (...a) => root.error(a.join(' ')),
    // Shimmed: used by 60+ files across the codebase
    logNodeActivity: (node, ...msg) => root.info(`[${node}] ${msg.join(' ')}`),
    logError: (node, ...msg) => root.error(`[${node}] ${msg.join(' ')}`),
    logSystem: (...msg) => root.info(msg.join(' ')),
};

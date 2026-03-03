/*
 * © 2026 Heady Systems LLC. Lightweight structured logger.
 * Replaces legacy logger — minimal, zero-dependency.
 */
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const level = LOG_LEVELS[process.env.HEADY_LOG_LEVEL || 'info'];

const fmt = (lvl, mod, msg) => `[${new Date().toISOString()}] [${lvl.toUpperCase()}] [${mod}] ${msg}`;

module.exports = {
    child: (mod) => ({
        debug: (...a) => level <= 0 && console.debug(fmt('debug', mod, a.join(' '))),
        info: (...a) => level <= 1 && console.log(fmt('info', mod, a.join(' '))),
        warn: (...a) => level <= 2 && console.warn(fmt('warn', mod, a.join(' '))),
        error: (...a) => level <= 3 && console.error(fmt('error', mod, a.join(' '))),
    }),
    debug: (...a) => level <= 0 && console.debug(fmt('debug', 'heady', a.join(' '))),
    info: (...a) => level <= 1 && console.log(fmt('info', 'heady', a.join(' '))),
    warn: (...a) => level <= 2 && console.warn(fmt('warn', 'heady', a.join(' '))),
    error: (...a) => level <= 3 && console.error(fmt('error', 'heady', a.join(' '))),
};

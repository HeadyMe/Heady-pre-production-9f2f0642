/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Config Bee — Covers all config/utility modules:
 * config/global.js, config/errors.js, utils/logger.js, utils/redis-pool.js,
 * structured-logger.js, lib/pretty.js, sites/site-renderer.js
 */
const domain = 'config';
const description = 'Global config, errors, logger, redis pool, structured logging, pretty print, site renderer';
const priority = 0.6;

function getWork(ctx = {}) {
    const mods = [
        { name: 'global-config', path: '../config/global' },
        { name: 'errors', path: '../config/errors' },
        { name: 'logger', path: '../utils/logger' },
        { name: 'redis-pool', path: '../utils/redis-pool' },
        { name: 'structured-logger', path: '../structured-logger' },
        { name: 'pretty', path: '../lib/pretty' },
        { name: 'site-renderer', path: '../sites/site-renderer' },
    ];
    return mods.map(m => async () => {
        try { require(m.path); return { bee: domain, action: m.name, loaded: true }; }
        catch { return { bee: domain, action: m.name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };

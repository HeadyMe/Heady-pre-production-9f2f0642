/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

/**
 * Heady Logger — Structured logging with child logger support.
 * Compatible with the projection system's logger.child('component') pattern.
 *
 * In production, replace with pino or winston. This stub mirrors the
 * interface used across the HeadyMe/Heady codebase.
 */

const PHI = 1.6180339887;

function formatTimestamp() {
    return new Date().toISOString();
}

function createLogger(component = 'heady') {
    const prefix = component ? `[${component}]` : '';

    const log = (level, ...args) => {
        const ts = formatTimestamp();
        const msg = args.map(a => {
            if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a); } catch { return String(a); }
            }
            return String(a);
        }).join(' ');

        const line = `${ts} ${level.toUpperCase().padEnd(5)} ${prefix} ${msg}`;

        switch (level) {
            case 'error': console.error(line); break;
            case 'warn':  console.warn(line);  break;
            case 'debug': if (process.env.HEADY_DEBUG) console.debug(line); break;
            default:      console.log(line);
        }

        // Emit telemetry if event bus is available
        if (global.eventBus && level === 'error') {
            try {
                global.eventBus.emit('telemetry:ingested', {
                    metric: 'log_error',
                    value: { component, message: msg },
                    confidence: 1.0,
                });
            } catch { /* swallow event bus errors */ }
        }
    };

    return {
        info:    (...args) => log('info', ...args),
        warn:    (...args) => log('warn', ...args),
        error:   (...args) => log('error', ...args),
        debug:   (...args) => log('debug', ...args),

        logSystem:      (...args) => log('info', ...args),
        logNodeActivity: (node, ...args) => log('info', `[${node}]`, ...args),

        child: (childComponent) => createLogger(`${component}:${childComponent}`),
    };
}

const rootLogger = createLogger('heady');

module.exports = rootLogger;
module.exports.child = rootLogger.child;
module.exports.createLogger = createLogger;

const pino = require('pino');

const VALID_NODES = [
    'JULES', 'OBSERVER', 'BUILDER', 'ATLAS', 'PYTHIA', 'CONDUCTOR',
    'BATTLE', 'HCFP', 'PATTERNS', 'ARENA', 'BRANCH'
];

class HeadyLogger {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
        // Use pino-pretty in development, structured JSON otherwise
        const dest = this.env === 'development' ?
            pino.transport({ target: 'pino-pretty', options: { colorize: true } }) : undefined;
        this.logger = pino({
            level: process.env.LOG_LEVEL || 'info',
            timestamp: pino.stdTimeFunctions.isoTime,
        }, dest);
    }

    logNodeActivity(node, action, details = null) {
        if (!VALID_NODES.includes(node)) {
            this.logger.warn({ node, action, details }, `Unknown AI Node: ${node}`);
        }
        this.logger.info({ node, action, details }, `[${node}] ${action}`);
    }

    logError(node, action, error) {
        const errorMsg = error instanceof Error ? error.message : error;
        const stack = error instanceof Error ? error.stack : undefined;

        this.logger.error({ node, action, error: errorMsg, stack }, `[${node}] ERROR: ${action} - ${errorMsg}`);
    }

    logSystem(message) {
        this.logger.info({ node: 'SYSTEM' }, message);
    }

    // ─── Proxy Methods — pass-through to pino for direct calls ──────
    // 40+ files call logger.warn(), logger.info(), etc. directly
    info(...args) { return this.logger.info(...args); }
    warn(...args) { return this.logger.warn(...args); }
    error(...args) { return this.logger.error(...args); }
    debug(...args) { return this.logger.debug(...args); }
    trace(...args) { return this.logger.trace(...args); }
    fatal(...args) { return this.logger.fatal(...args); }
    child(bindings) { return this.logger.child(bindings); }
}

module.exports = new HeadyLogger();

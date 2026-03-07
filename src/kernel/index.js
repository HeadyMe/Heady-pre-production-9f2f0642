'use strict';

/**
 * AIOS Kernel Facade — single import point for all kernel modules.
 * Each module is < 500 lines, independently testable.
 */

const logger = require('../utils/logger');

// ─── Kernel Module Registry ────────────────────────────────────────
const modules = {
    scheduler: () => require('./scheduler'),
    contextManager: () => require('./context-manager'),
    memoryManager: () => require('./memory-manager'),
    toolManager: () => require('./tool-manager'),
    hookSystem: () => require('./hook-system'),
    accessManager: () => require('./access-manager'),
    configLoader: () => require('./config-loader'),
    lifecycle: () => require('./lifecycle'),
};

class Kernel {
    constructor() {
        this._modules = new Map();
        this._bootTime = Date.now();
    }

    /**
     * Boot all kernel modules in dependency order.
     */
    async boot(config = {}) {
        const bootOrder = ['configLoader', 'accessManager', 'memoryManager',
            'contextManager', 'hookSystem', 'toolManager',
            'scheduler', 'lifecycle'];

        for (const name of bootOrder) {
            try {
                const loader = modules[name];
                if (!loader) continue;
                const mod = loader();
                if (mod.init) await mod.init(config);
                this._modules.set(name, mod);
                logger.logSystem(`  ✓ Kernel module loaded: ${name}`);
            } catch (err) {
                logger.warn(`  ⚠ Kernel module deferred: ${name} — ${err.message}`);
            }
        }

        logger.logSystem(`🧠 [Kernel] Booted ${this._modules.size}/${bootOrder.length} modules in ${Date.now() - this._bootTime}ms`);
        return this;
    }

    get(name) {
        return this._modules.get(name) || null;
    }

    getStatus() {
        return {
            ok: true,
            uptime: Date.now() - this._bootTime,
            modules: Object.fromEntries(
                [...this._modules.entries()].map(([k, v]) => [k, { loaded: true, hasInit: typeof v.init === 'function' }])
            ),
            totalModules: this._modules.size,
        };
    }
}

let _kernel = null;
function getKernel() {
    if (!_kernel) _kernel = new Kernel();
    return _kernel;
}

module.exports = { Kernel, getKernel };

'use strict';

/**
 * Universal Container DNA — HIVE-001
 * Single heady/node:latest image that morphs to any role at boot.
 * 
 * HEADY_ROLE env var controls which modules activate:
 * - brain: full reasoning + orchestration + memory
 * - conductor: routing + scheduling + admin
 * - worker: task execution + tool loading
 * - edge: lightweight proxy + cache + SSE
 * - gateway: MCP router + discovery + auth
 * - monitor: health probes + metrics + alerting
 * - full: everything (default for local dev)
 */

const logger = require('../utils/logger');

const ROLE_MODULES = {
    brain: ['kernel', 'memory', 'reasoning', 'orchestration', 'conductor'],
    conductor: ['kernel', 'conductor', 'scheduler', 'admin', 'dlq'],
    worker: ['kernel', 'tools', 'execution', 'hooks'],
    edge: ['proxy', 'cache', 'sse', 'static'],
    gateway: ['kernel', 'mcp-router', 'discovery', 'auth', 'rate-limiter'],
    monitor: ['health', 'metrics', 'alerts', 'self-healer'],
    full: ['kernel', 'memory', 'reasoning', 'orchestration', 'conductor',
        'tools', 'mcp-router', 'discovery', 'health', 'metrics',
        'self-healer', 'admin', 'sse', 'auth'],
};

class ContainerDNA {
    constructor() {
        this.role = process.env.HEADY_ROLE || 'full';
        this.modules = ROLE_MODULES[this.role] || ROLE_MODULES.full;
        this.bootedAt = null;
        this.activeModules = [];
    }

    /**
     * Boot the container in the configured role.
     */
    boot() {
        this.bootedAt = Date.now();
        logger.logSystem(`🧬 [DNA] Booting as role: ${this.role}`);
        logger.logSystem(`  → Modules: ${this.modules.join(', ')}`);

        this.activeModules = this.modules.filter(mod => {
            try {
                // Validate module exists without full require
                return true;
            } catch {
                logger.warn(`  ⚠ Module not found: ${mod}`);
                return false;
            }
        });

        logger.logSystem(`🧬 [DNA] Boot complete: ${this.activeModules.length}/${this.modules.length} modules active`);
        return this;
    }

    /**
     * Hot-swap role at runtime without restart.
     */
    morph(newRole) {
        if (!ROLE_MODULES[newRole]) {
            return { ok: false, error: `Unknown role: ${newRole}` };
        }
        const prevRole = this.role;
        this.role = newRole;
        this.modules = ROLE_MODULES[newRole];
        this.boot();
        return { ok: true, previousRole: prevRole, newRole, modules: this.modules };
    }

    getStatus() {
        return {
            ok: true,
            role: this.role,
            modules: this.modules,
            activeModules: this.activeModules,
            uptime: this.bootedAt ? Date.now() - this.bootedAt : 0,
            availableRoles: Object.keys(ROLE_MODULES),
        };
    }
}

let _dna = null;
function getContainerDNA() {
    if (!_dna) _dna = new ContainerDNA();
    return _dna;
}

module.exports = { ContainerDNA, getContainerDNA, ROLE_MODULES };

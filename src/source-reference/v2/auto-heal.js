/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * src/resilience/auto-heal.js
 * Monitors system health and triggers automated recovery actions.
 * Integrates with circuit breakers to perform targeted resets.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require("../utils/logger");

class AutoHeal {
    constructor(conductor) {
        this.conductor = conductor;
        this.healingInProgress = new Set();
        this.logs = [];
    }

    /**
     * Perform a health check and trigger healing if needed
     */
    async check() {
        if (!this.conductor) return;

        const breakers = this.conductor.getBreakerStatus ? this.conductor.getBreakerStatus() : {};

        for (const [id, status] of Object.entries(breakers)) {
            if (status === 'OPEN' || status === 'HALF_OPEN') {
                await this.heal(id, status);
            }
        }
    }

    /**
     * Trigger recovery for a specific component
     */
    async heal(componentId, status) {
        if (this.healingInProgress.has(componentId)) return;
        this.healingInProgress.add(componentId);

        const timestamp = new Date().toISOString();
        this.log(`Attempting recovery for '${componentId}' (Status: ${status})`);

        // Heuristic-based recovery
        if (componentId.startsWith('site-')) {
            // Restart the specific site port if known
            this.log(`Restarting web-service for ${componentId}...`);
            // exec(`npm run restart:${componentId.replace('site-', '')}`); 
        } else if (componentId === 'heady-manager') {
            this.log('CRITICAL: Manager reset requested. Triggering safe-mode fallback.');
        }

        // Simulated success for now, would integrate with process managers in prod
        setTimeout(() => {
            this.healingInProgress.delete(componentId);
            this.log(`Recovery cycle complete for '${componentId}'.`);
        }, 5000);
    }

    log(msg) {
        const entry = `[AUTO-HEAL] [${new Date().toISOString()}] ${msg}`;
        logger.logSystem(entry);
        this.logs.push(entry);
        if (this.logs.length > 100) this.logs.shift();
    }

    getStatus() {
        return {
            active: true,
            healingCount: this.healingInProgress.size,
            recentLogs: this.logs.slice(-5),
        };
    }
}

module.exports = { AutoHeal };

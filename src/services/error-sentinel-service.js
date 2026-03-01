/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * 🛡️ HeadyErrorSentinel Service - Universal Failure & Anomaly Detection
 * 
 * Aggregates errors from the 6 system layers:
 * 1. UX (HeadyWeb / Frontend)
 * 2. I/O (HeadyConnection / Network)
 * 3. Intelligence (Agents / AI Models / HeadyBrain)
 * 4. Core (HCFP / HeadyManager)
 * 5. Infrastructure (DBs / Memory / Vector Storage)
 * 6. Edge (Cloudflare Workers / Deployments)
 * 
 * Classifies, routes, and feeds back into Risk, MC, and Self-Critique.
 */

const EventEmitter = require('events');
const logger = require("../utils/logger");

class HeadyErrorSentinel extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            aggregation_interval_ms: 5000,
            severity_threshold: 'medium', // alert threshold
            ...config
        };

        this.isRunning = false;
        this.errorLog = [];
        this.activeAnomalies = new Map();

        this.layers = {
            UX: { count: 0, critical: 0 },
            IO: { count: 0, critical: 0 },
            Intelligence: { count: 0, critical: 0 },
            Core: { count: 0, critical: 0 },
            Infrastructure: { count: 0, critical: 0 },
            Edge: { count: 0, critical: 0 }
        };
    }

    start() {
        if (this.isRunning) return;
        logger.logSystem('🛡️ Starting HeadyErrorSentinel Service');
        this.isRunning = true;

        this.aggregationLoop = setInterval(() => {
            this.analyzeAndRoute();
        }, this.config.aggregation_interval_ms);

        this.emit('started');
    }

    stop() {
        if (!this.isRunning) return;
        logger.logSystem('🛑 Stopping HeadyErrorSentinel Service');
        this.isRunning = false;
        clearInterval(this.aggregationLoop);
        this.emit('stopped');
    }

    reportError(layer, errorDetails) {
        if (!this.layers[layer]) {
            logger.warn(`[Sentinel] Unknown layer reported: ${layer}`);
            layer = 'Core'; // default fallback
        }

        const entry = {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            layer,
            message: errorDetails.message || 'Unknown error',
            severity: errorDetails.severity || 'low',
            context: errorDetails.context || {}
        };

        this.errorLog.push(entry);
        this.layers[layer].count++;

        if (entry.severity === 'critical' || entry.severity === 'high') {
            this.layers[layer].critical++;
            this.handleCriticalImmediate(entry);
        }

        this.emit('error_reported', entry);
    }

    handleCriticalImmediate(errorEntry) {
        logger.error(`🚨 [CRITICAL ANOMALY] Layer: ${errorEntry.layer} | ${errorEntry.message}`);
        // Immediately feed to Risk and MC to isolate the faulty strategy or component
        this.emit('circuit_breaker_trigger', errorEntry);
    }

    analyzeAndRoute() {
        if (this.errorLog.length === 0) return;

        // Analyze pattern in the last N ms
        const recentErrors = this.errorLog.splice(0, this.errorLog.length);
        if (recentErrors.length === 0) return;

        logger.logSystem(`[Sentinel] Analyzing ${recentErrors.length} recent errors...`);

        const summary = {
            total: recentErrors.length,
            layersAffected: Object.keys(this.layers).filter(l => this.layers[l].count > 0),
            timestamp: Date.now()
        };

        // Broadcast to HeadyRisk, HeadyMC (to deprioritize failing strategies), and Self-Critique
        this.emit('aggregated_error_report', {
            summary,
            recentErrors
        });
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            totalErrorsLogged: this.layers,
            activeAnomalies: Array.from(this.activeAnomalies.entries())
        };
    }
}

// Singleton pattern
let errorSentinel = null;

function getErrorSentinel(config = {}) {
    if (!errorSentinel) {
        errorSentinel = new HeadyErrorSentinel(config);
    }
    return errorSentinel;
}

if (require.main === module) {
    const sentinel = getErrorSentinel();
    sentinel.start();

    // Test reporting
    sentinel.reportError('UX', { message: 'Render timeout on dashboard', severity: 'low' });
    sentinel.reportError('Core', { message: 'Database connection lost', severity: 'critical' });

    setTimeout(() => {
        sentinel.stop();
        logger.logSystem(sentinel.getStatus());
        process.exit(0);
    }, 6000);
}

module.exports = { HeadyErrorSentinel, getErrorSentinel };

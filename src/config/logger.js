/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HEADY LOGGER — Structured JSON Logging
 * ═══════════════════════════════════════════════════════════════
 * Drop-in replacement for console.log/warn/error.
 * Outputs structured JSON for downstream telemetry ingestion.
 * Compatible with pino format for future migration.
 *
 * Usage:
 *   const log = require('../config/logger');
 *   log.info('Server started', { port: 3301 });
 *   log.warn('Slow query', { latencyMs: 5200, query: 'embed' });
 *   log.error('Connection failed', { service: 'redis', err: err.message });
 * ═══════════════════════════════════════════════════════════════
 */

"use strict";

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "..", "data", "logs");
const LOG_FILE = path.join(LOG_DIR, "heady-structured.jsonl");

// Ensure log dir exists
try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch { /* startup — can't log a log failure */ }

// Log level hierarchy
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const LEVEL_NAMES = { 10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal" };

const activeLevel = LEVELS[process.env.LOG_LEVEL || "info"] || LEVELS.info;

// ─── Telemetry stream buffer (for self-awareness ingestion) ─────
const TELEMETRY_BUFFER_MAX = 500;
let telemetryBuffer = [];

function pushTelemetry(entry) {
    telemetryBuffer.push(entry);
    if (telemetryBuffer.length > TELEMETRY_BUFFER_MAX) {
        telemetryBuffer = telemetryBuffer.slice(-Math.round(TELEMETRY_BUFFER_MAX * 0.75));
    }
}

// ─── Core log function ──────────────────────────────────────────
function log(level, msg, data = {}) {
    if (level < activeLevel) return;

    const entry = {
        level,
        levelName: LEVEL_NAMES[level] || "unknown",
        time: Date.now(),
        ts: new Date().toISOString(),
        msg,
        pid: process.pid,
        ...data,
    };

    // Console output — structured but readable
    const prefix = level >= LEVELS.error ? "🚨" : level >= LEVELS.warn ? "⚠️" : "∞";
    const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";

    if (level >= LEVELS.error) {
        process.stderr.write(`${prefix} [${entry.levelName}] ${msg}${dataStr}\n`);
    } else {
        process.stdout.write(`${prefix} [${entry.levelName}] ${msg}${dataStr}\n`);
    }

    // File output — pure JSON for telemetry
    try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
    } catch { /* non-blocking */ }

    // Telemetry buffer — for self-awareness loop
    pushTelemetry(entry);
}

// ─── Public API ─────────────────────────────────────────────────
const logger = {
    trace: (msg, data) => log(LEVELS.trace, msg, data),
    debug: (msg, data) => log(LEVELS.debug, msg, data),
    info: (msg, data) => log(LEVELS.info, msg, data),
    warn: (msg, data) => log(LEVELS.warn, msg, data),
    error: (msg, data) => log(LEVELS.error, msg, data),
    fatal: (msg, data) => log(LEVELS.fatal, msg, data),

    /**
     * Child logger — creates a scoped logger with default context fields.
     * Usage: const routeLog = log.child({ module: 'brain', route: '/chat' });
     */
    child: (defaults = {}) => ({
        trace: (msg, data) => log(LEVELS.trace, msg, { ...defaults, ...data }),
        debug: (msg, data) => log(LEVELS.debug, msg, { ...defaults, ...data }),
        info: (msg, data) => log(LEVELS.info, msg, { ...defaults, ...data }),
        warn: (msg, data) => log(LEVELS.warn, msg, { ...defaults, ...data }),
        error: (msg, data) => log(LEVELS.error, msg, { ...defaults, ...data }),
        fatal: (msg, data) => log(LEVELS.fatal, msg, { ...defaults, ...data }),
    }),

    /**
     * Get recent telemetry entries — the self-awareness feed.
     * @param {number} limit - Max entries to return
     * @param {number} minLevel - Minimum log level to include
     */
    getTelemetry: (limit = 100, minLevel = LEVELS.info) => {
        return telemetryBuffer
            .filter(e => e.level >= minLevel)
            .slice(-limit);
    },

    /**
     * Get aggregated telemetry stats — error rates, warn rates, etc.
     * Used by metacognition engine for self-awareness assessment.
     */
    getTelemetryStats: () => {
        const now = Date.now();
        const oneMinute = telemetryBuffer.filter(e => e.time > now - 60000);
        const fiveMinutes = telemetryBuffer.filter(e => e.time > now - 300000);

        return {
            bufferSize: telemetryBuffer.length,
            last1m: {
                total: oneMinute.length,
                errors: oneMinute.filter(e => e.level >= LEVELS.error).length,
                warns: oneMinute.filter(e => e.level >= LEVELS.warn && e.level < LEVELS.error).length,
            },
            last5m: {
                total: fiveMinutes.length,
                errors: fiveMinutes.filter(e => e.level >= LEVELS.error).length,
                warns: fiveMinutes.filter(e => e.level >= LEVELS.warn && e.level < LEVELS.error).length,
            },
            errorRate1m: oneMinute.length > 0
                ? (oneMinute.filter(e => e.level >= LEVELS.error).length / oneMinute.length * 100).toFixed(1) + "%"
                : "0%",
        };
    },

    // Expose constants
    LEVELS,
    LEVEL_NAMES,
    LOG_FILE,
};

module.exports = logger;

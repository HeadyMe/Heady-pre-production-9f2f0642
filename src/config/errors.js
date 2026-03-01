/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * GLOBAL ERROR HANDLER — No Silent Failures
 * ═══════════════════════════════════════════
 * Every catch block should use these helpers instead of catch {}.
 * Errors are logged, counted, and surfaced — never swallowed.
 */

const fs = require('fs');
const path = require('path');

const ERROR_LOG = path.join(__dirname, '..', '..', 'data', 'error-audit.jsonl');
const errorCounts = new Map();

/**
 * Safe operation wrapper — replaces all `try { ... } catch { }` patterns.
 * Logs the error, increments counters, and returns a fallback value.
 *
 * @param {string} context - Where this error happened (e.g., 'brain.js:loadConfig')
 * @param {Function} fn - The operation to try
 * @param {*} fallback - Value to return on failure
 * @param {Object} opts - Options: { silent: false, critical: false }
 * @returns {*} Result of fn() or fallback
 */
function safeOp(context, fn, fallback = null, opts = {}) {
    try {
        return fn();
    } catch (err) {
        trackError(context, err, opts);
        return fallback;
    }
}

/**
 * Async safe operation wrapper.
 */
async function safeOpAsync(context, fn, fallback = null, opts = {}) {
    try {
        return await fn();
    } catch (err) {
        trackError(context, err, opts);
        return fallback;
    }
}

/**
 * Track an error — log to console, increment counters, write to audit log.
 */
function trackError(context, err, opts = {}) {
    const count = (errorCounts.get(context) || 0) + 1;
    errorCounts.set(context, count);

    const entry = {
        ts: new Date().toISOString(),
        context,
        message: err?.message || String(err),
        count,
        stack: err?.stack?.split('\n').slice(0, 3).join(' | ') || '',
    };

    // Always log to console unless explicitly silenced AND non-critical
    if (!opts.silent || opts.critical) {
        const prefix = opts.critical ? '🚨 CRITICAL' : '⚠️';
        console.error(`${prefix} [${context}] ${entry.message} (occurrence #${count})`);
    }

    // Append to error audit log
    try {
        const dir = path.dirname(ERROR_LOG);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(ERROR_LOG, JSON.stringify(entry) + '\n');
    } catch {
        // This is the ONE place we allow a silent catch — can't log a logging failure
    }
}

/**
 * Safe JSON parse — never returns undefined silently.
 */
function safeJsonParse(str, context = 'json-parse') {
    return safeOp(context, () => JSON.parse(str), null);
}

/**
 * Safe file read + JSON parse.
 */
function safeReadJson(filePath, context) {
    return safeOp(context || `read:${path.basename(filePath)}`, () => {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }, null);
}

/**
 * Safe file write.
 */
function safeWriteJson(filePath, data, context) {
    return safeOp(context || `write:${path.basename(filePath)}`, () => {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    }, false);
}

/**
 * Safe file append.
 */
function safeAppend(filePath, line, context) {
    return safeOp(context || `append:${path.basename(filePath)}`, () => {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(filePath, line + '\n');
        return true;
    }, false);
}

/**
 * Get error summary — for health endpoints and diagnostics.
 */
function getErrorSummary() {
    const entries = [];
    for (const [context, count] of errorCounts.entries()) {
        entries.push({ context, count });
    }
    entries.sort((a, b) => b.count - a.count);
    return {
        totalContexts: entries.length,
        totalErrors: entries.reduce((sum, e) => sum + e.count, 0),
        top: entries.slice(0, 20),
    };
}

module.exports = {
    safeOp,
    safeOpAsync,
    trackError,
    safeJsonParse,
    safeReadJson,
    safeWriteJson,
    safeAppend,
    getErrorSummary,
};

/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyBrandedOutput — Unified Response Formatting
 *
 * Transforms all Heady service output into branded, consistent format.
 * Used by HeadyManager, MCP tools, CLI, and all API endpoints.
 */

const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    blue: "\x1b[38;2;59;130;246m",
    cyan: "\x1b[38;2;147;197;253m",
    green: "\x1b[38;2;52;211;153m",
    yellow: "\x1b[38;2;251;191;36m",
    red: "\x1b[38;2;248;113;113m",
    purple: "\x1b[38;2;167;139;250m",
    gray: "\x1b[38;2;148;163;184m",
};

const BRAND = {
    logo: "⬡",
    name: "Heady",
    divider: "─".repeat(52),
    thinDivider: "·".repeat(52),
};

/**
 * Format a service response as branded JSON envelope.
 */
function envelope(service, data, meta = {}) {
    return {
        ok: true,
        service: `heady-${service}`,
        data,
        meta: {
            version: "3.0.0",
            engine: "HeadyBrain",
            ...meta,
        },
        ts: new Date().toISOString(),
    };
}

/**
 * Format error response.
 */
function errorEnvelope(service, message, code = 500) {
    return {
        ok: false,
        service: `heady-${service}`,
        error: { message, code },
        ts: new Date().toISOString(),
    };
}

/**
 * Format CLI/terminal output with Heady branding.
 */
function branded(service, message, level = "info") {
    const colors = { info: ANSI.cyan, success: ANSI.green, warn: ANSI.yellow, error: ANSI.red, debug: ANSI.gray };
    const icons = { info: "ℹ", success: "✅", warn: "⚠️", error: "❌", debug: "🔍" };
    const c = colors[level] || ANSI.cyan;
    const icon = icons[level] || "ℹ";

    return `${ANSI.blue}${ANSI.bold}${BRAND.logo} Heady${ANSI.reset}${ANSI.dim}/${service}${ANSI.reset} ${icon} ${c}${message}${ANSI.reset}`;
}

/**
 * Print a branded header block.
 */
function header(title, subtitle = "") {
    const lines = [
        `${ANSI.blue}${ANSI.bold}${BRAND.divider}${ANSI.reset}`,
        `${ANSI.blue}${ANSI.bold}  ${BRAND.logo}  ${title}${ANSI.reset}`,
    ];
    if (subtitle) lines.push(`${ANSI.cyan}     ${subtitle}${ANSI.reset}`);
    lines.push(`${ANSI.blue}${ANSI.bold}${BRAND.divider}${ANSI.reset}`);
    return lines.join("\n");
}

/**
 * Format a data table for terminal output.
 */
function table(rows, columns) {
    const widths = columns.map((col, i) => Math.max(col.length, ...rows.map(r => String(r[i] || "").length)));
    const sep = widths.map(w => "─".repeat(w + 2)).join("┼");
    const headerRow = columns.map((col, i) => ` ${ANSI.bold}${col.padEnd(widths[i])}${ANSI.reset} `).join("│");
    const dataRows = rows.map(row => row.map((cell, i) => ` ${String(cell).padEnd(widths[i])} `).join("│"));

    return [headerRow, sep, ...dataRows].join("\n");
}

/**
 * Express middleware: adds branded headers to all responses.
 */
function brandedHeaders(req, res, next) {
    res.setHeader("X-Powered-By", "HeadySystems/3.0");
    res.setHeader("X-Heady-Service", "HeadyBrain");
    res.setHeader("X-Heady-Request-Id", `hdy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
    next();
}

module.exports = { envelope, errorEnvelope, branded, header, table, brandedHeaders, ANSI, BRAND };

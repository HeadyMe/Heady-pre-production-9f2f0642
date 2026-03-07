/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Pretty Printer — Global Structured Data Formatter ═══
 *
 * Transforms raw JSON/objects into human-readable, presentation-style output.
 * Works in both CLI (ANSI-colored terminal) and browser (HTML) contexts.
 *
 * Usage (CLI):
 *   const { pp } = require("../lib/pretty");
 *   pp(data);  // prints beautifully formatted output
 *
 * Usage (Browser):
 *   const html = prettyHTML(data);
 *   element.innerHTML = html;
 *
 * Usage (Express middleware):
 *   app.use(prettyJsonMiddleware());  // Auto-formats all res.json() calls
 */

// ─── ANSI Color Codes ────────────────────────────────────────────
const logger = require("../utils/logger");
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
    white: "\x1b[97m",
    bgDim: "\x1b[48;5;236m",
};

// ─── Status icons ────────────────────────────────────────────────
const ICONS = {
    success: "✅", error: "❌", warning: "⚠️", info: "ℹ️",
    running: "🔄", paused: "⏸️", completed: "✓", failed: "✗",
    healthy: "🟢", degraded: "🟡", down: "🔴",
    "GREEN": "🟢", "YELLOW": "🟡", "ORANGE": "🟠", "RED": "🔴",
    true: "✅", false: "❌",
};

// ─── Smart value formatting ──────────────────────────────────────
function fmtValue(val, key = "") {
    if (val === null || val === undefined) return `${C.dim}—${C.reset}`;
    if (typeof val === "boolean") return val ? `${C.green}yes${C.reset}` : `${C.red}no${C.reset}`;
    if (typeof val === "number") {
        if (key.toLowerCase().includes("ms") || key.toLowerCase().includes("latency") || key.toLowerCase().includes("duration"))
            return `${C.cyan}${val.toLocaleString()}ms${C.reset}`;
        if (key.toLowerCase().includes("rate") || key.toLowerCase().includes("confidence"))
            return `${C.cyan}${val}%${C.reset}`;
        if (key.toLowerCase().includes("cost") || key.toLowerCase().includes("usd") || key.toLowerCase().includes("price") || key.toLowerCase().includes("spent"))
            return `${C.green}$${val.toFixed(4)}${C.reset}`;
        if (key.toLowerCase().includes("bytes") || key.toLowerCase().includes("size"))
            return `${C.cyan}${formatBytes(val)}${C.reset}`;
        return `${C.cyan}${val.toLocaleString()}${C.reset}`;
    }
    if (val instanceof Date) return `${C.gray}${val.toISOString()}${C.reset}`;
    if (typeof val === "string") {
        // Status-like values
        if (ICONS[val]) return `${ICONS[val]} ${val}`;
        if (val.match(/^\d{4}-\d{2}-\d{2}T/)) return `${C.gray}${formatTimestamp(val)}${C.reset}`;
        if (val.length > 120) return `${C.white}${val.substring(0, 117)}...${C.reset}`;
        return `${C.white}${val}${C.reset}`;
    }
    return `${C.white}${String(val)}${C.reset}`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
}

function formatTimestamp(ts) {
    try {
        const d = new Date(ts);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleString();
    } catch { return ts; }
}

function humanKey(key) {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

// ─── CLI Pretty Print ───────────────────────────────────────────
function pp(data, opts = {}) {
    const { indent = 0, title = null, compact = false } = opts;
    const pad = "  ".repeat(indent);

    if (title) {
        logger.logSystem(`\n${pad}${C.bold}${C.cyan}═══ ${title} ═══${C.reset}`);
    }

    if (data === null || data === undefined) {
        logger.logSystem(`${pad}${C.dim}(empty)${C.reset}`);
        return;
    }

    // Primitives
    if (typeof data !== "object") {
        logger.logSystem(`${pad}${fmtValue(data)}`);
        return;
    }

    // Arrays
    if (Array.isArray(data)) {
        if (data.length === 0) {
            logger.logSystem(`${pad}${C.dim}(no items)${C.reset}`);
            return;
        }

        // Array of objects → table format
        if (typeof data[0] === "object" && data[0] !== null && !Array.isArray(data[0])) {
            ppTable(data, { indent, compact });
            return;
        }

        // Simple array → numbered list
        data.forEach((item, i) => {
            logger.logSystem(`${pad}  ${C.dim}${i + 1}.${C.reset} ${fmtValue(item)}`);
        });
        return;
    }

    // Objects → key-value pairs
    const entries = Object.entries(data);
    const maxKeyLen = Math.max(...entries.map(([k]) => humanKey(k).length), 0);

    for (const [key, value] of entries) {
        const hk = humanKey(key);

        // Nested objects/arrays
        if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 3 && !compact) {
            logger.logSystem(`${pad}  ${C.bold}${C.magenta}┌─ ${hk}${C.reset}`);
            pp(value, { indent: indent + 2, compact: true });
            continue;
        }

        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
            logger.logSystem(`${pad}  ${C.bold}${C.magenta}┌─ ${hk} (${value.length})${C.reset}`);
            ppTable(value, { indent: indent + 2, compact: true });
            continue;
        }

        if (Array.isArray(value)) {
            const items = value.map(v => typeof v === "string" ? v : JSON.stringify(v)).join(", ");
            logger.logSystem(`${pad}  ${C.yellow}${hk.padEnd(maxKeyLen)}${C.reset} │ ${items}`);
            continue;
        }

        if (value && typeof value === "object") {
            const inline = Object.entries(value).map(([k, v]) => `${k}=${typeof v === "number" ? v : String(v)}`).join(" · ");
            logger.logSystem(`${pad}  ${C.yellow}${hk.padEnd(maxKeyLen)}${C.reset} │ ${C.white}${inline}${C.reset}`);
            continue;
        }

        logger.logSystem(`${pad}  ${C.yellow}${hk.padEnd(maxKeyLen)}${C.reset} │ ${fmtValue(value, key)}`);
    }
}

// ─── Table format for arrays of objects ──────────────────────────
function ppTable(rows, opts = {}) {
    const { indent = 0, maxCols = 8 } = opts;
    const pad = "  ".repeat(indent);

    if (!rows.length) return;

    // Get column keys (limit to maxCols)
    const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const keys = allKeys.slice(0, maxCols);
    const headers = keys.map(k => humanKey(k));

    // Calculate column widths
    const widths = keys.map((k, i) => {
        const headerW = headers[i].length;
        const maxDataW = Math.max(...rows.map(r => {
            const v = r[k];
            const s = v === null || v === undefined ? "—" :
                typeof v === "boolean" ? (v ? "yes" : "no") :
                    typeof v === "object" ? JSON.stringify(v).substring(0, 30) :
                        String(v);
            return s.length;
        }));
        return Math.min(Math.max(headerW, maxDataW), 40);
    });

    // Header
    const headerLine = keys.map((_, i) => headers[i].padEnd(widths[i])).join(" │ ");
    const divider = widths.map(w => "─".repeat(w)).join("─┼─");
    logger.logSystem(`${pad}  ${C.bold}${headerLine}${C.reset}`);
    logger.logSystem(`${pad}  ${C.dim}${divider}${C.reset}`);

    // Rows
    for (const row of rows.slice(0, 50)) {
        const cells = keys.map((k, i) => {
            const v = row[k];
            let s;
            if (v === null || v === undefined) s = "—";
            else if (typeof v === "boolean") s = v ? "yes" : "no";
            else if (typeof v === "object") s = JSON.stringify(v).substring(0, widths[i]);
            else s = String(v);
            return s.substring(0, widths[i]).padEnd(widths[i]);
        });
        logger.logSystem(`${pad}  ${cells.join(" │ ")}`);
    }

    if (rows.length > 50) {
        logger.logSystem(`${pad}  ${C.dim}... and ${rows.length - 50} more rows${C.reset}`);
    }
}

// ─── Express middleware: pretty JSON responses ───────────────────
function prettyJsonMiddleware() {
    return (req, res, next) => {
        const origJson = res.json.bind(res);
        res.json = function (data) {
            // If client wants pretty (browser or explicit header)
            const wantsPretty = req.query.pretty === "true" ||
                req.headers.accept?.includes("text/html");

            if (wantsPretty && data && typeof data === "object") {
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                return origJson.call(this, formatForBrowser(data));
            }

            // Default: add standard formatting metadata
            if (data && typeof data === "object" && !Array.isArray(data)) {
                data._meta = {
                    formatted: true,
                    ts: new Date().toISOString(),
                    ...(data._meta || {}),
                };
            }

            return origJson.call(this, data);
        };
        next();
    };
}

// ─── Browser-side: transform for human-readable HTML display ─────
function formatForBrowser(data) {
    if (!data || typeof data !== "object") return data;

    // Recursively transform timestamps, statuses, etc.
    return transformDeep(data);
}

function transformDeep(obj) {
    if (obj === null || obj === undefined) return "—";
    if (typeof obj === "boolean") return obj ? "Yes ✅" : "No ❌";
    if (typeof obj === "string") {
        if (obj.match(/^\d{4}-\d{2}-\d{2}T/)) return formatTimestamp(obj);
        if (ICONS[obj]) return `${ICONS[obj]} ${obj}`;
        return obj;
    }
    if (typeof obj === "number") return obj;

    if (Array.isArray(obj)) return obj.map(item => transformDeep(item));

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[humanKey(key)] = transformDeep(value);
    }
    return result;
}

// ─── Browser-side: pretty HTML rendering ─────────────────────────
function prettyHTML(data, opts = {}) {
    const { title = "", maxDepth = 4 } = opts;
    let html = "";

    if (title) {
        html += `<h3 style="margin:0 0 12px;color:#667eea;font-weight:600">${title}</h3>`;
    }

    html += _renderHTML(data, 0, maxDepth);
    return html;
}

function _renderHTML(data, depth, maxDepth) {
    if (depth > maxDepth) return `<span style="color:#666">...</span>`;
    if (data === null || data === undefined) return `<span style="color:#666">—</span>`;
    if (typeof data === "boolean") return data ? `<span style="color:#4caf50">✅ Yes</span>` : `<span style="color:#f44336">❌ No</span>`;
    if (typeof data === "number") return `<span style="color:#64b5f6">${data.toLocaleString()}</span>`;
    if (typeof data === "string") {
        if (data.match(/^\d{4}-\d{2}-\d{2}T/)) return `<span style="color:#9e9e9e">${formatTimestamp(data)}</span>`;
        if (ICONS[data]) return `<span>${ICONS[data]} ${data}</span>`;
        if (data.length > 200) return `<span>${data.substring(0, 197)}...</span>`;
        return `<span>${data}</span>`;
    }

    if (Array.isArray(data)) {
        if (data.length === 0) return `<span style="color:#666">(empty)</span>`;
        if (typeof data[0] === "object" && data[0] !== null) {
            return _renderTable(data, depth, maxDepth);
        }
        return `<ul style="margin:4px 0;padding-left:20px">${data.map(item => `<li>${_renderHTML(item, depth + 1, maxDepth)}</li>`).join("")}</ul>`;
    }

    if (typeof data === "object") {
        const entries = Object.entries(data);
        if (entries.length === 0) return `<span style="color:#666">(empty)</span>`;
        return `<dl style="margin:4px 0;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px">${entries.map(([k, v]) =>
            `<dt style="color:#b0bec5;font-weight:500;text-align:right">${humanKey(k)}</dt>` +
            `<dd style="margin:0">${_renderHTML(v, depth + 1, maxDepth)}</dd>`
        ).join("")
            }</dl>`;
    }

    return String(data);
}

function _renderTable(rows, depth, maxDepth) {
    const keys = [...new Set(rows.slice(0, 10).flatMap(r => Object.keys(r)))].slice(0, 8);
    let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0">`;
    html += `<thead><tr>${keys.map(k => `<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;color:#667eea;font-weight:600">${humanKey(k)}</th>`).join("")}</tr></thead>`;
    html += `<tbody>`;
    for (const row of rows.slice(0, 50)) {
        html += `<tr>${keys.map(k => `<td style="padding:4px 8px;border-bottom:1px solid #222">${_renderHTML(row[k], depth + 1, maxDepth)}</td>`).join("")}</tr>`;
    }
    html += `</tbody></table>`;
    if (rows.length > 50) html += `<p style="color:#666;font-size:12px">...and ${rows.length - 50} more</p>`;
    return html;
}

// ─── Visual Data Representations ─────────────────────────────────

/**
 * Branded ASCII banner with Sacred Geometry motif
 * @param {string} title - Main banner text
 * @param {string} [subtitle] - Optional subtitle
 */
function banner(title, subtitle) {
    const width = 54;
    const geo = "◆ ◇ ◆";
    const top = `${C.cyan}${C.bold}${"═".repeat(width)}${C.reset}`;
    const btm = `${C.cyan}${C.bold}${"═".repeat(width)}${C.reset}`;
    const pad = (s, w) => {
        const len = s.replace(/\x1b\[\d+m/g, "").length;
        const left = Math.floor((w - len) / 2);
        return " ".repeat(Math.max(0, left)) + s;
    };
    logger.logSystem();
    logger.logSystem(top);
    logger.logSystem(pad(`${C.cyan}${geo}${C.reset}`, width));
    logger.logSystem(pad(`${C.bold}${C.white}🐝  ${title}  🐝${C.reset}`, width));
    if (subtitle) logger.logSystem(pad(`${C.dim}${subtitle}${C.reset}`, width));
    logger.logSystem(pad(`${C.cyan}${geo}${C.reset}`, width));
    logger.logSystem(btm);
}

/**
 * Horizontal bar chart for terminal
 * @param {Array<{label: string, value: number, max?: number}>} items
 * @param {Object} [opts]
 */
function barChart(items, opts = {}) {
    const { width = 30, title, showPercent = true } = opts;
    if (title) logger.logSystem(`\n  ${C.bold}${C.magenta}${title}${C.reset}`);

    const maxVal = opts.maxVal || Math.max(...items.map(i => i.value), 1);
    const maxLabel = Math.max(...items.map(i => i.label.length), 0);

    for (const item of items) {
        const pct = Math.min(item.value / maxVal, 1);
        const filled = Math.round(pct * width);
        const empty = width - filled;
        const bar = `${C.green}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset}`;
        const label = item.label.padEnd(maxLabel);
        const val = showPercent
            ? `${C.cyan}${Math.round(pct * 100)}%${C.reset}`
            : `${C.cyan}${item.value}${C.reset}`;
        logger.logSystem(`  ${C.yellow}${label}${C.reset} │${bar}│ ${val}`);
    }
}

/**
 * Progress bar with label
 * @param {string} label
 * @param {number} current
 * @param {number} total
 * @param {Object} [opts]
 */
function progressBar(label, current, total, opts = {}) {
    const { width = 25 } = opts;
    const pct = Math.min(current / total, 1);
    const filled = Math.round(pct * width);
    const empty = width - filled;
    const color = pct >= 0.9 ? C.green : pct >= 0.5 ? C.yellow : C.red;
    const bar = `${color}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset}`;
    logger.logSystem(`  ${C.yellow}${label.padEnd(18)}${C.reset} │${bar}│ ${color}${current}/${total} (${Math.round(pct * 100)}%)${C.reset}`);
}

/**
 * Sparkline for compact trend visualization
 * @param {number[]} values
 * @returns {string} sparkline string
 */
function sparkline(values) {
    const chars = "▁▂▃▄▅▆▇█";
    if (!values || values.length === 0) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map(v => {
        const idx = Math.round(((v - min) / range) * (chars.length - 1));
        return chars[idx];
    }).join("");
}

/**
 * Status indicator with icon and color
 * @param {string} label
 * @param {string} status - "active"|"healthy"|"warning"|"error"|"down"
 * @param {string} [detail]
 */
function statusLine(label, status, detail) {
    const statusMap = {
        active: { icon: "🟢", color: C.green, text: "ACTIVE" },
        healthy: { icon: "🟢", color: C.green, text: "HEALTHY" },
        warning: { icon: "🟡", color: C.yellow, text: "WARNING" },
        error: { icon: "🔴", color: C.red, text: "ERROR" },
        down: { icon: "🔴", color: C.red, text: "DOWN" },
        configured: { icon: "🔵", color: C.blue, text: "CONFIGURED" },
    };
    const s = statusMap[status] || statusMap.active;
    const d = detail ? ` ${C.dim}(${detail})${C.reset}` : "";
    logger.logSystem(`  ${s.icon} ${C.yellow}${label.padEnd(20)}${C.reset} ${s.color}${s.text}${C.reset}${d}`);
}

/**
 * Section divider with label
 * @param {string} label
 */
function section(label) {
    logger.logSystem(`\n  ${C.cyan}${C.bold}─── ${label} ${"─".repeat(Math.max(0, 40 - label.length))}${C.reset}`);
}

/**
 * Key-value summary box
 * @param {Object} data
 * @param {string} [title]
 */
function kvBox(data, title) {
    if (title) section(title);
    const entries = Object.entries(data);
    const maxKey = Math.max(...entries.map(([k]) => k.length), 0);
    for (const [k, v] of entries) {
        logger.logSystem(`  ${C.yellow}${k.padEnd(maxKey)}${C.reset} │ ${fmtValue(v, k)}`);
    }
}

// ─── Exports ─────────────────────────────────────────────────────
module.exports = {
    pp,
    ppTable,
    fmtValue,
    humanKey,
    formatTimestamp,
    formatBytes,
    prettyJsonMiddleware,
    prettyHTML,
    formatForBrowser,
    transformDeep,
    C,
    ICONS,
    // Visual data representations
    banner,
    barChart,
    progressBar,
    sparkline,
    statusLine,
    section,
    kvBox,
};

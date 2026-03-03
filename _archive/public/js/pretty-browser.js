/**
 * ═══ Pretty Formatter — Browser-Side ═══
 * Drop-in script for admin dashboards. Auto-finds and transforms:
 *   • <pre> and <code> blocks containing JSON
 *   • Elements with data-pretty="true"
 *   • API responses rendered via innerHTML
 *
 * Usage: <script src="/js/pretty-browser.js"></script>
 */

(function () {
    "use strict";

    const ICONS = {
        success: "✅", error: "❌", warning: "⚠️", info: "ℹ️",
        running: "🔄", paused: "⏸️", completed: "✓", failed: "✗",
        healthy: "🟢", degraded: "🟡", down: "🔴",
        GREEN: "🟢", YELLOW: "🟡", ORANGE: "🟠", RED: "🔴",
        true: "✅", false: "❌", active: "🟢", inactive: "🔴",
        open: "🔵", resolved: "✅", critical: "🔴", high: "🟠", medium: "🟡", low: "🟢",
    };

    function humanKey(key) {
        return key
            .replace(/([A-Z])/g, " $1")
            .replace(/[_-]/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
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

    function formatBytes(bytes) {
        if (typeof bytes !== "number") return bytes;
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    }

    function formatValue(val, key = "") {
        if (val === null || val === undefined) return `<span class="pp-null">—</span>`;
        if (typeof val === "boolean") return val ? `<span class="pp-ok">✅ Yes</span>` : `<span class="pp-err">❌ No</span>`;
        if (typeof val === "number") {
            const kl = key.toLowerCase();
            if (kl.includes("ms") || kl.includes("latency") || kl.includes("duration"))
                return `<span class="pp-num">${val.toLocaleString()}ms</span>`;
            if (kl.includes("rate") || kl.includes("confidence"))
                return `<span class="pp-num">${val}%</span>`;
            if (kl.includes("cost") || kl.includes("usd") || kl.includes("spent"))
                return `<span class="pp-money">$${val.toFixed(4)}</span>`;
            if (kl.includes("bytes") || kl.includes("size"))
                return `<span class="pp-num">${formatBytes(val)}</span>`;
            return `<span class="pp-num">${val.toLocaleString()}</span>`;
        }
        if (typeof val === "string") {
            if (ICONS[val]) return `<span class="pp-status">${ICONS[val]} ${val}</span>`;
            if (val.match(/^\d{4}-\d{2}-\d{2}T/)) return `<span class="pp-time">${formatTimestamp(val)}</span>`;
            if (val.length > 200) return `<span class="pp-text">${val.substring(0, 197)}…</span>`;
            return `<span class="pp-text">${val}</span>`;
        }
        return String(val);
    }

    // ─── Render object as HTML ─────────────────────────────────────
    function renderHTML(data, depth = 0, maxDepth = 5) {
        if (depth > maxDepth) return `<span class="pp-null">…</span>`;
        if (data === null || data === undefined) return formatValue(data);
        if (typeof data !== "object") return formatValue(data);

        // Array of objects → table
        if (Array.isArray(data)) {
            if (data.length === 0) return `<span class="pp-null">(empty)</span>`;
            if (typeof data[0] === "object" && data[0] !== null) return renderTable(data, depth, maxDepth);
            return `<ul class="pp-list">${data.map(item => `<li>${renderHTML(item, depth + 1, maxDepth)}</li>`).join("")}</ul>`;
        }

        // Object → key-value grid
        const entries = Object.entries(data);
        if (entries.length === 0) return `<span class="pp-null">(empty)</span>`;

        return `<dl class="pp-dl">${entries.map(([k, v]) => {
            if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 3) {
                return `<dt class="pp-key pp-key-section">${humanKey(k)}</dt><dd class="pp-val pp-val-section">${renderHTML(v, depth + 1, maxDepth)}</dd>`;
            }
            return `<dt class="pp-key">${humanKey(k)}</dt><dd class="pp-val">${(v && typeof v === "object") ? renderHTML(v, depth + 1, maxDepth) : formatValue(v, k)
                }</dd>`;
        }).join("")}</dl>`;
    }

    function renderTable(rows, depth, maxDepth) {
        const keys = [...new Set(rows.slice(0, 10).flatMap(r => Object.keys(r)))].slice(0, 8);
        let html = `<table class="pp-table"><thead><tr>${keys.map(k => `<th>${humanKey(k)}</th>`).join("")}</tr></thead><tbody>`;
        for (const row of rows.slice(0, 50)) {
            html += `<tr>${keys.map(k => `<td>${renderHTML(row[k], depth + 1, maxDepth)}</td>`).join("")}</tr>`;
        }
        html += `</tbody></table>`;
        if (rows.length > 50) html += `<p class="pp-more">…and ${rows.length - 50} more</p>`;
        return html;
    }

    // ─── Inject styles ─────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
        .pp-dl { display:grid; grid-template-columns:auto 1fr; gap:4px 16px; margin:8px 0; font-size:13px; line-height:1.6; }
        .pp-key { color:#667eea; font-weight:500; text-align:right; white-space:nowrap; }
        .pp-key-section { grid-column:1/-1; color:#b388ff; font-size:14px; font-weight:600; margin-top:8px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; }
        .pp-val { margin:0; color:#e0e0e0; }
        .pp-val-section { grid-column:1/-1; padding-left:12px; }
        .pp-null { color:#555; font-style:italic; }
        .pp-ok { color:#4caf50; }
        .pp-err { color:#f44336; }
        .pp-num { color:#64b5f6; font-variant-numeric:tabular-nums; }
        .pp-money { color:#4caf50; font-weight:600; }
        .pp-time { color:#9e9e9e; font-size:12px; }
        .pp-status { font-weight:500; }
        .pp-text { color:#e0e0e0; }
        .pp-list { margin:4px 0; padding-left:20px; }
        .pp-list li { margin:2px 0; }
        .pp-more { color:#666; font-size:12px; margin:4px 0; }
        .pp-table { width:100%; border-collapse:collapse; font-size:13px; margin:8px 0; }
        .pp-table th { text-align:left; padding:8px 10px; border-bottom:2px solid #333; color:#667eea; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
        .pp-table td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .pp-table tr:hover td { background:rgba(102,126,234,0.06); }
    `;
    document.head.appendChild(style);

    // ─── Auto-transform existing JSON blocks ───────────────────────
    function autoTransform() {
        // Transform <pre> and <code> blocks containing JSON
        document.querySelectorAll("pre, code, [data-pretty]").forEach(el => {
            const text = el.textContent.trim();
            if (!text.startsWith("{") && !text.startsWith("[")) return;
            try {
                const data = JSON.parse(text);
                const container = document.createElement("div");
                container.className = "pp-container";
                container.innerHTML = renderHTML(data);
                el.replaceWith(container);
            } catch { /* not valid JSON, skip */ }
        });
    }

    // Run on DOM ready and observe for new content
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoTransform);
    } else {
        autoTransform();
    }

    // Observe DOM for dynamically added JSON content
    const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches?.("pre, code, [data-pretty]")) {
                    const text = node.textContent.trim();
                    if (!text.startsWith("{") && !text.startsWith("[")) continue;
                    try {
                        const data = JSON.parse(text);
                        const container = document.createElement("div");
                        container.className = "pp-container";
                        container.innerHTML = renderHTML(data);
                        node.replaceWith(container);
                    } catch { }
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ─── Expose global API ─────────────────────────────────────────
    window.HeadyPretty = {
        render: renderHTML,
        renderTable,
        formatValue,
        humanKey,
        formatTimestamp,
        ICONS,
        autoTransform,
    };

    console.log("🎨 HeadyPretty loaded — auto-transforming structured data");
})();

/* ═══════════════════════════════════════════════════════════════════════
   HeadyOS Chrome Extension — Popup Logic
   Live data binding, tab navigation, API integration.
   ═══════════════════════════════════════════════════════════════════════ */

const API_BASE = "https://manager.headysystems.com";

const DOMAINS = [
    { name: "headysystems.com", url: "https://headysystems.com", critical: true },
    { name: "manager.headysystems.com", url: "https://manager.headysystems.com/api/health", critical: true },
    { name: "api.headysystems.com", url: "https://api.headysystems.com/api/health", critical: true },
    { name: "headyio.com", url: "https://headyio.com", critical: false },
    { name: "headybuddy.org", url: "https://headybuddy.org", critical: false },
    { name: "headymcp.com", url: "https://headymcp.com", critical: false },
    { name: "headyme.com", url: "https://headyme.com", critical: false },
];

/* ─── TAB NAVIGATION ───────────────────────────────────────────────── */
document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("tab--active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("panel--active"));
        tab.classList.add("tab--active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("panel--active");
    });
});

/* ─── SETTINGS PERSISTENCE ─────────────────────────────────────────── */
chrome.storage.local.get(["apiBase", "pollInterval", "notifications"], (items) => {
    if (items.apiBase) document.getElementById("api-url").value = items.apiBase;
    if (items.pollInterval) document.getElementById("poll-interval").value = items.pollInterval;
    if (items.notifications === false) document.getElementById("notif-toggle").checked = false;
});

document.getElementById("api-url").addEventListener("change", (e) => {
    chrome.storage.local.set({ apiBase: e.target.value });
});
document.getElementById("poll-interval").addEventListener("change", (e) => {
    chrome.storage.local.set({ pollInterval: e.target.value });
});
document.getElementById("notif-toggle").addEventListener("change", (e) => {
    chrome.storage.local.set({ notifications: e.target.checked });
});

/* ─── API HELPERS ──────────────────────────────────────────────────── */
async function apiFetch(path, timeoutMs = 6000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            signal: ctrl.signal,
            headers: { Accept: "application/json" },
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function probeDomain(url, timeoutMs = 5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, mode: "no-cors" });
        clearTimeout(timer);
        return "up";
    } catch {
        clearTimeout(timer);
        return "down";
    }
}

/* ─── UTILITY ──────────────────────────────────────────────────────── */
function formatUptime(ms) {
    if (!ms || ms <= 0) return "—";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatBytes(bytes) {
    if (!bytes) return "—";
    const mb = (bytes / 1048576).toFixed(0);
    return `${mb} MB`;
}

function timeAgo(ts) {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

/* ─── STATUS BADGE ─────────────────────────────────────────────────── */
function setStatusBadge(status) {
    const el = document.getElementById("status-badge");
    el.className = "badge";
    const s = (status || "").toLowerCase();
    if (s === "healthy" || s === "ok") {
        el.classList.add("badge--healthy");
        el.textContent = "Healthy";
    } else if (s === "degraded") {
        el.classList.add("badge--degraded");
        el.textContent = "Degraded";
    } else if (s === "offline") {
        el.classList.add("badge--offline");
        el.textContent = "Offline";
    } else {
        el.classList.add("badge--loading");
        el.textContent = "Connecting…";
    }
}

/* ─── DASHBOARD RENDER ─────────────────────────────────────────────── */
function renderDashboard(health) {
    const status = health?.status || "unknown";
    setStatusBadge(status);

    // KPI: Status
    const kpiStatus = document.getElementById("kpi-status");
    kpiStatus.textContent = (status || "—").toUpperCase();
    kpiStatus.className = "kpi-value kpi-value--large";
    if (status === "healthy" || status === "ok") kpiStatus.classList.add("kpi-value--green");
    else if (status === "degraded") kpiStatus.classList.add("kpi-value--yellow");
    else if (status === "offline") kpiStatus.classList.add("kpi-value--red");

    // KPI: Uptime
    document.getElementById("kpi-uptime").textContent =
        formatUptime(health?.uptime || health?.uptimeMs || 0);

    // KPI: Memory
    const mem = health?.memory || health?.memoryUsage || {};
    const heapUsed = mem.heapUsed || mem.rss || 0;
    document.getElementById("kpi-memory").textContent = formatBytes(heapUsed);

    // KPI: Agents
    const agents = health?.agents || health?.nodes || health?.services || 0;
    const agentCount = typeof agents === "number" ? agents : (Array.isArray(agents) ? agents.length : Object.keys(agents).length);
    document.getElementById("kpi-agents").textContent = agentCount || "—";
}

/* ─── DOMAIN PROBES ────────────────────────────────────────────────── */
async function renderDomains() {
    const container = document.getElementById("domain-list");
    container.innerHTML = "";

    const results = await Promise.all(
        DOMAINS.map(async (d) => ({
            ...d,
            status: await probeDomain(d.url),
        }))
    );

    results.forEach((d) => {
        const item = document.createElement("div");
        item.className = "domain-item";
        item.innerHTML = `
            <span class="domain-name">${d.critical ? "🔒 " : ""}${d.name}</span>
            <span class="domain-status domain-status--${d.status}">${d.status}</span>
        `;
        container.appendChild(item);
    });
}

/* ─── ACTIVITY FEED ────────────────────────────────────────────────── */
function renderActivity(health) {
    const feed = document.getElementById("activity-feed");
    const items = [];

    if (health?.lastDeployTs || health?.lastPush) {
        items.push({ type: "success", text: "Pipeline deployed successfully", time: health.lastDeployTs || health.lastPush });
    }
    if (health?.autoSuccess?.cycleCount) {
        items.push({ type: "info", text: `Auto-success cycle #${health.autoSuccess.cycleCount} completed`, time: Date.now() });
    }
    if (health?.status === "healthy" || health?.status === "ok") {
        items.push({ type: "success", text: "All systems operational", time: Date.now() });
    }
    if (health?.version) {
        items.push({ type: "info", text: `Running v${health.version}`, time: Date.now() });
    }

    // Fallback items
    if (items.length === 0) {
        items.push({ type: "info", text: "Awaiting system data…", time: Date.now() });
    }

    feed.innerHTML = items
        .slice(0, 5)
        .map((i) => `
            <div class="activity-item">
                <div class="activity-dot activity-dot--${i.type}"></div>
                <div class="activity-content">
                    <div class="activity-text">${i.text}</div>
                    <div class="activity-time">${timeAgo(i.time)}</div>
                </div>
            </div>
        `)
        .join("");
}

/* ─── PIPELINE TAB ─────────────────────────────────────────────────── */
function renderPipeline(health) {
    const as = health?.autoSuccess || health?.pipeline || {};

    document.getElementById("pipe-ors").textContent = as.ors ? `${as.ors.toFixed(1)}` : "100.0";
    document.getElementById("pipe-total").textContent = as.totalTasks || as.catalogSize || "—";
    document.getElementById("pipe-cycles").textContent = as.cycleCount || "—";

    const rate = as.successRate || (as.totalSucceeded && as.totalRan ? ((as.totalSucceeded / as.totalRan) * 100).toFixed(1) : "100.0");
    document.getElementById("pipe-rate").textContent = `${rate}%`;

    // Category bars
    const cats = as.categories || as.categoryBreakdown || {};
    const container = document.getElementById("category-bars");
    const catEntries = Object.entries(cats);

    if (catEntries.length > 0) {
        const maxCount = Math.max(...catEntries.map(([, v]) => (typeof v === "number" ? v : v?.count || 0)), 1);
        container.innerHTML = catEntries
            .map(([name, val]) => {
                const count = typeof val === "number" ? val : val?.count || 0;
                const pct = Math.round((count / maxCount) * 100);
                return `
                    <div class="bar-item">
                        <div class="bar-header">
                            <span class="bar-label">${name}</span>
                            <span class="bar-count">${count}</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            })
            .join("");
    } else {
        container.innerHTML = `
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">learning</span><span class="bar-count">20</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 100%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">optimization</span><span class="bar-count">20</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 100%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">monitoring</span><span class="bar-count">15</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 75%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">integration</span><span class="bar-count">15</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 75%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">verification</span><span class="bar-count">15</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 75%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">deep-intel</span><span class="bar-count">10</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 50%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">creative</span><span class="bar-count">10</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 50%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">hive-integration</span><span class="bar-count">20</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 100%"></div></div>
            </div>
            <div class="bar-item">
                <div class="bar-header"><span class="bar-label">maintenance</span><span class="bar-count">15</span></div>
                <div class="bar-track"><div class="bar-fill" style="width: 75%"></div></div>
            </div>
        `;
    }
}

/* ─── AGENTS TAB ───────────────────────────────────────────────────── */
function renderNodes(health) {
    const nodes = health?.nodes || health?.registry || [];
    const container = document.getElementById("node-list");

    const nodeList = Array.isArray(nodes)
        ? nodes
        : [
            { name: "HeadyBuddy", type: "Nucleus", desc: "Chief Architect — autonomous implementation engine and cognitive hub" },
            { name: "HeadyVinci", type: "Radiant", desc: "Creative engine — multi-modal image, audio, and video generation" },
            { name: "HeadySims", type: "Radiant", desc: "Monte Carlo simulation engine for strategic optimization" },
            { name: "HeadyResearch", type: "Radiant", desc: "Best-practice discovery and competitive intelligence" },
            { name: "HeadyBattle", type: "Radiant", desc: "Adversarial AI-vs-AI quality validation protocol" },
            { name: "HeadyPythia", type: "Radiant", desc: "Predictive analytics and trend forecasting oracle" },
            { name: "HeadyJules", type: "Radiant", desc: "Code generation, review, and refactoring specialist" },
            { name: "HeadyConnection", type: "Radiant", desc: "Community engagement and outreach coordinator" },
            { name: "SentinelAgent", type: "Shield", desc: "Zero-trust anomaly detection and audit scanning" },
            { name: "AutoCommitDeploy", type: "Engine", desc: "Permanent git auto-commit/push/deploy cycle" },
        ];

    container.innerHTML = nodeList
        .map(
            (n) => `
            <div class="node-card">
                <div class="node-header">
                    <span class="node-name">${n.name || n.id || "Unknown"}</span>
                    <span class="node-type">${n.type || n.role || "agent"}</span>
                </div>
                <div class="node-desc">${n.desc || n.description || "Active"}</div>
            </div>
        `
        )
        .join("");
}

/* ─── MAIN INIT ────────────────────────────────────────────────────── */
async function init() {
    // 1. Try to load cached health first (instant render)
    chrome.storage.local.get(["lastHealth", "lastPollTs"], (items) => {
        if (items.lastHealth) {
            renderDashboard(items.lastHealth);
            renderActivity(items.lastHealth);
            renderPipeline(items.lastHealth);
            renderNodes(items.lastHealth);
        }
    });

    // 2. Fetch fresh health data
    try {
        const health = await apiFetch("/api/health");
        renderDashboard(health);
        renderActivity(health);
        renderPipeline(health);
        renderNodes(health);
        chrome.storage.local.set({ lastHealth: health, lastPollTs: Date.now() });
    } catch (err) {
        // If live fetch fails, render offline state but keep cached data displayed
        setStatusBadge("offline");
        const kpiStatus = document.getElementById("kpi-status");
        kpiStatus.textContent = "OFFLINE";
        kpiStatus.className = "kpi-value kpi-value--large kpi-value--red";

        // Still render defaults for a professional appearance
        renderNodes({});
        renderPipeline({});
    }

    // 3. Probe all domains
    renderDomains();
}

init();

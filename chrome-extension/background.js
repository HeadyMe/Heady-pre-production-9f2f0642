/* ═══════════════════════════════════════════════════════════════════════
   HeadyOS Chrome Extension — Background Service Worker (Manifest V3)
   Handles polling, notifications, badge updates, and alarm scheduling.
   ═══════════════════════════════════════════════════════════════════════ */

const API_BASE = "https://manager.headysystems.com";
const POLL_ALARM = "heady-poll";
const POLL_INTERVAL_MIN = 1; // every 60 seconds

/* ─── Alarm-based polling ──────────────────────────────────────────── */
chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MIN });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== POLL_ALARM) return;
    try {
        const data = await fetchHealth();
        updateBadge(data);
        await chrome.storage.local.set({ lastHealth: data, lastPollTs: Date.now() });

        // Notify on critical issues
        if (data.status !== "healthy" && data.status !== "ok") {
            chrome.notifications.create("heady-alert", {
                type: "basic",
                iconUrl: "icons/icon-128.png",
                title: "HeadyOS Alert",
                message: `System status: ${data.status?.toUpperCase() || "UNKNOWN"}`,
                priority: 2,
            });
        }
    } catch (err) {
        updateBadge({ status: "offline" });
        await chrome.storage.local.set({
            lastHealth: { status: "offline", error: err.message },
            lastPollTs: Date.now(),
        });
    }
});

/* ─── API fetch ────────────────────────────────────────────────────── */
async function fetchHealth() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(`${API_BASE}/api/health`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (!res.ok) return { status: "degraded", httpCode: res.status };
        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }
}

/* ─── Badge color/text ─────────────────────────────────────────────── */
function updateBadge(data) {
    const status = (data?.status || "").toLowerCase();
    let color, text;
    if (status === "healthy" || status === "ok") {
        color = "#00E676"; text = "✓";
    } else if (status === "degraded") {
        color = "#FFD600"; text = "!";
    } else {
        color = "#FF1744"; text = "✗";
    }
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setBadgeText({ text });
}

/* ─── Message handler for popup communication ──────────────────────── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "fetchEndpoint") {
        fetch(`${API_BASE}${msg.path}`, {
            headers: { Accept: "application/json" },
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
        return true; // keep channel open for async response
    }
    if (msg.action === "getStoredHealth") {
        chrome.storage.local.get(["lastHealth", "lastPollTs"], (items) => {
            sendResponse(items);
        });
        return true;
    }
});

/* ─── Install event ────────────────────────────────────────────────── */
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ apiBase: API_BASE, installed: Date.now() });
    updateBadge({ status: "unknown" });
});

/* ═══════════════════════════════════════════════════════════════════════
   HeadyBuddy Chrome Extension — Background Service Worker
   Opens the sidebar on icon click. Polls Buddy for new output.
   ═══════════════════════════════════════════════════════════════════════ */

// Open Side Panel when the toolbar icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

// Enable side panel on all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "fetchBuddy") {
        const apiBase = msg.apiBase || "https://manager.headysystems.com";
        fetch(`${apiBase}/api/health`, {
            headers: { Accept: "application/json" },
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }
    if (msg.action === "fetchA2UI") {
        const apiBase = msg.apiBase || "https://manager.headysystems.com";
        fetch(`${apiBase}/api/buddy/output`, {
            headers: { Accept: "application/json" },
        })
            .then((r) => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => sendResponse({ ok: false, error: String(err) }));
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ installed: Date.now() });
});

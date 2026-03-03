/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Chrome Extension — Background Service Worker v2.0
 * Handles API relay, context menus, status monitoring, and badge indicators.
 */

const DEFAULT_API = "https://manager.headysystems.com/api";

// Model mapping per context menu action
const ACTION_MODELS = {
    "heady-ask": "heady-flash",
    "heady-explain": "heady-reason",
    "heady-code": "heady-flash",
    "heady-battle": "heady-battle-v1",
};

// ── Helpers ──
async function getConfig() {
    const result = await chrome.storage.sync.get(['headyApiKey', 'headyEndpoint', 'headyModel']);
    return {
        apiKey: result.headyApiKey || '',
        endpoint: result.headyEndpoint || DEFAULT_API,
        model: result.headyModel || 'heady-flash',
    };
}

async function checkHealth() {
    try {
        const { endpoint } = await getConfig();
        const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        const ok = data.status === 'ok';
        chrome.action.setBadgeText({ text: ok ? '' : '!' });
        chrome.action.setBadgeBackgroundColor({ color: ok ? '#57F287' : '#ED4245' });
        return { ok, data };
    } catch (err) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#ED4245' });
        return { ok: false, error: err.message };
    }
}

// ── Context Menus ──
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "heady-ask",
        title: "🐝 Ask Heady",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-explain",
        title: "🧠 Explain with Heady",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-code",
        title: "⚡ Refactor with Heady",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-battle",
        title: "🏆 Battle-validate with Heady",
        contexts: ["selection"],
    });

    // Set defaults
    chrome.storage.sync.get(['headyModel'], (result) => {
        if (!result.headyModel) {
            chrome.storage.sync.set({ headyModel: 'heady-flash' });
        }
    });

    // Initial health check
    checkHealth();
});

// Periodic health check every 5 minutes
chrome.alarms?.create?.('heady-health', { periodInMinutes: 5 });
chrome.alarms?.onAlarm?.addListener?.((alarm) => {
    if (alarm.name === 'heady-health') checkHealth();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const text = info.selectionText;
    if (!text) return;

    const prompts = {
        "heady-ask": text,
        "heady-explain": `[INTELLIGENCE] Explain the following in detail:\n\n${text}`,
        "heady-code": `[CODE TASK] Refactor and improve this code:\n\n${text}`,
        "heady-battle": `[BATTLE] Validate the following for regressions, security issues, and quality:\n\n${text}`,
    };

    const message = prompts[info.menuItemId] || text;
    const model = ACTION_MODELS[info.menuItemId] || 'heady-flash';

    // Open side panel and send the message
    try {
        await chrome.sidePanel.open({ tabId: tab.id });
        setTimeout(() => {
            chrome.runtime.sendMessage({ type: "heady-query", message, model, source: info.menuItemId });
        }, 500);
    } catch (e) {
        chrome.action.openPopup?.();
    }
});

// ── Message Relay ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Chat API relay
    if (msg.type === "heady-api") {
        (async () => {
            try {
                const config = await getConfig();
                const model = msg.model || config.model;
                const headers = { "Content-Type": "application/json" };
                if (config.apiKey) {
                    headers["Authorization"] = `Bearer ${config.apiKey}`;
                }

                const res = await fetch(`${config.endpoint}/v1/chat/completions`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: msg.message }],
                    }),
                });

                const data = await res.json();

                if (data.error) {
                    sendResponse({ ok: false, error: data.error.message || data.error });
                    return;
                }

                // Extract reply from OpenAI-compatible response
                const reply = data.choices?.[0]?.message?.content
                    || data.response
                    || data.reply
                    || '';

                sendResponse({
                    ok: true,
                    data: {
                        reply,
                        model: data.model || model,
                        heady: data.heady || null,
                        usage: data.usage || null,
                    }
                });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true; // async response
    }

    // Status check
    if (msg.type === "heady-status") {
        checkHealth().then(sendResponse);
        return true;
    }

    // Pulse check (full system info)
    if (msg.type === "heady-pulse") {
        (async () => {
            try {
                const { endpoint, apiKey } = await getConfig();
                const headers = {};
                if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
                const res = await fetch(`${endpoint}/pulse`, { headers, signal: AbortSignal.timeout(5000) });
                const data = await res.json();
                sendResponse({ ok: true, data });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }

    // Get page context from content script
    if (msg.type === "heady-page-context") {
        sendResponse({ ok: true });
        return false;
    }
});

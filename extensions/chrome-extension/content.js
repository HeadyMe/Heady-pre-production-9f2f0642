/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Heady Chrome Extension — Content Script
 * Captures page context for context-aware AI queries.
 */

// Listen for requests from background/popup for page context
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "get-page-context") {
        const selection = window.getSelection()?.toString()?.trim() || '';
        const context = {
            url: window.location.href,
            title: document.title,
            selection,
            meta: document.querySelector('meta[name="description"]')?.content || '',
        };
        sendResponse({ ok: true, context });
    }
    return false;
});

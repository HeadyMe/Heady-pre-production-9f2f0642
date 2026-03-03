/**
 * Gemini Chat Scraper — Browser Console Script
 * 
 * USAGE:
 *   1. Open gemini.google.com in Chrome
 *   2. Navigate to a chat you want to export
 *   3. Open DevTools (F12) → Console tab
 *   4. Paste this entire script and press Enter
 *   5. The chat will be downloaded as a .md file
 *
 * For batch export: use Google Takeout instead (see scripts/research-ingest/takeout-processor.js)
 * 
 * © HeadySystems Inc. — Tools for auto-research-ingest pipeline
 */

(function exportGeminiChat() {
    "use strict";

    const HUMAN_LABEL = "## 🧑 You";
    const AI_LABEL = "## 🤖 Gemini";
    const SEPARATOR = "\n\n---\n\n";

    // Gemini DOM selectors (may change — update if Google changes their markup)
    const TURN_SELECTORS = [
        "message-content",           // current Gemini web (2025+)
        ".conversation-container",   // alternate layout
        "[data-message-id]",         // data-attribute based
        ".model-response-text",      // model responses
        ".user-query-text",          // user queries
    ];

    function getMessages() {
        // Strategy 1: structured turns
        const turns = document.querySelectorAll("message-content, [data-message-id]");
        if (turns.length > 0) {
            return Array.from(turns).map((el, i) => {
                const isUser = el.closest("[data-is-user-turn]") ||
                    el.classList.contains("user-query-text") ||
                    i % 2 === 0;
                const label = isUser ? HUMAN_LABEL : AI_LABEL;
                // Preserve code blocks
                const codeBlocks = el.querySelectorAll("pre, code");
                let text = "";
                if (codeBlocks.length > 0) {
                    // Walk DOM to preserve code formatting
                    text = walkDOM(el);
                } else {
                    text = el.innerText.trim();
                }
                return `${label}\n\n${text}`;
            });
        }

        // Strategy 2: fallback — grab all visible text blocks
        const allBlocks = document.querySelectorAll(
            ".response-container, .query-container, .conversation-turn"
        );
        if (allBlocks.length > 0) {
            return Array.from(allBlocks).map((el, i) => {
                const label = i % 2 === 0 ? HUMAN_LABEL : AI_LABEL;
                return `${label}\n\n${el.innerText.trim()}`;
            });
        }

        // Strategy 3: last resort — grab the main content area
        const main = document.querySelector("main") || document.body;
        return [`## ⚠️ Raw Export (DOM structure unrecognized)\n\n${main.innerText}`];
    }

    function walkDOM(el) {
        let result = "";
        for (const child of el.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                result += child.textContent;
            } else if (child.nodeName === "PRE" || child.nodeName === "CODE") {
                const lang = child.className?.match(/language-(\w+)/)?.[1] || "";
                result += `\n\`\`\`${lang}\n${child.textContent}\n\`\`\`\n`;
            } else if (child.nodeName === "BR") {
                result += "\n";
            } else if (child.nodeName === "LI") {
                result += `\n- ${child.innerText}`;
            } else {
                result += walkDOM(child);
            }
        }
        return result;
    }

    // Build the markdown
    const title = document.title || "Gemini Chat Export";
    const timestamp = new Date().toISOString();
    const messages = getMessages();

    const header = [
        `# ${title}`,
        "",
        "> **Exported:** " + timestamp,
        "> **Source:** Gemini (gemini.google.com)",
        "> **Turns:** " + messages.length,
        "",
        "> [!CAUTION]",
        "> This is an automated export from Google Gemini. Content may describe external",
        "> entities not affiliated with HeadySystems Inc. Review before integrating.",
        "",
        "---",
        "",
    ].join("\n");

    const markdown = header + messages.join(SEPARATOR);

    // Download
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const filename = `gemini-export-${slug}-${Date.now()}.md`;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${messages.length} turns → ${filename}`);
    console.log("Drop the file into docs/research/inbox/ and the pipeline will auto-ingest it.");
})();

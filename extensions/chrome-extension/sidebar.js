/* ═══════════════════════════════════════════════════════════════════════
   HeadyBuddy Sidebar — Dynamic A2UI Renderer
   
   The sidebar UI is data-driven. Buddy sends JSON directives via the
   manager API and the renderer builds the UI dynamically.
   
   A2UI Block Types:
     "text"     → Pretty-printed rich text bubble
     "image"    → Branded image card with caption
     "code"     → Syntax-highlighted code block
     "heading"  → Section heading
     "list"     → Bullet list
     "status"   → Status indicator (active/thinking/error)
     "divider"  → Visual separator
     "thinking" → Animated thinking state with branded imagery
     "card"     → Flexible card with title + body
   
   Buddy can reshape this sidebar at any time by pushing new directives.
   ═══════════════════════════════════════════════════════════════════════ */

const API_BASE = "https://manager.headysystems.com";
const BUDDY_AVATAR = "icons/buddy-avatar.png";
const BUDDY_THINKING_IMG = "icons/buddy-thinking.png";
const BUDDY_COMPLETE_IMG = "icons/buddy-complete.png";

const $feed = document.getElementById("buddy-feed");
const $content = document.getElementById("dynamic-content");
const $welcome = document.getElementById("welcome");
const $input = document.getElementById("buddy-input");
const $sendBtn = document.getElementById("send-btn");

/* ─── A2UI RENDERER ────────────────────────────────────────────────── */
const A2UI = {
    /**
     * Render an array of A2UI blocks into the dynamic content zone.
     * Can be called multiple times — appends or replaces based on mode.
     */
    render(blocks, { append = true, hideWelcome = true } = {}) {
        if (hideWelcome) $welcome.style.display = "none";
        if (!append) $content.innerHTML = "";

        blocks.forEach((block) => {
            const el = this._createBlock(block);
            if (el) $content.appendChild(el);
        });

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            $feed.scrollTop = $feed.scrollHeight;
        });
    },

    /** Clear all dynamic content and show welcome */
    clear() {
        $content.innerHTML = "";
        $welcome.style.display = "flex";
    },

    /** Create a single A2UI block element */
    _createBlock(block) {
        switch (block.type) {
            case "text": return this._text(block);
            case "image": return this._image(block);
            case "code": return this._code(block);
            case "heading": return this._heading(block);
            case "list": return this._list(block);
            case "status": return this._status(block);
            case "divider": return this._divider();
            case "thinking": return this._thinking(block);
            case "card": return this._card(block);
            default: return null;
        }
    },

    /* ─── Block Builders ───────────────────────────────────────────── */

    _text(b) {
        const wrap = document.createElement("div");
        wrap.className = "buddy-message";
        wrap.innerHTML = `
            <img src="${BUDDY_AVATAR}" alt="" class="buddy-avatar-sm">
            <div class="buddy-content">
                ${b.label ? `<div class="buddy-label">${esc(b.label)}</div>` : ""}
                <div class="buddy-text">${prettyPrint(b.content || "")}</div>
                ${b.timestamp ? `<div class="buddy-timestamp">${timeAgo(b.timestamp)}</div>` : ""}
            </div>
        `;
        return wrap;
    },

    _image(b) {
        const card = document.createElement("div");
        card.className = "buddy-image-card";
        // Use branded image mappings
        const src = resolveImage(b.src || b.url || "");
        card.innerHTML = `
            <img src="${src}" alt="${esc(b.alt || "")}" loading="lazy">
            ${b.caption ? `<div class="buddy-image-caption">${esc(b.caption)}</div>` : ""}
        `;
        return card;
    },

    _code(b) {
        const block = document.createElement("div");
        block.className = "buddy-code-block";
        block.innerHTML = `
            <div class="buddy-code-header">
                <span class="buddy-code-lang">${esc(b.language || "output")}</span>
                <button class="buddy-code-copy" data-code="${esc(b.content || "")}">Copy</button>
            </div>
            <pre class="buddy-code-content">${esc(b.content || "")}</pre>
        `;
        block.querySelector(".buddy-code-copy").addEventListener("click", (e) => {
            navigator.clipboard.writeText(b.content || "");
            e.target.textContent = "Copied!";
            setTimeout(() => (e.target.textContent = "Copy"), 1500);
        });
        return block;
    },

    _heading(b) {
        const h = document.createElement("h3");
        h.className = "buddy-heading";
        h.textContent = b.content || "";
        return h;
    },

    _list(b) {
        const ul = document.createElement("ul");
        ul.className = "buddy-list";
        (b.items || []).forEach((item) => {
            const li = document.createElement("li");
            li.innerHTML = prettyPrint(item);
            ul.appendChild(li);
        });
        return ul;
    },

    _status(b) {
        const div = document.createElement("div");
        div.className = "buddy-status-card";
        const state = b.state || "active";
        div.innerHTML = `
            <div class="buddy-status-dot buddy-status-dot--${state}"></div>
            <span class="buddy-status-text">${esc(b.content || "Processing…")}</span>
        `;
        return div;
    },

    _divider() {
        return Object.assign(document.createElement("hr"), { className: "buddy-divider" });
    },

    _thinking(b) {
        const div = document.createElement("div");
        div.className = "thinking-indicator";
        div.innerHTML = `
            <img src="${BUDDY_THINKING_IMG}" alt="" class="thinking-image">
            <span class="thinking-text">${esc(b.content || "Buddy is thinking…")}</span>
        `;
        return div;
    },

    _card(b) {
        const card = document.createElement("div");
        card.className = "buddy-content";
        card.style.animation = "fadeUp 0.4s var(--ease)";
        card.innerHTML = `
            ${b.title ? `<div class="buddy-label">${esc(b.title)}</div>` : ""}
            <div class="buddy-text">${prettyPrint(b.content || "")}</div>
        `;
        return card;
    },
};

/* ─── PRETTY PRINT ─────────────────────────────────────────────────── */
function prettyPrint(text) {
    return text
        // Bold: **text** → <strong>
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Italic: *text* → <em>
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
        // Inline code: `text` → <code>
        .replace(/`(.+?)`/g, '<code style="background:rgba(0,230,180,0.08);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:12px;color:var(--text-code)">$1</code>')
        // Links: [text](url)
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Line breaks
        .replace(/\n/g, "<br>");
}

function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function timeAgo(ts) {
    const diff = Date.now() - (typeof ts === "number" ? ts : new Date(ts).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

/** Map branded keywords to local images */
function resolveImage(src) {
    const map = {
        "buddy-avatar": BUDDY_AVATAR,
        "buddy-thinking": BUDDY_THINKING_IMG,
        "buddy-complete": BUDDY_COMPLETE_IMG,
        "avatar": BUDDY_AVATAR,
        "thinking": BUDDY_THINKING_IMG,
        "complete": BUDDY_COMPLETE_IMG,
        "success": BUDDY_COMPLETE_IMG,
    };
    return map[src] || src;
}

/* ─── USER INPUT HANDLING ──────────────────────────────────────────── */
function handleSend() {
    const text = $input.value.trim();
    if (!text) return;
    $input.value = "";

    // Show user message
    A2UI.render([
        { type: "text", label: "You", content: text, timestamp: Date.now() },
        { type: "thinking", content: "Buddy is processing your request…" },
    ]);

    // Send to Buddy via manager API
    chrome.runtime.sendMessage(
        { action: "fetchBuddy", apiBase: API_BASE },
        (response) => {
            // Remove thinking indicator
            const thinkingEls = $content.querySelectorAll(".thinking-indicator");
            thinkingEls.forEach((el) => el.remove());

            if (response?.ok && response.data) {
                const health = response.data;
                A2UI.render([
                    {
                        type: "text",
                        label: "Buddy",
                        content: `System is **${health.status || "online"}**. Uptime: \`${formatUptime(health.uptime || health.uptimeMs)}\`. ${health.version ? `Running v${health.version}` : ""}`,
                        timestamp: Date.now(),
                    },
                    { type: "image", src: "buddy-complete", caption: "Sacred Geometry — Resonance Achieved" },
                ]);
            } else {
                A2UI.render([
                    {
                        type: "text",
                        label: "Buddy",
                        content: "I'm having trouble reaching the manager right now. The Sacred Geometry network may be recalibrating. Try again in a moment.",
                        timestamp: Date.now(),
                    },
                ]);
            }
        }
    );
}

$sendBtn.addEventListener("click", handleSend);
$input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

function formatUptime(ms) {
    if (!ms || ms <= 0) return "calculating…";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/* ─── INITIAL LOAD — Fetch Buddy's latest output ──────────────────── */
async function loadBuddyOutput() {
    try {
        // Try to get A2UI directives from the manager
        chrome.runtime.sendMessage({ action: "fetchA2UI", apiBase: API_BASE }, (response) => {
            if (response?.ok && response.data?.blocks) {
                // Buddy has sent UI directives — render them dynamically
                A2UI.render(response.data.blocks, { append: false });
            }
            // Otherwise keep the welcome screen — Buddy will push content when ready
        });
    } catch {
        // Welcome screen stays visible — no API connection needed for first impression
    }
}

// Load on sidebar open
loadBuddyOutput();

/* ─── EXPOSE A2UI GLOBALLY for Buddy to call from content scripts ──── */
window.A2UI = A2UI;

/* ─── LISTEN FOR DYNAMIC UPDATES from background/content scripts ───── */
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "a2ui:render") {
        A2UI.render(msg.blocks || [], { append: msg.append !== false });
    }
    if (msg.action === "a2ui:clear") {
        A2UI.clear();
    }
});

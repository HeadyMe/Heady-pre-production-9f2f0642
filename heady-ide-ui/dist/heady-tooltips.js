/**
 * HeadyTooltips — Global Knowledge Hover System
 * Include on any Heady website. Automatically enriches elements with
 * data-tip attributes into beautiful branded hover popups.
 *
 * Usage: <span data-tip="Title|Description text here">Hover me</span>
 *        <span data-tip="Explanation text">Hover me</span>
 */
(function () {
    'use strict';

    // ── Inject styles ──
    const style = document.createElement('style');
    style.textContent = `
        /* HeadyTooltip container */
        .heady-tip-anchor { position: relative; cursor: help; }
        .heady-tip-anchor::after {
            content: ''; display: inline-block; width: 5px; height: 5px;
            border-radius: 50%; background: rgba(59,130,246,0.4);
            margin-left: 3px; vertical-align: super;
            animation: tipDot 2s ease-in-out infinite;
        }
        @keyframes tipDot {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; box-shadow: 0 0 6px rgba(59,130,246,0.5); }
        }

        /* Popup */
        .heady-tip-popup {
            position: absolute; z-index: 9999;
            bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%) translateY(8px);
            min-width: 240px; max-width: 360px;
            background: linear-gradient(135deg, rgba(10,22,40,0.97), rgba(17,29,53,0.97));
            border: 1px solid rgba(59,130,246,0.25);
            border-radius: 12px; padding: 0;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(59,130,246,0.08);
            opacity: 0; pointer-events: none;
            transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16,1,0.3,1);
            backdrop-filter: blur(20px);
            overflow: hidden;
        }
        .heady-tip-popup.show {
            opacity: 1; pointer-events: auto;
            transform: translateX(-50%) translateY(0);
        }
        /* Arrow */
        .heady-tip-popup::after {
            content: ''; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg);
            width: 12px; height: 12px;
            background: rgba(17,29,53,0.97); border-right: 1px solid rgba(59,130,246,0.25);
            border-bottom: 1px solid rgba(59,130,246,0.25);
        }

        /* Header bar */
        .heady-tip-header {
            display: flex; align-items: center; gap: 6px;
            padding: 8px 14px; font-size: 12px; font-weight: 700;
            color: #60a5fa; letter-spacing: 0.04em;
            background: rgba(59,130,246,0.06);
            border-bottom: 1px solid rgba(59,130,246,0.1);
        }
        .heady-tip-header .hex { font-size: 11px; opacity: 0.6; }

        /* Body */
        .heady-tip-body {
            padding: 10px 14px 12px; font-size: 13px; line-height: 1.55;
            color: #c8d6e5;
        }

        /* Gradient top bar */
        .heady-tip-glow {
            height: 2px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
            background-size: 300% 100%;
            animation: tipGlow 3s linear infinite;
        }
        @keyframes tipGlow {
            0% { background-position: 0% 0; }
            100% { background-position: 300% 0; }
        }

        /* Flip popup below if near top of viewport */
        .heady-tip-popup.flip {
            bottom: auto; top: calc(100% + 12px);
            transform: translateX(-50%) translateY(-8px);
        }
        .heady-tip-popup.flip.show { transform: translateX(-50%) translateY(0); }
        .heady-tip-popup.flip::after {
            bottom: auto; top: -6px;
            border-right: none; border-bottom: none;
            border-left: 1px solid rgba(59,130,246,0.25);
            border-top: 1px solid rgba(59,130,246,0.25);
        }
    `;
    document.head.appendChild(style);

    // ── Heady knowledge base for auto-enrichment ──
    const KNOWLEDGE = {
        'hcfp': 'Heady Continuous Full Pipeline — the auto-success engine that validates all changes through HeadySims simulation, HeadyBattle interrogation, and Arena Mode competitive selection before deployment.',
        'headysims': 'Monte Carlo simulation engine using UCB1 algorithm. Runs 1000+ simulations across 7 strategies (fast_serial, fast_parallel, balanced, thorough, cached_fast, probe_then_commit, monte_carlo_optimal) to find optimal execution paths.',
        'headybattle': 'Socratic interrogation layer that validates decisions through structured questioning across purpose, consequences, and optimization categories. Requires 0.8+ validation score for approval.',
        'arena mode': 'Competitive tournament system where 7 candidate strategies compete across 3 elimination rounds. Winners must pass HeadyBattle validation and meet 0.75 confidence threshold for production promotion.',
        'headybrain': 'Central AI intelligence hub. Fires requests to all AI providers simultaneously via Parallel Race Buffer — Claude, OpenAI, Gemini, Ollama — and returns the fastest quality response.',
        'parallel race buffer': 'Concurrent request strategy that fires identical prompts to all configured AI providers simultaneously. The first response meeting quality thresholds wins, dramatically reducing latency.',
        'sacred geometry': 'Design philosophy inspired by Metatron\'s Cube — a geometric figure composed of 13 equal circles with lines from the center connecting them. Ensures balanced, fault-tolerant system architecture.',
        'metatron\'s cube': 'Sacred geometric pattern used as the architectural blueprint for HeadySystems. Each circle represents a service node, with connecting lines representing data flow paths.',
        'headyliquid': 'Dynamic component allocation engine. Every Heady component is "liquid" — intelligently routed to where it\'s needed based on context analysis, affinity scoring, and resource availability.',
        'api key': 'Bearer token for server-to-server authentication. Format: heady_api_key_NNN. Include in Authorization header. Tiers: Admin (unlimited), Premium (100/min), Core (30/min), Guest (5/min).',
        'oauth': 'Google OAuth 2.0 redirect flow. Users are redirected to Google consent screen, then returned to /auth/google/callback with a JWT token valid for 180 days.',
        'device token': 'Silent authentication for desktop and mobile apps. Auto-generated per device UUID, valid for 90 days. No user interaction required — ideal for HeadyBuddy and editors.',
        'warp': 'Cloudflare WARP tunnel authentication. Devices connected through WARP are auto-detected and granted premium tier access for 365 days with zero-trust encryption.',
        'vector memory': '3D vector storage system using nomic-embed-text embeddings. Every interaction is embedded and stored for semantic search, context recall, and continuous learning.',
        'headybuddy': 'AI companion available as a desktop app (Electron), browser extension, and embeddable widget. Connects to HeadyBrain for chat, code assistance, and system management.',
        'headymcp': 'Model Context Protocol server implementation. Exposes Heady\'s 20+ AI tools as MCP resources for integration with any MCP-compatible IDE or agent.',
        'headyweb': 'Search-first web application. Features AI-powered search with knowledge base integration, user accounts via Firebase, and Stripe subscription management.',
        'headyconnection': 'Partnership and connector hub. Provides integration guides, webhook endpoints, and SDK documentation for third-party developers building on the Heady platform.',
        'headyme': 'Personal AI assistant workspace. Manages individual preferences, search history, and personalized AI responses through 3D vector memory profiles.',
        'headyio': 'Developer SDK and integration platform. Provides JavaScript, Python, and cURL APIs for programmatic access to all HeadyBrain capabilities.',
        'ors': 'Operational Readiness Score — a 0-100% metric that represents overall system health. Combines uptime, response latency, error rate, and capacity metrics.'
    };

    // ── Create popup element ──
    function createPopup(title, body) {
        const popup = document.createElement('div');
        popup.className = 'heady-tip-popup';
        popup.innerHTML = `
            <div class="heady-tip-glow"></div>
            <div class="heady-tip-header"><span class="hex">⬡</span> ${title}</div>
            <div class="heady-tip-body">${body}</div>
        `;
        return popup;
    }

    // ── Parse tip content ──
    function parseTip(raw) {
        if (raw.includes('|')) {
            const [title, ...body] = raw.split('|');
            return { title: title.trim(), body: body.join('|').trim() };
        }
        return { title: 'Info', body: raw };
    }

    // ── Auto-enrich known terms ──
    function autoEnrich() {
        // Find elements with data-tip attribute
        document.querySelectorAll('[data-tip]').forEach(el => {
            if (el._headyTipInit) return;
            el._headyTipInit = true;
            el.classList.add('heady-tip-anchor');
            const { title, body } = parseTip(el.getAttribute('data-tip'));
            attachPopup(el, title, body);
        });

        // Auto-detect known terms in card content, status pills, and metric labels
        const textEls = document.querySelectorAll('.card li, .card p, .metric .lbl, .arch-nodes span, .endpoint-desc, .status-item');
        textEls.forEach(el => {
            if (el._headyAutoTip) return;
            const text = el.textContent.toLowerCase();
            for (const [term, desc] of Object.entries(KNOWLEDGE)) {
                if (text.includes(term.toLowerCase()) && !el.querySelector('[data-tip]')) {
                    el._headyAutoTip = true;
                    el.classList.add('heady-tip-anchor');
                    const capTitle = term.charAt(0).toUpperCase() + term.slice(1);
                    attachPopup(el, capTitle, desc);
                    break; // One tooltip per element
                }
            }
        });
    }

    // ── Attach popup behavior ──
    function attachPopup(el, title, body) {
        const popup = createPopup(title, body);
        el.appendChild(popup);

        let showTimeout, hideTimeout;

        el.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                // Check if near top of viewport — flip if needed
                const rect = el.getBoundingClientRect();
                if (rect.top < 180) {
                    popup.classList.add('flip');
                } else {
                    popup.classList.remove('flip');
                }
                popup.classList.add('show');
            }, 300);
        });

        el.addEventListener('mouseleave', () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => popup.classList.remove('show'), 200);
        });
    }

    // ── Init on DOM ready ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoEnrich);
    } else {
        autoEnrich();
    }
    // Re-run after dynamic content loads
    setTimeout(autoEnrich, 2000);
    // Observe DOM mutations for dynamic content
    new MutationObserver(autoEnrich).observe(document.body, { childList: true, subtree: true });
})();

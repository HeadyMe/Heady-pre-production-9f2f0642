/**
 * Heady Runtime — Dynamic Config & Live Status for HF Spaces
 * Injected into all HF Spaces at deploy time.
 * Reads config from window.HEADY_CONFIG (set by deploy script).
 */
(function () {
    'use strict';

    // ── Config Resolution ──
    const defaults = {
        apiUrl: 'https://api.headysystems.com',
        spaceId: 'unknown',
        version: '1.0.0',
        buildTs: null,
        statusPollMs: 30000,
    };
    const cfg = Object.assign({}, defaults, window.HEADY_CONFIG || {});
    window.HEADY_CONFIG = cfg;

    // Legacy compat — buddy-widget.js reads HEADY_API
    if (!window.HEADY_API) window.HEADY_API = cfg.apiUrl;

    // ── Status Badge Renderer ──
    const STATUS_COLORS = {
        healthy: '#4ade80',
        degraded: '#f59e0b',
        down: '#ef4444',
        unknown: '#6b7280',
    };

    function createStatusBadge() {
        const existing = document.getElementById('heady-status-badge');
        if (existing) return existing;

        const badge = document.createElement('div');
        badge.id = 'heady-status-badge';
        badge.style.cssText = `
            position:fixed;bottom:24px;left:24px;display:inline-flex;align-items:center;
            gap:8px;padding:6px 14px;border-radius:24px;font-size:0.72rem;font-weight:500;
            font-family:system-ui,-apple-system,sans-serif;z-index:99990;
            background:rgba(10,10,26,0.85);border:1px solid rgba(255,255,255,0.08);
            backdrop-filter:blur(12px);color:#e0e0f0;cursor:pointer;
            transition:all 0.3s;box-shadow:0 2px 12px rgba(0,0,0,0.3);
        `;
        badge.title = 'Heady System Status';

        const dot = document.createElement('span');
        dot.id = 'heady-status-dot';
        dot.style.cssText = `
            width:8px;height:8px;border-radius:50%;
            background:${STATUS_COLORS.unknown};
            box-shadow:0 0 6px ${STATUS_COLORS.unknown};
            transition:all 0.3s;
        `;

        const label = document.createElement('span');
        label.id = 'heady-status-label';
        label.textContent = 'Connecting...';

        const version = document.createElement('span');
        version.style.cssText = 'opacity:0.4;font-size:0.6rem;margin-left:4px;';
        version.textContent = `v${cfg.version}`;

        badge.appendChild(dot);
        badge.appendChild(label);
        badge.appendChild(version);
        document.body.appendChild(badge);

        badge.addEventListener('click', () => {
            pollStatus();
            badge.style.transform = 'scale(0.95)';
            setTimeout(() => badge.style.transform = '', 150);
        });

        return badge;
    }

    function updateBadge(status, text) {
        const dot = document.getElementById('heady-status-dot');
        const label = document.getElementById('heady-status-label');
        if (dot) {
            dot.style.background = STATUS_COLORS[status] || STATUS_COLORS.unknown;
            dot.style.boxShadow = `0 0 6px ${STATUS_COLORS[status] || STATUS_COLORS.unknown}`;
        }
        if (label) label.textContent = text;
    }

    // ── Live Status Polling ──
    let lastStatus = null;

    async function pollStatus() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${cfg.apiUrl}/api/autonomy/runtime-status`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' },
            });
            clearTimeout(timeout);

            if (!res.ok) {
                updateBadge('degraded', `API ${res.status}`);
                lastStatus = 'degraded';
                return;
            }

            const data = await res.json();
            lastStatus = data;

            if (data.alive) {
                const score = data.healthScore || 0;
                if (score >= 0.8) {
                    updateBadge('healthy', `Operational · ${(score * 100).toFixed(0)}%`);
                } else if (score >= 0.5) {
                    updateBadge('degraded', `Degraded · ${(score * 100).toFixed(0)}%`);
                } else {
                    updateBadge('down', `Issues · ${(score * 100).toFixed(0)}%`);
                }
            } else {
                updateBadge('down', 'System Down');
            }

            // Emit custom event for other scripts
            window.dispatchEvent(new CustomEvent('heady:status', { detail: data }));
        } catch (e) {
            if (e.name === 'AbortError') {
                updateBadge('degraded', 'Timeout');
            } else {
                updateBadge('unknown', 'Offline');
            }
        }
    }

    // ── Build Info Footer ──
    function injectBuildFooter() {
        if (!cfg.buildTs) return;
        const footers = document.querySelectorAll('footer');
        const target = footers[footers.length - 1];
        if (!target) return;

        const info = document.createElement('p');
        info.style.cssText = 'margin-top:8px;font-size:0.6rem;opacity:0.3;';
        const date = new Date(cfg.buildTs).toISOString().split('T')[0];
        info.textContent = `Build: ${date} · Space: ${cfg.spaceId} · v${cfg.version}`;
        target.appendChild(info);
    }

    // ── Dynamic Data Helpers ──
    window.HEADY_RUNTIME = {
        getConfig: () => cfg,
        getLastStatus: () => lastStatus,
        pollStatus,
        updateBadge,

        async fetchJSON(path) {
            try {
                const res = await fetch(`${cfg.apiUrl}${path}`, {
                    headers: { 'Accept': 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (e) {
                console.warn(`[HeadyRuntime] fetch failed: ${path}`, e.message);
                return null;
            }
        },

        async getAutonomyState() {
            return this.fetchJSON('/api/autonomy/state');
        },

        async getDigitalPresence() {
            return this.fetchJSON('/api/autonomy/digital-presence');
        },

        async getUnifiedModel() {
            return this.fetchJSON('/api/autonomy/unified-model');
        },
    };

    // ── Init ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        createStatusBadge();
        injectBuildFooter();
        pollStatus();
        if (cfg.statusPollMs > 0) {
            setInterval(pollStatus, cfg.statusPollMs);
        }
    }
})();

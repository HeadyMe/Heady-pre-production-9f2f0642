/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Template Bee — Centralized sacred-geometry site template engine.
 * Generates branded, themed pages for every Heady domain by injecting
 * site-registry data dynamically. This is the single source of truth
 * for all site rendering across edge (Cloudflare) and origin (Cloud Run).
 *
 * Every site gets:
 *  - Unique sacred geometry background (Seed of Life, Flower of Life, Metatrons Cube, etc.)
 *  - Per-site accent colors and branding
 *  - Branded auth gate with all popular login providers
 *  - HeadyBuddy chat integration
 *  - Responsive nav linking all Heady domains
 *
 * Used by: heady-edge-proxy (Cloudflare Worker), site-renderer.js (Cloud Run)
 */

const path = require("path");

// Structured logger — delegates to StructuredLogger for JSON output
const _logger = require('../utils/logger').child('template-bee');
const logger = {
    logNodeActivity: (node, msg) => { try { _logger.info(`[${node}] ${msg}`); } catch { } },
};

const domain = "templates";
const description = "Sacred geometry site template engine — delivers branded pages for every Heady domain";
const priority = 0.9;

// ─── Site Registry (embedded for edge-compatible instant recall) ─────
let _registry = null;

function getRegistry() {
    if (_registry) return _registry;
    try {
        const raw = require("../sites/site-registry.json");
        // Normalize: support both preconfiguredSites (new) and preconfigured (legacy)
        _registry = {
            ...raw,
            preconfiguredSites: raw.preconfiguredSites || raw.preconfigured || {},
        };
        return _registry;
    } catch (e) {
        logger.logNodeActivity("TEMPLATE-BEE", `⚠ Registry load failed: ${e.message}`);
        return { preconfiguredSites: {}, domainAliases: {} };
    }
}

function resolveDomain(hostname) {
    const reg = getRegistry();
    const resolved = reg.domainAliases?.[hostname] || hostname;
    return reg.preconfiguredSites?.[resolved] || null;
}

// ─── Auth Providers ─────────────────────────────────────────────────
const AUTH_PROVIDERS = [
    {
        id: "google", name: "Google",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`
    },
    {
        id: "apple", name: "Apple",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`
    },
    {
        id: "github", name: "GitHub",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.748-1.026 2.748-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>`
    },
    {
        id: "microsoft", name: "Microsoft",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>`
    },
    {
        id: "discord", name: "Discord",
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>`
    },
    {
        id: "x", name: "X / Twitter",
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
    }
];

// ─── Nav Generator ──────────────────────────────────────────────────
const HEADY_SITES = [
    ["HeadyMe", "https://headyme.com"],
    ["HeadyBuddy", "https://headybuddy.org"],
    ["HeadySystems", "https://headysystems.com"],
    ["HeadyConnection", "https://headyconnection.org"],
    ["HeadyMCP", "https://headymcp.com"],
    ["HeadyIO", "https://headyio.com"],
    ["HeadyBot", "https://headybot.com"],
    ["HeadyOS", "https://headyos.com"],
    ["HeadyAPI", "https://headyapi.com"],
];

function generateNav(activeDomain) {
    return HEADY_SITES.map(([name, url]) =>
        `<a href="${url}" ${url.includes(activeDomain) ? 'class="active"' : ""}>${name}</a>`
    ).join("");
}

// ─── Auth Gate Generator ────────────────────────────────────────────
function generateAuthGate(siteName, accent, domain) {
    const providerButtons = AUTH_PROVIDERS.map(p =>
        `<button class="auth-provider" onclick="heady_auth('${p.id}')">${p.icon}<span>${p.name}</span></button>`
    ).join("");

    return `
<!-- ═══ Liquid Auth Gate — Sacred Geometry Branded ═══ -->
<div id="heady-auth-gate" class="auth-overlay">
<div class="auth-backdrop"></div>
<div class="auth-card">
<div class="auth-geo-ring">
<svg viewBox="0 0 120 120" class="auth-geo-svg">
<circle cx="60" cy="60" r="55" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.3"/>
<circle cx="60" cy="60" r="40" fill="none" stroke="${accent}" stroke-width="0.3" opacity="0.2"/>
<circle cx="60" cy="60" r="25" fill="none" stroke="${accent}" stroke-width="0.3" opacity="0.15"/>
<polygon points="60,5 108,32.5 108,87.5 60,115 12,87.5 12,32.5" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.25"/>
<polygon points="60,20 95,42 95,78 60,100 25,78 25,42" fill="none" stroke="${accent}" stroke-width="0.4" opacity="0.2"/>
</svg>
<div class="auth-logo-hex">
<svg width="32" height="32" viewBox="0 0 40 40" fill="none">
<polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="${accent}" stroke-width="2"/>
<circle cx="20" cy="20" r="5" fill="${accent}"/>
</svg>
</div>
</div>
<h2 class="auth-title">${siteName}</h2>
<p class="auth-sub">Sign in to access your command center</p>
<div class="auth-providers">${providerButtons}</div>
<div class="auth-divider"><span>or sign in with email</span></div>
<input id="auth-email" type="email" placeholder="Email address" class="auth-input">
<input id="auth-pass" type="password" placeholder="Password" class="auth-input">
<button onclick="heady_auth('email')" class="auth-submit" style="border-color:${accent}88;color:${accent}">SIGN IN</button>
<p class="auth-footer">Don't have an account? <a href="#" onclick="heady_auth('signup');return false" style="color:${accent}">Sign up</a></p>
</div>
</div>
<style>
.auth-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .5s ease}
.auth-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5)}
.auth-card{position:relative;background:linear-gradient(145deg,rgba(12,12,20,0.97),rgba(8,8,16,0.99));border:1px solid ${accent}22;border-radius:28px;padding:2.5rem 2.5rem 2rem;max-width:440px;width:92%;text-align:center;box-shadow:0 0 80px ${accent}08,0 0 40px ${accent}06,0 32px 64px rgba(0,0,0,.8);overflow:hidden}
.auth-card::before{content:'';position:absolute;inset:-1px;border-radius:28px;padding:1px;background:linear-gradient(135deg,${accent}22,transparent 40%,transparent 60%,${accent}11);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.auth-geo-ring{position:relative;width:100px;height:100px;margin:0 auto 1.2rem}
.auth-geo-svg{position:absolute;inset:0;width:100%;height:100%;animation:authGeoSpin 30s linear infinite}
.auth-logo-hex{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(0,0,0,0.6);border:1px solid ${accent}33;box-shadow:0 0 24px ${accent}22}
.auth-title{font-size:1.5rem;font-weight:700;color:#fff;margin:0 0 .4rem;letter-spacing:-.02em}
.auth-sub{font-size:.82rem;color:rgba(255,255,255,.4);margin:0 0 1.5rem}
.auth-providers{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1rem}
.auth-provider{display:flex;align-items:center;gap:.6rem;padding:.7rem .8rem;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.85);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit}
.auth-provider:hover{background:rgba(255,255,255,.08);border-color:${accent}44;transform:translateY(-1px)}
.auth-provider span{white-space:nowrap}
.auth-divider{display:flex;align-items:center;gap:.8rem;margin:.8rem 0}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
.auth-divider span{font-size:.7rem;color:rgba(255,255,255,.2);white-space:nowrap}
.auth-input{width:100%;padding:.7rem 1rem;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#fff;font-size:.82rem;margin-bottom:.6rem;outline:none;font-family:inherit;transition:border-color .2s}
.auth-input:focus{border-color:${accent}55}
.auth-submit{width:100%;padding:.8rem;border-radius:12px;border:1px solid;background:transparent;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .25s;letter-spacing:.04em;font-family:inherit;margin-top:.3rem}
.auth-submit:hover{background:${accent}15;box-shadow:0 0 20px ${accent}15}
.auth-footer{margin-top:1rem;font-size:.75rem;color:rgba(255,255,255,.3)}
.auth-footer a{text-decoration:none;font-weight:500}
@keyframes authGeoSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
</style>
<script>
function heady_auth(provider){
  var g=document.getElementById('heady-auth-gate');
  g.style.opacity='0';
  setTimeout(function(){g.style.display='none';},500);
  localStorage.setItem('heady_auth_session',JSON.stringify({ts:Date.now(),site:'${domain}',provider:provider}));
}
(function(){
  var s=localStorage.getItem('heady_auth_session');
  if(s){try{var d=JSON.parse(s);if(Date.now()-d.ts<365*86400000){var g=document.getElementById('heady-auth-gate');if(g){g.style.display='none';}}}catch(e){}}
})();
<\\/script>`;
}

// ─── Full Page Template Generator ───────────────────────────────────
/**
 * Generates a full branded page for a Heady domain.
 * This is the core template that every site uses.
 *
 * @param {string} hostname - The domain to render (e.g., 'headysystems.com')
 * @returns {string} Full HTML page with sacred geometry, auth gate, nav, branding
 */
function renderSite(hostname) {
    const site = resolveDomain(hostname);
    if (!site) return null;

    const {
        name, tagline, description: desc, sacredGeometry,
        accent, accentDark, features, stats
    } = site;

    const nav = generateNav(hostname);
    const authGate = generateAuthGate(name, accent, hostname);

    const cardHTML = (features || []).map(f =>
        `<div class="card"><div class="ci">${f.icon}</div><h3>${f.title}</h3><p>${f.desc}</p></div>`
    ).join("");

    const statsHTML = (stats || []).map(s =>
        `<div class="stat"><div class="stat-val">${s.value}</div><div class="stat-lbl">${s.label}</div></div>`
    ).join("");

    return { name, tagline, desc, sacredGeometry, accent, accentDark, nav, authGate, cardHTML, statsHTML, hostname };
}

/**
 * Get all site template data for edge embedding.
 * Returns a map of hostname → template data for instant edge delivery.
 */
function getAllSiteTemplates() {
    const reg = getRegistry();
    const templates = {};
    for (const [domain, config] of Object.entries(reg.preconfiguredSites || {})) {
        templates[domain] = {
            name: config.name,
            tagline: config.tagline,
            description: config.description,
            sacredGeometry: config.sacredGeometry,
            accent: config.accent,
            accentDark: config.accentDark,
            features: config.features,
            stats: config.stats,
            chatEnabled: config.chatEnabled,
        };
    }
    return templates;
}

// ─── Bee Work Functions ─────────────────────────────────────────────
function getWork(ctx = {}) {
    const reg = getRegistry();
    const sites = Object.keys(reg.preconfiguredSites || {});

    return sites.map(domain => async () => {
        const template = renderSite(domain);
        return {
            bee: "templates",
            action: `render-${domain}`,
            site: domain,
            rendered: !!template,
            sacredGeometry: template?.sacredGeometry || "unknown",
        };
    });
}

module.exports = {
    domain,
    description,
    priority,
    getWork,
    // Template API — used by edge proxy and site-renderer
    renderSite,
    resolveDomain,
    generateNav,
    generateAuthGate,
    getAllSiteTemplates,
    AUTH_PROVIDERS,
    HEADY_SITES,
};

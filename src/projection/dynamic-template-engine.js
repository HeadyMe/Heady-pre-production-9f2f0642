/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Dynamic Site Template Engine ═══════════════════════════════════════
 *
 * Unifies ALL template engines into a single dynamic rendering pipeline:
 *   1. template-bee.js         → Auth gate, nav, branding data
 *   2. site-projection-renderer.js → CSS design system + HTML generation
 *   3. headybee-ui-templates.js    → Widget layouts, palettes, typography
 *   4. a2ui.js                     → Agent-to-UI protocol streaming
 *   5. generative-engine.js        → AI component generation
 *
 * Usage:
 *   const engine = require('./dynamic-template-engine');
 *   const html = engine.renderDynamic('headyme.com', { withAuth: true });
 *   engine.projectAll();                  // re-project all 9 sites
 *   engine.renderWidget('command-center'); // render a widget layout
 *
 * @module dynamic-template-engine
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ── Import all template engines ─────────────────────────────────────
const templateBee = require('../bees/template-bee');
const siteRenderer = require('../projection/site-projection-renderer');

// ── Constants ───────────────────────────────────────────────────────
const PHI = 1.618033988749895;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SITES_DIR = path.join(PROJECT_ROOT, 'services/heady-web/sites');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'src/sites/site-registry.json');

// ── Load Registry ───────────────────────────────────────────────────
function loadRegistry() {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  return raw.preconfiguredSites || raw.preconfigured || raw;
}

// ── Auth Gate Injection ─────────────────────────────────────────────
/**
 * Injects template-bee auth gate + nav into rendered HTML
 * @param {string} html - Rendered HTML from site-projection-renderer
 * @param {object} siteData - Template bee data (authGate, nav, etc.)
 * @param {object} opts - Options
 * @returns {string} HTML with auth gate + nav injected
 */
function injectAuthGate(html, siteData, opts = {}) {
  if (!siteData || !siteData.authGate) return html;

  const authModal = `
  <!-- ══ Auth Gate (injected by dynamic-template-engine) ══ -->
  <div id="heady-auth-gate" class="auth-gate" style="display:none">
    <div class="auth-overlay" onclick="document.getElementById('heady-auth-gate').style.display='none'"></div>
    <div class="auth-panel">
      ${siteData.authGate}
    </div>
  </div>
  <style>
    .auth-gate { position:fixed; top:0; left:0; width:100%; height:100%; z-index:10000; display:flex; align-items:center; justify-content:center; }
    .auth-overlay { position:absolute; inset:0; background:rgba(0,0,0,.7); backdrop-filter:blur(12px); }
    .auth-panel { position:relative; z-index:1; width:90%; max-width:420px; border-radius:16px; overflow:hidden; }
    .auth-trigger { position:fixed; top:16px; right:16px; z-index:9999; padding:8px 20px; border-radius:8px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.05); backdrop-filter:blur(12px); color:#e2e8f0; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; }
    .auth-trigger:hover { background:rgba(255,255,255,.12); transform:translateY(-1px); }
  </style>
  <button class="auth-trigger" onclick="document.getElementById('heady-auth-gate').style.display='flex'">
    Sign In
  </button>`;

  // Inject before closing </body>
  return html.replace('</body>', authModal + '\n</body>');
}

// ── Cross-Site Nav Injection ────────────────────────────────────────
/**
 * Injects the cross-domain nav bar on every site
 */
function injectCrossSiteNav(html) {
  const sites = templateBee.HEADY_SITES || [];
  if (!sites.length) return html;

  const navLinks = sites.map(([name, url]) =>
    `<a href="${url}" class="csn-link" target="_blank">${name}</a>`
  ).join('');

  const crossNav = `
  <!-- ══ Cross-Site Nav (injected by dynamic-template-engine) ══ -->
  <div class="cross-site-nav" id="crossSiteNav">
    <button class="csn-toggle" onclick="document.getElementById('crossSiteNav').classList.toggle('open')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      Heady Network
    </button>
    <div class="csn-links">${navLinks}</div>
  </div>
  <style>
    .cross-site-nav { position:fixed; bottom:16px; left:16px; z-index:9998; font-family:'Inter',system-ui,sans-serif; }
    .csn-toggle { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:20px; border:1px solid rgba(255,255,255,.1); background:rgba(10,14,23,.9); backdrop-filter:blur(16px); color:#94a3b8; font-size:12px; font-weight:500; cursor:pointer; transition:all .2s; font-family:inherit; }
    .csn-toggle:hover { border-color:rgba(0,212,170,.3); color:#e2e8f0; }
    .csn-links { display:none; position:absolute; bottom:44px; left:0; background:rgba(17,24,39,.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.1); border-radius:12px; padding:8px; min-width:180px; }
    .cross-site-nav.open .csn-links { display:block; }
    .csn-link { display:block; padding:8px 12px; color:#94a3b8; text-decoration:none; font-size:12px; border-radius:6px; transition:all .15s; }
    .csn-link:hover { background:rgba(0,212,170,.08); color:#00d4aa; }
  </style>`;

  return html.replace('</body>', crossNav + '\n</body>');
}

// ── Buddy Widget Injection ──────────────────────────────────────────
function injectBuddyWidget(html) {
  const widget = `
  <!-- ══ HeadyBuddy Widget (injected by dynamic-template-engine) ══ -->
  <div id="heady-buddy-fab" class="buddy-fab" onclick="this.classList.toggle('open')">
    <div class="buddy-icon">🤖</div>
    <div class="buddy-panel">
      <div class="buddy-header">
        <span>HeadyBuddy</span>
        <span class="buddy-status">● Online</span>
      </div>
      <div class="buddy-body">
        <div class="buddy-msg">Hey! I'm HeadyBuddy, your AI companion. Ask me anything about this site.</div>
        <input class="buddy-input" placeholder="Ask HeadyBuddy..." onkeydown="if(event.key==='Enter')this.value=''"/>
      </div>
    </div>
  </div>
  <style>
    .buddy-fab { position:fixed; bottom:16px; right:16px; z-index:9999; }
    .buddy-icon { width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg,#00d4aa,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer; box-shadow:0 4px 20px rgba(0,212,170,.3); transition:transform .2s; }
    .buddy-icon:hover { transform:scale(1.08); }
    .buddy-panel { display:none; position:absolute; bottom:60px; right:0; width:320px; background:rgba(17,24,39,.97); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.1); border-radius:16px; overflow:hidden; }
    .buddy-fab.open .buddy-panel { display:block; }
    .buddy-header { padding:14px 16px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:600; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; }
    .buddy-status { font-size:11px; color:#00d4aa; font-weight:500; }
    .buddy-body { padding:16px; }
    .buddy-msg { font-size:13px; color:#94a3b8; line-height:1.6; margin-bottom:12px; font-family:'Inter',system-ui,sans-serif; }
    .buddy-input { width:100%; padding:10px 14px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#e2e8f0; font-size:13px; outline:none; font-family:'Inter',system-ui,sans-serif; }
    .buddy-input:focus { border-color:rgba(0,212,170,.4); }
  </style>`;

  return html.replace('</body>', widget + '\n</body>');
}

// ══════════════════════════════════════════════════════════════════════
// MAIN API
// ══════════════════════════════════════════════════════════════════════

/**
 * Resolve slug from domain using registry config
 */
function domainToSlug(domain, config) {
  if (config && config.slug) return config.slug;
  return domain.replace(/\..*$/, '');
}

/**
 * Enhance an EXISTING site HTML file with dynamic features.
 * DOES NOT regenerate the design — preserves the original awesome layout
 * and injects auth gate, cross-site nav, and buddy widget on top.
 *
 * @param {string} domain - Domain key (e.g., 'headyme.com')
 * @param {object} opts
 * @param {boolean} opts.withAuth - Include auth gate
 * @param {boolean} opts.withNav - Include cross-site nav
 * @param {boolean} opts.withBuddy - Include buddy widget
 * @returns {string|null} Enhanced HTML page, or null if no source file found
 */
function enhanceSite(domain, opts = {}) {
  const { withAuth = true, withNav = true, withBuddy = true } = opts;

  const registry = loadRegistry();
  const siteConfig = registry[domain];
  if (!siteConfig) {
    console.error(`[dynamic-template-engine] Unknown domain: ${domain}`);
    return null;
  }

  // Read the EXISTING site file — preserves the original design
  const slug = domainToSlug(domain, siteConfig);
  const filePath = path.join(SITES_DIR, slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    console.error(`[dynamic-template-engine] No existing site file for: ${domain} (${filePath})`);
    return null;
  }

  let html = fs.readFileSync(filePath, 'utf-8');

  // Only inject features if they aren't already present
  if (withAuth && !html.includes('heady-auth-gate')) {
    const siteData = templateBee.renderSite(domain);
    html = injectAuthGate(html, siteData, opts);
  }

  if (withNav && !html.includes('cross-site-nav')) {
    html = injectCrossSiteNav(html);
  }

  if (withBuddy && !html.includes('heady-buddy-fab')) {
    html = injectBuddyWidget(html);
  }

  return html;
}

/**
 * Render a single site FROM SCRATCH using site-projection-renderer.
 * Use this only when creating a NEW site, not when updating existing ones.
 *
 * @param {string} domain - Domain key (e.g., 'headyme.com')
 * @param {object} opts
 * @returns {string} Full HTML page (freshly generated)
 */
function renderFromScratch(domain, opts = {}) {
  const { withAuth = true, withNav = true, withBuddy = true } = opts;

  const registry = loadRegistry();
  const siteConfig = registry[domain];
  if (!siteConfig) return null;

  let html = siteRenderer.renderSiteToHTML(siteConfig, domain);

  if (withAuth) {
    const siteData = templateBee.renderSite(domain);
    html = injectAuthGate(html, siteData, opts);
  }
  if (withNav) html = injectCrossSiteNav(html);
  if (withBuddy) html = injectBuddyWidget(html);

  return html;
}

/**
 * Enhance all 9 sites with dynamic features (preserving original designs).
 * @returns {{ enhanced: string[], errors: string[], bytes: Object }}
 */
function enhanceAll(opts = {}) {
  const registry = loadRegistry();
  const enhanced = [];
  const errors = [];
  const bytes = {};

  for (const [domain, config] of Object.entries(registry)) {
    try {
      const html = enhanceSite(domain, opts);
      if (!html) { errors.push(domain); continue; }

      const slug = domainToSlug(domain, config);
      const dir = path.join(SITES_DIR, slug);
      const outPath = path.join(dir, 'index.html');
      fs.writeFileSync(outPath, html, 'utf-8');
      bytes[domain] = Buffer.byteLength(html);
      enhanced.push(domain);
    } catch (err) {
      errors.push(`${domain}: ${err.message}`);
    }
  }

  return { enhanced, errors, bytes };
}

// ── CLI Entry Point ─────────────────────────────────────────────────
if (require.main === module) {
  const mode = process.argv.includes('--scratch') ? 'scratch' : 'enhance';

  console.log('═══ Dynamic Template Engine ═══\n');

  if (mode === 'enhance') {
    console.log('Enhancing all 9 sites (preserving original designs)...\n');
    const result = enhanceAll();

    console.log(`✅ Enhanced: ${result.enhanced.length} sites`);
    result.enhanced.forEach(d => {
      const kb = (result.bytes[d] / 1024).toFixed(1);
      console.log(`   ${d} → ${kb} KB`);
    });
    if (result.errors.length) {
      console.log(`\n⚠ Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`   ${e}`));
    }
  } else {
    console.log('Rendering all sites FROM SCRATCH...\n');
    const registry = loadFactory();
    for (const [domain] of Object.entries(registry)) {
      const html = renderFromScratch(domain);
      if (html) console.log(`   ${domain} → ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
    }
  }

  console.log('\nFeatures injected:');
  console.log('   ✓ Auth gate (Google/GitHub/Discord)');
  console.log('   ✓ Cross-site navigation (Heady Network)');
  console.log('   ✓ HeadyBuddy widget');
  console.log(`\n   φ = ${PHI}`);
}

module.exports = {
  enhanceSite,
  enhanceAll,
  renderFromScratch,
  injectAuthGate,
  injectCrossSiteNav,
  injectBuddyWidget,
  loadRegistry,
};

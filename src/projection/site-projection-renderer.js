/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Site Projection Renderer ═══════════════════════════════════════════
 *
 * Premium HTML generator — takes site config from the latent space
 * (site-registry.json) and produces full, standalone, branded HTML pages.
 *
 * Source of truth: RAM / vector space → site-registry.json
 * Output: Development projections (services/heady-web/sites/*)
 *         + HF Space projections + Cloudflare KV projections
 *
 * Each site gets:
 *  - Full <head> with meta, OG tags, Google Fonts, inline CSS design system
 *  - Animated hero with sacred geometry canvas
 *  - Feature cards, stats, sections based on config
 *  - Glassmorphic nav with responsive hamburger
 *  - Branded footer with cross-domain links
 *  - Sacred geometry SVG logo per vertical
 *  - Scroll animations, micro-interactions
 *  - Auth gate integration
 *
 * This is the ONLY file that produces HTML for Heady sites.
 * Do not hand-edit HTML files in services/heady-web/sites/.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SITES_DIR = path.join(PROJECT_ROOT, 'services/heady-web/sites');

// ── Sacred Geometry SVG Generators ─────────────────────────────────
const SACRED_SVGS = {
  'Flower of Life': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="10" stroke="${accent}" stroke-width="0.8" fill="none" opacity="0.4"/>
    <circle cx="16" cy="10" r="6" stroke="${accent}" stroke-width="0.5" fill="none" opacity="0.3"/>
    <circle cx="16" cy="22" r="6" stroke="${accent}" stroke-width="0.5" fill="none" opacity="0.3"/>
    <circle cx="10.8" cy="13" r="6" stroke="${accent}" stroke-width="0.5" fill="none" opacity="0.3"/>
    <circle cx="21.2" cy="13" r="6" stroke="${accent}" stroke-width="0.5" fill="none" opacity="0.3"/>
    <circle cx="16" cy="16" r="2.5" fill="${accent}" opacity="0.7"/>
  </svg>`,

  'Metatrons Cube': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="20" height="20" rx="3" stroke="${accent}" stroke-width="1.5" fill="none" transform="rotate(45 16 16)"/>
    <rect x="9" y="9" width="14" height="14" rx="2" stroke="${accent}" stroke-width="0.7" fill="${accent}08" transform="rotate(45 16 16)"/>
    <circle cx="16" cy="16" r="2.5" fill="${accent}"/>
  </svg>`,

  'Sri Yantra': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polygon points="16,2 30,26 2,26" stroke="${accent}" stroke-width="1.5" fill="${accent}08"/>
    <polygon points="16,8 25,23 7,23" stroke="${accent}" stroke-width="1" fill="${accent}06"/>
    <circle cx="16" cy="17" r="3" fill="${accent}" opacity="0.8"/>
    <line x1="16" y1="2" x2="16" y2="30" stroke="${accent}" stroke-width="0.5" opacity="0.3"/>
  </svg>`,

  'Torus': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <ellipse cx="16" cy="16" rx="13" ry="8" stroke="${accent}" stroke-width="1" fill="none" opacity="0.4"/>
    <ellipse cx="16" cy="16" rx="8" ry="13" stroke="${accent}" stroke-width="0.7" fill="none" opacity="0.3"/>
    <circle cx="16" cy="16" r="4" stroke="${accent}" stroke-width="1.2" fill="${accent}15"/>
    <circle cx="16" cy="16" r="2" fill="${accent}"/>
  </svg>`,

  'Seed of Life': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="7" stroke="${accent}" stroke-width="1" fill="none" opacity="0.5"/>
    <circle cx="16" cy="10" r="5" stroke="${accent}" stroke-width="0.7" fill="none" opacity="0.3"/>
    <circle cx="11" cy="19" r="5" stroke="${accent}" stroke-width="0.7" fill="none" opacity="0.3"/>
    <circle cx="21" cy="19" r="5" stroke="${accent}" stroke-width="0.7" fill="none" opacity="0.3"/>
    <circle cx="16" cy="16" r="2" fill="${accent}" opacity="0.8"/>
  </svg>`,

  'Vesica Piscis': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="12" cy="16" r="9" stroke="${accent}" stroke-width="1" fill="none" opacity="0.4"/>
    <circle cx="20" cy="16" r="9" stroke="${accent}" stroke-width="1" fill="none" opacity="0.4"/>
    <ellipse cx="16" cy="16" rx="4" ry="8" fill="${accent}15" stroke="${accent}" stroke-width="0.5"/>
    <circle cx="16" cy="16" r="2" fill="${accent}"/>
  </svg>`,

  'Fibonacci Spiral': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 28 A12 12 0 0 1 4 16 A8 8 0 0 1 12 8 A5 5 0 0 1 17 13 A3 3 0 0 1 14 16 A2 2 0 0 1 16 18" stroke="${accent}" stroke-width="1.5" fill="none" opacity="0.5"/>
    <circle cx="16" cy="16" r="2" fill="${accent}" opacity="0.8"/>
  </svg>`,

  'Icosahedron': (accent) => `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polygon points="16,3 28,11 28,21 16,29 4,21 4,11" stroke="${accent}" stroke-width="1" fill="none" opacity="0.4"/>
    <polygon points="16,8 23,13 23,19 16,24 9,19 9,13" stroke="${accent}" stroke-width="0.7" fill="${accent}08"/>
    <circle cx="16" cy="16" r="2.5" fill="${accent}"/>
  </svg>`,
};

function getLogoSVG(sacredGeometry, accent) {
  const gen = SACRED_SVGS[sacredGeometry] || SACRED_SVGS['Flower of Life'];
  return gen(accent);
}

// ── CSS Design System Generator ─────────────────────────────────────
function generateCSS(site) {
  const { accent, accentDark, accentGlow } = site;
  const secondary = site.accentSecondary || accent;
  return `
    /* ═══ AUTO-GENERATED Design Tokens — Source: site-registry.json ═══ */
    :root {
      --phi: 1.6180339887;
      --phi-inv: 0.6180339887;
      --bg-base:    #0a0e17;
      --bg-surface: #0d1221;
      --bg-card:    #111827;
      --bg-glass:   rgba(13, 18, 33, 0.72);
      --border:     rgba(255,255,255,0.08);
      --border-glow: ${accentGlow || `${accent}30`};
      --accent:       ${accent};
      --accent-dark:  ${accentDark || accent};
      --accent-glow:  ${accentGlow || `${accent}15`};
      --secondary:    ${secondary};
      --text-primary:   #f0f4ff;
      --text-secondary: #8b98b8;
      --text-muted:     #4a5568;
      --font-display: 'Outfit', sans-serif;
      --font-body:    'Inter', sans-serif;
      --font-mono:    'Berkeley Mono', 'Fira Code', monospace;
      --sp-1:4px; --sp-2:8px; --sp-3:13px; --sp-4:21px;
      --sp-5:34px; --sp-6:55px; --sp-7:89px; --sp-8:144px;
      --radius-sm:8px; --radius-md:13px; --radius-lg:21px;
      --transition: 0.3s cubic-bezier(0.4,0,0.2,1);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; font-size: 16px; }
    body {
      background: var(--bg-base); color: var(--text-primary);
      font-family: var(--font-body); line-height: 1.618;
      overflow-x: hidden; -webkit-font-smoothing: antialiased;
    }
    ::selection { background: var(--accent-glow); color: var(--accent); }
    a { color: inherit; text-decoration: none; transition: color var(--transition); }
    a:hover { color: var(--accent); }

    /* ── Skip Link ── */
    .skip-link {
      position: absolute; top: -40px; left: 0;
      background: var(--accent); color: var(--bg-base);
      padding: 8px 21px; font-weight: 600; z-index: 1000;
      transition: top 0.2s; border-radius: 0 0 8px 0;
    }
    .skip-link:focus { top: 0; }

    /* ── Navigation ── */
    .nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      padding: var(--sp-4) var(--sp-5);
      display: flex; align-items: center; justify-content: space-between;
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      background: rgba(10,14,23,0.8);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      display: flex; align-items: center; gap: var(--sp-3);
      font-family: var(--font-display); font-weight: 700;
      font-size: 1.15rem; color: var(--text-primary); text-decoration: none;
    }
    .nav-logo svg { width: 32px; height: 32px; }
    .nav-links { display: flex; align-items: center; gap: var(--sp-5); list-style: none; }
    .nav-links a {
      font-size: 0.88rem; font-weight: 500; color: var(--text-secondary);
      transition: color var(--transition); text-decoration: none;
    }
    .nav-links a:hover { color: var(--text-primary); }
    .nav-cta {
      background: var(--accent); color: var(--bg-base) !important;
      padding: 8px 20px; border-radius: 8px; font-weight: 600; font-size: 0.85rem;
    }
    .nav-cta:hover { opacity: 0.9; transform: translateY(-1px); color: var(--bg-base) !important; }
    .hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
    .hamburger span {
      display: block; width: 22px; height: 2px; background: var(--text-primary);
      margin: 5px 0; border-radius: 2px; transition: all 0.3s;
    }

    /* ── Hero ── */
    .hero {
      position: relative; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden; padding: var(--sp-8) var(--sp-5) var(--sp-7);
    }
    #heroCanvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 0;
    }
    .hero-content {
      position: relative; z-index: 2;
      text-align: center; max-width: 900px; padding: 0 var(--sp-5);
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--accent-glow); border: 1px solid var(--border-glow);
      color: var(--accent); padding: 6px 16px; border-radius: 100px;
      font-size: 0.8rem; font-weight: 600; letter-spacing: 0.05em;
      text-transform: uppercase; margin-bottom: var(--sp-5);
    }
    .hero-badge::before {
      content: ''; width: 6px; height: 6px; background: var(--accent);
      border-radius: 50%; animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.5); }
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(2.4rem, 6vw, 4.5rem);
      font-weight: 800; line-height: 1.08; letter-spacing: -0.03em;
      margin-bottom: var(--sp-4);
      background: linear-gradient(135deg, #fff 0%, var(--accent) 60%, ${accentDark || accent} 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-title .accent { -webkit-text-fill-color: var(--accent); }
    .hero-title .accent-gold { -webkit-text-fill-color: #f5c842; }
    .hero-subtitle {
      font-size: clamp(1rem, 2vw, 1.25rem); color: var(--text-secondary);
      max-width: 680px; margin: 0 auto var(--sp-6); line-height: 1.618;
    }
    .hero-actions { display: flex; gap: var(--sp-4); justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--accent); color: var(--bg-base); padding: 14px 32px;
      border-radius: 10px; font-weight: 700; font-size: 1rem;
      border: none; cursor: pointer; transition: all var(--transition);
      text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 8px 30px var(--accent-glow); color: var(--bg-base); }
    .btn-outline {
      background: transparent; color: var(--text-primary); padding: 14px 32px;
      border-radius: 10px; font-weight: 600; font-size: 1rem;
      border: 1px solid var(--border); cursor: pointer; transition: all var(--transition);
      text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-outline:hover { background: rgba(255,255,255,0.04); border-color: var(--accent); color: var(--accent); }
    .hero-stats {
      display: flex; gap: var(--sp-6); justify-content: center;
      margin-top: var(--sp-7); padding-top: var(--sp-5);
      border-top: 1px solid var(--border); flex-wrap: wrap;
    }
    .hero-stat { text-align: center; }
    .hero-stat .num { font-size: 1.8rem; font-weight: 800; color: var(--accent); letter-spacing: -0.02em; font-family: var(--font-display); }
    .hero-stat .lbl { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

    /* ── Sections ── */
    section { padding: var(--sp-8) var(--sp-5); }
    .container { max-width: 1200px; margin: 0 auto; }
    .section-header { text-align: center; margin-bottom: var(--sp-7); }
    .section-label {
      display: inline-block; font-size: 0.75rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--accent); margin-bottom: var(--sp-3);
    }
    .section-title {
      font-family: var(--font-display);
      font-size: clamp(1.6rem, 3vw, 2.4rem);
      font-weight: 700; letter-spacing: -0.02em;
      margin-bottom: var(--sp-4); line-height: 1.2;
    }
    .section-desc { font-size: 1.05rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto; line-height: 1.618; }

    /* ── Feature Cards ── */
    .features-section { background: var(--bg-surface); }
    .features-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--sp-4);
    }
    .feature-card {
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: var(--sp-6);
      backdrop-filter: blur(16px); transition: all 0.3s ease;
      position: relative; overflow: hidden;
    }
    .feature-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--secondary));
      opacity: 0; transition: opacity var(--transition);
    }
    .feature-card:hover {
      border-color: var(--border-glow); transform: translateY(-4px);
      box-shadow: 0 20px 60px ${accentGlow || 'rgba(0,0,0,0.3)'};
    }
    .feature-card:hover::before { opacity: 1; }
    .feature-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: var(--accent-glow); border: 1px solid var(--border-glow);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: var(--sp-4); font-size: 1.4rem;
    }
    .feature-card h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: var(--sp-2); color: var(--text-primary); }
    .feature-card p { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; }

    /* ── Stats ── */
    .stats-bar {
      display: flex; gap: var(--sp-5); justify-content: center; flex-wrap: wrap;
      padding: var(--sp-6) 0;
    }
    .stat-card {
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: var(--sp-5) var(--sp-6);
      text-align: center; min-width: 150px; backdrop-filter: blur(12px);
    }
    .stat-card .num { font-size: 2rem; font-weight: 800; color: var(--accent); font-family: var(--font-display); }
    .stat-card .lbl { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }

    /* ── CTA Section ── */
    .cta-section {
      text-align: center; padding: var(--sp-8) var(--sp-5);
      background: linear-gradient(135deg, var(--accent-glow) 0%, var(--bg-base) 50%, rgba(255,255,255,0.02) 100%);
    }

    /* ── Footer ── */
    footer {
      background: var(--bg-surface); border-top: 1px solid var(--border);
      padding: var(--sp-7) var(--sp-5) var(--sp-5);
    }
    .footer-grid {
      display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: var(--sp-6);
      max-width: 1200px; margin: 0 auto var(--sp-7);
    }
    .footer-brand p { font-size: 0.88rem; color: var(--text-muted); margin-top: var(--sp-3); max-width: 280px; line-height: 1.618; }
    .footer-col h5 { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: var(--sp-4); }
    .footer-col ul { list-style: none; }
    .footer-col ul li { margin-bottom: var(--sp-2); }
    .footer-col ul li a { font-size: 0.88rem; color: var(--text-secondary); }
    .footer-col ul li a:hover { color: var(--accent); }
    .footer-bottom {
      max-width: 1200px; margin: 0 auto;
      border-top: 1px solid var(--border); padding-top: var(--sp-5);
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: var(--sp-3);
    }
    .footer-bottom p { font-size: 0.75rem; color: var(--text-muted); }
    .footer-bottom a { color: var(--accent); font-size: 0.75rem; }

    /* ── Animations ── */
    .fade-up { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .fade-up.visible { opacity: 1; transform: translateY(0); }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .nav-links.open {
        display: flex; flex-direction: column; position: absolute;
        top: 100%; left: 0; right: 0; background: var(--bg-surface);
        padding: var(--sp-4); border-bottom: 1px solid var(--border); gap: var(--sp-4);
      }
      .hamburger { display: block; }
      .features-grid { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr 1fr; }
      .hero-stats { gap: var(--sp-4); }
      .hero-actions { flex-direction: column; align-items: center; }
    }
    @media (max-width: 480px) {
      .footer-grid { grid-template-columns: 1fr; }
      .stats-bar { gap: var(--sp-3); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
  `;
}

// ── HTML Section Generators ─────────────────────────────────────────
function renderNav(site) {
  const logo = getLogoSVG(site.sacredGeometry, site.accent);
  const links = (site.navLinks || []).map(l =>
    l.cta
      ? `<li><a href="${l.href}" class="nav-cta">${l.label}</a></li>`
      : `<li><a href="${l.href}">${l.label}</a></li>`
  ).join('');

  return `
  <nav class="nav" role="navigation" aria-label="Main navigation">
    <a href="/" class="nav-logo" aria-label="${site.name} Home">${logo}<span>${site.name}</span></a>
    <ul class="nav-links" id="navLinks" role="list">${links}</ul>
    <button class="hamburger" id="hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks">
      <span></span><span></span><span></span>
    </button>
  </nav>`;
}

function renderHero(site) {
  return `
  <section class="hero" id="hero" aria-label="Hero">
    <canvas id="heroCanvas" aria-hidden="true"></canvas>
    <div class="hero-content">
      <div class="hero-badge">${site.name} — ${site.vertical || 'Platform'}</div>
      <h1 class="hero-title">${site.heroTitle || site.name}</h1>
      <p class="hero-subtitle">${site.heroSubtitle || site.tagline}</p>
      <div class="hero-actions">
        <a href="${(site.navLinks || [])[0]?.href || '#'}" class="btn-primary">Explore →</a>
        <a href="${site.navLinks?.find(l => l.cta)?.href || '#'}" class="btn-outline">Learn More</a>
      </div>
      ${renderHeroStats(site)}
    </div>
  </section>`;
}

function renderHeroStats(site) {
  if (!site.stats?.length) return '';
  const items = site.stats.map(s => `<div class="hero-stat"><div class="num">${s.value}</div><div class="lbl">${s.label}</div></div>`).join('');
  return `<div class="hero-stats">${items}</div>`;
}

function renderFeatures(site, section) {
  const cards = (site.features || []).map(f => `
    <div class="feature-card fade-up">
      <div class="feature-icon" aria-hidden="true">${f.icon}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </div>`).join('');

  return `
  <section class="features-section" id="features" aria-labelledby="features-heading">
    <div class="container">
      <div class="section-header fade-up">
        <span class="section-label">${site.name}</span>
        <h2 id="features-heading" class="section-title">${section?.heading || 'Core Capabilities'}</h2>
        <p class="section-desc">${section?.subheading || ''}</p>
      </div>
      <div class="features-grid">${cards}</div>
    </div>
  </section>`;
}

function renderStats(site, section) {
  if (!site.stats?.length) return '';
  const items = site.stats.map(s => `<div class="stat-card fade-up"><div class="num">${s.value}</div><div class="lbl">${s.label}</div></div>`).join('');

  return `
  <section id="stats" aria-labelledby="stats-heading">
    <div class="container">
      <div class="section-header fade-up">
        <span class="section-label">Metrics</span>
        <h2 id="stats-heading" class="section-title">${section?.heading || 'By the Numbers'}</h2>
      </div>
      <div class="stats-bar">${items}</div>
    </div>
  </section>`;
}

function renderCTA(site, section) {
  return `
  <section class="cta-section" id="cta" aria-labelledby="cta-heading">
    <div class="container">
      <div class="section-header fade-up">
        <h2 id="cta-heading" class="section-title">${section?.heading || 'Get Started'}</h2>
        <p class="section-desc">${section?.subheading || ''}</p>
      </div>
      <div class="hero-actions" style="margin-top:var(--sp-5)">
        <a href="${site.navLinks?.find(l => l.cta)?.href || '#'}" class="btn-primary">Get Started →</a>
      </div>
    </div>
  </section>`;
}

function renderFooter(site) {
  const year = new Date().getFullYear();
  const logo = getLogoSVG(site.sacredGeometry, site.accent);
  const cols = (site.footerCols || []).map(col => {
    const links = col.links.map(([label, href]) =>
      `<li><a href="${href}">${label}</a></li>`
    ).join('');
    return `<div class="footer-col"><h5>${col.title}</h5><ul>${links}</ul></div>`;
  }).join('');

  return `
  <footer role="contentinfo">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo" style="margin-bottom:12px;display:inline-flex" aria-label="${site.name}">
          ${logo}<span style="margin-left:8px">${site.name}</span>
        </a>
        <p>${site.description}</p>
        <p style="margin-top:12px;font-size:0.78rem;color:var(--text-muted)">Founder: Eric Haywood · ${site.stats?.find(s => s.label === 'Patents')?.value || '51+'} Patents</p>
      </div>
      ${cols}
    </div>
    <div class="footer-bottom">
      <p>© ${year} HeadySystems Inc. All rights reserved. Patent Pending.</p>
      <a href="https://headysystems.com" target="_blank" rel="noopener">HeadySystems Platform</a>
    </div>
  </footer>`;
}

// ── Canvas Animation Script ─────────────────────────────────────────
function renderCanvasScript(site) {
  return `
  <script>
  (function() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], frame = 0;
    const PHI = 1.618033988749895;
    const ACCENT = '${site.accent}';
    function hexToRgb(h) { const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); return [r,g,b]; }
    const [ar,ag,ab] = hexToRgb(ACCENT);

    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    class Node {
      constructor() { this.reset(); }
      reset() {
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 60 + Math.random() * Math.min(W||800, H||600) * 0.38;
        this.speed = (0.0003 + Math.random() * 0.0005) * (Math.random() > 0.5 ? 1 : -1);
        this.size = 1.5 + Math.random() * 3;
        this.opacity = 0.3 + Math.random() * 0.5;
        this.phiOrbit = Math.random() > 0.5;
      }
      update() {
        this.angle += this.speed;
        const cx = W/2, cy = H/2;
        this.x = cx + Math.cos(this.angle) * this.radius * (this.phiOrbit ? 1 : 1/PHI);
        this.y = cy + Math.sin(this.angle) * this.radius * (this.phiOrbit ? 1/PHI : 1);
      }
      draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fillStyle = 'rgba('+ar+','+ag+','+ab+','+this.opacity+')'; ctx.fill();
      }
    }
    function init() { particles = []; for (let i=0;i<60;i++) particles.push(new Node()); }
    function drawConnections() {
      for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) {
        const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<120) { ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y);
          ctx.lineTo(particles[j].x,particles[j].y);
          ctx.strokeStyle='rgba('+ar+','+ag+','+ab+','+(0.12*(1-dist/120))+')';
          ctx.lineWidth=0.5; ctx.stroke(); }
      }
    }
    function drawGeometry() {
      const n=6, r=Math.min(W,H)*0.3;
      ctx.save(); ctx.translate(W/2,H/2);
      for (let i=0;i<n;i++) {
        const a1=(i/n)*Math.PI*2+frame*0.0002, a2=((i+1)/n)*Math.PI*2+frame*0.0002;
        ctx.beginPath(); ctx.moveTo(Math.cos(a1)*r,Math.sin(a1)*r);
        ctx.lineTo(Math.cos(a2)*r,Math.sin(a2)*r);
        ctx.strokeStyle='rgba('+ar+','+ag+','+ab+',0.06)'; ctx.lineWidth=1; ctx.stroke();
      }
      const r2=r/PHI;
      for (let i=0;i<n;i++) {
        const a1=(i/n)*Math.PI*2-frame*0.0003, a2=((i+1)/n)*Math.PI*2-frame*0.0003;
        ctx.beginPath(); ctx.moveTo(Math.cos(a1)*r2,Math.sin(a1)*r2);
        ctx.lineTo(Math.cos(a2)*r2,Math.sin(a2)*r2);
        ctx.strokeStyle='rgba('+ar+','+ag+','+ab+',0.04)'; ctx.stroke();
      }
      ctx.restore();
    }
    function animate() {
      ctx.clearRect(0,0,W,H); frame++;
      drawGeometry(); particles.forEach(p=>{p.update();p.draw()}); drawConnections();
      requestAnimationFrame(animate);
    }
    window.addEventListener('resize', resize);
    resize(); init(); animate();
  })();
  </script>`;
}

// ── Interaction Scripts ─────────────────────────────────────────────
function renderInteractionScripts() {
  return `
  <script>
  // Hamburger menu
  (function(){
    const btn = document.getElementById('hamburger');
    const nav = document.getElementById('navLinks');
    if (btn && nav) btn.addEventListener('click', function() {
      nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  })();
  // Scroll fade-up
  (function(){
    const obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }});
    }, { threshold: 0.15 });
    document.querySelectorAll('.fade-up').forEach(function(el) { obs.observe(el); });
  })();
  </script>`;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN RENDERER — Assembles a full HTML page from site config
// ══════════════════════════════════════════════════════════════════════
function renderSiteToHTML(siteConfig, domain) {
  const year = new Date().getFullYear();
  const canonicalDomain = domain || siteConfig.slug?.replace(/-/g, '.') || 'headysystems.com';
  const sections = (siteConfig.sections || []).map(s => {
    switch (s.type) {
      case 'features': return renderFeatures(siteConfig, s);
      case 'stats': return renderStats(siteConfig, s);
      case 'cta': return renderCTA(siteConfig, s);
      default: return renderFeatures(siteConfig, s);
    }
  }).join('\n');

  return `<!-- AUTO-GENERATED by site-projection-renderer — do not edit manually.
     Source of truth: src/sites/site-registry.json (latent space)
     Generated: ${new Date().toISOString()}
     Sacred Geometry: ${siteConfig.sacredGeometry}
     © ${year} HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL. -->
<!DOCTYPE html>
<html lang="en" data-heady-site="${siteConfig.slug}" data-vertical="${siteConfig.vertical || 'platform'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteConfig.name} — ${siteConfig.tagline}</title>
  <meta name="description" content="${siteConfig.description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://${canonicalDomain}/">

  <!-- OpenGraph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${siteConfig.name} — ${siteConfig.tagline}">
  <meta property="og:description" content="${siteConfig.description}">
  <meta property="og:site_name" content="${siteConfig.name}">

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${siteConfig.name} — ${siteConfig.tagline}">
  <meta name="twitter:description" content="${siteConfig.description}">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "${siteConfig.name}",
    "description": "${siteConfig.description}",
    "applicationCategory": "ArtificialIntelligenceApplication",
    "operatingSystem": "Web",
    "creator": {
      "@type": "Organization",
      "name": "HeadySystems Inc.",
      "founder": {"@type": "Person", "name": "Eric Haywood"},
      "url": "https://headysystems.com"
    }
  }
  </script>

  <style>${generateCSS(siteConfig)}</style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  ${renderNav(siteConfig)}
  <main id="main-content">
    ${renderHero(siteConfig)}
    ${sections}
  </main>
  ${renderFooter(siteConfig)}
  ${renderCanvasScript(siteConfig)}
  ${renderInteractionScripts()}
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════
// PROJECTION API — Used by sync-projection-bee and project-sites CLI
// ══════════════════════════════════════════════════════════════════════

/**
 * Render all sites from the registry and return as a map.
 * @returns {Object<string, {slug: string, html: string, bytes: number}>}
 */
function renderAllSites() {
  const registry = require('../sites/site-registry.json');
  const sites = registry.preconfiguredSites || registry.preconfigured || {};
  const results = {};

  for (const [domain, config] of Object.entries(sites)) {
    try {
      const html = renderSiteToHTML(config);
      results[domain] = {
        slug: config.slug || domain.replace(/\./g, '-'),
        html,
        bytes: Buffer.byteLength(html, 'utf8'),
        sacredGeometry: config.sacredGeometry,
        accent: config.accent,
      };
    } catch (e) {
      results[domain] = { slug: config.slug || domain, html: null, error: e.message };
    }
  }
  return results;
}

/**
 * Project all rendered sites to the dev folder.
 * @returns {{ projected: string[], errors: string[] }}
 */
function projectToDevFolder() {
  const rendered = renderAllSites();
  const projected = [];
  const errors = [];

  for (const [domain, result] of Object.entries(rendered)) {
    if (!result.html) {
      errors.push(`${domain}: ${result.error}`);
      continue;
    }
    const siteDir = path.join(SITES_DIR, result.slug);
    if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir, { recursive: true });

    const indexPath = path.join(siteDir, 'index.html');
    fs.writeFileSync(indexPath, result.html, 'utf8');
    projected.push(`${result.slug}/index.html (${result.bytes} bytes, ${result.sacredGeometry})`);
  }

  return { projected, errors };
}

module.exports = {
  renderSiteToHTML,
  renderAllSites,
  projectToDevFolder,
  getLogoSVG,
  generateCSS,
  SACRED_SVGS,
};

/**
 * HeadySystems Brand Kit — v1.0
 * Shared brand components injected across all Heady sites
 * 
 * Usage: <script src="../design-system/brand.js"></script>
 *        Then call HeadyBrand.init({ site: 'headyme', vertical: 'headyme' });
 */

const HeadyBrand = (() => {
    // ── Sacred Geometry Logo SVG ──────────────────────────────────────
    const LOGO_SVG = `
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="heady-logo-svg">
      <!-- Outer golden circle -->
      <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
      <!-- Inner phi spiral path -->
      <path d="M24 2 C37.2 2 46 10.8 46 24 C46 32.4 41.6 39.6 35 43.6 
               C28.4 47.6 20.4 47.6 13.8 43.6 
               C7.2 39.6 2 32.4 2 24 
               C2 15.6 7.2 8.4 13.8 4.4" 
            stroke="url(#heady-grad)" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Central H mark -->
      <path d="M16 15 L16 33 M16 24 L32 24 M32 15 L32 33" 
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Phi ratio dot -->
      <circle cx="24" cy="14.8" r="2" fill="url(#heady-grad)"/>
      <defs>
        <linearGradient id="heady-grad" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stop-color="var(--color-accent-teal-light, #2dd4bf)"/>
          <stop offset="61.8%" stop-color="var(--color-accent, #20808d)"/>
          <stop offset="100%" stop-color="var(--color-accent-gold-light, #fbbf24)"/>
        </linearGradient>
      </defs>
    </svg>`;

    // ── Site configurations ───────────────────────────────────────────
    const SITES = {
        headyme: { name: 'HeadyMe', tagline: 'Your AI Operating System', domain: 'headyme.com', accent: 'teal', vertical: 'headyme' },
        headyos: { name: 'HeadyOS', tagline: 'The Latent Operating System', domain: 'headyos.com', accent: 'violet', vertical: 'headyos' },
        heady-ai: { name: 'HeadyAI', tagline: 'Intelligence Without Limits', domain: 'heady-ai.com', accent: 'violet', vertical: 'ai' },
        headysystems: { name: 'HeadySystems', tagline: 'Enterprise AI Infrastructure', domain: 'headysystems.com', accent: 'gold', vertical: 'enterprise' },
        'headyconnection-com': { name: 'HeadyConnection', tagline: 'AI-Powered Human Connection', domain: 'headyconnection.com', accent: 'teal', vertical: 'community' },
        'headyconnection-org': { name: 'HeadyConnection.org', tagline: 'Open Source AI Community', domain: 'headyconnection.org', accent: 'teal', vertical: 'community' },
        'headyex': { name: 'HeadyEX', tagline: 'AI-Driven Market Intelligence', domain: 'headyex.com', accent: 'gold', vertical: 'finance' },
        'headyfinance': { name: 'HeadyFinance', tagline: 'Intelligent Wealth Management', domain: 'headyfinance.com', accent: 'gold', vertical: 'investments' },
        'admin-portal': { name: 'Heady Admin', tagline: 'System Control Plane', domain: 'admin.headyme.com', accent: 'teal', vertical: 'headyme' },
    };

    const NAV_LINKS = [
        { label: 'Platform', href: 'https://headyos.com' },
        { label: 'AI', href: 'https://heady-ai.com' },
        { label: 'Enterprise', href: 'https://headysystems.com' },
        { label: 'Community', href: 'https://headyconnection.com' },
        { label: 'Invest', href: 'https://headyfinance.com' },
    ];

    // ── Brand initialization ──────────────────────────────────────────
    function init(opts = {}) {
        const siteKey = opts.site || 'headyme';
        const config = SITES[siteKey] || SITES.headyme;

        // Set data-vertical attribute for design token overrides
        document.documentElement.setAttribute('data-vertical', config.vertical);
        document.body.setAttribute('data-vertical', config.vertical);

        // Remove all Perplexity attributions
        removePerplexityBranding();

        // Inject brand meta tags
        injectBrandMeta(config);

        // Update page branding
        updateNavBranding(config);
        updateFooterBranding(config);

        // Add sacred geometry background
        injectSacredGeometryBg();

        // Add favicon
        injectFavicon(config);

        console.log(`[HeadyBrand] ${config.name} initialized — ${config.domain}`);
    }

    function removePerplexityBranding() {
        // Remove Perplexity comments
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        const toRemove = [];
        while (walker.nextNode()) {
            if (walker.currentNode.textContent.toLowerCase().includes('perplexity')) {
                toRemove.push(walker.currentNode);
            }
        }
        toRemove.forEach(n => n.parentNode.removeChild(n));

        // Remove Perplexity meta tags
        document.querySelectorAll('meta[content*="Perplexity"], meta[content*="perplexity"], link[href*="perplexity"]').forEach(el => el.remove());
    }

    function injectBrandMeta(config) {
        // Update generator meta
        let gen = document.querySelector('meta[name="generator"]');
        if (!gen) {
            gen = document.createElement('meta');
            gen.name = 'generator';
            document.head.appendChild(gen);
        }
        gen.content = 'HeadySystems Platform v4.0';

        // Update author meta
        let author = document.querySelector('meta[name="author"]');
        if (!author) {
            author = document.createElement('meta');
            author.name = 'author';
            document.head.appendChild(author);
        }
        author.content = 'HeadySystems Inc. — Eric Haywood';

        // Update OG site_name
        let ogSite = document.querySelector('meta[property="og:site_name"]');
        if (ogSite) ogSite.content = config.name;
    }

    function updateNavBranding(config) {
        // Find nav logo and update
        const navLogo = document.querySelector('.nav-logo, .navbar-brand, [class*="logo"]');
        if (navLogo) {
            const logoHTML = `${LOGO_SVG}<span class="heady-brand-name">${config.name}</span>`;
            navLogo.innerHTML = logoHTML;
        }
    }

    function updateFooterBranding(config) {
        // Find footer brand section and update
        const footerBrand = document.querySelector('.footer-brand, footer [class*="brand"]');
        if (footerBrand) {
            const year = new Date().getFullYear();
            footerBrand.innerHTML = `
        <div class="heady-footer-brand">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:13px;">
            ${LOGO_SVG}
            <span style="font-family:var(--font-display);font-weight:700;font-size:1.25rem;">${config.name}</span>
          </div>
          <p style="font-size:0.875rem;color:var(--text-secondary,rgba(255,255,255,0.65));line-height:1.618;max-width:280px;">
            ${config.tagline}. Built by HeadySystems Inc.
          </p>
          <p style="font-size:0.75rem;color:var(--text-muted,rgba(255,255,255,0.38));margin-top:8px;">
            © ${year} HeadySystems Inc. All rights reserved.
          </p>
          <p style="font-size:0.625rem;color:var(--text-muted,rgba(255,255,255,0.25));margin-top:5px;">
            51+ patents pending · Sacred Geometry Architecture · φ-derived design
          </p>
        </div>`;
        }

        // Update any copyright text in footer
        document.querySelectorAll('footer p, .footer-bottom p').forEach(p => {
            if (p.textContent.includes('Perplexity') || p.textContent.includes('perplexity')) {
                p.textContent = p.textContent.replace(/Perplexity\s*Computer/gi, 'HeadySystems Inc.');
            }
        });
    }

    function injectSacredGeometryBg() {
        if (document.querySelector('.heady-sacred-bg')) return;
        const bg = document.createElement('div');
        bg.className = 'heady-sacred-bg';
        bg.setAttribute('aria-hidden', 'true');
        bg.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: -1; pointer-events: none; opacity: 0.03;
      background-image: conic-gradient(from 0deg at 50% 50%,
        rgba(255,255,255,0.04) 0deg, transparent 60deg,
        rgba(255,255,255,0.03) 120deg, transparent 180deg,
        rgba(255,255,255,0.04) 240deg, transparent 300deg,
        rgba(255,255,255,0.04) 360deg);
    `;
        document.body.prepend(bg);
    }

    function injectFavicon(config) {
        // Create a simple SVG favicon
        const accentColor = config.accent === 'gold' ? '#fbbf24' :
            config.accent === 'violet' ? '#8b5cf6' : '#2dd4bf';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${accentColor}" opacity="0.15"/>
      <path d="M10 9L10 23M10 16L22 16M22 9L22 23" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;

        let link = document.querySelector('link[rel="icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
        link.type = 'image/svg+xml';
    }

    // ── Public API ────────────────────────────────────────────────────
    return { init, LOGO_SVG, SITES, NAV_LINKS, removePerplexityBranding };
})();

// Auto-init if data attribute present
document.addEventListener('DOMContentLoaded', () => {
    const siteAttr = document.documentElement.getAttribute('data-heady-site') ||
        document.body.getAttribute('data-heady-site');
    if (siteAttr) HeadyBrand.init({ site: siteAttr });
});

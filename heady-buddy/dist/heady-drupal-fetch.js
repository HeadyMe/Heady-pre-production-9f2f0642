/**
 * HeadyDrupalFetch — Lightweight CMS Content Hydration
 * 
 * Include on any Heady site to pull content from Drupal 11 JSON:API.
 * Usage: <script src="heady-drupal-fetch.js" data-site="headysystems" data-drupal="https://cms.headysystems.com"></script>
 * 
 * DOM elements with data-drupal-section="hero" will be hydrated with
 * matching site_page content from Drupal.
 */
(function () {
    'use strict';

    const script = document.currentScript;
    const SITE = script?.getAttribute('data-site') || 'headysystems';
    const DRUPAL_BASE = script?.getAttribute('data-drupal') || 'https://cms.headysystems.com';
    const JSONAPI = `${DRUPAL_BASE}/jsonapi`;

    // Cache responses for 5 minutes
    const CACHE_KEY = `heady_drupal_${SITE}`;
    const CACHE_TTL = 5 * 60 * 1000;

    /**
     * Fetch site_page nodes filtered by site taxonomy.
     */
    async function fetchSitePages() {
        // Check cache
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, ts } = JSON.parse(cached);
            if (Date.now() - ts < CACHE_TTL) return data;
        }

        try {
            // JSON:API filter by taxonomy term name
            const url = `${JSONAPI}/node/site_page?filter[field_site.name]=${encodeURIComponent(SITE)}&sort=field_sort_order&include=field_site`;
            const resp = await fetch(url, {
                headers: { 'Accept': 'application/vnd.api+json' },
                signal: AbortSignal.timeout(8000)
            });

            if (!resp.ok) return null;

            const json = await resp.json();
            const pages = (json.data || []).map(node => ({
                id: node.id,
                section: node.attributes?.field_section,
                heading: node.attributes?.field_heading,
                body: node.attributes?.body?.processed || node.attributes?.body?.value || '',
                ctaText: node.attributes?.field_cta_text,
                ctaUrl: node.attributes?.field_cta_url?.uri,
                icon: node.attributes?.field_icon,
                sortOrder: node.attributes?.field_sort_order || 0,
            }));

            // Cache the result
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: pages, ts: Date.now() }));
            return pages;
        } catch (e) {
            console.warn('[HeadyDrupalFetch] Failed to load CMS content:', e.message);
            return null;
        }
    }

    /**
     * Fetch AI capabilities for this site.
     */
    async function fetchAICapabilities() {
        try {
            const url = `${JSONAPI}/node/ai_capability?filter[field_site.name]=${encodeURIComponent(SITE)}&include=field_site`;
            const resp = await fetch(url, {
                headers: { 'Accept': 'application/vnd.api+json' },
                signal: AbortSignal.timeout(8000)
            });

            if (!resp.ok) return [];

            const json = await resp.json();
            return (json.data || []).map(node => ({
                id: node.id,
                name: node.attributes?.field_capability_name,
                description: node.attributes?.body?.processed || '',
                endpoint: node.attributes?.field_endpoint,
                status: node.attributes?.field_capability_status,
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Fetch Heady system config from custom endpoint.
     */
    async function fetchHeadyConfig() {
        try {
            const resp = await fetch(`${DRUPAL_BASE}/api/heady/config`, {
                signal: AbortSignal.timeout(5000)
            });
            if (resp.ok) return await resp.json();
        } catch (e) { }
        return null;
    }

    /**
     * Hydrate DOM elements with CMS content.
     * Looks for elements with data-drupal-section="xxx" attributes.
     */
    function hydrateSections(pages) {
        if (!pages || pages.length === 0) return;

        pages.forEach(page => {
            const targets = document.querySelectorAll(`[data-drupal-section="${page.section}"]`);
            targets.forEach(el => {
                // Update heading
                if (page.heading) {
                    const h = el.querySelector('h1, h2, h3, [data-drupal-field="heading"]');
                    if (h) h.textContent = page.heading;
                }

                // Update body
                if (page.body) {
                    const b = el.querySelector('p, [data-drupal-field="body"]');
                    if (b) b.innerHTML = page.body;
                }

                // Update CTA
                if (page.ctaText) {
                    const cta = el.querySelector('a[data-drupal-field="cta"], .cta-btn, a.primary-btn');
                    if (cta) {
                        cta.textContent = page.ctaText;
                        if (page.ctaUrl) cta.href = page.ctaUrl;
                    }
                }

                // Mark as hydrated
                el.setAttribute('data-drupal-hydrated', 'true');
            });
        });
    }

    /**
     * Initialize: fetch and hydrate on DOM ready.
     */
    async function init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => init());
            return;
        }

        // Fetch in parallel
        const [pages, capabilities, config] = await Promise.all([
            fetchSitePages(),
            fetchAICapabilities(),
            fetchHeadyConfig(),
        ]);

        // Hydrate
        if (pages) hydrateSections(pages);

        // Expose to HeadyBuddy widget and browser extension
        window.__HEADY_CMS__ = {
            site: SITE,
            pages: pages || [],
            capabilities: capabilities || [],
            config: config || null,
            drupalBase: DRUPAL_BASE,
            lastFetch: new Date().toISOString(),
        };

        // Dispatch event for other scripts to consume
        document.dispatchEvent(new CustomEvent('heady:cms:ready', {
            detail: window.__HEADY_CMS__
        }));

        console.log(`[HeadyDrupalFetch] Loaded ${(pages || []).length} sections, ${(capabilities || []).length} capabilities for ${SITE}`);
    }

    init();
})();

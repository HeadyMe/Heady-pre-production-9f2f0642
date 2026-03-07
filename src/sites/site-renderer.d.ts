/**
 * Render a complete HTML page for a site config.
 */
export function renderSite(site: any): string;
/**
 * Resolve a hostname to a site config.
 * 1. Check domain aliases
 * 2. Check preconfigured sites
 * 3. Check user-created sites
 * 4. Fallback to headyme.com
 */
export function resolveSite(hostname: any): any;
/**
 * Resolve a site by slug (for /v/:slug routes)
 */
export function resolveSiteBySlug(slug: any): any;
/**
 * Get nav items for a site
 */
export function getNavItems(site: any): {
    slug: string;
    name: string;
    domain: string;
    active: boolean;
    href: string;
}[];
//# sourceMappingURL=site-renderer.d.ts.map
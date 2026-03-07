export const domain: "templates";
export const description: "Sacred geometry site template engine \u2014 delivers branded pages for every Heady domain";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    site: string;
    rendered: boolean;
    sacredGeometry: any;
}>)[];
/**
 * Generates a full branded page for a Heady domain.
 * This is the core template that every site uses.
 *
 * @param {string} hostname - The domain to render (e.g., 'headysystems.com')
 * @returns {string} Full HTML page with sacred geometry, auth gate, nav, branding
 */
export function renderSite(hostname: string): string;
export function resolveDomain(hostname: any): any;
export function generateNav(activeDomain: any): string;
export function generateAuthGate(siteName: any, accent: any, domain: any): string;
/**
 * Get all site template data for edge embedding.
 * Returns a map of hostname → template data for instant edge delivery.
 */
export function getAllSiteTemplates(): {};
export const AUTH_PROVIDERS: {
    id: string;
    name: string;
    icon: string;
}[];
export const HEADY_SITES: string[][];
//# sourceMappingURL=template-bee.d.ts.map
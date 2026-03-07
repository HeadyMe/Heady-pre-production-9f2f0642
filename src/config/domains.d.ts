export type DomainConfig = {
    /**
     * - Human-readable name
     */
    name: string;
    /**
     * - Bare domain (no protocol)
     */
    domain: string;
    /**
     * - Full HTTPS base URL
     */
    baseUrl: string;
    /**
     * - Primary role/function of this domain
     */
    role: string;
    /**
     * - Permitted CORS origins
     */
    allowedOrigins: string[];
    /**
     * - Health check path
     */
    healthEndpoint: string;
    /**
     * - Status/info path
     */
    statusEndpoint: string;
    /**
     * - Whether this domain exposes a public API
     */
    publicApi: boolean;
    /**
     * - Whether MCP is enabled on this domain
     */
    mcpEnabled: boolean;
    /**
     * - Cloudflare tunnel configuration
     */
    tunnel: Object;
    /**
     * - Services hosted on this domain
     */
    services: string[];
};
/**
 * @fileoverview Heady domain registry — all canonical domains, their roles,
 * tunnel configurations, and health endpoint definitions.
 * @module src/config/domains
 */
/**
 * @typedef {Object} DomainConfig
 * @property {string} name - Human-readable name
 * @property {string} domain - Bare domain (no protocol)
 * @property {string} baseUrl - Full HTTPS base URL
 * @property {string} role - Primary role/function of this domain
 * @property {string[]} allowedOrigins - Permitted CORS origins
 * @property {string} healthEndpoint - Health check path
 * @property {string} statusEndpoint - Status/info path
 * @property {boolean} publicApi - Whether this domain exposes a public API
 * @property {boolean} mcpEnabled - Whether MCP is enabled on this domain
 * @property {Object} tunnel - Cloudflare tunnel configuration
 * @property {string[]} services - Services hosted on this domain
 */
/** @type {DomainConfig[]} */
export const HEADY_DOMAINS: DomainConfig[];
/**
 * Map of domain string → config for O(1) lookups.
 * @type {Map<string, DomainConfig>}
 */
export const DOMAIN_MAP: Map<string, DomainConfig>;
/**
 * All allowed CORS origins across every Heady domain, deduplicated.
 * @type {string[]}
 */
export const ALL_ALLOWED_ORIGINS: string[];
/**
 * Returns the configuration for a specific domain.
 * @param {string} domain - Bare domain name (e.g. 'headyme.com')
 * @returns {DomainConfig|undefined}
 */
export function getDomainConfig(domain: string): DomainConfig | undefined;
/**
 * Returns whether a given origin is permitted for CORS.
 * @param {string} origin - Full origin URL (e.g. 'https://headyme.com')
 * @returns {boolean}
 */
export function isAllowedOrigin(origin: string): boolean;
/**
 * Returns all domains with a specific role.
 * @param {string} role
 * @returns {DomainConfig[]}
 */
export function getDomainsByRole(role: string): DomainConfig[];
/**
 * Returns all MCP-enabled domains.
 * @returns {DomainConfig[]}
 */
export function getMCPDomains(): DomainConfig[];
//# sourceMappingURL=domains.d.ts.map
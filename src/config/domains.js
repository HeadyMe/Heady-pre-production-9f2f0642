/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

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
const HEADY_DOMAINS = [
  {
    name: 'HeadyMe',
    domain: 'headyme.com',
    baseUrl: 'https://headyme.com',
    role: 'primary-platform',
    description: 'Primary Heady AI Platform interface and dashboard',
    allowedOrigins: [
      'https://headyme.com',
      'https://www.headyme.com',
      'https://app.headyme.com',
      'https://api.headyme.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'headyme.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYME || '',
      protocol: 'https',
    },
    services: ['conductor', 'pipeline', 'dashboard', 'soul'],
  },

  {
    name: 'HeadySystems',
    domain: 'headysystems.com',
    baseUrl: 'https://headysystems.com',
    role: 'corporate-platform',
    description: 'HeadySystems Inc. corporate platform and developer portal',
    allowedOrigins: [
      'https://headysystems.com',
      'https://www.headysystems.com',
      'https://dev.headysystems.com',
      'https://portal.headysystems.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'headysystems.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYSYSTEMS || '',
      protocol: 'https',
    },
    services: ['api', 'developer-portal', 'docs', 'admin'],
  },

  {
    name: 'HeadyConnection',
    domain: 'headyconnection.org',
    baseUrl: 'https://headyconnection.org',
    role: 'community-hub',
    description: 'Heady community, connections, and social orchestration',
    allowedOrigins: [
      'https://headyconnection.org',
      'https://www.headyconnection.org',
      'https://community.headyconnection.org',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: false,
    mcpEnabled: false,
    tunnel: {
      enabled: true,
      hostname: 'headyconnection.org',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYCONNECTION || '',
      protocol: 'https',
    },
    services: ['community', 'connections', 'social'],
  },

  {
    name: 'HeadyMCP',
    domain: 'headymcp.com',
    baseUrl: 'https://headymcp.com',
    role: 'mcp-gateway',
    description: 'Model Context Protocol gateway and tool registry',
    allowedOrigins: [
      'https://headymcp.com',
      'https://www.headymcp.com',
      'https://gateway.headymcp.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'headymcp.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYMCP || '',
      protocol: 'https',
    },
    services: ['mcp-server', 'tool-registry', 'resource-catalog'],
  },

  {
    name: 'HeadyAPI',
    domain: 'headyapi.com',
    baseUrl: 'https://headyapi.com',
    role: 'api-gateway',
    description: 'Primary public API gateway for external integrations',
    allowedOrigins: [
      'https://headyapi.com',
      'https://www.headyapi.com',
      'https://v1.headyapi.com',
      'https://v2.headyapi.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: false,
    tunnel: {
      enabled: true,
      hostname: 'headyapi.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYAPI || '',
      protocol: 'https',
    },
    services: ['rest-api', 'graphql', 'webhooks', 'rate-limiter'],
  },

  {
    name: 'HeadyIO',
    domain: 'headyio.com',
    baseUrl: 'https://headyio.com',
    role: 'io-streaming',
    description: 'Real-time I/O streaming, WebSocket hub, and event bus',
    allowedOrigins: [
      'https://headyio.com',
      'https://www.headyio.com',
      'https://stream.headyio.com',
      'https://ws.headyio.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: false,
    tunnel: {
      enabled: true,
      hostname: 'headyio.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYIO || '',
      protocol: 'https',
    },
    services: ['websocket', 'sse', 'event-bus', 'pubsub'],
  },

  {
    name: 'HeadyBuddy',
    domain: 'headybuddy.org',
    baseUrl: 'https://headybuddy.org',
    role: 'companion-ai',
    description: 'Heady Buddy — personal AI companion and assistant interface',
    allowedOrigins: [
      'https://headybuddy.org',
      'https://www.headybuddy.org',
      'https://chat.headybuddy.org',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: false,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'headybuddy.org',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYBUDDY || '',
      protocol: 'https',
    },
    services: ['companion', 'chat', 'memory', 'soul'],
  },

  {
    name: 'HeadyBot',
    domain: 'headybot.com',
    baseUrl: 'https://headybot.com',
    role: 'bot-platform',
    description: 'Heady Bot — automated agent deployment and orchestration',
    allowedOrigins: [
      'https://headybot.com',
      'https://www.headybot.com',
      'https://bots.headybot.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'headybot.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYBOT || '',
      protocol: 'https',
    },
    services: ['bots', 'bee-factory', 'battle', 'automation'],
  },

  {
    name: 'HeadyAI',
    domain: 'heady-ai.com',
    baseUrl: 'https://heady-ai.com',
    role: 'ai-research',
    description: 'Heady AI research portal and model experimentation hub',
    allowedOrigins: [
      'https://heady-ai.com',
      'https://www.heady-ai.com',
      'https://research.heady-ai.com',
      'https://lab.heady-ai.com',
    ],
    healthEndpoint: '/health/live',
    statusEndpoint: '/api/status',
    publicApi: true,
    mcpEnabled: true,
    tunnel: {
      enabled: true,
      hostname: 'heady-ai.com',
      service: 'http://localhost:3301',
      tunnelId: process.env.HEADY_TUNNEL_ID_HEADYAI || '',
      protocol: 'https',
    },
    services: ['ai-lab', 'model-router', 'monte-carlo', 'vinci'],
  },
];

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/**
 * Map of domain string → config for O(1) lookups.
 * @type {Map<string, DomainConfig>}
 */
const DOMAIN_MAP = new Map(HEADY_DOMAINS.map((d) => [d.domain, d]));

/**
 * All allowed CORS origins across every Heady domain, deduplicated.
 * @type {string[]}
 */
const ALL_ALLOWED_ORIGINS = [...new Set(
  HEADY_DOMAINS.flatMap((d) => d.allowedOrigins)
)];

/**
 * Returns the configuration for a specific domain.
 * @param {string} domain - Bare domain name (e.g. 'headyme.com')
 * @returns {DomainConfig|undefined}
 */
function getDomainConfig(domain) {
  return DOMAIN_MAP.get(domain);
}

/**
 * Returns whether a given origin is permitted for CORS.
 * @param {string} origin - Full origin URL (e.g. 'https://headyme.com')
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALL_ALLOWED_ORIGINS.includes(origin);
}

/**
 * Returns all domains with a specific role.
 * @param {string} role
 * @returns {DomainConfig[]}
 */
function getDomainsByRole(role) {
  return HEADY_DOMAINS.filter((d) => d.role === role);
}

/**
 * Returns all MCP-enabled domains.
 * @returns {DomainConfig[]}
 */
function getMCPDomains() {
  return HEADY_DOMAINS.filter((d) => d.mcpEnabled);
}

module.exports = {
  HEADY_DOMAINS,
  DOMAIN_MAP,
  ALL_ALLOWED_ORIGINS,
  getDomainConfig,
  isAllowedOrigin,
  getDomainsByRole,
  getMCPDomains,
};

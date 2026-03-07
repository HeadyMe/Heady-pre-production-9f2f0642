/**
 * HeadyWeb — UI Registry Service
 *
 * Maps domain hostnames to their corresponding UI IDs and configuration.
 * Used by the shell to determine which micro-frontend to load for a given domain.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module services/ui-registry
 */

'use strict';

/**
 * Registry mapping hostnames to UI configuration objects.
 *
 * @type {Record<string, {
 *   uiId: string,
 *   scope: string,
 *   category: 'platform'|'marketing'|'developer'|'ops',
 *   label: string,
 *   description: string,
 *   themeAccent: string,
 *   preload: boolean,
 * }>}
 */
const UI_REGISTRY = {
  // ── HeadyMe — Primary platform domain ──────────────────────────────────────
  'headyme.com': {
    uiId: 'antigravity',
    scope: 'antigravity',
    category: 'platform',
    label: 'HeadyMe Antigravity',
    description: '3D vector space visualization and autonomous agent interface',
    themeAccent: '#10B981',
    preload: true,
  },
  'www.headyme.com': {
    uiId: 'antigravity',
    scope: 'antigravity',
    category: 'platform',
    label: 'HeadyMe Antigravity',
    description: '3D vector space visualization and autonomous agent interface',
    themeAccent: '#10B981',
    preload: true,
  },
  'app.headyme.com': {
    uiId: 'swarm-dashboard',
    scope: 'swarmDashboard',
    category: 'ops',
    label: 'Swarm Dashboard',
    description: 'Real-time agent swarm monitoring',
    themeAccent: '#F5A623',
    preload: false,
  },

  // ── HeadySystems — Engineering domain ──────────────────────────────────────
  'headysystems.com': {
    uiId: 'landing',
    scope: 'headyLanding',
    category: 'marketing',
    label: 'HeadySystems Landing',
    description: 'Marketing landing page and product overview',
    themeAccent: '#4c8fff',
    preload: true,
  },
  'www.headysystems.com': {
    uiId: 'landing',
    scope: 'headyLanding',
    category: 'marketing',
    label: 'HeadySystems Landing',
    description: 'Marketing landing page and product overview',
    themeAccent: '#4c8fff',
    preload: true,
  },
  'ide.headysystems.com': {
    uiId: 'heady-ide',
    scope: 'headyIDE',
    category: 'developer',
    label: 'Heady IDE',
    description: 'Code editor and AI-assisted development environment',
    themeAccent: '#4c8fff',
    preload: false,
  },

  // ── HeadyMCP — Model Context Protocol domain ────────────────────────────────
  'headymcp.com': {
    uiId: 'governance-panel',
    scope: 'governancePanel',
    category: 'ops',
    label: 'Governance Panel',
    description: 'Policy engine, MCP governance, and audit log',
    themeAccent: '#8b5cf6',
    preload: false,
  },
  'www.headymcp.com': {
    uiId: 'governance-panel',
    scope: 'governancePanel',
    category: 'ops',
    label: 'Governance Panel',
    description: 'Policy engine, MCP governance, and audit log',
    themeAccent: '#8b5cf6',
    preload: false,
  },

  // ── HeadyConnection — Community / connection domain ─────────────────────────
  'headyconnection.org': {
    uiId: 'vector-explorer',
    scope: 'vectorExplorer',
    category: 'platform',
    label: 'Vector Explorer',
    description: 'Semantic vector memory exploration across the HeadyNetwork',
    themeAccent: '#10B981',
    preload: false,
  },
  'www.headyconnection.org': {
    uiId: 'vector-explorer',
    scope: 'vectorExplorer',
    category: 'platform',
    label: 'Vector Explorer',
    description: 'Semantic vector memory exploration across the HeadyNetwork',
    themeAccent: '#10B981',
    preload: false,
  },

  // ── HeadyDeploy / Projections ───────────────────────────────────────────────
  'deploy.headyme.com': {
    uiId: 'projection-monitor',
    scope: 'projectionMonitor',
    category: 'ops',
    label: 'Projection Monitor',
    description: 'Deployment projection health and domain routing status',
    themeAccent: '#00d4ff',
    preload: false,
  },
  'projections.headysystems.com': {
    uiId: 'projection-monitor',
    scope: 'projectionMonitor',
    category: 'ops',
    label: 'Projection Monitor',
    description: 'Deployment projection health and domain routing status',
    themeAccent: '#00d4ff',
    preload: false,
  },

  // ── Local development ───────────────────────────────────────────────────────
  'localhost': {
    uiId: 'landing',
    scope: 'headyLanding',
    category: 'marketing',
    label: 'HeadySystems Landing (Dev)',
    description: 'Local development — marketing landing page',
    themeAccent: '#4c8fff',
    preload: true,
  },
  '127.0.0.1': {
    uiId: 'landing',
    scope: 'headyLanding',
    category: 'marketing',
    label: 'HeadySystems Landing (Dev)',
    description: 'Local development — marketing landing page',
    themeAccent: '#4c8fff',
    preload: true,
  },
};

// ── Service Methods ───────────────────────────────────────────────────────────

/**
 * Register a new UI mapping dynamically.
 *
 * @param {string} hostname - The domain hostname to register
 * @param {object} config   - UI configuration object (must include uiId and scope)
 * @throws {TypeError} If hostname or config.uiId is missing
 */
function registerUI(hostname, config) {
  if (!hostname || typeof hostname !== 'string') {
    throw new TypeError('registerUI: hostname must be a non-empty string');
  }
  if (!config?.uiId) {
    throw new TypeError('registerUI: config.uiId is required');
  }
  UI_REGISTRY[hostname.toLowerCase()] = config;
}

/**
 * Resolve a hostname to its UI configuration.
 *
 * @param {string} hostname - The domain hostname to resolve
 * @returns {object|null} UI config object, or null if not found
 *
 * @example
 * const cfg = resolveUI('headyme.com');
 * // => { uiId: 'antigravity', scope: 'antigravity', ... }
 */
function resolveUI(hostname) {
  if (!hostname) return null;
  const key = hostname.toLowerCase().trim();
  return UI_REGISTRY[key] || null;
}

/**
 * List all registered UI entries.
 *
 * @returns {Array<{ hostname: string } & object>}
 */
function listRegisteredUIs() {
  return Object.entries(UI_REGISTRY).map(([hostname, config]) => ({
    hostname,
    ...config,
  }));
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  UI_REGISTRY,
  registerUI,
  resolveUI,
  listRegisteredUIs,
};

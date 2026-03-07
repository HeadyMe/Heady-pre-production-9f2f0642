/**
 * HeadyWeb — Domain Router Service
 *
 * Resolves the current domain hostname to a projection configuration.
 * Used by the shell to determine which micro-frontend to activate for
 * any given Heady domain entry point.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module services/domain-router
 */

'use strict';

const { resolveUI } = require('./ui-registry');

/**
 * Full domain map: hostname → projection config.
 * Each entry describes the UI, deployment target, staleness budget, and routing metadata.
 *
 * @type {Record<string, {
 *   uiId: string,
 *   category: string,
 *   projection: string,
 *   deployTarget: string,
 *   endpoint: string,
 *   stalenessBudget: number,
 *   syncMode: 'event-driven'|'polling'|'manual',
 *   description: string,
 * }>}
 */
const DOMAIN_MAP = {
  // ── Core domains ──────────────────────────────────────────────────────────

  'headyme.com': {
    uiId: 'antigravity',
    category: 'platform',
    projection: 'antigravity',
    deployTarget: 'cloudflare-pages',
    endpoint: 'https://headyme.com',
    stalenessBudget: 300,        // 5 minutes
    syncMode: 'event-driven',
    description: 'Primary platform entry — 3D vector visualization',
  },

  'headysystems.com': {
    uiId: 'landing',
    category: 'marketing',
    projection: 'landing',
    deployTarget: 'cloudflare-pages',
    endpoint: 'https://headysystems.com',
    stalenessBudget: 3600,       // 1 hour
    syncMode: 'event-driven',
    description: 'Marketing landing page for HeadySystems Inc.',
  },

  'headymcp.com': {
    uiId: 'governance-panel',
    category: 'ops',
    projection: 'governance-panel',
    deployTarget: 'cloud-run',
    endpoint: 'https://headymcp.com',
    stalenessBudget: 60,         // 1 minute — governance needs freshness
    syncMode: 'event-driven',
    description: 'MCP governance and policy engine',
  },

  'headyconnection.org': {
    uiId: 'vector-explorer',
    category: 'platform',
    projection: 'vector-explorer',
    deployTarget: 'huggingface-spaces',
    endpoint: 'https://headyconnection.org',
    stalenessBudget: 120,        // 2 minutes
    syncMode: 'event-driven',
    description: 'Vector memory federation network',
  },

  // ── Subdomain routes ───────────────────────────────────────────────────────

  'app.headyme.com': {
    uiId: 'swarm-dashboard',
    category: 'ops',
    projection: 'swarm-dashboard',
    deployTarget: 'cloud-run',
    endpoint: 'https://app.headyme.com',
    stalenessBudget: 15,         // 15 seconds — live agent data
    syncMode: 'event-driven',
    description: 'Real-time agent swarm monitoring dashboard',
  },

  'ide.headysystems.com': {
    uiId: 'heady-ide',
    category: 'developer',
    projection: 'heady-ide',
    deployTarget: 'cloud-run',
    endpoint: 'https://ide.headysystems.com',
    stalenessBudget: 0,          // No caching — IDE is always live
    syncMode: 'event-driven',
    description: 'AI-assisted code editor and development environment',
  },

  'deploy.headyme.com': {
    uiId: 'projection-monitor',
    category: 'ops',
    projection: 'projection-monitor',
    deployTarget: 'cloud-run',
    endpoint: 'https://deploy.headyme.com',
    stalenessBudget: 30,         // 30 seconds
    syncMode: 'event-driven',
    description: 'Deployment projection health monitoring',
  },

  'projections.headysystems.com': {
    uiId: 'projection-monitor',
    category: 'ops',
    projection: 'projection-monitor',
    deployTarget: 'cloud-run',
    endpoint: 'https://projections.headysystems.com',
    stalenessBudget: 30,
    syncMode: 'event-driven',
    description: 'Deployment projection health monitoring',
  },

  'www.headyme.com': {
    uiId: 'antigravity',
    category: 'platform',
    projection: 'antigravity',
    deployTarget: 'cloudflare-pages',
    endpoint: 'https://www.headyme.com',
    stalenessBudget: 300,
    syncMode: 'event-driven',
    description: 'Primary platform — www alias',
  },

  'www.headysystems.com': {
    uiId: 'landing',
    category: 'marketing',
    projection: 'landing',
    deployTarget: 'cloudflare-pages',
    endpoint: 'https://www.headysystems.com',
    stalenessBudget: 3600,
    syncMode: 'event-driven',
    description: 'Marketing landing page — www alias',
  },

  // ── Development ────────────────────────────────────────────────────────────

  'localhost': {
    uiId: 'landing',
    category: 'dev',
    projection: 'landing',
    deployTarget: 'local',
    endpoint: 'http://localhost:3000',
    stalenessBudget: 0,
    syncMode: 'manual',
    description: 'Local development server',
  },

  '127.0.0.1': {
    uiId: 'landing',
    category: 'dev',
    projection: 'landing',
    deployTarget: 'local',
    endpoint: 'http://127.0.0.1:3000',
    stalenessBudget: 0,
    syncMode: 'manual',
    description: 'Local development server (IP)',
  },
};

// ── Router API ────────────────────────────────────────────────────────────────

/**
 * Resolve a hostname to its projection configuration.
 *
 * Tries the following in order:
 *  1. Exact hostname match in DOMAIN_MAP
 *  2. UI Registry lookup via resolveUI()
 *  3. Returns null if neither resolves
 *
 * @param {string} hostname - Domain hostname to resolve (e.g. 'headyme.com')
 * @returns {{ uiId: string, category: string, hostname: string, config: object }|null}
 *
 * @example
 * const result = resolveDomain('headyme.com');
 * // => { uiId: 'antigravity', category: 'platform', hostname: 'headyme.com', config: { ... } }
 */
function resolveDomain(hostname) {
  if (!hostname) return null;

  const key = hostname.toLowerCase().trim();

  // ── 1. Exact DOMAIN_MAP match ────────────────────────────────────────────
  if (DOMAIN_MAP[key]) {
    return {
      uiId: DOMAIN_MAP[key].uiId,
      category: DOMAIN_MAP[key].category,
      hostname: key,
      config: DOMAIN_MAP[key],
    };
  }

  // ── 2. UI_REGISTRY fallback ──────────────────────────────────────────────
  const uiCfg = resolveUI(key);
  if (uiCfg) {
    return {
      uiId: uiCfg.uiId,
      category: uiCfg.category || 'platform',
      hostname: key,
      config: {
        uiId: uiCfg.uiId,
        projection: uiCfg.uiId,
        deployTarget: 'cloudflare-pages',
        stalenessBudget: 300,
        syncMode: 'event-driven',
        description: uiCfg.description || '',
      },
    };
  }

  return null;
}

/**
 * Resolve the current browser hostname.
 * Safe to call in non-browser environments (returns null).
 *
 * @returns {{ uiId: string, category: string, hostname: string, config: object }|null}
 */
function resolveCurrentDomain() {
  if (typeof window === 'undefined' || !window.location) return null;
  return resolveDomain(window.location.hostname);
}

/**
 * Get the full domain map.
 * @returns {typeof DOMAIN_MAP}
 */
function getDomainMap() {
  return { ...DOMAIN_MAP };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  DOMAIN_MAP,
  resolveDomain,
  resolveCurrentDomain,
  getDomainMap,
};

/**
 * HeadyWeb Universal Shell — Entry Point
 *
 * Boots the Heady platform by:
 *  1. Preloading frequently-used remotes
 *  2. Resolving the current domain to a projection
 *  3. Looking up the corresponding remote in REMOTE_REGISTRY
 *  4. Dynamically loading and mounting the micro-frontend via Module Federation
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module shell/index
 */

'use strict';

import { loadDynamicRemote, mountRemote, preloadRemote } from './load-dynamic-remote';

// ── Constants ────────────────────────────────────────────────────────────────

/** Current shell version (separate from platform version). */
const SHELL_VERSION = '3.0.1';

/** API endpoint that returns the active domain projection config. */
const DOMAIN_API_URL = '/api/domains/current';

/** Default fallback remote name if domain resolution fails. */
const DEFAULT_REMOTE = 'landing';

// ── Remote Registry ──────────────────────────────────────────────────────────

/**
 * Registry of all Module Federation remotes available to this shell.
 * Each entry defines the runtime URL, scope name, and exposed module path.
 *
 * @type {Record<string, { url: string, scope: string, module: string, description: string }>}
 */
const REMOTE_REGISTRY = {
  antigravity: {
    url: '/remotes/antigravity/remoteEntry.js',
    scope: 'antigravity',
    module: './App',
    description: '3D vector space visualization with Sacred Geometry',
  },
  landing: {
    url: '/remotes/landing/remoteEntry.js',
    scope: 'headyLanding',
    module: './App',
    description: 'Marketing landing page for HeadySystems',
  },
  'heady-ide': {
    url: '/remotes/heady-ide/remoteEntry.js',
    scope: 'headyIDE',
    module: './App',
    description: 'Code editor and IDE interface with HeadyBuddy AI',
  },
  'swarm-dashboard': {
    url: '/remotes/swarm-dashboard/remoteEntry.js',
    scope: 'swarmDashboard',
    module: './App',
    description: 'Real-time agent swarm monitoring dashboard',
  },
  'governance-panel': {
    url: '/remotes/governance/remoteEntry.js',
    scope: 'governancePanel',
    module: './App',
    description: 'Policy engine, approval gates, and audit log',
  },
  'projection-monitor': {
    url: '/remotes/projections/remoteEntry.js',
    scope: 'projectionMonitor',
    module: './App',
    description: 'Deployment projection monitoring for Heady domains',
  },
  'vector-explorer': {
    url: '/remotes/vectors/remoteEntry.js',
    scope: 'vectorExplorer',
    module: './App',
    description: 'Semantic vector memory exploration and federation',
  },
};

// ── UI Helpers ───────────────────────────────────────────────────────────────

/**
 * Update the shell loading status text.
 * @param {string} message
 */
function setLoaderStatus(message) {
  const el = document.getElementById('loader-status-text');
  if (el) el.textContent = message;
}

/**
 * Hide the loading overlay.
 */
function hideLoader() {
  const loader = document.getElementById('heady-loader');
  if (loader) {
    loader.classList.add('hidden');
    // Remove from DOM after transition
    setTimeout(() => loader.remove(), 500);
  }
}

/**
 * Render a fallback UI when no projection/remote is found for the domain.
 * @param {string} [projection] - The projection name that failed to resolve
 */
function renderFallbackUI(projection) {
  const root = document.getElementById('heady-root');
  if (!root) return;

  root.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      min-height:100vh; gap:16px; padding:32px; text-align:center;
      font-family:'Inter',system-ui,sans-serif; color:#e8eaf0;
    ">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 4L43.05 14.5V35.5L24 46L4.95 35.5V14.5L24 4Z"
          stroke="#F5A623" stroke-width="1.5" fill="none"/>
        <circle cx="24" cy="24" r="6" fill="#F5A623" opacity="0.6"/>
      </svg>
      <div style="font-size:18px;font-weight:600;">No Remote Found</div>
      <div style="font-size:13px;color:#6b7280;font-family:'JetBrains Mono',monospace;max-width:380px;">
        ${projection
          ? `Projection "${projection}" is not registered in REMOTE_REGISTRY.`
          : 'Domain resolution returned no projection mapping.'}
      </div>
      <a href="/" style="
        margin-top:8px; padding:10px 24px; background:#7B61FF; color:#fff;
        border-radius:6px; font-size:14px; font-weight:500; text-decoration:none;
      ">Go to Landing</a>
    </div>
  `;
}

/**
 * Render a user-visible error state when a remote fails to load.
 * @param {Error} error
 */
function renderErrorUI(error) {
  const errOverlay = document.getElementById('heady-error');
  const errMsg = document.getElementById('heady-error-message');

  if (errOverlay && errMsg) {
    errMsg.textContent = error?.message || String(error);
    errOverlay.classList.add('visible');
  } else {
    // Fallback — write directly to root
    const root = document.getElementById('heady-root');
    if (root) {
      root.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:100vh;gap:12px;padding:32px;color:#e8eaf0;font-family:'Inter',system-ui,sans-serif;">
          <div style="color:#ef4444;font-size:16px;font-weight:600;">Shell Boot Error</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#6b7280;
            max-width:480px;word-break:break-all;text-align:center;">${error?.message || error}</div>
          <button onclick="window.location.reload()" style="
            padding:10px 24px;background:#7B61FF;color:#fff;border:none;border-radius:6px;
            cursor:pointer;font-size:14px;margin-top:8px;">Retry</button>
        </div>
      `;
    }
  }
}

// ── Boot Logic ───────────────────────────────────────────────────────────────

/**
 * Preload the most frequently accessed remotes to speed up subsequent mounts.
 * Uses <link rel="preload"> for script resources.
 */
function preloadFrequentRemotes() {
  try {
    preloadRemote(
      REMOTE_REGISTRY.antigravity.url,
      REMOTE_REGISTRY.antigravity.scope
    );
    preloadRemote(
      REMOTE_REGISTRY.landing.url,
      REMOTE_REGISTRY.landing.scope
    );
  } catch (err) {
    // Preload failures are non-fatal
    console.warn('[HeadyShell] Preload warning:', err.message);
  }
}

/**
 * Boot the HeadyWeb shell:
 *  1. Fetch the domain API to get the current projection
 *  2. Look up the remote in REMOTE_REGISTRY
 *  3. Mount the remote into #heady-root
 *
 * Falls back to DEFAULT_REMOTE ('landing') if any step fails.
 */
async function bootShell() {
  const container = document.getElementById('heady-root');
  if (!container) {
    console.error('[HeadyShell] #heady-root not found in DOM');
    return;
  }

  let projection = DEFAULT_REMOTE;

  try {
    // ── Step 1: Resolve domain → projection ──────────────────────────────
    setLoaderStatus('Resolving domain projection…');

    try {
      const res = await fetch(DOMAIN_API_URL, {
        signal: AbortSignal.timeout(5000),
        headers: { 'X-Heady-Shell': SHELL_VERSION },
      });
      if (res.ok) {
        const data = await res.json();
        projection = data?.projection || data?.uiId || DEFAULT_REMOTE;
      }
    } catch (fetchErr) {
      // Domain API is optional — fall back to DEFAULT_REMOTE
      console.warn('[HeadyShell] Domain API unavailable, using default remote:', fetchErr.message);
    }

    // ── Step 2: Look up remote ────────────────────────────────────────────
    setLoaderStatus(`Loading module: ${projection}…`);

    const remote = REMOTE_REGISTRY[projection];
    if (!remote) {
      console.warn(`[HeadyShell] No remote registered for projection "${projection}". Rendering fallback.`);
      hideLoader();
      renderFallbackUI(projection);
      return;
    }

    // ── Step 3: Mount remote ──────────────────────────────────────────────
    setLoaderStatus(`Mounting ${projection}…`);

    await mountRemote({
      url: remote.url,
      scope: remote.scope,
      module: remote.module,
      container,
      props: {
        shellVersion: SHELL_VERSION,
        projection,
        domain: window.location.hostname,
        theme: 'dark',
      },
    });

    hideLoader();
    console.info(`[HeadyShell] ✓ Mounted remote "${projection}" (shell v${SHELL_VERSION})`);

  } catch (err) {
    console.error('[HeadyShell] Boot failure:', err);
    hideLoader();
    renderErrorUI(err);
  }
}

// ── Entry Point ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.info(`[HeadyShell] Starting up — shell v${SHELL_VERSION} | platform v3.1.0`);
  preloadFrequentRemotes();
  bootShell();
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  bootShell,
  REMOTE_REGISTRY,
  SHELL_VERSION,
};

/**
 * Heady Governance Panel — Webpack Remote Entry Bootstrap
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
import('./mount').then(({ mount }) => {
  mount(document.getElementById('heady-root') || document.body, { autoMount: true });
}).catch((err) => console.error('[GovernancePanel] Bootstrap failed:', err));

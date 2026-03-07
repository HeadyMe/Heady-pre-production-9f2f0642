/**
 * HeadySystems Landing — Webpack Remote Entry Bootstrap
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

import('./mount').then(({ mount }) => {
  const container = document.getElementById('heady-root') || document.body;
  mount(container, { autoMount: true, theme: 'dark' });
}).catch((err) => console.error('[Landing] Bootstrap failed:', err));

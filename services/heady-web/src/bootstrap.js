/**
 * HeadyWeb — Remote Entry Bootstrap
 *
 * Webpack remote entry point. This file is the async boundary that enables
 * Module Federation's shared chunk loading before the application boots.
 *
 * When used as the remote entry for a micro-frontend, it:
 *  1. Imports the mount lifecycle
 *  2. Auto-mounts if a #heady-root container exists in the DOM
 *  3. Exposes the mount/unmount API on window.__heady_app__ for host shells
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module bootstrap
 */

'use strict';

// This dynamic import creates the async boundary required by Module Federation.
// All application code must be imported from here (never directly from index.js)
// to ensure shared modules are initialized before they are used.

import('./mount')
  .then(({ mount, unmount }) => {
    // Auto-mount if we find a container in the DOM
    const container = document.getElementById('heady-root')
      || document.getElementById('app')
      || document.body;

    if (container) {
      const props = {
        autoMount: true,
        domain: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        theme: 'dark',
      };

      const result = mount(container, props);

      // Expose mount/unmount API for host shell integration
      if (typeof window !== 'undefined') {
        window.__heady_app__ = {
          mount,
          unmount: typeof result?.unmount === 'function'
            ? result.unmount
            : () => unmount && unmount(container),
          container,
        };
      }
    }
  })
  .catch((err) => {
    console.error('[HeadyBootstrap] Failed to mount application:', err);
  });

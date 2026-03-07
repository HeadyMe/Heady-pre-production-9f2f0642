/**
 * HeadyMe Antigravity — Mount Lifecycle
 *
 * Provides the Module Federation mount/unmount contract.
 * Called by the host shell to attach and detach this micro-frontend.
 *
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * @module remotes/antigravity/mount
 */

'use strict';

import { createApp } from './App';

/**
 * Mount the Antigravity application into a container element.
 *
 * @param {HTMLElement} container - The DOM element to mount into
 * @param {object} [props={}]    - Shell-provided props (theme, domain, etc.)
 * @returns {{ unmount: () => void }}
 */
export function mount(container, props = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('mount: container must be an HTMLElement');
  }

  // Clear any previous content
  container.innerHTML = '';

  const app = createApp(props);
  container.appendChild(app.element);

  return {
    unmount() {
      app.destroy();
      container.innerHTML = '';
    },
  };
}

/**
 * Unmount the application from a container.
 * @param {HTMLElement} container
 */
export function unmount(container) {
  if (container instanceof HTMLElement) {
    container.innerHTML = '';
  }
}

export default { mount, unmount };

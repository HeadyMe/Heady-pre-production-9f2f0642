/**
 * Heady Projection Monitor — Mount Lifecycle
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';
import { createApp } from './App';
export function mount(container, props = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('mount: container must be an HTMLElement');
  container.innerHTML = '';
  const app = createApp(props);
  container.appendChild(app.element);
  return { unmount: () => { app.destroy(); container.innerHTML = ''; } };
}
export function unmount(container) { if (container instanceof HTMLElement) container.innerHTML = ''; }
export default { mount, unmount };

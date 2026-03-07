// Bootstrap for Projection Monitor micro-frontend
const { createApp } = require('./App');

// Standalone mode: mount if #heady-root exists
if (typeof document !== 'undefined') {
  const root = document.getElementById('heady-root') || document.getElementById('root');
  if (root) createApp(root);
}

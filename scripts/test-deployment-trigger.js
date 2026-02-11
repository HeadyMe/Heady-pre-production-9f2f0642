const HCBrain = require('../packages/hc-brain');
const registry = require('../heady-registry.json');

// Simulate a registry update
registry.updatedAt = new Date().toISOString();

// Trigger monitoring
HCBrain.monitorRegistry(registry);

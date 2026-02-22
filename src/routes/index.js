/**
 * src/routes/index.js — Route module barrel file
 *
 * Usage in heady-manager.js:
 *   const routes = require('./src/routes');
 *   app.use('/api/registry', routes.registry);
 *   app.use('/api/nodes', routes.nodes);
 *   app.use('/api/system', routes.system);
 *   app.use('/api', routes.config);
 *
 * This enables a gradual migration: replace inline route blocks
 * in heady-manager.js one section at a time with these modules.
 */

const { router: registryRouter, loadRegistry, saveRegistry, readJsonSafe } = require("./registry");
const nodesRouter = require("./nodes");
const systemRouter = require("./system");
const { router: configRouter, loadYamlConfig } = require("./config");

module.exports = {
    registry: registryRouter,
    nodes: nodesRouter,
    system: systemRouter,
    config: configRouter,

    // Shared utilities for other modules
    utils: { loadRegistry, saveRegistry, readJsonSafe, loadYamlConfig },
};

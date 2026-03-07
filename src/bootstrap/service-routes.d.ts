/**
 * Register all service routes on the Express app.
 *
 * @param {Express.Application} app - Express app instance
 * @param {Object} deps - Dependencies from the manager
 * @param {Object} deps.engines - Engine references from wireEngines()
 * @param {Object} deps.vectorMemory - Vector memory instance
 * @param {Object} deps.orchestrator - Agent orchestrator instance
 * @param {Object} deps.Handshake - Handshake module
 * @param {string} deps.projectRoot - __dirname of main entry
 */
export function registerServiceRoutes(app: Express.Application, deps?: {
    engines: Object;
    vectorMemory: Object;
    orchestrator: Object;
    Handshake: Object;
    projectRoot: string;
}): void;
//# sourceMappingURL=service-routes.d.ts.map
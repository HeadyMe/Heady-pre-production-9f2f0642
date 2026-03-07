/**
 * Initialize all system engines and wire them together.
 * Each engine is fault-tolerant — failure to load one doesn't block others.
 *
 * @param {Express.Application} app - Express app instance
 * @param {Object} deps - External dependencies from heady-manager
 * @param {Object} deps.pipeline - Pipeline instance (may be null)
 * @param {Function} deps.loadRegistry - Registry loader function
 * @param {EventEmitter} deps.eventBus - Global event bus
 * @param {string} deps.projectRoot - __dirname of the main entry point
 * @param {number} deps.PORT - Manager port
 * @returns {Object} Engine references
 */
export function wireEngines(app: Express.Application, deps?: {
    pipeline: Object;
    loadRegistry: Function;
    eventBus: EventEmitter;
    projectRoot: string;
    PORT: number;
}): Object;
//# sourceMappingURL=engine-wiring.d.ts.map
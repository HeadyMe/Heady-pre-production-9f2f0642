export class LogicOrchestrator extends EventEmitter<[never]> {
    constructor();
    buddy: any;
    conductor: any;
    orchestrator: any;
    pipeline: any;
    selfAwareness: typeof import("../self-awareness") | null;
    autoHeal: import("../resilience/auto-heal").AutoHeal | null;
    secretRotation: any;
    watchdog: import("../orchestration/buddy-watchdog").BuddyWatchdog | null;
    engines: Object | null;
    improvementScheduler: any;
    authEngine: any;
    corrections: any;
    deepResearch: any;
    /**
     * Boot all logic/orchestration subsystems.
     * @param {Object} opts - { vectorMemory, eventBus, projectRoot, PORT }
     */
    boot(opts: Object): this;
    /**
     * Register all orchestration routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app: Express): void;
    getBuddy(): any;
    getConductor(): any;
    getOrchestrator(): any;
    getEngines(): Object | null;
    getSelfAwareness(): typeof import("../self-awareness") | null;
}
import { EventEmitter } from "events";
//# sourceMappingURL=logic-orchestrator.d.ts.map
export class ProjectionDispatcher extends EventEmitter<[never]> {
    constructor();
    activeLayer: string;
    projectionEngine: typeof import("../services/projection-engine") | null;
    projectionGovernance: typeof import("../services/projection-governance") | null;
    domainRouter: typeof import("../services/domain-router") | null;
    uiRegistry: typeof import("../services/ui-registry") | null;
    llmRouter: typeof import("../services/llm-router") | null;
    autonomousScheduler: typeof import("../services/autonomous-scheduler") | null;
    swarmIgnition: typeof import("../orchestration/swarm-ignition") | null;
    beeTemplateRegistry: typeof import("../bees/headybee-template-registry") | null;
    swarmConsensus: import("../orchestration/swarm-consensus").SwarmConsensus | null;
    digitalPresence: typeof import("../services/digital-presence-orchestrator") | null;
    beeRegistry: {
        discover: () => number;
        getWork: (domain: string, context?: Object) => Function[];
        listDomains: () => {
            domain: any;
            file: any;
            description: any;
            priority: any;
        }[];
        getAllWork: (context?: Object) => {
            name: string;
            work: Function[];
            urgency: number;
        }[];
        getHealth: () => {
            domains: any[];
            loaded: number;
            failed: number;
            failedFiles: never[];
            discoveredAt: null;
            registered: number;
        };
        registry: Map<any, any>;
        createBee: (domain: string, config?: {
            description: string;
            priority: number;
            workers: any[];
            persist: boolean;
        }) => Object;
        spawnBee: (name: string, work: Function | Function[], priority?: number) => Object;
        createWorkUnit: (domain: string, name: string, fn: Function) => Object;
        createFromTemplate: (template: string, config?: Object) => Object;
        listDynamicBees: () => {
            domain: any;
            description: any;
            priority: any;
            type: string;
            createdAt: any;
        }[];
        dissolveBee: (domain: any) => void;
    } | null;
    buddySystem: typeof import("../services/buddy-system") | null;
    vectorServe: any;
    /**
     * Boot all projection/dispatch subsystems.
     * @param {Object} opts - { vectorMemory, eventBus }
     */
    boot(opts: Object): this;
    /**
     * Register all projection/dispatch routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app: Express): void;
    getActiveLayer(): string;
    getLayers(): {
        local: {
            name: string;
            endpoint: string;
        };
        "cloud-me": {
            name: string;
            endpoint: string;
        };
        "cloud-sys": {
            name: string;
            endpoint: string;
        };
        "cloud-conn": {
            name: string;
            endpoint: string;
        };
        "hf-liquid": {
            name: string;
            endpoint: string;
        };
        hybrid: {
            name: string;
            endpoint: string;
        };
    };
}
import { EventEmitter } from "events";
//# sourceMappingURL=projection-dispatcher.d.ts.map
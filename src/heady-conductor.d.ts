export class HeadyConductor extends EventEmitter<[never]> {
    constructor();
    started: number;
    routeCount: number;
    routeHistory: any[];
    vectorMem: any;
    orchestrator: any;
    cloudControlUrl: string;
    lastSwarmPulseAt: number;
    swarmAllocation: {
        targetBees: number;
        targetSwarms: number;
        asyncConcurrency: number;
        strategy: string;
        score: {
            loadScore: number;
            pendingTasks: number;
            p95LatencyMs: number;
            errorRate: number;
        };
    };
    injectedTaskCount: number;
    cognitiveGovernor: any;
    retryBudgetPerTask: number;
    taskAttempts: Map<any, any>;
    deadLetterQueue: any[];
    maxDeadLetterQueue: number;
    groupHits: {};
    layers: {
        taskRouter: {
            active: boolean;
            type: string;
            routes: number;
        };
        vectorZone: {
            active: boolean;
            type: string;
            zones: number;
        };
        brainRouter: {
            active: boolean;
            type: string;
        };
        patternEngine: {
            active: boolean;
            type: string;
            patterns: number;
        };
    };
    swarmPulseInterval: NodeJS.Timeout;
    /**
     * Wire vector memory for zone-aware routing.
     */
    setVectorMemory(vectorMem: any): void;
    /**
     * Wire orchestrator for supervisor-aware routing.
     */
    setOrchestrator(orchestrator: any): void;
    /**
     * ═══ Primary Route Decision ═══
     * The single entry point for ALL routing decisions.
     *
     * @param {Object} task - { action, payload }
     * @returns {Object} - { serviceGroup, vectorZone, pattern, weight, routeId }
     */
    route(task: Object, requestIp?: string): Object;
    /**
     * Simple synchronous route (for DynamicRouter compatibility).
     * Used by orchestrator when it doesn't need zone/pattern awareness.
     */
    routeSync(task: any): any;
    _requireAdminMutation(req: any, res: any, next: any): any;
    recordTaskOutcome(taskId: any, outcome?: {}): {
        taskId: string;
        movedToDlq: boolean;
        dlqEntry: {
            id: string;
            taskId: string;
            attempts: any;
            status: string;
            reason: any;
            payload: any;
            ts: string;
        };
        retryBudgetPerTask: number;
        attempts?: undefined;
    } | {
        taskId: string;
        movedToDlq: boolean;
        attempts: any;
        retryBudgetPerTask: number;
        dlqEntry?: undefined;
    };
    getDeadLetterQueue(limit?: number): any[];
    requeueDeadLetterEntry(id: any): any;
    _swarmPulse(): void;
    /**
     * Get federated routing status — all layers.
     */
    getStatus(): {
        ok: boolean;
        architecture: string;
        uptime: number;
        totalRoutes: number;
        layers: {
            taskRouter: {
                active: boolean;
                type: string;
                routes: number;
            };
            vectorZone: {
                active: boolean;
                type: string;
                zones: number;
            };
            brainRouter: {
                active: boolean;
                type: string;
            };
            patternEngine: {
                active: boolean;
                type: string;
                patterns: number;
            };
        };
        groupHits: {
            group: string;
            hits: any;
            pct: number;
        }[];
        recentRoutes: {
            routeId: any;
            action: any;
            serviceGroup: any;
            vectorZone: any;
            latency: any;
        }[];
        supervisors: any;
        minConcurrent: any;
        swarmAllocation: {
            targetBees: number;
            targetSwarms: number;
            asyncConcurrency: number;
            strategy: string;
            score: {
                loadScore: number;
                pendingTasks: number;
                p95LatencyMs: number;
                errorRate: number;
            };
        };
        injectedTaskCount: number;
        cloudStatus: {
            hasCloudUrl: boolean;
            heartbeatHealthy: boolean;
            servicesHealthy: boolean;
            liveReady: boolean;
        };
        cognitiveStatus: any;
        retryBudgetPerTask: number;
        dlqSize: number;
    };
    /**
     * Get the full route map — which actions go where.
     */
    getRouteMap(): {
        ok: boolean;
        architecture: string;
        groups: {};
    };
    /**
     * Register Express routes for conductor status.
     */
    registerRoutes(app: any): void;
    _audit(entry: any): void;
}
export function getConductor(): any;
import EventEmitter = require("events");
//# sourceMappingURL=heady-conductor.d.ts.map
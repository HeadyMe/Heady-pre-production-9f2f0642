export class AgentOrchestrator extends EventEmitter<[never]> {
    constructor(options?: {});
    minConcurrent: any;
    maxConcurrent: any;
    supervisors: Map<any, any>;
    taskQueue: any[];
    completedTasks: number;
    failedTasks: number;
    conductor: any;
    router: any;
    started: number;
    scaleEvents: any[];
    taskHistory: any[];
    handlers: Map<any, any>;
    groupCounts: {};
    groupLimits: {
        reasoning: number;
        embedding: number;
        search: number;
        creative: number;
        battle: number;
        ops: number;
        coding: number;
        governance: number;
        vision: number;
        sims: number;
        swarm: number;
        intelligence: number;
        "heady-reasoning": number;
        "heady-multimodal": number;
        "heady-enterprise": number;
        "heady-open-weights": number;
        "heady-cloud-fallback": number;
        "heady-local": number;
        "heady-edge-native": number;
    };
    _scaleInterval: NodeJS.Timeout;
    _profilingInterval: NodeJS.Timeout;
    /**
     * Ensure minimum supervisors are always running.
     * Distributes MIN_CONCURRENT across all service groups proportionally.
     * FORCE-CREATES new supervisors (doesn't reuse idle ones).
     */
    _ensureMinimum(): void;
    /**
     * Register a local handler function for an action.
     * This is how brain routes wire into the orchestrator WITHOUT self-HTTP.
     *
     * @param {string} action - e.g., "chat", "analyze", "embed", "search"
     * @param {Function} handler - async (payload) => result
     */
    registerHandler(action: string, handler: Function): void;
    _getOrCreateSupervisor(serviceGroup: any): any;
    /** Scale up a service group by N nodes */
    scaleUp(serviceGroup: any, count?: number): any[];
    /** Scale down idle agents in a service group */
    scaleDown(serviceGroup: any): number;
    /** Auto-scale based on queue pressure + idle reclamation */
    _autoScale(): void;
    /** Automated Performance Profiling & Pruning */
    _profilePerformanceAndPrune(): Promise<void>;
    _audit(entry: any): void;
    /**
     * Attach vector memory for memory-first scanning.
     * RULE: Before ANY task dispatch, scan persistent memory for context.
     */
    setVectorMemory(vectorMem: any): void;
    vectorMem: any;
    /**
     * ═══ HeadyValidator — Pre-Action Protocol ═══════════════════════════
     * ALWAYS runs BEFORE any task dispatch. Cannot be skipped.
     *
     * Checklist:
     *   1. Validate handler exists (HeadyRegistry)
     *   2. Enforce MIN_CONCURRENT (150 HeadySupervisors active)
     *   3. Scan HeadyMemory for relevant context
     *   4. Check HeadyPatterns for known optimizations
     *   5. Audit the validation result
     *
     * @param {Object} task - { action, payload }
     * @returns {Object} - { valid, context, patterns, supervisorCount }
     */
    _headyValidator(task: Object): Object;
    /**
     * Submit a task — the primary entry point.
     * ENFORCES: HeadyValidator → dispatch → store result
     */
    submit(task: any): Promise<any>;
    /** Submit multiple tasks in parallel */
    submitParallel(tasks: any): Promise<PromiseSettledResult<any>[]>;
    /** Deterministic parallel execution with results */
    parallel(tasks: any): Promise<any[]>;
    _processQueue(): void;
    /** Orchestrator stats — liquid architecture view */
    getStats(): {
        architecture: string;
        totalSupervisors: number;
        maxConcurrent: any;
        completedTasks: number;
        failedTasks: number;
        queuedTasks: number;
        handlersRegistered: any[];
        uptime: number;
        groups: {};
        supervisors: any[];
        recentScaleEvents: any[];
        recentTasks: {
            action: any;
            ok: any;
            latency: any;
            agent: any;
            serviceGroup: any;
        }[];
    };
    shutdown(): void;
    /** Express routes */
    registerRoutes(app: any): void;
}
export function getOrchestrator(options: any): any;
import EventEmitter = require("events");
//# sourceMappingURL=agent-orchestrator.d.ts.map
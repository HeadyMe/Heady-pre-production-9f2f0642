export class AutoSuccessEngine extends EventEmitter<[never]> {
    /** Category → Bee domain mapping.
     *  Every task category maps to a bee that does the REAL work.
     *  No passive observation — bees detect, adjust, and learn instantly. */
    static CAT_TO_BEE: {
        learning: string;
        optimization: string;
        integration: string;
        monitoring: string;
        maintenance: string;
        discovery: string;
        verification: string;
        creative: string;
        'deep-intel': string;
        'hive-integration': string;
        trading: string;
        security: string;
        ops: string;
        governance: string;
        telemetry: string;
        intelligence: string;
        ui: string;
        enterprise: string;
        orchestration: string;
        devops: string;
        core: string;
        mcp: string;
        ml: string;
        compliance: string;
        research: string;
        'output-format': string;
        presentation: string;
        'duckdb-memory': string;
        database: string;
        'liquid-federation': string;
        'edge-routing': string;
        'pqc-security': string;
        'mesh-resiliency': string;
        architecture: string;
        quality: string;
        vision: string;
        mission: string;
        development: string;
    };
    constructor(opts?: {});
    running: boolean;
    safeMode: boolean;
    reactionCount: number;
    totalSucceeded: number;
    startedAt: number | null;
    lastReactionTs: string | null;
    _reacting: boolean;
    taskStates: Map<any, any>;
    history: any;
    _trialLedger: any;
    _failureSignatures: Map<any, any>;
    _patternEngine: any;
    _selfCritique: any;
    _storyDriver: any;
    _resourceManager: any;
    _eventBus: any;
    /** Wire external systems for feedback loops. */
    wire(systems?: {}): void;
    _wireResourceManager(rm: any): void;
    start(): void;
    stop(): void;
    enterSafeMode(): void;
    exitSafeMode(): void;
    react(trigger?: string, eventData?: {}): Promise<void>;
    /** Select ALL eligible tasks — no batch limits, fully dynamic.
     *  In safe mode, hot pool tasks are excluded. Priority ordered: hot → warm → cold. */
    _selectAll(): any[];
    /** Execute a single task with deterministic terminal state enforcement.
     *  Every task MUST resolve to an explicit terminal state:
     *  completed | failed_closed | escalated | timed_out_recovered
     *  No implicit closures. No silent drops. */
    _executeTask(task: any): Promise<{
        taskId: any;
        name: any;
        cat: any;
        pool: any;
        success: boolean;
        terminalState: "completed";
        durationMs: number;
        finding: any;
        absorbed: boolean;
        strategyShifted: boolean;
        inputHash: string;
        outputHash: string;
        reaction: number;
        ts: any;
    }>;
    /** Delegate to a bee — fire ALL its workers PLUS dynamic workers for every mapped task.
     *  Each bee fires ONCE per reaction. Task descriptions become workers.
     *  This is the most effective model: no N×M redundancy, full coverage. */
    _delegateToBee(beeDomain: any, tasks: any): Promise<{
        domain: any;
        coreWorkers: any;
        dynamicWorkers: any;
        totalFired: number;
        adjustments: any;
        absorbed: any;
        results: any;
    }>;
    /** React: group tasks by bee domain, fire each bee ONCE.
     *  Most effective: no redundancy, every task covered, every bee fires exactly once. */
    _performWork(task: any): Promise<{
        domain: any;
        coreWorkers: any;
        dynamicWorkers: any;
        totalFired: number;
        adjustments: any;
        absorbed: any;
        results: any;
    } | {
        finding: string;
        adjusted: boolean;
    }>;
    _hashInput(...args: any[]): string;
    _checkRepeat(taskId: any, inputHash: any): {
        isRepeat: boolean;
        count: any;
    };
    _recordTrial(entry: any): void;
    _loadTrialLedger(): any;
    _saveTrialLedger(): void;
    getTrialLedger(opts?: {}): {
        total: any;
        filtered: any;
        entries: any;
        terminalStates: ("completed" | "failed_closed" | "escalated" | "timed_out_recovered")[];
    };
    _recordAudit(action: any, target: any, data?: {}): void;
    _auditTrail: any;
    _loadAudit(): any;
    _saveAudit(): void;
    getAuditTrail(opts?: {}): {
        total: any;
        filtered: any;
        entries: any;
        actions: any[];
        targets: any[];
    };
    getStatus(): {
        engine: string;
        running: boolean;
        safeMode: boolean;
        cycleCount: number;
        totalTasks: number;
        totalSucceeded: number;
        successRate: string;
        ors: number;
        intervalMs: any;
        mode: string;
        lastReactionTs: string | null;
        uptime: number;
        categories: {};
        ts: string;
    };
    getHealth(): {
        status: string;
        service: string;
        mode: string;
        ors: number;
        successRate: string;
        cycleCount: number;
        totalSucceeded: number;
        catalogSize: number;
        safeMode: boolean;
        uptime: number;
        ts: string;
    };
    getTaskCatalog(category: any): {
        id: any;
        name: any;
        cat: any;
        pool: any;
        weight: any;
        desc: any;
        runs: any;
        successes: any;
        lastRunTs: any;
        lastDurationMs: any;
        avgDurationMs: any;
        status: any;
        lastFinding: any;
    }[];
    getHistory(limit?: number): any;
    /** Merge external tasks (from auto-flow-200-tasks.json) into the live catalog. */
    loadExternalTasks(externalTasks: any): number;
    /** Summary for HeadyConductor integration. */
    getConductorSummary(): {
        engine: string;
        running: boolean;
        safeMode: boolean;
        cycleCount: number;
        totalSucceeded: number;
        ors: number;
        catalogSize: number;
        byPool: {
            hot: number;
            warm: number;
            cold: number;
        };
        byCat: {};
        lastReactionTs: string | null;
    };
    _loadHistory(): any;
    _saveHistory(): void;
}
export function registerAutoSuccessRoutes(app: any, engine: any): void;
export const TASK_CATALOG: any[];
export const REACTION_TRIGGERS: string[];
export const TERMINAL_STATES: Readonly<{
    COMPLETED: "completed";
    FAILED_CLOSED: "failed_closed";
    ESCALATED: "escalated";
    TIMED_OUT_RECOVERED: "timed_out_recovered";
}>;
import EventEmitter = require("events");
//# sourceMappingURL=hc_auto_success.d.ts.map
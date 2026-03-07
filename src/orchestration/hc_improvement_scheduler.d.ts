export class ImprovementScheduler {
    constructor(opts?: {});
    interval: any;
    pipeline: any;
    patternEngine: any;
    selfCritiqueEngine: any;
    mcPlanScheduler: any;
    running: boolean;
    cycleCount: number;
    lastCycleTs: string | null;
    lastResult: any;
    errors: any[];
    maxErrors: number;
    _timer: any;
    start(): void;
    stop(): void;
    _runCycle(): Promise<void>;
    getStatus(): {
        running: boolean;
        intervalMs: any;
        intervalHuman: string;
        cycleCount: number;
        lastCycleTs: string | null;
        lastStatus: any;
        recentErrors: any[];
        pipelineLoaded: boolean;
        ts: string;
    };
}
export function registerImprovementRoutes(app: any, scheduler: any): void;
//# sourceMappingURL=hc_improvement_scheduler.d.ts.map
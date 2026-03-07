export function runOptimizationCycle(vectorMem: any): Promise<{
    cycle: number;
    duration: number;
    benchScores: {} | null;
    tunings: {
        provider: string;
        oldWeight: any;
        newWeight: number;
        reason: string;
    }[];
    skills: {
        active: number;
        total: number;
    };
    connectors: {
        ready: number;
        total: number;
    };
    improvements: {
        type: string;
        message: string;
        priority: string;
    }[];
    routingWeights: {
        hf: number;
        headypythia: number;
        headyjules: number;
        local: number;
        edge: number;
    };
}>;
export function registerRoutes(app: any, vectorMem: any): void;
export namespace optState {
    let cycleCount: number;
    let lastRun: null;
    namespace routingWeights {
        let hf: number;
        let headypythia: number;
        let headyjules: number;
        let local: number;
        let edge: number;
    }
    let providerScores: {};
    let skills: never[];
    let connectors: never[];
    let improvements: never[];
    let started: number;
}
export namespace heartbeat {
    export let status: string;
    export let lastCycleAt: null;
    let cycleCount_1: number;
    export { cycleCount_1 as cycleCount };
    export let consecutiveErrors: number;
    export let totalErrors: number;
    export let lastError: null;
    export let lastErrorAt: null;
    export let intervalMs: any;
    export let baseIntervalMs: any;
    export let recoveries: number;
    export let proofOfLifeStored: number;
    export let startedAt: number;
}
export function startContinuousLoop(vectorMem: any): void;
export function stopContinuousLoop(): void;
//# sourceMappingURL=self-optimizer.d.ts.map
export class HeadyBees extends EventEmitter<[never]> {
    constructor();
    activeBees: Map<any, any>;
    dissolvedCount: number;
    totalSpawned: number;
    totalBlasts: number;
    metrics: {
        totalBees: number;
        totalBlasts: number;
        totalWorkMs: number;
        avgBeesPerBlast: number;
        avgBlastDurationMs: number;
        peakConcurrency: number;
        fastestBlastMs: number;
        slowestBlastMs: number;
    };
    blastHistory: any[];
    bootTime: number;
    /**
     * BLAST — the primary operation.
     *
     * Takes a task, calculates how many bees to spawn,
     * materializes them instantly, executes all in parallel,
     * merges results, dissolves bees back into the pool.
     *
     * @param {Object} task - The task/obstacle to overcome
     * @param {string} task.name - Human-readable task name
     * @param {number} [task.urgency] - 0.0–1.0 sliding dial, how urgently to blast (default 0.7)
     * @param {Function[]} task.work - Array of work functions, one per subtask
     *   Each function receives (bee) and returns a result.
     *   The swarm materializes exactly as many bees as the work demands.
     * @param {Object} [task.context] - Optional context passed to each bee
     * @returns {Object} Blast result with merged outputs from all bees
     */
    blast(task: {
        name: string;
        urgency?: number | undefined;
        work: Function[];
        context?: Object | undefined;
    }): Object;
    /** Blast a single function across N parallel bees (same work, N copies) */
    blastParallel(name: any, fn: any, count: any, context?: {}): Promise<Object>;
    /** Blast an array of independent tasks — one bee per task */
    blastAll(name: any, tasks: any): Promise<Object>;
    /** Blast a file operation across multiple files simultaneously */
    blastFiles(name: any, files: any, processor: any): Promise<Object>;
    /** Blast an HTTP check across multiple URLs simultaneously */
    blastHealth(urls: any): Promise<Object>;
    /** Blast deployment to multiple targets simultaneously */
    blastDeploy(targets: any): Promise<Object>;
    /**
     * Blast-decompose a god class into domain-specific work units.
     *
     * Takes a module's responsibilities as domain-keyed work functions,
     * and blasts them all simultaneously. The swarm decides how many
     * bees to fire up — not the developer.
     *
     * @param {string} name - Name of the decomposition blast
     * @param {Object} domains - { domainName: workFunction, ... }
     * @param {number} [urgency] - 0-1 urgency dial (default: golden ratio)
     * @returns {Object} Blast result with per-domain outputs
     */
    blastDecompose(name: string, domains: Object, urgency?: number): Object;
    /**
     * Blast all registered bee workers from the registry.
     * Auto-discovers available workers and blasts them ALL IN PARALLEL.
     * The swarm decides parallelism — not the developer.
     *
     * @param {Object} context - Context passed to all workers
     * @returns {Object[]} Array of blast results
     */
    blastRegistry(context?: Object): Object[];
    /** Enter safe mode — reduce concurrency for resource conservation */
    enterSafeMode(): void;
    _safeMode: boolean | undefined;
    /** Exit safe mode — restore full concurrency */
    exitSafeMode(): void;
    /** Auto-blast a specific bee domain (used by projection staleness events) */
    autoBlast(domain: any, context?: {}): Promise<Object | {
        ok: boolean;
        error: string;
    }>;
    /**
     * Calculate the EXACT number of bees on a continuous sliding scale.
     *
     * No steps. No categories. Golden ratio governs the curve.
     *
     *   bees = ⌈ workItems × urgency × resources × efficiency × history ⌉
     *
     * Golden ratio properties:
     *   • Efficiency = e^(-k × activeBees) where k = φ·ln(φ)/maxBees
     *   • At maxBees/φ active bees → efficiency = exactly 1/φ (0.618...)
     *   • Default urgency = 1/φ (natural resting state)
     *   • Resource floor = 1/φ³ (emergency threshold)
     *   • History factor slides [1/φ, 1.0] — past performance shapes future
     */
    _calculateBeeCount(task: any): number;
    /** Materialize N bees from the liquid pool */
    _materialize(count: any, taskName: any): Bee[];
    /** Assign work items to bees — round-robin if more work than bees */
    _assignWork(bees: any, workItems: any): {
        bee: any;
        work: any;
    }[];
    /** Get current resource availability (0-1 scale) */
    _getResourceAvailability(): {
        available: number;
        heapUsedPercent: number;
        activeBees: number;
    };
    /** Record blast metrics */
    _recordBlastMetrics(beeCount: any, durationMs: any): void;
    getStatus(): {
        service: string;
        metaphor: string;
        activeBees: number;
        dissolved: number;
        totalSpawned: number;
        metrics: {
            fastestBlastMs: number;
            totalBees: number;
            totalBlasts: number;
            totalWorkMs: number;
            avgBeesPerBlast: number;
            avgBlastDurationMs: number;
            peakConcurrency: number;
            slowestBlastMs: number;
        };
        resources: {
            available: number;
            heapUsedPercent: number;
            activeBees: number;
        };
        recentBlasts: {
            id: any;
            task: any;
            bees: any;
            succeeded: any;
            failed: any;
            durationMs: any;
            ts: any;
        }[];
        uptime: number;
        ts: string;
    };
    getBlastHistory(limit?: number): any[];
}
export class Bee {
    constructor(id: any, role: any);
    id: any;
    role: any;
    status: string;
    spawnedAt: number;
    startedAt: number | null;
    completedAt: number | null;
    result: any;
    error: any;
    execute(work: any): Promise<{
        ok: boolean;
        beeId: any;
        result: any;
        durationMs: number;
        error?: undefined;
    } | {
        ok: boolean;
        beeId: any;
        error: any;
        durationMs: number;
        result?: undefined;
    }>;
    dissolve(): {
        id: any;
        role: any;
        lifespan: number;
        workDuration: number;
    };
}
export function registerBeesRoutes(app: any, bees: any): void;
export namespace SWARM_PARAMS {
    export { PHI as phi };
    export let minBees: number;
    export const maxBees: number;
    export let baseLatencyMs: number;
    export const efficiencyDecay: number;
    export { PHI_INV as defaultUrgency };
    export let resourceFloor: number;
}
import { EventEmitter } from "events";
declare const PHI: number;
declare const PHI_INV: number;
export {};
//# sourceMappingURL=heady-bees.d.ts.map
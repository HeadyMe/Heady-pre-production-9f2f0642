export class HeadyCloudOrchestrator extends EventEmitter<[never]> {
    constructor(opts?: {});
    workerPool: CloudWorkerPool;
    vectorMerge: VectorMergeEngine;
    autoDeploy: AutoDeployPipeline;
    running: boolean;
    cycleCount: number;
    bootTime: number | null;
    /** Start the orchestrator — spin up all worker nodes */
    start(): number | undefined;
    /**
     * Run a full autonomous cycle — the Heady Intelligence Pipeline:
     *
     *   Phase 1: RESEARCH — HeadyResearch gathers best practices, competitive intel, context
     *   Phase 2: DECOMPOSE — HeadyDecomp analyzes architecture, identifies improvement targets
     *   Phase 3: CONTEST — HeadyMC + HeadyBattle generate competing solutions (informed by research)
     *   Phase 4: CODE — HeadyCoder builds actual improvements from contest winners
     *   Phase 5: SIMULATE — HeadySims validates the coded changes
     *   Phase 6: MERGE — 3D vector space selects optimal output
     *   Phase 7: SECURITY — HeadyGuard validates before deploy
     *   Phase 8: DEPLOY — HeadyBot pushes to GitHub + Cloud Run + CF Workers
     *
     * Research always runs first. Nothing changes without understanding first.
     */
    runCycle(task: any): Promise<{
        ok: boolean;
        cycleId: string;
        durationMs: number;
        phases: number;
        candidates: number;
        winner: {
            node: any;
            vector: any;
            magnitude: any;
        };
        mergeRecord: {
            id: string;
            candidates: any;
            winner: {
                node: any;
                magnitude: any;
                vector: any;
            };
            runners: any;
            ts: string;
        };
        researchFindings: any;
        securityPassed: boolean;
        deployed: boolean;
        phaseResults: {
            research: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            decompose: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            contest: {
                candidates: number;
            };
            code: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            simulate: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            merge: {
                id: string;
                candidates: any;
                winner: {
                    node: any;
                    magnitude: any;
                    vector: any;
                };
                runners: any;
                ts: string;
            };
            security: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            deploy: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            } | null;
        };
    } | {
        ok: boolean;
        cycleId: string;
        reason: string;
        phaseResults: {
            research: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            decompose: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            contest: {
                candidates: number;
            };
            code: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            simulate: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            merge: {
                id: string;
                candidates: any;
                winner: {
                    node: any;
                    magnitude: any;
                    vector: any;
                };
                runners: any;
                ts: string;
            };
            security: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            };
            deploy: {
                ok: boolean;
                taskId: string;
                worker: any;
                durationMs: number;
                result: any;
                error?: undefined;
            } | {
                ok: boolean;
                taskId: string;
                worker: any;
                error: any;
                durationMs?: undefined;
                result?: undefined;
            } | {
                queued: boolean;
                queuePosition: number;
            } | null;
        };
    }>;
    stop(): void;
    getStatus(): {
        orchestrator: string;
        running: boolean;
        cycleCount: number;
        uptime: number;
        workerPool: {
            totalNodes: number;
            activeNodes: number;
            queueDepth: number;
            metrics: {
                started: number;
                completed: number;
                failed: number;
                totalDurationMs: number;
            };
            uptime: number;
            nodes: {};
        };
        vectorMerge: {
            totalMerges: number;
            recentMerges: any[];
            dimensions: string[];
        };
        deployHistory: any[];
        ts: string;
    };
}
export class CloudWorkerPool extends EventEmitter<[never]> {
    constructor();
    workers: Map<any, any>;
    taskQueue: any[];
    activeTasks: Map<any, any>;
    metrics: {
        started: number;
        completed: number;
        failed: number;
        totalDurationMs: number;
    };
    bootTime: number;
    /** Spin up all configured worker nodes */
    spinUp(): number;
    /** Assign a task to the best available worker for the given role */
    dispatch(role: any, task: any): Promise<{
        ok: boolean;
        taskId: string;
        worker: any;
        durationMs: number;
        result: any;
        error?: undefined;
    } | {
        ok: boolean;
        taskId: string;
        worker: any;
        error: any;
        durationMs?: undefined;
        result?: undefined;
    } | {
        queued: boolean;
        queuePosition: number;
    }>;
    /** Execute task on a specific worker */
    _executeOnWorker(worker: any, task: any): Promise<{
        ok: boolean;
        taskId: string;
        worker: any;
        durationMs: number;
        result: any;
        error?: undefined;
    } | {
        ok: boolean;
        taskId: string;
        worker: any;
        error: any;
        durationMs?: undefined;
        result?: undefined;
    }>;
    _findWorkerForRole(role: any): any;
    _drainQueue(): void;
    getStatus(): {
        totalNodes: number;
        activeNodes: number;
        queueDepth: number;
        metrics: {
            started: number;
            completed: number;
            failed: number;
            totalDurationMs: number;
        };
        uptime: number;
        nodes: {};
    };
}
export class VectorMergeEngine {
    merges: any[];
    dimensions: string[];
    /**
     * Score a candidate output in 3D vector space.
     * Each dimension is 0-1, producing a point in the unit cube.
     */
    score(candidate: any): {
        quality: number;
        performance: number;
        security: number;
    };
    /** Merge multiple candidates by selecting winner per file based on 3D distance from ideal */
    merge(candidates: any): {
        winner: any;
        mergeRecord: {
            id: string;
            candidates: any;
            winner: {
                node: any;
                magnitude: any;
                vector: any;
            };
            runners: any;
            ts: string;
        };
    };
    _scoreQuality(candidate: any): number;
    _scorePerformance(candidate: any): number;
    _scoreSecurity(candidate: any): number;
    getStats(): {
        totalMerges: number;
        recentMerges: any[];
        dimensions: string[];
    };
}
export class AutoDeployPipeline extends EventEmitter<[never]> {
    constructor(opts?: {});
    deployHistory: any[];
    githubToken: any;
    cfToken: any;
    gcpCreds: any;
    /**
     * Deploy a set of files to all targets.
     * files: [{ path: "src/foo.js", content: "..." }, ...]
     */
    deploy(files: any, commitMessage?: string): Promise<{
        id: string;
        files: any;
        results: {
            github: null;
            cloudrun: null;
            workers: null;
            ts: string;
        };
    }>;
    /** Push files to GitHub via the Contents API */
    _pushToGitHub(files: any, message: any): Promise<{
        ok: boolean;
        error: string;
        files?: undefined;
        results?: undefined;
    } | {
        ok: boolean;
        files: number;
        results: ({
            path: any;
            ok: boolean;
            status: number;
            error?: undefined;
        } | {
            path: any;
            ok: boolean;
            error: any;
            status?: undefined;
        })[];
        error?: undefined;
    }>;
    /** Trigger Cloud Run deploy via GitHub Actions dispatch */
    _triggerCloudRunDeploy(): Promise<{
        ok: boolean;
        error: string;
        status?: undefined;
    } | {
        ok: boolean;
        status: number;
        error?: undefined;
    }>;
    /** Deploy Cloudflare Worker via API */
    _deployWorker(files: any): Promise<{
        ok: boolean;
        error: string;
        note?: undefined;
        files?: undefined;
    } | {
        ok: boolean;
        note: string;
        files: any;
        error?: undefined;
    }>;
    getHistory(limit?: number): any[];
}
export function registerOrchestratorRoutes(app: any, orchestrator: any): void;
export const WORKER_NODE_ROLES: {
    "heady-jules": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-coder": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-research": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-mc": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-sims": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-decomp": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-battle": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-forge": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-guard": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-bot": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-patterns": {
        role: string;
        concurrency: number;
        pool: string;
    };
    "heady-observer": {
        role: string;
        concurrency: number;
        pool: string;
    };
};
export namespace DEPLOY_TARGETS {
    namespace github {
        let type: string;
        let repo: string;
    }
    namespace cloudrun {
        let type_1: string;
        export { type_1 as type };
        export let project: string;
        export let service: string;
        export let region: string;
    }
    namespace workers {
        let type_2: string;
        export { type_2 as type };
        export let name: string;
    }
}
import { EventEmitter } from "events";
//# sourceMappingURL=cloud-orchestrator.d.ts.map
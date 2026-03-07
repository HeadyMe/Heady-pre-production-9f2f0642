export class WorkerPool {
    constructor(opts?: {});
    size: any;
    workers: any[];
    queue: any[];
    activeJobs: number;
    execute(taskFn: any, data: any): Promise<any>;
    _runJob(job: any): void;
    _processQueue(): void;
    getStats(): {
        poolSize: any;
        active: number;
        queued: number;
    };
    terminate(): Promise<void>;
}
export function batchEmbed(texts: any, embedFn: any, opts?: {}): Promise<any[]>;
//# sourceMappingURL=worker-pool.d.ts.map
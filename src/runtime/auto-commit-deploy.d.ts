export = autoCommitDeploy;
declare const autoCommitDeploy: AutoCommitDeploy;
declare class AutoCommitDeploy {
    constructor(opts?: {});
    interval: any;
    enabled: boolean;
    running: boolean;
    timer: NodeJS.Timeout | null;
    cycleCount: number;
    lastCommitHash: string | null;
    lastPushTs: number | null;
    stats: {
        commits: number;
        pushes: number;
        errors: number;
        noChanges: number;
    };
    /** Start the auto-commit/push cycle */
    start(): void;
    /** Stop the cycle */
    stop(): void;
    /** Single commit-push cycle */
    _cycle(): void;
    /** Async push to avoid blocking the Node.js event loop */
    _pushAsync(): void;
    /** Synchronous exec helper */
    _exec(cmd: any): string;
    /** Get current status */
    getStatus(): {
        enabled: boolean;
        running: boolean;
        cycleCount: number;
        intervalMs: any;
        lastCommitHash: string | null;
        lastPushTs: number | null;
        stats: {
            commits: number;
            pushes: number;
            errors: number;
            noChanges: number;
        };
    };
}
//# sourceMappingURL=auto-commit-deploy.d.ts.map
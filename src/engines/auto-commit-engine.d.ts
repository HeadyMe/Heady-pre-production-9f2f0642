export class AutoCommitEngine extends EventEmitter<[never]> {
    constructor(opts?: {});
    repoRoot: any;
    branch: any;
    remote: any;
    consecutiveFailures: number;
    lastCommitHash: string | null;
    lastPushAt: string | null;
    stats: {
        totalCommits: number;
        totalPushes: number;
        failedPushes: number;
        filesCommitted: number;
    };
    _log(level: any, msg: any): void;
    _acquireLock(): boolean;
    _releaseLock(): void;
    _exec(cmd: any): string;
    _hasChanges(): boolean;
    _getChangeSummary(): {
        fileCount: number;
        notable: string[];
        summaryLine: string;
    } | null;
    _buildCommitMessage(summary: any): string;
    /**
     * Main entry point — commit all pending changes and push.
     * @param {Object} opts
     * @param {string} opts.context - Optional context (e.g. "pipeline_run:run_123")
     * @returns {Object} { committed, pushed, commitHash, message, error }
     */
    autoCommitAndPush(opts?: {
        context: string;
    }): Object;
    getStatus(): Promise<{
        engine: string;
        version: string;
        repoRoot: any;
        branch: any;
        remote: any;
        hasUncommittedChanges: boolean;
        pendingFileCount: number;
        lastCommitHash: string | null;
        lastPushAt: string | null;
        consecutiveFailures: number;
        stats: {
            totalCommits: number;
            totalPushes: number;
            failedPushes: number;
            filesCommitted: number;
        };
    }>;
    /**
     * Register this engine as an HCFP pipeline task handler.
     * @param {Function} registerTaskHandler - from hc_pipeline.js
     */
    registerWithPipeline(registerTaskHandler: Function): void;
}
export const autoCommitEngine: AutoCommitEngine;
import EventEmitter = require("events");
//# sourceMappingURL=auto-commit-engine.d.ts.map
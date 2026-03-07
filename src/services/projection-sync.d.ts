export class ProjectionSyncAutomation {
    constructor(options?: {});
    targets: any;
    syncHistory: any[];
    rollbackStack: any[];
    maxHistory: any;
    projectRoot: any;
    /**
     * Create a deterministic receipt for a sync operation.
     */
    createReceipt(data: any): {
        hash: string;
        timestamp: string;
        data: any;
    };
    /**
     * Run a scheduled projection diff and sync to targets.
     */
    runProjectionSync(projectionState: any): Promise<{
        receipt: {
            hash: string;
            timestamp: string;
            data: any;
        };
        results: {};
    }>;
    /**
     * Sync to a specific target.
     */
    syncToTarget(target: any, state: any, receipt: any): Promise<{
        status: string;
        target: string;
        receipt: any;
        message: string;
        commitHash?: undefined;
        changedFiles?: undefined;
        vectorsProjected?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        commitHash: string;
        changedFiles: number;
        vectorsProjected: number;
        message?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        error: any;
        message?: undefined;
        commitHash?: undefined;
        changedFiles?: undefined;
        vectorsProjected?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        spacesUpdated: ({
            space: string;
            status: string;
            reason: string;
            error?: undefined;
        } | {
            space: string;
            status: string;
            reason?: undefined;
            error?: undefined;
        } | {
            space: string;
            status: string;
            error: any;
            reason?: undefined;
        })[];
    } | {
        status: string;
        target: string;
        receipt: any;
        reason: string;
        service?: undefined;
        region?: undefined;
        projectId?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        service: string;
        region: string;
        projectId: string;
        reason?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        error: any;
        reason?: undefined;
        service?: undefined;
        region?: undefined;
        projectId?: undefined;
    } | {
        status: string;
        reason: string;
    }>;
    /**
     * Sync projection to GitHub monorepo.
     * Uses git CLI to stage, commit, and push changes.
     */
    syncToGitHub(state: any, receipt: any): Promise<{
        status: string;
        target: string;
        receipt: any;
        message: string;
        commitHash?: undefined;
        changedFiles?: undefined;
        vectorsProjected?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        commitHash: string;
        changedFiles: number;
        vectorsProjected: number;
        message?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        error: any;
        message?: undefined;
        commitHash?: undefined;
        changedFiles?: undefined;
        vectorsProjected?: undefined;
    }>;
    /**
     * Sync projection to HuggingFace Spaces.
     * Uses the HuggingFace API to trigger space rebuilds.
     */
    syncToHuggingFace(state: any, receipt: any): Promise<{
        status: string;
        target: string;
        receipt: any;
        spacesUpdated: ({
            space: string;
            status: string;
            reason: string;
            error?: undefined;
        } | {
            space: string;
            status: string;
            reason?: undefined;
            error?: undefined;
        } | {
            space: string;
            status: string;
            error: any;
            reason?: undefined;
        })[];
    }>;
    /**
     * Fallback: sync HuggingFace spaces via git push.
     */
    _syncHuggingFaceViaGit(spaces: any, receipt: any): Promise<{
        status: string;
        target: string;
        receipt: any;
        spacesUpdated: ({
            space: string;
            status: string;
            reason: string;
            error?: undefined;
        } | {
            space: string;
            status: string;
            reason?: undefined;
            error?: undefined;
        } | {
            space: string;
            status: string;
            error: any;
            reason?: undefined;
        })[];
    }>;
    /**
     * Sync projection to Cloud Run via gcloud deploy.
     */
    syncToCloudRun(state: any, receipt: any): Promise<{
        status: string;
        target: string;
        receipt: any;
        reason: string;
        service?: undefined;
        region?: undefined;
        projectId?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        service: string;
        region: string;
        projectId: string;
        reason?: undefined;
        error?: undefined;
    } | {
        status: string;
        target: string;
        receipt: any;
        error: any;
        reason?: undefined;
        service?: undefined;
        region?: undefined;
        projectId?: undefined;
    }>;
    /**
     * Rollback to a previous sync state using receipt replay.
     */
    rollback(receiptHash: any): Promise<{
        status: string;
        error: string;
        originalReceipt?: undefined;
        rollbackReceipt?: undefined;
        restoredState?: undefined;
    } | {
        status: string;
        originalReceipt: any;
        rollbackReceipt: string;
        restoredState: any;
        error?: undefined;
    }>;
    /**
     * Get sync history with receipts.
     */
    getHistory(): {
        entries: number;
        latest: any;
        rollbackDepth: number;
    };
    /**
     * Health check.
     */
    getHealth(): {
        status: string;
        targets: any;
        syncHistory: number;
        rollbackDepth: number;
    };
}
//# sourceMappingURL=projection-sync.d.ts.map
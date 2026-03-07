export class BranchAutomationService extends EventEmitter<[never]> {
    constructor(config?: {});
    config: {
        enabled: boolean;
        continuous_mode: boolean;
        validation_required: boolean;
        sync_interval: number;
        auto_merge_enabled: boolean;
        rollback_capability: boolean;
        monitoring_enabled: boolean;
    };
    branches: {
        development: {
            description: string;
            source: string;
            destination: string;
            last_sync: number;
            sync_count: number;
            validation_required: boolean;
            auto_merge: boolean;
        };
        staging: {
            description: string;
            source: string;
            destination: string;
            last_sync: number;
            sync_count: number;
            validation_required: boolean;
            auto_merge: boolean;
        };
        main: {
            description: string;
            source: string;
            destination: string;
            last_sync: number;
            sync_count: number;
            validation_required: boolean;
            auto_merge: boolean;
        };
    };
    syncQueue: any[];
    activeSyncs: Map<any, any>;
    completedSyncs: any[];
    rollbackHistory: any[];
    validationResults: Map<any, any>;
    isRunning: boolean;
    metrics: {
        syncsCompleted: number;
        averageSyncTime: number;
        successRate: number;
        rollbackRate: number;
        uptime: number;
        lastSync: number;
        currentBranch: string;
    };
    currentBranch: string;
    gitStatus: {};
    start(): Promise<void>;
    startTime: number | undefined;
    syncLoop: NodeJS.Timeout | undefined;
    monitoringLoop: NodeJS.Timeout | undefined;
    metricsLoop: NodeJS.Timeout | undefined;
    validationLoop: NodeJS.Timeout | undefined;
    stop(): Promise<void>;
    updateGitStatus(): Promise<void>;
    queueSync(branchName: any, options?: {}): Promise<number>;
    processSyncQueue(): Promise<void>;
    processSync(sync: any): Promise<void>;
    validateSync(sync: any): Promise<any>;
    validateDevelopmentSync(sync: any): Promise<{
        valid: boolean;
        reason: string;
        HeadyBattleScore?: undefined;
    } | {
        valid: boolean;
        reason: string;
        HeadyBattleScore: number;
    }>;
    validateStagingSync(sync: any): Promise<{
        valid: boolean;
        reason: string;
        arenaReady?: undefined;
        mcConfidence?: undefined;
    } | {
        valid: boolean;
        reason: string;
        arenaReady: {
            ready: boolean;
            championScore: number;
            reason: string;
        };
        mcConfidence: number;
    }>;
    validateMainSync(sync: any): Promise<{
        valid: boolean;
        reason: string;
        productionReady?: undefined;
    } | {
        valid: boolean;
        reason: string;
        productionReady: {
            ready: boolean;
            securityScore: number;
            reason: string;
        };
    }>;
    checkArenaModeReadiness(): Promise<{
        ready: boolean;
        championScore: number;
        reason: string;
    }>;
    checkProductionReadiness(): Promise<{
        ready: boolean;
        securityScore: number;
        reason: string;
    }>;
    executeSync(sync: any): Promise<{
        success: boolean;
        duration: number;
        commitMessage: string;
        destination: any;
    }>;
    generateCommitMessage(sync: any): string;
    attemptRollback(sync: any, error: any): Promise<void>;
    monitorBranches(): Promise<void>;
    shouldTriggerSync(branchName: any, branch: any): boolean;
    monitorValidations(): void;
    updateMetrics(): void;
    getStatus(): {
        isRunning: boolean;
        uptime: number;
        syncsCompleted: number;
        activeSyncs: number;
        queueSize: number;
        averageSyncTime: number;
        successRate: number;
        rollbackRate: number;
        lastSync: number;
        currentBranch: string;
        gitStatus: {};
    };
    getBranchReport(): {
        timestamp: number;
        branches: {};
        recentSyncs: any[];
        recommendations: never[];
    };
    sleep(ms: any): Promise<any>;
}
export function getBranchAutomationService(config?: {}): any;
import EventEmitter = require("events");
//# sourceMappingURL=branch-automation-service.d.ts.map
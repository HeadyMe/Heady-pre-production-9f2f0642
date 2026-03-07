declare const _exports: LiquidAutonomyController;
export = _exports;
declare class LiquidAutonomyController {
    startedAt: number;
    triggerHistory: any[];
    heartbeatHistory: any[];
    topicConfig: {
        standard: string;
        admin: string;
    };
    enqueueAdminTrigger(payload?: {}): {
        id: string;
        lane: string;
        topic: string;
        requestedBy: any;
        source: any;
        command: any;
        constraints: {
            removeStandardResourceLimits: boolean;
            godBeeProfile: {
                cpu: string;
                memory: string;
                timeoutSec: number;
                retries: number;
            };
            governanceResolutionMode: string;
        };
        projection: {
            destination: string;
            strategy: string;
        };
        ts: string;
    };
    runHeartbeatJob(jobId: any): {
        id: string;
        jobId: string;
        topic: string;
        task: string;
        lane: string;
        remediationMode: string;
        status: string;
        ts: string;
    } | null;
    getBlueprint(): {
        dualPipelines: {
            adminGodMode: {
                topic: string;
                lane: string;
                orchestratorResourceProfile: {
                    cpu: string;
                    memory: string;
                    timeoutSec: number;
                    retries: number;
                };
                autoSuccessResolver: string;
            };
            backgroundHeartbeat: {
                topic: string;
                jobs: {
                    id: string;
                    schedule: string;
                    lane: string;
                    task: string;
                    remediationMode: string;
                }[];
                scheduler: string;
            };
        };
        integrations: {
            terraformPath: string;
            maxForLiveReceiverPath: string;
            maxForLiveManufacturerId: string;
        };
        ts: string;
    };
    health(): {
        status: string;
        service: string;
        uptimeSec: number;
        topics: {
            standard: string;
            admin: string;
        };
        heartbeatsConfigured: number;
        recentAdminTriggers: any[];
        recentHeartbeats: any[];
        ts: string;
    };
}
//# sourceMappingURL=liquid-autonomy-controller.d.ts.map
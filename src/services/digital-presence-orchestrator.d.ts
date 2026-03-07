export class DigitalPresenceOrchestratorService {
    startedAt: string | null;
    templateRegistry: HeadybeeTemplateRegistryService;
    unifiedAutonomy: UnifiedEnterpriseAutonomyService;
    skills: any;
    scenarios: any;
    start(): void;
    getHealth(): {
        ok: boolean;
        service: string;
        startedAt: string | null;
        templateRegistry: {
            service: string;
            startedAt: string | null;
            endpoint: string;
            status: string;
            templateCount: any;
            coverage: number;
            registryHash: string;
        };
        unifiedAutonomy: {
            ok: boolean;
            service: string;
            startedAt: string | null;
            workerCount: any;
            queueCount: number;
            embeddingCollections: any;
            topologyPlanes: any;
            onboardingStages: any;
            dualPipelineMode: any;
            onboardingSecurityBridge: any;
            determinism: any;
            sourceOfTruth: null;
            projectionHygiene: null;
            onboardingValidation: {
                ok: boolean;
                missingStages: string[];
                missingBridge: string[];
                requiredStages: string[];
                securityBridge: any;
                evaluatedAt: string;
            };
            lastDispatchAt: string | null;
            lastProjectionAt: string | null;
        };
        scenarios: any;
    };
    recommendTemplateAndWorkflow({ scenario, tags }?: {
        scenario?: string | undefined;
        tags?: never[] | undefined;
    }): {
        scenario: string;
        recommendation: {
            scenario: string;
            tags: string[];
            top: any;
            candidates: any;
        };
        workflows: any[];
        receipt: string;
    };
    getSkillsForTags(tags?: any[], limit?: number): any[];
    evaluateTemplateCoverage(): {
        ok: boolean;
        coverage: number;
        healthy: any;
        total: any;
        scenarios: any;
        receipt: string;
    };
    buildSwarmTaskPlan({ queuePressure }?: {
        queuePressure?: {} | undefined;
    }): {
        ok: boolean;
        dispatch: {
            at: string;
            queuePressure: {};
            assignments: {
                queue: string;
                selectedWorker: any;
                candidates: any;
                deterministicReceipt: string;
            }[];
        };
        coverage: {
            ok: boolean;
            coverage: number;
            healthy: any;
            total: any;
            scenarios: any;
            receipt: string;
        };
        tasks: any;
        receipt: string;
    };
    buildUnifiedSystemProjection({ queuePressure, scenario }?: {
        queuePressure?: {} | undefined;
        scenario?: string | undefined;
    }): {
        ok: boolean;
        generatedAt: string;
        runtime: {
            architecture: string;
            serviceModel: string;
            orchestration: string[];
            templateInjection: {
                source: string;
                registryTemplate: any;
                swarmReady: boolean;
            };
            livePerformance: {
                midiBridge: string;
                target: string;
                mode: string;
            };
        };
        cloudOnlyExecution: {
            localResourceUsage: string;
            preferredExecutionPlane: string;
            colabWorkers: any;
            queues: {
                queue: string;
                worker: any;
            }[];
        };
        projectionStatus: {
            ok: boolean;
            sourceOfTruth: string;
            totalRepos: number;
            projected: any;
            missing: string[];
            coverage: number;
            generatedAt: any;
            receipt: string;
        };
        embeddingPlan: {
            profile: any;
            includePatterns: any;
            collections: any;
        };
        dispatch: {
            at: string;
            queuePressure: {};
            assignments: {
                queue: string;
                selectedWorker: any;
                candidates: any;
                deterministicReceipt: string;
            }[];
        };
        recommendation: {
            scenario: string;
            recommendation: {
                scenario: string;
                tags: string[];
                top: any;
                candidates: any;
            };
            workflows: any[];
            receipt: string;
        };
        templateCoverage: {
            ok: boolean;
            coverage: number;
            healthy: any;
            total: any;
            scenarios: any;
            receipt: string;
        };
        receipt: string;
    };
    getProjectionStatus(): {
        ok: boolean;
        sourceOfTruth: string;
        totalRepos: number;
        projected: any;
        missing: string[];
        coverage: number;
        generatedAt: any;
        receipt: string;
    };
    getMaintenancePlan(files?: any[]): {
        ok: boolean;
        staleCount: any;
        staleWorkers: any;
        staleTunnels: any;
        staleServiceWorkers: any;
        staleGCloud: any;
        protected: any;
        receipt: string;
    };
}
export function registerDigitalPresenceOrchestratorRoutes(app: any, service?: DigitalPresenceOrchestratorService): DigitalPresenceOrchestratorService;
export function deterministicReceipt(payload: any): string;
import { HeadybeeTemplateRegistryService } from "./headybee-template-registry";
import { UnifiedEnterpriseAutonomyService } from "./unified-enterprise-autonomy";
//# sourceMappingURL=digital-presence-orchestrator.d.ts.map
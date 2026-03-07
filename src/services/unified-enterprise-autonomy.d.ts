export class UnifiedEnterpriseAutonomyService {
    constructor(opts?: {});
    colabPlanPath: any;
    embeddingCatalogPath: any;
    liquidFabricPath: any;
    platformBlueprintPath: any;
    dualPipelineBlueprintPath: any;
    colabPlan: any;
    embeddingCatalog: any;
    liquidFabric: any;
    platformBlueprint: any;
    dualPipelineBlueprint: any;
    startedAt: string | null;
    lastDispatch: {
        at: string;
        queuePressure: {};
        assignments: {
            queue: string;
            selectedWorker: any;
            candidates: any;
            deterministicReceipt: string;
        }[];
    } | null;
    lastProjection: {
        generatedAt: string;
        runtimeMode: any;
        topology: {
            paradigm: any;
            planes: any;
            activeQueueCount: number;
        };
        orchestration: {
            conductor: string;
            cloudConductor: string;
            swarmRuntime: string;
            workerRuntime: string;
            deterministicScheduling: any;
        };
        templateInjection: {
            vectorWorkspaceCollections: any;
            includePatterns: any;
            projectionHealth: string;
        };
        liveMusic: {
            enabled: boolean;
            bridge: any;
            transport: any;
            targetLatencyMs: any;
        };
        resourcePolicy: {
            cloudOnlyProjection: boolean;
            localResourceTargetPercent: any;
            maxSnapshotStalenessMs: any;
            preferredTransports: any;
        };
        healthContracts: any;
        sourceOfTruthPolicy: any;
        projectionHygienePolicy: any;
        sourceOfTruth: null;
        projectionHygiene: null;
        projectionCleanupPlan: {
            generatedAt: string;
            candidateCount: number;
            trackedCandidates: number;
            localCandidates: number;
            totalSizeBytes: number;
            totalSizeMB: number;
            candidates: {
                path: any;
                tracked: boolean;
                ageHours: number;
                sizeBytes: number;
                reason: string;
            }[];
        };
        developerPlatform: {
            generatedAt: string;
            mission: any;
            entrypoint: any;
            onboarding: {
                stageCount: any;
                stages: any;
            };
            capabilities: any;
            onboardingContract: {
                generatedAt: string;
                entrypoint: any;
                auth: any;
                permissions: any;
                identity: any;
                install: any;
                customization: any;
                securityBridge: any;
                runtimeParadigm: any;
                deterministicReceipt: string;
            };
            deterministicReceipt: string;
        };
        onboardingContract: {
            generatedAt: string;
            entrypoint: any;
            auth: any;
            permissions: any;
            identity: any;
            install: any;
            customization: any;
            securityBridge: any;
            runtimeParadigm: any;
            deterministicReceipt: string;
        };
        contextFabric: {
            generatedAt: string;
            mode: string;
            coverage: any;
            queueLength: number;
            totalIngested: number;
            keepAliveEvents: any;
            bySource: {};
            deterministicReceipt: string;
        };
        syncFabric: {
            generatedAt: string;
            mode: string;
            deviceSync: any;
            authOnboarding: any;
            deterministicReceipt: string;
        };
        livingSystem: {
            generatedAt: string;
            mode: string;
            alive: any;
            selfHealPlan: any;
            autonomyDirective: string;
            deterministicReceipt: string;
        };
        godModePipeline: {
            generatedAt: string;
            lane: any;
            triggerTopic: any;
            bypassTopic: any;
            actor: any;
            triggerType: any;
            command: any;
            sandbox: any;
            governance: {
                evaluator: any;
                conflictResolution: any;
                recursiveAttempts: number;
                maxAttempts: any;
                autoSuccess: boolean;
            };
            projection: any;
            deterministicReceipt: string;
        };
        autonomousHeartbeat: {
            generatedAt: string;
            lane: any;
            scheduler: any;
            topic: any;
            tasks: any;
            runtimeHealth: {
                vitalityScore: any;
                selfHealActions: any;
                healthy: any;
            };
            deterministicReceipt: string;
        };
        abletonBridge: {
            generatedAt: string;
            enabled: boolean;
            manufacturerId: any;
            receiver: any;
            commands: any;
            deterministicReceipt: string;
        };
        liquidArchitecture: {
            generatedAt: string;
            paradigm: string;
            architecture: {
                split: string;
                projectionEngine: string;
                projectionStrategy: string;
                staleProjectionPolicy: string;
            };
            directives: string[];
            projectionOptimization: any;
            cleanupPlan: any;
            deterministicReceipt: string;
        };
        deterministicReceipt: string;
    } | null;
    lastSelfHealing: string | null;
    telemetryCache: {
        sourceOfTruth: null;
        projectionHygiene: null;
        refreshedAt: number;
        ttlMs: number;
    };
    start(): {
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
    stop(): void;
    getNodeResponsibilities(): any;
    buildEmbeddingPlan(): {
        profile: any;
        includePatterns: any;
        collections: any;
    };
    dispatch(queuePressure?: {}): {
        at: string;
        queuePressure: {};
        assignments: {
            queue: string;
            selectedWorker: any;
            candidates: any;
            deterministicReceipt: string;
        }[];
    };
    getCachedTelemetry(): {
        sourceOfTruth: null;
        projectionHygiene: null;
    };
    buildOnboardingContract(): {
        generatedAt: string;
        entrypoint: any;
        auth: any;
        permissions: any;
        identity: any;
        install: any;
        customization: any;
        securityBridge: any;
        runtimeParadigm: any;
        deterministicReceipt: string;
    };
    buildDeveloperPlatformBlueprint(): {
        generatedAt: string;
        mission: any;
        entrypoint: any;
        onboarding: {
            stageCount: any;
            stages: any;
        };
        capabilities: any;
        onboardingContract: {
            generatedAt: string;
            entrypoint: any;
            auth: any;
            permissions: any;
            identity: any;
            install: any;
            customization: any;
            securityBridge: any;
            runtimeParadigm: any;
            deterministicReceipt: string;
        };
        deterministicReceipt: string;
    };
    buildEnterpriseImprovementBacklog(architectureText?: string): {
        generatedAt: string;
        totalTasks: number;
        byTrack: any;
        tasks: any[];
        deterministicReceipt: string;
    };
    getAlwaysOnContextStatus(): {
        generatedAt: string;
        mode: string;
        coverage: any;
        queueLength: number;
        totalIngested: number;
        keepAliveEvents: any;
        bySource: {};
        deterministicReceipt: string;
    };
    getDeviceSyncFabricStatus(): {
        generatedAt: string;
        mode: string;
        deviceSync: any;
        authOnboarding: any;
        deterministicReceipt: string;
    };
    getLivingSystemStatus(): {
        generatedAt: string;
        mode: string;
        alive: any;
        selfHealPlan: any;
        autonomyDirective: string;
        deterministicReceipt: string;
    };
    buildLiquidArchitectureDirective(): {
        generatedAt: string;
        paradigm: string;
        architecture: {
            split: string;
            projectionEngine: string;
            projectionStrategy: string;
            staleProjectionPolicy: string;
        };
        directives: string[];
        projectionOptimization: any;
        cleanupPlan: any;
        deterministicReceipt: string;
    };
    buildGodModePipelineStatus(trigger?: {}): {
        generatedAt: string;
        lane: any;
        triggerTopic: any;
        bypassTopic: any;
        actor: any;
        triggerType: any;
        command: any;
        sandbox: any;
        governance: {
            evaluator: any;
            conflictResolution: any;
            recursiveAttempts: number;
            maxAttempts: any;
            autoSuccess: boolean;
        };
        projection: any;
        deterministicReceipt: string;
    };
    buildAutonomousHeartbeatStatus(): {
        generatedAt: string;
        lane: any;
        scheduler: any;
        topic: any;
        tasks: any;
        runtimeHealth: {
            vitalityScore: any;
            selfHealActions: any;
            healthy: any;
        };
        deterministicReceipt: string;
    };
    buildAbletonBridgeStatus(): {
        generatedAt: string;
        enabled: boolean;
        manufacturerId: any;
        receiver: any;
        commands: any;
        deterministicReceipt: string;
    };
    buildSystemProjectionSnapshot(): {
        generatedAt: string;
        runtimeMode: any;
        topology: {
            paradigm: any;
            planes: any;
            activeQueueCount: number;
        };
        orchestration: {
            conductor: string;
            cloudConductor: string;
            swarmRuntime: string;
            workerRuntime: string;
            deterministicScheduling: any;
        };
        templateInjection: {
            vectorWorkspaceCollections: any;
            includePatterns: any;
            projectionHealth: string;
        };
        liveMusic: {
            enabled: boolean;
            bridge: any;
            transport: any;
            targetLatencyMs: any;
        };
        resourcePolicy: {
            cloudOnlyProjection: boolean;
            localResourceTargetPercent: any;
            maxSnapshotStalenessMs: any;
            preferredTransports: any;
        };
        healthContracts: any;
        sourceOfTruthPolicy: any;
        projectionHygienePolicy: any;
        sourceOfTruth: null;
        projectionHygiene: null;
        projectionCleanupPlan: {
            generatedAt: string;
            candidateCount: number;
            trackedCandidates: number;
            localCandidates: number;
            totalSizeBytes: number;
            totalSizeMB: number;
            candidates: {
                path: any;
                tracked: boolean;
                ageHours: number;
                sizeBytes: number;
                reason: string;
            }[];
        };
        developerPlatform: {
            generatedAt: string;
            mission: any;
            entrypoint: any;
            onboarding: {
                stageCount: any;
                stages: any;
            };
            capabilities: any;
            onboardingContract: {
                generatedAt: string;
                entrypoint: any;
                auth: any;
                permissions: any;
                identity: any;
                install: any;
                customization: any;
                securityBridge: any;
                runtimeParadigm: any;
                deterministicReceipt: string;
            };
            deterministicReceipt: string;
        };
        onboardingContract: {
            generatedAt: string;
            entrypoint: any;
            auth: any;
            permissions: any;
            identity: any;
            install: any;
            customization: any;
            securityBridge: any;
            runtimeParadigm: any;
            deterministicReceipt: string;
        };
        contextFabric: {
            generatedAt: string;
            mode: string;
            coverage: any;
            queueLength: number;
            totalIngested: number;
            keepAliveEvents: any;
            bySource: {};
            deterministicReceipt: string;
        };
        syncFabric: {
            generatedAt: string;
            mode: string;
            deviceSync: any;
            authOnboarding: any;
            deterministicReceipt: string;
        };
        livingSystem: {
            generatedAt: string;
            mode: string;
            alive: any;
            selfHealPlan: any;
            autonomyDirective: string;
            deterministicReceipt: string;
        };
        godModePipeline: {
            generatedAt: string;
            lane: any;
            triggerTopic: any;
            bypassTopic: any;
            actor: any;
            triggerType: any;
            command: any;
            sandbox: any;
            governance: {
                evaluator: any;
                conflictResolution: any;
                recursiveAttempts: number;
                maxAttempts: any;
                autoSuccess: boolean;
            };
            projection: any;
            deterministicReceipt: string;
        };
        autonomousHeartbeat: {
            generatedAt: string;
            lane: any;
            scheduler: any;
            topic: any;
            tasks: any;
            runtimeHealth: {
                vitalityScore: any;
                selfHealActions: any;
                healthy: any;
            };
            deterministicReceipt: string;
        };
        abletonBridge: {
            generatedAt: string;
            enabled: boolean;
            manufacturerId: any;
            receiver: any;
            commands: any;
            deterministicReceipt: string;
        };
        liquidArchitecture: {
            generatedAt: string;
            paradigm: string;
            architecture: {
                split: string;
                projectionEngine: string;
                projectionStrategy: string;
                staleProjectionPolicy: string;
            };
            directives: string[];
            projectionOptimization: any;
            cleanupPlan: any;
            deterministicReceipt: string;
        };
        deterministicReceipt: string;
    };
    scanProjectionNoise(): {
        trackedFileCount: any;
        forbiddenRuntimeFiles: any;
        serviceWorkerFiles: any;
        cleanupCandidates: number;
        recommendRemoval: any[];
        clean: boolean;
    };
    buildProjectionCleanupPlan(): {
        generatedAt: string;
        candidateCount: number;
        trackedCandidates: number;
        localCandidates: number;
        totalSizeBytes: number;
        totalSizeMB: number;
        candidates: {
            path: any;
            tracked: boolean;
            ageHours: number;
            sizeBytes: number;
            reason: string;
        }[];
    };
    applyProjectionCleanup({ includeTracked, limit }?: {
        includeTracked?: boolean | undefined;
        limit?: number | undefined;
    }): {
        ok: boolean;
        dryRunCandidates: number;
        totalSizeMB: number;
        selected: number;
        removed: any[];
        freedBytes: number;
        freedMB: number;
        emptiedDirs: any[];
        errors: {
            path: any;
            error: any;
        }[];
        includeTracked: boolean;
        limit: number;
        executedAt: string;
    };
    /**
     * Prune empty directories that were left behind after file cleanup.
     */
    _pruneEmptyDirectories(): any[];
    _pruneEmptyDirsRecursive(dir: any, pruned: any): void;
    getSourceOfTruthStatus(): {
        branch: string | null;
        commit: string | null;
        sourceOfTruth: any;
        remotes: any;
        policy: any;
        repoPolicyAligned: boolean;
    };
    validateOnboardingAndAuthFlow(): {
        ok: boolean;
        missingStages: string[];
        missingBridge: string[];
        requiredStages: string[];
        securityBridge: any;
        evaluatedAt: string;
    };
    buildAlternateParadigmDirectives(): {
        ok: boolean;
        paradigm: string;
        directives: string[];
        runtimeMode: any;
        templateCollections: any;
        generatedAt: string;
    };
    /**
     * Self-healing cycle. Now DEFAULTS to applying cleanup when stale files exist,
     * because maintenance wasn't running when applyCleanup defaulted to false.
     */
    runSelfHealingCycle({ applyCleanup, cleanupLimit }?: {
        applyCleanup?: string | undefined;
        cleanupLimit?: number | undefined;
    }): {
        ok: boolean;
        ranAt: string;
        autoCleanupTriggered: boolean;
        hygiene: {
            trackedFileCount: any;
            forbiddenRuntimeFiles: any;
            serviceWorkerFiles: any;
            cleanupCandidates: number;
            recommendRemoval: any[];
            clean: boolean;
        };
        cleanupPlan: {
            candidateCount: number;
            totalSizeMB: number;
        };
        cleanup: {
            ok: boolean;
            selected: number;
            removed: never[];
            freedMB: number;
        };
        onboardingValidation: {
            ok: boolean;
            missingStages: string[];
            missingBridge: string[];
            requiredStages: string[];
            securityBridge: any;
            evaluatedAt: string;
        };
        directives: {
            ok: boolean;
            paradigm: string;
            directives: string[];
            runtimeMode: any;
            templateCollections: any;
            generatedAt: string;
        };
    };
    getHealth(): {
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
}
export function registerUnifiedEnterpriseAutonomyRoutes(app: any, service?: UnifiedEnterpriseAutonomyService): UnifiedEnterpriseAutonomyService;
export function rankWorkersForQueue(queue: any, queueWeight: any, workers: any, queuePressure?: {}): any;
export function createDeterministicReceipt(input: any): string;
//# sourceMappingURL=unified-enterprise-autonomy.d.ts.map
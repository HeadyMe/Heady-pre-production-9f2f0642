export class LiquidUnifiedRuntime {
    constructor(config?: {});
    config: {
        targetLatencyMs: number;
        maxMicroservices: number;
        projectionMode: string;
        cloudProviders: {
            id: string;
            gpu: string;
            gpuRamGb: number;
        }[];
        repoRoot: string;
    };
    capabilityMesh: Map<any, any>;
    templateReceipts: any[];
    lastProjectionSnapshotAt: string | null;
    registerDefaultCapabilities(): void;
    registerCapability(name: any, descriptor: any): void;
    getCapabilityHealth(name: any): {
        ok: boolean;
        module: any;
        status: string;
        domain?: undefined;
        dependencies?: undefined;
        updatedAt?: undefined;
    } | {
        ok: boolean;
        module: any;
        domain: any;
        status: any;
        dependencies: any;
        updatedAt: any;
    };
    optimizeMicroserviceFootprint(): {
        strategy: string;
        currentCapabilityCount: number;
        recommendedMicroserviceCount: number;
        decomposedByDomain: any;
        unifiedPlane: boolean;
        paradigm: {
            frontendBackendSplit: boolean;
            interfaceDelivery: string;
            serviceDelivery: string;
        };
    };
    injectTemplateFrom3DWorkspace(payload: any): {
        ok: boolean;
        receipt: {
            id: string;
            workspaceVectorId: any;
            target: any;
            templateName: any;
            projectedAt: string;
            status: string;
            orchestration: {
                source: string;
                destination: any;
                path: string[];
            };
        };
        orchestrationPath: string[];
    };
    buildDynamicExperience(request?: {}): {
        ok: boolean;
        deploymentPlan: {
            appId: any;
            capabilities: any;
            provisionMode: string;
            localResourceUsage: string;
            delivery: {
                rendering: string;
                dataPlane: string;
                sourceOfTruth: string;
            };
            cloudExecution: {
                providers: {
                    id: string;
                    gpu: string;
                    gpuRamGb: number;
                }[];
                allocation: {
                    provider: string;
                    gpu: string;
                    gpuRamGb: number;
                    reservedGpuRamGb: number;
                }[];
            };
        };
        topology: {
            strategy: string;
            currentCapabilityCount: number;
            recommendedMicroserviceCount: number;
            decomposedByDomain: any;
            unifiedPlane: boolean;
            paradigm: {
                frontendBackendSplit: boolean;
                interfaceDelivery: string;
                serviceDelivery: string;
            };
        };
    };
    allocateGpuResources(gpuIntensity: any): {
        provider: string;
        gpu: string;
        gpuRamGb: number;
        reservedGpuRamGb: number;
    }[];
    health(): {
        ok: boolean;
        module: string;
        timestamp: string;
        projectionMode: string;
        capabilityCount: number;
        lastProjectionSnapshotAt: string | null;
    };
    getUnifiedProjectionSnapshot(): {
        ok: boolean;
        snapshotAt: string;
        monorepoSourceOfTruth: boolean;
        topology: {
            strategy: string;
            currentCapabilityCount: number;
            recommendedMicroserviceCount: number;
            decomposedByDomain: any;
            unifiedPlane: boolean;
            paradigm: {
                frontendBackendSplit: boolean;
                interfaceDelivery: string;
                serviceDelivery: string;
            };
        };
        runtime: {
            mode: string;
            projectionMode: string;
            targetLatencyMs: number;
            capabilities: any[];
            templateReceipts: any[];
            microserviceOptimization: {
                strategy: string;
                currentCapabilityCount: number;
                recommendedMicroserviceCount: number;
                decomposedByDomain: any;
                unifiedPlane: boolean;
                paradigm: {
                    frontendBackendSplit: boolean;
                    interfaceDelivery: string;
                    serviceDelivery: string;
                };
            };
        };
    };
    reconcileRepositoryProjection({ apply }?: {
        apply?: boolean | undefined;
    }): {
        ok: boolean;
        apply: boolean;
        candidates: string[];
        cleaned: string[];
        guidance: string;
    };
    getUntrackedFiles(): string[];
    isStrayFile(filePath: any): boolean;
    runtimeStatus(): {
        mode: string;
        projectionMode: string;
        targetLatencyMs: number;
        capabilities: any[];
        templateReceipts: any[];
        microserviceOptimization: {
            strategy: string;
            currentCapabilityCount: number;
            recommendedMicroserviceCount: number;
            decomposedByDomain: any;
            unifiedPlane: boolean;
            paradigm: {
                frontendBackendSplit: boolean;
                interfaceDelivery: string;
                serviceDelivery: string;
            };
        };
    };
}
export function getLiquidUnifiedRuntime(config: any): any;
export function registerLiquidUnifiedRuntimeRoutes(app: any): any;
//# sourceMappingURL=liquid-unified-runtime.d.ts.map
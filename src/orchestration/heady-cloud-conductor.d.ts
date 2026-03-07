export class HeadyCloudConductor extends EventEmitter<[never]> {
    constructor(options?: {});
    options: {
        reconcileIntervalMs: number;
        driftThreshold: number;
    };
    _desiredState: {};
    _actualState: {};
    _layerAllocation: {
        local: number;
        'cloud-me': number;
        'cloud-sys': number;
        'cloud-conn': number;
        hybrid: number;
    };
    _tenantPolicies: Map<any, any>;
    _driftDetector: DriftDetector;
    _provisionQueue: any[];
    _provisioning: Set<any>;
    _reconcileTimer: NodeJS.Timeout | null;
    start(): void;
    stop(): void;
    getDesiredState(layerId: any): any;
    scaleLayer(layerId: any, config: any): Promise<{
        layerId: any;
        prev: any;
        next: any;
    }>;
    _enqueueProvisioning(layerId: any, config: any): void;
    _processProvisionQueue(): Promise<void>;
    _provisionLayer(layerId: any, config: any): Promise<void>;
    setLayerAllocation(allocations: any): void;
    adjustAllocationByDemand(demandMetrics: any): void;
    setTenantPolicy(tenantId: any, policy: any): void;
    getTenantPolicy(tenantId: any): any;
    enforcePolicy(tenantId: any, requestedLayer: any, requestedConfig: any): {
        allowed: boolean;
        issues?: undefined;
    } | {
        allowed: boolean;
        issues: string[];
    };
    reconcile(): Promise<{
        drifts: number;
        layers: number;
        duration: number;
        details: ({
            field: string;
            desired: any;
            actual: any;
            layerId: string;
        } | {
            layerId: string;
            type: string;
        })[];
        ts: string;
    }>;
    _detectDrift(layerId: any, desired: any, actual: any): {
        field: string;
        desired: any;
        actual: any;
    }[];
    updateActualState(layerId: any, state: any): void;
    getStatus(): {
        layers: {};
        tenantPolicies: number;
        provisionQueue: number;
    };
}
export const LAYER_DEFINITIONS: {
    local: {
        id: string;
        class: string;
        description: string;
        costTier: string;
        latencyMs: number;
        capabilities: string[];
    };
    'cloud-me': {
        id: string;
        class: string;
        description: string;
        costTier: string;
        latencyMs: number;
        capabilities: string[];
    };
    'cloud-sys': {
        id: string;
        class: string;
        description: string;
        costTier: string;
        latencyMs: number;
        capabilities: string[];
    };
    'cloud-conn': {
        id: string;
        class: string;
        description: string;
        costTier: string;
        latencyMs: number;
        capabilities: string[];
    };
    hybrid: {
        id: string;
        class: string;
        description: string;
        costTier: string;
        latencyMs: number;
        capabilities: string[];
    };
};
export const LAYER_IDS: string[];
export const DEFAULT_DESIRED_STATE: {
    local: {
        replicas: number;
        memoryGB: number;
        gpuEnabled: boolean;
        models: string[];
        enabled: boolean;
    };
    'cloud-me': {
        replicas: number;
        memoryGB: number;
        gpuEnabled: boolean;
        models: string[];
        enabled: boolean;
    };
    'cloud-sys': {
        replicas: number;
        memoryGB: number;
        gpuEnabled: boolean;
        models: string[];
        enabled: boolean;
    };
    'cloud-conn': {
        replicas: number;
        memoryGB: number;
        gpuEnabled: boolean;
        models: string[];
        enabled: boolean;
    };
    hybrid: {
        replicas: number;
        memoryGB: number;
        gpuEnabled: boolean;
        models: string[];
        enabled: boolean;
    };
};
import { EventEmitter } from "events";
import { DriftDetector } from "../drift-detector";
//# sourceMappingURL=heady-cloud-conductor.d.ts.map
export const REGISTRY_PATH: string;
export const OPTIMIZATION_POLICY_PATH: string;
export function readRegistry(filePath?: string): any;
export function readOptimizationPolicy(filePath?: string): any;
export function hashRegistry(registry: any): string;
export function validateRegistry(registry: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    totalTemplates: any;
    coverage: number;
    uncoveredPredictions: any[];
    registryHash: string;
};
export function scoreTemplate(template: any, policy?: any): number;
export function selectTemplatesForSituation(registry: any, situation: any, limit?: number, policy?: any): any;
export function buildOptimizationReport(registry?: any, policy?: any): {
    generatedAt: string;
    sourceOfTruth: any;
    registryHash: string;
    valid: boolean;
    coverage: number;
    topTemplates: any;
    bySituation: {};
    warnings: string[];
    errors: string[];
};
export class HeadybeeTemplateRegistryService {
    constructor(options?: {});
    registryPath: any;
    optimizationPolicyPath: any;
    startedAt: string | null;
    start(): {
        service: string;
        startedAt: string | null;
        endpoint: string;
        status: string;
        templateCount: any;
        coverage: number;
        registryHash: string;
    };
    stop(): void;
    getRegistry(): any;
    getOptimizationPolicy(): any;
    getHealth(): {
        service: string;
        startedAt: string | null;
        endpoint: string;
        status: string;
        templateCount: any;
        coverage: number;
        registryHash: string;
    };
    report(): {
        generatedAt: string;
        sourceOfTruth: any;
        registryHash: string;
        valid: boolean;
        coverage: number;
        topTemplates: any;
        bySituation: {};
        warnings: string[];
        errors: string[];
    };
    recommend({ scenario, tags, limit }?: {
        scenario?: string | undefined;
        tags?: never[] | undefined;
    }): {
        scenario: string;
        tags: string[];
        top: any;
        candidates: any;
    };
}
export function getHealthStatus(): {
    endpoint: string;
    status: string;
    templateCount: any;
    coverage: number;
    registryHash: string;
};
export function getOptimizationState(): {
    sourceOfTruth: any;
    version: any;
    updatedAt: any;
    validation: {
        valid: boolean;
        errors: string[];
        warnings: string[];
        totalTemplates: any;
        coverage: number;
        uncoveredPredictions: any[];
        registryHash: string;
    };
    health: {
        endpoint: string;
        status: string;
        templateCount: any;
        coverage: number;
        registryHash: string;
    };
};
export function registerHeadybeeTemplateRegistryRoutes(app: any): void;
//# sourceMappingURL=headybee-template-registry.d.ts.map
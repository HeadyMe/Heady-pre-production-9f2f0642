export function loadScenarios(): any;
export function buildRegistrySnapshot({ templates, beeDomains }?: {
    templates?: never[] | undefined;
    beeDomains?: never[] | undefined;
}): {
    generatedAt: number;
    templates: any[];
    beeDomains: any[];
    stats: {
        templateCount: number;
        beeDomainCount: number;
        coveredZones: any[];
    };
};
export function validateRegistry(snapshot: any): {
    valid: boolean;
    issues: {
        code: string;
        detail: string;
        severity: string;
    }[];
};
export function evaluateScenarioCoverage(snapshot: any, scenarios?: any): any;
export function createProjectionState(snapshot: any, coverage: any, validation: any): {
    generatedAt: number;
    sourceOfTruth: {
        gitBranch: string;
        gitCommit: string;
    };
    snapshot: any;
    validation: any;
    coverageSummary: {
        averageCoverage: number;
        fullyReadyScenarios: any;
        totalScenarios: any;
    };
    scenarios: any;
};
//# sourceMappingURL=template-registry-optimizer.d.ts.map
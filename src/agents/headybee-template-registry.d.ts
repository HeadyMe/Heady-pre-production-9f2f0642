export const TEMPLATE_REGISTRY: {
    id: string;
    name: string;
    domains: string[];
    triggers: string[];
    workflows: string[];
    skills: string[];
    nodes: string[];
    swarmTasks: string[];
    optimizationChannels: string[];
    vectorZone: number;
}[];
export function recommendTemplates(context?: {}, limit?: number): {
    rank: number;
    templateId: any;
    score: number;
    matches: string[];
    name: any;
    workflows: any;
    skills: any;
    nodes: any;
    swarmTasks: any;
    optimizationChannels: any;
    vectorZone: any;
}[];
export function validateTemplateCoverage(templates?: {
    id: string;
    name: string;
    domains: string[];
    triggers: string[];
    workflows: string[];
    skills: string[];
    nodes: string[];
    swarmTasks: string[];
    optimizationChannels: string[];
    vectorZone: number;
}[]): {
    valid: boolean;
    totalTemplates: number;
    requiredScenarios: string[];
    missing: string[];
    coverageScore: number;
};
export function buildGithubSourceOfTruthProjection(options?: {}): {
    version: number;
    generatedAt: string;
    sourceOfTruth: {
        repository: any;
        branch: any;
        commitSha: any;
    };
    registryDigest: string;
    coverage: {
        valid: boolean;
        totalTemplates: number;
        requiredScenarios: string[];
        missing: string[];
        coverageScore: number;
    };
    channels: {
        selfAwareness: {
            status: string;
            strategy: string;
        };
        learning: {
            status: string;
            strategy: string;
        };
        healing: {
            status: string;
            strategy: string;
        };
        optimization: {
            status: string;
            strategy: string;
        };
    };
    templates: {
        id: string;
        name: string;
        domains: string[];
        triggers: string[];
        workflows: string[];
        skills: string[];
        nodes: string[];
        swarmTasks: string[];
        optimizationChannels: string[];
        vectorZone: number;
    }[];
};
export function auditInfrastructureDrift(input?: {}): {
    ok: boolean;
    actions: {
        removeServiceWorkers: any;
        removeTunnels: any;
    };
    counts: {
        staleServiceWorkers: any;
        staleTunnels: any;
    };
};
//# sourceMappingURL=headybee-template-registry.d.ts.map
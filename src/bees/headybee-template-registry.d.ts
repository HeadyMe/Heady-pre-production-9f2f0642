export const DEFAULT_TEMPLATES: {
    id: string;
    name: string;
    scenarios: string[];
    skills: string[];
    nodes: string[];
    workflows: string[];
    tasks: string[];
    priority: number;
}[];
export const REQUIRED_SCENARIOS: string[];
export class HeadyBeeTemplateRegistry {
    constructor(templates?: {
        id: string;
        name: string;
        scenarios: string[];
        skills: string[];
        nodes: string[];
        workflows: string[];
        tasks: string[];
        priority: number;
    }[]);
    templates: Map<any, any>;
    list(): any[];
    register(template: any): {
        id: string;
        name: string;
        scenarios: any[];
        skills: any[];
        nodes: any[];
        workflows: any[];
        tasks: any[];
        priority: any;
        version: any;
        status: any;
    };
    recommend(signal?: {}): {
        template: any;
        match: {
            id: string;
            score: number;
            scenarioHits: number;
            skillHits: number;
            workflowHits: number;
        };
    }[];
    buildSwarmPlan(signal?: {}): {
        selected: null;
        tasks: never[];
        skills: never[];
        nodes: never[];
        score?: undefined;
        workflows?: undefined;
        vectorProjection?: undefined;
    } | {
        selected: any;
        score: {
            id: string;
            score: number;
            scenarioHits: number;
            skillHits: number;
            workflowHits: number;
        };
        tasks: any;
        skills: any;
        nodes: any;
        workflows: any;
        vectorProjection: {
            space: string;
            vector3: number[];
            hash: string;
        };
    };
    validateCoverage(requiredScenarios?: string[]): {
        healthy: boolean;
        requiredScenarios: string[];
        coveredScenarios: any[];
        missing: string[];
        templateCount: number;
    };
    buildMaintenanceAudit(input?: {}): {
        checkedAt: string;
        staleCandidates: any;
        shouldReviewCount: any;
        notes: string[];
    };
    _buildVectorProjection(template: any, signal: any): {
        space: string;
        vector3: number[];
        hash: string;
    };
}
export function normalizeTemplate(template?: {}): {
    id: string;
    name: string;
    scenarios: any[];
    skills: any[];
    nodes: any[];
    workflows: any[];
    tasks: any[];
    priority: any;
    version: any;
    status: any;
};
export function scoreTemplate(template: any, signal?: {}): {
    id: string;
    score: number;
    scenarioHits: number;
    skillHits: number;
    workflowHits: number;
};
export function registerRoutes(app: any, registry?: HeadyBeeTemplateRegistry): void;
//# sourceMappingURL=headybee-template-registry.d.ts.map
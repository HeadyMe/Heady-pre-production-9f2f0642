export const CONTENDERS: ({
    id: string;
    name: string;
    model: string;
    provider: string;
    strength: string;
    apiTool: string;
    apiParams: {
        action: string;
        thinkingBudget: number;
        model?: undefined;
        stream?: undefined;
    };
    repoName: string;
    status: string;
} | {
    id: string;
    name: string;
    model: string;
    provider: string;
    strength: string;
    apiTool: string;
    apiParams: {
        model: string;
        action?: undefined;
        thinkingBudget?: undefined;
        stream?: undefined;
    };
    repoName: string;
    status: string;
} | {
    id: string;
    name: string;
    model: string;
    provider: string;
    strength: string;
    apiTool: string;
    apiParams: {
        action: string;
        thinkingBudget?: undefined;
        model?: undefined;
        stream?: undefined;
    };
    repoName: string;
    status: string;
} | {
    id: string;
    name: string;
    model: string;
    provider: string;
    strength: string;
    apiTool: string;
    apiParams: {
        stream: boolean;
        action?: undefined;
        thinkingBudget?: undefined;
        model?: undefined;
    };
    repoName: string;
    status: string;
} | {
    id: string;
    name: string;
    model: string;
    provider: string;
    strength: string;
    apiTool: string;
    apiParams: {
        action?: undefined;
        thinkingBudget?: undefined;
        model?: undefined;
        stream?: undefined;
    };
    repoName: string;
    status: string;
})[];
/**
 * Generate the comprehensive project blueprint that each model receives.
 * This is the "maximum intelligence" context package.
 */
export function generateBlueprint(): {
    version: string;
    generated: string;
    project: {
        name: string;
        vision: string;
        architecture: string;
        domains: string[];
    };
    coreModules: {
        'heady-manager': string;
        'vector-memory': string;
        'domain-router': string;
        'site-renderer': string;
        'auto-projection': string;
        'vault-boot': string;
        'swarm-matrix': string;
        'aspirational-registry': string;
        'ast-schema': string;
        'hologram-bee': string;
        'context-weaver-bee': string;
        'projection-engine': string;
        governance: string;
        'structured-logger': string;
        'health-registry': string;
        'self-healing-mesh': string;
        'unified-enterprise-autonomy': string;
        'continuous-embedder': string;
    };
    beeSystem: {
        description: string;
        templateSystem: string;
        totalBees: number;
        categories: string[];
    };
    stack: {
        runtime: string;
        framework: string;
        database: string;
        cache: string;
        edge: string;
        compute: string;
        gpu: string;
        cicd: string;
        containerization: string;
        ai: string;
        protocols: string;
    };
    fileStructure: {
        'src/core/': string;
        'src/services/': string;
        'src/bees/': string;
        'src/mcp/': string;
        'src/shell/': string;
        'src/utils/': string;
        'src/bootstrap/': string;
        'configs/': string;
        'scripts/': string;
        'docs/': string;
    };
    patterns: string[];
    dependencies: {
        production: string[];
        dev: string[];
    };
    rebuildInstructions: string;
};
/**
 * Start a new battle session — dispatch to all 10 contenders.
 */
export function startBattle(): {
    sessionId: null;
    status: string;
    startedAt: null;
    blueprint: null;
    contenders: never[];
    results: never[];
    rankings: never[];
    winner: null;
};
/**
 * Get the context package optimized for a specific model.
 * Each model gets a context tailored to its strengths.
 */
export function getContextForModel(contenderId: any): {
    role: string;
    content: string;
} | null;
/**
 * Mark a contender as dispatched.
 */
export function markDispatched(contenderId: any): void;
/**
 * Record a contender's result.
 */
export function recordResult(contenderId: any, result: any): void;
/**
 * Get battle status.
 */
export function getStatus(): {
    sessionId: null;
    status: string;
    startedAt: null;
    contenders: {
        id: any;
        name: any;
        model: any;
        status: any;
        dispatched: any;
        completed: any;
        score: any;
    }[];
    resultsCount: number;
    winner: null;
};
/**
 * Get repo manifest — the repos that need to be created for each contender.
 */
export function getRepoManifest(): {
    repoName: string;
    contender: string;
    model: string;
    provider: string;
    description: string;
    isPrivate: boolean;
}[];
/**
 * Express routes.
 */
export function battleArenaRoutes(app: any): void;
//# sourceMappingURL=battle-arena.d.ts.map
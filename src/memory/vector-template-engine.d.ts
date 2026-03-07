export const TEMPLATE_REGISTRY: {
    'site-builder': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                content: string;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                valid: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                deployed: boolean;
                ts: number;
            }>;
        })[];
    };
    'code-processor': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                parsed: boolean;
                type: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                transformed: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                verified: boolean;
                ts: number;
            }>;
        })[];
    };
    'config-injector': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                valid: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                merged: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                deployed: boolean;
                environment: any;
                ts: number;
            }>;
        })[];
    };
    'api-handler': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                route: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                bound: boolean;
                ts: number;
            }>;
        })[];
    };
    'agent-spawner': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                agent: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                personality: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                active: boolean;
                ts: number;
            }>;
        })[];
    };
    'pipeline-runner': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                steps: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                executed: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                complete: boolean;
                ts: number;
            }>;
        })[];
    };
    'data-transformer': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                extracted: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                transformed: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                loaded: boolean;
                target: any;
                ts: number;
            }>;
        })[];
    };
    'infra-deployer': {
        zone: number;
        description: string;
        patterns: RegExp[];
        priority: number;
        workerFactory: (vectorData: any) => ({
            name: string;
            fn: () => Promise<{
                action: string;
                provider: any;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                provisioned: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                deployed: boolean;
                ts: number;
            }>;
        } | {
            name: string;
            fn: () => Promise<{
                action: string;
                healthy: boolean;
                ts: number;
            }>;
        })[];
    };
};
export const ZONE_TEMPLATE_MAP: Map<any, any>;
export function indexArtifact(content: any, type?: string, metadata?: {}): Promise<{
    id: any;
    templateType: string;
}>;
export function detectTemplate(content: any, filename?: string): string;
export function instantiate(taskQuery: any, options?: {}): Promise<{
    template: string;
    bees: any[];
    vectorMatches: number;
    mode: string;
    templates?: undefined;
} | {
    template: string;
    bees: any[];
    vectorMatches: any;
    templates: string[];
    mode: string;
}>;
export function swarm(taskQuery: any, options?: {}): Promise<{
    execResults: {
        bee: any;
        results: any[];
    }[];
    elapsed: number;
    status: string;
    template: string;
    bees: any[];
    vectorMatches: number;
    mode: string;
    templates?: undefined;
} | {
    execResults: {
        bee: any;
        results: any[];
    }[];
    elapsed: number;
    status: string;
    template: string;
    bees: any[];
    vectorMatches: any;
    templates: string[];
    mode: string;
}>;
export function indexDirectory(dirPath: any, options?: {}): Promise<{
    id: any;
    templateType: string;
}[]>;
export function getStats(): {
    templates: number;
    templateNames: string[];
    zoneMapping: any;
};
export function getTemplateForZone(zone: any): any;
export function getTemplate(name: any): any;
export function listTemplates(): {
    name: string;
    zone: number;
    description: string;
    priority: number;
    patternCount: number;
}[];
//# sourceMappingURL=vector-template-engine.d.ts.map
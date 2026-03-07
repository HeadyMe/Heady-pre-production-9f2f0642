/**
 * Register a new project.
 */
export function registerProject(payload: any): {
    projectId: any;
    apiKey: string;
    intent: any;
    environment: any;
    projectType: any;
    templates: any;
    projectionTarget: {
        primary: string;
        endpoint: string;
        stalenessBudgetMs: number;
    };
    permissions: {
        read: boolean;
        write: boolean;
        admin: boolean;
        authProviders: string[];
    };
    quota: {
        dailyLlmCallsLimit: number;
        monthlyStorageMb: number;
        maxConcurrentBees: number;
    };
    registeredAt: string;
    lastSeen: string;
};
/**
 * Validate an API key and return the project.
 */
export function validateApiKey(apiKey: any): any;
/**
 * Get the onboarding blueprint consumed by SDK and UIs.
 */
export function getOnboardingBlueprint(): {
    version: string;
    authProviders: string[];
    intentTypes: string[];
    templates: {
        general: string[];
        'trading-bot': string[];
        'web-app': string[];
        'ai-agent': string[];
        music: string[];
        'data-pipeline': string[];
    };
    projectionTargets: string[];
    sdkLanguages: string[];
    onboardingSteps: {
        step: number;
        action: string;
        description: string;
    }[];
};
/**
 * Express API routes for SDK registration.
 */
export function sdkRoutes(app: any): void;
export const INTENT_TEMPLATES: {
    general: string[];
    'trading-bot': string[];
    'web-app': string[];
    'ai-agent': string[];
    music: string[];
    'data-pipeline': string[];
};
export const SUPPORTED_AUTH_PROVIDERS: string[];
//# sourceMappingURL=sdk-registration.d.ts.map
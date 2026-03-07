export class OnboardingOrchestrator {
    constructor(opts?: {});
    domain: any;
    googleWorkspaceEnabled: boolean;
    startedAt: string;
    getOnboardingState(userId: any): any;
    advanceStage(userId: any, stageData: any): any;
    _processAuth(_state: any, stageData: any): {
        data: {
            provider: any;
            email: any;
            displayName: any;
            authenticatedAt: string;
        };
    };
    _processPermissions(_state: any, stageData: any): {
        data: {
            permissions: any;
            allCloudExecuted: boolean;
        };
    };
    _processEmail(state: any, stageData: any): {
        email: string;
        username: any;
        data: {
            headyEmail: string;
            username: any;
            provisionStatus: string;
            googleWorkspace: boolean;
            imapServer: string;
            smtpServer: string;
            provisionedAt: string | null;
        };
    };
    _processEmailConfig(state: any, stageData: any): {
        data: {
            mode: any;
            headyEmail: any;
            forwardingTarget: any;
            clientConfig: {
                id: string;
                name: string;
                platform: string[];
                imapConfig: {
                    server: string;
                    port: number;
                    security: string;
                } | undefined;
                smtpConfig: {
                    server: string;
                    port: number;
                    security: string;
                } | undefined;
                emailAddress: any;
            } | null;
            configuredAt: string;
        };
    };
    _processBuddySetup(state: any, stageData: any): {
        data: {
            selectedContexts: any;
            preferences: any;
            uiLayouts: any;
            contextDefinitions: any;
            buddyWelcomeMessage: {
                greeting: string;
                message: string;
                quickStartActions: {
                    label: string;
                    action: string;
                    icon: string;
                }[];
            };
            configuredAt: string;
        };
    };
    _generateBuddyWelcome(state: any): {
        greeting: string;
        message: string;
        quickStartActions: {
            label: string;
            action: string;
            icon: string;
        }[];
    };
    getSuggestionsForUser(userId: any): {
        ok: boolean;
        userId: any;
        provider: any;
        suggestedContexts: any;
        reason: any;
        allAvailableContexts: string[];
    };
    getHealth(): {
        ok: boolean;
        service: string;
        domain: any;
        startedAt: string;
        activeOnboardings: number;
        completedOnboardings: number;
        stages: number;
        emailClients: number;
        forwardingModes: number;
        ts: string;
    };
}
export function registerOnboardingOrchestratorRoutes(app: any, orchestrator?: OnboardingOrchestrator): OnboardingOrchestrator;
export function deriveUsername(authProfile: any): any;
export const STAGES: {
    id: string;
    step: number;
    label: string;
    icon: string;
    required: boolean;
}[];
export const SECURE_EMAIL_CLIENTS: ({
    id: string;
    name: string;
    platform: string[];
    protocol: string;
    icon: string;
    features: string[];
    downloadUrl: string;
    imapConfig: {
        server: string;
        port: number;
        security: string;
    };
    smtpConfig: {
        server: string;
        port: number;
        security: string;
    };
    note?: undefined;
} | {
    id: string;
    name: string;
    platform: string[];
    protocol: string;
    icon: string;
    features: string[];
    downloadUrl: string;
    note: string;
    imapConfig?: undefined;
    smtpConfig?: undefined;
})[];
export const EMAIL_FORWARDING_MODES: ({
    id: string;
    label: string;
    description: string;
    icon: string;
    requiresInput?: undefined;
} | {
    id: string;
    label: string;
    description: string;
    icon: string;
    requiresInput: string;
})[];
//# sourceMappingURL=onboarding-orchestrator.d.ts.map
export class HeadySDK {
    constructor(options?: {});
    apiKey: any;
    baseUrl: any;
    edgeUrl: any;
    initialized: boolean;
    sessionId: `${string}-${string}-${string}-${string}-${string}`;
    blueprint: string | null;
    /**
     * Initialize the SDK — reads blueprint config and validates auth.
     * This is the single canonical SDK initialization path.
     */
    init(): Promise<{
        success: boolean;
        sessionId: `${string}-${string}-${string}-${string}-${string}`;
        manager: string;
        stage: string;
        endpoints: {
            projection: string;
            blueprint: string;
            health: string;
            edge: string;
        };
        error?: undefined;
        remediation?: undefined;
    } | {
        success: boolean;
        error: any;
        stage: string;
        remediation: string;
        sessionId?: undefined;
        manager?: undefined;
        endpoints?: undefined;
    }>;
    /**
     * Get current system projection state.
     */
    getProjection(): Promise<unknown>;
    /**
     * Trigger CloudBurst sync to edge.
     */
    syncToEdge(data?: {}): Promise<unknown>;
    /**
     * Get SDK health status.
     */
    getHealth(): {
        initialized: boolean;
        sessionId: `${string}-${string}-${string}-${string}-${string}`;
        apiKey: string | null;
        baseUrl: any;
        edgeUrl: any;
        hasBlueprintConfig: boolean;
    };
}
/**
 * CLI quickstart entry point.
 * Usage: npx heady-sdk init
 */
export function cliQuickstart(): Promise<{
    success: boolean;
    sessionId: `${string}-${string}-${string}-${string}-${string}`;
    manager: string;
    stage: string;
    endpoints: {
        projection: string;
        blueprint: string;
        health: string;
        edge: string;
    };
    error?: undefined;
    remediation?: undefined;
} | {
    success: boolean;
    error: any;
    stage: string;
    remediation: string;
    sessionId?: undefined;
    manager?: undefined;
    endpoints?: undefined;
}>;
//# sourceMappingURL=sdk-quickstart.d.ts.map
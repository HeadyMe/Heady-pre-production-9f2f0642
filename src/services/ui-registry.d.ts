/**
 * Get the full UI manifest.
 * Used by HeadyWeb shell to discover available apps.
 */
export function getUIManifest(options?: {}): {
    receipt: {
        hash: string;
        timestamp: string;
    };
    shell: {
        name: string;
        version: string;
        description: string;
        baseUrl: string;
    };
    totalApps: number;
    activeApps: number;
    plannedApps: number;
    categories: any[];
    apps: {
        id: any;
        name: any;
        description: any;
        category: any;
        route: any;
        icon: any;
        status: any;
        version: any;
    }[];
};
/**
 * Register a new UI application.
 */
export function registerUI(config: any): {
    success: boolean;
    error: string;
    app?: undefined;
} | {
    success: boolean;
    app: {
        id: any;
        name: any;
        description: any;
        category: any;
        entryPoint: any;
        route: any;
        icon: any;
        status: any;
        version: any;
        registeredAt: string;
    };
    error?: undefined;
};
/**
 * Get a specific UI app by ID.
 */
export function getUI(id: any): any;
/**
 * Update a UI app's status.
 */
export function updateUIStatus(id: any, status: any): {
    success: boolean;
    error: string;
    app?: undefined;
} | {
    success: boolean;
    app: any;
    error?: undefined;
};
/**
 * Get UI health — checks all active UIs have valid entry points.
 */
export function getUIHealth(): {
    totalRegistered: number;
    active: number;
    planned: number;
    deprecated: number;
    byCategory: any;
};
export function uiRegistryRoutes(app: any): void;
//# sourceMappingURL=ui-registry.d.ts.map
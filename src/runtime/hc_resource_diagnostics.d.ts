export class HCResourceDiagnostics {
    constructor(deps?: {});
    resourceManager: any;
    taskScheduler: any;
    diagnose(): {
        ok: boolean;
        resourceHealth: any;
        schedulerHealth: any;
        resourceSnapshot: any;
        bottlenecks: {
            type: string;
            severity: string;
            value: any;
        }[];
        recommendation: string;
        ts: string;
    };
    getHealth(): {
        ok: boolean;
        service: string;
        hasResourceManager: boolean;
        hasTaskScheduler: boolean;
    };
}
export function registerDiagnosticRoutes(app: any, diagnostics: any): void;
//# sourceMappingURL=hc_resource_diagnostics.d.ts.map
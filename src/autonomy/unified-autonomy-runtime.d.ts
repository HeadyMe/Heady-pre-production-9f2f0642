export class UnifiedAutonomyRuntime {
    constructor({ vectorMemory, tracker }?: {});
    templateRegistry: HeadyTemplateRegistry;
    maintenanceOps: HeadyMaintenanceOps;
    digitalPresence: DigitalPresenceControlPlane;
    state: {
        initialized: boolean;
        startedAt: null;
        tickCount: number;
    };
    initialize(): Promise<this>;
    tick(): Promise<{
        ok: boolean;
        tick: number;
        score: number;
        maintenance: string;
        generatedAt: string;
    }>;
    health(): {
        ok: boolean;
        initialized: boolean;
        startedAt: null;
        tickCount: number;
        templateHealth: {
            ok: boolean;
            templates: number;
            coverageRatio: number;
            generatedAt: null;
            sourceOfTruth: string;
        };
        maintenanceHealth: {
            ok: boolean;
            hasAudit: boolean;
            lastAuditAt: string | null;
        };
        digitalPresenceHealth: {
            ok: boolean;
            runs: number;
            lastRunAt: null;
            lastScore: null;
            timestamp: string;
        };
        timestamp: string;
    };
    registerRoutes(app: any): void;
}
export function getUnifiedAutonomyRuntime(options?: {}): Promise<any>;
import { HeadyTemplateRegistry } from "./heady-template-registry";
import { HeadyMaintenanceOps } from "./heady-maintenance-ops";
import { DigitalPresenceControlPlane } from "./digital-presence-control-plane";
//# sourceMappingURL=unified-autonomy-runtime.d.ts.map
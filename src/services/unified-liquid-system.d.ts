export class UnifiedLiquidSystemService {
    startedAt: string | null;
    unifiedAutonomy: UnifiedEnterpriseAutonomyService;
    start(): void;
    getProjection(): {
        projectionHash: string;
        ok: boolean;
        generatedAt: string;
        paradigm: {
            model: string;
            splitFrontendBackend: boolean;
            capabilitySurface: string;
        };
        orchestration: {
            conductor: string;
            cloudConductor: string;
            swarm: string;
            bees: string;
            queueCount: number;
        };
        realtime: {
            instantaneousAction: {
                enabled: boolean;
                transport: string[];
            };
            abletonLive: {
                enabled: boolean;
                controlPath: string;
                healthEndpoint: string;
            };
        };
        compute: {
            colabProPlusPlans: number;
            workers: any;
            gpuPolicy: string;
            cloudOnlyProjection: {
                enabled: boolean;
                localResourceUsageTarget: string;
            };
        };
        templateInjection: {
            workspace: string;
            injectionTargets: string[];
            scenarios: any;
        };
        embeddings: {
            profile: any;
            includePatterns: any;
            collections: any;
        };
        dispatch: {
            at: string;
            queuePressure: {};
            assignments: {
                queue: string;
                selectedWorker: any;
                candidates: any;
                deterministicReceipt: string;
            }[];
        };
    };
    getHealth(): {
        ok: boolean;
        service: string;
        startedAt: string | null;
        scenarios: any;
        workers: any;
        projectionHash: string;
    };
}
export function registerUnifiedLiquidSystemRoutes(app: any, service?: UnifiedLiquidSystemService): UnifiedLiquidSystemService;
export function buildTemplateInjectionMap({ registry, policy, situations }: {
    registry: any;
    policy: any;
    situations: any;
}): any;
import { UnifiedEnterpriseAutonomyService } from "./unified-enterprise-autonomy";
//# sourceMappingURL=unified-liquid-system.d.ts.map
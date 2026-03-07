export function runDeepScan(): Promise<{
    scanId: string;
    startedAt: string;
    internal: {};
    patterns: null;
    cloud: null;
    registry: null;
    bestPractices: {};
    overallScore: number;
    completedAt: null;
}>;
export function registerDeepScanRoutes(app: any): void;
export const INTERNAL_SERVICES: {
    brain: {
        path: string;
        role: string;
        critical: boolean;
    };
    soul: {
        path: string;
        role: string;
        critical: boolean;
    };
    conductor: {
        path: string;
        role: string;
        critical: boolean;
    };
    battle: {
        path: string;
        role: string;
        critical: boolean;
    };
    hcfp: {
        path: string;
        role: string;
        critical: boolean;
    };
    patterns: {
        path: string;
        role: string;
        critical: boolean;
    };
    lens: {
        path: string;
        role: string;
        critical: boolean;
    };
    vinci: {
        path: string;
        role: string;
        critical: boolean;
    };
    notion: {
        path: string;
        role: string;
        critical: boolean;
    };
    ops: {
        path: string;
        role: string;
        critical: boolean;
    };
    maintenance: {
        path: string;
        role: string;
        critical: boolean;
    };
    registry: {
        path: string;
        role: string;
        critical: boolean;
    };
    "auto-success": {
        path: string;
        role: string;
        critical: boolean;
    };
    stream: {
        path: string;
        role: string;
        critical: boolean;
    };
    cloud: {
        path: string;
        role: string;
        critical: boolean;
    };
    memory: {
        path: string;
        role: string;
        critical: boolean;
    };
    config: {
        path: string;
        role: string;
        critical: boolean;
    };
    system: {
        path: string;
        role: string;
        critical: boolean;
    };
    nodes: {
        path: string;
        role: string;
        critical: boolean;
    };
};
export namespace BEST_PRACTICES {
    namespace resilience {
        let id: string;
        let name: string;
        function check(scanData: any): {
            score: number;
            covered: number;
            total: number;
            recommendation: string;
        };
    }
    namespace caching {
        let id_1: string;
        export { id_1 as id };
        let name_1: string;
        export { name_1 as name };
        export function check_1(scanData: any): {
            score: number;
            activeCaches: number;
            recommendation: string;
        };
        export { check_1 as check };
    }
    namespace pooling {
        let id_2: string;
        export { id_2 as id };
        let name_2: string;
        export { name_2 as name };
        export function check_2(scanData: any): {
            score: number;
            activePools: number;
            recommendation: string;
        };
        export { check_2 as check };
    }
    namespace monitoring {
        let id_3: string;
        export { id_3 as id };
        let name_3: string;
        export { name_3 as name };
        export function check_3(scanData: any): {
            score: number;
            healthyServices: number;
            totalServices: number;
            recommendation: string;
        };
        export { check_3 as check };
    }
    namespace redundancy {
        let id_4: string;
        export { id_4 as id };
        let name_4: string;
        export { name_4 as name };
        export function check_4(scanData: any): {
            score: number;
            capabilities: {
                autoSuccess: boolean;
                safeMode: boolean;
                gracefulErrors: boolean;
                conductorPoll: boolean;
            };
            recommendation: string;
        };
        export { check_4 as check };
    }
    namespace cloudCoverage {
        let id_5: string;
        export { id_5 as id };
        let name_5: string;
        export { name_5 as name };
        export function check_5(scanData: any): {
            score: number;
            activeProviders: number;
            totalProviders: number;
            recommendation: string;
        };
        export { check_5 as check };
    }
    namespace autoSuccess {
        let id_6: string;
        export { id_6 as id };
        let name_6: string;
        export { name_6 as name };
        export function check_6(scanData: any): {
            score: number;
            running: boolean;
            recommendation: string;
        };
        export { check_6 as check };
    }
}
//# sourceMappingURL=hc_deep_scan.d.ts.map
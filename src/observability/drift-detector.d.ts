export = DriftDetector;
declare class DriftDetector {
    constructor(opts?: {});
    snapshots: Map<any, any>;
    events: any[];
    maxEvents: any;
    _hash(data: any): string;
    snapshot(key: any, data: any): string;
    _classifyKind(key: any): "REGISTRY" | "CONNECTIVITY" | "CONFIG";
    scanDirectory(dir: any, extensions?: string[]): {
        error: any;
        drifts: never[];
        scanned?: undefined;
    } | {
        drifts: {
            file: string;
            prevHash: any;
            newHash: string;
        }[];
        scanned: number;
        error?: undefined;
    };
    checkConnectivity(services?: any[]): Promise<({
        id: any;
        status: string;
        latency: number;
        httpStatus: number;
        error?: undefined;
    } | {
        id: any;
        status: string;
        error: any;
        latency?: undefined;
        httpStatus?: undefined;
    })[]>;
    getLatest(limit?: number): any[];
    status(): {
        snapshotsTracked: number;
        driftEventsTotal: number;
        lastEvent: any;
    };
}
//# sourceMappingURL=drift-detector.d.ts.map
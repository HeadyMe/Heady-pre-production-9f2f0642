export class SpatialContextEngine extends EventEmitter<[never]> {
    constructor(opts?: {});
    _spatialMemory: any[];
    _maxMemory: any;
    _attention: {
        pitch: number;
        yaw: number;
        roll: number;
    };
    _currentState: {
        x: number;
        y: number;
        z: number;
    };
    _corrections: any[];
    _correctionDecayRate: any;
    _clusters: Map<any, any>;
    _clusterDirty: boolean;
    _metrics: {
        ingested: number;
        queries: number;
        corrections: number;
        avgQueryTimeUs: number;
        queryTimes: never[];
        clusterCount: number;
    };
    generateStateVector(event: any): {
        x: number;
        y: number;
        z: any;
        pitch: number;
        yaw: number;
        roll: number;
    };
    _mapTemporal(event: any): number;
    _mapFrequency(event: any): number;
    _mapDepth(event: any): any;
    _updateAttention(x: any, y: any, z: any): void;
    ingest(event: any, metadata?: {}, embedding?: null): {
        id: string;
        x: number;
        y: number;
        z: any;
        pitch: number;
        yaw: number;
        roll: number;
        weight: any;
        timestamp: number;
        event: any;
        metadata: {};
        embedding: null;
    };
    recordCorrection(event: any, strength?: number): {
        id: string;
        x: number;
        y: number;
        z: any;
        pitch: number;
        yaw: number;
        roll: number;
        weight: number;
        timestamp: number;
        event: any;
        metadata: {
            correction: boolean;
            originalEvent: any;
        };
    };
    query(stateOrEvent: any, topK?: number, opts?: {}): {
        query: {
            x: any;
            y: any;
            z: any;
        };
        attention: {
            pitch: number;
            yaw: number;
            roll: number;
        };
        results: {
            id: any;
            x: any;
            y: any;
            z: any;
            distance: number;
            weight: any;
            score: number;
            event: any;
            metadata: any;
            age: number;
        }[];
        queryTimeUs: number;
    };
    getClusters(resolution?: number): any[];
    getCurrentState(): {
        attention: {
            pitch: number;
            yaw: number;
            roll: number;
        };
        x: number;
        y: number;
        z: number;
    };
    getMemorySize(): number;
    getMetrics(): {
        memorySize: number;
        correctionCount: number;
        ingested: number;
        queries: number;
        corrections: number;
        avgQueryTimeUs: number;
        queryTimes: never[];
        clusterCount: number;
    };
    decayCorrections(): void;
    registerRoutes(app: any): void;
}
export function getInstance(opts: any): any;
export namespace FREQ_BANDS {
    namespace sub {
        let min: number;
        let max: number;
        let y: number;
    }
    namespace bass {
        let min_1: number;
        export { min_1 as min };
        let max_1: number;
        export { max_1 as max };
        let y_1: number;
        export { y_1 as y };
    }
    namespace lowMid {
        let min_2: number;
        export { min_2 as min };
        let max_2: number;
        export { max_2 as max };
        let y_2: number;
        export { y_2 as y };
    }
    namespace mid {
        let min_3: number;
        export { min_3 as min };
        let max_3: number;
        export { max_3 as max };
        let y_3: number;
        export { y_3 as y };
    }
    namespace highMid {
        let min_4: number;
        export { min_4 as min };
        let max_4: number;
        export { max_4 as max };
        let y_4: number;
        export { y_4 as y };
    }
    namespace presence {
        let min_5: number;
        export { min_5 as min };
        let max_5: number;
        export { max_5 as max };
        let y_5: number;
        export { y_5 as y };
    }
    namespace air {
        let min_6: number;
        export { min_6 as min };
        let max_6: number;
        export { max_6 as max };
        let y_6: number;
        export { y_6 as y };
    }
}
export namespace DEPTH_LEVELS {
    let master: number;
    let groupBus: number;
    let trackMixer: number;
    let deviceChain: number;
    let deviceParam: number;
    let rackChain: number;
    let nestedParam: number;
    let deepNested: number;
}
import EventEmitter = require("events");
//# sourceMappingURL=spatial-context-engine.d.ts.map
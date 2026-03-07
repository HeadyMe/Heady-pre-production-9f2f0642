export declare const PHI = 1.618033988749895;
export declare const PSI: number;
export declare const CSL_BANDS: {
    readonly DORMANT_MAX: 0.236068;
    readonly LOW_MAX: 0.381966;
    readonly MODERATE_MAX: 0.618034;
    readonly HIGH_MAX: 0.854102;
    readonly CRITICAL_MAX: 1;
};
export type CslBand = 'DORMANT' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export declare function fib(n: number): number;
export declare function clamp01(value: number): number;
export declare function labelForCslScore(score: number): CslBand;
export declare function phiWeights(count: number): number[];
export declare function phiBlend(values: number[]): number;
export declare function phiBackoffMs(attempt: number, baseMs?: number, maxMs?: number): number;
export declare function dotProduct(a: number[], b: number[]): number;
export declare function magnitude(vector: number[]): number;
export declare function cosineSimilarity(a: number[], b: number[]): number;
export declare function normalizeVector(vector: number[]): number[];
export declare function meanVector(vectors: number[][]): number[];
export declare function spatialDistance(a: Vector3, b: Vector3): number;
export declare function attenuationFromDistance(distance: number): number;
export declare function hashToUnitInterval(seed: string): number;
export declare function hashToVector3(seed: string, scale?: number): Vector3;
//# sourceMappingURL=index.d.ts.map
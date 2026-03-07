export function registerRoutes(app: any, vectorMem: any): void;
export function getSummary(): {
    totalEntries: number;
    avgConfidence: number;
    byType: {};
    byConfidence: {
        high: number;
        medium: number;
        low: number;
        stale: number;
    };
    scanCount: number;
    lastScan: null;
    globalScanNeeded: boolean;
};
export function getAllWithConfidence(): {};
export function fullPopulate(): Promise<{
    entries: number;
}>;
export function incrementalScan(): Promise<{
    scanned: number;
    staleCount: number;
}>;
export namespace registry {
    let entries: {};
    namespace meta {
        let created: number;
        let scanCount: number;
        let lastScan: null;
    }
}
//# sourceMappingURL=heady-registry.d.ts.map
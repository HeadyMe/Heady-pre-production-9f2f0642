/**
 * Creates Express middleware that augments brain endpoints with vector memory.
 * @param {Object} vectorMem — { queryMemory, ingestMemory }
 */
export function createVectorAugmentedMiddleware(vectorMem: Object): (req: any, res: any, next: any) => any;
/**
 * Express routes for the vector pipeline status + φ constants
 */
export function registerRoutes(app: any, vectorMem: any): void;
export const PHI: 1.6180339887;
export namespace PHI_INTERVALS {
    let micro: number;
    let short: number;
    let medium: number;
    let normal: number;
    let long: number;
    let slow: number;
    let deep: number;
}
//# sourceMappingURL=vector-pipeline.d.ts.map
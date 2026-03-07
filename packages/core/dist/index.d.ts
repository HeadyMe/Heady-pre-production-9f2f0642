export declare const HEADY_VERSION = "3.2.0";
export interface HeadyConfig {
    userId: string;
    domain: string;
    vectorDimension: number;
}
export declare class HeadyError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare function validateUserId(userId: string): boolean;
//# sourceMappingURL=index.d.ts.map
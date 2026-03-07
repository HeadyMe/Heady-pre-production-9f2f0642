export const domain: "credential-bee";
export const description: "Cross-domain credential health monitoring and rotation advisory";
export const priority: 0.85;
export function getWork(ctx?: {}): (() => Promise<{
    skipped: boolean;
    reason: string;
    total?: undefined;
    expiringSoon?: undefined;
    expired?: undefined;
    details?: undefined;
    bee: string;
    action: string;
    error?: undefined;
} | {
    total: any;
    expiringSoon: any;
    expired: any;
    details: {
        id: any;
        domain: any;
        status: string;
    }[];
    skipped?: undefined;
    reason?: undefined;
    bee: string;
    action: string;
    error?: undefined;
} | {
    total: any;
    needsRotation: number;
    credentials: {
        credentialId: any;
        domain: any;
        ageDays: number;
        maxDays: any;
        overdueDays: number;
    }[];
    skipped?: undefined;
    reason?: undefined;
    bee: string;
    action: string;
    error?: undefined;
} | {
    covered: string[];
    missing: any;
    coveragePercent: number;
    counts: any;
    skipped?: undefined;
    reason?: undefined;
    bee: string;
    action: string;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
}>)[];
declare const BEE_ID: "credential-bee";
export const workers: ({
    id: string;
    name: string;
    interval: number;
    run(): Promise<{
        skipped: boolean;
        reason: string;
        total?: undefined;
        expiringSoon?: undefined;
        expired?: undefined;
        details?: undefined;
    } | {
        total: any;
        expiringSoon: any;
        expired: any;
        details: {
            id: any;
            domain: any;
            status: string;
        }[];
        skipped?: undefined;
        reason?: undefined;
    }>;
} | {
    id: string;
    name: string;
    interval: number;
    run(): Promise<{
        skipped: boolean;
        reason: string;
        covered?: undefined;
        missing?: undefined;
        coveragePercent?: undefined;
        counts?: undefined;
    } | {
        covered: string[];
        missing: any;
        coveragePercent: number;
        counts: any;
        skipped?: undefined;
        reason?: undefined;
    }>;
} | {
    id: string;
    name: string;
    interval: number;
    run(): Promise<{
        skipped: boolean;
        reason: string;
        total?: undefined;
        needsRotation?: undefined;
        credentials?: undefined;
    } | {
        total: any;
        needsRotation: number;
        credentials: {
            credentialId: any;
            domain: any;
            ageDays: number;
            maxDays: any;
            overdueDays: number;
        }[];
        skipped?: undefined;
        reason?: undefined;
    }>;
})[];
export declare let name: string;
export { BEE_ID as id };
//# sourceMappingURL=credential-bee.d.ts.map
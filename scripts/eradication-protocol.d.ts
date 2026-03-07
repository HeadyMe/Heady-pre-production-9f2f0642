#!/usr/bin/env node
export function executeEradicationProtocol(): Promise<{
    workspace: {
        wiped: boolean;
        reason: string;
        fileCount?: undefined;
        dryRun?: undefined;
    } | {
        wiped: boolean;
        fileCount: number;
        dryRun: boolean;
        reason?: undefined;
    } | {
        wiped: boolean;
        fileCount: number;
        reason?: undefined;
        dryRun?: undefined;
    };
    memory: {
        pruned: number;
        reason: string;
        wouldPrune?: undefined;
        dryRun?: undefined;
        error?: undefined;
    } | {
        pruned: number;
        wouldPrune: number;
        dryRun: boolean;
        reason?: undefined;
        error?: undefined;
    } | {
        pruned: any;
        reason?: undefined;
        wouldPrune?: undefined;
        dryRun?: undefined;
        error?: undefined;
    } | {
        pruned: number;
        error: any;
        reason?: undefined;
        wouldPrune?: undefined;
        dryRun?: undefined;
    };
    dataFiles: {
        deleted: number;
        wouldDelete: number;
        dryRun: boolean;
    } | {
        deleted: number;
        wouldDelete?: undefined;
        dryRun?: undefined;
    };
    edgeCache: {
        invalidated: boolean;
        reason: string;
        dryRun?: undefined;
        error?: undefined;
    } | {
        invalidated: boolean;
        dryRun: boolean;
        reason?: undefined;
        error?: undefined;
    } | {
        invalidated: any;
        reason?: undefined;
        dryRun?: undefined;
        error?: undefined;
    } | {
        invalidated: boolean;
        error: any;
        reason?: undefined;
        dryRun?: undefined;
    };
    ts: string;
    dryRun: boolean;
}>;
//# sourceMappingURL=eradication-protocol.d.ts.map
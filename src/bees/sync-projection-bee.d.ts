export const domain: "sync-projection";
export const description: "RAM-first auto-sync: detects state deltas, renders templates, projects to GitHub/HF/Cloudflare";
export const priority: 0.95;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    stateChanged: boolean;
    currentHash: string;
    projectionCount: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    skipped: boolean;
    reason: string;
    results?: undefined;
    projectionCount?: undefined;
} | {
    bee: string;
    action: string;
    results: ({
        space: string;
        injected: boolean;
        reason: string;
        domain?: undefined;
        bytes?: undefined;
        error?: undefined;
    } | {
        space: string;
        injected: boolean;
        domain: string;
        bytes: number;
        reason?: undefined;
        error?: undefined;
    } | {
        space: string;
        injected: boolean;
        error: any;
        reason?: undefined;
        domain?: undefined;
        bytes?: undefined;
    })[];
    projectionCount: number;
    skipped?: undefined;
    reason?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    lastProjection: null;
    projectionCount: number;
    targets: {
        target: string;
        status: string;
        lastSync: null;
    }[];
}>))[];
export function computeRAMStateHash(): string;
export function hasStateChanged(): boolean;
export function injectTemplatesIntoHFSpaces(): ({
    space: string;
    injected: boolean;
    reason: string;
    domain?: undefined;
    bytes?: undefined;
    error?: undefined;
} | {
    space: string;
    injected: boolean;
    domain: string;
    bytes: number;
    reason?: undefined;
    error?: undefined;
} | {
    space: string;
    injected: boolean;
    error: any;
    reason?: undefined;
    domain?: undefined;
    bytes?: undefined;
})[];
export function projectToGitHub(changedFiles: any): {
    ok: boolean;
    files: any;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    files?: undefined;
};
export function generateFullPage(rendered: any, template: any): string;
export declare function getSyncState(): {
    lastRegistryHash: null;
    lastProjectionTime: null;
    projectionCount: number;
    targets: {
        github: {
            lastSync: null;
            hash: null;
            status: string;
        };
        hfSpaces: {
            lastSync: null;
            hash: null;
            status: string;
        };
        cloudflare: {
            lastSync: null;
            hash: null;
            status: string;
        };
    };
};
//# sourceMappingURL=sync-projection-bee.d.ts.map
/**
 * EXHALE — Push AST mutations from pgvector to dev repo + edge.
 *
 * When the Overmind or any bee mutates AST logic in Postgres,
 * this function unparses it to flat files and pushes everywhere.
 */
export function exhale(opts?: {}): Promise<{
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: string;
    files: number;
    message: any;
    timestamp: string;
    durationMs: number;
} | {
    skipped: boolean;
    reason: string;
}>;
/**
 * INHALE — Absorb dev repo changes into pgvector.
 *
 * When Antigravity or a human pushes a commit, this function
 * parses the changed files into AST, generates embeddings,
 * and updates the pgvector brain.
 */
export function inhale(opts?: {}): Promise<{
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: string;
    files: number;
    timestamp: string;
    durationMs: number;
} | {
    skipped: boolean;
    reason: string;
}>;
/**
 * COMPILE — Pull AST from pgvector, compile in memory, push to edge.
 *
 * This is the HologramBee pathway — materializes code from
 * latent vector space into a deployable artifact, then pushes
 * to the target edge (Cloudflare, Cloud Run, browser).
 */
export function compile(opts?: {}): Promise<{
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: string;
    target: any;
    domain: any;
    modules: any;
    bundleHash: string;
    bundleSize: any;
    timestamp: string;
    durationMs: number;
}>;
export function getStats(): {
    recentDeploys: any[];
    edgeTargets: string[];
    lastExhale: null;
    lastInhale: null;
    lastCompile: null;
    totalExhales: number;
    totalInhales: number;
    totalCompiles: number;
    pendingMutations: never[];
};
export function getHistory(limit?: number): any[];
export function liquidDeployRoutes(app: any): void;
export const EDGE_TARGETS: {
    'cloudflare-edge': {
        type: string;
        purgeApi: string;
        kvNamespace: string;
    };
    'cloud-run': {
        type: string;
        deployApi: string;
    };
    browser: {
        type: string;
        description: string;
    };
};
//# sourceMappingURL=liquid-deploy.d.ts.map
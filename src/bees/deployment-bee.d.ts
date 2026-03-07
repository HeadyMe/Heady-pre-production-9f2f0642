export const domain: "deployment";
export const description: "RAM-first deployment: template injection \u2192 git push \u2192 HF Spaces \u2192 Cloud Run \u2192 post-deploy verification";
export const priority: 0.85;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    success: boolean;
    error?: undefined;
} | {
    bee: string;
    action: string;
    success: boolean;
    error: any;
}>) | (() => Promise<{
    bee: string;
    action: string;
    results: ({
        space: string;
        repo: string;
        pushed: boolean;
        error?: undefined;
    } | {
        space: string;
        repo: string;
        pushed: boolean;
        error: any;
    })[];
}>) | (() => Promise<{
    bee: string;
    action: string;
    total: number;
    healthy: number;
    pass: boolean;
    success?: undefined;
    error?: undefined;
} | {
    bee: string;
    action: string;
    success: boolean;
    error: any;
    total?: undefined;
    healthy?: undefined;
    pass?: undefined;
}>))[];
export const DEPLOY_TARGETS: {
    'cloud-run': {
        service: string;
        region: string;
        project: string;
    };
    'cloudflare-worker': {
        name: string;
        account: string;
    };
    github: {
        repo: string;
        branch: string;
    };
    'hf-spaces': string[];
};
export namespace HF_SPACE_MAP {
    let main: string;
    let systems: string;
    let connection: string;
}
//# sourceMappingURL=deployment-bee.d.ts.map
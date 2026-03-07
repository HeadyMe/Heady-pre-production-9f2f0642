export const domain: "cloud-run-deployer";
export const description: "Deploy a service to Google Cloud Run from source directory";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=cloud-run-deployer-bee.d.ts.map
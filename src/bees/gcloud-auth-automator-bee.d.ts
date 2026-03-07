export const domain: "gcloud-auth-automator";
export const description: "Automate GCP auth using service account keys \u2014 no manual browser login needed";
export const priority: 1;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=gcloud-auth-automator-bee.d.ts.map
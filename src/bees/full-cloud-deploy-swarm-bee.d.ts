export const domain: "full-cloud-deploy-swarm";
export const description: "Swarm: Deploy all services to all cloud pillars in parallel";
export const priority: 1;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=full-cloud-deploy-swarm-bee.d.ts.map
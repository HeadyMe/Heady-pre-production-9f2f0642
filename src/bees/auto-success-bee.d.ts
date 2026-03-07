export const domain: "auto-success";
export const description: "Auto-success pipeline: task catalog, cycle execution, health probes, audit";
export const priority: 1;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=auto-success-bee.d.ts.map
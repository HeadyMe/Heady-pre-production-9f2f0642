export const domain: "pruner-bee";
export const description: "Scan for orphaned projections, stale branches, and unused artifacts";
export const priority: 0.7;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=pruner-bee-bee.d.ts.map
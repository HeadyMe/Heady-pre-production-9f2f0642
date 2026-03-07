export const domain: "routes";
export const description: "All API routes: brain, lens, memory, battle, buddy, conductor, governance, harmony, health, nodes, ops, patterns, pipeline, soul, system, vinci";
export const priority: 0.7;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=routes-bee.d.ts.map
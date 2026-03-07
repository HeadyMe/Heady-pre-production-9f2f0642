export const domain: "trading";
export const description: "Trading tasks, apex risk, payment gateway, fintech agent, trader widgets";
export const priority: 0.75;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=trading-bee.d.ts.map
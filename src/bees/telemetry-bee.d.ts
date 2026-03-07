export const domain: "telemetry";
export const description: "Cognitive telemetry, proof-view receipts, provider usage tracking, system monitor, self-optimizer";
export const priority: 0.75;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=telemetry-bee.d.ts.map
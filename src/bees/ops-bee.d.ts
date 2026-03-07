export const domain: "ops";
export const description: "DAG engine, MLOps logger, scaler, deploy gates, incident manager, drift detector";
export const priority: 0.8;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=ops-bee.d.ts.map
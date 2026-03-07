export const domain: "lifecycle";
export const description: "Bootstrap wiring, service routes, static hosting, error bridge, shutdown, registry, QA, improvement scheduler, verticals, config-buildout, decomposition, architecture";
export const priority: 0.7;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=lifecycle-bee.d.ts.map
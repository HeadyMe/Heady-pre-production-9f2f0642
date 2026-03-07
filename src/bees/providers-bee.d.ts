export const domain: "providers";
export const description: "Brain providers, Claude SDK, provider benchmark, model catalog, Monte Carlo";
export const priority: 0.85;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=providers-bee.d.ts.map
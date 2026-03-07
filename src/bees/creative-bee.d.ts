export const domain: "creative";
export const description: "Creative engine: generate, transform, compose, analyze, remix, edge-diffusion";
export const priority: 0.8;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    models: number;
    pipelines: number;
    status: string;
    loaded?: undefined;
} | {
    bee: string;
    action: string;
    loaded: boolean;
    models?: undefined;
    pipelines?: undefined;
    status?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>))[];
//# sourceMappingURL=creative-bee.d.ts.map
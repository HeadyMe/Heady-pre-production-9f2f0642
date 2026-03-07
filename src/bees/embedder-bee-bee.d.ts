export const domain: "embedder-bee";
export const description: "Process text chunks through embedding pipeline on demand";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=embedder-bee-bee.d.ts.map
export const domain: "memory";
export const description: "Vector memory, federation, pipeline, hybrid search, embeddings, receipts";
export const priority: 0.85;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=memory-bee.d.ts.map
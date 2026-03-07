export const domain: "colab-gpu-runtime";
export const description: "Manage Colab GPU runtime for 384D embedding generation and 3D vector ops";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=colab-gpu-runtime-bee.d.ts.map
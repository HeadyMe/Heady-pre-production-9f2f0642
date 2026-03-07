export const domain: "tester-bee";
export const description: "Run health checks and latency tests against all projection endpoints";
export const priority: 0.8;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=tester-bee-bee.d.ts.map
export const domain: "service-connection-racer";
export const description: "Race connections to multiple service endpoints, use fastest responder";
export const priority: 1;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=service-connection-racer-bee.d.ts.map
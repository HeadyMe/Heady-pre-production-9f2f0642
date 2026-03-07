export const domain: "refactoring";
export const description: "Learns from every system action \u2014 utility can shift at any moment";
export const priority: 0.9;
export function getWork(ctx?: {}): ((() => Promise<{
    type: string;
    moduleCount: number;
    insight: string;
    ts: number;
    bee: string;
    action: string;
}>) | (() => Promise<{
    bee: string;
    action: string;
    beeCount: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    heapUsedMB: number;
    heapTotalMB: number;
    heapPct: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalListeners: any;
    eventTypes: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    cachedModules: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    absorbedErrors: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    cpus: number;
    loadAvg: string[];
    uptimeSec: number;
    insight: string;
    ts: number;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalLearnings: number;
    insight: string;
    ts: number;
}>))[];
declare const _learningLog: any[];
export { _learningLog as learningLog };
//# sourceMappingURL=refactor-bee.d.ts.map
export const domain: "agents";
export const description: "All agent types: buddy-error, claude-code, buddy, fintech, nonprofit, pipeline-handlers";
export const priority: 0.85;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=agents-bee.d.ts.map
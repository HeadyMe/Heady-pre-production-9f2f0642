export const domain: "middleware";
export const description: "Auto-error pipeline, CORS, error handler, request-id, resilience, security headers";
export const priority: 0.7;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=middleware-bee.d.ts.map
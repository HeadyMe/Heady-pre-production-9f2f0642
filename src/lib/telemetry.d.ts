export const tracer: any;
export const meter: any;
export function startSpan(name: any, attributes?: {}): any;
export function withSpan(name: any, fn: any, attributes?: {}): any;
export function traceMiddleware(req: any, res: any, next: any): void;
export function recordTokenUsage(model: any, inputTokens: any, outputTokens: any, tenant?: string): void;
export function recordToolCall(toolName: any, durationMs: any, success?: boolean): void;
export function recordEvalScore(evalName: any, score: any): void;
export const tokenCounter: any;
export const requestLatency: any;
//# sourceMappingURL=telemetry.d.ts.map
export class TraceContext {
    static fromTraceparent(header: any): TraceContext;
    constructor({ traceId, spanId, parentSpanId, sampled }?: {
        sampled?: boolean | undefined;
    });
    traceId: any;
    spanId: any;
    parentSpanId: any;
    sampled: boolean;
    /** W3C traceparent header format */
    toTraceparent(): string;
    child(): TraceContext;
}
export class Span {
    constructor(name: any, context: any, attributes?: {});
    name: any;
    context: any;
    attributes: {};
    events: any[];
    status: string;
    startTime: number;
    endTime: number | null;
    durationMs: number | null;
    setAttribute(key: any, value: any): this;
    addEvent(name: any, attributes?: {}): this;
    setStatus(status: any, message: any): this;
    end(): this;
    toJSON(): {
        name: any;
        traceId: any;
        spanId: any;
        parentSpanId: any;
        status: string;
        startTime: string;
        endTime: string | null;
        durationMs: number | null;
        attributes: {};
        events: any[];
    };
}
export class Tracer {
    constructor(serviceName?: string, { maxSpans, sampleRate }?: {
        maxSpans?: number | undefined;
        sampleRate?: number | undefined;
    });
    serviceName: string;
    maxSpans: number;
    sampleRate: number;
    spans: any[];
    activeSpans: Map<any, any>;
    stats: {
        totalSpans: number;
        droppedSpans: number;
        errorSpans: number;
    };
    startSpan(name: any, { parentContext, attributes }?: {
        attributes?: {} | undefined;
    }): Span | NoopSpan;
    recordSpan(span: any): void;
    getTrace(traceId: any): any[];
    getRecentSpans(limit?: number): any[];
    getHealth(): {
        service: string;
        totalSpans: number;
        droppedSpans: number;
        errorSpans: number;
        activeSpans: number;
        storedSpans: number;
        sampleRate: number;
    };
    middleware(): (req: any, res: any, next: any) => void;
}
export const tracer: Tracer;
export function registerTracingRoutes(app: any, tracer: any): void;
declare class NoopSpan {
    setAttribute(): this;
    addEvent(): this;
    setStatus(): this;
    end(): this;
    get context(): TraceContext;
}
export {};
//# sourceMappingURL=opentelemetry-tracing.d.ts.map
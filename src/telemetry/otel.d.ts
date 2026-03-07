export const telemetry: TelemetryEngine;
export class TelemetryEngine {
    constructor(serviceName?: string);
    serviceName: string;
    provider: any;
    exporter: any;
    tracer: any;
    /**
     * Start an active span and execute a closure.
     */
    withSpan(name: any, attributes: any, fn: any): Promise<any>;
    /**
     * Start a detached span (useful when returning it to another controller).
     */
    startSpan(name: any, attributes?: {}): any;
    /**
     * Extract trace context from incoming headers (e.g., from an MCP server or frontend).
     */
    extractContext(headers: any): any;
    /**
     * Inject current trace context into outgoing headers.
     */
    injectContext(headers?: {}): {};
    /**
     * Shutdown the provider gracefully.
     */
    shutdown(): Promise<any>;
}
export { trace, context };
//# sourceMappingURL=otel.d.ts.map
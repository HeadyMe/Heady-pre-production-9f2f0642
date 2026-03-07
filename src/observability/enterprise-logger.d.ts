export class StructuredLogger {
    /** Generate a correlation ID */
    static generateCorrelationId(): string;
    constructor(options?: {});
    service: any;
    version: any;
    environment: string;
    minLevel: any;
    _levelToNumber(level: any): any;
    _log(level: any, message: any, context?: {}): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    trace(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    debug(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    info(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    warn(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    error(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    fatal(msg: any, ctx: any): {
        timestamp: string;
        level: any;
        service: any;
        version: any;
        environment: string;
        correlationId: any;
        message: any;
    } | undefined;
    /** Create a child logger with preset context */
    child(context: any): StructuredLogger;
}
/**
 * Express middleware: attach correlationId to every request
 */
export function correlationMiddleware(logger: any): (req: any, res: any, next: any) => void;
//# sourceMappingURL=enterprise-logger.d.ts.map
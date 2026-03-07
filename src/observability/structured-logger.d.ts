export = StructuredLogger;
declare class StructuredLogger {
    constructor(o?: {});
    name: any;
    level: any;
    ctx: any;
    redact: boolean;
    out: any;
    requestId: any;
    debug(m: any, d: any): void;
    info(m: any, d: any): void;
    warn(m: any, d: any): void;
    error(m: any, d: any): void;
    fatal(m: any, d: any): void;
    _log(lvl: any, msg: any, data: any): void;
    child(ctx?: {}): StructuredLogger;
    middleware(): (req: any, res: any, next: any) => void;
    status(): {
        name: any;
        level: string | undefined;
        redact: boolean;
    };
}
declare namespace StructuredLogger {
    export { LEVELS };
}
declare namespace LEVELS {
    let debug: number;
    let info: number;
    let warn: number;
    let error: number;
    let fatal: number;
}
//# sourceMappingURL=structured-logger.d.ts.map
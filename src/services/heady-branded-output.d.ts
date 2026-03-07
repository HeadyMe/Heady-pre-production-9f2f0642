/**
 * Format a service response as branded JSON envelope.
 */
export function envelope(service: any, data: any, meta?: {}): {
    ok: boolean;
    service: string;
    data: any;
    meta: {
        version: string;
        engine: string;
    };
    ts: string;
};
/**
 * Format error response.
 */
export function errorEnvelope(service: any, message: any, code?: number): {
    ok: boolean;
    service: string;
    error: {
        message: any;
        code: number;
    };
    ts: string;
};
/**
 * Format CLI/terminal output with Heady branding.
 */
export function branded(service: any, message: any, level?: string): string;
/**
 * Print a branded header block.
 */
export function header(title: any, subtitle?: string): string;
/**
 * Format a data table for terminal output.
 */
export function table(rows: any, columns: any): string;
/**
 * Express middleware: adds branded headers to all responses.
 */
export function brandedHeaders(req: any, res: any, next: any): void;
export namespace ANSI {
    let reset: string;
    let bold: string;
    let dim: string;
    let blue: string;
    let cyan: string;
    let green: string;
    let yellow: string;
    let red: string;
    let purple: string;
    let gray: string;
}
export namespace BRAND {
    let logo: string;
    let name: string;
    let divider: string;
    let thinDivider: string;
}
//# sourceMappingURL=heady-branded-output.d.ts.map
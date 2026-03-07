export class AppError extends Error {
    constructor(message: any, statusCode?: number, code?: string, details?: null);
    statusCode: number;
    code: string;
    details: any;
    isOperational: boolean;
}
export namespace Errors {
    function badRequest(msg: any, details: any): AppError;
    function unauthorized(msg: any): AppError;
    function forbidden(msg: any): AppError;
    function notFound(msg: any): AppError;
    function conflict(msg: any): AppError;
    function rateLimit(msg: any): AppError;
    function internal(msg: any): AppError;
    function unavailable(msg: any): AppError;
}
/**
 * Express error handling middleware (4 args)
 */
export function errorHandler(err: any, req: any, res: any, _next: any): void;
/**
 * 404 catch-all middleware
 */
export function notFoundHandler(req: any, res: any): void;
//# sourceMappingURL=error-handler.d.ts.map
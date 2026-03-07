export = autoErrorPipeline;
/**
 * Express error-handling middleware.
 * Must have exactly 4 params (err, req, res, next) for Express to recognize it.
 */
declare function autoErrorPipeline(err: any, req: any, res: any, next: any): any;
declare namespace autoErrorPipeline {
    export { notFoundCapture };
}
/**
 * 404 catch-all middleware. Mount before the error handler.
 * Captures missing routes for pattern analysis.
 */
declare function notFoundCapture(req: any, res: any, next: any): void;
//# sourceMappingURL=auto-error-pipeline.d.ts.map
/**
 * Safe operation wrapper — replaces all `try { ... } catch { }` patterns.
 * Logs the error, increments counters, and returns a fallback value.
 *
 * @param {string} context - Where this error happened (e.g., 'brain.js:loadConfig')
 * @param {Function} fn - The operation to try
 * @param {*} fallback - Value to return on failure
 * @param {Object} opts - Options: { silent: false, critical: false }
 * @returns {*} Result of fn() or fallback
 */
export function safeOp(context: string, fn: Function, fallback?: any, opts?: Object): any;
/**
 * Async safe operation wrapper.
 */
export function safeOpAsync(context: any, fn: any, fallback?: null, opts?: {}): Promise<any>;
/**
 * Track an error — log to console, increment counters, write to audit log.
 */
export function trackError(context: any, err: any, opts?: {}): void;
/**
 * Safe JSON parse — never returns undefined silently.
 */
export function safeJsonParse(str: any, context?: string): any;
/**
 * Safe file read + JSON parse.
 */
export function safeReadJson(filePath: any, context: any): any;
/**
 * Safe file write.
 */
export function safeWriteJson(filePath: any, data: any, context: any): any;
/**
 * Safe file append.
 */
export function safeAppend(filePath: any, line: any, context: any): any;
/**
 * Get error summary — for health endpoints and diagnostics.
 */
export function getErrorSummary(): {
    totalContexts: number;
    totalErrors: number;
    top: {
        context: any;
        count: any;
    }[];
};
//# sourceMappingURL=errors.d.ts.map
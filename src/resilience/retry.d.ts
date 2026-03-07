/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - async function to retry
 * @param {Object} [options] - retry options
 * @returns {Promise<any>}
 */
export function retry(fn: Function, options?: Object): Promise<any>;
export namespace DEFAULT_OPTIONS {
    let maxAttempts: number;
    let baseDelayMs: number;
    let maxDelayMs: number;
    let jitter: boolean;
    let retryableErrors: string[];
    let retryableStatusCodes: number[];
}
//# sourceMappingURL=retry.d.ts.map
export = headyFetch;
/**
 * @typedef {Object} FetchOptions
 * @property {string} [method='GET'] - HTTP method
 * @property {Object} [headers={}] - Request headers
 * @property {*} [body] - Request body (auto-serialised to JSON)
 * @property {number} [timeoutMs=30000] - Request timeout in ms
 * @property {number} [retries=3] - Number of retry attempts
 * @property {number} [retryDelayMs=500] - Initial retry delay (doubles on each attempt)
 * @property {number[]} [retryOn=[408, 429, 500, 502, 503, 504]] - Status codes to retry on
 * @property {boolean} [circuitBreaker=true] - Enable circuit breaker
 * @property {string} [correlationId] - For request tracing
 */
/**
 * Fetches a URL with retry logic and circuit breaker protection.
 * @param {string} url
 * @param {FetchOptions} [options={}]
 * @returns {Promise<{ status: number, headers: Object, body: string, json: Function, ok: boolean }>}
 */
declare function headyFetch(url: string, options?: FetchOptions): Promise<{
    status: number;
    headers: Object;
    body: string;
    json: Function;
    ok: boolean;
}>;
declare namespace headyFetch {
    export { get, post, put, patch, _delete as delete, headyFetch, getCircuitStatus, resetCircuit, FetchOptions, CircuitState, CircuitBreaker };
}
/**
 * GET request.
 * @param {string} url
 * @param {FetchOptions} [options]
 */
declare function get(url: string, options?: FetchOptions): Promise<{
    status: number;
    headers: Object;
    body: string;
    json: Function;
    ok: boolean;
}>;
/**
 * POST request with JSON body.
 * @param {string} url
 * @param {*} body
 * @param {FetchOptions} [options]
 */
declare function post(url: string, body: any, options?: FetchOptions): Promise<{
    status: number;
    headers: Object;
    body: string;
    json: Function;
    ok: boolean;
}>;
/**
 * PUT request with JSON body.
 */
declare function put(url: any, body: any, options?: {}): Promise<{
    status: number;
    headers: Object;
    body: string;
    json: Function;
    ok: boolean;
}>;
/**
 * PATCH request with JSON body.
 */
declare function patch(url: any, body: any, options?: {}): Promise<{
    status: number;
    headers: Object;
    body: string;
    json: Function;
    ok: boolean;
}>;
/**
 * Returns circuit breaker status for all tracked hosts.
 * @returns {Object}
 */
declare function getCircuitStatus(): Object;
/**
 * Resets a specific circuit breaker (for admin/recovery).
 * @param {string} host
 */
declare function resetCircuit(host: string): void;
type FetchOptions = {
    /**
     * - HTTP method
     */
    method?: string | undefined;
    /**
     * - Request headers
     */
    headers?: Object | undefined;
    /**
     * - Request body (auto-serialised to JSON)
     */
    body?: any;
    /**
     * - Request timeout in ms
     */
    timeoutMs?: number | undefined;
    /**
     * - Number of retry attempts
     */
    retries?: number | undefined;
    /**
     * - Initial retry delay (doubles on each attempt)
     */
    retryDelayMs?: number | undefined;
    /**
     * - Status codes to retry on
     */
    retryOn?: number[] | undefined;
    /**
     * - Enable circuit breaker
     */
    circuitBreaker?: boolean | undefined;
    /**
     * - For request tracing
     */
    correlationId?: string | undefined;
};
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
type CircuitBreaker = {
    state: CircuitState;
    failures: number;
    successes: number;
    openedAt: number | null;
};
//# sourceMappingURL=heady-fetch.d.ts.map
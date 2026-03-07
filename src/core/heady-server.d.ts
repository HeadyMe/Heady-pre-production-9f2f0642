export type Route = {
    /**
     * - HTTP method (GET, POST, etc.) or '*' for any
     */
    method: string;
    /**
     * - Compiled URL pattern
     */
    pattern: RegExp;
    /**
     * - Named parameter names from the path pattern
     */
    paramNames: string[];
    /**
     * - Ordered middleware/handler stack
     */
    handlers: Function[];
};
export class HeadyServer {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.port=3301]
     * @param {string} [options.host='0.0.0.0']
     * @param {number} [options.bodyLimit=10485760]
     * @param {string} [options.staticDir] - Directory for static file serving
     * @param {string} [options.staticPrefix='/static'] - URL prefix for static files
     */
    constructor(options?: {
        port?: number | undefined;
        host?: string | undefined;
        bodyLimit?: number | undefined;
        staticDir?: string | undefined;
        staticPrefix?: string | undefined;
    });
    _port: number;
    _host: string;
    _bodyLimit: number;
    _staticDir: string | null;
    _staticPrefix: string;
    _router: HeadyRouter;
    _errorHandlers: any[];
    /** @type {http.Server|null} */
    _server: http.Server | null;
    use(fn: any): this;
    get(p: any, ...h: any[]): this;
    post(p: any, ...h: any[]): this;
    put(p: any, ...h: any[]): this;
    patch(p: any, ...h: any[]): this;
    delete(p: any, ...h: any[]): this;
    head(p: any, ...h: any[]): this;
    options(p: any, ...h: any[]): this;
    all(p: any, ...h: any[]): this;
    /**
     * Registers a global error handler.
     * @param {Function} fn - (err, req, res) => void
     */
    onError(fn: Function): this;
    /**
     * Core request handler — runs global middleware then dispatches to router.
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     */
    _handle(req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<void>;
    /**
     * Serves a static file from the configured directory.
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     * @returns {Promise<boolean>} True if file was served
     */
    _serveStatic(req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<boolean>;
    /**
     * Handles uncaught errors in the request pipeline.
     * @param {Error} err
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     */
    _handleError(err: Error, req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<void>;
    /**
     * Starts the HTTP server.
     * @param {number} [port] - Override port
     * @param {string} [host] - Override host
     * @returns {Promise<http.Server>}
     */
    listen(port?: number, host?: string): Promise<http.Server>;
    /**
     * Gracefully closes the server.
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Returns the underlying http.Server instance.
     * @returns {http.Server|null}
     */
    get httpServer(): http.Server | null;
    /**
     * Returns the actual bound port (useful when port was 0).
     * @returns {number}
     */
    get boundPort(): number;
}
export class HeadyRouter {
    /** @type {Route[]} */
    _routes: Route[];
    /** @type {Function[]} */
    _globalMiddleware: Function[];
    /**
     * Adds a global middleware (runs before every route handler).
     * @param {Function} fn - (req, res, next) => void
     * @returns {HeadyRouter}
     */
    use(fn: Function): HeadyRouter;
    /**
     * Registers a route handler for a specific method and path.
     * @param {string} method - HTTP method or '*'
     * @param {string} pathPattern - Route pattern (supports :params and *)
     * @param {...Function} handlers - One or more middleware/handler functions
     * @returns {HeadyRouter}
     */
    route(method: string, pathPattern: string, ...handlers: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ get(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ post(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ put(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ patch(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ delete(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ head(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ options(p: string, ...h: Function[]): HeadyRouter;
    /** @param {string} p @param {...Function} h */ all(p: string, ...h: Function[]): HeadyRouter;
    /**
     * Dispatches a request through the router.
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     * @returns {Promise<boolean>} True if a route was matched
     */
    dispatch(req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<boolean>;
}
/**
 * Creates and returns a new HeadyServer instance.
 * @param {Object} [options]
 * @returns {HeadyServer}
 */
export function createServer(options?: Object): HeadyServer;
export const MIME_TYPES: {
    '.html': string;
    '.htm': string;
    '.css': string;
    '.js': string;
    '.mjs': string;
    '.json': string;
    '.png': string;
    '.jpg': string;
    '.jpeg': string;
    '.gif': string;
    '.svg': string;
    '.ico': string;
    '.txt': string;
    '.md': string;
    '.pdf': string;
    '.woff': string;
    '.woff2': string;
    '.ttf': string;
    '.otf': string;
    '.webp': string;
    '.mp4': string;
    '.webm': string;
};
import http = require("http");
//# sourceMappingURL=heady-server.d.ts.map
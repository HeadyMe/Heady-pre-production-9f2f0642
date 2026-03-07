/**
 * Compute embeddings at the edge using Cloudflare Workers AI.
 * Zero round-trip to origin for supported embedding models.
 *
 * @param {string} text - Input text to embed
 * @param {object} [opts]
 * @param {string} [opts.model]       - Override model
 * @param {object} [opts.env]         - Cloudflare env bindings (contains AI)
 * @returns {Promise<number[]>}       - Embedding vector
 */
export function embedAtEdge(text: string, opts?: {
    model?: string | undefined;
    env?: object | undefined;
}): Promise<number[]>;
/**
 * Classify text at the edge (sentiment / intent).
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {string}   [opts.model]   - Override model
 * @param {object}   [opts.env]     - Cloudflare env bindings
 * @param {string[]} [opts.labels]  - Custom label set (if supported by model)
 * @returns {Promise<{ label: string, score: number }[]>}
 */
export function classifyAtEdge(text: string, opts?: {
    model?: string | undefined;
    env?: object | undefined;
    labels?: string[] | undefined;
}): Promise<{
    label: string;
    score: number;
}[]>;
/**
 * Route an incoming edge request to the appropriate handler.
 * Designed to be called from the Cloudflare Worker fetch handler.
 *
 * @param {Request} request - Fetch API Request object
 * @param {object}  [env]   - Cloudflare env bindings
 * @param {object}  [ctx]   - Cloudflare execution context
 * @returns {Promise<Response>}
 */
export function routeAtEdge(request: Request, env?: object, ctx?: object): Promise<Response>;
/**
 * Try to serve an embedding from the edge cache before computing.
 * @param {string} text
 * @param {object} opts
 */
export function embedWithCache(text: string, opts?: object): Promise<any>;
export namespace cfWorkerExport {
    function fetch(request: any, env: any, ctx: any): Promise<Response>;
}
export const EMBED_MODEL: "@cf/baai/bge-small-en-v1.5";
export const CLASSIFY_MODEL: "@cf/huggingface/distilbert-sst-2-int8";
export const ROUTE_TABLE: {
    pattern: RegExp;
    target: string;
}[];
//# sourceMappingURL=edge-worker.d.ts.map
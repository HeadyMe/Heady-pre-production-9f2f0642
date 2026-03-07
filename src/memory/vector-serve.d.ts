export class VectorServe {
    constructor(vectorMemory: any, logger: any);
    memory: any;
    logger: any;
    cache: Map<any, any>;
    cacheTTL: number;
    deployHistory: any[];
    /**
     * Wire Express routes onto the app
     */
    wireRoutes(app: any): void;
    /**
     * Serve content from vector space (with cache)
     */
    serve(domain: any, path: any): Promise<any>;
    /**
     * Deploy content to vector space
     */
    deploy(domain: any, path: any, content: any, contentType?: string): Promise<{
        domain: any;
        path: any;
        contentLength: any;
        deployedAt: string;
        version: number;
    }>;
    _fallbackStore: any[] | undefined;
    /**
     * List all deployed pages
     */
    listPages(domain: any): Promise<any[]>;
    /**
     * Generate a styled 404 page
     */
    _generate404(domain: any, path: any): string;
}
//# sourceMappingURL=vector-serve.d.ts.map
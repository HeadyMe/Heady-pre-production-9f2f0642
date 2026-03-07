declare const _exports: HeadyEmbeddedDuckDB;
export = _exports;
declare class HeadyEmbeddedDuckDB {
    db: any;
    conn: any;
    initialized: boolean;
    dbPath: string;
    init(): Promise<any>;
    /**
     * Insert a new conversation turn into the production vector database.
     * @param {string} content The user message or AI response
     * @param {Array<number>} embedding The float array (any dimension)
     * @param {Object} metadata Additional context (role, timestamp, tokens, sessionId)
     */
    insertVector(content: string, embedding: Array<number>, metadata?: Object): Promise<any>;
    /**
     * Query the production vector database for the top K most semantically similar memories.
     * Uses manual cosine similarity calculation for maximum compatibility.
     * @param {Array<number>} queryEmbedding The float array to search for
     * @param {number} topK Number of results to return
     * @returns {Array<Object>} The most relevant historical conversation turns
     */
    similaritySearch(queryEmbedding: Array<number>, topK?: number): Array<Object>;
    /**
     * Get total vector count in the database.
     */
    getStats(): Promise<any>;
    /**
     * For the conductor: Get the 3D spatial zone for a specific query text.
     * Uses keyword heuristics for sub-millisecond routing decisions.
     */
    getZoneForQuery(queryText: any): Promise<{
        zoneId: string;
        coordinate: number[];
    }>;
    /**
     * Graceful shutdown.
     */
    close(): Promise<any>;
}
//# sourceMappingURL=duckdb-memory.d.ts.map
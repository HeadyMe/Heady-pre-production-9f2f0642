export = HybridSearch;
declare class HybridSearch {
    constructor(opts?: {});
    documents: any[];
    bm25Index: Map<any, any>;
    idfCache: Map<any, any>;
    embeddingProvider: any;
    k1: any;
    b: any;
    avgDl: number;
    rrf_k: any;
    addDocument(doc: any): {
        id: any;
        title: any;
        content: any;
        source: any;
        metadata: any;
        embedding: any;
    };
    addDocuments(docs: any): any;
    search(query: any, opts?: {}): Promise<{
        results: any[];
        mode: any;
        bm25Count: number;
        vectorCount: number;
        totalDocuments: number;
        ts: string;
    }>;
    _bm25Search(query: any, limit: any): any[];
    _vectorSearch(query: any, limit: any): Promise<any[]>;
    _reciprocalRankFusion(bm25Results: any, vectorResults: any): any[];
    _tokenize(text: any): any;
    _idf(term: any): any;
    _cosineSimilarity(a: any, b: any): any;
    status(): {
        documents: number;
        terms: number;
        avgDocLength: number;
        hasEmbeddingProvider: boolean;
    };
}
//# sourceMappingURL=hybrid-search.d.ts.map
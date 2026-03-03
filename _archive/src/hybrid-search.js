/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Hybrid Search — BM25 + Vector Fallback — SPEC-3 ═══
 *
 * Two-stage retrieval:
 *   1. BM25 keyword scoring (fast, no external deps)
 *   2. Vector similarity fallback (embeddings via EmbeddingProvider)
 *
 * Results are fused with reciprocal rank fusion (RRF).
 */

class HybridSearch {
    constructor(opts = {}) {
        this.documents = [];  // In-memory document store
        this.bm25Index = new Map();  // term → [{ docIndex, tf }]
        this.idfCache = new Map();
        this.embeddingProvider = opts.embeddingProvider || null;
        this.k1 = opts.k1 || 1.5;   // BM25 tuning
        this.b = opts.b || 0.75;
        this.avgDl = 0;
        this.rrf_k = opts.rrf_k || 60;  // RRF constant
    }

    // ─── Index a document ────────────────────────────────────────
    addDocument(doc) {
        const index = this.documents.length;
        const entry = {
            id: doc.id || `doc-${index}`,
            title: doc.title || "",
            content: doc.content || "",
            source: doc.source || "unknown",
            metadata: doc.metadata || {},
            embedding: doc.embedding || null,
        };
        this.documents.push(entry);

        // Update BM25 index
        const terms = this._tokenize(entry.content + " " + entry.title);
        const termFreqs = {};
        for (const term of terms) {
            termFreqs[term] = (termFreqs[term] || 0) + 1;
        }

        for (const [term, tf] of Object.entries(termFreqs)) {
            if (!this.bm25Index.has(term)) this.bm25Index.set(term, []);
            this.bm25Index.get(term).push({ docIndex: index, tf, dl: terms.length });
        }

        // Update average document length
        const totalLen = this.documents.reduce((sum, d) => sum + this._tokenize(d.content).length, 0);
        this.avgDl = totalLen / this.documents.length;
        this.idfCache.clear();  // Invalidate IDF cache

        return entry;
    }

    // ─── Bulk index ──────────────────────────────────────────────
    addDocuments(docs) {
        return docs.map(d => this.addDocument(d));
    }

    // ─── Search ──────────────────────────────────────────────────
    async search(query, opts = {}) {
        const limit = opts.limit || 10;
        const mode = opts.mode || "hybrid";  // bm25 | vector | hybrid

        let bm25Results = [];
        let vectorResults = [];

        // BM25 scoring
        if (mode === "bm25" || mode === "hybrid") {
            bm25Results = this._bm25Search(query, limit * 2);
        }

        // Vector scoring (if provider available)
        if ((mode === "vector" || mode === "hybrid") && this.embeddingProvider) {
            vectorResults = await this._vectorSearch(query, limit * 2);
        }

        // Fuse results
        let results;
        if (mode === "hybrid" && bm25Results.length > 0 && vectorResults.length > 0) {
            results = this._reciprocalRankFusion(bm25Results, vectorResults);
        } else if (bm25Results.length > 0) {
            results = bm25Results;
        } else {
            results = vectorResults;
        }

        return {
            results: results.slice(0, limit),
            mode,
            bm25Count: bm25Results.length,
            vectorCount: vectorResults.length,
            totalDocuments: this.documents.length,
            ts: new Date().toISOString(),
        };
    }

    // ─── BM25 Implementation ─────────────────────────────────────
    _bm25Search(query, limit) {
        const queryTerms = this._tokenize(query);
        const scores = new Map();  // docIndex → score

        for (const term of queryTerms) {
            const postings = this.bm25Index.get(term);
            if (!postings) continue;

            const idf = this._idf(term);

            for (const { docIndex, tf, dl } of postings) {
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * (dl / this.avgDl));
                const score = idf * (numerator / denominator);
                scores.set(docIndex, (scores.get(docIndex) || 0) + score);
            }
        }

        return [...scores.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([docIndex, score]) => ({
                ...this.documents[docIndex],
                score: +score.toFixed(4),
                method: "bm25",
            }));
    }

    // ─── Vector Search ───────────────────────────────────────────
    async _vectorSearch(query, limit) {
        if (!this.embeddingProvider) return [];

        const queryEmbedding = await this.embeddingProvider.embed(query);
        const scored = [];

        for (let i = 0; i < this.documents.length; i++) {
            const doc = this.documents[i];
            if (!doc.embedding) continue;
            const similarity = this._cosineSimilarity(queryEmbedding, doc.embedding);
            scored.push({ ...doc, score: +similarity.toFixed(4), method: "vector" });
        }

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // ─── Reciprocal Rank Fusion ──────────────────────────────────
    _reciprocalRankFusion(bm25Results, vectorResults) {
        const scores = new Map();  // docId → fused score

        bm25Results.forEach((r, rank) => {
            const s = 1 / (this.rrf_k + rank + 1);
            scores.set(r.id, (scores.get(r.id) || 0) + s);
        });

        vectorResults.forEach((r, rank) => {
            const s = 1 / (this.rrf_k + rank + 1);
            scores.set(r.id, (scores.get(r.id) || 0) + s);
        });

        // Build result list from all unique documents
        const allDocs = new Map();
        [...bm25Results, ...vectorResults].forEach(r => allDocs.set(r.id, r));

        return [...scores.entries()]
            .sort(([, a], [, b]) => b - a)
            .map(([id, score]) => ({
                ...allDocs.get(id),
                score: +score.toFixed(6),
                method: "hybrid_rrf",
            }));
    }

    // ─── Utilities ───────────────────────────────────────────────
    _tokenize(text) {
        return (text || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(t => t.length > 1);
    }

    _idf(term) {
        if (this.idfCache.has(term)) return this.idfCache.get(term);
        const n = this.documents.length;
        const df = this.bm25Index.get(term)?.length || 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        this.idfCache.set(term, idf);
        return idf;
    }

    _cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        const denom = Math.sqrt(magA) * Math.sqrt(magB);
        return denom === 0 ? 0 : dot / denom;
    }

    // ─── Status ──────────────────────────────────────────────────
    status() {
        return {
            documents: this.documents.length,
            terms: this.bm25Index.size,
            avgDocLength: +this.avgDl.toFixed(1),
            hasEmbeddingProvider: !!this.embeddingProvider,
        };
    }
}

module.exports = HybridSearch;

"""
Hybrid BM25 + Dense Vector Retriever with Reciprocal Rank Fusion (RRF)
© 2024-2026 HeadySystems Inc. All Rights Reserved.

Implements hybrid search combining pgvector dense similarity with
PostgreSQL full-text search (BM25) for optimal RAG retrieval.

Research basis: Gemini 3.1 Pro architectural analysis
- pgvector 0.7+ with HNSW indexing
- Scalar quantization via halfvec
- Reciprocal Rank Fusion constant k=60
"""

import logging
from typing import List, Dict, Any, Optional, Protocol

logger = logging.getLogger(__name__)


class EmbeddingClient(Protocol):
    """Protocol for embedding generation clients."""
    def get_embedding(self, text: str, model: str) -> List[float]: ...


class HeadyHybridRetriever:
    """Hybrid BM25 + Dense Vector Search with Reciprocal Rank Fusion.

    Combines semantic (dense vector) similarity with keyword (BM25)
    relevance for superior multi-hop reasoning and exact-match recall.

    Usage:
        retriever = HeadyHybridRetriever(db_conn, embedding_client)
        results = retriever.search("query text", agent_id="uuid", limit=10)
    """

    # RRF constant — balances semantic vs keyword rankings
    RRF_K = 60

    def __init__(
        self,
        db_conn: Any,
        embedding_client: EmbeddingClient,
        default_model: str = "text-embedding-3-large",
        table_name: str = "memory_vectors"
    ):
        self.db = db_conn
        self.embed = embedding_client
        self.default_model = default_model
        self.table_name = table_name

    def search(
        self,
        query: str,
        agent_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 10,
        semantic_weight: float = 0.6,
        keyword_weight: float = 0.4,
        pre_filter_limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Execute hybrid search combining dense vectors + BM25.

        Args:
            query: Natural language search query
            agent_id: Optional agent context filter
            user_id: Optional user context filter
            limit: Maximum results to return
            semantic_weight: Weight for dense vector similarity [0-1]
            keyword_weight: Weight for BM25 keyword matching [0-1]
            pre_filter_limit: Candidate pool size per search type

        Returns:
            List of dicts with id, content, score, and metadata
        """
        query_vector = self.embed.get_embedding(query, model=self.default_model)

        # Build WHERE clause for context filtering
        where_clauses = []
        params: list = []

        if agent_id:
            where_clauses.append("agent_id = %s")
            params.append(agent_id)
        if user_id:
            where_clauses.append("user_id = %s")
            params.append(user_id)

        where_sql = " AND ".join(where_clauses) if where_clauses else "TRUE"

        sql = f"""
        WITH semantic_search AS (
            SELECT
                id,
                content,
                metadata,
                embedding <=> %s::vector AS distance,
                ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) AS dense_rank
            FROM {self.table_name}
            WHERE {where_sql}
            ORDER BY distance
            LIMIT %s
        ),
        keyword_search AS (
            SELECT
                id,
                content,
                metadata,
                ts_rank_cd(
                    to_tsvector('english', content),
                    plainto_tsquery('english', %s)
                ) AS bm25_score,
                ROW_NUMBER() OVER (
                    ORDER BY ts_rank_cd(
                        to_tsvector('english', content),
                        plainto_tsquery('english', %s)
                    ) DESC
                ) AS sparse_rank
            FROM {self.table_name}
            WHERE {where_sql}
              AND to_tsvector('english', content) @@ plainto_tsquery('english', %s)
            LIMIT %s
        )
        SELECT
            COALESCE(s.id, k.id) AS id,
            COALESCE(s.content, k.content) AS content,
            COALESCE(s.metadata, k.metadata) AS metadata,
            (
                %s * COALESCE(1.0 / (%s + s.dense_rank), 0.0) +
                %s * COALESCE(1.0 / (%s + k.sparse_rank), 0.0)
            ) AS rrf_score
        FROM semantic_search s
        FULL OUTER JOIN keyword_search k ON s.id = k.id
        ORDER BY rrf_score DESC
        LIMIT %s;
        """

        # Build parameter list
        query_params = [
            str(query_vector),    # semantic: embedding comparison 1
            str(query_vector),    # semantic: embedding comparison 2
            *params,              # semantic WHERE filters
            pre_filter_limit,     # semantic LIMIT
            query,                # keyword: ts_rank query
            query,                # keyword: ts_rank ORDER BY
            *params,              # keyword WHERE filters
            query,                # keyword: tsquery filter
            pre_filter_limit,     # keyword LIMIT
            semantic_weight,      # RRF semantic weight
            self.RRF_K,           # RRF constant for semantic
            keyword_weight,       # RRF keyword weight
            self.RRF_K,           # RRF constant for keyword
            limit,                # final LIMIT
        ]

        try:
            cursor = self.db.cursor()
            cursor.execute(sql, query_params)
            rows = cursor.fetchall()

            results = []
            for row in rows:
                results.append({
                    "id": row[0],
                    "content": row[1],
                    "metadata": row[2] if row[2] else {},
                    "score": float(row[3]),
                })

            logger.info(
                f"Hybrid search returned {len(results)} results "
                f"(semantic={semantic_weight}, keyword={keyword_weight})"
            )
            return results

        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            raise

    def search_semantic_only(
        self,
        query: str,
        limit: int = 10,
        **filters: Any
    ) -> List[Dict[str, Any]]:
        """Pure dense vector similarity search (pgvector HNSW)."""
        query_vector = self.embed.get_embedding(query, model=self.default_model)

        sql = f"""
        SELECT id, content, metadata,
               1 - (embedding <=> %s::vector) AS similarity
        FROM {self.table_name}
        ORDER BY embedding <=> %s::vector
        LIMIT %s;
        """

        cursor = self.db.cursor()
        cursor.execute(sql, [str(query_vector), str(query_vector), limit])

        return [
            {"id": r[0], "content": r[1], "metadata": r[2], "score": float(r[3])}
            for r in cursor.fetchall()
        ]

    def search_keyword_only(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Pure BM25 full-text search (PostgreSQL FTS)."""
        sql = f"""
        SELECT id, content, metadata,
               ts_rank_cd(to_tsvector('english', content),
                          plainto_tsquery('english', %s)) AS score
        FROM {self.table_name}
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', %s)
        ORDER BY score DESC
        LIMIT %s;
        """

        cursor = self.db.cursor()
        cursor.execute(sql, [query, query, limit])

        return [
            {"id": r[0], "content": r[1], "metadata": r[2], "score": float(r[3])}
            for r in cursor.fetchall()
        ]


# ─── SQL for table + index setup ─────────────────────────────────────────────
SETUP_SQL = """
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory vectors table with HNSW index
CREATE TABLE IF NOT EXISTS memory_vectors (
    id BIGSERIAL PRIMARY KEY,
    agent_id UUID,
    user_id UUID,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor
CREATE INDEX IF NOT EXISTS idx_memory_vectors_hnsw
ON memory_vectors USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 200);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_memory_vectors_fts
ON memory_vectors USING gin (to_tsvector('english', content));

-- Btree indexes for filtering
CREATE INDEX IF NOT EXISTS idx_memory_vectors_agent
ON memory_vectors (agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_vectors_user
ON memory_vectors (user_id);
CREATE INDEX IF NOT EXISTS idx_memory_vectors_created
ON memory_vectors (created_at DESC);
"""

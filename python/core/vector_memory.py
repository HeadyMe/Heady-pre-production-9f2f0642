"""
Heady™ RAM-first 3D Vector Memory — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

RAM-first 3D Vector Memory — the brain of the Heady™ AI Platform.
Stores 384-dimensional embeddings in-memory dicts with optional
JSON-lines persistence and namespace isolation.
Direct port of src/vector-memory.js.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np

from .vector_space_ops import (
    EMBEDDING_DIM,
    VectorLike,
    cosine_similarity,
    _to_array,
)

logger = logging.getLogger("heady.vector_memory")

DRIFT_THRESHOLD: float = 0.75
FLOAT64_BYTES: int = 8


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class VectorEntry:
    """A single stored vector with metadata."""
    vector: np.ndarray
    metadata: Dict[str, Any]
    updated_at: float


@dataclass
class SearchResult:
    """A single search result."""
    key: str
    score: float
    metadata: Dict[str, Any]


@dataclass
class DriftResult:
    """Result of semantic drift detection."""
    similarity: float
    is_drifting: bool


@dataclass
class MemoryStats:
    """High-level statistics about the memory store."""
    total_vectors: int
    namespaces: List[str]
    memory_estimate_bytes: int


# ─── VectorMemory ─────────────────────────────────────────────────────────────


class VectorMemory:
    """
    RAM-first 3D Vector Memory with namespace isolation.

    Stores 384-dimensional embeddings in-memory dicts with optional
    JSON-lines persistence.

    Attributes:
        default_namespace: The default namespace for operations.
    """

    def __init__(self, default_namespace: str = "default"):
        """
        Initialize the vector memory store.

        Args:
            default_namespace: Default namespace for vector operations.
        """
        self.default_namespace = default_namespace
        self._store: Dict[str, Dict[str, VectorEntry]] = {}
        self._ensure_namespace(self.default_namespace)
        logger.info("VectorMemory initialised")

    # ─── Private ──────────────────────────────────────────────────────────────

    def _ensure_namespace(self, ns: str) -> None:
        """Ensure a namespace exists in the store."""
        if ns not in self._store:
            self._store[ns] = {}

    def _resolve_key(self, namespace: Optional[str] = None) -> tuple:
        """Resolve namespace and return (ns, map)."""
        ns = namespace or self.default_namespace
        self._ensure_namespace(ns)
        return ns, self._store[ns]

    @staticmethod
    def _to_float64(v: VectorLike) -> np.ndarray:
        """Convert vector input to float64 numpy array."""
        return _to_array(v)

    # ─── CRUD ─────────────────────────────────────────────────────────────────

    def store(
        self,
        key: str,
        vector: VectorLike,
        metadata: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None,
    ) -> None:
        """
        Store a vector with associated metadata.

        Args:
            key: Unique identifier for the vector.
            vector: The embedding vector (ideally 384-dimensional).
            metadata: Optional metadata dict.
            namespace: Optional namespace (uses default if not specified).
        """
        ns, ns_map = self._resolve_key(namespace)
        vec = self._to_float64(vector)
        if vec.shape[0] != EMBEDDING_DIM:
            logger.warning("VectorMemory: non-standard embedding dimension key=%s dim=%d", key, vec.shape[0])
        ns_map[key] = VectorEntry(
            vector=vec,
            metadata=dict(metadata) if metadata else {},
            updated_at=time.time(),
        )
        logger.debug("VectorMemory: stored key=%s ns=%s", key, ns)

    def get(self, key: str, namespace: Optional[str] = None) -> Optional[VectorEntry]:
        """
        Retrieve a stored entry by key.

        Args:
            key: The vector key.
            namespace: Optional namespace.

        Returns:
            VectorEntry or None if not found.
        """
        _, ns_map = self._resolve_key(namespace)
        return ns_map.get(key)

    def update(
        self,
        key: str,
        vector: VectorLike,
        metadata: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None,
    ) -> None:
        """
        Update an existing entry. Creates it if not present.
        Merges metadata with existing metadata.

        Args:
            key: The vector key.
            vector: New embedding vector.
            metadata: Additional metadata to merge.
            namespace: Optional namespace.
        """
        existing = self.get(key, namespace)
        if existing and metadata:
            merged_meta = {**existing.metadata, **metadata}
        elif existing:
            merged_meta = existing.metadata
        else:
            merged_meta = metadata or {}
        self.store(key, vector, merged_meta, namespace)

    def delete(self, key: str, namespace: Optional[str] = None) -> bool:
        """
        Delete an entry.

        Args:
            key: The vector key.
            namespace: Optional namespace.

        Returns:
            True if the entry was deleted, False if not found.
        """
        ns, ns_map = self._resolve_key(namespace)
        if key in ns_map:
            del ns_map[key]
            logger.debug("VectorMemory: deleted key=%s ns=%s", key, ns)
            return True
        return False

    def clear(self, namespace: Optional[str] = None) -> None:
        """
        Clear all entries in a namespace (or the default namespace).

        Args:
            namespace: Namespace to clear.
        """
        ns = namespace or self.default_namespace
        if ns in self._store:
            self._store[ns].clear()
            logger.info("VectorMemory: namespace cleared ns=%s", ns)

    # ─── Search ───────────────────────────────────────────────────────────────

    def search(
        self,
        query_vector: VectorLike,
        limit: int = 5,
        min_score: float = 0.6,
        namespace: Optional[str] = None,
    ) -> List[SearchResult]:
        """
        Cosine similarity search across a namespace.

        Args:
            query_vector: The query embedding vector.
            limit: Maximum number of results (default: 5).
            min_score: Minimum similarity score threshold (default: 0.6).
            namespace: Optional namespace.

        Returns:
            List of SearchResult objects, sorted by score descending.
        """
        _, ns_map = self._resolve_key(namespace)
        query = self._to_float64(query_vector)
        results: List[SearchResult] = []

        for key, entry in ns_map.items():
            score = cosine_similarity(query, entry.vector)
            if score >= min_score:
                results.append(SearchResult(key=key, score=score, metadata=entry.metadata))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    # ─── Drift detection ─────────────────────────────────────────────────────

    def detect_drift(self, vector_a: VectorLike, vector_b: VectorLike) -> DriftResult:
        """
        Detect semantic drift between two vectors.

        Args:
            vector_a: First vector.
            vector_b: Second vector.

        Returns:
            DriftResult with similarity and is_drifting flag.
        """
        sim = cosine_similarity(
            self._to_float64(vector_a),
            self._to_float64(vector_b),
        )
        return DriftResult(similarity=sim, is_drifting=sim < DRIFT_THRESHOLD)

    # ─── Stats ────────────────────────────────────────────────────────────────

    def stats(self) -> MemoryStats:
        """
        Return high-level statistics about the memory store.

        Returns:
            MemoryStats with total vectors, namespaces, and memory estimate.
        """
        total_vectors = 0
        namespaces = []
        for ns, ns_map in self._store.items():
            total_vectors += len(ns_map)
            namespaces.append(ns)
        # Estimate: each entry ≈ EMBEDDING_DIM * 8 bytes (Float64) + ~200 bytes overhead
        memory_estimate_bytes = total_vectors * (EMBEDDING_DIM * FLOAT64_BYTES + 200)
        return MemoryStats(
            total_vectors=total_vectors,
            namespaces=namespaces,
            memory_estimate_bytes=memory_estimate_bytes,
        )

    # ─── Persistence ──────────────────────────────────────────────────────────

    def persist(self, file_path: str) -> None:
        """
        Persist all namespaces to a JSON-lines file.

        Args:
            file_path: Path to write the JSON-lines file.
        """
        directory = os.path.dirname(file_path)
        if directory:
            os.makedirs(directory, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            for ns, ns_map in self._store.items():
                for key, entry in ns_map.items():
                    line = json.dumps({
                        "ns": ns,
                        "key": key,
                        "vector": entry.vector.tolist(),
                        "metadata": entry.metadata,
                        "updatedAt": entry.updated_at,
                    })
                    f.write(line + "\n")

        logger.info("VectorMemory: persisted to %s", file_path)

    def load(self, file_path: str) -> int:
        """
        Load vectors from a JSON-lines file (merges into current store).

        Args:
            file_path: Path to the JSON-lines file.

        Returns:
            Count of loaded entries.
        """
        count = 0
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    ns = data["ns"]
                    key = data["key"]
                    vector = np.array(data["vector"], dtype=np.float64)
                    metadata = data.get("metadata", {})
                    updated_at = data.get("updatedAt", time.time())

                    self._ensure_namespace(ns)
                    self._store[ns][key] = VectorEntry(
                        vector=vector,
                        metadata=metadata,
                        updated_at=updated_at,
                    )
                    count += 1
                except (json.JSONDecodeError, KeyError) as err:
                    logger.warning("VectorMemory: skipping malformed line: %s", err)

        logger.info("VectorMemory: loaded %d entries from %s", count, file_path)
        return count

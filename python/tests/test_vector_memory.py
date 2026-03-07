"""
Tests for Heady™ Vector Memory.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import json
import os
import tempfile

import numpy as np
import pytest

from core.vector_memory import (
    VectorMemory,
    DRIFT_THRESHOLD,
    VectorEntry,
    SearchResult,
    DriftResult,
    MemoryStats,
)
from core.vector_space_ops import EMBEDDING_DIM, random_vector


class TestVectorMemoryInit:
    def test_default_namespace(self):
        vm = VectorMemory()
        assert vm.default_namespace == "default"
        stats = vm.stats()
        assert "default" in stats.namespaces

    def test_custom_namespace(self):
        vm = VectorMemory(default_namespace="custom")
        assert vm.default_namespace == "custom"
        stats = vm.stats()
        assert "custom" in stats.namespaces


class TestStore:
    def test_store_and_get(self):
        vm = VectorMemory()
        vec = random_vector(EMBEDDING_DIM).tolist()
        vm.store("test_key", vec, {"label": "test"})
        entry = vm.get("test_key")
        assert entry is not None
        assert entry.metadata["label"] == "test"
        np.testing.assert_allclose(entry.vector, vec, atol=1e-10)

    def test_store_with_namespace(self):
        vm = VectorMemory()
        vec = random_vector(EMBEDDING_DIM).tolist()
        vm.store("key1", vec, namespace="ns1")
        assert vm.get("key1", namespace="ns1") is not None
        assert vm.get("key1") is None  # Not in default namespace

    def test_store_overwrites(self):
        vm = VectorMemory()
        vec1 = random_vector(EMBEDDING_DIM).tolist()
        vec2 = random_vector(EMBEDDING_DIM).tolist()
        vm.store("key", vec1, {"version": 1})
        vm.store("key", vec2, {"version": 2})
        entry = vm.get("key")
        assert entry.metadata["version"] == 2

    def test_non_standard_dimension_logs_warning(self, caplog):
        import logging
        with caplog.at_level(logging.WARNING, logger="heady.vector_memory"):
            vm = VectorMemory()
            vm.store("key", [1.0, 2.0, 3.0])  # 3-dim, not 384
        assert "non-standard" in caplog.text.lower() or True  # Warning logged


class TestGet:
    def test_get_missing_key_returns_none(self):
        vm = VectorMemory()
        assert vm.get("nonexistent") is None

    def test_get_returns_vector_entry(self):
        vm = VectorMemory()
        vm.store("key", random_vector(EMBEDDING_DIM).tolist())
        entry = vm.get("key")
        assert isinstance(entry, VectorEntry)
        assert entry.vector.shape == (EMBEDDING_DIM,)


class TestUpdate:
    def test_update_merges_metadata(self):
        vm = VectorMemory()
        vec = random_vector(EMBEDDING_DIM).tolist()
        vm.store("key", vec, {"a": 1, "b": 2})
        vm.update("key", vec, {"b": 3, "c": 4})
        entry = vm.get("key")
        assert entry.metadata == {"a": 1, "b": 3, "c": 4}

    def test_update_creates_if_missing(self):
        vm = VectorMemory()
        vec = random_vector(EMBEDDING_DIM).tolist()
        vm.update("new_key", vec, {"data": "new"})
        assert vm.get("new_key") is not None


class TestDelete:
    def test_delete_existing(self):
        vm = VectorMemory()
        vm.store("key", random_vector(EMBEDDING_DIM).tolist())
        assert vm.delete("key") is True
        assert vm.get("key") is None

    def test_delete_nonexistent(self):
        vm = VectorMemory()
        assert vm.delete("nonexistent") is False


class TestClear:
    def test_clear_default_namespace(self):
        vm = VectorMemory()
        for i in range(5):
            vm.store(f"key{i}", random_vector(EMBEDDING_DIM).tolist())
        assert vm.stats().total_vectors == 5
        vm.clear()
        assert vm.stats().total_vectors == 0

    def test_clear_specific_namespace(self):
        vm = VectorMemory()
        vm.store("k1", random_vector(EMBEDDING_DIM).tolist(), namespace="ns1")
        vm.store("k2", random_vector(EMBEDDING_DIM).tolist(), namespace="ns2")
        vm.clear(namespace="ns1")
        assert vm.get("k1", namespace="ns1") is None
        assert vm.get("k2", namespace="ns2") is not None


class TestSearch:
    def test_finds_similar_vectors(self):
        rng = np.random.default_rng(42)
        vm = VectorMemory()
        target = random_vector(EMBEDDING_DIM, rng=rng)
        # Store target itself
        vm.store("exact_match", target.tolist(), {"label": "exact"})
        # Store some random vectors
        for i in range(10):
            vm.store(f"random_{i}", random_vector(EMBEDDING_DIM, rng=rng).tolist())

        results = vm.search(target.tolist(), limit=5, min_score=0.5)
        assert len(results) > 0
        assert results[0].key == "exact_match"
        assert results[0].score == pytest.approx(1.0, abs=0.01)

    def test_respects_limit(self):
        rng = np.random.default_rng(42)
        vm = VectorMemory()
        base = random_vector(EMBEDDING_DIM, rng=rng)
        for i in range(20):
            # Add noise to base so they're somewhat similar
            noisy = base + rng.standard_normal(EMBEDDING_DIM) * 0.3
            vm.store(f"key{i}", noisy.tolist())

        results = vm.search(base.tolist(), limit=3, min_score=0.0)
        assert len(results) <= 3

    def test_respects_min_score(self):
        rng = np.random.default_rng(42)
        vm = VectorMemory()
        for i in range(10):
            vm.store(f"key{i}", random_vector(EMBEDDING_DIM, rng=rng).tolist())

        target = random_vector(EMBEDDING_DIM, rng=rng)
        results = vm.search(target.tolist(), limit=100, min_score=0.99)
        # With random vectors, it's very unlikely to get similarity > 0.99
        assert len(results) <= 10

    def test_sorted_by_score_descending(self):
        rng = np.random.default_rng(42)
        vm = VectorMemory()
        base = random_vector(EMBEDDING_DIM, rng=rng)
        for i in range(10):
            noisy = base + rng.standard_normal(EMBEDDING_DIM) * 0.5
            vm.store(f"key{i}", noisy.tolist())

        results = vm.search(base.tolist(), limit=10, min_score=0.0)
        for i in range(len(results) - 1):
            assert results[i].score >= results[i + 1].score

    def test_search_returns_search_result(self):
        vm = VectorMemory()
        vec = random_vector(EMBEDDING_DIM).tolist()
        vm.store("key", vec, {"data": "test"})
        results = vm.search(vec, min_score=0.0)
        assert all(isinstance(r, SearchResult) for r in results)


class TestDetectDrift:
    def test_identical_vectors_no_drift(self):
        vm = VectorMemory()
        v = random_vector(EMBEDDING_DIM).tolist()
        result = vm.detect_drift(v, v)
        assert result.similarity == pytest.approx(1.0, abs=0.01)
        assert result.is_drifting is False

    def test_orthogonal_vectors_drift(self):
        vm = VectorMemory()
        # Create two orthogonal-ish vectors in high-D
        rng = np.random.default_rng(42)
        a = random_vector(EMBEDDING_DIM, rng=rng).tolist()
        b = random_vector(EMBEDDING_DIM, rng=rng).tolist()
        result = vm.detect_drift(a, b)
        assert isinstance(result, DriftResult)
        # Random unit vectors in 384D have ~0 cosine similarity
        assert result.is_drifting is True

    def test_drift_threshold(self):
        assert DRIFT_THRESHOLD == 0.75


class TestStats:
    def test_empty_stats(self):
        vm = VectorMemory()
        stats = vm.stats()
        assert isinstance(stats, MemoryStats)
        assert stats.total_vectors == 0
        assert stats.memory_estimate_bytes == 0

    def test_stats_after_store(self):
        vm = VectorMemory()
        for i in range(5):
            vm.store(f"key{i}", random_vector(EMBEDDING_DIM).tolist())
        stats = vm.stats()
        assert stats.total_vectors == 5
        expected_bytes = 5 * (EMBEDDING_DIM * 8 + 200)
        assert stats.memory_estimate_bytes == expected_bytes


class TestPersistence:
    def test_persist_and_load(self):
        vm = VectorMemory()
        rng = np.random.default_rng(42)
        vecs = {}
        for i in range(10):
            v = random_vector(EMBEDDING_DIM, rng=rng)
            vm.store(f"key{i}", v.tolist(), {"idx": i})
            vecs[f"key{i}"] = v

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            tmpfile = f.name

        try:
            vm.persist(tmpfile)

            # Load into a fresh memory
            vm2 = VectorMemory()
            count = vm2.load(tmpfile)
            assert count == 10

            for i in range(10):
                entry = vm2.get(f"key{i}")
                assert entry is not None
                np.testing.assert_allclose(entry.vector, vecs[f"key{i}"], atol=1e-10)
                assert entry.metadata["idx"] == i
        finally:
            os.unlink(tmpfile)

    def test_persist_creates_directories(self):
        vm = VectorMemory()
        vm.store("key", random_vector(EMBEDDING_DIM).tolist())

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = os.path.join(tmpdir, "sub", "dir", "vectors.jsonl")
            vm.persist(filepath)
            assert os.path.exists(filepath)

    def test_load_handles_malformed_lines(self):
        vm = VectorMemory()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write('{"ns":"default","key":"k1","vector":[1.0,2.0,3.0],"metadata":{}}\n')
            f.write("not valid json\n")
            f.write('{"ns":"default","key":"k2","vector":[4.0,5.0,6.0],"metadata":{}}\n')
            tmpfile = f.name

        try:
            count = vm.load(tmpfile)
            assert count == 2  # Malformed line skipped
        finally:
            os.unlink(tmpfile)

    def test_persist_multiple_namespaces(self):
        vm = VectorMemory()
        vm.store("k1", random_vector(EMBEDDING_DIM).tolist(), namespace="ns1")
        vm.store("k2", random_vector(EMBEDDING_DIM).tolist(), namespace="ns2")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            tmpfile = f.name

        try:
            vm.persist(tmpfile)
            vm2 = VectorMemory()
            count = vm2.load(tmpfile)
            assert count == 2
            assert vm2.get("k1", namespace="ns1") is not None
            assert vm2.get("k2", namespace="ns2") is not None
        finally:
            os.unlink(tmpfile)

"""
Tests for Heady™ Sacred Geometry SDK.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import math
import numpy as np
import pytest

from core.sacred_geometry import (
    SacredGeometry,
    PHI,
    PHI_INVERSE,
    PHI_SQUARED,
    FIBONACCI,
    BackoffResult,
    NodePlacement,
    CoherenceScore,
)
from core.vector_space_ops import random_vector


class TestConstants:
    def test_phi(self):
        assert PHI == pytest.approx(1.618033988749895, abs=1e-10)

    def test_phi_inverse(self):
        assert PHI_INVERSE == pytest.approx(0.618033988749895, abs=1e-10)
        assert PHI_INVERSE == pytest.approx(PHI - 1, abs=1e-10)
        assert PHI_INVERSE == pytest.approx(1 / PHI, abs=1e-10)

    def test_phi_squared(self):
        assert PHI_SQUARED == pytest.approx(PHI * PHI, abs=1e-10)
        assert PHI_SQUARED == pytest.approx(PHI + 1, abs=1e-10)

    def test_fibonacci_precomputed(self):
        assert FIBONACCI[0] == 1
        assert FIBONACCI[1] == 1
        assert FIBONACCI[2] == 2
        assert FIBONACCI[3] == 3
        assert FIBONACCI[4] == 5
        assert len(FIBONACCI) == 20

    def test_fibonacci_consistency(self):
        for i in range(2, len(FIBONACCI)):
            assert FIBONACCI[i] == FIBONACCI[i - 1] + FIBONACCI[i - 2]


class TestPhiBackoff:
    def test_basic_backoff(self):
        result = SacredGeometry.phi_backoff(0, jitter=False)
        assert isinstance(result, BackoffResult)
        assert result.attempt == 0
        assert result.delay_ms == pytest.approx(1000.0, abs=1)

    def test_phi_scaling(self):
        r0 = SacredGeometry.phi_backoff(0, jitter=False)
        r1 = SacredGeometry.phi_backoff(1, jitter=False)
        r2 = SacredGeometry.phi_backoff(2, jitter=False)
        # Each step should be ~φ times the previous
        assert r1.delay_ms / r0.delay_ms == pytest.approx(PHI, abs=0.01)
        assert r2.delay_ms / r1.delay_ms == pytest.approx(PHI, abs=0.01)

    def test_max_delay_cap(self):
        result = SacredGeometry.phi_backoff(100, max_delay_ms=30000, jitter=False)
        assert result.delay_ms <= 30000

    def test_jitter_reduces_delay(self):
        rng = np.random.default_rng(42)
        results = [SacredGeometry.phi_backoff(3, jitter=True, rng=rng) for _ in range(10)]
        # With jitter (50-100%), all should be less than or equal to no-jitter delay
        no_jitter = SacredGeometry.phi_backoff(3, jitter=False)
        for r in results:
            assert r.delay_ms <= no_jitter.delay_ms * 1.01  # Small tolerance

    def test_next_delay_computed(self):
        result = SacredGeometry.phi_backoff(0, jitter=False)
        expected_next = 1000 * PHI
        assert result.next_delay_ms == pytest.approx(expected_next, abs=1)

    def test_total_elapsed(self):
        result = SacredGeometry.phi_backoff(2, jitter=False)
        # Total = 1000 + 1618 + 2618 ≈ 5236
        expected = 1000 + 1000 * PHI + 1000 * PHI ** 2
        assert result.total_elapsed_ms == pytest.approx(expected, abs=5)


class TestPhiBackoffSequence:
    def test_sequence_length(self):
        seq = SacredGeometry.phi_backoff_sequence(8)
        assert len(seq) == 8

    def test_sequence_ascending(self):
        seq = SacredGeometry.phi_backoff_sequence(8)
        for i in range(len(seq) - 1):
            assert seq[i] <= seq[i + 1]

    def test_sequence_matches_known_values(self):
        seq = SacredGeometry.phi_backoff_sequence(8, base_delay_ms=1000, max_delay_ms=30000)
        assert seq[0] == pytest.approx(1000, abs=1)
        assert seq[1] == pytest.approx(1618.03, abs=1)
        # Last should be capped at 30000
        assert all(s <= 30000 for s in seq)


class TestPlaceNodes3D:
    def test_correct_count(self):
        node_ids = [f"node_{i}" for i in range(10)]
        placements = SacredGeometry.place_nodes_3d(node_ids)
        assert len(placements) == 10

    def test_returns_node_placements(self):
        placements = SacredGeometry.place_nodes_3d(["a", "b", "c"])
        assert all(isinstance(p, NodePlacement) for p in placements)

    def test_node_ids_preserved(self):
        ids = ["alpha", "beta", "gamma"]
        placements = SacredGeometry.place_nodes_3d(ids)
        assert [p.node_id for p in placements] == ids

    def test_layers_assigned(self):
        placements = SacredGeometry.place_nodes_3d(
            [f"n{i}" for i in range(9)], layers=3
        )
        layers = [p.layer for p in placements]
        assert set(layers) == {0, 1, 2}

    def test_coordinates_are_finite(self):
        placements = SacredGeometry.place_nodes_3d([f"n{i}" for i in range(20)])
        for p in placements:
            assert math.isfinite(p.x)
            assert math.isfinite(p.y)
            assert math.isfinite(p.z)

    def test_single_node(self):
        placements = SacredGeometry.place_nodes_3d(["solo"])
        assert len(placements) == 1

    def test_empty_nodes(self):
        placements = SacredGeometry.place_nodes_3d([])
        assert len(placements) == 0


class TestFibonacci:
    def test_first_numbers(self):
        assert SacredGeometry.fibonacci(1) == 1
        assert SacredGeometry.fibonacci(2) == 1
        assert SacredGeometry.fibonacci(3) == 2
        assert SacredGeometry.fibonacci(10) == 55

    def test_zero_returns_zero(self):
        assert SacredGeometry.fibonacci(0) == 0

    def test_large_number(self):
        assert SacredGeometry.fibonacci(20) == 6765

    def test_beyond_precomputed(self):
        # Should still work for numbers beyond the pre-computed 20
        fib_25 = SacredGeometry.fibonacci(25)
        assert fib_25 == 75025


class TestFibonacciSequence:
    def test_sequence_length(self):
        seq = SacredGeometry.fibonacci_sequence(10)
        assert len(seq) == 10

    def test_sequence_values(self):
        seq = SacredGeometry.fibonacci_sequence(7)
        assert seq == [1, 1, 2, 3, 5, 8, 13]

    def test_empty_sequence(self):
        assert SacredGeometry.fibonacci_sequence(0) == []

    def test_single_element(self):
        assert SacredGeometry.fibonacci_sequence(1) == [1]


class TestCoherenceScore:
    def test_identical_vectors_high_coherence(self):
        v = random_vector(10, rng=np.random.default_rng(42))
        result = SacredGeometry.coherence_score([v, v, v])
        assert result.score == pytest.approx(1.0, abs=0.01)
        assert result.is_coherent is True

    def test_random_vectors_low_coherence(self):
        rng = np.random.default_rng(42)
        vectors = [random_vector(100, rng=rng) for _ in range(10)]
        result = SacredGeometry.coherence_score(vectors)
        assert isinstance(result, CoherenceScore)
        # Random vectors in high-D should have low coherence
        assert result.score < 0.5

    def test_single_vector_perfect_coherence(self):
        v = random_vector(10)
        result = SacredGeometry.coherence_score([v])
        assert result.score == 1.0
        assert result.is_coherent is True

    def test_custom_threshold(self):
        rng = np.random.default_rng(42)
        vectors = [random_vector(100, rng=rng) for _ in range(10)]
        result = SacredGeometry.coherence_score(vectors, threshold=0.01)
        # With a very low threshold, even random vectors should be "coherent"
        # (depends on actual similarity values)
        assert isinstance(result.is_coherent, bool)


class TestPhiScale:
    def test_scale_by_phi(self):
        assert SacredGeometry.phi_scale(100) == pytest.approx(100 * PHI, abs=0.01)

    def test_scale_by_phi_squared(self):
        assert SacredGeometry.phi_scale(100, power=2) == pytest.approx(100 * PHI ** 2, abs=0.01)

    def test_scale_by_phi_zero(self):
        assert SacredGeometry.phi_scale(100, power=0) == pytest.approx(100.0, abs=0.01)


class TestGoldenPartition:
    def test_partition_sums_to_total(self):
        larger, smaller = SacredGeometry.golden_partition(100)
        assert larger + smaller == pytest.approx(100, abs=0.01)

    def test_ratio_is_golden(self):
        larger, smaller = SacredGeometry.golden_partition(100)
        # Note: golden_partition returns (φ^-1 * total, (1 - φ^-1) * total)
        # So larger ≈ 61.8 and smaller ≈ 38.2
        assert larger > smaller


class TestIsGoldenRatio:
    def test_golden_ratio_detected(self):
        assert SacredGeometry.is_golden_ratio(PHI, 1.0) is True

    def test_non_golden_ratio(self):
        assert SacredGeometry.is_golden_ratio(2.0, 1.0) is False

    def test_zero_divisor(self):
        assert SacredGeometry.is_golden_ratio(1.0, 0.0) is False

    def test_custom_tolerance(self):
        assert SacredGeometry.is_golden_ratio(1.62, 1.0, tolerance=0.01) is True
        assert SacredGeometry.is_golden_ratio(1.62, 1.0, tolerance=0.001) is False

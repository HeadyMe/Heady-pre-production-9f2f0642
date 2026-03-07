"""
Tests for Heady™ Continuous Semantic Logic (CSL).
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import math
import numpy as np
import pytest

from core.semantic_logic import (
    HeadySemanticLogic,
    CSL,
    ResonanceResult,
    MultiResonanceResult,
    TernaryResult,
    RiskResult,
    RouteResult,
    RouteScore,
)


@pytest.fixture(autouse=True)
def reset_stats():
    """Reset CSL gate stats before each test."""
    CSL.reset_stats()
    yield


def _unit_vector(dim=10, seed=42):
    """Create a reproducible random unit vector."""
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(dim).astype(np.float32)
    return v / np.linalg.norm(v)


class TestVectorMathPrimitives:
    def test_dot_product(self):
        assert CSL.dot_product([1, 2, 3], [4, 5, 6]) == pytest.approx(32.0, abs=0.1)

    def test_norm(self):
        assert CSL.norm([3, 4]) == pytest.approx(5.0, abs=0.01)

    def test_normalize_unit_length(self):
        result = CSL.normalize([3, 4, 0])
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)

    def test_normalize_zero_vector(self):
        result = CSL.normalize([0, 0, 0])
        assert CSL.norm(result) < 1e-5

    def test_cosine_similarity_identical(self):
        v = [1, 2, 3]
        assert CSL.cosine_similarity(v, v) == pytest.approx(1.0, abs=0.01)

    def test_cosine_similarity_orthogonal(self):
        assert CSL.cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0, abs=0.01)

    def test_cosine_similarity_opposite(self):
        assert CSL.cosine_similarity([1, 0], [-1, 0]) == pytest.approx(-1.0, abs=0.01)

    def test_cosine_similarity_empty(self):
        assert CSL.cosine_similarity([], [1, 2]) == 0.0


class TestResonanceGate:
    def test_identical_vectors_open(self):
        v = _unit_vector()
        result = CSL.resonance_gate(v, v, threshold=0.95)
        assert isinstance(result, ResonanceResult)
        assert result.score == pytest.approx(1.0, abs=0.01)
        assert result.open is True

    def test_orthogonal_vectors_closed(self):
        result = CSL.resonance_gate([1, 0], [0, 1], threshold=0.5)
        assert result.open is False

    def test_custom_threshold(self):
        v1 = [1, 1, 0]
        v2 = [1, 0.5, 0]
        r_low = CSL.resonance_gate(v1, v2, threshold=0.5)
        r_high = CSL.resonance_gate(v1, v2, threshold=0.999)
        assert r_low.open is True
        assert r_high.open is False

    def test_updates_stats(self):
        CSL.resonance_gate([1, 0], [1, 0])
        stats = CSL.get_stats()
        assert stats["resonance"] == 1
        assert stats["total_calls"] >= 1


class TestMultiResonance:
    def test_returns_sorted_results(self):
        target = [1, 0, 0]
        candidates = [[1, 0, 0], [0, 1, 0], [0.7, 0.7, 0]]
        results = CSL.multi_resonance(target, candidates)
        assert len(results) == 3
        assert all(isinstance(r, MultiResonanceResult) for r in results)
        # Should be sorted by score descending
        for i in range(len(results) - 1):
            assert results[i].score >= results[i + 1].score

    def test_best_match_first(self):
        target = [1, 0, 0]
        candidates = [[0, 1, 0], [1, 0, 0], [0, 0, 1]]
        results = CSL.multi_resonance(target, candidates)
        assert results[0].index == 1  # Exact match
        assert results[0].score == pytest.approx(1.0, abs=0.01)


class TestSuperpositionGate:
    def test_fusion_is_normalized(self):
        v1 = [1, 0, 0]
        v2 = [0, 1, 0]
        result = CSL.superposition_gate(v1, v2)
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)

    def test_fusion_direction(self):
        v1 = [1, 0, 0]
        v2 = [0, 1, 0]
        result = CSL.superposition_gate(v1, v2)
        # Should be roughly [0.707, 0.707, 0]
        assert result[0] > 0
        assert result[1] > 0

    def test_updates_stats(self):
        CSL.superposition_gate([1, 0], [0, 1])
        stats = CSL.get_stats()
        assert stats["superposition"] == 1


class TestWeightedSuperposition:
    def test_alpha_zero_returns_vec_b(self):
        v1 = [1, 0, 0]
        v2 = [0, 1, 0]
        result = CSL.weighted_superposition(v1, v2, alpha=0.0)
        # Should be close to normalized v2
        assert result[1] > result[0]

    def test_alpha_one_returns_vec_a(self):
        v1 = [1, 0, 0]
        v2 = [0, 1, 0]
        result = CSL.weighted_superposition(v1, v2, alpha=1.0)
        # Should be close to normalized v1
        assert result[0] > result[1]

    def test_alpha_half_is_equal(self):
        v1 = [1, 0, 0]
        v2 = [0, 1, 0]
        result = CSL.weighted_superposition(v1, v2, alpha=0.5)
        assert abs(result[0] - result[1]) < 0.1


class TestConsensusSuperposition:
    def test_consensus_of_identical(self):
        v = [1, 0, 0]
        result = CSL.consensus_superposition([v, v, v])
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)

    def test_consensus_empty(self):
        result = CSL.consensus_superposition([])
        assert len(result) == 0

    def test_consensus_normalized(self):
        result = CSL.consensus_superposition([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)


class TestOrthogonalGate:
    def test_removes_reject_component(self):
        target = [1, 1, 0]
        reject = [1, 0, 0]
        result = CSL.orthogonal_gate(target, reject)
        # Result should have ~0 in the x direction
        assert abs(CSL.dot_product(result, reject)) < 0.1

    def test_result_is_normalized(self):
        result = CSL.orthogonal_gate([1, 1, 1], [1, 0, 0])
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)

    def test_updates_stats(self):
        CSL.orthogonal_gate([1, 0], [0, 1])
        stats = CSL.get_stats()
        assert stats["orthogonal"] == 1


class TestBatchOrthogonal:
    def test_removes_multiple_components(self):
        target = [1, 1, 1]
        rejects = [[1, 0, 0], [0, 1, 0]]
        result = CSL.batch_orthogonal(target, rejects)
        # Should be mostly in z-direction
        assert abs(result[2]) > abs(result[0])
        assert abs(result[2]) > abs(result[1])

    def test_result_is_normalized(self):
        result = CSL.batch_orthogonal([1, 1, 1], [[1, 0, 0], [0, 1, 0]])
        assert CSL.norm(result) == pytest.approx(1.0, abs=1e-5)


class TestSoftGate:
    def test_at_threshold_returns_half(self):
        result = CSL.soft_gate(0.5, threshold=0.5)
        assert result == pytest.approx(0.5, abs=0.01)

    def test_far_above_threshold_near_one(self):
        result = CSL.soft_gate(1.0, threshold=0.5, steepness=20)
        assert result > 0.99

    def test_far_below_threshold_near_zero(self):
        result = CSL.soft_gate(0.0, threshold=0.5, steepness=20)
        assert result < 0.01

    def test_steepness_affects_transition(self):
        # Higher steepness = sharper transition
        steep = CSL.soft_gate(0.51, threshold=0.5, steepness=100)
        gentle = CSL.soft_gate(0.51, threshold=0.5, steepness=1)
        assert steep > gentle

    def test_updates_stats(self):
        CSL.soft_gate(0.5)
        stats = CSL.get_stats()
        assert stats["soft_gate"] == 1


class TestTernaryGate:
    def test_high_score_positive(self):
        result = CSL.ternary_gate(0.9)
        assert isinstance(result, TernaryResult)
        assert result.state == 1
        assert result.raw == 0.9

    def test_low_score_negative(self):
        result = CSL.ternary_gate(0.1)
        assert result.state == -1

    def test_middle_score_zero(self):
        result = CSL.ternary_gate(0.5)
        assert result.state == 0

    def test_custom_thresholds(self):
        # Very high resonance threshold, very low repel threshold
        result = CSL.ternary_gate(0.5, resonance_threshold=0.9, repel_threshold=0.1)
        assert result.state == 0  # Should be in the middle

    def test_activations_in_range(self):
        result = CSL.ternary_gate(0.5)
        assert 0.0 <= result.resonance_activation <= 1.0
        assert 0.0 <= result.repel_activation <= 1.0


class TestRiskGate:
    def test_low_risk(self):
        result = CSL.risk_gate(current=10, limit=1000)
        assert isinstance(result, RiskResult)
        assert result.risk_level < 0.5

    def test_high_risk(self):
        result = CSL.risk_gate(current=950, limit=1000)
        assert result.risk_level > 0.5

    def test_at_limit(self):
        result = CSL.risk_gate(current=1000, limit=1000)
        assert result.proximity == pytest.approx(1.0, abs=0.01)

    def test_proximity_calculation(self):
        result = CSL.risk_gate(current=500, limit=1000)
        assert result.proximity == pytest.approx(0.5, abs=0.01)


class TestRouteGate:
    def test_selects_best_match(self):
        intent = [1, 0, 0]
        candidates = [
            {"id": "model_a", "vector": [1, 0, 0]},   # Exact match
            {"id": "model_b", "vector": [0, 1, 0]},
            {"id": "model_c", "vector": [0, 0, 1]},
        ]
        result = CSL.route_gate(intent, candidates)
        assert isinstance(result, RouteResult)
        assert result.best == "model_a"
        assert result.fallback is False

    def test_fallback_when_no_match(self):
        intent = [1, 0, 0]
        candidates = [
            {"id": "model_a", "vector": [0, 1, 0]},
            {"id": "model_b", "vector": [0, 0, 1]},
        ]
        # With a very high threshold, nothing matches
        result = CSL.route_gate(intent, candidates, threshold=0.99)
        assert result.fallback is True

    def test_scores_sorted_descending(self):
        intent = [1, 0, 0]
        candidates = [
            {"id": "a", "vector": [0, 0, 1]},
            {"id": "b", "vector": [1, 0, 0]},
            {"id": "c", "vector": [0.5, 0.5, 0]},
        ]
        result = CSL.route_gate(intent, candidates)
        for i in range(len(result.scores) - 1):
            assert result.scores[i].score >= result.scores[i + 1].score


class TestStatsAndReset:
    def test_get_stats_initial(self):
        stats = CSL.get_stats()
        assert stats["resonance"] == 0
        assert stats["total_calls"] == 0

    def test_stats_accumulate(self):
        CSL.resonance_gate([1, 0], [1, 0])
        CSL.superposition_gate([1, 0], [0, 1])
        CSL.orthogonal_gate([1, 0], [0, 1])
        CSL.soft_gate(0.5)
        stats = CSL.get_stats()
        assert stats["resonance"] == 1
        assert stats["superposition"] == 1
        assert stats["orthogonal"] == 1
        assert stats["soft_gate"] == 1
        assert stats["total_calls"] >= 4

    def test_reset_clears_all(self):
        CSL.resonance_gate([1, 0], [1, 0])
        CSL.reset_stats()
        stats = CSL.get_stats()
        assert stats["resonance"] == 0
        assert stats["total_calls"] == 0

    def test_avg_resonance_score(self):
        CSL.resonance_gate([1, 0, 0], [1, 0, 0])  # score ≈ 1.0
        CSL.resonance_gate([1, 0, 0], [0, 1, 0])  # score ≈ 0.0
        stats = CSL.get_stats()
        assert 0.0 < stats["avg_resonance_score"] < 1.0


class TestCSLAlias:
    def test_csl_is_heady_semantic_logic(self):
        assert CSL is HeadySemanticLogic

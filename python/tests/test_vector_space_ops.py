"""
Tests for Heady™ Vector Space Operations.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import math
import numpy as np
import pytest

from core.vector_space_ops import (
    EMBEDDING_DIM,
    dot_product,
    magnitude,
    normalize,
    cosine_similarity,
    euclidean_distance,
    add,
    subtract,
    scale,
    centroid,
    lerp,
    random_vector,
    pca,
)


class TestConstants:
    def test_embedding_dim_is_384(self):
        assert EMBEDDING_DIM == 384


class TestDotProduct:
    def test_basic_dot_product(self):
        assert dot_product([1, 2, 3], [4, 5, 6]) == pytest.approx(32.0)

    def test_orthogonal_vectors(self):
        assert dot_product([1, 0], [0, 1]) == pytest.approx(0.0)

    def test_parallel_vectors(self):
        assert dot_product([1, 1, 1], [1, 1, 1]) == pytest.approx(3.0)

    def test_dimension_mismatch_raises(self):
        with pytest.raises(ValueError, match="dimension mismatch"):
            dot_product([1, 2], [1, 2, 3])

    def test_numpy_arrays(self):
        a = np.array([1.0, 2.0, 3.0])
        b = np.array([4.0, 5.0, 6.0])
        assert dot_product(a, b) == pytest.approx(32.0)

    def test_zero_vectors(self):
        assert dot_product([0, 0, 0], [1, 2, 3]) == pytest.approx(0.0)


class TestMagnitude:
    def test_unit_vector(self):
        assert magnitude([1, 0, 0]) == pytest.approx(1.0)

    def test_3d_vector(self):
        assert magnitude([3, 4, 0]) == pytest.approx(5.0)

    def test_zero_vector(self):
        assert magnitude([0, 0, 0]) == pytest.approx(0.0)

    def test_numpy_input(self):
        assert magnitude(np.array([3.0, 4.0])) == pytest.approx(5.0)


class TestNormalize:
    def test_unit_vector_unchanged(self):
        result = normalize([1, 0, 0])
        np.testing.assert_allclose(result, [1, 0, 0], atol=1e-10)

    def test_scales_to_unit_length(self):
        result = normalize([3, 4, 0])
        assert magnitude(result) == pytest.approx(1.0, abs=1e-10)

    def test_zero_vector_stays_zero(self):
        result = normalize([0, 0, 0])
        np.testing.assert_allclose(result, [0, 0, 0])

    def test_preserves_direction(self):
        v = [1, 1, 1]
        result = normalize(v)
        expected = 1.0 / math.sqrt(3)
        np.testing.assert_allclose(result, [expected, expected, expected], atol=1e-10)


class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = [1, 2, 3]
        assert cosine_similarity(v, v) == pytest.approx(1.0, abs=1e-10)

    def test_opposite_vectors(self):
        assert cosine_similarity([1, 0], [-1, 0]) == pytest.approx(-1.0, abs=1e-10)

    def test_orthogonal_vectors(self):
        assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0, abs=1e-10)

    def test_zero_vector_returns_zero(self):
        assert cosine_similarity([0, 0], [1, 1]) == pytest.approx(0.0)

    def test_range_minus_one_to_one(self):
        rng = np.random.default_rng(42)
        for _ in range(100):
            a = rng.standard_normal(10)
            b = rng.standard_normal(10)
            sim = cosine_similarity(a, b)
            assert -1.0 <= sim <= 1.0 + 1e-10


class TestEuclideanDistance:
    def test_same_point_is_zero(self):
        assert euclidean_distance([1, 2], [1, 2]) == pytest.approx(0.0)

    def test_known_distance(self):
        assert euclidean_distance([0, 0], [3, 4]) == pytest.approx(5.0)

    def test_dimension_mismatch_raises(self):
        with pytest.raises(ValueError, match="dimension mismatch"):
            euclidean_distance([1, 2], [1, 2, 3])


class TestAdd:
    def test_basic_addition(self):
        result = add([1, 2, 3], [4, 5, 6])
        np.testing.assert_allclose(result, [5, 7, 9])

    def test_dimension_mismatch_raises(self):
        with pytest.raises(ValueError, match="dimension mismatch"):
            add([1, 2], [1, 2, 3])

    def test_zero_vector_identity(self):
        result = add([1, 2, 3], [0, 0, 0])
        np.testing.assert_allclose(result, [1, 2, 3])


class TestSubtract:
    def test_basic_subtraction(self):
        result = subtract([5, 7, 9], [4, 5, 6])
        np.testing.assert_allclose(result, [1, 2, 3])

    def test_self_subtraction_is_zero(self):
        result = subtract([1, 2, 3], [1, 2, 3])
        np.testing.assert_allclose(result, [0, 0, 0])

    def test_dimension_mismatch_raises(self):
        with pytest.raises(ValueError, match="dimension mismatch"):
            subtract([1, 2], [1, 2, 3])


class TestScale:
    def test_double(self):
        result = scale([1, 2, 3], 2.0)
        np.testing.assert_allclose(result, [2, 4, 6])

    def test_zero_scalar(self):
        result = scale([1, 2, 3], 0.0)
        np.testing.assert_allclose(result, [0, 0, 0])

    def test_negative_scalar(self):
        result = scale([1, 2, 3], -1.0)
        np.testing.assert_allclose(result, [-1, -2, -3])


class TestCentroid:
    def test_basic_centroid(self):
        vectors = [[0, 0], [2, 0], [0, 2], [2, 2]]
        result = centroid(vectors)
        np.testing.assert_allclose(result, [1, 1])

    def test_single_vector(self):
        result = centroid([[3, 4, 5]])
        np.testing.assert_allclose(result, [3, 4, 5])

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty vector array"):
            centroid([])

    def test_inconsistent_dimensions_raises(self):
        with pytest.raises(ValueError, match="inconsistent dimensions"):
            centroid([[1, 2], [1, 2, 3]])


class TestLerp:
    def test_t_zero_returns_a(self):
        result = lerp([0, 0], [10, 10], 0.0)
        np.testing.assert_allclose(result, [0, 0])

    def test_t_one_returns_b(self):
        result = lerp([0, 0], [10, 10], 1.0)
        np.testing.assert_allclose(result, [10, 10])

    def test_t_half_returns_midpoint(self):
        result = lerp([0, 0], [10, 10], 0.5)
        np.testing.assert_allclose(result, [5, 5])

    def test_dimension_mismatch_raises(self):
        with pytest.raises(ValueError, match="dimension mismatch"):
            lerp([1, 2], [1, 2, 3], 0.5)


class TestRandomVector:
    def test_default_dimension(self):
        v = random_vector()
        assert v.shape == (384,)

    def test_custom_dimension(self):
        v = random_vector(dimensions=10)
        assert v.shape == (10,)

    def test_is_unit_vector(self):
        v = random_vector()
        assert magnitude(v) == pytest.approx(1.0, abs=1e-10)

    def test_reproducible_with_rng(self):
        rng1 = np.random.default_rng(42)
        rng2 = np.random.default_rng(42)
        v1 = random_vector(rng=rng1)
        v2 = random_vector(rng=rng2)
        np.testing.assert_allclose(v1, v2)

    def test_different_seeds_give_different_vectors(self):
        v1 = random_vector(rng=np.random.default_rng(1))
        v2 = random_vector(rng=np.random.default_rng(2))
        assert not np.allclose(v1, v2)


class TestPCA:
    def test_basic_dimensionality_reduction(self):
        rng = np.random.default_rng(42)
        # Create 50 vectors with clear 2D structure in 10D space
        vectors = [rng.standard_normal(10) for _ in range(50)]
        projected = pca(vectors, 3)
        assert len(projected) == 50
        assert all(p.shape == (3,) for p in projected)

    def test_empty_input_raises(self):
        with pytest.raises(ValueError, match="empty input"):
            pca([], 2)

    def test_target_dims_too_large_raises(self):
        vectors = [[1, 2, 3], [4, 5, 6]]
        with pytest.raises(ValueError, match="target_dims"):
            pca(vectors, 3)

    def test_preserves_relative_distances(self):
        # Vectors that are similar in high-D should remain similar in low-D
        rng = np.random.default_rng(42)
        base = rng.standard_normal(20)
        v1 = base + rng.standard_normal(20) * 0.1
        v2 = base + rng.standard_normal(20) * 0.1
        v3 = rng.standard_normal(20) * 5  # very different
        vectors = [base, v1, v2, v3]
        projected = pca(vectors, 3)
        # base, v1, v2 should be closer to each other than to v3
        d_base_v1 = np.linalg.norm(projected[0] - projected[1])
        d_base_v3 = np.linalg.norm(projected[0] - projected[3])
        assert d_base_v1 < d_base_v3

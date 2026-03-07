"""
Heady™ Vector Space Operations — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

Vector math primitives for 384-dimensional embedding space.
All operations are pure functions; no external dependencies beyond numpy.
Direct port of src/vector-space-ops.js.
"""

from __future__ import annotations

import math
import numpy as np
from typing import List, Optional, Union

# ─── Constants ────────────────────────────────────────────────────────────────

EMBEDDING_DIM: int = 384

# Type alias for vector inputs
VectorLike = Union[np.ndarray, List[float]]


def _to_array(v: VectorLike) -> np.ndarray:
    """Convert any vector-like input to a float64 numpy array."""
    if isinstance(v, np.ndarray):
        return v.astype(np.float64, copy=False)
    return np.array(v, dtype=np.float64)


# ─── Basic operations ────────────────────────────────────────────────────────


def dot_product(a: VectorLike, b: VectorLike) -> float:
    """
    Dot product of two vectors.

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Scalar dot product.

    Raises:
        ValueError: If vectors have different dimensions.
    """
    a, b = _to_array(a), _to_array(b)
    if a.shape[0] != b.shape[0]:
        raise ValueError(
            f"dot_product: dimension mismatch ({a.shape[0]} vs {b.shape[0]})"
        )
    return float(np.dot(a, b))


def magnitude(v: VectorLike) -> float:
    """
    Euclidean magnitude (L2 norm) of a vector.

    Args:
        v: Input vector.

    Returns:
        Scalar magnitude.
    """
    v = _to_array(v)
    return float(np.linalg.norm(v))


def normalize(v: VectorLike) -> np.ndarray:
    """
    Normalize a vector to unit length.

    Args:
        v: Input vector.

    Returns:
        Unit vector as float64 numpy array. Zero vector returns zero vector.
    """
    v = _to_array(v)
    mag = np.linalg.norm(v)
    if mag == 0:
        return np.zeros_like(v, dtype=np.float64)
    return v / mag


def cosine_similarity(a: VectorLike, b: VectorLike) -> float:
    """
    Cosine similarity between two vectors (range -1 to 1).

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Cosine similarity score.
    """
    a, b = _to_array(a), _to_array(b)
    mag_a = np.linalg.norm(a)
    mag_b = np.linalg.norm(b)
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return float(np.dot(a, b) / (mag_a * mag_b))


def euclidean_distance(a: VectorLike, b: VectorLike) -> float:
    """
    Euclidean distance between two vectors.

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Euclidean distance.

    Raises:
        ValueError: If vectors have different dimensions.
    """
    a, b = _to_array(a), _to_array(b)
    if a.shape[0] != b.shape[0]:
        raise ValueError(
            f"euclidean_distance: dimension mismatch ({a.shape[0]} vs {b.shape[0]})"
        )
    return float(np.linalg.norm(a - b))


def add(a: VectorLike, b: VectorLike) -> np.ndarray:
    """
    Element-wise addition of two vectors.

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Sum vector as float64 numpy array.

    Raises:
        ValueError: If vectors have different dimensions.
    """
    a, b = _to_array(a), _to_array(b)
    if a.shape[0] != b.shape[0]:
        raise ValueError(
            f"add: dimension mismatch ({a.shape[0]} vs {b.shape[0]})"
        )
    return a + b


def subtract(a: VectorLike, b: VectorLike) -> np.ndarray:
    """
    Element-wise subtraction (a - b).

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Difference vector as float64 numpy array.

    Raises:
        ValueError: If vectors have different dimensions.
    """
    a, b = _to_array(a), _to_array(b)
    if a.shape[0] != b.shape[0]:
        raise ValueError(
            f"subtract: dimension mismatch ({a.shape[0]} vs {b.shape[0]})"
        )
    return a - b


def scale(v: VectorLike, scalar: float) -> np.ndarray:
    """
    Scalar multiplication.

    Args:
        v: Input vector.
        scalar: Scaling factor.

    Returns:
        Scaled vector as float64 numpy array.
    """
    return _to_array(v) * scalar


# ─── Higher-order operations ─────────────────────────────────────────────────


def centroid(vectors: List[VectorLike]) -> np.ndarray:
    """
    Centroid (mean vector) of an array of vectors.

    Args:
        vectors: List of vectors.

    Returns:
        Mean vector as float64 numpy array.

    Raises:
        ValueError: If the list is empty or dimensions are inconsistent.
    """
    if not vectors:
        raise ValueError("centroid: empty vector array")
    arrs = [_to_array(v) for v in vectors]
    dim = arrs[0].shape[0]
    for v in arrs:
        if v.shape[0] != dim:
            raise ValueError("centroid: inconsistent dimensions")
    return np.mean(arrs, axis=0).astype(np.float64)


def lerp(a: VectorLike, b: VectorLike, t: float) -> np.ndarray:
    """
    Linear interpolation between two vectors at parameter t in [0, 1].

    Args:
        a: Start vector.
        b: End vector.
        t: Interpolation factor.

    Returns:
        Interpolated vector as float64 numpy array.

    Raises:
        ValueError: If vectors have different dimensions.
    """
    a, b = _to_array(a), _to_array(b)
    if a.shape[0] != b.shape[0]:
        raise ValueError(
            f"lerp: dimension mismatch ({a.shape[0]} vs {b.shape[0]})"
        )
    return a + (b - a) * t


def random_vector(dimensions: int = EMBEDDING_DIM, rng: Optional[np.random.Generator] = None) -> np.ndarray:
    """
    Generate a random unit vector of the given dimensionality.
    Uses Gaussian sampling (Box-Muller equivalent) for uniform distribution on sphere.

    Args:
        dimensions: Number of dimensions (default: 384).
        rng: Optional numpy random generator for reproducibility.

    Returns:
        Unit vector as float64 numpy array.
    """
    if rng is None:
        rng = np.random.default_rng()
    raw = rng.standard_normal(dimensions).astype(np.float64)
    return normalize(raw)


# ─── PCA via power iteration ─────────────────────────────────────────────────


def pca(vectors: List[VectorLike], target_dims: int) -> List[np.ndarray]:
    """
    Basic PCA using power iteration (randomised SVD-lite).
    Projects vectors down to target_dims principal components.

    Args:
        vectors: N x D matrix (list of row vectors).
        target_dims: Desired output dimensions.

    Returns:
        List of projected vectors (N x target_dims).

    Raises:
        ValueError: If input is empty or target_dims >= source dims.
    """
    if not vectors:
        raise ValueError("pca: empty input")
    arrs = [_to_array(v) for v in vectors]
    N = len(arrs)
    D = arrs[0].shape[0]
    if target_dims >= D:
        raise ValueError(
            f"pca: target_dims ({target_dims}) must be < source dims ({D})"
        )

    # 1. Centre the data
    mean = centroid(arrs)
    centred = [v - mean for v in arrs]

    # 2. Extract target_dims principal components via deflation + power iteration
    components = []
    residual = [v.copy() for v in centred]

    for k in range(target_dims):
        # Random initialisation
        pc = random_vector(D)

        # Power iteration (30 iterations)
        for _ in range(30):
            # Compute covariance-vector product: X^T (X pc)
            scores = [float(np.dot(row, pc)) for row in residual]
            next_pc = np.zeros(D, dtype=np.float64)
            for i in range(N):
                next_pc += scores[i] * residual[i]
            pc = normalize(next_pc)

        components.append(pc)

        # Deflate: remove this component from residual
        for i in range(N):
            proj = float(np.dot(residual[i], pc))
            residual[i] = residual[i] - pc * proj

    # 3. Project original (centred) vectors onto components
    projected = []
    for row in centred:
        p = np.array([float(np.dot(row, comp)) for comp in components], dtype=np.float64)
        projected.append(p)

    return projected

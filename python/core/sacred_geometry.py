"""
Heady™ Sacred Geometry SDK — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

Sacred Geometry orchestration patterns with φ-based routing,
golden ratio scaling, and Fibonacci sequencing for multi-agent
coordination and resilience engineering.
"""

from __future__ import annotations

import math
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("heady.sacred_geometry")

# ─── Constants ────────────────────────────────────────────────────────────────

PHI: float = (1 + math.sqrt(5)) / 2  # Golden Ratio ≈ 1.618033988749895
PHI_INVERSE: float = PHI - 1         # 1/φ ≈ 0.618033988749895
PHI_SQUARED: float = PHI * PHI       # φ² ≈ 2.618033988749895

# Pre-computed Fibonacci sequence (first 20)
FIBONACCI: List[int] = [1, 1]
for _i in range(18):
    FIBONACCI.append(FIBONACCI[-1] + FIBONACCI[-2])


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class BackoffResult:
    """Result of a φ-exponential backoff calculation."""
    attempt: int
    delay_ms: float
    total_elapsed_ms: float
    next_delay_ms: float


@dataclass
class NodePlacement:
    """3D coordinate placement for a node in Sacred Geometry space."""
    node_id: str
    x: float
    y: float
    z: float
    layer: int
    angle_rad: float


@dataclass
class CoherenceScore:
    """Coherence score for a set of nodes in geometric space."""
    score: float
    is_coherent: bool
    mean_distance: float
    std_distance: float


# ─── Sacred Geometry Engine ───────────────────────────────────────────────────


class SacredGeometry:
    """
    Sacred Geometry orchestration engine for Heady™ AI Platform.

    Provides φ-based calculations for:
    - Exponential backoff with golden ratio scaling
    - Node placement in 3D Sacred Geometry space
    - Fibonacci-based sequencing
    - Coherence scoring for agent constellations
    """

    # ─── φ-Exponential Backoff ────────────────────────────────────────────────

    @staticmethod
    def phi_backoff(
        attempt: int,
        base_delay_ms: float = 1000.0,
        max_delay_ms: float = 30000.0,
        jitter: bool = True,
        rng: Optional[np.random.Generator] = None,
    ) -> BackoffResult:
        """
        Calculate φ-exponential backoff delay.
        Delay sequence: 1s → 1.6s → 2.6s → 4.2s → 6.9s → 11.1s → 17.9s → 29s

        Args:
            attempt: Current attempt number (0-indexed).
            base_delay_ms: Base delay in milliseconds (default: 1000).
            max_delay_ms: Maximum delay cap (default: 30000).
            jitter: Whether to add random jitter (default: True).
            rng: Optional numpy random generator.

        Returns:
            BackoffResult with delay and elapsed time information.
        """
        if rng is None:
            rng = np.random.default_rng()

        delay = base_delay_ms * (PHI ** attempt)
        delay = min(delay, max_delay_ms)

        if jitter:
            jitter_factor = 0.5 + rng.random() * 0.5  # 50-100% of delay
            delay *= jitter_factor

        # Calculate total elapsed time for all attempts
        total_elapsed = sum(
            min(base_delay_ms * (PHI ** i), max_delay_ms) for i in range(attempt + 1)
        )

        next_delay = min(base_delay_ms * (PHI ** (attempt + 1)), max_delay_ms)

        return BackoffResult(
            attempt=attempt,
            delay_ms=round(delay, 2),
            total_elapsed_ms=round(total_elapsed, 2),
            next_delay_ms=round(next_delay, 2),
        )

    @staticmethod
    def phi_backoff_sequence(
        max_attempts: int = 8,
        base_delay_ms: float = 1000.0,
        max_delay_ms: float = 30000.0,
    ) -> List[float]:
        """
        Generate the full φ-backoff sequence (no jitter).

        Args:
            max_attempts: Number of attempts.
            base_delay_ms: Base delay in milliseconds.
            max_delay_ms: Maximum delay cap.

        Returns:
            List of delay values in milliseconds.
        """
        return [
            round(min(base_delay_ms * (PHI ** i), max_delay_ms), 2)
            for i in range(max_attempts)
        ]

    # ─── Node Placement ──────────────────────────────────────────────────────

    @staticmethod
    def place_nodes_3d(
        node_ids: List[str],
        radius: float = 1.0,
        layers: int = 3,
    ) -> List[NodePlacement]:
        """
        Place nodes in 3D Sacred Geometry space using golden angle distribution.
        Nodes are distributed on concentric spheres using the golden angle
        for uniform coverage.

        Args:
            node_ids: List of node identifiers.
            radius: Base radius of the placement sphere.
            layers: Number of concentric layers.

        Returns:
            List of NodePlacement objects with 3D coordinates.
        """
        golden_angle = 2 * math.pi * PHI_INVERSE  # ≈ 2.399963...
        placements = []
        n = len(node_ids)

        for i, node_id in enumerate(node_ids):
            # Determine layer (distribute nodes across layers)
            layer = i % layers
            layer_radius = radius * (1 + layer * PHI_INVERSE)

            # Golden angle distribution on sphere
            theta = golden_angle * i
            # Distribute along z-axis uniformly
            phi = math.acos(1 - 2 * (i + 0.5) / n) if n > 0 else 0

            x = layer_radius * math.sin(phi) * math.cos(theta)
            y = layer_radius * math.sin(phi) * math.sin(theta)
            z = layer_radius * math.cos(phi)

            placements.append(NodePlacement(
                node_id=node_id,
                x=round(x, 6),
                y=round(y, 6),
                z=round(z, 6),
                layer=layer,
                angle_rad=round(theta % (2 * math.pi), 6),
            ))

        return placements

    # ─── Fibonacci Sequencing ─────────────────────────────────────────────────

    @staticmethod
    def fibonacci(n: int) -> int:
        """
        Get the nth Fibonacci number (1-indexed).

        Args:
            n: Position in sequence (1-indexed).

        Returns:
            The nth Fibonacci number.
        """
        if n <= 0:
            return 0
        if n <= len(FIBONACCI):
            return FIBONACCI[n - 1]
        a, b = FIBONACCI[-2], FIBONACCI[-1]
        for _ in range(n - len(FIBONACCI)):
            a, b = b, a + b
        return b

    @staticmethod
    def fibonacci_sequence(count: int) -> List[int]:
        """
        Generate a Fibonacci sequence of given length.

        Args:
            count: Number of Fibonacci numbers to generate.

        Returns:
            List of Fibonacci numbers.
        """
        if count <= 0:
            return []
        if count <= len(FIBONACCI):
            return FIBONACCI[:count]
        seq = FIBONACCI.copy()
        while len(seq) < count:
            seq.append(seq[-1] + seq[-2])
        return seq

    # ─── Coherence Scoring ────────────────────────────────────────────────────

    @staticmethod
    def coherence_score(
        vectors: List[np.ndarray],
        threshold: float = 0.7,
    ) -> CoherenceScore:
        """
        Calculate coherence score for a set of vectors.
        Measures how geometrically aligned a constellation of nodes is.

        Args:
            vectors: List of vectors to evaluate.
            threshold: Coherence threshold (default: 0.7).

        Returns:
            CoherenceScore with score, flag, mean and std distance.
        """
        if len(vectors) < 2:
            return CoherenceScore(score=1.0, is_coherent=True, mean_distance=0.0, std_distance=0.0)

        from .vector_space_ops import cosine_similarity

        similarities = []
        n = len(vectors)
        for i in range(n):
            for j in range(i + 1, n):
                sim = cosine_similarity(vectors[i], vectors[j])
                similarities.append(sim)

        mean_sim = float(np.mean(similarities))
        std_sim = float(np.std(similarities))

        return CoherenceScore(
            score=round(mean_sim, 6),
            is_coherent=mean_sim >= threshold,
            mean_distance=round(mean_sim, 6),
            std_distance=round(std_sim, 6),
        )

    # ─── φ-Scaling Utilities ──────────────────────────────────────────────────

    @staticmethod
    def phi_scale(value: float, power: int = 1) -> float:
        """
        Scale a value by φ^power.

        Args:
            value: Base value to scale.
            power: Exponent for φ (default: 1).

        Returns:
            Scaled value.
        """
        return value * (PHI ** power)

    @staticmethod
    def golden_partition(total: float) -> Tuple[float, float]:
        """
        Partition a value according to the golden ratio.
        Returns (larger, smaller) where larger/smaller ≈ φ.

        Args:
            total: Value to partition.

        Returns:
            Tuple of (larger, smaller) partition.
        """
        larger = total * PHI_INVERSE
        smaller = total - larger
        return (round(larger, 6), round(smaller, 6))

    @staticmethod
    def is_golden_ratio(a: float, b: float, tolerance: float = 0.01) -> bool:
        """
        Check if two values are in golden ratio.

        Args:
            a: First value (larger).
            b: Second value (smaller).
            tolerance: Acceptable deviation (default: 0.01).

        Returns:
            True if a/b ≈ φ.
        """
        if b == 0:
            return False
        ratio = a / b
        return abs(ratio - PHI) < tolerance

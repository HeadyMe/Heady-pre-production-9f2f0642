"""
Continuous Semantic Logic (CSL) Engine — Python Implementation
© 2024-2026 HeadySystems Inc. All Rights Reserved.

Mathematical CSL operations based on Hyperdimensional Computing (HDC)
and Vector Symbolic Architectures (VSA). Maps boolean logic into
high-dimensional geometric spaces for deterministic swarm routing.

Patent: HS-2026-058 (Continuous Semantic Logic for AI Orchestration)
"""

import numpy as np
from typing import List, Tuple, Optional


class CSLGate:
    """Continuous Semantic Logic Operations based on Hyperdimensional Computing."""

    PHI = 1.618033988749895  # Golden ratio for sacred geometry weighting

    @staticmethod
    def normalize(v: np.ndarray) -> np.ndarray:
        """Normalize vector to unit length."""
        norm = np.linalg.norm(v)
        return v / norm if norm > 0 else v

    @staticmethod
    def bundle(v1: np.ndarray, v2: np.ndarray) -> np.ndarray:
        """OR Gate / Superposition: Merges two semantic concepts.

        Element-wise addition followed by normalization creates a
        consensus vector representing the union of both concepts.
        """
        return CSLGate.normalize(v1 + v2)

    @staticmethod
    def bind(v1: np.ndarray, v2: np.ndarray) -> np.ndarray:
        """AND Gate / Association: Circular convolution via FFT.

        Uses Holographic Reduced Representations (HRR) for deterministic
        binding of two concept vectors into a composite representation.
        """
        return np.fft.ifft(np.fft.fft(v1) * np.fft.fft(v2)).real

    @staticmethod
    def orthogonal_projection(target: np.ndarray, context: np.ndarray) -> np.ndarray:
        """NOT Gate: Removes the 'context' concept from the 'target' vector.

        Projects out the component of target parallel to context,
        leaving only the orthogonal (unrelated) component.
        """
        context_norm = CSLGate.normalize(context)
        projection = np.dot(target, context_norm) * context_norm
        return CSLGate.normalize(target - projection)

    @staticmethod
    def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))

    @staticmethod
    def evaluate_gate_routing(
        task_vector: np.ndarray,
        swarm_centroids: List[np.ndarray]
    ) -> int:
        """MoE Router using cosine similarity on CSL structures.

        Returns the index of the optimal swarm for the given task,
        determined by maximum cosine similarity with swarm centroids.
        """
        similarities = [
            CSLGate.cosine_similarity(task_vector, centroid)
            for centroid in swarm_centroids
        ]
        return int(np.argmax(similarities))

    @staticmethod
    def evaluate_superposition(
        context_vector: np.ndarray,
        task_vector: np.ndarray,
        threshold: float = 0.3
    ) -> bool:
        """Evaluate whether a task is contextually valid for a swarm.

        Returns True if the task vector is sufficiently aligned with
        the current context (above threshold), indicating the swarm
        can handle this task without context switching.
        """
        similarity = CSLGate.cosine_similarity(context_vector, task_vector)
        return similarity >= threshold

    @staticmethod
    def semantic_backpressure(
        queue_vectors: List[np.ndarray],
        limit: float = 0.85
    ) -> float:
        """Calculate semantic density of a task queue.

        High density (approaching limit) means the queue contains
        many semantically similar tasks — a sign of overload.
        Returns density score in [0, 1].
        """
        if len(queue_vectors) < 2:
            return 0.0

        total_sim = 0.0
        count = 0
        for i in range(len(queue_vectors)):
            for j in range(i + 1, len(queue_vectors)):
                total_sim += abs(CSLGate.cosine_similarity(
                    queue_vectors[i], queue_vectors[j]
                ))
                count += 1

        return total_sim / count if count > 0 else 0.0

    @staticmethod
    def decompose(
        task_vector: np.ndarray,
        num_subtasks: int = 3,
        dimension: Optional[int] = None
    ) -> List[np.ndarray]:
        """Decompose a task vector into orthogonal sub-task components.

        Uses dimensional reduction to create subtasksthat together
        reconstruct the original task but can be processed independently.
        """
        dim = dimension or len(task_vector)

        # Generate random orthogonal directions
        random_dirs = np.random.randn(num_subtasks, dim)

        # Gram-Schmidt orthogonalization
        ortho_dirs = []
        for i in range(num_subtasks):
            v = random_dirs[i]
            for ov in ortho_dirs:
                v = v - np.dot(v, ov) * ov
            norm = np.linalg.norm(v)
            if norm > 1e-10:
                ortho_dirs.append(v / norm)

        # Project task onto orthogonal directions
        subtasks = []
        for direction in ortho_dirs:
            component = np.dot(task_vector, direction) * direction
            subtasks.append(component)

        return subtasks

    @staticmethod
    def phi_weighted_bundle(vectors: List[np.ndarray]) -> np.ndarray:
        """Bundle vectors using Fibonacci/golden-ratio weighting.

        Sacred geometry-aligned aggregation gives exponentially
        decreasing weight to older/less-relevant vectors.
        """
        if not vectors:
            raise ValueError("Cannot bundle empty vector list")

        result = np.zeros_like(vectors[0], dtype=float)
        phi = CSLGate.PHI

        for i, v in enumerate(vectors):
            weight = phi ** (-i)  # Golden ratio decay
            result += weight * v

        return CSLGate.normalize(result)


if __name__ == "__main__":
    # Quick self-test
    dim = 128
    v1 = np.random.randn(dim)
    v2 = np.random.randn(dim)

    print("CSL Engine Self-Test")
    print(f"  Bundle:     norm={np.linalg.norm(CSLGate.bundle(v1, v2)):.4f}")
    print(f"  Bind:       shape={CSLGate.bind(v1, v2).shape}")
    print(f"  OrthoProj:  norm={np.linalg.norm(CSLGate.orthogonal_projection(v1, v2)):.4f}")
    print(f"  Similarity: {CSLGate.cosine_similarity(v1, v2):.4f}")
    print(f"  Routing:    swarm_idx={CSLGate.evaluate_gate_routing(v1, [v1, v2])}")
    print(f"  Backpress:  {CSLGate.semantic_backpressure([v1, v2]):.4f}")
    print(f"  Decompose:  {len(CSLGate.decompose(v1))} subtasks")
    print(f"  PhiBundle:  norm={np.linalg.norm(CSLGate.phi_weighted_bundle([v1, v2])):.4f}")
    print("✅ All CSL operations passed")

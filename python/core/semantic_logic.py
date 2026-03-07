"""
Heady™ Continuous Semantic Logic (CSL) — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

BLUEPRINT: Universal Vector Gates v2.0
Replace ALL discrete logic (0/1) with infinite geometric continuity.

THE 3 UNIVERSAL VECTOR GATES:
  1. Resonance Gate  (Semantic AND / IF)  — cosine similarity
  2. Superposition Gate (Semantic OR / MERGE) — vector fusion
  3. Orthogonal Gate (Semantic NOT / REJECT) — vector subtraction

EXTENDED OPERATIONS:
  4. Weighted Superposition — biased fusion with α
  5. Multi-Resonance — score N vectors against a target
  6. Batch Orthogonal — strip multiple reject vectors in one pass
  7. Soft Gate — sigmoid activation (continuous, not boolean)
  8. Ternary Gate — continuous {-1, 0, +1} classification
  9. Risk Gate — trading-specific continuous risk evaluation
  10. Route Gate — multi-candidate routing via ranked resonance

Patent: PPA #52 — Continuous Semantic Logic Gates
Direct port of src/core/semantic-logic.js.
"""

from __future__ import annotations

import math
import numpy as np
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

VectorLike = Union[np.ndarray, List[float]]


# ─── Stats Tracking ──────────────────────────────────────────────────────────


@dataclass
class GateStats:
    """Statistics tracker for CSL gate operations."""
    resonance: int = 0
    superposition: int = 0
    orthogonal: int = 0
    soft_gate: int = 0
    total_calls: int = 0
    avg_resonance_score: float = 0.0
    _resonance_score_sum: float = 0.0


# Module-level stats instance
_gate_stats = GateStats()


# ─── Data classes for results ─────────────────────────────────────────────────


@dataclass
class ResonanceResult:
    """Result of a resonance gate operation."""
    score: float
    open: bool


@dataclass
class MultiResonanceResult:
    """Result of a single candidate in multi-resonance scoring."""
    index: int
    score: float
    open: bool


@dataclass
class TernaryResult:
    """Result of a ternary gate operation."""
    state: int  # -1, 0, or +1
    resonance_activation: float
    repel_activation: float
    raw: float


@dataclass
class RiskResult:
    """Result of a risk gate operation."""
    risk_level: float
    signal: int  # -1, 0, or +1
    proximity: float
    activation: float


@dataclass
class RouteScore:
    """Score for a single routing candidate."""
    id: str
    score: float
    activation: float


@dataclass
class RouteResult:
    """Result of a route gate operation."""
    best: Optional[str]
    scores: List[RouteScore]
    fallback: bool


# ─── HeadySemanticLogic ──────────────────────────────────────────────────────


class HeadySemanticLogic:
    """
    Continuous Semantic Logic (CSL) — Universal Vector Gates.

    All methods are class methods / static methods, matching the JS
    static class pattern. Uses module-level gate stats for tracking.
    """

    # ═══════════════════════════════════════════════════════════════
    # VECTOR MATH PRIMITIVES (shared by all gates)
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _to_array(v: VectorLike) -> np.ndarray:
        """Convert to float32 numpy array (matching JS Float32Array)."""
        if isinstance(v, np.ndarray):
            return v.astype(np.float32, copy=False)
        return np.array(v, dtype=np.float32)

    @staticmethod
    def dot_product(a: VectorLike, b: VectorLike) -> float:
        """Dot product of two vectors."""
        a = HeadySemanticLogic._to_array(a)
        b = HeadySemanticLogic._to_array(b)
        length = min(len(a), len(b))
        return float(np.dot(a[:length], b[:length]))

    @staticmethod
    def norm(v: VectorLike) -> float:
        """Euclidean norm of a vector."""
        v = HeadySemanticLogic._to_array(v)
        return float(np.linalg.norm(v))

    @staticmethod
    def normalize(v: VectorLike) -> np.ndarray:
        """Normalize a vector to unit length."""
        v = HeadySemanticLogic._to_array(v)
        n = float(np.linalg.norm(v))
        if n < 1e-10:
            return v
        return v / n

    @staticmethod
    def cosine_similarity(a: VectorLike, b: VectorLike) -> float:
        """
        Cosine similarity — the foundational metric of CSL.
        All gates reduce to this geometric measure.
        """
        a = HeadySemanticLogic._to_array(a)
        b = HeadySemanticLogic._to_array(b)
        if len(a) == 0 or len(b) == 0:
            return 0.0
        dot = HeadySemanticLogic.dot_product(a, b)
        norm_a = HeadySemanticLogic.norm(a)
        norm_b = HeadySemanticLogic.norm(b)
        return dot / (norm_a * norm_b or 1e-10)

    # ═══════════════════════════════════════════════════════════════
    # GATE 1: RESONANCE (The Semantic IF / AND)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def resonance_gate(
        cls, vec_a: VectorLike, vec_b: VectorLike, threshold: float = 0.95
    ) -> ResonanceResult:
        """
        Measures cosine similarity between two intents.
        R(I, C) = (I · C) / (‖I‖ · ‖C‖)

        Args:
            vec_a: Intent A vector.
            vec_b: Intent B vector.
            threshold: Activation threshold (default: 0.95).

        Returns:
            ResonanceResult with score and open flag.
        """
        score = cls.cosine_similarity(vec_a, vec_b)
        _gate_stats.resonance += 1
        _gate_stats.total_calls += 1
        _gate_stats._resonance_score_sum += score
        _gate_stats.avg_resonance_score = (
            _gate_stats._resonance_score_sum / _gate_stats.resonance
        )
        return ResonanceResult(
            score=round(score, 6),
            open=score >= threshold,
        )

    @classmethod
    def multi_resonance(
        cls,
        target: VectorLike,
        candidates: List[VectorLike],
        threshold: float = 0.95,
    ) -> List[MultiResonanceResult]:
        """
        Multi-Resonance: score N vectors simultaneously against a target.
        Returns sorted array of results for each candidate.

        Args:
            target: The reference vector.
            candidates: List of vectors to score.
            threshold: Activation threshold (default: 0.95).

        Returns:
            Sorted list of MultiResonanceResult (highest score first).
        """
        results = []
        for i, c in enumerate(candidates):
            score = cls.cosine_similarity(target, c)
            _gate_stats.resonance += 1
            _gate_stats.total_calls += 1
            _gate_stats._resonance_score_sum += score
            results.append(MultiResonanceResult(
                index=i,
                score=round(score, 6),
                open=score >= threshold,
            ))
        results.sort(key=lambda r: r.score, reverse=True)
        return results

    # ═══════════════════════════════════════════════════════════════
    # GATE 2: SUPERPOSITION (The Semantic OR / MERGE)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def superposition_gate(cls, vec_a: VectorLike, vec_b: VectorLike) -> np.ndarray:
        """
        Fuses two concepts into a brand-new hybrid intent.
        S(T, A) = normalize(T + A)

        Args:
            vec_a: Concept A vector.
            vec_b: Concept B vector.

        Returns:
            Normalized hybrid vector.
        """
        a = cls._to_array(vec_a)
        b = cls._to_array(vec_b)
        hybrid = a + b
        _gate_stats.superposition += 1
        _gate_stats.total_calls += 1
        return cls.normalize(hybrid)

    @classmethod
    def weighted_superposition(
        cls, vec_a: VectorLike, vec_b: VectorLike, alpha: float = 0.5
    ) -> np.ndarray:
        """
        Weighted Superposition: biased fusion with factor α.
        S(A, B, α) = normalize(α·A + (1-α)·B)

        Args:
            vec_a: Concept A vector.
            vec_b: Concept B vector.
            alpha: Weight for vec_a (0.0 - 1.0, default: 0.5).

        Returns:
            Normalized weighted hybrid vector.
        """
        a = cls._to_array(vec_a)
        b = cls._to_array(vec_b)
        beta = 1.0 - alpha
        hybrid = alpha * a + beta * b
        _gate_stats.superposition += 1
        _gate_stats.total_calls += 1
        return cls.normalize(hybrid)

    @classmethod
    def consensus_superposition(cls, vectors: List[VectorLike]) -> np.ndarray:
        """
        N-way Superposition: fuse an array of vectors into a single consensus.
        S(V₁, V₂, ... Vₙ) = normalize(Σ Vᵢ)

        Args:
            vectors: List of vectors to fuse.

        Returns:
            Normalized consensus vector.
        """
        if not vectors:
            return np.array([], dtype=np.float32)
        arrs = [cls._to_array(v) for v in vectors]
        fused = np.zeros_like(arrs[0], dtype=np.float32)
        for v in arrs:
            fused += v
        _gate_stats.superposition += 1
        _gate_stats.total_calls += 1
        return cls.normalize(fused)

    # ═══════════════════════════════════════════════════════════════
    # GATE 3: ORTHOGONAL (The Semantic NOT / REJECT)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def orthogonal_gate(cls, target_vec: VectorLike, reject_vec: VectorLike) -> np.ndarray:
        """
        Strips the influence of reject_vec from target_vec.
        O(T, L) = T - ((T·L)/(L·L)) · L

        Args:
            target_vec: The base intent vector.
            reject_vec: The intent to strip out.

        Returns:
            Purified orthogonal vector (normalized).
        """
        t = cls._to_array(target_vec)
        r = cls._to_array(reject_vec)
        dot_tr = cls.dot_product(t, r)
        dot_rr = cls.dot_product(r, r)
        projection_factor = dot_tr / (dot_rr or 1e-10)
        orthogonal = t - projection_factor * r
        _gate_stats.orthogonal += 1
        _gate_stats.total_calls += 1
        return cls.normalize(orthogonal)

    @classmethod
    def batch_orthogonal(
        cls, target_vec: VectorLike, reject_vecs: List[VectorLike]
    ) -> np.ndarray:
        """
        Batch Orthogonal: strip multiple reject vectors in one pass.
        Iteratively projects out each rejection vector.

        Args:
            target_vec: The base intent vector.
            reject_vecs: List of intents to strip.

        Returns:
            Purified vector with all rejections removed (normalized).
        """
        current = cls._to_array(target_vec).copy()
        for reject in reject_vecs:
            r = cls._to_array(reject)
            dot_tr = cls.dot_product(current, r)
            dot_rr = cls.dot_product(r, r)
            factor = dot_tr / (dot_rr or 1e-10)
            current = current - factor * r
        _gate_stats.orthogonal += 1
        _gate_stats.total_calls += 1
        return cls.normalize(current)

    # ═══════════════════════════════════════════════════════════════
    # SOFT GATE — Continuous sigmoid activation
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def soft_gate(
        cls, score: float, threshold: float = 0.5, steepness: float = 20.0
    ) -> float:
        """
        Soft Gate: returns a continuous activation value [0, 1]
        instead of a hard boolean. Uses sigmoid around the threshold.

        σ(x) = 1 / (1 + e^(-k(x - threshold)))

        Args:
            score: The raw cosine similarity score.
            threshold: Center of the sigmoid (default: 0.5).
            steepness: How sharp the transition is (default: 20).

        Returns:
            Continuous activation between 0 and 1.
        """
        _gate_stats.soft_gate += 1
        _gate_stats.total_calls += 1
        exponent = -steepness * (score - threshold)
        # Clamp to prevent overflow
        exponent = max(-500.0, min(500.0, exponent))
        return 1.0 / (1.0 + math.exp(exponent))

    # ═══════════════════════════════════════════════════════════════
    # GATE 5: TERNARY (Continuous {-1, 0, +1} Classification)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def ternary_gate(
        cls,
        score: float,
        resonance_threshold: float = 0.72,
        repel_threshold: float = 0.35,
        steepness: float = 15.0,
    ) -> TernaryResult:
        """
        Ternary Gate: maps a continuous confidence score to {-1, 0, +1}
        using dual sigmoid boundaries instead of hard thresholds.

        Returns the discrete state PLUS the continuous activation values
        so downstream systems preserve the geometric magnitude.

        Args:
            score: Raw confidence/similarity (0.0 - 1.0).
            resonance_threshold: Center for +1 sigmoid (default: 0.72).
            repel_threshold: Center for -1 sigmoid (default: 0.35).
            steepness: Sigmoid steepness (default: 15).

        Returns:
            TernaryResult with state, activations, and raw score.
        """
        resonance_activation = cls.soft_gate(score, resonance_threshold, steepness)
        repel_activation = 1.0 - cls.soft_gate(score, repel_threshold, steepness)

        if resonance_activation >= 0.5:
            state = 1   # Core Resonance
        elif repel_activation >= 0.5:
            state = -1  # Repel
        else:
            state = 0   # Ephemeral / Epistemic Hold

        _gate_stats.total_calls += 1
        return TernaryResult(
            state=state,
            resonance_activation=round(resonance_activation, 6),
            repel_activation=round(repel_activation, 6),
            raw=score,
        )

    # ═══════════════════════════════════════════════════════════════
    # GATE 6: RISK (Trading-Specific Continuous Risk Evaluation)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def risk_gate(
        cls,
        current: float,
        limit: float,
        sensitivity: float = 0.8,
        steepness: float = 12.0,
    ) -> RiskResult:
        """
        Risk Gate: evaluates trading risk as a continuous activation.
        Maps proximity-to-limit ratios through sigmoid to produce
        smooth risk curves instead of hard cutoffs.

        Args:
            current: Current value (equity, P&L, etc.).
            limit: The hard limit/threshold.
            sensitivity: How early the alarm activates (default: 0.8 = at 80%).
            steepness: Sigmoid steepness (default: 12).

        Returns:
            RiskResult with risk level, signal, proximity, and activation.
        """
        proximity = abs(current) / (abs(limit) or 1e-10)
        activation = cls.soft_gate(proximity, sensitivity, steepness)

        # Map to ternary: high activation = danger
        ternary = cls.ternary_gate(1.0 - activation, 0.5, 0.2, steepness)

        _gate_stats.total_calls += 1
        return RiskResult(
            risk_level=round(activation, 6),
            signal=ternary.state,
            proximity=round(proximity, 6),
            activation=round(activation, 6),
        )

    # ═══════════════════════════════════════════════════════════════
    # GATE 7: ROUTE (Multi-Candidate Routing via Ranked Resonance)
    # ═══════════════════════════════════════════════════════════════

    @classmethod
    def route_gate(
        cls,
        intent: VectorLike,
        candidates: List[Dict[str, Any]],
        threshold: float = 0.3,
    ) -> RouteResult:
        """
        Route Gate: selects the best candidate from a set using
        multi-resonance scoring with soft gate activation.
        Used for model selection, service routing, bee dispatch.

        Args:
            intent: The intent/query vector.
            candidates: List of dicts with 'id' and 'vector' keys.
            threshold: Minimum activation to be considered (default: 0.3).

        Returns:
            RouteResult with best candidate, scores, and fallback flag.
        """
        scores = []
        for c in candidates:
            score = cls.cosine_similarity(intent, c["vector"])
            activation = cls.soft_gate(score, threshold, 10)
            scores.append(RouteScore(
                id=c["id"],
                score=round(score, 6),
                activation=round(activation, 6),
            ))
        scores.sort(key=lambda s: s.score, reverse=True)

        viable = [s for s in scores if s.activation >= 0.5]
        _gate_stats.total_calls += 1

        return RouteResult(
            best=viable[0].id if viable else None,
            scores=scores,
            fallback=len(viable) == 0,
        )

    # ═══════════════════════════════════════════════════════════════
    # STATUS & DIAGNOSTICS
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        """
        Get gate operation statistics.

        Returns:
            Dict with gate call counts and average resonance score.
        """
        return {
            "resonance": _gate_stats.resonance,
            "superposition": _gate_stats.superposition,
            "orthogonal": _gate_stats.orthogonal,
            "soft_gate": _gate_stats.soft_gate,
            "total_calls": _gate_stats.total_calls,
            "avg_resonance_score": (
                round(_gate_stats._resonance_score_sum / _gate_stats.resonance, 4)
                if _gate_stats.resonance > 0
                else 0
            ),
        }

    @staticmethod
    def reset_stats() -> None:
        """Reset all gate statistics to zero."""
        global _gate_stats
        _gate_stats = GateStats()


# Convenience alias
CSL = HeadySemanticLogic

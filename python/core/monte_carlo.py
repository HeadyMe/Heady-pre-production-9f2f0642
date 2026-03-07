"""
Heady™ Monte Carlo Simulation Engine — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

Monte Carlo Simulation Engine for operational readiness and risk assessment.
Uses Mulberry32 seeded PRNG for reproducible simulations.
Direct port of src/monte-carlo.js.
"""

from __future__ import annotations

import math
import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("heady.monte_carlo")


# ─── Mulberry32 PRNG ─────────────────────────────────────────────────────────


def mulberry32(seed: int) -> Callable[[], float]:
    """
    Create a seeded Mulberry32 PRNG.

    Args:
        seed: 32-bit unsigned integer seed.

    Returns:
        A callable that returns floats in [0, 1) on each call.
    """
    state = [seed & 0xFFFFFFFF]

    def _next() -> float:
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        z = state[0]
        z = _imul(z ^ (z >> 15), z | 1) & 0xFFFFFFFF
        z = (z ^ (z + (_imul(z ^ (z >> 7), z | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((z ^ (z >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return _next


def _imul(a: int, b: int) -> int:
    """Emulate JavaScript Math.imul (32-bit integer multiplication)."""
    a, b = a & 0xFFFFFFFF, b & 0xFFFFFFFF
    result = (a * b) & 0xFFFFFFFF
    if result >= 0x80000000:
        result -= 0x100000000
    return result & 0xFFFFFFFF


# ─── Risk grades ──────────────────────────────────────────────────────────────


class RiskGrade(str, Enum):
    """Risk grade classification levels."""
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED = "RED"


RISK_GRADE = RiskGrade


def score_to_grade(score: float) -> RiskGrade:
    """
    Convert a numeric score (0-100) to a risk grade.

    Args:
        score: Numeric score between 0 and 100.

    Returns:
        Corresponding RiskGrade.
    """
    if score >= 80:
        return RiskGrade.GREEN
    if score >= 60:
        return RiskGrade.YELLOW
    if score >= 40:
        return RiskGrade.ORANGE
    return RiskGrade.RED


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class RiskFactor:
    """A single risk factor for Monte Carlo simulation."""
    name: str
    probability: float = 0.1
    impact: float = 0.5
    mitigation: Optional[str] = None


@dataclass
class ReadinessSignals:
    """Operational signals for quick readiness assessment."""
    error_rate: float = 0.0
    last_deploy_success: bool = True
    cpu_pressure: float = 0.0
    memory_pressure: float = 0.0
    service_health_ratio: float = 1.0
    open_incidents: int = 0


@dataclass
class ReadinessResult:
    """Result of a quick readiness assessment."""
    score: int
    grade: RiskGrade
    breakdown: Dict[str, float]


@dataclass
class SimulationOutcomes:
    """Outcome counts from a full Monte Carlo cycle."""
    success: int
    partial: int
    failure: int


@dataclass
class ConfidenceBounds:
    """95% Wilson confidence interval bounds."""
    lower: float
    upper: float


@dataclass
class SimulationResult:
    """Full result of a Monte Carlo simulation cycle."""
    scenario: str
    iterations: int
    confidence: int
    failure_rate: float
    risk_grade: RiskGrade
    top_mitigations: List[str]
    outcomes: SimulationOutcomes
    confidence_bounds: ConfidenceBounds
    seed: int


@dataclass
class HistoryEntry:
    """A single simulation history entry."""
    scenario: str
    result: SimulationResult
    run_at: float


# ─── MonteCarloEngine ─────────────────────────────────────────────────────────


class MonteCarloEngine:
    """
    Monte Carlo Simulation Engine for operational readiness and risk assessment.

    Attributes:
        default_seed: Default PRNG seed for reproducible simulations.
    """

    def __init__(self, default_seed: int = 42):
        """
        Initialize the Monte Carlo engine.

        Args:
            default_seed: Default PRNG seed (default: 42).
        """
        self.default_seed = default_seed
        self._history: List[HistoryEntry] = []
        logger.info("MonteCarloEngine initialised")

    # ─── Quick readiness ──────────────────────────────────────────────────────

    def quick_readiness(self, signals: Optional[ReadinessSignals] = None) -> ReadinessResult:
        """
        Fast readiness score from operational signals.

        Args:
            signals: Operational signals. Uses defaults if None.

        Returns:
            ReadinessResult with score, grade, and breakdown.
        """
        if signals is None:
            signals = ReadinessSignals()

        # Score components (each 0-100, weighted)
        error_score = max(0.0, 100.0 - signals.error_rate * 200.0)
        deploy_score = 100.0 if signals.last_deploy_success else 30.0
        cpu_score = max(0.0, 100.0 - signals.cpu_pressure * 100.0)
        mem_score = max(0.0, 100.0 - signals.memory_pressure * 100.0)
        health_score = signals.service_health_ratio * 100.0
        incident_score = max(0.0, 100.0 - signals.open_incidents * 15.0)

        score = round(
            error_score * 0.25
            + deploy_score * 0.20
            + cpu_score * 0.15
            + mem_score * 0.15
            + health_score * 0.20
            + incident_score * 0.05
        )

        grade = score_to_grade(score)
        logger.debug("MonteCarloEngine: quickReadiness score=%d grade=%s", score, grade.value)

        return ReadinessResult(
            score=score,
            grade=grade,
            breakdown={
                "error_score": error_score,
                "deploy_score": deploy_score,
                "cpu_score": cpu_score,
                "mem_score": mem_score,
                "health_score": health_score,
                "incident_score": incident_score,
            },
        )

    # ─── Full simulation ──────────────────────────────────────────────────────

    def run_full_cycle(
        self,
        name: str = "unnamed",
        seed: Optional[int] = None,
        risk_factors: Optional[List[RiskFactor]] = None,
        iterations: int = 10000,
    ) -> SimulationResult:
        """
        Run a full Monte Carlo simulation cycle.

        Args:
            name: Scenario name.
            seed: PRNG seed (defaults to current time).
            risk_factors: List of RiskFactor objects.
            iterations: Number of simulation iterations (default: 10000).

        Returns:
            SimulationResult with confidence, failure rate, outcomes, etc.
        """
        if seed is None:
            seed = int(time.time() * 1000) & 0xFFFFFFFF
        if risk_factors is None:
            risk_factors = []

        rand = mulberry32(seed)

        success_count = 0
        partial_count = 0
        failure_count = 0
        mitigation_hits: Dict[str, int] = {}

        for _ in range(iterations):
            total_impact = 0.0

            for factor in risk_factors:
                roll = rand()
                if roll < factor.probability:
                    # Mitigation reduces impact by 50% when applied
                    effective_impact = factor.impact * 0.5 if factor.mitigation else factor.impact
                    total_impact += effective_impact
                    if factor.mitigation:
                        mitigation_hits[factor.mitigation] = mitigation_hits.get(factor.mitigation, 0) + 1

            if total_impact < 0.3:
                success_count += 1
            elif total_impact < 0.7:
                partial_count += 1
            else:
                failure_count += 1

        failure_rate = failure_count / iterations
        success_rate = success_count / iterations

        # 95% Wilson confidence interval for failure rate
        z = 1.96
        n = iterations
        p = failure_rate
        denominator = 1 + (z * z) / n
        centre = (p + (z * z) / (2 * n)) / denominator
        margin = (z * math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator
        confidence_bounds = ConfidenceBounds(
            lower=max(0.0, centre - margin),
            upper=min(1.0, centre + margin),
        )

        # Confidence: 1 - failureRate, scaled
        confidence = round(success_rate * 100)
        risk_grade = score_to_grade(confidence)

        # Top mitigations by hit frequency
        sorted_mitigations = sorted(mitigation_hits.items(), key=lambda x: x[1], reverse=True)
        top_mitigations = [m for m, _ in sorted_mitigations[:5]]

        result = SimulationResult(
            scenario=name,
            iterations=iterations,
            confidence=confidence,
            failure_rate=round(failure_rate * 10000) / 10000,
            risk_grade=risk_grade,
            top_mitigations=top_mitigations,
            outcomes=SimulationOutcomes(
                success=success_count,
                partial=partial_count,
                failure=failure_count,
            ),
            confidence_bounds=confidence_bounds,
            seed=seed,
        )

        self._history.append(HistoryEntry(
            scenario=name,
            result=result,
            run_at=time.time(),
        ))

        logger.info("MonteCarloEngine: full cycle complete scenario=%s confidence=%d grade=%s",
                     name, confidence, risk_grade.value)
        return result

    # ─── History & status ─────────────────────────────────────────────────────

    def get_history(self, limit: int = 20) -> List[HistoryEntry]:
        """
        Return recent simulation history.

        Args:
            limit: Maximum entries to return (default: 20).

        Returns:
            List of HistoryEntry objects.
        """
        return self._history[-limit:]

    def status(self) -> Dict[str, Any]:
        """
        Engine status summary.

        Returns:
            Dict with total_runs and last_run timestamp.
        """
        last = self._history[-1] if self._history else None
        return {
            "total_runs": len(self._history),
            "last_run": last.run_at if last else None,
        }

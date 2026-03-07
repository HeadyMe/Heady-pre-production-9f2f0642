"""
Tests for Heady™ Monte Carlo Simulation Engine.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import pytest

from core.monte_carlo import (
    MonteCarloEngine,
    mulberry32,
    RiskGrade,
    RiskFactor,
    ReadinessSignals,
    ReadinessResult,
    SimulationResult,
    score_to_grade,
)


class TestMulberry32:
    def test_returns_callable(self):
        rand = mulberry32(42)
        assert callable(rand)

    def test_returns_float_in_range(self):
        rand = mulberry32(42)
        for _ in range(1000):
            val = rand()
            assert 0.0 <= val < 1.0

    def test_reproducible_with_same_seed(self):
        rand1 = mulberry32(42)
        rand2 = mulberry32(42)
        for _ in range(100):
            assert rand1() == rand2()

    def test_different_seeds_differ(self):
        rand1 = mulberry32(42)
        rand2 = mulberry32(99)
        # At least some values should differ
        vals1 = [rand1() for _ in range(10)]
        vals2 = [rand2() for _ in range(10)]
        assert vals1 != vals2

    def test_uniform_distribution(self):
        """Values should be approximately uniformly distributed."""
        rand = mulberry32(42)
        vals = [rand() for _ in range(10000)]
        mean = sum(vals) / len(vals)
        assert abs(mean - 0.5) < 0.05  # Should be close to 0.5


class TestRiskGrade:
    def test_grade_enum_values(self):
        assert RiskGrade.GREEN == "GREEN"
        assert RiskGrade.YELLOW == "YELLOW"
        assert RiskGrade.ORANGE == "ORANGE"
        assert RiskGrade.RED == "RED"


class TestScoreToGrade:
    def test_green(self):
        assert score_to_grade(100) == RiskGrade.GREEN
        assert score_to_grade(80) == RiskGrade.GREEN

    def test_yellow(self):
        assert score_to_grade(79) == RiskGrade.YELLOW
        assert score_to_grade(60) == RiskGrade.YELLOW

    def test_orange(self):
        assert score_to_grade(59) == RiskGrade.ORANGE
        assert score_to_grade(40) == RiskGrade.ORANGE

    def test_red(self):
        assert score_to_grade(39) == RiskGrade.RED
        assert score_to_grade(0) == RiskGrade.RED


class TestMonteCarloEngineInit:
    def test_default_seed(self):
        engine = MonteCarloEngine()
        assert engine.default_seed == 42

    def test_custom_seed(self):
        engine = MonteCarloEngine(default_seed=123)
        assert engine.default_seed == 123

    def test_empty_history(self):
        engine = MonteCarloEngine()
        assert engine.get_history() == []


class TestQuickReadiness:
    def test_perfect_signals(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals())
        assert result.score == 100
        assert result.grade == RiskGrade.GREEN

    def test_high_error_rate(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(error_rate=0.5))
        assert result.score < 100
        assert result.breakdown["error_score"] == 0.0

    def test_failed_deploy(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(last_deploy_success=False))
        assert result.breakdown["deploy_score"] == 30.0

    def test_high_cpu_pressure(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(cpu_pressure=0.9))
        assert result.breakdown["cpu_score"] == pytest.approx(10.0)

    def test_zero_service_health(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(service_health_ratio=0.0))
        assert result.breakdown["health_score"] == 0.0

    def test_multiple_incidents(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(open_incidents=5))
        assert result.breakdown["incident_score"] == 25.0

    def test_all_bad_signals(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness(ReadinessSignals(
            error_rate=1.0,
            last_deploy_success=False,
            cpu_pressure=1.0,
            memory_pressure=1.0,
            service_health_ratio=0.0,
            open_incidents=10,
        ))
        assert result.grade == RiskGrade.RED

    def test_default_signals(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness()
        assert result.score == 100
        assert result.grade == RiskGrade.GREEN

    def test_returns_readiness_result(self):
        engine = MonteCarloEngine()
        result = engine.quick_readiness()
        assert isinstance(result, ReadinessResult)
        assert "error_score" in result.breakdown


class TestRunFullCycle:
    def test_basic_run(self):
        engine = MonteCarloEngine()
        result = engine.run_full_cycle(name="test", seed=42)
        assert isinstance(result, SimulationResult)
        assert result.scenario == "test"
        assert result.iterations == 10000
        assert result.seed == 42

    def test_reproducible_with_seed(self):
        engine1 = MonteCarloEngine()
        engine2 = MonteCarloEngine()
        r1 = engine1.run_full_cycle(name="test", seed=42)
        r2 = engine2.run_full_cycle(name="test", seed=42)
        assert r1.confidence == r2.confidence
        assert r1.failure_rate == r2.failure_rate

    def test_with_risk_factors(self):
        engine = MonteCarloEngine()
        factors = [
            RiskFactor(name="network", probability=0.3, impact=0.4),
            RiskFactor(name="disk", probability=0.2, impact=0.5, mitigation="RAID"),
        ]
        result = engine.run_full_cycle(name="risky", seed=42, risk_factors=factors)
        assert 0 <= result.confidence <= 100
        assert 0.0 <= result.failure_rate <= 1.0
        assert result.outcomes.success + result.outcomes.partial + result.outcomes.failure == 10000

    def test_mitigation_reduces_failure(self):
        engine = MonteCarloEngine()
        factors_no_mitigation = [
            RiskFactor(name="network", probability=0.5, impact=0.8),
        ]
        factors_with_mitigation = [
            RiskFactor(name="network", probability=0.5, impact=0.8, mitigation="failover"),
        ]
        r_no = engine.run_full_cycle(name="no_mit", seed=42, risk_factors=factors_no_mitigation)
        r_yes = engine.run_full_cycle(name="yes_mit", seed=42, risk_factors=factors_with_mitigation)
        assert r_yes.failure_rate <= r_no.failure_rate

    def test_top_mitigations_populated(self):
        engine = MonteCarloEngine()
        factors = [
            RiskFactor(name="a", probability=0.5, impact=0.5, mitigation="backup"),
            RiskFactor(name="b", probability=0.5, impact=0.5, mitigation="failover"),
        ]
        result = engine.run_full_cycle(name="test", seed=42, risk_factors=factors)
        assert len(result.top_mitigations) <= 5
        assert all(isinstance(m, str) for m in result.top_mitigations)

    def test_confidence_bounds(self):
        engine = MonteCarloEngine()
        result = engine.run_full_cycle(name="test", seed=42)
        assert 0.0 <= result.confidence_bounds.lower <= result.confidence_bounds.upper <= 1.0

    def test_no_risk_factors_all_success(self):
        engine = MonteCarloEngine()
        result = engine.run_full_cycle(name="safe", seed=42, risk_factors=[])
        assert result.confidence == 100
        assert result.failure_rate == 0.0
        assert result.outcomes.success == 10000

    def test_custom_iterations(self):
        engine = MonteCarloEngine()
        result = engine.run_full_cycle(name="small", seed=42, iterations=100)
        assert result.iterations == 100
        assert result.outcomes.success + result.outcomes.partial + result.outcomes.failure == 100


class TestHistory:
    def test_history_populated_after_run(self):
        engine = MonteCarloEngine()
        engine.run_full_cycle(name="test1", seed=42)
        engine.run_full_cycle(name="test2", seed=43)
        history = engine.get_history()
        assert len(history) == 2
        assert history[0].scenario == "test1"
        assert history[1].scenario == "test2"

    def test_history_limit(self):
        engine = MonteCarloEngine()
        for i in range(30):
            engine.run_full_cycle(name=f"test{i}", seed=i, iterations=100)
        history = engine.get_history(limit=5)
        assert len(history) == 5

    def test_status(self):
        engine = MonteCarloEngine()
        status = engine.status()
        assert status["total_runs"] == 0
        assert status["last_run"] is None

        engine.run_full_cycle(name="test", seed=42, iterations=100)
        status = engine.status()
        assert status["total_runs"] == 1
        assert status["last_run"] is not None

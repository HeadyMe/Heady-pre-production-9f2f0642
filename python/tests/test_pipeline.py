"""
Tests for Heady™ HCFullPipeline.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import pytest

from core.pipeline import (
    HCFullPipeline,
    PipelineStage,
    PipelineStatus,
    PipelineRun,
    StageResult,
    STAGE_ORDER,
)
from core.monte_carlo import MonteCarloEngine, RiskFactor


class TestPipelineStage:
    def test_all_12_stages_exist(self):
        assert len(PipelineStage) == 12

    def test_stage_names(self):
        expected = [
            "INTAKE", "TRIAGE", "PLAN", "MONTE_CARLO", "ARENA", "JUDGE",
            "APPROVE", "EXECUTE", "VERIFY", "RECEIPT", "ARCHIVE", "COMPLETE",
        ]
        for name in expected:
            assert hasattr(PipelineStage, name)

    def test_stage_order(self):
        assert len(STAGE_ORDER) == 12
        assert STAGE_ORDER[0] == PipelineStage.INTAKE
        assert STAGE_ORDER[-1] == PipelineStage.COMPLETE


class TestPipelineStatus:
    def test_status_values(self):
        assert PipelineStatus.PENDING == "PENDING"
        assert PipelineStatus.RUNNING == "RUNNING"
        assert PipelineStatus.COMPLETED == "COMPLETED"
        assert PipelineStatus.FAILED == "FAILED"


class TestHCFullPipelineInit:
    def test_default_init(self):
        pipeline = HCFullPipeline()
        assert pipeline._auto_approve is False

    def test_auto_approve(self):
        pipeline = HCFullPipeline(auto_approve=True)
        assert pipeline._auto_approve is True

    def test_custom_mc_engine(self):
        mc = MonteCarloEngine(default_seed=99)
        pipeline = HCFullPipeline(monte_carlo_engine=mc)
        assert pipeline._mc_engine.default_seed == 99


class TestPipelineRun:
    def test_basic_run_completes(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        assert isinstance(run, PipelineRun)
        assert run.status == PipelineStatus.COMPLETED
        assert len(run.stage_results) == 12

    def test_all_stages_complete(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        completed_stages = [r.stage for r in run.stage_results]
        for stage in STAGE_ORDER:
            assert stage in completed_stages

    def test_stage_results_have_timing(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        for result in run.stage_results:
            assert isinstance(result, StageResult)
            assert result.started_at > 0
            assert result.completed_at >= result.started_at
            assert result.duration_ms >= 0

    def test_run_id_generated(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        assert run.run_id is not None
        assert len(run.run_id) == 8

    def test_context_passed_through(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run(context={"task_type": "deployment", "priority": "high"})
        assert run.context.get("task_type") == "deployment"
        assert run.context.get("triage_priority") == "high"

    def test_monte_carlo_stage_runs(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run(context={"mc_iterations": 100})
        mc_result = next(r for r in run.stage_results if r.stage == PipelineStage.MONTE_CARLO)
        assert mc_result.status == "completed"
        assert "mc_confidence" in mc_result.data

    def test_with_risk_factors(self):
        pipeline = HCFullPipeline(auto_approve=True)
        context = {
            "risk_factors": [
                {"name": "network", "probability": 0.2, "impact": 0.3},
                {"name": "disk", "probability": 0.1, "impact": 0.5, "mitigation": "RAID"},
            ],
            "mc_iterations": 500,
        }
        run = pipeline.run(context=context)
        assert run.status == PipelineStatus.COMPLETED
        assert "mc_confidence" in run.context

    def test_timestamps(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        assert run.started_at > 0
        assert run.completed_at >= run.started_at


class TestPipelineApproval:
    def test_auto_approve_true(self):
        pipeline = HCFullPipeline(auto_approve=True)
        run = pipeline.run()
        assert run.context.get("approved") is True
        assert run.context.get("executed") is True

    def test_auto_approve_false_judge_approved(self):
        pipeline = HCFullPipeline(auto_approve=False)
        # No risk factors = high confidence = judge approves
        run = pipeline.run()
        assert run.context.get("judge_approved") is True
        assert run.context.get("approved") is True


class TestCustomHandlers:
    def test_register_custom_handler(self):
        pipeline = HCFullPipeline(auto_approve=True)

        custom_data = {"custom_key": "custom_value"}

        def custom_intake(context):
            return custom_data

        pipeline.register_handler(PipelineStage.INTAKE, custom_intake)
        run = pipeline.run()
        assert run.context.get("custom_key") == "custom_value"

    def test_custom_handler_error_fails_pipeline(self):
        pipeline = HCFullPipeline(auto_approve=True)

        def failing_handler(context):
            raise RuntimeError("Custom handler error")

        pipeline.register_handler(PipelineStage.TRIAGE, failing_handler)
        run = pipeline.run()
        assert run.status == PipelineStatus.FAILED
        assert "TRIAGE" in run.error


class TestPipelineHistory:
    def test_history_tracked(self):
        pipeline = HCFullPipeline(auto_approve=True)
        pipeline.run()
        pipeline.run()
        history = pipeline.get_history()
        assert len(history) == 2

    def test_history_limit(self):
        pipeline = HCFullPipeline(auto_approve=True)
        for _ in range(5):
            pipeline.run()
        history = pipeline.get_history(limit=3)
        assert len(history) == 3

    def test_current_run(self):
        pipeline = HCFullPipeline(auto_approve=True)
        pipeline.run()
        assert pipeline.current_run is not None
        assert pipeline.current_run.status == PipelineStatus.COMPLETED


class TestConfigSummary:
    def test_config_summary(self):
        pipeline = HCFullPipeline(auto_approve=True)
        config = pipeline.get_config_summary()
        assert config["stage_count"] == 12
        assert config["auto_approve"] is True
        assert len(config["stages"]) == 12

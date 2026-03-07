"""
Heady™ HCFullPipeline — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

12-stage pipeline implementation for the Heady AI Platform.
Stages: INTAKE → TRIAGE → PLAN → MONTE_CARLO → ARENA → JUDGE →
        APPROVE → EXECUTE → VERIFY → RECEIPT → ARCHIVE → COMPLETE

Mirrors the Node.js HCFullPipeline with Python-native execution.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from .monte_carlo import MonteCarloEngine, RiskFactor

logger = logging.getLogger("heady.pipeline")


# ─── Pipeline Stages ─────────────────────────────────────────────────────────


class PipelineStage(str, Enum):
    """The 12 stages of the HCFullPipeline."""
    INTAKE = "INTAKE"
    TRIAGE = "TRIAGE"
    PLAN = "PLAN"
    MONTE_CARLO = "MONTE_CARLO"
    ARENA = "ARENA"
    JUDGE = "JUDGE"
    APPROVE = "APPROVE"
    EXECUTE = "EXECUTE"
    VERIFY = "VERIFY"
    RECEIPT = "RECEIPT"
    ARCHIVE = "ARCHIVE"
    COMPLETE = "COMPLETE"


class PipelineStatus(str, Enum):
    """Pipeline run status."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABORTED = "ABORTED"


# ─── Stage Definitions ───────────────────────────────────────────────────────

STAGE_ORDER: List[PipelineStage] = [
    PipelineStage.INTAKE,
    PipelineStage.TRIAGE,
    PipelineStage.PLAN,
    PipelineStage.MONTE_CARLO,
    PipelineStage.ARENA,
    PipelineStage.JUDGE,
    PipelineStage.APPROVE,
    PipelineStage.EXECUTE,
    PipelineStage.VERIFY,
    PipelineStage.RECEIPT,
    PipelineStage.ARCHIVE,
    PipelineStage.COMPLETE,
]


# ─── Data classes ─────────────────────────────────────────────────────────────


@dataclass
class StageResult:
    """Result of a single pipeline stage execution."""
    stage: PipelineStage
    status: str
    started_at: float
    completed_at: float
    duration_ms: float
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class PipelineRun:
    """Complete pipeline run record."""
    run_id: str
    status: PipelineStatus
    started_at: float
    completed_at: Optional[float] = None
    current_stage: Optional[PipelineStage] = None
    stage_results: List[StageResult] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


# ─── Stage Handlers ───────────────────────────────────────────────────────────

StageHandler = Callable[[Dict[str, Any]], Dict[str, Any]]


# ─── HCFullPipeline ──────────────────────────────────────────────────────────


class HCFullPipeline:
    """
    The Heady 12-stage pipeline orchestrator.

    Provides a structured execution framework where each stage can be
    customized with handlers. Includes built-in Monte Carlo risk assessment
    at the MONTE_CARLO stage.
    """

    def __init__(
        self,
        monte_carlo_engine: Optional[MonteCarloEngine] = None,
        auto_approve: bool = False,
    ):
        """
        Initialize the pipeline.

        Args:
            monte_carlo_engine: Optional MonteCarloEngine instance.
            auto_approve: If True, skip manual approval at APPROVE stage.
        """
        self._mc_engine = monte_carlo_engine or MonteCarloEngine()
        self._auto_approve = auto_approve
        self._handlers: Dict[PipelineStage, StageHandler] = {}
        self._history: List[PipelineRun] = []
        self._current_run: Optional[PipelineRun] = None

        # Register default handlers
        self._register_default_handlers()
        logger.info("HCFullPipeline initialised (auto_approve=%s)", auto_approve)

    def _register_default_handlers(self) -> None:
        """Register default stage handlers."""
        self._handlers[PipelineStage.INTAKE] = self._handle_intake
        self._handlers[PipelineStage.TRIAGE] = self._handle_triage
        self._handlers[PipelineStage.PLAN] = self._handle_plan
        self._handlers[PipelineStage.MONTE_CARLO] = self._handle_monte_carlo
        self._handlers[PipelineStage.ARENA] = self._handle_arena
        self._handlers[PipelineStage.JUDGE] = self._handle_judge
        self._handlers[PipelineStage.APPROVE] = self._handle_approve
        self._handlers[PipelineStage.EXECUTE] = self._handle_execute
        self._handlers[PipelineStage.VERIFY] = self._handle_verify
        self._handlers[PipelineStage.RECEIPT] = self._handle_receipt
        self._handlers[PipelineStage.ARCHIVE] = self._handle_archive
        self._handlers[PipelineStage.COMPLETE] = self._handle_complete

    # ─── Handler Registration ─────────────────────────────────────────────────

    def register_handler(self, stage: PipelineStage, handler: StageHandler) -> None:
        """
        Register a custom handler for a pipeline stage.

        Args:
            stage: The pipeline stage to handle.
            handler: A callable that takes a context dict and returns a data dict.
        """
        self._handlers[stage] = handler
        logger.info("Custom handler registered for stage %s", stage.value)

    # ─── Pipeline Execution ───────────────────────────────────────────────────

    def run(self, context: Optional[Dict[str, Any]] = None) -> PipelineRun:
        """
        Execute the full 12-stage pipeline.

        Args:
            context: Initial context dict to pass through stages.

        Returns:
            PipelineRun with all stage results.
        """
        run_id = str(uuid.uuid4())[:8]
        self._current_run = PipelineRun(
            run_id=run_id,
            status=PipelineStatus.RUNNING,
            started_at=time.time(),
            context=dict(context) if context else {},
        )

        logger.info("Pipeline run started: %s", run_id)

        for stage in STAGE_ORDER:
            self._current_run.current_stage = stage
            handler = self._handlers.get(stage)

            if handler is None:
                logger.warning("No handler for stage %s, skipping", stage.value)
                continue

            stage_start = time.time()
            try:
                stage_data = handler(self._current_run.context)
                stage_end = time.time()

                result = StageResult(
                    stage=stage,
                    status="completed",
                    started_at=stage_start,
                    completed_at=stage_end,
                    duration_ms=round((stage_end - stage_start) * 1000, 2),
                    data=stage_data or {},
                )
                self._current_run.stage_results.append(result)

                # Merge stage data into context for downstream stages
                self._current_run.context.update(stage_data or {})

                logger.info("Stage %s completed in %.2fms",
                           stage.value, result.duration_ms)

            except Exception as e:
                stage_end = time.time()
                result = StageResult(
                    stage=stage,
                    status="failed",
                    started_at=stage_start,
                    completed_at=stage_end,
                    duration_ms=round((stage_end - stage_start) * 1000, 2),
                    error=str(e),
                )
                self._current_run.stage_results.append(result)
                self._current_run.status = PipelineStatus.FAILED
                self._current_run.error = f"Stage {stage.value} failed: {e}"
                self._current_run.completed_at = time.time()
                self._history.append(self._current_run)

                logger.error("Pipeline %s failed at stage %s: %s", run_id, stage.value, e)
                return self._current_run

        self._current_run.status = PipelineStatus.COMPLETED
        self._current_run.completed_at = time.time()
        self._current_run.current_stage = None
        self._history.append(self._current_run)

        total_ms = round((self._current_run.completed_at - self._current_run.started_at) * 1000, 2)
        logger.info("Pipeline %s completed in %.2fms", run_id, total_ms)
        return self._current_run

    # ─── Default Stage Handlers ───────────────────────────────────────────────

    @staticmethod
    def _handle_intake(context: Dict[str, Any]) -> Dict[str, Any]:
        """INTAKE: Validate and accept the incoming task."""
        return {
            "intake_validated": True,
            "intake_timestamp": time.time(),
            "task_type": context.get("task_type", "general"),
        }

    @staticmethod
    def _handle_triage(context: Dict[str, Any]) -> Dict[str, Any]:
        """TRIAGE: Classify priority and route the task."""
        priority = context.get("priority", "medium")
        return {
            "triage_priority": priority,
            "triage_route": "standard" if priority == "medium" else "express",
        }

    @staticmethod
    def _handle_plan(context: Dict[str, Any]) -> Dict[str, Any]:
        """PLAN: Create execution plan."""
        return {
            "plan_steps": context.get("steps", ["execute_task"]),
            "plan_estimated_duration_ms": 5000,
        }

    def _handle_monte_carlo(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """MONTE_CARLO: Run risk assessment simulation."""
        risk_factors = context.get("risk_factors", [])
        factors = [
            RiskFactor(**rf) if isinstance(rf, dict) else rf
            for rf in risk_factors
        ]

        result = self._mc_engine.run_full_cycle(
            name=context.get("task_type", "pipeline_assessment"),
            risk_factors=factors,
            iterations=context.get("mc_iterations", 1000),
        )

        return {
            "mc_confidence": result.confidence,
            "mc_risk_grade": result.risk_grade.value,
            "mc_failure_rate": result.failure_rate,
        }

    @staticmethod
    def _handle_arena(context: Dict[str, Any]) -> Dict[str, Any]:
        """ARENA: Competitive evaluation of solutions."""
        return {
            "arena_candidates": context.get("arena_candidates", 1),
            "arena_winner": "primary",
        }

    @staticmethod
    def _handle_judge(context: Dict[str, Any]) -> Dict[str, Any]:
        """JUDGE: Evaluate arena results."""
        mc_confidence = context.get("mc_confidence", 100)
        return {
            "judge_approved": mc_confidence >= 40,
            "judge_confidence": mc_confidence,
        }

    def _handle_approve(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """APPROVE: Gate for manual or auto approval."""
        if self._auto_approve or context.get("judge_approved", False):
            return {"approved": True, "approval_method": "auto"}
        return {"approved": False, "approval_method": "pending"}

    @staticmethod
    def _handle_execute(context: Dict[str, Any]) -> Dict[str, Any]:
        """EXECUTE: Run the actual task."""
        if not context.get("approved", True):
            return {"executed": False, "reason": "not_approved"}
        return {
            "executed": True,
            "execution_timestamp": time.time(),
        }

    @staticmethod
    def _handle_verify(context: Dict[str, Any]) -> Dict[str, Any]:
        """VERIFY: Verify execution results."""
        return {
            "verified": context.get("executed", False),
            "verification_timestamp": time.time(),
        }

    @staticmethod
    def _handle_receipt(context: Dict[str, Any]) -> Dict[str, Any]:
        """RECEIPT: Generate execution receipt."""
        return {
            "receipt_id": str(uuid.uuid4())[:12],
            "receipt_timestamp": time.time(),
        }

    @staticmethod
    def _handle_archive(context: Dict[str, Any]) -> Dict[str, Any]:
        """ARCHIVE: Archive run data."""
        return {"archived": True}

    @staticmethod
    def _handle_complete(context: Dict[str, Any]) -> Dict[str, Any]:
        """COMPLETE: Finalize the pipeline run."""
        return {"completed": True, "completion_timestamp": time.time()}

    # ─── Status & History ─────────────────────────────────────────────────────

    def get_history(self, limit: int = 10) -> List[PipelineRun]:
        """Get recent pipeline run history."""
        return self._history[-limit:]

    def get_config_summary(self) -> Dict[str, Any]:
        """Get pipeline configuration summary."""
        return {
            "stages": [s.value for s in STAGE_ORDER],
            "stage_count": len(STAGE_ORDER),
            "auto_approve": self._auto_approve,
            "custom_handlers": [
                s.value for s in self._handlers
                if self._handlers[s].__name__.startswith("_handle_") is False
            ],
        }

    @property
    def current_run(self) -> Optional[PipelineRun]:
        """Get the current or most recent pipeline run."""
        return self._current_run

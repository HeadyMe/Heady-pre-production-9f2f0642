"""
Heady™ Python SDK — Core Package
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

The Python SDK for the Heady™ AI Platform. Provides native Python
implementations of vector operations, Monte Carlo simulation,
Continuous Semantic Logic (CSL), Sacred Geometry orchestration,
and the 12-stage HCFullPipeline.

Usage:
    from heady.core import (
        # Vector Space Operations
        EMBEDDING_DIM,
        dot_product, magnitude, normalize, cosine_similarity,
        euclidean_distance, add, subtract, scale,
        centroid, lerp, random_vector, pca,

        # Monte Carlo Engine
        MonteCarloEngine, mulberry32, RiskGrade, RiskFactor,
        ReadinessSignals, ReadinessResult,

        # Vector Memory
        VectorMemory, DRIFT_THRESHOLD,

        # Continuous Semantic Logic (CSL)
        HeadySemanticLogic, CSL,

        # Sacred Geometry
        SacredGeometry, PHI, PHI_INVERSE,

        # Pipeline
        HCFullPipeline, PipelineStage, PipelineStatus,
    )
"""

__version__ = "3.1.0"
__author__ = "HeadySystems Inc."
__email__ = "eric@headyconnection.org"
__license__ = "Proprietary"

# ─── Vector Space Operations ──────────────────────────────────────────────────
from .vector_space_ops import (
    EMBEDDING_DIM,
    VectorLike,
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

# ─── Monte Carlo Engine ──────────────────────────────────────────────────────
from .monte_carlo import (
    MonteCarloEngine,
    mulberry32,
    RiskGrade,
    RISK_GRADE,
    score_to_grade,
    RiskFactor,
    ReadinessSignals,
    ReadinessResult,
    SimulationResult,
    SimulationOutcomes,
    ConfidenceBounds,
    HistoryEntry,
)

# ─── Vector Memory ────────────────────────────────────────────────────────────
from .vector_memory import (
    VectorMemory,
    DRIFT_THRESHOLD,
    VectorEntry,
    SearchResult,
    DriftResult,
    MemoryStats,
)

# ─── Continuous Semantic Logic (CSL) ──────────────────────────────────────────
from .semantic_logic import (
    HeadySemanticLogic,
    CSL,
    GateStats,
    ResonanceResult,
    MultiResonanceResult,
    TernaryResult,
    RiskResult,
    RouteScore,
    RouteResult,
)

# ─── Sacred Geometry ──────────────────────────────────────────────────────────
from .sacred_geometry import (
    SacredGeometry,
    PHI,
    PHI_INVERSE,
    PHI_SQUARED,
    FIBONACCI,
    BackoffResult,
    NodePlacement,
    CoherenceScore,
)

# ─── Pipeline ─────────────────────────────────────────────────────────────────
from .pipeline import (
    HCFullPipeline,
    PipelineStage,
    PipelineStatus,
    PipelineRun,
    StageResult,
    STAGE_ORDER,
)

# ─── Public API ───────────────────────────────────────────────────────────────
__all__ = [
    # Version
    "__version__",
    # Vector Space Ops
    "EMBEDDING_DIM",
    "VectorLike",
    "dot_product",
    "magnitude",
    "normalize",
    "cosine_similarity",
    "euclidean_distance",
    "add",
    "subtract",
    "scale",
    "centroid",
    "lerp",
    "random_vector",
    "pca",
    # Monte Carlo
    "MonteCarloEngine",
    "mulberry32",
    "RiskGrade",
    "RISK_GRADE",
    "score_to_grade",
    "RiskFactor",
    "ReadinessSignals",
    "ReadinessResult",
    "SimulationResult",
    "SimulationOutcomes",
    "ConfidenceBounds",
    "HistoryEntry",
    # Vector Memory
    "VectorMemory",
    "DRIFT_THRESHOLD",
    "VectorEntry",
    "SearchResult",
    "DriftResult",
    "MemoryStats",
    # CSL
    "HeadySemanticLogic",
    "CSL",
    "GateStats",
    "ResonanceResult",
    "MultiResonanceResult",
    "TernaryResult",
    "RiskResult",
    "RouteScore",
    "RouteResult",
    # Sacred Geometry
    "SacredGeometry",
    "PHI",
    "PHI_INVERSE",
    "PHI_SQUARED",
    "FIBONACCI",
    "BackoffResult",
    "NodePlacement",
    "CoherenceScore",
    # Pipeline
    "HCFullPipeline",
    "PipelineStage",
    "PipelineStatus",
    "PipelineRun",
    "StageResult",
    "STAGE_ORDER",
]

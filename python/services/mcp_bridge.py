"""
Heady™ MCP Bridge Service — Python SDK
© 2024-2026 HeadySystems Inc. All Rights Reserved.
PROPRIETARY AND CONFIDENTIAL.

Python MCP (Model Context Protocol) bridge service that exposes the
Heady Python SDK as MCP-compatible tools via a FastAPI server.

Provides JSON-RPC 2.0 compatible endpoints for:
- Vector space operations (embed, search, similarity)
- Monte Carlo simulation (quick readiness, full cycle)
- Vector memory CRUD and search
- CSL gate operations (resonance, superposition, orthogonal, etc.)
- Sacred Geometry calculations
- Pipeline execution

Usage:
    uvicorn heady.services.mcp_bridge:app --host 0.0.0.0 --port 8420

Or run directly:
    python -m heady.services.mcp_bridge
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── SDK Imports ──────────────────────────────────────────────────────────────

import sys
import os

# Add parent directories to path for standalone execution
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.vector_space_ops import (
    EMBEDDING_DIM,
    cosine_similarity,
    dot_product,
    euclidean_distance,
    magnitude,
    normalize,
    random_vector,
    centroid,
    lerp,
    pca,
)
from core.monte_carlo import (
    MonteCarloEngine,
    RiskFactor,
    ReadinessSignals,
)
from core.vector_memory import VectorMemory
from core.semantic_logic import HeadySemanticLogic, CSL
from core.sacred_geometry import SacredGeometry, PHI
from core.pipeline import HCFullPipeline, PipelineStage

logger = logging.getLogger("heady.mcp_bridge")
logging.basicConfig(level=logging.INFO)


# ─── Singleton Instances ─────────────────────────────────────────────────────

_mc_engine = MonteCarloEngine()
_vector_memory = VectorMemory()
_pipeline = HCFullPipeline(monte_carlo_engine=_mc_engine, auto_approve=True)

# ─── MCP Tool Registry ───────────────────────────────────────────────────────

TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "vector.random": {
        "description": "Generate a random unit vector",
        "parameters": {"dimensions": {"type": "integer", "default": 384}},
    },
    "vector.similarity": {
        "description": "Compute cosine similarity between two vectors",
        "parameters": {
            "vector_a": {"type": "array", "items": {"type": "number"}},
            "vector_b": {"type": "array", "items": {"type": "number"}},
        },
    },
    "vector.distance": {
        "description": "Compute Euclidean distance between two vectors",
        "parameters": {
            "vector_a": {"type": "array", "items": {"type": "number"}},
            "vector_b": {"type": "array", "items": {"type": "number"}},
        },
    },
    "vector.normalize": {
        "description": "Normalize a vector to unit length",
        "parameters": {"vector": {"type": "array", "items": {"type": "number"}}},
    },
    "vector.pca": {
        "description": "Reduce dimensionality via PCA (power iteration)",
        "parameters": {
            "vectors": {"type": "array", "items": {"type": "array"}},
            "target_dims": {"type": "integer"},
        },
    },
    "memory.store": {
        "description": "Store a vector in memory with metadata",
        "parameters": {
            "key": {"type": "string"},
            "vector": {"type": "array", "items": {"type": "number"}},
            "metadata": {"type": "object", "default": {}},
            "namespace": {"type": "string", "default": "default"},
        },
    },
    "memory.get": {
        "description": "Retrieve a vector by key",
        "parameters": {
            "key": {"type": "string"},
            "namespace": {"type": "string", "default": "default"},
        },
    },
    "memory.search": {
        "description": "Semantic search across stored vectors",
        "parameters": {
            "query_vector": {"type": "array", "items": {"type": "number"}},
            "limit": {"type": "integer", "default": 5},
            "min_score": {"type": "number", "default": 0.6},
            "namespace": {"type": "string", "default": "default"},
        },
    },
    "memory.delete": {
        "description": "Delete a vector by key",
        "parameters": {
            "key": {"type": "string"},
            "namespace": {"type": "string", "default": "default"},
        },
    },
    "memory.stats": {
        "description": "Get memory store statistics",
        "parameters": {},
    },
    "monte_carlo.quick_readiness": {
        "description": "Fast operational readiness assessment",
        "parameters": {
            "error_rate": {"type": "number", "default": 0},
            "last_deploy_success": {"type": "boolean", "default": True},
            "cpu_pressure": {"type": "number", "default": 0},
            "memory_pressure": {"type": "number", "default": 0},
            "service_health_ratio": {"type": "number", "default": 1},
            "open_incidents": {"type": "integer", "default": 0},
        },
    },
    "monte_carlo.run": {
        "description": "Run a full Monte Carlo simulation cycle",
        "parameters": {
            "name": {"type": "string", "default": "unnamed"},
            "seed": {"type": "integer"},
            "risk_factors": {"type": "array"},
            "iterations": {"type": "integer", "default": 10000},
        },
    },
    "csl.resonance": {
        "description": "CSL Resonance Gate (Semantic AND/IF)",
        "parameters": {
            "vec_a": {"type": "array", "items": {"type": "number"}},
            "vec_b": {"type": "array", "items": {"type": "number"}},
            "threshold": {"type": "number", "default": 0.95},
        },
    },
    "csl.superposition": {
        "description": "CSL Superposition Gate (Semantic OR/MERGE)",
        "parameters": {
            "vec_a": {"type": "array", "items": {"type": "number"}},
            "vec_b": {"type": "array", "items": {"type": "number"}},
        },
    },
    "csl.orthogonal": {
        "description": "CSL Orthogonal Gate (Semantic NOT/REJECT)",
        "parameters": {
            "target_vec": {"type": "array", "items": {"type": "number"}},
            "reject_vec": {"type": "array", "items": {"type": "number"}},
        },
    },
    "csl.soft_gate": {
        "description": "CSL Soft Gate (continuous sigmoid activation)",
        "parameters": {
            "score": {"type": "number"},
            "threshold": {"type": "number", "default": 0.5},
            "steepness": {"type": "number", "default": 20},
        },
    },
    "csl.ternary": {
        "description": "CSL Ternary Gate ({-1, 0, +1} classification)",
        "parameters": {
            "score": {"type": "number"},
            "resonance_threshold": {"type": "number", "default": 0.72},
            "repel_threshold": {"type": "number", "default": 0.35},
        },
    },
    "csl.risk": {
        "description": "CSL Risk Gate (continuous risk evaluation)",
        "parameters": {
            "current": {"type": "number"},
            "limit": {"type": "number"},
            "sensitivity": {"type": "number", "default": 0.8},
        },
    },
    "csl.route": {
        "description": "CSL Route Gate (multi-candidate routing)",
        "parameters": {
            "intent": {"type": "array", "items": {"type": "number"}},
            "candidates": {"type": "array"},
            "threshold": {"type": "number", "default": 0.3},
        },
    },
    "csl.stats": {
        "description": "Get CSL gate statistics",
        "parameters": {},
    },
    "sacred_geometry.phi_backoff": {
        "description": "Calculate φ-exponential backoff delay",
        "parameters": {
            "attempt": {"type": "integer"},
            "base_delay_ms": {"type": "number", "default": 1000},
            "max_delay_ms": {"type": "number", "default": 30000},
        },
    },
    "sacred_geometry.place_nodes": {
        "description": "Place nodes in 3D Sacred Geometry space",
        "parameters": {
            "node_ids": {"type": "array", "items": {"type": "string"}},
            "radius": {"type": "number", "default": 1.0},
            "layers": {"type": "integer", "default": 3},
        },
    },
    "pipeline.run": {
        "description": "Execute the 12-stage HCFullPipeline",
        "parameters": {
            "context": {"type": "object", "default": {}},
        },
    },
    "pipeline.status": {
        "description": "Get pipeline status and history",
        "parameters": {},
    },
}


# ─── Pydantic Models ─────────────────────────────────────────────────────────


class MCPRequest(BaseModel):
    """JSON-RPC 2.0 style MCP request."""
    jsonrpc: str = "2.0"
    method: str
    params: Dict[str, Any] = Field(default_factory=dict)
    id: Optional[str] = None


class MCPResponse(BaseModel):
    """JSON-RPC 2.0 style MCP response."""
    jsonrpc: str = "2.0"
    result: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    id: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    uptime_seconds: float
    tools_registered: int
    memory_stats: Dict[str, Any]


# ─── App Lifecycle ────────────────────────────────────────────────────────────

_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Heady MCP Bridge starting on port 8420")
    yield
    logger.info("Heady MCP Bridge shutting down")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Heady™ MCP Bridge",
    description="Python MCP Bridge for the Heady™ AI Platform SDK",
    version="3.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Tool Dispatcher ─────────────────────────────────────────────────────────


def _dispatch_tool(method: str, params: Dict[str, Any]) -> Any:
    """Dispatch an MCP tool call to the appropriate SDK function."""

    # ─── Vector Operations ────────────────────────────────────────────────
    if method == "vector.random":
        dims = params.get("dimensions", EMBEDDING_DIM)
        return {"vector": random_vector(dims).tolist(), "dimensions": dims}

    elif method == "vector.similarity":
        return {"similarity": cosine_similarity(params["vector_a"], params["vector_b"])}

    elif method == "vector.distance":
        return {"distance": euclidean_distance(params["vector_a"], params["vector_b"])}

    elif method == "vector.normalize":
        return {"vector": normalize(params["vector"]).tolist()}

    elif method == "vector.pca":
        vectors = [np.array(v) for v in params["vectors"]]
        projected = pca(vectors, params["target_dims"])
        return {"projected": [p.tolist() for p in projected]}

    # ─── Memory Operations ────────────────────────────────────────────────
    elif method == "memory.store":
        _vector_memory.store(
            key=params["key"],
            vector=params["vector"],
            metadata=params.get("metadata", {}),
            namespace=params.get("namespace"),
        )
        return {"stored": True, "key": params["key"]}

    elif method == "memory.get":
        entry = _vector_memory.get(params["key"], params.get("namespace"))
        if entry is None:
            return {"found": False}
        return {
            "found": True,
            "vector": entry.vector.tolist(),
            "metadata": entry.metadata,
            "updated_at": entry.updated_at,
        }

    elif method == "memory.search":
        results = _vector_memory.search(
            query_vector=params["query_vector"],
            limit=params.get("limit", 5),
            min_score=params.get("min_score", 0.6),
            namespace=params.get("namespace"),
        )
        return {
            "results": [
                {"key": r.key, "score": r.score, "metadata": r.metadata}
                for r in results
            ]
        }

    elif method == "memory.delete":
        deleted = _vector_memory.delete(params["key"], params.get("namespace"))
        return {"deleted": deleted}

    elif method == "memory.stats":
        stats = _vector_memory.stats()
        return {
            "total_vectors": stats.total_vectors,
            "namespaces": stats.namespaces,
            "memory_estimate_bytes": stats.memory_estimate_bytes,
        }

    # ─── Monte Carlo Operations ───────────────────────────────────────────
    elif method == "monte_carlo.quick_readiness":
        signals = ReadinessSignals(
            error_rate=params.get("error_rate", 0),
            last_deploy_success=params.get("last_deploy_success", True),
            cpu_pressure=params.get("cpu_pressure", 0),
            memory_pressure=params.get("memory_pressure", 0),
            service_health_ratio=params.get("service_health_ratio", 1),
            open_incidents=params.get("open_incidents", 0),
        )
        result = _mc_engine.quick_readiness(signals)
        return {
            "score": result.score,
            "grade": result.grade.value,
            "breakdown": result.breakdown,
        }

    elif method == "monte_carlo.run":
        risk_factors = [
            RiskFactor(**rf) if isinstance(rf, dict) else rf
            for rf in params.get("risk_factors", [])
        ]
        result = _mc_engine.run_full_cycle(
            name=params.get("name", "unnamed"),
            seed=params.get("seed"),
            risk_factors=risk_factors,
            iterations=params.get("iterations", 10000),
        )
        return {
            "scenario": result.scenario,
            "iterations": result.iterations,
            "confidence": result.confidence,
            "failure_rate": result.failure_rate,
            "risk_grade": result.risk_grade.value,
            "top_mitigations": result.top_mitigations,
            "outcomes": {
                "success": result.outcomes.success,
                "partial": result.outcomes.partial,
                "failure": result.outcomes.failure,
            },
            "confidence_bounds": {
                "lower": result.confidence_bounds.lower,
                "upper": result.confidence_bounds.upper,
            },
            "seed": result.seed,
        }

    # ─── CSL Operations ───────────────────────────────────────────────────
    elif method == "csl.resonance":
        r = CSL.resonance_gate(params["vec_a"], params["vec_b"], params.get("threshold", 0.95))
        return {"score": r.score, "open": r.open}

    elif method == "csl.superposition":
        result = CSL.superposition_gate(params["vec_a"], params["vec_b"])
        return {"vector": result.tolist()}

    elif method == "csl.orthogonal":
        result = CSL.orthogonal_gate(params["target_vec"], params["reject_vec"])
        return {"vector": result.tolist()}

    elif method == "csl.soft_gate":
        return {"activation": CSL.soft_gate(
            params["score"], params.get("threshold", 0.5), params.get("steepness", 20)
        )}

    elif method == "csl.ternary":
        r = CSL.ternary_gate(
            params["score"],
            params.get("resonance_threshold", 0.72),
            params.get("repel_threshold", 0.35),
        )
        return {
            "state": r.state,
            "resonance_activation": r.resonance_activation,
            "repel_activation": r.repel_activation,
            "raw": r.raw,
        }

    elif method == "csl.risk":
        r = CSL.risk_gate(
            params["current"], params["limit"], params.get("sensitivity", 0.8)
        )
        return {
            "risk_level": r.risk_level,
            "signal": r.signal,
            "proximity": r.proximity,
            "activation": r.activation,
        }

    elif method == "csl.route":
        r = CSL.route_gate(params["intent"], params["candidates"], params.get("threshold", 0.3))
        return {
            "best": r.best,
            "scores": [{"id": s.id, "score": s.score, "activation": s.activation} for s in r.scores],
            "fallback": r.fallback,
        }

    elif method == "csl.stats":
        return CSL.get_stats()

    # ─── Sacred Geometry ──────────────────────────────────────────────────
    elif method == "sacred_geometry.phi_backoff":
        r = SacredGeometry.phi_backoff(
            params["attempt"],
            params.get("base_delay_ms", 1000),
            params.get("max_delay_ms", 30000),
            jitter=False,
        )
        return {
            "attempt": r.attempt,
            "delay_ms": r.delay_ms,
            "total_elapsed_ms": r.total_elapsed_ms,
            "next_delay_ms": r.next_delay_ms,
        }

    elif method == "sacred_geometry.place_nodes":
        placements = SacredGeometry.place_nodes_3d(
            params["node_ids"],
            params.get("radius", 1.0),
            params.get("layers", 3),
        )
        return {
            "placements": [
                {
                    "node_id": p.node_id,
                    "x": p.x, "y": p.y, "z": p.z,
                    "layer": p.layer,
                    "angle_rad": p.angle_rad,
                }
                for p in placements
            ]
        }

    # ─── Pipeline ─────────────────────────────────────────────────────────
    elif method == "pipeline.run":
        run = _pipeline.run(params.get("context", {}))
        return {
            "run_id": run.run_id,
            "status": run.status.value,
            "stages_completed": len(run.stage_results),
            "error": run.error,
        }

    elif method == "pipeline.status":
        history = _pipeline.get_history(5)
        return {
            "total_runs": len(history),
            "recent": [
                {
                    "run_id": r.run_id,
                    "status": r.status.value,
                    "stages_completed": len(r.stage_results),
                }
                for r in history
            ],
        }

    else:
        raise ValueError(f"Unknown method: {method}")


# ─── API Routes ───────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    stats = _vector_memory.stats()
    return HealthResponse(
        status="healthy",
        version="3.1.0",
        uptime_seconds=round(time.time() - _start_time, 2),
        tools_registered=len(TOOL_REGISTRY),
        memory_stats={
            "total_vectors": stats.total_vectors,
            "namespaces": stats.namespaces,
        },
    )


@app.get("/tools")
async def list_tools():
    """List all available MCP tools."""
    return {
        "tools": [
            {"name": name, **info}
            for name, info in TOOL_REGISTRY.items()
        ]
    }


@app.post("/mcp", response_model=MCPResponse)
async def mcp_endpoint(request: MCPRequest):
    """
    JSON-RPC 2.0 compatible MCP endpoint.
    Dispatches tool calls to the Heady Python SDK.
    """
    request_id = request.id or str(uuid.uuid4())[:8]

    try:
        if request.method not in TOOL_REGISTRY:
            return MCPResponse(
                id=request_id,
                error={"code": -32601, "message": f"Method not found: {request.method}"},
            )

        result = _dispatch_tool(request.method, request.params)
        return MCPResponse(id=request_id, result=result)

    except Exception as e:
        logger.error("MCP dispatch error: %s", e)
        return MCPResponse(
            id=request_id,
            error={"code": -32603, "message": str(e)},
        )


@app.post("/tools/{tool_name}")
async def call_tool(tool_name: str, params: Dict[str, Any] = {}):
    """Direct REST endpoint for calling tools by name."""
    if tool_name not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")

    try:
        result = _dispatch_tool(tool_name, params)
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8420)

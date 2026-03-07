"""
Tests for Heady™ MCP Bridge Service.
© 2024-2026 HeadySystems Inc. All Rights Reserved.
"""

import pytest
from fastapi.testclient import TestClient

from services.mcp_bridge import app, TOOL_REGISTRY


@pytest.fixture
def client():
    """Create a test client for the MCP bridge."""
    return TestClient(app)


class TestHealth:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "3.1.0"
        assert data["tools_registered"] > 0
        assert "memory_stats" in data

    def test_health_uptime(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["uptime_seconds"] >= 0


class TestToolRegistry:
    def test_list_tools(self, client):
        response = client.get("/tools")
        assert response.status_code == 200
        data = response.json()
        assert "tools" in data
        assert len(data["tools"]) == len(TOOL_REGISTRY)

    def test_all_tools_have_description(self):
        for name, info in TOOL_REGISTRY.items():
            assert "description" in info, f"Tool {name} missing description"

    def test_all_tools_have_parameters(self):
        for name, info in TOOL_REGISTRY.items():
            assert "parameters" in info, f"Tool {name} missing parameters"


class TestMCPEndpoint:
    def test_vector_random(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "vector.random",
            "params": {"dimensions": 10},
            "id": "test1",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["result"]["dimensions"] == 10
        assert len(data["result"]["vector"]) == 10

    def test_vector_similarity(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "vector.similarity",
            "params": {
                "vector_a": [1, 0, 0],
                "vector_b": [1, 0, 0],
            },
        })
        data = response.json()
        assert data["result"]["similarity"] == pytest.approx(1.0, abs=0.01)

    def test_vector_distance(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "vector.distance",
            "params": {
                "vector_a": [0, 0, 0],
                "vector_b": [3, 4, 0],
            },
        })
        data = response.json()
        assert data["result"]["distance"] == pytest.approx(5.0, abs=0.01)

    def test_vector_normalize(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "vector.normalize",
            "params": {"vector": [3, 4, 0]},
        })
        data = response.json()
        vec = data["result"]["vector"]
        mag = sum(v ** 2 for v in vec) ** 0.5
        assert mag == pytest.approx(1.0, abs=0.01)

    def test_unknown_method_error(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "nonexistent.method",
            "params": {},
        })
        data = response.json()
        assert data["error"] is not None
        assert data["error"]["code"] == -32601


class TestMemoryEndpoints:
    def test_store_and_get(self, client):
        vec = [float(i) for i in range(10)]
        # Store
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.store",
            "params": {
                "key": "test_mcp_key",
                "vector": vec,
                "metadata": {"source": "test"},
            },
        })
        assert response.json()["result"]["stored"] is True

        # Get
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.get",
            "params": {"key": "test_mcp_key"},
        })
        data = response.json()["result"]
        assert data["found"] is True
        assert data["metadata"]["source"] == "test"

    def test_search(self, client):
        vec = [1.0] * 10
        client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.store",
            "params": {"key": "search_test", "vector": vec},
        })
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.search",
            "params": {"query_vector": vec, "min_score": 0.0},
        })
        data = response.json()["result"]
        assert len(data["results"]) > 0

    def test_delete(self, client):
        vec = [1.0] * 10
        client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.store",
            "params": {"key": "del_test", "vector": vec},
        })
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.delete",
            "params": {"key": "del_test"},
        })
        assert response.json()["result"]["deleted"] is True

    def test_stats(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "memory.stats",
            "params": {},
        })
        data = response.json()["result"]
        assert "total_vectors" in data
        assert "namespaces" in data


class TestMonteCarloEndpoints:
    def test_quick_readiness(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "monte_carlo.quick_readiness",
            "params": {},
        })
        data = response.json()["result"]
        assert data["score"] == 100
        assert data["grade"] == "GREEN"

    def test_full_cycle(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "monte_carlo.run",
            "params": {
                "name": "mcp_test",
                "seed": 42,
                "iterations": 100,
                "risk_factors": [
                    {"name": "net", "probability": 0.3, "impact": 0.4},
                ],
            },
        })
        data = response.json()["result"]
        assert data["scenario"] == "mcp_test"
        assert data["iterations"] == 100
        assert 0 <= data["confidence"] <= 100


class TestCSLEndpoints:
    def test_resonance(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.resonance",
            "params": {
                "vec_a": [1, 0, 0],
                "vec_b": [1, 0, 0],
                "threshold": 0.95,
            },
        })
        data = response.json()["result"]
        assert data["score"] == pytest.approx(1.0, abs=0.01)
        assert data["open"] is True

    def test_superposition(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.superposition",
            "params": {
                "vec_a": [1, 0, 0],
                "vec_b": [0, 1, 0],
            },
        })
        data = response.json()["result"]
        assert len(data["vector"]) == 3

    def test_orthogonal(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.orthogonal",
            "params": {
                "target_vec": [1, 1, 0],
                "reject_vec": [1, 0, 0],
            },
        })
        data = response.json()["result"]
        assert len(data["vector"]) == 3

    def test_soft_gate(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.soft_gate",
            "params": {"score": 0.5, "threshold": 0.5},
        })
        data = response.json()["result"]
        assert data["activation"] == pytest.approx(0.5, abs=0.01)

    def test_ternary(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.ternary",
            "params": {"score": 0.9},
        })
        data = response.json()["result"]
        assert data["state"] == 1

    def test_risk(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.risk",
            "params": {"current": 500, "limit": 1000},
        })
        data = response.json()["result"]
        assert "risk_level" in data
        assert "signal" in data

    def test_stats(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "csl.stats",
            "params": {},
        })
        data = response.json()["result"]
        assert "resonance" in data
        assert "total_calls" in data


class TestSacredGeometryEndpoints:
    def test_phi_backoff(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "sacred_geometry.phi_backoff",
            "params": {"attempt": 0},
        })
        data = response.json()["result"]
        assert data["attempt"] == 0
        assert data["delay_ms"] == pytest.approx(1000, abs=1)

    def test_place_nodes(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "sacred_geometry.place_nodes",
            "params": {"node_ids": ["a", "b", "c"]},
        })
        data = response.json()["result"]
        assert len(data["placements"]) == 3
        assert data["placements"][0]["node_id"] == "a"


class TestPipelineEndpoints:
    def test_run_pipeline(self, client):
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "pipeline.run",
            "params": {"context": {}},
        })
        data = response.json()["result"]
        assert data["status"] == "COMPLETED"
        assert data["stages_completed"] == 12

    def test_pipeline_status(self, client):
        # Run a pipeline first
        client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "pipeline.run",
            "params": {},
        })
        response = client.post("/mcp", json={
            "jsonrpc": "2.0",
            "method": "pipeline.status",
            "params": {},
        })
        data = response.json()["result"]
        assert data["total_runs"] >= 1


class TestDirectToolEndpoint:
    def test_call_tool_directly(self, client):
        response = client.post(
            "/tools/vector.random",
            json={"dimensions": 5},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["result"]["vector"]) == 5

    def test_unknown_tool_404(self, client):
        response = client.post("/tools/nonexistent.tool", json={})
        assert response.status_code == 404

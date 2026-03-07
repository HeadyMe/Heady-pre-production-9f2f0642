"""
node2_conductor.py
==================
Google Colab Pro+ launcher for the HEADY CONDUCTOR node.

CONDUCTOR is the inner-ring (processing core) of the 3-node cluster:
  - Task routing and priority queues (PhiPriorityQueue)
  - Full pipeline execution (HCFullPipeline)
  - Bee factory — spawns specialized AI worker bees
  - Swarm intelligence and consensus (Raft-like)
  - WebSocket connection to BRAIN for memory access

Sacred Geometry role: Inner Ring — 21% warm + 13% cold pool (Fibonacci[7]+[6])

GPU requirement: T4 (minimum) / V100 (recommended for pipeline throughput)

Usage
-----
Run each cell in order in a Colab Pro+ notebook (separate instance from BRAIN).
Requires HEADY_DISCOVERY_GIST set to the Gist ID created by node1_brain.py.

Environment variables:
    NGROK_AUTHTOKEN      — ngrok auth token
    GITHUB_TOKEN         — GitHub PAT for discovery Gist
    HEADY_DISCOVERY_GIST — Gist ID from BRAIN node (required)
    HEADY_BRAIN_URL      — BRAIN node URL (auto-discovered via Gist)
    HEADY_MAX_BEES       — max concurrent bee workers (default: 13)
    HEADY_PIPELINE_CONCURRENCY — pipeline parallelism (default: 5)
"""

# ─────────────────────────────────────────────────────────────────────────────
# @title 0 — Colab Setup: Load Secrets
# @markdown Run first. Reads secrets from Colab's Secrets panel.
# @markdown **Required:** Set HEADY_DISCOVERY_GIST to the Gist ID from BRAIN.
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import time
import subprocess
from pathlib import Path

def _load_colab_secrets():
    try:
        from google.colab import userdata
        for key in [
            "NGROK_AUTHTOKEN", "GITHUB_TOKEN", "HEADY_DISCOVERY_GIST",
            "HEADY_BRAIN_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
            "GOOGLE_API_KEY", "HEADY_MAX_BEES", "HEADY_PIPELINE_CONCURRENCY",
        ]:
            try:
                val = userdata.get(key)
                if val and key not in os.environ:
                    os.environ[key] = val
            except Exception:
                pass
        print("✓ Secrets loaded")
    except ImportError:
        print("ℹ Not in Colab — using os.environ")

_load_colab_secrets()

# Add colab dir to path
_colab_dir = os.path.dirname(os.path.abspath(__file__))
if _colab_dir not in sys.path:
    sys.path.insert(0, _colab_dir)

from cluster_bootstrap import (
    install_nodejs, setup_repo, probe_gpu, setup_tunnel,
    register_node, wait_for_peers, build_env, setup_colab_keepalive,
    wait_for_service, health_check_local, health_check_remote,
    HeadyDashboard, AutoReconnect, PHI, FIBONACCI, HEADY_DIR,
    NodeRegistry, TunnelInfo,
)

# ── Config ────────────────────────────────────────────────────────────────────
NGROK_TOKEN       = os.environ.get("NGROK_AUTHTOKEN", "")
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")
DISCOVERY_GIST    = os.environ.get("HEADY_DISCOVERY_GIST", "")
CONDUCTOR_PORT    = int(os.environ.get("CONDUCTOR_PORT", "3002"))
CONDUCTOR_BRIDGE  = int(os.environ.get("CONDUCTOR_BRIDGE_PORT", "9102"))
MAX_BEES          = int(os.environ.get("HEADY_MAX_BEES", str(FIBONACCI[6])))   # 13
PIPELINE_CONCUR   = int(os.environ.get("HEADY_PIPELINE_CONCURRENCY", str(FIBONACCI[4])))  # 5

print("\n" + "═" * 60)
print("  HEADY  ✦  CONDUCTOR NODE  (Node 2 of 3)")
print("  Sacred Geometry: Inner Ring — 21%+13% Pool")
print(f"  φ = {PHI:.10f}")
print("═" * 60 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 1 — Bootstrap: Install Node.js 22 & Clone Repo
# ─────────────────────────────────────────────────────────────────────────────

print("▸ Installing Node.js 22 via nvm…")
node_path = install_nodejs(node_version="22")
print(f"  ✓ node at {node_path}\n")

print("▸ Setting up heady-zero-dep repository…")
repo_dir = setup_repo()
print(f"  ✓ repo at {repo_dir}\n")

print("▸ Probing GPU…")
gpu = probe_gpu()
if gpu.available:
    print(f"  ✓ {gpu.name}  [{gpu.detected_tier.upper()}]  {gpu.memory_mb} MB  CUDA {gpu.cuda_version}")
    if gpu.detected_tier not in ("t4", "v100", "a100"):
        print("  ⚠ CONDUCTOR works best with T4 or V100")
else:
    print("  ⚠ No GPU — CPU-only mode")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 2 — Tunnel: Expose CONDUCTOR Node Publicly
# ─────────────────────────────────────────────────────────────────────────────

print("▸ Opening tunnel on port", CONDUCTOR_PORT, "…")
tunnel = setup_tunnel(CONDUCTOR_PORT, ngrok_token=NGROK_TOKEN)
if tunnel:
    os.environ["HEADY_CONDUCTOR_URL"] = tunnel.public_url
    print(f"  ✓ {tunnel.public_url}")
else:
    print("  ⚠ Tunnel failed — LAN only")
    tunnel = TunnelInfo("none", f"http://localhost:{CONDUCTOR_PORT}", CONDUCTOR_PORT)

print("▸ Opening EventBridge tunnel on port", CONDUCTOR_BRIDGE, "…")
bridge_tunnel = setup_tunnel(CONDUCTOR_BRIDGE, ngrok_token=NGROK_TOKEN)
if bridge_tunnel:
    os.environ["HEADY_CONDUCTOR_BRIDGE_URL"] = bridge_tunnel.public_url
    print(f"  ✓ Bridge: {bridge_tunnel.public_url}")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 3 — Discovery: Register CONDUCTOR & Wait for BRAIN
# @markdown Registers this node in the cluster discovery Gist and waits for
# @markdown the BRAIN node to come online.
# @markdown
# @markdown **Requires:** HEADY_DISCOVERY_GIST set to BRAIN's Gist ID.
# ─────────────────────────────────────────────────────────────────────────────

registry = None
peers = {}

if not DISCOVERY_GIST:
    print("  ⚠ HEADY_DISCOVERY_GIST not set!")
    print("    1. Copy the Gist ID from the BRAIN notebook (cell 3)")
    print("    2. Set it as a Colab Secret named HEADY_DISCOVERY_GIST")
    print("    3. Re-run this cell")
    print("  Continuing with manual peer config…\n")
elif GITHUB_TOKEN:
    print(f"▸ Using discovery Gist: {DISCOVERY_GIST}")
    registry = NodeRegistry("conductor", GITHUB_TOKEN, DISCOVERY_GIST)
    registry.register_node(tunnel, gpu, extra={
        "bridge_url": os.environ.get("HEADY_CONDUCTOR_BRIDGE_URL", ""),
        "bridge_port": CONDUCTOR_BRIDGE,
        "services": ["heady-conductor", "pipeline", "bee-factory", "swarm"],
        "max_bees": MAX_BEES,
        "pipeline_concurrency": PIPELINE_CONCUR,
    })
    print(f"  ✓ CONDUCTOR registered in Gist {DISCOVERY_GIST}\n")

    # Wait for BRAIN (required) and SENTINEL (optional — don't block)
    print("▸ Waiting for BRAIN node to register…")
    try:
        peers = registry.wait_for_peers(["brain"], timeout_s=300.0)
        brain_url = peers["brain"]["public_url"]
        os.environ["HEADY_BRAIN_URL"] = brain_url
        bridge_url = peers["brain"].get("bridge_url", "")
        if bridge_url:
            os.environ["HEADY_BRAIN_BRIDGE_URL"] = bridge_url
        print(f"  ✓ BRAIN found: {brain_url}")
        print(f"  ✓ BRAIN bridge: {bridge_url or 'n/a'}")
    except TimeoutError:
        print("  ⚠ BRAIN not found in Gist within 5 min")
        print("    Set HEADY_BRAIN_URL manually and continue")
    print()
else:
    print("  ⚠ No GITHUB_TOKEN — skipping discovery")
    print("    Set HEADY_BRAIN_URL manually\n")

# Allow manual BRAIN URL override
BRAIN_URL = os.environ.get("HEADY_BRAIN_URL", "")
if not BRAIN_URL:
    print("  ⚠ HEADY_BRAIN_URL is not set — CONDUCTOR will start without BRAIN connection")
    print("    Set it and restart, or CONDUCTOR will retry automatically\n")
else:
    # Quick health check of BRAIN
    print(f"▸ Checking BRAIN health at {BRAIN_URL}/health …")
    result = health_check_remote(BRAIN_URL, "/health", timeout=10)
    if result.get("ok") or result.get("status") == "ok":
        print(f"  ✓ BRAIN is healthy")
    else:
        print(f"  ⚠ BRAIN health check: {result}")
    print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 4 — Task Queue Monitoring Setup
# @markdown Configures the Phi-priority task queue and pipeline parameters.
# ─────────────────────────────────────────────────────────────────────────────

def setup_conductor_env():
    """Build the complete environment for the CONDUCTOR process."""
    # Fibonacci-based resource allocation (PHI governs priorities)
    queue_sizes = {
        "CRITICAL": FIBONACCI[5],   # 8  — top priority
        "HIGH":     FIBONACCI[6],   # 13
        "NORMAL":   FIBONACCI[7],   # 21
        "LOW":      FIBONACCI[8],   # 34
        "BACKGROUND": FIBONACCI[9], # 55
    }

    env_extra = {
        # BRAIN connection
        "HEADY_BRAIN_URL":           BRAIN_URL,
        "HEADY_BRAIN_BRIDGE_URL":    os.environ.get("HEADY_BRAIN_BRIDGE_URL", ""),

        # CONDUCTOR identity
        "HEADY_CONDUCTOR_URL":       tunnel.public_url,
        "HEADY_BRIDGE_START":        "true",
        "HEADY_BRIDGE_PORT":         str(CONDUCTOR_BRIDGE),
        "HEADY_NODE_ID":             f"heady-conductor-{os.getpid()}",

        # Bee factory config
        "HEADY_MAX_BEES":            str(MAX_BEES),
        "HEADY_BEE_TIMEOUT_MS":      str(int(PHI ** 6 * 1000)),  # ~17.9s

        # Pipeline config
        "HEADY_PIPELINE_CONCURRENCY": str(PIPELINE_CONCUR),
        "HEADY_PIPELINE_TIMEOUT_MS":  str(int(PHI ** 8 * 1000)),  # ~46.9s

        # Priority queue sizes
        **{f"HEADY_QUEUE_{k}": str(v) for k, v in queue_sizes.items()},

        # Swarm consensus
        "HEADY_SWARM_QUORUM":        str(FIBONACCI[3]),  # 3 nodes for quorum

        # Data dir
        "HEADY_DATA_DIR":            str(HEADY_DIR / "data" / "conductor"),

        # LLM providers (forwarded from BRAIN)
        "OPENAI_API_KEY":            os.environ.get("OPENAI_API_KEY", ""),
        "ANTHROPIC_API_KEY":         os.environ.get("ANTHROPIC_API_KEY", ""),
        "GOOGLE_API_KEY":            os.environ.get("GOOGLE_API_KEY", ""),
    }

    return build_env("conductor", peers, env_extra)

print("▸ Building CONDUCTOR environment…")
env = setup_conductor_env()
Path(env["HEADY_DATA_DIR"]).mkdir(parents=True, exist_ok=True)
print(f"  ✓ Data dir: {env['HEADY_DATA_DIR']}")
print(f"  ✓ Max bees: {env['HEADY_MAX_BEES']}")
print(f"  ✓ Pipeline concurrency: {env['HEADY_PIPELINE_CONCURRENCY']}")
print(f"  ✓ BRAIN URL: {env.get('HEADY_BRAIN_URL', 'not set')}")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 5 — Start CONDUCTOR Services
# @markdown Launches all CONDUCTOR services:
# @markdown  ● heady-conductor — Federated routing hub on port 3002
# @markdown  ● hc-full-pipeline — End-to-end task pipeline
# @markdown  ● bee-factory — Dynamic worker bee spawner
# @markdown  ● swarm-consensus — Raft-like distributed coordination
# ─────────────────────────────────────────────────────────────────────────────

CONDUCTOR_ENTRY = repo_dir / "heady-system.js"
if not CONDUCTOR_ENTRY.exists():
    CONDUCTOR_ENTRY = repo_dir

SERVICE_PORTS = {
    CONDUCTOR_PORT:  "heady-conductor (main)",
    3021:            "hc-full-pipeline",
    3022:            "bee-factory",
    3023:            "swarm-consensus",
    CONDUCTOR_BRIDGE: "event-bridge",
}

print("▸ Starting CONDUCTOR services…\n")

def start_conductor_process():
    """Launch the CONDUCTOR Node.js process."""
    cmd = [str(node_path), "--experimental-vm-modules", str(CONDUCTOR_ENTRY)]
    if os.path.isdir(str(CONDUCTOR_ENTRY)):
        cmd = [str(node_path), "--experimental-vm-modules", "."]

    log_file = open("/tmp/heady-conductor.log", "a", buffering=1)
    proc = subprocess.Popen(
        cmd,
        cwd=str(repo_dir),
        env=env,
        stdout=log_file,
        stderr=log_file,
    )
    print(f"  ✓ CONDUCTOR process started (PID {proc.pid})")
    print(f"  ✓ Logs: /tmp/heady-conductor.log")
    return proc

auto_reconnect = AutoReconnect(start_conductor_process, max_attempts=FIBONACCI[6])
auto_reconnect.launch()


# ─────────────────────────────────────────────────────────────────────────────
# @title 6 — Wait for Services & Show Status
# ─────────────────────────────────────────────────────────────────────────────

print("\n▸ Waiting for CONDUCTOR to become healthy…\n")
main_ready = wait_for_service(CONDUCTOR_PORT, "/health", timeout_s=120.0, service_name="CONDUCTOR")

if main_ready:
    print(f"\n  ┌─────────────────────────────────────────────────────┐")
    print(f"  │  CONDUCTOR NODE READY  ✓                            │")
    print(f"  │                                                     │")
    print(f"  │  Endpoint:   {tunnel.public_url:<38} │")
    print(f"  │  Health:     {(tunnel.public_url + '/health'):<38} │")
    print(f"  │  BRAIN:      {BRAIN_URL or 'not connected':<38} │")
    print(f"  │  Bees:       {str(MAX_BEES) + ' workers max':<38} │")
    print(f"  └─────────────────────────────────────────────────────┘\n")
else:
    print("\n  ⚠ Services slow to start — check logs:")
    print("    !tail -50 /tmp/heady-conductor.log\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 7 — Pipeline Status Dashboard
# @markdown Live dashboard showing task queue depth, bee utilization,
# @markdown and pipeline throughput.
# ─────────────────────────────────────────────────────────────────────────────

def render_pipeline_status() -> str:
    """Fetch and render CONDUCTOR pipeline stats."""
    lines = []
    try:
        result = health_check_local(CONDUCTOR_PORT, "/status")
        if isinstance(result, dict):
            lines.append(f"  Tasks queued:    {result.get('queued', '?')}")
            lines.append(f"  Active bees:     {result.get('active_bees', '?')} / {MAX_BEES}")
            lines.append(f"  Pipeline runs:   {result.get('pipeline_runs', '?')}")
            lines.append(f"  Tasks complete:  {result.get('tasks_complete', '?')}")
            lines.append(f"  Tasks failed:    {result.get('tasks_failed', '?')}")
            swarm = result.get("swarm", {})
            if swarm:
                lines.append(f"  Swarm state:     {swarm.get('state', '?')}")
                lines.append(f"  Swarm leader:    {swarm.get('leader', '?')}")
    except Exception as exc:
        lines.append(f"  (pipeline status unavailable: {exc})")
    return "\n".join(lines)

dashboard = HeadyDashboard(
    node_role="CONDUCTOR",
    gpu=gpu,
    tunnel=tunnel,
    service_ports=list(SERVICE_PORTS.keys()),
    service_names=SERVICE_PORTS,
    refresh_interval=FIBONACCI[4],  # 5s
)
setup_colab_keepalive(interval_s=60.0)

print("▸ Starting live dashboard…\n")
dashboard.start()
print(dashboard.render())


# ─────────────────────────────────────────────────────────────────────────────
# @title 8 — Interactive Commands
# @markdown
# @markdown ```python
# @markdown # Check pipeline status
# @markdown print(health_check_local(3002, "/status"))
# @markdown
# @markdown # Tail logs
# @markdown !tail -100 /tmp/heady-conductor.log
# @markdown
# @markdown # Submit a test task to the conductor
# @markdown import json, urllib.request
# @markdown task = {"type": "test", "payload": {"echo": "hello"}}
# @markdown req = urllib.request.Request(
# @markdown     f"http://localhost:{CONDUCTOR_PORT}/task",
# @markdown     data=json.dumps(task).encode(),
# @markdown     headers={"Content-Type": "application/json"},
# @markdown     method="POST"
# @markdown )
# @markdown with urllib.request.urlopen(req) as resp:
# @markdown     print(json.loads(resp.read()))
# @markdown
# @markdown # See peer discovery
# @markdown if registry: print(registry.discover_peers())
# @markdown ```
# ─────────────────────────────────────────────────────────────────────────────

CONDUCTOR_INFO = {
    "role": "conductor",
    "public_url": tunnel.public_url,
    "port": CONDUCTOR_PORT,
    "bridge_port": CONDUCTOR_BRIDGE,
    "brain_url": BRAIN_URL,
    "max_bees": MAX_BEES,
    "pipeline_concurrency": PIPELINE_CONCUR,
    "gpu": gpu.to_dict(),
    "gist_id": registry.gist_id if registry else DISCOVERY_GIST,
    "log_file": "/tmp/heady-conductor.log",
}

print("\n  CONDUCTOR_INFO summary:")
for k, v in CONDUCTOR_INFO.items():
    if k != "gpu":
        print(f"  {k:<25} {v}")

print(f"\n  φ = {PHI:.10f}  — Inner Ring, processing core")
print("  CONDUCTOR node is running. Start SENTINEL next.\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 9 — Graceful Shutdown
# @markdown Run only when stopping the CONDUCTOR node.
# ─────────────────────────────────────────────────────────────────────────────

def shutdown_conductor():
    import signal as _signal
    print("▸ Stopping CONDUCTOR node…")
    dashboard.stop()
    if auto_reconnect._proc and auto_reconnect._proc.poll() is None:
        auto_reconnect._proc.send_signal(_signal.SIGTERM)
        try:
            auto_reconnect._proc.wait(timeout=15)
            print("  ✓ CONDUCTOR process terminated gracefully")
        except subprocess.TimeoutExpired:
            auto_reconnect._proc.kill()
            print("  ⚠ CONDUCTOR process killed (timeout)")
    auto_reconnect.terminate()
    print("  CONDUCTOR node stopped.\n")

# Uncomment to run:
# shutdown_conductor()


# ─────────────────────────────────────────────────────────────────────────────
# @title CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__" and "ipykernel" not in sys.modules:
    import argparse

    parser = argparse.ArgumentParser(description="Heady CONDUCTOR node launcher")
    parser.add_argument("--port", type=int, default=CONDUCTOR_PORT)
    parser.add_argument("--bridge-port", type=int, default=CONDUCTOR_BRIDGE)
    parser.add_argument("--ngrok-token", default=NGROK_TOKEN)
    parser.add_argument("--github-token", default=GITHUB_TOKEN)
    parser.add_argument("--gist-id", default=DISCOVERY_GIST)
    parser.add_argument("--brain-url", default=BRAIN_URL)
    args = parser.parse_args()

    os.environ["HEADY_BRAIN_URL"] = args.brain_url
    print("Running CONDUCTOR launcher from CLI…")
    try:
        while True:
            time.sleep(FIBONACCI[4])
    except KeyboardInterrupt:
        shutdown_conductor()

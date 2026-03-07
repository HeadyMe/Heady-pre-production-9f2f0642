"""
node1_brain.py
==============
Google Colab Pro+ launcher for the HEADY BRAIN node.

BRAIN is the central hub (φ origin point) of the 3-node cluster:
  - Vector memory (HNSW, 384-dimensional)
  - Embedding engine (local or API-backed)
  - LLM routing across all providers
  - Model serving / inference (GPU-accelerated)
  - MCP protocol endpoint for CONDUCTOR + SENTINEL

Sacred Geometry role: Central Hub — 34% hot resource pool (Fibonacci[8]=34)

GPU requirement: T4 (minimum) / A100 (recommended for model inference)

Usage
-----
Run each cell in order top-to-bottom in a Colab Pro+ notebook.
This script can also be executed directly:
    $ python node1_brain.py --port 3001 --ngrok-token <token>

Environment variables (set in Colab Secrets or cell 0):
    NGROK_AUTHTOKEN      — ngrok auth token for stable tunnels
    GITHUB_TOKEN         — GitHub PAT for discovery Gist
    HEADY_DISCOVERY_GIST — Gist ID (auto-created if unset on BRAIN)
    OPENAI_API_KEY       — (optional) OpenAI provider
    ANTHROPIC_API_KEY    — (optional) Anthropic provider
    HEADY_LLM_PROVIDERS  — comma-separated list of enabled providers
    HEADY_EMBED_MODEL    — embedding model (default: "local")
"""

# ─────────────────────────────────────────────────────────────────────────────
# @title 0 — Colab Setup: Mount Drive & Load Secrets
# @markdown Run this cell first. Mounts Google Drive and loads secrets from
# @markdown Colab's Secrets panel (key icon in left sidebar).
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys

def _load_colab_secrets():
    """Load secrets from Colab userdata if available."""
    try:
        from google.colab import userdata
        secret_keys = [
            "NGROK_AUTHTOKEN",
            "GITHUB_TOKEN",
            "HEADY_DISCOVERY_GIST",
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "GOOGLE_API_KEY",
            "HEADY_LLM_PROVIDERS",
            "HEADY_EMBED_MODEL",
        ]
        for key in secret_keys:
            try:
                val = userdata.get(key)
                if val and key not in os.environ:
                    os.environ[key] = val
            except Exception:
                pass
        print("✓ Secrets loaded from Colab Secrets panel")
    except ImportError:
        print("ℹ Not running in Colab — using environment variables directly")

_load_colab_secrets()

# Optionally mount Drive for persistent data
MOUNT_DRIVE = os.environ.get("HEADY_MOUNT_DRIVE", "0") == "1"
if MOUNT_DRIVE:
    try:
        from google.colab import drive
        drive.mount("/content/drive", force_remount=False)
        print("✓ Google Drive mounted at /content/drive")
    except Exception as e:
        print(f"ℹ Drive mount skipped: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# @title 1 — Bootstrap: Install Node.js 22, Clone Repo, Detect GPU
# @markdown Installs nvm + Node.js 22 (no npm packages needed), clones the
# @markdown heady-zero-dep repo, and probes GPU/CUDA capabilities.
# ─────────────────────────────────────────────────────────────────────────────

# @markdown **Configuration** (edit these or set as Colab Secrets):

# @markdown `NGROK_AUTHTOKEN` — your ngrok auth token for a stable public URL
NGROK_TOKEN = os.environ.get("NGROK_AUTHTOKEN", "")

# @markdown `GITHUB_TOKEN` — GitHub PAT (repo + gist scope) for discovery
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# @markdown `HEADY_DISCOVERY_GIST` — leave empty to auto-create a new Gist
DISCOVERY_GIST = os.environ.get("HEADY_DISCOVERY_GIST", "")

# @markdown `BRAIN_PORT` — local HTTP port for the BRAIN node (default 3001)
BRAIN_PORT = int(os.environ.get("BRAIN_PORT", "3001"))

# @markdown `BRAIN_BRIDGE_PORT` — EventBridge WebSocket port (default 9101)
BRAIN_BRIDGE_PORT = int(os.environ.get("BRAIN_BRIDGE_PORT", "9101"))

# Add the colab directory to Python path so we can import cluster_bootstrap
_colab_dir = os.path.dirname(os.path.abspath(__file__))
if _colab_dir not in sys.path:
    sys.path.insert(0, _colab_dir)

from cluster_bootstrap import (
    install_nodejs,
    setup_repo,
    probe_gpu,
    setup_tunnel,
    register_node,
    wait_for_peers,
    build_env,
    setup_colab_keepalive,
    wait_for_service,
    health_check_local,
    HeadyDashboard,
    AutoReconnect,
    PHI,
    FIBONACCI,
    HEADY_DIR,
    NodeRegistry,
    TunnelInfo,
)

print("\n" + "═" * 60)
print("  HEADY  ✦  BRAIN NODE  (Node 1 of 3)")
print("  Sacred Geometry: Central Hub — 34% Hot Pool")
print(f"  φ = {PHI:.10f}")
print("═" * 60 + "\n")

# ── Install Node.js 22 ────────────────────────────────────────────────────────
print("▸ Installing Node.js 22 via nvm…")
node_path = install_nodejs(node_version="22")
print(f"  ✓ node at {node_path}\n")

# ── Clone / update repository ──────────────────────────────────────────────
print("▸ Setting up heady-zero-dep repository…")
repo_dir = setup_repo()
print(f"  ✓ repo at {repo_dir}\n")

# ── GPU detection ─────────────────────────────────────────────────────────
print("▸ Probing GPU…")
gpu = probe_gpu()
if gpu.available:
    print(f"  ✓ {gpu.name}  [{gpu.detected_tier.upper()}]  {gpu.memory_mb} MB  CUDA {gpu.cuda_version}")
    if gpu.detected_tier not in ("t4", "v100", "a100"):
        print("  ⚠ BRAIN works best with T4 or A100 GPU for embedding + inference")
else:
    print("  ⚠ No GPU detected — running in CPU-only mode (slower embeddings)")

print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 2 — Tunnel: Expose BRAIN Node Publicly via ngrok
# @markdown Opens a public HTTPS tunnel so CONDUCTOR and SENTINEL can reach
# @markdown this node's HTTP/WebSocket/MCP endpoints.
# ─────────────────────────────────────────────────────────────────────────────

print("▸ Establishing ngrok tunnel on port", BRAIN_PORT, "…")
tunnel = setup_tunnel(BRAIN_PORT, ngrok_token=NGROK_TOKEN)

if tunnel:
    print(f"  ✓ Public URL: {tunnel.public_url}")
    # Store for peer discovery
    os.environ["HEADY_BRAIN_URL"] = tunnel.public_url
else:
    print("  ⚠ Tunnel failed — BRAIN will only be reachable on local network")
    # Create a placeholder so the rest of the script can continue
    tunnel = TunnelInfo("none", f"http://localhost:{BRAIN_PORT}", BRAIN_PORT)

# Also expose the EventBridge port
print("▸ Establishing EventBridge tunnel on port", BRAIN_BRIDGE_PORT, "…")
bridge_tunnel = setup_tunnel(BRAIN_BRIDGE_PORT, ngrok_token=NGROK_TOKEN)
if bridge_tunnel:
    os.environ["HEADY_BRAIN_BRIDGE_URL"] = bridge_tunnel.public_url
    print(f"  ✓ Bridge URL: {bridge_tunnel.public_url}")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 3 — Discovery: Register BRAIN in Cluster Gist
# @markdown Writes this node's public URL to a GitHub Gist so CONDUCTOR
# @markdown and SENTINEL can discover it automatically.
# @markdown
# @markdown **Share the Gist ID below with all 3 notebooks.**
# ─────────────────────────────────────────────────────────────────────────────

registry = None
if GITHUB_TOKEN:
    print("▸ Registering BRAIN in discovery Gist…")
    registry = NodeRegistry("brain", GITHUB_TOKEN, DISCOVERY_GIST or None)
    registry.register_node(tunnel, gpu, extra={
        "bridge_url": os.environ.get("HEADY_BRAIN_BRIDGE_URL", ""),
        "bridge_port": BRAIN_BRIDGE_PORT,
        "services": ["vector-db", "embedding-engine", "llm-router", "mcp"],
    })
    gist_id = registry.gist_id
    os.environ["HEADY_DISCOVERY_GIST"] = gist_id
    print(f"\n  ┌─────────────────────────────────────────────────┐")
    print(f"  │  Discovery Gist ID:  {gist_id:<27} │")
    print(f"  │  Share this with node2_conductor.py and         │")
    print(f"  │  node3_sentinel.py notebooks!                   │")
    print(f"  └─────────────────────────────────────────────────┘\n")
else:
    print("  ⚠ No GITHUB_TOKEN — skipping discovery Gist")
    print("    Set HEADY_CONDUCTOR_URL and HEADY_SENTINEL_URL manually\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 4 — CUDA Environment Setup for Local Model Inference
# @markdown Configures CUDA / ONNX Runtime environment variables so Node.js
# @markdown can invoke local model inference without Python dependencies.
# ─────────────────────────────────────────────────────────────────────────────

def setup_cuda_env(gpu_info):
    """Configure CUDA-related environment variables for Node.js inference."""
    if not gpu_info.available:
        print("  ℹ CPU-only mode: skipping CUDA setup")
        return

    import subprocess, shutil

    # Detect CUDA path
    cuda_paths = ["/usr/local/cuda", "/usr/cuda", "/opt/cuda"]
    cuda_home = next((p for p in cuda_paths if os.path.isdir(p)), None)
    if cuda_home:
        os.environ["CUDA_HOME"] = cuda_home
        os.environ["CUDA_PATH"] = cuda_home
        cuda_lib = os.path.join(cuda_home, "lib64")
        existing_ld = os.environ.get("LD_LIBRARY_PATH", "")
        os.environ["LD_LIBRARY_PATH"] = f"{cuda_lib}:{existing_ld}"
        print(f"  ✓ CUDA_HOME = {cuda_home}")

    os.environ["HEADY_GPU_TIER"] = gpu_info.detected_tier
    os.environ["HEADY_GPU_MEM_MB"] = str(gpu_info.memory_mb)
    os.environ["HEADY_CUDA_VERSION"] = gpu_info.cuda_version

    # Pick embedding batch size based on GPU tier
    batch_sizes = {"t4": "32", "v100": "64", "a100": "128"}
    batch = batch_sizes.get(gpu_info.detected_tier, "16")
    os.environ["HEADY_EMBED_BATCH_SIZE"] = batch
    print(f"  ✓ Embedding batch size: {batch}")

    # Confirm GPU is accessible
    if shutil.which("nvidia-smi"):
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            for line in result.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                print(f"  ✓ GPU live: {parts[0]}  util={parts[1]}%  "
                      f"mem={parts[2]}/{parts[3]} MB")

print("▸ Setting up CUDA environment…")
setup_cuda_env(gpu)
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 5 — Build Environment & Start BRAIN Services
# @markdown Builds the complete environment variable set and launches all
# @markdown BRAIN services via Node.js:
# @markdown
# @markdown  ● vector-db     — HNSW vector store on port 3011
# @markdown  ● embedding-engine — Local/API embedding on port 3012
# @markdown  ● llm-router    — Multi-provider LLM routing on port 3013
# @markdown  ● mcp-server    — MCP protocol endpoint on port 3001
# ─────────────────────────────────────────────────────────────────────────────

import subprocess
from pathlib import Path

# Build environment
peers = {}
if registry:
    try:
        peers = registry.discover_peers()
    except Exception:
        pass

env = build_env("brain", peers, {
    # LLM providers — read from Colab Secrets
    "OPENAI_API_KEY":     os.environ.get("OPENAI_API_KEY", ""),
    "ANTHROPIC_API_KEY":  os.environ.get("ANTHROPIC_API_KEY", ""),
    "GOOGLE_API_KEY":     os.environ.get("GOOGLE_API_KEY", ""),
    "HEADY_LLM_PROVIDERS": os.environ.get("HEADY_LLM_PROVIDERS", "openai,anthropic,google"),
    "HEADY_EMBED_MODEL":  os.environ.get("HEADY_EMBED_MODEL", "local"),
    # BRAIN-specific
    "HEADY_BRAIN_URL":    tunnel.public_url,
    "HEADY_BRIDGE_START": "true",
    "HEADY_BRIDGE_PORT":  str(BRAIN_BRIDGE_PORT),
    # Data persistence
    "HEADY_DATA_DIR":     str(HEADY_DIR / "data" / "brain"),
    # Sacred Geometry
    "HEADY_PHI":          str(PHI),
    "HEADY_NODE_ID":      f"heady-brain-{os.getpid()}",
})

# Ensure data dir exists
Path(env["HEADY_DATA_DIR"]).mkdir(parents=True, exist_ok=True)

# ── Entry point script ────────────────────────────────────────────────────
BRAIN_ENTRY = repo_dir / "heady-system.js"
if not BRAIN_ENTRY.exists():
    print(f"  ⚠ {BRAIN_ENTRY} not found — checking package.json scripts…")
    BRAIN_ENTRY = repo_dir  # fallback: use repo dir, rely on package.json "start:brain"

# ── Service definitions ───────────────────────────────────────────────────
SERVICE_PORTS = {
    BRAIN_PORT: "mcp-server (main)",
    3011: "vector-db",
    3012: "embedding-engine",
    3013: "llm-router",
    BRAIN_BRIDGE_PORT: "event-bridge",
}

print("▸ Starting BRAIN services…\n")

def start_brain_process():
    """Launch the BRAIN Node.js process."""
    cmd = [str(node_path), "--experimental-vm-modules", str(BRAIN_ENTRY)]
    # If entry is a directory, use `node .`
    if os.path.isdir(str(BRAIN_ENTRY)):
        cmd = [str(node_path), "--experimental-vm-modules", "."]

    log_file = open("/tmp/heady-brain.log", "a", buffering=1)
    proc = subprocess.Popen(
        cmd,
        cwd=str(repo_dir),
        env=env,
        stdout=log_file,
        stderr=log_file,
    )
    print(f"  ✓ BRAIN process started (PID {proc.pid})")
    print(f"  ✓ Logs: /tmp/heady-brain.log  (tail -f /tmp/heady-brain.log)")
    return proc

auto_reconnect = AutoReconnect(start_brain_process, max_attempts=FIBONACCI[6])  # 13 attempts
auto_reconnect.launch()


# ─────────────────────────────────────────────────────────────────────────────
# @title 6 — Wait for Services & Show Health Status
# @markdown Polls the BRAIN services until they respond healthy, then
# @markdown prints the full connection info for other nodes.
# ─────────────────────────────────────────────────────────────────────────────

import time

print("▸ Waiting for BRAIN services to become healthy…\n")

# Wait for main MCP endpoint (most critical)
main_ready = wait_for_service(BRAIN_PORT, "/health", timeout_s=120.0, service_name="BRAIN MCP")

if main_ready:
    print(f"\n  ┌─────────────────────────────────────────────────────┐")
    print(f"  │  BRAIN NODE READY  ✓                                │")
    print(f"  │                                                     │")
    print(f"  │  MCP endpoint:   {tunnel.public_url + '/mcp':<34} │")
    print(f"  │  Health:         {tunnel.public_url + '/health':<34} │")
    print(f"  │  Bridge WS:      {os.environ.get('HEADY_BRAIN_BRIDGE_URL', f'ws://localhost:{BRAIN_BRIDGE_PORT}'):<34} │")
    if registry:
        print(f"  │  Discovery Gist: {registry.gist_id:<34} │")
    print(f"  └─────────────────────────────────────────────────────┘\n")
else:
    print("\n  ⚠ BRAIN services slow to start — check logs:")
    print("    !tail -50 /tmp/heady-brain.log\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 7 — Live Health Dashboard
# @markdown Shows a live-updating dashboard with GPU utilization, service
# @markdown health, and tunnel info.  Runs in the background — execute other
# @markdown cells freely.
# ─────────────────────────────────────────────────────────────────────────────

dashboard = HeadyDashboard(
    node_role="BRAIN",
    gpu=gpu,
    tunnel=tunnel,
    service_ports=list(SERVICE_PORTS.keys()),
    service_names=SERVICE_PORTS,
    refresh_interval=FIBONACCI[4],  # PHI^4 * 1000 / 1000 ≈ 5s, use Fibonacci[4]=5
)

setup_colab_keepalive(interval_s=60.0)

print("▸ Starting live dashboard (updates every 5 seconds)…")
print("  Dashboard will render below. Run !tail -f /tmp/heady-brain.log for logs.\n")
dashboard.start()

# Print initial render
print(dashboard.render())


# ─────────────────────────────────────────────────────────────────────────────
# @title 8 — Interactive Commands (optional)
# @markdown Utility commands you can run in separate cells:
# @markdown
# @markdown ```python
# @markdown # Check service health
# @markdown print(health_check_local(3001))
# @markdown
# @markdown # Tail logs
# @markdown !tail -100 /tmp/heady-brain.log
# @markdown
# @markdown # See registered peers
# @markdown if registry: print(registry.discover_peers())
# @markdown
# @markdown # Manual health check against all ports
# @markdown for port, name in SERVICE_PORTS.items():
# @markdown     r = health_check_local(port)
# @markdown     print(f"{name}: {r}")
# @markdown
# @markdown # Graceful restart
# @markdown auto_reconnect.terminate()
# @markdown auto_reconnect.launch()
# @markdown ```
# ─────────────────────────────────────────────────────────────────────────────

# Keep a summary of key vars for interactive use
BRAIN_INFO = {
    "role": "brain",
    "public_url": tunnel.public_url,
    "mcp_url": tunnel.public_url + "/mcp",
    "health_url": tunnel.public_url + "/health",
    "port": BRAIN_PORT,
    "bridge_port": BRAIN_BRIDGE_PORT,
    "gpu": gpu.to_dict(),
    "gist_id": registry.gist_id if registry else None,
    "log_file": "/tmp/heady-brain.log",
    "pid": auto_reconnect._proc.pid if auto_reconnect._proc else None,
}

print("\n  BRAIN_INFO summary:")
for k, v in BRAIN_INFO.items():
    if k != "gpu":
        print(f"  {k:<20} {v}")

print(f"\n  φ = {PHI:.10f}  — Sacred Geometry governs all")
print("  BRAIN node is running. Start CONDUCTOR next.\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 9 — Graceful Shutdown (run only when stopping)
# @markdown Execute this cell to cleanly shut down all BRAIN services.
# @markdown This sends SIGTERM to the Node.js process and waits for it to
# @markdown complete its shutdown sequence.
# ─────────────────────────────────────────────────────────────────────────────

def shutdown_brain():
    """Gracefully stop all BRAIN services."""
    import signal as _signal
    print("▸ Stopping BRAIN node…")
    dashboard.stop()
    if auto_reconnect._proc and auto_reconnect._proc.poll() is None:
        auto_reconnect._proc.send_signal(_signal.SIGTERM)
        try:
            auto_reconnect._proc.wait(timeout=int(PHI ** 5 * 1000 / 1000))  # ~11s
            print("  ✓ BRAIN process terminated gracefully")
        except subprocess.TimeoutExpired:
            auto_reconnect._proc.kill()
            print("  ⚠ BRAIN process killed (timeout)")
    auto_reconnect.terminate()
    print("  BRAIN node stopped.\n")

# Uncomment to run shutdown:
# shutdown_brain()


# ─────────────────────────────────────────────────────────────────────────────
# @title CLI entry point (for direct script execution)
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__" and "ipykernel" not in sys.modules:
    import argparse

    parser = argparse.ArgumentParser(description="Heady BRAIN node launcher")
    parser.add_argument("--port", type=int, default=BRAIN_PORT)
    parser.add_argument("--bridge-port", type=int, default=BRAIN_BRIDGE_PORT)
    parser.add_argument("--ngrok-token", default=NGROK_TOKEN)
    parser.add_argument("--github-token", default=GITHUB_TOKEN)
    parser.add_argument("--gist-id", default=DISCOVERY_GIST)
    args = parser.parse_args()

    # Override globals from CLI args
    BRAIN_PORT = args.port
    BRAIN_BRIDGE_PORT = args.bridge_port
    NGROK_TOKEN = args.ngrok_token
    GITHUB_TOKEN = args.github_token
    DISCOVERY_GIST = args.gist_id

    print("Running BRAIN launcher from CLI — all cells execute sequentially.")
    # Keep process alive
    try:
        while True:
            time.sleep(FIBONACCI[4])  # 5s
    except KeyboardInterrupt:
        shutdown_brain()

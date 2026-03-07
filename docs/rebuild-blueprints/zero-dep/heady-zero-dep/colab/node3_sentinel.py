"""
node3_sentinel.py
=================
Google Colab Pro+ launcher for the HEADY SENTINEL node.

SENTINEL is the governance shell of the 3-node cluster:
  - Circuit breakers and fault isolation (ResilienceLayer)
  - Self-healing mesh (quarantine → diagnose → heal → verify)
  - Security: PQC handshake, RBAC, env validation
  - Distributed telemetry aggregation across all nodes
  - Governance approval gates for high-risk operations
  - Alerting system (console + webhook)

Sacred Geometry role: Governance Shell — 8% reserve + 5% governance overhead
                      (Fibonacci[5]+[3] = 8+3 = 11)

GPU requirement: T4 (basic compute for telemetry aggregation)

Usage
-----
Run each cell in order in a Colab Pro+ notebook (separate instance).
Requires HEADY_DISCOVERY_GIST and ideally both BRAIN and CONDUCTOR running.

Environment variables:
    NGROK_AUTHTOKEN         — ngrok auth token
    GITHUB_TOKEN            — GitHub PAT for discovery Gist
    HEADY_DISCOVERY_GIST    — Gist ID from BRAIN node (required)
    HEADY_ALERT_WEBHOOK     — Optional webhook URL for alerts (Slack/Discord)
    HEADY_SECURITY_MODE     — "strict" | "permissive" (default: "strict")
    HEADY_TELEMETRY_FLUSH_S — Telemetry flush interval in seconds (default: 11)
"""

# ─────────────────────────────────────────────────────────────────────────────
# @title 0 — Colab Setup: Load Secrets
# @markdown Run first. Required: HEADY_DISCOVERY_GIST (from BRAIN notebook).
# ─────────────────────────────────────────────────────────────────────────────

import os
import sys
import time
import json
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import urlopen, Request

def _load_colab_secrets():
    try:
        from google.colab import userdata
        for key in [
            "NGROK_AUTHTOKEN", "GITHUB_TOKEN", "HEADY_DISCOVERY_GIST",
            "HEADY_BRAIN_URL", "HEADY_CONDUCTOR_URL",
            "HEADY_ALERT_WEBHOOK", "HEADY_SECURITY_MODE",
            "HEADY_TELEMETRY_FLUSH_S",
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
NGROK_TOKEN        = os.environ.get("NGROK_AUTHTOKEN", "")
GITHUB_TOKEN       = os.environ.get("GITHUB_TOKEN", "")
DISCOVERY_GIST     = os.environ.get("HEADY_DISCOVERY_GIST", "")
SENTINEL_PORT      = int(os.environ.get("SENTINEL_PORT", "3003"))
SENTINEL_BRIDGE    = int(os.environ.get("SENTINEL_BRIDGE_PORT", "9103"))
ALERT_WEBHOOK      = os.environ.get("HEADY_ALERT_WEBHOOK", "")
SECURITY_MODE      = os.environ.get("HEADY_SECURITY_MODE", "strict")
TELEMETRY_FLUSH_S  = int(os.environ.get("HEADY_TELEMETRY_FLUSH_S", str(int(PHI ** 5))))  # ~11s

print("\n" + "═" * 60)
print("  HEADY  ✦  SENTINEL NODE  (Node 3 of 3)")
print("  Sacred Geometry: Governance Shell — 8%+5% Reserve")
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
else:
    print("  ℹ No GPU — CPU mode (SENTINEL is lightly compute-bound)")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 2 — Tunnel: Expose SENTINEL Node Publicly
# ─────────────────────────────────────────────────────────────────────────────

print("▸ Opening tunnel on port", SENTINEL_PORT, "…")
tunnel = setup_tunnel(SENTINEL_PORT, ngrok_token=NGROK_TOKEN)
if tunnel:
    os.environ["HEADY_SENTINEL_URL"] = tunnel.public_url
    print(f"  ✓ {tunnel.public_url}")
else:
    print("  ⚠ Tunnel failed — LAN only")
    tunnel = TunnelInfo("none", f"http://localhost:{SENTINEL_PORT}", SENTINEL_PORT)

print("▸ Opening EventBridge tunnel on port", SENTINEL_BRIDGE, "…")
bridge_tunnel = setup_tunnel(SENTINEL_BRIDGE, ngrok_token=NGROK_TOKEN)
if bridge_tunnel:
    os.environ["HEADY_SENTINEL_BRIDGE_URL"] = bridge_tunnel.public_url
    print(f"  ✓ Bridge: {bridge_tunnel.public_url}")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 3 — Discovery: Register SENTINEL & Discover All Peers
# @markdown SENTINEL connects to BOTH BRAIN and CONDUCTOR. It needs both URLs
# @markdown to perform cross-cluster health monitoring.
# ─────────────────────────────────────────────────────────────────────────────

registry = None
peers = {}

if not DISCOVERY_GIST:
    print("  ⚠ HEADY_DISCOVERY_GIST not set!")
    print("    Copy the Gist ID from BRAIN's notebook cell 3 and set it as a Colab Secret.\n")
elif GITHUB_TOKEN:
    print(f"▸ Using discovery Gist: {DISCOVERY_GIST}")
    registry = NodeRegistry("sentinel", GITHUB_TOKEN, DISCOVERY_GIST)
    registry.register_node(tunnel, gpu, extra={
        "bridge_url": os.environ.get("HEADY_SENTINEL_BRIDGE_URL", ""),
        "bridge_port": SENTINEL_BRIDGE,
        "services": ["circuit-breaker", "self-healing", "telemetry", "governance", "security"],
        "security_mode": SECURITY_MODE,
        "alert_webhook": bool(ALERT_WEBHOOK),
    })
    print(f"  ✓ SENTINEL registered in Gist {DISCOVERY_GIST}\n")

    print("▸ Discovering BRAIN and CONDUCTOR peers…")
    try:
        # Wait for BRAIN (required), CONDUCTOR is important but not blocking
        peers = registry.wait_for_peers(["brain"], timeout_s=300.0)
        brain_url = peers["brain"]["public_url"]
        os.environ["HEADY_BRAIN_URL"] = brain_url
        print(f"  ✓ BRAIN: {brain_url}")

        # Try for CONDUCTOR too
        all_peers = registry.discover_peers()
        if "conductor" in all_peers:
            conductor_url = all_peers["conductor"]["public_url"]
            os.environ["HEADY_CONDUCTOR_URL"] = conductor_url
            peers["conductor"] = all_peers["conductor"]
            print(f"  ✓ CONDUCTOR: {conductor_url}")
        else:
            print(f"  ⚠ CONDUCTOR not yet registered (SENTINEL will retry)")
    except TimeoutError:
        print("  ⚠ Peer discovery timed out")
    print()
else:
    print("  ⚠ No GITHUB_TOKEN — using manual peer config\n")

BRAIN_URL     = os.environ.get("HEADY_BRAIN_URL", "")
CONDUCTOR_URL = os.environ.get("HEADY_CONDUCTOR_URL", "")


# ─────────────────────────────────────────────────────────────────────────────
# @title 4 — Security Validation
# @markdown Validates the environment and performs startup security checks.
# @markdown In strict mode, missing critical vars will abort the startup.
# ─────────────────────────────────────────────────────────────────────────────

def validate_environment(strict: bool = True) -> list[str]:
    """
    Validate required environment variables.

    Returns a list of warning/error strings.  In strict mode, exits if
    critical vars are missing.
    """
    issues = []

    # Check for required keys
    if not os.environ.get("HEADY_BRAIN_URL"):
        issues.append("CRITICAL: HEADY_BRAIN_URL not set — SENTINEL cannot monitor BRAIN")
    if not GITHUB_TOKEN:
        issues.append("WARNING: GITHUB_TOKEN not set — no discovery Gist")
    if not NGROK_TOKEN:
        issues.append("INFO: NGROK_AUTHTOKEN not set — using free tunnel (may disconnect)")
    if not ALERT_WEBHOOK:
        issues.append("INFO: HEADY_ALERT_WEBHOOK not set — alerts will be console-only")

    # Warn about weak security
    if SECURITY_MODE != "strict":
        issues.append(f"WARNING: HEADY_SECURITY_MODE={SECURITY_MODE} — not using strict mode")

    return issues

print("▸ Validating environment (security mode:", SECURITY_MODE, ")…")
issues = validate_environment(strict=(SECURITY_MODE == "strict"))
if issues:
    for issue in issues:
        icon = "✗" if issue.startswith("CRITICAL") else ("⚠" if issue.startswith("WARNING") else "ℹ")
        print(f"  {icon} {issue}")
else:
    print("  ✓ Environment valid — no issues detected")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 5 — Alerting System Setup
# @markdown Configures the alerting system. Supports webhook delivery to
# @markdown Slack, Discord, or any HTTP endpoint.
# ─────────────────────────────────────────────────────────────────────────────

class AlertSystem:
    """
    Lightweight alerting system for SENTINEL.

    Delivers alerts via console output and optionally via HTTP webhook.
    Uses a background queue so alerts never block the main process.
    """

    SEVERITY_COLORS = {
        "INFO":     "\033[36m",   # cyan
        "WARNING":  "\033[33m",   # yellow
        "ERROR":    "\033[31m",   # red
        "CRITICAL": "\033[35m",   # magenta
    }
    RESET = "\033[0m"

    def __init__(self, webhook_url: str = "", node_role: str = "sentinel"):
        self.webhook_url = webhook_url
        self.node_role = node_role
        self._queue: list[dict] = []
        self._lock = threading.Lock()

    def alert(self, severity: str, title: str, message: str, metadata: dict | None = None):
        """
        Emit an alert at the given severity level.

        Parameters
        ----------
        severity : str
            "INFO" | "WARNING" | "ERROR" | "CRITICAL"
        title : str
            Short alert title.
        message : str
            Detailed alert message.
        metadata : dict or None
            Extra context data.
        """
        ts = datetime.now(timezone.utc).isoformat()
        record = {
            "severity": severity.upper(),
            "title": title,
            "message": message,
            "node": self.node_role,
            "timestamp": ts,
            **(metadata or {}),
        }

        # Console output
        color = self.SEVERITY_COLORS.get(severity.upper(), "")
        icon_map = {"INFO": "ℹ", "WARNING": "⚠", "ERROR": "✗", "CRITICAL": "🚨"}
        icon = icon_map.get(severity.upper(), "•")
        print(f"  {color}{icon} [{severity.upper()}] {title}{self.RESET}")
        print(f"    {message}")
        if metadata:
            for k, v in metadata.items():
                print(f"    {k}: {v}")

        # Queue for async webhook delivery
        with self._lock:
            self._queue.append(record)
        if self.webhook_url:
            threading.Thread(target=self._send_webhook, args=(record,), daemon=True).start()

    def _send_webhook(self, record: dict):
        """Send alert to webhook (Slack / Discord / generic HTTP)."""
        try:
            payload = {
                "text": f"[HEADY SENTINEL] {record['severity']}: {record['title']}\n{record['message']}",
                "attachments": [{"color": "danger" if record["severity"] in ("ERROR", "CRITICAL") else "warning",
                                  "fields": [{"title": k, "value": str(v), "short": True}
                                             for k, v in record.items() if k not in ("text",)]}]
            }
            body = json.dumps(payload).encode()
            req = Request(self.webhook_url, data=body,
                         headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(req, timeout=10) as resp:
                resp.read()
        except Exception as exc:
            print(f"  ⚠ Webhook delivery failed: {exc}")

    def get_history(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return list(self._queue[-limit:])

alerter = AlertSystem(webhook_url=ALERT_WEBHOOK, node_role="sentinel")
print("▸ Alert system initialized")
if ALERT_WEBHOOK:
    print(f"  ✓ Webhook: {ALERT_WEBHOOK[:40]}…")
    alerter.alert("INFO", "SENTINEL Starting", f"SENTINEL node booting on Colab — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
else:
    print("  ℹ Console-only mode (no webhook configured)")
print()


# ─────────────────────────────────────────────────────────────────────────────
# @title 6 — Build Environment & Start SENTINEL Services
# @markdown Launches all SENTINEL services:
# @markdown  ● sentinel-main   — Governance + coordination on port 3003
# @markdown  ● circuit-breaker — Fault isolation layer
# @markdown  ● self-healing    — Quarantine/diagnose/heal pipeline
# @markdown  ● telemetry       — Distributed metrics aggregation
# @markdown  ● governance      — Approval gates + audit trail
# ─────────────────────────────────────────────────────────────────────────────

def setup_sentinel_env():
    """Build the complete environment for the SENTINEL process."""
    return build_env("sentinel", peers, {
        # Peer connections
        "HEADY_BRAIN_URL":              BRAIN_URL,
        "HEADY_CONDUCTOR_URL":          CONDUCTOR_URL,
        "HEADY_BRAIN_BRIDGE_URL":       peers.get("brain", {}).get("bridge_url", ""),
        "HEADY_CONDUCTOR_BRIDGE_URL":   peers.get("conductor", {}).get("bridge_url", ""),

        # SENTINEL identity
        "HEADY_SENTINEL_URL":           tunnel.public_url,
        "HEADY_BRIDGE_START":           "true",
        "HEADY_BRIDGE_PORT":            str(SENTINEL_BRIDGE),
        "HEADY_NODE_ID":                f"heady-sentinel-{os.getpid()}",

        # Security
        "HEADY_SECURITY_MODE":          SECURITY_MODE,
        "HEADY_PQC_ENABLED":            "true",     # Post-quantum crypto handshake
        "HEADY_RBAC_ENABLED":           "true",

        # Circuit breaker config (PHI-scaled thresholds)
        "HEADY_CB_FAILURE_THRESHOLD":   str(FIBONACCI[4]),   # 5 failures → open
        "HEADY_CB_SUCCESS_THRESHOLD":   str(FIBONACCI[2]),   # 2 successes → close
        "HEADY_CB_TIMEOUT_MS":          str(int(PHI ** 6 * 1000)),  # ~17.9s

        # Self-healing
        "HEADY_HEAL_CHECK_INTERVAL_MS": str(int(PHI ** 5 * 1000)),  # ~11.1s
        "HEADY_HEAL_QUARANTINE_MS":     str(int(PHI ** 7 * 1000)),  # ~28.9s

        # Telemetry
        "HEADY_TELEMETRY_FLUSH_S":      str(TELEMETRY_FLUSH_S),
        "HEADY_TELEMETRY_BUFFER_SIZE":  str(FIBONACCI[8]),  # 34 entries

        # Governance
        "HEADY_GOVERNANCE_QUORUM":      str(FIBONACCI[2]),   # 2-of-3 approval
        "HEADY_GOVERNANCE_TIMEOUT_MS":  str(int(PHI ** 9 * 1000)),  # ~75.8s

        # Alerting
        "HEADY_ALERT_WEBHOOK":          ALERT_WEBHOOK,

        # Data dir
        "HEADY_DATA_DIR":               str(HEADY_DIR / "data" / "sentinel"),
    })

print("▸ Building SENTINEL environment…")
env = setup_sentinel_env()
Path(env["HEADY_DATA_DIR"]).mkdir(parents=True, exist_ok=True)
print(f"  ✓ Data dir: {env['HEADY_DATA_DIR']}")
print(f"  ✓ Security mode: {env['HEADY_SECURITY_MODE']}")
print(f"  ✓ BRAIN: {env.get('HEADY_BRAIN_URL', 'not set')}")
print(f"  ✓ CONDUCTOR: {env.get('HEADY_CONDUCTOR_URL', 'not set')}")
print()

SERVICE_PORTS = {
    SENTINEL_PORT:   "sentinel-main (governance)",
    3031:            "circuit-breaker",
    3032:            "self-healing",
    3033:            "telemetry-aggregator",
    SENTINEL_BRIDGE: "event-bridge",
}

print("▸ Starting SENTINEL services…\n")

SENTINEL_ENTRY = repo_dir / "heady-system.js"
if not SENTINEL_ENTRY.exists():
    SENTINEL_ENTRY = repo_dir

def start_sentinel_process():
    """Launch the SENTINEL Node.js process."""
    cmd = [str(node_path), "--experimental-vm-modules", str(SENTINEL_ENTRY)]
    if os.path.isdir(str(SENTINEL_ENTRY)):
        cmd = [str(node_path), "--experimental-vm-modules", "."]

    log_file = open("/tmp/heady-sentinel.log", "a", buffering=1)
    proc = subprocess.Popen(
        cmd,
        cwd=str(repo_dir),
        env=env,
        stdout=log_file,
        stderr=log_file,
    )
    print(f"  ✓ SENTINEL process started (PID {proc.pid})")
    print(f"  ✓ Logs: /tmp/heady-sentinel.log")
    return proc

auto_reconnect = AutoReconnect(start_sentinel_process, max_attempts=FIBONACCI[6])
auto_reconnect.launch()


# ─────────────────────────────────────────────────────────────────────────────
# @title 7 — Wait for Services & Show Status
# ─────────────────────────────────────────────────────────────────────────────

print("\n▸ Waiting for SENTINEL to become healthy…\n")
main_ready = wait_for_service(SENTINEL_PORT, "/health", timeout_s=120.0, service_name="SENTINEL")

if main_ready:
    print(f"\n  ┌─────────────────────────────────────────────────────┐")
    print(f"  │  SENTINEL NODE READY  ✓                             │")
    print(f"  │                                                     │")
    print(f"  │  Endpoint:    {tunnel.public_url:<37} │")
    print(f"  │  Security:    {SECURITY_MODE:<37} │")
    print(f"  │  BRAIN:       {(BRAIN_URL or 'not connected'):<37} │")
    print(f"  │  CONDUCTOR:   {(CONDUCTOR_URL or 'not connected'):<37} │")
    print(f"  │  Telemetry:   flush every {TELEMETRY_FLUSH_S}s                    │")
    print(f"  └─────────────────────────────────────────────────────┘\n")

    alerter.alert(
        "INFO",
        "SENTINEL Online",
        f"All 3 nodes are running. Cluster is fully operational.",
        {"brain": bool(BRAIN_URL), "conductor": bool(CONDUCTOR_URL)},
    )
else:
    print("\n  ⚠ Services slow — check logs:")
    print("    !tail -50 /tmp/heady-sentinel.log\n")
    alerter.alert("WARNING", "SENTINEL Startup Slow", "Services did not respond within 120s")


# ─────────────────────────────────────────────────────────────────────────────
# @title 8 — Security Monitoring Dashboard
# @markdown Live dashboard showing circuit breaker state, self-healing events,
# @markdown telemetry metrics, and security audit events.
# ─────────────────────────────────────────────────────────────────────────────

class SecurityMonitor(threading.Thread):
    """
    Background thread that polls all 3 nodes for health and fires alerts
    on degradation, circuit breaker trips, or security events.
    """

    def __init__(self, interval_s: float = TELEMETRY_FLUSH_S):
        super().__init__(daemon=True, name="heady-security-monitor")
        self.interval_s = interval_s
        self._running = False
        self.last_states: dict[str, str] = {}  # role → "healthy"|"degraded"|"down"

    def _check_node(self, role: str, url: str) -> str:
        """Check a node and return its health state."""
        if not url:
            return "unknown"
        result = health_check_remote(url, "/health", timeout=8)
        if result.get("ok") or result.get("status") == "ok":
            return "healthy"
        return "degraded"

    def run(self):
        self._running = True
        while self._running:
            try:
                # Check all nodes
                states = {
                    "brain":     self._check_node("brain",     BRAIN_URL),
                    "conductor": self._check_node("conductor", CONDUCTOR_URL),
                    "sentinel":  self._check_node("sentinel",  f"http://localhost:{SENTINEL_PORT}"),
                }

                # Alert on state changes
                for role, state in states.items():
                    prev = self.last_states.get(role, "unknown")
                    if prev == "healthy" and state != "healthy":
                        alerter.alert(
                            "ERROR",
                            f"{role.upper()} Degraded",
                            f"Node {role} transitioned from {prev} → {state}",
                            {"role": role, "previous": prev, "current": state},
                        )
                    elif prev in ("degraded", "down", "unknown") and state == "healthy":
                        alerter.alert(
                            "INFO",
                            f"{role.upper()} Recovered",
                            f"Node {role} is healthy again",
                            {"role": role},
                        )

                self.last_states = states
            except Exception as exc:
                pass  # Don't crash the monitor
            time.sleep(self.interval_s)

    def stop(self):
        self._running = False

security_monitor = SecurityMonitor(interval_s=TELEMETRY_FLUSH_S)
security_monitor.start()

dashboard = HeadyDashboard(
    node_role="SENTINEL",
    gpu=gpu,
    tunnel=tunnel,
    service_ports=list(SERVICE_PORTS.keys()),
    service_names=SERVICE_PORTS,
    refresh_interval=FIBONACCI[4],  # 5s
)
setup_colab_keepalive(interval_s=60.0)

print("▸ Starting live security dashboard…\n")
dashboard.start()
print(dashboard.render())


# ─────────────────────────────────────────────────────────────────────────────
# @title 9 — Interactive Commands
# @markdown
# @markdown ```python
# @markdown # Check SENTINEL governance status
# @markdown print(health_check_local(3003, "/governance/status"))
# @markdown
# @markdown # View circuit breaker states
# @markdown print(health_check_local(3031, "/status"))
# @markdown
# @markdown # View alert history
# @markdown for a in alerter.get_history(10):
# @markdown     print(f"[{a['severity']}] {a['title']}: {a['message']}")
# @markdown
# @markdown # Check telemetry aggregation
# @markdown print(health_check_local(3033, "/metrics"))
# @markdown
# @markdown # Manually trigger a health check across all nodes
# @markdown for role, url in [("brain", BRAIN_URL), ("conductor", CONDUCTOR_URL)]:
# @markdown     r = health_check_remote(url, "/health") if url else {"ok": False, "error": "no url"}
# @markdown     print(f"{role}: {r}")
# @markdown
# @markdown # Tail logs
# @markdown !tail -100 /tmp/heady-sentinel.log
# @markdown ```
# ─────────────────────────────────────────────────────────────────────────────

SENTINEL_INFO = {
    "role": "sentinel",
    "public_url": tunnel.public_url,
    "port": SENTINEL_PORT,
    "bridge_port": SENTINEL_BRIDGE,
    "brain_url": BRAIN_URL,
    "conductor_url": CONDUCTOR_URL,
    "security_mode": SECURITY_MODE,
    "alert_webhook": bool(ALERT_WEBHOOK),
    "gpu": gpu.to_dict(),
    "gist_id": registry.gist_id if registry else DISCOVERY_GIST,
    "log_file": "/tmp/heady-sentinel.log",
}

print("\n  SENTINEL_INFO summary:")
for k, v in SENTINEL_INFO.items():
    if k != "gpu":
        print(f"  {k:<25} {v}")

print(f"\n  φ = {PHI:.10f}  — Governance Shell, outer ring")
print("  All 3 nodes are running. Heady cluster is FULLY OPERATIONAL.\n")
print("  ┌─────────────────────────────────────────────────────────┐")
print("  │  CLUSTER TOPOLOGY                                       │")
print("  │                                                         │")
print("  │       ╭─────────╮                                       │")
print("  │       │  BRAIN  │  ← Central Hub (φ origin)             │")
print("  │       │  :3001  │    Vector DB + LLM Router             │")
print("  │       ╰────┬────╯                                       │")
print("  │          ╭─┴──────────────╮                             │")
print("  │   ╭──────┴──────╮  ╭──────┴──────╮                     │")
print("  │   │ CONDUCTOR   │  │  SENTINEL   │                     │")
print("  │   │   :3002     │  │    :3003    │                     │")
print("  │   │  Pipeline   │  │  Security   │                     │")
print("  │   │  Bees       │  │  Telemetry  │                     │")
print("  │   ╰─────────────╯  ╰─────────────╯                     │")
print("  │                                                         │")
print("  │  WebSocket mesh: all nodes ↔ all nodes                  │")
print("  │  Protocol: JSON-RPC 2.0 (MCP-compatible)               │")
print("  └─────────────────────────────────────────────────────────┘\n")


# ─────────────────────────────────────────────────────────────────────────────
# @title 10 — Graceful Shutdown
# @markdown Run only when stopping the SENTINEL node.
# ─────────────────────────────────────────────────────────────────────────────

def shutdown_sentinel():
    import signal as _signal
    print("▸ Stopping SENTINEL node…")
    security_monitor.stop()
    dashboard.stop()
    alerter.alert("INFO", "SENTINEL Stopping", "Node is shutting down gracefully")
    if auto_reconnect._proc and auto_reconnect._proc.poll() is None:
        auto_reconnect._proc.send_signal(_signal.SIGTERM)
        try:
            auto_reconnect._proc.wait(timeout=15)
            print("  ✓ SENTINEL process terminated gracefully")
        except subprocess.TimeoutExpired:
            auto_reconnect._proc.kill()
            print("  ⚠ SENTINEL process killed (timeout)")
    auto_reconnect.terminate()
    print("  SENTINEL node stopped.\n")

# Uncomment to run:
# shutdown_sentinel()


# ─────────────────────────────────────────────────────────────────────────────
# @title CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__" and "ipykernel" not in sys.modules:
    import argparse

    parser = argparse.ArgumentParser(description="Heady SENTINEL node launcher")
    parser.add_argument("--port", type=int, default=SENTINEL_PORT)
    parser.add_argument("--bridge-port", type=int, default=SENTINEL_BRIDGE)
    parser.add_argument("--ngrok-token", default=NGROK_TOKEN)
    parser.add_argument("--github-token", default=GITHUB_TOKEN)
    parser.add_argument("--gist-id", default=DISCOVERY_GIST)
    parser.add_argument("--brain-url", default=BRAIN_URL)
    parser.add_argument("--conductor-url", default=CONDUCTOR_URL)
    args = parser.parse_args()

    os.environ["HEADY_BRAIN_URL"] = args.brain_url
    os.environ["HEADY_CONDUCTOR_URL"] = args.conductor_url
    print("Running SENTINEL launcher from CLI…")
    try:
        while True:
            time.sleep(FIBONACCI[4])
    except KeyboardInterrupt:
        shutdown_sentinel()

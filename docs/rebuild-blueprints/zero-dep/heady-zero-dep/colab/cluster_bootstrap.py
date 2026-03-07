"""
cluster_bootstrap.py
====================
Shared bootstrap utilities for the Heady Zero-Dep 3-node Colab cluster.

Provides:
  - Node.js 22 installation via nvm
  - Tunnel setup (ngrok / localtunnel fallback)
  - Inter-node discovery protocol (ngrok URLs shared via GitHub Gist)
  - Health check utilities
  - GPU probe and resource reporting
  - Common environment setup helpers
  - Animated progress dashboard

Usage (in each node notebook):
  from cluster_bootstrap import (
      install_nodejs,
      setup_tunnel,
      register_node,
      wait_for_peers,
      probe_gpu,
      build_env,
      HeadyDashboard,
  )

Sacred Geometry:
  PHI = 1.618...  governs all timing, backoff, and retry constants.
"""

# @title Heady Cluster Bootstrap — Shared Utilities
# @markdown This cell must be executed **first** in every node notebook.
# @markdown It installs Node.js 22, sets up tunnels, and discovers peers.

import os
import sys
import json
import time
import signal
import shutil
import hashlib
import logging
import platform
import textwrap
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

# ─── Sacred Geometry Constants ────────────────────────────────────────────────

PHI = 1.6180339887498948482
"""Golden ratio φ — scales all timing, backoff, and retry windows."""

FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]
"""First 15 Fibonacci numbers used throughout the system."""

NVM_VERSION = "0.40.1"
NODE_VERSION = "22"
REPO_URL = "https://github.com/headyconnection/heady-zero-dep.git"
HEADY_DIR = Path("/root/heady-zero-dep")

# PHI^3 ≈ 4.24 s  →  base health-check interval (round to 4 s)
HEALTH_INTERVAL_S = 4
# PHI^5 ≈ 11.1 s  →  peer discovery poll interval
DISCOVERY_INTERVAL_S = 11

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("heady.bootstrap")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _phi_backoff(attempt: int, base_ms: float = 1000.0) -> float:
    """PHI-scaled exponential backoff.  Returns wait time in seconds."""
    return (PHI ** attempt) * base_ms / 1000.0


def _run(cmd: str, *, env=None, check=True, capture=False, shell=True) -> subprocess.CompletedProcess:
    """Run a shell command with optional output capture."""
    merged_env = {**os.environ, **(env or {})}
    return subprocess.run(
        cmd,
        shell=shell,
        check=check,
        capture_output=capture,
        text=True,
        env=merged_env,
    )


def _http_get(url: str, headers: dict | None = None, timeout: int = 15) -> bytes:
    """Minimal HTTP GET with retry (PHI backoff, up to Fibonacci[5]=8 attempts)."""
    req = Request(url, headers=headers or {})
    for attempt in range(FIBONACCI[5]):  # 8 attempts
        try:
            with urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (URLError, HTTPError) as exc:
            if attempt == FIBONACCI[5] - 1:
                raise
            wait = _phi_backoff(attempt)
            log.warning("HTTP GET %s failed (%s) — retry in %.1fs", url, exc, wait)
            time.sleep(wait)
    return b""  # unreachable


def _http_post(url: str, data: dict, headers: dict | None = None, timeout: int = 15) -> bytes:
    """Minimal HTTP POST (JSON body)."""
    body = json.dumps(data).encode()
    base_headers = {"Content-Type": "application/json", **(headers or {})}
    req = Request(url, data=body, headers=base_headers, method="POST")
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ─── 1. Node.js Installation ──────────────────────────────────────────────────

def install_nodejs(node_version: str = NODE_VERSION, nvm_version: str = NVM_VERSION) -> Path:
    """
    Install Node.js via nvm and return the path to the `node` binary.

    Parameters
    ----------
    node_version : str
        Node.js major version (default: "22").
    nvm_version : str
        nvm release to install (default: "0.40.1").

    Returns
    -------
    Path
        Absolute path to the installed `node` binary.
    """
    nvm_dir = Path.home() / ".nvm"

    # ── Step 1: install nvm if not present ──────────────────────────────────
    if not (nvm_dir / "nvm.sh").exists():
        log.info("Installing nvm %s …", nvm_version)
        install_script_url = (
            f"https://raw.githubusercontent.com/nvm-sh/nvm/v{nvm_version}/install.sh"
        )
        script = _http_get(install_script_url).decode()
        tmp = Path("/tmp/nvm-install.sh")
        tmp.write_text(script)
        _run(f"bash {tmp}", env={"NVM_DIR": str(nvm_dir)})
        log.info("nvm installed to %s", nvm_dir)
    else:
        log.info("nvm already present at %s", nvm_dir)

    # ── Step 2: install Node.js ──────────────────────────────────────────────
    nvm_sh = str(nvm_dir / "nvm.sh")
    result = _run(
        f'source "{nvm_sh}" && nvm install {node_version} && nvm use {node_version} && which node',
        capture=True,
    )
    node_path = Path(result.stdout.strip().splitlines()[-1])

    # ── Step 3: verify ───────────────────────────────────────────────────────
    version_result = _run(f'"{node_path}" --version', capture=True)
    installed_version = version_result.stdout.strip()
    log.info("Node.js %s ready at %s", installed_version, node_path)

    # Persist into the current process PATH so subprocesses can find `node`
    node_bin_dir = str(node_path.parent)
    os.environ["PATH"] = node_bin_dir + ":" + os.environ.get("PATH", "")
    os.environ["NODE_PATH"] = node_bin_dir
    os.environ["NVM_DIR"] = str(nvm_dir)

    return node_path


# ─── 2. Repository Setup ──────────────────────────────────────────────────────

def setup_repo(
    repo_url: str = REPO_URL,
    target_dir: Path = HEADY_DIR,
    branch: str = "main",
) -> Path:
    """
    Clone or update the heady-zero-dep repository.

    If `target_dir` already contains a git repo it is pulled instead of
    cloned.  If neither git nor the target exists a fresh clone is made.

    Parameters
    ----------
    repo_url : str
        HTTPS URL of the repository.
    target_dir : Path
        Local destination path.
    branch : str
        Git branch to check out.

    Returns
    -------
    Path
        Absolute path to the repository root.
    """
    target_dir = Path(target_dir)

    if (target_dir / ".git").exists():
        log.info("Repo found — pulling latest changes…")
        _run(f"git -C {target_dir} fetch origin {branch} && git -C {target_dir} reset --hard origin/{branch}")
    else:
        log.info("Cloning %s → %s …", repo_url, target_dir)
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        _run(f"git clone --branch {branch} --depth 1 {repo_url} {target_dir}")

    log.info("Repo ready at %s", target_dir)
    return target_dir


# ─── 3. GPU Probe ─────────────────────────────────────────────────────────────

class GPUInfo:
    """Holds GPU metadata detected at runtime."""

    def __init__(self):
        self.available: bool = False
        self.name: str = "none"
        self.memory_mb: int = 0
        self.cuda_version: str = "n/a"
        self.driver_version: str = "n/a"
        self.device_count: int = 0
        self.utilization_pct: int = 0
        self.detected_tier: str = "cpu"  # "cpu" | "t4" | "v100" | "a100"

    def __repr__(self):
        return (
            f"<GPUInfo name={self.name!r} mem={self.memory_mb}MB "
            f"cuda={self.cuda_version} tier={self.detected_tier}>"
        )

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def probe_gpu() -> GPUInfo:
    """
    Detect GPU, CUDA version, and infer the hardware tier.

    Returns a :class:`GPUInfo` object regardless of whether a GPU is
    present.  Uses ``nvidia-smi`` when available; falls back to
    ``/proc/driver/nvidia/gpus`` and ``nvcc --version``.

    Returns
    -------
    GPUInfo
    """
    info = GPUInfo()

    if not shutil.which("nvidia-smi"):
        log.warning("nvidia-smi not found — running in CPU-only mode")
        return info

    try:
        q = ",".join([
            "name",
            "memory.total",
            "driver_version",
            "utilization.gpu",
            "count",
        ])
        r = _run(
            f"nvidia-smi --query-gpu={q} --format=csv,noheader,nounits",
            capture=True,
            check=False,
        )
        if r.returncode == 0 and r.stdout.strip():
            parts = [p.strip() for p in r.stdout.strip().splitlines()[0].split(",")]
            info.available = True
            info.name = parts[0]
            info.memory_mb = int(parts[1]) if parts[1].isdigit() else 0
            info.driver_version = parts[2]
            info.utilization_pct = int(parts[3]) if parts[3].isdigit() else 0
            info.device_count = int(parts[4]) if parts[4].isdigit() else 1

            # Infer tier from name
            name_lower = info.name.lower()
            if "a100" in name_lower:
                info.detected_tier = "a100"
            elif "v100" in name_lower:
                info.detected_tier = "v100"
            elif "t4" in name_lower:
                info.detected_tier = "t4"
            else:
                info.detected_tier = "gpu_unknown"

        # CUDA version from nvcc
        nvcc = _run("nvcc --version", capture=True, check=False)
        if nvcc.returncode == 0:
            for line in nvcc.stdout.splitlines():
                if "release" in line.lower():
                    info.cuda_version = line.strip().split("release")[-1].strip().split(",")[0].strip()
                    break

        log.info("GPU detected: %s", info)
    except Exception as exc:
        log.warning("GPU probe failed: %s", exc)

    return info


# ─── 4. Tunnel Setup ──────────────────────────────────────────────────────────

class TunnelInfo:
    """Metadata for an established tunnel."""

    def __init__(self, provider: str, public_url: str, local_port: int):
        self.provider = provider
        self.public_url = public_url
        self.local_port = local_port
        self.established_at = datetime.now(timezone.utc).isoformat()

    def __repr__(self):
        return f"<TunnelInfo {self.provider} {self.public_url} → localhost:{self.local_port}>"

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "public_url": self.public_url,
            "local_port": self.local_port,
            "established_at": self.established_at,
        }


def _start_ngrok(local_port: int, auth_token: str | None = None) -> TunnelInfo | None:
    """Try to start an ngrok tunnel on `local_port`."""
    try:
        # Install ngrok if missing
        if not shutil.which("ngrok"):
            log.info("Installing ngrok…")
            _run(
                "curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | "
                "tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && "
                "echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | "
                "tee /etc/apt/sources.list.d/ngrok.list && "
                "apt-get install -y ngrok 2>/dev/null",
                check=False,
            )
            if not shutil.which("ngrok"):
                # Fallback: direct binary download
                _run(
                    "curl -Lo /tmp/ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz && "
                    "tar xzf /tmp/ngrok.tgz -C /usr/local/bin",
                    check=False,
                )

        if auth_token:
            _run(f"ngrok config add-authtoken {auth_token}", check=False)

        # Start ngrok in background
        proc = subprocess.Popen(
            ["ngrok", "http", str(local_port), "--log=stdout", "--log-level=info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait up to PHI^5 seconds for the API to be ready
        deadline = time.time() + PHI ** 5
        while time.time() < deadline:
            time.sleep(1)
            try:
                raw = _http_get("http://localhost:4040/api/tunnels", timeout=3)
                data = json.loads(raw)
                tunnels = data.get("tunnels", [])
                if tunnels:
                    url = tunnels[0]["public_url"]
                    if url.startswith("https://"):
                        log.info("ngrok tunnel: %s → localhost:%d", url, local_port)
                        return TunnelInfo("ngrok", url, local_port)
            except Exception:
                pass

        proc.terminate()
        return None
    except Exception as exc:
        log.warning("ngrok setup failed: %s", exc)
        return None


def _start_localtunnel(local_port: int) -> TunnelInfo | None:
    """Fallback: start a localtunnel using npx."""
    try:
        log.info("Starting localtunnel on port %d…", local_port)
        proc = subprocess.Popen(
            ["npx", "localtunnel", "--port", str(local_port)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        deadline = time.time() + PHI ** 5
        while time.time() < deadline:
            line = proc.stdout.readline()
            if "your url is:" in line.lower():
                url = line.split("your url is:")[-1].strip()
                log.info("localtunnel URL: %s", url)
                return TunnelInfo("localtunnel", url, local_port)
        return None
    except Exception as exc:
        log.warning("localtunnel setup failed: %s", exc)
        return None


def setup_tunnel(
    local_port: int,
    ngrok_token: str | None = None,
    prefer: str = "ngrok",
) -> TunnelInfo | None:
    """
    Establish a public tunnel to `local_port`.

    Tries ngrok first (if `prefer="ngrok"`) then falls back to
    localtunnel if ngrok fails or is unavailable.

    Parameters
    ----------
    local_port : int
        The local port to expose publicly.
    ngrok_token : str or None
        ngrok auth token for authenticated tunnels (higher limits).
    prefer : str
        "ngrok" (default) or "localtunnel".

    Returns
    -------
    TunnelInfo or None
    """
    if prefer == "localtunnel":
        return _start_localtunnel(local_port) or _start_ngrok(local_port, ngrok_token)

    return _start_ngrok(local_port, ngrok_token) or _start_localtunnel(local_port)


# ─── 5. Inter-Node Discovery Protocol ────────────────────────────────────────

class NodeRegistry:
    """
    Lightweight inter-node discovery using a GitHub Gist as a shared
    key-value store.

    Each node writes its tunnel URL + metadata to a Gist file named
    ``<node_role>.json``.  Peers poll the same Gist to discover URLs.

    The Gist ID is shared via the ``HEADY_DISCOVERY_GIST`` environment
    variable (or passed directly to the constructor).
    """

    GIST_API = "https://api.github.com/gists"

    def __init__(self, node_role: str, github_token: str | None = None, gist_id: str | None = None):
        self.node_role = node_role.lower()
        self._token = github_token or os.environ.get("GITHUB_TOKEN", "")
        self._gist_id = gist_id or os.environ.get("HEADY_DISCOVERY_GIST", "")
        self._peers: dict[str, dict] = {}

    def _auth_headers(self) -> dict:
        h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h

    # ── Gist CRUD ─────────────────────────────────────────────────────────────

    def _create_gist(self, payload: dict) -> str:
        """Create a new discovery Gist and return its ID."""
        data = {
            "description": "Heady Zero-Dep Cluster Discovery",
            "public": False,
            "files": {
                f"{self.node_role}.json": {"content": json.dumps(payload, indent=2)}
            },
        }
        raw = _http_post(self.GIST_API, data, self._auth_headers())
        gist = json.loads(raw)
        self._gist_id = gist["id"]
        log.info("Created discovery Gist: %s", self._gist_id)
        return self._gist_id

    def _update_gist(self, payload: dict) -> None:
        """Update our node's entry in an existing Gist."""
        url = f"{self.GIST_API}/{self._gist_id}"
        data = {
            "files": {
                f"{self.node_role}.json": {"content": json.dumps(payload, indent=2)}
            }
        }
        body = json.dumps(data).encode()
        req = Request(url, data=body, headers=self._auth_headers(), method="PATCH")
        req.add_header("Content-Type", "application/json")
        with urlopen(req, timeout=15) as resp:
            resp.read()

    def _read_gist(self) -> dict:
        """Return all files in the discovery Gist."""
        if not self._gist_id:
            return {}
        url = f"{self.GIST_API}/{self._gist_id}"
        raw = _http_get(url, self._auth_headers())
        gist = json.loads(raw)
        result = {}
        for fname, fdata in gist.get("files", {}).items():
            try:
                role = fname.replace(".json", "")
                result[role] = json.loads(fdata.get("content", "{}"))
            except Exception:
                pass
        return result

    # ── Public API ────────────────────────────────────────────────────────────

    def register_node(self, tunnel: TunnelInfo, gpu: GPUInfo, extra: dict | None = None) -> None:
        """
        Write this node's registration record to the discovery Gist.

        Parameters
        ----------
        tunnel : TunnelInfo
            Public tunnel established for this node.
        gpu : GPUInfo
            GPU hardware detected on this node.
        extra : dict or None
            Any additional metadata to include.
        """
        payload = {
            "role": self.node_role,
            "public_url": tunnel.public_url,
            "tunnel_provider": tunnel.provider,
            "local_port": tunnel.local_port,
            "gpu": gpu.to_dict(),
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "pid": os.getpid(),
            **(extra or {}),
        }
        if not self._gist_id:
            self._create_gist(payload)
        else:
            self._update_gist(payload)
        log.info("Node '%s' registered in discovery Gist %s", self.node_role, self._gist_id)

    def discover_peers(self) -> dict[str, dict]:
        """
        Read all peer registrations from the discovery Gist.

        Returns
        -------
        dict
            Mapping of role → registration payload for all nodes except self.
        """
        all_nodes = self._read_gist()
        self._peers = {k: v for k, v in all_nodes.items() if k != self.node_role}
        return self._peers

    def wait_for_peers(
        self,
        expected_roles: list[str],
        timeout_s: float = 300.0,
    ) -> dict[str, dict]:
        """
        Block until all `expected_roles` are registered (or timeout).

        Parameters
        ----------
        expected_roles : list[str]
            Roles to wait for (e.g. ["brain", "conductor"]).
        timeout_s : float
            Maximum seconds to wait (default 300 = 5 minutes).

        Returns
        -------
        dict
            Peer registry (role → data).

        Raises
        ------
        TimeoutError
            If not all peers appear within `timeout_s` seconds.
        """
        deadline = time.time() + timeout_s
        attempt = 0
        while time.time() < deadline:
            peers = self.discover_peers()
            missing = [r for r in expected_roles if r not in peers]
            if not missing:
                log.info("All peers discovered: %s", list(peers.keys()))
                return peers
            wait = min(_phi_backoff(attempt, base_ms=2000), DISCOVERY_INTERVAL_S)
            log.info("Waiting for peers %s (retry in %.1fs)…", missing, wait)
            time.sleep(wait)
            attempt += 1
        raise TimeoutError(
            f"Peer discovery timed out after {timeout_s}s. "
            f"Still missing: {[r for r in expected_roles if r not in self._peers]}"
        )

    @property
    def gist_id(self) -> str:
        return self._gist_id


# ── Convenience top-level functions ───────────────────────────────────────────

def register_node(
    node_role: str,
    tunnel: TunnelInfo,
    gpu: GPUInfo,
    github_token: str | None = None,
    gist_id: str | None = None,
    extra: dict | None = None,
) -> NodeRegistry:
    """
    Register this node in the discovery Gist.  Returns the :class:`NodeRegistry`.
    """
    registry = NodeRegistry(node_role, github_token, gist_id)
    registry.register_node(tunnel, gpu, extra)
    return registry


def wait_for_peers(
    registry: NodeRegistry,
    expected_roles: list[str],
    timeout_s: float = 300.0,
) -> dict[str, dict]:
    """Thin wrapper around :meth:`NodeRegistry.wait_for_peers`."""
    return registry.wait_for_peers(expected_roles, timeout_s)


# ─── 6. Health Check Utilities ───────────────────────────────────────────────

def health_check_local(port: int, path: str = "/health", timeout: int = 5) -> dict:
    """
    HTTP GET health check against a local port.

    Parameters
    ----------
    port : int
        Local TCP port to check.
    path : str
        Health endpoint path.
    timeout : int
        Request timeout in seconds.

    Returns
    -------
    dict
        Parsed JSON response, or ``{"ok": False, "error": "..."}`` on failure.
    """
    url = f"http://localhost:{port}{path}"
    try:
        raw = _http_get(url, timeout=timeout)
        return json.loads(raw)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "port": port}


def health_check_remote(public_url: str, path: str = "/health", timeout: int = 10) -> dict:
    """Like :func:`health_check_local` but against a public tunnel URL."""
    url = public_url.rstrip("/") + path
    try:
        raw = _http_get(url, timeout=timeout)
        return json.loads(raw)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


def wait_for_service(
    port: int,
    path: str = "/health",
    timeout_s: float = 120.0,
    service_name: str = "service",
) -> bool:
    """
    Poll a local HTTP service until it responds OK or timeout.

    Returns True if service came up, False on timeout.
    """
    deadline = time.time() + timeout_s
    attempt = 0
    while time.time() < deadline:
        result = health_check_local(port, path)
        if result.get("ok") or result.get("status") == "ok":
            log.info("%s is healthy on port %d ✓", service_name, port)
            return True
        wait = min(_phi_backoff(attempt, base_ms=500), 8.0)
        log.info("Waiting for %s on port %d (%.1fs)…", service_name, port, wait)
        time.sleep(wait)
        attempt += 1
    log.error("%s did not start within %.0fs", service_name, timeout_s)
    return False


# ─── 7. Environment Builder ──────────────────────────────────────────────────

def build_env(
    node_role: str,
    peers: dict[str, dict] | None = None,
    overrides: dict | None = None,
) -> dict:
    """
    Construct the environment variable dict for a Heady node process.

    Reads from the current ``os.environ`` and merges peer URLs, node
    role, and any caller-supplied overrides.

    Parameters
    ----------
    node_role : str
        This node's role: "brain", "conductor", or "sentinel".
    peers : dict or None
        Peer registration data returned by :meth:`NodeRegistry.discover_peers`.
    overrides : dict or None
        Additional env vars to set (highest priority).

    Returns
    -------
    dict
        Complete environment dict ready for ``subprocess.Popen(env=...)``.
    """
    port_map = {"brain": 3001, "conductor": 3002, "sentinel": 3003}
    bridge_map = {"brain": 9101, "conductor": 9102, "sentinel": 9103}

    env = {**os.environ}

    # Core identity
    env["HEADY_NODE_ROLE"] = node_role.upper()
    env["HEADY_PORT"] = str(port_map.get(node_role, 3000))
    env["HEADY_BRIDGE_PORT"] = str(bridge_map.get(node_role, 9100))
    env["HEADY_DATA_DIR"] = str(HEADY_DIR / "data" / node_role)
    env["NODE_ENV"] = env.get("NODE_ENV", "production")
    env["NODE_OPTIONS"] = "--experimental-vm-modules"

    # Peer URLs
    if peers:
        for role, data in peers.items():
            url = data.get("public_url", "")
            env[f"HEADY_{role.upper()}_URL"] = url

    # Sacred Geometry
    env["HEADY_PHI"] = str(PHI)

    # Caller overrides (highest priority)
    if overrides:
        env.update(overrides)

    return env


# ─── 8. Dashboard ────────────────────────────────────────────────────────────

class HeadyDashboard:
    """
    Live terminal dashboard for Colab notebooks.

    Displays GPU stats, service health, and tunnel info using ANSI
    escape codes inside a Colab output cell.  Refreshes every
    ``HEALTH_INTERVAL_S`` seconds in a background thread.

    Usage
    -----
    >>> dash = HeadyDashboard("BRAIN", gpu_info, tunnel_info, service_ports=[3001])
    >>> dash.start()   # launches background refresh thread
    >>> ...            # do other work
    >>> dash.stop()
    """

    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    MAGENTA = "\033[35m"
    BLUE = "\033[34m"

    ROLE_COLORS = {
        "BRAIN": "\033[35m",      # magenta
        "CONDUCTOR": "\033[34m",  # blue
        "SENTINEL": "\033[32m",   # green
    }

    def __init__(
        self,
        node_role: str,
        gpu: GPUInfo,
        tunnel: TunnelInfo | None = None,
        service_ports: list[int] | None = None,
        service_names: dict[int, str] | None = None,
        refresh_interval: float = HEALTH_INTERVAL_S,
    ):
        self.node_role = node_role.upper()
        self.gpu = gpu
        self.tunnel = tunnel
        self.service_ports = service_ports or []
        self.service_names = service_names or {}
        self.refresh_interval = refresh_interval
        self._running = False
        self._thread: threading.Thread | None = None
        self._start_time = time.time()

    def _color(self, text: str, color: str) -> str:
        return f"{color}{text}{self.RESET}"

    def _status_icon(self, ok: bool) -> str:
        return self._color("●", self.GREEN if ok else self.RED)

    def _uptime_str(self) -> str:
        elapsed = int(time.time() - self._start_time)
        h, rem = divmod(elapsed, 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    def _gpu_bar(self, pct: int, width: int = 20) -> str:
        filled = int(width * pct / 100)
        bar = "█" * filled + "░" * (width - filled)
        color = self.GREEN if pct < 70 else (self.YELLOW if pct < 90 else self.RED)
        return self._color(bar, color)

    def render(self) -> str:
        """Build and return the dashboard string."""
        role_color = self.ROLE_COLORS.get(self.node_role, self.CYAN)
        lines = []

        # Header
        lines.append("")
        lines.append(self._color(f"  ╔══════════════════════════════════════════╗", role_color))
        lines.append(self._color(f"  ║   HEADY  ✦  {self.node_role:<28} ║", role_color))
        lines.append(self._color(f"  ╚══════════════════════════════════════════╝", role_color))
        lines.append(f"  Uptime: {self._color(self._uptime_str(), self.CYAN)}  │  "
                     f"PID: {os.getpid()}  │  "
                     f"Node.js: {self._color(self._node_version(), self.GREEN)}")
        lines.append("")

        # GPU
        if self.gpu.available:
            util = self.gpu.utilization_pct
            lines.append(f"  {self._color('GPU', self.BOLD)} {self.gpu.name}  "
                         f"({self.gpu.memory_mb} MB)  CUDA {self.gpu.cuda_version}")
            lines.append(f"  Util  {self._gpu_bar(util)} {util:3d}%")
        else:
            lines.append(f"  {self._color('GPU', self.BOLD)} {self._color('not available — CPU mode', self.YELLOW)}")
        lines.append("")

        # Tunnel
        if self.tunnel:
            lines.append(f"  {self._color('Tunnel', self.BOLD)}  {self._color(self.tunnel.public_url, self.CYAN)}")
            lines.append(f"  Provider  {self.tunnel.provider}  │  Local port  {self.tunnel.local_port}")
        else:
            lines.append(f"  {self._color('Tunnel', self.BOLD)}  {self._color('not established', self.YELLOW)}")
        lines.append("")

        # Services
        lines.append(f"  {self._color('Services', self.BOLD)}")
        for port in self.service_ports:
            result = health_check_local(port)
            ok = result.get("ok") or result.get("status") == "ok"
            name = self.service_names.get(port, f":{port}")
            icon = self._status_icon(ok)
            status_text = self._color("healthy", self.GREEN) if ok else self._color("down", self.RED)
            lines.append(f"  {icon}  {name:<30} {status_text}")
        lines.append("")

        # Sacred Geometry footer
        lines.append(f"  {self._color('φ = 1.618…', self.MAGENTA)}  "
                     f"Sacred Geometry  │  "
                     f"{datetime.now().strftime('%H:%M:%S')}")
        lines.append(self._color("  ──────────────────────────────────────────────", role_color))

        return "\n".join(lines)

    def _node_version(self) -> str:
        try:
            r = _run("node --version", capture=True, check=False)
            return r.stdout.strip()
        except Exception:
            return "unknown"

    def _refresh_loop(self):
        while self._running:
            try:
                # In Colab, clear_output + print gives a live-updating cell
                try:
                    from IPython.display import clear_output
                    clear_output(wait=True)
                except ImportError:
                    print("\033[2J\033[H", end="")
                print(self.render())
            except Exception:
                pass
            time.sleep(self.refresh_interval)

    def start(self):
        """Start the background refresh thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._refresh_loop, daemon=True, name="heady-dashboard")
        self._thread.start()
        log.info("Dashboard started for %s", self.node_role)

    def stop(self):
        """Stop the dashboard thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        log.info("Dashboard stopped")


# ─── 9. Auto-reconnect ────────────────────────────────────────────────────────

def setup_colab_keepalive(interval_s: float = 60.0):
    """
    Prevent Colab from disconnecting due to inactivity.

    Spawns a daemon thread that sends a harmless syscall every
    `interval_s` seconds to keep the runtime alive.

    Parameters
    ----------
    interval_s : float
        Keepalive interval in seconds (default: 60).
    """
    def _keepalive():
        while True:
            time.sleep(interval_s)
            try:
                # Touch a temp file — minimal I/O to signal activity
                Path("/tmp/.heady_keepalive").write_text(str(time.time()))
            except Exception:
                pass

    t = threading.Thread(target=_keepalive, daemon=True, name="heady-keepalive")
    t.start()
    log.info("Colab keepalive started (interval=%.0fs)", interval_s)


class AutoReconnect:
    """
    Monitor a Node.js process and restart it on unexpected exit.

    Implements a PHI-scaled exponential backoff between restart attempts
    to avoid thrashing on persistent failures.

    Parameters
    ----------
    start_fn : callable
        Zero-argument callable that launches the Node.js process and
        returns the :class:`subprocess.Popen` instance.
    max_attempts : int
        Maximum restart attempts before giving up (default: Fibonacci[7]=21).
    """

    def __init__(self, start_fn, max_attempts: int = FIBONACCI[7]):
        self.start_fn = start_fn
        self.max_attempts = max_attempts
        self._proc: subprocess.Popen | None = None
        self._attempts = 0
        self._monitor_thread: threading.Thread | None = None

    def launch(self):
        """Start the process and begin monitoring."""
        self._proc = self.start_fn()
        self._attempts = 0
        self._monitor_thread = threading.Thread(
            target=self._monitor, daemon=True, name="heady-autoreconnect"
        )
        self._monitor_thread.start()
        log.info("AutoReconnect: process started (PID %s)", self._proc.pid if self._proc else "?")

    def _monitor(self):
        while True:
            if self._proc is None:
                break
            retcode = self._proc.wait()
            if self._attempts >= self.max_attempts:
                log.error("AutoReconnect: max attempts (%d) reached — giving up", self.max_attempts)
                break
            self._attempts += 1
            wait = _phi_backoff(self._attempts - 1, base_ms=1000)
            log.warning(
                "Process exited (code=%s) — restarting in %.1fs (attempt %d/%d)",
                retcode, wait, self._attempts, self.max_attempts,
            )
            time.sleep(wait)
            try:
                self._proc = self.start_fn()
                log.info("AutoReconnect: process restarted (PID %s)", self._proc.pid)
            except Exception as exc:
                log.error("AutoReconnect: restart failed: %s", exc)

    def terminate(self):
        """Stop monitoring and terminate the managed process."""
        self._proc and self._proc.terminate()
        self._proc = None


# ─── 10. Master Bootstrap Function ──────────────────────────────────────────

def full_bootstrap(
    node_role: str,
    local_port: int,
    *,
    ngrok_token: str | None = None,
    github_token: str | None = None,
    gist_id: str | None = None,
    expected_peers: list[str] | None = None,
    peer_timeout_s: float = 300.0,
    env_overrides: dict | None = None,
) -> dict:
    """
    Run the complete bootstrap sequence for a Heady cluster node.

    Steps
    -----
    1. Install Node.js 22 via nvm
    2. Set up / update the heady-zero-dep repository
    3. Probe GPU
    4. Establish public tunnel
    5. Register this node in the discovery Gist
    6. Optionally wait for peer nodes
    7. Build and return the environment dict

    Parameters
    ----------
    node_role : str
        "brain", "conductor", or "sentinel".
    local_port : int
        Port the Node.js service will listen on.
    ngrok_token : str or None
        ngrok auth token (optional but recommended for stability).
    github_token : str or None
        GitHub PAT for Gist-based discovery.
    gist_id : str or None
        Existing Gist ID to use; created automatically if None.
    expected_peers : list[str] or None
        Roles to wait for before returning (e.g. ["brain", "conductor"]).
    peer_timeout_s : float
        Seconds to wait for peers.
    env_overrides : dict or None
        Additional env vars.

    Returns
    -------
    dict
        {
          "node_path": Path,
          "repo_dir": Path,
          "gpu": GPUInfo,
          "tunnel": TunnelInfo | None,
          "registry": NodeRegistry | None,
          "peers": dict,
          "env": dict,
        }
    """
    print(f"\n{'═' * 55}")
    print(f"  HEADY  ✦  {node_role.upper()} NODE BOOTSTRAP")
    print(f"  φ = {PHI:.6f}  │  Fibonacci cluster architecture")
    print(f"{'═' * 55}\n")

    # 1. Node.js
    log.info("Step 1/6: Installing Node.js %s…", NODE_VERSION)
    node_path = install_nodejs()

    # 2. Repository
    log.info("Step 2/6: Setting up repository…")
    repo_dir = setup_repo()

    # 3. GPU
    log.info("Step 3/6: Probing GPU…")
    gpu = probe_gpu()
    print(f"  GPU: {gpu.name}  [{gpu.detected_tier.upper()}]  {gpu.memory_mb} MB")

    # 4. Tunnel
    log.info("Step 4/6: Establishing tunnel on port %d…", local_port)
    tunnel = setup_tunnel(local_port, ngrok_token=ngrok_token)
    if tunnel:
        print(f"  Tunnel: {tunnel.public_url}")
    else:
        log.warning("Could not establish tunnel — inter-node comms will be LAN-only")

    # 5. Register
    registry = None
    peers = {}
    if github_token or os.environ.get("GITHUB_TOKEN"):
        log.info("Step 5/6: Registering node in discovery Gist…")
        registry = register_node(
            node_role, tunnel or TunnelInfo("none", f"http://localhost:{local_port}", local_port),
            gpu, github_token, gist_id,
        )
        gist_id = registry.gist_id
        print(f"  Discovery Gist: {gist_id}")

        # 6. Wait for peers
        if expected_peers:
            log.info("Step 6/6: Waiting for peers %s…", expected_peers)
            try:
                peers = wait_for_peers(registry, expected_peers, peer_timeout_s)
                print(f"  Peers online: {list(peers.keys())}")
            except TimeoutError as exc:
                log.warning("%s", exc)
    else:
        log.info("Step 5-6/6: No GitHub token — skipping discovery (set GITHUB_TOKEN env var)")

    # 7. Env
    env = build_env(node_role, peers, env_overrides)
    setup_colab_keepalive()

    print(f"\n  Bootstrap complete ✓  Node: {node_role.upper()}\n")
    return {
        "node_path": node_path,
        "repo_dir": repo_dir,
        "gpu": gpu,
        "tunnel": tunnel,
        "registry": registry,
        "peers": peers,
        "env": env,
    }

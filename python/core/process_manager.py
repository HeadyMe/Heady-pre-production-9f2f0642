"""
process_manager.py
==================
Zero-dependency process management — replaces concurrently/nodemon/pm2.

Features:
    - Spawn and track multiple named child processes
    - File watching with auto-restart on change (pure Python, no inotify)
    - Health check monitoring with automatic restart on failure
    - Graceful LIFO shutdown (reverse startup order)
    - Log aggregation: stdout/stderr from children -> parent logger
    - PID tracking and process status
    - Restart policies: always, on-failure, never
    - Backoff on repeated crashes (phi-based: 1.618^n)
    - Environment variable injection per process
    - Signal forwarding to children (SIGTERM → children → SIGKILL fallback)

Usage:
    from core.process_manager import ProcessManager

    pm = ProcessManager()

    pm.add("api",     ["python", "-m", "api.server"],    cwd="./api")
    pm.add("worker",  ["python", "-m", "worker.main"],   cwd="./worker",
           env={"WORKER_CONCURRENCY": "4"})

    # File watching (restarts 'api' when .py files change)
    pm.watch("api", paths=["./api"], patterns=["*.py"])

    pm.run()   # blocking — handles SIGTERM/SIGINT for clean shutdown
"""

from __future__ import annotations

import asyncio
import fnmatch
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable

__all__ = [
    "ProcessManager",
    "ManagedProcess",
    "FileWatcher",
    "get_process_manager",
]

logger = logging.getLogger(__name__)

# Golden ratio for crash backoff
_PHI = 1.6180339887

# ---------------------------------------------------------------------------
# Enums & dataclasses
# ---------------------------------------------------------------------------


class RestartPolicy(Enum):
    ALWAYS = auto()
    ON_FAILURE = auto()
    NEVER = auto()


class ProcessStatus(Enum):
    PENDING = "pending"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    CRASHED = "crashed"
    RESTARTING = "restarting"


@dataclass
class ProcessConfig:
    """Configuration for a managed process."""

    name: str
    cmd: list[str]
    cwd: str | Path | None = None
    env: dict[str, str] | None = None
    restart_policy: RestartPolicy = RestartPolicy.ON_FAILURE
    max_restarts: int = 10
    restart_delay: float = 1.0
    health_check: Callable[[], bool] | None = None
    health_interval: float = 30.0
    health_timeout: float = 5.0
    shutdown_timeout: float = 10.0
    watch_paths: list[str] = field(default_factory=list)
    watch_patterns: list[str] = field(default_factory=lambda: ["*.py"])


# ---------------------------------------------------------------------------
# ManagedProcess
# ---------------------------------------------------------------------------


class ManagedProcess:
    """
    A single managed subprocess with restart logic and log aggregation.
    """

    def __init__(self, config: ProcessConfig) -> None:
        self.config = config
        self.status = ProcessStatus.PENDING
        self.pid: int | None = None
        self._proc: subprocess.Popen | None = None
        self._restart_count = 0
        self._start_time: float | None = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._log_threads: list[threading.Thread] = []
        self._callbacks: list[Callable[[str, Any], None]] = []

    @property
    def name(self) -> str:
        return self.config.name

    def on_event(self, callback: Callable[[str, Any], None]) -> None:
        """Register a callback: callback(event_type, data)."""
        self._callbacks.append(callback)

    def _emit(self, event: str, data: Any = None) -> None:
        for cb in self._callbacks:
            try:
                cb(event, data)
            except Exception as exc:
                logger.error("Process event callback error: %s", exc)

    def start(self) -> bool:
        """Start the process. Returns True if started successfully."""
        with self._lock:
            if self.status in (ProcessStatus.RUNNING, ProcessStatus.STARTING):
                return False
            self.status = ProcessStatus.STARTING

        env = {**os.environ, **(self.config.env or {})}
        cwd = str(self.config.cwd) if self.config.cwd else None

        try:
            self._proc = subprocess.Popen(
                self.config.cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=cwd,
                env=env,
                text=False,  # binary mode for universal handling
                bufsize=0,
            )
            self.pid = self._proc.pid
            self._start_time = time.monotonic()
            self.status = ProcessStatus.RUNNING
            self._stop_event.clear()

            # Start log aggregation threads
            self._log_threads = [
                threading.Thread(
                    target=self._pipe_reader,
                    args=(self._proc.stdout, "stdout"),
                    daemon=True, name=f"{self.name}-stdout"
                ),
                threading.Thread(
                    target=self._pipe_reader,
                    args=(self._proc.stderr, "stderr"),
                    daemon=True, name=f"{self.name}-stderr"
                ),
            ]
            for t in self._log_threads:
                t.start()

            logger.info("[%s] Started PID=%s cmd=%s", self.name, self.pid, self.config.cmd)
            self._emit("start", {"pid": self.pid})
            return True

        except Exception as exc:
            self.status = ProcessStatus.CRASHED
            logger.error("[%s] Failed to start: %s", self.name, exc)
            self._emit("start_failed", {"error": str(exc)})
            return False

    def stop(self, timeout: float | None = None) -> None:
        """Gracefully stop the process (SIGTERM → wait → SIGKILL)."""
        t = timeout or self.config.shutdown_timeout
        with self._lock:
            if self._proc is None or self.status == ProcessStatus.STOPPED:
                return
            self.status = ProcessStatus.STOPPING

        logger.info("[%s] Stopping (PID=%s)...", self.name, self.pid)
        self._emit("stopping", {"pid": self.pid})

        try:
            self._proc.terminate()  # SIGTERM
            try:
                self._proc.wait(timeout=t)
            except subprocess.TimeoutExpired:
                logger.warning("[%s] SIGTERM timeout — sending SIGKILL", self.name)
                self._proc.kill()
                self._proc.wait(timeout=5)
        except Exception as exc:
            logger.error("[%s] Stop error: %s", self.name, exc)

        self.status = ProcessStatus.STOPPED
        self.pid = None
        self._proc = None
        self._emit("stopped", {})

    def is_alive(self) -> bool:
        if self._proc is None:
            return False
        return self._proc.poll() is None

    def wait_for_exit(self) -> int | None:
        """Block until the process exits. Returns exit code."""
        if self._proc is None:
            return None
        return self._proc.wait()

    def returncode(self) -> int | None:
        if self._proc is None:
            return None
        return self._proc.poll()

    def uptime(self) -> float:
        if self._start_time is None:
            return 0.0
        return time.monotonic() - self._start_time

    def _pipe_reader(self, pipe: Any, stream: str) -> None:
        """Read from stdout/stderr and emit to logger."""
        prefix = f"[{self.name}][{stream}]"
        log_fn = logger.info if stream == "stdout" else logger.warning
        try:
            for line in iter(pipe.readline, b""):
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    log_fn("%s %s", prefix, decoded)
                    self._emit("log", {"stream": stream, "line": decoded})
        except Exception:
            pass

    def info(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "pid": self.pid,
            "restart_count": self._restart_count,
            "uptime": round(self.uptime(), 1),
            "cmd": self.config.cmd,
        }


# ---------------------------------------------------------------------------
# File Watcher
# ---------------------------------------------------------------------------


class FileWatcher:
    """
    Poll-based file watcher. Checks mtime of files in watched paths.
    Pure Python, no inotify/kqueue dependencies.
    """

    def __init__(self, poll_interval: float = 1.0) -> None:
        self._poll_interval = poll_interval
        self._watches: dict[str, list[tuple[list[str], list[str], Callable]]] = defaultdict(list)
        # watch_id -> list[(paths, patterns, callback)]
        self._mtimes: dict[str, float] = {}
        self._running = False
        self._thread: threading.Thread | None = None

    def watch(
        self,
        watch_id: str,
        paths: list[str],
        patterns: list[str],
        callback: Callable[[str, list[str]], None],
    ) -> None:
        """
        Register a watcher.

        Args:
            watch_id: Unique identifier (used to group watches).
            paths:    Directories to watch.
            patterns: File name patterns (fnmatch, e.g. ["*.py", "*.json"]).
            callback: Called with (watch_id, changed_files) when changes detected.
        """
        self._watches[watch_id].append((paths, patterns, callback))
        # Initialize mtimes for existing files
        for f in self._gather_files(paths, patterns):
            if f not in self._mtimes:
                try:
                    self._mtimes[f] = os.path.getmtime(f)
                except OSError:
                    pass

    def unwatch(self, watch_id: str) -> None:
        self._watches.pop(watch_id, None)

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._poll_loop, daemon=True, name="heady-filewatcher"
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def _gather_files(self, paths: list[str], patterns: list[str]) -> list[str]:
        files: list[str] = []
        for p in paths:
            root = Path(p)
            if not root.exists():
                continue
            for pattern in patterns:
                for f in root.rglob(pattern):
                    if f.is_file():
                        files.append(str(f))
        return files

    def _poll_loop(self) -> None:
        while self._running:
            for watch_id, entries in list(self._watches.items()):
                changed: list[str] = []
                for paths, patterns, callback in entries:
                    for filepath in self._gather_files(paths, patterns):
                        try:
                            mtime = os.path.getmtime(filepath)
                        except OSError:
                            continue
                        old = self._mtimes.get(filepath)
                        if old is None or mtime > old:
                            changed.append(filepath)
                            self._mtimes[filepath] = mtime
                if changed:
                    for paths, patterns, callback in entries:
                        try:
                            callback(watch_id, changed)
                        except Exception as exc:
                            logger.error("File watcher callback error: %s", exc)
            time.sleep(self._poll_interval)


# ---------------------------------------------------------------------------
# Health Monitor
# ---------------------------------------------------------------------------


class _HealthMonitor:
    """Periodically runs health checks for a process and restarts if failing."""

    def __init__(
        self,
        proc: ManagedProcess,
        on_unhealthy: Callable[[ManagedProcess], None],
    ) -> None:
        self._proc = proc
        self._on_unhealthy = on_unhealthy
        self._thread: threading.Thread | None = None
        self._running = False

    def start(self) -> None:
        if self._proc.config.health_check is None:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name=f"{self._proc.name}-health"
        )
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    def _loop(self) -> None:
        fn = self._proc.config.health_check
        interval = self._proc.config.health_interval
        timeout = self._proc.config.health_timeout
        consecutive_failures = 0

        while self._running:
            time.sleep(interval)
            if not self._running:
                break
            if not self._proc.is_alive():
                continue
            try:
                result = fn()
                if result:
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
            except Exception as exc:
                consecutive_failures += 1
                logger.warning("[%s] Health check error: %s", self._proc.name, exc)

            if consecutive_failures >= 3:
                logger.warning("[%s] Health check failing — triggering restart", self._proc.name)
                self._on_unhealthy(self._proc)
                consecutive_failures = 0


# ---------------------------------------------------------------------------
# ProcessManager
# ---------------------------------------------------------------------------


class ProcessManager:
    """
    Manages a fleet of child processes with watching, health monitoring,
    restart policies, and graceful shutdown.

    Example:
        pm = ProcessManager()
        pm.add("api", ["python", "api.py"], cwd="./api")
        pm.add("worker", ["python", "worker.py"])
        pm.run()   # blocking
    """

    def __init__(self) -> None:
        self._processes: dict[str, ManagedProcess] = {}
        self._start_order: list[str] = []  # for LIFO shutdown
        self._watcher = FileWatcher()
        self._health_monitors: dict[str, _HealthMonitor] = {}
        self._restart_locks: dict[str, threading.Lock] = {}
        self._running = False
        self._main_lock = threading.Lock()
        self._stop_event = threading.Event()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def add(
        self,
        name: str,
        cmd: list[str],
        *,
        cwd: str | Path | None = None,
        env: dict[str, str] | None = None,
        restart_policy: RestartPolicy = RestartPolicy.ON_FAILURE,
        max_restarts: int = 10,
        health_check: Callable[[], bool] | None = None,
        health_interval: float = 30.0,
        shutdown_timeout: float = 10.0,
    ) -> "ProcessManager":
        """Register a process (fluent API)."""
        config = ProcessConfig(
            name=name,
            cmd=cmd,
            cwd=cwd,
            env=env,
            restart_policy=restart_policy,
            max_restarts=max_restarts,
            health_check=health_check,
            health_interval=health_interval,
            shutdown_timeout=shutdown_timeout,
        )
        proc = ManagedProcess(config)
        proc.on_event(self._on_process_event)
        with self._main_lock:
            self._processes[name] = proc
            self._start_order.append(name)
            self._restart_locks[name] = threading.Lock()
        return self

    def watch(
        self,
        name: str,
        paths: list[str],
        patterns: list[str] | None = None,
    ) -> "ProcessManager":
        """
        Watch files and auto-restart process on change.

        Args:
            name:     Registered process name.
            paths:    Directories to watch.
            patterns: File patterns (default: *.py).
        """
        if name not in self._processes:
            raise KeyError(f"Unknown process: {name}")
        patterns = patterns or ["*.py"]
        self._watcher.watch(
            watch_id=name,
            paths=paths,
            patterns=patterns,
            callback=self._on_file_change,
        )
        return self

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start_all(self) -> None:
        """Start all registered processes."""
        self._running = True
        self._watcher.start()
        for name in self._start_order:
            proc = self._processes[name]
            proc.start()
            monitor = _HealthMonitor(proc, on_unhealthy=self._restart_process)
            self._health_monitors[name] = monitor
            monitor.start()

    def stop_all(self, timeout: float = 30.0) -> None:
        """Graceful shutdown in LIFO order."""
        logger.info("ProcessManager: graceful shutdown...")
        self._running = False
        self._watcher.stop()

        for name in reversed(self._start_order):
            proc = self._processes.get(name)
            if proc:
                proc.stop()

        for m in self._health_monitors.values():
            m.stop()

        logger.info("ProcessManager: all processes stopped")

    def run(self) -> None:
        """
        Start all processes and block until SIGTERM/SIGINT.
        Installs signal handlers for clean shutdown.
        """
        self._install_signal_handlers()
        self.start_all()
        logger.info("ProcessManager running — press Ctrl+C to stop")
        try:
            self._stop_event.wait()
        except KeyboardInterrupt:
            pass
        finally:
            self.stop_all()

    def restart(self, name: str) -> bool:
        """Manually restart a named process."""
        proc = self._processes.get(name)
        if proc is None:
            raise KeyError(f"Unknown process: {name}")
        return self._do_restart(proc)

    # ------------------------------------------------------------------
    # Restart logic
    # ------------------------------------------------------------------

    def _restart_process(self, proc: ManagedProcess) -> None:
        """Enqueue a restart (from health monitor or crash)."""
        lock = self._restart_locks.get(proc.name)
        if lock is None:
            return
        if lock.locked():
            return  # Already restarting

        t = threading.Thread(
            target=self._do_restart,
            args=(proc,),
            daemon=True,
            name=f"{proc.name}-restart",
        )
        t.start()

    def _do_restart(self, proc: ManagedProcess) -> bool:
        lock = self._restart_locks[proc.name]
        if not lock.acquire(blocking=False):
            return False
        try:
            proc._restart_count += 1
            if proc._restart_count > proc.config.max_restarts:
                logger.error(
                    "[%s] Max restarts (%d) exceeded — giving up",
                    proc.name, proc.config.max_restarts
                )
                proc.status = ProcessStatus.CRASHED
                return False

            delay = proc.config.restart_delay * (_PHI ** min(proc._restart_count, 8))
            logger.info(
                "[%s] Restarting (attempt %d/%d) in %.1fs...",
                proc.name, proc._restart_count, proc.config.max_restarts, delay
            )
            proc.status = ProcessStatus.RESTARTING
            time.sleep(delay)
            proc.stop()
            success = proc.start()
            return success
        finally:
            lock.release()

    # ------------------------------------------------------------------
    # Event handlers
    # ------------------------------------------------------------------

    def _on_process_event(self, event: str, data: Any) -> None:
        """Handle events from child processes."""
        if event == "stopped" and self._running:
            # Find which process emitted this by checking status
            for name, proc in self._processes.items():
                if proc.status == ProcessStatus.STOPPED and proc.config.restart_policy != RestartPolicy.NEVER:
                    self._restart_process(proc)

    def _on_file_change(self, watch_id: str, changed_files: list[str]) -> None:
        """Called by FileWatcher when files change."""
        proc = self._processes.get(watch_id)
        if proc is None:
            return
        logger.info(
            "[%s] File change detected (%d file(s)) — restarting",
            watch_id, len(changed_files)
        )
        for f in changed_files[:3]:
            logger.info("[%s]   changed: %s", watch_id, f)
        self._restart_process(proc)

    # ------------------------------------------------------------------
    # Signal handling
    # ------------------------------------------------------------------

    def _install_signal_handlers(self) -> None:
        def handler(signum: int, frame: Any) -> None:
            logger.info("Signal %s received — shutting down", signum)
            self._stop_event.set()

        try:
            signal.signal(signal.SIGTERM, handler)
            signal.signal(signal.SIGINT, handler)
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def status(self) -> dict[str, Any]:
        """Return status summary for all processes."""
        return {
            name: proc.info()
            for name, proc in self._processes.items()
        }

    def get(self, name: str) -> ManagedProcess | None:
        return self._processes.get(name)

    def __repr__(self) -> str:
        names = list(self._processes.keys())
        return f"<ProcessManager processes={names}>"


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_default_pm: ProcessManager | None = None


def get_process_manager() -> ProcessManager:
    """Return (or create) the default ProcessManager."""
    global _default_pm
    if _default_pm is None:
        _default_pm = ProcessManager()
    return _default_pm

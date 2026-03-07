"""
telemetry.py
============
Zero-dependency observability system — replaces Sentry/DataDog/Prometheus.

Features:
    - Structured JSON logging (configurable levels)
    - Log rotation (size + count based)
    - Error / warning / info / debug levels with stack traces
    - Metrics: counters, gauges, histograms (percentiles: p50, p95, p99)
    - Performance timing: @timer decorator and context manager
    - Health aggregation (liveness + readiness checks)
    - Event bus for internal alerts (async-compatible)
    - Exception capture with context (like Sentry.capture_exception)
    - Breadcrumbs for request tracing
    - Thread-safe

Usage:
    from core.telemetry import get_telemetry, timer, capture_exception

    tel = get_telemetry()

    tel.info("user.created", user_id=42, email="alice@example.com")
    tel.error("payment.failed", amount=99.99, reason="card_declined")

    @timer("db.query")
    def run_query():
        ...

    with tel.metrics.time("request.duration"):
        process_request()

    tel.metrics.incr("api.calls", tags={"endpoint": "/users"})
    tel.metrics.gauge("active_connections", 42)

    # Health checks
    tel.health.register("database", lambda: db.fetch_scalar("SELECT 1") == 1)
    status = tel.health.check()

    # Event bus
    tel.events.on("error", lambda ev: send_alert(ev))
    tel.events.emit("error", {"message": "DB down"})
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import json
import logging
import math
import os
import sys
import threading
import time
import traceback
from collections import defaultdict, deque
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Callable, Generator, Optional

__all__ = [
    "Telemetry",
    "Logger",
    "Metrics",
    "EventBus",
    "timer",
    "capture_exception",
    "get_telemetry",
]

# ---------------------------------------------------------------------------
# Structured JSON formatter
# ---------------------------------------------------------------------------


class _JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON objects."""

    def __init__(self, service: str = "heady", env: str = "production") -> None:
        super().__init__()
        self._service = service
        self._env = env

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self._service,
            "env": self._env,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "lineno": record.lineno,
        }
        # Attach extra fields
        for k, v in record.__dict__.items():
            if k not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ):
                payload[k] = v

        if record.exc_info:
            payload["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "value": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        try:
            return json.dumps(payload, ensure_ascii=False, default=str)
        except Exception:
            return json.dumps({"level": "ERROR", "msg": "log serialization failure"})


# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------


class Logger:
    """
    Structured logger that emits JSON to stderr and optionally a rotating file.
    Supports breadcrumbs for request tracing.
    """

    def __init__(
        self,
        name: str = "heady",
        level: str = "INFO",
        log_file: str | Path | None = None,
        max_bytes: int = 50 * 1024 * 1024,  # 50 MB
        backup_count: int = 5,
        service: str = "heady",
        env: str = "production",
    ) -> None:
        self._logger = logging.getLogger(name)
        self._logger.setLevel(getattr(logging, level.upper(), logging.INFO))
        self._logger.propagate = False

        formatter = _JSONFormatter(service=service, env=env)

        # Console handler
        if not any(isinstance(h, logging.StreamHandler) for h in self._logger.handlers):
            ch = logging.StreamHandler(sys.stderr)
            ch.setFormatter(formatter)
            self._logger.addHandler(ch)

        # File handler (rotating)
        if log_file:
            fh = RotatingFileHandler(
                str(log_file), maxBytes=max_bytes, backupCount=backup_count
            )
            fh.setFormatter(formatter)
            self._logger.addHandler(fh)

        self._breadcrumbs: list[dict[str, Any]] = []
        self._crumbs_lock = threading.Lock()
        self._max_breadcrumbs = 50

    def _log(self, level: int, msg: str, **kwargs: Any) -> None:
        extra = {k: v for k, v in kwargs.items()}
        self._logger.log(level, msg, extra=extra, stacklevel=3)

    def debug(self, msg: str, **kwargs: Any) -> None:
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs: Any) -> None:
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs: Any) -> None:
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, **kwargs: Any) -> None:
        self._log(logging.ERROR, msg, **kwargs)

    def critical(self, msg: str, **kwargs: Any) -> None:
        self._log(logging.CRITICAL, msg, **kwargs)

    def exception(self, msg: str, exc: BaseException | None = None, **kwargs: Any) -> None:
        """Log an exception with full traceback."""
        if exc is None:
            exc_info = sys.exc_info()
        else:
            exc_info = (type(exc), exc, exc.__traceback__)
        self._logger.error(msg, exc_info=exc_info, extra=kwargs, stacklevel=2)

    # Breadcrumbs
    def add_breadcrumb(self, category: str, message: str, **data: Any) -> None:
        crumb = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "category": category,
            "message": message,
            **data,
        }
        with self._crumbs_lock:
            self._breadcrumbs.append(crumb)
            if len(self._breadcrumbs) > self._max_breadcrumbs:
                self._breadcrumbs.pop(0)

    def get_breadcrumbs(self) -> list[dict]:
        with self._crumbs_lock:
            return list(self._breadcrumbs)

    def clear_breadcrumbs(self) -> None:
        with self._crumbs_lock:
            self._breadcrumbs.clear()


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


@dataclass
class _HistogramData:
    """Stores samples for histogram percentile computation."""
    samples: deque = field(default_factory=lambda: deque(maxlen=10_000))
    total: float = 0.0
    count: int = 0
    min_val: float = float("inf")
    max_val: float = float("-inf")

    def record(self, value: float) -> None:
        self.samples.append(value)
        self.total += value
        self.count += 1
        self.min_val = min(self.min_val, value)
        self.max_val = max(self.max_val, value)

    def percentile(self, p: float) -> float:
        """Return the p-th percentile (0..100)."""
        if not self.samples:
            return 0.0
        sorted_s = sorted(self.samples)
        idx = math.ceil(p / 100 * len(sorted_s)) - 1
        return sorted_s[max(0, idx)]

    def mean(self) -> float:
        return self.total / self.count if self.count else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "count": self.count,
            "mean": round(self.mean(), 6),
            "min": self.min_val if self.count else 0,
            "max": self.max_val if self.count else 0,
            "p50": round(self.percentile(50), 6),
            "p95": round(self.percentile(95), 6),
            "p99": round(self.percentile(99), 6),
        }


class Metrics:
    """
    Metrics registry: counters, gauges, histograms.

    Thread-safe.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, _HistogramData] = {}
        self._tags: dict[str, dict[str, Any]] = {}  # metric_name -> tags

    def _tagged_key(self, name: str, tags: dict[str, str] | None) -> str:
        if not tags:
            return name
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}[{tag_str}]"

    def incr(self, name: str, value: float = 1.0, tags: dict[str, str] | None = None) -> float:
        """Increment a counter. Returns new value."""
        key = self._tagged_key(name, tags)
        with self._lock:
            self._counters[key] += value
            return self._counters[key]

    def decr(self, name: str, value: float = 1.0, tags: dict[str, str] | None = None) -> float:
        """Decrement a counter."""
        return self.incr(name, -value, tags=tags)

    def gauge(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Set an absolute gauge value."""
        key = self._tagged_key(name, tags)
        with self._lock:
            self._gauges[key] = value

    def histogram(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Record a value in a histogram (for percentile computation)."""
        key = self._tagged_key(name, tags)
        with self._lock:
            if key not in self._histograms:
                self._histograms[key] = _HistogramData()
            self._histograms[key].record(value)

    @contextmanager
    def time(self, name: str, tags: dict[str, str] | None = None) -> Generator[None, None, None]:
        """Context manager that records elapsed time as a histogram."""
        start = time.perf_counter()
        try:
            yield
        finally:
            elapsed = time.perf_counter() - start
            self.histogram(name, elapsed, tags=tags)

    def get_counter(self, name: str) -> float:
        with self._lock:
            return self._counters.get(name, 0.0)

    def get_gauge(self, name: str) -> float | None:
        with self._lock:
            return self._gauges.get(name)

    def get_histogram(self, name: str) -> dict[str, Any] | None:
        with self._lock:
            h = self._histograms.get(name)
            return h.to_dict() if h else None

    def snapshot(self) -> dict[str, Any]:
        """Return all metrics as a dict."""
        with self._lock:
            return {
                "counters": dict(self._counters),
                "gauges": dict(self._gauges),
                "histograms": {k: v.to_dict() for k, v in self._histograms.items()},
            }

    def reset(self) -> None:
        """Reset all metrics (useful for tests)."""
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._histograms.clear()


# ---------------------------------------------------------------------------
# Event Bus
# ---------------------------------------------------------------------------


class EventBus:
    """
    Simple synchronous + async event bus for internal alerts.

    Example:
        bus = EventBus()
        bus.on("error", lambda ev: print("ERROR:", ev))
        bus.emit("error", {"message": "Something failed"})

        # Async
        await bus.emit_async("error", {...})
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable]] = defaultdict(list)
        self._lock = threading.Lock()

    def on(self, event: str, handler: Callable) -> Callable:
        """Register a handler for an event. Returns handler (for chaining)."""
        with self._lock:
            self._handlers[event].append(handler)
        return handler

    def off(self, event: str, handler: Callable) -> None:
        """Remove a handler."""
        with self._lock:
            lst = self._handlers.get(event, [])
            if handler in lst:
                lst.remove(handler)

    def emit(self, event: str, payload: Any = None) -> int:
        """Emit an event. Returns number of handlers called."""
        with self._lock:
            handlers = list(self._handlers.get(event, []))
        count = 0
        for h in handlers:
            try:
                h(payload)
                count += 1
            except Exception as exc:
                logging.error("EventBus handler error [%s]: %s", event, exc)
        return count

    async def emit_async(self, event: str, payload: Any = None) -> int:
        """Emit an event, awaiting async handlers."""
        with self._lock:
            handlers = list(self._handlers.get(event, []))
        count = 0
        for h in handlers:
            try:
                result = h(payload)
                if asyncio.iscoroutine(result):
                    await result
                count += 1
            except Exception as exc:
                logging.error("EventBus async handler error [%s]: %s", event, exc)
        return count

    def once(self, event: str, handler: Callable) -> None:
        """Register a one-shot handler (called once then removed)."""
        def _wrapper(payload: Any) -> None:
            self.off(event, _wrapper)
            handler(payload)
        self.on(event, _wrapper)


# ---------------------------------------------------------------------------
# Health checks
# ---------------------------------------------------------------------------


@dataclass
class _Check:
    name: str
    fn: Callable[[], bool]
    critical: bool = True


class HealthAggregator:
    """Runs registered health checks and aggregates results."""

    def __init__(self) -> None:
        self._checks: list[_Check] = []
        self._lock = threading.Lock()

    def register(self, name: str, fn: Callable[[], bool], critical: bool = True) -> None:
        """Register a health check function."""
        with self._lock:
            self._checks.append(_Check(name=name, fn=fn, critical=critical))

    def check(self) -> dict[str, Any]:
        """
        Run all checks and return aggregated result.

        Returns:
            {
                "status": "healthy" | "degraded" | "unhealthy",
                "checks": { "name": { "ok": True/False, "error": null/str } }
            }
        """
        with self._lock:
            checks = list(self._checks)

        results: dict[str, dict] = {}
        any_critical_fail = False
        any_fail = False

        for check in checks:
            try:
                ok = bool(check.fn())
                results[check.name] = {"ok": ok, "error": None}
                if not ok:
                    any_fail = True
                    if check.critical:
                        any_critical_fail = True
            except Exception as exc:
                results[check.name] = {"ok": False, "error": str(exc)}
                any_fail = True
                if check.critical:
                    any_critical_fail = True

        if any_critical_fail:
            status = "unhealthy"
        elif any_fail:
            status = "degraded"
        else:
            status = "healthy"

        return {
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": results,
        }


# ---------------------------------------------------------------------------
# Exception capture
# ---------------------------------------------------------------------------


@dataclass
class _CapturedError:
    error_type: str
    message: str
    traceback: list[str]
    context: dict[str, Any]
    timestamp: str
    fingerprint: str


class _ErrorTracker:
    """In-memory error store, similar to Sentry's event queue."""

    def __init__(self, max_errors: int = 1000) -> None:
        self._errors: deque[_CapturedError] = deque(maxlen=max_errors)
        self._counts: dict[str, int] = defaultdict(int)
        self._lock = threading.Lock()

    def capture(
        self,
        exc: BaseException,
        context: dict[str, Any] | None = None,
        tags: dict[str, str] | None = None,
    ) -> str:
        """Capture an exception. Returns fingerprint."""
        tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        fingerprint = _make_fingerprint(type(exc).__name__, str(exc))
        err = _CapturedError(
            error_type=type(exc).__name__,
            message=str(exc),
            traceback=tb,
            context={**(context or {}), **(tags or {})},
            timestamp=datetime.now(timezone.utc).isoformat(),
            fingerprint=fingerprint,
        )
        with self._lock:
            self._errors.append(err)
            self._counts[fingerprint] += 1
        return fingerprint

    def recent(self, n: int = 50) -> list[dict]:
        with self._lock:
            items = list(self._errors)[-n:]
        return [
            {
                "type": e.error_type,
                "message": e.message,
                "traceback": e.traceback,
                "context": e.context,
                "timestamp": e.timestamp,
                "fingerprint": e.fingerprint,
                "occurrences": self._counts[e.fingerprint],
            }
            for e in reversed(items)
        ]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "total_captured": sum(self._counts.values()),
                "unique_errors": len(self._counts),
                "top_errors": sorted(
                    self._counts.items(), key=lambda x: x[1], reverse=True
                )[:10],
            }


def _make_fingerprint(error_type: str, message: str) -> str:
    """Create a short fingerprint for deduplication."""
    import hashlib
    raw = f"{error_type}:{message[:200]}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Telemetry façade
# ---------------------------------------------------------------------------


class Telemetry:
    """
    Top-level telemetry object. Combines Logger, Metrics, EventBus, Health.

    Example:
        tel = Telemetry(service="heady-api", log_level="INFO")
        tel.info("server.started", port=8000)
        tel.metrics.incr("requests.total")
    """

    def __init__(
        self,
        service: str = "heady",
        env: str = "production",
        log_level: str = "INFO",
        log_file: str | Path | None = None,
        max_log_bytes: int = 50 * 1024 * 1024,
        backup_count: int = 5,
        max_errors: int = 1000,
    ) -> None:
        self.service = service
        self.env = env
        self.logger = Logger(
            name=service,
            level=log_level,
            log_file=log_file,
            max_bytes=max_log_bytes,
            backup_count=backup_count,
            service=service,
            env=env,
        )
        self.metrics = Metrics()
        self.events = EventBus()
        self.health = HealthAggregator()
        self._errors = _ErrorTracker(max_errors=max_errors)

    # Delegate logging
    def debug(self, msg: str, **kwargs: Any) -> None:
        self.logger.debug(msg, **kwargs)

    def info(self, msg: str, **kwargs: Any) -> None:
        self.logger.info(msg, **kwargs)

    def warning(self, msg: str, **kwargs: Any) -> None:
        self.logger.warning(msg, **kwargs)

    def error(self, msg: str, **kwargs: Any) -> None:
        self.logger.error(msg, **kwargs)
        self.events.emit("error", {"msg": msg, **kwargs})

    def critical(self, msg: str, **kwargs: Any) -> None:
        self.logger.critical(msg, **kwargs)
        self.events.emit("critical", {"msg": msg, **kwargs})

    def capture_exception(
        self,
        exc: BaseException | None = None,
        context: dict[str, Any] | None = None,
        tags: dict[str, str] | None = None,
    ) -> str:
        """
        Capture an exception (from current context if exc is None).
        Returns fingerprint string.
        """
        if exc is None:
            ei = sys.exc_info()
            if ei[1] is None:
                return ""
            exc = ei[1]
        self.logger.exception(f"Captured: {exc}", exc=exc, **(context or {}))
        fingerprint = self._errors.capture(exc, context=context, tags=tags)
        self.events.emit("exception", {
            "type": type(exc).__name__,
            "message": str(exc),
            "fingerprint": fingerprint,
        })
        return fingerprint

    def recent_errors(self, n: int = 50) -> list[dict]:
        return self._errors.recent(n)

    def error_stats(self) -> dict[str, Any]:
        return self._errors.stats()

    def snapshot(self) -> dict[str, Any]:
        """Full observability snapshot."""
        return {
            "service": self.service,
            "env": self.env,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "health": self.health.check(),
            "metrics": self.metrics.snapshot(),
            "errors": self.error_stats(),
        }

    @contextmanager
    def span(self, name: str, tags: dict[str, str] | None = None) -> Generator[None, None, None]:
        """Timing span context manager."""
        start = time.perf_counter()
        self.logger.add_breadcrumb("span", f"start:{name}")
        try:
            yield
        except Exception as exc:
            self.metrics.incr(f"{name}.error", tags=tags)
            self.capture_exception(exc)
            raise
        finally:
            elapsed = time.perf_counter() - start
            self.metrics.histogram(name, elapsed, tags=tags)
            self.logger.add_breadcrumb("span", f"end:{name}", elapsed_ms=round(elapsed * 1000, 2))


# ---------------------------------------------------------------------------
# Module-level decorators / singletons
# ---------------------------------------------------------------------------

_default_telemetry: Telemetry | None = None


def get_telemetry(
    service: str = "heady",
    env: str = "production",
    log_level: str = "INFO",
    **kwargs: Any,
) -> Telemetry:
    """Return (or create) the default Telemetry instance."""
    global _default_telemetry
    if _default_telemetry is None:
        _default_telemetry = Telemetry(service=service, env=env, log_level=log_level, **kwargs)
    return _default_telemetry


def timer(
    name: str,
    tags: dict[str, str] | None = None,
    telemetry: Telemetry | None = None,
) -> Callable:
    """
    Decorator to time a function and record in metrics.

    Works on both sync and async functions.

    Example:
        @timer("db.query")
        async def fetch_user(user_id):
            ...
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            tel = telemetry or get_telemetry()
            with tel.metrics.time(name, tags=tags):
                return await fn(*args, **kwargs)

        @functools.wraps(fn)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            tel = telemetry or get_telemetry()
            with tel.metrics.time(name, tags=tags):
                return fn(*args, **kwargs)

        if inspect.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper

    return decorator


def capture_exception(
    exc: BaseException | None = None,
    context: dict[str, Any] | None = None,
) -> str:
    """Module-level exception capture using the default telemetry."""
    return get_telemetry().capture_exception(exc=exc, context=context)

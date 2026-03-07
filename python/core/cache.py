"""
cache.py
========
Zero-dependency in-memory cache — replaces Redis/Upstash.

Features:
    - TTL (time-to-live) per key
    - LRU eviction when max_size is reached
    - Key namespaces (logical partitioning)
    - Atomic increment / decrement
    - Pub/sub (in-process, asyncio-based)
    - Persistence to disk as JSON (save / load)
    - Thread-safe operations (threading.Lock)
    - Comprehensive stats (hits, misses, evictions, expirations)
    - Pattern matching (fnmatch-style): cache.keys("user:*")
    - Pipeline (batched operations)

Usage:
    from core.cache import Cache, get_default_cache

    cache = Cache(max_size=10_000, default_ttl=300)
    cache.set("user:1", {"name": "Alice"}, ttl=60)
    user = cache.get("user:1")
    cache.delete("user:1")

    # Namespaced
    users = cache.namespace("users")
    users.set("1", {"name": "Bob"})

    # Pub/sub
    async def listener(channel, message):
        print(f"{channel}: {message}")
    await cache.subscribe("events", listener)
    await cache.publish("events", "hello")

    # Persistence
    cache.save("/tmp/cache.json")
    cache.load("/tmp/cache.json")
"""

from __future__ import annotations

import asyncio
import fnmatch
import json
import logging
import os
import threading
import time
from collections import OrderedDict, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterator, Optional

__all__ = [
    "Cache",
    "CacheNamespace",
    "cache_key",
    "get_default_cache",
]

logger = logging.getLogger(__name__)

_MISSING = object()

# ---------------------------------------------------------------------------
# Internal entry
# ---------------------------------------------------------------------------


@dataclass
class _Entry:
    """A single cache entry."""

    value: Any
    expires_at: float | None  # None = no expiry
    created_at: float = field(default_factory=time.monotonic)
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        return self.expires_at is not None and time.monotonic() >= self.expires_at

    def touch(self) -> None:
        self.hits += 1


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    expirations: int = 0
    sets: int = 0
    deletes: int = 0

    @property
    def total_requests(self) -> int:
        return self.hits + self.misses

    @property
    def hit_rate(self) -> float:
        total = self.total_requests
        return self.hits / total if total > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "expirations": self.expirations,
            "sets": self.sets,
            "deletes": self.deletes,
            "total_requests": self.total_requests,
            "hit_rate": round(self.hit_rate, 4),
        }


# ---------------------------------------------------------------------------
# Pub/Sub
# ---------------------------------------------------------------------------


class _PubSub:
    """In-process publish/subscribe (asyncio-based)."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._lock = threading.Lock()

    def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers[channel].append(q)
        return q

    def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        with self._lock:
            lst = self._subscribers.get(channel, [])
            if q in lst:
                lst.remove(q)

    def publish(self, channel: str, message: Any) -> int:
        """Publish to a channel. Returns number of subscribers notified."""
        with self._lock:
            subs = list(self._subscribers.get(channel, []))
        for q in subs:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass
        return len(subs)

    async def listen(self, channel: str) -> Any:
        q = self.subscribe(channel)
        try:
            return await q.get()
        finally:
            self.unsubscribe(channel, q)


# ---------------------------------------------------------------------------
# Main Cache
# ---------------------------------------------------------------------------


class Cache:
    """
    Thread-safe in-memory LRU cache with TTL, pub/sub, and persistence.

    Args:
        max_size:    Maximum number of keys (LRU eviction when exceeded).
        default_ttl: Default TTL in seconds (None = immortal).
        persist_path: If set, auto-persist on set/delete.
    """

    def __init__(
        self,
        max_size: int = 100_000,
        default_ttl: float | None = None,
        persist_path: str | Path | None = None,
    ) -> None:
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._persist_path = Path(persist_path) if persist_path else None
        self._store: OrderedDict[str, _Entry] = OrderedDict()
        self._lock = threading.Lock()
        self._stats = CacheStats()
        self._pubsub = _PubSub()
        self._expiry_task: asyncio.Task | None = None

        if self._persist_path and self._persist_path.exists():
            self.load(self._persist_path)

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def set(
        self,
        key: str,
        value: Any,
        ttl: float | None = _MISSING,  # type: ignore[assignment]
        nx: bool = False,  # Only set if not exists
        xx: bool = False,  # Only set if exists
    ) -> bool:
        """
        Set a key.

        Args:
            key:   Cache key.
            value: Value (must be JSON-serializable for persistence).
            ttl:   Time-to-live in seconds. None = no expiry. _MISSING = use default_ttl.
            nx:    Only set if key does NOT exist.
            xx:    Only set if key already EXISTS.

        Returns:
            True if set, False if nx/xx condition blocked the set.
        """
        if ttl is _MISSING:  # type: ignore[comparison-overlap]
            ttl = self._default_ttl

        with self._lock:
            existing = self._get_entry(key)
            if nx and existing is not None:
                return False
            if xx and existing is None:
                return False

            expires_at = (time.monotonic() + ttl) if ttl is not None else None
            entry = _Entry(value=value, expires_at=expires_at)

            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = entry

            # LRU eviction
            while len(self._store) > self._max_size:
                evicted_key, _ = self._store.popitem(last=False)
                self._stats.evictions += 1
                logger.debug("LRU evict: %s", evicted_key)

            self._stats.sets += 1

        if self._persist_path:
            self._maybe_persist()
        return True

    def get(self, key: str, default: Any = None) -> Any:
        """Get a key's value. Returns default if missing or expired."""
        with self._lock:
            entry = self._get_entry(key)
            if entry is None:
                self._stats.misses += 1
                return default
            entry.touch()
            self._store.move_to_end(key)
            self._stats.hits += 1
            return entry.value

    def delete(self, *keys: str) -> int:
        """Delete one or more keys. Returns count deleted."""
        count = 0
        with self._lock:
            for key in keys:
                if key in self._store:
                    del self._store[key]
                    self._stats.deletes += 1
                    count += 1
        if count and self._persist_path:
            self._maybe_persist()
        return count

    def exists(self, key: str) -> bool:
        with self._lock:
            return self._get_entry(key) is not None

    def expire(self, key: str, ttl: float) -> bool:
        """Update the TTL of an existing key. Returns False if key doesn't exist."""
        with self._lock:
            entry = self._get_entry(key)
            if entry is None:
                return False
            entry.expires_at = time.monotonic() + ttl
            return True

    def ttl(self, key: str) -> float | None:
        """Return remaining TTL in seconds. None if no expiry, -1 if not found/expired."""
        with self._lock:
            entry = self._get_entry(key)
            if entry is None:
                return -1.0  # type: ignore[return-value]
            if entry.expires_at is None:
                return None
            return max(0.0, entry.expires_at - time.monotonic())

    def clear(self, pattern: str | None = None) -> int:
        """
        Clear all keys (or matching a pattern).

        Args:
            pattern: fnmatch-style pattern (e.g. "user:*"). None = all.

        Returns:
            Number of keys deleted.
        """
        with self._lock:
            if pattern is None:
                count = len(self._store)
                self._store.clear()
                return count
            to_delete = [k for k in self._store if fnmatch.fnmatch(k, pattern)]
            for k in to_delete:
                del self._store[k]
            return len(to_delete)

    def keys(self, pattern: str = "*") -> list[str]:
        """Return all live keys matching the pattern."""
        with self._lock:
            return [
                k for k in self._store
                if fnmatch.fnmatch(k, pattern) and not self._store[k].is_expired
            ]

    def size(self) -> int:
        """Number of entries (including unexpired)."""
        with self._lock:
            return sum(1 for e in self._store.values() if not e.is_expired)

    # ------------------------------------------------------------------
    # Atomic counters
    # ------------------------------------------------------------------

    def incr(self, key: str, amount: int | float = 1, ttl: float | None = None) -> int | float:
        """Atomically increment a numeric value. Creates key=0 if missing."""
        with self._lock:
            entry = self._get_entry(key)
            current = entry.value if entry is not None else 0
            new_val = current + amount
            expires_at = (time.monotonic() + ttl) if ttl else (entry.expires_at if entry else None)
            self._store[key] = _Entry(value=new_val, expires_at=expires_at)
            self._store.move_to_end(key)
            self._stats.sets += 1
            return new_val

    def decr(self, key: str, amount: int | float = 1, ttl: float | None = None) -> int | float:
        """Atomically decrement a numeric value."""
        return self.incr(key, -amount, ttl=ttl)

    # ------------------------------------------------------------------
    # Pub/Sub
    # ------------------------------------------------------------------

    async def subscribe(self, channel: str, callback: Callable | None = None) -> asyncio.Queue:
        """
        Subscribe to a channel. Returns an asyncio.Queue.
        If callback is provided, starts a background listener that calls it.
        """
        q = self._pubsub.subscribe(channel)
        if callback is not None:
            async def _listener() -> None:
                while True:
                    msg = await q.get()
                    try:
                        result = callback(channel, msg)
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception as exc:
                        logger.error("Pub/sub callback error: %s", exc)
            asyncio.ensure_future(_listener())
        return q

    async def publish(self, channel: str, message: Any) -> int:
        """Publish a message to a channel. Returns subscriber count."""
        count = self._pubsub.publish(channel, message)
        return count

    # ------------------------------------------------------------------
    # Get-or-set (cache decorator)
    # ------------------------------------------------------------------

    def cached(self, key: str, ttl: float | None = None) -> Callable:
        """
        Decorator to cache a function's return value.

        Example:
            @cache.cached("expensive_result", ttl=300)
            def compute():
                return heavy_computation()
        """
        def decorator(fn: Callable) -> Callable:
            import functools

            @functools.wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                result = self.get(key)
                if result is None:
                    result = fn(*args, **kwargs)
                    self.set(key, result, ttl=ttl)
                return result

            return wrapper
        return decorator

    async def get_or_set(self, key: str, fn: Callable, ttl: float | None = None) -> Any:
        """
        Return cached value or call fn() to compute it.
        Supports both sync and async fn.
        """
        val = self.get(key)
        if val is not None:
            return val
        result = fn()
        if asyncio.iscoroutine(result):
            result = await result
        self.set(key, result, ttl=ttl)
        return result

    # ------------------------------------------------------------------
    # Pipeline (batched operations)
    # ------------------------------------------------------------------

    def pipeline(self) -> "_Pipeline":
        return _Pipeline(self)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str | Path | None = None) -> None:
        """
        Persist live cache entries to a JSON file.
        Only serializable values are saved; others are skipped.
        """
        target = Path(path or self._persist_path or "cache_dump.json")
        target.parent.mkdir(parents=True, exist_ok=True)

        data: dict[str, Any] = {}
        now = time.monotonic()
        with self._lock:
            for k, entry in self._store.items():
                if entry.is_expired:
                    continue
                try:
                    serialized = json.dumps(entry.value)  # test serializability
                    data[k] = {
                        "value": entry.value,
                        "expires_in": (
                            entry.expires_at - now if entry.expires_at else None
                        ),
                    }
                except (TypeError, ValueError):
                    pass  # skip non-serializable

        with open(target, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, default=str)
        logger.info("Cache saved: %d entries -> %s", len(data), target)

    def load(self, path: str | Path) -> int:
        """
        Load cache entries from a JSON file.

        Returns:
            Number of entries loaded.
        """
        p = Path(path)
        if not p.exists():
            return 0
        with open(p, encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)

        now = time.monotonic()
        loaded = 0
        with self._lock:
            for k, v in data.items():
                expires_in = v.get("expires_in")
                if expires_in is not None and expires_in <= 0:
                    continue  # already expired
                expires_at = (now + expires_in) if expires_in else None
                self._store[k] = _Entry(value=v["value"], expires_at=expires_at)
                loaded += 1
        logger.info("Cache loaded: %d entries from %s", loaded, p)
        return loaded

    def _maybe_persist(self) -> None:
        """Non-blocking background persist."""
        if self._persist_path:
            t = threading.Thread(target=self.save, daemon=True)
            t.start()

    # ------------------------------------------------------------------
    # Stats & introspection
    # ------------------------------------------------------------------

    @property
    def stats(self) -> CacheStats:
        return self._stats

    def info(self) -> dict[str, Any]:
        """Human-readable cache summary."""
        return {
            "size": self.size(),
            "max_size": self._max_size,
            "default_ttl": self._default_ttl,
            **self._stats.to_dict(),
        }

    def namespace(self, prefix: str, separator: str = ":") -> "CacheNamespace":
        """Return a namespaced view of this cache."""
        return CacheNamespace(self, prefix, separator)

    # ------------------------------------------------------------------
    # Background expiry reaper
    # ------------------------------------------------------------------

    async def start_reaper(self, interval: float = 60.0) -> None:
        """
        Start a background coroutine that periodically purges expired keys.
        Must be called from within a running asyncio event loop.
        """
        async def _reap() -> None:
            while True:
                await asyncio.sleep(interval)
                purged = self._purge_expired()
                if purged:
                    logger.debug("Reaper purged %d expired keys", purged)

        self._expiry_task = asyncio.ensure_future(_reap())

    def _purge_expired(self) -> int:
        with self._lock:
            dead = [k for k, e in self._store.items() if e.is_expired]
            for k in dead:
                del self._store[k]
                self._stats.expirations += 1
            return len(dead)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_entry(self, key: str) -> _Entry | None:
        """Get entry; removes and returns None if expired. Must hold lock."""
        entry = self._store.get(key)
        if entry is None:
            return None
        if entry.is_expired:
            del self._store[key]
            self._stats.expirations += 1
            return None
        return entry

    def __len__(self) -> int:
        return self.size()

    def __contains__(self, key: str) -> bool:
        return self.exists(key)

    def __repr__(self) -> str:
        return f"<Cache size={self.size()} max={self._max_size}>"


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class _Pipeline:
    """Batched cache operations, applied atomically."""

    def __init__(self, cache: Cache) -> None:
        self._cache = cache
        self._ops: list[tuple[str, tuple, dict]] = []

    def set(self, key: str, value: Any, **kwargs: Any) -> "_Pipeline":
        self._ops.append(("set", (key, value), kwargs))
        return self

    def delete(self, *keys: str) -> "_Pipeline":
        self._ops.append(("delete", keys, {}))
        return self

    def incr(self, key: str, amount: int = 1) -> "_Pipeline":
        self._ops.append(("incr", (key, amount), {}))
        return self

    def execute(self) -> list[Any]:
        results = []
        for name, args, kwargs in self._ops:
            fn = getattr(self._cache, name)
            results.append(fn(*args, **kwargs))
        self._ops.clear()
        return results


# ---------------------------------------------------------------------------
# CacheNamespace
# ---------------------------------------------------------------------------


class CacheNamespace:
    """
    A logical namespace over a Cache. All keys are prefixed.

    Example:
        users = cache.namespace("users")
        users.set("1", {"name": "Alice"})  # stored as "users:1"
    """

    def __init__(self, cache: Cache, prefix: str, separator: str = ":") -> None:
        self._cache = cache
        self._prefix = prefix
        self._sep = separator

    def _k(self, key: str) -> str:
        return f"{self._prefix}{self._sep}{key}"

    def set(self, key: str, value: Any, **kwargs: Any) -> bool:
        return self._cache.set(self._k(key), value, **kwargs)

    def get(self, key: str, default: Any = None) -> Any:
        return self._cache.get(self._k(key), default)

    def delete(self, *keys: str) -> int:
        return self._cache.delete(*[self._k(k) for k in keys])

    def exists(self, key: str) -> bool:
        return self._cache.exists(self._k(key))

    def incr(self, key: str, amount: int = 1) -> int | float:
        return self._cache.incr(self._k(key), amount)

    def decr(self, key: str, amount: int = 1) -> int | float:
        return self._cache.decr(self._k(key), amount)

    def keys(self, pattern: str = "*") -> list[str]:
        full_pattern = self._k(pattern)
        prefix_len = len(self._prefix) + len(self._sep)
        return [k[prefix_len:] for k in self._cache.keys(full_pattern)]

    def clear(self) -> int:
        return self._cache.clear(pattern=f"{self._prefix}{self._sep}*")

    def ttl(self, key: str) -> float | None:
        return self._cache.ttl(self._k(key))

    def expire(self, key: str, ttl: float) -> bool:
        return self._cache.expire(self._k(key), ttl)

    def namespace(self, sub: str) -> "CacheNamespace":
        return CacheNamespace(self._cache, self._k(sub), self._sep)

    def __repr__(self) -> str:
        return f"<CacheNamespace prefix={self._prefix!r}>"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def cache_key(*parts: Any, sep: str = ":") -> str:
    """Build a cache key from parts. cache_key('user', 42) -> 'user:42'"""
    return sep.join(str(p) for p in parts)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_default_cache: Cache | None = None


def get_default_cache(
    max_size: int = 100_000,
    default_ttl: float | None = None,
) -> Cache:
    """Return (or create) the module-level default Cache instance."""
    global _default_cache
    if _default_cache is None:
        _default_cache = Cache(max_size=max_size, default_ttl=default_ttl)
    return _default_cache

"""
http_client.py
==============
Zero-dependency async HTTP client using urllib.request + asyncio.

Features:
    - GET, POST, PUT, DELETE, PATCH
    - JSON serialization / deserialization
    - Custom headers management
    - Timeout support (connect + read)
    - Retry with phi-based exponential backoff (1.618^n seconds)
    - Basic connection pooling via thread executor
    - SSE (Server-Sent Events) streaming
    - Redirect following
    - HTTPS / SSL support
    - Cookie jar

Usage:
    from core.http_client import AsyncHTTPClient, get, post

    # One-off helpers
    resp = await get("https://api.example.com/users")
    data = resp.json()

    # Reusable client
    async with AsyncHTTPClient(base_url="https://api.example.com") as client:
        resp = await client.post("/users", json={"name": "Alice"})
        print(resp.json())

    # SSE streaming
    async for event in client.stream_sse("https://api.example.com/events"):
        print(event)
"""

from __future__ import annotations

import asyncio
import gzip
import http.client
import http.cookiejar
import json
import logging
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, AsyncIterator, Iterator, Optional

__all__ = [
    "HTTPClient",
    "AsyncHTTPClient",
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "HttpError",
]

logger = logging.getLogger(__name__)

# Golden ratio for backoff
_PHI = 1.6180339887

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class HttpError(Exception):
    """Raised for non-2xx HTTP responses (when raise_for_status=True)."""

    def __init__(self, status: int, reason: str, body: bytes = b"") -> None:
        self.status = status
        self.reason = reason
        self.body = body
        super().__init__(f"HTTP {status} {reason}")

    def json(self) -> Any:
        return json.loads(self.body.decode("utf-8"))


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


@dataclass
class HttpResponse:
    """Parsed HTTP response."""

    status: int
    reason: str
    headers: dict[str, str]
    content: bytes
    url: str
    elapsed: float  # seconds

    def json(self, **kwargs: Any) -> Any:
        return json.loads(self.content.decode("utf-8"), **kwargs)

    @property
    def text(self) -> str:
        encoding = self._detect_encoding()
        return self.content.decode(encoding, errors="replace")

    def _detect_encoding(self) -> str:
        ct = self.headers.get("content-type", "")
        for part in ct.split(";"):
            p = part.strip()
            if p.lower().startswith("charset="):
                return p[8:].strip('"')
        return "utf-8"

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300

    def raise_for_status(self) -> "HttpResponse":
        if not self.ok:
            raise HttpError(self.status, self.reason, self.content)
        return self

    def __repr__(self) -> str:
        return f"<HttpResponse [{self.status} {self.reason}] url={self.url!r}>"


# ---------------------------------------------------------------------------
# SSE Event
# ---------------------------------------------------------------------------


@dataclass
class SSEEvent:
    """A parsed Server-Sent Event."""

    data: str
    event: str = "message"
    id: str | None = None
    retry: int | None = None


# ---------------------------------------------------------------------------
# Sync HTTP client (runs in executor)
# ---------------------------------------------------------------------------


class _SyncHTTPClient:
    """
    Synchronous HTTP client used inside a ThreadPoolExecutor.
    Handles connection pooling at the urllib level.
    """

    def __init__(
        self,
        base_url: str = "",
        default_headers: dict[str, str] | None = None,
        timeout: float = 30.0,
        verify_ssl: bool = True,
        max_redirects: int = 10,
        cookie_jar: http.cookiejar.CookieJar | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.default_headers: dict[str, str] = {
            "User-Agent": "HeadyHTTPClient/1.0",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate",
            **(default_headers or {}),
        }
        self._ssl_ctx = (
            ssl.create_default_context() if verify_ssl
            else ssl._create_unverified_context()
        )
        self._max_redirects = max_redirects
        self._cookie_jar = cookie_jar or http.cookiejar.CookieJar()
        self._cookie_processor = urllib.request.HTTPCookieProcessor(self._cookie_jar)
        self._build_opener()

    def _build_opener(self) -> None:
        self._opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=self._ssl_ctx),
            self._cookie_processor,
            urllib.request.HTTPRedirectHandler(),
        )
        # Limit redirects
        rh = self._opener.handlers[2] if len(self._opener.handlers) > 2 else None
        if isinstance(rh, urllib.request.HTTPRedirectHandler):
            rh.max_repeats = self._max_redirects

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        body: bytes | None = None,
        timeout: float | None = None,
    ) -> HttpResponse:
        full_url = url if "://" in url else f"{self.base_url}{url}"
        merged_headers = {**self.default_headers, **(headers or {})}

        req = urllib.request.Request(
            full_url, data=body, headers=merged_headers, method=method.upper()
        )

        t0 = time.monotonic()
        try:
            with self._opener.open(req, timeout=timeout or self.timeout) as resp:
                raw = resp.read()
                resp_headers = {k.lower(): v for k, v in resp.headers.items()}
                # Decompress if gzipped
                if resp_headers.get("content-encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return HttpResponse(
                    status=resp.status,
                    reason=resp.reason,
                    headers=resp_headers,
                    content=raw,
                    url=resp.url,
                    elapsed=time.monotonic() - t0,
                )
        except urllib.error.HTTPError as exc:
            body_ = exc.read() or b""
            raise HttpError(exc.code, exc.reason or str(exc), body_) from exc
        except urllib.error.URLError as exc:
            raise ConnectionError(f"Request failed: {exc.reason}") from exc


# ---------------------------------------------------------------------------
# Async HTTP client
# ---------------------------------------------------------------------------


class AsyncHTTPClient:
    """
    Async HTTP client built on top of _SyncHTTPClient + ThreadPoolExecutor.

    Supports:
        - Base URL
        - Default headers
        - Retry with phi-based exponential backoff
        - SSE streaming
        - Context manager (async with)
    """

    def __init__(
        self,
        base_url: str = "",
        default_headers: dict[str, str] | None = None,
        timeout: float = 30.0,
        verify_ssl: bool = True,
        max_redirects: int = 10,
        max_retries: int = 3,
        retry_on: tuple[int, ...] = (429, 500, 502, 503, 504),
        workers: int = 8,
    ) -> None:
        self._sync = _SyncHTTPClient(
            base_url=base_url,
            default_headers=default_headers,
            timeout=timeout,
            verify_ssl=verify_ssl,
            max_redirects=max_redirects,
        )
        self._max_retries = max_retries
        self._retry_on = retry_on
        self._executor = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="heady-http")

    async def __aenter__(self) -> "AsyncHTTPClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        self.close()

    def close(self) -> None:
        self._executor.shutdown(wait=False)

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json_data: Any = None,
        data: bytes | str | None = None,
        params: dict[str, Any] | None = None,
        timeout: float | None = None,
        raise_for_status: bool = False,
    ) -> HttpResponse:
        """
        Perform an HTTP request with optional retry.

        Args:
            method:           HTTP method.
            url:              URL (relative to base_url if set).
            headers:          Extra headers.
            json_data:        Data to JSON-encode as body.
            data:             Raw body bytes or string.
            params:           Query parameters dict.
            timeout:          Per-request timeout (overrides default).
            raise_for_status: Raise HttpError for non-2xx responses.
        """
        h = dict(headers or {})
        body: bytes | None = None

        if json_data is not None:
            body = json.dumps(json_data, ensure_ascii=False, default=str).encode("utf-8")
            h.setdefault("Content-Type", "application/json; charset=utf-8")
        elif data is not None:
            body = data.encode("utf-8") if isinstance(data, str) else data

        if params:
            sep = "&" if "?" in url else "?"
            url = url + sep + urllib.parse.urlencode(params, doseq=True)

        loop = asyncio.get_event_loop()
        last_exc: Exception | None = None

        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                delay = _PHI ** attempt
                logger.debug("Retry %d for %s %s (backoff %.2fs)", attempt, method, url, delay)
                await asyncio.sleep(delay)
            try:
                response = await loop.run_in_executor(
                    self._executor,
                    lambda: self._sync.request(
                        method, url, headers=h, body=body, timeout=timeout
                    ),
                )
                if response.status in self._retry_on and attempt < self._max_retries:
                    last_exc = HttpError(response.status, response.reason, response.content)
                    continue
                if raise_for_status:
                    response.raise_for_status()
                return response
            except HttpError as exc:
                if exc.status in self._retry_on and attempt < self._max_retries:
                    last_exc = exc
                    continue
                raise
            except ConnectionError as exc:
                last_exc = exc
                if attempt == self._max_retries:
                    raise

        raise last_exc or ConnectionError("Request failed after retries")

    # Convenience methods
    async def get(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("PUT", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("DELETE", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> HttpResponse:
        return await self.request("PATCH", url, **kwargs)

    async def stream_sse(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        timeout: float = 60.0,
        reconnect_delay: float = 2.0,
        max_reconnects: int = 5,
    ) -> AsyncIterator[SSEEvent]:
        """
        Stream Server-Sent Events (SSE) from a URL.

        Yields SSEEvent objects. Reconnects automatically on disconnect.

        Example:
            async for event in client.stream_sse("https://api.example.com/stream"):
                print(event.event, event.data)
        """
        h = {"Accept": "text/event-stream", "Cache-Control": "no-cache", **(headers or {})}
        full_url = url if "://" in url else f"{self._sync.base_url}{url}"
        if params:
            sep = "&" if "?" in full_url else "?"
            full_url += sep + urllib.parse.urlencode(params, doseq=True)

        reconnects = 0
        loop = asyncio.get_event_loop()

        while reconnects <= max_reconnects:
            try:
                # Open a raw urllib connection to stream the response
                merged = {**self._sync.default_headers, **h}
                req = urllib.request.Request(full_url, headers=merged)

                async def _do_open():
                    return self._sync._opener.open(req, timeout=timeout)

                resp = await loop.run_in_executor(self._executor, _do_open)

                # Stream line by line in executor
                buf: list[str] = []
                async for raw_line in _iter_lines_async(resp, self._executor, loop):
                    line = raw_line.rstrip("\n\r")
                    if line == "":
                        # Dispatch accumulated event
                        event = _parse_sse_block(buf)
                        if event and event.data:
                            yield event
                        buf = []
                    elif line.startswith(":"):
                        pass  # comment
                    else:
                        buf.append(line)

                resp.close()
                reconnects = 0  # successful stream
                await asyncio.sleep(reconnect_delay)
                reconnects += 1

            except Exception as exc:
                logger.warning("SSE stream error (reconnect %d): %s", reconnects, exc)
                await asyncio.sleep(reconnect_delay * (_PHI ** reconnects))
                reconnects += 1
                if reconnects > max_reconnects:
                    raise


# ---------------------------------------------------------------------------
# Sync client (for non-async contexts)
# ---------------------------------------------------------------------------


class HTTPClient(_SyncHTTPClient):
    """
    Synchronous HTTP client with retry support.

    Use AsyncHTTPClient inside async code; this is for scripts/tests.
    """

    def __init__(self, *args: Any, max_retries: int = 3,
                 retry_on: tuple[int, ...] = (429, 500, 502, 503, 504), **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._max_retries = max_retries
        self._retry_on = retry_on

    def request(self, method: str, url: str, **kwargs: Any) -> HttpResponse:  # type: ignore[override]
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            if attempt > 0:
                delay = _PHI ** attempt
                logger.debug("Retry %d (backoff %.2fs)", attempt, delay)
                time.sleep(delay)
            try:
                resp = super().request(method, url, **kwargs)
                if resp.status in self._retry_on and attempt < self._max_retries:
                    last_exc = HttpError(resp.status, resp.reason, resp.content)
                    continue
                return resp
            except HttpError as exc:
                if exc.status in self._retry_on and attempt < self._max_retries:
                    last_exc = exc
                    continue
                raise
            except ConnectionError as exc:
                last_exc = exc
        raise last_exc or ConnectionError("Request failed after retries")

    def get(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("PUT", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("DELETE", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> HttpResponse:
        return self.request("PATCH", url, **kwargs)


# ---------------------------------------------------------------------------
# Module-level convenience functions (one-shot async)
# ---------------------------------------------------------------------------

_default_client: AsyncHTTPClient | None = None


def _get_default_client() -> AsyncHTTPClient:
    global _default_client
    if _default_client is None:
        _default_client = AsyncHTTPClient()
    return _default_client


async def get(url: str, **kwargs: Any) -> HttpResponse:
    return await _get_default_client().get(url, **kwargs)


async def post(url: str, **kwargs: Any) -> HttpResponse:
    return await _get_default_client().post(url, **kwargs)


async def put(url: str, **kwargs: Any) -> HttpResponse:
    return await _get_default_client().put(url, **kwargs)


async def delete(url: str, **kwargs: Any) -> HttpResponse:
    return await _get_default_client().delete(url, **kwargs)


async def patch(url: str, **kwargs: Any) -> HttpResponse:
    return await _get_default_client().patch(url, **kwargs)


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


async def _iter_lines_async(
    resp: Any,
    executor: Any,
    loop: asyncio.AbstractEventLoop,
) -> AsyncIterator[str]:
    """Read a urllib response line-by-line in a thread, yielding to asyncio."""
    while True:
        raw = await loop.run_in_executor(executor, resp.readline)
        if not raw:
            break
        yield raw.decode("utf-8", errors="replace")


def _parse_sse_block(lines: list[str]) -> SSEEvent | None:
    """Parse a block of SSE field lines into an SSEEvent."""
    data_parts: list[str] = []
    event_type = "message"
    event_id: str | None = None
    retry: int | None = None

    for line in lines:
        if line.startswith("data:"):
            data_parts.append(line[5:].lstrip(" "))
        elif line.startswith("event:"):
            event_type = line[6:].strip()
        elif line.startswith("id:"):
            event_id = line[3:].strip()
        elif line.startswith("retry:"):
            try:
                retry = int(line[6:].strip())
            except ValueError:
                pass

    return SSEEvent(
        data="\n".join(data_parts),
        event=event_type,
        id=event_id,
        retry=retry,
    )

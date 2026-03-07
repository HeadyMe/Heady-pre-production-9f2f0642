"""
http_server.py
==============
Zero-dependency async HTTP/1.1 server using asyncio + stdlib only.

Features:
    - Decorator-based route registration  (@route, @get, @post, etc.)
    - JSON body auto-parsing
    - CORS support (configurable origins, methods, headers)
    - Request / Response objects
    - Middleware chain (like WSGI/ASGI middleware)
    - Static file serving
    - Basic WebSocket upgrade (RFC 6455)
    - /health endpoint auto-registered
    - Graceful shutdown on SIGTERM/SIGINT
    - Streaming responses
    - Path parameters: /users/{id}

Usage:
    from core.http_server import HTTPServer, JSONResponse

    server = HTTPServer(host="0.0.0.0", port=8000)

    @server.route("/hello", methods=["GET"])
    async def hello(request):
        return JSONResponse({"message": "Hello, world!"})

    server.run()
"""

from __future__ import annotations

import asyncio
import base64
import gzip
import hashlib
import json
import logging
import mimetypes
import os
import re
import signal
import socket
import ssl
import sys
import traceback
import urllib.parse
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional, Union

__all__ = [
    "HTTPServer",
    "Request",
    "Response",
    "Router",
    "route",
    "middleware",
    "JSONResponse",
    "TextResponse",
    "StreamingResponse",
]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HTTP_METHODS = frozenset({"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"})
WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
CRLF = b"\r\n"
MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10 MB
CHUNK_SIZE = 65536

# ---------------------------------------------------------------------------
# Request / Response
# ---------------------------------------------------------------------------


@dataclass
class Request:
    """Incoming HTTP request."""

    method: str
    path: str
    query_string: str
    headers: dict[str, str]
    body: bytes
    remote_addr: str
    path_params: dict[str, str] = field(default_factory=dict)
    _json_cache: Any = field(default=None, init=False, repr=False)
    _query_cache: dict | None = field(default=None, init=False, repr=False)

    @property
    def query_params(self) -> dict[str, list[str]]:
        if self._query_cache is None:
            self._query_cache = urllib.parse.parse_qs(
                self.query_string, keep_blank_values=True
            )
        return self._query_cache

    def query(self, key: str, default: str | None = None) -> str | None:
        vals = self.query_params.get(key)
        return vals[0] if vals else default

    @property
    def json(self) -> Any:
        if self._json_cache is None and self.body:
            self._json_cache = json.loads(self.body.decode("utf-8"))
        return self._json_cache

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "")

    @property
    def is_json(self) -> bool:
        return "application/json" in self.content_type

    @property
    def is_websocket(self) -> bool:
        return (
            self.headers.get("upgrade", "").lower() == "websocket"
            and "upgrade" in self.headers.get("connection", "").lower()
        )

    def header(self, name: str, default: str | None = None) -> str | None:
        return self.headers.get(name.lower(), default)


class Response:
    """Outgoing HTTP response."""

    def __init__(
        self,
        body: bytes | str = b"",
        status: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.body = body
        self.status = status
        self.headers: dict[str, str] = headers or {}

    def set_header(self, key: str, value: str) -> "Response":
        self.headers[key] = value
        return self

    def set_cookie(
        self,
        name: str,
        value: str,
        max_age: int | None = None,
        path: str = "/",
        http_only: bool = True,
        secure: bool = False,
        same_site: str = "Lax",
    ) -> "Response":
        cookie = f"{name}={value}; Path={path}; SameSite={same_site}"
        if max_age is not None:
            cookie += f"; Max-Age={max_age}"
        if http_only:
            cookie += "; HttpOnly"
        if secure:
            cookie += "; Secure"
        self.headers["Set-Cookie"] = cookie
        return self

    def _render(self, extra_headers: dict[str, str] | None = None) -> bytes:
        """Serialize to HTTP/1.1 response bytes."""
        status_text = _STATUS_PHRASES.get(self.status, "Unknown")
        lines = [f"HTTP/1.1 {self.status} {status_text}".encode()]
        headers = {
            "Content-Length": str(len(self.body)),
            "Connection": "keep-alive",
            "Date": _http_date(),
            "Server": "HeadyHTTP/1.0",
        }
        headers.update(self.headers)
        if extra_headers:
            headers.update(extra_headers)
        for k, v in headers.items():
            lines.append(f"{k}: {v}".encode())
        lines.append(b"")
        lines.append(self.body)
        return CRLF.join(lines)


class JSONResponse(Response):
    """Convenience response for JSON data."""

    def __init__(
        self,
        data: Any,
        status: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        h = {"Content-Type": "application/json; charset=utf-8"}
        if headers:
            h.update(headers)
        super().__init__(body=body, status=status, headers=h)


class TextResponse(Response):
    """Convenience response for plain text."""

    def __init__(self, text: str, status: int = 200, headers: dict[str, str] | None = None) -> None:
        h = {"Content-Type": "text/plain; charset=utf-8"}
        if headers:
            h.update(headers)
        super().__init__(body=text.encode("utf-8"), status=status, headers=h)


class StreamingResponse(Response):
    """
    Response with a streaming body. The generator yields bytes chunks.
    Content-Length is not set; Transfer-Encoding: chunked is used.
    """

    def __init__(
        self,
        generator: Callable[[], Any],  # async generator
        status: int = 200,
        headers: dict[str, str] | None = None,
        media_type: str = "application/octet-stream",
    ) -> None:
        h = {"Content-Type": media_type, "Transfer-Encoding": "chunked"}
        if headers:
            h.update(headers)
        super().__init__(body=b"", status=status, headers=h)
        self._generator = generator

    async def stream_to(self, writer: asyncio.StreamWriter) -> None:
        async for chunk in self._generator():
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            size = f"{len(chunk):X}\r\n".encode()
            writer.write(size + chunk + CRLF)
            await writer.drain()
        writer.write(b"0\r\n\r\n")
        await writer.drain()


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------


class WebSocket:
    """Minimal RFC 6455 WebSocket connection."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        self._reader = reader
        self._writer = writer
        self.closed = False

    async def send(self, data: str | bytes) -> None:
        if self.closed:
            return
        if isinstance(data, str):
            opcode = 0x1
            payload = data.encode("utf-8")
        else:
            opcode = 0x2
            payload = data
        frame = _ws_encode_frame(payload, opcode)
        self._writer.write(frame)
        await self._writer.drain()

    async def recv(self) -> str | bytes | None:
        try:
            return await _ws_decode_frame(self._reader)
        except (asyncio.IncompleteReadError, ConnectionError):
            self.closed = True
            return None

    async def close(self, code: int = 1000, reason: str = "") -> None:
        if not self.closed:
            self.closed = True
            payload = code.to_bytes(2, "big") + reason.encode("utf-8")
            frame = _ws_encode_frame(payload, 0x8)
            try:
                self._writer.write(frame)
                await self._writer.drain()
                self._writer.close()
            except Exception:
                pass


def _ws_encode_frame(payload: bytes, opcode: int) -> bytes:
    header = bytes([0x80 | opcode])
    n = len(payload)
    if n < 126:
        header += bytes([n])
    elif n < 65536:
        header += bytes([126]) + n.to_bytes(2, "big")
    else:
        header += bytes([127]) + n.to_bytes(8, "big")
    return header + payload


async def _ws_decode_frame(reader: asyncio.StreamReader) -> str | bytes:
    header = await reader.readexactly(2)
    fin = (header[0] & 0x80) != 0
    opcode = header[0] & 0x0F
    masked = (header[1] & 0x80) != 0
    length = header[1] & 0x7F
    if length == 126:
        length = int.from_bytes(await reader.readexactly(2), "big")
    elif length == 127:
        length = int.from_bytes(await reader.readexactly(8), "big")
    if masked:
        mask = await reader.readexactly(4)
        data = bytearray(await reader.readexactly(length))
        for i in range(length):
            data[i] ^= mask[i % 4]
        payload = bytes(data)
    else:
        payload = await reader.readexactly(length)
    if opcode == 0x1:
        return payload.decode("utf-8")
    elif opcode == 0x8:
        raise ConnectionError("WebSocket closed by peer")
    return payload


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


@dataclass
class _Route:
    pattern: re.Pattern
    methods: frozenset[str]
    handler: Callable
    original_path: str
    is_websocket: bool = False


def _path_to_pattern(path: str) -> re.Pattern:
    """Convert /users/{id}/posts to a regex with named groups."""
    escaped = re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", re.escape(path).replace(r"\{", "{").replace(r"\}", "}"))
    # re.escape will have escaped { } — handle that:
    pattern = re.escape(path)
    pattern = re.sub(r"\\\{(\w+)\\\}", r"(?P<\1>[^/]+)", pattern)
    return re.compile(f"^{pattern}$")


class Router:
    """Route registry supporting path params and multiple HTTP methods."""

    def __init__(self) -> None:
        self._routes: list[_Route] = []
        self._middleware: list[Callable] = []

    def add_route(
        self,
        path: str,
        handler: Callable,
        methods: list[str] | None = None,
        is_websocket: bool = False,
    ) -> None:
        if methods is None:
            methods = ["GET"]
        self._routes.append(
            _Route(
                pattern=_path_to_pattern(path),
                methods=frozenset(m.upper() for m in methods),
                handler=handler,
                original_path=path,
                is_websocket=is_websocket,
            )
        )

    def route(
        self,
        path: str,
        methods: list[str] | None = None,
    ) -> Callable:
        """Decorator factory: @router.route('/path', methods=['GET','POST'])"""
        def decorator(fn: Callable) -> Callable:
            self.add_route(path, fn, methods=methods or ["GET"])
            return fn
        return decorator

    def ws(self, path: str) -> Callable:
        """Decorator for WebSocket handlers: @router.ws('/ws')"""
        def decorator(fn: Callable) -> Callable:
            self.add_route(path, fn, methods=["GET"], is_websocket=True)
            return fn
        return decorator

    def add_middleware(self, fn: Callable) -> None:
        self._middleware.append(fn)

    def match(self, path: str, method: str) -> tuple[_Route | None, dict[str, str]]:
        for r in self._routes:
            m = r.pattern.match(path)
            if m and (method in r.methods or "*" in r.methods):
                return r, m.groupdict()
        return None, {}

    def get_routes(self) -> list[_Route]:
        return list(self._routes)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


@dataclass
class CORSConfig:
    allow_origins: list[str] = field(default_factory=lambda: ["*"])
    allow_methods: list[str] = field(default_factory=lambda: ["*"])
    allow_headers: list[str] = field(default_factory=lambda: ["*"])
    allow_credentials: bool = False
    max_age: int = 600

    def headers_for(self, origin: str) -> dict[str, str]:
        allowed = (
            origin
            if ("*" in self.allow_origins or origin in self.allow_origins)
            else ""
        )
        h: dict[str, str] = {
            "Access-Control-Allow-Origin": allowed or "*",
            "Access-Control-Allow-Methods": ", ".join(self.allow_methods),
            "Access-Control-Allow-Headers": ", ".join(self.allow_headers),
            "Access-Control-Max-Age": str(self.max_age),
            "Vary": "Origin",
        }
        if self.allow_credentials:
            h["Access-Control-Allow-Credentials"] = "true"
        return h


# ---------------------------------------------------------------------------
# Request parsing
# ---------------------------------------------------------------------------


async def _parse_request(
    reader: asyncio.StreamReader, remote_addr: str
) -> Request | None:
    """Read and parse an HTTP/1.1 request from the stream."""
    try:
        # Read request line
        raw_line = await asyncio.wait_for(reader.readline(), timeout=30.0)
    except (asyncio.TimeoutError, asyncio.IncompleteReadError):
        return None

    if not raw_line or raw_line == CRLF:
        return None

    try:
        request_line = raw_line.decode("latin-1").rstrip("\r\n")
        parts = request_line.split(" ", 2)
        if len(parts) != 3:
            return None
        method, full_path, _ = parts
    except Exception:
        return None

    # Parse path + query string
    parsed = urllib.parse.urlsplit(full_path)
    path = urllib.parse.unquote(parsed.path) or "/"
    query_string = parsed.query or ""

    # Read headers
    headers: dict[str, str] = {}
    while True:
        try:
            line = await asyncio.wait_for(reader.readline(), timeout=10.0)
        except asyncio.TimeoutError:
            return None
        if line in (CRLF, b"\n", b""):
            break
        decoded = line.decode("latin-1").rstrip("\r\n")
        if ":" in decoded:
            k, _, v = decoded.partition(":")
            headers[k.strip().lower()] = v.strip()

    # Read body
    body = b""
    content_length = int(headers.get("content-length", 0))
    if content_length > 0:
        if content_length > MAX_REQUEST_SIZE:
            return None
        try:
            body = await asyncio.wait_for(
                reader.readexactly(content_length), timeout=30.0
            )
        except (asyncio.TimeoutError, asyncio.IncompleteReadError):
            return None

    return Request(
        method=method.upper(),
        path=path,
        query_string=query_string,
        headers=headers,
        body=body,
        remote_addr=remote_addr,
    )


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------


class HTTPServer:
    """
    Production-quality async HTTP/1.1 server.

    Example:
        server = HTTPServer(host="0.0.0.0", port=8000, cors=True)

        @server.route("/api/hello", methods=["GET"])
        async def hello(req):
            return JSONResponse({"hello": "world"})

        server.run()
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8000,
        cors: bool | CORSConfig = True,
        static_dir: str | Path | None = None,
        static_prefix: str = "/static",
        max_connections: int = 1000,
        keep_alive_timeout: float = 75.0,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.static_dir = Path(static_dir) if static_dir else None
        self.static_prefix = static_prefix
        self.max_connections = max_connections
        self.keep_alive_timeout = keep_alive_timeout
        self.ssl_context = ssl_context

        self._router = Router()
        self._global_middleware: list[Callable] = []
        self._startup_handlers: list[Callable] = []
        self._shutdown_handlers: list[Callable] = []
        self._cors: CORSConfig | None = None
        self._server: asyncio.AbstractServer | None = None
        self._active_connections: set[asyncio.Task] = set()
        self._shutting_down = False

        if cors is True:
            self._cors = CORSConfig()
        elif isinstance(cors, CORSConfig):
            self._cors = cors

        # Auto-register /health
        self._register_health()

    # ------------------------------------------------------------------
    # Route / middleware registration
    # ------------------------------------------------------------------

    def route(self, path: str, methods: list[str] | None = None) -> Callable:
        """Decorator: @server.route('/path', methods=['GET'])"""
        return self._router.route(path, methods=methods or ["GET"])

    def get(self, path: str) -> Callable:
        return self._router.route(path, methods=["GET"])

    def post(self, path: str) -> Callable:
        return self._router.route(path, methods=["POST"])

    def put(self, path: str) -> Callable:
        return self._router.route(path, methods=["PUT"])

    def delete(self, path: str) -> Callable:
        return self._router.route(path, methods=["DELETE"])

    def patch(self, path: str) -> Callable:
        return self._router.route(path, methods=["PATCH"])

    def ws(self, path: str) -> Callable:
        """Decorator for WebSocket endpoint."""
        return self._router.ws(path)

    def use(self, fn: Callable) -> None:
        """Register a global middleware function."""
        self._global_middleware.append(fn)

    def on_startup(self, fn: Callable) -> Callable:
        self._startup_handlers.append(fn)
        return fn

    def on_shutdown(self, fn: Callable) -> Callable:
        self._shutdown_handlers.append(fn)
        return fn

    def include_router(self, router: Router) -> None:
        """Merge another router's routes into this server."""
        for r in router.get_routes():
            self._router.add_route(
                r.original_path, r.handler,
                methods=list(r.methods),
                is_websocket=r.is_websocket,
            )

    # ------------------------------------------------------------------
    # Built-in endpoints
    # ------------------------------------------------------------------

    def _register_health(self) -> None:
        @self._router.route("/health", methods=["GET"])
        async def _health(_req: Request) -> JSONResponse:
            return JSONResponse({
                "status": "ok",
                "time": datetime.now(timezone.utc).isoformat(),
                "routes": len(self._router.get_routes()),
            })

    # ------------------------------------------------------------------
    # Connection handling
    # ------------------------------------------------------------------

    async def _handle_connection(
        self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter
    ) -> None:
        """Handle a single TCP connection (keep-alive loop)."""
        peername = writer.get_extra_info("peername")
        remote_addr = f"{peername[0]}:{peername[1]}" if peername else "unknown"

        try:
            while not self._shutting_down:
                request = await _parse_request(reader, remote_addr)
                if request is None:
                    break

                response = await self._dispatch(request, reader, writer)

                # WebSocket upgrade was handled inside dispatch — stop HTTP loop
                if response is None:
                    break

                raw = response._render(
                    self._cors.headers_for(request.headers.get("origin", "*"))
                    if self._cors
                    else None
                )

                if isinstance(response, StreamingResponse):
                    # Write headers first (without body), then stream
                    header_end = raw.find(b"\r\n\r\n") + 4
                    writer.write(raw[:header_end])
                    await writer.drain()
                    await response.stream_to(writer)
                else:
                    writer.write(raw)
                    await writer.drain()

                # Check Connection header
                conn = request.headers.get("connection", "keep-alive").lower()
                if conn == "close" or request.headers.get("http-version", "HTTP/1.1") == "HTTP/1.0":
                    break

        except (ConnectionResetError, BrokenPipeError, asyncio.CancelledError):
            pass
        except Exception as exc:
            logger.error("Connection error from %s: %s", remote_addr, exc, exc_info=True)
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _dispatch(
        self,
        request: Request,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> Response | None:
        """Route the request and invoke middleware chain."""
        # CORS preflight
        if request.method == "OPTIONS" and self._cors:
            origin = request.headers.get("origin", "*")
            return Response(
                status=204,
                headers=self._cors.headers_for(origin),
            )

        # Static files
        if self.static_dir and request.path.startswith(self.static_prefix):
            rel = request.path[len(self.static_prefix):]
            resp = await self._serve_static(rel)
            if resp:
                return resp

        matched_route, path_params = self._router.match(request.path, request.method)

        # 404 / 405
        if matched_route is None:
            # Check if path exists but method wrong
            any_match = any(
                r.pattern.match(request.path) for r in self._router.get_routes()
            )
            if any_match:
                return JSONResponse(
                    {"error": "Method Not Allowed"}, status=405,
                    headers={"Allow": "GET, POST, PUT, DELETE, PATCH, OPTIONS"},
                )
            return JSONResponse({"error": "Not Found", "path": request.path}, status=404)

        request.path_params = path_params

        # WebSocket upgrade
        if matched_route.is_websocket and request.is_websocket:
            await self._upgrade_websocket(request, reader, writer, matched_route.handler)
            return None

        # Build handler chain with middleware
        handler = matched_route.handler
        all_middleware = self._global_middleware + self._router._middleware

        async def call_handler(req: Request) -> Response:
            return await _ensure_awaitable(handler(req))

        chain = call_handler
        for mw in reversed(all_middleware):
            _next = chain
            async def make_mw(req: Request, _mw=mw, _n=_next) -> Response:
                return await _ensure_awaitable(_mw(req, _n))
            chain = make_mw

        try:
            response = await chain(request)
            if not isinstance(response, Response):
                # Auto-wrap dict/list as JSON
                if isinstance(response, (dict, list)):
                    response = JSONResponse(response)
                else:
                    response = TextResponse(str(response))
            return response
        except Exception as exc:
            logger.error(
                "Handler error [%s %s]: %s",
                request.method, request.path, exc,
                exc_info=True,
            )
            return JSONResponse(
                {"error": "Internal Server Error", "detail": str(exc)}, status=500
            )

    async def _upgrade_websocket(
        self,
        request: Request,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        handler: Callable,
    ) -> None:
        """Perform the WebSocket handshake and hand off to handler."""
        key = request.headers.get("sec-websocket-key", "")
        accept = base64.b64encode(
            hashlib.sha1((key + WS_MAGIC).encode()).digest()
        ).decode()
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "\r\n"
        )
        writer.write(response.encode())
        await writer.drain()
        ws = WebSocket(reader, writer)
        try:
            await handler(request, ws)
        except Exception as exc:
            logger.error("WebSocket handler error: %s", exc, exc_info=True)
        finally:
            await ws.close()

    async def _serve_static(self, rel_path: str) -> Response | None:
        """Serve a file from the static directory."""
        safe = rel_path.lstrip("/").replace("..", "").replace("//", "/")
        full = self.static_dir / safe  # type: ignore[operator]
        if not full.exists() or not full.is_file():
            return None
        mime, enc = mimetypes.guess_type(str(full))
        mime = mime or "application/octet-stream"
        body = full.read_bytes()
        return Response(body=body, headers={"Content-Type": mime, "Cache-Control": "public, max-age=3600"})

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def _start(self) -> None:
        for fn in self._startup_handlers:
            await _ensure_awaitable(fn())

        self._server = await asyncio.start_server(
            self._handle_connection,
            host=self.host,
            port=self.port,
            ssl=self.ssl_context,
            backlog=self.max_connections,
            reuse_address=True,
            reuse_port=(sys.platform != "win32"),
        )
        addr = self._server.sockets[0].getsockname()
        logger.info("HeadyHTTP listening on http://%s:%s", addr[0], addr[1])

    async def _stop(self) -> None:
        self._shutting_down = True
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        for fn in reversed(self._shutdown_handlers):
            await _ensure_awaitable(fn())
        logger.info("HeadyHTTP stopped")

    def run(
        self,
        debug: bool = False,
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> None:
        """Start the server (blocking). Handles SIGTERM/SIGINT."""
        if debug:
            logging.basicConfig(level=logging.DEBUG)
        else:
            logging.basicConfig(level=logging.INFO)

        async def main() -> None:
            await self._start()
            loop_ = asyncio.get_event_loop()

            stop_event = asyncio.Event()

            def _signal_handler() -> None:
                logger.info("Shutdown signal received")
                stop_event.set()

            for sig in (signal.SIGTERM, signal.SIGINT):
                try:
                    loop_.add_signal_handler(sig, _signal_handler)
                except NotImplementedError:
                    pass  # Windows

            try:
                await stop_event.wait()
            finally:
                await self._stop()

        asyncio.run(main())

    async def serve(self) -> None:
        """Async entry point — use when embedding in an existing event loop."""
        await self._start()
        try:
            await asyncio.Event().wait()  # wait forever
        finally:
            await self._stop()


# ---------------------------------------------------------------------------
# Module-level decorator helpers (global singleton router)
# ---------------------------------------------------------------------------

_default_server: HTTPServer | None = None


def route(path: str, methods: list[str] | None = None) -> Callable:
    """Module-level @route decorator using the default server."""
    global _default_server
    if _default_server is None:
        _default_server = HTTPServer()

    def decorator(fn: Callable) -> Callable:
        _default_server._router.add_route(path, fn, methods=methods or ["GET"])  # type: ignore[union-attr]
        return fn
    return decorator


def middleware(fn: Callable) -> Callable:
    """Module-level @middleware decorator."""
    global _default_server
    if _default_server is None:
        _default_server = HTTPServer()
    _default_server.use(fn)
    return fn


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _ensure_awaitable(result: Any) -> Any:
    if asyncio.iscoroutine(result):
        return await result
    return result


def _http_date() -> str:
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")


_STATUS_PHRASES: dict[int, str] = {
    100: "Continue", 101: "Switching Protocols",
    200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
    206: "Partial Content",
    301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 409: "Conflict",
    410: "Gone", 413: "Payload Too Large", 422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error", 501: "Not Implemented",
    502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
}


# ---------------------------------------------------------------------------
# CLI usage
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    server = HTTPServer(port=8000)

    @server.get("/")
    async def index(req: Request) -> JSONResponse:
        return JSONResponse({"message": "HeadyHTTP running", "path": req.path})

    server.run(debug=True)

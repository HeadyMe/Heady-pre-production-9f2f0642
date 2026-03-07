"""
client.py — Main HeadyClient implementation with async/sync support.

Provides:
- HeadyClient (async, primary)
- SyncHeadyClient (sync wrapper using asyncio.run)
- Full API namespace: brain, agents, memory, mcp, conductor, events
- φ-exponential retry backoff
- Auto token refresh
- Request/response hooks
"""

from __future__ import annotations

import asyncio
import logging
import math
import secrets
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

import httpx

from .exceptions import (
    AuthError,
    HeadyError,
    NetworkError,
    RateLimitError,
    TimeoutError,
    TokenExpiredError,
    from_http_error,
)
from .models import (
    PHI,
    fibonacci,
    AgentConfig,
    AgentListFilters,
    AnalyzeOptions,
    AnalyzeResponse,
    AuthTokens,
    ChatOptions,
    ChatResponse,
    ConductorTask,
    ConductorTaskStatus,
    HeadyConfig,
    MemoryEntry,
    MemorySearchOptions,
    MemorySearchResponse,
    MemoryStoreOptions,
    MCPExecuteOptions,
    MCPExecuteResponse,
    MCPTool,
    Message,
    PaginatedResponse,
    Agent,
)

logger = logging.getLogger("heady.client")

T = TypeVar("T")

# ---------------------------------------------------------------------------
# HTTP Client Internals
# ---------------------------------------------------------------------------

RETRY_BASE_MS = 1000
MAX_RETRY_DELAY_MS = round(1000 * PHI ** 8)   # ≈ 46370ms
TOKEN_REFRESH_BUFFER_S = fibonacci(5) * 60    # 5 minutes


class _HeadyHTTPClient:
    """Internal async HTTP client with φ-exponential retry."""

    def __init__(self, config: HeadyConfig) -> None:
        self.config = config
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._request_hooks: List[Callable] = []
        self._response_hooks: List[Callable] = []

        default_headers: Dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Heady-SDK": "python/1.0.0",
        }
        if config.tenant_id:
            default_headers["X-Heady-Tenant"] = config.tenant_id
        default_headers.update(config.headers)

        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=config.timeout,
            headers=default_headers,
        )

    def set_tokens(self, access_token: str, expires_at: datetime, refresh_token: Optional[str] = None) -> None:
        self._access_token = access_token
        self._token_expires_at = expires_at
        if refresh_token:
            self._refresh_token = refresh_token

    def _needs_refresh(self) -> bool:
        if not self._access_token or not self._token_expires_at:
            return False
        remaining = (self._token_expires_at - datetime.now(timezone.utc)).total_seconds()
        return remaining < TOKEN_REFRESH_BUFFER_S

    def _auth_header(self) -> str:
        if self._access_token:
            return f"Bearer {self._access_token}"
        return f"Bearer {self.config.api_key}"

    async def _refresh_access_token(self) -> None:
        if not self._refresh_token:
            return
        try:
            resp = await self._client.post(
                "/auth/token/refresh",
                json={"refreshToken": self._refresh_token},
                headers={"Authorization": self._auth_header()},
            )
            resp.raise_for_status()
            data = resp.json()
            self.set_tokens(
                access_token=data["accessToken"],
                expires_at=datetime.fromisoformat(data["expiresAt"]),
                refresh_token=data.get("refreshToken"),
            )
        except Exception as e:
            self._access_token = None
            self._refresh_token = None
            self._token_expires_at = None
            raise AuthError("Token refresh failed. Please re-authenticate.") from e

    def _retry_delay(self, attempt: int) -> float:
        """φ-exponential backoff in seconds."""
        delay_ms = min(
            round(RETRY_BASE_MS * PHI ** attempt),
            MAX_RETRY_DELAY_MS,
        )
        return delay_ms / 1000.0

    def _is_retryable(self, exc: Exception) -> bool:
        if isinstance(exc, HeadyError):
            return exc.retryable
        if isinstance(exc, (httpx.NetworkError, httpx.TimeoutException)):
            return True
        return False

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Execute an HTTP request with auto-retry and token refresh."""
        if self._needs_refresh():
            await self._refresh_access_token()

        request_id = f"sdk-{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(4)}"

        for hook in self._request_hooks:
            kwargs = await hook(method, path, kwargs) if asyncio.iscoroutinefunction(hook) else hook(method, path, kwargs)

        last_exc: Optional[Exception] = None

        for attempt in range(self.config.max_retries + 1):
            try:
                resp = await self._client.request(
                    method=method,
                    url=path,
                    headers={
                        "Authorization": self._auth_header(),
                        "X-Heady-Request-Id": request_id,
                    },
                    **kwargs,
                )

                request_id_resp = resp.headers.get("x-heady-request-id", request_id)

                if not resp.is_success:
                    try:
                        data = resp.json()
                    except Exception:
                        data = {"message": resp.text or f"HTTP {resp.status_code}"}
                    raise from_http_error(resp.status_code, data, request_id_resp)

                # Run response hooks
                for hook in self._response_hooks:
                    resp = await hook(resp) if asyncio.iscoroutinefunction(hook) else hook(resp)

                try:
                    return resp.json()
                except Exception:
                    return resp.text

            except TokenExpiredError:
                if self._refresh_token:
                    await self._refresh_access_token()
                    continue
                raise

            except RateLimitError as e:
                if attempt < self.config.max_retries:
                    await asyncio.sleep(e.retry_after_ms / 1000.0)
                    last_exc = e
                    continue
                raise

            except HeadyError as e:
                if not e.retryable or attempt == self.config.max_retries:
                    raise
                last_exc = e

            except httpx.TimeoutException as e:
                exc = TimeoutError(self.config.timeout, request_id=request_id)
                if attempt == self.config.max_retries:
                    raise exc from e
                last_exc = exc

            except httpx.NetworkError as e:
                exc = NetworkError(str(e), request_id=request_id, cause=e)
                if attempt == self.config.max_retries:
                    raise exc from e
                last_exc = exc

            delay = self._retry_delay(attempt)
            if self.config.debug:
                logger.debug(f"[HeadySDK] Retry {attempt + 1}/{self.config.max_retries} after {delay:.2f}s")
            await asyncio.sleep(delay)

        raise last_exc or HeadyError("Unknown error", code="SERVER_ERROR")

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, body: Any = None) -> Any:
        return await self._request("POST", path, json=body)

    async def put(self, path: str, body: Any = None) -> Any:
        return await self._request("PUT", path, json=body)

    async def patch(self, path: str, body: Any = None) -> Any:
        return await self._request("PATCH", path, json=body)

    async def delete(self, path: str) -> Any:
        return await self._request("DELETE", path)

    async def aclose(self) -> None:
        await self._client.aclose()


# ---------------------------------------------------------------------------
# API Namespaces
# ---------------------------------------------------------------------------

class _BrainAPI:
    def __init__(self, http: _HeadyHTTPClient) -> None:
        self._http = http

    async def chat(self, messages: List[Message], options: Optional[ChatOptions] = None) -> ChatResponse:
        """Send messages to the HeadyOS AI brain."""
        opts = options or ChatOptions()
        payload: Dict[str, Any] = {
            "messages": [m.model_dump(exclude_none=True) for m in messages],
            "temperature": opts.temperature,
            "stream": opts.stream,
        }
        if opts.model: payload["model"] = opts.model
        if opts.max_tokens: payload["maxTokens"] = opts.max_tokens
        if opts.system_prompt: payload["systemPrompt"] = opts.system_prompt
        if opts.agent_id: payload["agentId"] = opts.agent_id
        if opts.memory_namespace: payload["memoryNamespace"] = opts.memory_namespace
        data = await self._http.post("/brain/chat", payload)
        return ChatResponse.model_validate(data)

    async def analyze(self, input_text: str, options: Optional[AnalyzeOptions] = None) -> AnalyzeResponse:
        """Analyze text with HeadyOS AI inference."""
        opts = options or AnalyzeOptions()
        payload = {
            "input": input_text,
            "analysisType": opts.analysis_type,
            "outputFormat": opts.output_format,
            "confidence": opts.confidence,
        }
        if opts.model: payload["model"] = opts.model
        data = await self._http.post("/brain/analyze", payload)
        return AnalyzeResponse.model_validate(data)


class _AgentsAPI:
    def __init__(self, http: _HeadyHTTPClient) -> None:
        self._http = http

    async def create(self, config: AgentConfig) -> Agent:
        data = await self._http.post("/agents", config.model_dump(exclude_none=True))
        return Agent.model_validate(data)

    async def list(self, filters: Optional[AgentListFilters] = None) -> PaginatedResponse:
        params = (filters or AgentListFilters()).model_dump(exclude_none=True)
        data = await self._http.get("/agents", params)
        return PaginatedResponse.model_validate(data)

    async def get(self, agent_id: str) -> Agent:
        data = await self._http.get(f"/agents/{agent_id}")
        return Agent.model_validate(data)

    async def update(self, agent_id: str, updates: Dict[str, Any]) -> Agent:
        data = await self._http.patch(f"/agents/{agent_id}", updates)
        return Agent.model_validate(data)

    async def delete(self, agent_id: str) -> Dict[str, Any]:
        return await self._http.delete(f"/agents/{agent_id}")


class _MemoryAPI:
    def __init__(self, http: _HeadyHTTPClient) -> None:
        self._http = http

    async def store(self, key: str, value: str, options: Optional[MemoryStoreOptions] = None) -> MemoryEntry:
        opts = options or MemoryStoreOptions()
        payload = {
            "key": key,
            "value": value,
            "namespace": opts.namespace,
            "metadata": opts.metadata,
            "ttlDays": opts.ttl_days,
            "deduplicate": opts.deduplicate,
        }
        data = await self._http.post("/memory", payload)
        return MemoryEntry.model_validate(data)

    async def search(self, query: str, options: Optional[MemorySearchOptions] = None) -> MemorySearchResponse:
        opts = options or MemorySearchOptions()
        payload = {
            "query": query,
            "topK": opts.top_k,
            "minScore": opts.min_score,
            "includeMetadata": opts.include_metadata,
        }
        if opts.namespace: payload["namespace"] = opts.namespace
        if opts.filter: payload["filter"] = opts.filter
        data = await self._http.post("/memory/search", payload)
        return MemorySearchResponse.model_validate(data)

    async def get(self, key: str, namespace: Optional[str] = None) -> Optional[MemoryEntry]:
        params: Dict[str, Any] = {"key": key}
        if namespace: params["namespace"] = namespace
        data = await self._http.get("/memory/get", params)
        return MemoryEntry.model_validate(data) if data else None

    async def delete(self, key: str, namespace: Optional[str] = None) -> Dict[str, Any]:
        path = f"/memory/{key}"
        if namespace: path += f"?namespace={namespace}"
        return await self._http.delete(path)


class _MCPAPI:
    def __init__(self, http: _HeadyHTTPClient) -> None:
        self._http = http

    async def list_tools(self) -> List[MCPTool]:
        data = await self._http.get("/mcp/tools")
        return [MCPTool.model_validate(t) for t in (data or [])]

    async def execute_tool(
        self, name: str, args: Dict[str, Any], options: Optional[MCPExecuteOptions] = None
    ) -> MCPExecuteResponse:
        opts = options or MCPExecuteOptions()
        payload = {
            "name": name,
            "arguments": args,
            "timeout": opts.timeout,
            "retries": opts.retries,
            "context": opts.context,
        }
        data = await self._http.post("/mcp/tools/execute", payload)
        return MCPExecuteResponse.model_validate(data)


class _ConductorAPI:
    def __init__(self, http: _HeadyHTTPClient) -> None:
        self._http = http

    async def submit_task(self, task: ConductorTask) -> ConductorTaskStatus:
        data = await self._http.post("/conductor/tasks", task.model_dump(exclude_none=True))
        return ConductorTaskStatus.model_validate(data)

    async def get_status(self, task_id: str) -> ConductorTaskStatus:
        data = await self._http.get(f"/conductor/tasks/{task_id}")
        return ConductorTaskStatus.model_validate(data)

    async def cancel_task(self, task_id: str) -> ConductorTaskStatus:
        data = await self._http.post(f"/conductor/tasks/{task_id}/cancel", {})
        return ConductorTaskStatus.model_validate(data)

    async def wait_for_completion(
        self,
        task_id: str,
        max_wait_seconds: float = round(1000 * PHI ** 10) / 1000,  # φ^10 ≈ 121s
    ) -> ConductorTaskStatus:
        """Poll task status with φ-exponential backoff until completion."""
        deadline = asyncio.get_event_loop().time() + max_wait_seconds
        attempt = 0
        while asyncio.get_event_loop().time() < deadline:
            status = await self.get_status(task_id)
            if status.status.value in ("completed", "failed", "cancelled"):
                return status
            delay = min(RETRY_BASE_MS / 1000 * PHI ** attempt, MAX_RETRY_DELAY_MS / 1000)
            await asyncio.sleep(delay)
            attempt += 1
        raise HeadyError(
            f"Task {task_id} did not complete within {max_wait_seconds}s",
            code="TIMEOUT",
            retryable=False,
        )


# ---------------------------------------------------------------------------
# Main Client
# ---------------------------------------------------------------------------

class HeadyClient:
    """
    Async HeadyClient — Official Python SDK for HeadyOS and HeadyMe AI.

    Usage:
        async with HeadyClient(HeadyConfig(api_key="hdy_...")) as heady:
            response = await heady.brain.chat([
                Message(role="user", content="Hello, HeadyOS!")
            ])
            print(response.message.content)
    """

    PHI: float = PHI
    fibonacci = staticmethod(fibonacci)

    def __init__(self, config: HeadyConfig) -> None:
        self.config = config
        self._http = _HeadyHTTPClient(config)

        self.brain     = _BrainAPI(self._http)
        self.agents    = _AgentsAPI(self._http)
        self.memory    = _MemoryAPI(self._http)
        self.mcp       = _MCPAPI(self._http)
        self.conductor = _ConductorAPI(self._http)

        if config.debug:
            logging.basicConfig(level=logging.DEBUG)

    async def __aenter__(self) -> "HeadyClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._http.aclose()

    async def health_check(self) -> Dict[str, Any]:
        """Verify API connectivity and authentication."""
        import time
        start = time.monotonic()
        result = await self._http.get("/health")
        return {**result, "latency_ms": round((time.monotonic() - start) * 1000)}

    def add_request_hook(self, fn: Callable) -> None:
        """Add a hook called before each request. Signature: (method, path, kwargs) -> kwargs"""
        self._http._request_hooks.append(fn)

    def add_response_hook(self, fn: Callable) -> None:
        """Add a hook called after each response. Signature: (response) -> response"""
        self._http._response_hooks.append(fn)

    async def close(self) -> None:
        await self._http.aclose()


# ---------------------------------------------------------------------------
# Synchronous Wrapper
# ---------------------------------------------------------------------------

class SyncHeadyClient:
    """
    Synchronous HeadyClient wrapper for non-async codebases.

    Usage:
        heady = SyncHeadyClient(HeadyConfig(api_key="hdy_..."))
        response = heady.brain.chat([Message(role="user", content="Hello!")])
        print(response.message.content)
    """

    def __init__(self, config: HeadyConfig) -> None:
        self._async_client = HeadyClient(config)
        self._loop = asyncio.new_event_loop()

    def _run(self, coro):
        return self._loop.run_until_complete(coro)

    class _SyncBrain:
        def __init__(self, async_brain, runner): self._b = async_brain; self._r = runner
        def chat(self, messages, options=None): return self._r(self._b.chat(messages, options))
        def analyze(self, text, options=None): return self._r(self._b.analyze(text, options))

    class _SyncAgents:
        def __init__(self, a, r): self._a = a; self._r = r
        def create(self, config): return self._r(self._a.create(config))
        def list(self, filters=None): return self._r(self._a.list(filters))
        def get(self, id): return self._r(self._a.get(id))
        def update(self, id, updates): return self._r(self._a.update(id, updates))
        def delete(self, id): return self._r(self._a.delete(id))

    class _SyncMemory:
        def __init__(self, m, r): self._m = m; self._r = r
        def store(self, key, value, options=None): return self._r(self._m.store(key, value, options))
        def search(self, query, options=None): return self._r(self._m.search(query, options))
        def get(self, key, namespace=None): return self._r(self._m.get(key, namespace))
        def delete(self, key, namespace=None): return self._r(self._m.delete(key, namespace))

    class _SyncMCP:
        def __init__(self, m, r): self._m = m; self._r = r
        def list_tools(self): return self._r(self._m.list_tools())
        def execute_tool(self, name, args, options=None): return self._r(self._m.execute_tool(name, args, options))

    class _SyncConductor:
        def __init__(self, c, r): self._c = c; self._r = r
        def submit_task(self, task): return self._r(self._c.submit_task(task))
        def get_status(self, task_id): return self._r(self._c.get_status(task_id))
        def cancel_task(self, task_id): return self._r(self._c.cancel_task(task_id))
        def wait_for_completion(self, task_id, max_wait=None): return self._r(self._c.wait_for_completion(task_id, *([max_wait] if max_wait else [])))

    @property
    def brain(self): return self._SyncBrain(self._async_client.brain, self._run)
    @property
    def agents(self): return self._SyncAgents(self._async_client.agents, self._run)
    @property
    def memory(self): return self._SyncMemory(self._async_client.memory, self._run)
    @property
    def mcp(self): return self._SyncMCP(self._async_client.mcp, self._run)
    @property
    def conductor(self): return self._SyncConductor(self._async_client.conductor, self._run)

    def health_check(self): return self._run(self._async_client.health_check())
    def close(self): self._run(self._async_client.close()); self._loop.close()
    def __enter__(self): return self
    def __exit__(self, *args): self.close()

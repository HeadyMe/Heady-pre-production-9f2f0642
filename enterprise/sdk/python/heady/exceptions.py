"""
exceptions.py — Exception classes for the Heady Python SDK.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional


class HeadyError(Exception):
    """Base exception for all Heady SDK errors."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: Optional[int] = None,
        request_id: Optional[str] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.request_id = request_id
        self.retryable = retryable

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"message={self.message!r}, "
            f"code={self.code!r}, "
            f"status_code={self.status_code})"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.__class__.__name__,
            "message": self.message,
            "code": self.code,
            "status_code": self.status_code,
            "request_id": self.request_id,
            "retryable": self.retryable,
        }


class AuthError(HeadyError):
    """Authentication or authorization error (HTTP 401/403)."""

    def __init__(
        self,
        message: str,
        status_code: int = 401,
        request_id: Optional[str] = None,
    ) -> None:
        code = "FORBIDDEN" if status_code == 403 else "UNAUTHORIZED"
        super().__init__(
            message=message,
            code=code,
            status_code=status_code,
            request_id=request_id,
            retryable=False,
        )


class InvalidApiKeyError(AuthError):
    """Invalid or expired API key."""

    def __init__(
        self,
        message: str = "Invalid or expired API key",
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message=message, status_code=401, request_id=request_id)
        self.code = "INVALID_API_KEY"


class TokenExpiredError(AuthError):
    """JWT access token has expired — SDK will auto-refresh."""

    def __init__(
        self,
        message: str = "Access token expired",
        request_id: Optional[str] = None,
        expired_at: Optional[str] = None,
    ) -> None:
        super().__init__(message=message, status_code=401, request_id=request_id)
        self.code = "TOKEN_EXPIRED"
        self.retryable = True  # Retryable after token refresh
        self.expired_at = expired_at


class RateLimitError(HeadyError):
    """Rate limit exceeded (HTTP 429). Includes retry-after information."""

    def __init__(
        self,
        retry_after_ms: int,
        limit: int,
        remaining: int,
        reset_at: str,
        message: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message or f"Rate limit exceeded. Retry after {retry_after_ms // 1000}s",
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            request_id=request_id,
            retryable=True,
        )
        self.retry_after_ms = retry_after_ms
        self.limit = limit
        self.remaining = remaining
        self.reset_at = reset_at


class ValidationError(HeadyError):
    """Input validation error (HTTP 400/422)."""

    def __init__(
        self,
        issues: List[Dict[str, str]],
        message: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        auto_msg = "; ".join(f"{i.get('field', '?')}: {i.get('message', '')}" for i in issues)
        super().__init__(
            message=message or f"Validation failed: {auto_msg}",
            code="VALIDATION_ERROR",
            status_code=422,
            request_id=request_id,
            retryable=False,
        )
        self.issues = issues


class NetworkError(HeadyError):
    """Network or connection error."""

    def __init__(
        self,
        message: str,
        request_id: Optional[str] = None,
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="NETWORK_ERROR",
            request_id=request_id,
            retryable=True,
        )
        self.__cause__ = cause


class TimeoutError(NetworkError):
    """Request timeout."""

    def __init__(
        self,
        timeout_seconds: float,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=f"Request timed out after {timeout_seconds}s",
            request_id=request_id,
        )
        self.code = "TIMEOUT"
        self.timeout_seconds = timeout_seconds


class ServerError(HeadyError):
    """Server-side error (HTTP 5xx). Retryable."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="SERVER_ERROR",
            status_code=status_code,
            request_id=request_id,
            retryable=True,
        )


class AgentError(HeadyError):
    """Agent execution error."""

    def __init__(
        self,
        message: str,
        agent_id: Optional[str] = None,
        step: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="AGENT_ERROR",
            request_id=request_id,
            retryable=False,
        )
        self.agent_id = agent_id
        self.step = step


class MemoryError(HeadyError):
    """Vector memory operation error."""

    def __init__(
        self,
        message: str,
        operation: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="MEMORY_ERROR",
            request_id=request_id,
            retryable=False,
        )
        self.operation = operation


class MCPError(HeadyError):
    """MCP tool execution error."""

    def __init__(
        self,
        message: str,
        tool_name: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="MCP_ERROR",
            request_id=request_id,
            retryable=False,
        )
        self.tool_name = tool_name


class ConductorError(HeadyError):
    """Conductor orchestration error."""

    def __init__(
        self,
        message: str,
        task_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            message=message,
            code="CONDUCTOR_ERROR",
            request_id=request_id,
            retryable=False,
        )
        self.task_id = task_id


def from_http_error(
    status_code: int,
    data: Dict[str, Any],
    request_id: Optional[str] = None,
) -> HeadyError:
    """Factory function: create the appropriate HeadyError from an HTTP response."""
    message = data.get("message", f"HTTP {status_code} error")
    issues = data.get("issues", [])

    if status_code in (400, 422):
        return ValidationError(
            issues=issues or [{"field": "unknown", "message": message, "code": "invalid"}],
            message=message,
            request_id=request_id,
        )
    elif status_code == 401:
        return AuthError(message=message, status_code=401, request_id=request_id)
    elif status_code == 403:
        return AuthError(message=message, status_code=403, request_id=request_id)
    elif status_code == 429:
        retry_after_ms = data.get("retryAfterMs", data.get("retry_after_ms", 60000))
        return RateLimitError(
            retry_after_ms=retry_after_ms,
            limit=data.get("limit", 0),
            remaining=0,
            reset_at=data.get("resetAt", ""),
            message=message,
            request_id=request_id,
        )
    elif status_code >= 500:
        return ServerError(message=message, status_code=status_code, request_id=request_id)
    else:
        return HeadyError(message=message, code="SERVER_ERROR", status_code=status_code)

"""
models.py — Pydantic models for all @heady-ai/sdk Python request/response types.

All numeric parameters derive from φ (phi) = 1.618033988749895 and Fibonacci sequences.
"""

from __future__ import annotations

import math
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# φ (Golden Ratio) Constants
# ---------------------------------------------------------------------------

PHI: float = 1.618033988749895
_FIB_SEQ = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]


def fibonacci(n: int) -> int:
    """Return the nth Fibonacci number."""
    if n < len(_FIB_SEQ):
        return _FIB_SEQ[n]
    return round(_FIB_SEQ[-1] * PHI ** (n - len(_FIB_SEQ) + 1))


# ---------------------------------------------------------------------------
# Configuration Models
# ---------------------------------------------------------------------------

class HeadyConfig(BaseModel):
    """Configuration for HeadyClient."""

    api_key: str = Field(..., description="HeadyOS API key")
    base_url: str = Field(
        default="https://api.headyme.com/v1",
        description="API base URL"
    )
    timeout: float = Field(
        default=round(1000 * PHI ** 5) / 1000,  # ≈ 11.09 seconds
        description="Request timeout in seconds (default: 1000ms × φ^5 / 1000)"
    )
    max_retries: int = Field(
        default=fibonacci(5),  # 5 retries
        ge=0,
        le=fibonacci(7),      # max 13
        description="Maximum retry attempts with φ-backoff"
    )
    tenant_id: Optional[str] = Field(default=None, description="Tenant ID for multi-tenant deployments")
    ws_url: str = Field(
        default="wss://ws.headyme.com",
        description="WebSocket URL for real-time events"
    )
    debug: bool = Field(default=False, description="Enable debug logging")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom headers")

    class Config:
        populate_by_name = True


# ---------------------------------------------------------------------------
# Auth Models
# ---------------------------------------------------------------------------

class AuthTokens(BaseModel):
    """JWT token pair."""
    access_token: str
    refresh_token: str
    expires_at: datetime
    token_type: Literal["Bearer"] = "Bearer"


class ApiKey(BaseModel):
    """API key metadata."""
    id: str
    name: str
    prefix: str  # First 8 chars of SHA-256 hash
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Brain (AI Inference) Models
# ---------------------------------------------------------------------------

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    FUNCTION = "function"


class FunctionCall(BaseModel):
    name: str
    arguments: str  # JSON string


class Message(BaseModel):
    """A single conversation message."""
    role: MessageRole
    content: str
    name: Optional[str] = None
    function_call: Optional[FunctionCall] = None


class TokenUsage(BaseModel):
    """Token usage statistics for a brain request."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatOptions(BaseModel):
    """Options for brain.chat()."""
    model: Optional[str] = None
    temperature: float = Field(
        default=round(1 / PHI, 6),  # ≈ 0.618 — HIGH CSL threshold
        ge=0.0,
        le=1.0
    )
    max_tokens: Optional[int] = None
    stream: bool = False
    system_prompt: Optional[str] = None
    agent_id: Optional[str] = None
    memory_namespace: Optional[str] = None
    tenant_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from brain.chat()."""
    id: str
    model: str
    message: Message
    usage: TokenUsage
    finish_reason: Literal["stop", "length", "function_call", "content_filter"]
    latency_ms: int
    created_at: datetime


class AnalyzeOptions(BaseModel):
    """Options for brain.analyze()."""
    analysis_type: str = "reasoning"
    output_format: Literal["json", "text", "markdown"] = "json"
    confidence: bool = True
    model: Optional[str] = None


class AnalyzeResponse(BaseModel):
    """Response from brain.analyze()."""
    id: str
    analysis_type: str
    result: Any
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    model: str
    latency_ms: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Agent Models
# ---------------------------------------------------------------------------

class AgentStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPLOYING = "deploying"
    ERROR = "error"


class AgentCapability(str, Enum):
    MCP_TOOLS = "mcp_tools"
    WEB_SEARCH = "web_search"
    CODE_EXECUTION = "code_execution"
    MEMORY_READ = "memory_read"
    MEMORY_WRITE = "memory_write"
    CONDUCTOR_SUBMIT = "conductor_submit"


class AgentConfig(BaseModel):
    """Configuration for creating/updating an agent."""
    name: str = Field(..., min_length=1)
    description: Optional[str] = Field(default=None, max_length=fibonacci(11))  # max 89 chars
    system_prompt: str = Field(..., min_length=1)
    capabilities: List[AgentCapability]
    model: Optional[str] = None
    tools: List[str] = Field(default_factory=list)
    memory_namespace: Optional[str] = None
    max_iterations: int = Field(
        default=fibonacci(7),  # 13 iterations
        ge=1,
        le=fibonacci(10)       # max 55
    )
    temperature: float = Field(
        default=round(1 / PHI, 6),
        ge=0.0,
        le=1.0
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Agent(BaseModel):
    """HeadyOS Agent."""
    id: str
    name: str
    description: Optional[str] = None
    system_prompt: str
    capabilities: List[AgentCapability]
    model: str
    tools: List[str]
    status: AgentStatus
    memory_namespace: Optional[str] = None
    max_iterations: int
    owner_id: str
    tenant_id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AgentListFilters(BaseModel):
    """Filters for listing agents."""
    status: Optional[AgentStatus] = None
    capability: Optional[AgentCapability] = None
    tenant_id: Optional[str] = None
    page: int = 1
    page_size: int = fibonacci(7)  # 13


class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


# ---------------------------------------------------------------------------
# Memory (Vector) Models
# ---------------------------------------------------------------------------

class MemoryStoreOptions(BaseModel):
    """Options for memory.store()."""
    namespace: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ttl_days: int = Field(
        default=fibonacci(13),  # 233 days
        ge=fibonacci(9),        # min 34 days
        le=fibonacci(15)        # max 610 days
    )
    deduplicate: bool = True


class MemoryEntry(BaseModel):
    """A single vector memory entry."""
    id: str
    key: str
    value: str
    namespace: str = "default"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    created_at: datetime
    updated_at: datetime
    accessed_at: Optional[datetime] = None


class MemorySearchOptions(BaseModel):
    """Options for memory.search()."""
    namespace: Optional[str] = None
    top_k: int = Field(
        default=fibonacci(5),   # 5 results
        ge=1,
        le=fibonacci(10)        # max 55
    )
    min_score: float = Field(
        default=round(1 / (PHI * PHI), 6),  # ≈ 0.382 — MODERATE CSL threshold
        ge=0.0,
        le=1.0
    )
    filter: Optional[Dict[str, Any]] = None
    include_metadata: bool = True


class MemorySearchResponse(BaseModel):
    """Response from memory.search()."""
    query: str
    results: List[MemoryEntry]
    total_found: int
    search_latency_ms: int


# ---------------------------------------------------------------------------
# MCP Models
# ---------------------------------------------------------------------------

class MCPTool(BaseModel):
    """An MCP tool definition."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Optional[Dict[str, Any]] = None
    server_name: str
    version: str
    requires_auth: bool


class MCPExecuteOptions(BaseModel):
    """Options for mcp.execute_tool()."""
    timeout: float = Field(
        default=round(1000 * PHI ** 4) / 1000,  # φ^4 ≈ 6.854s
        description="Timeout in seconds"
    )
    retries: int = Field(default=fibonacci(4), ge=0, le=fibonacci(7))  # default 3, max 13
    context: Dict[str, Any] = Field(default_factory=dict)


class MCPExecuteResponse(BaseModel):
    """Response from mcp.execute_tool()."""
    tool_name: str
    result: Any
    is_error: bool
    error_message: Optional[str] = None
    execution_ms: int
    executed_at: datetime


# ---------------------------------------------------------------------------
# Conductor Models
# ---------------------------------------------------------------------------

class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AWAITING_REVIEW = "awaiting_review"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class ConductorTask(BaseModel):
    """Task to submit to the Heady Conductor."""
    type: str = Field(..., min_length=1)
    title: Optional[str] = None
    description: Optional[str] = None
    input: Dict[str, Any]
    agent_id: Optional[str] = None
    priority: TaskPriority = TaskPriority.NORMAL
    max_steps: int = Field(
        default=fibonacci(8),   # 21 steps
        ge=1,
        le=fibonacci(11)        # max 89
    )
    timeout: float = Field(
        default=round(1000 * PHI ** 8) / 1000,  # φ^8 ≈ 46.37s
        description="Timeout in seconds"
    )
    webhook_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConductorTaskStatus(BaseModel):
    """Status of a Conductor task."""
    task_id: str
    type: str
    status: TaskStatus
    priority: TaskPriority
    current_step: Optional[int] = None
    max_steps: int
    progress: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    result: Optional[Any] = None
    error: Optional[str] = None
    agent_id: Optional[str] = None
    submitted_by: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Event Models
# ---------------------------------------------------------------------------

class HeadyEvent(BaseModel):
    """A HeadyOS real-time event."""
    channel: str
    type: str
    data: Any
    timestamp: datetime
    sequence_id: int

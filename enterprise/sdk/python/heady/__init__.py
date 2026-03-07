"""
heady — Official Python SDK for HeadyOS Platform and HeadyMe AI

HeadySystems Inc. (DBA Heady™)
https://headyme.com | sdk@headyme.com

Example:
    Async usage (recommended):
        import asyncio
        from heady import HeadyClient, HeadyConfig, Message

        async def main():
            async with HeadyClient(HeadyConfig(api_key="hdy_your_key")) as heady:
                response = await heady.brain.chat([
                    Message(role="user", content="Hello, HeadyOS!")
                ])
                print(response.message.content)

        asyncio.run(main())

    Sync usage:
        from heady import SyncHeadyClient, HeadyConfig, Message

        with SyncHeadyClient(HeadyConfig(api_key="hdy_your_key")) as heady:
            response = heady.brain.chat([
                Message(role="user", content="Hello, HeadyOS!")
            ])
            print(response.message.content)
"""

from .client import HeadyClient, SyncHeadyClient
from .models import (
    PHI,
    fibonacci,
    HeadyConfig,
    Message,
    MessageRole,
    ChatOptions,
    ChatResponse,
    AnalyzeOptions,
    AnalyzeResponse,
    Agent,
    AgentConfig,
    AgentCapability,
    AgentStatus,
    AgentListFilters,
    MemoryEntry,
    MemoryStoreOptions,
    MemorySearchOptions,
    MemorySearchResponse,
    MCPTool,
    MCPExecuteOptions,
    MCPExecuteResponse,
    ConductorTask,
    ConductorTaskStatus,
    TaskStatus,
    TaskPriority,
    PaginatedResponse,
    HeadyEvent,
    AuthTokens,
)
from .exceptions import (
    HeadyError,
    AuthError,
    InvalidApiKeyError,
    TokenExpiredError,
    RateLimitError,
    ValidationError,
    NetworkError,
    TimeoutError,
    ServerError,
    AgentError,
    MemoryError,
    MCPError,
    ConductorError,
)

__all__ = [
    # Clients
    "HeadyClient",
    "SyncHeadyClient",
    # Config
    "HeadyConfig",
    # φ
    "PHI",
    "fibonacci",
    # Brain
    "Message",
    "MessageRole",
    "ChatOptions",
    "ChatResponse",
    "AnalyzeOptions",
    "AnalyzeResponse",
    # Agents
    "Agent",
    "AgentConfig",
    "AgentCapability",
    "AgentStatus",
    "AgentListFilters",
    # Memory
    "MemoryEntry",
    "MemoryStoreOptions",
    "MemorySearchOptions",
    "MemorySearchResponse",
    # MCP
    "MCPTool",
    "MCPExecuteOptions",
    "MCPExecuteResponse",
    # Conductor
    "ConductorTask",
    "ConductorTaskStatus",
    "TaskStatus",
    "TaskPriority",
    # Common
    "PaginatedResponse",
    "HeadyEvent",
    "AuthTokens",
    # Exceptions
    "HeadyError",
    "AuthError",
    "InvalidApiKeyError",
    "TokenExpiredError",
    "RateLimitError",
    "ValidationError",
    "NetworkError",
    "TimeoutError",
    "ServerError",
    "AgentError",
    "MemoryError",
    "MCPError",
    "ConductorError",
]

__version__ = "1.0.0"
__author__ = "HeadySystems Inc."
__email__ = "sdk@headyme.com"

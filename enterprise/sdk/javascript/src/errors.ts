/**
 * @file errors.ts
 * @description Typed error classes for the @heady-ai/sdk.
 */

import type { HeadyErrorCode } from './types';

/**
 * Base error class for all Heady SDK errors.
 */
export class HeadyError extends Error {
  readonly code: HeadyErrorCode;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(options: {
    message: string;
    code: HeadyErrorCode;
    statusCode?: number;
    requestId?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'HeadyError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      requestId: this.requestId,
      retryable: this.retryable,
    };
  }
}

/**
 * Authentication/authorization error (HTTP 401/403).
 */
export class AuthError extends HeadyError {
  constructor(message: string, options?: { statusCode?: number; requestId?: string }) {
    super({
      message,
      code: options?.statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
      statusCode: options?.statusCode ?? 401,
      requestId: options?.requestId,
      retryable: false, // Auth errors are not retryable
    });
    this.name = 'AuthError';
  }
}

/**
 * Invalid or expired API key error.
 */
export class InvalidApiKeyError extends AuthError {
  constructor(message = 'Invalid or expired API key', options?: { requestId?: string }) {
    super(message, { statusCode: 401, ...options });
    this.name = 'InvalidApiKeyError';
    // Override code after calling super
    (this as HeadyError & { code: HeadyErrorCode }).code = 'INVALID_API_KEY';
  }
}

/**
 * JWT access token expired — SDK will auto-refresh.
 */
export class TokenExpiredError extends AuthError {
  readonly expiredAt?: string;

  constructor(message = 'Access token expired', options?: { requestId?: string; expiredAt?: string }) {
    super(message, { statusCode: 401, ...options });
    this.name = 'TokenExpiredError';
    (this as HeadyError & { code: HeadyErrorCode }).code = 'TOKEN_EXPIRED';
    (this as TokenExpiredError & { retryable: boolean }).retryable = true; // Retryable after refresh
    this.expiredAt = options?.expiredAt;
  }
}

/**
 * Rate limit exceeded error (HTTP 429).
 * Includes retry-after information.
 */
export class RateLimitError extends HeadyError {
  readonly retryAfterMs: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string;

  constructor(options: {
    message?: string;
    retryAfterMs: number;
    limit: number;
    remaining: number;
    resetAt: string;
    requestId?: string;
  }) {
    super({
      message: options.message ?? `Rate limit exceeded. Retry after ${Math.round(options.retryAfterMs / 1000)}s`,
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      requestId: options.requestId,
      retryable: true, // Retryable after delay
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = options.retryAfterMs;
    this.limit = options.limit;
    this.remaining = options.remaining;
    this.resetAt = options.resetAt;
  }
}

/**
 * Input validation error (HTTP 400/422).
 */
export class ValidationError extends HeadyError {
  readonly issues: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  constructor(options: {
    message?: string;
    issues: Array<{ field: string; message: string; code: string }>;
    requestId?: string;
  }) {
    super({
      message: options.message ?? `Validation failed: ${options.issues.map(i => `${i.field}: ${i.message}`).join(', ')}`,
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      requestId: options.requestId,
      retryable: false,
    });
    this.name = 'ValidationError';
    this.issues = options.issues;
  }
}

/**
 * Network or connection error.
 */
export class NetworkError extends HeadyError {
  constructor(message: string, options?: { requestId?: string; cause?: unknown }) {
    super({
      message,
      code: 'NETWORK_ERROR',
      retryable: true,
      cause: options?.cause,
      requestId: options?.requestId,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Request timeout error.
 */
export class TimeoutError extends NetworkError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: { requestId?: string }) {
    super(`Request timed out after ${timeoutMs}ms`, options);
    this.name = 'TimeoutError';
    (this as HeadyError & { code: HeadyErrorCode }).code = 'TIMEOUT';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Server-side error (HTTP 5xx).
 */
export class ServerError extends HeadyError {
  constructor(message: string, options?: { statusCode?: number; requestId?: string }) {
    super({
      message,
      code: 'SERVER_ERROR',
      statusCode: options?.statusCode ?? 500,
      requestId: options?.requestId,
      retryable: true,
    });
    this.name = 'ServerError';
  }
}

/**
 * Agent execution error.
 */
export class AgentError extends HeadyError {
  readonly agentId?: string;
  readonly step?: number;

  constructor(message: string, options?: { agentId?: string; step?: number; requestId?: string }) {
    super({
      message,
      code: 'AGENT_ERROR',
      requestId: options?.requestId,
      retryable: false,
    });
    this.name = 'AgentError';
    this.agentId = options?.agentId;
    this.step = options?.step;
  }
}

/**
 * Vector memory operation error.
 */
export class MemoryError extends HeadyError {
  readonly operation?: string;

  constructor(message: string, options?: { operation?: string; requestId?: string }) {
    super({
      message,
      code: 'MEMORY_ERROR',
      requestId: options?.requestId,
      retryable: false,
    });
    this.name = 'MemoryError';
    this.operation = options?.operation;
  }
}

/**
 * MCP tool execution error.
 */
export class MCPError extends HeadyError {
  readonly toolName?: string;

  constructor(message: string, options?: { toolName?: string; requestId?: string }) {
    super({
      message,
      code: 'MCP_ERROR',
      requestId: options?.requestId,
      retryable: false,
    });
    this.name = 'MCPError';
    this.toolName = options?.toolName;
  }
}

/**
 * Conductor orchestration error.
 */
export class ConductorError extends HeadyError {
  readonly taskId?: string;

  constructor(message: string, options?: { taskId?: string; requestId?: string }) {
    super({
      message,
      code: 'CONDUCTOR_ERROR',
      requestId: options?.requestId,
      retryable: false,
    });
    this.name = 'ConductorError';
    this.taskId = options?.taskId;
  }
}

// ---------------------------------------------------------------------------
// Error Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate error type from an HTTP response.
 */
export const fromHttpError = (status: number, data: unknown, requestId?: string): HeadyError => {
  const message = (data as { message?: string })?.message ?? `HTTP ${status} error`;
  const issues = (data as { issues?: Array<{ field: string; message: string; code: string }> })?.issues;

  switch (status) {
    case 400:
    case 422:
      return new ValidationError({
        message,
        issues: issues ?? [{ field: 'unknown', message, code: 'invalid' }],
        requestId,
      });
    case 401:
      return new AuthError(message, { statusCode: 401, requestId });
    case 403:
      return new AuthError(message, { statusCode: 403, requestId });
    case 429: {
      const retryAfter = (data as { retryAfterMs?: number })?.retryAfterMs ?? 60000;
      return new RateLimitError({
        message,
        retryAfterMs: retryAfter,
        limit: (data as { limit?: number })?.limit ?? 0,
        remaining: 0,
        resetAt: new Date(Date.now() + retryAfter).toISOString(),
        requestId,
      });
    }
    default:
      return status >= 500
        ? new ServerError(message, { statusCode: status, requestId })
        : new HeadyError({ message, code: 'SERVER_ERROR', statusCode: status, requestId });
  }
};

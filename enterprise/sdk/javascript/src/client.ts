/**
 * @file client.ts
 * @description HTTP client wrapper with φ-exponential retry, auth header injection,
 * token refresh, and request/response interceptors.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { PHI, fibonacci, type HeadyConfig } from './types';
import {
  HeadyError,
  AuthError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  TokenExpiredError,
  fromHttpError,
} from './errors';

// ---------------------------------------------------------------------------
// Client Constants
// ---------------------------------------------------------------------------

const CLIENT_CONSTANTS = {
  DEFAULT_BASE_URL: 'https://api.headyme.com/v1',
  // Default timeout: 1000ms × φ^5 ≈ 11090ms
  DEFAULT_TIMEOUT_MS: Math.round(1000 * Math.pow(PHI, 5)),
  // Default max retries: fib(5)=5
  DEFAULT_MAX_RETRIES: fibonacci(5),
  // Retry base delay: 1000ms
  RETRY_BASE_MS: 1000,
  // Max retry delay: 1000ms × φ^8 ≈ 46370ms
  MAX_RETRY_DELAY_MS: Math.round(1000 * Math.pow(PHI, 8)),
  // Token refresh buffer: fib(5)=5 minutes before expiry
  TOKEN_REFRESH_BUFFER_MS: fibonacci(5) * 60 * 1000,
  // Request ID header
  REQUEST_ID_HEADER: 'X-Heady-Request-Id',
};

// ---------------------------------------------------------------------------
// Interceptor Types
// ---------------------------------------------------------------------------

export type RequestInterceptor = (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
export type ResponseInterceptor = (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;

// ---------------------------------------------------------------------------
// HTTP Client
// ---------------------------------------------------------------------------

export class HeadyHttpClient {
  private readonly axios: AxiosInstance;
  private readonly config: Required<Pick<HeadyConfig, 'apiKey' | 'baseUrl' | 'timeout' | 'maxRetries' | 'debug'>>;
  private accessToken?: string;
  private accessTokenExpiresAt?: Date;
  private refreshToken?: string;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: HeadyConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? CLIENT_CONSTANTS.DEFAULT_BASE_URL,
      timeout: config.timeout ?? CLIENT_CONSTANTS.DEFAULT_TIMEOUT_MS,
      maxRetries: config.maxRetries ?? CLIENT_CONSTANTS.DEFAULT_MAX_RETRIES,
      debug: config.debug ?? false,
    };

    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Heady-SDK': 'javascript/1.0.0',
        'X-Heady-SDK-Version': '1.0.0',
        ...(config.tenantId ? { 'X-Heady-Tenant': config.tenantId } : {}),
        ...(config.headers ?? {}),
      },
    });

    this.setupAxiosInterceptors();
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  /**
   * Set access/refresh token pair (for OAuth flow).
   */
  setTokens(accessToken: string, expiresAt: Date, refreshToken?: string): void {
    this.accessToken = accessToken;
    this.accessTokenExpiresAt = expiresAt;
    this.refreshToken = refreshToken;
  }

  /**
   * Check if the current access token needs refresh.
   */
  private needsTokenRefresh(): boolean {
    if (!this.accessToken || !this.accessTokenExpiresAt) return false;
    return this.accessTokenExpiresAt.getTime() - Date.now() < CLIENT_CONSTANTS.TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Refresh access token using the refresh token.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) return;
    try {
      const response = await this.axios.post<{ accessToken: string; expiresAt: string; refreshToken?: string }>(
        '/auth/token/refresh',
        { refreshToken: this.refreshToken }
      );
      const { accessToken, expiresAt, refreshToken } = response.data;
      this.setTokens(accessToken, new Date(expiresAt), refreshToken ?? this.refreshToken);
    } catch (err) {
      this.accessToken = undefined;
      this.accessTokenExpiresAt = undefined;
      this.refreshToken = undefined;
      throw new AuthError('Token refresh failed. Please re-authenticate.');
    }
  }

  /**
   * Get the current auth header value.
   */
  private getAuthHeader(): string {
    if (this.accessToken) return `Bearer ${this.accessToken}`;
    return `Bearer ${this.config.apiKey}`;
  }

  // ---------------------------------------------------------------------------
  // Interceptors
  // ---------------------------------------------------------------------------

  addRequestInterceptor(fn: RequestInterceptor): void {
    this.requestInterceptors.push(fn);
  }

  addResponseInterceptor(fn: ResponseInterceptor): void {
    this.responseInterceptors.push(fn);
  }

  private setupAxiosInterceptors(): void {
    // Request interceptor: inject auth header, token refresh, run custom interceptors
    this.axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      // Auto-refresh token if needed
      if (this.needsTokenRefresh()) {
        await this.refreshAccessToken();
      }

      // Inject auth header
      config.headers.Authorization = this.getAuthHeader();

      // Inject request ID for tracing
      config.headers[CLIENT_CONSTANTS.REQUEST_ID_HEADER] = this.generateRequestId();

      // Run custom interceptors
      let req: AxiosRequestConfig = config;
      for (const interceptor of this.requestInterceptors) {
        req = await interceptor(req);
      }

      if (this.config.debug) {
        console.debug('[HeadySDK] Request:', { method: config.method?.toUpperCase(), url: config.url });
      }

      return config;
    });

    // Response interceptor: run custom interceptors
    this.axios.interceptors.response.use(
      async (response: AxiosResponse) => {
        let res = response;
        for (const interceptor of this.responseInterceptors) {
          res = await interceptor(res);
        }
        if (this.config.debug) {
          console.debug('[HeadySDK] Response:', { status: response.status, requestId: response.headers?.[CLIENT_CONSTANTS.REQUEST_ID_HEADER.toLowerCase()] });
        }
        return res;
      },
      (error) => {
        // Transformed in withRetry
        return Promise.reject(error);
      }
    );
  }

  // ---------------------------------------------------------------------------
  // φ-Exponential Retry
  // ---------------------------------------------------------------------------

  /**
   * Calculate retry delay using φ-exponential backoff.
   * delay(n) = min(1000ms × φ^n, MAX_RETRY_DELAY_MS)
   */
  private retryDelay(attempt: number): number {
    const delay = Math.round(CLIENT_CONSTANTS.RETRY_BASE_MS * Math.pow(PHI, attempt));
    return Math.min(delay, CLIENT_CONSTANTS.MAX_RETRY_DELAY_MS);
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof HeadyError) return error.retryable;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (!status) return true; // Network error
      return status === 429 || status >= 500;
    }
    return false;
  }

  /**
   * Execute a request with φ-exponential retry on transient failures.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        // Transform axios errors to Heady errors
        const headyErr = this.transformError(err);

        // Handle token expiry
        if (headyErr instanceof TokenExpiredError && this.refreshToken) {
          await this.refreshAccessToken();
          continue;
        }

        // Rate limit: respect Retry-After
        if (headyErr instanceof RateLimitError && attempt < this.config.maxRetries) {
          await this.sleep(headyErr.retryAfterMs);
          continue;
        }

        if (!this.isRetryable(headyErr) || attempt === this.config.maxRetries) {
          throw headyErr;
        }

        const delay = this.retryDelay(attempt);
        if (this.config.debug) {
          console.debug(`[HeadySDK] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
        }
        await this.sleep(delay);
        lastError = headyErr;
      }
    }

    throw this.transformError(lastError);
  }

  /**
   * Transform an error to the appropriate HeadyError subtype.
   */
  private transformError(err: unknown): HeadyError {
    if (err instanceof HeadyError) return err;

    if (axios.isAxiosError(err)) {
      if (!err.response) {
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          return new TimeoutError(this.config.timeout);
        }
        return new NetworkError(err.message, { cause: err });
      }
      const requestId = err.response.headers?.[CLIENT_CONSTANTS.REQUEST_ID_HEADER.toLowerCase()];
      return fromHttpError(err.response.status, err.response.data, requestId);
    }

    if (err instanceof Error) {
      return new NetworkError(err.message, { cause: err });
    }

    return new HeadyError({ message: String(err), code: 'SERVER_ERROR' });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `sdk-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  // ---------------------------------------------------------------------------
  // HTTP Methods
  // ---------------------------------------------------------------------------

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.axios.get<T>(path, { params });
      return response.data;
    });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.axios.post<T>(path, body);
      return response.data;
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.axios.put<T>(path, body);
      return response.data;
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.axios.patch<T>(path, body);
      return response.data;
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.axios.delete<T>(path);
      return response.data;
    });
  }
}

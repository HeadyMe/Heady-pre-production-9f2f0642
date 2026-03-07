/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Built-in fetch wrapper for the Heady™ AI Platform.
 * Provides retry logic, configurable timeouts, and a circuit breaker
 * pattern using only Node.js built-in modules.
 * @module src/core/heady-fetch
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { createLogger } = require('../utils/logger');

const logger = createLogger('heady-fetch');

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

/**
 * @typedef {'CLOSED'|'OPEN'|'HALF_OPEN'} CircuitState
 */

/**
 * @typedef {Object} CircuitBreaker
 * @property {CircuitState} state
 * @property {number} failures
 * @property {number} successes
 * @property {number|null} openedAt
 */

/**
 * Per-host circuit breaker registry.
 * @type {Map<string, CircuitBreaker>}
 */
const _circuits = new Map();

/** Failure threshold before opening the circuit. */
const CB_FAILURE_THRESHOLD = 5;

/** Milliseconds to wait before allowing a probe request (HALF_OPEN). */
const CB_RESET_TIMEOUT_MS = 30000;

/** Number of successes in HALF_OPEN state needed to close the circuit. */
const CB_SUCCESS_THRESHOLD = 2;

/**
 * Returns or creates a circuit breaker for a given hostname.
 * @param {string} host
 * @returns {CircuitBreaker}
 */
function _getCircuit(host) {
  if (!_circuits.has(host)) {
    _circuits.set(host, { state: 'CLOSED', failures: 0, successes: 0, openedAt: null });
  }
  return _circuits.get(host);
}

/**
 * Returns whether a request to the host should be blocked by the circuit breaker.
 * @param {string} host
 * @returns {boolean}
 */
function _isCircuitOpen(host) {
  const cb = _getCircuit(host);
  if (cb.state === 'CLOSED') return false;
  if (cb.state === 'OPEN') {
    if (Date.now() - cb.openedAt >= CB_RESET_TIMEOUT_MS) {
      cb.state = 'HALF_OPEN';
      cb.successes = 0;
      logger.info(`Circuit breaker HALF_OPEN for ${host}`);
      return false;
    }
    return true;
  }
  return false; // HALF_OPEN: allow probe
}

/**
 * Records a successful request for circuit breaker tracking.
 * @param {string} host
 */
function _recordSuccess(host) {
  const cb = _getCircuit(host);
  cb.failures = 0;
  if (cb.state === 'HALF_OPEN') {
    cb.successes++;
    if (cb.successes >= CB_SUCCESS_THRESHOLD) {
      cb.state = 'CLOSED';
      cb.openedAt = null;
      logger.info(`Circuit breaker CLOSED for ${host}`);
    }
  }
}

/**
 * Records a failed request for circuit breaker tracking.
 * @param {string} host
 */
function _recordFailure(host) {
  const cb = _getCircuit(host);
  cb.failures++;
  if (cb.state === 'HALF_OPEN') {
    cb.state = 'OPEN';
    cb.openedAt = Date.now();
    logger.warn(`Circuit breaker re-OPEN for ${host} (probe failed)`);
    return;
  }
  if (cb.state === 'CLOSED' && cb.failures >= CB_FAILURE_THRESHOLD) {
    cb.state = 'OPEN';
    cb.openedAt = Date.now();
    logger.warn(`Circuit breaker OPEN for ${host} after ${cb.failures} failures`);
  }
}

// ---------------------------------------------------------------------------
// Core HTTP request
// ---------------------------------------------------------------------------

/**
 * Performs a single HTTP/HTTPS request using Node.js built-in modules.
 * @param {string} url
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {Object} [options.headers={}]
 * @param {string|Buffer|null} [options.body=null]
 * @param {number} [options.timeoutMs=30000]
 * @param {boolean} [options.parseJson=true]
 * @returns {Promise<{ status: number, headers: Object, body: string, json: Function }>}
 */
function _request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeoutMs = 30000,
    } = options;

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${url}`));
    }

    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const bodyBuf = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'User-Agent': 'HeadyFetch/3.1.0 (HeadySystems Inc.)',
      ...headers,
    };
    if (bodyBuf) {
      reqHeaders['Content-Length'] = String(bodyBuf.length);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: reqHeaders,
    };

    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: rawBody,
          json() {
            try {
              return JSON.parse(rawBody);
            } catch (e) {
              throw new Error(`Failed to parse JSON response: ${e.message}`);
            }
          },
          ok: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms: ${method} ${url}`));
    });

    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main headyFetch with retry + circuit breaker
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FetchOptions
 * @property {string} [method='GET'] - HTTP method
 * @property {Object} [headers={}] - Request headers
 * @property {*} [body] - Request body (auto-serialised to JSON)
 * @property {number} [timeoutMs=30000] - Request timeout in ms
 * @property {number} [retries=3] - Number of retry attempts
 * @property {number} [retryDelayMs=500] - Initial retry delay (doubles on each attempt)
 * @property {number[]} [retryOn=[408, 429, 500, 502, 503, 504]] - Status codes to retry on
 * @property {boolean} [circuitBreaker=true] - Enable circuit breaker
 * @property {string} [correlationId] - For request tracing
 */

/**
 * Fetches a URL with retry logic and circuit breaker protection.
 * @param {string} url
 * @param {FetchOptions} [options={}]
 * @returns {Promise<{ status: number, headers: Object, body: string, json: Function, ok: boolean }>}
 */
async function headyFetch(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 30000,
    retries = 3,
    retryDelayMs = 500,
    retryOn = [408, 429, 500, 502, 503, 504],
    circuitBreaker: useCB = true,
    correlationId,
  } = options;

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error(`headyFetch: Invalid URL "${url}"`);
  }

  const host = parsed.hostname;

  // Circuit breaker check
  if (useCB && _isCircuitOpen(host)) {
    throw new Error(`headyFetch: Circuit breaker OPEN for ${host} — request blocked`);
  }

  const reqHeaders = { ...headers };
  if (correlationId) reqHeaders['X-Heady-Correlation-Id'] = correlationId;

  let lastError;
  let attempt = 0;

  while (attempt <= retries) {
    const t0 = Date.now();
    try {
      const response = await _request(url, {
        method,
        headers: reqHeaders,
        body,
        timeoutMs,
      });

      const durationMs = Date.now() - t0;
      logger.debug(`${method} ${url} → ${response.status}`, {
        status: response.status,
        durationMs,
        attempt,
        correlationId,
      });

      if (retryOn.includes(response.status) && attempt < retries) {
        // Retry on specific status codes
        attempt++;
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`headyFetch: Retrying (${attempt}/${retries}) due to status ${response.status}`, { url, delay });
        await _sleep(delay);
        continue;
      }

      if (useCB) _recordSuccess(host);
      return response;

    } catch (err) {
      lastError = err;
      const durationMs = Date.now() - t0;
      logger.warn(`headyFetch: Request failed (attempt ${attempt + 1}/${retries + 1})`, {
        url, method, err: err.message, durationMs,
      });

      if (attempt < retries) {
        attempt++;
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await _sleep(delay);
      } else {
        break;
      }
    }
  }

  if (useCB) _recordFailure(host);
  throw lastError || new Error(`headyFetch: All ${retries + 1} attempts failed for ${url}`);
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * GET request.
 * @param {string} url
 * @param {FetchOptions} [options]
 */
headyFetch.get = (url, options = {}) => headyFetch(url, { ...options, method: 'GET' });

/**
 * POST request with JSON body.
 * @param {string} url
 * @param {*} body
 * @param {FetchOptions} [options]
 */
headyFetch.post = (url, body, options = {}) => headyFetch(url, { ...options, method: 'POST', body });

/**
 * PUT request with JSON body.
 */
headyFetch.put = (url, body, options = {}) => headyFetch(url, { ...options, method: 'PUT', body });

/**
 * PATCH request with JSON body.
 */
headyFetch.patch = (url, body, options = {}) => headyFetch(url, { ...options, method: 'PATCH', body });

/**
 * DELETE request.
 */
headyFetch.delete = (url, options = {}) => headyFetch(url, { ...options, method: 'DELETE' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Returns circuit breaker status for all tracked hosts.
 * @returns {Object}
 */
function getCircuitStatus() {
  /** @type {Object} */
  const result = {};
  for (const [host, cb] of _circuits) {
    result[host] = {
      state: cb.state,
      failures: cb.failures,
      successes: cb.successes,
      openedAt: cb.openedAt ? new Date(cb.openedAt).toISOString() : null,
    };
  }
  return result;
}

/**
 * Resets a specific circuit breaker (for admin/recovery).
 * @param {string} host
 */
function resetCircuit(host) {
  _circuits.set(host, { state: 'CLOSED', failures: 0, successes: 0, openedAt: null });
  logger.info(`Circuit breaker manually reset for ${host}`);
}

module.exports = headyFetch;
module.exports.headyFetch = headyFetch;
module.exports.getCircuitStatus = getCircuitStatus;
module.exports.resetCircuit = resetCircuit;

/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview HTTP server factory for the Heady™ AI Platform.
 * Replaces Express — provides routing, middleware pipeline, JSON body
 * parsing, and static file serving using only Node.js built-in modules.
 * @module src/core/heady-server
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { newCorrelationId } = require('../utils/logger');

const logger = createLogger('heady-server');

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// ---------------------------------------------------------------------------
// Route types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Route
 * @property {string} method - HTTP method (GET, POST, etc.) or '*' for any
 * @property {RegExp} pattern - Compiled URL pattern
 * @property {string[]} paramNames - Named parameter names from the path pattern
 * @property {Function[]} handlers - Ordered middleware/handler stack
 */

/**
 * Converts an Express-style path pattern to a RegExp.
 * Supports :param and *wildcard patterns.
 * @param {string} pathPattern
 * @returns {{ regex: RegExp, paramNames: string[] }}
 */
function _compilePath(pathPattern) {
  const paramNames = [];
  let regexStr = pathPattern
    .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&') // Escape special chars
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\\\*/g, '(.*)');

  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

class HeadyRouter {
  constructor() {
    /** @type {Route[]} */
    this._routes = [];
    /** @type {Function[]} */
    this._globalMiddleware = [];
  }

  /**
   * Adds a global middleware (runs before every route handler).
   * @param {Function} fn - (req, res, next) => void
   * @returns {HeadyRouter}
   */
  use(fn) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be a function');
    this._globalMiddleware.push(fn);
    return this;
  }

  /**
   * Registers a route handler for a specific method and path.
   * @param {string} method - HTTP method or '*'
   * @param {string} pathPattern - Route pattern (supports :params and *)
   * @param {...Function} handlers - One or more middleware/handler functions
   * @returns {HeadyRouter}
   */
  route(method, pathPattern, ...handlers) {
    const { regex, paramNames } = _compilePath(pathPattern);
    this._routes.push({
      method: method.toUpperCase(),
      pattern: regex,
      paramNames,
      handlers,
    });
    return this;
  }

  /** @param {string} p @param {...Function} h */ get(p, ...h) { return this.route('GET', p, ...h); }
  /** @param {string} p @param {...Function} h */ post(p, ...h) { return this.route('POST', p, ...h); }
  /** @param {string} p @param {...Function} h */ put(p, ...h) { return this.route('PUT', p, ...h); }
  /** @param {string} p @param {...Function} h */ patch(p, ...h) { return this.route('PATCH', p, ...h); }
  /** @param {string} p @param {...Function} h */ delete(p, ...h) { return this.route('DELETE', p, ...h); }
  /** @param {string} p @param {...Function} h */ head(p, ...h) { return this.route('HEAD', p, ...h); }
  /** @param {string} p @param {...Function} h */ options(p, ...h) { return this.route('OPTIONS', p, ...h); }
  /** @param {string} p @param {...Function} h */ all(p, ...h) { return this.route('*', p, ...h); }

  /**
   * Dispatches a request through the router.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @returns {Promise<boolean>} True if a route was matched
   */
  async dispatch(req, res) {
    const method = req.method.toUpperCase();
    const urlPath = req.url.split('?')[0];

    for (const route of this._routes) {
      if (route.method !== '*' && route.method !== method) continue;
      const match = urlPath.match(route.pattern);
      if (!match) continue;

      // Extract named parameters
      req.params = {};
      route.paramNames.forEach((name, i) => {
        req.params[name] = decodeURIComponent(match[i + 1] || '');
      });

      // Run handler chain
      const stack = route.handlers;
      let idx = 0;

      const next = async (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
          return;
        }
        if (idx >= stack.length) return;
        const handler = stack[idx++];
        try {
          await handler(req, res, next);
        } catch (handlerErr) {
          await next(handlerErr);
        }
      };

      await next();
      return true;
    }

    return false; // No route matched
  }
}

// ---------------------------------------------------------------------------
// Body parser
// ---------------------------------------------------------------------------

/**
 * Reads and parses the request body.
 * @param {import('http').IncomingMessage} req
 * @param {number} [maxBytes=10485760]
 * @returns {Promise<Buffer>}
 */
function _readBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HeadyServer
// ---------------------------------------------------------------------------

class HeadyServer {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.port=3301]
   * @param {string} [options.host='0.0.0.0']
   * @param {number} [options.bodyLimit=10485760]
   * @param {string} [options.staticDir] - Directory for static file serving
   * @param {string} [options.staticPrefix='/static'] - URL prefix for static files
   */
  constructor(options = {}) {
    this._port = options.port || 3301;
    this._host = options.host || '0.0.0.0';
    this._bodyLimit = options.bodyLimit || 10 * 1024 * 1024;
    this._staticDir = options.staticDir || null;
    this._staticPrefix = options.staticPrefix || '/static';
    this._router = new HeadyRouter();
    this._errorHandlers = [];
    /** @type {http.Server|null} */
    this._server = null;
  }

  // Delegate router methods
  use(fn) { this._router.use(fn); return this; }
  get(p, ...h) { this._router.get(p, ...h); return this; }
  post(p, ...h) { this._router.post(p, ...h); return this; }
  put(p, ...h) { this._router.put(p, ...h); return this; }
  patch(p, ...h) { this._router.patch(p, ...h); return this; }
  delete(p, ...h) { this._router.delete(p, ...h); return this; }
  head(p, ...h) { this._router.head(p, ...h); return this; }
  options(p, ...h) { this._router.options(p, ...h); return this; }
  all(p, ...h) { this._router.all(p, ...h); return this; }

  /**
   * Registers a global error handler.
   * @param {Function} fn - (err, req, res) => void
   */
  onError(fn) {
    this._errorHandlers.push(fn);
    return this;
  }

  /**
   * Core request handler — runs global middleware then dispatches to router.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async _handle(req, res) {
    const cid = req.headers['x-heady-correlation-id'] || newCorrelationId();
    req.correlationId = cid;
    req.startTime = Date.now();
    res.setHeader('X-Request-Id', cid);

    // Parse query string
    const [urlPath, queryString] = (req.url || '/').split('?');
    req.path = urlPath;
    req.query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};

    // Parse body for mutating methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const buf = await _readBody(req, this._bodyLimit);
        req.rawBody = buf;
        const ct = req.headers['content-type'] || '';
        if (ct.includes('application/json') && buf.length > 0) {
          try {
            req.body = JSON.parse(buf.toString('utf8'));
          } catch (_) {
            req.body = null;
          }
        } else if (ct.includes('application/x-www-form-urlencoded') && buf.length > 0) {
          req.body = Object.fromEntries(new URLSearchParams(buf.toString('utf8')));
        } else {
          req.body = buf.length > 0 ? buf : null;
        }
      } catch (err) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        return;
      }
    }

    // Static file serving
    if (this._staticDir && req.path.startsWith(this._staticPrefix)) {
      const served = await this._serveStatic(req, res);
      if (served) return;
    }

    // Run global middleware chain
    const globalStack = [...this._router._globalMiddleware];
    let gIdx = 0;

    const runGlobal = async (err) => {
      if (err) return this._handleError(err, req, res);
      if (gIdx >= globalStack.length) return this._router.dispatch(req, res);
      const mw = globalStack[gIdx++];
      try {
        await mw(req, res, runGlobal);
      } catch (mwErr) {
        await this._handleError(mwErr, req, res);
      }
    };

    const matched = await runGlobal().then(() => true).catch(async (err) => {
      await this._handleError(err, req, res);
      return true;
    });

    // 404 if no route matched and response not yet sent
    if (!res.writableEnded) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: req.path }));
    }
  }

  /**
   * Serves a static file from the configured directory.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @returns {Promise<boolean>} True if file was served
   */
  async _serveStatic(req, res) {
    const relativePath = req.path.slice(this._staticPrefix.length) || '/index.html';
    const filePath = path.join(this._staticDir, relativePath);

    // Security: prevent path traversal
    if (!filePath.startsWith(this._staticDir)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return true;
    }

    return new Promise((resolve) => {
      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          resolve(false);
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=3600',
          'Last-Modified': stat.mtime.toUTCString(),
        });
        fs.createReadStream(filePath).pipe(res);
        resolve(true);
      });
    });
  }

  /**
   * Handles uncaught errors in the request pipeline.
   * @param {Error} err
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  async _handleError(err, req, res) {
    logger.error('Unhandled server error', { err, path: req?.path, method: req?.method });

    for (const handler of this._errorHandlers) {
      try {
        await handler(err, req, res);
        if (res.writableEnded) return;
      } catch (_) { /* ignore */ }
    }

    if (!res.writableEnded) {
      const status = err.status || err.statusCode || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: status >= 500 ? 'Internal Server Error' : err.message,
        ...(process.env.HEADY_ENV !== 'production' && { detail: err.message }),
      }));
    }
  }

  /**
   * Starts the HTTP server.
   * @param {number} [port] - Override port
   * @param {string} [host] - Override host
   * @returns {Promise<http.Server>}
   */
  listen(port, host) {
    this._port = port || this._port;
    this._host = host || this._host;

    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => {
        this._handle(req, res).catch((err) => {
          logger.fatal('Fatal error in request handler', { err });
        });
      });

      this._server.on('error', reject);
      this._server.listen(this._port, this._host, () => {
        logger.logSystem('server:listen', { port: this._port, host: this._host });
        resolve(this._server);
      });
    });
  }

  /**
   * Gracefully closes the server.
   * @returns {Promise<void>}
   */
  close() {
    return new Promise((resolve, reject) => {
      if (!this._server) return resolve();
      this._server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /**
   * Returns the underlying http.Server instance.
   * @returns {http.Server|null}
   */
  get httpServer() {
    return this._server;
  }

  /**
   * Returns the actual bound port (useful when port was 0).
   * @returns {number}
   */
  get boundPort() {
    return this._server?.address()?.port || this._port;
  }
}

/**
 * Creates and returns a new HeadyServer instance.
 * @param {Object} [options]
 * @returns {HeadyServer}
 */
function createServer(options = {}) {
  return new HeadyServer(options);
}

module.exports = { HeadyServer, HeadyRouter, createServer, MIME_TYPES };

/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Environment loader for the Heady™ AI Platform.
 * Replaces dotenv — parses .env files and populates process.env
 * without any external dependencies.
 * @module src/core/heady-env
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses a .env file string into a key-value map.
 * Supports:
 *   - KEY=value
 *   - KEY="quoted value"
 *   - KEY='single quoted'
 *   - # comments (full line and inline)
 *   - Multi-line values with escaped newlines: KEY="line1\nline2"
 *   - Export prefix: export KEY=value
 *   - Blank lines are ignored
 *
 * @param {string} content - Raw .env file content
 * @returns {Record<string, string>}
 */
function parse(content) {
  /** @type {Record<string, string>} */
  const result = {};

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    let line = lines[i].trimStart();
    i++;

    // Skip blank lines and comments
    if (!line || line.startsWith('#')) continue;

    // Strip optional 'export ' prefix
    if (line.startsWith('export ')) {
      line = line.slice(7).trimStart();
    }

    // Find the first '=' separator
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trimEnd();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let rawValue = line.slice(eqIdx + 1);

    // Strip inline comment if value is not quoted
    let value;
    if (rawValue.startsWith('"')) {
      // Double-quoted: read until closing unescaped "
      const match = rawValue.match(/^"((?:[^"\\]|\\.)*)"/);
      if (match) {
        value = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\"/g, '"');
      } else {
        value = rawValue.slice(1); // Malformed — just strip leading quote
      }
    } else if (rawValue.startsWith("'")) {
      // Single-quoted: no escape processing, read until closing '
      const match = rawValue.match(/^'([^']*)'/);
      value = match ? match[1] : rawValue.slice(1);
    } else {
      // Unquoted: strip inline comment and trailing whitespace
      value = rawValue.replace(/#.*$/, '').trimEnd();
    }

    result[key] = value;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads environment variables from a .env file into process.env.
 * Variables already present in process.env are NOT overwritten (by default).
 *
 * @param {Object} [options={}]
 * @param {string} [options.path] - Path to .env file (default: .env in cwd)
 * @param {boolean} [options.override=false] - If true, overwrite existing env vars
 * @param {boolean} [options.silent=false] - If true, suppress file-not-found warnings
 * @param {string} [options.encoding='utf8'] - File encoding
 * @returns {{ parsed: Record<string, string>, path: string, error?: Error }}
 */
function loadEnv(options = {}) {
  const {
    path: envPath = path.resolve(process.cwd(), '.env'),
    override = false,
    silent = false,
    encoding = 'utf8',
  } = options;

  let content;
  try {
    content = fs.readFileSync(envPath, { encoding });
  } catch (err) {
    if (!silent && err.code !== 'ENOENT') {
      process.stderr.write(`[heady-env] Warning: could not read ${envPath}: ${err.message}\n`);
    }
    return { parsed: {}, path: envPath, error: err };
  }

  const parsed = parse(content);
  let loaded = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(parsed)) {
    if (!override && key in process.env) {
      skipped++;
      continue;
    }
    process.env[key] = value;
    loaded++;
  }

  if (!silent) {
    process.stderr.write(`[heady-env] Loaded ${loaded} vars from ${envPath}${skipped ? ` (${skipped} skipped — already set)` : ''}\n`);
  }

  return { parsed, path: envPath };
}

/**
 * Loads multiple .env files in order. Later files take precedence
 * (only if override is enabled).
 *
 * @param {string[]} paths - Array of .env file paths
 * @param {Object} [options={}]
 * @returns {Record<string, string>} Combined parsed map
 */
function loadEnvFiles(paths, options = {}) {
  /** @type {Record<string, string>} */
  const combined = {};
  for (const p of paths) {
    const { parsed } = loadEnv({ ...options, path: p });
    Object.assign(combined, parsed);
  }
  return combined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the value of an environment variable, or throws if missing.
 * @param {string} key
 * @returns {string}
 * @throws {Error} If the variable is not set
 */
function requireEnv(key) {
  const val = process.env[key];
  if (val === undefined || val === '') {
    throw new Error(`[heady-env] Required environment variable "${key}" is not set`);
  }
  return val;
}

/**
 * Returns the value of an environment variable, or the default.
 * @param {string} key
 * @param {string} [defaultValue='']
 * @returns {string}
 */
function getEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Returns true if we're running in production.
 * @returns {boolean}
 */
function isProduction() {
  return (process.env.HEADY_ENV || process.env.NODE_ENV) === 'production';
}

/**
 * Returns true if we're running in a test environment.
 * @returns {boolean}
 */
function isTest() {
  return (process.env.HEADY_ENV || process.env.NODE_ENV) === 'test';
}

/**
 * Returns true if we're running in development.
 * @returns {boolean}
 */
function isDevelopment() {
  const env = process.env.HEADY_ENV || process.env.NODE_ENV;
  return !env || env === 'development';
}

module.exports = {
  parse,
  loadEnv,
  loadEnvFiles,
  requireEnv,
  getEnv,
  isProduction,
  isTest,
  isDevelopment,
};
